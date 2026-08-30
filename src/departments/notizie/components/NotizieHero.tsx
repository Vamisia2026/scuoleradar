import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CalendarClock,
  FileCheck2,
  Newspaper,
} from 'lucide-react';
import { newsArticles } from '../services/newsService';
import { SeoMeta } from './SeoMeta';

/**
 * Copy editoriale ufficiale della pagina Notizie (nuova edizione).
 * Linguaggio diretto, zero marketing: il blog è un filtro sulle fonti.
 */
export const SOTTOTITOLO_NOTIZIE =
  'Controlliamo noi, perché tu non perda tempo. Solo notizie reali e scadenze, dal MIM e dalla Gazzetta Ufficiale.';

/**
 * Slogan della pagina Notizie: compare sotto il sottotitolo, sopra i badge
 * di fiducia, in carattere display regolare (non corsivo).
 */
export const SLOGAN_NOTIZIE =
  'Quando vuoi sapere cosa succede di importante, vieni qui!';

/**
 * Data della Pasqua (Calendario gregoriano) — algoritmo di Meeus/Jones/Butcher.
 * Ritorna un Date locale a mezzanotte: nessuna ambiguità di fuso orario.
 */
export function dataPasqua(anno: number): Date {
  const a = anno % 19;
  const b = Math.floor(anno / 100);
  const c = anno % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mese = Math.floor((h + l - 7 * m + 114) / 31); // 3 = marzo, 4 = aprile
  const giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anno, mese - 1, giorno);
}

/**
 * Differenza in GIORNI CIVILI tra due Date locali a mezzanotte.
 * Il confronto avviene tramite `Date.UTC(anno, mese, giorno)`: immune ai
 * cambi di ora legale (DST) e a qualsiasi offset di fuso orario.
 */
function giorniCiviliTra(dal: Date, al: Date): number {
  const base = Date.UTC(dal.getFullYear(), dal.getMonth(), dal.getDate());
  const arrivo = Date.UTC(al.getFullYear(), al.getMonth(), al.getDate());
  return Math.round((arrivo - base) / 86_400_000);
}

/**
 * Conto alla rovescia per le vacanze scolastiche, basato sulla data odierna:
 *   - 30 giu → 31 ago : ESTATE → il conteggio è nascosto (box solo scadenza)
 *   - 1 set → 22 dic  : "XX giorni alle vacanze di Natale"
 *   - 23 dic → Pasqua : "XX giorni alle vacanze di Pasqua"
 *   - Pasqua → 29 giu : "XX giorni alle vacanze estive"
 * Tutte le date sono locali a mezzanotte (`new Date(anno, mese, giorno)`):
 * nessuno spostamento di fuso orario nei confronti tra date.
 */
export function prossimeVacanze(oggi: Date): {
  estate: boolean;
  giorni: number;
  nome: string;
} {
  const anno = oggi.getFullYear();
  const inizioEstate = new Date(anno, 5, 30); // 30 giugno
  const fineEstate = new Date(anno, 7, 31); // 31 agosto

  // Estate (30 giu – 31 ago): il conteggio viene nascosto, box solo scadenza.
  if (
    oggi.getTime() >= inizioEstate.getTime() &&
    oggi.getTime() <= fineEstate.getTime()
  ) {
    return { estate: true, giorni: 0, nome: '' };
  }

  const natale = new Date(anno, 11, 23); // inizio vacanze di Natale
  const primoSettembre = new Date(anno, 8, 1);
  const primoGiornoEstate = new Date(anno, 5, 30); // primo giorno di vacanze estive
  let pasqua = dataPasqua(anno);

  let target: Date;
  let nome: string;

  if (oggi.getTime() >= natale.getTime()) {
    // 23 dic → 31 dic: la prossima Pasqua è quella della stagione successiva.
    pasqua = dataPasqua(anno + 1);
    target = pasqua;
    nome = 'vacanze di Pasqua';
  } else if (oggi.getTime() >= primoSettembre.getTime()) {
    // 1 set → 22 dic: vacanze di Natale.
    target = natale;
    nome = 'vacanze di Natale';
  } else if (oggi.getTime() >= pasqua.getTime()) {
    // Pasqua → 29 giu: vacanze estive (inizio 30 giugno).
    target = primoGiornoEstate;
    nome = 'vacanze estive';
  } else {
    // 1 gen → (Pasqua - 1): vacanze di Pasqua.
    target = pasqua;
    nome = 'vacanze di Pasqua';
  }

  // Differenza in giorni civili tra due mezzanotte locali: nessun offset di
  // fuso orario, nessun errore di arrotondamento DST.
  const giorni = Math.max(0, giorniCiviliTra(oggi, target));
  return { estate: false, giorni, nome };
}

/** Data locale a mezzanotte da una stringa ISO "YYYY-MM-DD" (senza shift di fuso). */
function dataLocaleDaIso(iso: string): Date {
  const [anno, mese, giorno] = iso.split('-').map(Number);
  return new Date(anno, mese - 1, giorno);
}

/** Formatta una data locale come "1 settembre" (prima lettera maiuscola). */
function etichettaItaliana(data: Date): string {
  const testo = data.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'long',
  });
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

/** Parole da rimuovere in coda alla sintesi dell'evento (articoli/preposizioni). */
const STOPWORDS = new Set([
  'e', 'ed', 'o', 'di', 'del', 'della', 'dei', 'delle', 'il', 'la', 'le', 'gli',
  'lo', 'per', 'con', 'al', 'alla', 'ai', 'alle', 'dal', 'dalla', 'dai', 'dalle',
  'nel', 'nella', 'nei', 'nelle', 'sul', 'sulla', 'sui', 'sulle', 'in', 'a', 'da',
  'un', 'una', 'che', 'su',
]);

/**
 * Sintetizza il nome dell'evento a partire da un titolo di notizia:
 *  - prende il topic PRIMA dei ":" (e prima della prima virgola);
 *  - rimuove date e anni ripetuti (es. "1° settembre", "1°luglio", "2026", "2026/27");
 *  - conserva al massimo 3 parole significative (senza articoli in coda);
 *  - restituisce il testo in MAIUSCOLO (es. "PRESA DI SERVIZIO", "BOLLETTINI GPS").
 */
export function sintetizzaEvento(titolo: string): string {
  const topic = (titolo.split(':')[0] ?? '').split(',')[0] ?? '';
  const pulito = topic
    .replace(
      /\d{1,2}°?\s*(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)/gi,
      ' ',
    )
    .replace(/\b20\d{2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/\b\d{2}\/\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parole = pulito.split(' ').filter(Boolean).slice(0, 3);
  while (
    parole.length > 0 &&
    STOPWORDS.has(parole[parole.length - 1].toLowerCase())
  ) {
    parole.pop();
  }

  if (parole.length === 0) {
    return topic.split(' ').filter(Boolean).slice(0, 3).join(' ').toUpperCase();
  }
  return parole.join(' ').toUpperCase();
}

/**
 * Prossimo evento UFFICIALE del calendario scolastico (fallback dinamico
 * quando nessuna scadenza delle notizie è attiva): presa di servizio,
 * vacanze di Natale, Pasqua, fine delle lezioni — il primo con data >= oggi.
 * Gli eventi sono calcolati per la stagione scolastica corrente (settembre →
 * agosto) e cambiano automaticamente con la data odierna.
 */
export function prossimoEventoAccademico(oggi: Date): { etichetta: string; evento: string } {
  const anno = oggi.getFullYear();
  const mese = oggi.getMonth();
  // Autunno di riferimento della stagione scolastica corrente:
  // se oggi è da settembre in poi, l'anno scolastico è quello corrente,
  // altrimenti quello iniziato l'anno solare precedente.
  const autunno = mese >= 8 ? anno : anno - 1;

  const eventi = [
    { data: new Date(autunno, 8, 1), nome: 'Presa di servizio' },
    { data: new Date(autunno, 11, 23), nome: 'Vacanze di Natale' },
    { data: dataPasqua(autunno + 1), nome: 'Vacanze di Pasqua' },
    { data: new Date(autunno + 1, 5, 8), nome: 'Fine delle lezioni' },
    { data: new Date(autunno + 1, 8, 1), nome: 'Presa di servizio' },
  ];

  const prossimo = eventi
    .filter((e) => e.data.getTime() >= oggi.getTime())
    .sort((a, b) => a.data.getTime() - b.data.getTime())[0];

  const evento = prossimo ?? eventi[0];
  return {
    etichetta: etichettaItaliana(evento.data),
    evento: sintetizzaEvento(evento.nome),
  };
}

/**
 * Prima scadenza ATTIVA dal servizio notizie (data di scadenza >= oggi,
 * la più vicina), oppure fallback al prossimo evento del calendario
 * scolastico ufficiale quando non ci sono scadenze specifiche.
 */
export function trovaProssimaScadenza(oggi: Date): { etichetta: string; evento: string } {
  const prossima = newsArticles
    .filter((a) => a.deadline_date)
    .map((a) => ({ articolo: a, data: dataLocaleDaIso(a.deadline_date as string) }))
    .filter(
      (x) => !Number.isNaN(x.data.getTime()) && x.data.getTime() >= oggi.getTime(),
    )
    .sort((a, b) => a.data.getTime() - b.data.getTime())[0];

  if (prossima) {
    return {
      etichetta: etichettaItaliana(prossima.data),
      evento: sintetizzaEvento(prossima.articolo.title),
    };
  }
  return prossimoEventoAccademico(oggi);
}

/**
 * Hero editoriale del Dipartimento Notizie (stile "Daily Planet"):
 * masthead serif con righe doppie, sottotitolo + slogan, widget
 * "PROSSIMA SCADENZA IMPORTANTE" a destra e CTA di registrazione in basso.
 */
export function NotizieHero() {
  const [oggi, setOggi] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Aggiornamento automatico alla mezzanotte: quando una scadenza passa,
  // il widget passa subito alla successiva senza ricaricare la pagina.
  useEffect(() => {
    const timer = setInterval(() => {
      setOggi((prev) => {
        const ora = new Date();
        ora.setHours(0, 0, 0, 0);
        return ora.getTime() === prev.getTime() ? prev : ora;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Prima scadenza attiva (data >= oggi) dalle notizie, oppure fallback al
  // prossimo evento ufficiale del calendario scolastico.
  const prossimaScadenza = useMemo(() => trovaProssimaScadenza(oggi), [oggi]);

  // Conto alla rovescia per le vacanze (in estate il box mostra solo la scadenza).
  const contoVacanze = useMemo(() => prossimeVacanze(oggi), [oggi]);

  return (
    <>
      <SeoMeta
        titolo="Notizie e scadenze ufficiali per la scuola"
        descrizione={SOTTOTITOLO_NOTIZIE}
        urlCanonica="/notizie"
      />
      <section
        aria-label="Rassegna stampa di notizie e scadenze per la scuola"
        className="bg-gradient-to-b from-primary-50 to-white"
      >
        <div className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6 sm:pt-10">
          <div className="grid gap-8 md:grid-cols-12">
            {/* Colonna sinistra — masthead editoriale */}
            <div className="md:col-span-7">
              <div className="border-y-4 border-double border-primary-900/80 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Newspaper className="h-3.5 w-3.5" />
                    Rassegna stampa
                  </span>
                  <span className="hidden sm:inline">Edizione Docenti &amp; ATA</span>
                </div>
                <h1 className="mt-2 font-display text-3xl font-black leading-tight tracking-tight text-primary-900 sm:text-4xl">
                  Notizie <span className="text-secondary-500">per chi lavora nella Scuola</span>
                </h1>
              </div>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-primary-700 sm:text-lg">
                {SOTTOTITOLO_NOTIZIE}
              </p>

              {/* Slogan: sotto il sottotitolo, sopra i badge di fiducia */}
              <p className="mt-3 font-display text-xl font-semibold leading-snug text-primary-900 sm:text-2xl">
                «{SLOGAN_NOTIZIE}»
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <BadgeCheck className="h-3.5 w-3.5 text-accent-500" />
                  Solo fonti ufficiali verificate
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <FileCheck2 className="h-3.5 w-3.5 text-secondary-500" />
                  Max 3 articoli a settimana
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                  <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent-500" />
                  Aggiornato ogni giorno
                </span>
              </div>
            </div>

            {/* Colonna destra — prossima scadenza importante */}
            <div className="md:col-span-5">
              <aside
                aria-label="Prossima scadenza importante e conto alla rovescia per le vacanze"
                className="flex h-full flex-col overflow-hidden rounded-xl border border-primary-100 bg-white shadow-card"
              >
                {/* Sezione principale — in estate (scuola non ancora iniziata)
                    riempie tutta l'altezza con elementi ingranditi; a scuola
                    iniziata si scala leggermente per lasciare spazio al conteggio. */}
                <div
                  className={`flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center ${
                    contoVacanze.estate ? 'py-8' : 'py-5'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CalendarClock
                      className={`shrink-0 text-secondary-500 ${
                        contoVacanze.estate ? 'h-5 w-5' : 'h-4 w-4'
                      }`}
                    />
                    <span
                      className={`font-bold uppercase tracking-[0.22em] text-primary-500 ${
                        contoVacanze.estate ? 'text-sm' : 'text-xs'
                      }`}
                    >
                      Prossima scadenza importante
                    </span>
                  </div>
                  <p
                    className={`font-display font-black leading-none tracking-tight text-primary-900 ${
                      contoVacanze.estate
                        ? 'mt-2 text-5xl sm:text-6xl'
                        : 'mt-1 text-4xl sm:text-5xl'
                    }`}
                  >
                    {prossimaScadenza.etichetta}
                  </p>
                  <p
                    className={`mx-auto max-w-[17rem] font-bold uppercase leading-snug tracking-[0.16em] text-secondary-600 ${
                      contoVacanze.estate
                        ? 'mt-2 text-2xl'
                        : 'mt-1 text-lg sm:text-xl'
                    }`}
                  >
                    {prossimaScadenza.evento}
                  </p>
                </div>

                {/* Scuola iniziata: divisore orizzontale + conteggio vacanze */}
                {!contoVacanze.estate && (
                  <>
                    <div className="mx-auto w-2/3 border-t border-dashed border-primary-100" />
                    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-5 py-4 text-center">
                      <p className="font-display text-3xl font-black leading-none tracking-tight text-primary-900 sm:text-4xl">
                        {contoVacanze.giorni}
                        <span className="ml-2 align-baseline text-base font-bold uppercase tracking-[0.18em] text-primary-500">
                          {contoVacanze.giorni === 1 ? 'giorno' : 'giorni'}
                        </span>
                      </p>
                      <p className="text-sm font-semibold text-primary-700">
                        Alle {contoVacanze.nome}.
                      </p>
                    </div>
                  </>
                )}
              </aside>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

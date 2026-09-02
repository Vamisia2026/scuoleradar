import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  FileCheck2,
  Newspaper,
} from 'lucide-react';
import { SeoMeta } from './SeoMeta';
import { RevolverScadenze } from '@/departments/scadenze';

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

/**
 * Hero editoriale del Dipartimento Notizie (stile "Daily Planet"):
 * masthead serif con righe doppie, sottotitolo + slogan, e a destra il
 * widget Scadenze con il revolver orizzontale delle 10 prossime scadenze
 * operative e il conto alla rovescia per le vacanze in basso.
 */
export interface NotizieHeroProps {
  /** Voci del menu categorie (es. 'Tutte', 'GPS', 'Mobilità'…). */
  categorie?: string[];
  /** Conteggio articoli per categoria (chiavi = nomi categoria). */
  conteggi?: Record<string, number>;
  /** Categoria attiva (default 'Tutte'). */
  categoria?: string;
  /** Callback quando l'admin/cliente cambia categoria. */
  onCategoriaChange?: (categoria: string) => void;
}

export function NotizieHero({
  categorie = [],
  conteggi = {},
  categoria = 'Tutte',
  onCategoriaChange,
}: NotizieHeroProps = {}) {
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
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4">
          <div className="grid w-full max-w-full grid-cols-1 gap-x-8 gap-y-6 overflow-x-hidden lg:grid-cols-12">
            {/* Colonna sinistra — masthead editoriale */}
            <div className="flex min-w-0 flex-col lg:col-span-7">
              <div className="border-b-4 border-double border-primary-900/80 py-3 sm:py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-primary-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Newspaper className="h-3.5 w-3.5" />
                    Rassegna stampa
                  </span>
                  <span className="hidden sm:inline">Edizione Docenti &amp; ATA</span>
                </div>
                <h1 className="mt-2 font-display text-2xl font-black leading-tight tracking-tight text-primary-900 sm:text-4xl">
                  Notizie <span className="text-secondary-500">per chi lavora nella Scuola</span>
                </h1>
              </div>

              <p className="mt-3 min-w-0 max-w-xl text-sm leading-relaxed text-primary-700 sm:text-lg">
                {SOTTOTITOLO_NOTIZIE}
              </p>

              {/* Slogan: sotto il sottotitolo, sopra i badge di fiducia */}
              <p className="mt-2 font-display text-xl font-semibold leading-snug text-primary-900 sm:text-2xl">
                «{SLOGAN_NOTIZIE}»
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
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

              {/* Menu Categorie: subito sotto i badge di verifica, occupa lo spazio
                  residuo della colonna e chiude il suo bordo inferiore in linea con
                  il fondo del box "PROSSIME SCADENZE" a destra. */}
              {onCategoriaChange && categorie.length > 0 && (
                <div
                  role="toolbar"
                  aria-label="Filtra le notizie per categoria"
                  className="mt-4 flex w-full min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap py-1 no-scrollbar lg:flex-wrap lg:overflow-visible lg:whitespace-normal"
                >
                  <span className="mr-1 shrink-0 text-[11px] font-black uppercase tracking-[0.16em] text-secondary-600">
                    Categorie
                  </span>
                  {categorie.map((c) => {
                    const attiva = categoria === c;
                    const conteggio = conteggi[c] ?? 0;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => onCategoriaChange(c)}
                        aria-pressed={attiva}
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                          attiva
                            ? 'bg-primary-700 text-white shadow-soft'
                            : 'bg-white text-primary-600 ring-1 ring-inset ring-primary-200 hover:bg-primary-50'
                        }`}
                      >
                        {c}
                        {c !== 'Tutte' && conteggio > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              attiva ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-500'
                            }`}
                          >
                            {conteggio}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Colonna destra — widget Scadenze: revolver (2/3) + countdown (1/3) */}
            <div className="w-full min-w-0 max-w-full lg:col-span-5">
              <aside
                aria-label="Prossime scadenze operative e conto alla rovescia per le vacanze"
                className="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-primary-100 bg-white shadow-card"
              >
                {/* Revolver Scadenze — 2/3 dell'altezza (in estate occupa tutto il box). */}
                <RevolverScadenze
                  className={contoVacanze.estate ? 'min-h-0 flex-1' : 'min-h-0 flex-[2]'}
                />

                {/* Scuola iniziata: divisorio netto + conteggio vacanze (1/3 del box),
                    compatto per stare nella fascia inferiore senza tagli. */}
                {!contoVacanze.estate && (
                  <>
                    <div className="mx-5 shrink-0 border-b-2 border-gray-300" />
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-3 pb-3 pt-1.5 text-center sm:px-5">
                      <p className="font-display text-2xl font-black leading-none tracking-tight text-primary-900 sm:text-3xl">
                        {contoVacanze.giorni}
                        <span className="ml-2 align-baseline text-sm font-bold uppercase tracking-[0.16em] text-primary-500 sm:text-base">
                          {contoVacanze.giorni === 1 ? 'giorno' : 'giorni'}
                        </span>
                      </p>
                      <p className="w-full min-w-0 text-xs font-bold uppercase leading-snug tracking-[0.14em] text-secondary-600 sm:text-sm">
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

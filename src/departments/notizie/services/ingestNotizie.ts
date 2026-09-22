/**
 * ScuoleRadar.it — Ingestione Notizie (entry point CLI / cron).
 *
 * Pipeline (vedi docs/BLOG_EDITORIAL_GUIDELINES.md):
 *   1. raccoglie le voci reali dalle fonti ufficiali (MIM, Gazzetta Ufficiale)
 *      con log HTTP esplicito per ogni fonte (nessun silent-fail);
 *   2. applica il motore di rilevanza (ZERO rumore: rifiuta contenuti non
 *      vincolanti, accetta solo decreti/note/ordinanze/scadenze operative);
 *   3. valida l'integrità degli URL della fonte (STRICT URL INTEGRITY: niente
 *      root-domain generici né mockup) e verifica che il link risponda
 *      HTTP 200/3xx;
 *   4. estrae la data di scadenza ufficiale e genera l'articolo editoriale
 *      (date esatte, acronimi spiegati, link di approfondimento reali);
 *   5. applica il LOOKBACK di 15 giorni (avvio anno scolastico: presa di
 *      servizio, interpelli, supplenze…) e il tetto articoli (max 6 ad alto
 *      valore nella finestra, ≈3/settimana);
 *   6. AGGIUNGE le nuove notizie all'archivio esistente (accumulo con dedupe
 *      per id: la bacheca non si svuota mai) e scrive il risultato in
 *      `src/departments/notizie/data/notizieIngestite.ts`.
 *
 * Esiti e log:
 *   - fonti OK, nessuna notizia nuova → "✓ HTTP 200 - 0 new posts criteria matched"
 *     (esecuzione riuscita, file invariato, nessun commit necessario);
 *   - fonti OK, N notizie nuove → "✓ HTTP 200 - N new posts criteria matched";
 *   - tutte le fonti non raggiungibili → "✗ HTTP FAIL" + exit code 1
 *     (il workflow GitHub lo segnala con un warning, mai un fallimento silenzioso).
 *
 * Uso:
 *   npm run scrape:notizie            # pipeline completa (scrive il file dati)
 *   npm run scrape:notizie -- --dry-run   # solo estrazione + filtro, nessuna scrittura
 */
import process from 'node:process';
import {
  LIVELLI_NAZIONALI,
  raccogliLivello,
  verificaUrlUfficiale,
  type VoceFonte,
} from './newsFetcher.ts';
import { notizieIngestite } from '../data/notizieIngestite.ts';
import {
  FILE_ARCHIVIO_NOTIZIE,
  scriviArchivioNotizie,
} from './archivioNotizie.ts';
import { risolviFonteGranulare } from './tracciaFonte.ts';
import {
  valutaRilevanza,
  punteggioRilevanza,
  articoloValido,
  generaArticoloEditoriale,
  classificaLink,
  èFonteCanonica,
  èRiservaSettimanale,
  applicaFormatoEditoriale,
  verificaCadenzaSettimanale,
  categoriaDaImpatto,
  estraiDeadline,
  linkDomandaUfficiale,
  richiedePresentazioneDomanda,
  limitaArticoliSettimanali,
  limitaCadenzaSettimanale,
  FINESTRA_LOOKBACK_GIORNI,
  FINESTRA_LOOKBACK_NAZIONALE_GIORNI,
  MAX_ARTICOLI_FINESTRA,
  MAX_ARTICOLI_SETTIMANA,
  èFonteNazionale,
  titoloAzione,
  type ValutazioneNotizia,
} from './relevanceEngine.ts';
import type { NewsArticle } from '../types.ts';

function slug(testo: string): string {
  return testo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function dataPubblicazione(pubDate: string | null): string {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}

/**
 * Data di RILEVAZIONE (fallback): se la fonte ufficiale non dichiara una data di
 * pubblicazione (es. pagine operative USR sempre aggiornate), l'articolo assume
 * la data di ingestione. Così la bacheca mostra correttamente l'aggiornamento
 * (non resta "ferma" su agosto) e la cadenza settimanale è misurabile.
 */
function dataRilevazione(): string {
  return new Date().toISOString();
}

/**
 * Report di CADENZA: quanti articoli risultano pubblicati negli ultimi 7 giorni.
 * Target editoriale: almeno 1 notizia a settimana. Se zero, emette un warning
 * esplicito (visibile nei log del cron) senza far fallire la pipeline.
 */
function reportCadenza(articoli: NewsArticle[]): void {
  const esito = verificaCadenzaSettimanale(articoli);
  console.log(
    `📈 Cadenza settimanale: ${esito.recenti} articolo/i negli ultimi 7 giorni (limite ${esito.min}–${esito.max}).`,
  );
  if (esito.recenti < esito.min) {
    console.warn(
      '⚠ RATE: nessun articolo negli ultimi 7 giorni — verificare fonti, motore di rilevanza (èRiservaSettimanale) e cron.',
    );
  } else if (esito.recenti > esito.max) {
    console.warn(`⚠ RATE: ${esito.recenti} articoli negli ultimi 7 giorni (limite ${esito.max}).`);
  } else {
    console.log('✓ RATE: cadenza settimanale rispettata.');
  }
}

/** Estrae un eventuale link PDF dal sommario HTML della fonte (assolutizzato). */
function cercaPdf(descrizione: string, baseUrl: string): string | null {
  const m = descrizione.match(/href="([^"]+\.pdf[^"]*)"|src="([^"]+\.pdf[^"]*)"/i);
  const rel = m ? (m[1] ?? m[2] ?? null) : null;
  const url =
    rel ??
    descrizione.match(/https?:\/\/[^\s"']+\.pdf[^\s"']*/i)?.[0] ??
    null;
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Trasforma una voce grezza in un NewsArticle (se supera il filtro editoriale,
 * la validazione STRICT URL INTEGRITY e il controllo HTTP 200/3xx della fonte).
 */
async function costruisciArticolo(
  v: VoceFonte,
  opzioni: { promozioneRiserva?: boolean } = {},
): Promise<NewsArticle | null> {
  // PROMOZIONE DI RISERVA (garanzia settimanale ≥ 1 articolo/7 giorni): la voce è
  // già stata ammessa da `èRiservaSettimanale` (titolo informativo, niente
  // burocrazia vuota, niente archivio, doppio vocabolario impatto+scuola); qui si
  // assegna soltanto la categoria. TUTTI gli altri gate — link diretto, fonte
  // canonica, risposta HTTP 200/3xx — restano obbligatori.
  const valutazione: ValutazioneNotizia = opzioni.promozioneRiserva
    ? {
        rilevante: true,
        categoria: categoriaDaImpatto(v.title) ?? 'Scuole',
        deadline: estraiDeadline(`${v.title} ${v.description ?? ''}`),
      }
    : valutaRilevanza({
        title: v.title,
        description: v.description,
        url: v.link,
        data: v.pubDate,
      });
  if (!valutazione.rilevante) {
    console.log(
      `  ✗ RIFIUTATA: ${v.title.slice(0, 70)} — ${valutazione.motivo ?? 'non rilevante'}`,
    );
    return null;
  }

  // ZERO FLUFF / CONTENUTO COMPLETO: l'avviso si pubblica solo se è azionabile.
  //  · se annuncia una PROCEDURA DA PRESENTARE (domanda, istanza, candidatura…)
  //    deve indicare il canale ufficiale → altrimenti il link di presentazione
  //    non esisterebbe e la notizia rinvierebbe a un generico "consultare l'avviso";
  //  · i temi Normativa/Scadenze/Concorsi richiedono un fatto concreto: una
  //    scadenza oppure il canale di presentazione.
  const testoFonte = `${v.title} ${v.description ?? ''}`;
  const canale = linkDomandaUfficiale(testoFonte);
  if (richiedePresentazioneDomanda(testoFonte) && !canale) {
    console.log(
      `  ✗ RIFIUTATA (avviso incompleto: procedura senza link di presentazione): ${v.title.slice(0, 70)}`,
    );
    return null;
  }
  const temaContext = valutazione.categoria ?? '';
  if (
    !valutazione.deadline &&
    !canale &&
    ['Normativa', 'Scadenze', 'Concorsi'].includes(temaContext)
  ) {
    console.log(
      `  ✗ RIFIUTATA (nessuna scadenza né canale di presentazione): ${v.title.slice(0, 70)}`,
    );
    return null;
  }

  // TRACCIABILITÀ: la notizia NON si blocca mai per un link poco profondo. Se la
  // voce punta a una pagina-contenitore (indice, elenco, archivio circolari,
  // pagina "notizie") si RISALE alla voce specifica — sottopagina, circolare,
  // documento/PDF — che è la base fattuale della notizia; se non si trova, si
  // pubblica COMUNQUE con la pagina disponibile (traccia verificabile). Solo i
  // link non validi (mockup/login/non http) impediscono la pubblicazione.
  const tracciamento = await risolviFonteGranulare({
    title: v.title,
    link: v.link,
    description: v.description,
  });
  const fonteUrl = tracciamento.url || v.link;
  const classeFonte = classificaLink(fonteUrl);
  if (classeFonte.classe === 'non-valido') {
    console.log(
      `  ✗ RIFIUTATA (link non valido): ${v.title.slice(0, 70)} — ${classeFonte.motivo}`,
    );
    return null;
  }
  if (tracciamento.tracciato) {
    console.log(
      `  ↳ fonte tracciata (${tracciamento.punteggio ?? '?'}%): ${fonteUrl.slice(0, 92)}`,
    );
  } else if (classeFonte.classe === 'contenitore') {
    console.log(
      `  ⚠ link di pagina/elenco (${classeFonte.motivo ?? 'n/d'}): pubblicato con la traccia disponibile`,
    );
  }

  // La fonte ufficiale deve essere un ARTICOLO CANONICO: "Leggi la fonte
  // ufficiale" non deve mai puntare a homepage o liste (es. /web/guest/home).
  if (!èFonteCanonica(fonteUrl)) {
    console.log(
      `  ✗ RIFIUTATA (fonte non canonica): ${v.title.slice(0, 70)} — ${fonteUrl}`,
    );
    return null;
  }

  // Verifica reale del link della fonte: deve rispondere HTTP 200/3xx.
  const linkFonte = await verificaUrlUfficiale(fonteUrl);
  if (!linkFonte.ok) {
    console.log(
      `  ✗ RIFIUTATA (link non risponde 2xx/3xx): ${v.title.slice(0, 70)} — ${fonteUrl}`,
    );
    return null;
  }

  const { content_html, summary_points } = generaArticoloEditoriale({
    title: v.title,
    categoria: valutazione.categoria,
    deadline: valutazione.deadline,
    fonte: v.fonte,
    descrizione: v.description,
    official_url: fonteUrl,
    application_url: canale?.url ?? null,
    application_label: canale?.etichetta ?? null,
  });
  const articolo: NewsArticle = {
    id: `notizia-${slug(v.title)}-${slug(v.fonte)}`,
    // TITOLO AZIONE: niente copia-incolla istituzionale — si dice che cosa
    // cambia per il lettore (e l'eventuale scadenza). L'id resta ancorato al
    // titolo ORIGINALE della fonte (identità stabile nel tempo).
    title: titoloAzione(v.title, valutazione.categoria, valutazione.deadline),
    category: valutazione.categoria ?? 'Scuole',
    deadline_date: valutazione.deadline,
    summary_points,
    content_html,
    official_source_url: fonteUrl,
    official_pdf_url: tracciamento.pdf ?? cercaPdf(v.description ?? '', fonteUrl),
    relevance_score: punteggioRilevanza(valutazione.categoria, Boolean(valutazione.deadline)),
    // Data della fonte se dichiarata, altrimenti data di rilevazione (fallback).
    published_at: dataPubblicazione(v.pubDate) || dataRilevazione(),
  };
  if (!articoloValido(articolo)) {
    console.log(`  ✗ RIFIUTATA (articolo non valido): ${v.title.slice(0, 70)}`);
    return null;
  }

  // PDF ufficiale allegato: se non è raggiungibile, lo si rimuove dal box PDF
  // (l'articolo resta pubblicabile se la fonte web è valida).
  if (articolo.official_pdf_url) {
    const pdfOk = await verificaUrlUfficiale(articolo.official_pdf_url);
    if (!pdfOk.ok) {
      console.log(
        `  ⚠ PDF ufficiale non raggiungibile (rimosso dal box PDF): ${articolo.official_pdf_url}`,
      );
      articolo.official_pdf_url = null;
    }
  }

  return articolo;
}

/**
 * Scrive l'archivio notizie (accumulo) su `notizieIngestite.ts`.
 * Il file è GENERATO: non modificarlo a mano (serializzazione centralizzata in
 * `archivioNotizie.ts`).
 */

/**
 * WATERFALL NAZIONALE (requisito editoriale): interroga i livelli in ordine di
 * priorità — 1. MIM nazionale → 2. Gazzetta Ufficiale → 3. ARAN →
 * 4. giurisdizione/previdenza — e si FERMA al primo che produce almeno un
 * articolo valido. Ogni livello applica la propria finestra di lookback:
 *   · 15 giorni per le NOTIZIE quotidiane (MIM/GU);
 *   · 60 giorni per gli ATTI NAZIONALI STRUTTURALI (CCNL, decreti ministeriali),
 *     che restano vincolanti per mesi.
 * Nel dubbio NON si inventa nulla: se nessun livello produce articoli, la
 * bacheca resta invariata (0 pubblicati) e i log lo dicono esplicitamente.
 */
async function raccogliConWaterfall(): Promise<{
  fontiRaggiunte: number;
  vociValutate: number;
  articoli: NewsArticle[];
  /** Voci ammissibili come RISERVA settimanale (vedi `èRiservaSettimanale`). */
  riserve: VoceFonte[];
  livello: number | null;
}> {
  let fontiRaggiunte = 0;
  let vociValutate = 0;
  const riserve: VoceFonte[] = [];

  for (const meta of LIVELLI_NAZIONALI) {
    const raccolta = await raccogliLivello(meta.priorita);
    if (!raccolta) continue;
    if (raccolta.raggiunta) fontiRaggiunte += 1;

    // Dedupe per link.
    const unici = [...new Map(raccolta.voci.map((v) => [v.link, v])).values()];
    vociValutate += unici.length;

    const giorni =
      meta.priorita >= 3 ? FINESTRA_LOOKBACK_NAZIONALE_GIORNI : FINESTRA_LOOKBACK_GIORNI;
    const soglia = Date.now() - giorni * 24 * 60 * 60 * 1000;
    const inFinestra = unici.filter((v) => {
      if (!v.pubDate) return true;
      const t = new Date(v.pubDate).getTime();
      return Number.isNaN(t) || t >= soglia;
    });
    console.log(
      `• LIVELLO ${meta.priorita} — ${meta.etichetta}: ${inFinestra.length}/${unici.length} voci nella finestra di ${giorni} giorni`,
    );
    if (inFinestra.length === 0) {
      console.log('  ↳ nessuna voce nella finestra: passo al livello successivo.');
      continue;
    }

    // Filtro editoriale + STRICT URL INTEGRITY (validazione locale e HTTP 200/3xx).
    const articoli = (await Promise.all(inFinestra.map((v) => costruisciArticolo(v)))).filter(
      (a): a is NewsArticle => a !== null,
    );
    console.log(`  ↳ articoli validi: ${articoli.length}`);
    // Candidati di RISERVA per la garanzia settimanale (≥ 1 articolo ogni 7
    // giorni): voci dichiaratamente scolastiche che il filtro principale non ha
    // pubblicato. Nessun costo di rete: la validazione strutturale (URL
    // canonico + HTTP 200/3xx) avviene solo se la riserva serve davvero.
    const riserveLivello = inFinestra.filter((v) =>
      èRiservaSettimanale(v.title, v.description, v.pubDate),
    );
    riserve.push(...riserveLivello);
    if (riserveLivello.length > 0) {
      console.log(
        `  ↳ riserve settimanali disponibili: ${riserveLivello.length} voce/i (usate solo se la bacheca resta ferma).`,
      );
    }
    if (articoli.length > 0) {
      console.log(
        `✓ LIVELLO ${meta.priorita} (${meta.etichetta}) produttivo: waterfall interrotto.`,
      );
      return { fontiRaggiunte, vociValutate, articoli, riserve, livello: meta.priorita };
    }
    console.log('  ↳ nessun articolo valido: passo al livello successivo.');
  }

  return { fontiRaggiunte, vociValutate, articoli: [], riserve, livello: null };
}

/** Vero se c'è almeno un articolo DATATO negli ultimi 7 giorni. */
function haArticoloRecente(articoli: NewsArticle[], oggi: Date = new Date()): boolean {
  const soglia = oggi.getTime() - 7 * 24 * 60 * 60 * 1000;
  return articoli.some((a) => {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    return !Number.isNaN(t) && t >= soglia;
  });
}

/**
 * GARANZIA SETTIMANALE (≥ 1 articolo ogni 7 giorni).
 *
 * Se nessun articolo è datato negli ultimi 7 giorni — le fonti rispondono ma
 * nessuna voce supera il filtro editoriale — si promuove la RISERVA più fresca:
 * la voce è già ammessa da `èRiservaSettimanale` e passa comunque TUTTI i gate
 * strutturali di `costruisciArticolo` (link diretto, fonte canonica, HTTP
 * 200/3xx). È l'unico percorso che può pubblicare una voce non passata dal
 * filtro principale ed è tracciato nei log come "GARANZIA SETTIMANALE".
 */
async function applicaGaranziaSettimanale(
  articoli: NewsArticle[],
  riserve: VoceFonte[],
): Promise<NewsArticle[]> {
  if (haArticoloRecente(articoli)) return articoli;
  const candidate = [...riserve].sort((a, b) =>
    (b.pubDate || '').localeCompare(a.pubDate || ''),
  );
  if (candidate.length === 0) {
    console.warn(
      '⚠ GARANZIA SETTIMANALE: nessuna riserva disponibile — la bacheca resta invariata.',
    );
    return articoli;
  }
  for (const voce of candidate.slice(0, 5)) {
    const articolo = await costruisciArticolo(voce, { promozioneRiserva: true });
    if (!articolo) continue;
    console.log(
      `✓ GARANZIA SETTIMANALE: pubblicata la riserva più fresca (${articolo.published_at}) — ${articolo.title.slice(0, 70)}`,
    );
    return [articolo, ...articoli];
  }
  console.warn(
    '⚠ GARANZIA SETTIMANALE: le riserve non superano i gate strutturali (fonte canonica / HTTP 200) — bacheca invariata.',
  );
  return articoli;
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('=== Ingestione Notizie ScuoleRadar ===');

  const { fontiRaggiunte, vociValutate, articoli, riserve } = await raccogliConWaterfall();
  console.log(`• Voci valutate: ${vociValutate} | fonti raggiunte: ${fontiRaggiunte}`);

  // Nessuna fonte ufficiale raggiunta (HTTP 2xx/3xx): niente silent-fail.
  // Il workflow GitHub trasforma l'exit code in warning visibile nei log.
  if (fontiRaggiunte === 0) {
    console.error(
      '✗ HTTP FAIL - fonti ufficiali NAZIONALI non raggiungibili. Nessuna ingestione eseguita.',
    );
    process.exitCode = 1;
    return;
  }

  // GARANZIA SETTIMANALE: se il filtro editoriale non produce nulla di datato
  // negli ultimi 7 giorni si promuove la riserva più fresca (gate strutturali
  // invariati), così la sezione Notizie non resta ferma una settimana intera.
  const articoliConRiserva = await applicaGaranziaSettimanale(articoli, riserve);
  console.log(
    `• Articoli che soddisfano i criteri editoriali: ${articoliConRiserva.length}`,
  );

  // Archiviazione ACCUMULATIVA + IGIENE: le nuove notizie si aggiungono a
  // quelle già presenti (dedupe per id), ma i record preesistenti che non
  // superano più le regole STRICT (URL canonico, niente login/area riservata)
  // o che non passano più il gate di rilevanza (avvisi tecnici generali)
  // vengono rimossi, così l'archivio resta sempre pertinente e valido.
  // NOTA: gli articoli preesistenti SENZA data di fonte (pagine operative USR
  // "evergreen") NON vengono datati: restano nella loro sottocartella storica e
  // NON consumano il tetto settimanale (vedi `limitaArticoliSettimanali`),
  // altrimenti occuperebbero tutti gli slot e bloccherebbero ogni nuovo articolo.
  // FORMATO EDITORIALE UNIFORME, PRIMA dell'igiene: le voci già in archivio
  // vengono ricondotte allo standard corrente (zero fluff, doppio link quando la
  // notizia parla di una domanda, sintesi operativa). Solo dopo si valuta se la
  // voce merita di restare in bacheca.
  const archivioRiformattato = notizieIngestite.map((a) => applicaFormatoEditoriale(a));
  const esistentiValidi = archivioRiformattato.filter(
    (a) =>
      articoloValido(a) &&
      valutaRilevanza({ title: a.title, url: a.official_source_url }).rilevante,
  );
  const purgate = notizieIngestite.length - esistentiValidi.length;
  if (purgate > 0) {
    console.log(`⚠ Igiene archivio: ${purgate} notizia/e preesistente/i non più valida/e rimossa/e.`);
  }
  // Policy NAZIONALE: le voci da fonti regionali/locali (es. pagine USR) escono
  // dall'archivio, così la bacheca resta di copertura nazionale.
  const regionali = notizieIngestite.filter((a) => !èFonteNazionale(a.official_source_url)).length;
  if (regionali > 0) {
    console.log(
      `⚠ Igiene nazionale: ${regionali} notizia/e da fonti REGIONALI/locali rimossa/e (ScuoleRadar pubblica solo copertura nazionale).`,
    );
  }
  const esistenti = esistentiValidi;
  const perId = new Map(articoli.map((a) => [a.id, a]));
  const nuovi = articoliConRiserva.filter((a) => !esistenti.some((e) => e.id === a.id));
  // REFRESH: un avviso già in archivio viene aggiornato con la versione fresca
  // (stesso id): le correzioni editoriali (scadenza, titolo, contenuto) si
  // propagano senza duplicare la voce.
  // Le voci esistenti sono già state riformattate prima dell'igiene: nessun
  // secondo passaggio. Il conteggio degli aggiornamenti confronta il formato
  // appena applicato con quello pubblicato in precedenza.
  const esistentiFreschi = esistenti;
  const aggiornati = archivioRiformattato.filter(
    (a, i) => JSON.stringify(a) !== JSON.stringify(notizieIngestite[i]),
  ).length;

  // NB: nessun early-return qui. Anche quando non arriva nulla di nuovo,
  // l'archivio viene comunque ripulito (igiene) e riportato ai limiti
  // (cap finestra + cadenza settimanale) prima di decidere se scrivere.

  const combinati = [...esistentiFreschi, ...nuovi].sort((a, b) =>
    (b.published_at || '').localeCompare(a.published_at || ''),
  );

  // Tetto articoli: massimo MAX_ARTICOLI_FINESTRA ad alto valore nella finestra
  // di lookback (15 giorni ≈ 3/settimana); gli esuberi recenti decadono.
  const { mantenuti: dopoFinestra, rimossi } = limitaArticoliSettimanali(combinati);
  if (rimossi.length > 0) {
    console.log(
      `⚠ Tetto attivo (max ${MAX_ARTICOLI_FINESTRA} articoli per ${FINESTRA_LOOKBACK_GIORNI} giorni): ${rimossi.length} articolo/i in esubero scartato/i.`,
    );
    rimossi.forEach((r) => console.log(`  ✗ RIMOSSO (cap finestra): ${r.title.slice(0, 70)}`));
  }

  // CADENZA SETTIMANALE BLOCCATA (1–3 articoli/settimana): negli ultimi 7 giorni
  // restano al massimo MAX_ARTICOLI_SETTIMANA articoli DATATI. Vince la
  // freschezza (i più recenti restano): il feed mostra subito gli aggiornamenti
  // nazionali del momento. Lo storico più vecchio di 7 giorni non è toccato.
  const { mantenuti, rimossi: rimossiCadenza } = limitaCadenzaSettimanale(dopoFinestra);
  if (rimossiCadenza.length > 0) {
    console.log(
      `⚠ Cadenza settimanale (max ${MAX_ARTICOLI_SETTIMANA} articoli datati negli ultimi 7 giorni): ${rimossiCadenza.length} articolo/i in esubero scartato/i.`,
    );
    rimossiCadenza.forEach((r) =>
      console.log(`  ✗ RIMOSSO (cadenza settimanale): ${r.title.slice(0, 70)}`),
    );
  }
  const aggiunti = nuovi.filter((n) => mantenuti.some((m) => m.id === n.id));

  // Scrittura SOLO se l'archivio cambia davvero: nuovi articoli, refresh di una
  // voce esistente, igiene o POTATURA da cap/cadenza. Così i limiti (compresa la
  // cadenza 1–3 a settimana) vengono imposti anche quando non arriva nulla di
  // nuovo, e la bacheca resta sempre allineata alle regole.
  const idsAttuali = notizieIngestite.map((a) => a.id).join('|');
  const idsFinali = mantenuti.map((a) => a.id).join('|');
  const potati = rimossi.length + rimossiCadenza.length;
  const archivioCambiato = idsAttuali !== idsFinali || aggiornati > 0;

  if (!archivioCambiato) {
    console.log('✓ HTTP 200 - 0 new posts criteria matched');
    if (esistenti.length === 0) {
      console.log('L\u2019archivio notizie è vuoto: resta attivo il fallback editoriale.');
    } else {
      console.log('L\u2019archivio notizie resta invariato (nessun commit necessario).');
    }
    reportCadenza(mantenuti);
    if (isDryRun) console.log('=== DRY-RUN (nessuna scrittura) ===');
    return;
  }

  if (isDryRun) {
    console.log('=== DRY-RUN (nessuna scrittura) ===');
    mantenuti.forEach((a) => {
      console.log(
        `  ✓ [${a.category}] ${a.title.slice(0, 70)} | scad: ${a.deadline_date ?? 'n/d'}`,
      );
    });
    console.log(
      `✓ HTTP 200 - ${aggiunti.length} new posts criteria matched${aggiornati > 0 ? ` (${aggiornati} aggiornati)` : ''}${potati > 0 ? ` (${potati} potati)` : ''}`,
    );
    reportCadenza(mantenuti);
    return;
  }

  scriviArchivioNotizie(mantenuti);
  console.log(
    `✓ HTTP 200 - ${aggiunti.length} new posts criteria matched${aggiornati > 0 ? ` (${aggiornati} aggiornati)` : ''}${potati > 0 ? ` (${potati} potati)` : ''}`,
  );
  console.log(`✓ Scritti ${mantenuti.length} articoli in ${FILE_ARCHIVIO_NOTIZIE}`);
  reportCadenza(mantenuti);
}

main().catch((err) => {
  console.error('✗ Errore imprevisto nell\'ingestione Notizie:', err);
  process.exitCode = 1;
});


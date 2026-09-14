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
import {
  valutaRilevanza,
  punteggioRilevanza,
  articoloValido,
  generaArticoloEditoriale,
  linkDirettoUfficiale,
  èFonteCanonica,
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
  const soglia = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recenti = articoli.filter((a) => {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    return !Number.isNaN(t) && t >= soglia;
  }).length;
  console.log(`📈 Cadenza settimanale: ${recenti} articolo/i negli ultimi 7 giorni (target ≥ 1).`);
  if (recenti === 0) {
    console.warn('⚠ RATE: nessun articolo negli ultimi 7 giorni — verificare fonti/cron di ingestione.');
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
async function costruisciArticolo(v: VoceFonte): Promise<NewsArticle | null> {
  const valutazione: ValutazioneNotizia = valutaRilevanza({
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

  // PUNTO-A-PUNTO: la notizia si pubblica SOLO con l'URL diretto del documento
  // specifico. Indici, elenchi, home page, directory URP e archivi "master"
  // bloccano la pubblicazione: nessun fallback a contenitori generici.
  const diretto = linkDirettoUfficiale(v.link);
  if (!diretto.ok) {
    console.log(
      `  ✗ RIFIUTATA (link non puntuale): ${v.title.slice(0, 70)} — ${diretto.motivo}`,
    );
    return null;
  }

  // La fonte ufficiale deve essere l'ARTICOLO CANONICO: "Leggi la fonte
  // ufficiale" non deve mai puntare a homepage o liste (es. /web/guest/home).
  if (!èFonteCanonica(v.link)) {
    console.log(
      `  ✗ RIFIUTATA (fonte non canonica): ${v.title.slice(0, 70)} — ${v.link}`,
    );
    return null;
  }

  // Verifica reale del link della fonte: deve rispondere HTTP 200/3xx.
  const linkFonte = await verificaUrlUfficiale(v.link);
  if (!linkFonte.ok) {
    console.log(
      `  ✗ RIFIUTATA (link non risponde 2xx/3xx): ${v.title.slice(0, 70)} — ${v.link}`,
    );
    return null;
  }

  const { content_html, summary_points } = generaArticoloEditoriale({
    title: v.title,
    categoria: valutazione.categoria,
    deadline: valutazione.deadline,
    fonte: v.fonte,
    descrizione: v.description,
    official_url: v.link,
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
    official_source_url: v.link,
    official_pdf_url: cercaPdf(v.description ?? '', v.link),
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
  livello: number | null;
}> {
  let fontiRaggiunte = 0;
  let vociValutate = 0;

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
    const articoli = (await Promise.all(inFinestra.map(costruisciArticolo))).filter(
      (a): a is NewsArticle => a !== null,
    );
    console.log(`  ↳ articoli validi: ${articoli.length}`);
    if (articoli.length > 0) {
      console.log(
        `✓ LIVELLO ${meta.priorita} (${meta.etichetta}) produttivo: waterfall interrotto.`,
      );
      return { fontiRaggiunte, vociValutate, articoli, livello: meta.priorita };
    }
    console.log('  ↳ nessun articolo valido: passo al livello successivo.');
  }

  return { fontiRaggiunte, vociValutate, articoli: [], livello: null };
}

async function main(): Promise<void> {
  const isDryRun = process.argv.includes('--dry-run');
  console.log('=== Ingestione Notizie ScuoleRadar ===');

  const { fontiRaggiunte, vociValutate, articoli } = await raccogliConWaterfall();
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

  console.log(`• Articoli che soddisfano i criteri editoriali: ${articoli.length}`);

  // Archiviazione ACCUMULATIVA + IGIENE: le nuove notizie si aggiungono a
  // quelle già presenti (dedupe per id), ma i record preesistenti che non
  // superano più le regole STRICT (URL canonico, niente login/area riservata)
  // o che non passano più il gate di rilevanza (avvisi tecnici generali)
  // vengono rimossi, così l'archivio resta sempre pertinente e valido.
  // NOTA: gli articoli preesistenti SENZA data di fonte (pagine operative USR
  // "evergreen") NON vengono datati: restano nella loro sottocartella storica e
  // NON consumano il tetto settimanale (vedi `limitaArticoliSettimanali`),
  // altrimenti occuperebbero tutti gli slot e bloccherebbero ogni nuovo articolo.
  const esistentiValidi = notizieIngestite.filter(
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
  const nuovi = articoli.filter((a) => !esistenti.some((e) => e.id === a.id));
  // REFRESH: un avviso già in archivio viene aggiornato con la versione fresca
  // (stesso id): le correzioni editoriali (scadenza, titolo, contenuto) si
  // propagano senza duplicare la voce.
  const esistentiFreschi = esistenti.map((e) => perId.get(e.id) ?? e);
  const aggiornati = esistenti.filter(
    (e, i) => JSON.stringify(e) !== JSON.stringify(esistentiFreschi[i]),
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


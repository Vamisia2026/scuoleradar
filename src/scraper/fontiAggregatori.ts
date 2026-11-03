/**
 * ScuoleRadar.it — AGGREGATORI PRIVATI NEL REGISTRO FONTI (Node-only, DATI).
 *
 * §26.123 — PERCHÉ ESISTE. Fino al 31/10/2026 l'indice nazionale e i 19 archivi
 * regionali di `scuolainterpelli.it` erano fonti **ATTIVE** del motore: la fonte
 * più produttiva del run e la ragione per cui in bacheca comparivano righe il cui
 * unico link era un portale terzo. Un aggregatore non è una fonte, è un
 * concorrente: le voci restano qui **registrate e spente** — la copertura si
 * dichiara, non si simula — e il motivo è scritto una volta sola.
 *
 * Il blocco vive in un file a parte perché `fonti.ts` sta al limite di dimensione
 * del gate strutturale (250 righe): la logica resta là, i dati stanno qui.
 */
import { province } from '../data/province.ts';
import type { FonteInterpelli } from './fontiTipi.ts';
import { AGGREGATORI_REGIONALI } from './fontiRegistro.ts';

/** Indice nazionale dell'aggregatore (SPENTO, §26.123). */
export const AGGREGATORE_NAZIONALE =
  'https://www.scuolainterpelli.it/interpelli-scuola-aggiornati/';

/**
 * Motivo dichiarato su OGNI voce: finisce nel registro e nei report
 * (`npm run fonti:verifica`). Deve restare ≥ 20 caratteri: la guardia
 * `test:scraper:fonti` pretende un motivo scritto su ogni fonte spenta.
 */
const MOTIVO_AGGREGATORE =
  'aggregatore privato concorrente: non è una fonte istituzionale e le sue righe ' +
  'non sono atti dell’istituto (§26.109 · §26.123). La copertura si dichiara, non si simula.';

/** Le 20 voci spente: indice nazionale + un archivio per regione. */
export const AGGREGATORI_SPENTI: FonteInterpelli[] = [
  {
    id: 'aggregatore-nazionale',
    etichetta: 'Aggregatore interpelli — indice nazionale (SPENTO)',
    url: AGGREGATORE_NAZIONALE,
    tipo: 'aggregatore',
    regioni: [],
    capoluogo: null,
    nazionale: true,
    attiva: false,
    verificata: null,
    note: MOTIVO_AGGREGATORE,
  },
  ...AGGREGATORI_REGIONALI.map(([regione, slug]) => ({
    id: `aggregatore-${regione.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    etichetta: `Aggregatore interpelli — archivio ${regione} (SPENTO)`,
    url: `https://www.scuolainterpelli.it/${slug}/`,
    tipo: 'aggregatore' as const,
    regioni: [regione],
    capoluogo: null,
    nazionale: true,
    attiva: false,
    verificata: null,
    note: MOTIVO_AGGREGATORE,
  })),
];

/* -------------------------------------------------------------------------- */
/*  SONDE DI DISCOVERY (§26.138) — aggregatori privati come SEGNALATORI       */
/* -------------------------------------------------------------------------- */

/**
 * PERCHÉ ESISTONO. La copertura di una provincia non si compra a un aggregatore
 * (§26.123), ma un aggregatore **sa dove guardare prima di noi**: elenca per
 * provincia le scuole che hanno un avviso aperto, spesso con il codice
 * meccanografico e il termine di scadenza. È informazione di RICOGNIZIONE, non
 * un atto: serve a dire al crawler «guarda il sito di questa scuola / questo
 * codice su Nuvola», e il documento ufficiale si prende là.
 *
 * REGOLE DICHIARATE (non opinioni)
 *  1. una sonda NON è una fonte: non entra in `FONTI_INTERPELLI`, quindi non
 *     finisce né in `fontiAttive()` né nella whitelist della coda
 *     (`targetWhitelist()`): nessun target da crawler, nessuna riga in bacheca;
 *  2. i suoi host stanno in `AGGREGATORI_PRIVATI` (`lib/dominiIstituzionali.ts`),
 *     quindi un link raccolto che punta lì è RESPINTO da `valutaDominio()` e le
 *     righe già in tabella vengono rimosse da `clean-and-sync-targets`;
 *  3. ogni voce dichiara la data e la MISURA della verifica: se la pagina cambia
 *     forma, il numero vecchio si smentisce da solo.
 *
 * LIMITE DICHIARATO. Oggi la sonda produce INDIZI (scuola, codice, scadenza): il
 * passaggio indizio → documento ufficiale richiede l'anagrafica codice → sito
 * della scuola, che vive fuori da questo modulo. Nessuna riga di bacheca nasce
 * qui, e nessuna riga di bacheca nascerà da un URL di sonda.
 */

/** Data della misura che accompagna le sonde (stessa giornata del blocco 03/11). */
export const DATA_VERIFICA_SONDE = '2026-11-03';

/** Una sonda di discovery: URL templata per provincia + cosa se ne ricava. */
export interface SondaDiscovery {
  id: string;
  etichetta: string;
  /** Template con il segnaposto `{provincia}` (slug del nome della provincia). */
  template: string;
  /** Data ISO della misura dichiarata in `note`. */
  verificata: string;
  /** Cosa rende la pagina, cosa se ne ricava e perché non pubblica nulla. */
  note: string;
}

/**
 * Le sonde misurate il 03/11/2026 (UA Chrome/124). Il motivo è lo stesso per
 * tutte: sono aggregatori privati, e la loro riga in bacheca sarebbe un falso
 * positivo col link di un terzo.
 */
export const SONDE_DISCOVERY: readonly SondaDiscovery[] = [
  {
    id: 'sonda-scuolago',
    etichetta: 'scuolago.it — interpelli per provincia (SONDA di discovery)',
    template: 'https://scuolago.it/interpelli/{provincia}',
    verificata: DATA_VERIFICA_SONDE,
    note:
      'SONDA, non fonte: aggregatore privato («Nessun interpello aperto oggi. Negli ultimi 30 ' +
      'giorni ne sono usciti 8»). Misura 03/11/2026 su `asti`: HTTP 200, 65 KB, tabella con 4 ' +
      'codici meccanografici (ATIC817001 IC 2 di Asti, ATIC811002 IC San Damiano, ATIC809002 ' +
      'Rocchetta Tanaro, ATIC815009 IC delle Quattro Valli) e le date di ciascun avviso (30 ott → ' +
      '8 nov, 30 set → 30 apr 2027). Serve a sapere QUALI scuole hanno un avviso e con quale ' +
      'codice: il documento si prende sul sito della scuola o su Nuvola, mai qui.',
  },
  {
    id: 'sonda-docenti-it',
    etichetta: 'docenti.it — interpelli per provincia (SONDA di discovery)',
    template: 'https://www.docenti.it/interpelli/interpelli-{provincia}.html',
    verificata: DATA_VERIFICA_SONDE,
    note:
      'SONDA, non fonte: portale privato di lead generation («REGISTRATI AGLI INTERPELLI»). ' +
      'Misura 03/11/2026 su `asti`: HTTP 200, 128 KB, 10 schede `article.interpelli-feed-card` ' +
      'TUTTE `is-expired` (0 «Aperto»), con nome istituto, classe di concorso, «Pubblicato il» e ' +
      '«Scadenza» in `<time datetime="…">` ISO (es. 2026-11-03T09:30). Nessun codice ' +
      'meccanografico nella scheda: l’indizio è il NOME, da incrociare con l’anagrafica.',
  },
];

/**
 * Slug di provincia usato dalle sonde: nome ISTAT in minuscolo, senza accenti,
 * con gruppi non alfanumerici ridotti a un trattino.
 * (`L'Aquila` → `l-aquila`, `Forlì-Cesena` → `forli-cesena`: le due forme viste
 * nella navigazione di `scuolago.it`.) Accetta anche il codice a due lettere.
 */
export function slugProvincia(provincia: string): string | null {
  const chiave = String(provincia ?? '').trim().toLowerCase();
  if (!chiave) return null;
  const trovata =
    province.find((p) => p.codice.toLowerCase() === chiave) ??
    province.find((p) => p.nome.toLowerCase() === chiave);
  const nome = trovata?.nome ?? String(provincia ?? '').trim();
  const slug = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : null;
}

/** URL della sonda per una provincia (codice o nome), oppure `null`. */
export function urlSonda(sonda: SondaDiscovery, provincia: string): string | null {
  const slug = slugProvincia(provincia);
  if (!slug) return null;
  return sonda.template.replace('{provincia}', slug);
}

/** Le sonde interrogabili per una provincia, con l'URL già costruita. */
export function sondePerProvincia(
  provincia: string,
): { sonda: SondaDiscovery; url: string }[] {
  const out: { sonda: SondaDiscovery; url: string }[] = [];
  for (const sonda of SONDE_DISCOVERY) {
    const url = urlSonda(sonda, provincia);
    if (url) out.push({ sonda, url });
  }
  return out;
}


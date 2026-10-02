/**
 * ScuoleRadar.it — DATI del REGISTRO FONTI INTERPELLI (Node-only, PURO).
 *
 * Solo DATI: le URL verificate, le regioni coperte e il capoluogo di riferimento.
 * La logica di selezione e i tipi stanno in `fonti.ts`; la copertura dichiarata in
 * `fontiCopertura.ts`. Nessuna URL inventata: ogni voce è verificata (HTTP 200 con
 * contenuto di reclutamento) oppure è elencata fra gli ESCLUSI con il motivo.
 *
 * Tuple:
 *   AGGREGATORI_REGIONALI: [regione, slug]  →  https://www.scuolainterpelli.it/<slug>/
 *   HUB_ATTIVI:            [id, etichetta, url, regioni, capoluogo]
 *   HUB_ESCLUSI:           [id, etichetta, url, regioni, capoluogo, motivo]
 */

/** Landing regionali dell'aggregatore di interpelli. */
export const AGGREGATORI_REGIONALI: [string, string][] = [
  ['Abruzzo', 'interpelli-abruzzo'],
  ['Basilicata', 'interpelli-basilicata'],
  ['Calabria', 'interpelli-calabria'],
  ['Campania', 'interpelli-campania'],
  ['Emilia-Romagna', 'interpelli-emilia-romagna'],
  ['Friuli-Venezia Giulia', 'interpelli-friuli-venezia-giulia'],
  ['Lazio', 'interpelli-lazio'],
  ['Liguria', 'interpelli-liguria'],
  ['Lombardia', 'interpelli-lombardia'],
  ['Marche', 'interpelli-marche'],
  ['Molise', 'interpelli-molise'],
  ['Piemonte', 'tag/interpelli-scuola-piemonte'],
  ['Puglia', 'interpelli-puglia'],
  ['Sardegna', 'interpelli-sardegna'],
  ['Sicilia', 'interpelli-sicilia'],
  ['Toscana', 'interpelli-toscana'],
  ['Trentino-Alto Adige', 'interpelli-trentino-alto-adige'],
  ['Umbria', 'interpelli-umbria'],
  ['Veneto', 'tag/interpelli-scuola-veneto'],
];

/**
 * Pagine di RECLUTAMENTO degli Uffici Scolastici Regionali (USR): sono gli hub
 * ufficiali dei capoluoghi di regione e degli hub metropolitani — bandi docenti,
 * ATA, PNRR ed esperti esterni pubblicati dall'ente.
 */
export const HUB_ATTIVI: [string, string, string, string[], string][] = [
  ['mim-usr-lombardia-docenti', 'USR Lombardia — Concorsi e reclutamento docenti (Milano)', 'https://www.mim.gov.it/web/usr-lombardia/concorsi-e-reclutamento-docenti', ['Lombardia'], 'MI'],
  ['mim-usr-lombardia-ata', 'USR Lombardia — Concorsi e selezione personale ATA (Milano)', 'https://www.mim.gov.it/web/usr-lombardia/concorsi-e-selezione-personale-ata', ['Lombardia'], 'MI'],
  ['istruzionepiemonte-avvisi', 'USR Piemonte — Avvisi pubblici (Torino)', 'https://www.istruzionepiemonte.it/avvisi-pubblici-3/', ['Piemonte'], 'TO'],
  ['istruzionepiemonte-docenti', 'USR Piemonte — Reclutamento personale docente (Torino)', 'https://www.istruzionepiemonte.it/area-immissioni-in-ruolo/reclutamento-personale-docente/', ['Piemonte'], 'TO'],
  ['istruzionepiemonte-ata', 'USR Piemonte — Reclutamento personale ATA (Torino)', 'https://www.istruzionepiemonte.it/area-immissioni-in-ruolo/reclutamento-personale-ata/', ['Piemonte'], 'TO'],
  ['istruzioneliguria-interpelli', 'USR Liguria — Interpelli e comunicati (Genova)', 'https://www.istruzioneliguria.gov.it/pagine/interpelli-e-comunicati', ['Liguria'], 'GE'],
  ['istruzioneer-avvisi', 'USR Emilia-Romagna — Avvisi (Bologna)', 'https://www.istruzioneer.gov.it/category/avvisi-incarichi-dirigenziali-ii-fascia/', ['Emilia-Romagna'], 'BO'],
  ['istruzioneer-home', 'USR Emilia-Romagna — Home istituzionale (Bologna)', 'https://www.istruzioneer.gov.it/', ['Emilia-Romagna'], 'BO'],
  ['usrlazio-concorsi', 'USR Lazio — Concorsi e nomine (Roma)', 'https://www.ufficioscolasticoregionalelazio.it/category/aree-tematiche/concorsi-e-nomine/', ['Lazio'], 'RM'],
  ['mim-usr-campania', 'USR Campania — Home e avvisi (Napoli)', 'https://www.mim.gov.it/web/miur-usr-campania', ['Campania'], 'NA'],
  ['mim-usr-toscana', 'USR Toscana — Home e avvisi (Firenze)', 'https://www.mim.gov.it/web/miur-usr-toscana', ['Toscana'], 'FI'],
  ['pugliausr-docenti', 'USR Puglia — Reclutamento docenti (Bari)', 'http://www.pugliausr.gov.it/index.php/docenti/reclutamento', ['Puglia'], 'BA'],
  ['pugliausr-ata', 'USR Puglia — Reclutamento personale ATA (Bari)', 'http://www.pugliausr.gov.it/index.php/ata/reclutamento', ['Puglia'], 'BA'],
  ['istruzione-calabria-concorsi', 'USR Calabria — Concorsi e graduatorie (Catanzaro)', 'https://www.istruzione.calabria.it/concorsi-e-graduatorie/', ['Calabria'], 'CZ'],
  ['usr-sicilia-interpelli', 'USR Sicilia — Interpelli (Palermo)', 'https://www.usr.sicilia.it/interpelli/', ['Sicilia'], 'PA'],
  ['usr-sicilia-reclutamento', 'USR Sicilia — Reclutamento (Palermo)', 'https://www.usr.sicilia.it/aree-tematiche/reclutamento/', ['Sicilia'], 'PA'],
  ['mim-usr-sardegna', 'USR Sardegna — Home e avvisi (Cagliari)', 'https://www.mim.gov.it/web/usr-sardegna', ['Sardegna'], 'CA'],
  ['mim-usr-marche-concorsi', 'USR Marche — Concorsi personale scuola (Ancona)', 'https://www.mim.gov.it/web/miur-usr-marche/concorsi-personale-scuola', ['Marche'], 'AN'],
  ['mim-abruzzo-concorsi', 'USR Abruzzo — Concorsi scuola (L’Aquila)', 'https://www.mim.gov.it/web/abruzzo/concorsi-scuola', ['Abruzzo'], 'AQ'],
  ['mim-basilicata-concorsi', 'USR Basilicata — Concorsi (Potenza)', 'https://www.mim.gov.it/web/basilicata/concorsi', ['Basilicata'], 'PZ'],
  ['mim-molise-concorsi', 'USR Molise — Concorsi (Campobasso)', 'https://www.mim.gov.it/web/molise/concorsi', ['Molise'], 'CB'],
  ['istruzioneveneto-avvisi', 'USR Veneto — Avvisi e incarichi (Venezia)', 'https://istruzioneveneto.gov.it/argomenti/avvisi-incarichi-dirigenziali/', ['Veneto'], 'VE'],
  ['umbria-interpelli-aperti', 'USR Umbria — Interpelli aperti (Perugia)', 'https://istruzione.umbria.it/interpelli/interpelli-aperti/', ['Umbria'], 'PG'],
];

/**
 * Hub NON interrogabili: restano nel registro per dichiarare la copertura reale.
 * Nessuna provincia è coperta "per finta": il motivo è sempre esplicito.
 */
export const HUB_ESCLUSI: [string, string, string, string[], string, string][] = [
  [
    'mim-pnrr-avvisi',
    'PNRR Istruzione — Protocolli e Avvisi (nazionale)',
    'https://pnrr.istruzione.it/protocolli-e-avvisi/',
    [],
    '',
    'Avvisi NAZIONALI PNRR senza provincia determinabile: la bacheca è provinciale, ' +
      'quindi la riga non è pubblicabile (nessuna provincia inventata). I bandi PNRR di ' +
      'scuola/esperto esterno arrivano dalle fonti locali (hub USR + siti delle scuole).',
  ],
  [
    'scuola-fvg-trieste',
    'USR Friuli-Venezia Giulia (Trieste)',
    'http://www.scuola.fvg.it/',
    ['Friuli-Venezia Giulia'],
    'TS',
    'Fonte NON verificata: il certificato TLS non corrisponde all’host (hostname ' +
      'mismatch) e la lettura fallisce. Da verificare prima di attivarla.',
  ],
  [
    'istruzione-vda-aosta',
    'USR Valle d’Aosta (Aosta)',
    'https://www.istruzione.vda.it/',
    ["Valle d'Aosta"],
    'AO',
    'Fonte NON verificata: dominio non risolto (ENOTFOUND) alla verifica del 2026-09-28.',
  ],
  [
    'usr-trentino-alto-adige',
    'USR Trentino-Alto Adige (Trento/Bolzano)',
    'https://www.mim.gov.it/web/usr-trentino-alto-adige',
    ['Trentino-Alto Adige'],
    'TN',
    'Fonte NON verificata: sistema scolastico provinciale (Province autonome) con portali ' +
      'separati; la copertura resta garantita dall’aggregatore nazionale.',
  ],
];


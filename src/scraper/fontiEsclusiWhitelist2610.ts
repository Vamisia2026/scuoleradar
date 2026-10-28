/**
 * ScuoleRadar.it — WHITELIST 26/10/2026: URL verificate e NON attivate.
 *
 * Estratte da `fontiWhitelist2610.ts` per rispettare il tetto di 300 righe per
 * file (gate `test:architettura`): qui stanno solo i MOTIVI e le tuple, la
 * costruzione delle fonti resta nel file principale. Le 27 voci sono URL fornite
 * dal cliente e aperte una per una il 26/10/2026: rispondono, ma non offrono un
 * elenco di interpelli leggibile (home senza voci, pagina-guscio JS, alias dello
 * stesso portale, 403 anti-bot, certificato TLS non valido, dominio scomparso).
 * Restano registrate perché la copertura si DICHIARI: `npm run fonti:verifica`
 * le ricontrolla e la prima che torna leggibile si sposta fra le attive.
 */

/** [id, etichetta, url, regioni, capoluogo, motivo]. */
export type TuplaEsclusa = [string, string, string, string[], string, string];

/** Home istituzionale senza voci di reclutamento: l’elenco vive altrove. */
const SOLO_HOME_26 =
  'HTTP 200 ma NESSUNA voce di reclutamento leggibile alla verifica del 2026-10-26 (home ' +
  'istituzionale: solo notizie e menu). Gli elenchi di interpelli di questo territorio sono ' +
  'le pagine di sezione già attive del registro: la home non aggiunge righe pubblicabili.';

/** Pagina-guscio: il contenuto arriva solo dopo l’esecuzione di JS. */
const SHELL_26 =
  'HTTP 200 con pagina-guscio (0 link, 0 testo, solo script): il contenuto è reso lato client. ' +
  'Non è un guasto del crawler, ma finché l’elenco non è nell’HTML non c’è nulla da leggere.';

/** Alias dello stesso portale (redirect): non è una seconda fonte. */
const ALIAS_26 =
  'Alias del portale già coperto (redirect allo stesso sito/alla stessa home): registrarlo ' +
  'raddoppierebbe le richieste senza aggiungere una riga. La fonte vera è quella canonica.';

/** Certificato TLS non valido: contenuto non leggibile in HTTPS. */
const TLS_26 =
  'Certificato TLS non valido (hostname mismatch) alla verifica del 2026-10-26: contenuto non ' +
  'leggibile. Da riverificare prima di qualunque attivazione.';

/** Dominio che non esiste più. */
const DNS_26 =
  'Dominio non risolto (ENOTFOUND) alla verifica del 2026-10-26: la URL non esiste più.';

/** Blocco anti-bot del server (403 Cloudflare). */
const ANTIBOT_26 =
  'HTTP 403 con pagina anti-bot («Wait a moment…») alla verifica del 2026-10-26: il server ' +
  'rifiuta i client automatici. La fonte resta dichiarata e ricontrollabile.';

/** Archivio documentale che richiede autenticazione/JS (SharePoint/OneDrive). */
const CLOUD_26 =
  'HTTP 200 con pagina di reindirizzamento SharePoint/OneDrive: elenco protetto, richiede ' +
  'sessione e JavaScript. Non leggibile dal crawler.';

/** Albo on-line senza interpelli (solo atti). */
const ALBO_26 =
  'Albo on-line (HTTP 200) senza voci di interpello alla verifica del 2026-10-26: pubblica atti ' +
  'e decreti, non avvisi di reclutamento con link alla voce.';

/** Ricerca interna con risultati resi lato server solo su input. */
const RICERCA_26 =
  'Pagina di RICERCA (0 voci statiche) alla verifica del 2026-10-26: senza il parametro di ' +
  'ricerca e senza JS non restituisce alcun elenco.';

/** Le 27 URL che restano nel registro con `attiva: false` e il motivo. */
export const ESCLUSI_WHITELIST_2610: TuplaEsclusa[] = [
  // ── Home USR che non contengono voci (le sezioni sono già attive) ──
  ['lazio-home', 'USR Lazio — Home (Roma)', 'https://www.ufficioscolasticoregionalelazio.it/', ['Lazio'], 'RM', SOLO_HOME_26],
  ['piemonte-home', 'USR Piemonte — Home (Torino)', 'https://www.istruzionepiemonte.it/', ['Piemonte'], 'TO', SOLO_HOME_26],
  ['umbria-home', 'USR Umbria — Home (Perugia)', 'https://istruzione.umbria.it/', ['Umbria'], 'PG', SOLO_HOME_26],
  ['veneto-home', 'USR Veneto — Home (Venezia)', 'https://istruzioneveneto.gov.it/', ['Veneto'], 'VE', SOLO_HOME_26],
  ['calabria-home', 'USR Calabria — Home (Catanzaro)', 'http://www.istruzione.calabria.it/', ['Calabria'], 'CZ', SOLO_HOME_26],
  ['marche-home', 'USR Marche — Home (Ancona)', 'http://www.marche.istruzione.it/', ['Marche'], 'AN', SOLO_HOME_26],
  ['sardegna-home', 'USR Sardegna — Home (Cagliari)', 'http://www.sardegna.istruzione.it/', ['Sardegna'], 'CA', SOLO_HOME_26],
  ['puglia-home', 'USR Puglia — Home (Bari)', 'https://www.pugliausr.gov.it/', ['Puglia'], 'BA', SOLO_HOME_26],
  ['liguria-old-home', 'USR Liguria — dominio storico (Genova)', 'http://www.istruzioneliguria.it/', ['Liguria'], 'GE', ALIAS_26],
  ['trentino-vivoscuola', 'Vivoscuola — Portale scuola Trentino (Trento)', 'https://www.vivoscuola.it/', ['Trentino-Alto Adige'], 'TN', SOLO_HOME_26],
  ['sassari-home', 'ATP Sassari — Home (Sassari)', 'https://www.mim.gov.it/web/sassari', ['Sardegna'], 'SS', SOLO_HOME_26],

  // ── Alias MIM/MIUR della stessa pagina ──
  ['mim-abruzzo-alias', 'MIM Abruzzo — alias miur.gov.it', 'https://www.miur.gov.it/web/abruzzo', ['Abruzzo'], 'AQ', ALIAS_26],
  ['mim-molise-alias', 'MIM Molise — alias miur.gov.it', 'https://www.miur.gov.it/web/molise', ['Molise'], 'CB', ALIAS_26],
  ['mim-molise-home', 'MIM Molise — Home (Campobasso)', 'https://www.mim.gov.it/web/molise', ['Molise'], 'CB', SOLO_HOME_26],
  ['mim-marche-home', 'MIM Marche — Home (Ancona)', 'https://www.mim.gov.it/web/miur-usr-marche', ['Marche'], 'AN', SOLO_HOME_26],
  ['mim-toscana-alias', 'MIM Toscana — alias miur.gov.it', 'https://www.miur.gov.it/web/miur-usr-toscana', ['Toscana'], 'FI', ALIAS_26],
  ['mim-toscana-ricerca', 'USR Toscana — Ricerca interna «interpelli»', 'https://www.mim.gov.it/web/miur-usr-toscana/ricerca?r=interpelli&scope=this-site', ['Toscana'], 'FI', RICERCA_26],
  ['istruzioneer-alias', 'USR Emilia-Romagna — alias senza www', 'http://istruzioneer.gov.it/', ['Emilia-Romagna'], 'BO', ALIAS_26],

  // ── Pagine-guscio ed elenchi non leggibili ──
  ['atproma-home', 'ATP Roma — Home (Roma)', 'https://www.atpromaistruzione.it/', ['Lazio'], 'RM', SHELL_26],
  ['basilicata-home', 'USR Basilicata — Home (Potenza)', 'http://www.basilicata.istruzione.it/', ['Basilicata'], 'PZ', SHELL_26],
  ['campania-home', 'USR Campania — Home (Napoli)', 'http://www.campania.istruzione.it/home/home.shtml', ['Campania'], 'NA', SHELL_26],
  ['basilicata-albo', 'USR Basilicata — Albo on-line', 'https://www.mim.gov.it/web/basilicata/albo-on-line', ['Basilicata'], 'PZ', ALBO_26],
  ['veneto-sharepoint', 'USR Veneto — Cartella interpelli Venezia (SharePoint)', 'https://usrveneto-my.sharepoint.com/personal/redazione_sito_usrve_it/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Fredazione%5Fsito%5Fusrve%5Fit%2FDocuments%2FInterpelli%2FVE%2FAggiornamento%20interpelli&ga=1', ['Veneto'], 'VE', CLOUD_26],

  // ── Errori di rete e blocchi dichiarati ──
  ['benevento-uat', 'USP Benevento — Area UAT', 'https://www.uspbenevento.it/uat/', ['Campania'], 'BN', ANTIBOT_26],
  ['benevento-interpelli', 'USP Benevento — Interpelli e varie', 'https://www.uspbenevento.it/uat/category/interpelli-e-varie/', ['Campania'], 'BN', ANTIBOT_26],
  ['fvg-usrfvg-old', 'USR FVG — vecchio portale (Trieste)', 'http://www.scuola.fvg.it/usr/fvg/USRFVG/', ['Friuli-Venezia Giulia'], 'TS', TLS_26],
  ['lombardia-old-usr', 'USR Lombardia — dominio storico (Milano)', 'http://usr.istruzione.lombardia.gov.it/', ['Lombardia'], 'MI', DNS_26],
];

/**
 * ScuoleRadar.it — WHITELIST UST/USR VERIFICATA (2026-10-26) — Node-only, dati.
 *
 * Perché un file a parte: `fontiTerritoriali.ts` raccoglie i blocchi verificati
 * del 23 e del 25/10/2026 e sta già al limite di dimensione; il blocco di questa
 * sessione (173 URL fornite dal cliente, 163 uniche) entra qui, nella stessa
 * forma (tuple + data di verifica per voce) e viene riversato nel registro da
 * `fonti.ts` con una sola spread. Nessuna URL inventata.
 *
 * COME SONO STATE TRATTATE LE URL
 *  1. cross-reference contro il registro: 33 già attive, 13 già registrate ma
 *     spente (Piemonte «per ambito», `usrlazio.it`, `scuole.vda.it`, …: restano
 *     come sono, con il loro motivo) → nessun doppione;
 *  2. le 117 NEW sono state aperte una per una il 26/10/2026 (HTTP 200 + voci di
 *     reclutamento leggibili). 84 entrano attive (83 hub + 1 aggregatore), 27
 *     restano registrate e spente con il motivo dichiarato, 6 non entrano: sono
 *     alias della stessa pagina o indici di scelta senza righe proprie;
 *     DAL 31/10/2026 (§26.122) l'aggregatore è SPENTO: le attive sono 83, le
 *     spente 28. Un aggregatore privato non è una fonte.
 *  3. gli alias scartati sono elencati in fondo (`ALIAS_SCARTATI`) per memoria:
 *     `usr.sicilia.it` ≡ `www.usr.sicilia.it`, `servizi…/index.php` ≡ `/`,
 *     `miur.gov.it/web/molise` ≡ `mim.gov.it/web/molise`, le varianti `http://`
 *     di Umbria/Piemonte/Puglia.
 *
 * Criterio invariato (§26.89): una pagina è fonte solo se le sue voci portano a
 * un interpello leggibile. Le home che non contengono voci di reclutamento
 * restano registrate con `attiva: false` e il motivo — la copertura si dichiara,
 * non si simula. `npm run fonti:verifica` le ricontrolla tutte.
 */
import type { FonteInterpelli } from './fontiTipi.ts';
import { ESCLUSI_WHITELIST_2610 } from './fontiEsclusiWhitelist2610.ts';

/** Data della verifica HTTP di questo blocco. */
export const DATA_VERIFICA_WHITELIST = '2026-10-26';

/** [id, etichetta, url, regioni, capoluogo] — fonti ATTIVE. */
type TuplaAttiva = [string, string, string, string[], string];

const ATTIVI: TuplaAttiva[] = [
  // ── Emilia-Romagna: home dei nove USP + le due sezioni nuove ──
  ['er-fe-home', 'USP Ferrara — Home e avvisi (Ferrara)', 'https://fe.istruzioneer.gov.it/', ['Emilia-Romagna'], 'FE'],
  ['er-fc-home', 'USP Forlì-Cesena — Home e avvisi (Forlì)', 'https://fc.istruzioneer.gov.it/', ['Emilia-Romagna'], 'FC'],
  ['er-mo-home', 'USP Modena — Home e avvisi (Modena)', 'https://mo.istruzioneer.gov.it/', ['Emilia-Romagna'], 'MO'],
  ['er-pr-home', 'USP Parma — Home e avvisi (Parma)', 'https://pr.istruzioneer.gov.it/', ['Emilia-Romagna'], 'PR'],
  ['er-pc-home', 'USP Piacenza — Home e avvisi (Piacenza)', 'https://pc.istruzioneer.gov.it/', ['Emilia-Romagna'], 'PC'],
  ['er-ra-home', 'USP Ravenna — Home e avvisi (Ravenna)', 'https://ra.istruzioneer.gov.it/', ['Emilia-Romagna'], 'RA'],
  ['er-re-home', 'USP Reggio Emilia — Home e avvisi (Reggio Emilia)', 'https://re.istruzioneer.gov.it/', ['Emilia-Romagna'], 'RE'],
  ['er-fe-assunzioni', 'USP Ferrara — Interpelli docenti (Assunzioni e concorsi)', 'https://fe.istruzioneer.gov.it/category/assunzioni-e-concorsi/interpelli_docenti/', ['Emilia-Romagna'], 'FE'],
  ['er-rn-docenti-2526', 'USP Rimini — Interpelli docenti 2025/26', 'https://rn.istruzioneer.gov.it/category/personale-docente/interpelli-docenti-2025-2026/', ['Emilia-Romagna'], 'RN'],

  // ── Lazio: Latina, Frosinone, Viterbo (le altre sedi restano come sono) ──
  ['lt-interpelli', 'USP Latina — Interpelli (Latina)', 'https://www.csalatina.it/interpelli/', ['Lazio'], 'LT'],
  ['fr-interpello-nazionale', 'USP Frosinone — Interpelli nazionali (Frosinone)', 'https://www.uspistruzione.fr.it/wp2/tag/interpello-nazionale', ['Lazio'], 'FR'],
  ['vt-interpelli-docenti', 'USP Viterbo — Interpelli docenti (Viterbo)', 'https://www.provveditoratostudiviterbo.it/DOCENTI/interpelli/INTERPELLIDOC.htm', ['Lazio'], 'VT'],

  // ── Liguria: USR e le pagine per provincia ──
  ['li-usr-home', 'USR Liguria — Home e comunicati (Genova)', 'https://www.istruzioneliguria.gov.it/', ['Liguria'], 'GE'],
  ['li-interpelli-pagina', 'USR Liguria — Interpelli (pagina unica)', 'https://www.istruzioneliguria.gov.it/pagine/interpelli-', ['Liguria'], 'GE'],
  ['ge-interpelli-2526', 'USP Genova — Interpelli a.s. 2025/26', 'https://www.istruzionegenova.gov.it/pagine/interpelli-ge---as-2025-2026', ['Liguria'], 'GE'],
  ['sv-interpelli-2425', 'USP Savona — Interpelli a.s. 2024/25', 'https://www.istruzionesavona.gov.it/pagine/interpelli-sv---as-2024-2025-2', ['Liguria'], 'SV'],
  ['sp-interpelli-2425', 'USP La Spezia — Interpelli a.s. 2024/25', 'https://www.istruzionelaspezia.gov.it/pagine/interpelli-la-spezia---as-2024-2025', ['Liguria'], 'SP'],

  // ── Sicilia: USR e le sedi territoriali che pubblicano in autonomia ──
  ['pa-home', 'USR Sicilia — Home e avvisi (Palermo)', 'https://www.usr.sicilia.it/', ['Sicilia'], 'PA'],
  ['pa-personale-scuola', 'USR Sicilia — Area personale scuola (Palermo)', 'https://www.usr.sicilia.it/personale-scuola/', ['Sicilia'], 'PA'],
  ['pa-interpello-a033', 'USR Sicilia — Interpello A033 Bitonto (BA)', 'https://www.usr.sicilia.it/interpello-nazionale-per-supplenza-cdc-a033-bitonto-ba/', ['Sicilia'], 'PA'],
  ['tp-interpelli', 'USP Trapani — Interpelli (Trapani)', 'https://tp.usr.sicilia.it/personale-scuola/interpelli/', ['Sicilia'], 'TP'],
  ['cl-interpelli-nazionali', 'USP Caltanissetta/Enna — Interpelli nazionali', 'https://cl-en.usr.sicilia.it/interpelli-nazionali/', ['Sicilia'], 'CL'],
  ['me-interpelli-nazionali', 'USP Messina — Interpelli nazionali (Messina)', 'https://me.usr.sicilia.it/category/personale-scuola/interpelli/interpelli-nazionali/', ['Sicilia'], 'ME'],
  ['ct-interpelli', 'USP Catania — Interpelli (Catania)', 'https://ct.usr.sicilia.it/aree-tematiche/interpelli/', ['Sicilia'], 'CT'],
  ['ag-interpelli', 'USP Agrigento — Interpelli docenti (Agrigento)', 'https://ag.usr.sicilia.it/category/personale-scuola/personale-docente/interpelli/', ['Sicilia'], 'AG'],

  // ── Veneto: la ricerca interpelli di Verona (la home del USR non ha voci) ──
  ['vr-ricerca-interpelli', 'USP Verona — Ricerca interpelli (Verona)', 'https://verona.istruzioneveneto.gov.it/?s=interpelli', ['Veneto'], 'VR'],

  // ── Basilicata: Potenza (DSGA e nuovo elenco docenti) ──
  ['pz-interpelli-dsga', 'USP Potenza — Interpelli nazionali DSGA (Potenza)', 'https://www.istruzionepotenza.it/interpelli-nazionali-dsga/', ['Basilicata'], 'PZ'],
  ['pz-nuovo-interpelli', 'USP Potenza — Nuovi interpelli nazionali docenti', 'https://www.istruzionepotenza.it/nuovo-interpelli-nazionali-docenti/', ['Basilicata'], 'PZ'],

  // ── Calabria: le tre sedi provinciali con elenco vero ──
  ['vv-interpelli', 'USP Vibo Valentia — Interpelli (Vibo Valentia)', 'https://www.istruzione.calabria.it/vibovalentia/category/ccn/https-www-istruzione-calabria-it-vibovalentia-interpelli-3/', ['Calabria'], 'VV'],
  ['kr-interpelli', 'USP Crotone — Interpelli per supplenza (Crotone)', 'https://www.istruzione.calabria.it/crotone/category/notizie/interpelli-per-supplenza/', ['Calabria'], 'KR'],
  ['cs-interdoc', 'USP Cosenza — Interpelli docenti (Interdoc)', 'https://www.istruzione.calabria.it/cosenza/category/interdoc/', ['Calabria'], 'CS'],

  // ── Campania: Salerno, Avellino e i due tag di Napoli ──
  ['sa-territorio', 'ATP Salerno — Interpelli e avvisi (Salerno)', 'https://www.mim.gov.it/web/miur-usr-campania/uat-salerno', ['Campania'], 'SA'],
  ['av-home', 'USP Avellino — Home e avvisi (Avellino)', 'https://atavellino.it/', ['Campania'], 'AV'],
  ['na-tag-ata', 'USP Napoli — Interpelli personale ATA (Napoli)', 'https://www.uat-napoli.it/tag/interpelli-personale-ata/', ['Campania'], 'NA'],
  ['na-tag-docenti', 'USP Napoli — Interpelli personale docente (Napoli)', 'https://www.uat-napoli.it/tag/interpelli-personale-docente/', ['Campania'], 'NA'],

  // ── Lombardia: home USR + gli elenchi «ricerca supplenti» degli ATP ──
  ['lo-usr-home', 'USR Lombardia — Home e avvisi (Milano)', 'https://www.mim.gov.it/web/usr-lombardia/', ['Lombardia'], 'MI'],
  ['bg-interpelli', 'ATP Bergamo — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/bergamo/interpelli-ricerca-supplenti', ['Lombardia'], 'BG'],
  ['bs-interpelli', 'ATP Brescia — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/brescia/interpelli-ricerca-supplenti', ['Lombardia'], 'BS'],
  ['co-interpelli', 'ATP Como — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/como/interpelli-ricerca-supplenti', ['Lombardia'], 'CO'],
  ['cr-interpelli', 'ATP Cremona — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/cremona/interpelli-ricerca-supplenti', ['Lombardia'], 'CR'],
  ['lc-interpelli', 'ATP Lecco — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/lecco/interpelli-ricerca-supplenti', ['Lombardia'], 'LC'],
  ['lo-interpelli', 'ATP Lodi — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/lodi/interpelli-ricerca-supplenti', ['Lombardia'], 'LO'],
  ['mn-interpelli', 'ATP Mantova — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/mantova/interpelli-ricerca-supplenti', ['Lombardia'], 'MN'],
  ['mi-interpelli', 'ATP Milano — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/milano/interpelli-ricerca-supplenti', ['Lombardia'], 'MI'],
  ['pv-interpelli', 'ATP Pavia — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/pavia/interpelli-ricerca-supplenti', ['Lombardia'], 'PV'],
  ['so-interpelli', 'ATP Sondrio — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/sondrio/interpelli-ricerca-supplenti', ['Lombardia'], 'SO'],
  ['va-interpelli', 'ATP Varese — Interpelli ricerca supplenti', 'https://www.mim.gov.it/web/varese/interpelli-ricerca-supplenti', ['Lombardia'], 'VA'],

  // ── Sardegna: le home degli ATP (gli elenchi sono già attivi) ──
  ['ca-home', 'ATP Cagliari — Home e avvisi (Cagliari)', 'https://www.mim.gov.it/web/cagliari', ['Sardegna'], 'CA'],
  ['or-home', 'ATP Oristano — Home e avvisi (Oristano)', 'https://www.mim.gov.it/web/oristano', ['Sardegna'], 'OR'],
  ['nu-home', 'ATP Nuoro — Home e avvisi (Nuoro)', 'https://www.mim.gov.it/web/nuoro', ['Sardegna'], 'NU'],

  // ── Abruzzo: home e sezioni di Chieti-Pescara, L’Aquila e Teramo ──
  ['ch-home', 'USP Chieti-Pescara — Home e avvisi (Chieti)', 'https://www.istruzionechietipescara.it/', ['Abruzzo'], 'CH'],
  ['ch-istituzioni', 'USP Chieti-Pescara — Dalle istituzioni scolastiche', 'https://www.istruzionechietipescara.it/category/dalle-istituzioni-scolatiche/', ['Abruzzo'], 'CH'],
  ['aq-le-scuole', 'USP L’Aquila — Le scuole della provincia', 'https://lnx.csalaquila.it/wp/le-scuole/', ['Abruzzo'], 'AQ'],
  ['aq-home', 'USP L’Aquila — Home e avvisi', 'https://lnx.csalaquila.it/wp/', ['Abruzzo'], 'AQ'],
  ['te-interpelli', 'USP Teramo — Interpelli (Teramo)', 'https://www.csateramo.it/wpusp/interpelli', ['Abruzzo'], 'TE'],

  // ── Puglia: BAT, Taranto, Brindisi e Lecce ──
  ['bt-interpelli-2627', 'USP Barletta-Andria-Trani — Interpelli a.s. 2026/27', 'https://www.istruzionebat.it/interpelli/a-s-2026-2027/', ['Puglia'], 'BT'],
  ['ta-ricerca-interpelli', 'USP Taranto — Ricerca interpelli (Taranto)', 'https://www.usptaranto.it/?s=interpell', ['Puglia'], 'TA'],
  ['br-interpelli', 'USP Brindisi — Interpelli (Brindisi)', 'https://www.istruzionebrindisi.it/category/interpelli/', ['Puglia'], 'BR'],
  ['le-interpelli', 'USP Lecce — Interpelli (Lecce)', 'https://www.ustlecce.it/index.php/interpelli', ['Puglia'], 'LE'],

  // ── Friuli-Venezia Giulia: i tre Uffici Territoriali (portale unico) ──
  ['ts-interpelli', 'UST Trieste — Interpelli', 'https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-trieste/Interpelli/', ['Friuli-Venezia Giulia'], 'TS'],
  ['go-interpelli', 'UST Gorizia — Interpelli', 'https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-gorizia/Interpelli/', ['Friuli-Venezia Giulia'], 'GO'],
  ['ud-interpelli', 'UST Udine — Interpelli', 'https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-udine/Interpelli/', ['Friuli-Venezia Giulia'], 'UD'],

  // ── Toscana: i dieci Uffici Territoriali, uno per provincia ──
  ['fi-home', 'UST Firenze — Home e avvisi (Firenze)', 'https://www.ust.fi.it/', ['Toscana'], 'FI'],
  ['fi-interpelli', 'UST Firenze — Interpelli (Firenze)', 'https://www.ust.fi.it/mese/interpelli/', ['Toscana'], 'FI'],
  ['ms-home', 'UST Massa-Carrara — Home e avvisi (Massa)', 'https://www.ustms.it/', ['Toscana'], 'MS'],
  ['ms-interpelli', 'UST Massa-Carrara — Interpelli docenti (Massa)', 'https://www.ustms.it/category/docenti/interpelli/', ['Toscana'], 'MS'],
  ['ar-home', 'USP Arezzo — Home e avvisi (Arezzo)', 'https://www.arezzoistruzione.it/usparezzo/', ['Toscana'], 'AR'],
  ['ar-interpelli', 'USP Arezzo — Interpelli (Arezzo)', 'https://www.arezzoistruzione.it/usparezzo/index.php/interpelli', ['Toscana'], 'AR'],
  ['ar-tabella-avvisi', 'USP Arezzo — Tabella avvisi di interpello O.M. 27/2026', 'https://www.arezzoistruzione.it/usparezzo/index.php/interpelli/2159-tabella-degli-avvisi-di-interpello-o-m-n-27-2026-art-14-comma-22', ['Toscana'], 'AR'],
  ['gr-home', 'USP Grosseto — Home e avvisi (Grosseto)', 'https://www.ufficioscolasticogrosseto.it/uff7/', ['Toscana'], 'GR'],
  ['li-home', 'USP Livorno — Home e avvisi (Livorno)', 'https://www.ustli.it/usp_livorno/', ['Toscana'], 'LI'],
  ['li-interpelli', 'USP Livorno — Interpelli docenti (Livorno)', 'https://www.ustli.it/usp_livorno/index.php/docenti/interpelli', ['Toscana'], 'LI'],
  ['lu-home', 'UST Lucca — Home e avvisi (Lucca)', 'https://ustlucca.it/', ['Toscana'], 'LU'],
  ['lu-interpelli', 'UST Lucca — Interpelli (Lucca)', 'https://ustlucca.it/category/interpelli/', ['Toscana'], 'LU'],
  ['po-home', 'UST Prato — Home e avvisi (Prato)', 'https://www.ufficioscolasticoprovinciale.prato.it/', ['Toscana'], 'PO'],
  ['po-news', 'UST Prato — News e comunicazioni (Prato)', 'https://www.ufficioscolasticoprovinciale.prato.it/news/', ['Toscana'], 'PO'],
  ['pi-interpelli', 'USP Pisa — Interpelli (Pisa)', 'https://www.usp-pi.it/category/interpelli/', ['Toscana'], 'PI'],
  ['pi-home', 'USP Pisa — Home e avvisi (Pisa)', 'https://www.usp-pi.it/', ['Toscana'], 'PI'],
  ['si-home', 'USP Siena — Home e avvisi (Siena)', 'https://www.uspsi.it/', ['Toscana'], 'SI'],
  ['si-interpelli-docenti', 'USP Siena — Interpelli docenti (Siena)', 'https://www.uspsi.it/uspsiena/interpelli-docenti/', ['Toscana'], 'SI'],
  ['si-interpelli-ata', 'USP Siena — Interpelli ATA (Siena)', 'https://www.uspsi.it/uspsiena/interpelli-ata/', ['Toscana'], 'SI'],
  ['pt-home', 'UST Pistoia — Home e avvisi (Pistoia)', 'https://www.ufficioscolasticoprovinciale.pistoia.it/', ['Toscana'], 'PT'],
  ['pt-comunicazioni', 'UST Pistoia — Comunicazioni (Pistoia)', 'https://www.ufficioscolasticoprovinciale.pistoia.it/comunicazioni/', ['Toscana'], 'PT'],
];

/**
 * AGGREGATORI TERZI — §26.122: NESSUNO ENTRA PIÙ.
 *
 * Fino al 31/10/2026 questo blocco conteneva una voce ATTIVA
 * (`interpelloweb.it/interpelli-supplenze/istituto/boss000vd8/`): un aggregatore
 * concorrente usato come FONTE del motore, con 35 segnali di interpello e nessuna
 * provincia dichiarata. Conseguenza misurata: le righe nate da lì portavano in
 * bacheca l'indirizzo dell'aggregatore (o, dopo il gate §26.109, la home della
 * scuola) senza che l'avviso fosse un atto dell'istituto.
 *
 * La regola ora è quella della whitelist dei domini (`lib/dominiIstituzionali.ts`,
 * `AGGREGATORI_PRIVATI`): un aggregatore non è una fonte, è un concorrente. La
 * voce resta REGISTRATA e SPENTA, con il motivo — la copertura si dichiara, non
 * si simula — così chi legge il registro sa perché non c'è.
 */
const AGGREGATORI_ESCLUSI: Array<[string, string, string, string]> = [
  [
    'interpelloweb-boss000vd8',
    'InterpelloWeb — Istituto BOS000VD8 (aggregatore)',
    'https://interpelloweb.it/interpelli-supplenze/istituto/boss000vd8/',
    'aggregatore privato concorrente: non è una fonte istituzionale (§26.109 · §26.122)',
  ],
];

/**
 * Alias della stessa pagina, scartati in cross-reference (non entrano nel
 * registro: l’URL canonica è già presente in uno dei blocchi).
 */
export const ALIAS_SCARTATI: string[] = [
  'https://usr.sicilia.it/ (≡ https://www.usr.sicilia.it/)',
  'https://servizi.istruzioneliguria.gov.it/ (indice delle quattro province: le fonti vere sono i provincia.php già attivi)',
  'https://servizi.istruzioneliguria.gov.it/index.php (≡ https://servizi.istruzioneliguria.gov.it/)',
  'http://www.istruzionepiemonte.it/ (≡ https://www.istruzionepiemonte.it/)',
  'http://istruzione.umbria.it/ (≡ https://istruzione.umbria.it/)',
  'http://www.pugliausr.gov.it/ (≡ https://www.pugliausr.gov.it/)',
];

/**
 * Blocco della whitelist 26/10/2026 nella forma del registro: prima le fonti
 * attive (hub + aggregatori), poi quelle spente con il motivo. Gli `id` hanno
 * il prefisso `w26-` per non collidere con i blocchi precedenti.
 */
export const FONTI_WHITELIST_2610: FonteInterpelli[] = [
  ...ATTIVI.map(([id, etichetta, url, regioni, capoluogo]) => ({
    id: `w26-${id}`,
    etichetta,
    url,
    tipo: 'hub-istituzionale' as const,
    regioni,
    capoluogo,
    nazionale: false,
    attiva: true,
    verificata: DATA_VERIFICA_WHITELIST,
  })),
  ...AGGREGATORI_ESCLUSI.map(([id, etichetta, url, note]) => ({
    id: `w26-${id}`,
    etichetta,
    url,
    tipo: 'aggregatore' as const,
    regioni: [] as string[],
    capoluogo: null,
    nazionale: true,
    attiva: false,
    verificata: null,
    note,
  })),
  ...ESCLUSI_WHITELIST_2610.map(([id, etichetta, url, regioni, capoluogo, note]) => ({
    id: `w26-${id}`,
    etichetta,
    url,
    tipo: 'hub-istituzionale' as const,
    regioni,
    capoluogo,
    nazionale: false,
    attiva: false,
    verificata: null,
    note,
  })),
];

/** Numeri dichiarati (guardia `npm run test:whitelist`): attive, spente, totale. */
export const RIEPILOGO_WHITELIST_2610 = {
  attive: ATTIVI.length,
  spente: AGGREGATORI_ESCLUSI.length + ESCLUSI_WHITELIST_2610.length,
  totale: ATTIVI.length + AGGREGATORI_ESCLUSI.length + ESCLUSI_WHITELIST_2610.length,
} as const;

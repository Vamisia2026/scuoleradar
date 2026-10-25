/**
 * ScuoleRadar.it — HUB TERRITORIALI VERIFICATI (Node-only, PURO, SOLO DATI).
 *
 * Secondo blocco del registro fonti (§26.89): gli elenchi di interpelli degli
 * Uffici Territoriali (ATP/USP), che pubblicano per PROVINCIA — non solo per
 * capoluogo di regione. A differenza di `HUB_ATTIVI` (verifica 2026-09-28,
 * solo USR dei capoluoghi) questi URL sono stati verificati il 2026-10-23 uno
 * per uno (HTTP 200 + contenuto di reclutamento nell'elenco), quindi ognuno ha
 * la propria data di verifica.
 *
 * Tuple: [id, etichetta, url, regioni, capoluogo].
 * Le URL NON verificabili sono in `fontiEsclusiVerifica.ts` con il motivo.
 * Criterio (non solo HTTP 200): una pagina è fonte solo se le sue voci portano a
 * un documento/pagina dell'interpello. Gli elenchi pieni ma senza link — il modulo
 * «per ambito» del Piemonte — restano esclusi: un avviso senza URL ufficiale non
 * è verificabile.
 *
 * Nota sul volume: gli hub territoriali sono molti più del budget di rete di
 * un run. La SELEZIONE (quali interrogare ora) sta in `fonti.ts`
 * (`MAX_HUB_PER_REGIONE`, rotazione giornaliera): restano tutti attivi e
 * verificati, ma nessun run li scarica tutti.
 */

/** Data dell'ultima verifica HTTP di questo blocco. */
export const DATA_VERIFICA_TERRITORI = '2026-10-23';

/** Data della verifica del blocco AGGIORNATO (nuovi territori, 2026-10-25). */
export const DATA_VERIFICA_AGGIORNATI = '2026-10-25';

/**
 * Elenchi di interpelli degli Uffici Territoriali (provincia per provincia).
 * Il sesto elemento (OPZIONALE) è la data di verifica della singola voce:
 * assente = `DATA_VERIFICA_TERRITORI`, così blocchi verificati in giorni diversi
 * restano tracciabili senza riscrivere le date già dichiarate.
 */
export const HUB_TERRITORIALI: [string, string, string, string[], string, string?][] = [
  // ── Emilia-Romagna: una pagina per USP, con elenco reale per provincia ──
  ['er-bo-home', 'USP Bologna — Avvisi e interpelli (Bologna)', 'https://bo.istruzioneer.gov.it/', ['Emilia-Romagna'], 'BO'],
  ['er-fe-docenti', 'USP Ferrara — Interpelli docenti (Ferrara)', 'https://fe.istruzioneer.gov.it/category/interpelli_docenti/', ['Emilia-Romagna'], 'FE'],
  ['er-fe-ata', 'USP Ferrara — Interpelli personale ATA (Ferrara)', 'https://fe.istruzioneer.gov.it/category/interpelli-personale-ata/', ['Emilia-Romagna'], 'FE'],
  ['er-fc-interpelli', 'USP Forlì-Cesena — Interpelli a.s. 2026/27 (Forlì)', 'https://fc.istruzioneer.gov.it/category/interpelli-a-s-2026-27/', ['Emilia-Romagna'], 'FC'],
  ['er-mo-docenti', 'USP Modena — Interpelli personale docente 2026/27 (Modena)', 'https://mo.istruzioneer.gov.it/category/interpelli-personale-docente-2026-27/', ['Emilia-Romagna'], 'MO'],
  ['er-pr-interpelli', 'USP Parma — Interpelli docenti (Parma)', 'https://pr.istruzioneer.gov.it/interpelli-docenti/', ['Emilia-Romagna'], 'PR'],
  ['er-pc-interpelli', 'USP Piacenza — Interpelli (Piacenza)', 'https://pc.istruzioneer.gov.it/interpelli/', ['Emilia-Romagna'], 'PC'],
  ['er-ra-supplenze', 'USP Ravenna — Supplenze da esaurimento graduatorie (Ravenna)', 'https://ra.istruzioneer.gov.it/conferimento-supplenze-per-esaurimento-graduatorie-di-istituto/', ['Emilia-Romagna'], 'RA'],
  ['er-re-interpelli', 'USP Reggio Emilia — Interpelli docenti (Reggio Emilia)', 'https://re.istruzioneer.gov.it/category/docenti/interpello/', ['Emilia-Romagna'], 'RE'],

  // ── Piemonte: gli elenchi per AMBITO non sono leggibili ──
  // `ric_interpello_ambito_<prov>.php` è la pagina di un MODULO di ricerca: HTTP
  // 200 e tabelle piene (1419 righe a TO, 315 ad AL), ma nessuna riga contiene un
  // link (0 `<a href>`): senza l'URL del singolo interpello l'avviso non è
  // verificabile, quindi le 8 URL sono in `fontiEsclusiVerifica.ts`. La copertura
  // del Piemonte resta affidata agli hub USR di Torino (`fontiRegistro.ts`).

  // ── Liguria: motore di interpelli per provincia (4 province) ──
  // URL SENZA parametro d'anno (`&as=2026%2F2027`): la pagina rende l'a.s. in
  // corso, così la fonte non si svuota al cambio d'anno (verificato il 23/10/2026:
  // GE 93 voci, SP 23, IM 18, SV 18).
  // La HOME del portale NON è una fonte: le sue righe sono i quattro indici
  // provinciali («GE · Genova · 509 interpelli e comunicati a.s. 2026/2027»), che
  // passavano il gate come se fossero avvisi e finivano in bacheca al posto degli
  // interpelli veri. Gli elenchi da leggere sono le `provincia.php` qui sotto.
  ['li-nazionali', 'USR Liguria — Interpelli nazionali (Genova)', 'https://servizi.istruzioneliguria.gov.it/nazionali.php', ['Liguria'], 'GE'],
  ['li-ge-interpelli', 'USR Liguria — Interpelli Genova (Genova)', 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=GE', ['Liguria'], 'GE'],
  ['li-sp-interpelli', 'USR Liguria — Interpelli La Spezia (La Spezia)', 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SP', ['Liguria'], 'SP'],
  ['li-im-interpelli', 'USR Liguria — Interpelli Imperia (Imperia)', 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=IM', ['Liguria'], 'IM'],
  ['li-sv-interpelli', 'USR Liguria — Interpelli Savona (Savona)', 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=SV', ['Liguria'], 'SV'],

  // ── Lazio: ATP Roma (il solo elenco con righe) e USP Rieti ──
  ['rm-atproma-docenti', 'USP Roma — Interpelli personale docente (Roma)', 'https://www.atpromaistruzione.it/atp/category/reclutamento/interpelli-personale-docente/', ['Lazio'], 'RM'],
  ['ri-usp-interpelli', 'USP Rieti — Interpelli (Rieti)', 'https://www.usp-rieti.it/interpelli/', ['Lazio'], 'RI'],

  // ── Sicilia: elenco degli interpelli nazionali TD docenti ──
  ['pa-interpelli-nazionali', 'USR Sicilia — Interpelli nazionali TD docenti (Palermo)', 'https://www.usr.sicilia.it/category/personale-scuola/docenti/interpelli-nazionali-contratti-a-tempo-determinato-docenti/', ['Sicilia'], 'PA'],

  // ── Veneto: USP Padova (docenti e DSGA) ──
  ['pd-docenti', 'USP Padova — Interpelli personale docente (Padova)', 'https://padova.istruzioneveneto.gov.it/category/interpelli-personale-docente/', ['Veneto'], 'PD'],
  ['pd-dsga', 'USP Padova — Interpelli DSGA (Padova)', 'https://padova.istruzioneveneto.gov.it/category/interpelli-dsga/', ['Veneto'], 'PD'],

  // ── Sardegna: e-portfolio MIM degli ATP, elenchi molto densi ──
  ['ss-interpelli-docenti', 'ATP Sassari — Interpelli docenti (Sassari)', 'https://www.mim.gov.it/web/sassari/interpelli-docenti', ['Sardegna'], 'SS'],
  ['nu-interpelli', 'ATP Nuoro — Interpelli (Nuoro)', 'https://www.mim.gov.it/web/nuoro/interpelli', ['Sardegna'], 'NU'],
  ['ca-interpelli', 'ATP Cagliari — Interpelli docenti e personale educativo (Cagliari)', 'https://www.mim.gov.it/web/cagliari/interpelli-docenti-e-personale-educativo', ['Sardegna'], 'CA'],

  // ── Abruzzo: USP con WordPress (L’Aquila, Teramo) e Chieti ──
  ['aq-interpelli-nazionali', 'USP L’Aquila — Interpelli nazionali (L’Aquila)', 'https://lnx.csalaquila.it/wp/category/interpelli-nazionali/', ['Abruzzo'], 'AQ'],
  ['te-wpusp', 'USP Teramo — Avvisi e interpelli (Teramo)', 'https://www.csateramo.it/wpusp/', ['Abruzzo'], 'TE'],
  ['ch-interpelli-provinciali', 'USP Chieti — Interpelli provinciali (Chieti)', 'https://www.istruzionechietipescara.it/category/interpelli-provinciali/', ['Abruzzo'], 'CH'],

  // ── Basilicata: Potenza (interpelli nazionali docenti) e Matera ──
  ['pz-interpelli-nazionali', 'USP Potenza — Interpelli nazionali docenti (Potenza)', 'https://www.istruzionepotenza.it/interpelli-nazionali-docenti/', ['Basilicata'], 'PZ'],
  ['mt-interpelli', 'USP Matera — Interpelli (Matera)', 'https://www.istruzionematera.it/category/interpelli/', ['Basilicata'], 'MT'],

  // ── Campania: Napoli, Caserta e Avellino (le altre sedi non risolvono) ──
  ['na-uat-home', 'USP Napoli — Avvisi e interpelli (Napoli)', 'https://www.uat-napoli.it/', ['Campania'], 'NA'],
  ['ce-uat-interpelli', 'USP Caserta — Interpelli (Caserta)', 'https://www.uat-caserta.it/interpelli/', ['Campania'], 'CE'],
  ['av-ata-avvisi', 'USP Avellino — Avvisi e interpelli (Avellino)', 'https://atavellino.it/avvisi/', ['Campania'], 'AV'],

  // ── Lombardia: e-portfolio MIM degli ATP (elenchi per provincia) ──
  ['mb-interpelli-supplenti', 'ATP Monza e Brianza — Interpelli ricerca supplenti (Monza)', 'https://www.mim.gov.it/web/monza-brianza/interpelli-ricerca-supplenti', ['Lombardia'], 'MB'],
  ['mi-territorio', 'ATP Milano — Interpelli e avvisi (Milano)', 'https://www.mim.gov.it/web/milano', ['Lombardia'], 'MI'],
  ['bg-territorio', 'ATP Bergamo — Interpelli e avvisi (Bergamo)', 'https://www.mim.gov.it/web/bergamo', ['Lombardia'], 'BG'],
  ['bs-territorio', 'ATP Brescia — Interpelli e avvisi (Brescia)', 'https://www.mim.gov.it/web/brescia', ['Lombardia'], 'BS'],
  ['co-territorio', 'ATP Como — Interpelli e avvisi (Como)', 'https://www.mim.gov.it/web/como', ['Lombardia'], 'CO'],
  ['cr-territorio', 'ATP Cremona — Interpelli e avvisi (Cremona)', 'https://www.mim.gov.it/web/cremona', ['Lombardia'], 'CR'],
  ['lc-territorio', 'ATP Lecco — Interpelli e avvisi (Lecco)', 'https://www.mim.gov.it/web/lecco', ['Lombardia'], 'LC'],
  ['lo-territorio', 'ATP Lodi — Interpelli e avvisi (Lodi)', 'https://www.mim.gov.it/web/lodi', ['Lombardia'], 'LO'],
  ['mn-territorio', 'ATP Mantova — Interpelli e avvisi (Mantova)', 'https://www.mim.gov.it/web/mantova', ['Lombardia'], 'MN'],
  ['pv-territorio', 'ATP Pavia — Interpelli e avvisi (Pavia)', 'https://www.mim.gov.it/web/pavia', ['Lombardia'], 'PV'],
  ['so-territorio', 'ATP Sondrio — Interpelli e avvisi (Sondrio)', 'https://www.mim.gov.it/web/sondrio', ['Lombardia'], 'SO'],
  ['va-territorio', 'ATP Varese — Interpelli e avvisi (Varese)', 'https://www.mim.gov.it/web/varese', ['Lombardia'], 'VA'],

  // ── AGGIORNAMENTO 2026-10-25: territori rimasti scoperti, verificati uno per uno ──
  // Criterio identico ai blocchi precedenti: HTTP 200 + voci di reclutamento
  // leggibili nella pagina (link reali verso l’avviso), niente URL inventate.
  // Le province provate e NON servibili sono in `fontiEsclusiVerifica.ts`.

  // Emilia-Romagna: Rimini (categoria senza anno scolastico, non si svuota a settembre)
  ['er-rn-docenti', 'USP Rimini — Interpelli personale docente (Rimini)', 'https://rn.istruzioneer.gov.it/category/personale-docente/', ['Emilia-Romagna'], 'RN', DATA_VERIFICA_AGGIORNATI],

  // Veneto: gli USP pubblicano su sottodomini con struttura diversa da Padova
  ['tv-avvisi', 'USP Treviso — Avvisi e reclutamento (Treviso)', 'https://treviso.istruzioneveneto.gov.it/argomenti/avvisi/', ['Veneto'], 'TV', DATA_VERIFICA_AGGIORNATI],
  ['vr-interpelli-docenti', 'USP Verona — Interpelli docenti (Verona)', 'https://verona.istruzioneveneto.gov.it/index.php/interpelli-docenti/', ['Veneto'], 'VR', DATA_VERIFICA_AGGIORNATI],
  ['ve-interpelli-supplenze', 'USP Venezia — Interpelli e supplenze (Venezia)', 'https://venezia.istruzioneveneto.gov.it/interpelli-supplenze/', ['Veneto'], 'VE', DATA_VERIFICA_AGGIORNATI],
  ['vi-avvisi-interpelli', 'USP Vicenza — Avvisi e interpelli docenti (Vicenza)', 'https://vicenza.istruzioneveneto.gov.it/avvisi-interpelli-docenti-vicenza/', ['Veneto'], 'VI', DATA_VERIFICA_AGGIORNATI],
  ['ro-interpelli-docenti', 'USP Rovigo — Interpelli docenti (Rovigo)', 'https://rovigo.istruzioneveneto.gov.it/category/5-interpelli/docenti-rovigo/', ['Veneto'], 'RO', DATA_VERIFICA_AGGIORNATI],

  // Molise: e-portfolio MIM dei due Uffici Territoriali (prima solo l’hub regionale)
  ['cb-interpelli', 'USP Campobasso — Interpelli (Campobasso)', 'https://www.mim.gov.it/web/campobasso/interpelli', ['Molise'], 'CB', DATA_VERIFICA_AGGIORNATI],
  ['is-interpelli', 'USP Isernia — Interpelli (Isernia)', 'https://www.mim.gov.it/web/isernia/interpelli', ['Molise'], 'IS', DATA_VERIFICA_AGGIORNATI],

  // Sardegna: quarto territorio (Oristano) accanto a Cagliari, Nuoro e Sassari
  ['or-reclutamento', 'ATP Oristano — Reclutamento e interpelli (Oristano)', 'https://www.mim.gov.it/web/oristano/reclutamento', ['Sardegna'], 'OR', DATA_VERIFICA_AGGIORNATI],
];

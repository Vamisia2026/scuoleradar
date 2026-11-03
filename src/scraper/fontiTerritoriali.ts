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
 * Criterio (non solo HTTP 200): una pagina è fonte se le sue voci portano a un
 * documento/pagina dell'interpello OPPURE se la RIGA dichiara da sola l'atto —
 * codice meccanografico, classe di concorso, stato e scadenza — e la pagina è
 * l'URL ufficiale di quell'elenco (tabelle dense, §26.123). Restano esclusi gli
 * elenchi che non offrono nessun link e nessuna data: una pagina resa solo da JavaScript
 * (Nuvola) o un albo senza termine di candidatura non sono leggibili, e fingersi
 * di averli letti sarebbe copertura finta.
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
 * Data della verifica del blocco SICILIA (§26.132, 2026-11-02).
 *
 * Perché un blocco nuovo invece di correggere il registro: gli ARCHIVI di
 * categoria dell'USP di Catania e dell'USR Sicilia sono stati aperti uno per
 * uno il 02/11/2026 (HTTP 200 + voci di reclutamento con il documento
 * dell'atto), mentre le voci del registro che puntavano alle stesse aree
 * rispondevano con un redirect a un SINGOLO articolo. La data per voce evita di
 * riscrivere le date già dichiarate dagli altri blocchi.
 */
export const DATA_VERIFICA_SICILIA = '2026-11-02';

/**
 * Data della verifica del blocco PIEMONTE (2026-11-03, §26.137).
 *
 * CAMBIO DI CRITERIO rispetto al 2026-10-23: gli elenchi «per ambito» dell'USP
 * (`ric_interpello_ambito_<prov>.php`) non hanno link per voce, ma sono TABELLE
 * DENSE con le etichette di colonna in chiaro — «Codice meccanografico Istituo
 * Scolastico*», «Classe di concorso*», «Stato interpello*», «Data Scadenza
 * Interpello*». Il lettore profondo di `tabellaUst.ts` (§26.123) legge le CELLE,
 * quindi la riga descrive l'atto per intero e la pagina dell'USP è il suo URL
 * ufficiale: la fonte è verificabile senza inventare nessun indirizzo. Il
 * criterio del 23/10 («niente link per voce = esclusa») reggeva finché il lettore
 * non sapeva leggere le tabelle dense; oggi lo sa, e il Piemonte è la regione con
 * più interpelli dichiarati d'Italia.
 */
export const DATA_VERIFICA_PIEMONTE_03 = '2026-11-03';

/** Data della verifica del blocco PUGLIA (2026-11-03, §26.137): albo dell'UST Foggia. */
export const DATA_VERIFICA_PUGLIA_03 = '2026-11-03';

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

  // ── PIEMONTE: gli otto elenchi «per ambito» SONO una fonte (2026-11-03, §26.137) ──
  // CAMBIO DI CRITERIO. Fino al 23/10 queste URL erano escluse perché «nessuna riga
  // contiene un link»: vero (0 `<a href>` su 207 righe ad Asti), ma irrilevante ora
  // che la riga si legge per CELLE. Ogni `<tr>` dichiara codice meccanografico,
  // denominazione, classe di concorso, tipo cattedra, durata, data interpello, stato
  // e «Data Scadenza Interpello»: l'atto è descritto, e la pagina dell'USP è il suo
  // URL ufficiale. MISURA del 03/11/2026 (UA browser, 8/8 HTTP 200) — righe totali /
  // righe «aperto» / scadenze entro i 15 giorni / righe che passano anche il segnale
  // di insegnamento:
  //   TO 1545/50/26/20 · CN 715/80/18/17 · NO 402/17/17/13 · AL 339/9/7/5
  //   BI 312/180/0/0 · VB 252/139/0/0 · VC 221/136/0/0 · AT 207/4/1/1
  // BI, VB e VC dichiarano come scadenza la FINE DELL'INCARICO (30/04/2027): il gate
  // li scarta per finestra ed è il comportamento voluto (§26.82). Restano registrati
  // perché sono l'unico elenco ufficiale di quelle province, e il giorno in cui la
  // colonna porta un termine di candidatura la riga passa senza toccare il codice.
  // L'edizione `interpello2025/` serve uno SNAPSHOT della stessa tabella (stessi
  // conteggi di righe, stati fermi: NO 204 «aperto» contro 17) e resta esclusa in
  // `fontiEsclusiVerifica.ts`.
  ['pi-at-ambito', 'USP Asti — Interpelli per ambito (Asti)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_at.php', ['Piemonte'], 'AT', DATA_VERIFICA_PIEMONTE_03],
  ['pi-al-ambito', 'USP Alessandria — Interpelli per ambito (Alessandria)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_al.php', ['Piemonte'], 'AL', DATA_VERIFICA_PIEMONTE_03],
  ['pi-bi-ambito', 'USP Biella — Interpelli per ambito (Biella)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_bi.php', ['Piemonte'], 'BI', DATA_VERIFICA_PIEMONTE_03],
  ['pi-cn-ambito', 'USP Cuneo — Interpelli per ambito (Cuneo)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_cn.php', ['Piemonte'], 'CN', DATA_VERIFICA_PIEMONTE_03],
  ['pi-no-ambito', 'USP Novara — Interpelli per ambito (Novara)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_no.php', ['Piemonte'], 'NO', DATA_VERIFICA_PIEMONTE_03],
  ['pi-to-ambito', 'USP Torino — Interpelli per ambito (Torino)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_to.php', ['Piemonte'], 'TO', DATA_VERIFICA_PIEMONTE_03],
  ['pi-vb-ambito', 'USP Verbania — Interpelli per ambito (Verbania)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_vb.php', ['Piemonte'], 'VB', DATA_VERIFICA_PIEMONTE_03],
  ['pi-vc-ambito', 'USP Vercelli — Interpelli per ambito (Vercelli)', 'https://servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_vc.php', ['Piemonte'], 'VC', DATA_VERIFICA_PIEMONTE_03],

  // ── SCUOLE DI ASTI (2026-11-03): le due che pubblicano davvero gli interpelli ──
  // Gli istituti comprensivi della provincia non hanno un elenco: 4 siti aperti uno
  // per uno, e solo due contengono avvisi veri (i PDF datati nel nome del file).
  //   IIS Giobert          «Interpelli Docenti» — 2 voci, PDF `Interpello AS12.pdf`
  //                        con la data nel titolo («Interpello AS12 — 14/10/2026»)
  //   IC Castell'Alfero    «Interpelli» — `Interpello-n.1_ADAA-…-fino-al-30_06_2027.pdf`
  //   IC S. Damiano        9 link, tutti di condivisione social: 0 avvisi (escluso)
  //   IC Villanova d'Asti  2 link, 0 avvisi (escluso)
  // Zero candidabili oggi (l'avviso del Giobert scadeva il 14/10), ma è l'unico
  // canale con cui una scuola di Asti pubblica un interpello di istituto.
  ['asti-giobert-interpelli', 'IIS G.A. Giobert Asti — Interpelli docenti (Asti)', 'https://www.giobert.it/iisgiobert/?page_id=5473', ['Piemonte'], 'AT', DATA_VERIFICA_PIEMONTE_03],
  ['asti-castellalfero-interpelli', 'IC Castell’Alfero — Interpelli (Asti)', 'https://iccastellalfero.edu.it/mad/', ['Piemonte'], 'AT', DATA_VERIFICA_PIEMONTE_03],

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

  // ── AGGIORNAMENTO 2026-11-02 (§26.132): SICILIA — gli archivi che pubblicano per CT ──
  // MISURA, PRIMA DELLE URL. Le pagine «aree-tematiche/interpelli» dell'USP di
  // Catania elencano voci vere (18 allegati, 8 con «sostegno»), ma le 10 scadenze
  // dichiarate vanno dal 20/02/2026 al 26/05/2026: sono tutte passate. Gli avvisi
  // in corso — «posti comuni e di SOSTEGNO … a.s. 2026/27 GAE e GPS I e II fascia»
  // — vivono negli ARCHIVI di categoria, dove ogni voce è un articolo con i PDF
  // dell'atto (6 PDF, 0 ZIP sull'avviso P.6 del 20/10/2026, che l'elenco-landing
  // non mostra affatto). Un elenco che si svuota a settembre non è una fonte: lo
  // è l'archivio che resta.
  ['ct-reclutamento-docenti', 'USP Catania — Archivio reclutamento docenti (Catania)', 'https://ct.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'CT', DATA_VERIFICA_SICILIA],
  ['ct-interpelli-archivio', 'USP Catania — Archivio interpelli (Catania)', 'https://ct.usr.sicilia.it/category/aree-tematiche/interpelli/', ['Sicilia'], 'CT', DATA_VERIFICA_SICILIA],

  // ── AGGIORNAMENTO 2026-11-02 (§26.134): LE ALTRE SEI SEDI PROVINCIALI ──
  // MISURA, PRIMA DELLE URL. Ogni sede USP della Sicilia ha un archivio di
  // categoria «personale-docente/reclutamento-docenti», e in quell'archivio ci
  // sono gli INTERPELLI con la scadenza dichiarata nel titolo. Verifica HTTP del
  // 02/11/2026 (voci d'articolo = link interni con testo, navigazione esclusa):
  //
  //   AG    200 · 26 voci · 2 «interpello» · 6 «sostegno»
  //   CL-EN 200 · 33 voci · 9 «interpello» · 2 «sostegno»
  //   ME    200 · 28 voci · 0 «interpello» · 1 «sostegno»
  //   RG    200 · 23 voci · 5 «interpello» · 2 «sostegno»
  //   SR    200 · 29 voci · 7 «interpello» · 4 «sostegno»
  //   TP    200 · 29 voci · 1 «interpello» · 1 «sostegno»
  //
  // Palermo (USR) è l'unica che NON ha questo archivio: `…/reclutamento-docenti/`
  // risponde 404 in entrambe le forme, e l'elenco dell'USR resta quello di
  // `category/aree-tematiche/reclutamento/` (già registrato sopra). Le pagine
  // «interpelli» delle singole sedi non bastano: `rg`/`sr` `/interpelli/`
  // rispondono 404 e redirect a UN articolo (vedi `fontiEsclusiVerifica.ts`).
  ['ag-reclutamento-docenti', 'USP Agrigento — Archivio reclutamento docenti (Agrigento)', 'https://ag.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'AG', DATA_VERIFICA_SICILIA],
  ['cl-en-reclutamento-docenti', 'USP Caltanissetta/Enna — Archivio reclutamento docenti (Caltanissetta)', 'https://cl-en.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'CL', DATA_VERIFICA_SICILIA],
  ['me-reclutamento-docenti', 'USP Messina — Archivio reclutamento docenti (Messina)', 'https://me.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'ME', DATA_VERIFICA_SICILIA],
  ['rg-reclutamento-docenti', 'USP Ragusa — Archivio reclutamento docenti (Ragusa)', 'https://rg.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'RG', DATA_VERIFICA_SICILIA],
  ['sr-reclutamento-docenti', 'USP Siracusa — Archivio reclutamento docenti (Siracusa)', 'https://sr.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'SR', DATA_VERIFICA_SICILIA],
  ['tp-reclutamento-docenti', 'USP Trapani — Archivio reclutamento docenti (Trapani)', 'https://tp.usr.sicilia.it/category/personale-scuola/personale-docente/reclutamento-docenti/', ['Sicilia'], 'TP', DATA_VERIFICA_SICILIA],
  // USR Sicilia: l'archivio della categoria «reclutamento» (10 avvisi per pagina:
  // scorrimento, INR, albo commissioni, accreditamento tirocini a.s. 2026/27)
  // prende il posto di `/interpelli/`, che risponde con un redirect a UN articolo
  // di un'altra provincia, e di `/aree-tematiche/reclutamento/`, che è un indice
  // di download per classe di concorso (150 righe, link `/download/…/a005`),
  // non un elenco di avvisi: la sua lettura finiva in «150 scarti senza scadenza».
  ['pa-reclutamento-archivio', 'USR Sicilia — Archivio reclutamento e interpelli (Palermo)', 'https://www.usr.sicilia.it/category/aree-tematiche/reclutamento/', ['Sicilia'], 'PA', DATA_VERIFICA_SICILIA],

  // ── PUGLIA (2026-11-03, §26.137): l'albo pretorio dell'UST di Foggia ──
  // L'archivio di categoria `albo-pretorio` è l'unico elenco datato dell'UST: 19 voci
  // con «interpell» nel testo, e il termine di candidatura sta nel TITOLO della voce
  // («… fino al 15/11/2026», «dal 3-11-2026 al 30-06-2027»). Il resto dell'albo
  // (decreti, verbali, PN 21-27, bandi per esperti) lo scarta il gate: rumore
  // amministrativo oppure nessun segnale di insegnamento.
  ['fg-albo-pretorio', 'UST Foggia — Albo pretorio (Foggia)', 'https://www.ustfoggia.it/category/albo-pretorio/', ['Puglia'], 'FG', DATA_VERIFICA_PUGLIA_03],
];

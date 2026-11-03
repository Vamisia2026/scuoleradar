/**
 * ScuoleRadar.it — URL TERRITORIALI NON VERIFICABILI (Node-only, PURO, SOLO DATI).
 *
 * Terzo blocco del registro fonti (§26.89): le URL dei territori che alle
 * verifiche del 2026-10-23 e del 2026-10-25 NON hanno restituito una pagina di
 * reclutamento.
 * Restano registrate con `attiva: false` e il motivo esplicito perché la
 * copertura sia DICHIARATA e ricontrollabile (`npm run fonti:verifica`), mai
 * simulata: un capoluogo senza fonte attiva deve risultare scoperto, non finto.
 *
 * Tuple: [id, etichetta, url, regioni, capoluogo, motivo].
 * Gli hub del territorio che funzionano stanno in `fontiTerritoriali.ts`.
 */

const DNS =
  'Dominio non risolto (ENOTFOUND) alla verifica del 2026-10-23: la URL non esiste più. ' +
  'La copertura del territorio resta affidata agli hub verificati e all’aggregatore nazionale.';
const TLS =
  'Certificato TLS scaduto/non valido alla verifica del 2026-10-23: contenuto non leggibile. ' +
  'Da riverificare prima di qualunque attivazione.';
const P404 =
  'HTTP 404 alla verifica del 2026-10-23: la pagina non esiste (nessun e-portfolio su questo ' +
  'dominio per il territorio). Il MIM pubblica gli avvisi altrove: nessuna URL inventata.';
const P503 =
  'HTTP 503 (manutenzione) alla verifica del 2026-10-23: sito non servibile. Da riverificare.';
// §26.137 — il criterio «tabella senza link per voce = esclusa» del 2026-10-23 è
// SUPERATO: le tabelle dense si leggono per celle (`tabellaUst.ts`), quindi
// l'edizione corrente degli elenchi «per ambito» del Piemonte è una fonte attiva
// (`fontiTerritoriali.ts`). Resta qui l'edizione 2025/26, che serve uno SNAPSHOT.
const AMBITO_25 =
  'Snapshot degli elenchi «per ambito» dell’edizione 2025/26: STESSA tabella ' +
  'dell’elenco attivo (identico numero di righe) ma con gli stati FERMI — Novara ' +
  'dichiara 204 righe «aperto» contro le 17 dell’edizione corrente — e date in forma ' +
  'ISO. La fonte attiva è la tupla `interpello2026/` in `fontiTerritoriali.ts`: questa ' +
  'resta spenta per non interrogare due volte la stessa tabella e per non importare ' +
  'stati vecchi.';
const IFRAME =
  'Pagina-ponte con un <iframe> verso il portale dei servizi: nell’HTML non c’è nessuna voce ' +
  '(0 avvisi, 0 post). Gli elenchi leggibili sono le pagine per provincia dello stesso portale ' +
  '(`provincia.php`, in `fontiTerritoriali.ts`).';

const P404_02 =
  'HTTP 404 alla verifica del 2026-11-02: la pagina non esiste su questa sede USP. ' +
  'L’elenco vero è l’archivio di categoria `personale-docente/reclutamento-docenti` ' +
  '(in `fontiTerritoriali.ts`): nessuna URL inventata.';
const REDIRECT_02 =
  'HTTP 200 con REDIRECT a UN SINGOLO articolo di un’altra provincia alla verifica del ' +
  '2026-11-02: non è un elenco. L’archivio di categoria `personale-docente/reclutamento-docenti` ' +
  'della stessa sede è in `fontiTerritoriali.ts` ed è quello interrogato.';

// Motivi dell'AGGIORNAMENTO 2026-10-25 (stessa forma dei precedenti, data esplicita):
// le URL restano nel registro per rendere ricontrollabile la copertura mancante.
const P404_25 =
  'HTTP 404 alla verifica del 2026-10-25: nessun e-portfolio MIM per questo territorio (la URL ' +
  'non esiste). La copertura resta affidata agli hub verificati della regione e all’aggregatore nazionale.';
const TLS_25 =
  'Certificato TLS scaduto/non valido alla verifica del 2026-10-25: contenuto non leggibile in ' +
  'HTTPS. Da riverificare prima di qualunque attivazione.';
const NOELENCO_25 =
  'Nessun elenco leggibile alla verifica del 2026-10-25: la pagina rende solo menu e singoli avvisi ' +
  'sparsi, senza una lista di interpelli con link alla voce. Il territorio resta scoperto e dichiarato.';

// Motivi della verifica del 2026-11-03 (§26.137): Nuvola (madisoft), gli istituti di
// Asti senza avvisi e la pagina di ricerca dell'e-portfolio MIM di Como.
const NUVOLA_JS_03 =
  'HTTP 200 con 1,2 KB di HTML e NESSUN contenuto: la pagina è un guscio React ' +
  '(`<div id="interpelli-react-root" data-codice-cliente="…">`) che si riempie solo con ' +
  'JavaScript. Gli interpelli della scuola esistono, ma un fetch non li legge: dichiarare ' +
  'attiva questa fonte darebbe zero righe e una copertura finta. Servirebbe un renderer ' +
  '(mai introdotto) o un endpoint JSON pubblico, che non risulta documentato.';
const NUVOLA_BACHECA_03 =
  'HTTP 200 con una tabella vera (103 righe: «Oggetto | Data pubblicazione su bacheca | ' +
  'Registro») ma senza il TERMINE di candidatura: la data di colonna è quella di ' +
  'PUBBLICAZIONE, e il termine compare solo dentro l’oggetto («… DAL 03.11.2026 AL ' +
  '06.12.2026»). Il gate esige la scadenza dichiarata (§26.82): resa zero, quindi resta ' +
  'esclusa e ricontrollabile invece di entrare in bacheca con la data sbagliata.';
const NOVOCI_03 =
  'Pagina «Interpelli» della scuola senza NESSUN avviso alla verifica del 2026-11-03: solo ' +
  'link di condivisione social, menu e contatti. Ri-misurata lo stesso giorno: 154 link su ' +
  'S. Damiano e 144 su Villanova, nessuno verso un avviso (0 link a PDF, 0 date di scadenza). ' +
  'Non è un elenco: la scuola resta scoperta e dichiarata finché non pubblica gli avvisi in una ' +
  'pagina leggibile (le altre due scuole di Asti con avvisi veri sono in `fontiTerritoriali.ts`).';
const RICERCA_03 =
  'Pagina di RICERCA dell’e-portfolio MIM (`/web/como/ricerca?r=interpelli`): HTTP 200 e ' +
  'zero risultati nell’HTML — la lista la costruisce il client. Provata anche la variante con ' +
  '`&scope=this-site` (2026-11-03): 50 KB, 41 link tutti di navigazione, 0 voci d’avviso. Non ' +
  'è un elenco e non ha voci da leggere: per Como la copertura resta affidata agli hub verificati.';

/** Hub e portali territoriali esclusi dal fetch, con il motivo della verifica. */
export const HUB_ESCLUSI_VERIFICA: [string, string, string, string[], string, string][] = [
  // ── Toscana: gli e-portfolio MIM dei territori non esistono (404) ──
  ['mim-toscana-firenze', 'MIM Toscana — Firenze', 'https://www.mim.gov.it/web/firenze', ['Toscana'], 'FI', P404],
  ['mim-toscana-arezzo', 'MIM Toscana — Arezzo', 'https://www.mim.gov.it/web/arezzo', ['Toscana'], 'AR', P404],
  ['mim-toscana-grosseto', 'MIM Toscana — Grosseto', 'https://www.mim.gov.it/web/grosseto', ['Toscana'], 'GR', P404],
  ['mim-toscana-livorno', 'MIM Toscana — Livorno', 'https://www.mim.gov.it/web/livorno', ['Toscana'], 'LI', P404],
  ['mim-toscana-lucca', 'MIM Toscana — Lucca', 'https://www.mim.gov.it/web/lucca', ['Toscana'], 'LU', P404],
  ['mim-toscana-prato', 'MIM Toscana — Prato', 'https://www.mim.gov.it/web/prato', ['Toscana'], 'PO', P404],
  ['mim-toscana-siena', 'MIM Toscana — Siena', 'https://www.mim.gov.it/web/siena', ['Toscana'], 'SI', P404],
  ['mim-toscana-pisa', 'MIM Toscana — Pisa', 'https://www.mim.gov.it/web/pisa', ['Toscana'], 'PI', P404],
  ['mim-toscana-pistoia', 'MIM Toscana — Pistoia', 'https://www.mim.gov.it/web/pistoia', ['Toscana'], 'PT', P404],

  // ── Valle d’Aosta: portale in manutenzione (503) ──
  ['vda-scuole-home', 'USR Valle d’Aosta — Portale scuole (Aosta)', 'https://www.scuole.vda.it/', ["Valle d'Aosta"], 'AO', P503],
  ['vda-scuole-interpelli', 'USR Valle d’Aosta — Interpelli (Aosta)', 'https://scuole.vda.it/interpelli', ["Valle d'Aosta"], 'AO', P503],

  // ── Piemonte: edizione 2025/26 degli elenchi «per ambito» (snapshot, 2026-11-03) ──
  // §26.137 — il criterio del 2026-10-23 («tabella senza link per voce = esclusa») è
  // superato: la tabella si legge per CELLE. L'elenco ATTIVO è lo stesso modulo in
  // `interpello2026/` (`fontiTerritoriali.ts`); qui resta l'edizione 2025/26, con gli
  // stessi conteggi di righe ma gli stati fermi.
  ['pi-to-ambito-2025', 'USP Torino — Interpelli per ambito 2025/26 (Torino)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php', ['Piemonte'], 'TO', AMBITO_25],
  ['pi-al-ambito-2025', 'USP Alessandria — Interpelli per ambito 2025/26 (Alessandria)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_al.php', ['Piemonte'], 'AL', AMBITO_25],
  ['pi-at-ambito-2025', 'USP Asti — Interpelli per ambito 2025/26 (Asti)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_at.php', ['Piemonte'], 'AT', AMBITO_25],
  ['pi-bi-ambito-2025', 'USP Biella — Interpelli per ambito 2025/26 (Biella)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_bi.php', ['Piemonte'], 'BI', AMBITO_25],
  ['pi-cn-ambito-2025', 'USP Cuneo — Interpelli per ambito 2025/26 (Cuneo)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_cn.php', ['Piemonte'], 'CN', AMBITO_25],
  ['pi-no-ambito-2025', 'USP Novara — Interpelli per ambito 2025/26 (Novara)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_no.php', ['Piemonte'], 'NO', AMBITO_25],
  ['pi-vb-ambito-2025', 'USP Verbania — Interpelli per ambito 2025/26 (Verbania)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vb.php', ['Piemonte'], 'VB', AMBITO_25],
  ['pi-vc-ambito-2025', 'USP Vercelli — Interpelli per ambito 2025/26 (Vercelli)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vc.php', ['Piemonte'], 'VC', AMBITO_25],

  // ── Liguria: pagina-ponte del portale istituzionale (2026-10-23) ──
  ['istruzioneliguria-interpelli', 'USR Liguria — Interpelli e comunicati (Genova)', 'https://www.istruzioneliguria.gov.it/pagine/interpelli-e-comunicati', ['Liguria'], 'GE', IFRAME],

  // ── Domini che non risolvono più (ENOTFOUND) o con TLS scaduto ──
  ['uspnovara-home', 'USP Novara — Home (Novara)', 'http://www.uspnovara.it/', ['Piemonte'], 'NO', DNS],
  ['atp-alessandria', 'ATP Alessandria — Home (Alessandria)', 'https://www.atp.alessandria.it/', ['Piemonte'], 'AL', DNS],
  ['istruzioneasti-home', 'USP Asti — Home (Asti)', 'https://www.istruzioneasti.it/', ['Piemonte'], 'AT', DNS],
  ['istruzionetorino-home', 'USP Torino — Home (Torino)', 'https://www.istruzionetorino.it/', ['Piemonte'], 'TO', DNS],
  ['usr-liguria-vecchio', 'USR Liguria — Portale storico (Genova)', 'https://usr.liguria.istruzione.it/', ['Liguria'], 'GE', DNS],
  ['istruzione-liguria-genova', 'USP Genova — Portale storico (Genova)', 'https://istruzione.liguria.it/genova/', ['Liguria'], 'GE', DNS],
  ['usr-lombardia-vecchio', 'USR Lombardia — Portale storico (Milano)', 'https://usr.istruzione.lombardia.gov.it/', ['Lombardia'], 'MI', DNS],
  ['istruzionelombardia-home', 'USR Lombardia — Portale regionale (Milano)', 'https://www.istruzionelombardia.gov.it/', ['Lombardia'], 'MI', TLS],
  ['usr-abruzzo-home', 'USR Abruzzo — Home (L’Aquila)', 'https://www.usrabruzzo.it/', ['Abruzzo'], 'AQ', DNS],
  ['istruzione-abruzzo-laquila', 'USP L’Aquila — Portale regionale (L’Aquila)', 'https://www.istruzioneabruzzo.it/laquila/', ['Abruzzo'], 'AQ', DNS],
  ['istruzione-abruzzo-chieti', 'USP Chieti-Pescara — Portale regionale (Chieti)', 'https://www.istruzioneabruzzo.it/chieti-pescara/', ['Abruzzo'], 'CH', DNS],
  ['istruzione-abruzzo-teramo', 'USP Teramo — Portale regionale (Teramo)', 'https://www.istruzioneabruzzo.it/teramo/', ['Abruzzo'], 'TE', DNS],
  ['usr-basilicata-vecchio', 'USR Basilicata — Portale storico (Potenza)', 'https://usr.basilicata.istruzione.it/', ['Basilicata'], 'PZ', DNS],
  ['usr-calabria-home', 'USR Calabria — Home (Catanzaro)', 'https://www.usrcalabria.gov.it/', ['Calabria'], 'CZ', DNS],
  ['usr-calabria-catanzaro', 'USP Catanzaro — Sede (Catanzaro)', 'https://www.usrcalabria.gov.it/catanzaro/', ['Calabria'], 'CZ', DNS],
  ['usr-calabria-cosenza', 'USP Cosenza — Sede (Cosenza)', 'https://www.usrcalabria.gov.it/cosenza/', ['Calabria'], 'CS', DNS],
  ['usr-calabria-reggio', 'USP Reggio Calabria — Sede (Reggio Calabria)', 'https://www.usrcalabria.gov.it/reggiocalabria/', ['Calabria'], 'RC', DNS],
  ['usr-campania-vecchio', 'USR Campania — Portale storico (Napoli)', 'https://www.usr.campania.gov.it/', ['Campania'], 'NA', DNS],
  ['usp-napoli-vecchio', 'USP Napoli — Portale storico (Napoli)', 'https://www.istruzione.campania.gov.it/napoli/', ['Campania'], 'NA', DNS],
  ['usp-avellino-vecchio', 'USP Avellino — Portale storico (Avellino)', 'https://www.istruzione.campania.gov.it/avellino/', ['Campania'], 'AV', DNS],
  ['usp-benevento-vecchio', 'USP Benevento — Portale storico (Benevento)', 'https://www.istruzione.campania.gov.it/benevento/', ['Campania'], 'BN', DNS],
  ['usp-caserta-vecchio', 'USP Caserta — Portale storico (Caserta)', 'https://www.istruzione.campania.gov.it/caserta/', ['Campania'], 'CE', DNS],
  ['usp-salerno-vecchio', 'USP Salerno — Portale storico (Salerno)', 'https://www.istruzione.campania.gov.it/salerno/', ['Campania'], 'SA', DNS],
  ['usr-fvg-home', 'USR Friuli-Venezia Giulia — Home (Trieste)', 'https://www.fvg.istruzione.it/', ['Friuli-Venezia Giulia'], 'TS', DNS],
  ['usrlazio-vecchio', 'USR Lazio — Portale storico (Roma)', 'https://www.usrlazio.it/', ['Lazio'], 'RM', TLS],
  ['usp-frosinone-vecchio', 'USP Frosinone — Portale storico (Frosinone)', 'https://www.istruzione.lazio.it/frosinone/', ['Lazio'], 'FR', DNS],
  ['usp-latina-vecchio', 'USP Latina — Portale storico (Latina)', 'https://www.istruzione.lazio.it/latina/', ['Lazio'], 'LT', DNS],
  ['usp-rieti-vecchio', 'USP Rieti — Portale storico (Rieti)', 'https://www.istruzione.lazio.it/rieti/', ['Lazio'], 'RI', DNS],
  ['usp-viterbo-vecchio', 'USP Viterbo — Portale storico (Viterbo)', 'https://www.istruzione.lazio.it/viterbo/', ['Lazio'], 'VT', DNS],

  // ── AGGIORNAMENTO 2026-10-25: e-portfolio MIM inesistenti (404) e TLS scaduto ──
  // Lazio: le province non hanno un e-portfolio MIM (Rieti resta coperta da usp-rieti.it)
  ['mim-lazio-frosinone', 'MIM Lazio — Frosinone (404)', 'https://www.mim.gov.it/web/frosinone', ['Lazio'], 'FR', P404_25],
  ['mim-lazio-latina', 'MIM Lazio — Latina (404)', 'https://www.mim.gov.it/web/latina', ['Lazio'], 'LT', P404_25],
  ['mim-lazio-rieti', 'MIM Lazio — Rieti (404)', 'https://www.mim.gov.it/web/rieti', ['Lazio'], 'RI', P404_25],
  ['mim-lazio-viterbo', 'MIM Lazio — Viterbo (404)', 'https://www.mim.gov.it/web/viterbo', ['Lazio'], 'VT', P404_25],

  // Campania: Salerno e Benevento — nessun e-portfolio MIM e TLS scaduto sugli UAT
  ['mim-campania-salerno', 'MIM Campania — Salerno (404)', 'https://www.mim.gov.it/web/salerno', ['Campania'], 'SA', P404_25],
  ['mim-campania-benevento', 'MIM Campania — Benevento (404)', 'https://www.mim.gov.it/web/benevento', ['Campania'], 'BN', P404_25],
  ['uat-salerno-home', 'USP Salerno — Home (Salerno)', 'https://www.uat-salerno.it/', ['Campania'], 'SA', TLS_25],
  ['uat-benevento-home', 'USP Benevento — Home (Benevento)', 'https://www.uat-benevento.it/', ['Campania'], 'BN', TLS_25],

  // Puglia: le province non hanno e-portfolio MIM; Bari resta coperta da pugliausr.gov.it
  ['mim-puglia-lecce', 'MIM Puglia — Lecce (404)', 'https://www.mim.gov.it/web/lecce', ['Puglia'], 'LE', P404_25],
  ['mim-puglia-foggia', 'MIM Puglia — Foggia (404)', 'https://www.mim.gov.it/web/foggia', ['Puglia'], 'FG', P404_25],
  ['mim-puglia-taranto', 'MIM Puglia — Taranto (404)', 'https://www.mim.gov.it/web/taranto', ['Puglia'], 'TA', P404_25],
  ['mim-puglia-brindisi', 'MIM Puglia — Brindisi (404)', 'https://www.mim.gov.it/web/brindisi', ['Puglia'], 'BR', P404_25],
  ['mim-puglia-barletta', 'MIM Puglia — Barletta-Andria-Trani (404)', 'https://www.mim.gov.it/web/barletta-andria-trani', ['Puglia'], 'BT', P404_25],

  // Calabria: solo l'hub regionale (Catanzaro) espone un elenco; le altre sedi no
  ['mim-calabria-cosenza', 'MIM Calabria — Cosenza (404)', 'https://www.mim.gov.it/web/cosenza', ['Calabria'], 'CS', P404_25],
  ['mim-calabria-reggio', 'MIM Calabria — Reggio Calabria (404)', 'https://www.mim.gov.it/web/reggio-calabria', ['Calabria'], 'RC', P404_25],
  ['mim-calabria-crotone', 'MIM Calabria — Crotone (404)', 'https://www.mim.gov.it/web/crotone', ['Calabria'], 'KR', P404_25],
  ['mim-calabria-vibo', 'MIM Calabria — Vibo Valentia (404)', 'https://www.mim.gov.it/web/vibo-valentia', ['Calabria'], 'VV', P404_25],

  // Marche: l'elenco regionale (Ancona) è attivo, le sedi provinciali non hanno e-portfolio
  ['mim-marche-pesaro', 'MIM Marche — Pesaro e Urbino (404)', 'https://www.mim.gov.it/web/pesaro', ['Marche'], 'PU', P404_25],
  ['mim-marche-macerata', 'MIM Marche — Macerata (404)', 'https://www.mim.gov.it/web/macerata', ['Marche'], 'MC', P404_25],
  ['mim-marche-ascoli', 'MIM Marche — Ascoli Piceno (404)', 'https://www.mim.gov.it/web/ascoli-piceno', ['Marche'], 'AP', P404_25],
  ['mim-marche-fermo', 'MIM Marche — Fermo (404)', 'https://www.mim.gov.it/web/fermo', ['Marche'], 'FM', P404_25],

  // Sicilia: l'elenco regionale (Palermo) è attivo, le nove sedi provinciali non hanno e-portfolio
  ['mim-sicilia-catania', 'MIM Sicilia — Catania (404)', 'https://www.mim.gov.it/web/catania', ['Sicilia'], 'CT', P404_25],
  ['mim-sicilia-messina', 'MIM Sicilia — Messina (404)', 'https://www.mim.gov.it/web/messina', ['Sicilia'], 'ME', P404_25],
  ['mim-sicilia-siracusa', 'MIM Sicilia — Siracusa (404)', 'https://www.mim.gov.it/web/siracusa', ['Sicilia'], 'SR', P404_25],
  ['mim-sicilia-ragusa', 'MIM Sicilia — Ragusa (404)', 'https://www.mim.gov.it/web/ragusa', ['Sicilia'], 'RG', P404_25],
  ['mim-sicilia-trapani', 'MIM Sicilia — Trapani (404)', 'https://www.mim.gov.it/web/trapani', ['Sicilia'], 'TP', P404_25],
  ['mim-sicilia-caltanissetta', 'MIM Sicilia — Caltanissetta (404)', 'https://www.mim.gov.it/web/caltanissetta', ['Sicilia'], 'CL', P404_25],
  ['mim-sicilia-agrigento', 'MIM Sicilia — Agrigento (404)', 'https://www.mim.gov.it/web/agrigento', ['Sicilia'], 'AG', P404_25],
  ['mim-sicilia-enna', 'MIM Sicilia — Enna (404)', 'https://www.mim.gov.it/web/enna', ['Sicilia'], 'EN', P404_25],
  // Le pagine «interpelli» delle sedi USP siciliane: NON sono elenchi (§26.134)
  ['rg-interpelli', 'USP Ragusa — Interpelli (404)', 'https://rg.usr.sicilia.it/interpelli/', ['Sicilia'], 'RG', P404_02],
  ['sr-interpelli', 'USP Siracusa — Interpelli (redirect a un articolo)', 'https://sr.usr.sicilia.it/interpelli/', ['Sicilia'], 'SR', REDIRECT_02],

  // Toscana: anche Massa-Carrara è senza e-portfolio (le altre nove erano già qui)
  ['mim-toscana-massa', 'MIM Toscana — Massa-Carrara (404)', 'https://www.mim.gov.it/web/massa-carrara', ['Toscana'], 'MS', P404_25],

  // Friuli-Venezia Giulia / Trentino-Alto Adige / Valle d’Aosta: nessun e-portfolio MIM
  ['mim-fvg-trieste', 'MIM FVG — Trieste (404)', 'https://www.mim.gov.it/web/trieste', ['Friuli-Venezia Giulia'], 'TS', P404_25],
  ['mim-fvg-udine', 'MIM FVG — Udine (404)', 'https://www.mim.gov.it/web/udine', ['Friuli-Venezia Giulia'], 'UD', P404_25],
  ['mim-fvg-pordenone', 'MIM FVG — Pordenone (404)', 'https://www.mim.gov.it/web/pordenone', ['Friuli-Venezia Giulia'], 'PN', P404_25],
  ['mim-fvg-gorizia', 'MIM FVG — Gorizia (404)', 'https://www.mim.gov.it/web/gorizia', ['Friuli-Venezia Giulia'], 'GO', P404_25],
  ['mim-fvg-regione', 'MIM FVG — Pagina regionale (404)', 'https://www.mim.gov.it/web/friuli-venezia-giulia', ['Friuli-Venezia Giulia'], 'TS', P404_25],
  ['mim-taa-trento', 'MIM Trentino-Alto Adige — Trento (404)', 'https://www.mim.gov.it/web/trento', ['Trentino-Alto Adige'], 'TN', P404_25],
  ['mim-taa-bolzano', 'MIM Trentino-Alto Adige — Bolzano (404)', 'https://www.mim.gov.it/web/bolzano', ['Trentino-Alto Adige'], 'BZ', P404_25],
  ['mim-vda-aosta', 'MIM Valle d’Aosta — Aosta (404)', 'https://www.mim.gov.it/web/aosta', ["Valle d'Aosta"], 'AO', P404_25],
  ['mim-vda-territorio', 'MIM Valle d’Aosta — Pagina regionale (404)', 'https://www.mim.gov.it/web/valle-d-aosta', ["Valle d'Aosta"], 'AO', P404_25],
  ['vda-regione-interpelli', 'Regione Valle d’Aosta — Interpelli (Aosta)', 'https://www.regione.vda.it/istruzione/interpelli/', ["Valle d'Aosta"], 'AO', P404_25],

  // Veneto: Belluno non espone una pagina-elenco (solo avvisi sparsi nel portale)
  ['bl-categoria-interpelli', 'USP Belluno — Categoria interpelli (Belluno)', 'https://belluno.istruzioneveneto.gov.it/category/interpelli/', ['Veneto'], 'BL', NOELENCO_25],

  // ── AGGIORNAMENTO 2026-11-03 (§26.137): NUVOLA, ISTITUTI DI ASTI, RICERCA MIM ──
  // Otto URL aperte una per una. Nuvola risponde 200 ma è JS (1,2 KB di guscio React);
  // la bacheca digitale rende una tabella vera con la data di PUBBLICAZIONE; i due
  // comprensivi di Asti non hanno nessun avviso; la «ricerca» di Como non ha risultati
  // nell'HTML. Nessuna produce righe candidabili: registrate spente, con il motivo.
  ['nv-atic81800r-ata', 'Nuvola — Interpelli ATA (ATIC81800R)', 'https://nuvola.madisoft.it/interpelli/ATIC81800R/ata', ['Piemonte'], 'AT', NUVOLA_JS_03],
  ['nv-atic81800r-docenti', 'Nuvola — Interpelli docenti (ATIC81800R)', 'https://nuvola.madisoft.it/interpelli/ATIC81800R/docenti', ['Piemonte'], 'AT', NUVOLA_JS_03],
  ['nv-atee00500r-ata', 'Nuvola — Interpelli ATA (ATEE00500R)', 'https://nuvola.madisoft.it/interpelli/ATEE00500R/ata', ['Piemonte'], 'AT', NUVOLA_JS_03],
  ['nv-atic81200t-bacheca', 'Nuvola — Bacheca digitale (ATIC81200T)', 'https://nuvola.madisoft.it/bacheca-digitale/bacheca/ATIC81200T/7/IN_PUBBLICAZIONE/0/show?isBachecaPubblica=1', ['Piemonte'], 'AT', NUVOLA_BACHECA_03],
  ['asti-sandamiano-interpelli', 'IC S. Damiano d’Asti — Interpelli (Asti)', 'https://icsandamiano.edu.it/servizio/interpelli/', ['Piemonte'], 'AT', NOVOCI_03],
  ['asti-villanova-interpelli', 'IC Villanova d’Asti — Interpelli (Asti)', 'https://icvillanovasti.edu.it/interpelli-i-c-villanova-dasti/', ['Piemonte'], 'AT', NOVOCI_03],
  ['como-ricerca-interpelli', 'MIM Como — Ricerca interpelli (Como)', 'https://www.mim.gov.it/web/como/ricerca?r=interpelli', ['Lombardia'], 'CO', RICERCA_03],
  // ── AGGIORNAMENTO 2026-11-03 (§26.138): altre TRE URL aperte una per una ──
  // Seconda passata dello stesso giorno sulle segnalazioni rimaste: la seconda
  // scuola di Asti su Nuvola (`ATIC82000R`, IC 5) e la variante con
  // `&scope=this-site` della ricerca di Como. Esito identico: gusci React e
  // pagine di navigazione, zero voci. Registrate, spente, ricontrollabili.
  ['nv-atic82000r-ata', 'Nuvola — Interpelli ATA (ATIC82000R)', 'https://nuvola.madisoft.it/interpelli/ATIC82000R/ata', ['Piemonte'], 'AT', NUVOLA_JS_03],
  ['nv-atic82000r-docenti', 'Nuvola — Interpelli docenti (ATIC82000R)', 'https://nuvola.madisoft.it/interpelli/ATIC82000R/docenti', ['Piemonte'], 'AT', NUVOLA_JS_03],
  ['como-ricerca-interpelli-scope', 'MIM Como — Ricerca interpelli con scope sul sito (Como)', 'https://www.mim.gov.it/web/como/ricerca?r=interpelli&scope=this-site', ['Lombardia'], 'CO', RICERCA_03],
];

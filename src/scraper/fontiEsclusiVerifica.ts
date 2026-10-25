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
const PTABELLA =
  'HTTP 200 con tabelle piene ma NESSUN link per voce (modulo di ricerca «per ambito»): ' +
  'la riga descrive l’interpello, non rimanda al documento ufficiale. Senza URL specifico ' +
  'l’avviso non è verificabile, quindi la fonte resta esclusa.';
const IFRAME =
  'Pagina-ponte con un <iframe> verso il portale dei servizi: nell’HTML non c’è nessuna voce ' +
  '(0 avvisi, 0 post). Gli elenchi leggibili sono le pagine per provincia dello stesso portale ' +
  '(`provincia.php`, in `fontiTerritoriali.ts`).';

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

  // ── Piemonte: elenchi «per ambito» senza link per voce (2026-10-23) ──
  ['pi-to-ambito', 'USP Torino — Ricerca interpelli per ambito (Torino)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_to.php', ['Piemonte'], 'TO', PTABELLA],
  ['pi-al-ambito', 'USP Alessandria — Ricerca interpelli per ambito (Alessandria)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_al.php', ['Piemonte'], 'AL', PTABELLA],
  ['pi-at-ambito', 'USP Asti — Ricerca interpelli per ambito (Asti)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_at.php', ['Piemonte'], 'AT', PTABELLA],
  ['pi-bi-ambito', 'USP Biella — Ricerca interpelli per ambito (Biella)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_bi.php', ['Piemonte'], 'BI', PTABELLA],
  ['pi-cn-ambito', 'USP Cuneo — Ricerca interpelli per ambito (Cuneo)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_cn.php', ['Piemonte'], 'CN', PTABELLA],
  ['pi-no-ambito', 'USP Novara — Ricerca interpelli per ambito (Novara)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_no.php', ['Piemonte'], 'NO', PTABELLA],
  ['pi-vb-ambito', 'USP Verbania — Ricerca interpelli per ambito (Verbania)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vb.php', ['Piemonte'], 'VB', PTABELLA],
  ['pi-vc-ambito', 'USP Vercelli — Ricerca interpelli per ambito (Vercelli)', 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_vc.php', ['Piemonte'], 'VC', PTABELLA],

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
];

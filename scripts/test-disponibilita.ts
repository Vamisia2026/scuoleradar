/**
 * TEST — LA DISPONIBILITÀ SENZA TERMINE (§26.133).
 *
 * Il 2 novembre 2026 il «Radar Live» non aveva una sola riga della Sicilia. La
 * causa non era il registro delle fonti: l'avviso P.6 dell'USP di Catania del
 * 20/10/2026 — «posti comuni e di SOSTEGNO … a.s. 2026/27» — è una TABELLA DI
 * DISPONIBILITÀ: 128 istituti con le cattedre libere e NESSUN termine. Letta con
 * la grammatica dell'interpello non produceva nemmeno una riga
 * (`righeTabellaInterpelli` → 0), e senza data non entrava in nessuna superficie.
 *
 * Questa guardia fissa le tre cose che rendono la riga pubblicabile senza
 * inventare niente:
 *   1. la tabella si legge per CODICE (anche quando il codice è a metà riga);
 *   2. la stima del termine parte dalla PUBBLICAZIONE dell'avviso, e se la
 *      pubblicazione non c'è non si stima nulla (nessun «oggi», nessun rinnovo);
 *   3. la stima vale solo per una DISPONIBILITÀ aperta, mai per un atto chiuso.
 *
 * Uso: npm run test:disponibilita  (incluso in `npm test`)
 */
import { righeDisponibilita, righeTabellaInterpelli } from '../src/scraper/tabellaInterpelliPdf.ts';
import {
  GIORNI_SCADENZA_STIMATA,
  eDisponibilitaSenzaTermine,
  scadenzaStimata,
} from '../src/lib/motivoSenzaScadenza.ts';
import { dataPubblicazioneArticolo } from '../src/scraper/articoloPost.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* -------- 1) LA TABELLA VERA (estratto del PDF dell'USP di Catania) -------- */
console.log('\n— 1. La tabella di disponibilità si legge per codice —');
const AVVISO_CT = [
  'CTAA8AK00B I.C. MASCALI AA',
  'ADAA - SOSTEGNO SCUOLA',
  'INFANZIA - SOSTEGNO 00000012.50',
  'CTAA806004',
  'IC CARLO LEVI -',
  'MANIACE AA',
  'ADAA - SOSTEGNO SCUOLA',
  'INFANZIA - SOSTEGNO 02000000',
  'CTEE89101P',
  'CAPPUCCINI-DE',
  'CRUYLLAS- RAMACCA EE',
  'ADEE - SOSTEGNO SCUOLA',
  'PRIMARIA - SOSTEGNO 01000000',
].join('\n');
const righe = righeDisponibilita(AVVISO_CT);
// Il documento è una disponibilità, non una tabella d'interpello: la vecchia
// grammatica non ne ricavava NIENTE (è la ragione per cui la Sicilia era vuota).
check('la grammatica dell’interpello non ne ricava righe', 0, righeTabellaInterpelli(AVVISO_CT).length);
check('la grammatica della disponibilità ne ricava tre', 3, righe.length);
check('codice e classe della prima riga', 'CTAA8AK00B ADAA', `${righe[0]?.schoolCode} ${righe[0]?.classCode}`);
check('la materia non ripete l’intestazione di colonna', 'SOSTEGNO SCUOLA INFANZIA', righe[0]?.subject);
check('il nome spezzato su due righe si ricompone', 'IC CARLO LEVI - MANIACE', righe[1]?.schoolName);
check('il codice da solo apre comunque la riga', 'CTAA806004', righe[1]?.schoolCode);
check(
  'la primaria porta la sua tipologia di posto',
  'ADEE SOSTEGNO SCUOLA PRIMARIA',
  `${righe[2]?.classCode} ${righe[2]?.subject}`,
);
check('la denominazione perde il tipo di scuola in coda', 'CAPPUCCINI-DE CRUYLLAS- RAMACCA', righe[2]?.schoolName);

console.log('\n— 2. Il codice accodato alla riga dei valori non sporca la materia —');
const CON_CODICE_IN_CODA = [
  'CTAA89000L IC GABELLI MISTERBIANCO AA',
  'ADAA - SOSTEGNO SCUOLA',
  'INFANZIA - SOSTEGNO 02000000 CTAA892008',
  'IC XX SETTEMBRE',
  'CATANIA AA',
  'ADAA - SOSTEGNO SCUOLA',
  'INFANZIA - SOSTEGNO 01000000',
].join('\n');
const righeCoda = righeDisponibilita(CON_CODICE_IN_CODA);
check('due istituti distinti', ['CTAA89000L', 'CTAA892008'], righeCoda.map((r) => r.schoolCode));
check('la materia della prima riga resta pulita', 'SOSTEGNO SCUOLA INFANZIA', righeCoda[0]?.subject);

console.log('\n— 3. Una parola di dieci lettere non è un codice —');
const SENZA_CODICI = ['CAPPUCCINI-DE', 'CRUYLLAS- RAMACCA EE', 'ADEE - SOSTEGNO SCUOLA'].join('\n');
check('nessuna scuola inventata', 0, righeDisponibilita(SENZA_CODICI).length);
check('testo vuoto: nessuna riga', 0, righeDisponibilita('').length);
check('un interpello senza tabella: nessuna riga', 0, righeDisponibilita('Interpello A022 — IC Manzoni').length);

/* ------------------- 4) IL TERMINE STIMATO (e i suoi limiti) --------------- */
console.log('\n— 4. Il termine stimato parte dalla pubblicazione, non da oggi —');
check('trenta giorni di validità presunta', 30, GIORNI_SCADENZA_STIMATA);
check('pubblicato il 20/10/2026 → stimato 19/11/2026', '2026-11-19', scadenzaStimata('2026-10-20'));
check('la forma ISO con orario è accettata', '2026-11-19', scadenzaStimata('2026-10-20T08:15:00Z'));
check('senza pubblicazione non si stima nulla', null, scadenzaStimata(null));
check('una data inesistente non è una data', null, scadenzaStimata('2026-02-30'));
check('i giorni si possono dichiarare', '2026-10-27', scadenzaStimata('2026-10-20', 7));

/* ------------- 5) QUANDO LA STIMA VALE (e quando non deve valere) ---------- */
console.log('\n— 5. La stima vale per una disponibilità aperta, non per un atto chiuso —');
check(
  '«Avviso disponibilità per contratti a T.D. … posti comuni e di sostegno» → sì',
  true,
  eDisponibilitaSenzaTermine({
    titolo: 'Avviso disponibilità per contratti a T.D. - A.S. 2026/27 - posti comuni e di sostegno',
  }),
);
check(
  'disponibilità ESAURITA → nessuna stima',
  false,
  eDisponibilitaSenzaTermine({ titolo: 'Disponibilità esaurita: graduatoria ADAA posti di sostegno' }),
);
check(
  'un atto senza disponibilità → nessuna stima',
  false,
  eDisponibilitaSenzaTermine({ titolo: 'Interpello per supplenza su classe di concorso A022' }),
);
check(
  'un atto amministrativo non diventa una disponibilità',
  false,
  eDisponibilitaSenzaTermine({
    titolo: 'Disponibilità: determina per la fornitura di arredi scolastici',
  }),
);

/* -------- 6) LA DATA DI PUBBLICAZIONE (Dublin Core dei siti USP) ----------- */
console.log('\n— 6. La pagina dichiara la sua pubblicazione (Dublin Core) —');
const HTML_DC = '<html><head><meta name="DC.date" content="2026-10-20" /></head><body>Avviso</body></html>';
const HTML_DC_MAIUSCOLO =
  '<html><head><meta name="DC.Date" content="20/10/2026" /></head><body>Avviso</body></html>';
const HTML_SENZA_DATA = '<html><head><title>Avviso</title></head><body>Disponibilità</body></html>';
check('DC.date → data ISO', '2026-10-20', dataPubblicazioneArticolo(HTML_DC));
check('DC.Date in forma italiana → data ISO', '2026-10-20', dataPubblicazioneArticolo(HTML_DC_MAIUSCOLO));
check('senza data dichiarata → null (nessuna stima)', null, dataPubblicazioneArticolo(HTML_SENZA_DATA));
check(
  'la data pubblicata produce il termine della tabella di Catania',
  '2026-11-19',
  scadenzaStimata(dataPubblicazioneArticolo(HTML_DC)),
);

console.log(`\n${errori === 0 ? '✅' : '❌'} DISPONIBILITÀ A TERMINE STIMATO: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;

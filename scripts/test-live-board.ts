/**
 * Verifica il filtro di VETRINA del "Radar Live" (Flight Board):
 * le righe incomplete NON devono arrivare in pagina — niente "Scuola non
 * indicata" né "Scadenza n/d". Le righe vengono prima ARRICCHITE (nome scuola
 * dal campo, dal registro per codice meccanografico, dal titolo) e solo se resta
 * un buco vengono scartate. In più (direttiva cliente 28/09/2026): nella colonna
 * «Scuola & Città» non finisce MAI un codice amministrativo o una stringa grezza
 * («EEEE | A246», «AAAA | A246», «BA02 | AR04») né un'etichetta di posto/materia:
 * se il nome non è risolvibile in chiaro la riga non entra in vetrina.
 *
 * La finestra dei 60 giorni per gli avvisi che la fonte non data e l'alternanza
 * per provincia (scala NAZIONALE del tabellone) sono verificati a parte da
 * `npm run test:board:scala` (`scripts/test-live-board-scala.ts`).
 *
 * Uso: npm run test:board
 */
import { preparaRigheBoard, scuolaDaTitolo } from '../src/lib/liveBoard.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const FUTURO = '2099-12-31';

const righe = [
  // 1) Riga completa: resta.
  {
    id: 'ok',
    title: 'Interpello supplenza A-022 — Matematica',
    school_name: 'Liceo Augusto Monti',
    province: 'AT',
    expiration_date: FUTURO,
  },
  // 2) Senza nome scuola ma con codice del registro: arricchita.
  {
    id: 'da-codice',
    title: 'Interpello A-022 per supplenza',
    school_name: null,
    school_code: 'BSIS02900X',
    province: 'BS',
    expiration_date: FUTURO,
  },
  // 3) Senza nome scuola né codice, ma titolo con l'istituto: arricchita.
  {
    id: 'da-titolo',
    title: 'Interpello supplenza — Liceo Scientifico Galilei',
    school_name: null,
    province: 'RM',
    expiration_date: FUTURO,
  },
  // 4) Nessuna scuola ricavabile: SCARTATA (mai "Scuola non indicata").
  {
    id: 'senza-scuola',
    title: 'Interpello supplenza posto comune',
    school_name: null,
    province: 'RM',
    expiration_date: FUTURO,
  },
  // 5) Scadenza assente: SCARTATA (mai "Scadenza n/d").
  {
    id: 'senza-scadenza',
    title: 'Interpello supplenza — Liceo Galilei',
    school_name: 'Liceo Galilei',
    province: 'RM',
    expiration_date: null,
  },
  // 6) Scadenza già passata: SCARTATA.
  {
    id: 'scaduto',
    title: 'Interpello supplenza — Liceo Galilei',
    school_name: 'Liceo Galilei',
    province: 'RM',
    expiration_date: '2020-01-31',
  },
  // 7) `school_name` = elenco di codici classe (dato reale dello scraper, non un
  //    nome di scuola): il nome viene risolto dal titolo.
  {
    id: 'codici-classe',
    title: 'Interpello per supplenza — Liceo Scientifico Galilei',
    school_name: 'ADEE | EEEE',
    province: 'MB',
    expiration_date: FUTURO,
  },
  // 8) Solo codici classe e nessuna alternativa: SCARTATA (mai un codice in vetrina).
  {
    id: 'solo-codici',
    title: 'EEEE | AAAA | AL56 | A041 | A042 | ADEE',
    school_name: 'BA02 | AR04',
    province: 'MB',
    expiration_date: FUTURO,
  },
  // 9) `school_name` = etichetta di POSTO/MATERIA (dato reale dello scraper) e
  //    titolo fatto di soli codici: nulla di leggibile → SCARTATA.
  {
    id: 'etichetta-posto',
    title: 'ADEE | EEEE | A042',
    school_name: 'Conversazione in lingua straniera',
    province: 'PD',
    expiration_date: FUTURO,
  },
  // 10) Codici amministrativi citati dal cliente: mai in vetrina.
  {
    id: 'client-codici',
    title: 'La provincia di TO non ha nuovi avvisi con scuola indicata',
    school_name: 'AAAA | A246',
    province: 'TO',
    expiration_date: FUTURO,
  },
  // 11) Etichetta di posto + nessun istituto nel titolo: SCARTATA.
  {
    id: 'posto-montessori',
    title: 'Albo pretorio — elenco avvisi',
    school_name: 'Scuola primaria posto Montessori',
    province: 'VE',
    expiration_date: FUTURO,
  },
  // 12) Nome REALE con la coda di procedura: resta, ma la coda viene tagliata.
  {
    id: 'nome-con-coda',
    title: 'I.C. Ferruccio Ulivi – supplenza primaria lingua inglese',
    school_name: 'I.C. Ferruccio Ulivi – interpello preventivo primaria sostegno',
    province: 'RM',
    expiration_date: FUTURO,
  },
];

const pronte = preparaRigheBoard(righe);
check(
  'restano solo le righe presentabili',
  ['ok', 'da-codice', 'da-titolo', 'codici-classe', 'nome-con-coda'],
  pronte.map((p) => p.riga.id),
);
check(
  'nome reale ripulito dalla coda di procedura',
  'I.C. Ferruccio Ulivi',
  pronte.find((p) => p.riga.id === 'nome-con-coda')?.scuola ?? null,
);
check(
  'nomi non risolvibili: NESSUNA etichetta di posto o codice in bacheca',
  [],
  pronte
    .filter((p) => ['etichetta-posto', 'client-codici', 'posto-montessori'].includes(p.riga.id))
    .map((p) => p.riga.id),
);
check(
  'nessun codice amministrativo in vetrina',
  [],
  pronte.filter((p) => /\||\d[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ]\d/.test(p.scuola)).map((p) => p.riga.id),
);
check(
  'scuola risolta dal registro per codice',
  "I.I.S. 'L. Gigli'",
  pronte.find((p) => p.riga.id === 'da-codice')?.scuola ?? null,
);
check(
  'scuola risolta dal titolo',
  'Liceo Scientifico Galilei',
  pronte.find((p) => p.riga.id === 'da-titolo')?.scuola ?? null,
);
check(
  'nessuna riga mostra placeholder di scuola',
  [],
  pronte.filter((p) => /non indicata|non disponibile|n\/d/i.test(p.scuola)).map((p) => p.riga.id),
);
check(
  'ogni riga con scadenza dichiarata ha una data valida',
  [],
  pronte
    .filter((p) => p.scadenza !== null && !/^\d{4}-\d{2}-\d{2}/.test(p.scadenza))
    .map((p) => p.riga.id),
);
check(
  'nessuna riga entra senza scadenza se non per la finestra dei 60 giorni',
  [],
  pronte.filter((p) => p.scadenza === null && !p.senzaScadenza).map((p) => p.riga.id),
);
check('scuola dal titolo: frammento generico ignorato', null, scuolaDaTitolo('Avviso supplenza — Scuola'));
check(
  'scuola dal titolo: nome PRIMA del separatore quando dopo c’è la procedura',
  'IX IC Ricci Curbastro',
  scuolaDaTitolo('IX IC Ricci Curbastro – nterpello per la copertura di posti Art. 13 C.'),
);
check(
  'scuola dal titolo: frammento di procedura non è un nome di scuola',
  null,
  scuolaDaTitolo('annotazione_INTERPELLO – Classe di concorso A042 – 9H – Dal 01.10.2026'),
);
check(
  'scuola dal titolo: il nome dopo il separatore resta la prima scelta',
  'Liceo Scientifico Galilei',
  scuolaDaTitolo('Interpello supplenza — Liceo Scientifico Galilei'),
);
check(
  'scuola dal titolo: solo codici classe → nessun nome inventato',
  null,
  scuolaDaTitolo('ADEE | EEEE'),
);
check(
  'elenchi di codici classe («ADEE | EEEE») non sono nomi di scuola: riga scartata',
  true,
  !pronte.some((p) => p.riga.id === 'solo-codici'),
);
check(
  'nessun codice classe esposto come nome scuola',
  [],
  pronte.filter((p) => /\|/.test(p.scuola)).map((p) => p.riga.id),
);
check('liste vuote non rompono il filtro', 0, preparaRigheBoard([]).length);

console.log(errori === 0 ? '\n✅ RADAR LIVE: nessun problema' : `\n❌ RADAR LIVE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;


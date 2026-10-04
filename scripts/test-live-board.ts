/**
 * Verifica la VETRINA del "Radar Live" (Flight Board).
 *
 * DIREZIONE (direttiva cliente 04/10/2026, §26.47 — corregge la §26.20 del
 * 28/09/2026): un avviso GENUINO non si scarta MAI per un'anagrafica incompleta
 * (caso storico: i 10 annunci di Padova). Le righe incomplete restano in pagina —
 * niente "Scuola non indicata" e niente "Scadenza n/d" — perché il nome viene
 * risolto (campo → registro per codice → titolo) e, se resta un buco, si usa il
 * nome GREZZO pubblicato dal bando oppure il segnaposto GESTITO «Scuola non
 * specificata / Più plessi», marcando la riga (`anagraficaParziale`). Nella colonna «Scuola»
 * non finisce MAI un codice amministrativo («EEEE | A246», «AAAA | A246»).
 * Restano fuori solo le righe che non sono avvisi vivi: scadute, o senza data di
 * pubblicazione utile per la finestra dei 60 giorni.
 *
 * La finestra dei 60 giorni e l'alternanza per provincia (scala NAZIONALE del
 * tabellone) sono verificati a parte da `npm run test:board:scala`
 * (`scripts/test-live-board-scala.ts`).
 *
 * Uso: npm run test:board
 */
import {
  SCUOLA_NON_SPECIFICATA,
  preparaRigheBoard,
  scuolaDaTitolo,
} from '../src/lib/liveBoard.ts';

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
  // 4) Nessuna scuola ricavabile: la riga RESTA con la dicitura gestita
  //    (direttiva 04/10/2026, §26.47: mai uno scarto per anagrafica).
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
  // 8) Solo codici classe e nessuna alternativa: RESTA (mai un codice in vetrina:
  //    la colonna mostra la dicitura gestita).
  {
    id: 'solo-codici',
    title: 'EEEE | AAAA | AL56 | A041 | A042 | ADEE',
    school_name: 'BA02 | AR04',
    province: 'MB',
    expiration_date: FUTURO,
  },
  // 9) `school_name` = etichetta di POSTO/MATERIA (dato reale dello scraper) e
  //    titolo fatto di soli codici: nessun istituto, ma il bando dichiara un nome
  //    leggibile → RESTA con il nome grezzo.
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
  // 11) Etichetta di posto + nessun istituto nel titolo: RESTA con il nome grezzo
  //     del bando.
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
  'nessun avviso VIVO viene scartato per anagrafica',
  ['ok', 'da-codice', 'da-titolo', 'senza-scuola', 'codici-classe', 'solo-codici', 'etichetta-posto', 'client-codici', 'posto-montessori', 'nome-con-coda'],
  pronte.map((p) => p.riga.id),
);
check(
  'fuori restano SOLO gli avvisi non vivi (scaduto / fuori finestra)',
  [],
  pronte
    .filter((p) => ['senza-scadenza', 'scaduto'].includes(p.riga.id))
    .map((p) => p.riga.id),
);
check(
  'nome reale ripulito dalla coda di procedura',
  'I.C. Ferruccio Ulivi',
  pronte.find((p) => p.riga.id === 'nome-con-coda')?.scuola ?? null,
);
// La TOLLERANZA della vetrina (riga che resta, dicitura gestita, nome grezzo,
// marcatore `anagraficaParziale`) è verificata da `npm run test:pipeline`
// (`scripts/test-pipeline-tollerante.ts`), sui suoi casi Padova: qui si controlla
// solo che nessuna di quelle righe porti un codice al posto del nome.
check(
  'nessuna riga di ripiego mostra un codice al posto del nome',
  [],
  pronte
    .filter((p) => ['etichetta-posto', 'client-codici', 'posto-montessori'].includes(p.riga.id))
    .filter((p) => /\||\d[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ]\d/.test(p.scuola))
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
  'elenchi di codici classe («ADEE | EEEE») non sono nomi di scuola: nome gestito, riga presente',
  true,
  pronte.some((p) => p.riga.id === 'solo-codici' && p.scuola === SCUOLA_NON_SPECIFICATA),
);
check(
  'la riga senza istituto resta marcata come anagrafica parziale',
  true,
  Boolean(pronte.find((p) => p.riga.id === 'senza-scuola')?.anagraficaParziale),
);
check(
  'nessun codice classe esposto come nome scuola',
  [],
  pronte.filter((p) => /\|/.test(p.scuola)).map((p) => p.riga.id),
);
check('liste vuote non rompono il filtro', 0, preparaRigheBoard([]).length);

console.log(errori === 0 ? '\n✅ RADAR LIVE: nessun problema' : `\n❌ RADAR LIVE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;


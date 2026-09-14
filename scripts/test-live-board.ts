/**
 * Verifica il filtro di VETRINA del "Radar Live" (Flight Board):
 * le righe incomplete NON devono arrivare in pagina — niente "Scuola non
 * indicata" né "Scadenza n/d". Le righe vengono prima ARRICCHITE (nome scuola
 * dal campo, dal registro per codice meccanografico, dal titolo, dall'ente
 * emittente) e solo se resta un buco vengono scartate.
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
];

const pronte = preparaRigheBoard(righe);
check('restano solo le righe presentabili', ['ok', 'da-codice', 'da-titolo'], pronte.map((p) => p.riga.id));
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
  'ogni riga ha una scadenza valida',
  [],
  pronte.filter((p) => !/^\d{4}-\d{2}-\d{2}/.test(p.scadenza)).map((p) => p.riga.id),
);
check('scuola dal titolo: frammento generico ignorato', null, scuolaDaTitolo('Avviso supplenza — Scuola'));
check('liste vuote non rompono il filtro', 0, preparaRigheBoard([]).length);

console.log(errori === 0 ? '\n✅ RADAR LIVE: nessun problema' : `\n❌ RADAR LIVE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

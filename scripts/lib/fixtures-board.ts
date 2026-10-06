/**
 * ScuoleRadar.it — Fixture condivise delle guardie della VETRINA del tabellone.
 *
 * Modulo di supporto delle guardie (mai importato da `src/`): le righe di prova del
 * «Radar Live» vivono qui, così le guardie del tabellone partono dallo stesso dato
 * invece di ricopiarlo (§26.59). Ogni caso porta nel commento il motivo per cui la
 * riga resta in vetrina o ne esce: senza un istituto reale risolto, la riga è FUORI.
 */

import type { RigaBoard } from '../../src/lib/liveBoard.ts';

/** Scadenza lontana: una riga con questa data è sempre «viva». */
const FUTURO = '2099-12-31';

/** Righe di prova della vetrina: il numero nel commento è il caso della guardia. */
export const RIGHE_BOARD: RigaBoard[] = [
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
  // 4) Nessuna scuola ricavabile: FUORI (§26.59) — la dicitura gestita «Scuola non
  //    specificata / Più plessi» non è un'anagrafica.
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
  // 8) Solo codici classe e nessuna alternativa: FUORI (§26.59): nessun istituto.
  {
    id: 'solo-codici',
    title: 'EEEE | AAAA | AL56 | A041 | A042 | ADEE',
    school_name: 'BA02 | AR04',
    province: 'MB',
    expiration_date: FUTURO,
  },
  // 9) `school_name` = etichetta di POSTO/MATERIA (dato reale dello scraper) e
  //    titolo fatto di soli codici: nessun istituto → FUORI (§26.59).
  {
    id: 'etichetta-posto',
    title: 'ADEE | EEEE | A042',
    school_name: 'Conversazione in lingua straniera',
    province: 'PD',
    expiration_date: FUTURO,
  },
  // 10) Codici amministrativi citati dal cliente e titolo che non nomina un
  //     istituto: FUORI (§26.59) — mai un codice in vetrina, per nessuna strada.
  {
    id: 'client-codici',
    title: 'La provincia di TO non ha nuovi avvisi con scuola indicata',
    school_name: 'AAAA | A246',
    province: 'TO',
    expiration_date: FUTURO,
  },
  // 11) Etichetta di posto + nessun istituto nel titolo: FUORI (§26.59) — una
  //     stringa della fonte non è un'anagrafica.
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
  // 13) Istituto reale con anagrafica dichiarata `parziale`: la riga ENTRA — lo stato
  //     dell'anagrafica non è un motivo di scarto, il gate è il NOME.
  {
    id: 'anagrafica-parziale',
    title: 'Interpello supplenza — Liceo Galilei',
    school_name: 'Liceo Galilei',
    province: 'RM',
    expiration_date: FUTURO,
    stato_arricchimento: 'parziale',
  },
];

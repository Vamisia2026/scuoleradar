/**
 * ScuoleRadar.it — Dipartimento CFU · engine/sources/dm22122023_A12_A22_LM14.
 *
 * FONTE PRIMARIA VERBATIM — DM 22/12/2023 — Gazzetta Ufficiale N. 34
 * (10/02/2024) — Tabella A:
 *  - A-12 «Discipline letterarie negli istituti di istruzione secondaria di
 *    II grado» (laurea magistrale LM-14 · Filologia moderna);
 *  - A-22 «Italiano, storia, geografia nella scuola secondaria di I grado»
 *    (laurea magistrale LM-14 · Filologia moderna).
 *
 * I testi verbatim sono copiati ESATTAMENTE dai file raw
 * `sources/raw/DM_22_12_2023_A12_LM14.txt` e
 * `sources/raw/DM_22_12_2023_A22_LM14.txt`; `rawSourceSha256` è l'hash SHA-256
 * dell'INTERO file raw. I macro-settori citati senza slash (es. "L-FIL-LET,
 * L-LIN, M-STO, L-ANT") sono modellati come PREFIX PATTERN della tassonomia
 * CUN (token con "/") — nessuna enumerazione manuale.
 */
import type {
  IntegrabilitaStatus,
  NormativeRuleEntry,
  VincoloCfu,
} from '../types';

export const A12_RAW_SOURCE_PATH = 'sources/raw/DM_22_12_2023_A12_LM14.txt';
export const A22_RAW_SOURCE_PATH = 'sources/raw/DM_22_12_2023_A22_LM14.txt';

export const A12_RAW_SHA256 =
  'fab9e4a33b37777835556205d7f6429a700f9f97335da7b687880743eb2a5be7';
export const A22_RAW_SHA256 =
  '1d44867346a24ecde72f549c8d0ff8fc1364ff6449a40a2af9d752f942443c03';

/** Testo verbatim A-12 (identico al file raw, incluso il newline finale). */
export const TESTO_FONTE_A12 = `A-12 Discipline letterarie negli istituti di istruzione secondaria di II grado
LM 14-Filologia moderna
Con almeno 84 CFU nei settori scientifico disciplinari L-FIL-LET, L-LIN, M-STO, L-ANT, di cui: 12 L-FIL-LET/04, 12 L-FIL-LET/10, 12 L-FIL-LET/12, 12 L-LIN/01 o L-FIL-LET/15, 12 M-STO/01 o 02 o 04, 12 L-ANT/02 o 03.
`;

const LOCATION_A12 = 'G.U. 10/02/2024 - Tabella A - Classe A-12';
const LOCATION_A22 = 'G.U. 10/02/2024 - Tabella A - Classe A-22';

/** Vincoli A-12 derivati STRETTAMENTE dalla riga verbatim (LM-14). */
export const VINCOLI_A12_LM14: VincoloCfu[] = [
  {
    id: 'v-A12-totale',
    tipo: 'gruppoSsd',
    ssd: ['L-FIL-LET/', 'L-LIN/', 'M-STO/', 'L-ANT/'],
    min: 84,
    sourceExcerpt:
      'Con almeno 84 CFU nei settori scientifico disciplinari L-FIL-LET, L-LIN, M-STO, L-ANT',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-LFILLET04',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/04',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/04',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-LFILLET10',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/10',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/10',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-LFILLET12',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/12',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/12',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-LLIN01-FIL15',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'v-A12-LLIN01-FIL15-opt-L-LIN-01', ssd: ['L-LIN/01'], min: 12, nota: '12 CFU in L-LIN/01.' },
      { id: 'v-A12-LLIN01-FIL15-opt-L-FIL-LET-15', ssd: ['L-FIL-LET/15'], min: 12, nota: '12 CFU in L-FIL-LET/15.' },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER L-LIN/01 OR L-FIL-LET/15',
    sourceExcerpt: '12 L-LIN/01 o L-FIL-LET/15',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-MSTO',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'v-A12-MSTO-opt-01', ssd: ['M-STO/01'], min: 12, nota: '12 CFU in M-STO/01.' },
      { id: 'v-A12-MSTO-opt-02', ssd: ['M-STO/02'], min: 12, nota: '12 CFU in M-STO/02.' },
      { id: 'v-A12-MSTO-opt-04', ssd: ['M-STO/04'], min: 12, nota: '12 CFU in M-STO/04.' },
    ],
    disgiunzioneEsplicita:
      'At least 12 CFU required in EITHER M-STO/01 OR M-STO/02 OR M-STO/04',
    sourceExcerpt: '12 M-STO/01 o 02 o 04',
    sourceLocation: LOCATION_A12,
  },
  {
    id: 'v-A12-LANT',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'v-A12-LANT-opt-02', ssd: ['L-ANT/02'], min: 12, nota: '12 CFU in L-ANT/02.' },
      { id: 'v-A12-LANT-opt-03', ssd: ['L-ANT/03'], min: 12, nota: '12 CFU in L-ANT/03.' },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER L-ANT/02 OR L-ANT/03',
    sourceExcerpt: '12 L-ANT/02 o 03',
    sourceLocation: LOCATION_A12,
  },
];

export const RULE_ID_A12_LM14 = 'A-12::LM-14::DM22-12-2023';

export const REGOLA_A12_LM14: NormativeRuleEntry = {
  id: RULE_ID_A12_LM14,
  rawSourceFilePath: A12_RAW_SOURCE_PATH,
  rawSourceSha256: A12_RAW_SHA256,
  estrattoVerbatim: TESTO_FONTE_A12,
  sourceStatus: 'VERIFIED',
  provisione: 'Tabella A - classe A-12 (titolo LM-14)',
  articoloTabellaNota: 'G.U. 10/02/2024 - Tabella A - Classe A-12 (LM-14)',
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  classeCodice: 'A-12',
  denominazioneClasse:
    'Discipline letterarie negli istituti di istruzione secondaria di II grado',
  vincoli: VINCOLI_A12_LM14,
  classiLaureaAmmesse: ['LM-14'],
  integrabilita: 'NOT_SPECIFIED' as IntegrabilitaStatus,
  nota:
    'Riga verbatim Tabella A (LM-14). Nessuna clausola di integrazione dei CFU ' +
    'mancanti nel testo → integrabilita NOT_SPECIFIED (nessuna deduzione automatica).',
  fonte:
    'DM 22/12/2023 - G.U. N. 34 del 10/02/2024 - Tabella A - Classe A-12 (LM-14)',
  dataAggiornamentoNormativa: '2024-02-10',
};

/* ------------------------------ A-22 (LM-14) ------------------------------ */

/** Testo verbatim A-22 (identico al file raw, incluso il newline finale). */
export const TESTO_FONTE_A22 = `A-22 Italiano, storia, geografia nella scuola secondaria di I grado
LM 14-Filologia moderna
Con almeno 80 CFU nei settori scientifico disciplinari L-FIL-LET, L-LIN, M-STO, L-ANT, M-GGR, di cui: 12 L-FIL-LET/04, 12 L-FIL-LET/10, 12 L-FIL-LET/12, 12 L-LIN/01 o L-FIL-LET/15, 12 M-STO/01 o 02 o 04, 12 M-GGR/01.
`;

/** Vincoli A-22 derivati STRETTAMENTE dalla riga verbatim (LM-14). */
export const VINCOLI_A22_LM14: VincoloCfu[] = [
  {
    id: 'v-A22-totale',
    tipo: 'gruppoSsd',
    ssd: ['L-FIL-LET/', 'L-LIN/', 'M-STO/', 'L-ANT/', 'M-GGR/'],
    min: 80,
    sourceExcerpt:
      'Con almeno 80 CFU nei settori scientifico disciplinari L-FIL-LET, L-LIN, M-STO, L-ANT, M-GGR',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-LFILLET04',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/04',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/04',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-LFILLET10',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/10',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/10',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-LFILLET12',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/12',
    min: 12,
    sourceExcerpt: '12 L-FIL-LET/12',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-LLIN01-FIL15',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'v-A22-LLIN01-FIL15-opt-L-LIN-01', ssd: ['L-LIN/01'], min: 12, nota: '12 CFU in L-LIN/01.' },
      { id: 'v-A22-LLIN01-FIL15-opt-L-FIL-LET-15', ssd: ['L-FIL-LET/15'], min: 12, nota: '12 CFU in L-FIL-LET/15.' },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER L-LIN/01 OR L-FIL-LET/15',
    sourceExcerpt: '12 L-LIN/01 o L-FIL-LET/15',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-MSTO',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'v-A22-MSTO-opt-01', ssd: ['M-STO/01'], min: 12, nota: '12 CFU in M-STO/01.' },
      { id: 'v-A22-MSTO-opt-02', ssd: ['M-STO/02'], min: 12, nota: '12 CFU in M-STO/02.' },
      { id: 'v-A22-MSTO-opt-04', ssd: ['M-STO/04'], min: 12, nota: '12 CFU in M-STO/04.' },
    ],
    disgiunzioneEsplicita:
      'At least 12 CFU required in EITHER M-STO/01 OR M-STO/02 OR M-STO/04',
    sourceExcerpt: '12 M-STO/01 o 02 o 04',
    sourceLocation: LOCATION_A22,
  },
  {
    id: 'v-A22-MGGR01',
    tipo: 'singoloSsd',
    ssd: 'M-GGR/01',
    min: 12,
    sourceExcerpt: '12 M-GGR/01',
    sourceLocation: LOCATION_A22,
  },
];

export const RULE_ID_A22_LM14 = 'A-22::LM-14::DM22-12-2023';

export const REGOLA_A22_LM14: NormativeRuleEntry = {
  id: RULE_ID_A22_LM14,
  rawSourceFilePath: A22_RAW_SOURCE_PATH,
  rawSourceSha256: A22_RAW_SHA256,
  estrattoVerbatim: TESTO_FONTE_A22,
  sourceStatus: 'VERIFIED',
  provisione: 'Tabella A - classe A-22 (titolo LM-14)',
  articoloTabellaNota: 'G.U. 10/02/2024 - Tabella A - Classe A-22 (LM-14)',
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  classeCodice: 'A-22',
  denominazioneClasse: 'Italiano, storia, geografia nella scuola secondaria di I grado',
  vincoli: VINCOLI_A22_LM14,
  classiLaureaAmmesse: ['LM-14'],
  integrabilita: 'NOT_SPECIFIED' as IntegrabilitaStatus,
  nota:
    'Riga verbatim Tabella A (LM-14). Nessuna clausola di integrazione dei CFU ' +
    'mancanti nel testo → integrabilita NOT_SPECIFIED (nessuna deduzione automatica).',
  fonte:
    'DM 22/12/2023 - G.U. N. 34 del 10/02/2024 - Tabella A - Classe A-22 (LM-14)',
  dataAggiornamentoNormativa: '2024-02-10',
};


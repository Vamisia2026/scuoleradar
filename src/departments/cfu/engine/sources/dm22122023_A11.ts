/**
 * ScuoleRadar.it — Dipartimento CFU · engine/sources/dm22122023_A11.
 *
 * FONTE PRIMARIA VERBATIM — Classe A-11 «Discipline letterarie e latino nei
 * licei e nell'istituto magistrale» (laurea magistrale LM-14 · Filologia moderna).
 *
 * DM 22/12/2023 — Gazzetta Ufficiale N. 34 (10/02/2024) — Tabella A.
 *
 * Il testo verbatim è copiato ESATTAMENTE dal file raw
 * `sources/raw/DM_22_12_2023_A11_LM14.txt`; `rawSourceSha256` è l'hash SHA-256
 * dell'INTERO file raw (calcolato con `crypto.createHash('sha256')`).
 *
 * MODELLAZIONE SEMANTICA (nessuna enumerazione arbitraria di SSD):
 *  - i settori aggregati citati come "L-FIL-LET/", "L-ANT/", "M-STO/" sono
 *    PREFIX PATTERN risolti dal solver tramite la tassonomia CUN
 *    (engine/ssdTaxonomy) — nessun elenco manuale di sottocodici nella regola;
 *  - la clausola "L-ANT/02 o L-ANT/03" è una DISGIUNZIONE ESPLICITA formale
 *    (tipo 'disgiunzioneSsd', EXPLICIT_OR_CONDITION): serve il minimo in UNA
 *    delle due opzioni (i crediti non si sommano).
 */
import type {
  IntegrabilitaStatus,
  NormativaTemporalContext,
  NormativeRuleEntry,
  VincoloCfu,
} from '../types';

export const A11_RAW_SOURCE_PATH = 'sources/raw/DM_22_12_2023_A11_LM14.txt';

export const A11_RAW_SHA256 =
  '1a691b6006cb1d0cfd2ae20fb66d47eeba993ed5a742a35955952b19133cdd0a';

export const RIFERIMENTO_UFFICIALE_A11 = {
  decreto: 'DM 22/12/2023',
  gazzettaUfficiale: 'G.U. N. 34 (10/02/2024)',
  tavola: 'Tabella A',
  classe: 'A-11',
  denominazioneClasse:
    'Discipline letterarie e latino nei licei e nell\u2019istituto magistrale',
  titoloAccesso: 'Laurea magistrale LM-14 (Filologia moderna)',
  ente: 'MIM',
} as const;

/** Testo verbatim (identico al file raw, incluso il newline finale). */
export const TESTO_FONTE_A11 = `Classe A-11 - Discipline letterarie e latino nei licei e nell'istituto magistrale
Consegue la laurea magistrale in Filologia moderna (LM-14) chi possiede almeno 96 CFU nei settori scientifico-disciplinari L-FIL-LET/, L-ANT/, M-STO/, L-LIN/01, di cui:
- almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04;
- almeno 12 CFU tra L-FIL-LET/10 e L-FIL-LET/12;
- almeno 12 CFU tra L-ANT/02 o L-ANT/03.
Note: Le lauree che comprendono i CFU indicati sono titoli di accesso diretti.
`;

const LOCATION_A11 = 'G.U. 10/02/2024 - Tabella A - Classe A-11';

/** Vincoli strutturati derivati STRETTAMENTE dalle righe verbatim della fonte. */
export const VINCOLI_A11_LM14: VincoloCfu[] = [
  {
    id: 'v-A11-totale',
    tipo: 'gruppoSsd',
    // Prefissi macro CUN + codice esatto, esattamente come citati dalla riga
    // verbatim ("L-FIL-LET/, L-ANT/, M-STO/, L-LIN/01"): il prefix wildcard
    // copre qualsiasi SSD del macro-settore senza enumerarli qui.
    ssd: ['L-FIL-LET/', 'L-ANT/', 'M-STO/', 'L-LIN/01'],
    min: 96,
    sourceExcerpt:
      'almeno 96 CFU nei settori scientifico-disciplinari L-FIL-LET/, L-ANT/, M-STO/, L-LIN/01',
    sourceLocation: LOCATION_A11,
  },
  {
    id: 'v-A11-LFILLET0405',
    tipo: 'gruppoSsd',
    ssd: ['L-FIL-LET/04', 'L-FIL-LET/05'],
    min: 24,
    sourceExcerpt:
      'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04',
    sourceLocation: LOCATION_A11,
  },
  {
    id: 'v-A11-LFILLET04',
    tipo: 'singoloSsd',
    ssd: 'L-FIL-LET/04',
    min: 12,
    nota: 'Almeno 12 CFU in L-FIL-LET/04.',
    sourceExcerpt:
      'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04',
    sourceLocation: LOCATION_A11,
  },
  {
    id: 'v-A11-LFILLET1012',
    tipo: 'gruppoSsd',
    ssd: ['L-FIL-LET/10', 'L-FIL-LET/12'],
    min: 12,
    sourceExcerpt: 'almeno 12 CFU tra L-FIL-LET/10 e L-FIL-LET/12',
    sourceLocation: LOCATION_A11,
  },
  {
    id: 'v-A11-LANT',
    tipo: 'disgiunzioneSsd',
    // "almeno 12 CFU tra L-ANT/02 o L-ANT/03" = DISGIUNZIONE ESPLICITA:
    // 12 CFU in EITHER L-ANT/02 OR L-ANT/03 (6+6 NON soddisfa la clausola).
    opzioni: [
      {
        id: 'v-A11-LANT-opt-L-ANT-02',
        ssd: ['L-ANT/02'],
        min: 12,
        nota: '12 CFU in L-ANT/02.',
      },
      {
        id: 'v-A11-LANT-opt-L-ANT-03',
        ssd: ['L-ANT/03'],
        min: 12,
        nota: '12 CFU in L-ANT/03.',
      },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER L-ANT/02 OR L-ANT/03',
    sourceExcerpt: 'almeno 12 CFU tra L-ANT/02 o L-ANT/03',
    sourceLocation: LOCATION_A11,
  },
];

export const RULE_ID_A11_LM14 = 'A-11::LM-14::DM22-12-2023';

export const REGOLA_A11_LM14: NormativeRuleEntry = {
  id: RULE_ID_A11_LM14,
  rawSourceFilePath: A11_RAW_SOURCE_PATH,
  rawSourceSha256: A11_RAW_SHA256,
  estrattoVerbatim: TESTO_FONTE_A11,
  sourceStatus: 'VERIFIED',
  provisione: 'Tabella A - classe A-11 (titolo LM-14)',
  articoloTabellaNota: 'G.U. 10/02/2024 - Tabella A - Classe A-11 (LM-14)',
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  classeCodice: 'A-11',
  denominazioneClasse:
    'Discipline letterarie e latino nei licei e nell\u2019istituto magistrale',
  vincoli: VINCOLI_A11_LM14,
  classiLaureaAmmesse: ['LM-14'],
  integrabilita: 'NOT_SPECIFIED' as IntegrabilitaStatus,
  nota:
    'La riga dichiara che le lauree con i CFU indicati sono titoli di accesso ' +
    'diretti; nessuna clausola di integrazione dei CFU mancanti è presente nel ' +
    'testo → integrabilita NOT_SPECIFIED (niente deduzioni automatiche). ' +
    'I settori aggregati L-FIL-LET/, L-ANT/, M-STO/ sono modellati come prefix ' +
    'pattern sulla tassonomia CUN (engine/ssdTaxonomy); la clausola "o" su ' +
    'L-ANT/02/L-ANT/03 è una disgiunzione esplicita (tipo disgiunzioneSsd).',
  fonte:
    'DM 22/12/2023 - G.U. N. 34 del 10/02/2024 - Tabella A - Classe A-11 (LM-14)',
  dataAggiornamentoNormativa: '2024-02-10',
};

export const CONTESTO_A11_DM22: NormativaTemporalContext = {
  id: 'ctx-A-11::DM22-12-2023',
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  validFrom: '2024-02-10',
  fonte: 'G.U. N. 34 del 10/02/2024 - DM 22/12/2023',
  dataAggiornamentoNormativa: '2024-02-10',
  note: 'Tabella A - classe A-11 (titolo LM-14).',
};


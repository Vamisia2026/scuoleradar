/**
 * ScuoleRadar.it — Dipartimento CFU · Fixture della Universal Requirement Pipeline.
 *
 * ⚠️ FIXTURE DI TEST: classi "T-*", codici "X-TEST/*", testi "TEST-ONLY".
 * Nessun contenuto normativo reale viene inventato: le suite
 * `universalPipeline.test.ts` e `universalPipelineSemantica.test.ts` verificano
 * la MECCANICA della pipeline su questi dati dichiaratamente fittizi.
 */
import { sha256Hex } from '../sourceGate';
import type { InputPipelineUniversale } from '../pipeline/pipeline';
import type { DefinizioneRequisito } from '../pipeline/requirementTypes';
import type { RegistroStrategieRequisito } from '../pipeline/strategies';
import type {
  DateRilevanza,
  EsameCanonico,
  NormativaTemporalContext,
  NormativeRuleEntry,
  TitoloAccademicoCanonico,
  VincoloCfu,
} from '../types';

let conteggioAssert = 0;

/** Asserzione condivisa dalle suite (una suite = un processo). */
export function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

export function conteggioAsserzioni(): number {
  return conteggioAssert;
}

export const EXCERPT_SINGOLO = 'almeno 12 CFU nel settore X-TEST/01';
export const EXCERPT_GRUPPO = 'almeno 12 CFU nei settori Y-TEST/01 e Y-TEST/02';
export const EXCERPT_DISGIUNZIONE = 'almeno 12 CFU in Z-TEST/01 oppure Z-TEST/02';
export const EXCERPT_TITOLO = 'titolo di abilitazione TEST richiesto come condizione necessaria';
export const LOCATION_TEST = 'TEST-MOCK — riga di fixture';

export const TESTO_MOCK =
  'TEST-ONLY — fixture di test (nessuna norma reale): ' +
  `${EXCERPT_SINGOLO}; ` +
  `${EXCERPT_GRUPPO}; ` +
  `${EXCERPT_DISGIUNZIONE}; ` +
  `${EXCERPT_TITOLO}.`;
export const FILE_MOCK = `${TESTO_MOCK}\n`;

export const ORA_FISSA = '2024-03-15T09:00:00.000Z';

export const DATE_MOCK: DateRilevanza = {
  enrollmentDate: '2019-10-01',
  awardedDate: '2022-11-18',
  procedureDate: '2024-03-15',
};

export const TITOLO_MOCK: TitoloAccademicoCanonico = {
  denominazione: 'Laurea TEST (fixture)',
  classe: 'LM-99-TEST',
  classeLegacy: null,
  paese: null,
  titoloEstero: false,
};

export const CONTESTO_MOCK: NormativaTemporalContext = {
  id: 'ctx-T-11::TEST-MOCK',
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  validFrom: '2024-02-10',
  fonte: 'TEST-MOCK — G.U. fittizia',
  dataAggiornamentoNormativa: '2024-02-10',
  note: 'Contesto di fixture (nessuna norma reale).',
};

export function esameMock(id: string, ssd: string, cfu: number): EsameCanonico {
  return {
    id,
    denominazione: `Esame ${ssd} (TEST)`,
    cfu,
    ssd,
    fonte: 'manuale',
    provenienza: [],
  };
}

export const EXAMS_COMPLETI: EsameCanonico[] = [
  esameMock('x1', 'X-TEST/01', 12),
  esameMock('y1', 'Y-TEST/01', 6),
  esameMock('y2', 'Y-TEST/02', 6),
  esameMock('z1', 'Z-TEST/01', 12),
];

/** Difetto su X-TEST/01 ma requisiti gruppo/disgiunzione soddisfatti. */
export const EXAMS_PARZIALI: EsameCanonico[] = [
  esameMock('w1', 'W-TEST/01', 12),
  esameMock('y1', 'Y-TEST/01', 6),
  esameMock('y2', 'Y-TEST/02', 6),
  esameMock('z1', 'Z-TEST/01', 12),
];

export const VINCOLI_MOCK: VincoloCfu[] = [
  {
    id: 'v-T-singolo',
    tipo: 'singoloSsd',
    ssd: 'X-TEST/01',
    min: 12,
    nota: 'Almeno 12 CFU in X-TEST/01 (TEST).',
    sourceExcerpt: EXCERPT_SINGOLO,
    sourceLocation: LOCATION_TEST,
  },
  {
    id: 'v-T-gruppo',
    tipo: 'gruppoSsd',
    ssd: ['Y-TEST/01', 'Y-TEST/02'],
    min: 12,
    sourceExcerpt: EXCERPT_GRUPPO,
    sourceLocation: LOCATION_TEST,
  },
  {
    id: 'v-T-disgiunzione',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'opt-Z1', ssd: ['Z-TEST/01'], min: 12, nota: '12 CFU in Z-TEST/01 (TEST).' },
      { id: 'opt-Z2', ssd: ['Z-TEST/02'], min: 12, nota: '12 CFU in Z-TEST/02 (TEST).' },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER Z-TEST/01 OR Z-TEST/02 (TEST)',
    sourceExcerpt: EXCERPT_DISGIUNZIONE,
    sourceLocation: LOCATION_TEST,
  },
  {
    id: 'v-T-titolo',
    tipo: 'titoloAbilitante',
    denominazione: 'Abilitazione TEST (fixture)',
    necessario: false,
    sourceExcerpt: EXCERPT_TITOLO,
    sourceLocation: LOCATION_TEST,
  },
];

export interface OpzioniRegolaMock {
  id?: string;
  integrabilita?: NormativeRuleEntry['integrabilita'];
  vincoli?: VincoloCfu[];
  sourceStatus?: NormativeRuleEntry['sourceStatus'];
}

/** Regola autorevole di fixture (TEST-ONLY), verificabile dal Source Gate. */
export function regolaMock(sha: string, opzioni: OpzioniRegolaMock = {}): NormativeRuleEntry {
  return {
    id: opzioni.id ?? 'TEST-MOCK::T-11',
    rawSourceFilePath: 'sources/raw/_TEST_MOCK.txt',
    rawSourceSha256: sha,
    estrattoVerbatim: TESTO_MOCK,
    sourceStatus: opzioni.sourceStatus ?? 'VERIFIED',
    provisione: 'TEST-MOCK — classe T-11',
    articoloTabellaNota: 'TEST-MOCK — riga T-11',
    decreto: 'DM 22/12/2023',
    tabella: 'A',
    classeCodice: 'T-11',
    denominazioneClasse: 'Classe di test T-11',
    vincoli: opzioni.vincoli ?? VINCOLI_MOCK,
    classiLaureaAmmesse: ['LM-99-TEST'],
    integrabilita: opzioni.integrabilita ?? 'ALLOWED',
    nota: 'Fixture di test: nessuna norma reale.',
    fonte: 'TEST-MOCK — G.U. fittizia',
    dataAggiornamentoNormativa: '2024-02-10',
  };
}

export interface ParametriInputMock {
  esami?: EsameCanonico[];
  titolo?: TitoloAccademicoCanonico | null;
  dateRilevanza?: DateRilevanza;
  contestiNormativi?: NormativaTemporalContext[];
  catalogoRequisiti?: DefinizioneRequisito[];
  registroStrategie?: RegistroStrategieRequisito;
}

/** Input di pipeline su fixture (classe T-11). */
export function inputMock(
  regole: NormativeRuleEntry[],
  extra: ParametriInputMock = {},
): InputPipelineUniversale {
  return {
    classeCodice: 'T-11',
    denominazioneClasse: 'Classe di test T-11',
    esami: EXAMS_COMPLETI,
    titolo: TITOLO_MOCK,
    dateRilevanza: DATE_MOCK,
    contestiNormativi: [CONTESTO_MOCK],
    regole,
    ora: ORA_FISSA,
    ...extra,
  };
}

/** SHA-256 della fixture (calcolato una volta per processo). */
let shaCache: string | null = null;
export async function shaFixture(): Promise<string> {
  if (shaCache === null) shaCache = await sha256Hex(FILE_MOCK);
  return shaCache;
}

/** Serializzazione canonica (chiavi ordinate, `undefined` omessi). */
export function canonico(valore: unknown): string {
  if (valore === null || typeof valore !== 'object') return JSON.stringify(valore) ?? 'null';
  if (Array.isArray(valore)) return `[${valore.map(canonico).join(',')}]`;
  const voci = Object.entries(valore as Record<string, unknown>)
    .filter(([, voceValore]) => voceValore !== undefined)
    .sort(([chiaveA], [chiaveB]) => chiaveA.localeCompare(chiaveB));
  return `{${voci
    .map(([chiave, voceValore]) => `${JSON.stringify(chiave)}:${canonico(voceValore)}`)
    .join(',')}}`;
}

/** Proiezione del vincolo senza id (per il round-trip requisito ↔ vincolo). */
export function senzaId(vincolo: VincoloCfu): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...vincolo };
  delete copia.id;
  return copia;
}

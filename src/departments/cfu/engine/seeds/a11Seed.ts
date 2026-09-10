/**
 * ScuoleRadar.it — Dipartimento CFU · engine/seeds/a11Seed.
 *
 * Loader del seed Vertical Slice #1: registra la regola A-11 (LM-14) verificata
 * SOLO dall'artefatto di fonte primaria `sources/dm22122023_A11.ts`
 * (DM 22/12/2023 - G.U. N. 34 del 10/02/2024 - Tabella A).
 */
import { caricaContestiNormativi, caricaRegoleRequisiti } from '../normativeDatabase';
import {
  A11_RAW_SHA256,
  CONTESTO_A11_DM22,
  REGOLA_A11_LM14,
  RIFERIMENTO_UFFICIALE_A11,
  TESTO_FONTE_A11,
} from '../sources/dm22122023_A11';

let installato = false;

/** Installa il seed A-11 (VERIFIED). Ritorna true se la regola è attiva. */
export async function installaSeedA11(): Promise<boolean> {
  if (installato) return true;

  caricaContestiNormativi([CONTESTO_A11_DM22]);
  const esito = await caricaRegoleRequisiti([REGOLA_A11_LM14]);

  installato = esito.registrate.length === 1;
  return installato;
}

/** Metadati del seed esposti a test/report. */
export const SEED_A11_METADATA = {
  stato: 'VERIFIED' as const,
  rawSourceFilePath: REGOLA_A11_LM14.rawSourceFilePath,
  rawSourceSha256: A11_RAW_SHA256,
  ruleId: REGOLA_A11_LM14.id,
  fonte: REGOLA_A11_LM14.fonte,
  articoloTabellaNota: REGOLA_A11_LM14.articoloTabellaNota,
  dataAggiornamentoNormativa: REGOLA_A11_LM14.dataAggiornamentoNormativa,
  riferimento: RIFERIMENTO_UFFICIALE_A11,
  testoVerbatim: TESTO_FONTE_A11,
} as const;

/**
 * ScuoleRadar.it — Dipartimento CFU · Fixture e verifiche di parità del BRIDGE.
 *
 * Supporto alle suite `bridgePipelineParity`, `routingPipelineParity` e
 * `reportPipelineParity`. Contiene:
 *  - le carriere LEGACY di riferimento (Core Set LM-14: A-11, A-12, A-22);
 *  - `vecchiaComposizione`: la composizione PRE-REFACTOR del bridge
 *    (SourceRegistry → RequirementSolver → mappaEsitoLegacy), usata come
 *    riferimento di parità per il comportamento esternamente visibile;
 *  - le verifiche campo-per-campo (`verificaParita`) e dei metadati estesi
 *    (`verificaMetadatiPipeline`).
 */
import type { Esame } from '../../shared/types';
import {
  esamiLegacyInCanonici,
  mappaEsitoLegacy,
  rispostaFallbackBridge,
  traduciRuleRegistro,
  type EsitoClasseAdapter,
  type ParametriValutazioneBridge,
} from '../bridge/legacyAdapter';
import { valutaRequisitoClasse } from '../requirementSolver';
import {
  assicuraCatalogoEngineDiDefault,
  NORMATIVA_REF_DM22,
  registroEngineDiDefault,
} from '../seeds/progressiveRegistry';
import type { NormativeRuleEntry, TitoloAccademicoCanonico } from '../types';

let conteggioAssert = 0;

export function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

export function conteggioAsserzioni(): number {
  return conteggioAssert;
}

/** Prepara il registro reale (SourceRegistry) con il Core Set DM 22/12/2023. */
export function preparaCatalogoCoreSet(): void {
  assicuraCatalogoEngineDiDefault();
}

export function esame(id: string, ssd: string, cfu: number): Esame {
  return { id, denominazione: `Esame ${ssd}`, cfu, ssd, fonte: 'manuale', affidabilita: 'alta' };
}

/** Carriera LM-14 con 96 CFU (vincoli A-11 verbatim tutti soddisfatti). */
export const ESAMI_ELIGIBILE: Esame[] = [
  esame('e1', 'L-FIL-LET/04', 12),
  esame('e2', 'L-FIL-LET/05', 12),
  esame('e3', 'L-FIL-LET/12', 12),
  esame('e4', 'L-FIL-LET/01', 6),
  esame('e5', 'L-ANT/02', 12),
  esame('e6', 'L-ANT/03', 12),
  esame('e7', 'M-STO/01', 18),
  esame('e8', 'L-LIN/01', 12),
];

/** Deficit reale A-11: L-FIL-LET/04 = 6 CFU (atteso MANUAL + deficit 6). */
export const ESAMI_DEFICIT: Esame[] = [
  esame('e1', 'L-FIL-LET/04', 6),
  esame('e2', 'L-FIL-LET/05', 18),
  esame('e3', 'L-FIL-LET/12', 12),
  esame('e4', 'L-FIL-LET/01', 6),
  esame('e5', 'L-ANT/02', 12),
  esame('e6', 'L-ANT/03', 12),
  esame('e7', 'M-STO/01', 18),
  esame('e8', 'L-LIN/01', 12),
];

/** Carriera di Marco (multiClassScan): 48 CFU → A-11 90 · A-12 72 · A-22 74. */
export const ESAMI_MARCO: Esame[] = [
  esame('m1', 'L-FIL-LET/10', 12),
  esame('m2', 'L-FIL-LET/04', 6),
  esame('m3', 'M-STO/04', 12),
  esame('m4', 'L-ANT/03', 6),
  esame('m5', 'L-LIN/12', 12),
];

/** Carriera per la classe demo legacy A-26 (24 CFU matematici). */
export const ESAMI_A26: Esame[] = [esame('a1', 'MAT/05', 12), esame('a2', 'MAT/02', 12)];

export const CLASSE_LAUREA = 'LM-14';

export const DENOMINAZIONI: Record<string, string> = {
  'A-11': 'Discipline letterarie e latino',
  'A-12': 'Discipline letterarie',
  'A-22': 'Italiano, storia, geografia',
};

/** Input del bridge sul registro reale con contesto normativo dichiarato. */
export function parametriBridge(esami: Esame[], classeCodice: string): ParametriValutazioneBridge {
  return {
    esami,
    classeCodice,
    registry: registroEngineDiDefault,
    denominazioneClasse: DENOMINAZIONI[classeCodice] ?? classeCodice,
    tabella: 'A',
    normativa: NORMATIVA_REF_DM22,
    classeLaureaTitolo: CLASSE_LAUREA,
  };
}

/* --------------------- Composizione PRE-REFACTOR (riferimento) --------------------- */

/** Riproduce ESATTAMENTE il flusso pre-refactor: solver diretto + mappa legacy. */
export function vecchiaComposizione(parametri: ParametriValutazioneBridge): EsitoClasseAdapter {
  const denominazione = parametri.denominazioneClasse ?? parametri.classeCodice;
  const tabella = parametri.tabella ?? 'A';
  const esitoRegistry = parametri.registry.cercaPerClasseConcorso(parametri.classeCodice);
  if (esitoRegistry.totaleRegoleTrovate === 0 || esitoRegistry.regoleAttive.length === 0) {
    return rispostaFallbackBridge({
      classeCodice: parametri.classeCodice,
      denominazioneClasse: denominazione,
      tabella,
      motivo: `Nessuna regola data-driven attiva per la classe ${parametri.classeCodice}.`,
    });
  }
  const regoleEngine: NormativeRuleEntry[] = [];
  for (const regola of esitoRegistry.regoleAttive) {
    const tradotta = traduciRuleRegistro(regola, parametri.registry, {
      classeCodice: parametri.classeCodice,
      denominazioneClasse: denominazione,
      normativa: parametri.normativa,
    });
    if (tradotta) regoleEngine.push(tradotta);
  }
  const titolo: TitoloAccademicoCanonico = {
    denominazione: 'Carriera valutata via Bridge Adapter',
    classe: parametri.classeLaureaTitolo ?? null,
    classeLegacy: null,
    paese: null,
    titoloEstero: false,
  };
  const valutazione = valutaRequisitoClasse(
    parametri.classeCodice,
    esamiLegacyInCanonici(parametri.esami),
    {
      regole: regoleEngine,
      mappature: [],
      titolo,
      normativa: parametri.normativa,
      ora: parametri.ora,
    },
  );
  return mappaEsitoLegacy({
    classeCodice: parametri.classeCodice,
    denominazioneClasse: denominazione,
    tabella,
    statoMotore: valutazione.stato,
    cfuMancanti: valutazione.cfuMancantiTotali,
    regoleApplicate: valutazione.regoleApplicate ?? [],
    audit: valutazione.audit,
    motivazione:
      valutazione.motivazione ?? `Valutazione motore per la classe ${parametri.classeCodice}.`,
  });
}

/* ------------------------------ Verifiche di parità ------------------------------ */

/** Confronto campo-per-campo fra comportamento atteso e comportamento instradato. */
export function verificaParita(
  etichetta: string,
  atteso: EsitoClasseAdapter,
  nuovo: EsitoClasseAdapter,
): void {
  assert(nuovo.esitoMotore === atteso.esitoMotore, `${etichetta}: stato identico (${atteso.esitoMotore})`);
  assert(nuovo.cfuMancanti === atteso.cfuMancanti, `${etichetta}: deficit identico (${atteso.cfuMancanti})`);
  assert(nuovo.accessibile === atteso.accessibile, `${etichetta}: flag accessibile identico`);
  assert(
    nuovo.verificaManualeRichiesta === atteso.verificaManualeRichiesta,
    `${etichetta}: flag verifica manuale identico`,
  );
  assert(
    nuovo.regoleApplicate.join('|') === atteso.regoleApplicate.join('|'),
    `${etichetta}: regole applicate identiche (${atteso.regoleApplicate.length})`,
  );
  assert(nuovo.motivazione === atteso.motivazione, `${etichetta}: motivazione identica`);
  assert(nuovo.isEngineDriven === atteso.isEngineDriven, `${etichetta}: isEngineDriven identico`);
  assert(
    nuovo.classe.codice === atteso.classe.codice &&
      nuovo.classe.denominazione === atteso.classe.denominazione &&
      nuovo.classe.tabella === atteso.classe.tabella,
    `${etichetta}: shape legacy della classe identico`,
  );
  assert(
    Boolean(nuovo.motivoFallback) === Boolean(atteso.motivoFallback),
    `${etichetta}: presenza motivoFallback coerente`,
  );
  assert(
    nuovo.audit.length >= atteso.audit.length,
    `${etichetta}: audit pipeline ⊇ audit decisore (${atteso.audit.length} ≤ ${nuovo.audit.length})`,
  );
}

/** Metadati estesi: fonti, requisiti, deficit, conflitti, payload assistente, audit. */
export function verificaMetadatiPipeline(etichetta: string, esito: EsitoClasseAdapter): void {
  assert(Boolean(esito.fonti?.length), `${etichetta}: fonti autorevoli propagate`);
  assert(
    esito.fonti!.every((fonte) => fonte.verificata && fonte.sourceId.length > 0),
    `${etichetta}: fonti verificate dal Source Gate v2 con id tracciabile`,
  );
  assert(Boolean(esito.valutazioniRequisito?.length), `${etichetta}: requisiti strutturati valutati`);
  assert(
    esito.valutazioniRequisito!.every((valutazione) => valutazione.spiegazione.length > 0),
    `${etichetta}: ogni requisito espone il percorso logico`,
  );
  assert(Boolean(esito.deficit), `${etichetta}: analisi del deficit presente`);
  assert(esito.conflitti?.length === 0, `${etichetta}: nessun conflitto fra fonti reali`);
  assert(
    esito.payloadAssistantCreativo?.stato === esito.esitoMotore &&
      esito.payloadAssistantCreativo?.puoCreareEsito === false &&
      esito.payloadAssistantCreativo?.puoModificareEsito === false,
    `${etichetta}: payload non autorevole e allineato al motore`,
  );
  assert(
    esito.audit.some((voce) => voce.messaggio.startsWith('[requirement-evaluation]')) &&
      esito.audit.some((voce) => voce.messaggio.startsWith('[normative-source]')),
    `${etichetta}: audit di fonti e requisiti presente`,
  );
}

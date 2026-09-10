/**
 * ScuoleRadar.it — Dipartimento CFU · engine/seeds/progressiveRegistry.
 *
 * INGESTIONE PROGRESSIVA del catalogo engine nel SourceRegistry condiviso:
 * converte i vincoli delle regole REALI del DM 22/12/2023 (Tabella A — G.U.
 * N. 34 del 10/02/2024: A-11, A-12, A-22, tutte per LM-14) nella catena
 * Source → Evidence → Proposition → Rule del SourceRegistry, mantenendo hash e
 * excerpt verbatim. Il registro di default alimenta il wiring del calcolatore
 * legacy: classi con regole ATTIVE → NEW_ENGINE; tutte le altre → LEGACY.
 */
import { creaSourceRegistry, type SourceRegistry } from '../traceability/sourceRegistry';
import {
  creaEvidence,
  creaProposition,
  creaRule,
  creaSource,
  dominioClasseConcorso,
  dominioClasseLaurea,
  type Rule,
  type VincoloCFU,
} from '../traceability/traceabilityChain';
import {
  A11_RAW_SHA256,
  A11_RAW_SOURCE_PATH,
  REGOLA_A11_LM14,
} from '../sources/dm22122023_A11';
import {
  A12_RAW_SHA256,
  A12_RAW_SOURCE_PATH,
  A22_RAW_SHA256,
  A22_RAW_SOURCE_PATH,
  REGOLA_A12_LM14,
  REGOLA_A22_LM14,
} from '../sources/dm22122023_A12_A22_LM14';
import type { NormativaApplicata, NormativeRuleEntry } from '../types';

/** Contesto normativo di riferimento per il bridge quando non viene passato. */
export const NORMATIVA_REF_DM22: NormativaApplicata = {
  decreto: REGOLA_A11_LM14.decreto,
  tabella: REGOLA_A11_LM14.tabella,
  dataAggiornamentoNormativa: REGOLA_A11_LM14.dataAggiornamentoNormativa,
};

/** Converte un vincolo engine in un vincolo computabile della catena. */
export function convertiVincoloEngineInCatena(
  vincolo: (typeof REGOLA_A11_LM14.vincoli)[number],
): VincoloCFU | null {
  if (vincolo.tipo === 'singoloSsd') {
    return { tipo: 'singoloSsdMinCfu', ssd: vincolo.ssd, minCfu: vincolo.min };
  }
  if (vincolo.tipo === 'gruppoSsd') {
    return { tipo: 'gruppoSsdMinCfu', ssd: [...vincolo.ssd], minCfu: vincolo.min };
  }
  if (vincolo.tipo === 'disgiunzioneSsd') {
    return {
      tipo: 'disgiunzioneMinCfu',
      opzioni: vincolo.opzioni.map((opzione) => ({
        id: opzione.id,
        ssd: [...opzione.ssd],
        minCfu: opzione.min,
      })),
    };
  }
  return null;
}

export interface ParametriSeminaRegola {
  readonly regolaEngine: NormativeRuleEntry;
  readonly rawSourceFilePath: string;
  readonly rawSourceSha256: string;
  readonly titoloDocumento: string;
}

/**
 * Registra UNA regola normativa reale (DM 22/12/2023) nel registro fornito,
 * ricostruendo per ogni vincolo la catena Evidence → Proposition → Rule con
 * excerpt verbatim e hash della Source. Ritorna gli id delle Rule registrate.
 */
export function seminaRegolaNormativaNelRegistro(
  registro: SourceRegistry,
  parametri: ParametriSeminaRegola,
): string[] {
  const fonte = creaSource({
    id: `src-${parametri.regolaEngine.id}`,
    hash: parametri.rawSourceSha256,
    autorita: 'MIM',
    titolo: parametri.titoloDocumento,
    tipoDocumento: 'tabella',
    pubblicazione: {
      riferimento: 'G.U. N. 34 del 10/02/2024',
      data: '2024-02-10',
      articoloNota: parametri.regolaEngine.articoloTabellaNota,
    },
    rawFilePath: parametri.rawSourceFilePath,
    stato: 'ACTIVE',
  });
  registro.registraSource(fonte);

  const regoleRegistrate: string[] = [];
  for (const vincolo of parametri.regolaEngine.vincoli) {
    const vincoloCatena = convertiVincoloEngineInCatena(vincolo);
    if (!vincoloCatena) continue;

    const evidenza = creaEvidence({
      id: `ev-${parametri.regolaEngine.classeCodice}-${vincolo.id}`,
      sourceHash: parametri.rawSourceSha256,
      testo: vincolo.sourceExcerpt,
      coordinate: { pagina: 1, riga: 1 },
      stato: 'ACTIVE',
    });
    const proposizione = creaProposition({
      id: `prop-${parametri.regolaEngine.classeCodice}-${vincolo.id}`,
      contenutoAtomico: vincolo.sourceExcerpt,
      evidenze: [evidenza],
      stato: 'ACTIVE',
    });
    const rule: Rule = creaRule({
      id: `rule-${parametri.regolaEngine.classeCodice}-${vincolo.id}`,
      proposizioneId: proposizione.id,
      vincolo: vincoloCatena,
      dominii: [
        dominioClasseConcorso(parametri.regolaEngine.classeCodice),
        ...(parametri.regolaEngine.classiLaureaAmmesse ?? []).map((classe) =>
          dominioClasseLaurea(classe),
        ),
      ],
      stato: 'ACTIVE',
      nota: `Derivata da ${parametri.regolaEngine.id} (${parametri.regolaEngine.fonte}).`,
    });

    registro.registraProposition(proposizione);
    if (registro.registraRule(rule).registrata) regoleRegistrate.push(rule.id);
  }
  return regoleRegistrate;
}

/* ------------------------------ Regole reali del Core Set ------------------------------ */

const CATALOGO_CORE_SET: ParametriSeminaRegola[] = [
  {
    regolaEngine: REGOLA_A11_LM14,
    rawSourceFilePath: A11_RAW_SOURCE_PATH,
    rawSourceSha256: A11_RAW_SHA256,
    titoloDocumento: REGOLA_A11_LM14.fonte,
  },
  {
    regolaEngine: REGOLA_A12_LM14,
    rawSourceFilePath: A12_RAW_SOURCE_PATH,
    rawSourceSha256: A12_RAW_SHA256,
    titoloDocumento: REGOLA_A12_LM14.fonte,
  },
  {
    regolaEngine: REGOLA_A22_LM14,
    rawSourceFilePath: A22_RAW_SOURCE_PATH,
    rawSourceSha256: A22_RAW_SHA256,
    titoloDocumento: REGOLA_A22_LM14.fonte,
  },
];

/** Semina nel registro fornito le regole A-11 (utile a suite esistenti). */
export function seminaRegoleA11NelRegistro(registro: SourceRegistry): string[] {
  return seminaRegolaNormativaNelRegistro(registro, CATALOGO_CORE_SET[0]!);
}

/** Semina l'intero Core Set A-11 + A-12 + A-22 nel registro fornito. */
export function seminaCatalogoCoreSetNelRegistro(registro: SourceRegistry): string[] {
  const registrate: string[] = [];
  for (const voce of CATALOGO_CORE_SET) {
    registrate.push(...seminaRegolaNormativaNelRegistro(registro, voce));
  }
  return registrate;
}

/**
 * Registro engine di DEFAULT condiviso dal wiring (istanza unica esposta dal
 * modulo di integrazione; nessuno stato globale di libreria).
 */
export const registroEngineDiDefault: SourceRegistry = creaSourceRegistry();

let catalogoSeminato = false;

/** Popola (una sola volta) il registro di default con il Core Set reale. */
export function assicuraCatalogoEngineDiDefault(): { regoleRegistrate: string[] } {
  if (!catalogoSeminato) {
    const regoleRegistrate = seminaCatalogoCoreSetNelRegistro(registroEngineDiDefault);
    catalogoSeminato = true;
    return { regoleRegistrate };
  }
  return { regoleRegistrate: [] };
}


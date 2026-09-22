/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/normativeSources.
 *
 * STAGE 2 — RISOLUZIONE DELLE FONTI NORMATIVE.
 * Riusa il resolver temporale (`engine/normativeResolver`) e il Source Gate v2
 * (`engine/sourceGate`) e restituisce, per ogni regola applicabile, identità,
 * versione, finestra di vigenza dichiarata e stato di verifica della fonte.
 * Nessuna data o regola viene inventata qui.
 */
import type {
  DateRilevanza,
  EsitoRisoluzioneNormativa,
  NormativaApplicata,
  NormativaTemporalContext,
  NormativeRuleEntry,
} from '../types';
import { contestiInVigoreAllaData, contestiNormativi } from '../normativeDatabase';
import { risolviNormativa } from '../normativeResolver';
import { regoleApplicabili } from '../requirementSolver';
import { validaProvenienzaRegola } from '../sourceGate';
import { voceAuditPipeline } from './audit';
import type { RiferimentoFonte, RisoluzioneFonti } from './types';

export interface ParametriRisoluzioneFonti {
  readonly classeCodice: string;
  readonly regole: readonly NormativeRuleEntry[];
  readonly dateRilevanza: DateRilevanza;
  /** Registri di vigenza alternativi (test/mock); default = database autorevole. */
  readonly contestiNormativi?: readonly NormativaTemporalContext[];
  /**
   * Contesto normativo GIÀ RISOLTO dal chiamante (bridge/report): quando
   * presente, la pipeline NON interroga il registro di vigenza e usa questo
   * decreto/tabella (nessuna data inventata, finestra = non dichiarata).
   */
  readonly normativaRisolta?: NormativaApplicata | null;
  readonly ora?: string;
}

function riferimentoDaRegola(
  regola: NormativeRuleEntry,
  finestra: { validFrom: string; validUntil?: string | null } | null,
): RiferimentoFonte {
  const gate = validaProvenienzaRegola(regola);
  return {
    sourceId: regola.id,
    fonte: regola.fonte,
    decreto: regola.decreto,
    tabella: regola.tabella,
    provisione: regola.provisione ?? null,
    articoloTabellaNota: regola.articoloTabellaNota ?? null,
    rawSourceFilePath: regola.rawSourceFilePath ?? null,
    rawSourceSha256: regola.rawSourceSha256 ?? null,
    dataAggiornamentoNormativa: regola.dataAggiornamentoNormativa ?? null,
    effectiveFrom: finestra?.validFrom ?? null,
    effectiveTo: finestra?.validUntil ?? null,
    verificata: gate.valida,
    problemi: gate.problemi,
  };
}

/** Risolve contesto temporale, fonti applicabili e stato del Source Gate. */
export function risolviFontiNormative(parametri: ParametriRisoluzioneFonti): RisoluzioneFonti {
  const contesti = [...(parametri.contestiNormativi ?? contestiNormativi)];
  const dataProcedura =
    parametri.dateRilevanza.procedureDate ?? parametri.dateRilevanza.dataDomanda ?? null;
  const dichiarata = parametri.normativaRisolta ?? null;
  // Contesto dichiarato dal chiamante (bridge): il registro di vigenza NON
  // viene interrogato e nessuna data di vigenza viene inventata.
  const risoluzione: EsitoRisoluzioneNormativa = dichiarata
    ? {
        stato: 'applicabile',
        normativa: dichiarata,
        contesto: null,
        motivazione:
          `Contesto normativo dichiarato dal chiamante: ${dichiarata.decreto} · ` +
          `Tabella ${dichiarata.tabella} (vigenza non risolta dal registro).`,
      }
    : risolviNormativa(parametri.dateRilevanza, contesti);
  const contestiVigore =
    !dichiarata && dataProcedura ? contestiInVigoreAllaData(contesti, dataProcedura) : [];
  const audit = [
    voceAuditPipeline('normative-source', 'info', risoluzione.motivazione, {
      normativa: risoluzione.normativa,
      now: parametri.ora,
    }),
  ];

  if (!risoluzione.normativa) {
    audit.push(
      voceAuditPipeline(
        'normative-source',
        'warning',
        'Nessun contesto normativo utilizzabile: nessuna fonte applicabile e nessun giudizio automatico.',
        { now: parametri.ora },
      ),
    );
    return {
      normativa: null,
      statoTemporale: risoluzione.stato,
      motivazione: risoluzione.motivazione,
      contestoDichiaratoDalChiamante: Boolean(dichiarata),
      finestraVigenza: null,
      fonti: [],
      contestiInVigore: contestiVigore.map((contesto) => contesto.id),
      regoleEscluse: [],
      audit,
    };
  }

  const finestra = risoluzione.contesto
    ? { validFrom: risoluzione.contesto.validFrom, validUntil: risoluzione.contesto.validUntil }
    : null;
  const applicabili = regoleApplicabili(parametri.classeCodice, parametri.regole, risoluzione.normativa);
  const fonti: RiferimentoFonte[] = [];
  const regoleEscluse: { regolaId: string; motivo: string }[] = [];

  for (const regola of applicabili) {
    const riferimento = riferimentoDaRegola(regola, finestra);
    if (!riferimento.verificata) {
      regoleEscluse.push({
        regolaId: regola.id,
        motivo: riferimento.problemi.join(' ') || 'Source Gate v2 non superato.',
      });
      continue;
    }
    fonti.push(riferimento);
    audit.push(
      voceAuditPipeline(
        'normative-source',
        'info',
        `Fonte applicabile ${regola.id}: ${regola.fonte} (vigenza dichiarata: ${
          riferimento.effectiveFrom ?? 'non dichiarata'
        } → ${riferimento.effectiveTo ?? 'in vigore'}).`,
        { normativa: risoluzione.normativa, now: parametri.ora },
      ),
    );
  }

  for (const esclusa of regoleEscluse) {
    audit.push(
      voceAuditPipeline(
        'normative-source',
        'warning',
        `Regola ${esclusa.regolaId} esclusa dal Source Gate v2: ${esclusa.motivo}`,
        { normativa: risoluzione.normativa, now: parametri.ora },
      ),
    );
  }

  return {
    normativa: risoluzione.normativa,
    statoTemporale: risoluzione.stato,
    motivazione: risoluzione.motivazione,
    contestoDichiaratoDalChiamante: Boolean(dichiarata),
    finestraVigenza: finestra
      ? { validFrom: finestra.validFrom, validUntil: finestra.validUntil ?? null }
      : null,
    fonti,
    contestiInVigore: contestiVigore.map((contesto) => contesto.id),
    regoleEscluse,
    audit,
  };
}

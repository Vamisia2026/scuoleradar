/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/pipeline.
 *
 * PIPELINE UNIVERSALE DI VALUTAZIONE DEI REQUISITI — orchestratore.
 *
 *  1. IDENTIFICAZIONE            → classe obiettivo, titolo, date, sistema
 *  2. RISOLUZIONE FONTI          → contesto di vigenza + Source Gate v2
 *  3. NORMALIZZAZIONE            → esami/SSD/CFU + mappature utente↔canonico
 *  4. RISOLUZIONE REQUISITI      → requisiti strutturati (dati, non codice)
 *  5. VALUTAZIONE REQUISITI      → esiti auditabili per requisito
 *  6. ANALISI DEFICIT            → solo se norma stabilita e computabile
 *  7. STATO AGGREGATO            → autorità INTERNA della pipeline (R0-R10)
 *  8. PAYLOAD ASSISTENTE         → sola lettura, non autorevole
 *
 * Confine di autorità (fase 4-5): lo stato calcolato qui (`RisultatoPipeline.stato`)
 * è autorevole DENTRO la pipeline; il verdetto per bridge, routing, report e UI
 * resta quello del decisore aggregato legacy (`statoSolutore`/`valutazioneClasse`).
 * Le divergenze sono dichiarate in `escalations` e verificate dalle suite dedicate.
 */
import type {
  DateRilevanza,
  EsameCanonico,
  NormativaApplicata,
  NormativaTemporalContext,
  NormativeRuleEntry,
  SsdMappingRuleEntry,
  TitoloAccademicoCanonico,
  VoceAudit,
} from '../types';
import { regoleApplicabili, valutaRequisitoClasse } from '../requirementSolver';
import { voceAuditPipeline } from './audit';
import { creaPayloadAssistantCreativo } from './creativePayload';
import { rilevaConflitti } from './conflicts';
import { analizzaDeficit } from './deficit';
import { valutaRequisiti } from './evaluation';
import { identificaContesto } from './identification';
import { normalizzaDatiAccademici } from './normalization';
import { risolviFontiNormative } from './normativeSources';
import { risolviRequisiti } from './requirements';
import {
  REGISTRO_STRATEGIE_DEFAULT,
  type ContestoValutazioneRequisito,
  type RegistroStrategieRequisito,
} from './strategies';
import {
  aggregaStatoRequisiti,
  causaContestoNormativoDa,
  costruisciContestoAggregazione,
  motiviEscalation,
} from './status';
import type { DefinizioneRequisito } from './requirementTypes';
import type { RisultatoPipeline } from '../types';

export interface InputPipelineUniversale {
  readonly classeCodice: string;
  readonly denominazioneClasse?: string | null;
  /** Esami canonici (dal documentParser o da un adapter di dominio). */
  readonly esami: readonly EsameCanonico[];
  readonly titolo?: TitoloAccademicoCanonico | null;
  readonly dateRilevanza?: DateRilevanza;
  /** Regole autorevoli disponibili (database normativo o registro equivalente). */
  readonly regole: readonly NormativeRuleEntry[];
  readonly mappature?: readonly SsdMappingRuleEntry[];
  /** Registri di vigenza alternativi (default: database autorevole). */
  readonly contestiNormativi?: readonly NormativaTemporalContext[];
  /** Contesto normativo già risolto dal chiamante; vince sul registro di vigenza. */
  readonly normativaRisolta?: NormativaApplicata | null;
  /** Catalogo aggiuntivo di requisiti dichiarati (classi configurate via dati). */
  readonly catalogoRequisiti?: readonly DefinizioneRequisito[];
  /** Registro strategie alternativo (default: strategie built-in). */
  readonly registroStrategie?: RegistroStrategieRequisito;
  readonly ora?: string;
}

/** Esegue la pipeline universale su UNA classe di concorso obiettivo. */
export function eseguiPipelineUniversale(input: InputPipelineUniversale): RisultatoPipeline {
  const ora = input.ora ?? new Date().toISOString();
  const auditTrail: VoceAudit[] = [];

  /* 1. IDENTIFICAZIONE */
  const identificazione = identificaContesto({
    classeCodice: input.classeCodice,
    denominazioneClasse: input.denominazioneClasse ?? null,
    titolo: input.titolo ?? null,
    dateRilevanza: input.dateRilevanza,
  });
  const { datiMancanti } = identificazione;
  auditTrail.push(
    voceAuditPipeline(
      'identification',
      datiMancanti.length > 0 ? 'warning' : 'info',
      `Classe ${identificazione.classeCodice} · sistema ${identificazione.sistemaAccademico} · ` + (datiMancanti.length > 0 ? `dati mancanti: ${datiMancanti.join(', ')}` : 'identificazione completa'),
      { now: ora },
    ),
  );

  /* 2. RISOLUZIONE DELLE FONTI NORMATIVE (Source Gate v2 preservato) */
  const fonti = risolviFontiNormative({
    classeCodice: identificazione.classeCodice,
    regole: input.regole,
    dateRilevanza: identificazione.dateRilevanza,
    contestiNormativi: input.contestiNormativi,
    normativaRisolta: input.normativaRisolta,
    ora,
  });
  auditTrail.push(...fonti.audit);

  /* 3. NORMALIZZAZIONE DEI DATI ACCADEMICI */
  const dati = normalizzaDatiAccademici({ esami: input.esami, titolo: input.titolo ?? null });
  auditTrail.push(
    voceAuditPipeline(
      'normalization',
      dati.anomalie.length > 0 ? 'warning' : 'info',
      `${dati.esami.length} esami normalizzati (${dati.cfuTotali} CFU validi)` + (dati.anomalie.length > 0 ? ` · anomalie: ${dati.anomalie.join(' ')}` : ''),
      { normativa: fonti.normativa, now: ora },
    ),
  );

  /* 4. RISOLUZIONE DEI REQUISITI STRUTTURATI */
  // Solo le fonti che SUPERANO il Source Gate v2 possono dichiarare requisiti:
  // `fonti.fonti` contiene esclusivamente le regole verificate.
  const applicabili = fonti.normativa
    ? regoleApplicabili(identificazione.classeCodice, input.regole, fonti.normativa).filter(
        (regola) => fonti.fonti.some((fonte) => fonte.sourceId === regola.id),
      )
    : [];
  const risoluzione = risolviRequisiti({
    classeCodice: identificazione.classeCodice,
    regoleApplicabili: applicabili,
    finestra: fonti.finestraVigenza,
    catalogoRequisiti: input.catalogoRequisiti,
  });
  auditTrail.push(
    voceAuditPipeline(
      'requirement-resolution',
      risoluzione.requisiti.length > 0 ? 'info' : 'warning',
      `${risoluzione.requisiti.length} requisiti strutturati da ${fonti.fonti.length} fonte/i ` +
        `verificata/e (${risoluzione.gruppi.length} chiavi logiche)`,
      { normativa: fonti.normativa, now: ora },
    ),
  );

  const esitoConflitti = rilevaConflitti({
    gruppi: risoluzione.gruppi,
    regoleApplicabili: applicabili,
    contestiInVigore: fonti.contestiInVigore,
    statoTemporale: fonti.statoTemporale,
    ora,
  });
  auditTrail.push(...esitoConflitti.audit);

  /* 5. VALUTAZIONE DEI REQUISITI */
  const contesto: ContestoValutazioneRequisito = {
    esami: dati.esami,
    mappature: input.mappature ?? [],
    provisioni: applicabili.map((regola) => regola.provisione),
    regole: applicabili,
    titolo: dati.titolo,
    now: ora,
    cfuNonValidi: dati.cfuNonValidi,
    codiciMancanti: dati.codiciMancanti,
  };
  const valutazioneRequisiti = valutaRequisiti({
    requisiti: risoluzione.requisiti,
    fonti: fonti.fonti,
    contesto,
    registro: input.registroStrategie ?? REGISTRO_STRATEGIE_DEFAULT,
    ora,
  });
  auditTrail.push(...valutazioneRequisiti.audit);

  /* DECISIONE NORMATIVA AGGREGATA (motore esistente, riusato) */
  const valutazioneClasse = valutaRequisitoClasse(identificazione.classeCodice, [...dati.esami], {
    regole: [...input.regole],
    mappature: [...(input.mappature ?? [])],
    titolo: dati.titolo,
    normativa: fonti.normativa,
    ora,
  });
  auditTrail.push(...valutazioneClasse.audit);

  /* 7. STATO AGGREGATO — AUTORITÀ INTERNA DELLA PIPELINE (R0-R10, vedi status.ts) */
  // Stato calcolato dalla pipeline (requisiti + conflitti + causa del contesto).
  const causaContesto = causaContestoNormativoDa({
    normativaRisolta: fonti.normativa !== null,
    dataProcedura: identificazione.dateRilevanza.procedureDate ?? identificazione.dateRilevanza.dataDomanda ?? null,
  });
  const esitoStato = aggregaStatoRequisiti(costruisciContestoAggregazione({
    requisiti: risoluzione.requisiti,
    valutazioni: valutazioneRequisiti.valutazioni,
    conflitti: esitoConflitti.conflitti,
    regoleApplicabili: applicabili,
    causaContesto,
  }));
  const escalations = motiviEscalation(esitoStato, valutazioneClasse.stato, esitoConflitti.conflitti);
  for (const escalation of escalations) {
    auditTrail.push(voceAuditPipeline('final-status', 'warning', escalation, { normativa: fonti.normativa, now: ora }));
  }
  auditTrail.push(voceAuditPipeline('final-status', 'info', `Stato aggregato: ${esitoStato.stato} (${esitoStato.regola}); decisore legacy: ${valutazioneClasse.stato}.`, { normativa: fonti.normativa, now: ora }));

  /* 6. ANALISI DEL DEFICIT (calcolata solo se stabilita e computabile) */
  const deficit = analizzaDeficit({
    stato: esitoStato.stato,
    cfuMancantiSolutore: Number.isFinite(valutazioneClasse.cfuMancantiTotali)
      ? valutazioneClasse.cfuMancantiTotali
      : null,
    valutazioni: valutazioneRequisiti.valutazioni,
    gruppi: risoluzione.gruppi,
    conflitti: esitoConflitti.conflitti,
  });
  auditTrail.push(
    voceAuditPipeline('deficit', deficit.calcolabile ? 'info' : 'warning', deficit.motivo, {
      normativa: fonti.normativa,
      now: ora,
    }),
  );

  /* 8. PAYLOAD PER L'ASSISTENTE CREATIVO (sola lettura) */
  const payloadAssistantCreativo = creaPayloadAssistantCreativo({
    classeCodice: identificazione.classeCodice,
    denominazioneClasse: identificazione.denominazioneClasse,
    stato: esitoStato.stato,
    deficit,
    fonti: fonti.fonti,
    valutazioni: valutazioneRequisiti.valutazioni,
    conflitti: esitoConflitti.conflitti,
  });
  auditTrail.push(
    voceAuditPipeline('creative-payload', 'info', "Payload di sola lettura per l'Assistente Creativo: nessun potere su esito o deficit.", { normativa: fonti.normativa, now: ora }),
  );

  return {
    classeCodice: identificazione.classeCodice,
    stato: esitoStato.stato,
    statoSolutore: valutazioneClasse.stato,
    escalations,
    identificazione,
    fonti,
    dati,
    requisiti: risoluzione.requisiti,
    valutazioniRequisito: valutazioneRequisiti.valutazioni,
    deficit,
    conflitti: esitoConflitti.conflitti,
    valutazioneClasse,
    auditTrail,
    payloadAssistantCreativo,
  };
}


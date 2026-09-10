/**
 * ScuoleRadar.it — Dipartimento CFU · engine/bridge/legacyAdapter.
 *
 * BRIDGE ADAPTER (backward-compatible) tra il calcolatore LEGACY
 * (`src/departments/cfu/calcolatore`, shapes `Esame`/`EsitoClasse`) e il nuovo
 * motore data-driven (SourceRegistry + RequirementSolver).
 *
 * Il bridge:
 *  - accetta gli input LEGACY (esami con SSD/CFU + classe di concorso target);
 *  - interroga il SourceRegistry per le Rule ATTIVE della classe richiesta;
 *  - traduce ogni Rule registrata in una NormativeRuleEntry dell'engine e
 *    DELEGA somma crediti e validazione vincoli al RequirementSolver
 *    (`valutaRequisitoClasse`) che produce gli stati multi-valore;
 *  - mappa lo stato motore sullo shape legacy `EsitoClasse` (accessibile =
 *    ELIGIBLE, cfuMancanti dai deficit calcolati) arricchendolo con metadati
 *    `isEngineDriven: true`, `esitoMotore`, audit e flag di verifica manuale.
 *
 * SICUREZZA: nessuna eccezione non gestita — se non esistono Rule attive per la
 * classe (o la catena non è interamente ACTIVE) il bridge risponde con uno
 * stato legacy "non accessibile" + `MANUAL_VERIFICATION_REQUIRED`.
 *
 * Nessuna dipendenza esterna; i file del calcolatore legacy NON vengono toccati.
 */
import type {
  ClasseDiConcorso,
  CoperturaAmbito,
  Esame,
  EsitoClasse,
} from '../../shared/types';
import type {
  EsameCanonico,
  EsitoValutazione,
  NormativaApplicata,
  NormativeRuleEntry,
  TitoloAccademicoCanonico,
  VincoloCfu,
  VoceAudit,
} from '../types';
import { valutaRequisitoClasse } from '../requirementSolver';
import type { Rule, Source } from '../traceability/traceabilityChain';
import type { SourceRegistry } from '../traceability/sourceRegistry';

/* ------------------------------ Shape di output (legacy + metadati) ------------------------------ */

/** Esito compatibile con `EsitoClasse` legacy, arricchito dai metadati engine. */
export interface EsitoClasseAdapter extends EsitoClasse {
  /** Sempre true: il risultato è stato prodotto dal motore data-driven. */
  readonly isEngineDriven: true;
  /** Stato multi-valore del motore (ELIGIBLE / CONDITIONALLY_ELIGIBLE / …). */
  readonly esitoMotore: EsitoValutazione;
  /** True quando serve verifica manuale prima di un giudizio automatico. */
  readonly verificaManualeRichiesta: boolean;
  /** Id delle Rule registrate che hanno sostenuto la valutazione. */
  readonly regoleApplicate: readonly string[];
  readonly audit: readonly VoceAudit[];
  readonly motivazione: string;
  /** Presente SOLO nel fallback (nessuna regola attiva / contesto assente). */
  readonly motivoFallback?: string;
}

/** Input legacy della facciata bridge. */
export interface ParametriValutazioneBridge {
  /** Esami in shape legacy (denominazione, CFU, SSD). */
  readonly esami: readonly Esame[];
  /** Classe di concorso target (es. "A-11"). */
  readonly classeCodice: string;
  /** Registro data-driven attivo da interrogare. */
  readonly registry: SourceRegistry;
  /** Etichetta legacy della classe per `classe.denominazione` (UI). */
  readonly denominazioneClasse?: string;
  readonly tabella?: 'A' | 'B';
  /** Contesto normativo (decreto/tabella) richiesto dal solver. */
  readonly normativa: NormativaApplicata;
  /** Classe di laurea del titolo (es. "LM-14") per il check classi ammesse. */
  readonly classeLaureaTitolo?: string;
  readonly ora?: string;
}

/* ------------------------------ Conversioni pure (legacy ↔ engine) ------------------------------ */

/** Converte un esame legacy in un esame canonico dell'engine (nessuna mutazione). */
export function esameLegacyInCanonico(esame: Esame): EsameCanonico {
  return {
    id: esame.id,
    denominazione: esame.denominazione,
    cfu: esame.cfu,
    ssd: esame.ssd ? esame.ssd.trim().toUpperCase() : null,
    ssdOrigine: esame.ssd ?? null,
    voto: esame.voto ?? null,
    anno: esame.annoAccademico ?? null,
    fonte:
      esame.fonte === 'documento'
        ? 'ocr-documento'
        : esame.fonte === 'testo-incollato'
          ? 'testo-incollato'
          : 'manuale',
    affidabilita: esame.affidabilita ?? 'alta',
    provenienza: [],
  };
}

export function esamiLegacyInCanonici(esami: readonly Esame[]): EsameCanonico[] {
  return esami.map(esameLegacyInCanonico);
}

function classeLegacy(
  codice: string,
  denominazione: string,
  tabella: 'A' | 'B',
): ClasseDiConcorso {
  // I requisiti/coperture legacy per "ambito" non sono più usati: il motore
  // valuta vincoli SSD-level. Array vuoti mantengono lo shape della UI legacy.
  return {
    codice,
    denominazione,
    tabella,
    ordineScuola: 'secondaria-2-grado',
    requisiti: [],
    requisitiDemo: false,
  };
}

/** Localizzazione leggibile di un'Evidence per `sourceLocation` dei vincoli. */
function fonteLocation(evidenceCoordinate: {
  readonly pagina?: number;
  readonly riga?: number;
  readonly paragrafo?: number;
}): string {
  const parti: string[] = [];
  if (evidenceCoordinate.pagina !== undefined) parti.push(`pag. ${evidenceCoordinate.pagina}`);
  if (evidenceCoordinate.riga !== undefined) parti.push(`riga ${evidenceCoordinate.riga}`);
  if (evidenceCoordinate.paragrafo !== undefined) {
    parti.push(`par. ${evidenceCoordinate.paragrafo}`);
  }
  return parti.length > 0 ? `fonte primaria — ${parti.join(', ')}` : 'fonte primaria';
}

function fraseDisgiunzioneEsplicita(rule: Rule): string {
  const opzioni = rule.vincolo.tipo === 'disgiunzioneMinCfu' ? rule.vincolo.opzioni : [];
  return opzioni
    .map((opzione) => `${opzione.minCfu} CFU in ${opzione.ssd.join(' AND ')}`)
    .join(' | OR | ');
}

/**
 * Traduce UNA Rule registrata in una NormativeRuleEntry per il solver.
 * Ritorna null se la catena (proposition/evidence/source) non è ricostruibile
 * o non è dichiarata per la classe richiesta.
 */
export function traduciRuleRegistro(
  rule: Rule,
  registry: SourceRegistry,
  parametri: {
    classeCodice: string;
    denominazioneClasse?: string;
    normativa: NormativaApplicata;
  },
): NormativeRuleEntry | null {
  const proposizione = registry.getProposition(rule.proposizioneId);
  if (!proposizione || proposizione.evidenze.length === 0) return null;

  const estratti = proposizione.evidenze.map((evidenza) => evidenza.testo.trim());
  if (estratti.length === 0) return null;
  const estrattoVerbatim = estratti.join('\n');

  const primaEvidence = proposizione.evidenze[0];
  const fonte: Source | undefined = primaEvidence
    ? registry.getSource(primaEvidence.sourceHash)
    : undefined;
  const sourceExcerpt = estratti[0] ?? estrattoVerbatim;
  const sourceLocation = fonteLocation(primaEvidence?.coordinate ?? {});

  const base = {
    id: rule.id,
    rawSourceFilePath:
      fonte?.rawFilePath ?? `sources/raw/bridge-dynamic-${rule.id}.txt`,
    rawSourceSha256: fonte?.hash ?? primaEvidence?.sourceHash ?? '',
    estrattoVerbatim,
    sourceStatus: 'VERIFIED' as const,
    provisione: `Bridge registry → classe ${parametri.classeCodice}`,
    articoloTabellaNota: fonte?.pubblicazione.articoloNota,
    decreto: parametri.normativa.decreto,
    tabella: parametri.normativa.tabella,
    classeCodice: parametri.classeCodice,
    denominazioneClasse: parametri.denominazioneClasse,
    classiLaureaAmmesse: rule.dominii
      ?.filter((dominio) => dominio.tipo === 'classeLaurea')
      .map((dominio) => dominio.codice),
    fonte:
      fonte?.titolo ??
      `Regola dinamica ${rule.id} (SourceRegistry, nessun riferimento documentale)`,
    dataAggiornamentoNormativa: parametri.normativa.dataAggiornamentoNormativa,
    nota: rule.nota,
  };

  const vincolo = rule.vincolo;
  let vincoli: VincoloCfu[];
  if (vincolo.tipo === 'singoloSsdMinCfu') {
    vincoli = [
      {
        id: `${rule.id}:vincolo`,
        tipo: 'singoloSsd',
        ssd: vincolo.ssd,
        min: vincolo.minCfu,
        nota: rule.formula,
        sourceExcerpt,
        sourceLocation,
      },
    ];
  } else if (vincolo.tipo === 'gruppoSsdMinCfu') {
    vincoli = [
      {
        id: `${rule.id}:vincolo`,
        tipo: 'gruppoSsd',
        ssd: [...vincolo.ssd],
        min: vincolo.minCfu,
        sourceExcerpt,
        sourceLocation,
      },
    ];
  } else {
    vincoli = [
      {
        id: `${rule.id}:vincolo`,
        tipo: 'disgiunzioneSsd',
        opzioni: vincolo.opzioni.map((opzione) => ({
          id: `${rule.id}:${opzione.id}`,
          ssd: [...opzione.ssd],
          min: opzione.minCfu,
        })),
        disgiunzioneEsplicita: fraseDisgiunzioneEsplicita(rule),
        sourceExcerpt,
        sourceLocation,
      },
    ];
  }

  return { ...base, vincoli } as NormativeRuleEntry;
}


/* ------------------------------ Facciata bridge ------------------------------ */

/** Costruisce una risposta legacy-shaped dal risultato del motore. */
export function mappaEsitoLegacy(
  parametri: {
    classeCodice: string;
    denominazioneClasse: string;
    tabella: 'A' | 'B';
    statoMotore: EsitoValutazione;
    cfuMancanti: number;
    regoleApplicate: readonly string[];
    audit: readonly VoceAudit[];
    motivazione: string;
    motivoFallback?: string;
  },
): EsitoClasseAdapter {
  const accessibile = parametri.statoMotore === 'ELIGIBLE';
  return {
    classe: classeLegacy(
      parametri.classeCodice,
      parametri.denominazioneClasse,
      parametri.tabella,
    ),
    coperture: [] as CoperturaAmbito[],
    cfuMancanti: accessibile ? 0 : parametri.cfuMancanti,
    accessibile,
    isEngineDriven: true,
    esitoMotore: parametri.statoMotore,
    verificaManualeRichiesta: parametri.statoMotore === 'MANUAL_VERIFICATION_REQUIRED',
    regoleApplicate: parametri.regoleApplicate,
    audit: parametri.audit,
    motivazione: parametri.motivazione,
    motivoFallback: parametri.motivoFallback,
  };
}

/** Risposta di fallback: nessuna regola attiva / contesto mancante (mai throw). */
export function rispostaFallbackBridge(
  parametri: {
    classeCodice: string;
    denominazioneClasse: string;
    tabella: 'A' | 'B';
    motivo: string;
  },
): EsitoClasseAdapter {
  return mappaEsitoLegacy({
    ...parametri,
    statoMotore: 'MANUAL_VERIFICATION_REQUIRED',
    cfuMancanti: 0,
    regoleApplicate: [],
    audit: [],
    motivazione: parametri.motivo,
    motivoFallback: parametri.motivo,
  });
}

/**
 * Facciata principale: valuta una carriera legacy (esami) per una classe di
 * concorso delegando a SourceRegistry + RequirementSolver e restituendo uno
 * shape legacy-compatibile (EsitoClasse + metadati `isEngineDriven: true`).
 */
export function valutaClasseViaEngineBridge(
  parametri: ParametriValutazioneBridge,
): EsitoClasseAdapter {
  const denominazione = parametri.denominazioneClasse ?? parametri.classeCodice;
  const tabella = parametri.tabella ?? 'A';

  try {
    const esitoRegistry = parametri.registry.cercaPerClasseConcorso(parametri.classeCodice);
    const regoleAttive = esitoRegistry.regoleAttive;
    if (esitoRegistry.totaleRegoleTrovate === 0 || regoleAttive.length === 0) {
      const motivo =
        esitoRegistry.totaleRegoleTrovate === 0
          ? `Nessuna regola data-driven attiva per la classe ${parametri.classeCodice}: la valutazione richiede verifica manuale.`
          : `La classe ${parametri.classeCodice} ha solo regole non ancora attive (PROPOSED/UNCERTAIN o catena incompleta): verifica manuale richiesta.`;
      return rispostaFallbackBridge({
        classeCodice: parametri.classeCodice,
        denominazioneClasse: denominazione,
        tabella,
        motivo,
      });
    }

    // Traduzione Rule registrate → regole del RequirementSolver.
    const regoleEngine: NormativeRuleEntry[] = [];
    for (const regola of regoleAttive) {
      const tradotta = traduciRuleRegistro(regola, parametri.registry, {
        classeCodice: parametri.classeCodice,
        denominazioneClasse: denominazione,
        normativa: parametri.normativa,
      });
      if (tradotta) regoleEngine.push(tradotta);
    }
    if (regoleEngine.length === 0) {
      return rispostaFallbackBridge({
        classeCodice: parametri.classeCodice,
        denominazioneClasse: denominazione,
        tabella,
        motivo: `Le regole attive di ${parametri.classeCodice} non sono traducibili in vincoli engine: verifica manuale richiesta.`,
      });
    }

    const titolo: TitoloAccademicoCanonico = {
      denominazione: 'Carriera valutata via Bridge Adapter',
      classe: parametri.classeLaureaTitolo ?? null,
      classeLegacy: null,
      paese: null,
      titoloEstero: false,
    };

    // DELEGA al RequirementSolver: somma crediti + validazione vincoli + audit.
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
        valutazione.motivazione ??
        `Valutazione motore per la classe ${parametri.classeCodice}.`,
    });
  } catch (errore) {
    // Mai propagare errori non gestiti: il bridge degrada a MANUAL.
    return rispostaFallbackBridge({
      classeCodice: parametri.classeCodice,
      denominazioneClasse: denominazione,
      tabella,
      motivo: `Errore imprevisto durante la valutazione bridge: ${String(errore)} — verifica manuale richiesta.`,
    });
  }
}


/**
 * ScuoleRadar.it — Dipartimento CFU · engine/traceability/sourceRegistry.
 *
 * SOURCE REGISTRY — registro in-memory DINAMICO della catena di tracciabilità.
 *
 * Il registro permette di INGERIRE nuove Source/Proposition/Relation/Rule a
 * runtime, senza toccare codice applicativo e senza alcun condizionale
 * normativo hardcoded (niente `if (legge === "...")`): la selezione è sempre
 * guidata dai metadati strutturati delle entità (stato + dominii).
 *
 *  - zero dipendenze: nessun filesystem, nessun database, nessuna rete;
 *  - strutture JSON-serializzabili e immutabili (modello traceabilityChain);
 *  - lookup per dominio di valutazione (classe di concorso / classe di laurea /
 *    ambito disciplinare);
 *  - FALLBACK DI SICUREZZA: qualsiasi Rule/Proposition/Evidence/Source con
 *    stato 'UNCERTAIN' o 'PROPOSED' (o con catena mancante) NON viene mai
 *    restituita come attiva: il lookup segnala MANUAL_VERIFICATION_REQUIRED
 *    senza MAI lanciare eccezioni.
 */
import type {
  DominioValutazione,
  Proposition,
  Relation,
  Rule,
  Source,
  StatoCatena,
} from './traceabilityChain';

export interface ConteggiRegistro {
  readonly fonti: number;
  readonly proposizioni: number;
  readonly relazioni: number;
  readonly regole: number;
}

export type EsitoRegistrazione =
  | { readonly registrata: true }
  | { readonly registrata: false; readonly motivo: 'gia-presente' | 'entita-non-valida' };

/** Catalogo di ingresso batch per il caricamento dinamico. */
export interface CatalogoIngresso {
  readonly fonti?: readonly Source[];
  readonly proposizioni?: readonly Proposition[];
  readonly relazioni?: readonly Relation[];
  readonly regole?: readonly Rule[];
}

/** Problema che impedisce a una Rule di essere considerata ATTIVA. */
export interface ProblemaAttivazioneRegola {
  readonly ruleId: string;
  /** Descrizione pura del problema (stato o anello mancante della catena). */
  readonly motivo: string;
}

/** Esito del lookup di una Rule per un dominio di valutazione. */
export interface EsitoRegolePerDominio {
  readonly dominio: DominioValutazione;
  /** Regole pienamente attive (intera catena ACTIVE). */
  readonly regoleAttive: readonly Rule[];
  /** Problemi riscontrati sulle regole trovate ma non attivabili. */
  readonly incertezze: readonly ProblemaAttivazioneRegola[];
  /** True se serve verifica manuale prima di ogni giudizio automatico. */
  readonly verificaManualeRichiesta: boolean;
  readonly totaleRegoleTrovate: number;
}

export interface EsitoAnalisiRegola {
  readonly trovata: boolean;
  readonly attiva: boolean;
  readonly problemi: readonly string[];
}

/** Stato "attivabile" della catena: solo ACTIVE è automaticamente utilizzabile. */
export function statoAttivo(stato: StatoCatena): boolean {
  return stato === 'ACTIVE';
}

/** True se una Rule dichiara il dominio di valutazione richiesto. */
export function regolaCopreDominio(regola: Rule, dominio: DominioValutazione): boolean {
  return (regola.dominii ?? []).some(
    (d) => d.tipo === dominio.tipo && d.codice === dominio.codice,
  );
}

/**
 * Diagnosi PURA (mai eccezioni) della catena di una Rule:
 * Rule → Proposition → Evidence → Source. Restituisce i problemi che ne
 * impediscono l'attivazione (stati UNCERTAIN/PROPOSED o anelli mancanti).
 */
export function problemiAttivazioneRegola(
  regola: Rule,
  proposizioni: ReadonlyMap<string, Proposition>,
  fonti: ReadonlyMap<string, Source>,
): readonly string[] {
  const problemi: string[] = [];
  if (!statoAttivo(regola.stato)) {
    problemi.push(`Rule "${regola.id}" con stato ${regola.stato}.`);
  }
  const proposizione = proposizioni.get(regola.proposizioneId);
  if (!proposizione) {
    problemi.push(
      `Rule "${regola.id}": Proposition "${regola.proposizioneId}" non registrata.`,
    );
    return problemi;
  }
  if (!statoAttivo(proposizione.stato)) {
    problemi.push(`Proposition "${proposizione.id}" con stato ${proposizione.stato}.`);
  }
  if (proposizione.evidenze.length === 0) {
    problemi.push(`Proposition "${proposizione.id}" senza Evidence di supporto.`);
  }
  for (const evidenza of proposizione.evidenze) {
    if (!statoAttivo(evidenza.stato)) {
      problemi.push(`Evidence "${evidenza.id}" con stato ${evidenza.stato}.`);
    }
    const fonte = fonti.get(evidenza.sourceHash);
    if (!fonte) {
      problemi.push(
        `Evidence "${evidenza.id}": Source "${evidenza.sourceHash}" non registrata.`,
      );
    } else if (!statoAttivo(fonte.stato)) {
      problemi.push(`Source "${evidenza.sourceHash}" con stato ${fonte.stato}.`);
    }
  }
  return problemi;
}

/**
 * Registro in-memory della catena. Ogni istanza è indipendente (nessuno stato
 * globale): i test e le applicazioni possono crearne quante servono.
 */
export class SourceRegistry {
  private readonly fonti = new Map<string, Source>();
  private readonly proposizioni = new Map<string, Proposition>();
  private readonly relazioni = new Map<string, Relation>();
  private readonly regole = new Map<string, Rule>();

  /* ------------------------------ Registrazione dinamica ------------------------------ */

  registraSource(source: Source): EsitoRegistrazione {
    if (!source?.hash) return { registrata: false, motivo: 'entita-non-valida' };
    if (this.fonti.has(source.hash)) return { registrata: false, motivo: 'gia-presente' };
    this.fonti.set(source.hash, source);
    return { registrata: true };
  }

  registraProposition(proposizione: Proposition): EsitoRegistrazione {
    if (!proposizione?.id) return { registrata: false, motivo: 'entita-non-valida' };
    if (this.proposizioni.has(proposizione.id)) {
      return { registrata: false, motivo: 'gia-presente' };
    }
    this.proposizioni.set(proposizione.id, proposizione);
    return { registrata: true };
  }

  registraRelation(relazione: Relation): EsitoRegistrazione {
    if (!relazione?.id) return { registrata: false, motivo: 'entita-non-valida' };
    if (this.relazioni.has(relazione.id)) return { registrata: false, motivo: 'gia-presente' };
    this.relazioni.set(relazione.id, relazione);
    return { registrata: true };
  }

  registraRule(regola: Rule): EsitoRegistrazione {
    if (!regola?.id || !regola.proposizioneId) {
      return { registrata: false, motivo: 'entita-non-valida' };
    }
    if (this.regole.has(regola.id)) return { registrata: false, motivo: 'gia-presente' };
    this.regole.set(regola.id, regola);
    return { registrata: true };
  }

  /** Ingestione batch (senza eccezioni: le entità duplicate/non valide sono scartate). */
  registraCatalogo(catalogo: CatalogoIngresso): ConteggiRegistro {
    let fonti = 0;
    let proposizioni = 0;
    let relazioni = 0;
    let regole = 0;
    for (const fonte of catalogo.fonti ?? []) if (this.registraSource(fonte).registrata) fonti += 1;
    for (const proposizione of catalogo.proposizioni ?? []) {
      if (this.registraProposition(proposizione).registrata) proposizioni += 1;
    }
    for (const relazione of catalogo.relazioni ?? []) {
      if (this.registraRelation(relazione).registrata) relazioni += 1;
    }
    for (const regola of catalogo.regole ?? []) if (this.registraRule(regola).registrata) regole += 1;
    return { fonti, proposizioni, relazioni, regole };
  }

  /* ------------------------------ Lettura ------------------------------ */

  getSource(hash: string): Source | undefined {
    return this.fonti.get(hash);
  }

  getProposition(id: string): Proposition | undefined {
    return this.proposizioni.get(id);
  }

  getRelation(id: string): Relation | undefined {
    return this.relazioni.get(id);
  }

  getRule(id: string): Rule | undefined {
    return this.regole.get(id);
  }

  tutteLeRegole(): readonly Rule[] {
    return [...this.regole.values()];
  }

  conteggi(): ConteggiRegistro {
    return {
      fonti: this.fonti.size,
      proposizioni: this.proposizioni.size,
      relazioni: this.relazioni.size,
      regole: this.regole.size,
    };
  }

  /* ------------------------------ Lookup per dominio ------------------------------ */

  /** Analizza la catena di una Rule già registrata (mai eccezioni). */
  analizzaRegola(id: string): EsitoAnalisiRegola {
    const regola = this.regole.get(id);
    if (!regola) return { trovata: false, attiva: false, problemi: [] };
    const problemi = problemiAttivazioneRegola(regola, this.proposizioni, this.fonti);
    return { trovata: true, attiva: problemi.length === 0, problemi };
  }

  /**
   * Recupera le Rule ATTIVE dichiarate per un dominio di valutazione.
   * Regole/stati incerti (UNCERTAIN/PROPOSED) o con catena mancante NON sono
   * mai esposte come attive: compaiono in `incertezze` e il flag
   * `verificaManualeRichiesta` viene alzato (fallback di sicurezza).
   */
  cercaPerDominio(dominio: DominioValutazione): EsitoRegolePerDominio {
    const trovate = this.tutteLeRegole().filter((regola) => regolaCopreDominio(regola, dominio));
    const regoleAttive: Rule[] = [];
    const incertezze: ProblemaAttivazioneRegola[] = [];
    for (const regola of trovate) {
      const problemi = problemiAttivazioneRegola(regola, this.proposizioni, this.fonti);
      if (problemi.length === 0) {
        regoleAttive.push(regola);
      } else {
        incertezze.push({ ruleId: regola.id, motivo: problemi.join(' ') });
      }
    }
    return {
      dominio,
      regoleAttive,
      incertezze,
      verificaManualeRichiesta: incertezze.length > 0,
      totaleRegoleTrovate: trovate.length,
    };
  }

  /** Lookup per classe di concorso (es. "A-11"). */
  cercaPerClasseConcorso(codice: string): EsitoRegolePerDominio {
    return this.cercaPerDominio({ tipo: 'classeConcorso', codice });
  }

  /** Lookup per classe di laurea (es. "LM-14"). */
  cercaPerClasseLaurea(codice: string): EsitoRegolePerDominio {
    return this.cercaPerDominio({ tipo: 'classeLaurea', codice });
  }

  /** Lookup per ambito disciplinare. */
  cercaPerAmbitoDisciplinare(codice: string): EsitoRegolePerDominio {
    return this.cercaPerDominio({ tipo: 'ambitoDisciplinare', codice });
  }
}

/** Crea un SourceRegistry vuoto (nessuno stato globale condiviso). */
export function creaSourceRegistry(): SourceRegistry {
  return new SourceRegistry();
}


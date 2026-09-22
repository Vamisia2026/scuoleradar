/**
 * ScuoleRadar.it — Dipartimento CFU · calcolatore/classi.
 *
 * CLASSI DI CONCORSO COPERTE DALLA V1.
 *
 * La V1 propone SOLO le classi per cui esistono regole normative reali nel
 * SourceRegistry (DM 22/12/2023 — G.U. N. 34 del 10/02/2024 — Tabella A).
 * Denominazione, tabella e classi di laurea ammesse vengono dalle regole
 * stesse: qui non si duplica né si inventa alcun requisito.
 *
 * Nessuna classe viene aggiunta "per completezza": se manca la fonte, la classe
 * non è verificabile e non viene offerta.
 */
import { REGOLA_A11_LM14 } from '../engine/sources/dm22122023_A11';
import {
  REGOLA_A12_LM14,
  REGOLA_A22_LM14,
} from '../engine/sources/dm22122023_A12_A22_LM14';
import {
  assicuraCatalogoEngineDiDefault,
  registroEngineDiDefault,
} from '../engine/seeds/progressiveRegistry';
import type { NormativeRuleEntry, TabellaNormativa } from '../engine/types';

/** Classe di concorso con copertura normativa dichiarata. */
export interface ClasseCoperta {
  readonly codice: string;
  readonly denominazione: string;
  readonly tabella: TabellaNormativa;
  /** Classi di laurea ammesse SECONDO la fonte (es. LM-14). */
  readonly classiLaureaAmmesse: readonly string[];
  /** Riferimento della fonte autorevole (decreto · G.U. · tabella). */
  readonly fonte: string;
}

/** Regole del Core Set seminato: l'unica copertura normativa della V1. */
const REGOLE_COPERTE: readonly NormativeRuleEntry[] = [
  REGOLA_A11_LM14,
  REGOLA_A12_LM14,
  REGOLA_A22_LM14,
];

function daRegola(regola: NormativeRuleEntry): ClasseCoperta {
  return {
    codice: regola.classeCodice,
    denominazione: regola.denominazioneClasse ?? regola.classeCodice,
    tabella: regola.tabella,
    classiLaureaAmmesse: [...(regola.classiLaureaAmmesse ?? [])],
    fonte: regola.fonte,
  };
}

/** Tutte le classi con una regola dichiarata nel Core Set. */
export function classiCoperte(): ClasseCoperta[] {
  return REGOLE_COPERTE.map(daRegola);
}

/**
 * Classi realmente valutabili ORA: la regola deve risultare ATTIVA nel registro
 * condiviso. Se una regola non è attiva, la classe non viene proposta.
 */
export function classiCoperteAttive(): ClasseCoperta[] {
  assicuraCatalogoEngineDiDefault();
  return classiCoperte().filter(
    (classe) =>
      registroEngineDiDefault.cercaPerClasseConcorso(classe.codice).regoleAttive.length > 0,
  );
}

/** Classe coperta per codice (null se la V1 non la copre). */
export function classeCoperta(codice: string): ClasseCoperta | null {
  return classiCoperteAttive().find((classe) => classe.codice === codice) ?? null;
}

/** Nota di copertura da mostrare in UI: onesta e verificabile. */
export function notaCoperturaV1(): string {
  const classi = classiCoperteAttive();
  const elenco = classi.map((classe) => classe.codice).join(', ');
  const fonte = classi[0]?.fonte ?? '';
  return (
    `Questa versione verifica le classi ${elenco} (${fonte}). ` +
    'Le altre classi di concorso non hanno ancora una copertura normativa verificata: non vengono proposte per non darti risposte non controllate.'
  );
}

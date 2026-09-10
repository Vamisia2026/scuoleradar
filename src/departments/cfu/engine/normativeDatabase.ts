/**
 * ScuoleRadar.it — Dipartimento CFU · engine/normativeDatabase.
 *
 * DATABASE NORMATIVO AUTOREVOLE (authoritative).
 *
 * Vincoli di sicurezza:
 *  - il motore NON inventa regole: ogni conclusione positiva deve risalire a
 *    una regola presente qui;
 *  - i registri nascono VUOTI e vengono popolati esclusivamente dagli import
 *    dei decreti ufficiali (D.P.R. 19/2016, DM 259/2017, DM 639/2024,
 *    corrispondenze GSD, tabelle di classe di laurea);
 *  - se una regola/mappatura/disposizione transitoria manca o è ambigua, i
 *    moduli a valle devono restituire MANUAL_VERIFICATION_REQUIRED oppure
 *    INSUFFICIENT_DATA, MAI approssimare.
 */
import type {
  LegacyTitleMappingEntry,
  NormativaTemporalContext,
  NormativeRuleEntry,
  SsdMappingRuleEntry,
} from './types';
import { validaProvenienzaRegola, verificaFileRaw } from './sourceGate';

/* ------------------------------ Registri ufficiali ------------------------------ */

/** Finestre di vigenza decreto/tabella (autorevole). */
export const contestiNormativi: NormativaTemporalContext[] = [];

/** Regole requisito per classe (autorevole). */
export const regoleRequisiti: NormativeRuleEntry[] = [];

/** Mappature SSD storico / GSD 2024 dichiarate (autorevole). */
export const regoleMappaturaSsd: SsdMappingRuleEntry[] = [];

/** Corrispondenze di classe di laurea (vecchio ordinamento) dichiarate. */
export const regoleMappaturaTitoli: LegacyTitleMappingEntry[] = [];

/* ------------------------------ Loader (solo import ufficiale) ------------------------------ */

/** Popola i registri autorevoli (chiamabile SOLO da script di import dei decreti). */
export function caricaContestiNormativi(voci: NormativaTemporalContext[]): void {
  contestiNormativi.push(...voci);
}

export interface EsitoCaricamentoRegole {
  registrate: string[];
  rifiutate: { id: string; motivo: string }[];
}

/**
 * Registra le regole nel database ATTIVO, applicando il Source Gate in modo
 * GRACEFUL (mai eccezioni): le regole UNVERIFIED / senza fonte / con hash
 * errato vengono rifiutate e semplicemente escluse.
 *
 * @param rawTexts mappa facoltativa pathRaw → contenuto del file (ambiente
 *                 Node/test) per la verifica file-level parola-per-parola.
 */
export async function caricaRegoleRequisiti(
  regole: NormativeRuleEntry[],
  rawTexts?: Record<string, string>,
): Promise<EsitoCaricamentoRegole> {
  const registrate: string[] = [];
  const rifiutate: { id: string; motivo: string }[] = [];

  for (const regola of regole) {
    if (regoleRequisiti.some((esistente) => esistente.id === regola.id)) continue;

    const gate = validaProvenienzaRegola(regola);
    if (!gate.valida) {
      rifiutate.push({ id: regola.id, motivo: gate.problemi.join(' ') });
      continue;
    }

    if (rawTexts) {
      const testoFile = rawTexts[regola.rawSourceFilePath];
      if (!testoFile) {
        rifiutate.push({
          id: regola.id,
          motivo: 'file raw non fornito alla registrazione (verifica SHA-256 impossibile).',
        });
        continue;
      }
      const verifica = await verificaFileRaw(regola, testoFile);
      if (verifica.stato !== 'verificata') {
        rifiutate.push({ id: regola.id, motivo: verifica.motivo });
        continue;
      }
    }

    regoleRequisiti.push(regola);
    registrate.push(regola.id);
  }

  return { registrate, rifiutate };
}

export function caricaRegoleMappaturaSsd(regole: SsdMappingRuleEntry[]): void {
  regoleMappaturaSsd.push(...regole);
}

export function caricaRegoleMappaturaTitoli(regole: LegacyTitleMappingEntry[]): void {
  regoleMappaturaTitoli.push(...regole);
}

/* ------------------------------ Lookup (senza fallback) ------------------------------ */

/** Restituisce i contesti in vigore alla data (0 = non risolto; >1 = ambiguità). */
export function trovaContestiPerData(dataISO: string): NormativaTemporalContext[] {
  const data = new Date(dataISO).getTime();
  return contestiNormativi.filter(
    (contesto) =>
      new Date(contesto.validFrom).getTime() <= data &&
      (!contesto.validUntil || new Date(contesto.validUntil).getTime() >= data),
  );
}

/** Regole requisito per classe; opzionalmente filtrate per decreto/tabella. */
export function trovaRegolePerClasse(
  codiceClasse: string,
  filtro?: { decreto?: string; tabella?: string },
): NormativeRuleEntry[] {
  return regoleRequisiti.filter(
    (regola) =>
      regola.classeCodice === codiceClasse &&
      (!filtro?.decreto || regola.decreto === filtro.decreto) &&
      (!filtro?.tabella || regola.tabella === filtro.tabella),
  );
}

/** Regola requisito per id (es. per verificare la traceability nel report). */
export function trovaRegolaPerId(id: string): NormativeRuleEntry | undefined {
  return regoleRequisiti.find((regola) => regola.id === id);
}

/**
 * Mappature dichiarate per un codice sorgente. La mappatura è utilizzabile in
 * valutazione SOLO se `applicabileAProvisioni` include la provisione valutata.
 */
export function trovaMappatureDaCodice(codice: string): SsdMappingRuleEntry[] {
  return regoleMappaturaSsd.filter((regola) => regola.da === codice);
}

/** Mappature di classe di laurea per denominazione (solo dichiarate). */
export function trovaMappatureTitolo(denominazione: string): LegacyTitleMappingEntry[] {
  return regoleMappaturaTitoli.filter((regola) =>
    regola.denominazioneContiene
      ? denominazione.toLocaleLowerCase('it-IT').includes(
          regola.denominazioneContiene.toLocaleLowerCase('it-IT'),
        )
      : false,
  );
}

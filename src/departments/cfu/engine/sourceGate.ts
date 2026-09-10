/**
 * ScuoleRadar.it — Dipartimento CFU · engine/sourceGate.
 *
 * SOURCE GATE v2 — SHA-256 FILE INTEGRITY & ATOMIC TRACEABILITY.
 *
 * Regole valide:
 *  - `sourceStatus: 'VERIFIED'`;
 *  - `rawSourceFilePath` in `sources/raw/`;
 *  - `estrattoVerbatim` non vuoto;
 *  - `rawSourceSha256` = SHA-256 (esadecimale) dell'INTERO file raw;
 *  - ogni `VincoloCfu.sourceExcerpt` è presente nell'estratto (e nel file);
 *  - ogni vincolo ha `sourceLocation` esplicita.
 *
 * Il gate NON lancia eccezioni: regole non verificate/corrotte vengono escluse
 * e il motore risponde INSUFFICIENT_DATA / MANUAL_VERIFICATION_REQUIRED.
 */
import type { NormativeRuleEntry, VincoloCfu } from './types';

/** Percorso radice consentito per i file raw. */
export const RAW_SOURCES_PREFIX = 'sources/raw/';

/**
 * SHA-256 esadecimale via NODE NATIVE crypto.createHash('sha256'), calcolato
 * sull'intero contenuto del file raw. Il modulo `node:crypto` viene caricato
 * dinamicamente SOLO in ambiente Node (mai nel browser).
 */
async function sha256ConNode(testo: string): Promise<string> {
  // Nome del modulo via variabile: mai risolto dal bundler client (browser).
  const nomeModuloCrypto = 'node:crypto';
  const crypto = (await import(nomeModuloCrypto)) as {
    createHash: (algoritmo: string) => {
      update(dati: string, encoding?: string): { digest(formato: 'hex'): string };
    };
  };
  return crypto.createHash('sha256').update(testo, 'utf8').digest('hex');
}

/** SHA-256 esadecimale dell'intero contenuto (file raw). */
export async function sha256Hex(testo: string): Promise<string> {
  if (typeof window === 'undefined') {
    try {
      return await sha256ConNode(testo);
    } catch {
      // ambiente Node senza node:crypto accessibile: fallback WebCrypto
    }
  }

  const dati = new TextEncoder().encode(testo);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', dati);
  let esadecimale = '';
  for (const valore of new Uint8Array(digest)) {
    esadecimale += valore.toString(16).padStart(2, '0');
  }
  return esadecimale;
}

export interface EsitoValidazioneFonte {
  valida: boolean;
  problemi: string[];
}

/** Ogni vincolo atomico deve avere excerpt+location e citazione nell'estratto. */
function problemiVincoli(vincoli: VincoloCfu[], estrattoVerbatim: string): string[] {
  const problemi: string[] = [];
  for (const vincolo of vincoli) {
    if (!vincolo.sourceExcerpt || vincolo.sourceExcerpt.trim().length === 0) {
      problemi.push(`vincolo ${vincolo.id}: sourceExcerpt assente.`);
    }
    if (!vincolo.sourceLocation || vincolo.sourceLocation.trim().length === 0) {
      problemi.push(`vincolo ${vincolo.id}: sourceLocation assente.`);
    }
    if (vincolo.sourceExcerpt && !estrattoVerbatim.includes(vincolo.sourceExcerpt)) {
      problemi.push(
        `vincolo ${vincolo.id}: sourceExcerpt non presente parola-per-parola nell'estratto verbatim.`,
      );
    }
  }
  return problemi;
}

/** Verifica statica (nessuna I/O): campi, status, hash dichiarato e citazioni. */
export function validaProvenienzaRegola(regola: NormativeRuleEntry): EsitoValidazioneFonte {
  const problemi: string[] = [];

  if (!regola.rawSourceFilePath || !regola.rawSourceFilePath.startsWith(RAW_SOURCES_PREFIX)) {
    problemi.push(`rawSourceFilePath assente o fuori da ${RAW_SOURCES_PREFIX}.`);
  }
  if (!regola.estrattoVerbatim || regola.estrattoVerbatim.trim().length === 0) {
    problemi.push('estrattoVerbatim assente o vuoto.');
  }
  if (regola.sourceStatus !== 'VERIFIED') {
    problemi.push(`sourceStatus != 'VERIFIED' (attuale: ${regola.sourceStatus ?? 'assente'}).`);
  }
  if (!regola.rawSourceSha256 || !/^[0-9a-f]{64}$/i.test(regola.rawSourceSha256)) {
    problemi.push('rawSourceSha256 assente o non in formato SHA-256 esadecimale.');
  }
  if (regola.estrattoVerbatim) {
    problemi.push(...problemiVincoli(regola.vincoli, regola.estrattoVerbatim));
  }

  return { valida: problemi.length === 0, problemi };
}

export type EsitoVerificaFileRaw =
  | { stato: 'verificata' }
  | { stato: 'non-verificabile'; motivo: string };

/**
 * Verifica l'INTEGRITÀ SHA-256 dell'intero file raw + la presenza atomica di
 * estratto ed excerpt per vincolo. Il confronto avviene sul testo fornito da
 * chi legge il file (ambiente Node/test).
 */
export async function verificaFileRaw(
  regola: NormativeRuleEntry,
  testoFileRaw: string,
): Promise<EsitoVerificaFileRaw> {
  if (!testoFileRaw || testoFileRaw.trim().length === 0) {
    return { stato: 'non-verificabile', motivo: 'file raw vuoto o assente.' };
  }

  const hashCalcolato = await sha256Hex(testoFileRaw);
  if (hashCalcolato !== regola.rawSourceSha256) {
    return {
      stato: 'non-verificabile',
      motivo: `SHA-256 del file non corrispondente: atteso ${regola.rawSourceSha256}, calcolato ${hashCalcolato}.`,
    };
  }

  if (!testoFileRaw.includes(regola.estrattoVerbatim)) {
    return {
      stato: 'non-verificabile',
      motivo: "estratto verbatim non presente parola-per-parola nel file.",
    };
  }

  for (const vincolo of regola.vincoli) {
    if (!vincolo.sourceExcerpt || !testoFileRaw.includes(vincolo.sourceExcerpt)) {
      return {
        stato: 'non-verificabile',
        motivo: `sourceExcerpt del vincolo ${vincolo.id} non presente nel file raw.`,
      };
    }
  }

  return { stato: 'verificata' };
}

/** True se la regola può essere ATTIVATA (mai lancia eccezioni). */
export function regolaAttivabile(regola: NormativeRuleEntry): boolean {
  return validaProvenienzaRegola(regola).valida;
}

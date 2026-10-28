/**
 * ScuoleRadar.it — PREFILTRO DEL RUMORE · TIPI CONDIVISI (modulo puro).
 *
 * Perché è un file a parte: le REGOLE del pre-filtro vivono in `noiseFilter.ts`
 * (il giudizio) e in `noiseFilterSindacale.ts` (la vita sindacale, §26.91), e
 * entrambi devono parlare della STESSA forma del segnale — `{ re, reason, hard?,
 * informativa? }`. Un tipo duplicato è il modo più rapido per far divergere due
 * strati: qui il tipo è UNO, `noiseFilter.ts` lo ri-esporta, e chi importa dal
 * pre-filtro non cambia una riga.
 *
 * Zero dipendenze: si importa solo con `import type`, quindi il file non esiste
 * a runtime e non può chiudere un ciclo di import.
 */

/** Esito del pre-filtro: con `isNoise` true la voce si scarta subito. */
export interface NoiseVerdict {
  isNoise: boolean;
  /** Segnale che ha deciso, in forma leggibile (presente solo se `isNoise`). */
  reason?: string;
}

/** Segnale negativo con l'etichetta che finisce nei log e nei test. */
export interface NoisePattern {
  re: RegExp;
  reason: string;
  /** Atto di gara/previdenza: blocca anche un generico «avviso di selezione». */
  hard?: boolean;
  /** Pagina INFORMATIVA: salva solo con titolo SPECIFICO + finestra (§26.82). */
  informativa?: boolean;
}

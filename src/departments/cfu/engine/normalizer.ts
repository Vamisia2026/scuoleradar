/**
 * ScuoleRadar.it — Dipartimento CFU · engine/normalizer.
 *
 * Modulo 2 — Normalizzazione del dominio (SOLO lettura/classificazione).
 *
 * Vincoli di sicurezza:
 *  - NON altera mai i dati grezzi utente (`ssdOrigine`, `raw` immutati);
 *  - NON crea equivalenze legali: distingue LESSICALMENTE i codici SSD
 *    storici dai GSD 2024, senza dedurne l'applicabilità a una classe;
 *  - eventuali mappature di titolo/SSD/GSD arrivano SOLO dal database
 *    normativo autorevole (`normativeDatabase.ts`).
 */
import type {
  EsameCanonico,
  GsdCode,
  SsdCode,
  TitoloAccademicoCanonico,
} from './types';
import { trovaMappatureTitolo } from './normativeDatabase';

/** Formato SSD storico/canonico: lettere e trattini seguiti da slash+numero (es. M-PED/01, L-FIL-LET/04). */
const REGEX_SSD = /^[A-Z]{1,6}(?:-[A-Z]{1,6}){0,3}\/\d{2,3}$/;
/** Formato GSD 2024: LETTERE-NN/A (es. MATH-01/A). */
const REGEX_GSD = /^[A-Z]{3,6}-\d{2}\/[A-Z]$/;

export type TipoCodiceDisciplinare = 'ssd' | 'gsd' | 'non-classificato';

export interface EsitoClassificazione {
  tipo: TipoCodiceDisciplinare;
  /** Codice canonicalizzato (ssd o gsd). */
  canonico: SsdCode | GsdCode | null;
  avviso?: string;
}

/**
 * Classifica lessicalmente un codice disciplinare senza inventare nulla:
 * formato SSD storico o formato GSD 2024. Nessuna equivalenza implicita.
 */
export function classificaCodiceDisciplinare(
  raw: string | null | undefined,
): EsitoClassificazione {
  if (!raw || !raw.trim()) {
    return { tipo: 'non-classificato', canonico: null, avviso: 'Codice disciplinare assente.' };
  }
  const pulito = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (REGEX_SSD.test(pulito)) {
    return { tipo: 'ssd', canonico: pulito as SsdCode };
  }
  if (REGEX_GSD.test(pulito)) {
    return { tipo: 'gsd', canonico: pulito as GsdCode };
  }
  return {
    tipo: 'non-classificato',
    canonico: null,
    avviso: `"${raw}" non corrisponde a un formato SSD o GSD riconosciuto.`,
  };
}

/**
 * Normalizza un esame restituendo UNA COPIA: assegna il campo `ssd` SOLO se il
 * codice è un SSD, `gsd` SOLO se è un GSD. I dati grezzi restano immutati.
 */
export function normalizzaEsame(esame: EsameCanonico): EsameCanonico {
  const origine = esame.ssdOrigine ?? esame.ssd ?? null;
  const classificazione = classificaCodiceDisciplinare(origine);
  return {
    ...esame,
    ssdOrigine: origine,
    ssd: classificazione.tipo === 'ssd' ? (classificazione.canonico as SsdCode) : null,
    gsd: classificazione.tipo === 'gsd' ? (classificazione.canonico as GsdCode) : null,
    provenienza: [...esame.provenienza],
  };
}

/** Normalizza l'intero fascicolo in una copia canonica (nessuna mutazione). */
export function normalizzaFascicolo(
  fascicolo: import('./types').FascicoloAccademicoCanonico,
): import('./types').FascicoloAccademicoCanonico {
  return { ...fascicolo, esami: fascicolo.esami.map(normalizzaEsame) };
}

/* ------------------------------ Titoli (solo da DB autorevole) ------------------------------ */

export interface EsitoMappaturaTitolo {
  classe?: string | null;
  classeLegacy?: string | null;
  trovata: boolean;
  nota?: string;
}

/**
 * Mappa un titolo di studio SOLO se nel database autorevole esiste una
 * corrispondenza dichiarata per la denominazione. Nessuna corrispondenza =
 * `trovata: false` (il valutatore NON deve indovinare la classe).
 */
export function mappaTitoloLegacy(denominazione: string): EsitoMappaturaTitolo {
  const voci = trovaMappatureTitolo(denominazione);
  if (voci.length === 0) {
    return {
      classe: null,
      classeLegacy: null,
      trovata: false,
      nota: 'Nessuna corrispondenza di classe dichiarata nel database normativo.',
    };
  }
  const prima = voci[0];
  return {
    classe: prima.classe,
    classeLegacy: prima.classeLegacy,
    trovata: true,
    nota: `Corrispondenza dichiarata: ${prima.fonte} (agg. ${prima.dataAggiornamentoNormativa}).`,
  };
}

/**
 * Produce una copia canonica del titolo valorizzando la classe SOLO da una
 * corrispondenza autorevole. La copia conserva sempre `raw` originale.
 */
export function normalizzaTitolo(titolo: TitoloAccademicoCanonico): TitoloAccademicoCanonico {
  const mapping = mappaTitoloLegacy(titolo.denominazione);
  if (!mapping.trovata) {
    return { ...titolo, raw: titolo.raw ?? titolo };
  }
  return {
    ...titolo,
    raw: titolo.raw ?? titolo,
    classe: titolo.classe ?? mapping.classe ?? null,
    classeLegacy: titolo.classeLegacy ?? mapping.classeLegacy ?? null,
  };
}

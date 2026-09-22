/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/normalization.
 *
 * STAGE 3 — NORMALIZZAZIONE DEI DATI ACCADEMICI.
 * Normalizza esami (codice disciplinare SSD/GSD), CFU e titolo riusando il
 * modulo `engine/normalizer`, e conserva la MAPPATURA fra dato utente e dato
 * normalizzato. I dati grezzi non vengono mai alterati: i valori non validi
 * vengono segnalati (CFU non numerici, codici non classificati), non corretti.
 */
import type { EsameCanonico, TitoloAccademicoCanonico } from '../types';
import { classificaCodiceDisciplinare, normalizzaEsame, normalizzaTitolo } from '../normalizer';
import type { DatiAccademiciNormalizzati, MappaturaDatoNormalizzato } from './types';

export interface ParametriNormalizzazione {
  readonly esami: readonly EsameCanonico[];
  readonly titolo?: TitoloAccademicoCanonico | null;
}

/** CFU normalizzato (numero finito >= 0, 2 decimali) oppure null se non valido. */
export function cfuNormalizzato(cfu: number): number | null {
  if (typeof cfu !== 'number' || !Number.isFinite(cfu) || cfu < 0) return null;
  return Math.round(cfu * 100) / 100;
}

/** Normalizza esami/titolo conservando il legame con i dati di partenza. */
export function normalizzaDatiAccademici(
  parametri: ParametriNormalizzazione,
): DatiAccademiciNormalizzati {
  const esami: EsameCanonico[] = [];
  const mappature: MappaturaDatoNormalizzato[] = [];
  const anomalie: string[] = [];
  let cfuTotali = 0;
  let cfuNonValidi = false;
  let codiciMancanti = false;

  for (const esame of parametri.esami) {
    const canonico = normalizzaEsame(esame);
    const codice = canonico.ssdOrigine ?? canonico.ssd ?? null;
    const classificazione = classificaCodiceDisciplinare(codice);
    const cfu = cfuNormalizzato(esame.cfu);
    const avvisi: string[] = [];

    if (cfu === null) {
      cfuNonValidi = true;
      avvisi.push(`CFU non validi (${String(esame.cfu)}): nessun conteggio automatico.`);
      anomalie.push(`Esame ${esame.id}: CFU non validi (${String(esame.cfu)}).`);
    } else {
      cfuTotali += cfu;
    }
    if (classificazione.tipo === 'non-classificato') {
      codiciMancanti = true;
      avvisi.push(classificazione.avviso ?? 'Codice disciplinare non classificato.');
      anomalie.push(`Esame ${esame.id}: codice disciplinare non classificato.`);
    }

    esami.push(canonico);
    mappature.push({
      esameId: esame.id,
      cfuGrezzo: esame.cfu,
      cfuNormalizzato: cfu,
      ssdOrigine: codice,
      ssdCanonico: canonico.ssd ?? null,
      gsd: canonico.gsd ?? null,
      tipoCodice: classificazione.tipo,
      avvisi,
    });
  }

  const titolo = parametri.titolo ? normalizzaTitolo(parametri.titolo) : null;

  return {
    esami,
    titolo,
    mappature,
    cfuTotali: Math.round(cfuTotali * 100) / 100,
    cfuNonValidi,
    codiciMancanti,
    anomalie,
  };
}

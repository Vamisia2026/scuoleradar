/**
 * ScuoleRadar.it — Validazione della configurazione del Radar (fonte condivisa).
 *
 * Il Radar può essere ATTIVATO solo se il profilo ha tutti i campi obbligatori:
 *   1. Ordini di scuola   (dove vuoi insegnare/lavorare);
 *   2. Province           (dove vuoi cercare);
 *   3. Classi di concorso o Materie (cosa insegni / per cosa vuoi essere avvisato).
 *
 * Lo stesso modulo è usato da:
 *   - `RadarWizardModal` (blocco all'ultimo passo: non attiva se incompleto);
 *   - `RadarStatusToggle` (toggle di attivazione: blocca e apre il wizard sul
 *     primo passo mancante);
 *   - costanti di persistenza del passo del wizard.
 */

/** Chiave localStorage del passo corrente del wizard Radar (ripresa esatta). */
export const STORAGE_KEY_RADAR_WIZARD_STEP = 'sr_radar_wizard_step';

/** Campi minimi di configurazione considerati per la validazione. */
export interface RadarConfigCampi {
  ordini: string[];
  provinceCodici: string[];
  classiCodici: string[];
  materieId: string[];
  materieCustom: string[];
}

export interface EsitoRadarConfig {
  /** true = tutti i campi obbligatori sono presenti. */
  valido: boolean;
  /** Etichette leggibili delle sezioni mancanti (vuoto se valido). */
  mancanti: string[];
  /** Passo del wizard (1..3) su cui aprire l'utente per il primo campo mancante. */
  primoPasso: 1 | 2 | 3;
}

/**
 * Valida la configurazione Radar. Non lancia mai: restituisce l'elenco delle
 * sezioni mancanti (per un avviso chiaro e puntuale) e il passo da completare.
 */
export function validaConfigRadar(campi: RadarConfigCampi): EsitoRadarConfig {
  const mancanti: string[] = [];

  const haOrdini = (campi.ordini ?? []).length > 0;
  const haProvince = (campi.provinceCodici ?? []).length > 0;
  const haClassi =
    (campi.classiCodici ?? []).length > 0 ||
    (campi.materieId ?? []).length > 0 ||
    (campi.materieCustom ?? []).length > 0;

  if (!haOrdini) mancanti.push('Ordini di scuola');
  if (!haProvince) mancanti.push('Province');
  if (!haClassi) mancanti.push('Classi di concorso o materie');

  const primoPasso: 1 | 2 | 3 = !haOrdini ? 1 : !haProvince ? 2 : 3;
  return { valido: mancanti.length === 0, mancanti, primoPasso };
}

/** Frase amichevole con l'elenco puntuale dei campi mancanti. */
export function messaggioCampiMancanti(mancanti: string[]): string {
  if (mancanti.length === 0) return '';
  const elenco =
    mancanti.length === 1
      ? mancanti[0]
      : `${mancanti.slice(0, -1).join(', ')} e ${mancanti[mancanti.length - 1]}`;
  return `Per attivare il Radar completa questi campi: ${elenco}.`;
}

/**
 * Prepara l'apertura del wizard Radar sul passo indicato (1..4), così l'utente
 * atterra ESATTAMENTE sulla sezione da completare. Tollerante a localStorage
 * non disponibile (in tal caso il wizard riparte dal passo 1).
 */
export function impostaPassoRadar(passo: number): void {
  try {
    const p = Math.min(4, Math.max(1, Math.trunc(passo)));
    localStorage.setItem(STORAGE_KEY_RADAR_WIZARD_STEP, String(p));
  } catch {
    // localStorage non disponibile: nessuna azione
  }
}

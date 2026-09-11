/**
 * ScuoleRadar — Ciclo di vita dell'abbonamento (allineato ai cron lato DB).
 *
 * POLITICA CORRENTE
 *  · NUOVO utente → piano PRO in TRIAL gratuito di 1 mese (30 giorni, stato
 *    `trialing`, scadenza = registrazione + 30 gg). Sponsor: PureFocus.
 *  · Alla scadenza del trial l'account rientra NATURALMENTE su Base
 *    (cron DB `revert-prove-pro-scadute` + self-heal client in `refreshProfilo`).
 *  · PROMEMORIA DI RINNOVO: il cron DB `rinnovo-preavvisi-3-5g`
 *    (`public.invia_preavvisi_rinnovo()`, migrazione 20260903100000) contatta via
 *    EMAIL (Resend → Edge `send-notification`) e TELEGRAM tutti gli utenti — trial
 *    o PRO a pagamento — la cui scadenza cade tra 3 e 5 giorni.
 *
 * Questo modulo replica lato client LA STESSA finestra (3–5 giorni) e gli stessi
 * numeri del backend, così che badge, banner e wizard non divergano mai dal cron.
 * Fonte autorevole resta il database (`profiles.piano`, `subscription_status`,
 * `abbonamento_scade_il`).
 */

import { GIORNI_TRIAL_PRO } from './pricing';

/** Durata del trial PRO gratuito (1 mese) — riesportata per il lifecycle abbonamento. */
export { GIORNI_TRIAL_PRO };

/** Finestra (giorni) del promemoria di rinnovo — allineata a `invia_preavvisi_rinnovo()`. */
export const FINESTRA_PREAVVISO_RINNOVO = { minGiorni: 3, maxGiorni: 5 } as const;

/**
 * Giorni interi (arrotondati per eccesso) che mancano alla scadenza.
 * Ritorna `null` se la scadenza è assente o non è una data valida.
 */
export function giorniAllaScadenza(scadenzaIso?: string | null, oggi: Date = new Date()): number | null {
  if (!scadenzaIso) return null;
  const scad = new Date(scadenzaIso);
  if (Number.isNaN(scad.getTime())) return null;
  return Math.ceil((scad.getTime() - oggi.getTime()) / 86_400_000);
}

/**
 * true se la scadenza cade nella finestra 3–5 giorni (estremi inclusi):
 * la stessa regola applicata dal cron DB dei promemoria di rinnovo.
 */
export function inFinestraPreavviso(scadenzaIso?: string | null, oggi: Date = new Date()): boolean {
  const giorni = giorniAllaScadenza(scadenzaIso, oggi);
  return (
    giorni !== null &&
    giorni >= FINESTRA_PREAVVISO_RINNOVO.minGiorni &&
    giorni <= FINESTRA_PREAVVISO_RINNOVO.maxGiorni
  );
}

/** Etichetta breve dello stato di scadenza ("oggi", "domani", "tra 4 giorni", "scaduto"). */
export function etichettaScadenzaAbbonamento(scadenzaIso?: string | null, oggi: Date = new Date()): string {
  const giorni = giorniAllaScadenza(scadenzaIso, oggi);
  if (giorni === null) return '';
  if (giorni < 0) return 'scaduto';
  if (giorni === 0) return 'oggi';
  if (giorni === 1) return 'domani';
  return `tra ${giorni} giorni`;
}

/** Data della scadenza in formato breve italiano ("15/09/2026"); stringa vuota se invalida. */
export function dataScadenzaBreve(scadenzaIso?: string | null): string {
  if (!scadenzaIso) return '';
  const scad = new Date(scadenzaIso);
  if (Number.isNaN(scad.getTime())) return '';
  return scad.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

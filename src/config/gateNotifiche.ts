/**
 * ScuoleRadar.it — GATE CENTRALIZZATO delle notifiche automatiche.
 *
 * Regola unica, valida per OGNI canale (email Resend, Telegram bot/canali), in
 * base allo stato del dipartimento a cui la notifica appartiene:
 *
 *   `on`   → invio regolare, destinatario invariato;
 *   `test` → il messaggio parte SOLO verso l'account di test dell'admin: se il
 *            destinatario non è admin viene DIROTTATO su
 *            `FEATURE_ADMIN_EMAIL` / `ADMIN_TELEGRAM_ID`; senza recapito admin
 *            configurato il canale viene BLOCCATO;
 *   `off`  → nessun invio (bloccato) per quel canale.
 *
 * Il dirottamento in `test` si disattiva con `FEATURE_TEST_REDIRECT=0`
 * (in quel caso i canali non-admin vengono semplicemente bloccati).
 *
 * Modulo PURO e isomorfo: usato da `src/lib/resend.ts`, `src/lib/telegram.ts`
 * (choke point di ogni invio) e dai test (`npm run test:flags`).
 */
import { variabileAmbienteAttiva } from '../lib/ambiente.ts';
import { chatIdAdminTest, eEmailAdmin, emailAdminTest } from '../lib/utentiAdmin.ts';
import type { DipartimentoId, StatoDipartimento } from './features.ts';
import { statoDipartimento } from './statoDipartimenti.ts';

/** Esito del gate su un singolo canale. */
export interface EsitoCanale {
  /** true = il canale può partire (verso `recapito`). */
  consentito: boolean;
  /** Recapito finale: originale, recapito admin (dirottato) o `null` se bloccato. */
  recapito: string | null;
  /** true se il recapito è stato riportato all'account di test dell'admin. */
  dirottato: boolean;
  /** Spiegazione leggibile (log, test, diagnostica). */
  motivo: string;
}

/** Destinatario logico di una notifica automatica (uno o entrambi i canali). */
export interface DestinatarioAutomatico {
  email?: string | null;
  chatId?: string | null;
}

/** Opzioni di valutazione (usate dai test per forzare stato e recapiti). */
export interface OpzioniGateNotifica {
  /** Stato da usare al posto di quello effettivo del dipartimento. */
  stato?: StatoDipartimento;
  /** Forza l'attivazione/disattivazione del dirottamento in `test`. */
  dirottamento?: boolean;
  /** Recapito email dell'account di test. */
  emailAdmin?: string;
  /** Chat ID Telegram dell'account di test (`null` = non configurato). */
  chatIdAdmin?: string | null;
}

/** Esito complessivo su entrambi i canali (per test e pannelli). */
export interface EsitoGateNotifica extends EsitoCanale {
  modulo: DipartimentoId;
  stato: StatoDipartimento;
  /** Recapito email finale, se il canale email può partire. */
  email: string | null;
  /** Chat ID finale, se il canale Telegram può partire. */
  chatId: string | null;
}

/** Motivi già loggati: evita di ripetere lo stesso avviso a ogni invio. */
const motiviLoggati = new Set<string>();

/** Logga una volta sola il motivo di un blocco/dirottamento. */
export function logGate(motivo: string): void {
  if (motiviLoggati.has(motivo)) return;
  motiviLoggati.add(motivo);
  console.warn(`⛔ GATE DIPARTIMENTI — ${motivo}`);
}

/** Azzera la memoria dei log (usato dai test). */
export function resetLogGate(): void {
  motiviLoggati.clear();
}

/** true se il dirottamento in stato `test` è attivo (default: attivo). */
function dirottamentoAttivo(override?: boolean): boolean {
  return override ?? variabileAmbienteAttiva('FEATURE_TEST_REDIRECT', true);
}

/**
 * Valuta UN canale: `amministratore` = il recapito passato è già quello admin.
 */
function valutaCanale(
  canale: 'email' | 'telegram',
  recapito: string | null,
  stato: StatoDipartimento,
  amministratore: boolean,
  recapitoAdmin: string | null,
  dirotta: boolean,
): EsitoCanale {
  const etichetta = canale === 'email' ? 'email' : 'Telegram';
  if (!recapito) {
    return { consentito: false, recapito: null, dirottato: false, motivo: `nessun recapito ${etichetta}` };
  }
  if (stato === 'on') {
    return { consentito: true, recapito, dirottato: false, motivo: `${etichetta} ammessa (modulo ON)` };
  }
  if (stato === 'off') {
    return {
      consentito: false,
      recapito: null,
      dirottato: false,
      motivo: `${etichetta} bloccata: modulo disattivato (OFF)`,
    };
  }
  if (amministratore) {
    return { consentito: true, recapito, dirottato: false, motivo: `${etichetta} ammessa: destinatario admin` };
  }
  if (dirotta && recapitoAdmin) {
    return {
      consentito: true,
      recapito: recapitoAdmin,
      dirottato: true,
      motivo: `${etichetta} dirottata sull'account di test (modulo TEST)`,
    };
  }
  return {
    consentito: false,
    recapito: null,
    dirottato: false,
    motivo: recapitoAdmin
      ? `${etichetta} bloccata: destinatario non admin (modulo TEST)`
      : `${etichetta} bloccata: modulo TEST senza recapito admin configurato`,
  };
}

/** Valuta il canale EMAIL di un invio automatico. */
export function gateEmail(
  modulo: DipartimentoId,
  email: string | null | undefined,
  opts: OpzioniGateNotifica = {},
): EsitoCanale {
  const stato = opts.stato ?? statoDipartimento(modulo);
  const amministratore = eEmailAdmin(email);
  const admin = opts.emailAdmin ?? emailAdminTest();
  const esito = valutaCanale(
    'email',
    (email ?? '').trim() || null,
    stato,
    amministratore,
    admin,
    dirottamentoAttivo(opts.dirottamento),
  );
  if (esito.dirottato || !esito.consentito) logGate(`${esito.motivo} [${modulo}]`);
  return esito;
}

/** Valuta il canale TELEGRAM di un invio automatico (chat privata o canale). */
export function gateTelegram(
  modulo: DipartimentoId,
  chatId: string | null | undefined,
  opts: OpzioniGateNotifica = {},
): EsitoCanale {
  const stato = opts.stato ?? statoDipartimento(modulo);
  const recapito = (chatId ?? '').trim() || null;
  const admin = opts.chatIdAdmin !== undefined ? opts.chatIdAdmin : chatIdAdminTest();
  const amministratore = recapito !== null && admin !== null && recapito === admin;
  const esito = valutaCanale(
    'telegram',
    recapito,
    stato,
    amministratore,
    admin,
    dirottamentoAttivo(opts.dirottamento),
  );
  if (esito.dirottato || !esito.consentito) logGate(`${esito.motivo} [${modulo}]`);
  return esito;
}

/** Valuta una notifica su entrambi i canali (diagnostica, test, pannelli). */
export function valutaInvioNotifica(
  modulo: DipartimentoId,
  destinatario: DestinatarioAutomatico,
  opts: OpzioniGateNotifica = {},
): EsitoGateNotifica {
  const stato = opts.stato ?? statoDipartimento(modulo);
  const email = gateEmail(modulo, destinatario.email, opts);
  const telegram = gateTelegram(modulo, destinatario.chatId, opts);
  const consentito = email.consentito || telegram.consentito;
  const canali = [email.consentito ? 'email' : '', telegram.consentito ? 'telegram' : '']
    .filter(Boolean)
    .join(' + ');
  return {
    modulo,
    stato,
    consentito,
    recapito: email.consentito ? email.recapito : telegram.recapito,
    dirottato: email.dirottato || telegram.dirottato,
    email: email.consentito ? email.recapito : null,
    chatId: telegram.consentito ? telegram.recapito : null,
    motivo: consentito ? `invio ammesso (${canali})` : `${email.motivo}; ${telegram.motivo}`,
  };
}


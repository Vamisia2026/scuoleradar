/**
 * ScuoleRadar.it — identità AMMINISTRATORE (unica fonte di verità).
 *
 * La whitelist vive qui (strato condiviso `src/lib`) perché serve a strati che
 * NON possono importare da un dominio: `src/hooks/useFeatureFlags` (visibilità
 * dei dipartimenti in stato `test`), `src/config/gateNotifiche` (dirottamento
 * delle notifiche verso l'account di test) e i moduli Node di notifica.
 *
 * `src/departments/admin/types.ts` la ri-esporta: il pannello Admin continua a
 * importare `ADMIN_EMAILS` da `@/departments/admin` senza duplicazioni.
 *
 * Modulo PURO: nessun import di React né di domini.
 */
import { variabileAmbiente } from './ambiente.ts';

/** Email autorizzate al pannello Admin e alla visibilità dei moduli in `test`. */
export const ADMIN_EMAILS = ['bartoloansaldi@gmail.com', 'myvamisia@gmail.com'];

/** Account di TEST: unico destinatario ammesso quando un dipartimento è in `test`. */
export const EMAIL_ADMIN_TEST = ADMIN_EMAILS[0];

/** True se l'email appartiene a un amministratore (confronto case-insensitive). */
export function eEmailAdmin(email?: string | null): boolean {
  const normalizzata = (email ?? '').trim().toLowerCase();
  return normalizzata.length > 0 && ADMIN_EMAILS.includes(normalizzata);
}

/**
 * Chat ID Telegram dell'account ADMIN di test.
 * Fonte: `FEATURE_ADMIN_TELEGRAM_ID` (override esplicito) oppure `ADMIN_TELEGRAM_ID`
 * (stesso secret del bot admin, già usato da `telegram-admin-webhook`).
 * `null` = nessun recapito Telegram admin configurato → in stato `test` la
 * notifica Telegram viene bloccata (mai inviata a terzi).
 */
export function chatIdAdminTest(): string | null {
  const id = variabileAmbiente('FEATURE_ADMIN_TELEGRAM_ID') ?? variabileAmbiente('ADMIN_TELEGRAM_ID');
  return id && id.trim() ? id.trim() : null;
}

/** Email dell'account di test (override `FEATURE_ADMIN_EMAIL`, default storico). */
export function emailAdminTest(): string {
  return variabileAmbiente('FEATURE_ADMIN_EMAIL') ?? EMAIL_ADMIN_TEST;
}

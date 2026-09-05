/**
 * Redirect post-login per le pagine showroom pubbliche ("/nomedellostrumento").
 * Quando un visitatore non autenticato clicca la CTA di una vetrina pubblica,
 * salviamo qui la destinazione: al termine di login/registrazione l'utente
 * viene riportato al tool completo (/dashboard/moduli, ecc.).
 */
export const SR_POST_LOGIN_REDIRECT = 'sr_post_login_redirect';

/** Legge e rimuove il redirect pendente (se presente). */
export function getPostLoginRedirect(): string | null {
  try {
    const valore = sessionStorage.getItem(SR_POST_LOGIN_REDIRECT);
    if (valore) sessionStorage.removeItem(SR_POST_LOGIN_REDIRECT);
    return valore;
  } catch {
    return null;
  }
}

/** Memorizza il redirect post-login verso un tool completo della dashboard. */
export function setPostLoginRedirect(destinazione: string): void {
  try {
    sessionStorage.setItem(SR_POST_LOGIN_REDIRECT, destinazione);
  } catch {
    // sessionStorage non disponibile: il redirect resta un arricchimento opzionale
  }
}

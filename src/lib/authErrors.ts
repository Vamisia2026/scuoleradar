/**
 * Mappatura degli errori Supabase Auth in messaggi IT chiari e utilizzabili.
 *
 * Usata dal login email (AuthModal) e da qualsiasi flusso `signInWithPassword`:
 * evita che un errore di Supabase resti "silenzioso" o mostri il testo tecnico
 * inglese grezzo (es. "Invalid login credentials") all'utente.
 *
 * Nota: la stessa funzione vive in `src/lib/authErrors.ts` (frontend) perché il
 * modulo `@supabase/supabase-js` espone `AuthError.code` accanto a `message`.
 */

export interface ErroreAuthSupabase {
  message: string;
  code?: string | null;
  status?: number | null;
}

/** Messaggio "non attivato": inviato da GoTrue quando l'email non è confermata. */
export const MSG_ACCOUNT_NON_ATTIVATO =
  'Account non ancora attivato: controlla la tua casella email e clicca il link di conferma ricevuto alla registrazione.';

/**
 * Converte un errore di `signInWithPassword` (o `signUp`) in un messaggio IT.
 * Fallback sicuri: se il codice/messaggio non è riconosciuto si usa il testo
 * originale di Supabase oppure un generico "riprova".
 */
export function traduciErroreAuthSupabase(err: ErroreAuthSupabase | null | undefined): string {
  const code = String(err?.code ?? '').trim().toLowerCase();
  const message = String(err?.message ?? '').trim().toLowerCase();

  // 1) Credenziali errate → il caso più comune nel login.
  if (
    code === 'invalid_credentials' ||
    code === 'invalid_grant' ||
    message.includes('invalid login credentials') ||
    message.includes('invalid credentials') ||
    message.includes('bad request') && (message.includes('password') || message.includes('email'))
  ) {
    return 'Credenziali non valide. Controlla email e password.';
  }

  // 2) Account registrato ma email di conferma non ancora cliccata.
  if (
    code === 'email_not_confirmed' ||
    message.includes('email not confirmed') ||
    message.includes('not confirmed')
  ) {
    return MSG_ACCOUNT_NON_ATTIVATO;
  }

  // 3) Account già esistente (tentativo di doppia registrazione).
  if (
    code === 'user_already_exists' ||
    message.includes('already registered') ||
    message.includes('user already exists')
  ) {
    return 'Esiste già un account con questa email: prova ad accedere.';
  }

  // 4) Password troppo debole durante la registrazione.
  if (
    code === 'weak_password' ||
    message.includes('at least 6 characters') ||
    message.includes('weak password')
  ) {
    return 'La password deve avere almeno 6 caratteri.';
  }

  // 5) Rate limit: GoTrue blocca i tentativi ravvicinati.
  if (
    code === 'over_request_rate_limit' ||
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('too many email')
  ) {
    return 'Troppi tentativi in pochi minuti: attendi qualche istante e riprova.';
  }

  // 6) Email non valida / formato errato.
  if (
    code === 'invalid_email' ||
    message.includes('invalid email') ||
    message.includes('unable to validate email')
  ) {
    return 'Indirizzo email non valido. Controlla di averlo scritto correttamente.';
  }

  // 7) Account sospeso o disabilitato.
  if (
    code === 'user_banned' ||
    message.includes('user is banned') ||
    message.includes('user has been banned') ||
    message.includes('user disabled')
  ) {
    return 'Account sospeso o disabilitato: contatta il supporto ScuoleRadar per riattivarlo.';
  }

  // 8) Nuova password uguale alla precedente (flusso cambio password).
  if (message.includes('new password should be different')) {
    return 'La nuova password deve essere diversa dalla precedente.';
  }

  // Fallback: testo originale di Supabase se presente, altrimenti generico.
  const originale = String(err?.message ?? '').trim();
  return (
    originale ||
    'Accesso non riuscito. Controlla la connessione e riprova.'
  );
}

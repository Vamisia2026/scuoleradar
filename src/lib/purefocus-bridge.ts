/**
 * PureFocus Bridge — OUTGOING PRO Subscription Bridge (token generator).
 *
 * Genera un token firmato (JWT-like: `base64url(payload).hex(HMAC-SHA256)`) con lo
 * stato PRO dell'utente e restituisce l'URL di redirect verso PureFocus:
 *   https://purefocus.app/auth/bridge?token=...
 *
 * Payload firmato: { email, is_pro, expires_at, iat, exp, iss }.
 * La chiave HMAC è condivisa con PureFocus (VITE_PUREFOCUS_BRIDGE_SECRET).
 *
 * NOTA SICUREZZA: il segreto vive in una VITE_ env var (pubblica nel bundle) → è un
 * token di CAPACITÀ: PureFocus deve ri-validare `is_pro` tramite la RPC
 * `get_user_pro_status` sullo stesso progetto Supabase (fonte autorevole) prima di
 * concedere l'accesso PRO.
 *
 * Attivo SOLO se VITE_PUREFOCUS_BRIDGE_SECRET è configurato (altrimenti no-op).
 */

// Difensivo: in ambienti senza Vite (es. test Node/tsx) `import.meta.env` può
// essere undefined → il bridge resta disattivato.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const BRIDGE_SECRET = (env.VITE_PUREFOCUS_BRIDGE_SECRET ?? '').trim();
const BRIDGE_URL = (
  (env.VITE_PUREFOCUS_BRIDGE_URL ?? '').trim() || 'https://purefocus.app/auth/bridge'
).replace(/\/+$/, '');

/** Validità del token (secondi): 5 minuti. */
const TTL_SECONDI = 5 * 60;

function toBase64Url(testo: string): string {
  return btoa(testo).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded: string): string {
  const pad = encoded.length % 4 === 0 ? '' : '='.repeat(4 - (encoded.length % 4));
  return atob(encoded.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function firmaHmac(data: string, segreto: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const firma = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera il token firmato per il bridge PureFocus.
 *
 * @param userEmail  email dell'utente (identità per il riconoscimento cross-app)
 * @param isPro      true se l'utente ha un PRO attivo (annuale/mensile)
 * @param expiresAt  scadenza dell'abbonamento (ISO) o stringa vuota se lifetime
 * @returns token `base64url(payload).hex(firma)` oppure null se non configurabile
 */
export async function generatePureFocusBridgeToken(
  userEmail: string,
  isPro: boolean,
  expiresAt: string,
): Promise<string | null> {
  if (!BRIDGE_SECRET || !userEmail.trim()) return null;
  const ora = Math.floor(Date.now() / 1000);
  const payload = {
    email: userEmail.trim(),
    is_pro: Boolean(isPro),
    expires_at: expiresAt.trim() || null,
    iat: ora,
    exp: ora + TTL_SECONDI,
    iss: 'scuoleradar',
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  try {
    const firma = await firmaHmac(encoded, BRIDGE_SECRET);
    return `${encoded}.${firma}`;
  } catch {
    return null;
  }
}

/**
 * URL di redirect completo per il launch di PureFocus PRO.
 * Es.: https://purefocus.app/auth/bridge?token=eyJ...firma
 * (per lo sviluppo locale impostare VITE_PUREFOCUS_BRIDGE_URL su un endpoint locale).
 */
export async function generatePureFocusBridgeUrl(
  userEmail: string,
  isPro: boolean,
  expiresAt: string,
): Promise<string | null> {
  const token = await generatePureFocusBridgeToken(userEmail, isPro, expiresAt);
  if (!token) return null;
  return `${BRIDGE_URL}?token=${encodeURIComponent(token)}`;
}

/**
 * Verifica la firma HMAC di un token bridge e ne ritorna il payload (o null).
 * Utile per test e per il backend PureFocus (verifica hash + claim).
 */
export async function verifyPureFocusBridgeToken(
  token: string,
): Promise<Record<string, unknown> | null> {
  if (!BRIDGE_SECRET) return null;
  const parti = token.split('.');
  if (parti.length !== 2) return null;
  const [encoded, firmaAttesa] = parti;
  try {
    const firma = await firmaHmac(encoded, BRIDGE_SECRET);
    if (firma !== firmaAttesa) return null;
    return JSON.parse(fromBase64Url(encoded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

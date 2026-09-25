/**
 * Guardia COUPON UNICO SCUOLERADAR50 — regole tassative di prodotto.
 *
 * Un solo codice di sconto attivo: **SCUOLERADAR50**
 *   1. 50% sulla sottoscrizione ANNUALE (PRO);
 *   2. MONOUSO PER EMAIL (utente + email + email di notifica + Telegram);
 *   3. valido 40 giorni dalla registrazione iniziale (mese PRO gratuito);
 *   4. case-insensitive.
 * `RADAR50` è RIMOSSO da client, Edge Function e database.
 *
 * Le Edge Function girano su Deno (non importabili da `tsx`): la guardia è STATICA
 * e legge i sorgenti/le migrazioni come testo.
 *
 * Uso: npm run test:coupon (incluso in `npm test`)
 */
import { readdirSync, readFileSync } from 'node:fs';

const checkout = readFileSync('supabase/functions/checkout/index.ts', 'utf8');
const webhook = readFileSync('supabase/functions/webhook/index.ts', 'utf8');
const promoClient = readFileSync('src/lib/promo.ts', 'utf8');
const abbonamentoModal = readFileSync('src/components/AbbonamentoModal.tsx', 'utf8');
const checkoutPage = readFileSync('src/pages/CheckoutRedirectPage.tsx', 'utf8');

/** Tutto l'SQL delle migrazioni: RPC, seed e policy in un unico testo. */
const sqlPromo = readdirSync('supabase/migrations')
  .sort()
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'))
  .join('\n');

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Client: un solo coupon attivo —');
check('RADAR50 non è più un codice del client', false, /PROMO_CODE_RADAR50/.test(promoClient));
check(
  'codici attivi = BETA1ANNO + SCUOLERADAR50',
  true,
  /PROMO_CODES_ATTIVI = \[PROMO_CODE_BETA1ANNO, PROMO_CODE_50_PRIMO_ANNO\]/.test(promoClient),
);
check('SCUOLERADAR50 con sconto 50%', true, /SCONTO_SCUOLERADAR50_PERCENTO = 50/.test(promoClient));
check('finestra di 40 giorni dalla registrazione', true, /GIORNI_VALIDITA_SCUOLERADAR50 = 40/.test(promoClient));
check(
  'case-insensitive: normalizzazione condivisa (maiuscolo, solo A-Z0-9)',
  true,
  /export function normalizzaCodicePromo[\s\S]{0,160}?toUpperCase\(\)\.replace\(\/\[\^A-Z0-9\]\/g, ''\)/.test(
    promoClient,
  ),
);
check('descrizione monouso per email nel catalogo', true, /monouso per email/.test(promoClient));
check(
  'AbbonamentoModal usa la normalizzazione condivisa',
  true,
  /normalizzaCodicePromo\(codice\)/.test(abbonamentoModal),
);
check(
  'checkout diretto: il parametro coupon passa da PROMO_CODES_ATTIVI',
  true,
  /PROMO_CODES_ATTIVI\.includes\(coupon\)/.test(checkoutPage),
);

console.log('\n— 2. Edge checkout: ramo SCUOLERADAR50 —');
check('nessun ramo RADAR50', false, /'RADAR50'/.test(checkout));
check('ramo SCUOLERADAR50 presente', true, /codiceUpp === 'SCUOLERADAR50'/.test(checkout));
check(
  'SCUOLERADAR50 solo sul piano PRO annuale',
  true,
  /plan !== 'pro_annuale'[\s\S]{0,220}?SCUOLERADAR50 è valido solo sul piano PRO annuale/.test(checkout),
);
check(
  'validazione server-side (RPC valida_coupon_scuoleradar50)',
  true,
  /rpc\/valida_coupon_scuoleradar50/.test(checkout) && /async function validaScuoleradar50/.test(checkout),
);
check(
  'coupon Stripe applicato via discounts[0][coupon]',
  true,
  /campi\['discounts\[0\]\[coupon\]'\] = STRIPE_COUPON_SCUOLERADAR50/.test(checkout),
);
check('metadata promo = SCUOLERADAR50', true, /campi\['metadata\[promo\]'\] = 'SCUOLERADAR50'/.test(checkout));
check(
  'secret STRIPE_COUPON_SCUOLERADAR50 (fallback al vecchio coupon)',
  true,
  /Deno\.env\.get\('STRIPE_COUPON_SCUOLERADAR50'\)[\s\S]{0,120}?Deno\.env\.get\('STRIPE_COUPON_RADAR50'\)/.test(
    checkout,
  ),
);
check('health check aggiornato', true, /couponScuoleradar50: Boolean/.test(checkout));

console.log('\n— 3. Edge webhook: consumo monouso —');
check(
  'consumo su SCUOLERADAR50 pagato',
  true,
  /obj\.metadata\?\.promo === 'SCUOLERADAR50'/.test(webhook) &&
    /rpc\/registra_uso_coupon_scuoleradar50/.test(webhook),
);
check('nessun riferimento RADAR50 (standalone)', false, /\bRADAR50\b/.test(webhook));

console.log('\n— 4. Database: RADAR50 dismesso, SCUOLERADAR50 unico —');
check(
  'RADAR50 eliminato da promo_codes',
  true,
  /delete from public\.promo_codes where upper\(codice\) = 'RADAR50'/.test(sqlPromo),
);
check(
  'funzioni RADAR50 eliminate',
  true,
  /drop function if exists public\.valida_coupon_radar50/.test(sqlPromo) &&
    /drop function if exists public\.registra_uso_coupon_radar50/.test(sqlPromo),
);
check(
  'SCUOLERADAR50 = 50%, pro, 1anno, monouso, senza scadenza assoluta',
  true,
  /'SCUOLERADAR50', 'sconto', 50, 'pro', '1anno', true, null, true/.test(sqlPromo),
);
check(
  'finestra dinamica 40 giorni dalla registrazione iniziale',
  true,
  /v_creato \+ interval '40 days'/.test(sqlPromo) && /a\.created_at/.test(sqlPromo),
);
check(
  'monouso per email (utente + email + email di notifica + Telegram)',
  true,
  /u\.user_id = p_user_id/.test(sqlPromo) &&
    /lower\(o\.email\) = lower\(v_email_primaria\)/.test(sqlPromo) &&
    /lower\(o\.email_notifica\) = lower\(v_email_secondaria\)/.test(sqlPromo) &&
    /o\.telegram_chat_id = v_telegram/.test(sqlPromo),
);
check(
  'RPC di validazione e consumo per le Edge Function',
  true,
  /create or replace function public\.valida_coupon_scuoleradar50/.test(sqlPromo) &&
    /create or replace function public\.registra_uso_coupon_scuoleradar50/.test(sqlPromo),
);
check(
  'tracciamento utilizzi generalizzato (coupon_usage)',
  true,
  /rename to coupon_usage/.test(sqlPromo) &&
    /coupon_usage \(user_id, checkout_session_id, coupon\)/.test(sqlPromo),
);

console.log(errori === 0 ? '\n✅ COUPON SCUOLERADAR50: nessun problema' : `\n❌ COUPON SCUOLERADAR50: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/* Stripe — mappatura secrets canonici + health-check live ready.
   Uso: node scripts/_stripe-final.mjs */
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();

const leggi = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const scrivi = (f, txt) => {
  const eol = /\r\n/.test(txt) ? '\r\n' : '\n';
  fs.writeFileSync(path.join(root, f), txt.split(/\r?\n/).join('\n').split('\n').join(eol), 'utf8');
};

function applicaOp(f, ops) {
  const lines = leggi(f).split(/\r?\n/);
  const sorted = [...ops].sort((a, b) => (a.line ?? a.start) - (b.line ?? b.start));
  let delta = 0;
  for (const op of sorted) {
    if (op.type === 'replaceLine') {
      lines[op.line - 1 + delta] = op.new;
    } else if (op.type === 'removeLine') {
      lines.splice(op.line - 1 + delta, 1);
      delta -= 1;
    } else if (op.type === 'removeRange') {
      const s = op.start - 1 + delta;
      const e = op.end - 1 + delta;
      lines.splice(s, e - s + 1);
      delta -= e - s + 1;
    } else if (op.type === 'insertAfter') {
      const idx = op.line + delta;
      const parts = op.text.split('\n');
      lines.splice(idx, 0, ...parts);
      delta += parts.length;
    }
  }
  scrivi(f, lines.join('\n'));
}

/* ================= CHECKOUT ================= */
{
  const f = 'supabase/functions/checkout/index.ts';
  const headerNuovo = `// Secrets richiesti:
//   STRIPE_SECRET_KEY              (obbligatoria — sk_test_… / sk_live_…)
//   STRIPE_PRICE_ID_ANNUAL         (Price ID PRO annuale — 49€, es. price_1UAnSqKHxfBbZQd8xtvuLMVK)
//   STRIPE_PRICE_ID_MONTHLY        (Price ID PRO mensile — 9€, es. price_1UAnTeKHxfBbZQd8iqjzlvn0)
//   STRIPE_PRICE_ID_CONSUMO        (Price ID a consumo — 5€, es. price_1UAnUXKHxfBbZQd8n1UfrIkI)
//   REFERRAL_COUPON_ID             (Coupon referral -10€ sul PRO annuale, es. TOQf7ze2)
//   STRIPE_MODE                    (opzionale — 'test' | 'live'; default: auto-rilevata dalla chiave sk_live_*)
//   WEBHOOK_ENDPOINT               (URL dell'endpoint webhook configurato nel dashboard Stripe,
//                                    es. https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/webhook)
//
// Retrocompatibilità: in lettura vengono accettati anche i vecchi nomi
// STRIPE_PRICE_PRO_ANNUALE / STRIPE_PRICE_PRO_MENSILE / STRIPE_PRICE_A_CONSUMO
// (con fallback _CONSUMO / _ALACARTE) e STRIPE_COUPON_REFERRAL_10 (fallback del coupon).
//
// Passaggio TEST → LIVE: aggiorna SOLO i secrets — STRIPE_SECRET_KEY=sk_live_…,
// i Price ID e il coupon di produzione (nessuna modifica al codice necessaria).`;

  applicaOp(f, [
    { type: 'removeRange', start: 17, end: 27 },
    { type: 'insertAfter', line: 16, text: headerNuovo },
    {
      type: 'removeRange',
      start: 45,
      end: 46,
    },
    {
      type: 'insertAfter',
      line: 44,
      text: `/** Coupon referral Stripe (-10€ sul PRO annuale): REFERRAL_COUPON_ID (fallback STRIPE_COUPON_REFERRAL_10). */
const COUPON_REFERRAL = Deno.env.get('REFERRAL_COUPON_ID') ?? Deno.env.get('STRIPE_COUPON_REFERRAL_10') ?? '';
/** Endpoint webhook Stripe (configurato nel dashboard Stripe) — esposto nel health-check e nei log. */
const WEBHOOK_ENDPOINT = Deno.env.get('WEBHOOK_ENDPOINT') ?? '';`,
    },
    {
      type: 'removeRange',
      start: 65,
      end: 73,
    },
    {
      type: 'insertAfter',
      line: 64,
      text: `const STRIPE_PRICE_IDS: Record<string, string> = {
  pro_annuale:
    Deno.env.get('STRIPE_PRICE_ID_ANNUAL') ??
    Deno.env.get('STRIPE_PRICE_PRO_ANNUALE') ??
    '',
  pro_mensile:
    Deno.env.get('STRIPE_PRICE_ID_MONTHLY') ??
    Deno.env.get('STRIPE_PRICE_PRO_MENSILE') ??
    '',
  a_consumo:
    Deno.env.get('STRIPE_PRICE_ID_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_A_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_CONSUMO') ??
    Deno.env.get('STRIPE_PRICE_ALACARTE') ??
    '',
};`,
    },
    {
      type: 'insertAfter',
      line: 208,
      text: `        webhookEndpoint: WEBHOOK_ENDPOINT,
        couponReferral: Boolean(COUPON_REFERRAL),`,
    },
  ]);
  console.log('  ✓ checkout: secrets canonici STRIPE_PRICE_ID_*/REFERRAL_COUPON_ID/WEBHOOK_ENDPOINT');
}

/* ================= WEBHOOK ================= */
{
  const f = 'supabase/functions/webhook/index.ts';
  const headerNuovo = `// Secrets richiesti:
//   STRIPE_WEBHOOK_SECRET  (signing secret dal pannello Stripe → Webhooks, formato whsec_…;
//                           in LIVE va usato il signing secret dell'endpoint Live)
//   STRIPE_MODE            (opzionale — 'test' | 'live': modalità dichiarata, solo per i log)
//   WEBHOOK_ENDPOINT       (URL pubblico di questo endpoint —
//                           es. https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/webhook)
//
// Passaggio TEST → LIVE: basta usare il signing secret LIVE in STRIPE_WEBHOOK_SECRET.`;

  applicaOp(f, [
    { type: 'removeRange', start: 15, end: 19 },
    { type: 'insertAfter', line: 14, text: headerNuovo },
    {
      type: 'replaceLine',
      line: 30,
      new: `console.log(
  \`[stripe-webhook] modalità Stripe: \${STRIPE_MODE} — webhook secret: \${STRIPE_WEBHOOK_SECRET
    ? STRIPE_WEBHOOK_SECRET.startsWith('whsec_')
      ? STRIPE_WEBHOOK_SECRET.slice(0, 10) + '…'
      : 'formato non whsec_ (da verificare)'
    : 'mancante'}\`,
);`,
    },
  ]);
  console.log('  ✓ webhook: conferma firma HMAC con signing secret whsec_…');
}

console.log('\nStripe integration aggiornata.');

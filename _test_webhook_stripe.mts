import { readFileSync } from 'node:fs';
import { createHmac, randomUUID } from 'node:crypto';

const env = readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/^SUPABASE_URL=(.+)$/m)![1].trim();
const ROLE = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)![1].trim();
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/webhook`;
const SECRET = 'whsec_aan4UbRID6i7cybqyWbvP5iCwSa5OCGo';

const headers = { apikey: ROLE, Authorization: `Bearer ${ROLE}` };
const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

let ok = true;
const check = (label: string, cond: boolean) => {
  if (!cond) ok = false;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
};

// 1) Individua o crea un utente di test
let res = await fetch(
  `${SUPABASE_URL}/rest/v1/profiles?select=id,email,piano,crediti,stripe_subscription_id&limit=1`,
  { headers },
);
const utenti = (await res.json()) as Array<{ id: string; email?: string }>;
let user = utenti?.[0];
if (!user) {
  user = { id: randomUUID(), email: 'test.stripe@scuoleradar.it' };
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ id: user.id, email: user.email }),
  });
}
console.log(`UTENTE TEST: ${user.id} (${user.email})`);

async function invia(type: string, object: Record<string, unknown>): Promise<number> {
  const body = JSON.stringify({ id: `evt_${type}`, type, data: { object } });
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
  const r = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` },
    body,
  });
  const testo = await r.text();
  console.log(`  webhook ${type} → HTTP ${r.status} ${testo.slice(0, 40)}`);
  return r.status;
}

// 2) Evento A la Carte (checkout.session.completed, mode=payment) → +1 credito
const s1 = await invia('checkout.session.completed', {
  id: 'cs_test_alacarte',
  mode: 'payment',
  payment_status: 'paid',
  metadata: { user_id: user.id },
});
check('webhook A la Carte accettato (firma valida)', s1 === 200);

// 3) Evento PRO (customer.subscription.created, active) → piano pro
const finePeriodo = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
const s2 = await invia('customer.subscription.created', {
  id: 'sub_test_pro',
  status: 'active',
  current_period_end: finePeriodo,
  metadata: { user_id: user.id },
});
check('webhook subscription accettato (firma valida)', s2 === 200);

// 4) Verifica aggiornamento DB
const dopo = await fetch(
  `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=piano,crediti,stripe_subscription_id,abbonamento_scade_il`,
  { headers },
);
const profilo = (await dopo.json())[0];
console.log('PROFILO DOPO WEBHOOK:', JSON.stringify(profilo, null, 2));

check('crediti incrementati a 1', Number(profilo?.crediti) >= 1);
check('piano aggiornato a pro', profilo?.piano === 'pro');
check('stripe_subscription_id salvato', profilo?.stripe_subscription_id === 'sub_test_pro');
check('scadenza abbonamento impostata', Boolean(profilo?.abbonamento_scade_il));

process.exit(ok ? 0 : 1);

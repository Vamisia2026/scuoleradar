/**
 * Guardia CHECKOUT & CODICI PROMO — gli invarianti che tengono in piedi
 * "BETA1ANNO = 1 anno di PRO gratuito" e la diagnostica del System Health Check.
 *
 * Le Edge Function girano su Deno (non importabili da `tsx`), quindi la guardia è
 * STATICA: legge i sorgenti e i file di configurazione e verifica che non
 * regrediscano le scelte chiave del flusso:
 *
 *  1. `supabase/config.toml`: `[functions.checkout] verify_jwt = true` ESPLICITO
 *     (la sessione è creata a nome dell'utente del JWT);
 *  2. `checkout`: BETA1ANNO accettato SOLO sul piano PRO annuale, con il codice
 *     validato su `promo_codes` (attivo/scaduto/monouso) prima di applicare il
 *     coupon a sconto totale, e MAI via `promotion_code`;
 *  3. `webhook`: al pagamento completato il codice beta viene attivato con la RPC
 *     canonica `attiva_codice_promo` (PRO + 1 anno + `is_beta_tester` + consumo
 *     del monouso) e un suo errore non interrompe il webhook;
 *  4. migrazioni: RPC `attiva_codice_promo` completa, seed `BETA1ANNO`
 *     (1anno/monouso) e colonna `profiles.provincia` (dato demografico);
 *  5. `services/healthCheck.ts`: il 401 in Guest è OK (JWT voluto), errore solo
 *     con sessione attiva;
 *  6. registrazione (ultimo passo del wizard): provincia raccolta e inviata,
 *     nota per gli account scolastici, errori `signUp` mostrati e non silenziosi.
 *
 * Uso: npm run test:checkout-promo
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const checkout = readFileSync('supabase/functions/checkout/index.ts', 'utf8');
const webhook = readFileSync('supabase/functions/webhook/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const health = readFileSync('src/services/healthCheck.ts', 'utf8');
const authModal = readFileSync('src/components/AuthModal.tsx', 'utf8');
const notaScuola = readFileSync('src/components/auth/NotaAccessoScolastico.tsx', 'utf8');
const provinciaCampo = readFileSync('src/components/auth/CampoProvincia.tsx', 'utf8');
const tipi = readFileSync('src/contexts/app/types.ts', 'utf8');
const azioni = readFileSync('src/contexts/app/useAzioniAccount.ts', 'utf8');
const anagrafica = readFileSync('src/contexts/app/useAnagraficaProfilo.ts', 'utf8');
const faq = readFileSync('src/pages/FAQPage.tsx', 'utf8');

/** Migrazione che aggiunge `profiles.provincia` (dato demografico). */
const MIGRAZIONE_PROVINCIA = '20260922120000_add_profiles_provincia.sql';
/** Tutto l'SQL delle migrazioni: RPC, seed e colonne in un unico testo. */
const sqlPromo = readdirSync('supabase/migrations')
  .sort()
  .filter((f) => f.endsWith('.sql'))
  .map((f) => readFileSync(`supabase/migrations/${f}`, 'utf8'))
  .join('\n');
const sqlProvincia = existsSync(`supabase/migrations/${MIGRAZIONE_PROVINCIA}`)
  ? readFileSync(`supabase/migrations/${MIGRAZIONE_PROVINCIA}`, 'utf8')
  : '';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Sezione `[functions.<nome>]` del config Supabase (stringa vuota se assente). */
function sezioneFunzione(nome: string): string {
  const m = config.match(new RegExp(`\\[functions\\.${nome}\\]([\\s\\S]*?)(\\n\\[|$)`));
  return m?.[1] ?? '';
}

/** Finestra di testo attorno a un marcatore (per isolare un ramo del codice). */
function attorno(testo: string, marcatore: string, lunghezza = 1400): string {
  const i = testo.indexOf(marcatore);
  return i < 0 ? '' : testo.slice(i, i + lunghezza);
}

console.log('— 1. config.toml: postura JWT delle funzioni —');
check(
  '[functions.checkout] verify_jwt = true (esplicito)',
  true,
  /verify_jwt\s*=\s*true/.test(sezioneFunzione('checkout')),
);
check(
  '[functions.telegram-admin-webhook] verify_jwt = false',
  true,
  /verify_jwt\s*=\s*false/.test(sezioneFunzione('telegram-admin-webhook')),
);

console.log('\n— 2. Edge checkout: BETA1ANNO validato e sul piano giusto —');
const ramoBeta = attorno(checkout, "codiceUpp === 'BETA1ANNO'");
check('ramo BETA1ANNO presente', true, ramoBeta.length > 0);
check('BETA1ANNO rifiutato fuori dal piano PRO annuale', true, /plan !== 'pro_annuale'/.test(ramoBeta));
check('BETA1ANNO consulta promo_codes prima del coupon', true, /statoPromoCodice\(codiceUpp\)/.test(ramoBeta));
check(
  'blocco quando il DB conosce il codice e lo rifiuta',
  true,
  /stato\.esiste && !stato\.spendibile/.test(ramoBeta),
);
check(
  'coupon applicato via discounts[0][coupon]',
  true,
  /campi\['discounts\[0\]\[coupon\]'\] = STRIPE_COUPON_BETA1ANNO/.test(ramoBeta),
);
check('mai promotion_code applicato dal codice', false, /\[promotion_code'\]\s*=/.test(checkout));
check("Coupon ID di default 'XRxitsVf'", true, /STRIPE_COUPON_BETA1ANNO = .*\?\?\s*'XRxitsVf'/.test(checkout));
check(
  "allow_promotion_codes rimosso quando c'è uno sconto (mutua esclusione)",
  true,
  /delete campi\['allow_promotion_codes'\]/.test(checkout),
);
check(
  'statoPromoCodice legge promo_codes con service_role',
  true,
  /\/rest\/v1\/promo_codes\?/.test(checkout) && /SUPABASE_SERVICE_ROLE/.test(checkout),
);
check(
  'statoPromoCodice controlla attivo/scadenza/monouso/usato',
  true,
  ['attivo', 'scade_il', 'monouso', 'usato_il'].every((campo) => checkout.includes(campo)),
);

console.log('\n— 3. Edge webhook: attivazione reale del codice beta —');
check(
  'CODICI_BETA = BETA1ANNO + BETALIFETIME',
  true,
  /const CODICI_BETA = \['BETA1ANNO', 'BETALIFETIME'\]/.test(webhook),
);
check('RPC canonica attiva_codice_promo', true, /\/rest\/v1\/rpc\/attiva_codice_promo/.test(webhook));
check('parametri RPC p_codice/p_user_id', true, /p_codice: codice, p_user_id: userId/.test(webhook));
check(
  'attivazione dopo checkout completato (paid o no_payment_required)',
  true,
  /no_payment_required/.test(webhook) && /obj\.payment_status === 'paid'/.test(webhook),
);
check(
  'errore RPC non interrompe il webhook (log, nessun throw)',
  true,
  /console\.error\(`attiva_codice_promo/.test(webhook) && /console\.warn\(/.test(webhook),
);

console.log('\n— 4. Database: RPC, seed e dato demografico —');
check(
  'RPC attiva_codice_promo definita nelle migrazioni',
  true,
  /create or replace function public\.attiva_codice_promo/.test(sqlPromo),
);
check('RPC porta PRO con scadenza a +1 anno', true, /now\(\) \+ interval '1 year'/.test(sqlPromo));
check('RPC marca is_beta_tester (retention)', true, /is_beta_tester = true/.test(sqlPromo));
check('RPC consuma il codice monouso', true, /usato_da = p_user_id/.test(sqlPromo));
check(
  'seed BETA1ANNO: tipo beta, durata 1anno, monouso',
  true,
  /'BETA1ANNO',\s*'beta', 100, 'pro', '1anno',\s*true/.test(sqlPromo),
);
check(`migrazione ${MIGRAZIONE_PROVINCIA} presente`, true, sqlProvincia.length > 0);
check(
  'profiles.provincia aggiunta con check sul codice',
  true,
  /add column if not exists provincia text/.test(sqlProvincia) && /profiles_provincia_check/.test(sqlProvincia),
);

console.log('\n— 5. System Health Check: 401 in Guest è OK —');
// Ramo isolato con precisione: dal controllo 401 fino al successivo (404), così
// il `warning` legittimo degli altri status non falsa la verifica.
const inizio401 = health.indexOf('if (status === 401)');
const ramo401 = health.slice(inizio401, health.indexOf('if (status === 404)', inizio401));
check('ramo 401 individuato', true, ramo401.length > 0);
check('401 in Guest = ok', true, /status: 'ok'/.test(ramo401));
check('401 con sessione attiva = errore', true, /status: 'error'/.test(ramo401));
check('nessun warning sul 401 (diagnosi onesta)', false, /status: 'warning'/.test(ramo401));

console.log('\n— 6. Registrazione (ultimo passo del wizard) —');
check('AuthModal raccoglie la provincia', true, /<CampoProvincia value=\{provincia\}/.test(authModal));
check('provincia inviata alla registrazione', true, /provincia: provincia \|\| null/.test(authModal));
check(
  'nota istituti scolastici nel modal di accesso',
  true,
  /<NotaAccessoScolastico onNavigate=\{closeAuthModal\}/.test(authModal),
);
check('nota con rimando FAQ Animatore Digitale', true, /\/faq#animatore-digitale/.test(notaScuola));
check('ancora animatore-digitale esistente nella FAQ', true, /animatore-digitale/.test(faq));
check(
  'prefill demografico dal wizard (genere/età/provincia)',
  true,
  /preferenze\.genere \?\? null/.test(authModal) && /preferenze\.provincia/.test(authModal),
);
check('register atteso con gestione errori (niente fallimenti silenziosi)', true, /if \(!esito\.ok\)/.test(authModal));
check(
  'tipo register async con esito',
  true,
  /register: \(u: User\) => Promise<\{ ok: boolean; errore\?: string \}>/.test(tipi),
);
check('User.provincia nel contesto', true, /provincia\?: string \| null;/.test(tipi));
check(
  'signUp ATTESO (non fire-and-forget) e tradotto',
  true,
  /await supabase\.auth\.signUp\(/.test(azioni) && /traduciErroreAuthSupabase\(error\)/.test(azioni),
);
check('provincia in user_metadata al signUp', true, /provincia: u\.provincia \?\? ''/.test(azioni));
check(
  'provincia salvata su profiles (con fallback colonna assente)',
  true,
  /provincia: provinciaFinale/.test(anagrafica) && new RegExp(MIGRAZIONE_PROVINCIA).test(anagrafica),
);
check('select provincia riusa il dataset ufficiale', true, /from '@\/data\/province'/.test(provinciaCampo));

console.log(
  '\n— 7. Coupon unico SCUOLERADAR50 → guardie dedicate in `npm run test:coupon` —',
);
check(
  'guardia coupon dedicata presente',
  true,
  readFileSync('scripts/test-coupon-scuoleradar50.ts', 'utf8').includes('SCUOLERADAR50'),
);
console.log(errori === 0 ? '\n✅ CHECKOUT & PROMO: nessun problema' : `\n❌ CHECKOUT & PROMO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

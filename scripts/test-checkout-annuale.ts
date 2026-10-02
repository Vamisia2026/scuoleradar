/**
 * Guardia CHIUSURA ANNUALE (coupon PROANNUALE40 + CTA di fine flusso).
 *
 * Direttiva cliente (28/09/2026): dopo la configurazione del Radar e nel benvenuto
 * PRO l'utente trova il pulsante in evidenza per il PRO Annuale a 40 € invece di 49 €,
 * collegato al checkout con il coupon `PROANNUALE40` già applicato.
 *
 * Estratta da `scripts/test-checkout-promo.ts` (portato a 266 righe, sopra la soglia
 * `W-DIM` di 250): le Edge Function girano su Deno e non sono importabili da `tsx`,
 * quindi anche qui la verifica è STATICA — legge sorgenti, CTA e checkout come testo.
 *
 * Invarianti protetti:
 *  1. il codice è dichiarato una sola volta nel client (`lib/promo.ts`) ed è accettato
 *     in pre-fill (deep link / campo coupon del passo di pagamento);
 *  2. la Edge `checkout` ha il ramo `PROANNUALE40`, SOLO sul piano `pro_annuale`,
 *     applicato via `discounts[0][coupon]` (mai `promotion_code`);
 *  3. se il coupon non è provisionato (secret assente) la risposta è un errore
 *     esplicito, MAI un addebito a listino al posto dello sconto promesso;
 *  4. il frontend invia SOLO il codice: la CTA è presentazione pura, gli importi
 *     vengono da `lib/pricing.ts` (nessuna cifra a mano) e la copy è quella esatta.
 *
 * Uso: npm run test:checkout:annuale (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';

const checkout = readFileSync('supabase/functions/checkout/index.ts', 'utf8');
const promoClient = readFileSync('src/lib/promo.ts', 'utf8');
const ctaAnnuale = readFileSync('src/departments/radar/components/CtaProAnnuale.tsx', 'utf8');
const benvenutoPro = readFileSync('src/departments/radar/components/BenvenutoProRadar.tsx', 'utf8');
const wizardRadar = readFileSync('src/departments/radar/RadarWizardModal.tsx', 'utf8');

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Finestra di testo attorno a un marcatore (per isolare un ramo del codice). */
function attorno(testo: string, marcatore: string, lunghezza = 1400): string {
  const i = testo.indexOf(marcatore);
  return i < 0 ? '' : testo.slice(i, i + lunghezza);
}

console.log('— Chiusura annuale: coupon PROANNUALE40 e CTA di fine flusso —');
check(
  'codice PROANNUALE40 dichiarato nel client e accettato in pre-fill',
  true,
  /PROMO_CODE_PRO_ANNUALE_40 = 'PROANNUALE40'/.test(promoClient) &&
    /PROMO_CODES_ATTIVI = \[[\s\S]{0,200}?PROMO_CODE_PRO_ANNUALE_40/.test(promoClient),
);
check('ramo PROANNUALE40 presente nella Edge checkout', true, /codiceUpp === 'PROANNUALE40'/.test(checkout));
const ramoAnnuale = attorno(checkout, "codiceUpp === 'PROANNUALE40'");
check('PROANNUALE40 solo sul piano PRO annuale', true, /plan !== 'pro_annuale'/.test(ramoAnnuale));
check(
  'PROANNUALE40 non configurato = errore esplicito (mai addebito a listino silenzioso)',
  true,
  /PROANNUALE40 non configurato: contatta il supporto/.test(ramoAnnuale) && /500/.test(ramoAnnuale),
);
check(
  'coupon applicato via discounts[0][coupon], mai via promotion_code',
  true,
  /discounts\[0\]\[coupon\]/.test(ramoAnnuale) && !/promotion_code/.test(ramoAnnuale),
);
/** Corpo del componente (i commenti citano `avviaCheckout` per documentarlo). */
const corpoCtaAnnuale = ctaAnnuale.slice(ctaAnnuale.indexOf('export function'));
check(
  'la CTA è presentazione pura: nessun checkout e nessun prezzo nel componente',
  true,
  !/avviaCheckout|priceId|price_id|line_items/.test(corpoCtaAnnuale),
);
check(
  'il frontend invia SOLO il codice del coupon',
  true,
  /avviaCheckout\('pro_annuale', PROMO_CODE_PRO_ANNUALE_40\)/.test(benvenutoPro) &&
    /avviaCheckout\('pro_annuale', PROMO_CODE_PRO_ANNUALE_40\)/.test(wizardRadar),
);
check(
  'CTA montata nella conferma post-configurazione e nel box di benvenuto PRO',
  true,
  /<CtaProAnnuale/.test(wizardRadar) && /<CtaProAnnuale/.test(benvenutoPro),
);
check(
  'copy esatta del pulsante annuale (mese scontato, primo anno)',
  true,
  ctaAnnuale.includes('Vuoi toglierti il pensiero e passare subito a PRO Annuale?') &&
    ctaAnnuale.includes("per tutto l'anno") &&
    ctaAnnuale.includes('invece di') &&
    /vale per il primo anno/.test(ctaAnnuale),
);
check(
  'importi della CTA dalle costanti di pricing (nessuna cifra a mano)',
  true,
  /\$\{PREZZO_PRO_ANNO_DOPO_OMAGGIO_ETICHETTA\}/.test(ctaAnnuale) &&
    /\$\{PREZZO_PRO_ANNUO_ETICHETTA\}/.test(ctaAnnuale) &&
    /SCONTO_OMAGGIO_MESE_EUR/.test(ctaAnnuale),
);
console.log(
  errori === 0 ? '\n✅ CHIUSURA ANNUALE: nessun problema' : `\n❌ CHIUSURA ANNUALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

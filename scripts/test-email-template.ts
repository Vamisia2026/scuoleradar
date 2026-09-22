/**
 * Verifica il REDESIGN del template email/Telegram:
 *  - niente frase ridondante "Ci è sembrata interessante…";
 *  - header con il LOGO reale della piattaforma (non testo generico);
 *  - titolo pulito dai "dump" di codici classe ("ADEE | A042 | …");
 *  - footer CRISP: link Radar visibile, CTA Notizie a due righe esatte,
 *    avviso "non rispondere" in ULTIMA riga, nessun blocco "P.S.";
 *  - oggetto email STANDARD "Nuove opportunità per te!".
 *
 * Uso: npm run test:email
 */
import {
  CTA_NOTIZIE_TESTO_EMAIL,
  OGGETTO_OPPORTUNITA,
  TESTO_NON_RISPOSTA,
  URL_NOTIZIE_VISIBILE,
  renderEmailHtml,
  subjectDigest,
  subjectNotifica,
  subjectOpportunita,
  subjectPerNotifica,
  type DettagliNotifica,
  type DestinatarioNotifica,
} from '../src/lib/resend.ts';
import { formattaMessaggioTelegram } from '../src/lib/telegram.ts';
import { pulisciTitoloAvviso } from '../src/lib/alertInterpello.ts';
import { getEmailScheda } from '../supabase/functions/_shared/emailTemplates.ts';
import { readFileSync } from 'node:fs';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const destinatario: DestinatarioNotifica = {
  email: 'docente@example.it',
  nome: 'Mario',
  province: ['TO'],
  classi: ['A-041'],
};
const interpello: DettagliNotifica = {
  id: 'test-1',
  title: 'ADEE | A042 | AAAA | ADAA | EEEE | A042 | ADMM',
  schoolName: 'ITIS A. Artom di Asti',
  province: 'Torino',
  classi: ['A-041'],
  materia: 'Matematica',
  scadenza: '2026-09-30',
  link: 'https://www.mim.gov.it/web/example',
  contactEmail: 'protocollo@example.edu.it',
};

console.log('— pulisciTitoloAvviso —');
check('dump solo codici → fallback', 'Interpello A-041 — Torino', pulisciTitoloAvviso(interpello.title, 'Interpello A-041 — Torino'));
check('titolo normale preservato', 'Interpello supplenza A-041 Matematica', pulisciTitoloAvviso('Interpello supplenza A-041 Matematica', 'x'));

console.log('\n— OGGETTO email STANDARD: "Nuove opportunità per te!" —');
check('costante standard', 'Nuove opportunità per te!', OGGETTO_OPPORTUNITA);
check('digest (qualsiasi numero di voci)', OGGETTO_OPPORTUNITA, subjectDigest(7));
check('digest con 1 voce', OGGETTO_OPPORTUNITA, subjectDigest(1));
check('opportunità con contesto', OGGETTO_OPPORTUNITA, subjectOpportunita({ classe: 'A-22', provincia: 'Torino' }));
check('opportunità senza contesto', OGGETTO_OPPORTUNITA, subjectOpportunita({}));
check('notifica_pro', OGGETTO_OPPORTUNITA, subjectPerNotifica('notifica_pro', { classe: 'A-22' }));
check('prova1/2/3', OGGETTO_OPPORTUNITA, subjectPerNotifica('prova1', { classe: 'A-026' }));
check('fallback mappa (subjectNotifica)', OGGETTO_OPPORTUNITA, subjectNotifica('notifica_pro'));
check(
  'messaggi di ciclo di vita: oggetto specifico invariato',
  true,
  subjectPerNotifica('welcome', { classe: 'A-22' }).startsWith('Scuole Radar — Benvenuto'),
);

console.log('\n— BENVENUTO post-registrazione: promo MESE PRO (niente piano Base) —');
/*
 * Il trigger DB `trg_auth_users_step1_welcome` chiama la Edge `send-notification`
 * con tipo `step1`, che consegna il copy di `conferma_base`. I testi della Edge non
 * sono esportati: la guardia lavora sul BLOCCO di codice, così copre anche gli
 * eventuali residui di copy (account Base, quota di segnalazioni).
 */
const VIETATE_BENVENUTO = [
  /account Base/i,
  /piano Base/i,
  /piano gratuito/i,
  /3 segnalazioni/i,
  /tornare al piano/i,
];
const sorgenteEdge = readFileSync('supabase/functions/send-notification/index.ts', 'utf8');
const inizioBenvenuto = sorgenteEdge.indexOf('  conferma_base: {');
const fineBenvenuto = sorgenteEdge.indexOf('  conferma_attivazione: {');
const bloccoBenvenuto =
  inizioBenvenuto >= 0 && fineBenvenuto > inizioBenvenuto
    ? sorgenteEdge.slice(inizioBenvenuto, fineBenvenuto)
    : '';
check('Edge: blocco `conferma_base` trovato', true, bloccoBenvenuto.length > 200);
check(
  'Edge: `step1` (trigger DB) riusa lo stesso copy di `conferma_base`',
  true,
  /TESTI\.step1 = \{ \.\.\.TESTI\.conferma_base \};/.test(sorgenteEdge),
);
check(
  'Edge: benvenuto senza riferimenti al piano Base / quota di segnalazioni',
  [],
  VIETATE_BENVENUTO.filter((re) => re.test(bloccoBenvenuto)).map(String),
);
check('Edge: conferma il mese di PRO in omaggio', true, /mese di PRO in omaggio/.test(bloccoBenvenuto));
check('Edge: vantaggi "senza restrizioni"', true, /senza restrizioni/.test(bloccoBenvenuto));
check(
  'Edge: elenca i 4 strumenti attivi',
  true,
  ['Radar Scuole', 'Modulistica', 'Crea CV', 'Calcolatore CFU'].every((s) => bloccoBenvenuto.includes(s)),
);

// Template centralizzato (pannello Admin + tipo `email_1_1_onboarding`).
const schedaOnboarding = getEmailScheda('email_1_1_onboarding', { nome: 'Maria' });
check('template onboarding: oggetto col mese PRO', true, /mese di PRO/.test(schedaOnboarding.soggetto));
check(
  'template onboarding: nessun riferimento al piano Base',
  [],
  VIETATE_BENVENUTO.filter((re) => re.test(schedaOnboarding.testo)).map(String),
);
check(
  'template onboarding: 4 strumenti + CTA Radar',
  true,
  ['Radar Scuole', 'Modulistica', 'Crea CV', 'Calcolatore CFU', 'ATTIVA IL TUO RADAR'].every((s) =>
    schedaOnboarding.testo.includes(s),
  ),
);

// Renderer email Node (`src/lib/resend.ts`, tipo `welcome`).
const htmlBenvenuto = renderEmailHtml(null, destinatario, 'https://www.scuoleradar.it/dashboard', 'welcome');
check(
  'email welcome: nessun riferimento al piano Base',
  [],
  VIETATE_BENVENUTO.filter((re) => re.test(htmlBenvenuto)).map(String),
);
check('email welcome: mese di PRO in omaggio', true, htmlBenvenuto.includes('mese di PRO in omaggio'));
check(
  'email welcome: 4 strumenti elencati',
  true,
  ['Radar Scuole', 'Modulistica', 'Crea CV', 'Calcolatore CFU'].every((s) => htmlBenvenuto.includes(s)),
);

console.log('\n— Email HTML (notifica_pro) —');
const html = renderEmailHtml(interpello, destinatario, 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('niente frase ridondante', false, html.includes('Ci è sembrata interessante'));
check('niente "valesse la pena"', false, html.includes('valesse la pena'));
check('niente frase generica "Abbiamo trovato una nuova opportunità"', false, html.includes('Abbiamo trovato una nuova opportunità'));
check('niente dump di codici classe', false, html.includes('ADEE | A042 | AAAA'));
check('titolo pulito nel corpo', true, html.includes('Interpello A-041 — Torino'));
check('logo reale (img logo.png)', true, html.includes('src="https://www.scuoleradar.it/logo.png"'));
check('logo COMPATTO (32 px, nessun 200 px)', true, html.includes('width="32" height="32"') && !html.includes('width="200"'));
check('brand testuale accanto al logo', true, html.includes('Scuole Radar.it'));
check('niente header testuale "📡 ScuoleRadar"', false, html.includes('📡 ScuoleRadar'));
check('niente vecchio disclaimer "non desideri ricevere"', false, html.includes('Se non desideri ricevere'));

console.log('\n— FOOTER email: link Radar visibile + CTA Notizie + avviso finale —');
check(
  'link Radar VISIBILE (URL in chiaro)',
  true,
  html.includes('modifica il tuo radar su <a href="https://www.scuoleradar.it/dashboard"') &&
    html.includes('>https://www.scuoleradar.it/dashboard</a>'),
);
check('etichetta "modifica il tuo radar"', true, html.includes('modifica il tuo radar su'));
check(
  'preferenze Radar in PICCOLO nel footer (non è la CTA del messaggio)',
  true,
  html.includes('font-size:12.5px; line-height:1.55; color:#475569;">Se questi risultati non corrispondono'),
);
check('nessuna nota grigia sbiadita (#94a3b8)', false, html.includes('#94a3b8'));
check('nessun blocco "P.S."', false, /\bP\.S\./.test(html));
check(
  'CTA Notizie: riga URL breve esatta',
  true,
  html.includes(`>${URL_NOTIZIE_VISIBILE}</a>`) && html.includes('https://www.scuoleradar.it/notizie'),
);
check('CTA Notizie: seconda riga esatta', true, html.includes(CTA_NOTIZIE_TESTO_EMAIL));
check('CTA Notizie senza 📌 (formato email richiesto)', false, html.includes('📌'));
check('avviso "non rispondere" presente', true, html.includes(TESTO_NON_RISPOSTA));
{
  // Dopo l'avviso non c'è più TESTO (solo tag di chiusura): è l'ultima riga.
  const dopo = html.slice(html.indexOf(TESTO_NON_RISPOSTA) + TESTO_NON_RISPOSTA.length);
  const dopoSenzaTag = dopo.replace(/<[^>]*>/g, '').trim();
  check('avviso "non rispondere" in ULTIMA riga (nessun testo dopo)', '', dopoSenzaTag);
}
check(
  "bottone di fonte standard '👉 Apri l'avviso ufficiale'",
  true,
  html.includes("👉 Apri l'avviso ufficiale"),
);
// Checklist email §4/§5: nessun box giallo, link ufficiale IN EVIDENZA nella card e
// CTA primaria che porta allo STESSO annuncio (dato dello scraper).
check('nessun riquadro giallo di avviso (checklist §4)', false, html.includes('#fffbeb'));
check(
  'link ufficiale IN EVIDENZA nella card (scatola blu brand)',
  true,
  html.includes('background:#f2f9fd') && html.includes(`href="${interpello.link}"`),
);
check(
  'CTA primaria = annuncio ufficiale (stesso URL del link in evidenza)',
  true,
  html.includes(`<a href="${interpello.link}" class="cta"`),
);

console.log('\n— Telegram (notifica_pro) —');
const tg = formattaMessaggioTelegram(interpello, 'A-041', 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('niente frase ridondante', false, tg.includes('Ci è sembrata interessante'));
check('titolo pulito', true, tg.includes('Interpello A-041 — Torino'));

console.log(errori === 0 ? '\n✅ EMAIL TEMPLATE: nessun problema' : `\n❌ EMAIL TEMPLATE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

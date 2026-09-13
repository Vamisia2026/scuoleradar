/**
 * Verifica il REDESIGN del template email/Telegram:
 *  - niente frase ridondante "Ci è sembrata interessante…";
 *  - header con il LOGO reale della piattaforma (non testo generico);
 *  - titolo pulito dai "dump" di codici classe ("ADEE | A042 | …");
 *  - footer preferenze con link a /dashboard/radar;
 *  - notice automatico "non è monitorata".
 *
 * Uso: npm run test:email
 */
import { renderEmailHtml, type DettagliNotifica, type DestinatarioNotifica } from '../src/lib/resend.ts';
import { formattaMessaggioTelegram } from '../src/lib/telegram.ts';
import { pulisciTitoloAvviso } from '../src/lib/alertInterpello.ts';

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

console.log('\n— Email HTML (notifica_pro) —');
const html = renderEmailHtml(interpello, destinatario, 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('niente frase ridondante', false, html.includes('Ci è sembrata interessante'));
check('niente "valesse la pena"', false, html.includes('valesse la pena'));
check('niente dump di codici classe', false, html.includes('ADEE | A042 | AAAA'));
check('titolo pulito nel corpo', true, html.includes('Interpello A-041 — Torino'));
check('logo reale (img logo.png)', true, html.includes('src="https://www.scuoleradar.it/logo.png"'));
check('niente header testuale "📡 ScuoleRadar"', false, html.includes('📡 ScuoleRadar'));
check('footer: "modifica il radar qui"', true, html.includes('modifica il radar qui'));
check('footer: link /dashboard/radar', true, html.includes('https://www.scuoleradar.it/dashboard/radar'));
check('notice: "non è monitorata"', true, html.includes('non è monitorata'));
check('niente vecchio disclaimer "non desideri ricevere"', false, html.includes('Se non desideri ricevere'));

console.log('\n— Telegram (notifica_pro) —');
const tg = formattaMessaggioTelegram(interpello, 'A-041', 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('niente frase ridondante', false, tg.includes('Ci è sembrata interessante'));
check('titolo pulito', true, tg.includes('Interpello A-041 — Torino'));

console.log(errori === 0 ? '\n✅ EMAIL TEMPLATE: nessun problema' : `\n❌ EMAIL TEMPLATE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

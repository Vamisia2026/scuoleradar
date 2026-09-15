/**
 * Verifica LINK & ROUTING degli avvisi:
 *  · etichette ONESTE (mai "Candidati" se il link è un Albo Pretorio/avviso);
 *  · UN SOLO link alla fonte in email e Telegram (nessun duplicato);
 *  · deep link `/interpello/:id` risolto davvero (rotta presente in App.tsx) e
 *    chiave corretta (uuid → `id`, hash → `hash_id`).
 *
 * Uso: npm run test:link
 */
import { readFileSync } from 'node:fs';
import {
  classificaFonteLink,
  etichettaFonteLink,
  costruisciAvviso,
  eLinkEsterno,
  urlEsterna,
} from '../src/lib/alertInterpello.ts';
import { linkOpportunita, renderEmailHtml, type DettagliNotifica, type DestinatarioNotifica } from '../src/lib/resend.ts';
import { formattaMessaggioTelegram } from '../src/lib/telegram.ts';
import { chiaveInterpelloDaParam, eUuid } from '../src/lib/interpelloRouting.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
/** Conteggio delle occorrenze (non sovrapposte) di una sottostringa. */
function occorrenze(testo: string, ago: string): number {
  return testo.split(ago).length - 1;
}

const ALBO = 'https://www.mim.gov.it/albo-pretorio/avviso-augusto-monti.pdf';
const AVVISO = 'https://www.mim.gov.it/web/usr-lombardia/-/interpelli-supplenze';

console.log('— Etichette ONESTE del link di fonte —');
check('classifica PDF', 'pdf', classificaFonteLink(ALBO));
check('classifica Albo', 'albo', classificaFonteLink('https://x.it/albo-pretorio/2026/avviso-123'));
check('classifica avviso (default)', 'avviso', classificaFonteLink(AVVISO));
check('etichetta PDF', 'Apri il bando ufficiale (PDF)', etichettaFonteLink(ALBO));
check(
  'etichetta Albo Pretorio',
  "Apri l'avviso sull'Albo Pretorio",
  etichettaFonteLink('https://x.it/albo-pretorio/2026/avviso-123'),
);
check('etichetta avviso ufficiale', "Apri l'avviso ufficiale", etichettaFonteLink(AVVISO));
check(
  'etichetta scheda dell\'avviso su fonte ESTERNA',
  "Apri la scheda dell'avviso",
  etichettaFonteLink('https://www.usp-asti.gov.it/interpello/abc'),
);
// Un URL della PIATTAFORMA non è una fonte: l'etichetta non deve suggerirlo.
check(
  'URL interno della piattaforma non è una "scheda dell\'avviso"',
  true,
  eLinkEsterno('https://www.scuoleradar.it/interpello/abc') === false &&
    etichettaFonteLink('https://www.scuoleradar.it/interpello/abc') !== "Apri la scheda dell'avviso",
);
check(
  'MAI "candidati" in nessuna etichetta',
  true,
  [ALBO, AVVISO, 'https://x.it/albo-pretorio/1', '', '/interpello/x'].every(
    (u) => !/candidat/i.test(etichettaFonteLink(u)),
  ),
);

// Scheda strutturata: deve esistere e non introdurre placeholder grezzi.
const avviso = costruisciAvviso({ provincia: 'Torino', classCode: 'A-041', scadenza: '2026-09-30' });
check('avviso completo', true, avviso.completo);

const destinatario: DestinatarioNotifica = {
  email: 'docente@example.it',
  nome: 'Mario',
  province: ['TO'],
  classi: ['A-041'],
};
const interpello: DettagliNotifica = {
  id: 'abc123hash',
  title: 'Interpello supplenza A-041 Matematica - Liceo Augusto Monti',
  schoolName: 'Liceo Augusto Monti',
  province: 'Torino',
  classi: ['A-041'],
  materia: 'Matematica',
  scadenza: '2026-09-30',
  link: ALBO,
  contactEmail: 'segreteria@liceoaugustomonti.edu.it',
};

console.log('\n— Email: UN SOLO link alla fonte + etichetta onesta —');
const html = renderEmailHtml(interpello, destinatario, 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('un solo anchor verso la fonte', 1, occorrenze(html, ALBO));
// "Candidature:" è l'etichetta dell'email della scuola (legittima): il divieto
// riguarda i BOTTONI/link, non l'etichetta del contatto.
check('nessun bottone "candidati"', false, /candidat/i.test(html.replace(/Candidature:/g, '')));
check('CTA onesta (PDF)', true, html.includes('Apri il bando ufficiale (PDF)'));
check('niente vecchia dicitura Albo+candidati', false, html.includes('Fonte ufficiale verificata (Albo Pretorio)'));
check('email candidature presente (mailto)', true, html.includes('mailto:segreteria@liceoaugustomonti.edu.it'));

console.log('\n— Telegram: UN SOLO link alla fonte + etichetta onesta —');
const tg = formattaMessaggioTelegram(interpello, 'A-041', 'https://www.scuoleradar.it/dashboard', 'notifica_pro');
check('un solo link alla fonte', 1, occorrenze(tg, ALBO));
check('nessun link "candidati"', false, /candidat/i.test(tg.replace(/Candidature:/g, '')));
check('etichetta onesta nel bottone', true, tg.includes('Apri il bando ufficiale (PDF)'));

console.log('\n— POLICY DI ROUTING: mai un link interno della piattaforma —');
check('fonte esterna accettata', ALBO, linkOpportunita(interpello));
const senzaFonte = linkOpportunita({ ...interpello, link: null });
check('nessuna fonte → nessuna CTA interna', '', senzaFonte);
check('link interno ScuoleRadar rifiutato come fonte', '', linkOpportunita({ ...interpello, link: 'https://www.scuoleradar.it/interpello/abc123hash' }));
check('dashboard rifiutata come fonte', '', linkOpportunita({ ...interpello, link: 'https://scuoleradar.it/dashboard/radar' }));
check('URL di prova rifiutato come fonte', '', linkOpportunita({ ...interpello, link: 'https://example.com/avviso' }));
check('urlEsterna: solo http(s) esterni', null, urlEsterna('https://www.scuoleradar.it/interpello/x'));

const DASH_URL = 'https://www.scuoleradar.it/dashboard/radar';
const emailSenzaFonte = renderEmailHtml({ ...interpello, link: null }, destinatario, DASH_URL, 'notifica_pro');
check('email senza fonte: nessun link a /interpello/', false, emailSenzaFonte.includes('/interpello/'));
check('email senza fonte: CTA esplicita verso il Radar', true, emailSenzaFonte.includes('Apri il tuo Radar Scuole'));
check('email senza fonte: email della scuola presente', true, emailSenzaFonte.includes('mailto:segreteria@liceoaugustomonti.edu.it'));
const tgSenzaFonte = formattaMessaggioTelegram({ ...interpello, link: null }, 'A-041', DASH_URL, 'notifica_pro');
check('Telegram senza fonte: nessun link a /interpello/', false, tgSenzaFonte.includes('/interpello/'));
check('Telegram senza fonte: CTA esplicita verso il Radar', true, tgSenzaFonte.includes('Apri il tuo Radar Scuole'));

console.log('\n— Deep link LEGACY `/interpello/:id` (rotta storica + risoluzione chiave) —');
check(
  'id uuid → colonna id',
  { colonna: 'id', valore: '3f2504e0-4f89-11d3-9a0c-0305e82c3301' },
  chiaveInterpelloDaParam('3F2504E0-4F89-11D3-9A0C-0305E82C3301'),
);
check('hash → colonna hash_id', { colonna: 'hash_id', valore: 'abc123hash' }, chiaveInterpelloDaParam('/abc123hash/'));
check('param vuoto → null', null, chiaveInterpelloDaParam('   '));
check('eUuid("abc")', false, eUuid('abc'));

const app = readFileSync('src/App.tsx', 'utf8');
check('rotta /interpello/:id ancora registrata (link storici)', true, /path="\/interpello\/:id"/.test(app));

console.log(errori === 0 ? '\n✅ LINK & ROUTING: nessun problema' : `\n❌ LINK & ROUTING: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

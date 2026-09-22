/**
 * Verifica il GATE DI QUALITÀ STRICT dell'invio e l'INTEGRITÀ delle fonti:
 *  1. BRAND in testa a ogni messaggio Telegram (riga compatta cliccabile) e
 *     anteprime/immagini SEMPRE disattivate (nessun riquadro "gigante");
 *  2. LINK DIRETTO: "👉 Apri l'avviso ufficiale" punta all'URL esatto dell'avviso,
 *     mai a una home, a una pagina di ricerca/elenco o a un archivio regionale;
 *  3. GATE: gli avvisi senza link diretto o senza recapito di candidatura vengono
 *     SCARTATI dal dispatch (nessun avviso incompleto parte);
 *  4. MAPPATURA PROVINCE: i capoluoghi "composti" (es. Forlì → FC) non ricadono
 *     sulla provincia della fonte (era il bug "alert di Torino da Forlì-Cesena");
 *  5. CTA Notizie: le due righe esatte, in Telegram, email e Edge;
 *  6. CTA Radar: frequenza ~20%, non più in ogni comunicazione.
 *
 * Uso: npm run test:qualita
 */
import { readFileSync } from 'node:fs';
import {
  avvisoInviabile,
  eUrlAvvisoDiretto,
  motivoAvvisoNonInviabile,
} from '../src/lib/alertInterpello.ts';
import {
  deveMostrareCtaRadar,
  formattaMessaggioTelegram,
  FREQUENZA_CTA_RADAR,
} from '../src/lib/telegram.ts';
import { estraiProvincia, scegliUrlFonte } from '../src/scraper/parser.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const BRAND = '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>';
const CTA_NOTIZIE =
  '📌 https://www.scuoleradar.it/notizie\nQuando vuoi sapere cosa succede di importante nella scuola, vieni qui';

console.log('— Link DIRETTO all’avviso (mai home, elenchi o ricerche) —');
check('PDF ufficiale → diretto', true, eUrlAvvisoDiretto('https://www.mim.gov.it/albo-pretorio/avviso-a022.pdf'));
check('pagina avviso dell’ente → diretta', true, eUrlAvvisoDiretto('https://www.usp-asti.gov.it/interpelli/avviso-a022'));
check('circolare USR datata → diretta', true, eUrlAvvisoDiretto('https://www.istruzioneer.gov.it/2026/09/15/interpello-supplenze/'));
check('home dell’ente → NON diretta', false, eUrlAvvisoDiretto('https://www.istruzionepiemonte.it/'));
check('landing regionale → NON diretta', false, eUrlAvvisoDiretto('https://www.scuolainterpelli.it/interpelli-lombardia/'));
check('tag/elenco regionale → NON diretta', false, eUrlAvvisoDiretto('https://www.scuolainterpelli.it/tag/interpelli-scuola-piemonte/'));
check('post-archivio giornaliero → NON diretta', false, eUrlAvvisoDiretto('https://www.scuolainterpelli.it/interpelli-scuola-2026-09-17/'));
check('pagina di ricerca → NON diretta', false, eUrlAvvisoDiretto('https://www.usp-asti.gov.it/?s=interpello'));
check('elenco/archivio del sito → NON diretta', false, eUrlAvvisoDiretto('https://www.scuolainterpelli.it/elenco/avvisi/'));
check('URL della piattaforma → NON diretta', false, eUrlAvvisoDiretto('https://www.scuoleradar.it/interpello/abc123'));
check('URL assente → NON diretta', false, eUrlAvvisoDiretto(null));
// DESTINAZIONI AMMESSE dal prodotto: la pagina tabellare/"Stampa" del SINGOLO
// avviso (non un archivio) e i documenti ufficiali restano dirette.
check(
  'pagina tabellare "Stampa" del singolo avviso → diretta',
  true,
  eUrlAvvisoDiretto('https://www.usp-asti.gov.it/interpelli/stampa?cod=ASTF01000X'),
);

console.log('\n— GATE STRICT: link diretto ED email di candidatura obbligatori —');
check('link diretto + email → inviabile', true, avvisoInviabile({
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
  email: 'attf01000x@istruzione.it',
}));
check('link diretto ma senza email → SCARTATO', false, avvisoInviabile({
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
  email: null,
}));
check('email valida ma link non diretto → SCARTATO', false, avvisoInviabile({
  link: 'https://www.scuolainterpelli.it/interpelli-lombardia/',
  email: 'attf01000x@istruzione.it',
}));
check('motivo: fonte non diretta', 'fonte ufficiale non diretta', motivoAvvisoNonInviabile({
  link: 'https://www.istruzionepiemonte.it/',
  email: 'attf01000x@istruzione.it',
}));
check('motivo: recapito mancante', 'recapito di candidatura mancante', motivoAvvisoNonInviabile({
  link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
  email: 'non-una-email',
}));

console.log('\n— MAPPATURA PROVINCE: capoluoghi “composti” (bug Forlì → FC) —');
check('Forlì → FC (non TO)', 'FC', estraiProvincia('Interpello supplenza A-022 — Liceo di Forlì'));
check('Forlì a inizio titolo → FC', 'FC', estraiProvincia('Forlì: interpello A-022 Matematica'));
check('Cesena → FC', 'FC', estraiProvincia('Interpello A-022 presso Cesena'));
check('Monza → MB', 'MB', estraiProvincia('Interpello A-022 - Monza'));
check('Pesaro → PU', 'PU', estraiProvincia('Interpello A-022 presso Pesaro'));
check('Barletta → BT', 'BT', estraiProvincia('Interpello A-022 - Barletta'));
check('Carbonia → SU', 'SU', estraiProvincia('Interpello A-022 di Carbonia'));
check('La Spezia → SP', 'SP', estraiProvincia('Interpello A-022 - La Spezia'));

console.log('\n— FONTE: mai una home/elenco regionale come “avviso ufficiale” —');
check(
  'nessun candidato diretto → nessun link',
  null,
  scegliUrlFonte(
    ['https://www.istruzionepiemonte.it/', 'https://www.scuolainterpelli.it/interpelli-lombardia/'],
    { provincia: 'TO' },
  ),
);
check(
  'senza candidati → nessun fallback alla home dell’ente',
  null,
  scegliUrlFonte([], { provincia: 'TO' }),
);
check(
  'il candidato diretto vince sull’elenco',
  'https://www.usp-asti.gov.it/interpelli/avviso-a022',
  scegliUrlFonte(
    ['https://www.scuolainterpelli.it/interpelli-lombardia/', 'https://www.usp-asti.gov.it/interpelli/avviso-a022'],
    { provincia: 'TO' },
  ),
);

console.log('\n— Telegram: brand in testa, zero media, anteprime disattivate —');
const tg = formattaMessaggioTelegram(
  {
    id: 'hash-qualita-1',
    title: 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti',
    schoolName: 'Liceo Augusto Monti',
    province: 'AT',
    classi: ['A-022'],
    materia: null,
    scadenza: '2099-12-31',
    link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022',
    contactEmail: 'attf01000x@istruzione.it',
  },
  'A-022',
  'https://www.scuoleradar.it/dashboard/radar',
  'notifica_pro',
);
check('prima riga = testata brand', true, tg.startsWith(BRAND));
check('brand una sola volta', 1, tg.split(BRAND).length - 1);
check('CTA Notizie a due righe (esatte)', true, tg.includes(CTA_NOTIZIE));
const sorgenteTelegram = readFileSync('src/lib/telegram.ts', 'utf8');
check(
  'nessun invio di media (sendPhoto/sendMediaGroup)',
  false,
  /sendPhoto|sendMediaGroup|sendDocument/.test(sorgenteTelegram),
);
check('anteprime disattivate (link_preview_options)', true, /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(sorgenteTelegram));
check('fallback disable_web_page_preview: true', true, /disable_web_page_preview:\s*true/.test(sorgenteTelegram));
check(
  'garanzia di brand anche nel layer di invio (idempotente)',
  true,
  /testo\.startsWith\(BRAND_RIGA_TELEGRAM\)/.test(sorgenteTelegram),
);

console.log('\n— CTA Radar: frequenza ~20% (non più in ogni messaggio) —');
check('costante di frequenza = 0.2', 0.2, FREQUENZA_CTA_RADAR);
check('stesso seme → stessa decisione', true, (() => {
  const primo = deveMostrareCtaRadar('hash-qualita-1');
  return [0, 1, 2, 3, 4].every(() => deveMostrareCtaRadar('hash-qualita-1') === primo);
})());
{
  const campione = 500;
  let conCta = 0;
  for (let i = 0; i < campione; i += 1) {
    if (deveMostrareCtaRadar(`avviso-${i}`)) conCta += 1;
  }
  const quota = conCta / campione;
  check('quota entro 10%–32%', true, quota >= 0.1 && quota <= 0.32);
}

console.log('\n— Edge/Webhook: brand + anteprime disattivate ovunque —');
const edge = readFileSync('supabase/functions/send-notification/index.ts', 'utf8');
check('Edge: brand cliccabile', true, edge.includes(BRAND));
check('Edge: anteprime disattivate', true, /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(edge));
check('Edge: gate di qualità presente', true, /motivoAvvisoNonInviabile/.test(edge));
const webhook = readFileSync('supabase/functions/telegram-webhook/index.ts', 'utf8');
check('Telegram webhook: brand cliccabile', true, webhook.includes(BRAND));
check(
  'Telegram webhook: anteprime disattivate',
  true,
  /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(webhook),
);
const adminWebhook = readFileSync('supabase/functions/telegram-admin-webhook/index.ts', 'utf8');
check('Admin webhook: brand cliccabile', true, adminWebhook.includes(BRAND));
check(
  'Admin webhook: anteprime disattivate',
  true,
  /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(adminWebhook),
);

console.log(errori === 0 ? '\n✅ QUALITÀ INVIO: nessun problema' : `\n❌ QUALITÀ INVIO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * TEST — DIGEST GIORNALIERO (Step 2).
 * -----------------------------------------------------------------
 * Verifica il RIEPILOGO UNICO delle opportunità che sostituisce l'invio in tempo
 * reale (N email al giorno):
 *   · finestra di invio: 18:00 italiane calcolate su fuso Europe/Rome (estate e
 *     inverno) — il cron gira in UTC, quindi il guard è nel codice;
 *   · ordinamento per scadenza più vicina + raggruppamento per provincia;
 *   · UNA sola email con TUTTE le voci (link ESTERNI, email scuola, guida);
 *   · UN solo messaggio Telegram, entro il limite di caratteri della Bot API.
 *
 * Esecuzione: npm run test:digest
 */

import { ISTRUZIONE_AVVISO_UFFICIALE } from '../src/lib/alertInterpello.ts';
import {
  ORA_DIGEST,
  dataLocaleItalia,
  eOraDelDigest,
  etichettaDataItalia,
  oraLocaleItalia,
  ordinaVociDigest,
  raggruppaPerProvincia,
} from '../src/lib/digest.ts';
import {
  MAX_VOCI_EMAIL_DIGEST,
  renderDigestEmailHtml,
  subjectDigest,
  type DettagliNotifica,
  type DestinatarioNotifica,
} from '../src/lib/resend.ts';
import { formattaDigestTelegram, formattaMessaggioTelegram, testataDigest } from '../src/lib/telegram.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const ESTERNO = 'https://www.usp-asti.gov.it/interpelli/avviso-a022';
const ELENCO = 'https://www.liceoaugustomonti.edu.it/albo/stampa?classe=A022';

const destinatario: DestinatarioNotifica = {
  email: 'docente@example.it',
  nome: 'Mario',
  province: ['AT'],
  classi: ['A-022'],
};

/** Voce di prova: fonte ESTERNA dettagliata. */
function voce(indice: number, scadenza: string | null, link: string = ESTERNO): DettagliNotifica {
  return {
    id: `hash-${indice}`,
    title: `Interpello supplenza A-022 n.${indice}`,
    schoolName: 'Liceo Augusto Monti',
    province: 'AT',
    classi: ['A-022'],
    materia: 'Matematica',
    scadenza,
    link,
    contactEmail: 'astf01000x@istruzione.it',
  };
}

console.log('— Finestra di invio (17:00 italiane, cron in UTC) —');
check('ora configurata = 17:00', 17, ORA_DIGEST);
check('estate: 15:00Z = 17:00 italiane', true, eOraDelDigest(new Date('2026-07-10T15:00:00Z')));
check('inverno: 16:00Z = 17:00 italiane', true, eOraDelDigest(new Date('2026-01-15T16:00:00Z')));
check(
  'le 18:00 italiane NON sono più la finestra',
  false,
  eOraDelDigest(new Date('2026-07-10T16:00:00Z')),
);
check('mattina: 10:00Z non è l\'ora del digest', false, eOraDelDigest(new Date('2026-07-10T10:00:00Z')));
check('forzato → sempre vero', true, eOraDelDigest(new Date('2026-07-10T10:00:00Z'), true));
check('ora locale Roma (15:00Z estate)', 17, oraLocaleItalia(new Date('2026-07-10T15:00:00Z')));
check('ora locale Roma (16:00Z inverno)', 17, oraLocaleItalia(new Date('2026-01-15T16:00:00Z')));
check('data italiana ISO', '2026-07-10', dataLocaleItalia(new Date('2026-07-10T16:00:00Z')));
check('etichetta data italiana', '10 luglio 2026', etichettaDataItalia(new Date('2026-07-10T16:00:00Z')));

console.log('\n— Ordinamento e raggruppamento delle voci —');
const ordinate = ordinaVociDigest([
  voce(1, null),
  voce(2, '2026-09-30'),
  voce(3, '2026-09-18'),
]);
check('scadenza più vicina in cima', ['hash-3', 'hash-2', 'hash-1'], ordinate.map((v) => v.id));
const perProvincia = raggruppaPerProvincia([voce(1, '2026-09-30'), { ...voce(2, '2026-09-20'), province: 'MI' }]);
check('due gruppi per provincia', 2, perProvincia.size);
check('gruppo AT presente', true, perProvincia.has('AT'));

console.log('\n— Oggetto dell\'email —');
check(
  'una sola opportunità',
  'ScuoleRadar — Oggi abbiamo trovato 1 opportunità per te',
  subjectDigest(1),
);
check(
  'più opportunità (conteggio)',
  'ScuoleRadar — Oggi abbiamo trovato 3 opportunità per te',
  subjectDigest(3),
);
check(
  'formula richiesta (letterale)',
  'ScuoleRadar — Oggi abbiamo trovato 2 opportunità per te',
  subjectDigest(2),
);
check(
  'la testata Telegram usa la stessa formula',
  true,
  testataDigest(2).includes('ScuoleRadar — Oggi abbiamo trovato 2 opportunità per te'),
);

console.log('\n— Email di digest: UNA sola email con tutte le voci —');
const voci = [voce(1, '2026-09-30'), voce(2, '2026-09-18', ELENCO)];
const html = renderDigestEmailHtml(voci, destinatario, 'https://www.scuoleradar.it/dashboard/radar', {
  data: '10 luglio 2026',
});
check('titolo voce 1 presente', true, html.includes('Interpello supplenza A-022 n.1'));
check('titolo voce 2 presente', true, html.includes('Interpello supplenza A-022 n.2'));
check('fonte ESTERNA cliccabile', true, html.includes(`href="${ESTERNO}"`));
check('nessun link interno /interpello/', false, html.includes('/interpello/'));
check('email scuola cliccabile', true, html.includes('mailto:astf01000x@istruzione.it'));
check('guida operativa sull\'elenco', true, html.includes('cerca la riga con «A-022»'));
check('spiega la cadenza giornaliera', true, html.includes('una volta al giorno'));
check('CTA verso il Radar', true, html.includes('Apri il tuo Radar Scuole'));
// Layout "crisp": voci NUMERATE nell'email (come nel messaggio Telegram).
check('voci numerate nell\'email', true, />1\.<\/span>\s*Interpello/.test(html));
// Guida standardizzata (Step 2): l'istruzione STAMPA è presente anche nella
// versione compatta usata dal digest. NB: in HTML l'apostrofo è escapato.
check(
  'direttiva STAMPA standard nel digest',
  true,
  html.includes(ISTRUZIONE_AVVISO_UFFICIALE.replace(/'/g, '&#39;')),
);
// La versione compatta NON ripete l'email (è già sulla riga precedente).
check(
  'guida compatta senza ripetizione dell\'email',
  false,
  /scrivere direttamente a/.test(html),
);

const molte = Array.from({ length: MAX_VOCI_EMAIL_DIGEST + 4 }, (_, i) => voce(i + 1, '2026-09-30'));
const htmlMolte = renderDigestEmailHtml(molte, destinatario, 'https://www.scuoleradar.it/dashboard/radar');
check('numero voci limitato nell\'email', false, htmlMolte.includes(`n.${MAX_VOCI_EMAIL_DIGEST + 1}`));
check('nota sulle opportunità restanti', true, htmlMolte.includes('altre <strong>4</strong> opportunità'));

console.log('\n— Raggruppamento per urgenza (solo con più gruppi) —');
// Date RELATIVE a oggi: le soglie sono 2 e 7 giorni (semaforo dell'app).
const fraGiorni = (n: number): string =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const miste = [voce(1, fraGiorni(1)), voce(2, fraGiorni(20))];
const htmlMiste = renderDigestEmailHtml(miste, destinatario, 'https://www.scuoleradar.it/dashboard/radar');
check('intestazione gruppo urgente', true, htmlMiste.includes('Scadono entro 2 giorni'));
check('intestazione gruppo oltre la settimana', true, htmlMiste.includes('Oltre una settimana'));
check(
  'introduzione coerente col raggruppamento',
  true,
  htmlMiste.includes('raggruppate per urgenza di scadenza'),
);
// Un solo gruppo → NESSUNA intestazione (niente rumore visivo).
const lontane = [voce(1, '2099-12-31'), voce(2, '2099-12-30')];
const htmlUnGruppo = renderDigestEmailHtml(lontane, destinatario, 'https://www.scuoleradar.it/dashboard/radar');
check(
  'un solo gruppo → nessuna intestazione',
  false,
  /Scadono entro|Oltre una settimana|Scadenza non indicata/.test(htmlUnGruppo),
);
check('un solo gruppo → ordine per scadenza', true, htmlUnGruppo.includes('in ordine di scadenza'));

console.log('\n— Telegram di digest: UN solo messaggio —');
const tg = formattaDigestTelegram(voci, {
  dashboardUrl: 'https://www.scuoleradar.it/dashboard/radar',
  data: '10 luglio 2026',
});
check('testata con conteggio', true, tg.includes(testataDigest(2)));
check('voci numerate', true, tg.includes('<b>1. ') && tg.includes('<b>2. '));
check('fonte esterna presente', true, tg.includes(ESTERNO));
check('nessun link interno /interpello/', false, tg.includes('/interpello/'));
check('email scuola presente', true, tg.includes('mailto:astf01000x@istruzione.it'));
check('guida operativa presente', true, tg.includes('cerca la riga con «A-022»'));
check('nessuna opportunità → nessun messaggio', '', formattaDigestTelegram([]));
const tgMolte = formattaDigestTelegram(molte, { dashboardUrl: 'https://www.scuoleradar.it/dashboard/radar' });
check('rispetta il limite Telegram (4096)', true, tgMolte.length <= 4096);
check('nessun prompt di conversione nei messaggi PERSONALI', false, /Filtra per provincia/.test(tg));
check('intro senza "chiusura delle scuole"', false, /chiusura delle scuole/.test(tg));

console.log('\n— Layout degli ALERT individuali (testo puro, senza marchio/foto) —');
const alertPro = formattaMessaggioTelegram(
  voce(1, '2099-12-31'),
  'A-022',
  'https://www.scuoleradar.it/dashboard/radar',
  'notifica_pro',
);
// Il marchio "📡 ScuoleRadar" è stato RIMOSSO: era una riga ridondante sotto il
// logo (e la foto non viene più allegata: niente anteprima gigante).
check('nessun marchio ridondante in testa', false, alertPro.startsWith('📡'));
check('alert senza disclaimer operativo', false, alertPro.includes('ℹ️'));
check('alert senza la frase "non indica la pagina ufficiale"', false, /non indica la pagina ufficiale/i.test(alertPro));
check('alert con link ufficiale visibile', true, alertPro.includes("🔗 <b>Apri l'avviso ufficiale</b>:"));
check(
  'alert con CTA di ricalibrazione del Radar',
  true,
  alertPro.includes(
    '👉 Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su https://www.scuoleradar.it/dashboard/radar',
  ),
);
check('alert senza prompt di conversione', false, /Filtra per provincia/.test(alertPro));
const benvenuto = formattaMessaggioTelegram(
  null,
  '',
  'https://www.scuoleradar.it/dashboard/radar',
  'welcome',
);
check('messaggi di ciclo di vita: nessun marchio', false, benvenuto.includes('📡'));
check(
  'messaggi di ciclo di vita: footer Notiziario presente',
  true,
  benvenuto.includes('📌 Quando vuoi sapere cosa succede di importante'),
);

console.log(errori === 0 ? '\n✅ DIGEST: nessun problema' : `\n❌ DIGEST: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

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
  vociAttive,
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

console.log('\n— Oggetto dell\'email (branded, con conteggio) —');
check(
  'una sola opportunità',
  'Nuove opportunità per te!',
  subjectDigest(1),
);
check(
  'più opportunità',
  'Nuove opportunità per te!',
  subjectDigest(3),
);
check(
  'formula richiesta (letterale)',
  'Nuove opportunità per te!',
  subjectDigest(2),
);
check(
  'la testata Telegram NON ripete il marchio (già nella riga brand)',
  true,
  testataDigest(2).includes('Oggi abbiamo trovato 2 opportunità per te') &&
    !testataDigest(2).includes('ScuoleRadar'),
);

console.log('\n— Email di digest: UNA sola email con tutte le voci —');
const voci = [voce(1, '2026-09-30'), voce(2, '2026-09-25', ELENCO)];
const html = renderDigestEmailHtml(voci, destinatario, 'https://www.scuoleradar.it/dashboard/radar', {
  data: '10 luglio 2026',
});
check('titolo voce 1 presente', true, html.includes('Interpello supplenza A-022 n.1'));
check('titolo voce 2 presente', true, html.includes('Interpello supplenza A-022 n.2'));
check('fonte ESTERNA cliccabile', true, html.includes(`href="${ESTERNO}"`));
check('nessun link interno /interpello/', false, html.includes('/interpello/'));
check('email scuola cliccabile', true, html.includes('mailto:astf01000x@istruzione.it'));
// Checklist email §4: ZERO riquadri gialli e nessuna guida operativa nel corpo.
check('nessun riquadro giallo di avviso', false, html.includes('#fffbeb'));
check("nessuna guida operativa (l'azione è il link)", false, html.includes('cerca la riga con'));
// NIENTE blocco "P.S.": la cadenza del digest è già nell'intro ("Una sola email").
check('nessun blocco "P.S."', false, /\bP\.S\./.test(html));
check('intro: una sola email al giorno', true, html.includes('Una sola email, come promesso'));
check('nessuna nota grigia sbiadita (#94a3b8)', false, html.includes('#94a3b8'));
check('nessun bottone verso il Radar', false, html.includes('Apri il tuo Radar Scuole'));
check('link ufficiale IN EVIDENZA in ogni voce', true, /👉 Apri l(&#39;|')avviso ufficiale/.test(html));
check(
  'preferenze del Radar nel footer, in PICCOLO',
  true,
  html.includes('modifica il tuo radar su') && html.includes('font-size:12.5px'),
);
// Layout "crisp": voci NUMERATE nell'email (come nel messaggio Telegram).
check('voci numerate nell\'email', true, />1\.<\/span>\s*Interpello/.test(html));
// L'istruzione STAMPA è stata RIMOSSA dal corpo email (era dentro il box giallo):
// resta solo nei messaggi Telegram, dove il box non esiste.
check(
  'nessuna direttiva STAMPA nel corpo email',
  false,
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

console.log('\n— Digest = SOLO opportunità attive (gli scaduti NON partono) —');
{
  const oggi = new Date('2026-09-18T12:00:00');
  const scaduto = voce(10, '2026-09-01');
  const attiva = voce(11, '2026-09-30');
  const senzaScadenza = voce(12, null);
  const filtrate = vociAttive([scaduto, attiva, senzaScadenza], oggi);
  check('scaduta esclusa', ['hash-11', 'hash-12'], filtrate.map((v) => v.id));
  const htmlAttive = renderDigestEmailHtml([scaduto, attiva], destinatario, 'https://www.scuoleradar.it/dashboard/radar');
  check('il digest non cita l\'avviso scaduto', false, htmlAttive.includes('n.10'));
  check('il digest cita l\'avviso attivo', true, htmlAttive.includes('n.11'));
  check('conteggio basato sulle voci ATTIVE', true, htmlAttive.includes('una opportunità'));
  check('solo scadute → nessun contenuto utile', 0, vociAttive([scaduto], oggi).length);
}

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

console.log('\n— Layout degli ALERT individuali (testo puro, brand compatto in testa) —');
const BRAND_TG = '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>';
/** Link etichettati (`<a href="http…">`) presenti, ESCLUSO il link di BRAND. */
const linkHttp = (testo: string): string[] =>
  [...testo.matchAll(/<a\s+href="(https?:[^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => u !== 'https://www.scuoleradar.it');
const alertPro = formattaMessaggioTelegram(
  voce(1, '2099-12-31'),
  'A-022',
  'https://www.scuoleradar.it/dashboard/radar',
  'notifica_pro',
  // La CTA di ricalibrazione del Radar compare nel ~20% dei messaggi:
  // qui viene FORZATA per verificarne il formato esatto.
  { mostraCtaRadar: true },
);
// Il brand è UNA riga compatta (icona + nome ufficiale) in testa: nessuna foto,
// nessuna anteprima gigante (il logo grande è stato rimosso).
check('brand compatto in testa, una sola volta', 1, alertPro.split(BRAND_TG).length - 1);
check('alert parte dalla testata brand', true, alertPro.startsWith(BRAND_TG));
check('alert senza disclaimer operativo', false, alertPro.includes('ℹ️'));
check('alert senza la frase "non indica la pagina ufficiale"', false, /non indica la pagina ufficiale/i.test(alertPro));
// Link UFFICIALE con etichetta canonica e href verso l'URL dell'avviso (nessuna
// pagina di ricerca di un'altra provincia).
check(
  "alert con etichetta unica '🔗 Fonte Ufficiale'",
  true,
  alertPro.includes('<b>🔗 Fonte Ufficiale</b></a>'),
);
check('link dell\'avviso = URL della fonte', [ESTERNO], linkHttp(alertPro));
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
check('messaggi di ciclo di vita: brand compatto in testa', true, benvenuto.startsWith(BRAND_TG));
check(
  'messaggi di ciclo di vita: CTA Notizie a due righe',
  true,
  benvenuto.includes(
    '📌 https://www.scuoleradar.it/notizie\nQuando vuoi sapere cosa succede di importante nella scuola, vieni qui',
  ),
);

console.log(errori === 0 ? '\n✅ DIGEST: nessun problema' : `\n❌ DIGEST: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * Verifica i TEMPLATE Telegram (copy, gerarchia, scadenze, link, footer):
 *  · header "Abbiamo trovato una nuova opportunità per te!" e nessuna frase ripetuta;
 *  · nessuna riga metadato "🏷️ …" né "Email non disponibile";
 *  · Ordine di scuola coerente con Classe/Materia (nessuna contraddizione);
 *  · scadenze passate/errate soppresse;
 *  · ZERO link nascosti: URL sempre VISIBILI (nessun `text_link`), così Telegram
 *    non mostra il popup di conferma "Vuoi aprire questo link?";
 *  · nessun residuo della vecchia prova a 3 notifiche ("Te ne restano 2");
 *  · footer personale/canale esattamente come da specifica.
 *
 * Uso: npm run test:telegram:template
 */
import {
  formattaMessaggioTelegram,
  formattaPostCanaleTelegram,
  RADAR_SETUP_URL,
  type InterpelloCanale,
} from '../src/lib/telegram.ts';
import type { DettagliNotifica } from '../src/lib/resend.ts';
import { costruisciAvviso, scadenzaUtilizzabile } from '../src/lib/alertInterpello.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Link NASCOSTI dietro un'etichetta (`<a href="http…">`): causano il popup. */
function linkNascosti(testo: string): string[] {
  return [...testo.matchAll(/<a\s+href="(https?:[^"]+)"/g)].map((m) => m[1]);
}

const DASH = 'https://www.scuoleradar.it/dashboard/radar';

/** Avviso di secondaria di II grado (caso reale: prima classe ADEE, poi AA24). */
const secondaria: DettagliNotifica = {
  id: 'hash-at',
  title:
    'AA24 – Lingue e culture straniere negli istituti di istruzione secondaria di II grado (FRANCESE)',
  schoolName: 'Liceo Augusto Monti',
  province: 'AT',
  classi: ['ADEE', 'AA24'],
  materia: null,
  scadenza: '2099-06-30',
  link: 'https://www.mim.gov.it/albo-pretorio/avviso-aa24.pdf',
  contactEmail: null,
};

console.log('\n— Copy: header esatto, niente ripetizioni, niente metadati —');
const msg = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro');
check('header esatto', true, msg.includes('Abbiamo trovato una nuova opportunità per te!'));
check('vecchio header rimosso', false, msg.includes('🎯 Nuova opportunità trovata per te!'));
check('niente "Continuiamo a cercare per te"', false, msg.includes('Continuiamo a cercare'));
check('niente "A presto"', false, msg.includes('A presto'));
check('niente riga 🏷️', false, msg.includes('🏷️'));
check('nessuna riga "Opportunità" isolata', false, /(?:^|\n)Opportunità(?:\n|$)/.test(msg));
check('niente "Email non disponibile"', false, msg.includes('Email non disponibile'));
check('niente riga 📧 (email assente)', false, msg.includes('📧'));

console.log('\n— Gerarchia coerente (Ordine ↔ Classe/Materia) —');
const avvisoSecondaria = costruisciAvviso({
  provincia: 'Asti (AT)',
  classCode: 'AA24',
  classCodes: ['ADEE', 'AA24'],
  materia: null,
  scadenza: '2099-06-30',
  schoolName: 'Liceo Augusto Monti',
  titolo: secondaria.title,
});
const ordineSecondaria = avvisoSecondaria.obbligatorie.find(
  (r) => r.etichetta === 'Ordine di scuola',
)?.valore;
const classeSecondaria =
  avvisoSecondaria.obbligatorie.find((r) => r.etichetta === 'Classe / Materia')?.valore ?? '';
check('ordine = Secondaria di II grado', 'Secondaria di II grado', ordineSecondaria);
check(
  'classe coerente (AA24, non ADEE)',
  true,
  classeSecondaria.includes('AA24') && !classeSecondaria.includes('ADEE'),
);
check('nessuna "Scuola Primaria" contraddittoria', false, msg.includes('Scuola Primaria'));
// Con la classe ADEE (sostegno primaria) l'etichetta della classe cita la
// primaria: è corretto, ma il LIVELLO (Ordine di scuola) resta coerente con la
// classe mostrata — nessuna contraddizione tra i campi.
const msgAdee = formattaMessaggioTelegram(secondaria, 'ADEE', DASH, 'notifica_pro');
const livelloAdee = /🎓 Ordine di scuola: <b>([^<]+)<\/b>/.exec(msgAdee)?.[1];
check('livello coerente con la classe mostrata (ADEE → Primaria)', 'Scuola Primaria', livelloAdee);

const primaria: DettagliNotifica = {
  id: 'hash-mc',
  title: 'EEHN - INSEGNAMENTO SCUOLA PRIMARIA CON METODO MONTESSORI',
  schoolName: 'ICS Macerata',
  province: 'MC',
  classi: [],
  materia: 'Scuola primaria/infanzia',
  scadenza: null,
  link: null,
  contactEmail: null,
};
const msgPrimaria = formattaMessaggioTelegram(primaria, '', DASH, 'notifica_pro');
check('ordine dedotto dal testo = Scuola Primaria', true, msgPrimaria.includes('Scuola Primaria'));
check('niente "Secondaria di II grado" inventata', false, msgPrimaria.includes('Secondaria di II grado'));

console.log('\n— Scadenze: passate/errate soppresse —');
check('scadenza passata non utilizzabile', false, scadenzaUtilizzabile('2026-09-11'));
check('scadenza futura utilizzabile', true, scadenzaUtilizzabile('2099-12-31'));
check(
  'scadenza = pubblicazione → non utilizzabile',
  false,
  scadenzaUtilizzabile('2099-12-31', '2099-12-31'),
);
const scaduta: DettagliNotifica = { ...secondaria, scadenza: '2026-09-11' };
const msgScaduta = formattaMessaggioTelegram(scaduta, 'AA24', DASH, 'notifica_pro');
check('nessuna riga 📅 per scadenza passata', false, msgScaduta.includes('📅'));
const msgFutura = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro');
check('riga 📅 presente per scadenza valida', true, msgFutura.includes('📅'));

console.log('\n— Link: URL VISIBILI (nessun popup "Apri link"), etichetta onesta —');
check('nessun link nascosto nel messaggio', [], linkNascosti(msg));
check('URL della fonte visibile nel testo', true, msg.includes(secondaria.link as string));
check('etichetta onesta in testo', true, msg.includes('Apri il bando ufficiale (PDF)'));
check('mai la parola "candidati"', false, /candidat/i.test(msg.replace(/Candidature:/g, '')));
const conEmail: DettagliNotifica = {
  ...secondaria,
  contactEmail: 'segreteria@liceoaugustomonti.edu.it',
};
const msgEmail = formattaMessaggioTelegram(conEmail, 'AA24', DASH, 'notifica_pro');
check(
  'email presente → testo semplice (nessun mailto)',
  true,
  msgEmail.includes('📧 Candidature: segreteria@liceoaugustomonti.edu.it'),
);
check('email senza link nascosto', [], linkNascosti(msgEmail));

console.log('\n— Copy: nessun residuo della prova a 3 notifiche —');
for (const tipo of ['prova1', 'prova2', 'prova3', 'extra', 'recap'] as const) {
  const t = formattaMessaggioTelegram(secondaria, 'AA24', DASH, tipo);
  check(`[${tipo}] niente "Te ne restano"`, false, /Te ne restano|Te ne resta 1/i.test(t));
  check(`[${tipo}] niente "di prova"`, false, /di prova|prova sono finite/i.test(t));
  check(`[${tipo}] niente "Terza e ultima"`, false, /Terza e ultima/i.test(t));
}

console.log('\n— Footer personale (una sola riga, esattamente come da specifica) —');
const footerAtteso =
  '📌 Quando vuoi sapere cosa succede di importante, vieni qui: https://www.scuoleradar.it/notizie';
check('footer presente (URL visibile)', true, msg.includes(footerAtteso));
check('footer senza link nascosto', false, /<a\s+href="[^"]*notizie"/.test(msg));
check('niente firma "I tuoi colleghi"', false, msg.includes('I tuoi colleghi'));

console.log('\n— Post CANALE (broadcast): footer regionale —');
const canale: InterpelloCanale = {
  title: 'Interpello supplenza A-041 Matematica - Liceo Augusto Monti',
  classCodes: ['A-041'],
  materia: 'Matematica',
  province: 'AT',
  expirationDate: '2099-12-31',
  schoolName: 'Liceo Augusto Monti',
  link: 'https://www.mim.gov.it/albo-pretorio/avviso-a041.pdf',
};
const post = formattaPostCanaleTelegram(canale);
// CTA di conversione del canale: URL VISIBILE (nessun popup) al setup del Radar.
const footerCanaleAtteso =
  `⚡ Ricevi solo gli avvisi della tua provincia e per le tue classi: 👉 ${RADAR_SETUP_URL}`;
check('footer canale presente (URL visibile)', true, post.includes(footerCanaleAtteso));
check(
  'footer canale punta a /dashboard/radar',
  true,
  footerCanaleAtteso.includes('/dashboard/radar'),
);
check(
  'nessuna CTA alla home generica',
  false,
  /https:\/\/(?:www\.)?scuoleradar\.it\/?(?:\s|$)/.test(post),
);
check('nessun link nascosto nel post canale', [], linkNascosti(post));
check('URL della fonte visibile nel post', true, post.includes(canale.link as string));
check('link fonte senza la parola "candidati"', false, /candidat/i.test(post));
const postScaduto = formattaPostCanaleTelegram({ ...canale, expirationDate: '2026-09-11' });
check('post canale: scadenza passata soppressa', false, postScaduto.includes('📅'));
check('post canale: niente "Email non disponibile"', false, post.includes('Email non disponibile'));
check('post canale: niente riga 📧 senza email', false, post.includes('📧'));
const postSemplice = formattaPostCanaleTelegram({
  title: 'AA24 - Lingue e culture straniere secondaria di II grado',
  classCodes: ['ADEE', 'AA24'],
  materia: null,
  province: 'AT',
  expirationDate: null,
  schoolName: null,
  link: 'https://www.mim.gov.it/x/avviso.pdf',
});
check(
  'post canale: ruolo non ripetuto (niente 👩🏫 AA24 + 📚 AA24)',
  false,
  postSemplice.includes('👩🏫'),
);
const postEmail = formattaPostCanaleTelegram({
  ...canale,
  contactEmail: 'protocollo@itisartom.edu.it',
});
check(
  'post canale: email presente → testo semplice',
  true,
  postEmail.includes('📧 Candidature: protocollo@itisartom.edu.it'),
);

console.log(
  errori === 0 ? '\n✅ TELEGRAM TEMPLATE: nessun problema' : `\n❌ TELEGRAM TEMPLATE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


/**
 * Verifica i TEMPLATE Telegram (brand, copy, gerarchia, scadenze, link, footer):
 *  · TESTATA BRAND compatta ("📡 Scuole Radar.it") come PRIMA riga di ogni
 *    messaggio, una volta sola (nessun logo/anteprima gigante);
 *  · apertura UNIFORME e contestuale degli alert (classe · provincia), senza le
 *    vecchie frasi generiche ("Abbiamo trovato una nuova opportunità per te!");
 *  · nessuna riga metadato "🏷️ …" né "Email non disponibile";
 *  · Ordine di scuola coerente con Classe/Materia (nessuna contraddizione);
 *  · scadenze passate/errate soppresse;
 *  · link alla fonte ufficiale ETICHETTATO in modo canonico
 *    ("🔗 Fonte Ufficiale", unica etichetta del modulo) e diretto all'URL
 *    dell'avviso, con anteprime native DISATTIVATE (`link_preview_options`);
 *  · nessun URL di fonte in chiaro e nessuna riga per home/elenchi/ricerche;
 *  · nessun residuo della vecchia prova a 3 notifiche ("Te ne restano 2");
 *  · CTA Notizie esattamente nelle due righe ufficiali.
 *
 * Uso: npm run test:telegram:template
 */
import { readFileSync } from 'node:fs';
import {
  ETICHETTA_FONTE_UFFICIALE,
  formattaMessaggioTelegram,
  formattaPostCanaleTelegram,
  payloadMessaggioTesto,
  rigaFonteUfficiale,
  RADAR_SETUP_URL,
  type InterpelloCanale,
} from '../src/lib/telegram.ts';
import type { DettagliNotifica, TipoMessaggio } from '../src/lib/resend.ts';
import { costruisciAvviso, scadenzaUtilizzabile } from '../src/lib/alertInterpello.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Testata brand compatta e CLIICCABILE — prima riga di OGNI messaggio Telegram. */
const BRAND = '📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>';

/** Home ufficiale: è la destinazione del BRAND (link di testata, non una fonte). */
const HOME_BRAND = 'https://www.scuoleradar.it';

/**
 * URL dei link etichettati presenti nel testo, ESCLUSO il link di BRAND:
 * la testata è un link alla home, non una "fonte dell'avviso".
 */
function linkEtichettati(testo: string): string[] {
  return [...testo.matchAll(/<a\s+href="(https?:[^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => u !== HOME_BRAND);
}

/** CTA Notizie: ESATTAMENTE le due righe ufficiali. */
const CTA_NOTIZIE =
  '📌 https://www.scuoleradar.it/notizie\nQuando vuoi sapere cosa succede di importante nella scuola, vieni qui';

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

console.log('\n— Brand cliccabile + apertura con il copy di brand completo —');
const msg = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro');
check('prima riga = testata brand', true, msg.startsWith(BRAND));
check('intero nome del brand è un link alla home', true, BRAND.includes('<a href="https://www.scuoleradar.it">Scuole Radar.it</a>'));
check('brand presente UNA sola volta', 1, msg.split(BRAND).length - 1);
check(
  'apertura CONTESTUALE con il copy completo (classe · provincia)',
  true,
  msg.includes('🎯 <b>Abbiamo trovato una nuova opportunità per te</b>: AA24 · Asti'),
);
check('vecchia apertura abbreviata rimossa', false, msg.includes('🎯 <b>Nuova opportunità</b>'));
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

console.log('\n— Link: etichetta UNICA, URL diretti e anteprime disattivate —');
check('un solo link etichettato (la fonte)', [secondaria.link], linkEtichettati(msg));
check('URL della fonte presente nel link', true, msg.includes(secondaria.link as string));
// Riga canonica richiesta dal prodotto: `🔗 Fonte Ufficiale` con href verso l'URL
// ESATTO dell'avviso. L'URL non compare MAI in chiaro nel testo.
check(
  "riga '🔗 Fonte Ufficiale' con href corretto",
  true,
  msg.includes(`<a href="${secondaria.link}"><b>${ETICHETTA_FONTE_UFFICIALE}</b></a>`),
);
check('etichetta unica del modulo = "🔗 Fonte Ufficiale"', '🔗 Fonte Ufficiale', ETICHETTA_FONTE_UFFICIALE);
check(
  'URL della fonte MAI in chiaro (solo nell’href)',
  false,
  msg.replace(/<a\s+href="[^"]*"/g, '<a').includes(secondaria.link as string),
);
// Nessun fallback a link generici: home, elenchi e pagine di ricerca non generano
// riga di fonte (il messaggio resta pulito, senza URL in chiaro).
check('home dell’ente → nessuna riga fonte', '', rigaFonteUfficiale('https://www.istruzionepiemonte.it/'));
check('elenco/tag regionale → nessuna riga fonte', '', rigaFonteUfficiale('https://www.scuolainterpelli.it/tag/interpelli-scuola-piemonte/'));
check('ricerca `?s=INTERPELLO` → nessuna riga fonte', '', rigaFonteUfficiale('https://www.usp-asti.gov.it/?s=interpello'));
check('avviso diretto → riga con href', true, rigaFonteUfficiale('https://www.usp-asti.it/interpelli/avviso-a022').includes('<a href='));
// ANTEPRIME: il payload unico di `sendMessage` le disattiva per TUTTI gli invii.
const payload = payloadMessaggioTesto('123', 'prova');
check('payload: link_preview_options.is_disabled', true, JSON.stringify(payload.link_preview_options) === '{"is_disabled":true}');
check('payload: disable_web_page_preview (fallback)', true, payload.disable_web_page_preview === true);

// INVARIANTI su TUTTE le tipologie: l'etichetta canonica compare sempre e solo
// come LINK (mai testo nudo da cliccare senza effetto) e l'URL di fonte non è
// mai visibile in chiaro nel corpo del messaggio.
const TIPI_TELEGRAM: TipoMessaggio[] = [
  'digest_giornaliero',
  'welcome',
  'prova1',
  'prova2',
  'prova3',
  'extra',
  'recap',
  'welcome_pro',
  'conferma_attivazione',
  'free_forever_preavviso',
  'notifica_pro',
];
const conEtichettaNuda: string[] = [];
const conUrlInChiaro: string[] = [];
for (const tipo of TIPI_TELEGRAM) {
  const testo = formattaMessaggioTelegram(secondaria, 'AA24', DASH, tipo);
  if (
    testo.includes(ETICHETTA_FONTE_UFFICIALE) &&
    !testo.includes(`<b>${ETICHETTA_FONTE_UFFICIALE}</b></a>`)
  ) {
    conEtichettaNuda.push(tipo);
  }
  if (testo.replace(/<a\s+href="[^"]*"/g, '<a').includes(secondaria.link as string)) {
    conUrlInChiaro.push(tipo);
  }
}
check('etichetta canonica sempre cliccabile (mai testo nudo)', [], conEtichettaNuda);
check('URL della fonte mai in chiaro in nessuna tipologia', [], conUrlInChiaro);
check('mai la parola "candidati"', false, /candidat/i.test(msg.replace(/Candidature:/g, '')));
// NIENTE disclaimer operativo: era la frase che confondeva gli utenti.
check('nessun disclaimer "ℹ️"', false, msg.includes('ℹ️'));
check('nessuna frase sulla pagina ufficiale mancante', false, /non indica la pagina ufficiale/i.test(msg));
// Nessun riquadro di anteprima: la Bot API riceve `link_preview_options.is_disabled`.
const sorgenteTelegram = readFileSync('src/lib/telegram.ts', 'utf8');
check(
  'anteprime Telegram disattivate (link_preview_options)',
  true,
  /link_preview_options:\s*\{\s*is_disabled:\s*true\s*\}/.test(sorgenteTelegram),
);
check('niente vecchio disable_web_page_preview: false', false, /disable_web_page_preview:\s*false/.test(sorgenteTelegram));
const conEmail: DettagliNotifica = {
  ...secondaria,
  contactEmail: 'segreteria@liceoaugustomonti.edu.it',
};
const msgEmail = formattaMessaggioTelegram(conEmail, 'AA24', DASH, 'notifica_pro');
check('email presente → link mailto cliccabile', true, msgEmail.includes('📧 Candidature: <a href="mailto:segreteria@liceoaugustomonti.edu.it">'));
check('email: nessun link http oltre alla fonte', [secondaria.link], linkEtichettati(msgEmail));

console.log('\n— Copy: nessun residuo della prova a 3 notifiche —');
for (const tipo of ['prova1', 'prova2', 'prova3', 'extra', 'recap'] as const) {
  const t = formattaMessaggioTelegram(secondaria, 'AA24', DASH, tipo);
  check(`[${tipo}] niente "Te ne restano"`, false, /Te ne restano|Te ne resta 1/i.test(t));
  check(`[${tipo}] niente "di prova"`, false, /di prova|prova sono finite/i.test(t));
  check(`[${tipo}] niente "Terza e ultima"`, false, /Terza e ultima/i.test(t));
}

console.log('\n— Footer degli ALERT: CTA Radar (frequenza ~20%) + CTA Notizie a due righe —');
// La vecchia riga promozionale generica è stata sostituita dalla CTA Notizie
// ESATTA a due righe (la stessa in email e digest).
const footerAlertAtteso =
  '👉 Se questi risultati non corrispondono più ai tuoi interessi, modifica il tuo radar su https://www.scuoleradar.it/dashboard/radar';
// La CTA di ricalibrazione del Radar NON è più in OGNI messaggio: compare nel
// ~20% delle comunicazioni personalizzate. Qui la si forza per verificarne il
// formato esatto.
const msgCtaRadar = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro', {
  mostraCtaRadar: true,
});
check('footer alert presente quando forzato (URL visibile)', true, msgCtaRadar.includes(footerAlertAtteso));
check('footer alert senza link nascosto', false, /<a\s+href="[^"]*dashboard\/radar"/.test(msgCtaRadar));
check('footer alert assente quando disattivato', false, formattaMessaggioTelegram(
  secondaria,
  'AA24',
  DASH,
  'notifica_pro',
  { mostraCtaRadar: false },
).includes('modifica il tuo radar'));
check('alert con CTA Notizie a due righe (sempre presente)', true, msg.includes(CTA_NOTIZIE));
check('niente firma "I tuoi colleghi"', false, msg.includes('I tuoi colleghi'));

console.log('\n— Frequenza della CTA Radar: ~20% e deterministica —');
{
  // 400 avvisi distinti: la CTA deve comparire in una minoranza stabile (~20%),
  // mai in tutti i messaggi (era il rumore segnalato).
  let conCta = 0;
  const campione = 400;
  for (let i = 0; i < campione; i += 1) {
    const avviso: DettagliNotifica = { ...secondaria, id: `hash-frequenza-${i}` };
    const t = formattaMessaggioTelegram(avviso, 'AA24', DASH, 'notifica_pro');
    if (t.includes('modifica il tuo radar')) conCta += 1;
  }
  const quota = conCta / campione;
  check('quota CTA Radar entro il range atteso (10%–32%)', true, quota >= 0.1 && quota <= 0.32);
  check('quota CTA Radar non è il 100% dei messaggi', true, quota < 0.5);
  // Determinismo: lo stesso avviso riceve sempre la stessa decisione (retry sicuri).
  const a = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro');
  const b = formattaMessaggioTelegram(secondaria, 'AA24', DASH, 'notifica_pro');
  check('decisione stabile sullo stesso avviso', a.includes('modifica il tuo radar'), b.includes('modifica il tuo radar'));
}

console.log('\n— Messaggi di ciclo di vita: brand + CTA Notizie —');
const benvenuto = formattaMessaggioTelegram(null, '', DASH, 'welcome');
check('welcome con testata brand', true, benvenuto.startsWith(BRAND));
check('welcome con CTA Notizie a due righe', true, benvenuto.includes(CTA_NOTIZIE));
check('welcome senza riga ripetuta "Notiziario"', false, /passa dal nostro Notiziario/i.test(benvenuto));
check('welcome senza CTA radar (nessun alert)', false, benvenuto.includes('modifica il tuo radar'));

console.log('\n— Benvenuto: promo MESE PRO (nessun residuo del piano Base) —');
check('welcome: mese di PRO in omaggio GIÀ attivo', true, /mese di PRO in omaggio/.test(benvenuto));
check('welcome: vantaggi "senza restrizioni"', true, /senza restrizioni/.test(benvenuto));
check(
  'welcome: nessun riferimento al piano Base / quota di segnalazioni',
  [],
  [/account Base/i, /piano Base/i, /piano gratuito/i, /3 segnalazioni/i]
    .filter((re) => re.test(benvenuto))
    .map(String),
);
check(
  'welcome: elenca i 4 strumenti attivi',
  true,
  ['Radar Scuole', 'Modulistica', 'Crea CV', 'Calcolatore CFU'].every((s) => benvenuto.includes(s)),
);
check('welcome: invito a impostare provincia e classi', true, /provincia e classi di concorso/i.test(benvenuto));

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
// CTA di conversione del canale (LEAD GENERATION): invito esplicito a creare il
// Radar personalizzato, con URL VISIBILE al setup (nessun popup nativo).
const radiceCtaCanale = '👉 Crea il tuo Radar personalizzato:';
check(
  'footer canale = CTA di lead generation con URL visibile',
  true,
  post.includes(radiceCtaCanale) && post.includes(RADAR_SETUP_URL),
);
check(
  'footer canale punta a /dashboard/radar',
  true,
  RADAR_SETUP_URL.includes('/dashboard/radar'),
);
check(
  'nessuna CTA alla home generica',
  false,
  /https:\/\/(?:www\.)?scuoleradar\.it\/?(?:\s|$)/.test(post),
);
check('post canale con testata brand', true, post.startsWith(BRAND));
check('post canale: un solo link etichettato (la fonte)', [canale.link], linkEtichettati(post));
check(
  `post canale: etichetta unica '${ETICHETTA_FONTE_UFFICIALE}'`,
  true,
  post.includes(`<a href="${canale.link}"><b>${ETICHETTA_FONTE_UFFICIALE}</b></a>`),
);
check('post canale con CTA Notizie a due righe', true, post.includes(CTA_NOTIZIE));
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
  'post canale: email presente → link mailto cliccabile',
  true,
  postEmail.includes('📧 Candidature: <a href="mailto:protocollo@itisartom.edu.it">'),
);

console.log(
  errori === 0 ? '\n✅ TELEGRAM TEMPLATE: nessun problema' : `\n❌ TELEGRAM TEMPLATE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


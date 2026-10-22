/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FONTE APRIBILE di una riga.
 *
 * Direttiva cliente 22/10/2026: sul tabellone NON devono esistere link morti. Le
 * fonti pubblicano spesso indirizzi di PIATTAFORMA — Argo/ArgoWeb, Nuvola
 * (Spaggiari/Madisoft), ClasseViva, moduli e cartelle Google, OneDrive/SharePoint,
 * WeTransfer — che dopo pochi giorni chiedono un login o mostrano «modulo non più
 * disponibile». Per l'utente è un link rotto spacciato per «avviso ufficiale».
 *
 * Qui si fissano le tre regole di `linkFonte.ts`, che è l'unico punto di verità
 * usato sia dal filtro della query (`FlightBoardInterpelli`) sia dalla riga
 * (`RigaBoard`):
 *   1. `ePiattaformaNonApribile` riconosce la piattaforma (anche su sottodominio,
 *      con o senza `www.`) e lascia passare i domini delle scuole e i portali
 *      ministeriali;
 *   2. `dominioIstituzionale` accetta SOLO un `*.edu.it` — non `istruzione.it`
 *      (caselle di servizio del Ministero), non `pec.it`, non `gmail.com` — e la
 *      `homepageIstituzionale` ne ricava `https://<dominio>`;
 *   3. `fonteApribile` restituisce l'avviso vero, oppure la home della scuola
 *      dichiarandolo (`tipo: 'sito-scuola'`), oppure `null`: in quel caso la riga
 *      NON entra in bacheca (meglio una riga in meno che un link morto).
 *
 * Uso: npm run test:board:link  (incluso in `npm test`)
 */
import {
  dominioDaSito,
  dominioIstituzionale,
  ePiattaformaNonApribile,
  fonteApribile,
  homepageDaSito,
  homepageIstituzionale,
} from '../linkFonte';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Piattaforme che non servono un avviso pubblico —');
check('Argo (registro elettronico)', true, ePiattaformaNonApribile('https://www.portaleargo.it/argoweb/registro'));
check('Argo su sottodominio di plesso', true, ePiattaformaNonApribile('https://iccarducci.portaleargo.it/login'));
check('Nuvola / Spaggiari', true, ePiattaformaNonApribile('https://nuvola.madisoft.it/login'));
check('ClasseViva', true, ePiattaformaNonApribile('https://web.classeviva.it/ClasseViva-Web/'));
check('modulo Google Forms', true, ePiattaformaNonApribile('https://docs.google.com/forms/d/e/abc/viewform'));
check('link breve di Google Forms', true, ePiattaformaNonApribile('https://forms.gle/abc123'));
check('cartella Google Drive', true, ePiattaformaNonApribile('https://drive.google.com/drive/folders/abc'));
check('file OneDrive (link breve)', true, ePiattaformaNonApribile('https://1drv.ms/w/s!abc'));
check('cartella SharePoint', true, ePiattaformaNonApribile('https://iccarducci.sharepoint.com/sites/albo'));
check('trasferimento WeTransfer', true, ePiattaformaNonApribile('https://we.tl/t-abc123'));
check('sito della scuola: NON è una piattaforma', false, ePiattaformaNonApribile('https://www.liceoaugustomonti.edu.it/avvisi/1'));
check('albo del Ministero: NON è una piattaforma', false, ePiattaformaNonApribile('https://www.mim.gov.it/albo-pretorio/avviso-1.pdf'));
check('protocollo diverso da http(s) → non è un link', false, ePiattaformaNonApribile('ftp://ftp.liceo.edu.it/avviso.pdf'));
check('link assente', false, ePiattaformaNonApribile(null));
check('piattaforma solo nel PATH, host della scuola → apribile', false, ePiattaformaNonApribile('https://www.liceo.edu.it/argo/avviso.pdf'));

console.log('\n— 2. Dominio istituzionale: SOLO `*.edu.it` —');
check('PEO della scuola', 'liceoaugustomonti.edu.it', dominioIstituzionale('segreteria@liceoaugustomonti.edu.it'));
check('recapito con nome e caporali', 'ic-carducci.edu.it', dominioIstituzionale('Segreteria «SEGR@IC-CARDUCCI.EDU.IT»'));
check('sottodominio di plesso', 'liceo.marche.edu.it', dominioIstituzionale('dirigente@liceo.marche.edu.it'));
check('casella di servizio del Ministero → nessun dominio', null, dominioIstituzionale('ICIC84300R@istruzione.it'));
check('casella personale → nessun dominio', null, dominioIstituzionale('docente.privato@gmail.com'));
check('dominio PEC generico → nessun dominio', null, dominioIstituzionale('protocollo@pec.iccarducci.it'));
check('dominio nudo `edu.it` non è un istituto', null, dominioIstituzionale('info@edu.it'));
check('testo senza recapito', null, dominioIstituzionale('Albo pretorio — nessun indirizzo'));
check('recapito assente', null, dominioIstituzionale(null));

console.log('\n— 3. Home dell’istituto: il primo recapito utile, senza `www.` indovinato —');
check('primo recapito `.edu.it`', 'https://iccarducci.edu.it', homepageIstituzionale(['segreteria@iccarducci.edu.it']));
check(
  'scarta i recapiti non istituzionali e prende il primo `.edu.it`',
  'https://iccarducci.edu.it',
  homepageIstituzionale(['segreteria@istruzione.it', 'docente.privato@gmail.com', 'segreteria@iccarducci.edu.it']),
);
check('nessun recapito istituzionale', null, homepageIstituzionale(['segreteria@istruzione.it', null]));
check('elenco vuoto', null, homepageIstituzionale([]));

console.log('\n— 3-bis. Sito istituzionale MIM (`school_site`): solo host, solo `.edu.it` —');
check('host nudo dell’anagrafica', 'iccarducci.edu.it', dominioDaSito('www.iccarducci.edu.it'));
check('URL completo → resta l’host, senza percorso', 'liceoaugustomonti.edu.it', dominioDaSito('https://www.liceoaugustomonti.edu.it/orario?x=1'));
check('schema `http://` accettato', 'iccarducci.edu.it', dominioDaSito('http://iccarducci.edu.it'));
check('casella `@istruzione.it` NON è il sito dell’istituto', null, dominioDaSito('iccarducci@istruzione.it'));
check('dominio commerciale → null', null, dominioDaSito('www.rosamisticaonlus.com'));
check('valore vuoto → null', null, dominioDaSito('   '));
check('sito assente → null', null, dominioDaSito(null));
check('home dal sito istituzionale', 'https://iccarducci.edu.it', homepageDaSito('www.iccarducci.edu.it'));
check('sito non `.edu.it` → nessuna home inventata', null, homepageDaSito('www.istitutosconosciuto.it'));

console.log('\n— 4. Dove porta il click: avviso, home della scuola, oppure niente —');
const AVVISO = 'https://www.liceoaugustomonti.edu.it/albo/avviso-1.pdf';
check('avviso apribile → la pagina dell’avviso', { url: AVVISO, tipo: 'avviso' }, fonteApribile({ source_url: AVVISO }));
check(
  'URL sporco (caporali e punto finale) → ripulito, resta l’avviso',
  { url: AVVISO, tipo: 'avviso' },
  fonteApribile({ source_url: `«${AVVISO}».` }),
);
check(
  'entità HTML nell’URL → decodificata',
  { url: 'https://www.liceo.edu.it/albo/a.php?id=1&anno=2026', tipo: 'avviso' },
  fonteApribile({ source_url: 'https://www.liceo.edu.it/albo/a.php?id=1&amp;anno=2026' }),
);
check(
  'portale Argo + PEO della scuola → home dichiarata `sito-scuola`',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({ source_url: 'https://www.portaleargo.it/argoweb/registro', contact_email: 'segreteria@iccarducci.edu.it' }),
);
check(
  'portale Spaggiari/Nuvola + sito MIM (`school_site`) → home dell’istituto',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({ source_url: 'https://nuvola.madisoft.it/login', school_site: 'www.iccarducci.edu.it' }),
);
check(
  'il sito MIM ha PRECEDENZA sui recapiti dell’avviso',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({
    source_url: 'https://www.portaleargo.it/argoweb/registro',
    school_site: 'www.iccarducci.edu.it',
    contact_email: 'segreteria@altra-scuola.edu.it',
  }),
);
check(
  'sito MIM non `.edu.it` → si ripiega sulla PEC dell’avviso',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({
    source_url: 'https://forms.gle/abc',
    school_site: 'www.istitutosconosciuto.it',
    school_pec: 'ICIC84300R@iccarducci.edu.it',
  }),
);
check(
  'solo `school_site` (nessun `source_url`) → home della scuola',
  { url: 'https://liceoaugustomonti.edu.it', tipo: 'sito-scuola' },
  fonteApribile({ school_site: 'www.liceoaugustomonti.edu.it' }),
);
check(
  'modulo Google + sola PEC `.edu.it` → home dichiarata `sito-scuola`',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({ source_url: 'https://forms.gle/abc', school_pec: 'ICIC84300R@iccarducci.edu.it' }),
);
check(
  'piattaforma e NESSUN recapito `.edu.it` → nessuna fonte (riga fuori)',
  null,
  fonteApribile({ source_url: 'https://www.portaleargo.it/argoweb/registro', contact_email: 'segreteria@istruzione.it' }),
);
check(
  'nessun `source_url`, ma un recapito `.edu.it` → home della scuola',
  { url: 'https://iccarducci.edu.it', tipo: 'sito-scuola' },
  fonteApribile({ source_url: null, contact_email: 'segreteria@iccarducci.edu.it' }),
);
check('URL non http(s) e nessun recapito → nessuna fonte', null, fonteApribile({ source_url: 'javascript:alert(1)' }));
check('riga senza link e senza recapiti → nessuna fonte', null, fonteApribile({}));
check(
  'piattaforma con recapito istituzionale: la riga resta apribile',
  true,
  fonteApribile({ source_url: 'https://we.tl/t-abc', contact_email: 'segreteria@iccarducci.edu.it' }) !== null,
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ FONTE APRIBILE: nessun link morto in bacheca — avviso, home della scuola o riga fuori.'
    : `\n❌ FONTE APRIBILE: ${errori} errore/i.`,
);

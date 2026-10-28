/**
 * TEST — `schools_master`: dal CODICE alla scuola CERTIFICATA (`lib/scuoleMaster.ts`).
 *
 * Perché serve: le tabelle degli UST pubblicano righe con un codice, un nome
 * abbreviato e un link che spesso porta a una piattaforma privata. Perché la riga
 * diventi un avviso apribile servono nome presentabile, recapiti e HOME `.edu.it`,
 * presi dall'anagrafica MIM. La guardia fissa:
 *   1. CERTIFICAZIONE per codice (con i recapiti e il dominio dichiarato) e per
 *      NOME — solo se univoco, mai un'ipotesi su un nome condiviso da due province;
 *   2. HOME: dominio ISTITUZIONALE dichiarato dall'anagrafica (`.edu.it` per
 *      primo, poi `.gov.it` e gli altri), mai `istruzione.it` (casella di
 *      servizio), mai una piattaforma privata né un dominio personale;
 *      `www.` e percorso non finiscono nell'URL pubblicato;
 *   3. URL di una riga: quello della fonte se è apribile, altrimenti la home;
 *      `null` quando non c'è né l'uno né l'altra (riga fuori, non un link rotto);
 *   4. le scuole CITATE in un testo (deep crawl): deduplicate, nell'ordine di
 *      comparsa, solo se il codice è un meccanografico vero;
 *   5. anagrafica ASSENTE (CSV non trovati) → nessuna certificazione inventata;
 *   6. il modulo è in catena in `npm test` e usato da `table-reporter`.
 *
 * Uso: npm run test:scuole-master  (incluso in `npm test`)
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { caricaAnagrafica } from '../src/lib/anagraficaScuole.ts';
import {
  dominioEduIt,
  dominioIstituzionale,
  homeDaSito,
  homeUfficiale,
  scuoleDaTesto,
  scuolaCertificata,
  urlUfficiale,
  urlVerificabile,
} from '../src/lib/scuoleMaster.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Costruisce una riga CSV valida (virgolette solo dove servono). */
function rigaCsv(campi: Array<string | null>): string {
  return campi
    .map((campo) => {
      const valore = campo ?? '';
      return /[",\n]/.test(valore) ? `"${valore.replace(/"/g, '""')}"` : valore;
    })
    .join(',');
}

const INTESTAZIONE = [
  'ANNOSCOLASTICO', 'AREAGEOGRAFICA', 'REGIONE', 'PROVINCIA',
  'CODICEISTITUTORIFERIMENTO', 'DENOMINAZIONEISTITUTORIFERIMENTO', 'CODICESCUOLA',
  'DENOMINAZIONESCUOLA', 'INDIRIZZOSCUOLA', 'CAPSCUOLA', 'CODICECOMUNESCUOLA',
  'DESCRIZIONECOMUNE', 'DESCRIZIONECARATTERISTICASCUOLA',
  'DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA', 'INDICAZIONESEDEDIRETTIVO',
  'INDICAZIONESEDEOMNICOMPRENSIVO', 'INDIRIZZOEMAILSCUOLA', 'INDIRIZZOPECSCUOLA',
  'SITOWEBSCUOLA', 'SEDESCOLASTICA',
].join(',');

/** Riga dell'anagrafica: provincia, istituto, sede, recapiti, sito. */
function scuola(
  provincia: string, istituto: string, istitutoNome: string,
  sede: string, sedeNome: string, email: string,
  pec: string | null, sito: string | null,
): string {
  return rigaCsv([
    '202627', 'CENTRO', 'TOSCANA', provincia, istituto, istitutoNome, sede, sedeNome,
    'VIA ROMA 1', '52100', 'A390', provincia, 'NORMALE', 'SCUOLA SECONDARIA I GRADO',
    'SI', 'SI', email, pec, sito, 'SI',
  ]);
}

const RIGHE = [
  // Istituto con sito dichiarato: casa madre di ogni certificazione.
  scuola('AREZZO', 'ARIC82300X', 'ISTITUTO COMPRENSIVO VASARI', 'ARIC82300X', 'I.C. VASARI',
    'ARIC82300X@istruzione.it', 'ARIC82300X@pec.istruzione.it', 'https://www.icvasariarezzo.edu.it/'),
  // Plesso dello stesso istituto, senza sito proprio: eredita quello dell'istituto.
  scuola('AREZZO', 'ARIC82300X', 'ISTITUTO COMPRENSIVO VASARI', 'ARAA82301X', 'INFANZIA VASARI',
    'ARIC82300X@istruzione.it', null, 'Non Disponibile'),
  // Scuola senza `.edu.it`: home non certificabile (meglio `null` che un'invenzione).
  scuola('GROSSETO', 'GRIC84000P', 'ISTITUTO COMPRENSIVO DON MILANI', 'GRIC84000P', 'IC DON MILANI',
    'GRIC84000P@istruzione.it', null, 'Non Disponibile'),
  // Dominio ISTITUZIONALE diverso da `.edu.it` (§26.93): il sito dichiarato
  // dall'anagrafica è la casa della scuola lo stesso.
  scuola('SIENA', 'SIIC85000A', 'ISTITUTO COMPRENSIVO SENESE', 'SIIC85000A', 'I.C. SENESE',
    'SIIC85000A@istruzione.it', null, 'https://www.icsenese.gov.it/avvisi'),
  // STESSO nome in un'altra provincia: il nome da solo è AMBIGUO.
  scuola('AREZZO', 'ARIC84500T', 'ISTITUTO COMPRENSIVO DON MILANI', 'ARIC84500T', 'IC DON MILANI',
    'ARIC84500T@istruzione.it', null, 'Non Disponibile'),
];

const cartella = mkdtempSync(join(tmpdir(), 'sr-master-'));
const vuota = mkdtempSync(join(tmpdir(), 'sr-master-vuota-'));
writeFileSync(join(cartella, 'SCUANAGRAFESTAT20262720260901.csv'), [INTESTAZIONE, ...RIGHE].join('\n'), 'utf8');
const indice = caricaAnagrafica({ cartella, refresh: true });

process.on('exit', () => {
  rmSync(cartella, { recursive: true, force: true });
  rmSync(vuota, { recursive: true, force: true });
});


/* --------------------- 1) CERTIFICAZIONE PER CODICE ---------------------- */

console.log('\n— 1. Dal codice alla scuola certificata —');
const vasari = scuolaCertificata(indice, { codice: 'aric82300x' });
check('codice normalizzato in maiuscolo', 'ARIC82300X', vasari?.codice ?? null);
check('nome presentabile dell’istituto', 'ISTITUTO COMPRENSIVO VASARI', vasari?.nome ?? null);
check('email ufficiale (PEO)', 'aric82300x@istruzione.it', vasari?.email ?? null);
check('PEC ufficiale', 'aric82300x@pec.istruzione.it', vasari?.pec ?? null);
check('sito dichiarato senza schema né `www.`', 'icvasariarezzo.edu.it', vasari?.sito ?? null);
check('home `https://` sul dominio nudo', 'https://icvasariarezzo.edu.it', vasari?.home ?? null);
check('provincia e comune', ['AR', 'AREZZO'], [vasari?.provincia ?? null, vasari?.comune ?? null]);
check(
  'il PLESSO eredita il sito dell’istituto',
  'icvasariarezzo.edu.it',
  scuolaCertificata(indice, { codice: 'ARAA82301X' })?.sito ?? null,
);

/* ----------------------- 2) CERTIFICAZIONE PER NOME --------------------- */

console.log('\n— 2. Dal nome alla scuola, solo se il nome è UNIVOCO —');
check(
  'nome univoco: certifica',
  'ARIC82300X',
  scuolaCertificata(indice, { nome: 'I.C. VASARI' })?.codice ?? null,
);
check(
  'nome condiviso senza provincia: NESSUNA ipotesi',
  null,
  scuolaCertificata(indice, { nome: 'I.C. DON MILANI' }),
);
check(
  'nome condiviso CON provincia: risolve quella giusta',
  'ARIC84500T',
  scuolaCertificata(indice, { nome: 'I.C. DON MILANI', provincia: 'AR' })?.codice ?? null,
);
check('nome sconosciuto: nessuna certificazione', null, scuolaCertificata(indice, { nome: 'I.C. INESISTENTE' }));
check('codice inesistente: nessuna certificazione', null, scuolaCertificata(indice, { codice: 'XXIC00000X' }));
check(
  'scuola senza `.edu.it`: home `null` (mai una home inventata)',
  null,
  scuolaCertificata(indice, { codice: 'GRIC84000P' })?.home ?? null,
);

/* ------------------------- 3) HOME E DOMINI AMMESSI --------------------- */

console.log('\n— 3. La home è ISTITUZIONALE: `.edu.it` per primo, non per forza —');
check('sito con percorso: resta l’host', 'https://iccarducci.edu.it', homeDaSito('https://www.iccarducci.edu.it/avvisi/2026'));
check('sito senza schema: si compone `https://`', 'https://iccarducci.edu.it', homeDaSito('iccarducci.edu.it'));
check('`.gov.it` dichiarato dall’anagrafica è la casa', 'https://icsenese.gov.it', homeDaSito('https://www.icsenese.gov.it/avvisi'));
check('`istruzione.it` NON è il sito di un istituto', null, homeDaSito('https://aric82300x.istruzione.it'));
check('piattaforma privata: mai una home', null, homeDaSito('https://www.portaleargo.it/argoweb/registro'));
check('dominio personale: mai una home', null, homeDaSito('https://sites.google.com/view/icvasari'));
check('casella personale: mai una home', null, homeDaSito('segreteria.icvasari@gmail.com'));
check('assente / vuoto', [null, null], [homeDaSito(null), homeDaSito('')]);
check('home ufficiale da scuola nulla', null, homeUfficiale(null));
check(
  'certificazione: home `.gov.it` dal sito dichiarato',
  'https://icsenese.gov.it',
  scuolaCertificata(indice, { codice: 'SIIC85000A' })?.home ?? null,
);

check('dominio `.edu.it` da recapito', 'icvasari.edu.it', dominioEduIt('segreteria@ICVASARI.edu.it'));
check('dominio ISTITUZIONALE `.gov.it`', 'icsenese.gov.it', dominioIstituzionale('segreteria@icsenese.gov.it'));
check(
  '`.edu.it` preferito quando il recapito ne cita due',
  'icsenese.edu.it',
  dominioIstituzionale('protocollo@icsenese.gov.it, segreteria@icsenese.edu.it'),
);
check('recapito `istruzione.it` non è un dominio', null, dominioIstituzionale('ARIC82300X@istruzione.it'));
check('recapito personale non è un dominio', null, dominioIstituzionale('segreteria@gmail.com'));

/* ----------------------- 4) URL DI UNA RIGA D’AVVISO -------------------- */

console.log('\n— 4. Dove può portare il click —');
check(
  'avviso apribile: resta quello della fonte',
  true,
  urlVerificabile('https://www.icvasariarezzo.edu.it/avvisi/interpello-1.pdf'),
);
check('piattaforma privata: non verificabile', false, urlVerificabile('https://www.portaleargo.it/argoweb/registro'));
check('schema non apribile', false, urlVerificabile('javascript:alert(1)'));
check('URL assente → home dell’istituto', 'https://icvasariarezzo.edu.it', urlUfficiale(null, vasari));
check(
  'URL di piattaforma → home dell’istituto',
  'https://icvasariarezzo.edu.it',
  urlUfficiale('https://www.portaleargo.it/argoweb/registro', vasari),
);
check('né URL né scuola → nessun link (riga fuori)', null, urlUfficiale('', null));
check(
  'scuola senza `.edu.it` e URL di piattaforma → nessun link',
  null,
  urlUfficiale('https://forms.gle/abc', scuolaCertificata(indice, { codice: 'GRIC84000P' })),
);

/* ------------------------- 5) SCUOLE CITATE IN UN TESTO ----------------- */

console.log('\n— 5. Deep crawl: le scuole CITATE —');
const citate = scuoleDaTesto(
  indice,
  'Avvisi per ARIC82300X e ARIC82300X, disponibilità ARAA82301X; altro istituto XXIC00000X.',
  'AR',
);
check('deduplicate e nell’ordine di comparsa', ['ARIC82300X', 'ARAA82301X'], citate.map((s) => s.codice));
check('testo senza codici', [], scuoleDaTesto(indice, 'Nessun codice in questa riga'));

/* ------------------------- 6) ANAGRAFICA ASSENTE ----------------------- */

console.log('\n— 6. Senza anagrafica non si inventa nulla —');
const senzaFile = caricaAnagrafica({ cartella: vuota, refresh: true });
check('indice non disponibile', false, senzaFile.disponibile);
check('nessuna certificazione per codice', null, scuolaCertificata(senzaFile, { codice: 'ARIC82300X' }));
check('nessuna certificazione per nome', null, scuolaCertificata(senzaFile, { nome: 'I.C. VASARI' }));
check('nessuna scuola citata', [], scuoleDaTesto(senzaFile, 'ARIC82300X'));
check(
  'indice `null` tollerato',
  [null, []],
  [scuolaCertificata(null, { codice: 'ARIC82300X' }), scuoleDaTesto(null, 'ARIC82300X')],
);

/* ------------------------- 7) LA GUARDIA È IN CATENA ------------------- */

console.log('\n— 7. Il modulo è in catena e ha un consumatore —');
const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:scuole-master' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-scuole-master.ts'));
const reporter = leggi('scripts/table-reporter.ts');
check('table-reporter usa la facciata', true, /from '\.\.\/src\/lib\/scuoleMaster\.ts'/.test(reporter));
check('table-reporter certifica la scuola', true, /scuolaCertificata\(/.test(reporter));

console.log(
  errori === 0
    ? '\n✅ SCUOLE MASTER: codice → istituto certificato, home istituzionale o niente.'
    : `\n❌ SCUOLE MASTER: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


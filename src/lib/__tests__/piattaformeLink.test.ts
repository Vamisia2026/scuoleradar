/**
 * TEST — PIATTAFORME PRIVATE (`src/lib/piattaformeLink.ts`).
 *
 * L'elenco degli host che NON servono un avviso verificabile (Argo, Nuvola–
 * Spaggiari/ClasseViva, moduli Google, cartelle SharePoint/OneDrive, WeTransfer)
 * è UNO per tabellone e ingestione: se divergesse, la regola «mai un link di
 * login» diventerebbe una questione di superficie. La guardia fissa:
 *   1. la NORMALIZZAZIONE dell'host (`www.`, punto finale, schema, URL invalidi);
 *   2. i POSITIVI (piattaforma) e i NEGATIVI che devono restare apribili
 *      (`/argo/avviso.pdf` su un `.edu.it`, `notargo.it`, `argoweb.it.evil.com`:
 *      il confronto è sull'host INTERO, mai su una sottostringa);
 *   3. la PROPRIETÀ dell'elenco: una sola dichiarazione in `src/**`, importata
 *      dai consumatori (`flightBoard/linkFonte.ts`, `lib/scuoleMaster.ts`);
 *   4. la GUARDIA è in catena in `npm test`.
 *
 * Uso: npm run test:piattaforme-link  (incluso in `npm test`)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HOST_PIATTAFORMA_PRIVATA, ePiattaformaPrivata, hostDaUrl } from '../piattaformeLink.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Tutti i file di codice sotto una cartella (percorsi POSIX, ricorsivo). */
function fileDiCodice(cartella: string): string[] {
  const out: string[] = [];
  for (const voce of readdirSync(cartella, { withFileTypes: true })) {
    if (voce.name === 'node_modules' || voce.name.startsWith('.')) continue;
    const pieno = join(cartella, voce.name);
    if (voce.isDirectory()) out.push(...fileDiCodice(pieno));
    else if (/\.tsx?$/.test(voce.name)) out.push(pieno.split('\\').join('/'));
  }
  return out;
}

/* ------------------- 1) HOST NORMALIZZATO E URL INVALIDI ------------------ */

console.log('\n— 1. Host: `www.`, punto finale, schema http(s) —');
check('host da URL https (minuscolo, senza `www.`)', 'portaleargo.it', hostDaUrl('https://WWW.PortaleArgo.IT/login?x=1'));
check('host con punto finale (FQDN)', 'iccarducci.edu.it', hostDaUrl('https://www.iccarducci.edu.it./avvisi'));
check('schema non http(s) non è un link apribile', null, hostDaUrl('ftp://www.iccarducci.edu.it/avvisi'));
check('protocollo `javascript:` non è un link apribile', null, hostDaUrl('javascript:alert(1)'));
check('testo che non è un URL', null, hostDaUrl('vai all’avviso'));
check('stringa vuota / assente', [null, null], [hostDaUrl(''), hostDaUrl()]);

/* --------------------- 2) PIATTAFORME: I TRE GRUPPI --------------------- */

console.log('\n— 2. Le piattaforme che chiedono il login —');
/** Casi [nome, url, atteso]: una tabella, nessuna ripetizione. */
type Caso = [string, string, boolean];
function tabella(righe: readonly Caso[]): void {
  for (const [nome, url, atteso] of righe) check(nome, atteso, ePiattaformaPrivata(url));
}
tabella([
  ['portale Argo per-istituto', 'https://www.portaleargo.it/argoweb/registro', true],
  ['Argo senza `www.`', 'https://argo.it/login', true],
  ['Argo Web', 'https://argoweb.it/istituto', true],
  ['Nuvola (Madisoft)', 'https://nuvola.madisoft.it/login', true],
  ['Spaggiari', 'https://web.spaggiari.eu/home/app.wp', true],
  ['ClasseViva', 'https://web.classeviva.it/ClasseViva-Web/', true],
  ['Google Forms', 'https://docs.google.com/forms/d/e/abc/viewform', true],
  ['link breve di Forms', 'https://forms.gle/8Xk2demo', true],
  ['cartella Google Drive', 'https://drive.google.com/drive/folders/abc', true],
  ['file OneDrive', 'https://1drv.ms/w/s!abc', true],
  ['cartella SharePoint', 'https://iccarducci.sharepoint.com/sites/albo', true],
  ['WeTransfer', 'https://we.tl/t-abc123', true],
]);


console.log('\n— 3. Ciò che resta APRIBILE (nessun falso positivo) —');
tabella([
  ['avviso PDF sul sito della scuola', 'https://www.liceoaugustomonti.edu.it/avvisi/interpello-1.pdf', false],
  ['percorso `/argo/` su un dominio di scuola', 'https://www.iccarducci.edu.it/argo/avviso.pdf', false],
  ['albo del Ministero', 'https://www.mim.gov.it/albo-pretorio/avviso-1.pdf', false],
  ['dominio che CONTIENE «argo»', 'https://notargo.it/avvisi', false],
  ['suffisso ingannevole', 'https://argoweb.it.evil.com/avviso.pdf', false],
  ['host che finisce come la piattaforma ma non lo è', 'https://spaggiari.eu.example.org/x', false],
  ['testo non URL / vuoto / assente', 'non un link', false],
]);

/* ------------------- 4) L’ELENCO È UNO, E I CONSUMATORI LO USANO --------- */

console.log('\n— 4. Un solo elenco, importato da tabellone e ingestione —');
const MODULO = 'src/lib/piattaformeLink.ts';
/** Forma con cui l'elenco è DICHIARATO (regex escapata, non un URL di prova). */
const DICHIARAZIONE_ARGO = 'portaleargo\\.it$';
const dichiarazioni = fileDiCodice('src').filter(
  (f) => f !== MODULO && readFileSync(f, 'utf8').includes(DICHIARAZIONE_ARGO),
);
check('l’elenco degli host è dichiarato SOLO in `piattaformeLink`', [], dichiarazioni);
check('almeno 15 host sorvegliati', true, HOST_PIATTAFORMA_PRIVATA.length >= 15);
const linkFonte = leggi('src/departments/radar/flightBoard/linkFonte.ts');
check('tabellone: importa l’elenco condiviso', true, /from '@\/lib\/piattaformeLink'/.test(linkFonte));
const scuoleMaster = leggi('src/lib/scuoleMaster.ts');
check(
  'ingestione: usa la regola unica',
  true,
  /from '\.\/piattaformeLink'/.test(scuoleMaster) && /ePiattaformaPrivata\(/.test(scuoleMaster),
);

/* ------------------------- 5) LA GUARDIA È IN CATENA -------------------- */

console.log('\n— 5. La guardia è nella catena di `npm test` —');
const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:piattaforme-link' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/piattaformeLink.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ PIATTAFORME: un solo elenco, mai un login spacciato per avviso.'
    : `\n❌ PIATTAFORME: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

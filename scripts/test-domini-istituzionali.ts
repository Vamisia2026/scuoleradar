/**
 * TEST — WHITELIST DEI DOMINI ISTITUZIONALI IN INGRESSO (§26.109).
 *
 * Perché esiste: la bacheca promette «il sito della scuola o il portale
 * dell'ufficio scolastico». Un link raccolto dal crawler o da un post può però
 * puntare all'articolo di un aggregatore concorrente, a un social, a un hosting
 * gratuito, a un modulo Google: pubblicato come fonte ufficiale diventa una
 * promessa falsa (e regala traffico a chi ci copia i bandi). Qui si fissa:
 *   1. cosa è AMMESSO (`*.edu.it`, `*.gov.it`, MIM/USR e i portali del registro);
 *   2. cosa è RIFIUTATO, compresi i trucchi di suffisso (`istruzione.it.evil.com`);
 *   3. che l'elenco dei portali USR/ATP arrivi dal REGISTRO fonti e non da una
 *      copia scritta a mano (che divergerebbe al primo ufficio aggiunto);
 *   4. il GATE 0 del presidio d'ingresso: link di terzi → home ufficiale se nota,
 *      altrimenti la riga resta fuori;
 *   5. il cablaggio (estrazione dei link, parser, catena di `npm test`).
 *
 * Uso: npm run test:domini-istituzionali  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  AGGREGATORI_PRIVATI,
  DOMINIO_MINISTERO,
  eAggregatorePrivato,
  eDominioIstituzionale,
  valutaDominio,
} from '../src/lib/dominiIstituzionali.ts';
import { opzioniDominio, portaliUfficiali } from '../src/scraper/portaliUfficiali.ts';
import { valutaIngressoPerLink } from '../src/scraper/presidioLinkIngresso.ts';
import { eHostIstituzionale } from '../src/scraper/parser.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ---------------- 1) CIÒ CHE PUÒ DIVENTARE LA FONTE DI UN AVVISO ---------------- */

console.log('— 1. Ammessi: scuole, PA, Ministero, portali USR/ATP —');
const ammessi: ReadonlyArray<readonly [string, string]> = [
  ['sito di istituto', 'https://www.iccarducci.edu.it/avvisi/interpello-1'],
  ['host nudo', 'iccarducci.edu.it'],
  ['PA in .gov.it', 'https://www.regione.gov.it/bandi'],
  ['Ministero', 'https://www.istruzione.it/'],
  ['portale su sottodominio del Ministero', 'https://usr.istruzione.it/interpelli'],
  ['schema malformato del file MIM', 'https//icbiella.edu.it/avvisi'],
  ['maiuscole e punto finale', 'WWW.LICEOAUGUSTOMONTI.EDU.IT.'],
];
for (const [nome, valore] of ammessi) check(nome, true, eDominioIstituzionale(valore));

/* ---------------- 2) CIÒ CHE NON ENTRA MAI ---------------- */

console.log('\n— 2. Rifiutati: aggregatori, social, hosting, trucchi di suffisso —');
const rifiutati: ReadonlyArray<readonly [string, string]> = [
  ['aggregatore concorrente', 'https://www.scuolainterpelli.it/interpello/123'],
  ['aggregatore senza www', 'https://interpelloweb.it/avviso'],
  ['sottodominio di un aggregatore', 'https://archivio.orizzontescuola.it/2026/10/interpello/'],
  ['gruppo social', 'https://t.me/interpellinazionale'],
  ['modulo Google', 'https://docs.google.com/forms/d/e/1FAIpQLSf/viewform'],
  ['hosting gratuito', 'https://interpelli.altervista.org/avviso.html'],
  ['dominio privato qualsiasi', 'https://www.iltuosito.it/interpello'],
  ['`edu.it` nudo (non è un istituto)', 'https://edu.it/'],
  ['`gov.it` nudo', 'gov.it'],
  ['suffisso truccato', 'https://istruzione.it.evil.com/avviso'],
  ['dominio che imita il Ministero', 'https://notistruzione.it/avviso'],
  ['post social', 'https://www.facebook.com/scuola/posts/123'],
  ['vuoto', ''],
  ['solo punteggiatura', '---'],
];
for (const [nome, valore] of rifiutati) check(nome, false, eDominioIstituzionale(valore));

check('motivo dell’aggregatore nel verdetto', true, /aggregatore privato/.test(valutaDominio('https://www.studenti.it/').motivo));
check('host normalizzato nel verdetto', 'scuolainterpelli.it', valutaDominio('https://www.scuolainterpelli.it/x').host);
check('riconoscimento dell’aggregatore (sottodominio compreso)', [true, true, false], [
  eAggregatorePrivato('https://www.scuolainterpelli.it/x'),
  eAggregatorePrivato('news.skuola.net'),
  eAggregatorePrivato('https://www.iccarducci.edu.it'),
]);
check('elenco diagnostico non vuoto e senza duplicati', true, AGGREGATORI_PRIVATI.length > 0 && new Set(AGGREGATORI_PRIVATI).size === AGGREGATORI_PRIVATI.length);
check('dominio del Ministero dichiarato una volta', 'istruzione.it', DOMINIO_MINISTERO);

/* ---------------- 3) I PORTALI UFFICIALI VENGONO DAL REGISTRO ---------------- */

console.log('\n— 3. Portali USR/ATP: l’elenco arriva dal registro fonti —');
const portali = portaliUfficiali();
check('il registro offre portali fuori dai suffissi pubblici', true, portali.length > 20);
check('portale storico del Piemonte nel registro', true, portali.includes('istruzionepiemonte.it'));
check('senza opzioni il portale storico è fuori', false, eDominioIstituzionale('https://www.istruzionepiemonte.it/interpelli'));
check('con le opzioni del registro è dentro', [true, 'portale ufficiale USR/ATP (istruzionepiemonte.it)'], [
  eDominioIstituzionale('https://www.istruzionepiemonte.it/interpelli', opzioniDominio()),
  valutaDominio('https://www.istruzionepiemonte.it/interpelli', opzioniDominio()).motivo,
]);
check(
  'ogni portale del registro è ammesso (sottodomini compresi)',
  true,
  portali.every((host) => eDominioIstituzionale(`https://${host}/`, opzioniDominio())),
);
check('l’elenco è stabile fra due letture', portali, portaliUfficiali());

/* ---------------- 4) IL GATE 0 DEL PRESIDIO D’INGRESSO ---------------- */

console.log('\n— 4. Gate d’ingresso: il link di terzi non viene pubblicato —');
const HOME = 'https://icbiella.edu.it';
const avviso = (link: string) => ({ title: 'Interpello A-026 Matematica', link });
const terziConHome = valutaIngressoPerLink(
  avviso('https://www.scuolainterpelli.it/interpello/123'),
  null,
  HOME,
  opzioniDominio(),
);
check('aggregatore + home nota → home ufficiale', [true, HOME, true], [terziConHome.accetta, terziConHome.link, terziConHome.sostituito]);
const terziSenzaHome = valutaIngressoPerLink(avviso('https://www.scuolainterpelli.it/'), null, null);
check('aggregatore senza home → riga fuori', [false, null], [terziSenzaHome.accetta, terziSenzaHome.link]);
const istituzionale = valutaIngressoPerLink(avviso('https://www.iccarducci.edu.it/avvisi/1'), { stato: 'ok' } as never, HOME);
check('link istituzionale vivo → si pubblica quello', ['https://www.iccarducci.edu.it/avvisi/1', false], [istituzionale.link, istituzionale.sostituito]);

/* ---------------- 5) IL CABLAGGIO ---------------- */

console.log('\n— 5. Cablaggio: estrazione, parser, script e catena di `npm test` —');
const indexScraper = leggi('src/scraper/index.ts');
check('l’estrazione dei link usa la regola unica', true, indexScraper.includes('eDominioIstituzionale(h, DOMINI)'));
check('la vecchia blocklist locale è sparita', false, /scuolainterpelli|t\.me\|facebook/.test(indexScraper));
check('il presidio d’ingresso applica la regola', true, leggi('src/scraper/presidioLinkIngresso.ts').includes('eDominioIstituzionale(link, dominio)'));
check('il parser non ha più una regex di suffissi propria', false, /RE_HOST_ISTITUZIONALE/.test(leggi('src/scraper/parser.ts')));
check('il parser riconosce il portale storico del registro', [true, false], [
  eHostIstituzionale('https://www.istruzionepiemonte.it/interpelli'),
  eHostIstituzionale('https://www.scuolainterpelli.it/interpello/1'),
]);

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:domini-istituzionali' in pkg.scripts);
check('guardia nella catena di `npm test`', true, (pkg.scripts.test ?? '').includes('scripts/test-domini-istituzionali.ts'));

console.log(
  errori === 0
    ? '\n✅ DOMINI ISTITUZIONALI: in bacheca solo siti di scuole e uffici, mai aggregatori.'
    : `\n❌ DOMINI ISTITUZIONALI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;



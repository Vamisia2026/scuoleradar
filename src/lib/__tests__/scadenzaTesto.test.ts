/**
 * TEST — LA SCADENZA DICHIARATA NEL TESTO (`src/lib/scadenzaTesto.ts`).
 *
 * Perché serve: un avviso vero veniva scartato come «senza scadenza» solo
 * perché il termine era nella frase («entro le ore 12:00 del …») e non in una
 * colonna. Questa guardia fissa il contratto di §26.94:
 *   1. le forme italiane standard («entro», «non oltre», «termine per la
 *      presentazione», «a pena di esclusione») producono la data;
 *   2. una data di PUBBLICAZIONE o di protocollo non diventa mai un termine;
 *   3. una data nuda non è una scadenza;
 *   4. le date impossibili (31 febbraio, mese 13, anno 1800) non esistono;
 *   5. il termine scritto nei metadati del link (title, aria-label, nome file)
 *      vale, ma un permalink WordPress no;
 *   6. modulo PURO, compatto e in catena (`npm test`).
 *
 * Uso: npm run test:scadenza-testo  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  dateNelTesto,
  scadenzaDaMetadati,
  scadenzaDaTesto,
} from '../scadenzaTesto.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ------------------- 1) LE FORME CHE GLI AVVISI USANO DAVVERO --------------- */

console.log('\n— 1. «entro», «non oltre», «termine», «a pena di esclusione» —');
check(
  'entro le ore … del',
  '2026-11-12',
  scadenzaDaTesto('Le domande vanno presentate entro le ore 12:00 del 12/11/2026.'),
);
check(
  'entro e non oltre il',
  '2026-11-12',
  scadenzaDaTesto('Le istanze vanno inviate entro e non oltre il 12/11/2026'),
);
check(
  'termine per la presentazione delle domande:',
  '2026-11-12',
  scadenzaDaTesto('Termine per la presentazione delle domande: 12/11/2026'),
);
check(
  'non oltre le ore … del giorno',
  '2026-11-12',
  scadenzaDaTesto('non oltre le ore 23:59 del giorno 12/11/2026'),
);
check(
  'a pena di esclusione entro il',
  '2026-11-12',
  scadenzaDaTesto('a pena di esclusione, entro il 12 novembre 2026'),
);
check(
  'manifattura: «scadenza»',
  '2026-11-12',
  scadenzaDaTesto('Scadenza: 12-11-2026'),
);
check(
  'data ISO dichiarata',
  '2026-11-12',
  scadenzaDaTesto('termine ultimo 2026-11-12'),
);
check(
  'etichetta DOPO la data',
  '2026-11-12',
  scadenzaDaTesto('12/11/2026 termine per la presentazione delle domande'),
);

/* ------------------- 2) PUBBLICAZIONE E PROTOCOLLO NON SONO TERMINI -------- */

console.log('\n— 2. Una data di pubblicazione non è una scadenza (§26.75) —');
check('pubblicato il', null, scadenzaDaTesto('Pubblicato il 12/11/2026'));
check('data di pubblicazione', null, scadenzaDaTesto('Data di pubblicazione: 12/11/2026'));
check('protocollo', null, scadenzaDaTesto('prot. n. 1234 del 12/11/2026'));
check('affisso all’albo', null, scadenzaDaTesto("Affisso all'albo il 12/11/2026"));
check(
  'pubblicazione + termine: vince il termine',
  '2026-11-20',
  scadenzaDaTesto('Pubblicato il 12/11/2026. Domande entro il 20/11/2026.'),
);
check(
  'protocollo + termine: vince il termine',
  '2026-11-20',
  scadenzaDaTesto('prot. n. 1234 del 10/11/2026 — scadenza 20/11/2026'),
);
check('data nuda: nessuna scadenza', null, scadenzaDaTesto('Interpello del 12/11/2026'));
check('testo senza date', null, scadenzaDaTesto('Nessuna data in questa riga'));
check('testo vuoto', null, scadenzaDaTesto('   '));

/* -------------------------- 3) DATE IMPOSSIBILI --------------------------- */

console.log('\n— 3. Il calendario non si inventa —');
check('31 febbraio non esiste', null, scadenzaDaTesto('entro il 31/02/2026'));
check('mese 13 non esiste', null, scadenzaDaTesto('entro il 12/13/2026'));
check('anno fuori scala', null, scadenzaDaTesto('entro il 12/11/1800'));
check('date valide del testo', ['2026-11-12'], dateNelTesto('entro il 12/11/2026').map((d) => d.iso));

/* -------------------- 4) METADATI DEL LINK (title/aria/URL) ---------------- */

console.log('\n— 4. Il termine scritto nel link vale, il permalink no —');
check(
  'title con scadenza',
  '2026-11-12',
  scadenzaDaMetadati({ titolo: 'Interpello A022 – scadenza 12/11/2026' }),
);
check(
  'aria-label con termine',
  '2026-11-12',
  scadenzaDaMetadati({ ariaLabel: 'Scarica l’avviso, termine 12/11/2026' }),
);
check(
  'nome del file',
  '2026-11-12',
  scadenzaDaMetadati({ url: 'https://www.icmanzoni.edu.it/albo/avviso_scadenza-12-11-2026.pdf' }),
);
check(
  'permalink WordPress: pubblicazione, non termine',
  null,
  scadenzaDaMetadati({ url: 'https://www.icmanzoni.edu.it/2026/11/12/interpello-a022/' }),
);
check(
  'titolo senza etichetta',
  null,
  scadenzaDaMetadati({ titolo: 'Interpello A022 matematica del 12/11/2026' }),
);
check('metadati vuoti', null, scadenzaDaMetadati({}));

/* --------------------------- 5) PUREZZA E CATENA -------------------------- */

console.log('\n— 5. Modulo puro, compatto e in catena —');
const sorgente = leggi('src/lib/scadenzaTesto.ts');
check('nessuna rete o database', false, /fetch\s*\(|axios|openai|anthropic|supabase/i.test(sorgente));
check('nessuna dipendenza esterna', false, /from '[^.]/i.test(sorgente));
check('sotto 250 righe', true, sorgente.split('\n').length <= 250);

const elenchi = leggi('src/lib/universalElenchi.ts');
check('il lettore d’elenchi usa la scadenza dal testo', true, /scadenzaDaTesto\(/.test(elenchi));
check('il lettore d’elenchi usa i metadati', true, /scadenzaDaMetadati\(/.test(elenchi));

const reporter = leggi('scripts/table-reporter.ts');
check('il runner legge il corpo dell’avviso', true, /scadenzaDaCorpoAvviso\(/.test(reporter));
check('il runner visita i siti delle scuole', true, /deepCrawlScuole\(/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:scadenza-testo' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('src/lib/__tests__/scadenzaTesto.test.ts'));

console.log(
  errori === 0
    ? '\n✅ SCADENZA NEL TESTO: il termine si legge dove la fonte lo scrive, senza inventarlo.'
    : `\n❌ SCADENZA NEL TESTO: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

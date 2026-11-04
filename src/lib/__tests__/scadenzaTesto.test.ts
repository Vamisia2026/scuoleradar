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
 *   6. la NATURA della data trovata (§26.139): già passata = pubblicazione,
 *      oltre i 90 giorni / coda d'anno = «Disponibilità aperta / Fine contratto»
 *      — mai un termine perentorio per forza, mai una riga da buttare;
 *   7. il termine PRESUNTO di un atto d'albo (§26.142) è una data con una natura
 *      dichiarata, e tace dove la fonte un termine ce l'ha;
 *   8. modulo PURO, compatto e in catena (`npm test`).
 *
 * Uso: npm run test:scadenza-testo  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  classificaDateAvviso,
  dateNelTesto,
  eCodaAnnoScolastico,
  giorniTra,
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

/* ------- 5) LA NATURA DELLA DATA: pubblicazione, termine, fine contratto ------- */

console.log('\n— 5. §26.139. Che cosa è davvero la data trovata —');
// Riferimento dichiarato: le asserzioni non dipendono dal giorno in cui girano.
const OGGI = '2026-11-03';
const passata = classificaDateAvviso({ scadenza: '2026-10-31', oggi: OGGI });
check('data passata → publishedAt', '2026-10-31', passata.publishedAt);
check('data passata → nessuna scadenza perentoria', null, passata.expirationDate);
check('data passata → natura', 'pubblicazione', passata.natura);
check(
  'pubblicazione già nota: non la si sovrascrive',
  '2026-10-01',
  classificaDateAvviso({ scadenza: '2026-10-31', pubblicazione: '2026-10-01', oggi: OGGI }).publishedAt,
);
const inColonna = classificaDateAvviso({ scadenza: '2026-10-31', esplicita: true, oggi: OGGI });
check('data in colonna già passata: resta la scadenza', '2026-10-31', inColonna.expirationDate);
check('data in colonna già passata: natura', 'termine_scaduto', inColonna.natura);

const vicina = classificaDateAvviso({ scadenza: '2026-11-12', oggi: OGGI });
check('termine ravvicinato: natura', 'termine_candidatura', vicina.natura);
check('termine ravvicinato: giorni', 9, vicina.giorni);

for (const coda of ['2027-04-30', '2027-06-30', '2027-08-31']) {
  const lontana = classificaDateAvviso({ scadenza: coda, oggi: OGGI });
  check(`${coda}: la data RESTA (non si scarta)`, coda, lontana.expirationDate);
  check(`${coda}: natura`, 'disponibilita_aperta', lontana.natura);
  check(
    `${coda}: etichetta`,
    'Disponibilità aperta / Fine contratto',
    lontana.etichetta,
  );
}
check(
  'coda d’anno a 46 giorni = fine contratto',
  'disponibilita_aperta',
  classificaDateAvviso({ scadenza: '2027-06-30', oggi: '2027-05-15' }).natura,
);
check(
  'coda d’anno entro il mese = termine di candidatura',
  'termine_candidatura',
  classificaDateAvviso({ scadenza: '2027-06-30', oggi: '2027-06-10' }).natura,
);
check('oltre i 90 giorni = fine contratto', 'disponibilita_aperta', classificaDateAvviso({ scadenza: '2027-03-15', oggi: OGGI }).natura);
const senzaData = classificaDateAvviso({ oggi: OGGI });
check('nessuna data: natura', 'nessuna', senzaData.natura);
check('nessuna data: etichetta', 'Nessun termine dichiarato', senzaData.etichetta);
check('giorni fra due date', 31, giorniTra('2026-11-03', '2026-12-04'));
check('giorni su data illeggibile', null, giorniTra('2026-11-03', 'domani'));
check('coda d’anno riconosciuta', true, eCodaAnnoScolastico('2027-08-31'));
check('una data ordinaria non è coda d’anno', false, eCodaAnnoScolastico('2026-11-12'));

/* ------------- 5-bis) IL TERMINE PRESUNTO (§26.142) --------------- */

console.log('\n— 5-bis. Un termine PRESUNTO è una data, non un silenzio (§26.142) —');
const presunto = classificaDateAvviso({
  pubblicazione: '2026-11-01',
  oggi: OGGI,
  presunzione: '2026-11-08',
});
check('il termine presunto diventa la data della riga', '2026-11-08', presunto.expirationDate);
check('la sua natura è dichiarata', 'disponibilita_aperta', presunto.natura);
check('con l’etichetta di sempre', 'Disponibilità aperta / Fine contratto', presunto.etichetta);
check('i giorni si contano dal riferimento', 5, presunto.giorni);
check('la pubblicazione resta quella della fonte', '2026-11-01', presunto.publishedAt);
const conTermine = classificaDateAvviso({
  scadenza: '2026-11-12',
  oggi: OGGI,
  presunzione: '2026-11-08',
});
check('dove la fonte dichiara un termine, la presunzione tace', '2026-11-12', conTermine.expirationDate);
check('e la natura resta quella del termine', 'termine_candidatura', conTermine.natura);
const senzaPresunzione = classificaDateAvviso({ pubblicazione: '2026-11-01', oggi: OGGI });
check('senza presunzione la riga resta senza termine', null, senzaPresunzione.expirationDate);
check('natura «nessuna»', 'nessuna', senzaPresunzione.natura);

/* --------------------------- 6) PUREZZA E CATENA -------------------------- */

console.log('\n— 6. Modulo puro, compatto e in catena —');
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

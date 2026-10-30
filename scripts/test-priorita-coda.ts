/**
 * TEST — LA CODA METTE LE SCUOLE DAVANTI (`src/lib/prioritaCoda.ts`, §26.112).
 *
 * Perché serve: la coda `discovered_links` era ordinata per `depth` e
 * `path_score` soltanto. Le 828 home seminate il 09/10/2026 (private e
 * dell'infanzia, host non istituzionali) stanno tutte a `depth 0` e
 * `path_score 0`: a pari punteggio l'ordine è quello fisico del database, così
 * con un tetto di 120 target al giorno le home `*.edu.it` di Asti — anch'esse a
 * `depth 0` — non venivano MAI raggiunte, e la provincia risultava senza una
 * sola opportunità. Questa guardia fissa il contratto:
 *   1. prima i target ISTITUZIONALI (regola unica di `dominiIstituzionali`);
 *   2. dentro ciascun gruppo vale l'ordine storico (depth, path_score, URL);
 *   3. nulla si perde: il resto resta in coda e viene scelto quando serve;
 *   4. niente doppioni: una riga ripetuta non consuma due volte il tetto;
 *   5. il modulo è PURO (nessuna rete, nessun database);
 *   6. il discovery lo usa, e interroga prima i domini istituzionali.
 *
 * Uso: npm run test:priorita-coda  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { ordinaCoda, type VoceCoda } from '../src/lib/prioritaCoda.ts';
import { AGGREGATORI_PRIVATI } from '../src/lib/dominiIstituzionali.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const voce = (id: string, url: string, depth = 0, path_score = 0): VoceCoda => ({
  id,
  url,
  depth,
  path_score,
});

/* ------------------- 1) ISTITUZIONALI PRIMA, SENZA PERDERNE -------------- */

console.log('\n— 1. Le scuole passano davanti, il resto resta in coda —');
const coda = [
  voce('privata', 'https://www.scuolamariaexample.it/', 0, 0),
  voce('scuola', 'https://www.icmanzoni.edu.it/', 0, 0),
  voce('portale', 'https://usrpiemonte.istruzione.it/albo/', 0, 0),
  voce('aggregatore', 'https://www.scuolainterpelli.it/piemonte/asti', 0, 0),
  voce('comune', 'https://www.comune.asti.it/avvisi', 0, 0),
];
const esito = ordinaCoda(coda, 10);
check('nessuna riga persa', 5, esito.scelte.length);
check('istituzionali davanti', ['portale', 'scuola'], esito.scelte.slice(0, 2).map((v) => v.id));
check('due istituzionali', 2, esito.istituzionali);
check('tre altre fonti', 3, esito.altre);
check('niente scartato sotto il tetto', 0, esito.scartate);
check('le altre fonti vengono dopo', ['comune', 'aggregatore', 'privata'], esito.scelte.slice(2).map((v) => v.id));

console.log('\n— 2. Un dominio non istituzionale non passa davanti a una scuola —');
const misto = ordinaCoda(
  [voce('a', 'https://www.icmanzoni.edu.it/'), voce('b', 'https://www.portaleargo.it/argoweb/login')],
  1,
);
check('il tetto di uno lo prende la scuola', 'a', misto.scelte[0].id);
check('il login resta in coda, non sparisce', 1, misto.scartate);
check(
  'nessun aggregatore privato è istituzionale',
  0,
  AGGREGATORI_PRIVATI.filter((d) => ordinaCoda([voce('x', `https://www.${d}/`)], 1).istituzionali === 1).length,
);

/* --------------------- 3) L'ORDINE STORICO RESTA VALIDO ------------------ */

console.log('\n— 3. Dentro il gruppo: profondità, poi punteggio, poi URL —');
const ordine = ordinaCoda(
  [
    voce('fondo', 'https://www.icmanzoni.edu.it/albo/2024/', 4, 90),
    voce('home', 'https://secondaria.edu.it/', 0, 0),
    voce('albo', 'https://www.icmanzoni.edu.it/albo/', 1, 20),
    voce('interpelli', 'https://www.icmanzoni.edu.it/interpelli/', 1, 60),
  ],
  10,
);
check('quattro istituzionali', 4, ordine.istituzionali);
check('prima la home, poi il punteggio', ['home', 'interpelli', 'albo', 'fondo'], ordine.scelte.map((v) => v.id));

console.log('\n— 4. Portali USR/UST dichiarati: istituzionali per registro —');
const portale = 'https://www.istruzionepiemonte.it/';
check('senza registro non è istituzionale', 0, ordinaCoda([voce('p', portale)], 1).istituzionali);
check('con il registro lo diventa', 1, ordinaCoda([voce('p', portale)], 1, { portaliUfficiali: [portale] }).istituzionali);
check(
  'il sottodominio del portale è ammesso',
  1,
  ordinaCoda([voce('p', 'https://interpello2025.istruzionepiemonte.it/at/')], 1, {
    portaliUfficiali: ['istruzionepiemonte.it'],
  }).istituzionali,
);

/* ---------------------------- 5) IL TETTO DEL GIRO ----------------------- */

console.log('\n— 5. Il tetto del giro prende prima le scuole —');
const tanti = [
  voce('n1', 'https://www.esempio1.it/'),
  voce('n2', 'https://www.esempio2.it/'),
  voce('s1', 'https://www.icasti.edu.it/'),
  voce('s2', 'https://www.icalba.edu.it/'),
];
const tagliata = ordinaCoda(tanti, 2);
check('due target nel giro', ['s2', 's1'], tagliata.scelte.map((v) => v.id));
check('entrambi istituzionali', 2, tagliata.istituzionali);
check('nessuna altra fonte nel giro', 0, tagliata.altre);
check('le altre restano scartate (non perse)', 2, tagliata.scartate);
check('tetto zero: nessuna scelta', 0, ordinaCoda(tanti, 0).scelte.length);
check('tetto negativo: nessuna scelta', 0, ordinaCoda(tanti, -3).scelte.length);
check('limite frazionario arrotondato per difetto', 2, ordinaCoda(tanti, 2.9).scelte.length);

console.log('\n— 6. Una riga ripetuta non consuma due volte il tetto —');
const doppioni = ordinaCoda(
  [
    voce('x', 'https://www.icasti.edu.it/'),
    voce('x', 'https://www.icasti.edu.it/'),
    voce('', 'https://www.icalba.edu.it/'),
    voce('', 'https://www.icalba.edu.it/'),
  ],
  10,
);
check('due righe distinte', 2, doppioni.scelte.length);
check('stesso URL = stessa riga', 2, new Set(doppioni.scelte.map((v) => v.url)).size);
check(
  'senza identificativo la chiave è l’URL',
  1,
  ordinaCoda([voce('', 'https://www.icasti.edu.it/'), voce('', 'https://www.icasti.edu.it/')], 10).scelte.length,
);

console.log('\n— 7. L’ordine del chiamante non viene modificato —');
const originale = [voce('b', 'https://www.esempio.it/'), voce('a', 'https://www.icasti.edu.it/')];
const ordinate = ordinaCoda(originale, 10);
check('in ingresso resta com’era', ['b', 'a'], originale.map((v) => v.id));
check('in uscita le scuole davanti', ['a', 'b'], ordinate.scelte.map((v) => v.id));

/* --------------------------- 8) PUREZZA E CABLAGGIO ---------------------- */

console.log('\n— 8. Modulo puro, e il discovery lo usa davvero —');
const sorgente = leggi('src/lib/prioritaCoda.ts');
const codiceEseguibile = sorgente
  .split('\n')
  .filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios/i.test(codiceEseguibile));
check('nessun database', false, /supabase|created?Client/i.test(codiceEseguibile));
check('nessun stato riscritto', false, /\.update\(|\.upsert\(/.test(codiceEseguibile));
check('riusa la whitelist esistente', true, /import \{ eDominioIstituzionale \} from '\.\/dominiIstituzionali'/.test(sorgente));
check('sotto 300 righe', true, sorgente.split('\n').length <= 300);

const discovery = leggi('scripts/discovery-engine.ts');
check('il discovery ordina con il modulo', true, /ordinaCoda\(/.test(discovery));
check('legge prima i domini istituzionali', true, /FILTRO_HOST_ISTITUZIONALI/.test(discovery));
check('query dedicata riusabile', true, /async function chiediCoda\(/.test(discovery));
check('la coda mista è il completamento', true, /chiediCoda\([^)]*false\)/.test(discovery));
check('il verdetto finisce nel log', true, /coda\.istituzionali/.test(discovery));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:priorita-coda' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-priorita-coda.ts'));

console.log(
  errori === 0
    ? '\n✅ PRIORITÀ CODA: le scuole `*.edu.it` non stanno più dietro 828 home private.'
    : `\n❌ PRIORITÀ CODA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


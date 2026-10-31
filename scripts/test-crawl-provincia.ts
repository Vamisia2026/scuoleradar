/**
 * GUARDIA — CRAWLING DELLA PROVINCIA (§26.125).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La direttiva del 31/10/2026: «il sistema non scansiona i singoli
 * siti delle 52 scuole di Asti, si limita a 5 fonti centrali». Le cause erano due e
 * questa guardia le fissa entrambe:
 *   1. il deep crawl visitava solo gli istituti CITATI dall'USR, mai l'anagrafica
 *      (`scuoleMaster.scuoleDellaProvincia` + `--scuole-provincia`);
 *   2. il filtro `--province=AT` scartava gli hub REGIONALI, e il Piemonte non ha un
 *      hub censito su Asti: si spegneva l'unica fonte che ne parla
 *      (`ambitoProvincia.targetInAmbitoProvincia`).
 *
 * Esecuzione: `npm run test:crawl-provincia` (inclusa in `npm test`).
 * Con i file SCUANAGRAFE presenti stampa anche la lista reale delle scuole di Asti:
 * è la prova che il crawler ha qualcosa da contattare.
 */
import { existsSync, readFileSync } from 'node:fs';
import { regioneDiProvincia, regioniDelleProvince, targetInAmbitoProvincia } from '../src/lib/ambitoProvincia.ts';
import { caricaAnagrafica, type IndiceAnagrafica } from '../src/lib/anagraficaIndice.ts';
import type { ScuolaAnagrafica } from '../src/lib/anagraficaCsv.ts';
import { scuoleDellaProvincia } from '../src/lib/scuoleProvincia.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* -------------------- 1) AMBITO: provincia + hub regionale ---------------- */

console.log('\n— 1. Ambito della provincia: il target giusto, l’hub della regione —');
check('AT è in Piemonte', 'Piemonte', regioneDiProvincia('at'));
check('due province della stessa regione chiedono UNA regione', ['Piemonte'], regioniDelleProvince(['AT', 'TO']));
check(
  'target della provincia richiesta → dentro',
  true,
  targetInAmbitoProvincia({ province: 'AT', region: 'Piemonte', origine: 'db' }, ['AT']),
);
check(
  'target di un’altra provincia, non hub → fuori',
  false,
  targetInAmbitoProvincia({ province: 'GE', region: 'Liguria', origine: 'db' }, ['AT']),
);
check(
  'HUB della stessa regione → dentro (è l’USR che pubblica per Asti)',
  true,
  targetInAmbitoProvincia({ province: 'TO', region: 'Piemonte', origine: 'whitelist' }, ['AT']),
);
check(
  'HUB verificato presente in coda (origine db) → dentro lo stesso',
  true,
  targetInAmbitoProvincia({ province: 'TO', region: 'Piemonte', origine: 'db', verificata: true }, ['AT']),
);
check(
  'HUB di un’altra regione → fuori',
  false,
  targetInAmbitoProvincia({ province: 'BO', region: 'Emilia-Romagna', origine: 'whitelist' }, ['AT']),
);
check(
  'sorgente qualsiasi di un’altra regione → fuori',
  false,
  targetInAmbitoProvincia({ province: 'GE', region: 'Liguria', origine: 'db', verificata: false }, ['AT']),
);
check('nessun filtro → giro nazionale, tutto dentro', true, targetInAmbitoProvincia({ province: 'MI' }, []));

/* ------------------ 2) ANAGRAFICA: le scuole della provincia ------------- */

console.log('\n— 2. scuoleDellaProvincia: solo la provincia, una voce per sito —');
const riga = (codice: string, over: Partial<ScuolaAnagrafica> = {}): ScuolaAnagrafica => ({
  codice,
  istitutoCodice: null,
  istitutoNome: null,
  nome: `SCUOLA ${codice}`,
  email: null,
  pec: null,
  sitoWeb: null,
  provinciaNome: 'ASTI',
  provinciaCodice: 'AT',
  comune: 'ASTI',
  tipo: 'SCUOLA SECONDARIA DI SECONDO GRADO',
  paritaria: false,
  ...over,
});
const indice = (righe: ScuolaAnagrafica[]): IndiceAnagrafica => ({
  perCodice: new Map(righe.map((r) => [r.codice, r])),
  perIstituto: new Map(),
  sitoPerIstituto: new Map(),
  perNome: new Map(),
  totale: righe.length,
  fileLetti: [],
  disponibile: true,
});
const finto = indice([
  riga('ATIS00100A', { sitoWeb: 'www.istituto1.edu.it' }),
  riga('ATIS00100B', { sitoWeb: 'www.istituto1.edu.it' }), // stesso istituto: stesso sito
  riga('ATIC00200C', { sitoWeb: 'www.comprensivo2.edu.it' }),
  riga('ATEE00300D', { sitoWeb: null }), // plesso senza sito
  riga('ATIS00500F', { istitutoCodice: 'ATIS00500F', sitoWeb: 'www.scuola5.it' }),
  riga('ATEE00501G', { istitutoCodice: 'ATIS00500F', sitoWeb: 'www.scuola5.edu.it' }), // edu.it vince
  riga('ATEE00600H', { sitoWeb: null, pec: 'segreteria@pec.it' }), // la PEC non è una casa
  riga('AT1A00100P', { paritaria: true, sitoWeb: 'www.asiloprivato.it' }), // paritaria: fuori
  riga('MIIS00400E', { provinciaCodice: 'MI', provinciaNome: 'MILANO', sitoWeb: 'www.milano.edu.it' }),
]);
const esitoScuole = scuoleDellaProvincia(finto, 'at');
check('tre HOME distinte per la provincia di Asti', 3, esitoScuole.scuole.length);
check('senza sito dichiarato = non raggiungibile (mai un dominio di PEC)', 2, esitoScuole.senzaSito);
check('righe della provincia lette (Milano esclusa)', 8, esitoScuole.righe);
check('paritarie escluse di serie (un asilo privato non è una fonte)', 1, esitoScuole.paritarie);
check(
  'dedup per HOME: il doppione non raddoppia la visita',
  ['https://comprensivo2.edu.it', 'https://istituto1.edu.it', 'https://scuola5.edu.it'],
  esitoScuole.scuole.map((s) => s.home).sort(),
);
check(
  'a parità di istituto vince il dominio *.edu.it',
  'https://scuola5.edu.it',
  esitoScuole.scuole.find((s) => s.codice === 'ATEE00501G')?.home,
);
check('tetto rispettato', 1, scuoleDellaProvincia(finto, 'AT', { max: 1 }).scuole.length);
check(
  'anagrafica assente → esito vuoto, nessuna eccezione',
  0,
  scuoleDellaProvincia(null, 'AT').scuole.length,
);

/* --------------------------- 3) Cablaggio del giro ------------------------ */

console.log('\n— 3. Cablaggio: flag, stampa e comando unico —');
const reporter = leggi('scripts/table-reporter.ts');
check('flag --scuole-provincia', true, /--scuole-provincia/.test(reporter));
check('il flag si accende col filtro di provincia', true, /PROVINCE_FILTRO\.length > 0\);\s*$/m.test(reporter));
check('le scuole si seminano dall’anagrafica', true, /scuoleDellaProvincia\(anagrafica, provincia/.test(reporter));
check('stampa «Scuola contattata» per ogni istituto letto', true, /Scuola contattata: \$\{codice\}/.test(reporter));
check('stampa il blocco «SCUOLE CONTATTATE»', true, /SCUOLE CONTATTATE \(province:/.test(reporter));
check('gli hub regionali entrano nel giro mirato', true, /targetInAmbitoProvincia\(target, PROVINCE_FILTRO\)/.test(reporter));
check(
  'una provincia con la coda vuota prosegue sul deep crawl',
  true,
  /if \(!SCUOLE_PROVINCIA\) \{[\s\S]{0,200}?return;/.test(reporter),
);

const comando = leggi('scripts/crawl-provincia.ts');
check('il comando unico esiste', true, /scuoleDellaProvincia/.test(comando) && /table-reporter\.ts/.test(comando));
check('promuove la coda solo con --apply', true, /if \(APPLY && !DRY_RUN\)/.test(comando));

const pkg = leggi('package.json');
check('script npm dedicato', true, /"crawl:provincia": "tsx scripts\/crawl-provincia\.ts"/.test(pkg));
check('guardia dedicata', true, /"test:crawl-provincia": "tsx scripts\/test-crawl-provincia\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /test-crawl-provincia\.ts/.test(pkg));
check(
  'workflow manuale per provincia',
  true,
  existsSync('.github/workflows/crawl-provincia.yml'),
);

/* ------------- 4) LA LISTA VERA: le scuole di Asti dall'anagrafica -------- */

console.log('\n— 4. Le scuole di Asti secondo l’anagrafica MIM —');
const anagraficaReale = caricaAnagrafica();
if (!anagraficaReale.disponibile) {
  console.log(
    '• Anagrafica non disponibile in questa macchina (file SCUANAGRAFE assenti): ' +
      'la lista reale si stampa con `npm run crawl:provincia -- --province=AT`.',
  );
} else {
  const asti = scuoleDellaProvincia(anagraficaReale, 'AT');
  check('la provincia di Asti ha istituti da contattare', true, asti.scuole.length > 0);
  console.log(
    `• ${asti.scuole.length} istituti con sito ufficiale su ${asti.righe} righe d'anagrafica ` +
      `(${asti.senzaSito} senza sito dichiarato):`,
  );
  for (const scuola of asti.scuole) {
    console.log(`    · ${scuola.codice} — ${scuola.nome ?? 'nome non dichiarato'} → ${scuola.home}`);
  }
}

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ CRAWLING DELLA PROVINCIA: hub regionali dentro, scuole dall’anagrafica, lista in console.');
} else {
  console.log(`❌ CRAWLING DELLA PROVINCIA: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

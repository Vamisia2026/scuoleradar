/**
 * TEST — VETRINA VISIBILE (§26.119): la bacheca non resta vuota con il Radar pieno.
 *
 * Perché esiste: il 30/10/2026 la dashboard di un utente di Asti mostrava ZERO
 * opportunità con 395 avvisi attivi in Italia. Non era un problema di matching:
 *   1. il mapper leggeva solo `class_codes` (array) e ignorava `class_code`
 *      (singolare, 465 righe contro 197): le righe arrivavano senza classe;
 *   2. il gate identitario della pagina (`Classe / Materia`) le scartava TUTTE;
 *   3. il minimo dei cinque posti si contava sulla BACHECA, non sulla vetrina:
 *      cinque righe «piene» in memoria, zero a schermo, nessuna integrazione.
 * Questa guardia fissa il contratto:
 *   · la riga è presentabile solo con Provincia + Ordine + Classe/Materia;
 *   · la vetrina tiene solo righe PRESENTABILI e ANCORA APERTE (una scadenza di oggi
 *     vale tutto il giorno, §26.100);
 *   · il minimo si conta sulla vetrina, e sotto il minimo si integra regione → Italia
 *     (`vetrinaConAmbiti`), con le righe fuori zona dichiarate e senza voto;
 *   · la classe arriva anche dalla colonna singolare, mai dai segnaposto «GENERALE»;
 *   · ingestione e pagina usano QUESTE funzioni (nessun gate duplicato);
 *   · il modulo resta puro (niente rete, niente `node:*`).
 *
 * Uso: npm run test:vetrina-bacheca  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { MINIMO_BACHECA } from '../src/lib/riempitivi.ts';
import { codiciClasseRiga } from '../src/lib/matchingEngine.ts';
import {
  campiMancantiVetrina,
  rigaVetrinaCompleta,
  vetrinaConAmbiti,
  vetrinaVisibile,
} from '../src/lib/vetrinaBacheca.ts';
import type { Interpello } from '../src/data/interpelli.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Interpello di prova: identità completa, sovrascrivibile campo per campo. */
const avviso = (overrides: Partial<Interpello> = {}): Interpello => ({
  id: 'v1',
  titolo: 'Interpello supplenza ADEE',
  istituto: 'I.C. COSTIGLIOLE',
  provinciaCodice: 'AT',
  provinciaNome: 'Asti',
  classeCodice: 'ADEE',
  classiCodes: ['ADEE'],
  materia: null,
  ordine: 'primaria',
  dataScadenza: '2099-11-02',
  descrizione: 'Interpello supplenza ADEE',
  linkFonte: 'https://servizi.istruzionepiemonte.it/interpello2025/ric_interpello_ambito_at.php#progr=1',
  compatibilita: 100,
  ...overrides,
});

/* --------------------- 1) IL GATE IDENTITARIO --------------------------- */

console.log('\n— 1. La riga è presentabile solo con l’identità completa —');
check('riga identitaria → presentabile', true, rigaVetrinaCompleta(avviso()));
check(
  'riga SENZA classe → non presentabile (era il gate che svuotava la pagina)',
  false,
  rigaVetrinaCompleta(avviso({ classeCodice: '', classiCodes: [] })),
);
check(
  'la mancanza è dichiarata, mai silenziosa',
  ['Classe / Materia'],
  campiMancantiVetrina(avviso({ classeCodice: '', classiCodes: [] })),
);
check(
  'senza provincia → non presentabile',
  false,
  rigaVetrinaCompleta(avviso({ provinciaCodice: '', provinciaNome: '' })),
);

/* ------------------ 2) LA VETRINA: APERTA E PRESENTABILE ---------------- */

console.log('\n— 2. Vetrina: solo righe presentabili e ancora aperte —');
check(
  'tiene la riga buona, scarta quella senza classe e quella scaduta',
  ['v1'],
  vetrinaVisibile([
    avviso(),
    avviso({ id: 'v2', classeCodice: '', classiCodes: [] }),
    avviso({ id: 'v3', dataScadenza: '2020-01-01' }),
  ]).map((r) => r.id),
);
check(
  'una scadenza di OGGI resta in vetrina tutto il giorno',
  ['v1'],
  vetrinaVisibile([avviso({ dataScadenza: '2026-10-30' })], new Date('2026-10-30T20:00:00Z')).map(
    (r) => r.id,
  ),
);
check('input vuoto → vetrina vuota', 0, vetrinaVisibile([]).length);

/* --------- 3) IL MINIMO SI CONTA SULLA VETRINA, NON SULLA BACHECA ------- */

console.log('\n— 3. Provincia → regione → Italia, contando ciò che si vede —');
const provinciaPiena = Array.from({ length: MINIMO_BACHECA }, (_, i) =>
  avviso({ id: `p${i + 1}`, compatibilita: 90 }),
);
const piena = vetrinaConAmbiti(provinciaPiena, {
  fuori: [avviso({ id: 'r1', provinciaCodice: 'TO', provinciaNome: 'Torino' })],
  province: ['AT'],
});
check('con cinque righe visibili non si integra nulla', MINIMO_BACHECA, piena.length);
check(
  'nessuna riga fuori zona entra',
  false,
  piena.some((r) => r.ambito === 'regione' || r.ambito === 'nazionale'),
);


// Le cinque righe della bacheca NON sono presentabili: la vetrina è vuota e deve
// integrarsi (è il caso reale del 30/10/2026: 5 ripieghi senza classe, 0 a schermo).
// Le date restano entro l'orizzonte dei 15 giorni e il «oggi» è FISSO: la guardia non
// deve cambiare esito col passare del tempo.
const OGGI = new Date('2026-10-30T09:00:00Z');
const bachecaInvisibile = Array.from({ length: MINIMO_BACHECA }, (_, i) =>
  avviso({ id: `x${i + 1}`, classeCodice: '', classiCodes: [], dataScadenza: '2026-11-05' }),
);
const integrata = vetrinaConAmbiti(
  bachecaInvisibile,
  {
    fuori: [
      avviso({ id: 'reg1', provinciaCodice: 'TO', provinciaNome: 'Torino', dataScadenza: '2026-11-02', dataPubblicazione: '2026-10-28T09:00:00Z' }),
      avviso({ id: 'reg2', provinciaCodice: 'AL', provinciaNome: 'Alessandria', dataScadenza: '2026-11-03', dataPubblicazione: '2026-10-29T09:00:00Z' }),
      avviso({ id: 'reg3', provinciaCodice: 'CN', provinciaNome: 'Cuneo', dataScadenza: '2026-11-04', dataPubblicazione: '2026-10-27T09:00:00Z' }),
      avviso({ id: 'naz1', provinciaCodice: 'MI', provinciaNome: 'Milano', dataScadenza: '2026-11-03', dataPubblicazione: '2026-10-29T09:00:00Z' }),
      avviso({ id: 'naz2', provinciaCodice: 'RM', provinciaNome: 'Roma', dataScadenza: '2026-11-02', dataPubblicazione: '2026-10-28T09:00:00Z' }),
    ],
    province: ['AT'],
  },
  { oggi: OGGI },
);
check('la vetrina si riempie fino al minimo (e si ferma lì)', MINIMO_BACHECA, integrata.length);
check('prima la REGIONE, poi l’Italia', ['reg2', 'reg1', 'reg3'], integrata.slice(0, 3).map((r) => r.id));
check('le righe fuori zona sono dichiarate', true, integrata.every((r) => r.ambito !== 'provincia'));
check('le righe fuori zona non portano voto', [0, 0, 0, 0, 0], integrata.map((r) => r.compatibilita));
check('e non sono spacciate per ripieghi', false, integrata.some((r) => r.ripiego === true));
check(
  'a parità di ambito vince la più recente',
  ['reg2', 'reg1', 'reg3'],
  integrata.filter((r) => r.ambito === 'regione').map((r) => r.id),
);

const vuotoOvunque = vetrinaConAmbiti(
  bachecaInvisibile,
  { fuori: [], province: ['AT'] },
  { oggi: OGGI },
);
check('scorta esaurita: lista corta, mai righe inventate', 0, vuotoOvunque.length);

const mista = vetrinaConAmbiti(
  [avviso({ id: 'p1', dataScadenza: '2026-11-05' }), avviso({ id: 'p2', classeCodice: '', classiCodes: [], dataScadenza: '2026-11-05' })],
  {
    fuori: [avviso({ id: 'reg1', provinciaCodice: 'TO', provinciaNome: 'Torino', dataScadenza: '2026-11-02' })],
    province: ['AT'],
  },
  { minimo: 2, oggi: OGGI },
);
check('la riga buona resta davanti', ['p1', 'reg1'], mista.map((r) => r.id));
check('la riga illeggibile non entra nemmeno dalla scorta', false, mista.some((r) => r.id === 'p2'));


/* --------- 4) LA CLASSE ARRIVA ANCHE DALLA COLONNA SINGOLARE ---------- */

console.log('\n— 4. class_code (singolare) + class_codes (array): nessuna riga perde la classe —');
check('array vuoto: vale il singolare', ['ADEE'], codiciClasseRiga({ class_codes: [], class_code: 'adee' }));
check('dedup fra array e singolare', ['A-22'], codiciClasseRiga({ class_codes: ['A-22'], class_code: 'A-22' }));
check('array e singolare diversi: restano entrambi', ['A-22', 'ADEE'], codiciClasseRiga({ class_codes: ['A-22'], class_code: 'ADEE' }));
check('«GENERALE» non è una classe', [], codiciClasseRiga({ class_codes: ['GENERALE'], class_code: 'GENERALE' }));
check('riga senza classi', [], codiciClasseRiga({ class_codes: null, class_code: null }));

/* --------------------- 5) CABLAGGIO: UN SOLO METRO --------------------- */

console.log('\n— 5. Feed, pagina e ingestione usano la stessa regola —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
check('feed: la vetrina passa dal modulo puro', true, /vetrinaConAmbiti\(bacheca/.test(feed));
check('feed: il minimo si conta sulle righe visibili', true, /MINIMO_BACHECA - vetrina\.length/.test(feed));

const pagina = leggi('src/pages/DashboardPage.tsx');
check('pagina: usa la regola condivisa', true, /vetrinaVisibile\(interpelliFiltrati\)/.test(pagina));
check('pagina: nessun gate duplicato in linea', false, /mancanti\.includes\('Classe \/ Materia'\)/.test(pagina));

const motore = leggi('src/lib/matchingEngine.ts');
check('mapper: legge la colonna singolare', true, /codiciClasseRiga/.test(motore));
check('mapper: conosce i segnaposto', true, /CLASSI_SEGNAPOSTO/.test(motore));

const reporter = leggi('scripts/table-reporter.ts');
check(
  'ingestione: scrive l’ARRAY accanto al singolare (5 punti di costruzione)',
  true,
  (reporter.match(/class_codes: classiArray\(/g) ?? []).length >= 5,
);
check('ingestione: i segnaposto non diventano classi', true, /CLASS_CODE_SEGNAPOSTO/.test(reporter));
check('ingestione: giro mirato per provincia', true, /--province=/.test(reporter) && /PROVINCE_FILTRO/.test(reporter));
check('ingestione: il filtro vale anche su ciò che si scrive', true, /record\.province/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:vetrina-bacheca' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-vetrina-bacheca.ts'));
check('riparazione dei dati storici disponibile', true, /backfill-classi-array/.test(leggi('package.json')));
check('diagnosi per provincia disponibile', true, /diag-bacheca/.test(leggi('package.json')));

/* ------------------------- 6) PUREZZA DEL MODULO ----------------------- */

console.log('\n— 6. Modulo puro, verificabile senza browser —');
const sorgente = leggi('src/lib/vetrinaBacheca.ts');
const codice = sorgente
  .split('\n')
  .filter((riga) => !riga.trim().startsWith('//') && !riga.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codice));
check('nessun node:* (importabile dal browser)', false, /from\s+'node:/i.test(codice));
check('sotto 250 righe', true, sorgente.split('\n').length <= 250);

console.log(
  errori === 0
    ? '\n✅ VETRINA BACHECA: il minimo si conta su ciò che l’utente vede, e si dice da dove arriva.'
    : `\n❌ VETRINA BACHECA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


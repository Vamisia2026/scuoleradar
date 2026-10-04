/**
 * TEST — PIPELINE TOLLERANTE e BONIFICA DEI MOCK (direttiva 04/10/2026, §26.47).
 * ------------------------------------------------------------------------------
 * Due regole di prodotto, una guardia:
 *   1. **L'interpello genuino non si scarta MAI** per un'anagrafica incompleta
 *      (caso storico: i 10 annunci di Padova): la riga entra in `interpelli`, in
 *      vetrina e in notifica; lo stato `parziale` è solo un'etichetta onesta.
 *   2. **Nessun dato fittizio**: il feed di fallback è vuoto, i nomi delle scuole
 *      non si inventano (niente «Istituto <codice>», niente città «N/D»), lo
 *      scraper senza risultati logga e si ferma — non genera nulla.
 *
 * Esecuzione: npm run test:pipeline
 */
import { readFileSync } from 'node:fs';
import { interpelli } from '../src/data/interpelli.ts';
import {
  SCUOLA_NON_SPECIFICATA,
  anagraficaInAggiornamento,
  normalizzaStatoArricchimento,
  statoArricchimento,
} from '../src/lib/statoArricchimento.ts';
import { nomeGrezzoDaBando, preparaRigheBoard } from '../src/lib/liveBoard.ts';

declare const process: { exitCode?: number };

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) falliti += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${descrizione}` +
      (ok ? '' : `\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`),
  );
}

/** Legge un file del progetto (percorso relativo alla radice `project/`). */
function leggi(percorso: string): string {
  return readFileSync(new URL(`../${percorso}`, import.meta.url), 'utf8');
}

console.log('══════════════════════════════════════════════════════════');
console.log('🧪 PIPELINE TOLLERANTE (nessuno scarto, nessun dato fittizio)');
console.log('══════════════════════════════════════════════════════════');

console.log('\n— 1. Bonifica dei mock: nessun dato inventato —');
check('feed di fallback vuoto (nessun avviso dimostrativo)', 0, interpelli.length);

const SORGENTI_SENZA_FINZIONI = [
  'src/lib/school-lookup.ts',
  'src/lib/liveBoard.ts',
  'src/lib/nomeIstituto.ts',
  'src/lib/statoArricchimento.ts',
  'src/lib/matchingEngine.ts',
  'src/scraper/index.ts',
];
for (const file of SORGENTI_SENZA_FINZIONI) {
  const testo = leggi(file);
  check(`${file}: nessun nome scuola sintetico «Istituto <codice>»`, false, /Istituto \$\{/.test(testo));
  check(`${file}: nessuna città segnaposto «N/D»`, false, /'N\/D'|"N\/D"/.test(testo));
}
check(
  'school-lookup: generatore sintetico rimosso (nessuna definizione)',
  false,
  /export function resolveSchoolByCode/.test(leggi('src/lib/school-lookup.ts')),
);
const scraper = leggi('src/scraper/index.ts');
// I COMMENTI che dichiarano la rimozione dei mock non sono mock: si guarda il solo
// codice (via le righe di commento, sia `//` sia dentro un blocco `*`).
const scraperCodice = scraper
  .split('\n')
  .filter((riga) => !riga.trim().startsWith('//') && !riga.trim().startsWith('*'))
  .join('\n');
check(
  'scraper: non usa più il generatore sintetico',
  false,
  /resolveSchoolByCode/.test(scraperCodice),
);
check(
  'scraper: nessuna fixture/seed di test nella pipeline',
  false,
  /FIXTURE_HTML|SEED_INTERPELLI|fixtureInterpelli/i.test(scraperCodice),
);
check(
  'scraper: run senza risultati → solo log, nessun dato scritto',
  true,
  /Nessun interpello trovato nelle fonti/.test(scraper) &&
    /if \(unici\.length === 0\) \{[\s\S]{0,600}?return;/.test(scraper),
);

console.log('\n— 2. Stato dell’anagrafica: completo / parziale —');
check(
  'istituto presentabile + recapito → completo',
  'completo',
  statoArricchimento({ school_name: 'I.C. Ferruccio Ulivi', contact_email: 'rmic@istruzione.it' }),
);
check(
  'codice meccanografico valido + PEC → completo',
  'completo',
  statoArricchimento({ school_code: 'ASTF01000X', school_pec: 'astf01000x@pec.istruzione.it' }),
);
check('nessun istituto identificato → parziale', 'parziale', statoArricchimento({ contact_email: 'x@y.it' }));
check('istituto senza recapito → parziale', 'parziale', statoArricchimento({ school_name: 'I.C. Ferruccio Ulivi' }));
check(
  'nome grezzo NON presentabile = non identificato → parziale',
  'parziale',
  statoArricchimento({ school_name: 'ADEE | EEEE', contact_email: 'x@y.it' }),
);
check('codice meccanografico malformato non identifica', 'parziale', statoArricchimento({ school_code: 'ABC', contact_email: 'x@y.it' }));
check('etichetta DB normalizzata', 'completo', normalizzaStatoArricchimento('  COMPLETO '));
check('etichetta DB ignota → null', null, normalizzaStatoArricchimento('boh'));
check('stato «parziale» → marcatore attivo', true, anagraficaInAggiornamento('parziale'));
check('stato «completo» → nessun marcatore', false, anagraficaInAggiornamento('completo'));
check('stato ignoto/assente → nessuna affermazione', false, anagraficaInAggiornamento(null));

console.log('\n— 3. L’annuncio NON si scarta per anagrafica (caso Padova) —');
const FUTURO = '2099-12-31';
const righe = [
  {
    id: 'reale',
    title: 'Interpello supplenza A-022 — Liceo Augusto Monti',
    school_name: 'Liceo Augusto Monti',
    province: 'AT',
    expiration_date: FUTURO,
    stato_arricchimento: 'completo',
  },
  {
    id: 'padova-1',
    title: 'Interpello supplenza posto comune',
    school_name: null,
    province: 'PD',
    expiration_date: FUTURO,
    stato_arricchimento: 'parziale',
  },
  {
    id: 'padova-2',
    title: 'ADEE | EEEE | A042',
    school_name: 'ADEE | EEEE',
    province: 'PD',
    expiration_date: FUTURO,
  },
  {
    id: 'padova-3',
    title: 'Albo pretorio — elenco avvisi',
    school_name: 'Scuola primaria posto Montessori',
    province: 'PD',
    expiration_date: FUTURO,
    stato_arricchimento: 'parziale',
  },
  {
    id: 'scaduto',
    title: 'Interpello — Liceo Galilei',
    school_name: 'Liceo Galilei',
    province: 'RM',
    expiration_date: '2020-01-31',
  },
  {
    id: 'senza-data',
    title: 'Interpello — Liceo Galilei',
    school_name: 'Liceo Galilei',
    province: 'RM',
    expiration_date: null,
    created_at: '2020-01-01T00:00:00.000Z',
  },
];
const pronte = preparaRigheBoard(righe);
const idPresenti = pronte.map((p) => p.riga.id);
check('nessun avviso genuino scartato per anagrafica', ['reale', 'padova-1', 'padova-2', 'padova-3'], idPresenti);
check('avviso SCADUTO resta fuori (non è un avviso vivo)', false, idPresenti.includes('scaduto'));
check('avviso fuori finestra 60 giorni resta fuori', false, idPresenti.includes('senza-data'));
check('riga con nome reale: nessun marcatore', false, pronte.find((p) => p.riga.id === 'reale')?.anagraficaParziale);
check(
  'nome grezzo del bando mostrato quando manca l’istituto',
  'Scuola primaria posto Montessori',
  pronte.find((p) => p.riga.id === 'padova-3')?.scuola,
);
check(
  'dump di codici → dicitura gestita (mai codici in vetrina)',
  SCUOLA_NON_SPECIFICATA,
  pronte.find((p) => p.riga.id === 'padova-2')?.scuola,
);
check(
  'nessun nome risolvibile → dicitura gestita, riga presente',
  SCUOLA_NON_SPECIFICATA,
  pronte.find((p) => p.riga.id === 'padova-1')?.scuola,
);
check(
  'le righe di ripiego sono marcate per l’interfaccia',
  [true, true, true],
  pronte.filter((p) => p.riga.id.startsWith('padova')).map((p) => p.anagraficaParziale),
);

console.log('\n— 4. Nome grezzo del bando: mai pseudo-nomi —');
check('dump di codici di sostegno → null', null, nomeGrezzoDaBando('ADEE | EEEE'));
check('codici misti → null', null, nomeGrezzoDaBando('AAAA | A246'));
check('date/protocolli → null', null, nomeGrezzoDaBando('Avviso prot. 12345 del 12/09/2026'));
check('testo vuoto → null', null, nomeGrezzoDaBando('   '));
check(
  'nome leggibile → conservato',
  'Scuola primaria posto Montessori',
  nomeGrezzoDaBando('Scuola primaria posto Montessori'),
);

console.log('\n— 5. Scrittura tollerante: la riga esce sempre con lo stato —');
check('lo scraper calcola lo stato a ogni riga', true, /stato_arricchimento: statoArricchimento\(/.test(scraper));
check('la colonna è tollerata se la migrazione non è applicata', true, /'stato_arricchimento'/.test(scraper));

console.log('\n══════════════════════════════════════════════════════════');
if (falliti === 0) console.log('✅ PIPELINE TOLLERANTE: tutti i controlli superati');
else {
  console.log(`❌ PIPELINE TOLLERANTE: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('══════════════════════════════════════════════════════════');

/**
 * GUARDIA · RIGA DI TABELLA USR → TITLE CARD PULITA (§26.123)
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Le tabelle massive degli USR (Liguria `provincia.php?p=GE`,
 * Piemonte `ric_interpello_ambito_no.php` / `_vc.php`) rovesciano centinaia di
 * righe in bacheca. La riga NON è una card: è un record con celle unite, codici
 * classe accatastati, date di fine incarico e — quasi sempre — nessun recapito.
 *
 * Qui si verificano le tre garanzie che rendono la riga una card utilizzabile:
 *   1. RECORD SCADUTI FUORI — il gate della riga (`valutaRigaUst`) scarta bando
 *      scaduto, avviso chiuso e scadenza non dichiarata; la vetrina
 *      (`vetrinaVisibile`, richiamata nel feed) scarta di nuovo le scadenze
 *      passate: due sbarramenti, nessuna riga morta in pagina;
 *   2. RECAPITO DALLA «SARTORIA» — la riga porta `contact_email`/`school_pec`
 *      risolti con la gerarchia dei contatti (anagrafica MIM → PEO/PEC della
 *      convenzione ministeriale): nessuna card con «Email non disponibile»;
 *   3. CARD PULITA — la card mostra link alla fonte ufficiale, classe, scadenza
 *      ed email, e ripulisce il titolo dai dump di codici (`pulisciTitoloAvviso`).
 *
 * Uso: npm run test:scheda-ust  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { risolviEmailUfficialeScuola } from '../src/lib/emailScuola.ts';
import { valutaRigaUst, type RigaTabellaUst } from '../src/scraper/tabellaUst.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

function leggi(percorso: string): string {
  return readFileSync(new URL(`../${percorso}`, import.meta.url), 'utf8');
}


/* ------------------------- 1) IL GATE DELLA RIGA ------------------------- */

console.log('— 1. La riga di tabella: scaduti e chiusi fuori —');
const OGGI = new Date('2026-10-30T09:00:00');

/** Riga-tipo: Piacenza, IC Pianello, A022, scadenza fra sei giorni. */
function riga(over: Partial<RigaTabellaUst> = {}): RigaTabellaUst {
  return {
    titolo: 'Interpello supplenza posto intero',
    testo: 'Interpello per supplenza classe A022 — scadenza 05/11/2026 — codice PCIC81200P',
    data: '2026-11-05',
    codice: 'PCIC81200P',
    scuola: 'IC Pianello',
    classi: ['A022'],
    link: null,
    ...over,
  };
}

check('riga in finestra → candidabile', 'candidabile', valutaRigaUst(riga(), { oggi: OGGI }).stato);
check(
  'riga SCADUTA → scartata con il motivo',
  'bando scaduto',
  valutaRigaUst(riga({ data: '2026-10-01' }), { oggi: OGGI }).motivo,
);
check(
  'avviso CHIUSO → scartato',
  'avviso chiuso/revocato',
  valutaRigaUst(riga({ testo: 'Interpello A022 chiuso — codice PCIC81200P' }), { oggi: OGGI }).motivo,
);
check(
  'scadenza NON dichiarata → scartata (mai inventata)',
  'scadenza non dichiarata',
  valutaRigaUst(riga({ data: null }), { oggi: OGGI }).motivo,
);
// Piemonte `ric_interpello_ambito_*`: le righe non hanno nessun `<a href>`.
// La riga resta valida — l'identità dell'avviso è la tabella USR stessa, che il
// runner usa come fonte ufficiale (`urlUfficiale`) — ma non si inventa un link.
check(
  'riga senza link resta candidabile (Piemonte)',
  'candidabile',
  valutaRigaUst(riga({ link: null }), { oggi: OGGI }).stato,
);


/* --------------------- 2) IL RECAPITO DELLA «SARTORIA» --------------------- */

console.log('\n— 2. Il recapito della scuola ricostruito dal codice —');
check(
  'codice meccanografico → PEO ministeriale',
  { email: 'pcic81200p@istruzione.it', tipo: 'peo', fonte: 'codice' },
  risolviEmailUfficialeScuola({ schoolCode: 'PCIC81200P' }),
);
check(
  'stessa scuola in PEC quando serve un atto formale',
  { email: 'pcic81200p@pec.istruzione.it', tipo: 'pec', fonte: 'codice' },
  risolviEmailUfficialeScuola({ schoolCode: 'PCIC81200P', preferisciPec: true }),
);
check('codice illeggibile → nessun recapito inventato', null, risolviEmailUfficialeScuola({ testo: 'nessun codice' }));


/* ------------------------- 3) IL CABLAGGIO (statico) ------------------------- */

console.log('\n— 3. Riga USR: recapito in record, card con link/classe/scadenza/email —');
const reporter = leggi('scripts/table-reporter.ts');
check(
  'la riga di tabella risolve il contatto (gerarchia + convenzione)',
  true,
  /const schoolName = esito\.scuola[\s\S]{0,3000}?contact_email: contactEmail/.test(reporter),
);
check(
  'la riga di tabella dichiara anche la PEC',
  true,
  /const schoolName = esito\.scuola[\s\S]{0,3000}?school_pec: schoolPec/.test(reporter),
);
check(
  'la riga di tabella nasce con lo stato di arricchimento',
  true,
  /stato_arricchimento: statoArricchimento\(\{[\s\S]{0,200}contact_email: contactEmail/.test(reporter),
);

const card = leggi('src/components/InterpelloCard.tsx');
check('la card mostra la CLASSE', true, /etichettaClasse/.test(card));
check('la card mostra la SCADENZA', true, /Scadenza: \{formatDataAvviso/.test(card));
check('la card passa l’EMAIL alle azioni', true, /contactEmail=\{interpello\.contactEmail\}/.test(card));
check('la card punta al LINK della fonte ufficiale', true, /linkEsterno=\{linkEsterno\}/.test(card));
check('la card ripulisce il titolo dai dump di codici', true, /pulisciTitoloAvviso\(/.test(card));

const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
check('prima della card passa la vetrina (scadenze aperte)', true, /vetrinaVisibile\(bacheca\)/.test(feed));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:scheda-ust' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-scheda-ust.ts'));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ SCHEDA UST: riga scaduta fuori, recapito risolto, card con link/classe/scadenza/email.');
} else {
  console.log(`❌ SCHEDA UST: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

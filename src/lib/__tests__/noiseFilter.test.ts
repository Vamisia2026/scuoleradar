/**
 * TEST — PREFILTRO DEL RUMORE AMMINISTRATIVO (`src/lib/noiseFilter.ts`).
 *
 * Il pre-filtro gira PRIMA del parsing: se sbaglia in eccesso brucia opportunità
 * vere, se sbaglia in difetto riempie il motore di gare e circolari. La guardia
 * fissa i due lati: SCARTARE gare, circolari, burocrazia e pagine informative
 * (§26.82); TENERE interpelli e supplenze (A-22, sostegno ADEE), tutor PNRR,
 * CPIA e le pagine che citano un CIG. Verifica inoltre la precedenza del titolo,
 * la purezza del modulo e il cablaggio in `discovery-engine`/`table-reporter`.
 *
 * Uso: npm run test:noise-filter  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ADMIN_NOISE_PATTERNS,
  RECRUITMENT_INDICATORS,
  haFinestraCandidatura,
  hasRecruitmentIndicator,
  isAdministrativeNoise,
} from '../noiseFilter.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Rumore sì/no senza dover ripetere l'oggetto dell'esito in ogni caso. */
const rumore = (testo: string, titolo = ''): boolean =>
  isAdministrativeNoise(testo, titolo).isNoise;

/** Casi [nome, testo, titolo, atteso]: una tabella, nessuna ripetizione. */
type Caso = [string, string, string, boolean];
function tabella(righe: readonly Caso[]): void {
  for (const [nome, testo, titolo, atteso] of righe) check(nome, atteso, rumore(testo, titolo));
}

/* --------------------- 1) GARE, DETERMINE E FORNITURE -------------------- */

console.log('\n— Gli atti di gara non sono opportunità —');
tabella([
  [
    'una determina a contrarre con CIG',
    'Oggetto: affidamento diretto della fornitura di cancelleria. CIG Z4C3F2A1B9, CUP J11E23000120006.',
    'DETERMINA A CONTRARRE N. 77/2026',
    true,
  ],
  [
    'un avviso B2B senza titolo utile (CIG nel corpo)',
    'Avviso di selezione per affidamento diretto del servizio di pulizia. CIG: Z4C3F2A1B9.',
    '',
    true,
  ],
  [
    'l’«avviso di selezione» non salva una gara di forniture',
    'Avviso di selezione per la fornitura di arredi scolastici. Scadenza offerte 30/11.',
    '',
    true,
  ],
  ['prospetto di liquidazione / MEPA', 'Prospetto di liquidazione dei compensi. Acquisto effettuato su MEPA.', '', true],
  ['il CUP da solo è rumore', 'CUP J11E23000120006 — lavori di adeguamento palestra.', '', true],
  [
    '«determinazione» è la stessa famiglia di «determina»',
    'Determinazione del Dirigente Scolastico n. 412 del 3 ottobre.',
    '',
    true,
  ],
]);

/* ------------- 2) CIRCOLARI, SCUOLA E BUROCRAZIA DEL PERSONALE ------------ */

console.log('\n— Le circolari per le famiglie non sono opportunità —');
tabella([
  [
    'una circolare con viaggio di istruzione',
    'Si comunicano alle famiglie gli allegati e le autorizzazioni per il viaggio di istruzione a Roma.',
    'Circolare n. 45 — Viaggio di istruzione a Roma',
    true,
  ],
  ['circolare per i genitori senza titolo parlante', 'Circolare per le famiglie: orario scolastico definitivo dal 15 ottobre.', '', true],
  ['uscita didattica e orario scolastico', 'Uscita didattica al museo: modifiche all’orario scolastico del plesso.', '', true],
  ['elezione degli organi collegiali', 'Elezioni degli organi collegiali: liste entro il 30 ottobre.', '', true],
  [
    'assemblea sindacale',
    'Convocazione assemblea sindacale del 10 novembre per tutto il personale docente.',
    'Assemblea sindacale',
    true,
  ],
  [
    'quiescenza, TFR e ricostruzione di carriera',
    'Domanda di ricostruzione della carriera ai fini del trattamento di fine rapporto (TFR).',
    '',
    true,
  ],
  ['il TFS è rumore quanto il TFR', 'Modulistica per la cessazione dal servizio: TFS e buonuscita.', '', true],
  [
    'una circolare citata di sfuggita salvata da un interpello',
    'Si ricorda che è attivo un interpello per supplenza; la circolare alle famiglie resta separata.',
    '',
    false,
  ],
]);

/* ------------------- 3b) PAGINE INFORMATIVE (PCTO, progetti) -------------- */

console.log('\n— Le pagine informative non sono avvisi (§26.82) —');
// Un segnale informativo scarta da solo: sono pagine che RACCONTANO la scuola.
tabella([
  ['scuola in ospedale', 'Il progetto Scuola in Ospedale garantisce il diritto allo studio agli alunni ricoverati.', 'Scuola in ospedale', true],
  ['PCTO col menu «interpelli»', 'Percorsi per le competenze trasversali e l’orientamento (PCTO): aziende convenzionate. Interpelli · Supplenze · Albo.', 'PCTO — aziende convenzionate', true],
  ['formazione scuola-lavoro', 'Attività di formazione scuola lavoro per le classi terze e quarte.', 'Formazione scuola lavoro', true],
  ['corso di formazione per docenti', 'Corso di formazione per docenti sulla didattica inclusiva: iscrizioni su SOFIA.', 'Corsi di formazione 2026', true],
  ['elenco statico di scuole (USP)', 'Elenco delle scuole della provincia: istituti comprensivi, licei e istituti tecnici.', 'Elenco delle scuole — USP Rieti', true],
  ['mappa del sito', 'Mappa del sito: Home, Didattica, Interpelli, Albo, Contatti.', 'Mappa del sito', true],
]);

// …ma un BANDO VERO che parla di PCTO resta: titolo specifico + finestra.
check(
  'interpello per esperto PCTO con termine dichiarato → resta',
  false,
  rumore('Avviso di selezione per esperto PCTO. Presentare domanda entro il 30/10/2026.', 'Interpello esperto PCTO'),
);
check(
  'senza finestra la pagina informativa resta fuori anche col titolo forte',
  true,
  rumore('Interpello per esperto PCTO: le attività inizieranno a novembre.', 'Interpello esperto PCTO'),
);
check(
  'la finestra è riconosciuta in forma esplicita',
  true,
  haFinestraCandidatura('Le domande vanno presentate entro e non oltre il 05/11/2026.'),
);

/* ------------------ 3c) LE OPPORTUNITÀ VERE NON SI TOCCANO --------------- */

console.log('\n— Interpelli, sostegno e PNRR restano —');
tabella([
  [
    'interpello con classe di concorso e sostegno',
    'Interpello per la copertura di n. 2 posti di sostegno scuola primaria, classe di concorso ADEE. Scadenza 12/11/2026.',
    'Interpelli a.s. 2026/2027',
    false,
  ],
  [
    'supplenza su A-22 (italiano, storia, geografia)',
    'Avviso di selezione per il conferimento di supplenza annuale, classe di concorso A-22 (Italiano, storia, geografia).',
    'Avviso di selezione',
    false,
  ],
  [
    'tutor e orientatori PNRR',
    'Avviso di selezione per il conferimento di incarichi di tutor e orientatore, progetto PNRR. Candidatura entro il 5 novembre.',
    'Avviso selezione tutor PNRR',
    false,
  ],
  [
    'CPIA e corsi serali',
    'Interpello per supplenza presso il CPIA, corsi serali, classe di concorso A-24. Disponibilità entro il 9 novembre.',
    'Interpello CPIA — corsi serali',
    false,
  ],
  [
    'una pagina di interpelli che cita il CIG degli affidamenti',
    'Interpelli e supplenze in corso. Per la trasparenza si pubblica il CIG degli affidamenti: CIG Z4C3F2A1B9.',
    'Interpelli e supplenze',
    false,
  ],
  [
    'la fornitura citata in una pagina di interpelli non la scarta',
    'Interpello per supplenza: la fornitura didattica sarà consegnata al plesso. Disponibilità entro il 12/11.',
    'Interpello supplenza',
    false,
  ],
  [
    'un testo neutro non è giudicato dal pre-filtro',
    'Elenco dei documenti pubblicati nella sezione dedicata.',
    'Amministrazione trasparente',
    false,
  ],
  ['testo e titolo vuoti', '', '', false],
]);

/* --------------------- 4) PRECEDENZA DEL TITOLO ------------------------- */

console.log('\n— Il titolo è l’atto: la precedenza non si aggira —');
tabella([
  [
    'una determina non diventa un interpello per il corpo',
    'Avviso di selezione per interpello volto alla copertura di posti vacanti. CIG Z4C3F2A1B9.',
    'Determina n. 12 del 7 ottobre',
    true,
  ],
  [
    '«interpello» nel titolo salva l’atto bloccante',
    'Documento con CIG Z4C3F2A1B9 citato per trasparenza.',
    'Interpello per supplenza',
    false,
  ],
  ['un titolo generico non salva un atto bloccante', 'Documento con CIG Z4C3F2A1B9.', 'Avviso di selezione', true],
]);

/* --------------------- 5) PUREZZA E LISTE DI SEGNALI -------------------- */

console.log('\n— Il pre-filtro è puro e le liste sono vive —');
const sorgente = leggi('src/lib/noiseFilter.ts');
const esterne = [...sorgente.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]).filter((s) => !s.startsWith('./'));
check('dipendenze: solo file sorelli (`./…`, §26.91)', [], esterne);
check('nessun require dinamico né chiamata di rete', false, /require\s*\(|fetch\s*\(|axios|supabase/i.test(sorgente));
check('segnale CIG presente', true, ADMIN_NOISE_PATTERNS.some((p) => /CIG/.test(p.re.source)));
check('segnale determina presente', true, ADMIN_NOISE_PATTERNS.some((p) => /determina/.test(p.re.source)));
check('segnale TFR presente', true, ADMIN_NOISE_PATTERNS.some((p) => /TFR/.test(p.re.source)));
check('liste vive (≥ 20 segnali negativi, ≥ 8 positivi)', true, ADMIN_NOISE_PATTERNS.length >= 20 && RECRUITMENT_INDICATORS.length >= 8);
check('stringa vuota: nessun indicatore', false, hasRecruitmentIndicator(''));
check('spazi e NBSP non nascondono il segnale', true, rumore('CIG:\u00a0Z4C3F2A1B9'));



/* ------------------- 6) CABLAGGIO NELL’INGESTIONE ----------------------- */

console.log('\n— Il pre-filtro è nella catena di ingestione —');
const discovery = leggi('scripts/discovery-engine.ts');
check('discovery-engine importa il modulo', true, /from '\.\.\/src\/lib\/noiseFilter\.ts'/.test(discovery));
check('discovery-engine lo chiama', true, /isAdministrativeNoise\(/.test(discovery));
check('discovery-engine usa lo stato dedicato', true, /disqualified_noise/.test(discovery) && /noiseStatus/.test(discovery));

const reporter = leggi('scripts/table-reporter.ts');
check('table-reporter importa il modulo', true, /from '\.\.\/src\/lib\/noiseFilter\.ts'/.test(reporter));
check('table-reporter lo chiama', true, /isAdministrativeNoise\(/.test(reporter));

/* ------------------------ 7) LA GUARDIA È IN CATENA --------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:noise-filter' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('src/lib/__tests__/noiseFilter.test.ts'));

console.log(
  errori === 0
    ? '\n✅ NOISE FILTER: gare e circolari fuori dal motore, interpelli al loro posto.'
    : `\n❌ NOISE FILTER: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

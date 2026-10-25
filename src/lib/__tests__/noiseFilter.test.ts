/**
 * TEST — PREFILTRO DEL RUMORE AMMINISTRATIVO (`src/lib/noiseFilter.ts`).
 *
 * Il pre-filtro gira PRIMA del parsing: se sbaglia in eccesso brucia
 * opportunità vere, se sbaglia in difetto riempie il motore di gare e
 * circolari. La guardia fissa i due lati: SCARTARE gare, circolari per le
 * famiglie, assemblee sindacali e burocrazia del personale; TENERE interpelli
 * e supplenze (A-22, sostegno ADEE), tutor PNRR, CPIA e le pagine di interpelli
 * che citano un CIG. Verifica inoltre la precedenza del titolo, la purezza del
 * modulo (nessun import) e il cablaggio in `discovery-engine`/`table-reporter`.
 *
 * Uso: npm run test:noise-filter  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ADMIN_NOISE_PATTERNS,
  RECRUITMENT_INDICATORS,
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

/* --------------------- 1) GARE, DETERMINE E FORNITURE -------------------- */

console.log('\n— Gli atti di gara non sono opportunità —');
check(
  'una determina a contrarre con CIG',
  true,
  rumore(
    'Oggetto: affidamento diretto della fornitura di cancelleria. CIG Z4C3F2A1B9, CUP J11E23000120006.',
    'DETERMINA A CONTRARRE N. 77/2026',
  ),
);
check(
  'un avviso B2B senza titolo utile (CIG nel corpo)',
  true,
  rumore('Avviso di selezione per affidamento diretto del servizio di pulizia. CIG: Z4C3F2A1B9.'),
);
check(
  'l’«avviso di selezione» non salva una gara di forniture',
  true,
  rumore('Avviso di selezione per la fornitura di arredi scolastici. Scadenza offerte 30/11.'),
);
check(
  'prospetto di liquidazione / MEPA',
  true,
  rumore('Prospetto di liquidazione dei compensi. Acquisto effettuato su MEPA.'),
);
check(
  'il CUP da solo è rumore',
  true,
  rumore('CUP J11E23000120006 — lavori di adeguamento palestra.'),
);
check(
  '«determinazione» è la stessa famiglia di «determina»',
  true,
  rumore('Determinazione del Dirigente Scolastico n. 412 del 3 ottobre.'),
);


/* ------------- 2) CIRCOLARI, SCUOLA E BUROCRAZIA DEL PERSONALE ------------ */

console.log('\n— Le circolari per le famiglie non sono opportunità —');
check(
  'una circolare con viaggio di istruzione',
  true,
  rumore(
    'Si comunicano alle famiglie gli allegati e le autorizzazioni per il viaggio di istruzione a Roma.',
    'Circolare n. 45 — Viaggio di istruzione a Roma',
  ),
);
check(
  'una circolare per i genitori senza titolo parlante',
  true,
  rumore('Circolare per le famiglie: orario scolastico definitivo dal 15 ottobre.'),
);
check(
  'uscita didattica e orario scolastico',
  true,
  rumore('Uscita didattica al museo: modifiche all’orario scolastico del plesso centrale.'),
);
check(
  'elezione degli organi collegiali',
  true,
  rumore('Elezioni degli organi collegiali: presentazione delle liste entro il 30 ottobre.'),
);
check(
  'assemblea sindacale',
  true,
  rumore('Convocazione assemblea sindacale del 10 novembre per tutto il personale docente.', 'Assemblea sindacale'),
);
check(
  'quiescenza, TFR e ricostruzione di carriera',
  true,
  rumore('Domanda di ricostruzione della carriera ai fini del trattamento di fine rapporto (TFR).'),
);
check(
  'il TFS è rumore quanto il TFR',
  true,
  rumore('Modulistica per la cessazione dal servizio: TFS e buonuscita.'),
);
check(
  'una circolare citata di sfuggita salvata da un interpello',
  false,
  rumore('Si ricorda che è attivo un interpello per supplenza; la circolare alle famiglie resta separata.'),
);

/* ------------------ 3) LE OPPORTUNITÀ VERE NON SI TOCCANO --------------- */

console.log('\n— Interpelli, sostegno e PNRR restano —');
check(
  'interpello con classe di concorso e sostegno',
  false,
  rumore(
    'Interpello per la copertura di n. 2 posti di sostegno scuola primaria, classe di concorso ADEE. Scadenza 12/11/2026.',
    'Interpelli a.s. 2026/2027',
  ),
);
check(
  'supplenza su A-22 (italiano, storia, geografia)',
  false,
  rumore(
    'Avviso di selezione per il conferimento di supplenza annuale, classe di concorso A-22 (Italiano, storia, geografia).',
    'Avviso di selezione',
  ),
);
check(
  'tutor e orientatori PNRR',
  false,
  rumore(
    'Avviso di selezione per il conferimento di incarichi di tutor e orientatore, progetto PNRR. Candidatura entro il 5 novembre.',
    'Avviso selezione tutor PNRR',
  ),
);
check(
  'CPIA e corsi serali',
  false,
  rumore(
    'Interpello per supplenza presso il CPIA, corsi serali, classe di concorso A-24. Disponibilità entro il 9 novembre.',
    'Interpello CPIA — corsi serali',
  ),
);
check(
  'una pagina di interpelli che cita il CIG degli affidamenti',
  false,
  rumore(
    'Interpelli e supplenze in corso. Per la trasparenza si pubblica il CIG degli affidamenti: CIG Z4C3F2A1B9.',
    'Interpelli e supplenze',
  ),
);
check(
  'la fornitura citata in una pagina di interpelli non la scarta',
  false,
  rumore(
    'Interpello per supplenza: la fornitura didattica sarà consegnata al plesso. Disponibilità entro il 12/11.',
    'Interpello supplenza',
  ),
);
check(
  'un testo neutro non è giudicato dal pre-filtro',
  false,
  rumore('Elenco dei documenti pubblicati nella sezione dedicata.', 'Amministrazione trasparente'),
);
check('testo e titolo vuoti', false, rumore('', ''));

/* --------------------- 4) PRECEDENZA DEL TITOLO ------------------------- */

console.log('\n— Il titolo è l’atto: la precedenza non si aggira —');
check(
  'una determina non diventa un interpello per il corpo',
  true,
  rumore(
    'Avviso di selezione per interpello volto alla copertura di posti vacanti. CIG Z4C3F2A1B9.',
    'Determina n. 12 del 7 ottobre',
  ),
);
check(
  '«interpello» nel titolo salva l’atto bloccante',
  false,
  rumore('Documento con CIG Z4C3F2A1B9 citato per trasparenza.', 'Interpello per supplenza'),
);
check(
  'un titolo generico non salva un atto bloccante',
  true,
  rumore('Documento con CIG Z4C3F2A1B9.', 'Avviso di selezione'),
);

/* --------------------- 5) PUREZZA E LISTE DI SEGNALI -------------------- */

console.log('\n— Il pre-filtro è puro e le liste sono vive —');
const sorgente = leggi('src/lib/noiseFilter.ts');
check('nessun import (zero dipendenze)', false, /(^|\n)\s*import\s/.test(sorgente));
check('nessun require dinamico', false, /require\s*\(/.test(sorgente));
check('nessuna chiamata di rete', false, /fetch\s*\(|axios|supabase/i.test(sorgente));
check('segnale CIG presente', true, ADMIN_NOISE_PATTERNS.some((p) => /CIG/.test(p.re.source)));
check('segnale determina presente', true, ADMIN_NOISE_PATTERNS.some((p) => /determina/.test(p.re.source)));
check('segnale TFR presente', true, ADMIN_NOISE_PATTERNS.some((p) => /TFR/.test(p.re.source)));
check('almeno 20 segnali negativi', true, ADMIN_NOISE_PATTERNS.length >= 20);
check('almeno 8 indicatori positivi', true, RECRUITMENT_INDICATORS.length >= 8);
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

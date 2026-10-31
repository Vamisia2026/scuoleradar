/**
 * GUARDIA — BANDI CHE NON SONO LAVORO (§26.127).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Ampliando le scansioni cresce anche ciò che gli albi
 * pubblicano *accanto* agli interpelli: gare, forniture, alienazioni, pagine
 * morte. Questa guardia fissa le due cose che contano:
 *   1. la SEVERITÀ — le tre famiglie di falsi positivi vengono scartate, sia nel
 *      titolo sia in testa al corpo;
 *   2. la PROTEZIONE — un titolo di reclutamento (o una classe di concorso) non
 *      si scarta MAI: l'errore ammesso è una riga di troppo, non un interpello
 *      perso. Il limite è dichiarato, non nascosto.
 *
 * Esecuzione: `npm run test:bandi-commerciali` (inclusa in `npm test`).
 */
import { readFileSync } from 'node:fs';
import {
  MOTIVO_CESSIONE,
  MOTIVO_COMMERCIALE,
  MOTIVO_CONCORSO_STUDENTI,
  MOTIVO_GARA,
  MOTIVO_PAGINA_MORTA,
  MOTIVO_PIATTAFORMA,
  dichiaraPersonale,
  motivoBandoCommerciale,
} from '../src/lib/bandiCommerciali.ts';
import { motivoRigaNonOpportunita } from '../src/lib/qualitaAvviso.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* -------------------------- 1) Gare e appalti ----------------------------- */

console.log('\n— 1. Gare, forniture e piattaforme di acquisti restano fuori —');
check(
  'bando di gara per la fornitura di arredi',
  MOTIVO_GARA,
  motivoBandoCommerciale({ titolo: 'Bando di gara per la fornitura di arredi scolastici' }),
);
check(
  "procedura aperta per l'affidamento del servizio di pulizia",
  MOTIVO_GARA,
  motivoBandoCommerciale({ titolo: "Procedura aperta per l'affidamento del servizio di pulizia" }),
);
check(
  'indagine di mercato per la fornitura di dispositivi',
  MOTIVO_GARA,
  motivoBandoCommerciale({ titolo: 'Avviso di indagine di mercato per la fornitura di dispositivi' }),
);
check(
  'RdO su MEPA per acquisto di cancelleria',
  MOTIVO_GARA,
  motivoBandoCommerciale({ titolo: 'RdO su MEPA per acquisto di cancelleria' }),
);
check(
  'piattaforma dichiarata nel CORPO (non nel titolo)',
  MOTIVO_PIATTAFORMA,
  motivoBandoCommerciale({
    titolo: 'Avviso pubblico',
    testo: 'La procedura si svolge sulla piattaforma di approvvigionamento del Ministero.',
  }),
);
check(
  'gara dichiarata in testa al CORPO',
  MOTIVO_GARA,
  motivoBandoCommerciale({
    titolo: 'Avviso pubblico n. 4',
    testo: 'Si rende noto che è indetta una gara per la fornitura di banchi e sedie.',
  }),
);

/* --------------------- 2) Cessioni, commerciale, pagine ------------------- */

console.log('\n— 2. Vendite, contenuti commerciali e pagine morte sono contorno —');
check(
  "asta pubblica per l'alienazione dell'immobile",
  MOTIVO_CESSIONE,
  motivoBandoCommerciale({ titolo: "Asta pubblica per l'alienazione dell'immobile comunale" }),
);
check(
  'concessione del servizio di refezione',
  MOTIVO_CESSIONE,
  motivoBandoCommerciale({ titolo: 'Concessione del servizio di refezione scolastica' }),
);
check(
  'casa editrice che promuove le adozioni',
  MOTIVO_COMMERCIALE,
  motivoBandoCommerciale({ titolo: 'Casa editrice Zanichelli — promozione adozioni' }),
);
check('pagina 404', MOTIVO_PAGINA_MORTA, motivoBandoCommerciale({ titolo: '404 — Pagina non trovata' }));
check('cookie policy', MOTIVO_PAGINA_MORTA, motivoBandoCommerciale({ titolo: 'Cookie policy' }));
check('area riservata', MOTIVO_PAGINA_MORTA, motivoBandoCommerciale({ titolo: 'Area riservata' }));
check(
  'borsa di studio per studenti',
  MOTIVO_CONCORSO_STUDENTI,
  motivoBandoCommerciale({ titolo: "Bando per l'assegnazione di borse di studio" }),
);

/* --------------------------- 3) La protezione ----------------------------- */

console.log('\n— 3. Un titolo di reclutamento non si scarta mai —');
check(
  'interpello per docente di matematica',
  null,
  motivoBandoCommerciale({
    titolo: 'Interpello per la copertura di n. 1 posto di docente di matematica',
  }),
);
check('selezione per esperti PNRR', null, motivoBandoCommerciale({ titolo: 'Avviso di selezione per esperti PNRR' }));
check(
  'conferimento di incarico a esperto',
  null,
  motivoBandoCommerciale({ titolo: 'Avviso di selezione per il conferimento di incarico di esperto' }),
);
check('supplenza ATA', null, motivoBandoCommerciale({ titolo: 'Supplenza breve e saltuaria — personale ATA' }));
check(
  'conferimento a collaboratore scolastico',
  null,
  motivoBandoCommerciale({ titolo: 'Conferimento incarico di collaboratore scolastico' }),
);
check('messa a disposizione', null, motivoBandoCommerciale({ titolo: 'Messa a disposizione docenti primaria' }));
check('una classe di concorso protegge la riga', null, motivoBandoCommerciale({ titolo: 'Avviso', classi: ['A-01'] }));
check(
  'LIMITE DICHIARATO: «incarico» protegge anche una gara di progettazione (riga di troppo, non persa)',
  null,
  motivoBandoCommerciale({ titolo: "Avviso di selezione per l'affidamento dell'incarico di progettazione" }),
);
check(
  'LIMITE DICHIARATO: «esperto» protegge un titolo che cita una fornitura',
  null,
  motivoBandoCommerciale({ titolo: 'Interpello esperto per la fornitura di formazione' }),
);
check('un atto senza oggetto di appalto resta', null, motivoBandoCommerciale({ titolo: 'Determina dirigenziale n. 77' }));
check('riga vuota: nessun verdetto', null, motivoBandoCommerciale({}));
check('il riconoscimento del personale è dichiarato', true, dichiaraPersonale('Interpello supplenza'));

/* ------------------- 4) Bacheca, ingestione, pulizia ---------------------- */

console.log('\n— 4. Un solo giudizio: bacheca, ingestione e pulizia del DB —');
check(
  'la bacheca scarta la gara',
  MOTIVO_GARA,
  motivoRigaNonOpportunita({ titolo: 'Bando di gara per la fornitura di arredi' }),
);
check(
  'la bacheca tiene l’interpello',
  null,
  motivoRigaNonOpportunita({ titolo: 'Interpello di matematica', classi: ['A-01'] }),
);
const giudizio = leggi('src/lib/qualitaAvviso.ts');
const ingestion = leggi('src/scraper/qualitaOpportunita.ts');
const regola = leggi('src/lib/bandiCommerciali.ts');
check('la bacheca usa la regola condivisa', true, /motivoBandoCommerciale\(/.test(giudizio));
check('l’ingestione usa la STESSA regola', true, /motivoBandoCommerciale\(/.test(ingestion));
check(
  'l’ingestione la applica prima del rumore amministrativo',
  true,
  ingestion.indexOf('motivoBandoCommerciale(') < ingestion.indexOf('isAdministrativeNoise('),
);
check(
  'la pulizia del database passa dallo stesso giudizio',
  true,
  /motivoRigaNonOpportunitaAvviso\(/.test(leggi('scripts/pulisci-non-opportunita.ts')),
);
check('la regola è pura (nessun import)', false, /^import /m.test(regola));

const pkg = leggi('package.json');
check(
  'guardia dedicata ai bandi commerciali',
  true,
  /"test:bandi-commerciali": "tsx scripts\/test-bandi-commerciali\.ts"/.test(pkg),
);
check('nella catena di `npm test`', true, /test-bandi-commerciali\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ SEVERITÀ: le gare non entrano, gli interpelli non si perdono.');
} else {
  console.log(`❌ SEVERITÀ: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

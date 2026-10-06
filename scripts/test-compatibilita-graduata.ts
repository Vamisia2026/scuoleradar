/**
 * TEST — COMPATIBILITÀ GRADUATA: invarianti e cablaggio delle 5 MODALI.
 * --------------------------------------------------------------------------
 * Verifica ciò che NON deve cambiare quando le modali misurano il match:
 *
 *   1. INVARIANTI — il sostegno extra resta 60 (anche con una parola chiave trovata);
 *      fuori dal raggio l'avviso è escluso (0) salvo whitelist; la CONSEGNA
 *      (notifier/digest) resta STRICT, perché `provinceLimitrofe` è un'opzione della
 *      sola bacheca;
 *   2. OVERRIDE (Modalità 3) — una parola chiave trovata ASSEGNA il voto (90 piena ·
 *      85 vicina) e blocca la media delle altre modali: la provincia resta l'unica
 *      condizione (fuori dal raggio, esclusione);
 *   3. GRADUAZIONE — senza override il punteggio mostrato è la MEDIA PONDERATA delle
 *      modali applicabili (pesi: classe 2, resto 1 — `mediaModali.ts`) + jolly, con la
 *      penalità dichiarata rispetto al motore;
 *   4. CABLAGGIO — il feed delega alla bacheca pura, che applica modali, filtri
 *      scuole e cap dei riempitivi; card e modale mostrano motivo e parola chiave.
 *
 * I punteggi delle singole modali vivono in `npm run test:modali`; la geografia in
 * `npm run test:prossimita`; whitelist/blacklist in `npm run test:filtri-scuole`.
 *
 * Esecuzione: npm run test:compatibilita:graduata (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import { PUNTEGGIO_EXTRA_SOSTEGNO, punteggioCompatibilita } from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Profilo di riferimento della guardia (5 modali configurate). */
const profilo = { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'], materieCustom: [] } as const;

/* --------------------------- 1) INVARIANTI -------------------------------- */

console.log('— Invarianti: sostegno a 60, esclusione geografica, consegna strict —');
const sostegno = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AL', classi: ['ADEE'], ordine: 'primaria', titolo: 'Interpello sostegno scuola primaria' },
  { provinceLimitrofe: true },
);
check('SUGGERIMENTO EXTRA (sostegno) resta a 60: il pavimento non si sconta', PUNTEGGIO_EXTRA_SOSTEGNO, sostegno.punteggio);
check('e non porta penalità inventate', 0, sostegno.penalita);

const fuori = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'MN', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
check('oltre il raggio → escluso dalla bacheca', true, fuori.escluso);
check('e il punteggio è 0', 0, fuori.punteggio);
check('il motivo dichiara il raggio', true, /oltre il raggio di 60 km/.test(fuori.motivi.join(' ')));

const forzata = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'MN', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist: la scuola preferita non è esclusa', false, forzata.escluso);
check('ed è marcata come inclusione d’ufficio', true, forzata.forzata);

check(
  'CONSEGNA strict: provincia vicina senza opzione → 0 (nessuna regressione)',
  0,
  punteggioCompatibilita({ province: ['AT'], classi: ['A-22'] }, { province: 'AL', classi: ['A-022'] }),
);
check(
  'con l’opzione della bacheca la stessa opportunità è compatibile',
  100,
  punteggioCompatibilita(
    { province: ['AT'], classi: ['A-22'] },
    { province: 'AL', classi: ['A-022'] },
    { provinceLimitrofe: true },
  ),
);

console.log('\n— Graduazione: media PONDERATA delle modali, penalità dichiarata —');
const vicina = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AL', classi: ['A-022'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
// (100 × 1) ordine + (100 × 2) classe + (60 × 1) provincia = 360 : pesi 4 → 90.
check('ordine 100 · classe 100 (peso 2) · provincia vicina 60 → media ponderata 90', 90, vicina.punteggio);
check('la modale geografica è dichiarata nel dettaglio', 60, vicina.modali.provincia);
check('il denominatore è la somma dei pesi applicabili', 4, vicina.modali.pesoTotale);
check('la penalità rispetto al motore è misurata', 10, vicina.penalita);
check('il motivo racconta la provincia vicina', true, /provincia vicina/.test(vicina.motivi.join(' ')));
check('il tooltip dichiara la media ponderata', true, /media ponderata di 3 modali/.test(vicina.motivi.join(' ')));

// La CLASSE pesa il doppio (requisito abilitante): una classe estranea (55) trascina il
// voto più di una provincia solo vicina (60), a parità di ordine.
const classeEstranea = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'] },
  { province: 'AT', classi: ['A-01'], ordine: 'secondaria2', materia: 'Arte e immagine' },
  { provinceLimitrofe: true },
);
check('classe estranea: ordine 100 · classe 55 · provincia 100 → 78', 78, classeEstranea.punteggio);
check('e pesa più della provincia vicina (78 < 90)', true, classeEstranea.punteggio < vicina.punteggio);


/* ------------- 2) OVERRIDE DELLA MODALITÀ 3 (PAROLE CHIAVE) ---------------- */

console.log('\n— Override: la parola chiave assegna il voto, la provincia resta la condizione —');
/** Profilo con una parola chiave ad alta priorità (Modalità 3). */
const chiave = { ...profilo, ordini: ['secondaria2'] as const, materieCustom: ['Intelligenza Artificiale'] };
const conChiave = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('parola chiave trovata → voto ASSEGNATO 90 (la media delle altre modali tace)', 90, conChiave.punteggio);
check('l’override dichiara la parola chiave', 'Intelligenza Artificiale', conChiave.override?.parolaChiave);
check('nessun denominatore: la media non è stata calcolata', 0, conChiave.modali.pesoTotale);
check('il motivo dichiara il voto d’ufficio', true, /voto assegnato d'ufficio/.test(conChiave.motivi.join(' ')));

const chiaveVicina = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'], materieCustom: ['Didattica Multimediale'] },
  { province: 'AT', classi: ['A-22'], ordine: 'secondaria2', titolo: 'Corso multimediale' },
  { provinceLimitrofe: true },
);
check('match vicino → voto ASSEGNATO 85, anche con classe esatta (100)', 85, chiaveVicina.punteggio);
check('il grado dell’override è dichiarato', 'vicina', chiaveVicina.override?.grado);

// La PROVINCIA resta l’unica condizione: oltre il raggio l’esclusione d’ufficio vince.
const chiaveFuori = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('oltre il raggio l’avviso con la parola chiave è ESCLUSO', true, chiaveFuori.escluso);
check('e nessun voto d’ufficio viene assegnato', null, chiaveFuori.override ?? null);

const chiaveForzata = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist + parola chiave: entra d’ufficio col voto assegnato', 90, chiaveForzata.punteggio);
check('ed è marcata come inclusione d’ufficio', true, chiaveForzata.forzata);

// INVARIANTE §26.45: il pavimento del sostegno non si sconta e l’override non lo promuove.
const sostegnoChiave = valutaCompatibilita(
  { ...profilo, ordini: ['secondaria2'], materieCustom: ['Intelligenza Artificiale'] },
  {
    province: 'AL',
    classi: ['ADEE'],
    ordine: 'primaria',
    titolo: 'Interpello sostegno scuola primaria: intelligenza artificiale',
  },
  { provinceLimitrofe: true },
);
check('suggerimento EXTRA (sostegno) anche con la parola chiave: resta 60', PUNTEGGIO_EXTRA_SOSTEGNO, sostegnoChiave.punteggio);
check('e non diventa un voto d’ufficio', null, sostegnoChiave.override ?? null);

/* ---------------------------- 3) CABLAGGIO -------------------------------- */

console.log('\n— Cablaggio: feed → bacheca pura → card/modale —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const graduata = leggi('src/lib/compatibilitaGraduata.ts');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
check('feed: delega alla bacheca pura', true, /bachecaInterpelli\(/.test(feed));
check('feed: cerca anche le province entro il raggio', true, /provinceDiRicerca\(/.test(feed));
check('bacheca: applica le modali con l’opzione della bacheca', true, /valutaCompatibilita\(/.test(bacheca) && /provinceLimitrofe: true/.test(bacheca));
check('bacheca: cap dinamico dei riempitivi', true, /limitaRiempitivi\(/.test(bacheca));
check('graduata: il motore resta la base del punteggio', true, /punteggioCompatibilita\(/.test(graduata));
check('graduata: una sola media PONDERATA delle modali', true, /mediaPonderata\(/.test(graduata));
check(
  'card e modale: banda + motivo dichiarato',
  true,
  /bandaCompatibilita\(interpello\.compatibilita, interpello\.motivoCompatibilita\)/.test(card) &&
    /bandaCompatibilita\(interpello\.compatibilita, interpello\.motivoCompatibilita\)/.test(modale),
);
const consegna = ['src/lib/notifier.ts', 'src/lib/digest.ts', 'scripts/invia-digest.ts'];
check(
  'CONSEGNA: nessun file di notifica passa `provinceLimitrofe`',
  true,
  consegna.every((f) => !/provinceLimitrofe/.test(leggi(f))),
);
const moduli = [
  'src/lib/punteggioOrdine.ts',
  'src/lib/punteggioClasse.ts',
  'src/lib/punteggioCompetenze.ts',
  'src/lib/prossimitaGeografica.ts',
  'src/lib/filtriScuole.ts',
  'src/lib/areeDisciplinari.ts',
  'src/lib/mediaModali.ts',
];
check('una modale, un modulo (puro e testabile)', true, moduli.every((f) => leggi(f).length > 0));
// OVERRIDE — dal modulo puro al tipo, alla bacheca, alla card: un solo filo.
const datiInterpello = leggi('src/data/interpelli.ts');
check('tipo: il campo della parola chiave che ha assegnato il voto', true, /parolaChiaveVoto\?: string \| null/.test(datiInterpello));
check(
  'bacheca: l’override della valutazione diventa `parolaChiaveVoto`',
  true,
  /parolaChiaveVoto: valutazione\.override\?\.parolaChiave/.test(bacheca),
);
check(
  'bacheca: la pertinenza usa l’override (non un punteggio di modale)',
  true,
  /punteggioCompetenze\(profilo, avviso\)\.override !== null/.test(bacheca),
);
check(
  'card e modale: etichetta dedicata + tooltip dell’override',
  true,
  /ETICHETTA_PAROLA_CHIAVE/.test(card) &&
    /ETICHETTA_PAROLA_CHIAVE/.test(modale) &&
    /descrizioneParolaChiave\(parolaChiaveVoto, banda\.punteggio\)/.test(card) &&
    /descrizioneParolaChiave\(parolaChiaveVoto, banda\.punteggio\)/.test(modale),
);
check(
  'graduata: la parola chiave è l’unico tier di OVERRIDE (prima della media)',
  true,
  /if \(competenze\.override\) \{/.test(graduata) &&
    graduata.indexOf('if (competenze.override)') < graduata.indexOf('const contributi = ['),
);

/* ------------------------ 4) LA GUARDIA È NELLA CATENA -------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:compatibilita:graduata' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-compatibilita-graduata.ts'));

console.log(
  errori === 0
    ? '\n✅ COMPATIBILITÀ GRADUATA: override della parola chiave, media delle altre modali, sostegno a 60, consegna strict.'
    : `\n❌ COMPATIBILITÀ GRADUATA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

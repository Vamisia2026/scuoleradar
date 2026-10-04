/**
 * Verifica RICERCA UNIFICATA (classi di concorso + competenze + parole chiave).
 *
 * Digitando UNA parola (es. «Pedagogia») le due colonne del passo 3 del wizard e
 * la sezione «In cosa puoi lavorare» delle Preferenze devono mostrare gli STESSI
 * risultati: classe collegata per materia, competenza extra con quel nome e la
 * possibilità di usare il testo come parola chiave personale.
 *
 * Uso: npm run test:ricerca (insieme a `test-ricerca-cablaggio.ts`, che copre le
 * guardie STATICHE sui sorgenti delle due superfici).
 */
import { classiConcorso } from '../src/data/classiConcorso.ts';
import {
  cercaClassiDiConcorso,
  cercaCompetenzeExtra,
  cercaCompetenzeParole,
  cercaSelezioniRadar,
  classeCorrispondeAQuery,
  classeRispondeAQuery,
  etichettaMateria,
  normalizzaTestoRicerca,
  separaParoleChiave,
} from '../src/lib/ricercaSelezioniRadar.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Stato selezioni vuoto (nessuna classe/competenza/tag già scelto). */
const vuoto = { classiCodici: [], materieId: [], materieCustom: [] };

console.log('— Normalizzazione della query —');
check('accenti/spazi ignorati', 'pedagogia', normalizzaTestoRicerca('  PEDAGOGIA '));
check('trattino ignorato nel codice', 'a18', normalizzaTestoRicerca('A-18'));
check('accento normalizzato', 'creativita', normalizzaTestoRicerca('creatività'));

console.log('\n— Classi di concorso —');
check('«a18» trova la classe A-18', true, cercaClassiDiConcorso('a18').some((c) => c.codice === 'A-18'));
check('«A-18» trova la classe A-18', true, cercaClassiDiConcorso('A-18').some((c) => c.codice === 'A-18'));
check(
  '«Pedagogia» trova le classi collegate per MATERIA',
  true,
  cercaClassiDiConcorso('Pedagogia').some((c) => c.materie.includes('pedagogia')),
);
check('query vuota: catalogo disponibile (limite UI)', true, cercaClassiDiConcorso('').length > 0);
// TOLLERANZA anche su MATERIA e ORDINE: l'utente cerca «italiano» (materia) o
// «CPIA»/«adulti»/«primaria» (ordine di scuola) e il catalogo risponde — mai
// una casella vuota per una differenza di formato o di nome dell'area.
check(
  '«italiano» trova le classi di cattedra (materia collegata)',
  true,
  cercaClassiDiConcorso('italiano', 200).some((c) => c.materie.includes('italiano')),
);
check(
  '«CPIA» trova la classe del CPIA (denominazione)',
  true,
  cercaClassiDiConcorso('CPIA', 200).some((c) => c.codice === 'CPIA-ASSO'),
);
check(
  '«adulti» trova le classi dell’istruzione per adulti (ordine di scuola)',
  true,
  classiConcorso.some((c) => c.ordine === 'cpia' && classeCorrispondeAQuery(c, 'adulti')),
);
check(
  '«primaria» trova le classi della scuola primaria (ordine di scuola)',
  true,
  classiConcorso.some((c) => c.ordine === 'primaria' && classeCorrispondeAQuery(c, 'primaria')),
);

console.log('\n— CLASSI: tolleranza di scrittura (dashboard, wizard, onboarding) —');
// L'utente digita la classe come vuole: TUTTE queste forme indicano `A-19`.
const VARIANTI_A19 = ['a19', 'A19', 'A-19', 'a-19', 'A_19', 'A.19', 'A-019', 'A019', ' A 19 ', '  a 19  '];
check('ogni variante riconosce la classe A-19 (motore unificato)', VARIANTI_A19.map(() => true), VARIANTI_A19.map((v) => cercaClassiDiConcorso(v, 200).some((c) => c.codice === 'A-19')));
check('helper condiviso `classeRispondeAQuery`: varianti equivalenti', VARIANTI_A19.map(() => true), VARIANTI_A19.map((v) => classeRispondeAQuery('A-19', v)));
check('helper: classe diversa NON risponde', false, classeRispondeAQuery('A-18', 'a19'));
check('helper: query vuota non filtra (torna true)', true, classeRispondeAQuery('A-19', '   '));
// Ogni classe del catalogo è trovata in qualunque variante del PROPRIO codice.
const classiNonTrovate = classiConcorso
  .filter((c) => [c.codice, c.codice.toLowerCase(), c.codice.replace(/-/g, ''), c.codice.replace(/-/g, '_'), c.codice.replace(/-/g, '.'), ` ${c.codice.replace(/-/g, ' ')} `].some((v) => !classeRispondeAQuery(c.codice, v)))
  .map((c) => c.codice);
check('ogni classe trovata in ogni variante del proprio codice', [], classiNonTrovate);
check('filtro completo: denominazione e materia restano ricercabili', [true, true], [classiConcorso.some((c) => classeCorrispondeAQuery(c, 'pedagogia')), classiConcorso.some((c) => classeCorrispondeAQuery(c, c.denominazione.slice(0, 6)))]);

console.log('\n— Competenze extra (PNRR/PON) —');
check('«pedagogia» NON è una competenza extra (disciplina curricolare)', 0, cercaCompetenzeExtra('pedagogia').length);
check('«robotica» trova le competenze extra', true, cercaCompetenzeExtra('robotica').length > 0);
check('«illimitato» (testo libero): nessuna competenza', 0, cercaCompetenzeExtra('illimitato').length);

console.log('\n— Ricerca ESTESA: la parola chiave aggancia le materie correlate —');
check(
  '«inglese» aggancia la competenza «Lingua inglese» (è un tag PNRR/PON)',
  true,
  cercaCompetenzeExtra('inglese').some((m) => m.id === 'inglese'),
);
check(
  '«inglese» aggancia anche CLIL ed educazione linguistica',
  true,
  cercaCompetenzeExtra('inglese').some((m) => m.id === 'clil') &&
    cercaCompetenzeExtra('inglese').some((m) => m.id === 'educazione_linguistica'),
);
check(
  '«coding» aggancia robotica e competenze digitali',
  true,
  cercaCompetenzeExtra('coding').some((m) => m.id === 'robotica') &&
    cercaCompetenzeExtra('coding').some((m) => m.id === 'digital_skills'),
);
check(
  'le discipline curricolari restano fuori (agganciano solo le correlate)',
  [false, true],
  [
    cercaCompetenzeExtra('matematica').some((m) => m.id === 'matematica'),
    cercaCompetenzeExtra('matematica').some((m) => m.id === 'stem'),
  ],
);
check('testo senza correlazioni: nessuna competenza', 0, cercaCompetenzeExtra('zzqq').length);
check(
  'risultato unificato di «Inglese»: la competenza c’è e la parola chiave NON è riproposta',
  [true, []],
  [
    cercaSelezioniRadar('Inglese', vuoto).competenze.some((s) => s.chiave === 'inglese'),
    cercaSelezioniRadar('Inglese', vuoto).paroleChiave,
  ],
);

console.log('\n— Risultato UNIFICATO: «Pedagogia» —');
const gruppi = cercaSelezioniRadar('Pedagogia', vuoto);
check('contiene le classi collegate', true, gruppi.classi.length > 0);
check('query valida (non troppo corta)', false, gruppi.queryTroppoCorta);
check('parola chiave proposta per il testo libero', ['Pedagogia'], gruppi.paroleChiave);
check(
  'classe già selezionata: marcata «nel profilo»',
  true,
  cercaSelezioniRadar('A-18', { ...vuoto, classiCodici: ['A-18'] }).classi[0]?.selezionato === true,
);
check(
  'competenza già selezionata: marcata «nel profilo»',
  true,
  cercaSelezioniRadar('robotica', { ...vuoto, materieId: ['robotica'] }).competenze.find(
    (s) => s.chiave === 'robotica',
  )?.selezionato === true,
);
check(
  'parola chiave già presente: NON riproposta',
  [],
  cercaSelezioniRadar('Robotica', { ...vuoto, materieCustom: ['robotica'] }).paroleChiave,
);

console.log('\n— SEPARAZIONE dei campi: classi a sinistra, competenze/parole chiave a destra —');
const soloDestra = cercaCompetenzeParole('Pedagogia', vuoto);
const unificata = cercaSelezioniRadar('Pedagogia', vuoto);
check('colonna di destra: NESSUNA classe di concorso', 0, soloDestra.classi.length);
check(
  'colonna di destra: competenze e parole chiave IDENTICHE alla ricerca unificata',
  [true, true],
  [
    JSON.stringify(soloDestra.competenze) === JSON.stringify(unificata.competenze),
    JSON.stringify(soloDestra.paroleChiave) === JSON.stringify(unificata.paroleChiave),
  ],
);
check(
  'colonna di sinistra (classi): il filtro condiviso trova le classi per materia',
  true,
  cercaClassiDiConcorso('Pedagogia').some((c) => c.materie.includes('pedagogia')),
);
check('«Pedagogia» resta proponibile come parola chiave nella colonna di destra', ['Pedagogia'], soloDestra.paroleChiave);
check('query troppo corta: anche la colonna di destra sospende la ricerca', true, cercaCompetenzeParole('p', vuoto).queryTroppoCorta);

console.log('\n— Parole chiave MULTIPLE (separate da virgola) —');
check(
  '«A, B, C» → TRE tag indipendenti (mai una stringa incollata)',
  ['Intelligenza artificiale', 'Didattica digitale', 'Teatro'],
  separaParoleChiave('Intelligenza artificiale, Didattica digitale, Teatro'),
);
check('virgole doppie e spazi normalizzati', ['A', 'B'], separaParoleChiave('  A ,, B , '));
check('punto e virgola accettato', ['A', 'B'], separaParoleChiave('A;B'));
check(
  'duplicati rimossi (case-insensitive, tiene la prima forma)',
  ['robotica'],
  separaParoleChiave('robotica, ROBOTICA'),
);
check('testo vuoto o solo virgole → nessun tag', [], separaParoleChiave('  , ,, '));
check(
  'output vuoto quando ogni voce coincide con una competenza di catalogo',
  [],
  cercaSelezioniRadar('Robotica, Robotica', { ...vuoto, materieCustom: ['Robotica'] }).paroleChiave,
);
check('query di 1 carattere: ricerca sospesa', true, cercaSelezioniRadar('p', vuoto).queryTroppoCorta);
check('etichetta materia leggibile (id → nome)', 'Pedagogia', etichettaMateria('pedagogia'));

console.log(errori === 0 ? '\n✅ RICERCA UNIFICATA: nessun problema' : `\n❌ RICERCA UNIFICATA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

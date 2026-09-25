/**
 * Verifica RICERCA UNIFICATA (classi di concorso + competenze + parole chiave).
 *
 * Digitando UNA parola (es. «Pedagogia») le due colonne del passo 3 del wizard e
 * la sezione «In cosa puoi lavorare» delle Preferenze devono mostrare gli STESSI
 * risultati: classe collegata per materia, competenza extra con quel nome e la
 * possibilità di usare il testo come parola chiave personale.
 *
 * Uso: npm run test:ricerca
 */
import { readFileSync } from 'node:fs';
import {
  cercaClassiDiConcorso,
  cercaCompetenzeExtra,
  cercaSelezioniRadar,
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

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');
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

console.log('\n— Competenze extra (PNRR/PON) —');
check('«pedagogia» NON è una competenza extra (disciplina curricolare)', 0, cercaCompetenzeExtra('pedagogia').length);
check('«robotica» trova le competenze extra', true, cercaCompetenzeExtra('robotica').length > 0);
check('«illimitato» (testo libero): nessuna competenza', 0, cercaCompetenzeExtra('illimitato').length);

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

console.log('\n— Cablaggio: un solo campo per entrambe le colonne —');
const wizard = leggi('src/departments/radar/wizard/PassoClassiMaterie.tsx');
const wizardClassi = leggi('src/departments/radar/wizard/components/SezioneClassiConcorso.tsx');
const wizardCompetenze = leggi('src/departments/radar/wizard/components/SezioneCompetenzeExtra.tsx');
const pannelloMaterie = leggi('src/departments/radar/preferenze/PannelloMaterie.tsx');
const componenteRicerca = leggi('src/departments/radar/components/RicercaSelezioni.tsx');
const preferenze = leggi('src/departments/radar/PreferenzeRadar.tsx');

check('wizard: campo unico di ricerca unificata', true, wizard.includes('<RicercaSelezioni'));
check(
  'wizard: nessun campo di ricerca duplicato nelle due colonne',
  true,
  !/<input/.test(wizardClassi) && !/<input/.test(wizardCompetenze),
);
check(
  'wizard: nessuna <select> né elenco statico di materie',
  true,
  !wizardClassi.includes('<select') && !wizardCompetenze.includes('<select'),
);
check(
  'Preferenze «In cosa puoi lavorare»: NIENTE elenco fisso di materie',
  true,
  !pannelloMaterie.includes('materieCompetenzeExtra') && pannelloMaterie.includes('<RicercaSelezioni'),
);
check(
  'stesso motore + stesso componente nelle due superfici',
  true,
  componenteRicerca.includes('ricercaSelezioniRadar') &&
    wizard.includes('<RicercaSelezioni') &&
    pannelloMaterie.includes('<RicercaSelezioni'),
);
check(
  'Preferenze: la ricerca unificata usa lo stesso motore',
  true,
  preferenze.includes('cercaSelezioniRadar'),
);
check(
  'parola chiave: aggiunta sia dal wizard sia dalle Preferenze',
  true,
  /aggiungiParolaChiave/.test(leggi('src/departments/radar/RadarWizardModal.tsx')) &&
    /aggiungiParolaChiave/.test(preferenze),
);
check(
  'parola chiave: i container dividono le voci sulla virgola',
  true,
  /separaParoleChiave/.test(leggi('src/departments/radar/RadarWizardModal.tsx')) &&
    /separaParoleChiave/.test(preferenze),
);
check(
  'la UI propone tutte le voci separate da virgola',
  true,
  /onParolaChiave\(paroleChiave\.join\(', '\)\)/.test(leggi('src/departments/radar/components/RicercaSelezioni.tsx')),
);

console.log(errori === 0 ? '\n✅ RICERCA UNIFICATA: nessun problema' : `\n❌ RICERCA UNIFICATA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

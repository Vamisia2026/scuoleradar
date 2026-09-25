/**
 * Verifica le PREFERENZE RADAR (UI + dati):
 *  1. selezione classi a prova di formato (`A-18` ≡ `A18` ≡ `a 18`) e senza
 *     "sparizioni" (dedup, salvataggio/caricamento normalizzati);
 *  2. testo UI aggiornato: "Dove vuoi lavorare?";
 *  3. sezione COMPETENZE: etichetta corretta + competenze PNRR/PON suggerite
 *     (AI nella didattica, robotica educativa, digital storytelling, CLIL,
 *     creatività digitale) e NIENTE discipline curricolari generiche.
 *
 * Uso: npm run test:radar:preferenze
 */
import { readFileSync } from 'node:fs';
import {
  MATERIE_GENERICHE,
  competenzeSuggerite,
  materie,
  materieCompetenzeExtra,
} from '../src/data/ordiniMaterie.ts';
import { normalizzaClasse, normalizzaClassi } from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Classi di concorso: normalizzazione robusta (nessuna casella "spenta") —');
check('"A-18" → A-18', 'A-18', normalizzaClasse('A-18'));
check('"A18" → A-18', 'A-18', normalizzaClasse('A18'));
check('"a 18" → A-18', 'A-18', normalizzaClasse('a 18'));
check('"A_18" → A-18', 'A-18', normalizzaClasse('A_18'));
check('"A-018" → A-18', 'A-18', normalizzaClasse('A-018'));
check('lista deduplicata e canonica', ['A-18', 'A-22'], normalizzaClassi(['A18', 'A-018', 'a 22', 'A-22']));
check('codici sostegno preservati', ['ADEE', 'ADSS'], normalizzaClassi(['ADEE', 'ADSS']));

console.log('\n— Testo UI: "Dove vuoi lavorare?" —');
// I componenti sono stati spostati nel dipartimento radar (split per SRP): il test
// segue i FILE REALI (niente path morti) nel nuovo perimetro.
const preferenzeOrdini = readFileSync('src/departments/radar/preferenze/PannelloOrdini.tsx', 'utf8');
const preferenzeMaterie = readFileSync('src/departments/radar/preferenze/PannelloMaterie.tsx', 'utf8');
const wizardOrdini = readFileSync('src/departments/radar/wizard/PassoOrdini.tsx', 'utf8');
const wizard = readFileSync('src/departments/radar/wizard/PassoClassiMaterie.tsx', 'utf8');
const wizardClassi = readFileSync('src/departments/radar/wizard/components/SezioneClassiConcorso.tsx', 'utf8');
const wizardCompetenze = readFileSync('src/departments/radar/wizard/components/SezioneCompetenzeExtra.tsx', 'utf8');
const wizardModal = readFileSync('src/departments/radar/RadarWizardModal.tsx', 'utf8');
const pannelloClassi = readFileSync('src/departments/radar/preferenze/PannelloClassi.tsx', 'utf8');
check('PreferenzeRadar: titolo aggiornato', true, preferenzeOrdini.includes('Dove vuoi lavorare?'));
check('RadarWizardModal: titolo aggiornato', true, wizardOrdini.includes('Dove vuoi lavorare?'));
check('PassoOrdini: titolo "Dove vuoi lavorare?" nel corpo del passo', true, wizardOrdini.includes('Dove vuoi lavorare?'));
check(
  'nessun residuo del vecchio titolo',
  false,
  /Dove vuoi insegnare o lavorare\?/.test(preferenzeOrdini) ||
    /Dove vuoi insegnare o lavorare\?/.test(wizardOrdini),
);

console.log('\n— Competenze: etichetta e suggerimenti PNRR/PON —');
check(
  'PannelloMaterie: etichetta "Le tue competenze e laboratori extra da proporre:"',
  true,
  preferenzeMaterie.includes('Le tue competenze e laboratori extra da proporre:'),
);
check(
  'SezioneCompetenzeExtra: etichetta "Le tue competenze e laboratori extra da proporre:"',
  true,
  wizardCompetenze.includes('Le tue competenze e laboratori extra da proporre:'),
);
check(
  'nessun residuo "Cerchi competenze particolari? Aggiungile qui."',
  false,
  preferenzeMaterie.includes('Cerchi competenze particolari? Aggiungile qui.') ||
    wizardCompetenze.includes('Cerchi competenze particolari? Aggiungile qui.'),
);
check('suggerimenti PNRR/PON usati in PannelloMaterie', true, preferenzeMaterie.includes('competenzeSuggerite'));
check('suggerimenti PNRR/PON usati nel wizard', true, wizardCompetenze.includes('competenzeSuggerite'));
// Ricerca UNIFICATA (niente elenchi statici di materie sempre aperti).
check(
  'wizard: sostituito il campo di ricerca per materia con la ricerca unificata',
  true,
  !/queryMateria|queryFiltroMateria/.test(wizardCompetenze + wizardClassi),
);
check(
  'wizard: nessuna <select> statica (filtro materia predittivo)',
  true,
  !wizardClassi.includes('<select') && !wizardCompetenze.includes('<select'),
);
check(
  'wizard: sezioni estratte composte dal passo',
  true,
  wizard.includes('<SezioneClassiConcorso') && wizard.includes('<SezioneCompetenzeExtra'),
);

const nomiSuggeriti = competenzeSuggerite.map((c) => c.nome);
check('12 suggerimenti popolari (tag PNRR/PON)', 12, competenzeSuggerite.length);
check(
  'AI nella didattica presente',
  true,
  nomiSuggeriti.some((n) => /intelligenza artificiale/i.test(n)),
);
check('robotica educativa presente', true, nomiSuggeriti.includes('Robotica educativa'));
check('stop motion presente', true, nomiSuggeriti.includes('Stop Motion'));
check('digital storytelling presente', true, nomiSuggeriti.includes('Digital storytelling'));
check('metodologia CLIL presente', true, nomiSuggeriti.includes('Metodologia CLIL'));
check('lingua inglese presente', true, nomiSuggeriti.includes('Lingua inglese'));
check('creatività digitale presente', true, nomiSuggeriti.some((n) => /creativit[àa] digitale/i.test(n)));
check(
  'ogni suggerimento esiste nel catalogo materie',
  true,
  competenzeSuggerite.every((c) => materie.some((m) => m.id === c.materiaId)),
);
check(
  'nessun suggerimento duplicato',
  competenzeSuggerite.length,
  new Set(competenzeSuggerite.map((c) => c.materiaId)).size,
);

const extra = materieCompetenzeExtra().map((m) => m.id);
check('liste competenze: NIENTE Storia', false, extra.includes('storia'));
check('liste competenze: NIENTE Geografia', false, extra.includes('geografia'));
check('liste competenze: NIENTE Italiano', false, extra.includes('italiano'));
check('liste competenze: AI presente', true, extra.includes('intelligenza_artificiale'));
check('liste competenze: robotica presente', true, extra.includes('robotica'));
check('liste competenze: storytelling presente', true, extra.includes('digital_storytelling'));
check('liste competenze: CLIL presente', true, extra.includes('clil'));
check('liste competenze: creatività digitale presente', true, extra.includes('creativita_digitale'));
check(
  'lista nuove competenze usata dal MOTORE di ricerca condiviso',
  true,
  readFileSync('src/lib/ricercaSelezioniRadar.ts', 'utf8').includes('materieCompetenzeExtra()'),
);
check('MATERIE_GENERICHE include le discipline curricolari', true, MATERIE_GENERICHE.has('storia') && MATERIE_GENERICHE.has('geografia'));

console.log('\n— Persistenza: normalizzazione in lettura e scrittura —');
// I contesti sono stati scomposti in `contexts/app/*`: il test segue i file reali.
const bootstrap = readFileSync('src/contexts/app/useProfileBootstrap.ts', 'utf8');
const anagrafica = readFileSync('src/contexts/app/useAnagraficaProfilo.ts', 'utf8');
const preferenzeUtente = readFileSync('src/contexts/app/usePreferenzeUtente.ts', 'utf8');
check('load: classi normalizzate dal DB', true, /normalizzaClassi\(data\.classi_concorso\)/.test(bootstrap));
check('save: classi normalizzate su DB', true, /classi_concorso: normalizzaClassi\(dati\.classiCodici\)/.test(anagrafica));
check('setPreferenze: normalizza sempre le classi', true, /normalizzaClassi\(p\.classiCodici\)/.test(preferenzeUtente));
check(
  'UI: selezione comparata sul formato canonico',
  true,
  pannelloClassi.includes('contieneClasse(classiCodici') && wizardClassi.includes('contieneClasse(classiCodici'),
);

console.log('\n— Wizard: PERSISTENZA ISTANTANEA di ogni selezione —');
check(
  'helper di persistenza istantanea (senza retrocedere `onboarded`)',
  true,
  /const persistiSelezione = \(patch: Partial<Preferenze>\)[\s\S]{0,120}onboarded: preferenze\.onboarded/.test(
    wizardModal,
  ),
);
check('ordini: salvataggio immediato', true, /const toggleOrdine[\s\S]{0,400}persistiSelezione\(\{ ordini: prossimi \}\)/.test(wizardModal));
check('classi: salvataggio immediato', true, /const toggleClasse[\s\S]{0,900}persistiSelezione\(\{ classiCodici: prossime \}\)/.test(wizardModal));
check('province: salvataggio immediato', true, /const toggleProvincia[\s\S]{0,600}persistiSelezione\(\{ provinceCodici: prossime \}\)/.test(wizardModal));
check('competenze/keyword: salvataggio immediato', true, /toggleMateria[\s\S]{0,300}persistiSelezione\(\{ materieId: prossime \}\)/.test(wizardModal));
check('tag scritti a mano: salvataggio immediato', true, /persistiSelezione\(\{ materieCustom: next \}\)/.test(wizardModal));

// Provincia principale/promozione e ricerca unificata hanno una verifica DEDICATA:
//   npm run test:province · npm run test:ricerca

console.log(errori === 0 ? '\n✅ RADAR PREFERENZE: nessun problema' : `\n❌ RADAR PREFERENZE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

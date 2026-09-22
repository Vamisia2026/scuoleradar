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
const preferenze = readFileSync('src/components/PreferenzeRadar.tsx', 'utf8');
const wizard = readFileSync('src/components/RadarWizardModal.tsx', 'utf8');
check('PreferenzeRadar: titolo aggiornato', true, preferenze.includes('Dove vuoi lavorare?'));
check('RadarWizardModal: titolo aggiornato', true, wizard.includes('Dove vuoi lavorare?'));
check(
  'nessun residuo del vecchio titolo',
  false,
  /Dove vuoi insegnare o lavorare\?/.test(preferenze) || /Dove vuoi insegnare o lavorare\?/.test(wizard),
);

console.log('\n— Competenze: etichetta e suggerimenti PNRR/PON —');
check(
  'PreferenzeRadar: etichetta "Le tue competenze e laboratori extra da proporre:"',
  true,
  preferenze.includes('Le tue competenze e laboratori extra da proporre:'),
);
check(
  'RadarWizardModal: etichetta "Le tue competenze e laboratori extra da proporre:"',
  true,
  wizard.includes('Le tue competenze e laboratori extra da proporre:'),
);
check(
  'nessun residuo "Cerchi competenze particolari? Aggiungile qui."',
  false,
  preferenze.includes('Cerchi competenze particolari? Aggiungile qui.') ||
    wizard.includes('Cerchi competenze particolari? Aggiungile qui.'),
);
check('suggerimenti PNRR/PON usati in PreferenzeRadar', true, preferenze.includes('competenzeSuggerite'));
check('suggerimenti PNRR/PON usati nel wizard', true, wizard.includes('competenzeSuggerite'));

const nomiSuggeriti = competenzeSuggerite.map((c) => c.nome);
check('5 suggerimenti ad alta richiesta', 5, competenzeSuggerite.length);
check(
  'AI nella didattica presente',
  true,
  nomiSuggeriti.some((n) => /intelligenza artificiale/i.test(n)),
);
check('robotica educativa presente', true, nomiSuggeriti.includes('Robotica educativa'));
check('digital storytelling presente', true, nomiSuggeriti.includes('Digital storytelling'));
check('metodologia CLIL presente', true, nomiSuggeriti.includes('Metodologia CLIL'));
check('creatività digitale presente', true, nomiSuggeriti.includes('Creatività digitale'));
check(
  'ogni suggerimento esiste nel catalogo materie',
  true,
  competenzeSuggerite.every((c) => materie.some((m) => m.id === c.materiaId)),
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
  'lista nuove competenze usata dalle due UI',
  true,
  preferenze.includes('materieCompetenzeExtra()') && wizard.includes('materieCompetenzeExtra()'),
);
check('MATERIE_GENERICHE include le discipline curricolari', true, MATERIE_GENERICHE.has('storia') && MATERIE_GENERICHE.has('geografia'));

console.log('\n— Persistenza: normalizzazione in lettura e scrittura (AppContext) —');
const contesto = readFileSync('src/contexts/AppContext.tsx', 'utf8');
check(
  'load: classi normalizzate dal DB',
  true,
  /classiCodici:[\s\S]{0,120}normalizzaClassi\(data\.classi_concorso\)/.test(contesto),
);
check('save: classi normalizzate su DB', true, /classi_concorso: normalizzaClassi\(dati\.classiCodici\)/.test(contesto));
check('settori: setPreferenze normalizza le classi', true, /normalizzaClassi\(p\.classiCodici\)/.test(contesto));
check(
  'UI: selezione comparata sul formato canonico',
  true,
  preferenze.includes('contieneClasse(classiCodici') && wizard.includes('contieneClasse(classiCodici'),
);

console.log(errori === 0 ? '\n✅ RADAR PREFERENZE: nessun problema' : `\n❌ RADAR PREFERENZE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

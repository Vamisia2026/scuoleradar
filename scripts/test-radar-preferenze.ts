/**
 * Verifica le PREFERENZE RADAR (UI + dati):
 *  1. selezione classi a prova di formato (`A-18` ≡ `A18` ≡ `a 18`) e senza
 *     "sparizioni" (dedup, salvataggio/caricamento normalizzati);
 *  2. testo UI aggiornato: "Dove vuoi lavorare?";
 *  3. sezione COMPETENZE: etichetta corretta + competenze PNRR/PON suggerite
 *     (AI nella didattica, robotica educativa, digital storytelling, CLIL,
 *     creatività digitale) e NIENTE discipline curricolari generiche.
 *  4. ciclo COMPLETO delle competenze/parole chiave: scritte su `profiles`
 *     (`materie_id` + `materie_custom`), rilette al bootstrap e usate dalla
 *     validazione Radar e dalla regola unica di matching. Prima erano salvate
 *     solo in locale: nel backend il riepilogo mostrava «—» e il motore non
 *     aveva nulla da confrontare (Radar acceso, zero opportunità).
 *
 * Uso: npm run test:radar:preferenze
 */
import { readFileSync } from 'node:fs';
import {
  MATERIE_GENERICHE,
  competenzeSuggerite,
  materie,
  materieCompetenzeExtra,
  materieRicercabili,
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
  'lista competenze del catalogo usata dal MOTORE di ricerca condiviso',
  true,
  readFileSync('src/lib/ricercaSelezioniRadar.ts', 'utf8').includes('materieRicercabili()') &&
    readFileSync('src/data/ordiniMaterie.ts', 'utf8').includes('materieCompetenzeExtra()'),
);
// MATERIE RICERCABILI: le competenze extra PIÙ i tag PNRR/PON che sono discipline
// curricolari («Lingua inglese», «Educazione motoria»): prima non erano cercabili.
const ricercabili = materieRicercabili().map((m) => m.id);
check('ricercabili: le competenze extra ci sono', true, ricercabili.includes('clil'));
check('ricercabili: «Lingua inglese» è cercabile (tag PNRR/PON)', true, ricercabili.includes('inglese'));
check(
  'ricercabili: le altre discipline curricolari restano fuori',
  [false, false],
  [ricercabili.includes('storia'), ricercabili.includes('italiano')],
);
check('MATERIE_GENERICHE include le discipline curricolari', true, MATERIE_GENERICHE.has('storia') && MATERIE_GENERICHE.has('geografia'));

console.log('\n— Persistenza: normalizzazione in lettura e scrittura —');
// I contesti sono stati scomposti in `contexts/app/*`: il test segue i file reali.
const bootstrap = readFileSync('src/contexts/app/useProfileBootstrap.ts', 'utf8');
const anagrafica = readFileSync('src/contexts/app/useAnagraficaProfilo.ts', 'utf8');
const preferenzeUtente = readFileSync('src/contexts/app/usePreferenzeUtente.ts', 'utf8');
const valutaConfigurazione = readFileSync('src/departments/radar/valutaConfigurazione.ts', 'utf8');
const matchingEngine = readFileSync('src/lib/matchingEngine.ts', 'utf8');
check('load: classi normalizzate dal DB', true, /normalizzaClassi\(data\.classi_concorso\)/.test(bootstrap));
check('save: classi normalizzate su DB', true, /classi_concorso: normalizzaClassi\(dati\.classiCodici\)/.test(anagrafica));
check('setPreferenze: normalizza sempre le classi', true, /normalizzaClassi\(p\.classiCodici\)/.test(preferenzeUtente));
check(
  'UI: selezione comparata sul formato canonico',
  true,
  pannelloClassi.includes('contieneClasse(classiCodici') && wizardClassi.includes('contieneClasse(classiCodici'),
);

console.log('\n— Ciclo completo delle competenze («in cosa puoi lavorare») —');
check(
  'save: `materie_id` e `materie_custom` sono nel payload di `profiles`',
  true,
  /materie_id: dati\.materieId/.test(anagrafica) &&
    /materie_custom: dati\.materieCustom/.test(anagrafica),
);
check(
  'load: le due colonne sono nella SELECT del bootstrap',
  true,
  /materie_id, materie_custom/.test(bootstrap),
);
check(
  'load: idratazione delle competenze (un array vuoto NON cancella la scelta locale)',
  true,
  /materieId:[\s\S]{0,220}prev\.materieId/.test(bootstrap) &&
    /materieCustom:[\s\S]{0,260}prev\.materieCustom/.test(bootstrap),
);
check(
  'radar: la validazione legge le competenze dal DB, non solo dalla memoria locale',
  true,
  /materie_id, materie_custom/.test(valutaConfigurazione) &&
    /materieId: nonVuoto\(data\.materie_id/.test(valutaConfigurazione) &&
    /materieCustom: nonVuoto\(data\.materie_custom/.test(valutaConfigurazione),
);
check(
  'matching: le competenze entrano nella regola unica di compatibilità',
  true,
  /materieId:/.test(matchingEngine) && /materieCustom:/.test(matchingEngine),
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

console.log('\n— Pannello preferenze: nessun azzeramento da caricamento o refresh —');
// La schermata registra i campi toccati (`segnaToccato`) e salva SOLO quelli:
// aprire la pagina, un refresh o un profilo che arriva in ritardo non possono più
// scrivere un default vuoto sopra classi, province, competenze o scuole.
// Verifica end-to-end dedicata: npm run test:persistenza:preferenze
const schermata = readFileSync('src/departments/radar/PreferenzeRadar.tsx', 'utf8');
const campiPannello = [
  'ordini', 'classiCodici', 'materieId', 'materieCustom', 'provinceCodici',
  'telegramUsername', 'telegramChatId', 'emailNotifica', 'favoriteSchools', 'ignoredSchools',
];
check('autosave: nel payload solo i campi toccati', true, /modificheDaSalvare<Preferenze>\(toccatiRef\.current, locale, preferenze\)/.test(schermata));
check('autosave: nessuna scrittura se non c’è nulla da salvare', true, /Object\.keys\(modifiche\)\.length === 0\) return;/.test(schermata));
check('idratazione selettiva: i campi già toccati non si riallineano', true, campiPannello.every((c) => schermata.includes(`!toccati.has('${c}')`)));
check('ogni handler del pannello marca il proprio campo', true, campiPannello.every((c) => schermata.includes(`segnaToccato('${c}')`)));
check('le preferenze non toccate restano quelle del contesto', true, /\.\.\.preferenze,[\s\S]{0,40}\.\.\.modifiche,/.test(schermata));
check('nessun troncamento automatico in schermata', false, /slice\(0, max(?:Province|ClassiConcorso)\)/.test(schermata));
check('guardia: nessun salvataggio dedotto da fotografie diverse', false, /payloadSalvataggio|campiToccati|fondiCampiToccati|idratateRef|toccatoDallUtente/.test(schermata));
check('profilo: le colonne delle preferenze passano tutte da `idrataDaProfilo`', true, (bootstrap.match(/idrataDaProfilo\(/g) ?? []).length >= 7);

// Provincia principale/promozione e ricerca unificata hanno una verifica DEDICATA:
//   npm run test:province · npm run test:ricerca

console.log(errori === 0 ? '\n✅ RADAR PREFERENZE: nessun problema' : `\n❌ RADAR PREFERENZE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

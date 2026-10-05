/**
 * TEST — LE MODALI DEL RADAR: ordine di scuola, classi di concorso, parole chiave.
 * --------------------------------------------------------------------------
 * Verifica i punteggi di prodotto delle finestre di preferenze:
 *
 *   1. MODALITÀ 1 «Dove vuoi lavorare»: 100 esatto · 90 adiacente · 70 salto;
 *   2. MODALITÀ 2 «Classi di concorso»: 100 esatta · 95 affine · 90 competenza
 *      nella classe · 85 stessa area · 75 ponte affine · 65 contaminata · 55 estranea;
 *   3. MODALITÀ 3 «Oltre la classe»: 90 parola chiave · 85 match vicino · JOLLY
 *      (modale esclusa dalla media se non c'è nulla; +3% per ogni corrispondenza
 *      parziale o riconducibile);
 *   4. AGGREGATORE: media PONDERATA delle modali applicabili (pesi: classe 2, il resto 1)
 *      + incrementi jolly del 3%.
 *
 * Esecuzione: npm run test:modali (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  PUNTEGGIO_ORDINE_ADIACENTE,
  PUNTEGGIO_ORDINE_DISTANTE,
  PUNTEGGIO_ORDINE_ESATTO,
  punteggioOrdine,
} from '../src/lib/punteggioOrdine.ts';
import {
  PENALITA_CLASSE_ESTRANEA,
  PENALITA_CLASSE_PONTE_AFFINE,
  PENALITA_CLASSE_PONTE_CONTAMINATA,
  PENALITA_CLASSE_STESSA_AREA,
  PUNTEGGIO_CLASSE_AFFINE,
  PUNTEGGIO_CLASSE_ESATTA,
  PUNTEGGIO_CLASSE_PROBABILE,
  punteggioClasse,
} from '../src/lib/punteggioClasse.ts';
import {
  INCREMENTO_JOLLY,
  JOLLY_MASSIMO,
  PUNTEGGIO_KEYWORD_ESATTA,
  PUNTEGGIO_KEYWORD_VICINA,
  punteggioCompetenze,
} from '../src/lib/punteggioCompetenze.ts';
import {
  PESI_MODALI,
  mediaPonderata,
  valutaCompatibilita,
} from '../src/lib/compatibilitaGraduata.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* ---------------------- 1) MODALITÀ 1 — ORDINE DI SCUOLA ------------------- */

console.log('— Modalità 1 «Dove vuoi lavorare»: 100 esatto · 90 adiacente · 70 salto —');
check('ordine selezionato = 100', PUNTEGGIO_ORDINE_ESATTO, punteggioOrdine(['secondaria2'], 'secondaria2')?.punteggio);
check('Secondaria I → Secondaria II = 90', PUNTEGGIO_ORDINE_ADIACENTE, punteggioOrdine(['secondaria1'], 'secondaria2')?.punteggio);
check('Secondaria II → Secondaria I = 90', PUNTEGGIO_ORDINE_ADIACENTE, punteggioOrdine(['secondaria2'], 'secondaria1')?.punteggio);
check('Primaria → Secondaria I = 90', PUNTEGGIO_ORDINE_ADIACENTE, punteggioOrdine(['primaria'], 'secondaria1')?.punteggio);
check('Infanzia → Primaria = 90', PUNTEGGIO_ORDINE_ADIACENTE, punteggioOrdine(['infanzia'], 'primaria')?.punteggio);
check('Primaria → Secondaria II = 70 (salto)', PUNTEGGIO_ORDINE_DISTANTE, punteggioOrdine(['primaria'], 'secondaria2')?.punteggio);
check('Infanzia → Secondaria II = 70', PUNTEGGIO_ORDINE_DISTANTE, punteggioOrdine(['infanzia'], 'secondaria2')?.punteggio);
check('tipologia fuori sequenza (ATA) ≠ adiacente = 70', PUNTEGGIO_ORDINE_DISTANTE, punteggioOrdine(['ata'], 'secondaria1')?.punteggio);
check('CPIA selezionato e diverso = 70', PUNTEGGIO_ORDINE_DISTANTE, punteggioOrdine(['cpia'], 'primaria')?.punteggio);
check('RUOLO JOLLY: nessun ordine nel profilo → null (fuori dalla media)', null, punteggioOrdine([], 'primaria'));
check('ordine dell’avviso non dichiarato → null (fuori dalla media)', null, punteggioOrdine(['primaria'], null));
check('motivo leggibile dell’adiacenza', true, /adiacente/.test(punteggioOrdine(['secondaria1'], 'secondaria2')?.motivo ?? ''));


/* ---------------------- 2) MODALITÀ 2 — CLASSI DI CONCORSO ----------------- */

console.log('\n— Modalità 2 «Classi di concorso»: esatta · affine · distanza disciplinare —');
const A22 = { classi: ['A-22'], materieId: [] };
check('classe esatta (A-022 ≡ A-22) = 100', PUNTEGGIO_CLASSE_ESATTA, punteggioClasse(A22, { classi: ['A-022'] })?.punteggio);
check('classe AFFINE (A-22 ↔ A-24, lingue) = 95', PUNTEGGIO_CLASSE_AFFINE, punteggioClasse(A22, { classi: ['A-24'] })?.punteggio);
check('A-26 ↔ A-27 (matematica) = 95', PUNTEGGIO_CLASSE_AFFINE, punteggioClasse({ classi: ['A-26'] }, { classi: ['A-27'] })?.punteggio);
check('competenza dichiarata nella classe dell’avviso = 90', PUNTEGGIO_CLASSE_PROBABILE, punteggioClasse({ classi: ['A-26'], materieId: ['inglese'] }, { classi: ['A-24'] })?.punteggio);
check('avviso senza codice ma materia coperta = 90', PUNTEGGIO_CLASSE_PROBABILE, punteggioClasse(A22, { materia: 'Inglese' })?.punteggio);
check('STESSA AREA (A-20 fisica × A-50 scienze) = 85', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA, punteggioClasse({ classi: ['A-20'] }, { classi: ['A-50'] })?.punteggio);
check('PONTE AFFINE (A-01 arte × A-41 digitale) = 75', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_PONTE_AFFINE, punteggioClasse({ classi: ['A-01'] }, { classi: ['A-41'] })?.punteggio);
check('AREA CONTAMINATA (letteratura × teatro) = 65', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_PONTE_CONTAMINATA, punteggioClasse({ classi: ['A-12'] }, { materia: 'Laboratorio teatrale' })?.punteggio);
check('classe ESTRANEA (A-22 lingue × diritto) = 55', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_ESTRANEA, punteggioClasse(A22, { classi: ['A-46'], materia: 'Diritto ed economia' })?.punteggio);
check('le penalità crescono con la distanza disciplinare', true, PENALITA_CLASSE_STESSA_AREA < PENALITA_CLASSE_PONTE_AFFINE && PENALITA_CLASSE_PONTE_AFFINE < PENALITA_CLASSE_PONTE_CONTAMINATA && PENALITA_CLASSE_PONTE_CONTAMINATA < PENALITA_CLASSE_ESTRANEA);
check('modale non applicabile senza classi nel profilo → null', null, punteggioClasse({ classi: [] }, { classi: ['A-22'] }));

/* --------------------- 3) MODALITÀ 3 — PAROLE CHIAVE (JOLLY) --------------- */

console.log('\n— Modalità 3 «Oltre la classe»: 90 esatta · 85 vicina · jolly +3% —');
const IA = { materieCustom: ['Intelligenza Artificiale'] };
const ia = punteggioCompetenze(IA, { titolo: 'Corso di Intelligenza Artificiale per docenti' });
check('parola chiave trovata = 90', PUNTEGGIO_KEYWORD_ESATTA, ia.punteggio);
check('nessun incremento con una sola parola chiave', 0, ia.incrementi);
check('motivo leggibile', true, /parola chiave/.test(ia.motivi.join(' ')));
const vicina = punteggioCompetenze({ materieCustom: ['Didattica Multimediale'] }, { titolo: 'Corso multimediale' });
check('match semantico vicino = 85', PUNTEGGIO_KEYWORD_VICINA, vicina.punteggio);
const riconducibile = punteggioCompetenze(IA, { titolo: 'Didattica multimediale in classe' });
check('riconducibile (ponte IA ↔ Digitale) → +1 jolly', 1, riconducibile.incrementi);
check('e nessun punteggio di modale (resta jolly)', null, riconducibile.punteggio);
const nessuno = punteggioCompetenze({ materieCustom: ['Pedagogia Steineriana'] }, { titolo: 'Interpello di matematica' });
check('nessuna corrispondenza → modale ESCLUSA dalla media', null, nessuno.punteggio);
check('e nessun incremento inventato', 0, nessuno.incrementi);
check('jolly con tappo: al massimo +9%', 3, JOLLY_MASSIMO);
check('incremento unitario del 3%', 3, INCREMENTO_JOLLY);

/* ------------- 4) AGGREGATORE: MEDIA PONDERATA DELLE MODALI + JOLLY --------- */

console.log('\n— Aggregatore: media PONDERATA dei pesi delle modali applicabili + jolly —');
const sommaPesi =
  PESI_MODALI.ordine + PESI_MODALI.classe + PESI_MODALI.competenze + PESI_MODALI.provincia;
const pesiModali = [PESI_MODALI.ordine, PESI_MODALI.classe, PESI_MODALI.competenze, PESI_MODALI.provincia];
check('PESI di prodotto: le classi pesano 2, il contesto 1', { ordine: 1, classe: 2, competenze: 1, provincia: 1 }, PESI_MODALI);
check(
  'nessun peso raggiunge la metà dei pesi totali (il voto non nasce da una sola modale)',
  true,
  Math.max(...pesiModali) * 2 < sommaPesi,
);
check(
  'media ponderata di 4 modali applicabili',
  96,
  mediaPonderata([
    { punteggio: 100, peso: PESI_MODALI.ordine },
    { punteggio: 95, peso: PESI_MODALI.classe },
    { punteggio: 90, peso: PESI_MODALI.competenze },
    { punteggio: 100, peso: PESI_MODALI.provincia },
  ]),
);
check(
  'la CLASSE pesa il doppio: 100 (ordine) con classe estranea 55 → 70',
  70,
  mediaPonderata([
    { punteggio: 100, peso: PESI_MODALI.ordine },
    { punteggio: 55, peso: PESI_MODALI.classe },
  ]),
);
check(
  'i pesi si RINORMALIZZANO su ciò che c’è (una sola modale applicabile)',
  95,
  mediaPonderata([{ punteggio: 95, peso: PESI_MODALI.classe }]),
);
check(
  'peso nullo = modale non applicabile, fuori dal denominatore',
  100,
  mediaPonderata([
    { punteggio: 100, peso: PESI_MODALI.ordine },
    { punteggio: 0, peso: 0 },
  ]),
);
check('nessuna modale applicabile → 0', 0, mediaPonderata([]));
const pieno = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'] },
  { province: 'AT', classi: ['A-22'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
check('ordine + classe + provincia esatti → 100', 100, pieno.punteggio);
check('le modali non applicabili restano fuori dalla media', null, pieno.modali.competenze);
check('il denominatore è la somma dei pesi applicati (1 + 2 + 1)', 4, pieno.modali.pesoTotale);
const graduato = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'], materieCustom: ['Intelligenza Artificiale'] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('ordine 100 · classe affine 95 · parole chiave 90 · provincia 100 → 96', 96, graduato.punteggio);
check('il dettaglio delle modali è leggibile', 95, graduato.modali.classe);
check('tutte e 4 le modali applicabili → denominatore 5', 5, graduato.modali.pesoTotale);
check('il tooltip dichiara la media ponderata', true, /media ponderata di 4 modali/.test(graduato.motivi.join(' ')));
const conJolly = valutaCompatibilita(
  {
    ordini: ['secondaria2'],
    classi: ['A-22'],
    province: ['AT'],
    materieCustom: ['Intelligenza Artificiale', 'Didattica Multimediale'],
  },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('il jolly sfuma il punteggio: 96 + 3%', 99, conJolly.punteggio);
check('l’incremento jolly è dichiarato', 1, conJolly.modali.incrementiJolly);
check('la sfumatura jolly è dichiarata nel tooltip', true, /jolly 3%/.test(conJolly.motivi.join(' ')));
check('i motivi raccontano le modali', true, conJolly.motivi.some((m) => /classe affine/.test(m)));

/* ------------------- 5) LA GUARDIA È NELLA CATENA DI `npm test` ------------ */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(
  readFileSync('package.json', 'utf8'),
) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:modali' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-modali-radar.ts'));

console.log(
  errori === 0
    ? '\n✅ MODALI: ordine, classi e parole chiave con media ponderata dei pesi e jolly.'
    : `\n❌ MODALI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

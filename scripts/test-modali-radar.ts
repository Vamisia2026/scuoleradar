/**
 * TEST — LE MODALI DEL RADAR: ordine di scuola, classi di concorso, competenze.
 * --------------------------------------------------------------------------
 * Verifica i punteggi di prodotto delle finestre di preferenze:
 *
 *   1. MODALITÀ 1 «Dove vuoi lavorare»: 100 esatto · 90 adiacente · 70 salto;
 *   2. MODALITÀ 2 «Classi di concorso»: 100 esatta · 95 affine · 90 competenza
 *      nella classe · 85 stessa area · 75 ponte affine · 65 contaminata · 55 estranea;
 *   3. MODALITÀ 3 «Oltre la classe»: LIVELLO SECONDARIO (§26.63) — una competenza trovata
 *      SFUMA il voto delle preferenze primarie (25 piena · 20 vicina · 10 riconducibile, +3
 *      per ogni corrispondenza aggiuntiva) e resta tappata a `CAP_COMPETENZE`;
 *   4. AGGREGATORE: la MEDIA PONDERATA delle tre modali PRIMARIE (pesi: classe 2, il resto
 *      1 — `mediaModali.ts`) fa il voto, poi la sfumatura del livello secondario lo alza;
 *   5. senza competenza nel profilo non c'è nulla da sfumare: vale la media ponderata.
 *
 * I punteggi del livello secondario hanno la loro guardia dedicata: `npm run test:scoring`.
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
  CAP_COMPETENZE,
  INCREMENTO_JOLLY,
  PUNTEGGIO_COMPETENZA_ESATTA,
  PUNTEGGIO_COMPETENZA_RICONDUCIBILE,
  PUNTEGGIO_COMPETENZA_VICINA,
  punteggioCompetenze,
} from '../src/lib/punteggioCompetenze.ts';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import { PESI_MODALI, mediaPonderata } from '../src/lib/mediaModali.ts';

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
/** §26.63 — profilo MINIMO della modale primaria: solo le classi (le competenze stanno altrove). */
const classeLontana = { classi: ['A-26'] };
const classeLontanaConCompetenza = { classi: ['A-26'], materieId: ['inglese'] };
check(
  'le competenze del profilo NON toccano la modale delle classi (§26.63): stessi 55',
  punteggioClasse(classeLontana, { classi: ['A-24'] })?.punteggio,
  punteggioClasse(classeLontanaConCompetenza, { classi: ['A-24'] })?.punteggio,
);
check(
  'una classe lontana resta ESTRANEA anche con una competenza «amica» = 55',
  PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_ESTRANEA,
  punteggioClasse(classeLontanaConCompetenza, { classi: ['A-24'] })?.punteggio,
);
check('avviso senza codice ma materia coperta = 90', PUNTEGGIO_CLASSE_PROBABILE, punteggioClasse(A22, { materia: 'Inglese' })?.punteggio);
check('STESSA AREA (A-20 fisica × A-50 scienze) = 85', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_STESSA_AREA, punteggioClasse({ classi: ['A-20'] }, { classi: ['A-50'] })?.punteggio);
check('PONTE AFFINE (A-01 arte × A-41 digitale) = 75', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_PONTE_AFFINE, punteggioClasse({ classi: ['A-01'] }, { classi: ['A-41'] })?.punteggio);
check('AREA CONTAMINATA (letteratura × teatro) = 65', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_PONTE_CONTAMINATA, punteggioClasse({ classi: ['A-12'] }, { materia: 'Laboratorio teatrale' })?.punteggio);
check('classe ESTRANEA (A-22 lingue × diritto) = 55', PUNTEGGIO_CLASSE_ESATTA - PENALITA_CLASSE_ESTRANEA, punteggioClasse(A22, { classi: ['A-46'], materia: 'Diritto ed economia' })?.punteggio);
check('le penalità crescono con la distanza disciplinare', true, PENALITA_CLASSE_STESSA_AREA < PENALITA_CLASSE_PONTE_AFFINE && PENALITA_CLASSE_PONTE_AFFINE < PENALITA_CLASSE_PONTE_CONTAMINATA && PENALITA_CLASSE_PONTE_CONTAMINATA < PENALITA_CLASSE_ESTRANEA);
check('modale non applicabile senza classi nel profilo → null', null, punteggioClasse({ classi: [] }, { classi: ['A-22'] }));

/* --------- 3) LIVELLO SECONDARIO — COMPETENZE (TETTO 25, §26.63) ------------ */

console.log('\n— Livello secondario «Oltre la classe»: sfumatura 25 piena · 20 vicina · 10 riconducibile —');
const IA = { materieCustom: ['Intelligenza Artificiale'] };
const ia = punteggioCompetenze(IA, { titolo: 'Corso di Intelligenza Artificiale per docenti' });
check('competenza trovata = 25 (una SFUMATURA, non un voto)', PUNTEGGIO_COMPETENZA_ESATTA, ia.punteggio);
check('il tetto del livello secondario è dichiarato dal modulo', CAP_COMPETENZE, ia.punteggio);
check('la competenza riconosciuta è dichiarata', 'Intelligenza Artificiale', ia.competenza);
check('il grado del match è dichiarato', 'esatta', ia.grado);
check('nessun incremento con una sola competenza', 0, ia.incrementi);
check('motivo leggibile', true, /competenza: Intelligenza Artificiale/.test(ia.motivi.join(' ')));
const vicina = punteggioCompetenze({ materieCustom: ['Didattica Multimediale'] }, { titolo: 'Corso multimediale' });
check('match semantico vicino = 20', PUNTEGGIO_COMPETENZA_VICINA, vicina.punteggio);
check('grado «vicina» dichiarato (match parziale)', 'vicina', vicina.grado);
const riconducibile = punteggioCompetenze(IA, { titolo: 'Didattica multimediale in classe' });
check('riconducibile (ponte IA ↔ Digitale) = 10', PUNTEGGIO_COMPETENZA_RICONDUCIBILE, riconducibile.punteggio);
check('grado «riconducibile» dichiarato', 'riconducibile', riconducibile.grado);
check('e nessun voto d’ufficio: resta sotto il tetto', true, riconducibile.punteggio < CAP_COMPETENZE);
const nessuno = punteggioCompetenze({ materieCustom: ['Pedagogia Steineriana'] }, { titolo: 'Interpello di matematica' });
check('nessuna corrispondenza → il livello secondario tace', 0, nessuno.punteggio);
check('e nessuna competenza inventata', null, nessuno.competenza);
check('incremento unitario per ogni corrispondenza aggiuntiva', 3, INCREMENTO_JOLLY);
const dueCompetenze = punteggioCompetenze(
  { materieCustom: ['Intelligenza Artificiale', 'Didattica Multimediale'] },
  { titolo: 'Corso di Intelligenza Artificiale e Didattica Multimediale' },
);
check('due competenze: la seconda aggiunge 3 punti', 1, dueCompetenze.incrementi);
check('ma la somma resta DENTRO il tetto (25, non 28)', CAP_COMPETENZE, dueCompetenze.punteggio);

/* ------- 4) AGGREGATORE: MEDIA PONDERATA DELLE MODALI PRIMARIE + TETTO ------ */

console.log('\n— Aggregatore: la media ponderata delle modali primarie, poi la sfumatura —');
const pesiModali = [PESI_MODALI.ordine, PESI_MODALI.classe, PESI_MODALI.provincia];
const sommaPesi = pesiModali.reduce((totale, peso) => totale + peso, 0);
check('PESI di prodotto: le classi pesano 2, il contesto 1', { ordine: 1, classe: 2, provincia: 1 }, PESI_MODALI);
check(
  'le competenze NON sono pesate: sono il livello secondario, non entrano nella media',
  true,
  !('competenze' in PESI_MODALI),
);
check(
  'nessun peso SUPERA la metà dei pesi totali (il voto mediato non nasce da una sola modale)',
  true,
  Math.max(...pesiModali) * 2 <= sommaPesi,
);
check(
  'media ponderata di 3 modali applicabili (100 · 95 · 100)',
  98,
  mediaPonderata([
    { punteggio: 100, peso: PESI_MODALI.ordine },
    { punteggio: 95, peso: PESI_MODALI.classe },
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
check('senza competenza nel profilo non c’è nulla da sfumare', null, pieno.competenzaSecondaria);
check('le modali non applicabili restano fuori dalla media', null, pieno.modali.competenze);
check('il denominatore è la somma dei pesi applicati (1 + 2 + 1)', 4, pieno.modali.pesoTotale);

/* ------------- 5) SENZA COMPETENZA: MEDIA PONDERATA DELLE MODALI ------------- */

console.log('\n— Senza competenza: il voto è tutto della media ponderata primaria —');
const graduato = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', materia: 'Inglese' },
  { provinceLimitrofe: true },
);
check('ordine 100 · classe affine 95 (peso 2) · provincia 100 → 98', 98, graduato.punteggio);
check('nessuna competenza nel profilo: niente da sfumare', null, graduato.competenzaSecondaria);
check('il dettaglio delle modali è leggibile', 95, graduato.modali.classe);
check('tre modali applicabili → denominatore 4 (1 + 2 + 1)', 4, graduato.modali.pesoTotale);
check('il tooltip dichiara la media ponderata', true, /media ponderata di 3 modali/.test(graduato.motivi.join(' ')));
const conCompetenza = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: ['A-22'], province: ['AT'], materieCustom: ['Intelligenza Artificiale'] },
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Didattica multimediale in classe' },
  { provinceLimitrofe: true },
);
check('la competenza sfuma DOPO la media: 98 primari + 10 → 100', 100, conCompetenza.punteggio);
check(
  'la sfumatura è dichiarata, col suo peso',
  { etichetta: 'Intelligenza Artificiale', punteggio: 10 },
  conCompetenza.competenzaSecondaria,
);
check('le competenze restano FUORI dalla media: denominatore 4', 4, conCompetenza.modali.pesoTotale);
check('il tooltip dichiara anche il livello secondario', true, /livello secondario: \+10 punti/.test(conCompetenza.motivi.join(' ')));
check('i motivi raccontano le modali', true, conCompetenza.motivi.some((m) => /classe affine/.test(m)));

/* ------------------- 6) LA GUARDIA È NELLA CATENA DI `npm test` ------------ */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(
  readFileSync('package.json', 'utf8'),
) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:modali' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-modali-radar.ts'));

console.log(
  errori === 0
    ? '\n✅ MODALI: modali primarie a media ponderata, competenze come sfumatura (max 25).'
    : `\n❌ MODALI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * GUARDIA — LA DISTANZA DAL PROFILO (§26.145, direttiva 05/11/2026).
 * -----------------------------------------------------------------------------------
 * Il sintomo da cui nasce la direttiva: «Sostegno infanzia» arrivava al 88-93% a un
 * profilo Lingue della secondaria di II grado, perché il motore misura ordine e posto
 * come MODALI in media ponderata e non ha nessuna parola per dire «questo non c'entra».
 *
 * Questa guardia fissa la correzione, numero per numero:
 *
 *   1. SCALA DEGLI ORDINI — 1 gradino −25%, 2 −55%, 3 = SBARRAMENTO, `ata`/dati assenti 0;
 *   2. SBARRAMENTO (§26.148) — infanzia ↔ superiori NON entra in bacheca, nei due sensi, e
 *      mai sul dato assente; emergenza (ATA/CPIA/serali/PON) non scelta → −40%;
 *   3. POSTO DI SOSTEGNO — −40% a chi cerca una materia, 0 a chi ha una classe `AD…`;
 *   4. BONUS DI PROSSIMITÀ — +18% nella provincia principale, ma SOLO sotto 70;
 *   5. COMPOSIZIONE — le penalità si moltiplicano, non si sommano; il voto resta 1-100;
 *   6. IL CASO DELLA DIRETTIVA — Sostegno infanzia a un profilo Lingue/AT: **fuori**, non 9%;
 *      le Primarie restano sotto 30, le Medie sotto 40;
 *   7. MODULO PURO — nessuna rete, nessun orologio, e nessuna uscita della cascata che
 *      salti la veste (`voce()`).
 *
 * Uso: npm run test:distanza  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { voceCascata } from '../src/lib/cascataGenerosa.ts';
import { ETICHETTA_FONDO_CONVENTO, SOGLIA_FONDO_CONVENTO } from '../src/lib/compatibilita.ts';
import {
  BONUS_PROVINCIA_PRINCIPALE,
  PENALITA_PER_GRADO_ORDINE,
  PENALITA_POSTO_SOSTEGNO,
  SOGLIA_BONUS_PROVINCIA,
  applicaDistanza,
  bonusProssimita,
  penalitaOrdineDiScuola,
  penalitaPostoSostegno,
} from '../src/lib/distanzaProfilo.ts';
import { distanzaOrdini } from '../src/lib/punteggioOrdine.ts';
import {
  DISTANZA_SBARRAMENTO,
  ORDINI_EMERGENZA,
  PENALITA_EMERGENZA,
  penalitaEmergenza,
  sbarramentoOrdine,
} from '../src/lib/sbarramentoOrdine.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Il profilo della direttiva: Lingue (A-24) della secondaria di II grado, Asti. */
const PROFILO = { ordini: ['secondaria2' as const], classi: ['A-24'], province: ['AT'] };
/** Chi ha scelto il sostegno (classe `ADMM`, diversa da quella dell'avviso: niente match pieno). */
const PROFILO_AD = { ordini: ['secondaria2' as const], classi: ['ADMM'], province: ['AT'] };

/** «Sostegno infanzia» ad Asti: il falso positivo da cui parte tutto. */
const SOSTEGNO_INFANZIA = {
  titolo: 'Interpello per posto di sostegno',
  materia: 'Sostegno',
  classi: ['ADAA'],
  ordine: 'infanzia' as const,
  province: 'AT',
};
const sostegnoDi = (ordine: 'infanzia' | 'primaria' | 'secondaria1' | 'secondaria2', province = 'AT') => ({
  ...SOSTEGNO_INFANZIA,
  classi: [ordine === 'infanzia' ? 'ADAA' : 'ADSS'],
  ordine,
  province,
});

/* ------------------------ 1) SCALA DEGLI ORDINI ---------------------------- */

console.log('\n— 1. La scala degli ordini: un gradino, uno sconto —');
check('le penalità dichiarate sono 0 · 25 · 55 · 100 (il terzo è sbarramento)', [0, 25, 55, 100], [...PENALITA_PER_GRADO_ORDINE]);
check('la sequenza non si inventa: ATA e dati assenti fuori scala', [-1, -1, 0], [
  distanzaOrdini('secondaria2', 'ata'),
  distanzaOrdini(null, 'secondaria1'),
  distanzaOrdini('secondaria2', 'secondaria2'),
]);
check('Medie per chi cerca le Superiori → −25', -25, penalitaOrdineDiScuola(PROFILO, { ordine: 'secondaria1' }).punti);
check('Primarie per chi cerca le Superiori → −55', -55, penalitaOrdineDiScuola(PROFILO, { ordine: 'primaria' }).punti);
check('Infanzia per chi cerca le Superiori → −100 (sbarramento, non sconto)', -100, penalitaOrdineDiScuola(PROFILO, { ordine: 'infanzia' }).punti);
check(
  'la scala è SIMMETRICA: Superiori a una maestra d’infanzia → −100',
  -100,
  penalitaOrdineDiScuola({ ordini: ['infanzia'], classi: ['AAAA'], province: ['AT'] }, { ordine: 'secondaria2' }).punti,
);
check('ATA → nessuna distanza di ordine', 0, penalitaOrdineDiScuola(PROFILO, { ordine: 'ata' }).punti);
check('avviso che non dichiara l’ordine → nessuna distanza', 0, penalitaOrdineDiScuola(PROFILO, {}).punti);
check(
  'profilo senza ordini → nessuna distanza',
  0,
  penalitaOrdineDiScuola({ classi: ['A-24'], province: ['AT'] }, { ordine: 'infanzia' }).punti,
);
check(
  'con più ordini scelti vale il più VICINO (Medie scelte → −25)',
  -25,
  penalitaOrdineDiScuola({ ordini: ['secondaria2', 'secondaria1'], classi: ['A-24'], province: ['AT'] }, { ordine: 'primaria' }).punti,
);


/* -------------- 2) SBARRAMENTO DI ORDINE · CATEGORIE DI EMERGENZA ----------- */

console.log('\n— 2. Il terzo gradino non si sconta: si sbarra, e le emergenze pagano —');
check('il gradino dello sbarramento è il terzo, dichiarato', 3, DISTANZA_SBARRAMENTO);
check('infanzia per chi cerca le Superiori → SBARRATA', true, sbarramentoOrdine(PROFILO, SOSTEGNO_INFANZIA).escluso);
check(
  '…e nei due sensi: Superiori a una maestra d’infanzia → SBARRATA',
  true,
  sbarramentoOrdine({ ordini: ['infanzia'], classi: ['AAAA'], province: ['AT'] }, { ordine: 'secondaria2' }).escluso,
);
check('le Medie (un gradino) NON si sbarrano: si scontano', false, sbarramentoOrdine(PROFILO, sostegnoDi('secondaria1')).escluso);
check('le Primarie (due gradini) restano: −55%, non fuori', false, sbarramentoOrdine(PROFILO, sostegnoDi('primaria')).escluso);
check('chi ha scelto anche l’infanzia non se la vede sbarrare', false, sbarramentoOrdine({ ordini: ['secondaria2', 'infanzia'], classi: ['A-24'], province: ['AT'] }, SOSTEGNO_INFANZIA).escluso);
check('profilo senza ordini → nessuno sbarramento (il dato assente non giudica)', false, sbarramentoOrdine({ classi: ['A-24'], province: ['AT'] }, SOSTEGNO_INFANZIA).escluso);
check('avviso fuori sequenza (ATA) → nessuno sbarramento', false, sbarramentoOrdine(PROFILO, { ordine: 'ata' }).escluso);
check('il motivo parla di ordine incompatibile, mai di «match basso»', true, /ordine incompatibile/.test(sbarramentoOrdine(PROFILO, SOSTEGNO_INFANZIA).motivo));
check('le categorie di emergenza sono ATA · CPIA · serali · PON', ['ata', 'cpia', 'serali', 'pon'], [...ORDINI_EMERGENZA]);
check('ATA a chi cerca le Superiori → −40 (ripiego, non il mestiere)', -PENALITA_EMERGENZA, penalitaEmergenza(PROFILO, { ordine: 'ata' }).punti);
check('la stessa penalità per il CPIA', -PENALITA_EMERGENZA, penalitaEmergenza(PROFILO, { ordine: 'cpia' }).punti);
check('chi ha scelto l’ATA non paga l’ATA', 0, penalitaEmergenza({ ordini: ['ata'], classi: [], province: ['AT'] }, { ordine: 'ata' }).punti);
check('avviso dentro la sequenza → nessuna penalità di emergenza (decide la scala)', 0, penalitaEmergenza(PROFILO, { ordine: 'secondaria2' }).punti);
check('profilo senza ordini → nessuna penalità di emergenza', 0, penalitaEmergenza({ classi: ['A-24'] }, { ordine: 'ata' }).punti);

/* ------------------------ 3) POSTO DI SOSTEGNO ----------------------------- */

console.log('\n— 3. Il posto di sostegno: −40 se la cattedra è un’altra —');
check('la penalità dichiarata è 40, e chi ha la classe AD… non la paga', [40, 0], [
  PENALITA_POSTO_SOSTEGNO,
  penalitaPostoSostegno(PROFILO_AD, SOSTEGNO_INFANZIA).punti,
]);
check('sostegno a chi cerca una materia → −40', -40, penalitaPostoSostegno(PROFILO, SOSTEGNO_INFANZIA).punti);
check('avviso di materia → nessuna penalità di posto', 0, penalitaPostoSostegno(PROFILO, { titolo: 'Supplenza A-24', classi: ['A-24'] }).punti);

/* --------------------- 4) BONUS DI PROSSIMITÀ ------------------------------ */

console.log('\n— 4. Il bonus è un criterio d’ordine, non un salvacondotto —');
check('il bonus dichiarato è +18 e vive sotto 70', [18, 70], [BONUS_PROVINCIA_PRINCIPALE, SOGLIA_BONUS_PROVINCIA]);
check('riserva in provincia principale → +18', 18, bonusProssimita(PROFILO, { province: 'AT' }, 58).punti);
check('la normalizzazione non spegne il bonus (at ≡ AT)', 18, bonusProssimita(PROFILO, { province: ' at ' }, 58).punti);
check('provincia vicina → 0', 0, bonusProssimita(PROFILO, { province: 'AL' }, 58).punti);
check('provincia non dichiarata → 0', 0, bonusProssimita(PROFILO, {}, 58).punti);
check('da 70 in su il bonus NON si applica', [0, 0], [
  bonusProssimita(PROFILO, { province: 'AT' }, 70).punti,
  bonusProssimita(PROFILO, { province: 'AT' }, 100).punti,
]);

/* --------------------------- 5) COMPOSIZIONE ------------------------------- */

console.log('\n— 5. Le penalità si moltiplicano, non si sommano —');
check('un voto 0 non si tocca (non c’è nulla da aggiustare)', 0, applicaDistanza(0, PROFILO, sostegnoDi('secondaria1')).punteggio);
check('il match pieno resta 100', 100, applicaDistanza(100, PROFILO, { classi: ['A-24'], province: 'AT' }).punteggio);
const doppia = applicaDistanza(58, PROFILO, sostegnoDi('secondaria1'));
check('58 + 18 → 76; −40% posto; −25% ordine → 34 (mai −65 sommato)', 34, doppia.punteggio);
check('…con penalità e bonus dichiarati', { penalita: 65, bonus: 18 }, { penalita: doppia.penalita, bonus: doppia.bonus });
check('senza bonus (provincia vicina) → 26', 26, applicaDistanza(58, PROFILO, sostegnoDi('secondaria1', 'AL')).punteggio);
const sbarra = applicaDistanza(58, PROFILO, SOSTEGNO_INFANZIA);
check('infanzia per chi cerca le Superiori → SBARRATA, non un 9% in pagina', { punteggio: 0, penalita: 100, escluso: true }, { punteggio: sbarra.punteggio, penalita: sbarra.penalita, escluso: sbarra.escluso });
check('…e la stessa fine in provincia vicina', true, applicaDistanza(58, PROFILO, sostegnoDi('infanzia', 'AL')).escluso);
check('il voto resta intero nella forbice 1-100', true, [1, 50, 100].every((b) => {
  const v = applicaDistanza(b, PROFILO, sostegnoDi('secondaria1')).punteggio;
  return Number.isInteger(v) && v >= 1 && v <= 100;
}));
check('la soglia del fondo è 20', 20, SOGLIA_FONDO_CONVENTO);

/* ------------------- 6) IL CASO DELLA DIRETTIVA ---------------------------- */

console.log('\n— 6. Il caso del 06/11/2026: Lingue · Superiori · Asti —');
const infanzia = voceCascata(PROFILO, SOSTEGNO_INFANZIA, 'propria');
check('Sostegno infanzia → SBARRATO: la riga non si mostra', { escluso: true, punteggio: 0 }, {
  escluso: infanzia.escluso,
  punteggio: infanzia.punteggio,
});
check('…e non è un «Fondo Convento»: non c’è nessuna riga da dichiarare', false, infanzia.fondo);
check('…ma la fascia resta `riserva` (il PERCHÉ entra è distinto dal SE entra)', 'riserva', infanzia.fascia);
check('…e non è un tetto: non c’è voto da difendere', false, infanzia.tetto);
check('Sostegno primarie → sotto 30 (pesante, ma in pagina)', true, voceCascata(PROFILO, sostegnoDi('primaria'), 'propria').punteggio < 30);
check('Sostegno medie → sotto 40 (moderata)', true, voceCascata(PROFILO, sostegnoDi('secondaria1'), 'propria').punteggio < 40);
check('Sostegno superiori → paga il posto, non l’ordine: 90 −40% = 54', 54, voceCascata(PROFILO, sostegnoDi('secondaria2'), 'propria').punteggio);
check('chi ha scelto il sostegno non paga il posto: 90', 90, voceCascata(PROFILO_AD, sostegnoDi('secondaria2'), 'propria').punteggio);
check('la classe esatta resta il match pieno: 100', 100, voceCascata(PROFILO, { classi: ['A-24'], province: 'AT' }, 'propria').punteggio);
check(
  'la riserva ATA in provincia principale: 52 +18 di bonus, −40% di emergenza = 42',
  42,
  voceCascata(PROFILO, { titolo: 'Avviso per collaboratore scolastico', ordine: 'ata', province: 'AT' }, 'propria').punteggio,
);
check('…e nella provincia vicina, senza bonus: 50 −40% = 30 (là il chilometro zero non aiuta)', 30, voceCascata(PROFILO, { titolo: 'Avviso per collaboratore scolastico', ordine: 'ata', province: 'AL' }, 'vicina').punteggio);
check('una penalità rende il voto un TETTO (il motore non lo rialza)', true, voceCascata(PROFILO, sostegnoDi('primaria'), 'propria').tetto);

/* --------------------------- 7) MODULO PURO -------------------------------- */

console.log('\n— 7. Modulo puro, e nessuna uscita che salti la veste —');
const sorgente = leggi('src/lib/distanzaProfilo.ts');
const codice = sorgente
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codice));
check('nessun node:* (importabile dal browser)', false, /from\s+'node:/i.test(codice));
check('nessun orologio letto (nessun `new Date`)', false, /new Date|Date\.now/.test(codice));
check('sotto il tetto di 250 righe', true, sorgente.split('\n').length <= 250);
check('lo sbarramento vive in un modulo suo', true, /from '\.\/sbarramentoOrdine'/.test(sorgente));

const sbarramento = leggi('src/lib/sbarramentoOrdine.ts');
const codiceSbarramento = sbarramento
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
  .join('\n');
check('sbarramento: nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codiceSbarramento));
check('sbarramento: nessun node:*', false, /from\s+'node:/i.test(codiceSbarramento));
check('sbarramento: nessun orologio letto', false, /new Date|Date\.now/.test(codiceSbarramento));
check('sbarramento: sotto il tetto di 250 righe', true, sbarramento.split('\n').length <= 250);

const cascata = leggi('src/lib/cascataGenerosa.ts');
check('la cascata importa la distanza', true, /from '\.\/distanzaProfilo'/.test(cascata));
check(
  '…e la applica in UN solo punto, prima di restituire il voto',
  true,
  /const distanza = applicaDistanza\(punteggio, profilo, avviso\)/.test(cascata) &&
    /punteggio: distanza\.punteggio/.test(cascata),
);
check('…e la voce porta lo sbarramento alla bacheca (`escluso`)', true, /escluso: distanza\.escluso/.test(cascata));
const codaCascata = cascata.slice(cascata.indexOf('export function voceCascata'));
check('…e nessuna uscita si costruisce la voce a mano', false, /return\s*\{/.test(codaCascata));

const bacheca = leggi('src/lib/bachecaInterpelli.ts');
check('la bacheca salta le righe sbarrate', true, /if \(voce\.escluso && !scuole\.preferita\)/.test(bacheca));
check('…e le conta, senza farle sparire in silenzio', true, /esclusiOrdineEstremo: number/.test(leggi('src/lib/bachecaRipiego.ts')));
check('…e l’etichetta è quella dichiarata', 'Fondo Convento / Ripiego', ETICHETTA_FONDO_CONVENTO);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ DISTANZA DAL PROFILO: l’ordine estremo non entra, il resto pesa, e il Fondo è dichiarato.');
} else {
  console.log(`❌ DISTANZA DAL PROFILO: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

/**
 * GUARDIA — CASCATA GENEROSA (§26.144, direttiva 04/11/2026 · §26.145, 05/11/2026).
 * -----------------------------------------------------------------------------------
 * «Da gatekeeper a buttadentro»: l'unico sbarramento rigido è la geografia (province
 * scelte + raggio dei 60 km), e tutto ciò che è nel perimetro entra con una FASCIA
 * dichiarata. Questa guardia fissa le fasce e i loro numeri:
 *
 *   1. SOSTEGNO · ALTERNATIVA · ATA — entrano d'ufficio: ordine scelto 90/86 (merito),
 *      altro ordine 58/56 · 52/50 (riserva); il SOSTEGNO di un altro ordine paga poi la
 *      distanza (§26.145: −80% infanzia), l'ATA no (è fuori sequenza);
 *   2. INSEGNAMENTO — classe esatta 100, stessa area 85, grado affine 82 · 76 · 72 · 70,
 *      ponte disciplinare anche senza ordine vicino, classe ignota 60 (riserva). Il voto
 *      paga la distanza di ordine: «Inglese (primaria) ↔ Lingue» resta un match di merito,
 *      ma a 38 (−55%, due gradini);
 *   3. L'UNICO SCARTO DI MERITO — incompatibilità semantica evidente (Musica vs Spagnolo),
 *      mai un punteggio basso;
 *   4. LA FORBICE — da 1 a 100: sotto 50 ci si finisce solo con una penalità dichiarata
 *      (`penalita > 0`), e sotto 20 la riga è «Fondo Convento / Ripiego»;
 *   5. CABLAGGIO — la bacheca usa la cascata, non ha cap né paracadute, dichiara i conti e
 *      rispetta il TETTO della distanza (`voce.tetto`).
 *
 * Uso: npm run test:cascata  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  PUNTEGGIO_MERITO_SOSTEGNO,
  PUNTEGGIO_MERITO_SOSTEGNO_VICINO,
  PUNTEGGIO_RISERVA_ATA,
  PUNTEGGIO_RISERVA_ATA_VICINO,
  PUNTEGGIO_RISERVA_CLASSE_IGNOTA,
  PUNTEGGIO_RISERVA_SOSTEGNO,
  PUNTEGGIO_RISERVA_SOSTEGNO_VICINO,
  SOGLIA_MERITO_CLASSE,
  incompatibilitaSemantica,
  ponteTolleranza,
  voceCascata,
} from '../src/lib/cascataGenerosa.ts';
import { SOGLIA_FONDO_CONVENTO } from '../src/lib/compatibilita.ts';
import { PUNTEGGIO_GRADO_AFFINE_PONTE } from '../src/lib/gradiAffini.ts';
import { PUNTEGGIO_CLASSE_ESATTA } from '../src/lib/punteggioClasse.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Profilo della direttiva: docente di Lingue della secondaria di secondo grado, Asti. */
const PROFILO = { ordini: ['secondaria2' as const], classi: ['A-24'], province: ['AT'] };
/**
 * Profilo che ha SCELTO il sostegno (classe AD… propria, diversa da quella dell'avviso):
 * serve a misurare i pavimenti del canale d'ufficio senza la penalità di posto (§26.145).
 */
const PROFILO_AD = { ordini: ['secondaria2' as const], classi: ['ADMM'], province: ['AT'] };

/* ------------------ 1) SOSTEGNO · ALTERNATIVA · ATA: D'UFFICIO -------------- */

console.log('\n— 1. Sostegno/alternativa/ATA: entrano sempre, cambia la fascia —');
const sostegno = (ordine: 'secondaria2' | 'secondaria1' | 'infanzia') => ({
  titolo: 'Interpello sostegno',
  materia: 'Sostegno',
  classi: [ordine === 'infanzia' ? 'ADAA' : 'ADSS'],
  ordine,
});
check('ordine scelto, provincia propria → merito 90', PUNTEGGIO_MERITO_SOSTEGNO, voceCascata(PROFILO_AD, sostegno('secondaria2'), 'propria').punteggio);
check('…fascia `merito`', 'merito', voceCascata(PROFILO_AD, sostegno('secondaria2'), 'propria').fascia);
check('ordine scelto, provincia vicina → merito 86', PUNTEGGIO_MERITO_SOSTEGNO_VICINO, voceCascata(PROFILO_AD, sostegno('secondaria2'), 'vicina').punteggio);
/** §26.148 — il terzo gradino non si sconta: si sbarra (58 → nessun voto, nessuna riga). */
const sostegnoInfanzia = voceCascata(PROFILO_AD, sostegno('infanzia'), 'propria');
check('ordine NON scelto → fascia `riserva` (il PERCHÉ entrerebbe resta dichiarato)', 'riserva', sostegnoInfanzia.fascia);
check('…ma l’infanzia è SBARRATA: punteggio 0, nessuna riga da mostrare', { escluso: true, punteggio: 0 }, { escluso: sostegnoInfanzia.escluso, punteggio: sostegnoInfanzia.punteggio });
check('…e non è un fondo: non c’è nessun voto da dichiarare', false, sostegnoInfanzia.fondo);
/** §26.145 — la riserva-sostegno che resta leggibile: le Medie, un gradino, −25%. */
const sostegnoMedie = voceCascata(PROFILO_AD, sostegno('secondaria1'), 'propria');
check('sostegno alle Medie → riserva 58 −25% = 44 (in pagina, in coda)', 44, sostegnoMedie.punteggio);
check(
  'i pavimenti della riserva restano quelli dichiarati (58 · 56): li sconta la distanza',
  true,
  PUNTEGGIO_RISERVA_SOSTEGNO === 58 && PUNTEGGIO_RISERVA_SOSTEGNO_VICINO === 56,
);
const ata = { titolo: 'Avviso per collaboratore scolastico', materia: null, classi: [], ordine: 'ata' as const };
check('i pavimenti dell’ATA restano quelli dichiarati (52 · 50): li sconta l’emergenza', [52, 50], [PUNTEGGIO_RISERVA_ATA, PUNTEGGIO_RISERVA_ATA_VICINO]);
check('ATA → riserva 52 −40% di emergenza = 31 (fuori sequenza: nessuna distanza di ordine)', 31, voceCascata(PROFILO, ata, 'propria').punteggio);
check('ATA in provincia vicina → riserva 50 −40% = 30', 30, voceCascata(PROFILO, ata, 'vicina').punteggio);
check('la Religione è lo stesso canale del sostegno', 'sostegno', voceCascata(PROFILO, { titolo: 'Supplenza per l’insegnamento della religione cattolica', ordine: 'infanzia' }, 'propria').canale);
check('chi ha la classe AD… propria resta al 100 (classe esatta)', PUNTEGGIO_CLASSE_ESATTA, voceCascata({ ordini: ['secondaria2'], classi: ['ADSS'], province: ['AT'] }, sostegno('secondaria2'), 'propria').punteggio);

/* --------------------- 2) INSEGNAMENTO: TOLLERANZA AMPIA -------------------- */

console.log('\n— 2. Insegnamento: la classe decide, con la tolleranza ampia —');
const classe = (codice: string, materia: string | null = null) => ({
  titolo: `Supplenza ${codice}`,
  materia,
  classi: [codice],
  ordine: null,
});
check('classe esatta → merito 100', PUNTEGGIO_CLASSE_ESATTA, voceCascata(PROFILO, classe('A-24'), 'propria').punteggio);
check(
  'Matematica ↔ Fisica (stessa area) → merito 85',
  SOGLIA_MERITO_CLASSE,
  voceCascata({ ordini: ['secondaria2'], classi: ['A-26'], province: ['AT'] }, classe('A-20', 'Fisica'), 'propria').punteggio,
);
/** §26.145 — la classe è agganciata (merito) ma l'ordine è a due gradini: il voto lo dice. */
const inglesePrimaria = voceCascata(PROFILO, classe('EEEE', 'Lingua inglese'), 'propria');
check('Inglese (primaria) ↔ Lingue straniere (materia coperta) → resta merito 85', 'merito', inglesePrimaria.fascia);
check('…ma il voto paga i due gradini di ordine: 85 −55% = 38', 38, inglesePrimaria.punteggio);
check('…dichiarando il canale e la penalità', { canale: 'classe', penalita: 55 }, { canale: inglesePrimaria.canale, penalita: inglesePrimaria.penalita });
check(
  'Arte (musica) ↔ Digitale: ponte di area, senza il vincolo dell’ordine',
  PUNTEGGIO_GRADO_AFFINE_PONTE,
  ponteTolleranza(
    { ordini: ['secondaria1'], classi: ['A-30'], province: ['AT'] },
    { titolo: 'Esperto digital media', materia: 'Digital media' },
  )?.punteggio ?? 0,
);
check(
  'avviso senza classe in un ordine vicino → grado affine 70',
  70,
  voceCascata(PROFILO, { titolo: 'Avviso per il conferimento di supplenza', classi: [], ordine: 'secondaria2' }, 'propria').punteggio,
);
check('classe ignota al catalogo → riserva 60', PUNTEGGIO_RISERVA_CLASSE_IGNOTA, voceCascata(PROFILO, classe('X-99'), 'propria').punteggio);

/* -------------------- 3) L'UNICO SCARTO: INCOMPATIBILITÀ -------------------- */

console.log('\n— 3. Incompatibilità semantica evidente: l’unico «fuori» —');
check(
  'Musica vs Spagnolo → incompatibile (due temi noti che non si toccano)',
  'incompatibile',
  voceCascata(
    { ordini: ['secondaria1'], classi: ['A-30'], province: ['AT'] },
    { titolo: 'Supplenza A-22', materia: 'Lingua spagnola', classi: ['A-22'] },
    'propria',
  ).fascia,
);
check('…e la funzione lo dichiara', true, incompatibilitaSemantica({ classi: ['A-30'] }, { classi: ['A-22'], materia: 'Lingua spagnola' }));
check('un tema che il catalogo non conosce non è un’incompatibilità', false, incompatibilitaSemantica({ classi: ['A-30'] }, { classi: ['X-99'] }));
check('una lingua e la matematica restano separate', true, incompatibilitaSemantica({ classi: ['A-24'] }, { classi: ['A-26'], materia: 'Matematica' }));
check('profilo solo competenze (nessuna classe) → decide il motore', 'motore', voceCascata({ province: ['AT'], classi: [] }, classe('A-26'), 'propria').fascia);

/* ------------------------ 4) LA FORBICE DICHIARATA ------------------------- */

console.log('\n— 4. Nessun numero ansioso: la forbice è 1-100, e il fondo è dichiarato —');
const voci = [
  voceCascata(PROFILO, sostegno('secondaria2'), 'propria'),
  voceCascata(PROFILO, sostegno('secondaria1'), 'vicina'),
  voceCascata(PROFILO, ata, 'propria'),
  voceCascata(PROFILO, classe('A-24'), 'propria'),
  voceCascata(PROFILO, classe('X-99'), 'propria'),
  voceCascata(PROFILO, { titolo: 'Avviso per supplenza', classi: [], ordine: 'secondaria2' }, 'propria'),
];
check('ogni voce ammessa sta fra 1 e 100', true, voci.every((v) => v.punteggio >= 1 && v.punteggio <= 100));
check(
  'sotto 50 ci si finisce SOLO con una penalità dichiarata (mai per caso)',
  true,
  voci.every((v) => v.punteggio >= 50 || v.penalita > 0),
);
check(
  'sotto la soglia del Fondo la riga lo dichiara (fondo ⇔ punteggio < 20)',
  true,
  voci.every((v) => v.fondo === v.punteggio < SOGLIA_FONDO_CONVENTO),
);
check('le fasce sono solo quelle dichiarate', true, voci.every((v) => ['merito', 'tolleranza', 'riserva'].includes(v.fascia)));
check(
  'la riserva non supera mai il merito',
  true,
  Math.max(PUNTEGGIO_RISERVA_SOSTEGNO, PUNTEGGIO_RISERVA_CLASSE_IGNOTA) < PUNTEGGIO_MERITO_SOSTEGNO_VICINO,
);

/* ----------------------------- 5) CABLAGGIO ------------------------------- */

console.log('\n— 5. Cablaggio: bacheca, esito e guardie —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const esito = `${bacheca}\n${leggi('src/lib/bachecaRipiego.ts')}`;
check('la bacheca chiede la fascia alla cascata', true, /voceCascata\(profilo, avviso, scala\.provincia\)/.test(bacheca));
check('il perimetro geografico resta l’unico sbarramento', true, /!scala\.ammessa/.test(bacheca));
check('nessun cap e nessun paracadute nella pipeline', false, /limitaRiempitivi\(|paracaduteCinque\(/.test(bacheca));
check(
  'i conti delle tre fasce e del fondo sono dichiarati',
  true,
  /meritoInBacheca: number/.test(esito) &&
    /tolleranzaInBacheca: number/.test(esito) &&
    /riserveInBacheca: number/.test(esito) &&
    /fondoInBacheca: number/.test(esito),
);
check(
  '§26.145 — un voto penalizzato è un TETTO: il motore non lo rialza',
  true,
  /voce\.tetto/.test(bacheca) && /voce\.fascia === 'riserva' \|\| voce\.tetto/.test(bacheca),
);
check(
  '§26.148 — le righe SBARRATE non entrano e sono contate',
  true,
  /voce\.escluso && !scuole\.preferita/.test(bacheca) && /esclusiOrdineEstremo: number/.test(esito),
);

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:cascata": "tsx scripts\/test-cascata-generosa\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /scripts\/test-cascata-generosa\.ts/.test(pkg));
check('guardia della DISTANZA in package.json', true, /"test:distanza": "tsx scripts\/test-distanza-profilo\.ts"/.test(pkg));
check('guardia della distanza nella catena di `npm test`', true, /scripts\/test-distanza-profilo\.ts/.test(pkg));

/* --------------------------- 6) MODULO PURO ------------------------------- */

console.log('\n— 6. Modulo puro, verificabile senza browser —');
const sorgente = leggi('src/lib/cascataGenerosa.ts');
const codice = sorgente
  .split('\n')
  .filter((linea) => !linea.trim().startsWith('//') && !linea.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codice));
check('nessun node:* (importabile dal browser)', false, /from\s+'node:/i.test(codice));
check('sotto il tetto di 250 righe', true, sorgente.split('\n').length <= 250);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ CASCATA GENEROSA: la geografia è l’unico sbarramento, e ogni fascia ha il suo numero.');
} else {
  console.log(`❌ CASCATA GENEROSA: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

/**
 * GUARDIA — CASCATA GENEROSA (§26.144, direttiva 04/11/2026).
 * -----------------------------------------------------------------------------------
 * «Da gatekeeper a buttadentro»: l'unico sbarramento rigido è la geografia (province
 * scelte + raggio dei 60 km), e tutto ciò che è nel perimetro entra con una FASCIA
 * dichiarata. Questa guardia fissa le fasce e i loro numeri:
 *
 *   1. SOSTEGNO · ALTERNATIVA · ATA — entrano d'ufficio: ordine scelto 90/86 (merito),
 *      altro ordine 58/56 · 52/50 (riserva);
 *   2. INSEGNAMENTO — classe esatta 100, stessa area 85, grado affine 82 · 76 · 72 · 70,
 *      ponte disciplinare anche senza ordine vicino, classe ignota 60 (riserva);
 *   3. L'UNICO SCARTO DI MERITO — incompatibilità semantica evidente (Musica vs Spagnolo),
 *      mai un punteggio basso;
 *   4. CABLAGGIO — la bacheca usa la cascata, non ha cap né paracadute, e dichiara i conti.
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

/* ------------------ 1) SOSTEGNO · ALTERNATIVA · ATA: D'UFFICIO -------------- */

console.log('\n— 1. Sostegno/alternativa/ATA: entrano sempre, cambia la fascia —');
const sostegno = (ordine: 'secondaria2' | 'infanzia') => ({
  titolo: 'Interpello sostegno',
  materia: 'Sostegno',
  classi: [ordine === 'secondaria2' ? 'ADSS' : 'ADAA'],
  ordine,
});
check('ordine scelto, provincia propria → merito 90', PUNTEGGIO_MERITO_SOSTEGNO, voceCascata(PROFILO, sostegno('secondaria2'), 'propria').punteggio);
check('…fascia `merito`', 'merito', voceCascata(PROFILO, sostegno('secondaria2'), 'propria').fascia);
check('ordine scelto, provincia vicina → merito 86', PUNTEGGIO_MERITO_SOSTEGNO_VICINO, voceCascata(PROFILO, sostegno('secondaria2'), 'vicina').punteggio);
check('ordine NON scelto, provincia propria → riserva 58', PUNTEGGIO_RISERVA_SOSTEGNO, voceCascata(PROFILO, sostegno('infanzia'), 'propria').punteggio);
check('…fascia `riserva`, mai un match', 'riserva', voceCascata(PROFILO, sostegno('infanzia'), 'propria').fascia);
check('ordine NON scelto, provincia vicina → riserva 56', PUNTEGGIO_RISERVA_SOSTEGNO_VICINO, voceCascata(PROFILO, sostegno('infanzia'), 'vicina').punteggio);
const ata = { titolo: 'Avviso per collaboratore scolastico', materia: null, classi: [], ordine: 'ata' as const };
check('ATA → riserva 52 (l’ordine ATA non è fra quelli scelti)', PUNTEGGIO_RISERVA_ATA, voceCascata(PROFILO, ata, 'propria').punteggio);
check('ATA in provincia vicina → riserva 50', PUNTEGGIO_RISERVA_ATA_VICINO, voceCascata(PROFILO, ata, 'vicina').punteggio);
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
check(
  'Inglese (primaria) ↔ Lingue straniere (materia coperta) → merito 85',
  SOGLIA_MERITO_CLASSE,
  voceCascata(PROFILO, classe('EEEE', 'Lingua inglese'), 'propria').punteggio,
);
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

console.log('\n— 4. Nessun numero ansioso: la forbice è 50-100 —');
const voci = [
  voceCascata(PROFILO, sostegno('secondaria2'), 'propria'),
  voceCascata(PROFILO, sostegno('infanzia'), 'vicina'),
  voceCascata(PROFILO, ata, 'propria'),
  voceCascata(PROFILO, classe('A-24'), 'propria'),
  voceCascata(PROFILO, classe('X-99'), 'propria'),
  voceCascata(PROFILO, { titolo: 'Avviso per supplenza', classi: [], ordine: 'secondaria2' }, 'propria'),
];
check('ogni voce ammessa sta fra 50 e 100', true, voci.every((v) => v.punteggio >= 50 && v.punteggio <= 100));
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
  'i conti delle tre fasce sono dichiarati',
  true,
  /meritoInBacheca: number/.test(esito) && /tolleranzaInBacheca: number/.test(esito) && /riserveInBacheca: number/.test(esito),
);

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:cascata": "tsx scripts\/test-cascata-generosa\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /scripts\/test-cascata-generosa\.ts/.test(pkg));

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

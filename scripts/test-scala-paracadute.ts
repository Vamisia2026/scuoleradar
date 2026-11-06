/**
 * GUARDIA — IL PERIMETRO E LA SCALA DEI RAPPORTI (§26.125 → §26.144).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La direttiva del 04/11/2026 ha spostato il confine: l'unico sbarramento
 * rigido della bacheca è la GEOGRAFIA — province scelte + raggio dei 60 km — e tutto ciò
 * che sta dentro entra (cascata generosa, §26.144). Il vecchio divieto «sostegno mai fuori
 * dalle province scelte» era più severo della geografia: un sostegno a Vercelli per chi ha
 * scelto Asti veniva scartato anche se Vercelli è a 50 km. Oggi Vercelli è perimetro.
 *
 * Questa guardia fissa:
 *   1. i tre gradini della scala (`ottime` → `affini` → `ultima-spiaggia`);
 *   2. il PERIMETRO: dentro si entra (anche col sostegno), fuori no;
 *   3. l'ordine della scorta (`paracaduteCinque` con `priorita`), che resta un'utilità
 *      pura: la cascata non ha più una scorta da pescare;
 *   4. il cablaggio: la bacheca passa dalla scala per il perimetro e dalla cascata per
 *      il merito.
 *
 * Esecuzione: `npm run test:scala-paracadute` (inclusa in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import {
  ORDINE_LIVELLO,
  alternativaReligione,
  ammessaDallaScala,
  scalaParacadute,
} from '../src/lib/scalaParacadute.ts';
import { paracaduteCinque } from '../src/lib/riempitivi.ts';
import type { Interpello } from '../src/data/interpelli.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Data fra N giorni in ISO (la finestra delle opportunità è di 15 giorni). */
const fra = (giorni: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** Profilo della direttiva: docente di Lingue della secondaria, Asti. */
const profilo = { province: ['AT'], classi: ['A-24', 'A-25'], ordini: ['secondaria2' as const] };

/** Interpello di prova: identità completa, sovrascrivibile campo per campo. */
const avviso = (overrides: Partial<Interpello> = {}): Interpello => ({
  id: 'a1',
  titolo: 'Interpello supplenza A-24 lingua inglese',
  istituto: 'I.I.S. A. CASTIGLIANO',
  provinciaCodice: 'AT',
  provinciaNome: 'Asti',
  classeCodice: 'A-24',
  classiCodes: ['A-24'],
  materia: null,
  ordine: 'secondaria2',
  dataScadenza: fra(5),
  descrizione: 'Interpello supplenza A-24',
  linkFonte: 'https://www.iiscastigliano.edu.it/avvisi/interpello-a24',
  compatibilita: 100,
  ...overrides,
});

/* ------------------------- 1) LA SCALA: i tre gradini ---------------------- */

console.log('\n— 1. Livello 1 «Ottime»: stessa provincia e stessa classe —');
const ottime = scalaParacadute(profilo, { province: 'AT', classi: ['A-24'] });
check('gradino', 'ottime', ottime.livello);
check('ammessa', true, ottime.ammessa);
check('provincia', 'propria', ottime.provincia);
check('classe', 'stessa', ottime.classe);

console.log('\n— 2. Livello 2 «Affini»: due strade, non una —');
const affineInProvincia = scalaParacadute(profilo, { province: 'AT', classi: ['A-22'] });
check('stessa provincia + classe affine → affini', 'affini', affineInProvincia.livello);
const stessaInVicina = scalaParacadute(profilo, { province: 'VC', classi: ['A-24'] });
check('provincia vicina (VC) + stessa classe → affini', 'affini', stessaInVicina.livello);
check('e la provincia è dichiarata «vicina»', 'vicina', stessaInVicina.provincia);

console.log('\n— 3. Livello 3 «Ultima spiaggia»: sostegno e Religione, SOLO in provincia —');
const sostegnoAsti = scalaParacadute(profilo, {
  province: 'AT',
  classi: ['ADSS'],
  materia: 'Sostegno',
  titolo: 'Interpello sostegno',
  ordine: 'secondaria2',
});
check('sostegno ad Asti → ultima spiaggia', 'ultima-spiaggia', sostegnoAsti.livello);
check('e resta ammesso', true, sostegnoAsti.ammessa);
const religioneAsti = scalaParacadute(profilo, {
  province: 'AT',
  titolo: 'Supplenza per l’insegnamento della religione cattolica',
  ordine: 'secondaria2',
});
check('Religione ad Asti → ultima spiaggia', 'ultima-spiaggia', religioneAsti.livello);
check('alternativaReligione riconosce il titolo', true, alternativaReligione({
  titolo: 'Alternativa all’insegnamento della religione cattolica',
}));
check('e non scambia una scuola per un bando', false, alternativaReligione({
  materia: 'Matematica',
  titolo: 'Interpello A-26',
}));

/* --------------------- 2) IL PERIMETRO (non negoziabile) ------------------ */

console.log('\n— 4. PERIMETRO: province scelte + raggio dei 60 km — dentro si entra —');
const sostegnoVercelli = scalaParacadute(profilo, {
  province: 'VC',
  classi: ['ADSS'],
  materia: 'Sostegno',
  titolo: 'Interpello sostegno',
  ordine: 'secondaria2',
});
check('sostegno a Vercelli (50 km) → ammesso, è perimetro', true, sostegnoVercelli.ammessa);
check('e la provincia resta dichiarata «vicina»', 'vicina', sostegnoVercelli.provincia);
check('il gradino è quello del sostegno', 'ultima-spiaggia', sostegnoVercelli.livello);
const sostegnoMilano = scalaParacadute(profilo, {
  province: 'MI',
  classi: ['ADSS'],
  materia: 'Sostegno',
  ordine: 'secondaria2',
});
check('sostegno a Milano (fuori raggio) → NON ammesso', false, sostegnoMilano.ammessa);
check('e il motivo lo dichiara', true, /fuori dal perimetro/.test(sostegnoMilano.motivo));
check('ammessaDallaScala espone lo stesso verdetto (dentro)', true, ammessaDallaScala(profilo, {
  province: 'VC',
  classi: ['ADSS'],
  materia: 'Sostegno',
}));
check('…e fuori', false, ammessaDallaScala(profilo, {
  province: 'MI',
  classi: ['ADSS'],
  materia: 'Sostegno',
}));
const disciplinareVercelli = scalaParacadute(profilo, { province: 'VC', classi: ['A-26'] });
check('una classe estranea nella provincia vicina resta nel perimetro', true, disciplinareVercelli.ammessa);

console.log('\n— 5. Chi ha una classe AD… propria è un match, non un ripiego —');
const adProprio = scalaParacadute(
  { province: ['AT'], classi: ['ADSS'], ordini: ['secondaria2' as const] },
  { province: 'AT', classi: ['ADSS'], materia: 'Sostegno' },
);
check('stessa classe di sostegno → ottime', 'ottime', adProprio.livello);
check('e la classe esatta vince sul gradino del sostegno', 'stessa', adProprio.classe);
check(
  'profilo senza province → nessun vincolo geografico',
  true,
  scalaParacadute({ classi: ['A-24'] }, { province: 'VC', classi: ['ADSS'], materia: 'Sostegno' }).ammessa,
);

/* --------------------- 3) L'ORDINE DELLA SCORTA (5 posti) ----------------- */

console.log('\n— 6. paracaduteCinque: prima il gradino, poi il voto —');
type Riga = { id: string; compatibilita: number; livelloRipiego?: keyof typeof ORDINE_LIVELLO };
const scorta: Riga[] = [
  { id: 'sostegno', compatibilita: 60, livelloRipiego: 'ultima-spiaggia' },
  { id: 'affine', compatibilita: 65, livelloRipiego: 'affini' },
  { id: 'ottima', compatibilita: 55, livelloRipiego: 'ottime' },
];
const ordinata = paracaduteCinque<Riga>([], scorta, {
  priorita: (voce) => ORDINE_LIVELLO[voce.livelloRipiego ?? 'non-classificata'],
});
check(
  'senza voto: ottime → affini → ultima spiaggia',
  ['ottima', 'affine', 'sostegno'],
  ordinata.lista.map((v) => v.id),
);
const storica = paracaduteCinque<Riga>([], scorta);
check(
  'senza `priorita` l’ordine storico resta il voto decrescente',
  ['affine', 'sostegno', 'ottima'],
  storica.lista.map((v) => v.id),
);

/* --------------------------- 4) LA BACHECA VERA -------------------------- */

console.log('\n— 7. Bacheca: il perimetro è la geografia — Asti e Vercelli entrano, Milano no —');
const sostegno = (id: string, provinciaCodice: string, provinciaNome: string) =>
  avviso({
    id,
    titolo: 'Interpello sostegno scuola secondaria di secondo grado',
    provinciaCodice,
    provinciaNome,
    classeCodice: 'ADSS',
    classiCodes: ['ADSS'],
    materia: 'Sostegno',
    linkFonte: `https://www.scuola-${provinciaCodice.toLowerCase()}.edu.it/avvisi/sostegno`,
  });
const esito = bachecaInterpelli(
  [sostegno('sostegno-at', 'AT', 'Asti'), sostegno('sostegno-vc', 'VC', 'Vercelli'), sostegno('sostegno-mi', 'MI', 'Milano')],
  profilo,
);
check('entrano Asti e Vercelli (perimetro), non Milano', ['sostegno-at', 'sostegno-vc'], esito.lista.map((r) => r.id));
// §26.145 — la fascia resta `merito` (il sostegno entra d'ufficio), ma il VOTO paga il posto:
// chi cerca una materia di lingue non sta cercando il sostegno, e la cascata lo dice col −40%
// di `lib/distanzaProfilo`: 90 → 54 (Asti) · 86 → 52 (Vercelli, provincia vicina).
check('la fascia resta merito, il voto paga il posto di sostegno: 90 → 54', 54, esito.lista[0]?.compatibilita);
check('la provincia vicina: 86 → 52 (stesso −40%, nessun bonus fuori dalla principale)', 52, esito.lista[1]?.compatibilita);
check('nessun ripiego: la scorta non esiste più', 0, esito.lista.filter((r) => r.ripiego === true).length);
check('Milano è contata fuori perimetro', 1, esito.fuoriPerimetro);

console.log('\n— 8. Cablaggio: perimetro dalla scala, merito dalla cascata —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
// §26.144 — il contratto dell'esito e la riga vivono in `bachecaRipiego` (estratto per il
// tetto di 250 righe): la guardia legge i DUE file, il cablaggio resta uno solo.
const ripiego = leggi('src/lib/bachecaRipiego.ts');
const bachecaConEsito = `${bacheca}\n${ripiego}`;
check('la scala è importata', true, /from '\.\/scalaParacadute'/.test(bacheca));
check('il perimetro è applicato prima del punteggio', true, /if \(!scala\.ammessa && !scuole\.preferita && !jollyPieno\)/.test(bacheca));
check('il merito passa dalla cascata', true, /voceCascata\(profilo, avviso, scala\.provincia\)/.test(bacheca));
check('il paracadute non è più cablato', false, /paracaduteCinque\(/.test(bacheca));
check('il conto del perimetro è dichiarato nell’esito', true, /fuoriPerimetro: number/.test(bachecaConEsito));

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:scala-paracadute": "tsx scripts\/test-scala-paracadute\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /test-scala-paracadute\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ PERIMETRO E SCALA: dentro si entra (anche col sostegno), fuori no, e il merito è dichiarato.');
} else {
  console.log(`❌ SCALA DEL PARACADUTE: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

/**
 * GUARDIA — LA SCALA DEL PARACADUTE (§26.125).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La direttiva del 31/10/2026 chiede due cose insieme:
 *   1. le «5 opportunità minime» restano (la vetrina non deve restare vuota);
 *   2. l'ordine non è più il voto: prima la stessa provincia con la stessa classe,
 *      poi le affini, e SOLO alla fine il sostegno — che però non esce MAI dalle
 *      province scelte («sostegno a Vercelli» per chi ha scelto Asti è il falso
 *      positivo da eliminare, non un ripiego).
 *
 * Questa guardia fissa il modulo puro (`lib/scalaParacadute`), l'ordine della
 * scorta (`paracaduteCinque` con `priorita`) e il cablaggio nella bacheca.
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

/* ------------------------ 2) IL DIVIETO (non negoziabile) ----------------- */

console.log('\n— 4. DIVIETO: sostegno fuori dalle province scelte, mai —');
const sostegnoVercelli = scalaParacadute(profilo, {
  province: 'VC',
  classi: ['ADSS'],
  materia: 'Sostegno',
  titolo: 'Interpello sostegno',
  ordine: 'secondaria2',
});
check('sostegno a Vercelli → NON ammesso', false, sostegnoVercelli.ammessa);
check('anche se la provincia è solo «vicina»', 'vicina', sostegnoVercelli.provincia);
check('motivo dichiarato', true, /fuori dalle province scelte/.test(sostegnoVercelli.motivo));
const sostegnoMilano = scalaParacadute(profilo, {
  province: 'MI',
  classi: ['ADSS'],
  materia: 'Sostegno',
  ordine: 'secondaria2',
});
check('sostegno a Milano → NON ammesso', false, sostegnoMilano.ammessa);
check('ammessaDallaScala espone lo stesso verdetto', false, ammessaDallaScala(profilo, {
  province: 'VC',
  classi: ['ADSS'],
  materia: 'Sostegno',
}));

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

console.log('\n— 7. Bacheca: il sostegno di Vercelli non entra, nemmeno di ripiego —');
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
check('entra SOLO il sostegno di Asti', ['sostegno-at'], esito.lista.map((r) => r.id));
check('ed è dichiarato ripiego', true, esito.lista[0]?.ripiego === true);
check('col suo gradino', 'ultima-spiaggia', esito.lista[0]?.livelloRipiego);
check('Vercelli e Milano contati a parte (divieto)', 2, esito.sostegnoFuoriProvincia);

console.log('\n— 8. Cablaggio: la bacheca usa la scala e il suo ordine —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
// §26.125 — il contratto dell'esito e la riga di ripiego vivono in `bachecaRipiego`
// (estratto per il tetto di 250 righe): la guardia legge i DUE file, il cablaggio
// resta uno solo.
const ripiego = leggi('src/lib/bachecaRipiego.ts');
const bachecaConRipiego = `${bacheca}\n${ripiego}`;
check('la scala è importata', true, /from '\.\/scalaParacadute'/.test(bacheca));
check('il divieto è applicato prima del punteggio', true, /if \(!scuole\.preferita && !scala\.ammessa\)/.test(bacheca));
check('la scorta porta il gradino', true, /livelloRipiego: livello/.test(bachecaConRipiego));
check('il paracadute ordina per gradino', true, /priorita: \(voce\) => ORDINE_LIVELLO/.test(bacheca));
check('il conto del divieto è dichiarato nell’esito', true, /sostegnoFuoriProvincia: number/.test(bachecaConRipiego));

const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:scala-paracadute": "tsx scripts\/test-scala-paracadute\.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /test-scala-paracadute\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ SCALA DEL PARACADUTE: tre gradini, sostegno mai fuori provincia, ordine dichiarato.');
} else {
  console.log(`❌ SCALA DEL PARACADUTE: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

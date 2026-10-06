/**
 * TEST — OVERRIDE DELLA MODALITÀ 3: LA PAROLA CHIAVE ASSEGNA IL VOTO.
 * --------------------------------------------------------------------------
 * La regola ad ALTA PRIORITÀ delle preferenze: quando una parola chiave del profilo
 * compare nel testo dell'avviso il voto è ASSEGNATO d'ufficio e la media ponderata
 * delle altre modali non viene calcolata.
 *
 *   1. MODULO (`punteggioCompetenze`): parola chiave piena → 90 · match vicino → 85,
 *      con grado/parola/voto dichiarati; solo «riconducibile» → nessuna assegnazione
 *      (resta il jolly del 3%);
 *   2. AGGREGATORE: l'override blocca la media (`pesoTotale` 0, nessun jolly) e il
 *      tooltip dichiara il voto assegnato;
 *   3. LA PROVINCIA RESTA LA CONDIZIONE: oltre il raggio l'esclusione d'ufficio vince
 *      sull'override; entro il raggio l'override assegna comunque il voto.
 *
 * Il pavimento EXTRA del sostegno (60 anche con una parola chiave trovata) e il
 * cablaggio card/modale vivono in `test-compatibilita-graduata.ts`; i pesi della media
 * in `test-modali-radar.ts`.
 *
 * Esecuzione: npm run test:override (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import {
  PUNTEGGIO_KEYWORD_ESATTA,
  PUNTEGGIO_KEYWORD_VICINA,
  punteggioCompetenze,
} from '../src/lib/punteggioCompetenze.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Profilo con una parola chiave ad alta priorità (Modalità 3). */
const chiave = {
  ordini: ['secondaria2'],
  classi: ['A-22'],
  province: ['AT'],
  materieCustom: ['Intelligenza Artificiale'],
};

/* ---------------- 1) IL MODULO DICHIARA IL VOTO D’UFFICIO ------------------ */

console.log('— Modalità 3: la parola chiave trovata dichiara il voto d’ufficio —');
const piena = punteggioCompetenze(
  { materieCustom: ['Intelligenza Artificiale'] },
  { titolo: 'Corso di Intelligenza Artificiale per docenti' },
);
check('parola chiave piena = 90', PUNTEGGIO_KEYWORD_ESATTA, piena.override?.punteggio);
check(
  'l’override dichiara grado, parola chiave e voto',
  { grado: 'esatta', parolaChiave: 'Intelligenza Artificiale', punteggio: 90 },
  piena.override,
);
check('nessun jolly su una parola chiave sola', 0, piena.incrementi);
const parziale = punteggioCompetenze({ materieCustom: ['Didattica Multimediale'] }, { titolo: 'Corso multimediale' });
check('match vicino = 85', PUNTEGGIO_KEYWORD_VICINA, parziale.override?.punteggio);
check('grado «vicina» (match parziale)', 'vicina', parziale.override?.grado);
const ponte = punteggioCompetenze(chiave, { titolo: 'Didattica multimediale in classe' });
check('solo «riconducibile» → nessun voto d’ufficio (resta jolly)', null, ponte.override);

/* ---------------- 2) L’AGGREGATORE BLOCCA LA MEDIA PONDERATA -------------- */

console.log('\n— Aggregatore: l’override blocca la media ponderata delle altre modali —');
const conChiave = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('parola chiave trovata → voto d’ufficio 90 (non la media 98)', 90, conChiave.punteggio);
check(
  'l’override è dichiarato nella valutazione',
  { grado: 'esatta', parolaChiave: 'Intelligenza Artificiale', punteggio: 90 },
  conChiave.override,
);
check('blocca la media: nessun denominatore (pesoTotale 0)', 0, conChiave.modali.pesoTotale);
check('nessun jolly sul voto d’ufficio', 0, conChiave.modali.incrementiJolly);
check('il tooltip dichiara il voto assegnato', true, /voto assegnato d'ufficio 90%/.test(conChiave.motivi.join(' ')));

const chiaveVicina = valutaCompatibilita(
  { ...chiave, materieCustom: ['Didattica Multimediale'] },
  { province: 'AT', classi: ['A-22'], ordine: 'secondaria2', titolo: 'Corso multimediale' },
  { provinceLimitrofe: true },
);
check('match vicino → voto d’ufficio 85 anche con classe esatta 100', 85, chiaveVicina.punteggio);
check('grado «vicina» nel dettaglio', 'vicina', chiaveVicina.override?.grado);

/* ---------------- 3) LA PROVINCIA RESTA L’UNICA CONDIZIONE ---------------- */

console.log('\n— Provincia: fuori dal raggio l’esclusione vince, entro il raggio l’override resta —');
const fuoriRaggio = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('oltre il raggio: esclusione d’ufficio, non 90', 0, fuoriRaggio.punteggio);
check('e la valutazione è esclusa', true, fuoriRaggio.escluso);
check('nessun voto d’ufficio su un avviso escluso', null, fuoriRaggio.override ?? null);
const entroRaggio = valutaCompatibilita(
  { ...chiave, classi: ['A-01'] },
  { province: 'AL', classi: ['A-01'], ordine: 'primaria', titolo: 'Corso di intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('entro il raggio (60 km): l’override assegna comunque 90', 90, entroRaggio.punteggio);
check('anche se l’ordine di scuola scosta dal profilo', 70, entroRaggio.modali.ordine);

/* ------------------- 4) LA GUARDIA È NELLA CATENA DI `npm test` ----------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
check('script dedicato', true, 'test:override' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-override-modale3.ts'));

console.log(
  errori === 0
    ? '\n✅ OVERRIDE: la parola chiave assegna il voto, la provincia resta la condizione.'
    : `\n❌ OVERRIDE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

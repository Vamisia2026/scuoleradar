/**
 * TEST — IL JOLLY SEMANTICO DELLA MODALITÀ 3 (§26.64), ASIMMETRICO.
 * -----------------------------------------------------------------------------------
 *   · MATCH PIENO — tutti i token della competenza dichiarata sono nell'avviso: il voto ha il
 *     PAVIMENTO d'eccellenza (`PUNTEGGIO_JOLLY_PIENO`, 90) — mai una decurtazione — e fuori dal
 *     raggio dei 60 km l'avviso entra D'UFFICIO al pavimento d'inclusione
 *     (`PUNTEGGIO_JOLLY_OLTRE_RAGGIO`, 60: la distanza resta dichiarata nel numero);
 *   · MATCH PARZIALE — bonus dentro `BONUS_JOLLY_PARZIALE` (15): sfuma al massimo, NON apre la
 *     bacheca e NON scavalca l'esclusione geografica;
 *   · NESSUN MATCH — zero punti e ZERO penalizzazioni;
 *   · SOSPENSIONI — whitelist (`forzata`), profilo senza classi (`tettoMotore`), pavimento del
 *     sostegno: il jolly tace e vale la §26.63, che resta l'unica MISURA.
 * Verifica: 1) modulo `jollySemantico` (fasce, pavimenti, bonus, sospensioni);
 *           2) `punteggioConJolly` (asimmetria: verso l'alto sì, verso il basso nulla);
 *           3) dichiarazione del secondo livello + cablaggio in `valutaCompatibilita`;
 *           4) invarianti di cablaggio e catena di `npm test`.
 * Esecuzione: npm run test:jolly (la MISURA della sfumatura resta in `npm run test:scoring`).
 */
import { readFileSync } from 'node:fs';
import {
  BONUS_JOLLY_PARZIALE,
  esitoJollySemantico,
  motivoJolly,
  PUNTEGGIO_JOLLY_OLTRE_RAGGIO,
  PUNTEGGIO_JOLLY_PIENO,
  punteggioConJolly,
  secondarioDaDichiarare,
} from '../src/lib/jollySemantico.ts';
import { CAP_COMPETENZE, punteggioCompetenze } from '../src/lib/punteggioCompetenze.ts';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import { PUNTEGGIO_EXTRA_SOSTEGNO, PUNTEGGIO_MATCH_SECONDARIO } from '../src/lib/matchingEngine.ts';
import { SOGLIA_COMPATIBILITA_VERDE } from '../src/lib/compatibilita.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Modalità 3: la competenza dichiarata dal profilo, nominata PER INTERO nel testo dell'avviso. */
const profiloIA = { materieCustom: ['Intelligenza Artificiale'] };
const avvisoIA = { titolo: 'Corso di Intelligenza Artificiale per docenti' };

/* --------------------- 1) LE TRE FASCE: PIENO · PARZIALE · ASSENTE ---------- */

console.log('— Il modulo: pavimento (pieno), bonus (parziale), silenzio (assente) —');
check('il pavimento d’eccellenza sta sopra la soglia verde', true, PUNTEGGIO_JOLLY_PIENO > SOGLIA_COMPATIBILITA_VERDE);
check(
  'il pavimento d’inclusione fuori raggio è lo stesso del sostegno (§26.45)',
  PUNTEGGIO_EXTRA_SOSTEGNO,
  PUNTEGGIO_JOLLY_OLTRE_RAGGIO,
);
check('il bonus parziale è più stretto della sfumatura della §26.63', true, BONUS_JOLLY_PARZIALE < CAP_COMPETENZE);

const pienoDentro = esitoJollySemantico(profiloIA, avvisoIA, { statoGeo: 'propria' });
check('match PIENO dentro le proprie province: fascia «pieno»', 'pieno', pienoDentro.fascia);
check('col pavimento d’eccellenza', PUNTEGGIO_JOLLY_PIENO, pienoDentro.punteggio);
check('nessun bypass: la provincia era già la propria', false, pienoDentro.bypassRaggio);
check('la competenza riconosciuta è dichiarata', 'Intelligenza Artificiale', pienoDentro.etichetta);
check('i punti restano quelli MISURATI dalla §26.63: 25', 25, pienoDentro.punti);
check('nessun bonus da sommare a un pavimento', 0, pienoDentro.bonus);
check('il motivo dichiara l’eccellenza', true, /^interesse pieno \(Modalità 3\)/.test(pienoDentro.motivo ?? ''));
check('e il pavimento in cifre', true, /punteggio d'eccellenza \(almeno 90%\)/.test(pienoDentro.motivo ?? ''));

const pienoFuori = esitoJollySemantico(profiloIA, avvisoIA, { statoGeo: 'fuori' });
check('match PIENO oltre il raggio: inclusione d’ufficio al pavimento', PUNTEGGIO_JOLLY_OLTRE_RAGGIO, pienoFuori.punteggio);
check('col bypass del raggio dichiarato', true, pienoFuori.bypassRaggio);
check('e il motivo lo dice: l’avviso entra d’ufficio', true, /inclusione d'ufficio al 60%/.test(pienoFuori.motivo ?? ''));

const parziale = esitoJollySemantico(
  { materieCustom: ['Didattica Multimediale'] },
  { titolo: 'Corso multimediale' },
  { statoGeo: 'propria' },
);
check('match «vicino» (20 misurati) → fascia «parziale»', 'parziale', parziale.fascia);
check('il parziale non assegna il voto: nessun pavimento', null, parziale.punteggio);
check('il parziale non apre la bacheca: nessun bypass', false, parziale.bypassRaggio);
check('bonus dentro il tetto del jolly: 20 misurati → 15 applicati', BONUS_JOLLY_PARZIALE, parziale.bonus);
check('il motivo dichiara il bonus DAVVERO applicato', true, /→ \+15 punti/.test(parziale.motivo ?? ''));

const riconducibile = esitoJollySemantico(
  { materieCustom: ['Intelligenza Artificiale'] },
  { titolo: 'Didattica multimediale in classe' },
  { statoGeo: 'propria' },
);
check('match «riconducibile» (10) → bonus intero: 10', 10, riconducibile.bonus);

const assente = esitoJollySemantico(
  { materieCustom: ['Pedagogia Steineriana'] },
  { titolo: 'Interpello di matematica' },
  { statoGeo: 'propria' },
);
check('nessuna competenza nel testo: il jolly tace', 'assente', assente.fascia);
check(
  'zero punti, zero penalizzazioni, niente da dichiarare',
  { punteggio: null, bonus: 0, etichetta: null, motivo: null },
  { punteggio: assente.punteggio, bonus: assente.bonus, etichetta: assente.etichetta, motivo: assente.motivo },
);
check('e nessuna riga da mostrare alla card', [], motivoJolly(assente));

/* ------------------------ 2) LE TRE SOSPENSIONI ---------------------------- */

console.log('\n— Sospensioni: whitelist, profilo senza classi, pavimento del sostegno —');
check(
  'whitelist (scuola preferita): il jolly non tocca l’inclusione d’ufficio',
  'assente',
  esitoJollySemantico(profiloIA, avvisoIA, { statoGeo: 'fuori', forzata: true }).fascia,
);
check(
  'profilo senza classi: il verdetto del motore resta il tetto',
  'assente',
  esitoJollySemantico(profiloIA, avvisoIA, { statoGeo: 'propria', tettoMotore: true }).fascia,
);
check(
  'pavimento del sostegno: non si sconta (§26.45)',
  'assente',
  esitoJollySemantico(profiloIA, avvisoIA, { statoGeo: 'propria', sostegno: true }).fascia,
);
/* ------------------- 3) LA SOMMA DEI DUE LIVELLI: ASIMMETRIA ---------------- */

console.log('\n— punteggioConJolly: pavimento verso l’alto, nessuna decurtazione —');
check('pieno dentro, primarie forti: il voto resta il loro (100)', 100, punteggioConJolly(pienoDentro, 98, 100));
check('pieno dentro, primarie deboli: entra il pavimento (70 → 90)', PUNTEGGIO_JOLLY_PIENO, punteggioConJolly(pienoDentro, 60, 70));
check('pieno oltre il raggio: il voto È l’inclusione (60), non un 100% finto', PUNTEGGIO_JOLLY_OLTRE_RAGGIO, punteggioConJolly(pienoFuori, 100, 100));
check('parziale: il tetto è base + bonus, non la sfumatura (80 → 75)', 75, punteggioConJolly(parziale, 60, 80));
check('parziale: se la sfumatura è già sotto, non la alza (65 → 65)', 65, punteggioConJolly(parziale, 60, 65));
check('assente: la somma della §26.63 resta INTATTA (100)', 100, punteggioConJolly(assente, 98, 100));
check('assente: nessuna decurtazione nemmeno con primarie deboli', 62, punteggioConJolly(assente, 55, 62));

/* ------------- 4) COSA DICHIARARE DEL SECONDO LIVELLO (UNA VOLTA) ---------- */

console.log('\n— secondarioDaDichiarare: col pieno parla il jolly, col parziale il bonus —');
const competenze = punteggioCompetenze(profiloIA, avvisoIA);
check('misura della §26.63 di riferimento: 25', 25, competenze.punteggio);
check('col match PIENO il badge del secondo livello tace', null, secondarioDaDichiarare(pienoDentro, competenze));
check(
  'col match PARZIALE dichiara il bonus applicato (15), non i 20 misurati',
  { etichetta: 'Didattica Multimediale', punteggio: BONUS_JOLLY_PARZIALE },
  secondarioDaDichiarare(parziale, punteggioCompetenze({ materieCustom: ['Didattica Multimediale'] }, { titolo: 'Corso multimediale' })),
);
check(
  'senza jolly resta la sfumatura classica della §26.63',
  { etichetta: 'Intelligenza Artificiale', punteggio: 25 },
  secondarioDaDichiarare(assente, competenze),
);
check(
  'né competenza né punti: nulla da dichiarare',
  null,
  secondarioDaDichiarare(assente, punteggioCompetenze({ materieCustom: ['Pedagogia Steineriana'] }, { titolo: 'Interpello di matematica' })),
);
check('il motivo del jolly è una sola riga', 1, motivoJolly(pienoDentro).length);

/* ------------------- 5) CABLAGGIO: L’AGGREGATORE -------------------------- */

console.log('\n— valutaCompatibilita: il jolly apre e pavimenta, la §26.63 sfuma —');
const chiave = { ordini: ['secondaria2'] as const, classi: ['A-22'], province: ['AT'], materieCustom: ['Intelligenza Artificiale'] };
const dentro = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di Intelligenza Artificiale per docenti' },
  { provinceLimitrofe: true },
);
check('dentro le proprie province il jolly dichiara la competenza', 'Intelligenza Artificiale', dentro.jollySemantico);
check('e il badge del secondo livello parla al posto suo', null, dentro.competenzaSecondaria);
check('il voto non scende sotto il pavimento d’eccellenza', true, dentro.punteggio >= PUNTEGGIO_JOLLY_PIENO);
check('il motivo della card porta la riga del jolly', true, dentro.motivi.some((m) => m.startsWith('interesse pieno')));

const fuori = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di Intelligenza Artificiale per docenti' },
  { provinceLimitrofe: true },
);
check('match PIENO oltre i 60 km: NON è escluso', false, fuori.escluso);
check('entra al pavimento d’inclusione (60)', PUNTEGGIO_JOLLY_OLTRE_RAGGIO, fuori.punteggio);
check('e la competenza riconosciuta resta dichiarata', 'Intelligenza Artificiale', fuori.jollySemantico);

const fuoriSenzaPieno = valutaCompatibilita(
  { ...chiave, materieCustom: ['Pedagogia Steineriana'] },
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di matematica' },
  { provinceLimitrofe: true },
);
check('senza match pieno l’esclusione oltre il raggio resta secca', true, fuoriSenzaPieno.escluso);
check('e il motivo dichiara il raggio', true, /oltre il raggio/.test(fuoriSenzaPieno.motivi.join(' ')));

const fuoriParziale = valutaCompatibilita(
  { ...chiave, materieCustom: ['Didattica Multimediale'] },
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso multimediale' },
  { provinceLimitrofe: true },
);
check('match PARZIALE oltre i 60 km: esclusione secca (non apre la bacheca)', true, fuoriParziale.escluso);
check('e nessun jolly dichiarato su un avviso escluso', null, fuoriParziale.jollySemantico);

const sostegno = valutaCompatibilita(
  chiave,
  { province: 'AT', classi: ['ADEE'], ordine: 'primaria', titolo: 'Interpello sostegno primaria: intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('pavimento del sostegno (§26.45): resta 60', PUNTEGGIO_EXTRA_SOSTEGNO, sostegno.punteggio);
check('e il jolly tace: nessuna competenza dichiarata', null, sostegno.jollySemantico);

const senzaClassi = valutaCompatibilita(
  { ordini: ['secondaria2'], classi: [], province: ['AT'], materieCustom: ['Intelligenza Artificiale'] },
  { province: 'AT', classi: [], materia: 'Intelligenza Artificiale' },
  { provinceLimitrofe: true },
);
check('profilo senza classi: il tetto del motore resta 25 e il jolly tace', PUNTEGGIO_MATCH_SECONDARIO, senzaClassi.punteggio);
check('ma la sfumatura della §26.63 resta dichiarata', 25, senzaClassi.competenzaSecondaria?.punteggio);

const whitelist = valutaCompatibilita(
  chiave,
  { province: 'MN', classi: ['A-24'], ordine: 'secondaria2', titolo: 'Corso di Intelligenza Artificiale per docenti' },
  { provinceLimitrofe: true, forzata: true },
);
check('whitelist: entra d’ufficio coi due livelli della §26.63', null, whitelist.jollySemantico);
check('e il voto resta quello del match, non il pavimento del jolly', 100, whitelist.punteggio);

/* ------------- 6) INVARIANTI: UNA SOLA MISURA, DUE DECISIONI ------------- */

console.log('\n— Invarianti: una misura (§26.63), due decisioni, nessuna rilettura —');
const jolly = leggi('src/lib/jollySemantico.ts');
check('il jolly riusa la rilevazione: nessuna rilettura del testo', true,
  /punteggioCompetenze\(/.test(jolly) && !/areeDi\(|areeInComune\(|ponteTraAree\(|tokenCompetenza\(|paroleNelTitolo\(/.test(jolly));
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
check('bacheca: il match PIENO È una conferma di pertinenza', true, /jollyPieno = valutazione\.jollySemantico !== null/.test(bacheca));
check('bacheca: apre il jolly, non la sfumatura', true, /classeVicina\(profilo, avviso\) \|\| jollyPieno/.test(bacheca));
check('bacheca: la competenza riconosciuta viaggia sulla riga', true, /jollySemantico: valutazione\.jollySemantico/.test(bacheca));
check('tipo: `Interpello.jollySemantico` dichiarato', true, /jollySemantico\?: string \| null/.test(leggi('src/data/interpelli.ts')));
const vista = (f: string): boolean => /ETICHETTA_JOLLY_SEMANTICO/.test(leggi(f)) && /descrizioneJollySemantico\(jollySemantico, banda\.punteggio\)/.test(leggi(f));
check('card e modale: etichetta + tooltip del jolly', true, vista('src/components/InterpelloCard.tsx') && vista('src/components/InterpelloDettaglioModal.tsx'));
check('la consegna resta STRICT: il jolly non entra in email e Telegram', true, ['src/lib/notifier.ts', 'src/lib/digest.ts'].every((f) => !/jollySemantico/.test(leggi(f))));
check('documentazione allineata (§26.64)', true, ['docs/SYSTEM_HANDOVER.md', 'docs/DEPARTMENT_MAP.md', 'comunicazione/04_canali_regionali/checklist_regionali.md'].every((f) => /26\.64/.test(leggi(f))));

/* ------------------- 7) LA GUARDIA È NELLA CATENA ------------------------ */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:jolly' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-jolly-semantico.ts'));

console.log(errori === 0 ? '\n✅ JOLLY SEMANTICO: il match pieno apre e pavimenta, il parziale sfuma, l’assenza non toglie nulla.' : `\n❌ JOLLY SEMANTICO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;


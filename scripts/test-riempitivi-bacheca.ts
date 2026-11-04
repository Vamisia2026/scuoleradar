/**
 * TEST — CAP DINAMICO DEI RIEMPITIVI e cablaggio di bacheca.
 * --------------------------------------------------------------------------
 * Verifica il requisito di prodotto «niente avvisi di basso valore in coda»:
 *
 *   1. CAP — al massimo `MAX_RIEMPITIVI_BACHECA` (5) opportunità sotto il 70%;
 *      se la bacheca ha già `MINIMO_MATCH_QUALITA` (10) match di qualità, i
 *      riempitivi vengono nascosti del tutto;
 *   1-bis. ESCLUSIONE SECCA (§26.60) — un riempitivo NON pertinente (sotto il 70%
 *      e senza conferma per classe/competenza del Radar) NON entra in bacheca:
 *      `riempitivoNonPertinente` lo dichiara a monte del cap, e le scuole
 *      preferite restano comunque;
 *   2. INVARIANTI — il cap non tocca l'ordine, non classifica i punteggi assenti
 *      e non tocca le opportunità di qualità;
 *   3. CABLAGGIO — dalla direttiva del 04/11/2026 (§26.144) la bacheca NON usa più il cap
 *      né il paracadute: la cascata generosa fa entrare d'ufficio tutto ciò che è nel
 *      perimetro, quindi non c'è una coda di «riempitivi» da dosare. Le due utilità restano
 *      pure e verificate qui; il feed cerca anche le province limitrofe, card e modale
 *      dichiarano lo scostamento, e la CONSEGNA (notifier/digest) NON passa `provinceLimitrofe`.
 *
 * Esecuzione: npm run test:riempitivi (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MAX_RIEMPITIVI_BACHECA,
  MINIMO_BACHECA,
  MINIMO_MATCH_QUALITA,
  limitaRiempitivi,
  paracaduteCinque,
  riempitivoNonPertinente,
} from '../src/lib/riempitivi.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* ------------------- 1) CAP DINAMICO DEI RIEMPITIVI (< 70%) ---------------- */

console.log('— Cap dei riempitivi: max 5 sotto il 70%, nessuno con 10 match di qualità —');
check('massimo riempitivi in bacheca = 5', 5, MAX_RIEMPITIVI_BACHECA);
check('soglia di qualità = 10 match', 10, MINIMO_MATCH_QUALITA);
const voce = (id: string, compatibilita?: number) => ({ id, compatibilita });
const alti = (n: number) => Array.from({ length: n }, (_, i) => voce(`alto-${i}`, 90));
const bassi = (n: number) => Array.from({ length: n }, (_, i) => voce(`basso-${i}`, 60 + i));

const sottoTetto = limitaRiempitivi([...alti(3), ...bassi(8)]);
check('3 qualità + 8 riempitivi → restano 8 voci (3 + 5)', 8, sottoTetto.lista.length);
check('3 riempitivi nascosti', 3, sottoTetto.riempitiviNascosti);
check('motivo: sotto il tetto', 'sotto-tetto', sottoTetto.motivo);
check('i tenuti sono i MIGLIORI (il 60 sparisce)', false, sottoTetto.lista.some((v) => v.id === 'basso-0'));
check('ordine della bacheca conservato', 'alto-0', sottoTetto.lista[0].id);

const tettoRaggiunto = limitaRiempitivi([...alti(10), ...bassi(2)]);
check('10 match di qualità → NESSUN riempitivo in bacheca', 10, tettoRaggiunto.lista.length);
check('2 riempitivi nascosti', 2, tettoRaggiunto.riempitiviNascosti);
check('motivo: tetto raggiunto', 'tetto-raggiunto', tettoRaggiunto.motivo);

const nessunTaglio = limitaRiempitivi([...alti(4), ...bassi(4)]);
check('pochi riempitivi → bacheca intatta', 8, nessunTaglio.lista.length);
check('motivo: nessuno', 'nessuno', nessunTaglio.motivo);

const sogliaEsatta = limitaRiempitivi([...alti(9), voce('soglia', 70), ...bassi(3)]);
check('il 70% è qualità, non riempitivo', 10, sogliaEsatta.lista.length);
check('motivo: tetto raggiunto', 'tetto-raggiunto', sogliaEsatta.motivo);

const neutro = limitaRiempitivi([voce('senza-punteggio')]);
check('punteggio assente = neutro (mai classificato a caso)', 1, neutro.lista.length);
check('e non fa scattare limiti', 'nessuno', neutro.motivo);
check('lista vuota → nessun limite', 0, limitaRiempitivi([]).lista.length);

/* ------- 1-bis) ESCLUSIONE SECCA DEI RIEMPITIVI NON PERTINENTI (§26.60) ------ */

console.log('\n— Esclusione secca dei riempitivi NON pertinenti (§26.60) —');
const striscio = { compatibilita: 55 };
check(
  'sotto il 70% e senza pertinenza del Radar → la voce NON entra',
  true,
  riempitivoNonPertinente(striscio, { pertinente: false }),
);
check(
  'stessa voce, ma confermata da classe o parola chiave → resta (cap, non esclusione)',
  false,
  riempitivoNonPertinente(striscio, { pertinente: true }),
);
check(
  'scuola preferita (whitelist, Modalità 5) → mai esclusa',
  false,
  riempitivoNonPertinente(striscio, { pertinente: false, forzata: true }),
);
check(
  'punteggio di qualità (≥ 70%) → mai escluso',
  false,
  riempitivoNonPertinente({ compatibilita: 70 }, { pertinente: false }),
);
check(
  'punteggio assente = neutro → mai escluso (nessuna classificazione a caso)',
  false,
  riempitivoNonPertinente({}, { pertinente: false }),
);
check(
  'soglia dichiarabile (80%): 75 è un riempitivo non pertinente',
  true,
  riempitivoNonPertinente({ compatibilita: 75 }, { pertinente: false, soglia: 80 }),
);
check(
  'il riempitivo PERTINENTE resta soggetto al cap dinamico (5 visibili su 8)',
  5,
  limitaRiempitivi(bassi(8)).riempitiviVisibili,
);

/* --------------------- 2) VOCI PROTETTE (SCUOLE PREFERITE) ---------------- */

console.log('\n— Le voci protette non sono riempitivi (Modalità 5: whitelist) —');
const protette = limitaRiempitivi(
  [...alti(3), ...bassi(8).map((v) => ({ ...v, preferita: true }))],
  { proteggi: (v) => v.preferita === true },
);
check('scuole preferite sotto soglia: nessuna nascosta', 11, protette.lista.length);
check('motivo: nessuno (non sono riempitivi)', 'nessuno', protette.motivo);
const miste = limitaRiempitivi(
  [...alti(3), ...bassi(8), { id: 'preferita-1', compatibilita: 50, preferita: true }],
  { proteggi: (v) => v.preferita === true },
);
check('protette sempre in bacheca, il cap taglia solo i riempitivi', 9, miste.lista.length);
check('la preferita è sopravvissuta al taglio', true, miste.lista.some((v) => v.id === 'preferita-1'));

/* --------------- 3) PARACADUTE «5 OSSO-DA-MORDERE» (§26.106) ---------------- */

console.log('\n— Paracadute: la vetrina non scende sotto 5 risultati —');
check('minimo di prodotto = 5', 5, MINIMO_BACHECA);
const bachecaCorta = [voce('forte', 90), voce('media', 72)];
const scorta = [voce('scorta-1', 40), voce('scorta-2', 55), voce('scorta-3', 48), voce('scorta-4', 30)];
const integrato = paracaduteCinque(bachecaCorta, scorta);
check('2 match + scorta → 5 risultati', 5, integrato.lista.length);
check('mancavano 3', 3, integrato.aggiunti);
check('motivo: integrato', 'integrato', integrato.motivo);
check(
  'entrano i MIGLIORI (55 · 48 · 40), il 30 resta fuori',
  ['forte', 'media', 'scorta-2', 'scorta-3', 'scorta-1'],
  integrato.lista.map((v) => v.id),
);
check('i match veri restano in testa', 'forte', integrato.lista[0].id);
check(
  'a pari punteggio decide l’ordine del database (deterministico)',
  'scorta-a',
  paracaduteCinque([], [voce('scorta-a', 40), voce('scorta-b', 40)], { minimo: 1 }).lista[0].id,
);
const pieno = paracaduteCinque(alti(5), scorta);
check('5 match: il paracadute non aggiunge nulla', 0, pieno.aggiunti);
check('motivo: sufficiente', 'sufficiente', pieno.motivo);
const esaurita = paracaduteCinque([voce('solo', 90)], [voce('unica', 40)]);
check('scorta più corta del minimo: nessuna riga inventata', 2, esaurita.lista.length);
check('motivo: scorta esaurita', 'scorta-esaurita', esaurita.motivo);

/* ------------------- 4) CABLAGGIO E INVARIANTI DI CONSEGNA ----------------- */

console.log('\n— Cablaggio: feed → bacheca pura, card/modale, consegna invariata —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
// §26.125 — l'esito (`ripieghiInBacheca`, …) e la riga di ripiego vivono in
// `bachecaRipiego` (estratto per il tetto di 250 righe del gate strutturale): il
// cablaggio resta UNO, la guardia legge i due file come un solo contratto.
const bachecaConRipiego = `${bacheca}\n${leggi('src/lib/bachecaRipiego.ts')}`;
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
check('feed: delega alla bacheca pura (filtri e punteggio)', true, /bachecaInterpelli\(/.test(feed));
check(
  'feed: cerca anche le province entro il raggio (limite rigido rimosso)',
  true,
  /provinceDiRicerca\(/.test(feed),
);
check('bacheca: nessun cap dei riempitivi (la cascata non lascia vuoti)', false, /limitaRiempitivi\(/.test(bacheca));
check(
  'bacheca: nessun paracadute da pescare (§26.144)',
  false,
  /paracaduteCinque\(/.test(bacheca),
);
check(
  'bacheca: le riserve entrano d’ufficio e sono contate',
  true,
  /voceCascata\(profilo, avviso, scala\.provincia\)/.test(bacheca) &&
    /riserveInBacheca \+= 1/.test(bacheca) &&
    /riserveInBacheca: number/.test(bachecaConRipiego),
);
check(
  'bacheca: la scorta non accoglie righe senza affinità di classe (§26.120)',
  false,
  /if \(!valutazione\.escluso\) scorta\.push/.test(bacheca),
);
check(
  'bacheca: lo scarto per affinità è dichiarato, non silenzioso',
  true,
  /senzaAffinitaClasse \+= 1/.test(bacheca),
);
check('bacheca: le scuole preferite restano protette (Modalità 5)', true, /scuole\.preferita/.test(bacheca));
// §26.144 — la DECISIONE (merito · tolleranza · riserva · incompatibile) vive nella cascata:
// la guardia legge il modulo, così il «chi entra» non è più una catena di porte nel loop.
const cascataModulo = leggi('src/lib/cascataGenerosa.ts');
check(
  'bacheca: la decisione sta nella cascata, non nel loop (§26.144)',
  true,
  /fascia === 'incompatibile'/.test(bacheca) &&
    /normalizzaClassi\(profilo\.classi\)/.test(cascataModulo) &&
    /gradoAffine\(profilo, avviso\)/.test(cascataModulo),
);
check(
  'bacheca: i conti delle fasce sono dichiarati, mai silenziosi',
  true,
  /meritoInBacheca: number/.test(bachecaConRipiego) && /meritoInBacheca \+= 1/.test(bacheca),
);
check('bacheca: province entro il raggio con penalità', true, /provinceLimitrofe: true/.test(bacheca));
const bandaConMotivo = /bandaCompatibilita\(interpello\.compatibilita, interpello\.motivoCompatibilita\)/;
check('card e modale: banda + motivo dichiarato', true, bandaConMotivo.test(card) && bandaConMotivo.test(modale));
const consegna = ['src/lib/notifier.ts', 'src/lib/digest.ts', 'scripts/invia-digest.ts'];
check(
  'CONSEGNA: nessun file di notifica passa `provinceLimitrofe`',
  true,
  consegna.every((f) => !/provinceLimitrofe/.test(leggi(f))),
);

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:riempitivi' in catena.scripts);
check(
  'guardia nella catena',
  true,
  (catena.scripts.test ?? '').includes('scripts/test-riempitivi-bacheca.ts'),
);

console.log(
  errori === 0
    ? '\n✅ RIEMPITIVI: cap dinamico (max 5 sotto il 70%, nessuno con 10 match di qualità) + esclusione secca dei NON pertinenti (§26.60).'
    : `\n❌ RIEMPITIVI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

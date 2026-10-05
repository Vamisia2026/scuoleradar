/**
 * TEST — CAP DINAMICO DEI RIEMPITIVI e cablaggio di bacheca.
 * --------------------------------------------------------------------------
 * Verifica il requisito di prodotto «niente avvisi di basso valore in coda»:
 *
 *   1. CAP — al massimo `MAX_RIEMPITIVI_BACHECA` (5) opportunità sotto il 70%;
 *      se la bacheca ha già `MINIMO_MATCH_QUALITA` (10) match di qualità, i
 *      riempitivi vengono nascosti del tutto;
 *   2. INVARIANTI — il cap non tocca l'ordine, non classifica i punteggi assenti
 *      e non tocca le opportunità di qualità;
 *   3. CABLAGGIO — il feed applica il cap e cerca anche le province limitrofe,
 *      card e modale dichiarano lo scostamento, e la CONSEGNA (notifier/digest)
 *      NON passa `provinceLimitrofe`.
 *
 * Esecuzione: npm run test:riempitivi (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MAX_RIEMPITIVI_BACHECA,
  MINIMO_MATCH_QUALITA,
  limitaRiempitivi,
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

/* ------------------- 3) CABLAGGIO E INVARIANTI DI CONSEGNA ----------------- */

console.log('\n— Cablaggio: feed → bacheca pura, card/modale, consegna invariata —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
check('feed: delega alla bacheca pura (filtri e punteggio)', true, /bachecaInterpelli\(/.test(feed));
check(
  'feed: cerca anche le province entro il raggio (limite rigido rimosso)',
  true,
  /provinceDiRicerca\(/.test(feed),
);
check('bacheca: cap dinamico dei riempitivi', true, /limitaRiempitivi\(/.test(bacheca));
check('bacheca: le scuole preferite non sono riempitivi', true, /proteggi:/.test(bacheca));
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
    ? '\n✅ RIEMPITIVI: cap dinamico (max 5 sotto il 70%, nessuno con 10 match di qualità).'
    : `\n❌ RIEMPITIVI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

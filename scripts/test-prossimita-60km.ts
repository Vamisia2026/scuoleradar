/**
 * TEST — MODALITÀ 4 «Provincia»: distanza, raggio dei 60 km, esclusione.
 * --------------------------------------------------------------------------
 * Verifica la regola di prodotto:
 *
 *   1. provincia SELEZIONATA = 100%;
 *   2. provincia entro il RAGGIO di 60 km = **grossa penalità** (75 · 60 · 45);
 *   3. oltre i 60 km = **esclusione d'ufficio** (né bacheca né punteggio);
 *   4. la CONSEGNA (email/Telegram, digest) resta STRICT: senza l'opzione della
 *      bacheca vale solo la provincia selezionata.
 *
 * Esecuzione: npm run test:prossimita (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  PENALITA_PROVINCIA_20KM,
  PENALITA_PROVINCIA_40KM,
  PENALITA_PROVINCIA_60KM,
  PUNTEGGIO_PROVINCIA_PROPRIA,
  RAGGIO_PROVINCIA_KM,
  distanzaKm,
  penalitaDistanza,
  provinciaCompatibile,
  provinceDiRicerca,
  provinceEntroRaggio,
  punteggioProvincia,
} from '../src/lib/prossimitaGeografica.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/* --------------------------- 1) DISTANZE REALI ----------------------------- */

console.log('— Distanze fra capoluoghi (Haversine) —');
check('raggio di prodotto = 60 km', 60, RAGGIO_PROVINCIA_KM);
check('Asti ↔ Alessandria ≈ 32 km', true, (distanzaKm('AT', 'AL') ?? 0) >= 28 && (distanzaKm('AT', 'AL') ?? 0) <= 36);
check('Milano ↔ Monza entro 20 km', true, (distanzaKm('MI', 'MB') ?? 999) <= 20);
check('Milano ↔ Cremona oltre il raggio', true, (distanzaKm('MI', 'CR') ?? 0) > 60);
check('Asti ↔ Cuneo oltre il raggio', true, (distanzaKm('AT', 'CN') ?? 0) > 60);
check('Roma ↔ Napoli oltre i 150 km', true, (distanzaKm('RM', 'NA') ?? 0) > 150);
check('stessa provincia = 0 km', 0, distanzaKm('AT', 'at'));
check('provincia ignota = nessun giudizio', null, distanzaKm('AT', 'ZZ'));

/* --------------------------- 2) RAGGIO E RICERCA --------------------------- */

console.log('\n— Ricerca: le proprie province + quelle entro il raggio —');
const daAsti = provinceEntroRaggio(['AT']);
check('Alessandria è dentro il raggio di Asti', true, daAsti.includes('AL'));
check('Torino è dentro il raggio di Asti', true, daAsti.includes('TO'));
check('Cuneo è FUORI dal raggio di Asti', false, daAsti.includes('CN'));
check('Milano è FUORI dal raggio di Asti', false, daAsti.includes('MI'));
check('ordine per distanza: prima la più vicina', 'AL', daAsti[0]);
check('province da cercare = proprie + entro il raggio', ['AT', 'AL', 'TO', 'VC'], provinceDiRicerca(['AT']));
check('nessuna provincia nel profilo → ricerca senza vincolo', [], provinceDiRicerca([]));

/* -------------------------- 3) PUNTEGGIO PER FASCE ------------------------- */

console.log('\n— Punteggio: 100 propria · penalità per fasce · fuori dal raggio escluso —');
check('penalità entro 20 km = 25', PENALITA_PROVINCIA_20KM, penalitaDistanza(12));
check('penalità entro 40 km = 40', PENALITA_PROVINCIA_40KM, penalitaDistanza(35));
check('penalità entro 60 km = 55', PENALITA_PROVINCIA_60KM, penalitaDistanza(58));
const propria = punteggioProvincia(['AT'], 'AT', { limitrofe: true });
check('provincia propria = 100', PUNTEGGIO_PROVINCIA_PROPRIA, propria.stato === 'propria' ? propria.punteggio : null);
const vicina = punteggioProvincia(['AT'], 'AL', { limitrofe: true });
check('Alessandria per chi cerca Asti = vicina (60 km pen.)', 'vicina', vicina.stato);
check('con la penalità della fascia 20-40 km', PUNTEGGIO_PROVINCIA_PROPRIA - PENALITA_PROVINCIA_40KM, vicina.stato === 'vicina' ? vicina.punteggio : null);
check('il motivo dichiara distanza e verso', true, /AT → AL/.test(vicina.stato === 'vicina' ? vicina.motivo : ''));
const oltre = punteggioProvincia(['AT'], 'MN', { limitrofe: true });
check('Mantova (oltre il raggio) = FUORI', 'fuori', oltre.stato);
check('e il motivo dichiara il raggio', true, /oltre il raggio di 60 km/.test(oltre.stato === 'fuori' ? oltre.motivo : ''));
check('profilo senza province = modale non applicabile', 'non-applicabile', punteggioProvincia([], 'AT').stato);

console.log('\n— Consegna STRICT: senza l’opzione vale solo la provincia selezionata —');
check('stessa provincia ammessa', true, provinciaCompatibile(['AT'], 'AT', { limitrofe: true }));
check('vicina ammessa SOLO con `limitrofe`', false, provinciaCompatibile(['AT'], 'AL'));
check('e ammessa con `limitrofe`', true, provinciaCompatibile(['AT'], 'AL', { limitrofe: true }));
check('oltre il raggio: mai', false, provinciaCompatibile(['AT'], 'MN', { limitrofe: true }));
check('senza province nel profilo: nessun vincolo', true, provinciaCompatibile([], 'MN'));

/* ------------------------ 4) LA GUARDIA È NELLA CATENA -------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>;
};
check('script dedicato', true, 'test:prossimita' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-prossimita-60km.ts'));

console.log(
  errori === 0
    ? '\n✅ PROSSIMITÀ: 100 in provincia, penalità entro 60 km, esclusione oltre.'
    : `\n❌ PROSSIMITÀ: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * Integrità dell'Archivio Modulistica dopo la riorganizzazione "matrioska"
 * degli ordini di scuola (Macroarea → Tema → Sottocategoria → Moduli).
 *
 * Verifica:
 *  1. le 9 macroaree sono presenti con l'ordine previsto;
 *  2. i 4 ordini di scuola hanno struttura a 3 livelli COERENTE
 *     (ogni nodo ha SOLO sottocartelle oppure SOLO documenti);
 *  3. tutti gli `id` dei documenti sono univoci e i conteggi per ordine sono
 *     quelli attesi (158 moduli totali);
 *  4. BACKWARD COMPATIBILITY: gli id storici salvati in localStorage
 *     (cache/"Modelli scaricati") sono ancora risolvibili.
 *
 * Uso: npm run test:moduli
 */
import {
  macroAreeModulistica,
  ordineMacroAree,
  trovaDocumentoModulisticaById,
  type SottoCategoriaModulistica,
} from '../src/data/moduli.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

function contaDoc(n: SottoCategoriaModulistica): number {
  return (n.documenti?.length ?? 0) + (n.sotto ?? []).reduce((a, c) => a + contaDoc(c), 0);
}

/** True se OGNI nodo ha solo figli o solo documenti (mai entrambi). */
function strutturaConsistente(nodi: SottoCategoriaModulistica[]): boolean {
  return nodi.every((n) => {
    const figli = n.sotto ?? [];
    const docs = n.documenti ?? [];
    if (figli.length > 0 && docs.length > 0) return false;
    if (figli.length > 0 && n.sotto) return strutturaConsistente(figli);
    return true;
  });
}

console.log('— Macroaree presenti e ordine —');
const nomiPresenti = macroAreeModulistica.map((m) => m.nome);
// L'ordine del MENU è dato da `ordineMacroAree`; l'array raw tiene Sostegno per primo.
check('insieme = ordineMacroAree', [...ordineMacroAree].sort(), [...nomiPresenti].sort());
check('Sostegno per prima nell\'array raw', 'Sostegno', macroAreeModulistica[0]?.nome);
check('9 macroaree', 9, macroAreeModulistica.length);

console.log('\n— Struttura a 3 livelli coerente per i 4 ordini —');
const attesi: Record<string, number> = {
  infanzia: 38,
  primaria: 43,
  secondaria1: 38,
  secondaria2: 39,
};
for (const id of Object.keys(attesi)) {
  const area = macroAreeModulistica.find((m) => m.id === id);
  if (!area) {
    errori += 1;
    console.log(`✗ macroarea ${id} mancante`);
    continue;
  }
  check(`${id}: moduli`, attesi[id], area.sotto.reduce((a, t) => a + contaDoc(t), 0));
  check(`${id}: struttura coerente`, true, strutturaConsistente(area.sotto));
  const temi = area.sotto.length;
  check(`${id}: temi > 1`, true, temi > 1);
  // Ogni tema deve avere almeno una sottocategoria.
  check(
    `${id}: temi tutti valorizzati`,
    true,
    area.sotto.every((t) => (t.sotto?.length ?? 0) > 0),
  );
}

console.log('\n— Univocità e backward compatibility degli id —');
const ids: string[] = [];
const raccogli = (nodi: SottoCategoriaModulistica[]) => {
  for (const n of nodi) {
    for (const d of n.documenti ?? []) ids.push(d.id);
    raccogli(n.sotto ?? []);
  }
};
for (const area of macroAreeModulistica) raccogli(area.sotto);
check('id documenti univoci (nessun duplicato)', ids.length, new Set(ids).size);
check('totale documenti archivio > 150', true, ids.length > 150);

// Id DOCUMENTO storici (pre-refactor) che DEVONO restare risolvibili: la cache
// localStorage e lo storico "Modelli scaricati" salvano l'id del DOCUMENTO.
const legacy = [
  'iscrizione-infanzia',
  'richiesta-mensa-dieta',
  'richiesta-trasporto-infanzia',
  'sostegno-primaria',
  'mad-primaria',
  'autorizzazione-pcto',
  'supplenza-superiori',
  'convocazione-assemblea-studenti',
  'cambio-sezione-superiori',
  'adesione-scambio-estero',
];
// Ogni id presente nell'archivio deve essere risolvibile (nessun id orfano).
const orfani = ids.filter((id) => trovaDocumentoModulisticaById(id) === null);
check('nessun id orfano', [], orfani);
for (const id of legacy) {
  check(`resolve ${id}`, true, trovaDocumentoModulisticaById(id) !== null);
}

console.log(errori === 0 ? '\n✅ MODULI INTEGRITY: nessun problema' : `\n❌ MODULI INTEGRITY: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * TEST — ROBUSTEZZA DEL LEDGER SU FILE (anti-duplicato).
 * -----------------------------------------------------------------
 * Un ledger ILLEGGIBILE disattiva IN SILENZIO la protezione anti-duplicato.
 * È già successo davvero: il file era stato salvato con il BOM UTF-8 → `JSON.parse`
 * in errore → 0 chiavi caricate → 97 avvisi GIÀ consegnati sono tornati "da inviare".
 *
 * Qui si verifica che:
 *   · un ledger con BOM venga letto CORRETTAMENTE (tolleranza);
 *   · il salvataggio NON introduca il BOM (leggibile da qualunque consumatore);
 *   · le chiavi restino integre dopo un salvataggio (nessuna perdita).
 *
 * Esecuzione: npm run test:ledger
 */

import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ledgerLocale,
  ledgerLocaleGia,
  ledgerLocaleRegistra,
  ledgerLocaleSalva,
  unioneChiavi,
  unisciFileLedger,
} from '../src/lib/ledgerLocale.ts';

declare const process: { exitCode?: number; env: Record<string, string | undefined>; pid: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// Ledger ISOLATO (mai quello reale del workspace).
const percorso = join(tmpdir(), `scuoleradar-ledger-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorso;

const CHIAVE_1 = 'utente|aaa:bbb|notifica';
const CHIAVE_2 = 'utente|ccc:ddd|telegram';
const CHIAVE_NUOVA = 'utente|eee:fff|email';

// File salvato CON BOM (come lo scrisse l'incidente).
writeFileSync(percorso, `\uFEFF${JSON.stringify({ chiavi: [CHIAVE_1, CHIAVE_2] })}`, 'utf8');

console.log('— Lettura di un ledger con BOM UTF-8 —');
check('file davvero con BOM', true, readFileSync(percorso, 'utf8').charCodeAt(0) === 0xfeff);
check('chiavi caricate (non 0!)', 2, ledgerLocale().size);
check('chiave 1 trovata', true, ledgerLocaleGia(CHIAVE_1));
check('chiave 2 trovata', true, ledgerLocaleGia(CHIAVE_2));
check('chiave assente → false', false, ledgerLocaleGia('utente|zzz:zzz|email'));

console.log('\n— Salvataggio senza BOM (leggibile da chiunque) —');
ledgerLocaleRegistra(CHIAVE_NUOVA);
ledgerLocaleSalva();
const grezzo = readFileSync(percorso, 'utf8');
check('nessun BOM nel file salvato', false, grezzo.charCodeAt(0) === 0xfeff);
check('JSON valido senza rimozioni', true, Array.isArray(JSON.parse(grezzo).chiavi));
check('chiavi conservate dopo il salvataggio', 3, JSON.parse(grezzo).chiavi.length);
check('nuova chiave presente', true, JSON.parse(grezzo).chiavi.includes(CHIAVE_NUOVA));

console.log('\n— Nessuna chiave persa: merge con il file PRIMA di scrivere —');
/**
 * Scraper e digest girano negli stessi minuti e scrivono lo STESSO ledger: se un
 * processo salva la sola cache in memoria, le chiavi registrate dall'altro run
 * (dopo la lettura iniziale) vengono CANCELLATE → le stesse notifiche ripartono
 * nei giorni successivi. Qui si simula l'altro processo che scrive sul file.
 */
const CHIAVE_ALTRO_RUN = 'utente|altro-run:hash|telegram';
const contenutoAttuale = JSON.parse(readFileSync(percorso, 'utf8')) as { chiavi: string[] };
writeFileSync(
  percorso,
  `${JSON.stringify({ chiavi: [...contenutoAttuale.chiavi, CHIAVE_ALTRO_RUN] })}`,
  'utf8',
);
const CHIAVE_QUARTA = 'utente|ggg:hhh|email';
ledgerLocaleRegistra(CHIAVE_QUARTA);
ledgerLocaleSalva();
const dopoSave = JSON.parse(readFileSync(percorso, 'utf8')) as { chiavi: string[] };
check('chiave del processo CONCORRENTE conservata', true, dopoSave.chiavi.includes(CHIAVE_ALTRO_RUN));
check('chiave di questo processo salvata', true, dopoSave.chiavi.includes(CHIAVE_QUARTA));
check('chiavi storiche intatte', true, dopoSave.chiavi.includes(CHIAVE_1) && dopoSave.chiavi.includes(CHIAVE_2));
check('nessun duplicato nel file', dopoSave.chiavi.length, new Set(dopoSave.chiavi).size);

console.log('\n— Merge dei ledger fra run (script del workflow) —');
const fileRun = join(tmpdir(), `scuoleradar-ledger-run-${process.pid}.json`);
const fileRemoto = join(tmpdir(), `scuoleradar-ledger-remoto-${process.pid}.json`);
writeFileSync(fileRun, JSON.stringify({ chiavi: ['utente|run:1|telegram', CHIAVE_1] }), 'utf8');
writeFileSync(fileRemoto, JSON.stringify({ chiavi: ['utente|remoto:1|email', CHIAVE_1] }), 'utf8');
const totaleUnito = unisciFileLedger(fileRun, fileRemoto);
const unito = JSON.parse(readFileSync(percorso, 'utf8')) as { chiavi: string[] };
// 3 chiavi distinte: run:1, remoto:1 e la CHIAVE_1 condivisa dai due file (una sola volta).
check('unione = tutte le chiavi distinte', 3, totaleUnito);
check('chiave del run presente', true, unito.chiavi.includes('utente|run:1|telegram'));
check('chiave remota presente', true, unito.chiavi.includes('utente|remoto:1|email'));
check(
  'unioneChiavi: nessun duplicato e ordine preservato',
  ['a', 'b', 'c'],
  unioneChiavi(['a', 'b'], ['b', 'c']),
);
check('unisciFileLedger: file mancanti → nessun crash', 0, unisciFileLedger('inesistente-a.json', 'inesistente-b.json'));

rmSync(fileRun, { force: true });
rmSync(fileRemoto, { force: true });
rmSync(percorso, { force: true });
if (existsSync(percorso)) rmSync(percorso, { force: true });
console.log(errori === 0 ? '\n✅ LEDGER: nessun problema' : `\n❌ LEDGER: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

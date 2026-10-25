/**
 * ScuoleRadar.it — TEST della sanificazione di `interpelli` (§26.83).
 *
 * Verifica due cose, senza toccare il database:
 *   1. la REGOLA (pura) di `scripts/lib/sanificaInterpelli.ts`: finestra di 15
 *      giorni con lo stesso verdetto di `eOpportunitaConScadenza` e segnaposto
 *      del nome riconosciuti in qualunque grafia;
 *   2. che la MIGRAZIONE porti la stessa regola in SQL — se il file cambia e la
 *      regola no (o viceversa), questo test lo dice.
 *
 * Esecuzione: `npm run test:sanifica` (dentro `npm test`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import {
  COLONNA_FINESTRA,
  MIGRAZIONE,
  costruisciPiano,
  descriviPiano,
  eNomeSegnaposto,
  motivoFuoriFinestra,
  type RigaSanificazione,
} from './lib/sanificaInterpelli.ts';

let falliti = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(
      `  ✗ ${descrizione}\n      atteso: ${JSON.stringify(atteso)}\n      ottenuto: ${JSON.stringify(ottenuto)}`,
    );
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

/** OGGI fisso (domenica 25/10/2026): nessun test dipende dal giorno in cui gira. */
const OGGI = new Date('2026-10-25T12:00:00');

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST SANIFICAZIONE — finestra di 15 giorni + segnaposto del nome');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— motivoFuoriFinestra (la finestra è quella di eOpportunitaConScadenza) —');
check('scade oggi → in finestra', null, motivoFuoriFinestra('2026-10-25', OGGI));
check('fra 1 giorno → in finestra', null, motivoFuoriFinestra('2026-10-26', OGGI));
check('fra 14 giorni → in finestra', null, motivoFuoriFinestra('2026-11-08', OGGI));
check('fra 15 giorni (ultimo utile) → in finestra', null, motivoFuoriFinestra('2026-11-09', OGGI));
check('fra 16 giorni → oltre orizzonte', 'oltre-orizzonte', motivoFuoriFinestra('2026-11-10', OGGI));
check('fine incarico a giugno → oltre orizzonte', 'oltre-orizzonte', motivoFuoriFinestra('2027-06-30', OGGI));
check('ieri → scaduta', 'scaduta', motivoFuoriFinestra('2026-10-24', OGGI));
check('assente → senza data', 'senza-data', motivoFuoriFinestra(null, OGGI));
check('stringa vuota → senza data', 'senza-data', motivoFuoriFinestra('   ', OGGI));
check('illeggibile → non valida', 'non-valida', motivoFuoriFinestra('non-una-data', OGGI));
check('ISO con orario dentro la finestra → in finestra', null, motivoFuoriFinestra('2026-11-02T23:00:00+00:00', OGGI));

console.log('\n— eNomeSegnaposto (residuo del vecchio fallback, non una denominazione) —');
check('«SCUOLA NON SPECIFICATA»', true, eNomeSegnaposto('SCUOLA NON SPECIFICATA'));
check('«Scuola non specificata / Più plessi»', true, eNomeSegnaposto('Scuola non specificata / Più plessi'));
check('«Scuola non specificata - Piu plessi»', true, eNomeSegnaposto('Scuola non specificata - Piu plessi'));
check("«PIU' PLESSI» (apostrofo)", true, eNomeSegnaposto("PIU' PLESSI"));
// La direttiva nomina i DUE residui del vecchio fallback («SCUOLA NON SPECIFICATA»,
// «PIÙ PLESSI»): la variante «Istituto non specificato» non è fra questi e il
// gate pubblico la rifiuta comunque al momento di mostrare il nome
// (`lib/nomeIstituto.eSegnaposto`).
check('«Istituto non specificato» non è fra i residui da azzerare', false, eNomeSegnaposto('Istituto non specificato'));
check('nome VERO con «plessi» ma senza segnaposto', false, eNomeSegnaposto('I.C. Arzachena plesso Abbiadori'));
check('nome vero', false, eNomeSegnaposto('I.C. CUNEO CORSO SOLERI'));
check('vuoto / nullo', false, eNomeSegnaposto('   ') || eNomeSegnaposto(null));

console.log('\n— costruisciPiano: separazione e conteggi —');
const righe: RigaSanificazione[] = [
  { id: '1', school_name: 'I.C. Arzachena', expiration_date: '2026-10-30' },
  { id: '2', school_name: 'SCUOLA NON SPECIFICATA / PIÙ PLESSI', expiration_date: '2026-11-09' },
  { id: '3', school_name: null, expiration_date: '2026-11-20' },
  { id: '4', school_name: 'Liceo Monti', expiration_date: '2026-10-01' },
  { id: '5', school_name: null, expiration_date: null },
  { id: '6', school_name: 'Piu plessi', expiration_date: 'non-una-data' },
];
const piano = costruisciPiano(righe, OGGI);
check('dentro la finestra: 2 righe', 2, piano.inFinestra.length);
check('fuori finestra: 4 righe', 4, piano.fuoriFinestra.length);
check(
  'motivi distinti (oltre orizzonte 1, scaduta 1, senza data 1, non valida 1)',
  { 'senza-data': 1, 'non-valida': 1, scaduta: 1, 'oltre-orizzonte': 1 },
  piano.motivi,
);
check('segnaposto da azzerare: 2 righe (2 e 6)', ['2', '6'], piano.nomiDaAzzerare.map((r) => r.id));
check(
  'la misura stampata è completa e coerente',
  'righe: 6 · dentro la finestra: 2 · fuori finestra: 4 (senza data 1, non valide 1, scadute 1, oltre 15 giorni 1) · nomi con segnaposto: 2',
  descriviPiano(piano, righe.length),
);
check('elenco vuoto → nessun gruppo', 0, costruisciPiano([], OGGI).fuoriFinestra.length);

console.log('\n— la MIGRAZIONE porta la stessa regola —');
const sql = readFileSync(join(process.cwd(), MIGRAZIONE), 'utf8');
check('la migrazione esiste', true, sql.length > 0);
check('dichiara il marcatore atteso dallo script', true, sql.includes(`add column if not exists ${COLONNA_FINESTRA}`));
check('orizzonte in giorni = 15, in un solo posto', true, /select\s+15\s*;/i.test(sql));
check(
  'la RPC del feed usa la finestra (nessun ramo «senza scadenza»)',
  true,
  sql.includes('public.in_finestra_opportunita(i.expiration_date)') &&
    !/expiration_date\s+is\s+null\s+and\s+i\.created_at/i.test(sql),
);
check(
  'la pulizia del segnaposto è la stessa espressione dello script',
  true,
  sql.includes("scuola\\s+non\\s+specificat[oa]|pi[uù]\\s*[''’]?\\s*plessi"),
);

console.log('\n──────────────────────────────────────────────────────────');
if (falliti > 0) {
  console.log(`❌ ${falliti} verifiche fallite`);
  process.exitCode = 1;
} else {
  console.log('✅ Sanificazione: regola e migrazione allineate');
}

/**
 * Dipartimento Admin + Radar — GUARDIA della scheda utente.
 *
 * La card utente del pannello Admin deve rispecchiare la vista utente:
 *   · gli ORDINI di scuola scelti (nomi leggibili, non id opachi);
 *   · le MATERIE/COMPETENZE extra (catalogo `materie_id`, risolte nel nome);
 *   · i TAG personalizzati (`materie_custom`, il testo scritto dall'utente).
 *
 * Lo schema di salvataggio del Radar (`profiles`) scrive già le tre colonne:
 * la guardia verifica che il payload le contenga e che la scheda le mostri,
 * così la corrispondenza vista utente ↔ vista admin non può regredire.
 *
 * Uso: npm run test:admin:utente (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { etichetteCompetenzeProfilo } from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

const tipi = leggi('src/departments/admin/types.ts');
const dettaglio = leggi('src/departments/admin/tabs/utenti/DettaglioUtente.tsx');
const anagrafica = leggi('src/contexts/app/useAnagraficaProfilo.ts');

console.log('— Schema di salvataggio del Radar (`profiles`) —');
check('save: `ordini_scuola` nel payload', true, /ordini_scuola: dati\.ordini/.test(anagrafica));
check('save: `materie_id` nel payload', true, /materie_id: dati\.materieId/.test(anagrafica));
check('save: `materie_custom` nel payload', true, /materie_custom: dati\.materieCustom/.test(anagrafica));

console.log('\n— Scheda utente Admin: ordini + competenze extra/tag —');
check('tipi: `ordini_scuola` dichiarato', true, /ordini_scuola\??:\s*string\[\]/.test(tipi));
check('tipi: `materie_id` dichiarato', true, /materie_id\??:\s*string\[\]/.test(tipi));
check('tipi: `materie_custom` dichiarato', true, /materie_custom\??:\s*string\[\]/.test(tipi));
check('scheda: mostra gli Ordini di scuola', true, /Ordini scuola/.test(dettaglio));
check('scheda: risolve i nomi degli ordini (`ordiniScuola`)', true, /ordiniScuola/.test(dettaglio));
check('scheda: mostra le materie/competenze extra', true, /Materie e competenze extra/.test(dettaglio));
check('scheda: risolve i nomi del catalogo (`etichetteCompetenzeProfilo`)', true, /etichetteCompetenzeProfilo/.test(dettaglio));
check(
  'scheda: mostra i TAG personalizzati (`materie_custom`)',
  true,
  /Tag personalizzati/.test(dettaglio) && /materie_custom/.test(dettaglio),
);

console.log('\n— Risoluzione dei nomi (logica pura: vista utente ≡ vista admin) —');
check(
  'competenza di catalogo → nome della materia',
  ['Lingua inglese'],
  etichetteCompetenzeProfilo({ materieId: ['inglese'], materieCustom: [] }),
);
check(
  'tag personalizzati → testo scritto dall’utente',
  ['Intelligenza artificiale nella didattica'],
  etichetteCompetenzeProfilo({ materieId: [], materieCustom: ['Intelligenza artificiale nella didattica'] }),
);
check(
  'catalogo + tag insieme, nell’ordine del profilo',
  ['Lingua inglese', 'Teatro'],
  etichetteCompetenzeProfilo({ materieId: ['inglese'], materieCustom: ['Teatro'] }),
);

console.log(errori === 0 ? '\n✅ ADMIN · SCHEDA UTENTE: nessun problema' : `\n❌ ADMIN · SCHEDA UTENTE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

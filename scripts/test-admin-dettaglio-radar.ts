/**
 * Dipartimento Admin + Radar — GUARDIA delle viste utente Admin.
 *
 * Scheda di dettaglio (tab «Utenti») e card utente (tab «Radar») devono
 * rispecchiare la vista utente e non avere buchi: gli ORDINI di scuola scelti
 * (nomi leggibili, non id opachi), le CLASSI di concorso, le MATERIE/COMPETENZE
 * extra (catalogo `materie_id`, risolte nel nome), i TAG personalizzati
 * (`materie_custom`), le province e le scuole preferite/escluse.
 *
 * Le due superfici montano lo STESSO blocco condiviso
 * (`components/PreferenzeUtente.tsx`, con la derivazione pura in
 * `components/preferenzeUtente.ts`): la guardia verifica che il blocco esista,
 * che entrambe lo usino e che mostri tutti i parametri.
 *
 * Lo schema di salvataggio del Radar (`profiles`) scrive già le colonne: la
 * guardia verifica che il payload le contenga, così la corrispondenza
 * vista utente ↔ vista admin non può regredire.
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
const tabRadar = leggi('src/departments/admin/tabs/TabRadar.tsx');
const blocco = leggi('src/departments/admin/components/PreferenzeUtente.tsx');
const pure = leggi('src/departments/admin/components/derivaPreferenzeUtente.ts');
const anagrafica = leggi('src/contexts/app/useAnagraficaProfilo.ts');

console.log('— Schema di salvataggio del Radar (`profiles`) —');
check('save: `ordini_scuola` nel payload', true, /ordini_scuola: dati\.ordini/.test(anagrafica));
check('save: `materie_id` nel payload', true, /materie_id: dati\.materieId/.test(anagrafica));
check('save: `materie_custom` nel payload', true, /materie_custom: dati\.materieCustom/.test(anagrafica));

console.log('\n— Preferenze Radar: blocco CONDIVISO tra scheda e card utente —');
check('tipi: `ordini_scuola` dichiarato', true, /ordini_scuola\??:\s*string\[\]/.test(tipi));
check('tipi: `materie_id` dichiarato', true, /materie_id\??:\s*string\[\]/.test(tipi));
check('tipi: `materie_custom` dichiarato', true, /materie_custom\??:\s*string\[\]/.test(tipi));
check('blocco condiviso: esiste', true, /export function PreferenzeUtente/.test(blocco));
check('scheda di dettaglio: monta il blocco', true, /<PreferenzeUtente\b/.test(dettaglio));
check('card del tab «Radar»: monta lo STESSO blocco', true, /<PreferenzeUtente\b/.test(tabRadar));
check('card: variante compatta', true, /variante="compatto"/.test(tabRadar));
check('blocco: mostra gli Ordini di scuola', true, /Ordini di scuola/.test(blocco));
check('blocco: mostra le Classi di concorso', true, /Classi di concorso/.test(blocco));
check('blocco: mostra le Materie e competenze extra', true, /Materie e competenze extra/.test(blocco));
check('blocco: mostra i TAG personalizzati (`materie_custom`)', true, /Tag personalizzati/.test(blocco));
check(
  'blocco: mostra province e scuole (nessun buco)',
  true,
  /Province/.test(blocco) && /Scuole preferite/.test(blocco) && /Scuole escluse/.test(blocco),
);
check('derivazione: ordini risolti nel nome (`ordiniScuola`)', true, /ordiniScuola/.test(pure));
check(
  'derivazione: competenze di catalogo risolte nel nome (`etichetteCompetenzeProfilo`)',
  true,
  /etichetteCompetenzeProfilo/.test(pure),
);
check('derivazione: i tag restano il testo dell’utente (`materie_custom`)', true, /tag: u\.materie_custom/.test(pure));

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

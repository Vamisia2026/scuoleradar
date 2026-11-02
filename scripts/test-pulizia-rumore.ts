/**
 * Test — PULIZIA DEI TITOLI DI RUMORE in `interpelli` (`scripts/pulisci-rumore.ts`, §26.130).
 *
 * Perché esiste. Dopo che l'ingestione ha imparato a giudicare il TITOLO di una voce
 * (`titoloVoceERumore` in `table-reporter.ts`), la tabella può ancora contenere righe
 * scritte prima: lo script di pulizia le rimuove. La guardia fissa che la regola sia UNA
 * (nessuna copia locale), che il caso vero di Catania cada, che un interpello vero resti,
 * e che il piano sospetto si fermi prima di cancellare.
 *
 * Uso: npm run test:pulizia-rumore  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Il giudizio dello script: il titolo fa da corpo (prima del fetch non c'è altro). */
function rumore(titolo: string): boolean {
  return isAdministrativeNoise(titolo, titolo).isNoise;
}

/* ---------------- 1) IL CASO VERO ---------------- */

console.log('— 1. Il titolo che aveva riempito la bacheca di Catania —');
const CT = 'Sciopero 30 ottobre 2026 – promemoria';
check('la voce di CT è rumore', true, rumore(CT));
check('il motivo è dichiarato', 'sciopero', isAdministrativeNoise(CT, CT).reason);
check('la scadenza inventata non salva la riga', true, rumore(`${CT} – scadenza 07/12/2026`));

/* ---------------- 2) ALTRO RUMORE CHE RESTA IN TABELLA ---------------- */

console.log('\n— 2. Atti amministrativi e vita scolastica —');
check('assemblea sindacale', true, rumore('Assemblea sindacale 5 novembre 2026'));
check('circolare per le famiglie', true, rumore('Circolare n. 44 – colloqui con le famiglie'));
check("viaggio d'istruzione", true, rumore("Viaggio di istruzione a Napoli – programma"));
check('determina', true, rumore('Determina a contrarre per la fornitura di carta'));
check('prospetto di liquidazione', true, rumore('Prospetto di liquidazione competenze agosto'));

/* ---------------- 3) LE OPPORTUNITÀ VERE NON SI TOCCANO ---------------- */

console.log('\n— 3. Opportunità: nessuna cancellazione —');
check('interpello di classe', false, rumore('Interpello A022 – Scienze naturali'));
check(
  'disponibilità per supplenza',
  false,
  rumore('Avviso di disponibilità per supplenza classe di concorso A012'),
);
check(
  'incarico di esperto PNRR',
  false,
  rumore('Avviso di selezione per il conferimento di incarichi di esperto PNRR'),
);
check('profilo ATA', false, rumore('Bando per collaboratore scolastico a tempo determinato'));
check('titolo senza segnali: non giudicato qui', false, rumore('Commissione esaminatrice – nomine'));
check(
  'titolo vuoto: nessun giudizio',
  false,
  isAdministrativeNoise('', '').isNoise,
);

/* ---------------- 4) UNA SOLA REGOLA E L'ALLARME ---------------- */

console.log('\n— 4. Cablaggio: la stessa regola, e il piano sospetto si ferma —');
const src = readFileSync('scripts/pulisci-rumore.ts', 'utf8');
check('importa il modulo del rumore', true, src.includes("from '../src/lib/noiseFilter.ts'"));
check('usa la funzione condivisa', true, src.includes('isAdministrativeNoise(titolo, titolo)'));
check('tetto di lettura dichiarato come MINIMO', true, src.includes('TETTO_LETTURA'));
check('allarme sulla quota', true, src.includes('SOGLIA_ALLARME'));
check('piano sospetto: serve --forza', true, src.includes('--forza'));
check('DRY-RUN di default', true, src.includes('DRY-RUN'));
check('cancella a lotti', true, src.includes('ID_PER_LOTTO'));

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('comando di pulizia', 'tsx scripts/pulisci-rumore.ts', pkg.scripts['dati:pulisci-rumore']);
check(
  'guardia nella catena di `npm test`',
  true,
  (pkg.scripts.test ?? '').includes('scripts/test-pulizia-rumore.ts'),
);

console.log(
  errori === 0
    ? '\n✅ PULIZIA RUMORE: il titolo giudicato dalla stessa regola dell’ingestione.'
    : `\n❌ PULIZIA RUMORE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

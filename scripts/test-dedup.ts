/**
 * Verifica la DEDUPLICA anti-spam:
 *  · chiavi canoniche del ledger locale (`ambito|id|canale`);
 *  · registrazione idempotente e persistenza su file (fallback senza DB);
 *  · esclusione dei canali già serviti nella pubblicazione Telegram.
 *
 * Uso: npm run test:dedup
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import {
  chiaveLedger,
  ledgerLocaleGia,
  ledgerLocaleRegistra,
  ledgerLocaleSalva,
  percorsoLedgerLocale,
} from '../src/lib/ledgerLocale.ts';
import { destinazioniPubblicazione, pubblicaInterpelloSuCanali } from '../src/lib/telegram.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const percorso = percorsoLedgerLocale();
const esisteva = existsSync(percorso);

console.log('— Chiavi e registrazione (ledger locale) —');
check(
  'chiave canonica utente',
  'utente|abc:hash1|notifica',
  chiaveLedger('utente', 'abc:hash1', 'notifica'),
);
const chiave = chiaveLedger('utente', 'prova:hashX', 'notifica');
check('chiave non ancora registrata', false, ledgerLocaleGia(chiave));
ledgerLocaleRegistra(chiave);
check('chiave registrata', true, ledgerLocaleGia(chiave));

const chiaveCanale = chiaveLedger('canale', 'hashY', '@scuoleradar_piemonte');
ledgerLocaleRegistra(chiaveCanale);
ledgerLocaleSalva();
check('ledger salvato su disco', true, existsSync(percorso));
const contenuto = JSON.parse(readFileSync(percorso, 'utf8')) as { chiavi?: string[] };
check('chiave utente presente nel file', true, (contenuto.chiavi ?? []).includes(chiave));
check('chiave canale presente nel file', true, (contenuto.chiavi ?? []).includes(chiaveCanale));
check(
  'formato chiave canale tracciabile per (interpello, canale)',
  true,
  (contenuto.chiavi ?? []).some((k) => k.startsWith('canale|hashY|')),
);

console.log('\n— Pubblicazione canali: i canali già serviti vengono esclusi —');
const avviso = {
  title: 'Interpello supplenza A-022 — Liceo Augusto Monti',
  classCodes: ['A-022'],
  materia: 'Matematica',
  province: 'AT',
  expirationDate: '2099-12-31',
  schoolName: 'Liceo Augusto Monti',
  link: 'https://www.istruzione.piemonte.it/albo/interpello-a022.pdf',
};
const destinazioni = destinazioniPubblicazione(avviso);
check('almeno una destinazione configurata', true, destinazioni.length > 0);
const esito = await pubblicaInterpelloSuCanali(avviso, { escludi: destinazioni });
check('tutte le destinazioni già servite → nessun invio', 0, esito.destinazioni.length);
check('nessun invio effettuato', 0, esito.pubblicati);
check('nessun errore', 0, esito.errori.length);

// Pulizia: il ledger di test non deve restare nel workspace.
if (!esisteva) rmSync(percorso, { force: true });

console.log(errori === 0 ? '\n✅ DEDUPLICA: nessun problema' : `\n❌ DEDUPLICA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

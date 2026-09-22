/**
 * Verifica la DEDUPLICA anti-spam:
 *  · chiavi canoniche del ledger locale (`ambito|id|canale`);
 *  · registrazione idempotente e persistenza su file (fallback senza DB);
 *  · esclusione dei canali già serviti nella pubblicazione Telegram.
 *
 * ISOLAMENTO: il test lavora su un ledger TEMPORANEO
 * (`SCUOLERADAR_LEDGER_PATH`), così NON tocca mai il ledger reale del workspace
 * (che è il registro di deduplica di produzione).
 *
 * Uso: npm run test:dedup
 */
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  chiaveLedger,
  ledgerLocaleGia,
  ledgerLocaleRegistra,
  ledgerLocaleSalva,
  percorsoLedgerLocale,
} from '../src/lib/ledgerLocale.ts';
import { destinazioniPubblicazione, pubblicaInterpelloSuCanali } from '../src/lib/telegram.ts';
import { GIORNI_IMPRONTA, improntaAvviso } from '../src/lib/dedupAvvisi.ts';

// Va impostato PRIMA della prima chiamata al ledger (il percorso è risolto a runtime).
const percorsoTest = join(tmpdir(), `scuoleradar-dedup-test-${process.pid}.json`);
process.env.SCUOLERADAR_LEDGER_PATH = percorsoTest;
rmSync(percorsoTest, { force: true });

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const percorso = percorsoLedgerLocale();
check('il test usa un ledger temporaneo (mai quello reale)', percorsoTest, percorso);

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

console.log('\n— Impronta dell\'opportunità: la STESSA notizia non torna ogni giorno —');
/**
 * L'`hash_id` include titolo + data: la stessa opportunità ripubblicata con
 * titolo/date diversi generava un hash nuovo → nuovo record → nuovo alert, giorno
 * dopo giorno (bug "notifiche ripetute", es. gli avvisi del Liceo Monti). Qui si
 * verifica che l'IMPRONTA (scuola + provincia + classi + titolo normalizzato senza
 * date/numeri) resti IDENTICA al variare di date e rumore nel titolo.
 */
const avvisoBase = {
  titolo: 'Interpello supplenza A-022 Matematica — Liceo Augusto Monti',
  scuola: 'Liceo Augusto Monti',
  provincia: 'AT',
  classi: ['A-022'],
};
const improntaBase = improntaAvviso(avvisoBase);
check('impronta calcolata', true, typeof improntaBase === 'string' && improntaBase.length > 10);
check(
  'data nel titolo → STESSA impronta',
  improntaBase,
  improntaAvviso({ ...avvisoBase, titolo: 'Interpello supplenza A-022 Matematica del 12/09/2026 — Liceo Augusto Monti' }),
);
check(
  'protocollo e punteggiatura → STESSA impronta',
  improntaBase,
  improntaAvviso({
    ...avvisoBase,
    titolo: 'INTERPELLO N. 1234/2026 — SUPPLENZA A-022 MATEMATICA - Liceo Augusto Monti',
  }),
);
check(
  'ordine delle classi irrilevante',
  improntaAvviso({ ...avvisoBase, classi: ['A-022', 'ADEE'] }),
  improntaAvviso({ ...avvisoBase, classi: ['ADEE', 'A-022'] }),
);
check(
  'FORMATO del codice classe irrilevante (A-022 ≡ A-22 ≡ A042)',
  [
    improntaAvviso({ ...avvisoBase, classi: ['A-022'] }),
    improntaAvviso({ ...avvisoBase, classi: ['A-022'] }),
  ],
  [
    improntaAvviso({ ...avvisoBase, classi: ['A-22'] }),
    improntaAvviso({ ...avvisoBase, classi: ['A22'] }),
  ],
);
check(
  'SCUOLA diversa → impronta diversa',
  true,
  improntaAvviso({ ...avvisoBase, scuola: 'ITIS Artom' }) !== improntaBase,
);
check(
  'CLASSE diversa → impronta diversa',
  true,
  improntaAvviso({ ...avvisoBase, classi: ['A-041'] }) !== improntaBase,
);
check(
  'titolo generico troppo corto → nessuna impronta (non si sopprime nulla)',
  null,
  improntaAvviso({ titolo: 'Interpello', scuola: 'Liceo Monti', provincia: 'AT', classi: [] }),
);
check('finestra di confronto = 60 giorni', true, GIORNI_IMPRONTA === 60);

// Pulizia: il ledger di test è TEMPORANEO (mai il file reale del workspace).
rmSync(percorso, { force: true });

console.log(errori === 0 ? '\n✅ DEDUPLICA: nessun problema' : `\n❌ DEDUPLICA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

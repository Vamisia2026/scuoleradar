/**
 * ScuoleRadar.it — MERGE del ledger anti-duplicato prima del commit (workflow).
 *
 * Perché esiste: `scraper.yml` e `digest.yml` girano negli stessi minuti (15:00
 * UTC) e scrivono lo STESSO file `.scuoleradar/notifiche-ledger.json`. Con
 * `git add` + `git commit` + `git push` "diretti", il secondo run perdeva le
 * chiavi dell'altro (push rifiutato o file sovrascritto) → le notifiche già
 * consegnate NON risultavano più registrate e ripartivano nei giorni successivi
 * (bug "notifiche ripetute a distanza di giorni", es. gli avvisi del Liceo Monti).
 *
 * Il workflow salva il ledger del run in un file temporaneo, scarica la versione
 * del branch remoto e chiama questo script: il risultato è l'UNIONE delle chiavi,
 * poi committata sul remoto aggiornato.
 *
 * Uso: npm run ledger:unisci -- <file-run.json> [<file-remoto.json>]
 * Scrive su `.scuoleradar/notifiche-ledger.json` (o `SCUOLERADAR_LEDGER_PATH`).
 * Mai eccezioni: exit 0 anche se i file mancano (ledger vuoto = nessuna chiave).
 */

import { existsSync } from 'node:fs';
import { percorsoLedgerLocale, unisciFileLedger } from '../src/lib/ledgerLocale.ts';

declare const process: { argv: string[]; exitCode?: number };

const [fileRun, fileRemoto] = process.argv.slice(2).filter((a) => a !== '--');
if (!fileRun) {
  console.error('Uso: npm run ledger:unisci -- <file-run.json> [<file-remoto.json>]');
  process.exitCode = 1;
} else {
  const percorso = percorsoLedgerLocale();
  const chiavi = unisciFileLedger(fileRun, fileRemoto ?? 'file-remoto-assente');
  console.log(
    `✓ Ledger unito → ${percorso}: ${chiavi} chiavi totali ` +
      `(run: ${existsSync(fileRun) ? fileRun : 'assente'} · ` +
      `remoto: ${fileRemoto && existsSync(fileRemoto) ? fileRemoto : 'assente'}).`,
  );
}

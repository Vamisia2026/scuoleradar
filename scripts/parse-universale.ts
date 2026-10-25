/**
 * EURISTICA UNIVERSALE — CLI DI DIAGNOSI (§26.84).
 *
 * Legge uno snapshot HTML già sul disco (es. `curl -s <url> -o scripts/out/pagina.html`)
 * e mostra come `parseUniversalHtml` interpreta la pagina: layout riconosciuto,
 * voci estratte, motivo dello scarto. **Nessuna rete**: il file c'è già, quindi
 * la diagnosi si può fare su una sorgente senza toccare la produzione.
 *
 * Uso (da `project/`):
 *   npm run tabella:universale -- scripts/out/pagina.html [https://portale.scuola.it/]
 *
 * Guardia: `npm run test:universal-euristica` (incluso in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUniversalHtml, type UniversalExtractionResult } from '../src/lib/universalEuristica.ts';

/** Base usata quando il chiamante non dichiara la pagina di provenienza. */
export const BASE_PREDEFINITA = 'https://portale.scuola.example/';

/** Riepilogo leggibile dell'esito (una riga di intestazione + le prime voci). */
export function righeEsito(esito: UniversalExtractionResult): string[] {
  const righe = [`layout=${esito.layoutDetected} success=${esito.success} voci=${esito.items.length}`];
  if (esito.error) righe.push(`errore: ${esito.error}`);
  for (const voce of esito.items.slice(0, 10)) {
    const dettagli = [
      voce.expirationDate ? `scadenza ${voce.expirationDate}` : '',
      voce.classCodes.length > 0 ? voce.classCodes.join(', ') : '',
    ].filter(Boolean);
    righe.push(`- ${voce.title}`);
    righe.push(`  ${voce.directUrl}${dettagli.length > 0 ? ` · ${dettagli.join(' · ')}` : ''}`);
  }
  return righe;
}

/* ----------------------------------- CLI ----------------------------------- */

const invocatoDirettamente =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invocatoDirettamente) {
  const percorso = process.argv[2];
  if (!percorso) {
    console.error('Uso: npm run tabella:universale -- <pagina.html> [baseUrl]');
    process.exitCode = 1;
  } else {
    const esito = parseUniversalHtml(readFileSync(percorso, 'utf8'), process.argv[3] ?? BASE_PREDEFINITA);
    console.log(righeEsito(esito).join('\n'));
    process.exitCode = esito.success ? 0 : 1;
  }
}

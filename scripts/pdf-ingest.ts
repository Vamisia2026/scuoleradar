/**
 * PDF INGEST — la guardia deterministica PRIMA dell'LLM (§26.83).
 *
 * Questo è l'UNICO punto in cui un testo PDF già estratto può diventare una
 * chiamata al modello: `valutaTestoPdf` applica `parsePdfDeterminist` e restituisce
 * un `fallback` NON nullo solo quando `needsLlmFallback === true`. Il fallback
 * riceve esclusivamente `candidateChunk` (≤ `MAX_CHUNK_CHARS`), mai il documento.
 *
 * Uso (estrazione esterna, es. `pdftotext avviso.pdf -`):
 *   npx tsx scripts/pdf-ingest.ts scripts/out/avviso.txt
 *
 * Guardia: `npm run test:pdf-determinist` (incluso in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_CHUNK_CHARS,
  parsePdfDeterminist,
  type DeterministicPdfResult,
} from '../src/lib/pdfDeterminist.ts';

/** Ciò che si può passare a un LLM: SOLO lo snippet, mai il documento. */
export interface RichiestaFallbackLlm {
  source: string;
  chunk: string;
}

export interface EsitoIngestionePdf {
  esito: DeterministicPdfResult;
  /** `null` = via deterministica sufficiente: nessuna chiamata esterna. */
  fallback: RichiestaFallbackLlm | null;
}

/** Applica la guardia al testo già estratto dal PDF. */
export function valutaTestoPdf(
  testo: string,
  source: string,
  now: Date = new Date(),
): EsitoIngestionePdf {
  const esito = parsePdfDeterminist(testo, now);
  if (!esito.needsLlmFallback) return { esito, fallback: null };
  const chunk = (esito.candidateChunk ?? '').slice(0, MAX_CHUNK_CHARS);
  return { esito, fallback: chunk ? { source, chunk } : null };
}

/**
 * Invoca il ripiego LLM SOLO quando la guardia lo chiede, con il solo chunk.
 * La funzione `fallbackLlm` è iniettata: qui non si chiama alcuna API.
 */
export async function risolviDocumentoPdf<T>(
  testo: string,
  source: string,
  fallbackLlm: (richiesta: RichiestaFallbackLlm) => Promise<T | null>,
  now: Date = new Date(),
): Promise<{ esito: DeterministicPdfResult; usatoLlm: boolean; risposta: T | null }> {
  const { esito, fallback } = valutaTestoPdf(testo, source, now);
  if (!fallback) return { esito, usatoLlm: false, risposta: null };
  return { esito, usatoLlm: true, risposta: await fallbackLlm(fallback) };
}

/* ----------------------------------- CLI ----------------------------------- */

const invocatoDirettamente =
  Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invocatoDirettamente) {
  const percorso = process.argv[2];
  if (!percorso) {
    console.error('Uso: npx tsx scripts/pdf-ingest.ts <testo-estratto.txt>');
    process.exitCode = 1;
  } else {
    const { esito, fallback } = valutaTestoPdf(readFileSync(percorso, 'utf8'), percorso);
    console.log(JSON.stringify({ ...esito, llmInput: fallback?.chunk ?? null }, null, 2));
  }
}

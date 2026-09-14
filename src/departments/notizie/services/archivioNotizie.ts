/**
 * ScuoleRadar.it — Archivio Notizie: lettura/scrittura del file dati (Node-only).
 *
 * `notizieIngestite.ts` è un file GENERATO: questo modulo è l'unico punto che lo
 * serializza (usato dall'ingestione `npm run scrape:notizie` e dalla
 * manutenzione `npm run notizie:ripara-archivio`), così il formato resta unico.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NewsArticle } from '../types.ts';

const __dirnameCartella = dirname(fileURLToPath(import.meta.url));

/** Percorso del file dati dell'archivio Notizie. */
export const FILE_ARCHIVIO_NOTIZIE = join(__dirnameCartella, '..', 'data', 'notizieIngestite.ts');

/** Intestazione del file generato (documenta le regole della pipeline). */
const INTESTAZIONE = `/**
 * ScuoleRadar.it — Notizie ingestite (dati reali).
 *
 * File GENERATO automaticamente dal servizio di ingestione:
 *   npm run scrape:notizie
 * Non modificarlo a mano: il contenuto viene rigenerato ad ogni ingestione
 * (accelerazione ACCUMULATIVA con dedupe per id, REFRESH delle voci esistenti,
 * validazione URL HTTP 200, tetto di 6 articoli nella finestra di 15 giorni).
 *
 * POLICY NAZIONALE: sono ammesse SOLO fonti nazionali accreditate (MIM,
 * Gazzetta Ufficiale, ARAN, giurisdizione contabile/amministrativa). Le pagine
 * REGIONALI (USR) sono escluse: le voci regionali eventualmente presenti
 * vengono rimosse dall'igiene dell'archivio.
 *
 * POLICY LINK (§5): ogni articolo pubblica SOLO il link diretto al documento
 * specifico (dashboard articolo/PDF ufficiale). Home page, indici, elenchi,
 * directory URP e archivi "master" non sono ammessi: senza link puntuale
 * l'articolo non viene pubblicato.
 */
import type { NewsArticle } from '../types';

/** Notizie reali ingressate dalle fonti ufficiali NAZIONALI (MIM, Gazzetta Ufficiale, ARAN). */
`;

/** Scrive l'archivio notizie (accumulo) su `notizieIngestite.ts`. */
export function scriviArchivioNotizie(articoli: NewsArticle[]): void {
  const contenuto = `${INTESTAZIONE}export const notizieIngestite: NewsArticle[] = ${JSON.stringify(
    articoli,
    null,
    2,
  )};\n`;
  mkdirSync(dirname(FILE_ARCHIVIO_NOTIZIE), { recursive: true });
  writeFileSync(FILE_ARCHIVIO_NOTIZIE, contenuto, 'utf8');
}

/**
 * Estrae l'array di articoli da un sorgente TS dell'archivio, SENZA eseguirlo.
 * Si àncora alla dichiarazione (`notizieIngestite: NewsArticle[] = [`) per non
 * confondere le `[]` del tipo con l'array vero.
 */
export function estraiArticoliDaTesto(testo: string): NewsArticle[] {
  const marcatore = 'notizieIngestite: NewsArticle[] = [';
  const pos = testo.indexOf(marcatore);
  const inizio = pos >= 0 ? pos + marcatore.length - 1 : testo.indexOf('= [') + 2;
  const fine = testo.lastIndexOf(']');
  if (inizio <= 1 || fine <= inizio) return [];
  try {
    return JSON.parse(testo.slice(inizio, fine + 1)) as NewsArticle[];
  } catch {
    return [];
  }
}

/**
 * Legge l'array di articoli dal file dati SENZA eseguirlo: serve alla
 * manutenzione per fondere archivio storico e archivio corrente.
 */
export function leggiArchivioNotizie(percorso: string = FILE_ARCHIVIO_NOTIZIE): NewsArticle[] {
  try {
    return estraiArticoliDaTesto(readFileSync(percorso, 'utf8'));
  } catch {
    return [];
  }
}

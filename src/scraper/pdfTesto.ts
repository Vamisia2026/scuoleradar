/**
 * ScuoleRadar.it — IL TESTO DI UN PDF (motore di estrazione) — §26.95.
 *
 * Perché esiste: il 26/10/2026 la misura diceva **1.300 voci senza scadenza** e
 * la maggioranza erano allegati PDF. Senza leggere quei byte il termine non
 * esiste, e nessun numero si alza inventando date: si legge il documento.
 *
 * COME (nessuna dipendenza nuova: `node:zlib` è nel runtime)
 *  1. `pdfStruttura.ts` indicizza oggetti, stream compressi e pagine;
 *  2. `pdfContenuto.ts` legge i `/Contents` e interpreta gli operatori di testo
 *     (`Tj`, `TJ`, `'`, `"`), i fine riga (`Td`, `T*`, `ET`) e i font in uso;
 *  3. `pdfCmap.ts` traduce i codici con la `/ToUnicode` del font: i PDF di Word
 *     scrivono `<00350036>` (CID), non `(entro il 12/11/2026)`;
 *  4. se il documento non dichiara pagine si tenta l'ultima strada: gli stream
 *     che contengono operatori di testo, con una CMap unica di ripiego.
 *
 * Il testo prodotto si passa a `scadenzaDaTesto` (`src/lib/scadenzaTesto.ts`):
 * l'etichetta («entro», «termine», «non oltre») resta obbligatoria, quindi un
 * PDF illeggibile produce `null`, mai una data inventata.
 *
 * Guardia: `npm run test:pdf-testo` (inclusa in `npm test`).
 */

import { scadenzaDaTesto } from '../lib/scadenzaTesto.ts';
import { cmapDaTesto, type MappaFont } from './pdfCmap.ts';
import { testoDaContenuto } from './pdfContenuto.ts';
import {
  decodificaStream,
  dizionario,
  indiceOggetti,
  paginePdf,
  riferimento,
  testoLatin1,
  type OggettoPdf,
} from './pdfStruttura.ts';

/** Esito dell'estrazione: testo leggibile, pagine lette e motivi (mai eccezioni). */
export interface EsitoTestoPdf {
  testo: string;
  pagine: number;
  motivi: string[];
}

/** Un PDF dichiara il termine in testa: leggere 3 pagine basta e non costa. */
export const MAX_PAGINE_PDF = 3;
/** Oltre questa dimensione il documento non è un avviso (è un albo intero). */
export const MAX_BYTE_PDF = 8 * 1024 * 1024;
/** Tetto del testo restituito: oltre è un documento, non un avviso. */
const MAX_CARATTERI = 200_000;

/** `/Resources /Font`: nome usato dal contenuto → CMap del font. */
function fontDellaPagina(
  oggetti: Map<number, OggettoPdf>,
  risorse: string | null,
): Map<string, MappaFont> {
  const font = new Map<string, MappaFont>();
  const elenco = risorse ? dizionario(risorse, 'Font') : null;
  if (!elenco) return font;
  for (const m of elenco.matchAll(/\/([^\s/<>[\]()]{1,64})\s+(\d+)\s+\d+\s+R\b/g)) {
    const oggetto = oggetti.get(Number(m[2]));
    if (!oggetto) continue;
    const toUnicode = riferimento(oggetto.dict, 'ToUnicode');
    const vuoto: OggettoPdf = { numero: toUnicode ?? 0, dict: '', stream: null };
    const dati =
      toUnicode != null ? decodificaStream(oggetti.get(toUnicode) ?? vuoto) : null;
    font.set(
      m[1],
      dati
        ? cmapDaTesto(testoLatin1(dati))
        : { mappa: new Map<number, string>(), dueByte: /Identity-[HV]/.test(oggetto.dict) },
    );
  }
  return font;
}

/**
 * CMap di ripiego: tutte le `/ToUnicode` del file fuse insieme. Serve solo
 * quando il documento non dichiara pagine leggibili; può confondere i codici fra
 * font diversi, ma una data ha bisogno anche dell'etichetta («entro»), quindi il
 * rischio è di NON leggere, non di inventare.
 */
function mappaDiRipiego(oggetti: Map<number, OggettoPdf>): MappaFont {
  const fusa: MappaFont = { mappa: new Map(), dueByte: false };
  for (const oggetto of oggetti.values()) {
    if (!oggetto.stream) continue;
    const dati = decodificaStream(oggetto);
    if (!dati) continue;
    const testo = testoLatin1(dati);
    if (!/begincmap/i.test(testo)) continue;
    const mappa = cmapDaTesto(testo);
    for (const [codice, valore] of mappa.mappa) {
      if (!fusa.mappa.has(codice)) fusa.mappa.set(codice, valore);
    }
    fusa.dueByte = fusa.dueByte || mappa.dueByte;
  }
  return fusa;
}

/** Ultima strada: gli stream che contengono davvero operatori di testo. */
function testoDaStreamSciolti(oggetti: Map<number, OggettoPdf>): string {
  const predefinito = mappaDiRipiego(oggetti);
  const parti: string[] = [];
  for (const oggetto of oggetti.values()) {
    if (!oggetto.stream) continue;
    const dati = decodificaStream(oggetto);
    if (!dati) continue;
    const contenuto = testoLatin1(dati);
    if (!/\bBT\b/.test(contenuto) || !/\bT[Jj]\b/.test(contenuto)) continue;
    const estratto = testoDaContenuto(contenuto, new Map(), predefinito);
    if (estratto.trim()) parti.push(estratto);
  }
  return parti.join('\n');
}

/** Spazi compattati, righe vuote via: quello che serve a una regex. */
function normalizza(testo: string): string {
  // I caratteri di controllo (0x00–0x1F tranne `\n` e `\t`) nei content stream
  // sono byte di struttura, non testo: si scartano o diventano spazi.
  let visibile = '';
  for (const carattere of testo) {
    const codice = carattere.charCodeAt(0);
    if (codice === 0) continue;
    visibile += codice < 32 && carattere !== '\n' && carattere !== '\t' ? ' ' : carattere;
  }
  return visibile
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
    .slice(0, MAX_CARATTERI);
}

/**
 * Testo delle prime `maxPagine` pagine. Non lancia mai: un PDF rotto, cifrato o
 * scansionato restituisce testo vuoto e il motivo.
 */
export function estraiTestoPdf(
  buffer: Uint8Array,
  opzioni: { maxPagine?: number } = {},
): EsitoTestoPdf {
  if (buffer.byteLength === 0) return { testo: '', pagine: 0, motivi: ['file vuoto'] };
  if (!testoLatin1(buffer.subarray(0, 1024)).includes('%PDF')) {
    return { testo: '', pagine: 0, motivi: ['non è un PDF (manca %PDF)'] };
  }
  const motivi: string[] = [];
  const oggetti = indiceOggetti(buffer);
  if (oggetti.size === 0) {
    return { testo: '', pagine: 0, motivi: ['nessun oggetto leggibile'] };
  }

  const massimo = Math.max(1, opzioni.maxPagine ?? MAX_PAGINE_PDF);
  const pagine = paginePdf(oggetti).slice(0, massimo);
  if (pagine.length === 0) motivi.push('nessuna pagina dichiarata');
  const letti: string[] = [];
  for (const pagina of pagine) {
    const font = fontDellaPagina(oggetti, pagina.risorse);
    for (const numero of pagina.contenuti) {
      const oggetto = oggetti.get(numero);
      const dati = oggetto ? decodificaStream(oggetto) : null;
      if (!dati) {
        motivi.push(`contenuto ${numero} non leggibile`);
        continue;
      }
      letti.push(testoDaContenuto(testoLatin1(dati), font));
    }
  }

  let testo = normalizza(letti.join('\n'));
  if (!testo) {
    testo = normalizza(testoDaStreamSciolti(oggetti));
    motivi.push(
      testo
        ? 'letto senza pagina dichiarata'
        : 'nessun testo estraibile (PDF scansionato o font senza CMap)',
    );
  }
  return { testo, pagine: pagine.length, motivi };
}

/**
 * Scadenza dichiarata in un PDF, altrimenti `null`. È la porta usata dal runner:
 * il testo passa per `scadenzaDaTesto`, quindi valgono le stesse regole (una
 * data senza «entro/termine/scadenza» non è un termine).
 */
export function scadenzaDaPdf(
  buffer: Uint8Array,
  opzioni: { maxPagine?: number } = {},
): string | null {
  const { testo } = estraiTestoPdf(buffer, opzioni);
  return testo ? scadenzaDaTesto(testo) : null;
}

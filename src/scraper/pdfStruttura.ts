/**
 * ScuoleRadar.it — LA STRUTTURA DI UN PDF (oggetti, stream, pagine) — §26.95.
 *
 * Perché esiste: gli istituti pubblicano gli interpelli in PDF. Il testo c'è, ma
 * sta dentro stream compressi (`FlateDecode`) e, per i PDF esportati da Word o
 * LibreOffice, i caratteri NON sono ASCII: sono CID di un font Identity-H e la
 * traduzione codice → lettera sta nella CMap `/ToUnicode` (`pdfCmap.ts`). Senza
 * quella mappa si legge `\x00\x35\x00\x36` e nessuna data.
 *
 * COSA FA (solo lettura, nessuna rete, nessuna dipendenza nuova)
 *  · `indiceOggetti`: indicizza gli oggetti del file (`N G obj … endobj`) senza
 *    usare la tabella `xref` (che nei PDF moderni è a sua volta compressa);
 *  · `aggiungiOggettiCompressi`: apre gli `/ObjStm` (oggetti dentro uno stream,
 *    dove i PDF recenti mettono dizionari di pagina e font);
 *  · `decodificaStream`: `FlateDecode` (e `inflateRaw` come ripiego);
 *  · `dizionario`/`riferimento`/`riferimenti`: lettura dei dizionari PDF;
 *  · `paginePdf`: le pagine con `/Contents` e `/Resources`.
 *
 * REGOLE: nessuna eccezione in uscita (un PDF rotto restituisce `null`/liste
 * vuote), nessun accesso al filesystem. Il testo si ricostruisce in
 * `pdfContenuto.ts` + `pdfTesto.ts`. Guardia: `npm run test:pdf-testo`.
 */

import { inflateRawSync, inflateSync } from 'node:zlib';

/** Un oggetto PDF: numero, dizionario grezzo e dati di stream (se è uno stream). */
export interface OggettoPdf {
  numero: number;
  dict: string;
  stream: Uint8Array | null;
}

/** Byte → caratteri 1:1 (latin1): gli OFFSET restano quelli dei byte. */
const DECODER = new TextDecoder('latin1');

/** Interpreta i byte come latin1: indici e lunghezze coincidono con i byte. */
export function testoLatin1(dati: Uint8Array): string {
  return DECODER.decode(dati);
}

/** `N G obj` — l'inizio di un oggetto (la generazione non serve). */
const RE_OGGETTO = /(\d{1,10})\s+(\d{1,5})\s+obj\b/g;

/**
 * Indicizza gli oggetti del file. Non usa `xref`: si scorre il file e si
 * delimitano gli oggetti con `obj`/`endobj`, saltando il contenuto degli stream
 * (che può contenere le stesse parole per caso).
 */
export function indiceOggetti(buffer: Uint8Array): Map<number, OggettoPdf> {
  const oggetti = new Map<number, OggettoPdf>();
  const grezzo = testoLatin1(buffer);
  RE_OGGETTO.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE_OGGETTO.exec(grezzo)) !== null) {
    const numero = Number(m[1]);
    const inizio = m.index + m[0].length;
    const posEndobj = grezzo.indexOf('endobj', inizio);
    const posStream = grezzo.indexOf('stream', inizio);
    if (posEndobj !== -1 && (posStream === -1 || posEndobj < posStream)) {
      oggetti.set(numero, { numero, dict: grezzo.slice(inizio, posEndobj), stream: null });
      RE_OGGETTO.lastIndex = posEndobj + 'endobj'.length;
      continue;
    }
    if (posStream === -1) continue;
    const dict = grezzo.slice(inizio, posStream);
    let dati = posStream + 'stream'.length;
    // Dopo `stream` c'è un fine riga (CR, LF o CRLF) che NON è contenuto.
    if (grezzo[dati] === '\r') dati += 1;
    if (grezzo[dati] === '\n') dati += 1;
    const posEndstream = grezzo.indexOf('endstream', dati);
    if (posEndstream === -1) continue;
    let fine = posEndstream;
    if (grezzo[fine - 1] === '\n') fine -= 1;
    if (grezzo[fine - 1] === '\r') fine -= 1;
    oggetti.set(numero, { numero, dict, stream: buffer.subarray(dati, Math.max(dati, fine)) });
    RE_OGGETTO.lastIndex = posEndstream + 'endstream'.length;
  }
  aggiungiOggettiCompressi(oggetti);
  return oggetti;
}

/**
 * Gli oggetti dentro gli `/ObjStm`: i PDF recenti comprimono lì i dizionari
 * (font, pagine). Senza questo passaggio una pagina può risultare «senza font» e
 * il testo Identity-H resta illeggibile.
 */
function aggiungiOggettiCompressi(oggetti: Map<number, OggettoPdf>): void {
  for (const oggetto of [...oggetti.values()]) {
    if (!oggetto.stream || !/\/Type\s*\/ObjStm\b/.test(oggetto.dict)) continue;
    const dati = decodificaStream(oggetto);
    if (!dati) continue;
    const testo = testoLatin1(dati);
    const quanti = Number(/\/N\s+(\d+)/.exec(oggetto.dict)?.[1] ?? 0);
    const primo = Number(/\/First\s+(\d+)/.exec(oggetto.dict)?.[1] ?? 0);
    if (!quanti || !primo) continue;
    const intestazione = testo.slice(0, primo).trim().split(/\s+/).map(Number);
    for (let i = 0; i < quanti; i += 1) {
      const numero = intestazione[i * 2];
      const offset = intestazione[i * 2 + 1];
      if (!Number.isFinite(numero) || !Number.isFinite(offset)) continue;
      if (oggetti.has(numero)) continue;
      const successivo =
        i + 1 < quanti && Number.isFinite(intestazione[(i + 1) * 2 + 1])
          ? intestazione[(i + 1) * 2 + 1]
          : testo.length - primo;
      oggetti.set(numero, {
        numero,
        dict: testo.slice(primo + offset, primo + successivo),
        stream: null,
      });
    }
  }
}

/**
 * Dati di uno stream, decompressi se `FlateDecode`. `null` per i filtri che non
 * servono al testo (immagini `DCTDecode`, `ASCII85`, …): non è un errore, è un
 * formato che il lettore non interpreta.
 */
export function decodificaStream(oggetto: OggettoPdf): Uint8Array | null {
  const dati = oggetto.stream;
  if (!dati) return null;
  if (!/\/Filter/.test(oggetto.dict)) return dati;
  const flate = /\/FlateDecode|\/Fl\b/.test(oggetto.dict);
  if (!flate) return null;
  try {
    return new Uint8Array(inflateSync(dati));
  } catch {
    // Stream «raw» (senza header zlib): capita nei PDF prodotti da alcuni
    // generatori. Non è un motivo per arrendersi.
    try {
      return new Uint8Array(inflateRawSync(dati));
    } catch {
      return null;
    }
  }
}


/** Fine di un dizionario `<< … >>` che comincia in `inizio` (bilanciato). */
export function fineDizionario(testo: string, inizio: number): number {
  let livello = 0;
  let i = inizio;
  while (i < testo.length) {
    if (testo.startsWith('<<', i)) {
      livello += 1;
      i += 2;
      continue;
    }
    if (testo.startsWith('>>', i)) {
      livello -= 1;
      i += 2;
      if (livello === 0) return i;
      continue;
    }
    i += 1;
  }
  return testo.length;
}

/** Valore grezzo di una chiave (`12 0 R`, `<<…>>`, `[ … ]`, `/Nome`, numero). */
export function valore(dict: string, chiave: string): string | null {
  const m = new RegExp(`/${chiave}(?![A-Za-z0-9])\\s*`).exec(dict);
  if (!m) return null;
  const inizio = m.index + m[0].length;
  if (dict.startsWith('<<', inizio)) return dict.slice(inizio, fineDizionario(dict, inizio));
  if (dict[inizio] === '[') {
    const fine = dict.indexOf(']', inizio);
    return dict.slice(inizio, fine === -1 ? dict.length : fine + 1);
  }
  // Riferimento indiretto (`8 0 R`): il primo token da solo non basta.
  const indiretto = /^(\d+)\s+(\d+)\s+R\b/.exec(dict.slice(inizio, inizio + 40));
  if (indiretto) return `${indiretto[1]} ${indiretto[2]} R`;
  const semplice = /^[^\s/<>[\]()]*/.exec(dict.slice(inizio, inizio + 120));
  return semplice ? semplice[0] : null;
}

/** Dizionario annidato di una chiave (`/Resources << … >>`), altrimenti `null`. */
export function dizionario(dict: string, chiave: string): string | null {
  const grezzo = valore(dict, chiave);
  return grezzo && grezzo.startsWith('<<') ? grezzo : null;
}

/** Numero dell'oggetto referenziato da `/Chiave N 0 R`, altrimenti `null`. */
export function riferimento(dict: string, chiave: string): number | null {
  const grezzo = valore(dict, chiave);
  const m = grezzo ? /^\s*(\d+)\s+\d+\s+R\b/.exec(grezzo) : null;
  return m ? Number(m[1]) : null;
}

/** Tutti i riferimenti di una chiave: `N 0 R` oppure `[N 0 R M 0 R]`. */
export function riferimenti(dict: string, chiave: string): number[] {
  const grezzo = valore(dict, chiave);
  if (!grezzo) return [];
  return [...grezzo.matchAll(/(\d+)\s+\d+\s+R\b/g)].map((m) => Number(m[1]));
}

/** Una pagina dichiarata dal documento. */
export interface PaginaPdf {
  numero: number;
  /** Oggetti `/Contents` (in ordine). */
  contenuti: number[];
  /** Dizionario `/Resources` (grezzo), se dichiarato sulla pagina. */
  risorse: string | null;
}

/**
 * Le pagine del documento: gli oggetti `/Type /Page` con i loro contenuti.
 * L'ordine è quello degli oggetti, non quello di lettura: per cercare una data
 * nelle prime pagine è sufficiente e non richiede di ricostruire l'albero.
 */
export function paginePdf(oggetti: Map<number, OggettoPdf>): PaginaPdf[] {
  const pagine: PaginaPdf[] = [];
  for (const oggetto of oggetti.values()) {
    if (!/\/Type\s*\/Page(?![a-zA-Z])/.test(oggetto.dict)) continue;
    const risorse =
      dizionario(oggetto.dict, 'Resources') ??
      dizionario(oggetti.get(riferimento(oggetto.dict, 'Resources') ?? -1)?.dict ?? '', 'Resources');
    pagine.push({
      numero: oggetto.numero,
      contenuti: riferimenti(oggetto.dict, 'Contents'),
      risorse,
    });
  }
  return pagine.sort((a, b) => a.numero - b.numero);
}


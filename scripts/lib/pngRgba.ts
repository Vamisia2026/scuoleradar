/**
 * ScuoleRadar — Decodifica PNG minimale per le guardie sugli asset (zero dipendenze).
 *
 * Modulo di supporto di `scripts/test-favicon.ts`: legge i byte del file,
 * ricostruisce i pixel RGBA con `node:zlib` e li espone per i controlli di
 * identità visiva (campo azzurro del marchio, radar bianco, pieno formato).
 * Supporta PNG 8 bit, RGB/RGBA, non interlacciati: esattamente gli asset
 * prodotti da `npm run favicon`.
 */
import { inflateSync } from 'node:zlib';

/** Lettura little-endian / big-endian su array di byte. */
export const u16le = (d: Uint8Array, i: number): number => d[i] | (d[i + 1] << 8);
export const u32le = (d: Uint8Array, i: number): number =>
  (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0;
export const u32be = (d: Uint8Array, i: number): number =>
  ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0;

export interface Immagine {
  larghezza: number;
  altezza: number;
  /** Pixel RGBA (4 byte per pixel), righe dall'alto. */
  pixel: Uint8Array;
}

function concatena(parti: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parti.reduce((somma, p) => somma + p.length, 0));
  let offset = 0;
  for (const parte of parti) {
    out.set(parte, offset);
    offset += parte.length;
  }
  return out;
}

/** Decodifica minimale PNG: 8 bit, RGB/RGBA, non interlacciato. */
export function decodificaPng(dati: Uint8Array): Immagine | null {
  const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (dati.length < 8 || firma.some((byte, i) => dati[i] !== byte)) return null;

  let cursore = 8;
  let larghezza = 0;
  let altezza = 0;
  let canali = 0;
  const idat: Uint8Array[] = [];

  while (cursore + 12 <= dati.length) {
    const lunghezza = u32be(dati, cursore);
    const tipo = String.fromCharCode(dati[cursore + 4], dati[cursore + 5], dati[cursore + 6], dati[cursore + 7]);
    const inizio = cursore + 8;
    if (inizio + lunghezza > dati.length) return null;
    if (tipo === 'IHDR') {
      larghezza = u32be(dati, inizio);
      altezza = u32be(dati, inizio + 4);
      const bit = dati[inizio + 8];
      const colore = dati[inizio + 9];
      const interlaccio = dati[inizio + 12];
      if (bit !== 8 || interlaccio !== 0 || (colore !== 6 && colore !== 2)) return null;
      canali = colore === 6 ? 4 : 3;
    } else if (tipo === 'IDAT') {
      idat.push(dati.subarray(inizio, inizio + lunghezza));
    } else if (tipo === 'IEND') {
      break;
    }
    cursore = inizio + lunghezza + 4;
  }
  if (!larghezza || !altezza || canali === 0 || idat.length === 0) return null;

  const grezzo = new Uint8Array(inflateSync(concatena(idat)));
  const passo = larghezza * canali;
  const pixel = new Uint8Array(larghezza * altezza * 4);
  const riga = new Uint8Array(passo);
  const precedente = new Uint8Array(passo);
  let p = 0;

  for (let y = 0; y < altezza; y += 1) {
    const filtro = grezzo[p];
    p += 1;
    for (let x = 0; x < passo; x += 1) {
      const a = x >= canali ? riga[x - canali] : 0;
      const b = precedente[x];
      const c = x >= canali ? precedente[x - canali] : 0;
      let valore: number;
      switch (filtro) {
        case 0:
          valore = grezzo[p + x];
          break;
        case 1:
          valore = grezzo[p + x] + a;
          break;
        case 2:
          valore = grezzo[p + x] + b;
          break;
        case 3:
          valore = grezzo[p + x] + ((a + b) >> 1);
          break;
        case 4: {
          const stima = a + b - c;
          const pa = Math.abs(stima - a);
          const pb = Math.abs(stima - b);
          const pc = Math.abs(stima - c);
          valore = grezzo[p + x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default:
          return null;
      }
      riga[x] = valore & 0xff;
    }
    p += passo;
    for (let x = 0; x < larghezza; x += 1) {
      const da = x * canali;
      const a4 = (y * larghezza + x) * 4;
      pixel[a4] = riga[da];
      pixel[a4 + 1] = canali === 4 ? riga[da + 1] : riga[da];
      pixel[a4 + 2] = canali === 4 ? riga[da + 2] : riga[da];
      pixel[a4 + 3] = canali === 4 ? riga[da + 3] : 255;
    }
    precedente.set(riga);
  }
  return { larghezza, altezza, pixel };
}

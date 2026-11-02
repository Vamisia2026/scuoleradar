/**
 * ScuoleRadar.it â€” GLI OPERATORI DI TESTO DI UN PDF â€” Â§26.95.
 *
 * Un content stream Ã¨ un programma: `BT /F1 11 Tf 72 700 Td (â€¦ ) Tj ET`. Il testo
 * sta nelle stringhe `( â€¦ )` o `< â€¦ >`, gli array `TJ` alternano stringhe e
 * crenature, e gli operatori `Td`/`T*`/`ET` decidono dove finisce una riga.
 *
 * Questo modulo traduce quel programma in TESTO ORDINATO:
 *  Â· `leggiLetterale`: parentesi annidate ed escape (`\(`, `\n`, `\050`);
 *  Â· `leggiArray`: `TJ` con crenature â‰¤ -100 lette come spazio (parole separate);
 *  Â· `decodifica`: i byte passano dalla CMap del font IN USO (Identity-H);
 *  Â· `testoDaContenuto`: il giro completo, con i cambi font (`/F1 9.5 Tf`) e la
 *    distinzione fra un salto di RIGA (`Td`/`TD` con `ty` â‰  0) e un passo
 *    orizzontale dentro la riga (`ty` = 0, che Ã¨ solo il run successivo, Â§26.129).
 *
 * Tutto il resto (grafica, colori, immagini) si salta: serve una data, non un
 * renderer. Nessuna eccezione in uscita. Guardia: `npm run test:pdf-testo`.
 */

import type { MappaFont } from './pdfCmap.ts';

/** Escape di una stringa PDF: `\(`, `\\`, `\n`, ottali (`\050`). */
function leggiEscape(testo: string, i: number): [string, number] {
  const c = testo[i + 1];
  if (c === undefined) return ['', i + 1];
  const semplici: Record<string, string> = {
    n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\',
  };
  if (c in semplici) return [semplici[c], i + 2];
  if (c === '\r') return ['', testo[i + 2] === '\n' ? i + 3 : i + 2];
  if (c === '\n') return ['', i + 2];
  const ottale = /^[0-7]{1,3}/.exec(testo.slice(i + 1, i + 4));
  if (ottale) return [String.fromCharCode(parseInt(ottale[0], 8)), i + 1 + ottale[0].length];
  return [c, i + 2];
}

/** Stringa letterale `( â€¦ )`, con parentesi annidate ed escape. */
export function leggiLetterale(testo: string, inizio: number): { valore: string; fine: number } {
  let i = inizio + 1;
  let livello = 1;
  let out = '';
  while (i < testo.length) {
    const c = testo[i];
    if (c === '\\') {
      const [pezzo, dopo] = leggiEscape(testo, i);
      out += pezzo;
      i = dopo;
      continue;
    }
    if (c === '(') {
      livello += 1;
      i += 1;
      continue;
    }
    if (c === ')') {
      livello -= 1;
      if (livello === 0) return { valore: out, fine: i + 1 };
      i += 1;
      continue;
    }
    out += c;
    i += 1;
  }
  return { valore: out, fine: testo.length };
}

/** Byte di una stringa esadecimale PDF (`<0035 0036>`) come caratteri latin1. */
export function byteDaHex(hex: string): string {
  const pulito = hex.replace(/[^0-9A-Fa-f]/g, '');
  let out = '';
  for (let i = 0; i + 2 <= pulito.length; i += 2) {
    out += String.fromCharCode(parseInt(pulito.slice(i, i + 2), 16));
  }
  return out;
}

/**
 * Byte â†’ caratteri con la CMap del font in uso. Senza CMap si restituisce la
 * stringa cosÃ¬ com'Ã¨: nei PDF con font standard (`WinAnsi`) Ã¨ giÃ  leggibile.
 */
export function decodifica(bytes: string, font: MappaFont): string {
  if (font.mappa.size === 0) return bytes;
  const passo = font.dueByte ? 2 : 1;
  let out = '';
  for (let i = 0; i + passo <= bytes.length; i += passo) {
    const codice =
      passo === 2 ? (bytes.charCodeAt(i) << 8) | bytes.charCodeAt(i + 1) : bytes.charCodeAt(i);
    out += font.mappa.get(codice) ?? '';
  }
  return out;
}

/** Array `TJ`: stringhe e crenature; un salto â‰¤ -100 vale uno spazio. */
function leggiArray(
  testo: string,
  inizio: number,
  font: MappaFont,
  emetti: (pezzo: string) => void,
): { fine: number } {
  let i = inizio + 1;
  while (i < testo.length && testo[i] !== ']') {
    const c = testo[i];
    if (c === '(') {
      const { valore, fine } = leggiLetterale(testo, i);
      emetti(decodifica(valore, font));
      i = fine;
      continue;
    }
    if (c === '<' && testo[i + 1] !== '<') {
      const fine = testo.indexOf('>', i);
      if (fine === -1) break;
      emetti(decodifica(byteDaHex(testo.slice(i + 1, fine)), font));
      i = fine + 1;
      continue;
    }
    const numero = /^-?\d+(?:\.\d+)?/.exec(testo.slice(i, i + 12));
    if (numero) {
      if (Number(numero[0]) <= -100) emetti(' ');
      i += numero[0].length;
      continue;
    }
    i += 1;
  }
  return { fine: i + 1 };
}

/**
 * Interpreta un content stream: stringhe `Tj`/`TJ`, fine riga (`Td`, `T*`, `ET`)
 * e cambi font (`/F1 9.5 Tf`). Tutto il resto (grafica, colori) si salta.
 */

/** Oltre questo salto VERTICALE (in punti) il testo va a capo. */
const SOGLIA_SALTO_VERTICALE = 0.5;

/**
 * Che cosa separa questo operatore di posizionamento (Â§26.129).
 *
 * `Td`/`TD` portano `tx ty` **relativi**, `Tm` porta la matrice `a b c d e f`
 * (posizione assoluta: `e f` = x y). In entrambi i casi conta la COORDINATA
 * VERTICALE: a paritÃ  di y il testo resta sulla stessa riga, e la separazione Ã¨
 * un passo orizzontale. I PDF generati da Word (e timbrati da PadES/Aruba)
 * scrivono ogni frammento in un blocco `BT â€¦ Tm â€¦ TJ â€¦ ET` suo: con un `\n` per
 * ogni operatore la data Â«05/11/2026Â» diventava tre righe e nessuna scadenza era
 * piÃ¹ leggibile. Misurato il 31/10/2026 sul bando A040 dell'IT Â«G. Marconi â€“
 * L. PillaÂ» di Campobasso: 1.033 blocchi di testo, **1.729 righe estratte**,
 * lunghezza media 4 caratteri, 1.588 righe sotto i 6 caratteri.
 *
 * `BT`/`ET` non separano nulla (sono solo delimitatori di oggetto di testo): si
 * emette uno spazio, che non incolla le parole e non inventa righe.
 */
function separatore(
  operatore: string,
  ultimi: readonly number[],
  ultimoY: number | null,
): string {
  if (operatore === 'Td' || operatore === 'TD') {
    const ty = ultimi[1] ?? 0;
    return Math.abs(ty) > SOGLIA_SALTO_VERTICALE ? '\n' : ' ';
  }
  if (operatore === 'Tm') {
    const y = ultimi[1] ?? null;
    if (y === null || ultimoY === null) return '\n';
    return Math.abs(y - ultimoY) > SOGLIA_SALTO_VERTICALE ? '\n' : ' ';
  }
  if (operatore === 'BT' || operatore === 'ET') return ' ';
  return '\n';
}

export function testoDaContenuto(
  contenuto: string,
  font: Map<string, MappaFont>,
  predefinito?: MappaFont,
): string {
  const parti: string[] = [];
  const emetti = (pezzo: string): void => {
    if (pezzo) parti.push(pezzo);
  };
  let attuale: MappaFont = predefinito ?? { mappa: new Map(), dueByte: false };
  /** Gli ultimi due numeri letti: sono `tx ty` (`Td`) o `e f` (`Tm`). */
  const ultimi: number[] = [];
  /** Ultima ordinata vista in un `Tm`: la riga cambia solo se cambia la `y`. */
  let ultimoY: number | null = null;
  let i = 0;
  while (i < contenuto.length) {
    const c = contenuto[i];
    if (c === '%') {
      const fine = contenuto.indexOf('\n', i);
      i = fine === -1 ? contenuto.length : fine + 1;
      continue;
    }
    if (c === '(') {
      const { valore, fine } = leggiLetterale(contenuto, i);
      emetti(decodifica(valore, attuale));
      i = fine;
      continue;
    }
    if (c === '<' && contenuto[i + 1] === '<') {
      // Dizionario inline (`BDC`, `DP`): non Ã¨ testo.
      i += 2;
      continue;
    }
    if (c === '<') {
      const fine = contenuto.indexOf('>', i);
      if (fine === -1) break;
      emetti(decodifica(byteDaHex(contenuto.slice(i + 1, fine)), attuale));
      i = fine + 1;
      continue;
    }
    if (c === '[') {
      i = leggiArray(contenuto, i, attuale, emetti).fine;
      continue;
    }
    if (c === '/') {
      const selezione = /^\/([^\s/<>[\]()%]{1,64})\s+[-\d.]+\s+Tf\b/.exec(
        contenuto.slice(i, i + 160),
      );
      if (selezione) {
        attuale = font.get(selezione[1]) ?? attuale;
        i += selezione[0].length;
        continue;
      }
      i += 1;
      continue;
    }
    if (/\s/.test(c) || c === ')' || c === ']' || c === '}') {
      i += 1;
      continue;
    }
    // Operandi numerici: `Td`/`TD` ne usano due per distinguere riga da passo.
    const numero = /^[+-]?(?:\d+\.?\d*|\.\d+)/.exec(contenuto.slice(i, i + 24));
    if (numero) {
      ultimi.push(Number(numero[0]));
      if (ultimi.length > 2) ultimi.shift();
      i += numero[0].length;
      continue;
    }
    // Posizionamento del testo: separa le frasi, non le incolla.
    const operatore = /^(?:T[dDm*]|ET|BT|'|")/.exec(contenuto.slice(i, i + 2));
    if (operatore && (i === 0 || /\s/.test(contenuto[i - 1]))) {
      emetti(separatore(operatore[0], ultimi, ultimoY));
      if (operatore[0] === 'Tm' && ultimi.length === 2) ultimoY = ultimi[1];
      i += operatore[0].length;
      continue;
    }
    i += 1;
  }
  return parti.join('');
}

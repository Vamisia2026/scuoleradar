/**
 * ScuoleRadar.it — LA MAPPA DEI CARATTERI DI UN PDF (`/ToUnicode`) — §26.95.
 *
 * Perché esiste come modulo a sé: nei PDF esportati da Word/LibreOffice i
 * caratteri non sono ASCII. Il contenuto dice `<00350036>` e solo la CMap del
 * font (`/ToUnicode`) sa che `0035` è «5». Senza questa lettura un avviso
 * perfettamente leggibile per un umano è, per il crawler, un muro di byte.
 *
 * Due forme, entrambe gestite: `beginbfchar` (codice → carattere) e
 * `beginbfrange` (intervallo → carattere o lista). `dueByte` dice se i codici
 * sono a 2 byte (Identity-H, il caso dei PDF moderni).
 *
 * Nessuna dipendenza, nessuna eccezione: una CMap rotta produce una mappa vuota.
 * Guardia: `npm run test:pdf-testo`.
 */

/** Mappa di un font: codice → caratteri, e se i codici sono a 2 byte. */
export interface MappaFont {
  mappa: Map<number, string>;
  dueByte: boolean;
}

/** Hex UTF-16 (`0054 0065 0073 0074`) o a un byte (`54`) → testo. */
export function daHex(hex: string): string {
  const pulito = hex.replace(/[^0-9A-Fa-f]/g, '');
  let out = '';
  for (let i = 0; i + 4 <= pulito.length; i += 4) {
    out += String.fromCharCode(parseInt(pulito.slice(i, i + 4), 16));
  }
  if (pulito.length % 4 === 2) out += String.fromCharCode(parseInt(pulito.slice(-2), 16));
  return out;
}

/** Codici di una CMap `/ToUnicode`: `beginbfchar`, `beginbfrange`. */
export function cmapDaTesto(testo: string): MappaFont {
  const mappa = new Map<number, string>();
  let dueByte = false;
  const spazio = /begincodespacerange([\s\S]*?)endcodespacerange/i.exec(testo);
  if (spazio) dueByte = /<[0-9A-Fa-f]{3,}>/.test(spazio[1]);

  for (const blocco of testo.matchAll(/beginbfchar([\s\S]*?)endbfchar/gi)) {
    for (const m of blocco[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      mappa.set(parseInt(m[1], 16), daHex(m[2]));
      if (m[1].length >= 3) dueByte = true;
    }
  }
  for (const blocco of testo.matchAll(/beginbfrange([\s\S]*?)endbfrange/gi)) {
    const righe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<[0-9A-Fa-f]+>|\[[^\]]*\])/g;
    for (const m of blocco[1].matchAll(righe)) {
      const primo = parseInt(m[1], 16);
      const ultimo = parseInt(m[2], 16);
      if (!Number.isFinite(primo) || !Number.isFinite(ultimo) || ultimo < primo) continue;
      if (m[1].length >= 3) dueByte = true;
      // Un intervallo più lungo di 4.096 codici non è una CMap di testo.
      const quanti = Math.min(ultimo - primo, 4_096);
      if (m[3].startsWith('[')) {
        const destinazioni = [...m[3].matchAll(/<([0-9A-Fa-f]+)>/g)].map((d) => daHex(d[1]));
        for (let i = 0; i <= quanti && i < destinazioni.length; i += 1) {
          mappa.set(primo + i, destinazioni[i]);
        }
      } else {
        const base = daHex(m[3].slice(1, -1));
        const ultimoChar = base.charCodeAt(base.length - 1);
        const testa = base.slice(0, -1);
        for (let i = 0; i <= quanti; i += 1) {
          mappa.set(primo + i, `${testa}${String.fromCharCode(ultimoChar + i)}`);
        }
      }
    }
  }
  return { mappa, dueByte };
}

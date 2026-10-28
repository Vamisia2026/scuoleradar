/**
 * TEST — LETTURA DEL TESTO PDF (`src/scraper/pdfTesto.ts`, `pdfStruttura.ts`).
 *
 * Perché serve: il 26/10/2026 la misura diceva **1.300 voci senza scadenza** e
 * la maggioranza erano allegati PDF. Questa guardia fissa il contratto di
 * §26.95 su PDF COSTRUITI QUI (nessuna rete, nessun file di produzione):
 *   1. stringa letterale `( … )` → testo leggibile;
 *   2. stream `FlateDecode` → decompresso;
 *   3. font Identity-H + `/ToUnicode` → i CID diventano lettere;
 *   4. `TJ` con crenature → le parole non si incollano;
 *   5. data di PUBBLICAZIONE → nessuna scadenza inventata;
 *   6. PDF rotto, vuoto o scansionato → nessuna eccezione, solo il motivo;
 *   7. il runner USA il lettore (import + promozione albo in coda).
 *
 * Uso: npm run test:pdf-testo  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { cmapDaTesto } from '../src/scraper/pdfCmap.ts';
import { estraiTestoPdf, scadenzaDaPdf } from '../src/scraper/pdfTesto.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`,
  );
}

/* ------------------------- costruttore di PDF minimi ---------------------- */

type Parte = string | { dict: string; dati: Uint8Array };

const encoder = new TextEncoder();

function concatena(pezzi: Uint8Array[]): Uint8Array {
  const totale = pezzi.reduce((somma, pezzo) => somma + pezzo.byteLength, 0);
  const out = new Uint8Array(totale);
  let offset = 0;
  for (const pezzo of pezzi) {
    out.set(pezzo, offset);
    offset += pezzo.byteLength;
  }
  return out;
}

function pdf(parti: Parte[]): Uint8Array {
  const pezzi: Uint8Array[] = [encoder.encode('%PDF-1.7\n%\u00e2\u00e3\u00cf\u00d3\n')];
  parti.forEach((parte, i) => {
    const testa = `\n${i + 1} 0 obj\n`;
    if (typeof parte === 'string') {
      pezzi.push(encoder.encode(`${testa}${parte}\nendobj\n`));
      return;
    }
    pezzi.push(encoder.encode(`${testa}${parte.dict}\nstream\n`));
    pezzi.push(parte.dati);
    pezzi.push(encoder.encode('\nendstream\nendobj\n'));
  });
  pezzi.push(encoder.encode('\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'));
  return concatena(pezzi);
}

/** Pagina singola con il contenuto dato (byte già pronti). */
function pdfUnaPagina(contenuto: Uint8Array, dictContenuto: string, font: string): Uint8Array {
  return pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      `/Resources << /Font << /F1 ${font} >> >> /Contents 4 0 R >>`,
    { dict: dictContenuto, dati: contenuto },
  ]);
}

const FONT_TYPE1 = '5 0 R';
const OGGETTO_FONT = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

/** Frase → stringa esadecimale CID + CMap `/ToUnicode` che la rende leggibile. */
function codificaCid(frase: string): { hex: string; cmap: string } {
  const codici = new Map<string, number>();
  let hex = '';
  for (const carattere of frase) {
    if (!codici.has(carattere)) codici.set(carattere, codici.size + 1);
    hex += (codici.get(carattere) as number).toString(16).padStart(4, '0');
  }
  const righe = [...codici]
    .map(
      ([carattere, codice]) =>
        `<${codice.toString(16).padStart(4, '0')}> <${carattere
          .charCodeAt(0)
          .toString(16)
          .padStart(4, '0')}>`,
    )
    .join('\n');
  return {
    hex,
    cmap:
      '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n' +
      '/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n' +
      '1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
      `${codici.size} beginbfchar\n${righe}\nendbfchar\nendcmap\n` +
      'CMapName currentdict /CMap defineresource pop\nend\nend\n',
  };
}


/* --------------------- 1) stringa letterale, non compressa --------------- */

console.log('\n— 1. Stringa letterale in un content stream non compresso —');
const FRASE = 'Le domande vanno presentate entro le ore 12:00 del 12/11/2026';
const letterale = encoder.encode(`BT /F1 11 Tf 72 700 Td (${FRASE}) Tj ET`);
const esitoLetterale = estraiTestoPdf(pdfUnaPagina(letterale, '<< >>', FONT_TYPE1));
check('testo letto', true, esitoLetterale.testo.includes('entro le ore 12:00 del 12/11/2026'));
check('una pagina', 1, esitoLetterale.pagine);
check(
  'scadenza dal PDF',
  '2026-11-12',
  scadenzaDaPdf(pdfUnaPagina(letterale, '<< >>', FONT_TYPE1)),
);

/* ---------------- 2) stream FlateDecode (PDF della maggioranza) ---------- */

console.log('\n— 2. Stream compresso FlateDecode —');
const compresso = new Uint8Array(deflateSync(letterale));
const pdfCompresso = pdfUnaPagina(compresso, '<< /Length 999 /Filter /FlateDecode >>', FONT_TYPE1);
check('testo decompresso', true, estraiTestoPdf(pdfCompresso).testo.includes('12/11/2026'));
check('scadenza da stream compresso', '2026-11-12', scadenzaDaPdf(pdfCompresso));

/* ------------- 3) font Identity-H: i CID passano dalla /ToUnicode --------- */

console.log('\n— 3. Font Identity-H con CMap /ToUnicode —');
const cid = codificaCid(FRASE);
const contenutoCid = encoder.encode(`BT /F1 11 Tf 72 700 Td <${cid.hex}> Tj ET`);
const pdfCid = pdf([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
    '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  {
    dict: '<< /Length 999 /Filter /FlateDecode >>',
    dati: new Uint8Array(deflateSync(contenutoCid)),
  },
  '<< /Type /Font /Subtype /Type0 /BaseFont /ABCDEF+Arial /Encoding /Identity-H ' +
    '/ToUnicode 6 0 R >>',
  { dict: '<< /Length 999 >>', dati: encoder.encode(cid.cmap) },
]);
const esitoCid = estraiTestoPdf(pdfCid);
check('CID decodificati con la CMap', true, esitoCid.testo.includes('entro le ore 12:00'));
check('scadenza dal PDF Identity-H', '2026-11-12', scadenzaDaPdf(pdfCid));

/* ------------------ 4) TJ con crenature e escape nelle stringhe ---------- */

console.log('\n— 4. TJ con crenature ed escape —');
const conCrenature = encoder.encode(
  'BT /F1 11 Tf 72 700 Td [(Termine) -300 (presentazione domande:)] TJ ' +
    '(12\\/11\\/2026) Tj ET',
);
const pdfCrenature = pdfUnaPagina(conCrenature, '<< >>', FONT_TYPE1);
check(
  'parole separate',
  true,
  estraiTestoPdf(pdfCrenature).testo.includes('Termine presentazione'),
);
check('escape letto come data', '2026-11-12', scadenzaDaPdf(pdfCrenature));

/* --------------- 5) una PUBBLICAZIONE non è una scadenza ---------------- */

console.log('\n— 5. Data di pubblicazione: nessuna scadenza inventata —');
const pubblicazione = encoder.encode(
  'BT /F1 11 Tf 72 700 Td (Avviso pubblicato il 10/11/2026) Tj ET',
);
check('nessuna scadenza', null, scadenzaDaPdf(pdfUnaPagina(pubblicazione, '<< >>', FONT_TYPE1)));


/* --------------------- 6) PDF rotto, vuoto, senza pagine ----------------- */

console.log('\n— 6. Documenti non leggibili: nessuna eccezione —');
check('buffer vuoto: motivo', true, estraiTestoPdf(new Uint8Array()).motivi.length > 0);
const nonPdf = estraiTestoPdf(encoder.encode('questo non è un PDF'));
check('manca %PDF', true, nonPdf.motivi.some((m) => m.includes('%PDF')));
const senzaPagine = estraiTestoPdf(
  pdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [] /Count 0 >>',
    { dict: '<< >>', dati: letterale },
  ]),
);
check('letto senza pagina dichiarata', true, senzaPagine.testo.includes('12/11/2026'));
check('motivo dichiarato', true, senzaPagine.motivi.some((m) => m.includes('senza pagina')));
const rotto = encoder.encode('%PDF-1.7\n1 0 obj\n<< /Type /Page /Contents 9 0 R >>\nendobj\n');
check('contenuto assente non lancia', null, scadenzaDaPdf(rotto));

/* --------------------- 7) CMap a intervalli e ordine delle pagine -------- */

console.log('\n— 7. bfrange, limite di pagine e cablaggio nel runner —');
const intervallo = cmapDaTesto(
  'begincmap\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
    '1 beginbfrange\n<0030> <0039> <0030>\nendbfrange\nendcmap\n',
);
check('bfrange dueByte', true, intervallo.dueByte);
check('bfrange: 0035 → 5', '5', intervallo.mappa.get(0x35));
check('bfrange: 002f assente', undefined, intervallo.mappa.get(0x2f));

const duePagine = pdf([
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>',
  '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
  { dict: '<< >>', dati: encoder.encode('BT /F1 11 Tf 72 700 Td (Indice) Tj ET') },
  OGGETTO_FONT,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 5 0 R >> >> /Contents 8 0 R >>',
  { dict: '<< >>', dati: encoder.encode(`BT /F1 11 Tf 72 700 Td (${FRASE}) Tj ET`) },
]);
check('prima pagina senza scadenza', null, scadenzaDaPdf(duePagine, { maxPagine: 1 }));
check('seconda pagina con scadenza', '2026-11-12', scadenzaDaPdf(duePagine, { maxPagine: 2 }));

const runner = readFileSync('scripts/table-reporter.ts', 'utf8');
check('il runner importa il lettore', true, /from '\.\.\/src\/scraper\/pdfTesto\.ts'/.test(runner));
check('il runner chiama il lettore', true, /scadenzaDaPdf|estraiTestoPdf/.test(runner));
check(
  'albo verificato promosso in coda',
  true,
  /active_crawler/.test(runner) && /promuoviPaginaAlbo/.test(runner),
);

console.log(
  errori === 0 ? '\n✓ PDF: tutte le verifiche superate.' : `\n✗ PDF: ${errori} verifiche fallite.`,
);
if (errori > 0) process.exitCode = 1;

/**
 * ScuoleRadar.it — PDF Generator (layout del documento stampabile).
 *
 * Wrappa l'HTML generato da DeepSeek in un documento completo con:
 *  - logo in alto a sinistra (max 35px) + linea divisoria 1px (#e5e7eb)
 *  - solo logo e titolo: nessun testo pubblicitario o marchi aggiuntivi
 *  - piè di pagina: "Documento generato tramite ScuoleRadar.it" (sinistra)
 *    e numerazione "Pagina X di Y" (destra), via @page margin boxes
 *  - font Arial/Inter 11pt/12pt, interlinea 1.3, tabelle padding 8px e
 *    righe alternate chiarissime
 *  - indice automatico (TOC) solo per documenti stimati > 3 pagine
 */

export const LOGO_DOCUMENTO = '/ScuoleRadar Logo Transparent Full Final.png';

const STILI_DOCUMENTO = `
  @page {
    size: A4;
    margin: 22mm 14mm 20mm 14mm;
    @bottom-left {
      content: "Documento generato tramite ScuoleRadar.it";
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #94a3b8;
    }
    @bottom-right {
      content: "Pagina " counter(page) " di " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #94a3b8;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', Arial, 'Segoe UI', sans-serif;
    font-size: 12pt;
    line-height: 1.3;
    color: #0f172a;
  }
  .intestazione-documento { margin-bottom: 10px; }
  .intestazione-documento img {
    height: 35px;
    max-height: 35px;
    width: auto;
    display: block;
  }
  .divisore {
    border: none;
    border-top: 1px solid #e5e7eb;
    margin: 8px 0 20px;
  }
  h1.titolo-documento {
    font-size: 17pt;
    font-weight: 700;
    color: #0c2235;
    margin: 0 0 22px;
  }
  h2 {
    font-size: 13.5pt;
    font-weight: 700;
    color: #14354e;
    margin: 26px 0 10px;
    padding-bottom: 4px;
    border-bottom: 1px solid #eef2f7;
  }
  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #1b4768;
    margin: 18px 0 8px;
  }
  p { margin: 0 0 10px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 4px; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px;
  }
  th, td {
    padding: 8px;
    border: 1px solid #e2e8f0;
    font-size: 11pt;
    text-align: left;
    vertical-align: top;
  }
  thead th { background: #f1f5f9; font-weight: 700; color: #14354e; }
  tbody tr:nth-child(even) { background: #f9fafb; }
  .indice {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 0 0 20px;
    page-break-after: always;
  }
  .indice h2 { border: none; margin-top: 0; }
  .indice ol { margin: 0; padding-left: 20px; }
  .indice a { color: #2b6f9e; text-decoration: none; }
  strong, b { font-weight: 700; }
  @media screen {
    body { padding: 24px; }
  }
`;

export interface DocumentoPronto {
  html: string;
  pagineStimate: number;
  conIndice: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Stima indicativa delle pagine A4:
 *  - ~450 parole/pagina (12pt, interlinea 1.3)
 *  - ~4 sezioni <h2> per pagina
 * Usata per decidere l'inserimento automatico dell'indice (> 3 pagine).
 */
export function stimaPagine(contenutoHtml: string): number {
  const senzaScript = contenutoHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const testo = senzaScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parole = testo ? testo.split(' ').length : 0;
  const pagineDaParole = Math.max(1, Math.ceil(parole / 450));

  const sezioni = (contenutoHtml.match(/<h2[\s>]/gi) ?? []).length;
  const pagineDaSezioni = Math.max(1, Math.ceil(sezioni / 4));

  return Math.max(pagineDaParole, pagineDaSezioni);
}

/** Inietta un indice con collegamenti interni (ancore sui titoli h2/h3). */
function aggiungiIndice(contenutoHtml: string): string {
  const doc = new DOMParser().parseFromString(contenutoHtml, 'text/html');
  const titoli = Array.from(doc.querySelectorAll('h2, h3'));
  if (titoli.length < 3) return contenutoHtml;

  const voci: string[] = [];
  titoli.forEach((h, i) => {
    const testo = (h.textContent ?? '').replace(/\s+/g, ' ').trim() || `Sezione ${i + 1}`;
    h.id = `sezione-${i + 1}`;
    const rientro = h.tagName.toLowerCase() === 'h3' ? ' style="padding-left:12px"' : '';
    voci.push(`<li${rientro}><a href="#sezione-${i + 1}">${escapeHtml(testo)}</a></li>`);
  });

  const indice = `<nav class="indice" aria-label="Indice dei contenuti"><h2>Indice dei contenuti</h2><ol>${voci.join('')}</ol></nav>`;
  doc.body.insertAdjacentHTML('afterbegin', indice);
  return doc.body.innerHTML;
}

/**
 * Costruisce il documento HTML completo (header + titolo + indice + contenuto),
 * pronto per l'anteprima e per la stampa/conversione in PDF.
 */
export function costruisciDocumento(titolo: string, contenutoHtml: string): DocumentoPronto {
  const titoloPulito = (titolo ?? '').trim() || 'Documento ScuoleRadar';
  const pagineStimate = stimaPagine(contenutoHtml);
  const conIndice = pagineStimate > 3;
  const corpo = conIndice ? aggiungiIndice(contenutoHtml) : contenutoHtml;

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(titoloPulito)} — Documento ScuoleRadar.it</title>
<style>${STILI_DOCUMENTO}</style>
</head>
<body>
<header class="intestazione-documento">
  <img src="${LOGO_DOCUMENTO}" alt="ScuoleRadar.it" />
</header>
<hr class="divisore" />
<h1 class="titolo-documento">${escapeHtml(titoloPulito)}</h1>
<div class="contenuto-documento">${corpo}</div>
</body>
</html>`;

  return { html, pagineStimate, conIndice };
}

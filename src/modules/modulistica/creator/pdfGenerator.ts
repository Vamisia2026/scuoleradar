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
    margin: 20mm;
    @bottom-left {
      content: "Documento scaricato gratuitamente da ScuoleRadar.it";
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #64748b;
    }
    @bottom-right {
      content: "Pagina " counter(page) " di " counter(pages);
      font-family: Arial, sans-serif;
      font-size: 8pt;
      color: #64748b;
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
    border-top: 1px solid #333;
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
    border-bottom: 1px solid #cbd5e1;
  }
  h3 {
    font-size: 12pt;
    font-weight: 600;
    color: #1b4768;
    margin: 18px 0 8px;
  }
  p { margin: 0 0 10px; font-size: 12pt; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin-bottom: 4px; font-size: 12pt; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0 16px; }
  th, td {
    padding: 8px;
    border: 1px solid #333;
    font-size: 12pt;
    text-align: left;
    vertical-align: top;
  }
  thead th { background: #eef2f7; font-weight: 700; color: #0c2235; }

  /* ------- Anatomia del documento scolastico formale ------- */
  .intestazione-formale {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    page-break-inside: avoid;
  }
  .intestazione-formale td {
    border: 1px solid #333;
    padding: 8px 10px;
    font-size: 12pt;
    vertical-align: top;
  }
  .campo-etichetta {
    font-weight: 700;
    color: #111;
    width: 30%;
    background: #f4f6f8;
  }
  .riferimento-normativo {
    border: 1px solid #333;
    background: #f4f6f8;
    padding: 10px 12px;
    font-size: 11pt;
    margin: 0 0 18px;
    page-break-inside: avoid;
  }
  .quadro-anagrafico {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 16px;
    page-break-inside: avoid;
  }
  .quadro-anagrafico td {
    border: 1px solid #333;
    padding: 8px 10px;
    font-size: 12pt;
    vertical-align: top;
  }
  .crocette {
    border: 1px solid #333;
    padding: 14px 16px;
    margin: 0 0 16px;
    page-break-inside: avoid;
  }
  .crocette p { margin: 0 0 6px; font-size: 12pt; }
  .crocette .voce { display: flex; align-items: baseline; gap: 10px; margin: 0 0 6px; font-size: 12pt; }
  .casella {
    display: inline-block;
    width: 13px;
    height: 13px;
    border: 1px solid #333;
    margin-right: 8px;
    vertical-align: -2px;
    flex-shrink: 0;
  }
  .guida-compilazione {
    border: 1px solid #94a3b8;
    background: #f0f6ff;
    padding: 10px 12px;
    margin: 0 0 12px;
    font-style: italic;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1e3a5f;
    page-break-inside: avoid;
  }
  .guida-compilazione strong { font-style: normal; color: #14354e; }
  .scrittura-mano {
    min-height: 150px;
    border: 1px solid #333;
    margin: 0 0 18px;
    padding: 14px 16px;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 28px,
      #94a3b8 28px,
      #94a3b8 30px
    );
    page-break-inside: avoid;
  }
  .scrittura-mano--alta { min-height: 180px; }
  .convalida {
    border: 1px solid #333;
    padding: 12px 14px;
    margin-top: 22px;
    page-break-inside: avoid;
  }
  .convalida p { margin: 0 0 6px; font-size: 10.5pt; }
  .convalida .riga-firma { height: 30px; border-bottom: 1px dotted #333; }
  .tabella-firme {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 0;
    page-break-inside: avoid;
  }
  .tabella-firme th,
  .tabella-firme td {
    border: 1px solid #333;
    padding: 10px 12px;
    font-size: 12pt;
    vertical-align: bottom;
  }
  .tabella-firme th { background: #eef2f7; text-align: left; }
  .riga-firma { height: 40px; border-bottom: 1px dotted #333; }
  .campo-scrittura { height: 26px; border-bottom: 1px solid #94a3b8; }

  .indice {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 0 0 20px;
    page-break-after: always;
  }
  .indice h2 { border: none; margin-top: 0; }
  .indice ol { margin: 0; padding-left: 20px; }
  .indice a { color: #2b6f9e; text-decoration: none; }
  strong, b { font-weight: 700; }

  @media print {
    .scrittura-mano,
    .tabella-firme,
    .intestazione-formale,
    .quadro-anagrafico,
    .crocette,
    .riferimento-normativo,
    .guida-compilazione,
    .convalida {
      page-break-inside: avoid;
    }
    h2, h3 { page-break-after: avoid; }
  }
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

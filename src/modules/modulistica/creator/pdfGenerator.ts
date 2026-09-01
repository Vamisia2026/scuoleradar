/**
 * ScuoleRadar.it — PDF Generator (layout del documento stampabile).
 *
 * Riferimento permanente: docs/PDF_DESIGN_SYSTEM.md
 *
 * Wrappa l'HTML generato da DeepSeek in un documento completo con:
 *  - logo in alto a sinistra (42px) + linea divisoria 1px (#e5e7eb)
 *  - solo logo e titolo: nessun testo pubblicitario o marchi aggiuntivi
 *  - piè di pagina: "Documento scaricato gratuitamente da ScuoleRadar.it — Strumenti e risorse per la scuola" (sinistra)
 *    e numerazione "Pagina X di Y" (destra), via @page margin boxes
 *  - font Arial/Inter 11pt/12pt, interlinea 1.3, tabelle padding 8px e
 *    righe alternate chiarissime
 *  - indice automatico (TOC) solo per documenti stimati > 3 pagine
 */

export const LOGO_DOCUMENTO = '/logo.png';

const STILI_DOCUMENTO = `
  @page {
    size: A4;
    margin: 12mm 12mm 16mm 12mm;
    @bottom-left {
      content: "Documento scaricato gratuitamente da ScuoleRadar.it — Strumenti e risorse per la scuola";
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
    font-family: 'Inter', Roboto, Arial, Helvetica, 'Segoe UI', sans-serif;
    font-size: 10.5pt;
    line-height: 1.3;
    color: #0f172a;
  }
  .intestazione-documento { margin-bottom: 10px; }
  .intestazione-documento img {
    height: 42px;
    max-height: 42px;
    width: auto;
    display: block;
  }
  .divisore {
    border: none;
    border-top: 1px solid #333;
    margin: 8px 0 20px;
  }
  h1.titolo-documento {
    font-size: 14pt;
    font-weight: 700;
    color: #0c2235;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 11.5pt;
    font-weight: 700;
    color: #14354e;
    margin: 16px 0 8px;
    padding-bottom: 2px;
    border-bottom: 1px solid #cbd5e1;
  }
  h3 {
    font-size: 11pt;
    font-weight: 600;
    color: #1b4768;
    margin: 12px 0 6px;
  }
  p { margin: 0 0 5px; font-size: 10pt; }
  ul, ol { margin: 0 0 6px; padding-left: 18px; }
  li { margin-bottom: 2px; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  th, td {
    padding: 8px 12px;
    min-height: 32px;
    border: 1px solid #d1d5db;
    font-size: 10pt;
    text-align: left;
    vertical-align: top;
  }
  thead th { background: #f8f9fa; font-weight: 700; color: #0c2235; }

  /* ------- Anatomia del documento scolastico formale (layout 2 colonne) ------- */
  .intestazione-formale,
  .quadro-anagrafico {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 20px;
    page-break-inside: avoid;
  }
  .intestazione-formale td,
  .quadro-anagrafico td {
    padding: 10px 12px;
    min-height: 32px;
    font-size: 10pt;
    vertical-align: middle;
  }
  /* Etichette: colonna sinistra stretta ma mai spezzata (nowrap), campi con riga sottile. */
  .campo-etichetta {
    width: 34%;
    min-width: 34%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-weight: 600;
    color: #374151;
    background: #f8f9fa;
    border: 1px solid #d1d5db;
  }
  .campo-compilazione {
    border-bottom: 1px solid #d1d5db;
  }
  /* Voci descrittive (4 Dimensioni ICF, Assi/Macro-Aree, obiettivi minimi):
     box di scrittura da 90-120px per la grafia a mano. */
  .quadro-descrittivo td.campo-compilazione {
    vertical-align: top;
  }
  .quadro-descrittivo td.campo-compilazione .campo-scrittura {
    min-height: 100px;
    height: auto;
  }
  .riferimento-normativo {
    border: 1px solid #333;
    background: #f4f6f8;
    padding: 6px 10px;
    font-size: 10pt;
    margin: 0 0 8px;
    page-break-inside: avoid;
  }
  .crocette {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 12px;
    row-gap: 2px;
    border: 1px solid #d1d5db;
    padding: 6px 10px;
    margin: 0 0 8px;
    page-break-inside: avoid;
  }
  .crocette p { margin: 0; font-size: 10.5pt; }
  .crocette .voce { display: flex; align-items: baseline; gap: 6px; font-size: 10.5pt; }
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
    padding: 6px 10px;
    margin: 0 0 16px;
    font-style: italic;
    font-size: 9.5pt;
    line-height: 1.5;
    color: #1e3a5f;
    page-break-inside: avoid;
  }
  .guida-compilazione strong { font-style: normal; color: #14354e; }
  .scrittura-mano {
    min-height: 90px;
    margin: 0 0 18px;
    padding: 2px 0;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 23px,
      #e0e0e0 23px,
      #e0e0e0 24px
    );
    page-break-inside: avoid;
  }
  .scrittura-mano--media { min-height: 96px; }
  .scrittura-mano--alta { min-height: 120px; }
  /* BLOCCO FIRME UNICO (Single Sign Box): un solo contenitore a 2 colonne.
     Sinistra: Luogo e Data + Firma del richiedente. Destra: spazio riservato
     alla scuola (solo N° Protocollo / Data / Timbro, nessuna firma funzionario). */
  .blocco-firme {
    margin: 0 0 8px;
    page-break-inside: avoid;
    break-inside: avoid;
    page-break-before: avoid;
    break-before: avoid;
  }
  .blocco-convalida-unico {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 10px;
    border: 1px solid #cbd5e1;
    background: #fbfcfe;
    padding: 6px 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .blocco-convalida-unico p { margin: 0 0 4px; font-size: 10pt; }
  .blocco-convalida-unico .titolo-chiusura {
    font-weight: 700;
    color: #14354e;
    font-size: 10pt;
    margin-bottom: 6px;
  }
  .blocco-convalida-unico .riga-firma { height: 16px; border-bottom: 1px dotted #333; }
  .blocco-convalida-unico .chiusura-documento {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
  }
  .blocco-convalida-unico .protocollo-scuola {
    border-left: 1px solid #e5e7eb;
    padding-left: 10px;
    background: #f8f9fa;
  }
  /* Marcatore di layout forzato (classificazione rigida): nessun impatto visivo. */
  .layout-richiesto { display: none; }
  /* Chiusura dossier: firme estese + Single Sign Box + nota restano insieme e
     compatti in fondo all'ultima pagina (elimina la pagina bianca fantasma:
     niente break-before, margini ridotti e contenuto bilanciato). */
  .chiusura-dossier {
    page-break-inside: avoid;
    break-inside: avoid;
    margin-top: 0;
  }
  .chiusura-dossier .blocco-firme { margin: 0 0 4px; }
  .chiusura-dossier .blocco-convalida-unico { padding: 5px 8px; }
  .chiusura-dossier .nota-normativa { margin: 4px 0 0; }
  .chiusura-dossier .firme-estese { margin: 0 0 8px; }
  /* Due sezioni affiancate (es. Tipologia + Disponibilità) per i moduli a 1 pagina. */
  .griglia-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin: 0 0 8px;
  }
  .griglia-2 .crocette { margin: 0; }
  /* Righe guida visibili per la scrittura a mano: interlinea reale 24px, grigio discreto. */
  .righe-scrittura { margin: 0 0 18px; line-height: 1.5; }
  .righe-scrittura div {
    height: 24px;
    border-bottom: 1px solid #e0e0e0;
    margin-bottom: 6px;
  }
  /* Dichiarazione sostitutiva (DPR 445/2000): righe di compilazione spaziate ma
     calibrate per mantenere la struttura rigida a 1 pagina (Pagina 1 di 1):
     il blocco "Firma e Protocollo" non deve scivolare a pagina 2. */
  .righe-dichiarazione { margin: 8px 0 0; }
  .righe-dichiarazione div { height: 24px; margin-bottom: 6px; }
  body.layout-compatto .righe-scrittura.righe-dichiarazione div:nth-child(n+4) { display: block; }
  body.layout-compatto .righe-dichiarazione div { height: 24px; margin-bottom: 6px; }
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
  .riga-firma { height: 20px; border-bottom: 1px dotted #333; }
  .campo-scrittura { height: 22px; min-height: 22px; line-height: 1.5; }
  /* Campi a testo libero AMPI: 4-6 righe di scrittura reale. */
  .campo-scrittura-ampio div {
    height: 24px;
    min-height: 24px;
    line-height: 1.5;
    border-bottom: 1px solid #e0e0e0;
  }
  .nota-normativa {
    font-size: 8pt;
    color: #64748b;
    line-height: 1.4;
    margin: 6px 0 0;
  }
  /* Micro-copy informativo sopra le firme: riga discreta e umana. */
  .micro-copy {
    font-size: 9pt;
    color: #475569;
    font-style: italic;
    margin: 0 0 6px;
  }
  /* Formula giuridica delle dichiarazioni sostitutive (DPR 445/2000). */
  .formula-dichiarazione {
    font-size: 10pt;
    line-height: 1.5;
    color: #1f2937;
    margin: 0 0 10px;
  }
  /* Firme con ruoli (verbali, scrutini): righe compatte distinte dal blocco richiedente. */
  .firme-ruoli {
    border: 1px solid #333;
    padding: 8px 10px;
    margin: 0 0 8px;
    page-break-inside: avoid;
  }
  .firme-ruoli p { margin: 0 0 8px; font-size: 10.5pt; }
  .firme-ruoli .riga-firma { height: 20px; }

  /* ------- Regola d'oro 1 — Densità dinamica (A4 single vs double page) ------- */
  /* Modulo compatto (<6 sezioni): 1 pagina, padding minimi, righe di scrittura max 3. */
  body.layout-compatto h2 { margin: 10px 0 5px; }
  body.layout-compatto .crocette { padding: 4px 6px; }
  body.layout-compatto .intestazione-formale td,
  body.layout-compatto .quadro-anagrafico td { padding: 8px 12px; }
  body.layout-compatto .righe-scrittura div { margin-bottom: 4px; }
  body.layout-compatto .righe-scrittura div:nth-child(n+4) { display: none; }
  body.layout-compatto .scrittura-mano { min-height: 64px; }
  body.layout-compatto .scrittura-mano--media { min-height: 80px; }
  body.layout-compatto .scrittura-mano--alta { min-height: 100px; }
  body.layout-compatto .chiusura-documento,
  body.layout-compatto .convalida { padding: 5px 8px; }
  body.layout-compatto .chiusura-documento .riga-firma,
  body.layout-compatto .convalida .riga-firma,
  body.layout-compatto .firme-ruoli .riga-firma { height: 18px; }
  body.layout-compatto .campo-scrittura { height: 18px; min-height: 18px; }
  body.layout-compatto .blocco-convalida-unico { padding: 3px 6px; }
  body.layout-compatto .blocco-convalida-unico p { margin-bottom: 3px; }
  body.layout-compatto .blocco-convalida-unico .titolo-chiusura { margin-bottom: 4px; }
  body.layout-compatto .blocco-convalida-unico .riga-firma { height: 13px; }
  /* Modulo esteso (≥6 sezioni, es. PEI/PDP/Ricorsi): 2 pagine con spazio omogeneo. */
  body.layout-esteso .scrittura-mano { min-height: 110px; }
  body.layout-esteso .scrittura-mano--media { min-height: 170px; }
  body.layout-esteso .scrittura-mano--alta { min-height: 210px; }
  body.layout-esteso .righe-scrittura div { margin-bottom: 16px; line-height: 1.6; }
  body.layout-esteso .crocette { padding: 8px 10px; }
  body.layout-esteso { line-height: 1.6; }
  body.layout-esteso h2 { margin: 22px 0 10px; }
  body.layout-esteso h3 { margin: 16px 0 6px; }
  body.layout-esteso .intestazione-formale td,
  body.layout-esteso .quadro-anagrafico td { padding: 10px 12px; min-height: 32px; }
  /* Respirabilità: 18-24px di distanza tra i blocchi dei documenti estesi. */
  body.layout-esteso .quadro-anagrafico { margin: 0 0 22px; }
  body.layout-esteso .crocette,
  body.layout-esteso .scrittura-mano,
  body.layout-esteso .riferimento-normativo,
  body.layout-esteso .guida-compilazione,
  body.layout-esteso .righe-scrittura,
  body.layout-esteso .firme-ruoli { margin-bottom: 20px; }
  body.layout-esteso .campo-scrittura-ampio div { margin-bottom: 14px; line-height: 1.6; }
  body.layout-esteso .firme-estese {
    padding: 10px 12px;
    margin: 0 0 8px;
  }
  body.layout-esteso .firme-estese p { margin-bottom: 10px; }
  body.layout-esteso .firme-estese .riga-firma { height: 24px; }
  body.layout-esteso .blocco-convalida-unico { padding: 8px 10px; }
  body.layout-esteso .blocco-convalida-unico .riga-firma { height: 18px; }

  .indice {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 14px 18px;
    margin: 0 0 20px;
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
    .blocco-firme,
    .blocco-convalida-unico,
    .chiusura-documento,
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
  /** Regola d'oro 1 — densità dinamica: 'compatto' (1 pagina) o 'esteso' (2 pagine). */
  layout: 'compatto' | 'esteso';
}

/**
 * Regola d'oro 1 — Algoritmo di densità dinamica:
 * pesa il modulo contando le sezioni <h2> e decide il layout.
 *  - meno di 6 sezioni → `layout-compatto` (DEVE stare in 1 pagina A4);
 *  - 6 o più sezioni (PEI, PDP, Ricorsi complessi) → `layout-esteso` (2 pagine omogenee).
 *
 * Classificazione RIGIDA: se il corpo contiene un marcatore
 * `data-layout="compatto|esteso"` (documenti pedagogici/inclusivi forzati a
 * esteso, moduli rapidi forzati a compatto), questo ha precedenza sull'euristica.
 */
export function calcolaLayout(contenutoHtml: string): 'compatto' | 'esteso' {
  const richiesto = contenutoHtml.match(/data-layout="(compatto|esteso)"/)?.[1];
  if (richiesto === 'compatto' || richiesto === 'esteso') return richiesto;
  const sezioni = (contenutoHtml.match(/<h2[\s>]/gi) ?? []).length;
  return sezioni < 6 ? 'compatto' : 'esteso';
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
 * Stima indicativa delle pagine A4 (layout compatto 10-11pt):
 *  - ~600 parole/pagina
 *  - ~6 sezioni <h2> per pagina (griglie, righe sottili, spazi ridotti)
 * Usata per decidere l'inserimento automatico dell'indice (solo > 3 pagine).
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
  const pagineDaParole = Math.max(1, Math.ceil(parole / 600));

  const sezioni = (contenutoHtml.match(/<h2[\s>]/gi) ?? []).length;
  const pagineDaSezioni = Math.max(1, Math.ceil(sezioni / 6));

  const stima = Math.max(pagineDaParole, pagineDaSezioni);

  // Classificazione rigida: i documenti estesi (pedagogici/inclusivi, marcati
  // con data-layout="esteso") non possono essere stimati a meno del minimo
  // garantito (data-min-pagine, es. PEI/PDP/relazioni/verbali GLO → 5 pagine).
  const minPagine = Number(contenutoHtml.match(/data-min-pagine="(\d+)"/)?.[1] ?? 0);
  if (minPagine > 0) return Math.max(stima, minPagine);
  return stima;
}

/** Inietta un indice con collegamenti interni alle SOLO macro-sezioni h2
 * (max ~10-15 voci; le sotto-sezioni h3 non compaiono nell'indice). */
function aggiungiIndice(contenutoHtml: string): string {
  // In ambienti senza DOM (es. test Node/tsx) l'indice viene saltato.
  if (typeof DOMParser === 'undefined') return contenutoHtml;
  const doc = new DOMParser().parseFromString(contenutoHtml, 'text/html');
  const titoli = Array.from(doc.querySelectorAll('h2'));
  if (titoli.length < 3) return contenutoHtml;

  const voci: string[] = [];
  titoli.forEach((h, i) => {
    const testo = (h.textContent ?? '').replace(/\s+/g, ' ').trim() || `Sezione ${i + 1}`;
    h.id = `sezione-${i + 1}`;
    voci.push(`<li><a href="#sezione-${i + 1}">${escapeHtml(testo)}</a></li>`);
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
  const layout = calcolaLayout(contenutoHtml);

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(titoloPulito)} — Documento ScuoleRadar.it</title>
<style>${STILI_DOCUMENTO}</style>
</head>
<body class="${layout}">
<header class="intestazione-documento">
  <img src="${LOGO_DOCUMENTO}" alt="ScuoleRadar.it" />
</header>
<hr class="divisore" />
<h1 class="titolo-documento">${escapeHtml(titoloPulito)}</h1>
<div class="contenuto-documento">${corpo}</div>
</body>
</html>`;

  return { html, pagineStimate, conIndice, layout };
}

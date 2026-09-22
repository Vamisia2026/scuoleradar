/**
 * Modulistica · stili del documento — parte 1/4: foglio, tipografia, anatomia.
 *
 * Estratto da `pdfGenerator.ts` (il CSS era un unico template literal di ~590
 * righe). Qui: impostazioni del foglio A4, tipografia Arial/Inter, intestazione
 * con logo, anatomia del documento formale a 2 colonne e spazi di scrittura.
 *
 * Le parti sono concatenate da `stiliDocumento.ts`: NON aggiungere o togliere
 * righe vuote in testa/coda, altrimenti cambia il CSS finale (verificato con i
 * test `npm run test:pdf*`, che confrontano i documenti generati).
 */
export const STILI_BASE = `
  /* Impostazioni foglio A4. Nessun "margin box" @page: i browser non li
     stampano in modo affidabile. Margini 15mm con body-padding a piè di
     pagina: il footer ufficiale di ScuoleRadar è disegnato NEL documento e
     si ripete su ogni pagina (fixed in @media print). I metadati del browser
     (timestamp, URL, titolo "localhost:…") non entrano nel layout e i
     margini @page lasciano pulito il foglio. */
  @page {
    size: A4;
    margin: 15mm;
  }
  @media print {
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { padding: 0 0 11mm 0; }
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
    min-height: 92px;
    margin: 0 0 18px;
    padding: 2px 0;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 27px,
      #ccc 27px,
      #ccc 28px
    );
    page-break-inside: avoid;
  }
  .scrittura-mano--media { min-height: 96px; }
  .scrittura-mano--alta { min-height: 120px; }`;

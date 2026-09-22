/**
 * Modulistica · stili del documento — parte 4/4: stampa e moduli bipartiti.
 *
 * Estratto da `pdfGenerator.ts`. Qui: Regola d'oro 6 (box di scrittura guidati,
 * tabella firme del GLO, chiusura istituzionale), footer ufficiale ripetuto su
 * ogni pagina, firme bipartite (cambio turno, verbali) e stampa pulita
 * «Atto Pubblico» con margini uniformi.
 *
 * Concatenata da `stiliDocumento.ts`: le righe vuote di testa/coda fanno parte
 * del CSS, non riformattarle.
 */
export const STILI_STAMPA = `
  /* ============ REGOLA D'ORO 6 — STAMPA & BOX DI SCRITTURA GUIDATI ============
     Struttura a riquadri per i campi di scrittura (ICF, nuclei fondanti,
     obiettivi minimi/differenziati): bordo discreto + micro-prompt grigio
     inline + righe di grafia a mano. Mai spazi bianchi aperti. */
  .spazio-scrittura {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    background: #fcfdff;
    padding: 8px 12px 2px;
    margin: 0 0 18px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .spazio-scrittura .micro-prompt {
    margin-bottom: 6px;
    color: #8593a3;
  }
  .spazio-scrittura .righe-scrittura { margin: 2px 0 0; }
  .spazio-scrittura .righe-scrittura div {
    height: 28px;
    margin: 0 0 3px;
    border-bottom: 1px solid #ccc;
  }
  .campo-scrittura-ampio .micro-prompt {
    color: #8593a3;
    font-size: 8pt;
    font-style: italic;
    line-height: 1.35;
    margin: 0 0 3px;
  }

  /* Tabella firme FORMALE del GLO (pagina di chiusura PEI/verbali):
     ruoli a sinistra, righe di firma leggibile e data nelle colonne. */
  .firme-concertate td {
    height: auto;
    padding: 10px 10px 4px;
    vertical-align: top;
  }
  .firme-concertate td:first-child {
    width: 34%;
    font-weight: 600;
    color: #334155;
    font-size: 9pt;
  }
  .firme-concertate .riga-firma {
    display: block;
    margin-top: 16px;
  }

  /* Chiusura istituzionale elegante in calce all'ultima pagina (esteso). */
  .footer-documento {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 26px;
    padding-top: 8px;
    border-top: 1px solid #cbd5e1;
    font-size: 8pt;
    color: #64748b;
    line-height: 1.4;
  }
  .footer-documento strong { color: #334155; }

  /* Footer ufficiale ScuoleRadar: testo esatto, presente in OGNI documento.
     A schermo è un blocco statico a fine documento (visibile in anteprima);
     in stampa diventa fisso e si ripete su ogni pagina. */
  .pie-documento-fisso {
    display: block;
    position: static;
    text-align: center;
    margin-top: 22px;
    padding-top: 6px;
    border-top: 0.5pt solid #cbd5e1;
    font-size: 7.5pt;
    color: #64748b;
    line-height: 1.35;
  }

  /* Blocco firme "bipartito" per i moduli con DUE sottoscrittori (es. cambio
     turno: Richiedente + Sostituto; verbale: Segretario + Coordinatore). */
  .firme-bipartite {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 10px;
    border: 1px solid #cbd5e1;
    background: #fbfcfe;
    padding: 8px 10px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .firme-bipartite .riquadro-firma {
    border: none;
    background: none;
    padding: 0;
    margin: 0;
  }
  .firme-bipartite .riquadro-firma + .riquadro-firma {
    border-left: 1px solid #e5e7eb;
    padding-left: 10px;
  }
  .firme-bipartite p { margin: 0 0 6px; font-size: 10pt; }
  .firme-bipartite .titolo-firma { font-weight: 700; color: #14354e; }
  .firme-bipartite .riga-firma { display: block; height: 26px; margin-top: 18px; }

  @media print {
    /* Stampa pulita "Atto Pubblico": margine uniforme 15mm e NESSUNA richiesta
       di metadati browser (data/ora, URL, numerazione del dialogo di stampa)
       nei margini. Il footer ufficiale è disegnato nel documento e si ripete
       su ogni pagina tramite posizionamento fisso. */
    @page {
      size: A4;
      margin: 15mm;
    }
    .pie-documento-fisso {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      margin-top: 0;
      text-align: center;
      font-size: 7.5pt;
      color: #64748b;
      line-height: 1.35;
      padding: 1.5mm 0 0;
      border-top: 0.5pt solid #cbd5e1;
      background: #fff;
    }
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
    /* Atto Pubblico pulito: nessun timestamp/URL/header browser o rumore di
       debug nella stampa; colori di sfondo fedeli all'anteprima. */
    .no-print,
    .browser-header,
    .browser-footer,
    .debug,
    .debug-info,
    [data-debug] { display: none !important; }
    body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
  @media screen {
    body { padding: 24px; }
  }`;

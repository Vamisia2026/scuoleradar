/**
 * Modulistica · stili del documento — parte 2/4: blocchi, firme, scrittura.
 *
 * Estratto da `pdfGenerator.ts`. Qui: blocco firme unico (Single Sign Box),
 * marcatore di layout forzato, sezioni affiancate, righe guida per la scrittura
 * a mano, dichiarazioni sostitutive (DPR 445/2000) e campi a testo libero.
 *
 * Concatenata da `stiliDocumento.ts`: le righe vuote di testa/coda fanno parte
 * del CSS, non riformattarle.
 */
export const STILI_BLOCCHI = `
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
  /* Righe guida visibili per la scrittura a mano: altezza reale 28px (minimo
     ergonomico), riga orizzontale discreta #ccc — mai testo precaricato. */
  .righe-scrittura { margin: 0 0 18px; line-height: 1.5; }
  .righe-scrittura div {
    height: 28px;
    min-height: 28px;
    border-bottom: 1px solid #ccc;
    margin: 0 0 2px;
  }
  /* Dichiarazione sostitutiva (DPR 445/2000): righe di compilazione spaziate ma
     calibrate per mantenere la struttura rigida a 1 pagina (Pagina 1 di 1):
     il blocco "Firma e Protocollo" non deve scivolare a pagina 2. */
  .righe-dichiarazione { margin: 8px 0 0; }
  .righe-dichiarazione div { height: 28px; min-height: 28px; margin-bottom: 2px; }
  body.layout-compatto .righe-scrittura.righe-dichiarazione div:nth-child(n+4) { display: block; }
  body.layout-compatto .righe-dichiarazione div { height: 28px; margin-bottom: 2px; }
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
  .riga-firma { height: 28px; min-height: 28px; border-bottom: 1px dotted #333; }
  .campo-scrittura { height: 28px; min-height: 28px; line-height: 1.5; }
  /* Campi a testo libero AMPI: righe di scrittura reali da 28px. */
  .campo-scrittura-ampio div {
    height: 28px;
    min-height: 28px;
    line-height: 1.5;
    border-bottom: 1px solid #ccc;
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
`;

/**
 * Modulistica · stili del documento — parte 3/4: densità dinamica e inclusione.
 *
 * Estratto da `pdfGenerator.ts`. Qui: Regola d'oro 1 (modulo compatto vs
 * documento esteso, respirabilità dei blocchi) e Regola d'oro 3 (inclusione
 * D.Lgs 66/2017 · D.I. 182/2020: micro-prompt, dimensioni ICF, responsabilità
 * condivise, presa d'atto).
 *
 * Concatenata da `stiliDocumento.ts`: le righe vuote di testa/coda fanno parte
 * del CSS, non riformattarle.
 */
export const STILI_DENSITA = `
  /* ------- Regola d'oro 1 — Densità dinamica (A4 single vs double page) ------- */
  /* Modulo compatto (<6 sezioni): 1 pagina, padding minimi, righe di scrittura max 3. */
  body.layout-compatto h2 { margin: 10px 0 5px; }
  body.layout-compatto .crocette { padding: 4px 6px; }
  body.layout-compatto .intestazione-formale td,
  body.layout-compatto .quadro-anagrafico td { padding: 8px 12px; }
  body.layout-compatto .righe-scrittura div { margin-bottom: 2px; }
  body.layout-compatto .righe-scrittura div:nth-child(n+4) { display: none; }
  body.layout-compatto .scrittura-mano { min-height: 72px; }
  body.layout-compatto .scrittura-mano--media { min-height: 88px; }
  body.layout-compatto .scrittura-mano--alta { min-height: 108px; }
  body.layout-compatto .chiusura-documento,
  body.layout-compatto .convalida { padding: 5px 8px; }
  body.layout-compatto .chiusura-documento .riga-firma,
  body.layout-compatto .convalida .riga-firma,
  body.layout-compatto .firme-ruoli .riga-firma { height: 26px; }
  body.layout-compatto .campo-scrittura { height: 28px; min-height: 28px; }
  body.layout-compatto .blocco-convalida-unico { padding: 3px 6px; }
  body.layout-compatto .blocco-convalida-unico p { margin-bottom: 3px; }
  body.layout-compatto .blocco-convalida-unico .titolo-chiusura { margin-bottom: 4px; }
  body.layout-compatto .blocco-convalida-unico .riga-firma { height: 22px; }
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

  /* ============ REGOLA D'ORO 3 — INCLUSIONE (D.Lgs 66/2017 · D.I. 182/2020) ============
     Famiglia A2: PEI, Verbali GLO, PDP, richieste sostegno. Documenti estesi,
     rigorosi e legalmente difendibili: spazi di scrittura generosi sulle
     dimensioni ICF, micro-prompt discreti e responsabilità esplicite. */

  /* Micro-prompt: suggerimento grigio, non invadente, dentro gli spazi di
     scrittura (mai box blu "da compilare": guida discreta per il docente). */
  .micro-prompt {
    color: #94a3b8;
    font-size: 8pt;
    font-style: italic;
    font-weight: 400;
    line-height: 1.35;
    margin: 0 0 4px;
    padding: 0;
  }
  /* Le dimensioni ICF chiave (Socializzazione/Comunicazione/Autonomia/Cognitiva)
     non vanno MAI compresse in 2-3 righe: nei documenti estesi ogni box offre
     spazio reale per la grafia a mano. */
  body.layout-esteso .spazio-scrittura { min-height: 96px; }
  body.layout-esteso .spazio-scrittura--media { min-height: 140px; }
  body.layout-esteso .spazio-scrittura--alta { min-height: 190px; }
  body.layout-esteso .quadro-descrittivo td.campo-compilazione .campo-scrittura {
    min-height: 150px;
    height: auto;
  }
  body.layout-esteso .micro-prompt { margin-bottom: 6px; }

  /* Responsabilità condivisa: Consiglio di Classe + Specialist (ASL/Neuropsi-
     chiatria) + Famiglia. Quadro firme concertate usato nei verbali GLO e nei
     documenti di inclusione per schermare legalmente la scuola. */
  .firme-concertate {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 18px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .firme-concertate th {
    background: #f8f9fa;
    border: 1px solid #d1d5db;
    padding: 7px 10px;
    font-size: 9pt;
    text-align: left;
    color: #0c2235;
  }
  .firme-concertate td {
    border: 1px solid #d1d5db;
    padding: 30px 12px 10px;
    vertical-align: bottom;
    height: 96px;
  }
  .firme-concertate .ruolo-firmatario {
    display: block;
    font-size: 8pt;
    font-weight: 600;
    color: #475569;
    margin-bottom: 5px;
  }
  .firme-concertate .riga-firma { height: 18px; border-bottom: 1px dotted #333; }
  body.layout-compatto .firme-concertate td { height: 58px; padding: 16px 8px 6px; }

  /* Presa d'atto / condivisione esplicita (es. esiti GLO, scelte condivise). */
  .presa-atto {
    border: 1px solid #cbd5e1;
    border-left: 4px solid #14354e;
    background: #f8fafc;
    padding: 10px 12px;
    margin: 0 0 14px;
    font-size: 9.5pt;
    line-height: 1.5;
    page-break-inside: avoid;
  }
  .presa-atto strong { color: #0f172a; }
`;

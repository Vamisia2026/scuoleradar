/**
 * ScuoleRadar.it — Template PRESCRITTIVI per tipologie legali-rigide.
 *
 * Questi moduli non possono usare il layout generico "uno per tutti": ogni
 * pratica ha una struttura giuridica e una responsabilità firmataria proprie.
 * I builder restituiscono il CORPO HTML completo (quadri, sezioni, firme,
 * nota normativa): `costruisciModuloFormale` li usa al posto del flusso
 * generico quando il profilo dell'intervista contiene la `pratica` giusta.
 *
 * Pratiche prescrittive coperte:
 *  - cambio_turno            → Richiesta Cambio Turno e Sostituzione
 *  - verbale_dipartimento    → Verbale Riunione di Dipartimento
 *  - congedo_l104            → Richiesta Congedo / Permessi L. 104
 */

import { escapeHtml } from './pdfGenerator';

/** Profilo dell'intervista (chiave → valore). */
type ProfiloPrescrittivo = Record<string, string>;

/** Pratiche che hanno un template prescrittivo dedicato. */
const PRATICHE_PRESCRITTIVE = new Set([
  'cambio_turno',
  'verbale_dipartimento',
  'congedo_l104',
]);

/* ---------------------------- Helpers di markup ---------------------------- */

/** Riga "etichetta → spazio di scrittura" in una tabella anagrafica. */
function riga(etichetta: string, campo = '<span class="campo-scrittura"></span>'): string {
  return `<tr>
      <td class="campo-etichetta">${escapeHtml(etichetta)}</td>
      <td class="campo-compilazione">${campo}</td>
    </tr>`;
}

/** Campo su più righe di scrittura a mano (28px l'una, bordi #ccc). */
function scrittura(righe = 4): string {
  return `<div class="righe-scrittura">${Array.from({ length: righe }, () => '<div></div>').join('')}</div>`;
}

/** Crocetta singola. */
function crocetta(testo: string, sotto?: string): string {
  const nota = sotto ? `<span class="micro-prompt"> — ${escapeHtml(sotto)}</span>` : '';
  return `<p class="voce"><span class="casella"></span>${escapeHtml(testo)}${nota}</p>`;
}

/** Blocco crocette (massimo 2 colonne). */
function crocette(voci: { testo: string; sotto?: string }[]): string {
  return `<div class="crocette">${voci.map((v) => crocetta(v.testo, v.sotto)).join('')}</div>`;
}

/** Due firme affiancate ("bipartito"), ciascuna con spazio firma dedicato. */
function firmeBipartite(
  sinistra: { titolo: string; riga: string },
  destra: { titolo: string; riga: string },
): string {
  return `<div class="firme-bipartite">
      <div class="riquadro-firma">
        <p class="titolo-firma">${escapeHtml(sinistra.titolo)}</p>
        <p>${escapeHtml(sinistra.riga)}</p>
        <span class="riga-firma"></span>
      </div>
      <div class="riquadro-firma">
        <p class="titolo-firma">${escapeHtml(destra.titolo)}</p>
        <p>${escapeHtml(destra.riga)}</p>
        <span class="riga-firma"></span>
      </div>
    </div>`;
}

/* ------------------------- Richiesta Cambio Turno ------------------------- */

function corpoCambioTurno(): string {
  return `
  <h2>Dati dello scambio</h2>
  <table class="quadro-anagrafico">
    ${riga('Docente Richiedente')}
    ${riga('Docente Sostituto (accettante)')}
    ${riga('Materia')}
    ${riga('Classe / Sezione')}
    ${riga('Sede / Plesso')}
  </table>

  <h2>Turni oggetto della richiesta</h2>
  <table class="quadro-anagrafico">
    ${riga('Data e ora del turno da cedere')}
    ${riga('Data e ora del turno di recupero')}
    ${riga('Tipologia di turno', crocette([
      { testo: 'Mattino (orario antimeridiano)' },
      { testo: 'Pomeriggio (orario meridiano/pomeridiano)' },
      { testo: 'Intero giorno' },
    ]))}
  </table>

  <h2>Accordo tra i docenti</h2>
  <p class="formula-dichiarazione">
    Il/La sottoscritto/a docente richiedente dichiara di aver concordato con il/la
    collega indicato/a la sostituzione del turno in oggetto e si impegna a garantire
    il turno di recupero alle condizioni sopra indicate. La presente richiesta è
    subordinata all\u2019autorizzazione del Dirigente Scolastico secondo il regolamento
    di Istituto e le disposizioni vigenti su turni e sostituzioni.
  </p>
  <div class="crocette">
    ${crocetta('Sostituzione concordata e senza oneri aggiuntivi per la scuola')}
    ${crocetta('Recupero del turno entro 15 giorni dal cambio', 'data da definire con la segreteria')}
  </div>

  <div class="chiusura-dossier">
    <p class="micro-copy">Da consegnare alla segreteria almeno 48 ore prima del turno da cedere, salvo urgenze documentate.</p>
    ${firmeBipartite(
      { titolo: 'Firma del Richiedente', riga: 'Docente richiedente (leggibile)' },
      { titolo: 'Firma del Docente Accettante / Sostituto', riga: 'Docente sostituto (leggibile)' },
    )}
    <p class="nota-normativa">Riferimenti: CCNL Istruzione e Ricerca vigente, regolamento di Istituto, circolari interne su turni e sostituzioni. Documento rilasciato da ScuoleRadar.it.</p>
  </div>`;
}

/* ---------------------- Verbale Riunione di Dipartimento ---------------------- */

function corpoVerbaleDipartimento(): string {
  return `
  <div class="layout-richiesto" data-layout="esteso" data-min-pagine="4"></div>

  <h2>Dati della riunione</h2>
  <table class="quadro-anagrafico">
    ${riga('Dipartimento disciplinare')}
    ${riga('Data e ora della riunione')}
    ${riga('Luogo / modalità (in presenza, videoconferenza, mista)')}
    ${riga('Coordinatore / Presidente')}
    ${riga('Segretario verbalizzante')}
  </table>

  <h2>Ordine del Giorno (OdG)</h2>
  <p class="micro-copy">Elencare i punti all\u2019ordine del giorno comunicati con la convocazione.</p>
  ${scrittura(5)}

  <h2>Docenti presenti</h2>
  <p class="micro-copy">Indicare cognome e nome di ciascun docente presente alla riunione.</p>
  ${scrittura(5)}

  <h2>Docenti assenti</h2>
  <p class="micro-copy">Indicare i docenti assenti e, se nota, la motivazione (giustificata / non giustificata).</p>
  ${scrittura(4)}

  <h2>Sintesi della discussione</h2>
  <p class="micro-copy">Per ogni punto all\u2019OdG: interventi, osservazioni e posizioni emerse durante il confronto.</p>
  ${scrittura(8)}

  <h2>Delibere / Decisioni approvate</h2>
  <table class="quadro-anagrafico">
    ${riga('Delibera n. 1 — Oggetto')}
    ${riga('Esito (approvata all\u2019unanimità / a maggioranza)', crocette([
      { testo: 'Approvata all\u2019unanimità' },
      { testo: 'Approvata a maggioranza', sotto: 'indicare i contrari e gli astenuti' },
    ]))}
    ${riga('Delibera n. 2 — Oggetto')}
    ${riga('Esito (approvata all\u2019unanimità / a maggioranza)')}
    ${riga('Allegati alla delibera', crocette([
      { testo: 'Schede / materiali predisposti' },
      { testo: 'Programmazione dipartimentale' },
      { testo: 'Altro (specificare)' },
    ]))}
  </table>

  <div class="chiusura-dossier">
    <p class="micro-copy">Il presente verbale viene affisso e conservato agli atti del Dipartimento e dell\u2019Istituto.</p>
    ${firmeBipartite(
      { titolo: 'Firma del Segretario', riga: 'Segretario verbalizzante (leggibile)' },
      { titolo: 'Firma del Coordinatore', riga: 'Coordinatore di Dipartimento (leggibile)' },
    )}
    <p class="nota-normativa">Riferimenti: D.P.R. 275/1999 (autonomia scolastica), D.Lgs. 297/1994, regolamento di Istituto, disposizioni del Dirigente Scolastico sugli organi collegiali. Documento rilasciato da ScuoleRadar.it.</p>
  </div>`;
}

/* ---------------------- Richiesta Congedo / Permessi L. 104 ---------------------- */

function corpoCongedoL104(): string {
  return `
  <h2>Dati del dipendente</h2>
  <table class="quadro-anagrafico">
    ${riga('Cognome e Nome')}
    ${riga('Ruolo / profilo professionale (docente / ATA)')}
    ${riga('Sede di servizio / Istituto')}
    ${riga('Contatto (telefono / email)')}
  </table>

  <h2>Tipo di permesso richiesto</h2>
  ${crocette([
    { testo: 'Permesso giornaliero ex art. 33, comma 3, L. 104/1992', sotto: 'fino a 3 giorni al mese, retribuito' },
    { testo: 'Permesso ad ore', sotto: 'frazionabile secondo le disposizioni contrattuali' },
    { testo: 'Congedo straordinario biennale', sotto: 'art. 42, comma 5, D.Lgs. 151/2001 per assistenza a disabile grave' },
  ])}
  <table class="quadro-anagrafico">
    ${riga('Periodo richiesto — dal (giorno / mese / anno)')}
    ${riga('Periodo richiesto — al (giorno / mese / anno)')}
    ${riga('Orario di uscita / rientro per il permesso ad ore')}
  </table>

  <h2>Familiare assistito</h2>
  <p class="micro-copy">
    Indicare i dati del familiare assistito. I dati sensibili sono trattati nel
    rispetto del Regolamento (UE) 2016/679 (GDPR) e del D.Lgs. 196/2003: il
    modulo non richiede né conserva la diagnosi o la certificazione.
  </p>
  <table class="quadro-anagrafico">
    ${riga('Nome del familiare assistito')}
    ${riga('Grado di parentela', crocette([
      { testo: 'Coniuge / parte dell\u2019unione civile' },
      { testo: 'Figlio/a' },
      { testo: 'Genitore' },
      { testo: 'Fratello / sorella' },
      { testo: 'Convivente di fatto' },
      { testo: 'Altro familiare (specificare)' },
    ]))}
    ${riga('Recapito del familiare (solo se necessario per le comunicazioni)')}
  </table>

  <h2>Dichiarazione di unicità dell\u2019assistenza</h2>
  <p class="formula-dichiarazione">
    Il/La sottoscritto/a dichiara, ai sensi degli artt. 46 e 47 del D.P.R. 445/2000,
    consapevole delle sanzioni penali previste dall\u2019art. 76 del medesimo decreto
    per le dichiarazioni mendaci, di essere l\u2019unica persona che usufruisce di
    permessi o congedi per l\u2019assistenza al familiare sopra indicato, salvo il caso
    di assistenza condivisa nei termini previsti dalla legge.
  </p>
  ${crocette([
    { testo: 'Il richiedente dichiara l\u2019unicità dell\u2019assistenza' },
    { testo: 'Il richiedente dichiara l\u2019assistenza condivisa', sotto: 'indicare altro beneficiario se noto' },
  ])}

  <div class="chiusura-dossier">
    <p class="micro-copy">Allegare copia del verbale di accertamento della disabilità grave (art. 3, comma 3, L. 104/1992) quando richiesto dalla segreteria. La comunicazione mensile all\u2019INPS resta a carico dell\u2019Istituto nei termini di legge.</p>
    ${firmeBipartite(
      { titolo: 'Firma del Richiedente', riga: 'Dipendente (leggibile)' },
      { titolo: 'Riservato all\u2019Ufficio del Personale', riga: 'Protocollo / Data / Timbro' },
    )}
    <p class="nota-normativa">Riferimenti: L. 104/1992, art. 33; D.Lgs. 151/2001, art. 42; D.P.R. 445/2000; CCNL Scuola vigente; Reg. UE 2016/679 (GDPR). Documento rilasciato da ScuoleRadar.it.</p>
  </div>`;
}

/* ------------------------------- Dispatcher ------------------------------- */

/**
 * Restituisce il corpo HTML prescrittivo se il profilo richiede una delle
 * pratiche coperte; altrimenti `null` (il flusso generico prosegue).
 */
export function costruisciCorpoPrescrittivo(profilo?: ProfiloPrescrittivo): string | null {
  const pratica = profilo?.pratica;
  if (!pratica || !PRATICHE_PRESCRITTIVE.has(pratica)) return null;
  switch (pratica) {
    case 'cambio_turno':
      return corpoCambioTurno();
    case 'verbale_dipartimento':
      return corpoVerbaleDipartimento();
    case 'congedo_l104':
      return corpoCongedoL104();
    default:
      return null;
  }
}

/** Indica se il profilo richiede un template prescrittivo dedicato. */
export function haTemplatePrescrittivo(profilo?: ProfiloPrescrittivo | null): boolean {
  const pratica = profilo?.pratica;
  return Boolean(pratica && PRATICHE_PRESCRITTIVE.has(pratica));
}



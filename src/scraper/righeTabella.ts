/**
 * ScuoleRadar.it — RIGHE DI TABELLE-DATI E GRIGLIE ARIA — Node-only, puro.
 *
 * Modulo estratto da `elenchi.ts` (§26.72, 16/10/2026) per rispettare il limite
 * di 300 righe per file: qui vivono le funzioni che leggono una RIGA-DATI —
 * di una `<table>` oppure di una GRIGLIA ARIA (`div[role="row"]` con celle
 * `role="cell"` e intestazioni `role="columnheader"`) — ne ricompongono il testo
 * e ne recuperano le ETICHETTE DI COLONNA della scadenza.
 *
 * Perché serve: in una tabella la scadenza non è scritta accanto alla data, ma
 * nell'intestazione di colonna («Scadenza», «Data chiusura avviso»); senza le
 * etichette la data resta anonima e il parser scarta l'avviso come "senza
 * scadenza". È il caso dei portali provinciali (USR Liguria, `provincia.php`,
 * griglia ARIA) e della fonte regionale Umbria («interpelli aperti», `<table>`).
 *
 * Nessuna dipendenza dalla rete: ricevuto l'HTML già caricato con cheerio,
 * restituisce testo della riga ed etichette di colonna.
 */

import * as cheerio from 'cheerio';

/**
 * Nodo HTML accettato dalle query cheerio: cheerio NON riesporta i tipi dei nodi
 * (`cheerio.Element` non esiste), quindi il tipo si ricava dalla firma pubblica
 * di `CheerioAPI` — stessa convenzione di `elenchi.ts` (`Parameters<CheerioAPI>[0]`).
 */
type NodoHtml = Parameters<cheerio.CheerioAPI>[0];

/** Spazi normalizzati e testo troncato a `max` caratteri. */
function normalizza(testo: string, max: number): string {
  return testo.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Intestazioni di colonna che dichiarano una SCADENZA (parola chiave + valore). */
const RE_INTESTAZIONE_SCADENZA = /scadenz|chiusur|termine|giorno|fine|entro|presentazion/i;

/**
 * Intestazioni che NON sono una scadenza di candidatura (§26.75, 22/10/2026).
 * «Durata supplenza», «Data interpello» (la FINE dell'incarico), «Pubblicato il»
 * e le note di cancellazione contengono date che NON sono termini per
 * candidarsi: senza questo filtro una tabella come quella del USR Piemonte
 * offriva al parser la fine del contratto (`30/06/2027`) spacciata per scadenza.
 * L'esclusione è valutata PRIMA delle parole chiave di scadenza.
 */
const RE_INTESTAZIONE_NON_SCADENZA =
  /durata|supplenz|incaric|decorrenz|inizio|data\s*interpello|pubblicat|protocoll|cancellazion|note/i;

/** Celle senza valore (segnaposto): non aggiungono contesto, si saltano. */
const RE_CELLA_VUOTA = /^[-–—.…]*$/;

/**
 * Elementi DECORATIVI: il loro glifo (icona-font, `<svg>`) non è testo della
 * cella. La griglia del USR Liguria inizia ogni riga con `<i class="doc-icon">▤</i>`:
 * senza questo filtro il titolo dell'avviso diventava «▤EEEE Posto intero …».
 */
const SELETTORE_ICONA =
  'svg, i[class*="icon"], span[class*="icon"], .fa, .fas, .far, .fab, .dashicons, .glyphicon, .material-icons';

/**
 * Testo di una cella con uno spazio dove due nodi adiacenti INCOLLEREBBERO due
 * parole (`Genova` + `STATALE` → `Genova STATALE`, `A051` + `Spezzone` →
 * `A051 Spezzone`). Le giunzioni con la punteggiatura restano intatte: le date
 * spezzate (`16/10` + `/2026`) restano leggibili dal parser.
 */
function testoNodi($: cheerio.CheerioAPI, el: NodoHtml): string {
  const $el = $(el);
  const figli = $el.contents();
  if (figli.length === 0) return $el.text();
  let out = '';
  figli.each((_, figlio) => {
    const $figlio = $(figlio);
    if ($figlio.is(SELETTORE_ICONA)) return;
    // Un nodo con figli-elemento va aperto (i suoi `<span>` adiacenti possono
    // incollare due parole); un nodo di testo o senza figli si legge diretto.
    const pezzo = $figlio.children().length > 0 ? testoNodi($, figlio) : $figlio.text();
    if (!pezzo) return;
    if (out && !/\s$/.test(out) && /[a-z0-9à-öø-ÿ]$/i.test(out) && /^[a-z0-9à-öø-ÿ]/i.test(pezzo)) {
      out += ' ';
    }
    out += pezzo;
  });
  return out;
}

/** Celle di una riga: le celle ARIA (`role="cell"`), altrimenti `td`/`th`. */
function celleRiga($: cheerio.CheerioAPI, el: NodoHtml, max: number): string[] {
  const $riga = $(el);
  const $aria = $riga.find('[role="cell"]');
  const $celle = $aria.length > 0 ? $aria : $riga.find('td, th');
  return $celle.map((_, cella) => normalizza(testoNodi($, cella), max)).get();
}

/**
 * Intestazioni della tabella-dati a cui appartiene la riga: la riga `th` (o la
 * prima riga) di un `<table>`, oppure — per le griglie ARIA — le celle
 * `role="columnheader"` della riga di testa.
 */
function intestazioniTabella($: cheerio.CheerioAPI, el: NodoHtml): string[] {
  const $riga = $(el);
  const $tabella = $riga.closest('table');
  if ($tabella.length > 0 && $tabella.find('th').length > 0) {
    const $testa = $tabella.find('thead tr').first();
    const $prima = $tabella.find('tr').first();
    const $fonte = $testa.length > 0 ? $testa : $prima;
    if ($fonte.length > 0) {
      return $fonte
        .find('th, td')
        .map((_, cella) => normalizza($(cella).text(), 60))
        .get();
    }
  }
  const $griglia = $riga.closest('[role="table"], [role="grid"]');
  const $scope = $griglia.length > 0 ? $griglia : $riga.parent();
  const $teste = $scope.find('[role="columnheader"]');
  if ($teste.length === 0) return [];
  return $teste.map((_, cella) => normalizza($(cella).text(), 60)).get();
}

/** True se la riga è una INTESTAZIONE (solo etichette di colonna), non una voce. */
export function eRigaIntestazione($: cheerio.CheerioAPI, el: NodoHtml): boolean {
  const $riga = $(el);
  if ($riga.closest('thead').length > 0) return true;
  if ($riga.find('[role="columnheader"]').length > 0) return true;
  return $riga.is('tr') && $riga.find('td').length === 0;
}

/**
 * «Scadenza: 16/10/2026 · Data chiusura avviso: 20/10/2026» per una RIGA di una
 * tabella-dati, altrimenti stringa vuota.
 *
 * Regola: vale solo con una vera riga di intestazione (celle `th`, oppure celle
 * `role="columnheader"` nelle griglie ARIA) e solo per le colonne la cui
 * etichetta è una parola chiave di scadenza. Una tabella di impaginazione non ha
 * intestazioni e non produce nulla: nessun testo di navigazione finisce nel
 * contesto di un avviso.
 */
function suggerimentiDaRiga($: cheerio.CheerioAPI, el: NodoHtml): string {
  if (eRigaIntestazione($, el)) return '';
  const intestazioni = intestazioniTabella($, el);
  if (intestazioni.length === 0) return '';
  const valori = celleRiga($, el, 80);
  if (valori.length === 0) return '';

  const pezzi: string[] = [];
  for (let i = 0; i < intestazioni.length; i += 1) {
    const etichetta = intestazioni[i];
    const valore = valori[i] ?? '';
    if (!etichetta || RE_INTESTAZIONE_NON_SCADENZA.test(etichetta)) continue;
    if (!RE_INTESTAZIONE_SCADENZA.test(etichetta)) continue;
    if (!valore || RE_CELLA_VUOTA.test(valore)) continue;
    pezzi.push(`${etichetta}: ${valore}`);
  }
  return normalizza(pezzi.join(' · '), 240);
}

/**
 * Dati di una RIGA-DATI: vale sia per le `<table>` sia per le GRIGLIE ARIA
 * (`div[role="row"]` con celle `role="cell"`, come i portali provinciali).
 *
 * `contesto` è il testo delle CELLE unite da uno spazio: gli `<span>` adiacenti
 * (codice + oggetto) non incollano più le parole in un'unica parola illeggibile.
 * `suggerimenti` porta le etichette di colonna della scadenza.
 *
 * `null` quando l'elemento non è una riga-dati (riga di intestazione, riga di
 * impaginazione con una sola cella): in quel caso vale il testo del contenitore.
 */
export function datiRiga(
  $: cheerio.CheerioAPI,
  el: NodoHtml,
  max = 600,
): { contesto: string; suggerimenti: string } | null {
  if (eRigaIntestazione($, el)) return null;
  const celle = celleRiga($, el, max);
  const intestazioni = intestazioniTabella($, el);
  if (celle.length < 2 && intestazioni.length === 0) return null;
  const contesto =
    celle.length > 0 ? normalizza(celle.join(' '), max) : normalizza($(el).text(), max);
  if (!contesto) return null;
  return { contesto, suggerimenti: suggerimentiDaRiga($, el) };
}

/** Etichette di link non descrittive (il titolo va preso dalla riga). */
const RE_TESTO_LINK_GENERICO = /^(scarica|leggi|apri|visualizza|dettagli|dettaglio|vai|pdf|documento|link|qui|elenco)\b/i;

/**
 * Titolo di una voce: il testo del link se descrittivo, altrimenti la riga
 * (ripulita dal testo del link e dalle etichette generiche: «Avviso», «Vai
 * all'interpello ›» non sono titoli).
 */
export function titoloVoce(contesto: string, testoLink: string): string {
  let titolo = testoLink.length >= 12 && !RE_TESTO_LINK_GENERICO.test(testoLink) ? testoLink : '';
  if (!titolo) {
    const residuo = contesto
      .replace(testoLink, '')
      .replace(/^[\s\-–—:|·]+|[\s\-–—:|·]+$/g, '');
    titolo = residuo.length >= 12 ? residuo : '';
  }
  if (!titolo) titolo = contesto;
  return normalizza(titolo, 220);
}


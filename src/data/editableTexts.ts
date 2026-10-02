/**
 * ScuoleRadar.it — REGISTRO DEI TESTI MODIFICABILI «AL VOLO» (DEV).
 *
 * Unico dizionario `chiave → testo di default` delle superfici cablate all'editor
 * rapido della DEV Toolbar (`src/components/EditorTestiRapido.tsx`): si scrive nel
 * `<textarea>` di una chiave e quel testo cambia SUBITO in tutta l'app, senza
 * reload e senza ricostruire nulla. L'editor è CONTESTUALE: mostra solo le chiavi
 * che la vista attiva sta rendendo (registro `src/lib/testiInPagina.ts`) — qui non
 * esiste nessun raggruppamento per pagina da tenere allineato.
 *
 * Tre passaggi, nessuna astrazione:
 *   1. il testo di DEFAULT vive QUI (fonte di verità: se cambia la copy si cambia qui);
 *   2. le pagine rendono per CHIAVE (`useTestiEditabili().testo(chiave)`), mai la
 *      stringa duplicata nel JSX — niente doppioni da tenere allineati, e ogni
 *      chiave letta entra da sé nell'elenco «a schermo» dell'editor;
 *   3. l'override scritto nell'editor finisce in `localStorage: sr_simple_text_overrides`
 *      (`src/lib/testiModificabili.ts`) e vale SOLO in sviluppo: in build di produzione
 *      gli override sono ignorati e si usa sempre il default di questo file.
 *
 * Convenzione delle chiavi (`<area>.<soggetto>.<campo>`):
 *   · `faq.<slug>.domanda` / `faq.<slug>.risposta` → FAQ PUBBLICHE: le stesse voci su
 *     `/faq` e su `/prezzi` (elenco unico in `src/data/faqPubbliche.ts`, §2.11);
 *   · `prezzi.offerta.<blocco>.titolo` / `.testo`  → i tre blocchi dell'offerta PRO
 *     nella vetrina della homepage (`components/landing/LandingOffertaPro.tsx`).
 *
 * REGOLA DI CONTENUTO delle FAQ (29/09/2026): solo copy **di posizionamento** —
 * domanda pratica, risposta positiva. Vietate le domande difensive (disdette,
 * sicurezza dei pagamenti) e i rimandi a strumenti non ancora attivi: guardie
 * `test:editor-testi` e `test:copy:pubblico`.
 *
 * FUORI DAL REGISTRO, deliberatamente:
 *   · il LISTINO della pagina Prezzi (piani, importi, vantaggi, CIFRE) resta in
 *     `src/pages/PrezziPage.tsx` + `src/lib/pricing.ts`: modulo 🔒 **BLOCCATO**
 *     (`LOCKED_MODULES.md`). Della pagina Prezzi entra qui la **sola sezione FAQ**,
 *     cablata il 2026-09-29 con sblocco esplicito dell'utente («sostituire le FAQ della
 *     pagina Prezzi»): nessuna chiave `prezzi.*` per il listino;
 *   · le frasi di copy AUTORIZZATA dal cliente nella vetrina PRO restano nel componente:
 *     sono sorvegliate da `test:copy:etico` / `test:copy:pubblico`;
 *   · le CIFRE restano nel listino `src/lib/pricing.ts` (mai testo libero qui).
 *
 * Modulo PURO e isomorfo: nessun import di React, nessun accesso a storage.
 */

export const TESTI_EDITABILI = {
  /* ------------------------------------------------ FAQ pubbliche — /faq e /prezzi */
  'faq.radar-personalizzati.domanda': 'Come funziona il Radar e cosa mi arriva?',
  'faq.radar-personalizzati.risposta':
    'Decidi tu dove e cosa cercare: provincia, classi di concorso, ordine di scuola e le competenze che puoi mettere in campo (bandi PNRR/PON, laboratori, progetti). Da quel momento il Radar controlla le fonti da solo, ogni giorno: le opportunità compatibili con il tuo profilo ti arrivano su Telegram e via email. Quando non c’è nulla che ti riguarda non ricevi messaggi inutili.',
  'faq.animatore-digitale.domanda':
    'Sono Animatore Digitale o Referente Google: come inserisco ScuoleRadar tra i siti sicuri della scuola?',
  'faq.animatore-digitale.risposta':
    'Bastano due minuti e vale per tutto l’Istituto: apri la Google Admin Console, vai su Sicurezza › Controllo dell’accesso e dei dati › Controlli API e App terze, scegli «Aggiungi app», cerca ScuoleRadar (oppure incolla il Client ID che ti forniamo) e contrassegnala come «Attendibile» (Trusted). Da quel momento tutti i docenti della tua scuola accedono con un click, senza email personali e senza blocchi.',
  'faq.accesso-google-edu.domanda':
    'Non riesco a registrarmi con l’email scolastica (.edu.it), cosa devo fare?',
  'faq.accesso-google-edu.risposta':
    'Questo succede perché i filtri di sicurezza della tua scuola bloccano automaticamente la ricezione dei messaggi esterni, anche se i nostri sistemi sono perfettamente in regola. Per sbloccare la situazione, rivolgiti direttamente all’Animatore Digitale o al Responsabile Informatico della tua scuola e chiedigli di autorizzare i messaggi provenienti da Scuole Radar.',
  'faq.invita-un-collega.domanda': 'Come funziona «Invita un Collega»?',
  'faq.invita-un-collega.risposta':
    'Nella sezione «Invita un Collega» della tua bacheca trovi il tuo codice personale e il link pronto da condividere. Quando qualcuno si abbona al piano PRO annuale con il tuo codice riceve 10 € di sconto e tu ricevi un buono Amazon da 10 Euro.',
  'faq.purefocus-gmail.domanda': 'PureFocus richiede un account nuovo? Funziona con la mia Gmail?',
  'faq.purefocus-gmail.risposta':
    'Cos’è PureFocus? PureFocus è una piattaforma per usare Youtube senza distrazioni, molto utile per chi guarda video per lavoro e studio. L’abbonamento a PureFocus PRO è incluso nell’abbonamento Scuole Radar PRO e si accede con le stesse credenziali. Essendo Youtube parte di Google, PureFocus funziona meglio con un account Gmail. Potete accedere direttamente da scuoleradar.it oppure andare sul sito purefocus.one.',
  'faq.carta-docente.domanda': 'Posso pagare con la Carta del Docente?',
  'faq.carta-docente.risposta':
    'Stiamo valutando questa possibilità per il futuro. Se ti interessa questa opzione, per favore, segnalacelo inviandoci un messaggio tramite il modulo contatti (https://www.scuoleradar.it/contatti).',
  'faq.piano-conveniente.domanda': 'Qual è il piano più conveniente per accedere a tutto?',
  'faq.piano-conveniente.risposta':
    'Il piano PRO Annuale è la scelta d’elezione: ti garantisce il massimo risparmio equivalente a mesi gratuiti e sblocca l’accesso illimitato a tutti i dipartimenti, inclusa la dashboard anti-distrazione PureFocus.',
  'faq.regala-pro-collega.domanda':
    'Come posso regalare un anno di Scuole Radar PRO a un collega?',
  'faq.regala-pro-collega.risposta':
    'Al momento puoi inviare un codice con l’opzione «Invita un collega», in cui il collega ha 10 Euro di sconto e tu 10 Euro di credito Amazon. Stiamo valutando l’opzione di regalare un abbonamento annuale a Scuole Radar a un collega. Fateci sapere se vi interesserebbe questa possibilità scrivendoci a https://www.scuoleradar.it/contatti',
  /* ------------------------------------------- Offerta PRO — homepage (vetrina) */
  'prezzi.offerta.telegram.titolo': 'Avvisi Telegram in tempo reale',
  'prezzi.offerta.telegram.testo':
    'Appena esce un interpello per una delle tue province il messaggio parte: niente riepilogo una volta al giorno.',
  'prezzi.offerta.email.titolo': 'Email riepilogativa tutti i giorni alle 17.00',
  'prezzi.offerta.email.testo':
    'Un solo messaggio al giorno con tutte le opportunità uscite: le ritrovi nella tua casella, quando puoi.',
  'prezzi.offerta.purefocus.titolo': 'PureFocus incluso nel piano PRO',
  'prezzi.offerta.purefocus.testo':
    'Studio e lavoro su YouTube senza distrazioni (29 $/anno): incluso nel PRO, nessun costo aggiuntivo.',
} as const;

/** Chiave di una voce modificabile (`faq.<slug>.domanda`, …). */
export type ChiaveTesto = keyof typeof TESTI_EDITABILI;

/** Tutte le chiavi, in ordine di REGISTRO: è anche l'ordine dell'editor DEV
 *  (il registro delle viste `@/lib/testiInPagina` filtra questo elenco). */
export const CHIAVI_TESTO = Object.keys(TESTI_EDITABILI) as ChiaveTesto[];

/** Testo di DEFAULT (codice) di una chiave: è ciò che il reset ripristina. */
export function testoDiDefault(chiave: ChiaveTesto): string {
  return TESTI_EDITABILI[chiave];
}

/** true se la stringa è una chiave del registro (valida gli override salvati). */
export function eChiaveTesto(valore: string): valore is ChiaveTesto {
  return Object.prototype.hasOwnProperty.call(TESTI_EDITABILI, valore);
}

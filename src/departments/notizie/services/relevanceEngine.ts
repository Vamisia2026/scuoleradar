/**
 * ScuoleRadar.it — Motore di rilevanza e redazione del Dipartimento Notizie.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Modulo PURO (nessuna dipendenza dalla rete né da Node): valuta le notizie
 * reali in ingresso e applica le regole editoriali STRETTE:
 *  - ZERO rumore: RIFIUTA comunicati stampa, discorsi, interviste, campagne e
 *    qualsiasi annuncio NON vincolante;
 *  - ACCETTA SOLO provvedimenti vincolanti: decreti, ordinanze ministeriali,
 *    note, circolari, bandi e scadenze operative per il personale scolastico
 *    (GPS, Mobilità, Concorsi, Pensioni, Sostegno, …);
 *  - validità giuridica: la notizia deve riferirsi a un atto ufficiale preciso
 *    (Ordinanza Ministeriale, Decreto, articolo di legge), mai a generiche
 *    comunicazioni;
 *  - tetto articoli: MASSIMO `MAX_ARTICOLI_FINESTRA` (6) articoli ad alto valore
 *    nella finestra di lookback di 15 giorni (`FINESTRA_LOOKBACK_GIORNI`) —
 *    ~3 a settimana; se non ci sono provvedimenti vincolanti si pubblicano 0;
 *  - soglia di rilevanza: la categoria si assegna SOLO se la voce rientra in uno
 *    dei temi dell'ALLOW-LIST (`TEMI_OPERATIVI`: standardTemiPersonale.ts +
 *    standardTemiIA.ts + standardTemiDidattica.ts). La copertura è la scuola a
 *    360 gradi — normativa e reclutamento, personale ATA e segreterie,
 *    istruzione degli adulti (CPIA), formazione/titoli e CFU,
 *    contratti-previdenza-welfare, organizzazione-sicurezza-fonti normative,
 *    inclusione e sostegno — più i temi culturali e didattici (intelligenza
 *    artificiale, pedagogia, didattica, innovazione digitale), questi ultimi
 *    pubblicabili SOLO con un fatto concreto (scadenza reale o canale ufficiale
 *    di domanda/candidatura: `CATEGORIE_CON_FATTO_CONCRETO`);
 *  - lessico e scoring CONDIVISI: dizionario, acronimi, frasi di fluff, pesi e
 *    macro-aree vivono nei moduli `lessicoScuola.ts` e `editorialStandard.ts` e
 *    sono qui ri-esportati per compatibilità (es. `PAROLE_ACCETTA`,
 *    `GLOSSARIO_ACRONIMI`, `FRASI_FLUFF`);
 *  - integrità degli URL: niente mockup né root-domain generici, solo link di
 *    approfondimento reali validati HTTP 200;
 *  - PDF ufficiali: se la fonte è un PDF, il link dedicato deve aprire il PDF
 *    direttamente (target="_blank");
 *  - linguaggio chiaro: acronimi spiegati alla prima menzione, burocrazia
 *    semplificata, zero cliché da chatbot (il blog NON promuove moduli o
 *    template interni).
 */
import type { NewsArticle } from '../types';
import {
  CATEGORIE_CON_FATTO_CONCRETO,
  PESI_CATEGORIA,
  TEMI_OPERATIVI,
} from './editorialStandard';
import { FRASI_FLUFF, GLOSSARIO_ACRONIMI, PAROLE_OPERATIVE } from './lessicoScuola';
import { èFonteCanonica, èFonteNazionale, validaUrlDeepLink } from './fontiUfficiali';
import { classificaLink, linkNonValidiInHtml } from './linkUfficiale';
import {
  generaArticoloEditoriale,
  linkDomandaUfficiale,
  richiedePresentazioneDomanda,
} from './articoloEditoriale';
import { espandiAcronimi } from './editorialVoice';
import type { ValutazioneNotizia, VoceInValutazione } from './valutazioneTipi';

/**
 * Lessico del dipartimento: vive in `lessicoScuola.ts` (blocco condiviso dello
 * standard editoriale) e resta esposto da questo modulo con i nomi storici,
 * perché copy, igiene dell'archivio e documentazione li citano così.
 */
export { FRASI_FLUFF, GLOSSARIO_ACRONIMI };
export { PAROLE_OPERATIVE as PAROLE_ACCETTA };

/**
 * Parole che identificano l'ambito/categoria del personale scolastico.
 *
 * STORICO: il vocabolario delle categorie vive ora nell'allow-list dei temi
 * (`TEMI_OPERATIVI`: standardTemiPersonale.ts + standardTemiDidattica.ts), in
 * ordine di priorità e con macro-aree, pesi e gate del fatto concreto. Le voci
 * che compaiono solo qui ('Assegnazioni Provvisorie', 'Ricostruzione Carriera',
 * 'Riconoscimento Titoli', 'Scuole') restano mappate in `PESI_CATEGORIA` perché
 * arrivano ancora dai dati d'archivio già pubblicati.
 */

/**
 * Elenco storico delle parole "operative" (decreto, bando, scadenza, nomina…):
 * ora è `PAROLE_OPERATIVE` in `lessicoScuola.ts` — esteso alle voci della scuola
 * a 360 gradi (personale ATA e segreterie, DSGA, CPIA, sostegno, TFA/CFU, classi
 * di concorso, immissioni in ruolo) — ed è qui ri-esportato come
 * `PAROLE_ACCETTA`. Il GATE effettivo resta l'allow-list dei temi
 * (`classificaTemaPersonale` → `TEMI_OPERATIVI`).
 */

/**
 * Parole "FORTI" dell'avvio anno scolastico: termini che segnalano una
 * procedura operativa immediata (interpelli, supplenze, presa di servizio,
 * reggenze, bollettini). Restano il VOCABOLARIO di riferimento del periodo
 * (audit, copy, docs/BLOG_EDITORIAL_GUIDELINES.md): dalla riforma dello
 * standard il gate è l'allow-list dei temi (`TEMI_OPERATIVI`), non più una
 * categoria inferita dal solo titolo.
 */
export const PAROLE_FORTI_INIZIO_ANNO: string[] = [
  'interpello', 'interpelli', 'supplenza', 'supplenze',
  'presa di servizio', 'presa in servizio', 'reggenza', 'reggenze',
  'bollettino', 'bollettini',
];

/** Parole che segnalano contenuti NON vincolanti (zero rumore: da rifiutare). */
const PAROLE_RIFIUTA: string[] = [
  // Contenuti NON vincolanti: nessun rumore da marketing / press-release.
  'intervista', 'discorso', 'dichiarazione del ministro', 'messaggio del ministro',
  'comunicato stampa', 'conferenza stampa', 'saluto', 'auguri', 'cerimonia',
  'inaugurazione', 'premiazione', 'premio letterario', 'spettacolo', 'esibizione',
  'spot', 'spot pubblicitario', 'campagna di comunicazione', 'campagna social',
  'campagna pubblicitaria', 'iniziativa promozionale', 'webinar', 'seminario',
  'video', 'podcast', 'mostra', 'fiera', 'concorso artistico', 'progetto di lettura',
  'bandiera', 'festa', 'evento sportivo', 'manifestazione', 'sondaggio',
  'ipotesi', 'ipotesi di', 'bozza', 'bozze', 'preliminare', 'preliminari',
  'in preparazione', 'proposta preliminare', 'draft', 'avvio dei lavori preparatori',
  // Protocolli d'intesa, memorandum e visite: diplomazia istituzionale, non
  // notizie operative per docenti e ATA.
  'memorandum', 'incontro bilaterale', 'vertice bilaterale', 'visita ufficiale',
  'dichiarazione congiunta', 'missione istituzionale',
];

/** NB: la vecchia euristica "atto ufficiale + numero" (RE_ATTO_UFFICIALE /
 *  RE_RIF_ATTO / FINESTRA_ATTI_NAZIONALI_GIORNI) è stata RIMOSSA: accettava gli
 *  atti di sola burocrazia. Ora un atto si valuta dal CONTENUTO (vedi
 *  `attoBurocraticoVuoto`, `categoriaDaImpatto`). */

/** Parole del COMPARTO SCUOLA (docenti, ATA, dirigenti scolastici…). */
const PAROLE_SCUOLA =
  /(?:istruzione e ricerca|comparto istruzione|scuol|docenti|personale ata|\bata\b|dirigenti scolastici|supplent|graduator|interpell|organico|sostegno|scrutini|valutazion|iscrizion|studenti|alunni|educazione|reclutament|mobilit[aà])/;

/* ============ GIORNALISMO UTILE: burocrazia vuota fuori, impatto dentro ============ */

/**
 * Designazione FORMALE di un atto/avviso amministrativo (l'inizio tipico dei
 * titoli "burocratici" copiati dalle fonti): decreto, ordinanza, nota,
 * circolare, DPR, DPCM, D.L., comunicato, delibera, determina.
 */
const RE_DESIGNAZIONE_ATTO =
  /^\s*(?:d\.?\s*p\.?\s*r\.?|d\.?\s*p\.?\s*c\.?\s*m\.?|d\.?\s*l\.?|decreto(?:\s+(?:ministeriale|direttoriale|dirigenziale|legislativo|del\s+presidente))?|ordinanza(?:\s+ministeriale)?|nota(?:\s+prot(?:ocollo)?\.?)?|circolare|comunicato|delibera|determina|avviso)\b/i;

/** Riferimento formale (numero e/o data) tipico dei titoli svuotati. */
const RE_RIFERIMENTO_ATTO =
  /\bn\.?\s*\d+|(?:\bdel(?:l['’])?\s*\d{1,2}\s+[a-zà-ù]+)|(?:\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)|(?:\b(?:19|20)\d{2}\b)/i;

/**
 * Parole di IMPATTO PRATICO per chi lavora a scuola: se compaiono nel titolo,
 * la notizia merita di essere raccontata anche senza una parola-categoria
 * ufficiale (welfare e polizza sanitaria del personale, formazione ATA,
 * sicurezza, organico, stipendi…).
 */
const PAROLE_IMPATTO =
  /(?:stipend|paga|retribuzion|indennit|contratt|ccnl|welfare|polizza|sanitari|previdenz|contributiv|formazione|aggiornamento professionale|abilitazione|specializzazione|sicurezza|edilizia|digitalizzazione|organico|cattedre|classi|iscrizion|scrutini|esam[ei]|indirizz|maturit[aà]|diplom|calendario|festivit|benessere|psicolog|valutazion|orientamento|inclusione|bullismo|tutor|supplent|interpell|graduator|mobilit[aà]|trasferiment|assegnazion|nomine|assunzion|reclutament|pension|riscatto|ricostruzione|concors|reggenz|comandi|utilizzazion|permessi|aspettativa|telelavoro)/i;

/**
 * TITOLO DI BUROCRAZIA VUOTA: è SOLO il riferimento formale di un atto
 * ("Decreto Direttoriale n. 1095 del 10 settembre 2026", "Ordinanza
 * Ministeriale n. 163 del 7 agosto 2026") e non contiene NIENTE di ciò che
 * cambia la giornata di un docente o di un ATA. Questi contenuti NON si
 * pubblicano: il blog non fa da Gazzetta Ufficiale.
 */
export function attoBurocraticoVuoto(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (!RE_DESIGNAZIONE_ATTO.test(t)) return false;
  if (PAROLE_IMPATTO.test(t)) return false;
  return RE_RIFERIMENTO_ATTO.test(t);
}

/**
 * TITOLO INFORMATIVO: dice CHI/CHE COSA. Titoli-lista come "Concorso",
 * "Avviso", "Comunicazione" non diventano notizie: non dicono nulla al lettore.
 */
export function titoloInformativo(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim();
  if (t.length < 25) return false;
  const significative = t.split(/\s+/).filter((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length >= 4);
  return significative.length >= 4;
}

/** Categorie "di impatto" per argomento (la prima che corrisponde vince). */
const CATEGORIE_IMPATTO: Array<{ categoria: string; parole: string[] }> = [
  {
    categoria: 'CCNL',
    parole: ['contratto', 'ccnl', 'stipend', 'retribuzion', 'indennit'],
  },
  {
    categoria: 'Pensioni',
    parole: ['previdenz', 'contributiv', 'pension', 'riscatto'],
  },
  {
    categoria: 'PNRR',
    parole: ['pnrr', 'pon ', 'fondi', 'finanziament', 'edilizia', 'digitalizzazione'],
  },
  {
    categoria: 'Scuole',
    parole: [
      'welfare', 'polizza', 'sanitari', 'formazione', 'aggiornamento professionale',
      'sicurezza', 'organico', 'cattedre', 'iscrizion', 'orientamento',
      'inclusione', 'bullismo',
      // DIDATTICA, ORDINAMENTO ED ESAMI: la produzione MIM di settembre è fatta
      // di passaggi di indirizzo, esami integrativi, sessioni d'esame, maturità,
      // calendario e benessere a scuola. Senza queste voci la categoria non
      // veniva riconosciuta e l'intero flusso finiva nel rifiuto generico.
      'esam', 'indirizz', 'maturit', 'diplom', 'calendario', 'festivit',
      'benessere', 'psicolog',
    ],
  },
];

/**
 * RIFERIMENTI OBSOLETI: il testo cita solo anni vecchi (es. "Avviso n. 33 del
 * 06/07/2020") e la FONTE non dichiara una data recente → è materiale
 * d'archivio rispolverato dagli elenchi: non si pubblica come novità.
 */
export function riferimentiObsoleti(
  testo: string,
  dataFonte?: string | null,
  oggi: Date = new Date(),
): boolean {
  const t = (testo ?? '').toLowerCase();
  const anni = [...t.matchAll(/\b(?:19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  const annoTesto = anni.length > 0 ? Math.max(...anni) : null;
  const annoCorrente = oggi.getUTCFullYear();

  const data = dataFonte ? new Date(dataFonte) : null;
  const annoFonte = data && !Number.isNaN(data.getTime()) ? data.getUTCFullYear() : null;

  // Vecchio se il riferimento più recente nel testo è di oltre un anno fa…
  if (annoTesto !== null && annoTesto < annoCorrente - 1) {
    // …e la fonte NON attesta una pubblicazione recente.
    return !(annoFonte !== null && annoFonte >= annoCorrente - 1);
  }
  return false;
}

/** Categoria dedotta dall'IMPATTO del titolo (o null se non riconosciuto). */
export function categoriaDaImpatto(testo: string): string | null {
  const t = (testo ?? '').toLowerCase();
  if (!t || t.length < 20) return null;
  for (const { categoria, parole } of CATEGORIE_IMPATTO) {
    if (parole.some((p) => t.includes(p))) return categoria;
  }
  return null;
}

/**
 * RISERVA SETTIMANALE (garanzia di cadenza ≥ 1 articolo/settimana).
 *
 * Vero se la voce — pur non superata dal filtro editoriale principale — è
 * ammissibile come articolo di riserva quando la bacheca rischia una settimana
 * vuota. Requisiti (doppio vocabolario, nessun rumore):
 *  · titolo informativo (dice CHI/CHE COSA) e non burocrazia vuota;
 *  · non materiale d'archivio (riferimenti obsoleti senza data recente);
 *  · un termine di IMPATTO *e* un riferimento al mondo scuola nel TITOLO.
 * La validazione strutturale (URL canonico, HTTP 200/3xx, fonte nazionale)
 * resta a carico della pipeline: una riserva non può scavalcare quei gate.
 */
export function èRiservaSettimanale(
  title: string,
  descrizione?: string | null,
  dataFonte?: string | null,
): boolean {
  const titolo = (title ?? '').replace(/\s+/g, ' ').trim();
  const testo = `${titolo} ${(descrizione ?? '').replace(/\s+/g, ' ')}`
    .trim()
    .toLowerCase();
  if (!titolo || titolo.length < 20) return false;
  if (!titoloInformativo(titolo)) return false;
  if (attoBurocraticoVuoto(titolo)) return false;
  // Mai un comunicato/lettera/evento, nemmeno come riserva: il fluff resta fuori.
  if (titoloDaUfficioStampa(titolo)) return false;
  if (riferimentiObsoleti(testo, dataFonte)) return false;
  return PAROLE_IMPATTO.test(titolo) && PAROLE_SCUOLA.test(titolo);
}

/* ============ STANDARD EDITORIALE STRETTO (nessun fluff) ============ */

/**
 * GLOSSARIO ACRONIMI: ogni sigla va spiegata in parentesi alla PRIMA occorrenza
 * (titolo, sintesi, testo). Il dizionario vive in `lessicoScuola.ts` — con le
 * sigle della scuola a 360 gradi (GI, DSGA, TFA, CFU, CPIA, PNSD, PCTO, BES,
 * DSA, PEI, PDP, GLO, STEM/STEAM…) — ed è ri-esportato da questo modulo come
 * `GLOSSARIO_ACRONIMI` per compatibilità con copy e documentazione.
 */

/**
 * TEMI AMMESSI (allow-list): una notizia si pubblica SOLO se riguarda il
 * personale scolastico in modo operativo. L'elenco vive nei moduli tematici
 * (`standardTemiPersonale.ts` + `standardTemiDidattica.ts`) ed è unito da
 * `editorialStandard.ts` in `TEMI_OPERATIVI`, in ordine di PRIORITÀ: la prima
 * voce che corrisponde assegna la categoria. `autosufficiente: true` quando le
 * parole del tema bastano; altrimenti serve anche un contesto di personale
 * (`PAROLE_PERSONALE`), così un "concorso per studenti" non passa come concorso
 * riservato al personale della scuola.
 */

/**
 * Contesto di PERSONALE scolastico (obbligatorio per i temi non autosufficienti).
 * Copre la scuola a 360 gradi: docenti di ruolo e precari, personale ATA e
 * segreterie, DSGA, educatori, CPIA e istruzione degli adulti, sostegno,
 * formazione e titoli (TFA, CFU, classi di concorso), immissioni in ruolo.
 */
const PAROLE_PERSONALE =
  /(?:personale|docenti|docente|insegnant|educator|\bata\b|dsga|segreteri|collaborator|assistent|dirigenti scolastici|supplent|graduator|interpell|contratt|stipend|mobilit|organico|cattedre|reclutament|assunzion|nomine|neoassunt|precari|gps|ccnl|welfare|polizza|previdenz|pension|riscatto|formazione|abilitazione|carriera|permessi|aspettativa|utilizzazion|ricostruzione|ruolo|cpia|tfa|cfu|classi di concorso)/i;

/**
 * Classifica il TEMA OPERATIVO della notizia per il personale scolastico
 * (contratti e previdenza, welfare, mobilità, GPS/interpelli, sostegno, ATA e
 * segreterie, istruzione degli adulti, organico, formazione e titoli, PNRR,
 * sicurezza, normativa, scadenze, concorsi, intelligenza artificiale, didattica
 * e pedagogia).
 * Usa l'allow-list condivisa `TEMI_OPERATIVI` (ordine = priorità).
 * `null` = nessun impatto pratico → non si pubblica.
 */
export function classificaTemaPersonale(testo: string): string | null {
  const t = (testo ?? '').replace(/\s+/g, ' ').toLowerCase();
  if (!t) return null;
  const contestoForte = PAROLE_PERSONALE.test(t);
  const contestoScuola = contestoForte || PAROLE_SCUOLA.test(t);
  for (const tema of TEMI_OPERATIVI) {
    if (!tema.parole.some((p) => t.includes(p))) continue;
    // Temi autosufficienti (contratti, welfare, mobilità, GPS, sostegno, ATA,
    // CPIA…): bastano le loro parole. Gli altri (normativa, scadenze, concorsi,
    // reclutamento, didattica e pedagogia) valgono solo con un riferimento
    // ESPLICITO al personale: così un concorso o un evento per studenti non
    // passa come notizia operativa per docenti e ATA.
    if (tema.autosufficiente ? contestoScuola : contestoForte) return tema.categoria;
  }
  return null;
}

/**
 * TITOLO DA UFFICIO STAMPA: lettere, annunci, congratulazioni, dichiarazioni,
 * visite, protocolli, eventi. È comunicazione istituzionale, non notizia
 * operativa: si pubblica solo se il testo ha comunque un tema pratico forte
 * (vedi `classificaTemaPersonale`).
 */
export function titoloDaUfficioStampa(titolo?: string | null): boolean {
  const t = (titolo ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return /(?:lettera del ministro|lettera aperta|il ministro\b|la ministra\b|valditara|sottosegretario|dichiarazion|comunicato|nota stampa|soddisfazione|ringrazia|compliment|congratul|auguri|visita\b|incontro con|colloquio|memorandum|protocollo d.?intesa|intesa con|partnership|seminario|convegno|dibattito|tavola rotonda|cerimonia|premiazione|consegna del premio|rassegna stampa|giornata nazionale|giornata mondiale|celebrazion|anniversario|diretta\b|tutti a scuola|intervento del|presenzia|messaggio\b|augurio)/i.test(
    t,
  );
}

/**
 * FRASI DI FLUFF / PROMESSE VUOTE — mai pubblicabili.
 *
 * Sono riempitivi che non danno nulla di operativo al lettore ("ti avvisiamo
 * appena esce", "la scadenza non è ancora pubblicata", "verifica nel testo
 * ufficiale"): un articolo che ne contiene una viene scartato, in generazione e
 * in igiene dell'archivio. La notizia parla solo se ha fatti completi: scadenza,
 * requisiti, modalità e link diretti.
 *
 * L'elenco vive in `lessicoScuola.ts` (blocco condiviso dello standard
 * editoriale) ed è ri-esportato come `FRASI_FLUFF`.
 */

/** Vero se il testo contiene una frase di fluff/promessa vuota (non pubblicabile). */
export function contieneFraseFluff(testo?: string | null): boolean {
  const t = (testo ?? '').replace(/\s+/g, ' ').toLowerCase();
  if (!t) return false;
  return FRASI_FLUFF.some((f) => t.includes(f));
}

/** Data breve italiana (UTC) per l'urgenza nel titolo: "16 lug". */
function dataBreveIt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${d.getUTCDate()} ${mesi[d.getUTCMonth()]}`;
}

/**
 * Riscrive il titolo in chiave AZIONE ("che cosa cambia per me"): elimina le
 * intestazioni e le code burocratiche, tiene il SOGGETTO della notizia e,
 * quando esiste, aggiunge l'urgenza con la scadenza. Non inventa nulla: se la
 * pulizia svuota il titolo, torna l'originale.
 */
export function titoloAzione(
  titolo: string,
  categoria?: string | null,
  deadline?: string | null,
): string {
  const originale = (titolo ?? '').replace(/\s+/g, ' ').trim();
  let t = originale;

  // 0) Via le etichette da ufficio stampa: il lettore vuole il fatto, non la
  //    firma. Copre "Comunicato stampa:", "Lettera del Ministro …", "Il Ministro …",
  //    "Valditara: «…»" e il prefisso data delle rassegne ("05/09/2026 - ").
  t = t
    .replace(/^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*[-–—]\s*/, '')
    .replace(
      /^\s*(?:comunicato stampa|nota stampa|lettera del ministro(?:\s+dell[’'][a-zà-ù]+)?|lettera aperta|il ministro|la ministra|intervento del ministro|dichiarazione del ministro|messaggio del ministro)\b[^:]{0,120}[-–—:]\s*/i,
      '',
    )
    .replace(/^\s*(?:[A-ZÀ-Ù][a-zà-ù’']+\s){0,2}(?:valditara|ministro|ministra)\s*:\s*/i, '')
    .replace(/^[«“"']\s*/, '')
    .replace(/\s*[»”"']\s*$/, '');

  // 1) Via l'intestazione burocratica: designazione + numero + data.
  t = t.replace(
    /^\s*(?:d\.?\s*p\.?\s*r\.?|d\.?\s*p\.?\s*c\.?\s*m\.?|d\.?\s*l\.?|decreto(?:\s+(?:ministeriale|direttoriale|dirigenziale|legislativo|del\s+presidente))?|ordinanza(?:\s+ministeriale)?|nota(?:\s+prot(?:ocollo)?\.?)?|circolare|comunicato|delibera|determina)\s*(?:n\.?\s*\d+)?(?:\s*del(?:l['’])?\s*\d{1,2}\s+[a-zà-ù]+\s+\d{4})?\s*[-–—:]\s*/i,
    '',
  );

  // 2) Via le code burocratiche ("— Pubblicazione dell'Ordinanza Ministeriale").
  t = t.replace(
    /\s*[-–—:]\s*(?:pubblicazione|pubblicato|trasmissione|comunicazione|decreto|ordinanza|nota|avviso)\b[^.]*$/i,
    '',
  );

  // 2-bis) Via la CODA DA COMUNICATO: il titolo si ferma alla frase che dice il
  // fatto ("Nuove Indicazioni Nazionali 2025, al via il percorso di formazione
  // per le scuole. Domani, 16 settembre, il Ministro…" → si taglia al punto).
  t = t.replace(
    /\s*[.;]\s*(?:domani|oggi|ieri|dopodomani|il ministro|la ministra|il mim|alle ore|\d{1,2}\s+(?:gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre))\b[\s\S]*$/i,
    '',
  );

  // 3) Pulizia e salvagente: mai svuotare o stravolgere il titolo.
  t = t
    .replace(/^[\s\-–—:.,;]+|[\s\-–—:.,;]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (t.length < Math.min(20, originale.length)) t = originale;
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // 4) Categoria in testa solo se aiuta (titolo che inizia in modo generico).
  const cat = (categoria ?? '').trim();
  const categorieChiare = [
    'GPS', 'Supplenze', 'Concorsi', 'Mobilità', 'Graduatorie', 'Pensioni', 'CCNL', 'PNRR', 'Sostegno',
  ];
  if (
    cat &&
    categorieChiare.includes(cat) &&
    !t.toLowerCase().includes(cat.toLowerCase()) &&
    /^(?:aggiornamento|avviso|nota|comunicazione|nuove|nuovo|disposizioni|indicazioni|modalità)\b/i.test(t)
  ) {
    t = `${cat}: ${t}`;
  }

  // 5) Urgenza: la scadenza va in fondo, solo se la fonte la dichiara davvero.
  const conScadenza = /(?:entro|scadenz|termine|domand|istanz|candidatur)/i.test(
    `${originale} ${t}`,
  );
  if (deadline && conScadenza && !t.toLowerCase().includes('entro il')) {
    t = `${t.replace(/[.\s]+$/, '')} — domande entro il ${dataBreveIt(deadline)}`;
  }

  // 6) ACRONIMI: spiegati alla prima occorrenza (standard editoriale, anche nel
  //    titolo). Se il titolo diventerebbe troppo lungo, l'espansione resta
  //    comunque nella sintesi e nel corpo dell'articolo.
  const espanso = espandiAcronimi(t).testo;
  if (espanso.length <= 170) t = espanso;

  return t.length >= 12 ? t : originale;
}

const MESI_ITALIANI: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/**
 * Estrae la data di scadenza (ISO YYYY-MM-DD) da un testo, se dichiarata.
 * Gestisce anche ordinali ("1°luglio") e l'anno implicito (si usa l'anno
 * corrente quando non dichiarato, come accade nei titoli recenti del MIM).
 */
export function estraiDeadline(testo: string, oggi: Date = new Date()): string | null {
  const t = testo.toLowerCase();
  const nomiMesi = Object.keys(MESI_ITALIANI).join('|');
  const re = new RegExp(
    `(?:entro il|scadenza|scade il|termine ultimo|termine)?\\s*(\\d{1,2})\\s*(?:°|º|a)?\\s*(${nomiMesi})\\s*(\\d{4})?`,
    'g',
  );
  let match: RegExpExecArray | null;
  let ultima: string | null = null;
  while ((match = re.exec(t)) !== null) {
    const mese = MESI_ITALIANI[match[2]];
    if (!mese) continue;
    const anno = match[3] ? Number(match[3]) : oggi.getUTCFullYear();
    const d = new Date(Date.UTC(anno, mese - 1, Number(match[1])));
    if (!Number.isNaN(d.getTime())) ultima = d.toISOString().slice(0, 10);
  }
  if (ultima) return ultima;

  // Formato numerico gg/mm/aaaa.
  const numerica = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (numerica) {
    const d = new Date(Date.UTC(Number(numerica[3]), Number(numerica[2]) - 1, Number(numerica[1])));
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Classifica la categoria di appartenenza (per il personale scolastico).
 *
 * DEPRECATA: usa `classificaTemaPersonale`, l'allow-list completa dei temi
 * (scuola a 360 gradi: ATA e segreterie, istruzione degli adulti, formazione e
 * titoli, pedagogia e didattica…). Resta un wrapper per i chiamanti storici,
 * così non esistono due verdi diversi sullo stesso testo. `PAROLE_CATEGORIA`
 * resta il vocabolario storico (alias e sinonimi presenti in archivio).
 */
export function classificaCategoria(testo: string): string | null {
  return classificaTemaPersonale(testo);
}

/**
 * Valuta la rilevanza editoriale di una notizia in ingresso.
 * Regola: niente contenuti non vincolanti; solo provvedimenti, note e
 * scadenze operative per il personale scolastico.
 *
 * SOGLIA: la categoria si assegna SOLO se la voce rientra nell'ALLOW-LIST dei
 * temi (`classificaTemaPersonale` → `TEMI_OPERATIVI`: scuola a 360 gradi —
 * contratti e previdenza, welfare, mobilità, sostegno, ATA e segreterie,
 * istruzione degli adulti, GPS/interpelli, organico, formazione e titoli,
 * reclutamento, PNRR, sicurezza, normativa, scadenze, concorsi). I temi
 * CULTURALI e DIDATTICI (intelligenza artificiale, pedagogia, didattica,
 * innovazione digitale) sono
 * `fattoConcreto: true` (`CATEGORIE_CON_FATTO_CONCRETO`): passano solo con una
 * scadenza reale o un canale ufficiale di domanda/candidatura, mai come
 * webinar, convegno o comunicato.
 * In assenza di un tema, l'avviso viene SCARTATO: sono gli avvisi tecnici/
 * amministrativi generali che non interessano a docenti e ATA. Il filtro
 * anti-rumore (`PAROLE_RIFIUTA`) resta pienamente attivo.
 */
export function valutaRilevanza(voce: VoceInValutazione): ValutazioneNotizia {
  const testo = `${voce.title} ${voce.description ?? ''}`.toLowerCase();

  for (const parola of PAROLE_RIFIUTA) {
    if (!testo.includes(parola)) continue;
    // 'ipotesi'/'bozza' sono rumore negli avvisi generici, ma per i CONTRATTI
    // ("ipotesi di accordo CCNL") sono il documento ufficiale della trattativa:
    // un rinnovo contrattuale è sempre una notizia operativa per il personale.
    if (
      /^(?:ipotesi(?: di)?|bozz[ae])$/.test(parola) &&
      /(?:ccnl|contratto collettivo|ipotesi di accordo|contrattazione collettiva|comparto istruzione e ricerca)/i.test(
        testo,
      )
    ) {
      continue;
    }
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: `Contenuto non vincolante rilevato ("${parola}")`,
    };
  }

  // 0) BUROCRAZIA VUOTA: un titolo che è SOLO il riferimento formale di un atto
  //    ("Decreto Direttoriale n. 1095 del 10 settembre 2026", "Ordinanza
  //    Ministeriale n. 163 del 7 agosto 2026") non dice al lettore che cosa
  //    cambia: fuori dal blog, che non fa da Gazzetta Ufficiale.
  if (attoBurocraticoVuoto(voce.title)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Atto burocratico senza contenuto: nessun impatto pratico per docenti e ATA',
    };
  }

  // 0-bis) MATERIALE D'ARCHIVIO: riferimenti solo a vecchi anni (avvisi 2019/
  //    2020 rispolverati dagli elenchi) senza una fonte recente → fuori.
  if (riferimentiObsoleti(`${voce.title} ${voce.description ?? ''}`, voce.data)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Contenuto d\'archivio (riferimenti obsoleti, nessuna attualità)',
    };
  }

  // 0-ter) TITOLO INFORMATIVO: un titolo che non dice NULLA (es. "Concorso",
  //    "Avviso", "Comunicazione") non può diventare una notizia: si scarta
  //    (nessun titolo pigro copiato dalle liste delle fonti).
  if (!titoloInformativo(voce.title)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Titolo senza contenuto informativo: non dice che cosa cambia',
    };
  }

  // 1) CCNL: i contratti collettivi valgono SOLO per il comparto SCUOLA (i CCNL
  //    di Sanità, Funzioni Locali, Presidenza del Consiglio… non interessano a
  //    docenti e ATA: ScuoleRadar è una piattaforma nazionale per la scuola).
  // 2) TEMA OPERATIVO (allow-list): si pubblica SOLO ciò che ha un impatto
  //    pratico per il personale scolastico — contratti/CCNL, welfare, mobilità,
  //    GPS/interpelli, organizzazione e organico, formazione, scadenze
  //    operative, cambi normativi. Tutto il resto (comunicati, lettere,
  //    dichiarazioni, annunci politici, iniziative rivolte agli studenti,
  //    eventi) è comunicazione istituzionale, non una notizia operativa: fuori.
  const tema = classificaTemaPersonale(`${voce.title} ${voce.description ?? ''}`);
  if (tema === 'CCNL' && !PAROLE_SCUOLA.test(testo)) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Contratto non pertinente al comparto scuola',
    };
  }
  if (titoloDaUfficioStampa(voce.title) && !tema) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: 'Comunicazione istituzionale/press-office: nessun impatto pratico per il personale',
    };
  }
  if (!tema) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo:
        'Nessun impatto pratico sui temi del personale scolastico (contratti e previdenza, welfare, mobilità, sostegno, ATA e segreterie, istruzione degli adulti, GPS/interpelli, organico, formazione e titoli, reclutamento, PNRR, sicurezza, normativa, scadenze, concorsi)',
    };
  }
  // 3) FATTO CONCRETO (temi culturali e didattici): intelligenza artificiale,
  //    pedagogia, didattica e innovazione digitale non entrano in bacheca come
  //    puro comunicato, webinar o convegno. Servono una SCADENZA reale oppure un
  //    canale ufficiale di domanda/candidatura (procedura concreta da seguire).
  const deadline = estraiDeadline(testo);
  if (
    CATEGORIE_CON_FATTO_CONCRETO.includes(tema) &&
    !deadline &&
    !linkDomandaUfficiale(testo) &&
    !richiedePresentazioneDomanda(testo)
  ) {
    return {
      rilevante: false,
      categoria: null,
      deadline: null,
      motivo: `Tema ${tema} senza fatto concreto: serve una scadenza reale o un canale ufficiale di domanda/candidatura`,
    };
  }
  return { rilevante: true, categoria: tema, deadline };
}

/**
 * Punteggio di rilevanza 0-100 per l'ordinamento.
 * La matrice dei pesi è CONDIVISA (`PESI_CATEGORIA` in `editorialStandard.ts`),
 * alimentata dai temi di `standardTemiPersonale.ts`: qui non si duplica nulla,
 * così pubblicazione, ingest e reportistica ordinano con gli stessi pesi.
 * `65` resta il fallback per le categorie storiche presenti in archivio ma non
 * più in allow-list; `60` per le voci senza categoria. Una scadenza reale vale
 * `+8`.
 */
export function punteggioRilevanza(categoria: string | null, hasDeadline: boolean): number {
  const base = categoria ? (PESI_CATEGORIA[categoria] ?? 65) : 60;
  return Math.min(100, base + (hasDeadline ? 8 : 0));
}

/** Valida la coerenza di un articolo costruito prima dell'inserimento. */
export function articoloValido(a: NewsArticle): boolean {
  const base =
    Boolean(a.id) &&
    Boolean(a.title) &&
    Boolean(a.official_source_url) &&
    a.official_source_url.startsWith('http');
  if (!base) return false;
  const motivo = validaUrlDeepLink(a.official_source_url);
  if (motivo) {
    console.warn(`✗ Articolo scartato (${a.id}): URL fonte non valido — ${motivo}`);
    return false;
  }
  if (!èFonteCanonica(a.official_source_url)) {
    console.warn(
      `✗ Articolo scartato (${a.id}): la fonte non è un URL canonico di articolo — ${a.official_source_url}`,
    );
    return false;
  }
  // PERIMETRO NAZIONALE: fuori le fonti regionali/locali (es. pagine USR
  // `/web/usr-*`): ScuoleRadar pubblica solo copertura nazionale (MIM, Gazzetta
  // Ufficiale, ARAN, giurisdizione). L'igiene dell'archivio rimuove le voci
  // regionali già presenti.
  if (!èFonteNazionale(a.official_source_url)) {
    console.warn(
      `✗ Articolo scartato (${a.id}): fonte non nazionale — ${a.official_source_url}`,
    );
    return false;
  }
  // LINK: la notizia NON si blocca mai per un link "generico". Si pubblica con
  // la traccia disponibile (pagina ufficiale/elenco) e si segnala la classe del
  // link: solo gli URL NON VALIDI (mockup, login, non http) bloccano l'uscita.
  const classeLink = classificaLink(a.official_source_url);
  if (classeLink.classe === 'non-valido') {
    console.warn(
      `✗ Articolo scartato (${a.id}): URL fonte non valido — ${classeLink.motivo}`,
    );
    return false;
  }
  if (classeLink.classe === 'contenitore') {
    console.warn(
      `⚠ Articolo pubblicato con link di PAGINA/ELENCO (traccia) — ${a.id}: ${classeLink.motivo}`,
    );
  }
  // Link non validi nel testo pubblicato: quelli sì, bloccano (mockup/login).
  const nonValidi = linkNonValidiInHtml(a.content_html ?? '');
  if (nonValidi.length > 0) {
    console.warn(`✗ Articolo scartato (${a.id}): link non validi nel testo — ${nonValidi[0]}`);
    return false;
  }
  // STANDARD EDITORIALE STRETTO: resta in bacheca solo ciò che ha un tema
  // pratico per il personale (contratti, welfare, mobilità, GPS/interpelli,
  // organizzazione, formazione, scadenze, normativa) e non è una comunicazione
  // d'ufficio stampa. Vale anche per le voci già in archivio (igiene).
  // ZERO FLUFF: nessuna promessa vuota né rinvio generico ("ti avvisiamo appena
  // esce", "verifica nel testo ufficiale"). Vale anche per l'igiene dell'archivio.
  if (contieneFraseFluff(`${a.title} ${(a.summary_points ?? []).join(' ')} ${a.content_html ?? ''}`)) {
    console.warn(`✗ Articolo scartato (${a.id}): contiene una frase di fluff/promessa vuota`);
    return false;
  }
  const temaArticolo = classificaTemaPersonale(`${a.title} ${a.category ?? ''}`);
  const riservaAmmessa = èRiservaSettimanale(
    a.title,
    (a.summary_points ?? []).join(' '),
    a.deadline_date,
  );
  if (!temaArticolo && !riservaAmmessa) {
    console.warn(`✗ Articolo scartato (${a.id}): nessun impatto pratico per il personale scolastico`);
    return false;
  }
  if (titoloDaUfficioStampa(a.title) && !PAROLE_PERSONALE.test(a.title)) {
    console.warn(`✗ Articolo scartato (${a.id}): comunicazione istituzionale/press-office`);
    return false;
  }
  return true;
}

/** Fonte editoriale dedotta dall'host della fonte ufficiale (rigenerazione formato). */
export function fonteDaUrl(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('mim.gov.it') || host.endsWith('istruzione.it')) return 'MIM';
    if (host.endsWith('gazzettaufficiale.it')) return 'Gazzetta Ufficiale';
    if (host.endsWith('aranagenzia.it')) return 'ARAN';
    if (host.endsWith('inps.it')) return 'INPS';
    if (host.endsWith('corteconti.it')) return 'Corte dei Conti';
    if (host.endsWith('giustizia-amministrativa.it')) return 'Consiglio di Stato';
    return host.replace(/^www\./, '');
  } catch {
    return 'Fonte ufficiale';
  }
}

/**
 * RIGENERA IL FORMATO EDITORIALE di un articolo già in archivio: titolo con
 * acronimi spiegati, sintesi "IN SINTESI" a bullet pratici e copy a 3 paragrafi
 * secondo lo standard corrente. Non tocca fatti, data, link, categoria e
 * punteggio: interviene solo sulla forma (id e dedupe restano invariati).
 */
export function applicaFormatoEditoriale(a: NewsArticle): NewsArticle {
  // Il canale di presentazione si ricava dallo stesso testo pubblicato: se la
  // notizia parla di una domanda, il link diretto entra anche nella voce già in
  // archivio (zero rinvii vaghi anche sulle notizie storiche).
  const canale = linkDomandaUfficiale(
    `${a.title} ${(a.summary_points ?? []).join(' ')} ${a.content_html ?? ''}`,
  );
  const { content_html, summary_points } = generaArticoloEditoriale({
    title: a.title,
    categoria: a.category,
    deadline: a.deadline_date,
    fonte: fonteDaUrl(a.official_source_url),
    official_url: a.official_source_url,
    application_url: canale?.url ?? null,
    application_label: canale?.etichetta ?? null,
  });
  const titolo = espandiAcronimi(a.title).testo;
  return {
    ...a,
    title: titolo.length <= 170 ? titolo : a.title,
    content_html,
    summary_points,
  };
}

/* ============ SUPERFICIE PUBBLICA (re-export dei sotto-moduli) ============ */
/* Il contratto storico del motore resta invariato: chi importava da qui continua
   a farlo. La logica vive nei sotto-moduli specializzati. */
export { èFonteCanonica, èFonteMim, èFonteNazionale, èLinkPdf, validaUrlDeepLink } from './fontiUfficiali';
export {
  classificaLink,
  etichettaLinkFonte,
  linkDirettoUfficiale,
  linkNonValidiInHtml,
  linkVietatiInHtml,
} from './linkUfficiale';
export type { ClasseLink, EsitoLinkDiretto, ValutazioneLink } from './linkUfficiale';
export {
  FINESTRA_LOOKBACK_GIORNI,
  FINESTRA_LOOKBACK_NAZIONALE_GIORNI,
  MAX_ARTICOLI_FINESTRA,
  MAX_ARTICOLI_SETTIMANA,
  limitaArticoliSettimanali,
  limitaCadenzaSettimanale,
  verificaCadenzaSettimanale,
} from './cadenzaArticoli';
export {
  generaArticoloEditoriale,
  linkDomandaUfficiale,
  richiedePresentazioneDomanda,
} from './articoloEditoriale';
export type { DatiArticoloEditoriale } from './articoloEditoriale';
export { promptFiltroLLM, promptScritturaArticolo } from './promptEditoriale';
export {
  APERTURE_VIETATE,
  NOME_VOCE,
  REGOLE_VOCE,
  apertureVietateTesto,
  bloccoVoceEditoriale,
  espandiAcronimi,
} from './editorialVoice';
export type { ValutazioneNotizia, VoceInValutazione } from './valutazioneTipi';

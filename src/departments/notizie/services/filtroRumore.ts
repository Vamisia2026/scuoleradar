/**
 * ScuoleRadar.it — Dipartimento Notizie · FILTRO SEMANTICO DEL RUMORE (§26.98)
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * PERCHÉ ESISTE. L'allow-list dei temi (`TEMI_OPERATIVI`) scarta la
 * comunicazione istituzionale, ma non tutto ciò che riguarda la scuola merita
 * una scheda in bacheca. Restavano fuori tre famiglie di rumore che arrivano
 * puntuali dalle fonti ufficiali:
 *
 *   1. VITA SINDACALE E POLITICA — scioperi, assemblee sindacali, proteste,
 *      comunicati di sigla (Cobas, Flc Cgil…). Sono avvisi veri, ma non dicono
 *      nulla a chi cerca lavoro: durano un giorno e non cambiano una regola.
 *   2. AVVISI TEMPORANEI — chiusura degli uffici, orario estivo, disservizi,
 *      manutenzioni. Valgono per una settimana al massimo.
 *   3. SIGLE CITATE DI SFUGGO — un CCNL firmato nomina i sindacati: lì la sigla
 *      è CONTESTO, non la notizia.
 *
 * REGOLA. Il filtro scarta un articolo quando il rumore è nel fatto, non quando
 * è nell'aria:
 *   · `RUMORE_SINDACALE` e `AVVISI_TEMPORANEI` sono HARD → sempre fuori;
 *   · `SIGLE_SINDACALI` è SOFT → fuori solo se il testo NON contiene un
 *     ancoraggio duraturo (`ANCORAGGIO_DURATURO`): un CCNL, un decreto, delle
 *     linee guida restano in bacheca anche se nominano Cgil e Cisl.
 *
 * ORIZZONTE. Una notizia entra solo se resta utile per almeno
 * `DURATA_UTILE_MINIMA_MESI` mesi: normativa, reclutamento, PNRR, guide MIM,
 * contratti. Il tetto di 1–3 articoli a settimana è in `cadenzaArticoli.ts`; qui
 * sta la QUALITÀ di ciò che entra.
 *
 * DOVE SI APPLICA. Un solo punto di verità, tre richiami:
 *   · `relevanceEngine.valutaRilevanza` (ingestione, prima di ogni HTTP);
 *   · `relevanceEngine.èRiservaSettimanale` (promozione di riserva: un rumore
 *     non può occupare lo slot settimanale);
 *   · `relevanceEngine.articoloValido` (igiene dell'archivio: le voci già
 *     pubblicate che violano la regola escono al primo passaggio).
 * Verificato da `npm run test:notizie-rumore` (incluso in `npm test`).
 *
 * Modulo PURO: nessuna rete, nessun Node, nessuna dipendenza dallo stato.
 */

/** Un segnale di rumore: espressione regolare + motivo dichiarato nei log. */
export interface SegnaleRumore {
  re: RegExp;
  /** Etichetta del segnale, scritta nel `motivo` dello scarto e nei test. */
  motivo: string;
}

/**
 * Orizzonte minimo di validità editoriale (mesi). Sotto questa soglia la
 * notizia è cronaca — scioperi, avvisi di sportello, orari — e resta fuori.
 */
export const DURATA_UTILE_MINIMA_MESI = 6;

/**
 * 1. VITA SINDACALE E POLITICA — HARD: sempre fuori, anche quando il testo cita
 * un interpello o una scadenza. Dal segnale più specifico al più generico, così
 * il motivo dello scarto dice «assemblea sindacale» e non «assemblea».
 */
export const RUMORE_SINDACALE: readonly SegnaleRumore[] = [
  { re: /assemble[ae].{0,24}sindacal/i, motivo: 'assemblea sindacale' },
  { re: /\bscioper[oi]\b/i, motivo: 'sciopero' },
  { re: /\bcobas\b/i, motivo: 'cobas' },
  { re: /\bflc[\s-]*cgil\b/i, motivo: 'flc cgil' },
  // NB: «presidi» NON è qui — in italiano è anche il nome dei dirigenti
  // scolastici, e un articolo sui presidi sarebbe scartato per sbaglio.
  { re: /\bprotest[ae]\b|\bprotestare\b/i, motivo: 'protesta' },
  {
    re: /\bmanifestazion[ei]\b.{0,32}(?:sindacal|protesta)|\b(?:sindacal|protesta).{0,32}\bmanifestazion/i,
    motivo: 'manifestazione sindacale',
  },
];

/**
 * 2. AVVISI TEMPORANEI — HARD: valgono giorni, non mesi. L'espressione è
 * volutamente stretta (soggetto + oggetto): «riapertura dei termini» è un fatto
 * operativo e NON deve cadere, «riapertura degli uffici» è un orario e sì.
 */
export const AVVISI_TEMPORANEI: readonly SegnaleRumore[] = [
  {
    re: /(?:chiusura|sospensione|interruzione|riapertura|variazione|rimodulazione|differimento)[^.]{0,40}(?:uffici|segreter|sportell|riceviment|orari|servizio|lezion|attività didattic|refezione|mensa|trasport)/i,
    motivo: 'avviso temporaneo (chiusura/orario/servizio)',
  },
  { re: /orari[o]?\s+(?:estiv|invernal|ridott|di apertura|di sportello)/i, motivo: 'orario temporaneo' },
  { re: /\b(?:disservizi[oi]?|manutenzione straordinaria|guasto|interruzione di energia|blackout)\b/i, motivo: 'disservizio temporaneo' },
];

/**
 * 3. SIGLE E «VITA SINDACALE» COME CONTESTO — SOFT: rumore solo se il testo non
 * ha un ancoraggio duraturo. Un comunicato della sigla è rumore; un CCNL
 * firmato dalle sigle è la notizia più utile dell'anno.
 */
export const SIGLE_SINDACALI: readonly SegnaleRumore[] = [
  { re: /\bsindacat[oi]\b|\bsindacal[ei]\b/i, motivo: 'sindacato' },
  { re: /\b(?:cgil|cisl|uil|snals|gilda|anief|andoc|confsal)\b/i, motivo: 'sigla sindacale' },
];

/**
 * ANCORAGGIO DURATURO: fatti che restano veri per mesi — contratti, atti
 * normativi, linee guida MIM, PNRR, procedure di reclutamento e di mobilità.
 * È la condizione che fa passare una sigla citata di sfuggita.
 */
export const ANCORAGGIO_DURATURO =
  /(?:ccnl|contratt[oi] collettiv|contrattazione collettiv|ipotesi di accordo|decreto|ordinanza|\blegge\b|\bd\.?\s?l\.?\b|dpcm|\bdpr\b|linee guida|indicazioni nazional|documento di indirizzo|pnrr|piano nazionale|immission[ei] in ruolo|concors|gps|gae|graduator|mobilità|organico|classi? di concorso|\btfa\b|\bcfu\b|curricol|esami di stato|valutazion|iscrizion|orientament|sostegno|personale ata|cpia|pension|welfare|sicurezza|formazione|abilitazione|ricostruzione di carriera)/i;

/** Testo normalizzato per il confronto: minuscolo, spazi compattati, niente HTML. */
function normalizza(testo?: string | null): string {
  return (testo ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Motivo del rumore SINDACALE/POLITICO hard, oppure `null`. */
export function rumoreSindacale(testo?: string | null): string | null {
  const t = normalizza(testo);
  if (!t) return null;
  return RUMORE_SINDACALE.find((s) => s.re.test(t))?.motivo ?? null;
}

/** Motivo dell'AVVISO TEMPORANEO hard, oppure `null`. */
export function rumoreTemporaneo(testo?: string | null): string | null {
  const t = normalizza(testo);
  if (!t) return null;
  return AVVISI_TEMPORANEI.find((s) => s.re.test(t))?.motivo ?? null;
}

/** True se il testo contiene un fatto che resta utile per mesi. */
export function haValoreDuraturo(testo?: string | null): boolean {
  const t = normalizza(testo);
  return Boolean(t) && ANCORAGGIO_DURATURO.test(t);
}

/**
 * ESITO UNICO del filtro: il motivo dello scarto, oppure `null` se il testo è
 * pubblicabile. Ordine: prima i segnali HARD (sindacale, poi temporaneo), infine
 * le sigle SOFT — che cedono il passo a un ancoraggio duraturo.
 */
export function rilevaRumoreEditoriale(testo?: string | null): string | null {
  const t = normalizza(testo);
  if (!t) return null;

  const sindacale = rumoreSindacale(t);
  if (sindacale) return sindacale;

  const temporaneo = rumoreTemporaneo(t);
  if (temporaneo) return temporaneo;

  const sigla = SIGLE_SINDACALI.find((s) => s.re.test(t));
  if (sigla && !haValoreDuraturo(t)) return sigla.motivo;

  return null;
}

/**
 * Rumore di un ARTICOLO (titolo + sintesi + testo pubblicato): serve all'igiene
 * dell'archivio, dove il rumore può stare in un paragrafo e non nel titolo.
 */
export function articoloRumoroso(a: {
  title: string;
  summary_points?: string[] | null;
  content_html?: string | null;
}): string | null {
  const testo = [a.title, ...(a.summary_points ?? []), a.content_html ?? ''].join(' ');
  return rilevaRumoreEditoriale(testo);
}

/**
 * ScuoleRadar.it — LA SCADENZA CHE IL TESTO DICHIARA (§26.94).
 *
 * Perché esiste: metà delle fonti non ha una colonna «Scadenza». Il termine è
 * scritto nella frase dell'avviso — «Le domande vanno presentate **entro le ore
 * 12:00 del 12/11/2026**», «termine per la presentazione delle domande
 * **12/11/2026**», «non oltre il **12/11/2026**» — oppure nel nome del file
 * (`...scadenza-12-11-2026.pdf`) o nel `title` dell'ancora. Il lettore tabellare
 * scartava quelle righe come «senza scadenza» e l'elenco adattivo non le
 * contava: opportunità vere perse per un'etichetta mancante, non per un dato
 * assente.
 *
 * REGOLE DICHIARATE (le stesse di §26.75 e `parser.ts`)
 *  · Si accetta una data SOLO se una parola di TERMINE la qualifica: «scadenza»,
 *    «entro», «non oltre», «termine», «chiusura», «presentazione delle domande»,
 *    «a pena di esclusione». Una data nuda non è mai una scadenza;
 *  · se la qualifica più vicina è di PUBBLICAZIONE («pubblicato il», «prot. n.»,
 *    «affisso», «inserito») la data si scarta: è l'atto, non il termine;
 *  · le date italiane si leggono davvero (`12/11/2026`, `12-11-2026`,
 *    `2026-11-12`, `12 novembre 2026`) e il 31 febbraio non esiste;
 *  · PURO: nessuna rete, nessun LLM, nessuna dipendenza. Stesso testo = stessa
 *    data. Guardia: `npm run test:scadenza-testo` (incluso in `npm test`).
 *  · la data trovata ha una NATURA dichiarata (`classificaDateAvviso`, §26.139):
 *    se è già passata è la PUBBLICAZIONE, se sta oltre i 90 giorni è
 *    «Disponibilità aperta / Fine contratto» — mai un termine perentorio per
 *    forza, mai una riga da buttare.
 */

const MESI: Readonly<Record<string, number>> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

/** Data ISO valida (`AAAA-MM-GG`) oppure `null`: mai il 31 febbraio. */
export function isoDa(giorno: number, mese: number, anno: number): string | null {
  if (anno < 2000 || anno > 2100 || mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
  const d = new Date(Date.UTC(anno, mese - 1, giorno));
  const ok =
    d.getUTCFullYear() === anno && d.getUTCMonth() === mese - 1 && d.getUTCDate() === giorno;
  if (!ok) return null;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/** `12/11/2027`, `12-11-2027`, `2027-11-12`, `12 novembre 2027`. */
const RE_DATA =
  /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\b\.?\s*(\d{4})\b/gi;

/** Una data trovata nel testo, con la posizione di inizio e di fine. */
export interface DataTrovata {
  iso: string;
  indice: number;
  fine: number;
}

/** Tutte le date VALIDE di un testo, con la posizione (per leggere l'etichetta). */
export function dateNelTesto(testoGrezzo: string): DataTrovata[] {
  const out: DataTrovata[] = [];
  for (const m of (testoGrezzo ?? '').matchAll(RE_DATA)) {
    const iso = m[4]
      ? isoDa(Number(m[6]), Number(m[5]), Number(m[4]))
      : m[7]
        ? isoDa(Number(m[7]), MESI[String(m[8]).toLowerCase()] ?? 0, Number(m[9]))
        : isoDa(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) out.push({ iso, indice: m.index ?? 0, fine: (m.index ?? 0) + m[0].length });
  }
  return out;
}

/** Parole che rendono una data un TERMINE, non una pubblicazione (§26.75). */
const RE_SCADENZA =
  /scadenz|termin[ei]|chiusur|entro|non\s+oltre|a\s+pena\s+di\s+esclusione|presentazion[ei]\s+(?:delle\s+)?(?:domande|istanze|candidature|richieste|manifestazion)|fine\s+(?:delle\s+)?domande|ricezione|ultimo\s+giorno|inoltr/i;

/** Parole che rendono una data una PUBBLICAZIONE (l'atto, non il termine). */
const RE_PUBBLICAZIONE =
  /pubblicat|pubblicazion|protocoll|prot\.?\s*n|affiss|inserit|data\s+di|decorrenz|dal\s+giorno/i;

/** Quanti caratteri PRIMA della data si guardano per trovare l'etichetta. */
const FINESTRA_PRIMA = 90;
/** Quanti caratteri DOPO la data si guardano per l'etichetta invertita. */
const FINESTRA_DOPO = 40;

/** Posizione dell'ULTIMA occorrenza del pattern (l'etichetta più vicina vince). */
function ultimaPosizione(testo: string, re: RegExp): number {
  const globale = new RegExp(re.source, 'gi');
  let ultima = -1;
  let m: RegExpExecArray | null;
  while ((m = globale.exec(testo)) !== null) {
    ultima = m.index;
    if (m.index === globale.lastIndex) globale.lastIndex += 1;
  }
  return ultima;
}

/**
 * True se nel tratto che precede la data l'etichetta più vicina è di TERMINE.
 * «Pubblicato il 12/11/2026» → false; «entro il 12/11/2026» → true; «pubblicato
 * il 10/11/2026. Domande entro il 12/11/2026» → true (l'ultima è «entro»).
 */
function qualificataComeTermine(prima: string): boolean {
  return ultimaPosizione(prima, RE_SCADENZA) > ultimaPosizione(prima, RE_PUBBLICAZIONE);
}

/** «12/11/2026 termine per la presentazione…»: etichetta DOPO la data. */
const RE_TERMINE_DOPO =
  /^[\s.,;:–—-]*(?:ore\s+\d{1,2}[:.]\d{2}\s*)?(?:il\s+)?(?:termine|scadenza|chiusura|entro|inoltr)/i;

/**
 * Scadenza DICHIARATA nel testo, altrimenti `null`.
 *
 * L'ordine è deliberato: prima la qualifica che precede la data (la forma usata
 * dagli avvisi: «entro il …»), poi quella che la segue («… 12/11/2026 termine»):
 * una data di pubblicazione non diventa mai un termine perché più avanti nella
 * pagina compare la parola «scadenza».
 */
export function scadenzaDaTesto(testoGrezzo: string): string | null {
  const testo = (testoGrezzo ?? '').replace(/\s+/g, ' ').trim();
  if (!testo) return null;
  const date = dateNelTesto(testo);

  for (const d of date) {
    const prima = testo.slice(Math.max(0, d.indice - FINESTRA_PRIMA), d.indice);
    if (qualificataComeTermine(prima)) return d.iso;
  }
  for (const d of date) {
    const dopo = testo.slice(d.fine, d.fine + FINESTRA_DOPO);
    if (RE_TERMINE_DOPO.test(dopo)) return d.iso;
  }
  return null;
}

/** Metadati di una voce d'elenco: testo del link, `title`, `aria-label`, URL. */
export interface MetadatiVoce {
  titolo?: string | null;
  ariaLabel?: string | null;
  url?: string | null;
}

/**
 * Scadenza scritta nei METADATI del link (non nel corpo): `title="… scadenza
 * 12/11/2026"`, `aria-label="…"`, oppure il nome del file
 * (`avviso_scadenza-12-11-2026.pdf`). Nel percorso la parola «scadenza» deve
 * esserci: l'anno di un permalink WordPress (`/2026/11/12/`) è pubblicazione.
 */
const RE_SCADENZA_IN_URL =
  /(?:scadenz\w*|entro|termin[ei])[^\d]{0,12}(\d{4})-(\d{2})-(\d{2})|(?:scadenz\w*|entro|termin[ei])[^\d]{0,12}(\d{1,2})[/._-](\d{1,2})[/._-](\d{4})/i;

/** Scadenza dichiarata nei metadati della voce, altrimenti `null`. */
export function scadenzaDaMetadati(meta: MetadatiVoce): string | null {
  for (const testo of [meta.titolo, meta.ariaLabel]) {
    const trovata = scadenzaDaTesto(testo ?? '');
    if (trovata) return trovata;
  }
  const m = RE_SCADENZA_IN_URL.exec(meta.url ?? '');
  if (!m) return null;
  return m[1]
    ? isoDa(Number(m[3]), Number(m[2]), Number(m[1]))
    : isoDa(Number(m[4]), Number(m[5]), Number(m[6]));
}

/* ------- NATURA DI UNA DATA: pubblicazione, termine, fine contratto (§26.139) ------- */

/**
 * Oltre questo numero di giorni una data non è più la finestra di una
 * candidatura: è la FINE di un incarico (30/04, 30/06, 31/08) o la disponibilità
 * che la scuola tiene aperta — non una soglia di colore (quella vive in
 * `lib/scadenzaSemaforo`).
 */
export const GIORNI_FINE_CONTRATTO = 90;

/** Code d'anno che nei contratti scolastici vogliono dire «fine incarico». */
const CODE_FINE_ANNO: ReadonlySet<string> = new Set(['04-30', '06-30', '07-31', '08-31']);

/** Che cosa è DAVVERO la data trovata in un avviso. */
export type NaturaTermine =
  | 'nessuna' | 'pubblicazione' | 'termine_candidatura' | 'termine_scaduto' | 'disponibilita_aperta';

/** Etichetta leggibile di ogni natura (UI, log, censimenti). */
export const ETICHETTA_NATURA: Readonly<Record<NaturaTermine, string>> = {
  nessuna: 'Nessun termine dichiarato',
  pubblicazione: 'Data di pubblicazione',
  termine_candidatura: 'Termine di candidatura',
  termine_scaduto: 'Termine già scaduto',
  disponibilita_aperta: 'Disponibilità aperta / Fine contratto',
};

/** Solo la parte DATA di un valore ISO (`2026-10-31T08:00` → `2026-10-31`). */
function parteData(valore?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((valore ?? '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
/** Data di calendario LOCALE: mai un giorno spostato dal fuso orario. */
function calendario(d: Date): string {
  const due = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}`;
}
/** Giorni di calendario fra due date (`b − a`); `null` se una non è leggibile. */
export function giorniTra(a?: string | null, b?: string | null): number | null {
  const da = parteData(a);
  const al = parteData(b);
  if (!da || !al) return null;
  return Math.round((Date.parse(`${al}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000);
}

/** True se la data è una CODA D'ANNO («30/04», «30/06», «31/07», «31/08»). */
export function eCodaAnnoScolastico(iso?: string | null): boolean {
  const data = parteData(iso);
  return data !== null && CODE_FINE_ANNO.has(data.slice(5));
}

/** Le due date di un avviso, ciascuna con la sua natura. */
export interface DateAvviso {
  publishedAt: string | null;
  expirationDate: string | null;
  natura: NaturaTermine;
  etichetta: string;
  giorni: number | null;
}

/**
 * CLASSIFICA le date di un avviso, con una regola sola (§26.139):
 *  · data già PASSATA e non dichiarata in colonna → è la PUBBLICAZIONE, non una
 *    scadenza perentoria: `expirationDate` torna `null` e la riga non nasce
 *    «scaduta» per una data che parlava d'altro («31 ottobre» in testa all'atto);
 *  · data in COLONNA (`esplicita`) già passata → resta la scadenza, natura
 *    `termine_scaduto`: la fonte l'ha dichiarata, non la reinterpretiamo;
 *  · oltre `GIORNI_FINE_CONTRATTO` o su una coda d'anno oltre il mese →
 *    `disponibilita_aperta` («Disponibilità aperta / Fine contratto»), mai una
 *    riga da buttare; altrimenti → `termine_candidatura`.
 */
export function classificaDateAvviso(
  date: { scadenza?: string | null; pubblicazione?: string | null; esplicita?: boolean; oggi?: string | Date },
): DateAvviso {
  const pubblicazione = parteData(date.pubblicazione);
  const scadenza = parteData(date.scadenza);
  if (!scadenza) {
    return { publishedAt: pubblicazione, expirationDate: null, natura: 'nessuna', etichetta: ETICHETTA_NATURA.nessuna, giorni: null };
  }
  const oggi = date.oggi instanceof Date ? calendario(date.oggi) : parteData(date.oggi);
  const giorni = giorniTra(oggi ?? calendario(new Date()), scadenza);
  const passata = giorni !== null && giorni < 0;
  if (passata && date.esplicita !== true) {
    return { publishedAt: pubblicazione ?? scadenza, expirationDate: null, natura: 'pubblicazione', etichetta: ETICHETTA_NATURA.pubblicazione, giorni };
  }
  const lontana =
    !passata && giorni !== null && (giorni > GIORNI_FINE_CONTRATTO || (giorni > 30 && eCodaAnnoScolastico(scadenza)));
  const natura: NaturaTermine = passata ? 'termine_scaduto' : lontana ? 'disponibilita_aperta' : 'termine_candidatura';
  return { publishedAt: pubblicazione, expirationDate: scadenza, natura, etichetta: ETICHETTA_NATURA[natura], giorni };
}

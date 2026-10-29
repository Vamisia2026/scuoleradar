/**
 * ScuoleRadar.it — RIGHE D'INTERPELLO DENTRO UNA TABELLA DI DOCUMENTO (§26.101).
 *
 * Perché esiste: gli Uffici Scolastici Territoriali non pubblicano un avviso per
 * scuola, pubblicano UN documento con la TABELLA delle scuole che assumono.
 * L'avviso n. 72 dell'ATP Bergamo, per esempio, dichiara nel testo:
 *
 *   BGIS033008 - ISTITUTO DI ISTR. SUP. «ZENALE E BUTINONE» TREVIGLIO
 *   A026 - MATEMATICA
 *   Interpelli per le supplenze
 *   1 - 18 ore
 *   2/11/2026    ← inizio incarico
 *   22/12/2026   ← fine incarico
 *   29/10/2026   ← scadenza interpello
 *   https://www.zenale.edu.it/pagine/interpelli
 *
 * Letta come un unico testo, la pagina era «un avviso senza scadenza»: la
 * scadenza non è nel post — è nella tabella, una riga per istituto. E ogni riga
 * ha il proprio codice, la propria classe, la propria data e il proprio link:
 * sono QUATTRO avvisi distinti, non uno.
 *
 * COME SI LEGGE (strutturale, nessuna lista di portali)
 *  1. ancora: una riga che comincia con un CODICE MECCANOGRAFICO e un nome
 *     (`BGIS033008 - …`) apre un blocco;
 *  2. nel blocco: la prima riga `CLASSE - MATERIA` (`A026 - MATEMATICA`,
 *     `ADEE - SOSTEGNO SCUOLA PRIMARIA`, `AAAA - SCUOLA DELL'INFANZIA`);
 *  3. le DATE della riga, in ordine di lettura: se sono tre o più, il TERMINE è
 *     la TERZA (inizio incarico · fine incarico · scadenza), che è l'ordine di
 *     tutte le tabelle «Interpelli ricerca supplenti»; con una o due date non si
 *     indovina nulla e la riga resta senza scadenza;
 *  4. il primo link `http(s)` del blocco è la pagina dell'avviso di QUELLA scuola.
 *
 * Nessuna data inventata, nessuna classe inventata: se il documento non dichiara,
 * la riga non esce. PURO: nessuna rete, nessun database.
 * Guardia: `npm run test:sgranatura` (incluso in `npm test`).
 */

/** Una riga d'interpello: un avviso per una scuola. */
export interface RigaTabellaInterpelli {
  schoolCode: string;
  schoolName: string;
  classCode: string | null;
  subject: string | null;
  /** Termine in forma ISO (`aaaa-mm-gg`), `null` se il documento non lo dichiara. */
  deadline: string | null;
  sourceUrl: string | null;
}

/** Codice meccanografico + denominazione: apre il blocco di una scuola. */
const RE_RIGA_SCUOLA = /^([A-Z]{2}[A-Z0-9]{8})\s*[-–—]\s*(.{3,120})$/;

/** Classe di concorso o tipologia di posto + materia. */
const RE_RIGA_CLASSE = /^([A-Z]{1,2}\d{2,3}|[A-Z]{4,6})\s*[-–—]\s*(.{2,120})$/;

/** Data italiana (`29/10/2026`, `2.11.2026`, `2-11-2026`). */
const RE_DATA = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/g;

/** Riga che è SOLO un link: il documento dell'avviso di quella scuola. */
const RE_LINK = /^<?(https?:\/\/[^\s<>"']+)>?$/i;

/** Indice della data che è il TERMINE nella tabella (0 = inizio, 2 = scadenza). */
export const INDICE_DATA_SCADENZA = 2;
/** Date minime perché il termine sia leggibile (inizio · fine · scadenza). */
export const DATE_MINIME_RIGA = INDICE_DATA_SCADENZA + 1;

/** `29/10/2026` → `2026-10-29`; `null` se la data non esiste sul calendario. */
export function dataIsoItaliana(giorno: string, mese: string, anno: string): string | null {
  const g = Number(giorno);
  const m = Number(mese);
  const a = Number(anno);
  if (!Number.isInteger(g) || !Number.isInteger(m) || !Number.isInteger(a)) return null;
  if (a < 2000 || a > 2100 || m < 1 || m > 12 || g < 1 || g > 31) return null;
  const data = new Date(Date.UTC(a, m - 1, g));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== m - 1 || data.getUTCDate() !== g) return null;
  const due = (n: number): string => String(n).padStart(2, '0');
  return `${a}-${due(m)}-${due(g)}`;
}

/** Tutte le date di un blocco, in ordine di lettura, in forma ISO. */
function dateDelBlocco(righe: readonly string[]): string[] {
  const out: string[] = [];
  for (const riga of righe) {
    for (const m of riga.matchAll(RE_DATA)) {
      const iso = dataIsoItaliana(m[1], m[2], m[3]);
      if (iso) out.push(iso);
    }
  }
  return out;
}

/**
 * Le righe d'interpello di un documento tabellare. `[]` quando il testo non è
 * quella tabella: nessun record, nessuna eccezione.
 */
export function righeTabellaInterpelli(testo: string): RigaTabellaInterpelli[] {
  if (typeof testo !== 'string' || testo.trim() === '') return [];
  const righe = testo
    .split(/\r?\n/)
    .map((r) => r.replace(/[\u00a0\u2007\u202f]/g, ' ').trim())
    .filter(Boolean);
  const aperture: { indice: number; match: RegExpExecArray }[] = [];
  for (let i = 0; i < righe.length; i += 1) {
    const match = RE_RIGA_SCUOLA.exec(righe[i]);
    if (match) aperture.push({ indice: i, match });
  }
  const out: RigaTabellaInterpelli[] = [];
  for (let k = 0; k < aperture.length; k += 1) {
    const { indice, match } = aperture[k];
    const fine = k + 1 < aperture.length ? aperture[k + 1].indice : righe.length;
    const blocco = righe.slice(indice + 1, fine);
    const classe = blocco.map((r) => RE_RIGA_CLASSE.exec(r)).find((m) => m !== null) ?? null;
    const date = dateDelBlocco(blocco);
    const link = blocco.find((r) => RE_LINK.test(r)) ?? '';
    const sourceUrl = link ? RE_LINK.exec(link)?.[1] ?? null : null;
    out.push({
      schoolCode: match[1].toUpperCase(),
      schoolName: match[2].trim(),
      classCode: classe ? classe[1].toUpperCase() : null,
      subject: classe ? classe[2].trim() : null,
      deadline: date.length >= DATE_MINIME_RIGA ? date[INDICE_DATA_SCADENZA] : null,
      sourceUrl,
    });
  }
  return out;
}

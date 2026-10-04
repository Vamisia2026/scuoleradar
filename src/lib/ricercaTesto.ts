/**
 * ScuoleRadar.it — NORMALIZZAZIONE e MATCHING TESTUALE della ricerca Radar.
 *
 * Modulo PURO, senza stato e senza UI: qui vivono le UNA VOLTA le regole di
 * confronto usate da ogni superficie (ricerca unificata del wizard, sezione «In
 * cosa puoi lavorare» delle Preferenze, filtro delle classi di concorso).
 *
 * Perché è separato: `ricercaSelezioniRadar.ts` compone i risultati, mentre il
 * confronto tra testo digitato e catalogo (accenti, trattini, codici «a19» ≡
 * «A-19», ordini di scuola «CPIA»/«adulti», co-occorrenze tra materie) sta qui —
 * un file per responsabilità, sotto le soglie strutturali del progetto.
 */
import { CORRELAZIONI_MATERIE, materie, ordiniScuola } from '../data/ordiniMaterie';

/** Testo normalizzato per il confronto: minuscolo, senza accenti, spazi e trattini. */
export function normalizzaTestoRicerca(testo: string): string {
  return (testo ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]/g, '')
    .trim();
}

/** Etichetta leggibile di una materia di catalogo (id → nome). */
export function etichettaMateria(id: string): string {
  return materie.find((m) => m.id === id)?.nome ?? id;
}

/**
 * Divide un testo libero in PAROLE CHIAVE indipendenti.
 *
 * L'utente può scrivere o incollare più voci separate da **virgola** (o punto e
 * virgola): «Intelligenza artificiale, Didattica digitale, Teatro» diventa TRE tag
 * distinti, mai un'unica stringa incollata. Spazi normalizzati, voci vuote scartate
 * e duplicati rimossi (confronto senza accenti/maiuscole).
 */
export function separaParoleChiave(testo: string): string[] {
  const out: string[] = [];
  const visti = new Set<string>();
  for (const pezzo of (testo ?? '').split(/[,;]/)) {
    const voce = pezzo.trim().replace(/\s+/g, ' ');
    if (!voce) continue;
    const chiave = normalizzaTestoRicerca(voce);
    if (!chiave || visti.has(chiave)) continue;
    visti.add(chiave);
    out.push(voce);
  }
  return out;
}

/** true se la materia (o la sua etichetta) risponde alla query normalizzata. */
export function materiaRisponde(id: string, q: string): boolean {
  return normalizzaTestoRicerca(id).includes(q) || normalizzaTestoRicerca(etichettaMateria(id)).includes(q);
}

/**
 * ID di materie CORRELATE alla query, normalizzati: il termine cercato stesso più
 * i sinonimi/co-occorrenze curate (`CORRELAZIONI_MATERIE`). È l'aggancio ESTESO:
 * «Inglese» → `inglese`, `clil`, `educazione_linguistica`… La tabella vive in
 * `data/ordiniMaterie.ts` (nessun id inventato: punta solo a materie esistenti).
 */
export function materieCorrelate(query: string): Set<string> {
  const q = normalizzaTestoRicerca(query);
  const correlate = new Set<string>();
  if (!q) return correlate;
  correlate.add(q);
  for (const id of CORRELAZIONI_MATERIE[q] ?? []) correlate.add(normalizzaTestoRicerca(id));
  return correlate;
}

/** True se l'id di materia è tra quelli correlati alla query. */
export function materiaCorrelata(id: string, correlate: ReadonlySet<string>): boolean {
  return correlate.has(normalizzaTestoRicerca(id));
}

/**
 * True se l'ORDINE di scuola di una classe risponde alla query: «CPIA» trova le
 * classi dell'istruzione per adulti, «primaria» quelle della scuola primaria,
 * «adulti» la stessa area (`ordiniScuola`). Serve perché l'utente cerca la
 * classe con il nome dell'ordine che ha in mente, non solo con il codice.
 */
export function ordineRisponde(ordine: string | undefined, q: string): boolean {
  if (!ordine) return false;
  const info = ordiniScuola.find((o) => o.id === ordine);
  return normalizzaTestoRicerca(info?.nome ?? ordine).includes(q);
}

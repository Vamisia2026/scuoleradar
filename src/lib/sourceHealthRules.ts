/**
 * ScuoleRadar.it — REGOLE DI SALUTE E QUARANTENA DELLE FONTI (§26.85).
 *
 * Il cervello della telemetria, separato dalla persistenza per restare PURO:
 * nessuna rete, nessun database, orologio iniettato. Qui vive la decisione
 * («questa fonte va isolata? perché?»), in `sourceTelemetry.ts` le operazioni
 * con la memoria di processo e in `sourceTelemetryDb.ts` il ponte Supabase.
 *
 * Le soglie:
 *   · `SOGLIA_QUARANTENA` (3) fallimenti consecutivi (`empty` o `quarantine`);
 *   · `SOGLIA_LAYOUT_IGNOTO` (2) run con layout non riconosciuto: un rifacimento
 *     grafico è un guasto conclamato prima di tre run — i parser non trovano
 *     più le colonne, non è «una pagina vuota»;
 *   · `SOGLIA_NON_TROVATO` (2) run con `404`/`410`: il dominio è sparito, non è
 *     anti-bot né lentezza — è la prova più forte che abbiamo (§26.109).
 *
 * Un `success` azzera tutto: la ri-validazione è automatica, nessuno deve
 * ricordarsi di togliere la fonte dalla naftalina. In più la quarantena NON è
 * eterna: la finestra dei 60 giorni vive in `sourceQuarantine.ts` (scadenza e
 * insieme degli URL da saltare), così queste regole restano senza stato.
 */

/** Esito di un run di lettura di una fonte (lo decide chi chiama). */
export type EsitoRun = 'success' | 'empty' | 'quarantine';
/** Perché una fonte è stata isolata. */
export type MotivoQuarantena = 'layout_changed' | 'timeout' | 'zero_items' | 'not_found';
/** Stato registrato: l'esito dell'ultimo run o `unknown` (mai vista). */
export type StatoFonte = EsitoRun | 'unknown';

/** Dettagli del run: voci estratte, layout letto, errore. */
export interface DettagliRun {
  itemsCount: number;
  layoutDetected?: string;
  error?: string;
}

/** Stato di salute di una fonte: la riga di `source_health` in camelCase. */
export interface SourceHealthStatus {
  sourceUrl: string;
  status: StatoFonte;
  consecutiveFailures: number;
  isQuarantined: boolean;
  quarantineReason: MotivoQuarantena | null;
  quarantinedAt: string | null;
  layoutDetected: string | null;
  itemsCount: number;
  totalRuns: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

/**
 * Porta di persistenza (architettura esagonale): il dominio dichiara le due
 * operazioni, `sourceTelemetryDb.ts` le implementa su `public.source_health` e
 * i test le sostituiscono con un doppio in memoria.
 */
export interface PonteTelemetria {
  /** Tutte le fonti note: UNA query per run. Lancia se il DB non risponde. */
  leggi(): Promise<SourceHealthStatus[]>;
  /** Scrive/aggiorna una fonte: `null` = scritto, stringa = errore. */
  salva(stato: SourceHealthStatus): Promise<string | null>;
}

/** Run falliti consecutivi oltre i quali la fonte viene isolata. */
export const SOGLIA_QUARANTENA = 3;
/** Layout ignoto ripetuto per questi run = rifacimento grafico. */
export const SOGLIA_LAYOUT_IGNOTO = 2;
/** Run con `404`/`410` oltre i quali il dominio è dato per morto. */
export const SOGLIA_NON_TROVATO = 2;

/** Layout che l'euristica universale (§26.84) sa leggere. */
const LAYOUT_NOTI: readonly string[] = ['table', 'aria_grid', 'wp_posts'];

/** Stato neutro: fonte mai vista (o riga assente dalla telemetria). */
export function statoVuoto(sourceUrl: string): SourceHealthStatus {
  return {
    sourceUrl,
    status: 'unknown',
    consecutiveFailures: 0,
    isQuarantined: false,
    quarantineReason: null,
    quarantinedAt: null,
    layoutDetected: null,
    itemsCount: 0,
    totalRuns: 0,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
}

/**
 * Chiave canonica di una fonte: senza frammento né spazi accidentali, così la
 * stessa pagina scritta in due modi resta UNA fonte sola.
 */
export function normalizzaUrl(raw: string): string {
  const testo = String(raw ?? '').trim();
  if (!testo) return '';
  try {
    const url = new URL(testo);
    url.hash = '';
    return url.toString();
  } catch {
    return testo;
  }
}

/** Il layout letto è uno di quelli riconosciuti? (`unknown`/assente = no) */
export function layoutRiconosciuto(layout?: string | null): boolean {
  return typeof layout === 'string' && LAYOUT_NOTI.includes(layout);
}

/**
 * L'errore del trasporto dichiara la pagina SPARITA (`404`/`410`)? Allora non è
 * anti-bot né lentezza: è una prova che l'elenco non esiste più (§26.109).
 */
export function eNonTrovato(dettagli: DettagliRun): boolean {
  return /(^|\D)(404|410)(\D|$)/.test(dettagli.error ?? '');
}

/**
 * Perché il run è fallito. Con un errore la pagina non è mai stata servita
 * (timeout, HTTP ≥ 400, content-type sbagliato): il motivo è `timeout`, il
 * cappello del trasporto — tranne il `404`/`410`, che è un `not_found` conclamato.
 * Senza errore la pagina è stata letta: se il layout è ignoto è un
 * `layout_changed`, altrimenti l'elenco era vuoto (`zero_items`).
 */
export function motivoGuasto(dettagli: DettagliRun): MotivoQuarantena {
  if ((dettagli.error ?? '').trim()) return eNonTrovato(dettagli) ? 'not_found' : 'timeout';
  return layoutRiconosciuto(dettagli.layoutDetected) ? 'zero_items' : 'layout_changed';
}

/**
 * Soglia di isolamento per motivo: un `404`/`410` ripetuto è più probante di un
 * timeout (che può essere la rete) e isola al secondo run.
 */
export function sogliaQuarantena(motivo: MotivoQuarantena): number {
  if (motivo === 'layout_changed') return SOGLIA_LAYOUT_IGNOTO;
  if (motivo === 'not_found') return SOGLIA_NON_TROVATO;
  return SOGLIA_QUARANTENA;
}

/**
 * Stato successivo della fonte. PURA: la stessa sequenza di run produce sempre
 * lo stesso stato, quarantena compresa, che si prova senza database.
 */
export function valutaRun(
  sourceUrl: string,
  precedente: SourceHealthStatus | null,
  esito: EsitoRun,
  dettagli: DettagliRun,
  adesso: Date = new Date(),
): SourceHealthStatus {
  const base = precedente ?? statoVuoto(sourceUrl);
  const istante = adesso.toISOString();
  const fallito = esito !== 'success';
  const fallimenti = fallito ? base.consecutiveFailures + 1 : 0;
  const motivo = fallito ? motivoGuasto(dettagli) : null;
  // «Layout ignoto che persiste» è un guasto conclamato già al secondo run, un
  // dominio sparito pure: la soglia dipende dal motivo (vedi `sogliaQuarantena`).
  const scatta = motivo !== null && fallimenti >= sogliaQuarantena(motivo);
  // Una fonte isolata resta isolata finché un run riuscito non la riabilita.
  const isolata = fallito && (scatta || base.isQuarantined);
  return {
    ...base,
    sourceUrl,
    status: esito,
    consecutiveFailures: fallimenti,
    isQuarantined: isolata,
    // Motivo e data sono quelli del run che ha ISOLATO la fonte: restano stabili
    // anche se i run successivi falliscono per un'altra ragione.
    quarantineReason: !isolata ? null : base.isQuarantined ? base.quarantineReason : motivo,
    quarantinedAt: isolata ? base.quarantinedAt ?? istante : null,
    layoutDetected: dettagli.layoutDetected ?? null,
    itemsCount: Math.max(0, Math.trunc(Number(dettagli.itemsCount) || 0)),
    totalRuns: base.totalRuns + 1,
    lastRunAt: istante,
    lastSuccessAt: fallito ? base.lastSuccessAt : istante,
    lastError: fallito ? dettagli.error ?? base.lastError : null,
  };
}

/**
 * Le fonti da lavorare, nell'ordine originale. `ignora` è il giro di
 * ri-validazione (`--ignora-quarantena`): si passa anche sulle fonti isolate.
 */
export function filtraFontiSane<T extends { url: string }>(
  fonti: readonly T[],
  quarantena: ReadonlySet<string>,
  opzioni: { ignora?: boolean } = {},
): T[] {
  if (opzioni.ignora || quarantena.size === 0) return [...fonti];
  return fonti.filter((fonte) => !quarantena.has(normalizzaUrl(fonte.url)));
}

/**
 * ScuoleRadar.it — TELEMETRIA DELLE FONTI E QUARANTENA AUTOMATICA (§26.85).
 *
 * La pagina che ieri dava 40 interpelli oggi può restituire zero righe, un
 * timeout o un layout che nessun parser conosce. Senza memoria la scansione
 * riprova per sempre le stesse fonti rotte e nessuno se ne accorge: qui ogni run
 * lascia un segno e una fonte che sbaglia in modo ripetuto finisce in
 * QUARANTENA, dove i giri ordinari la saltano finché non torna a pubblicare (un
 * `success` la riabilita da solo) o qualcuno non la riabilita a mano.
 *
 * Tre strati, un compito ciascuno:
 *   · `sourceHealthRules.ts` — le regole PURE (soglie, motivi, `valutaRun`);
 *   · QUESTO modulo — memoria del run e operazioni (`recordSourceRun`,
 *     `getSourceHealth`, `fontiInQuarantena`, `riabilitaFonte`);
 *   · `sourceTelemetryDb.ts` — il ponte Supabase (`public.source_health`).
 *
 * ROBUSTEZZA: nessuna funzione lancia. Se il database non risponde lo stato
 * resta in memoria di processo e si logga un avviso per URL: un guasto della
 * telemetria non deve MAI fermare l'ingestione. `caricaTutte` è anche la cache
 * di lettura del run: una query, non una per fonte.
 *
 * Guardia: `npm run test:source-telemetry` (incluso in `npm test`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  normalizzaUrl,
  statoVuoto,
  valutaRun,
  type DettagliRun,
  type EsitoRun,
  type PonteTelemetria,
  type SourceHealthStatus,
} from './sourceHealthRules';
import { ponteSupabase } from './sourceTelemetryDb';
import { fontiIsolate, quarantenaScaduta } from './sourceQuarantine';

// Un solo punto d'import per chi registra o legge la salute di una fonte.
export * from './sourceHealthRules';
export * from './sourceQuarantine';

/** Opzioni comuni: client Supabase, ponte esplicito (test) e orologio. */
export interface OpzioniTelemetria {
  client?: SupabaseClient | null;
  ponte?: PonteTelemetria;
  adesso?: Date;
}

/** Cache di processo: stato più recente per URL, usata quando il DB tace. */
const memoria = new Map<string, SourceHealthStatus>();
/** URL di cui si è già segnalato un guasto di persistenza (un log per URL). */
const avvisati = new Set<string>();

/** Azzera la memoria di processo (test, run lunghi, cambio di dataset). */
export function resetTelemetria(): void {
  memoria.clear();
  avvisati.clear();
}

const messaggio = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** Un avviso per URL: un DB irraggiungibile non deve inondare il log del giro. */
function avvisa(chiave: string, motivo: string): void {
  if (avvisati.has(chiave)) return;
  avvisati.add(chiave);
  console.warn(`⚠ telemetria fonti: ${motivo} (${chiave}) — lo stato resta in memoria.`);
}

/** Ponte del chiamante: esplicito nei test, dal client nei runner. */
function ponteDi(opzioni: OpzioniTelemetria): PonteTelemetria | null {
  if (opzioni.ponte) return opzioni.ponte;
  return opzioni.client ? ponteSupabase(opzioni.client) : null;
}

/** Tutte le fonti note nella memoria del run (una query). Non lancia mai. */
export async function caricaTutte(
  ponte: PonteTelemetria | null,
): Promise<SourceHealthStatus[]> {
  try {
    for (const riga of (await ponte?.leggi()) ?? []) {
      const url = normalizzaUrl(riga.sourceUrl);
      if (url) memoria.set(url, { ...riga, sourceUrl: url });
    }
  } catch (err) {
    avvisa('elenco', `source_health non leggibile (${messaggio(err)})`);
  }
  return [...memoria.values()];
}

/** Riga dal DB se questa esecuzione non l'ha ancora vista. */
async function precedenteDi(
  url: string,
  ponte: PonteTelemetria | null,
): Promise<SourceHealthStatus | null> {
  if (memoria.has(url)) return memoria.get(url) ?? null;
  if (!ponte) return null;
  await caricaTutte(ponte);
  return memoria.get(url) ?? null;
}

/**
 * Registra l'esito di un run e, se le regole lo dicono, isola la fonte.
 * `Promise<void>`, nessuna eccezione: qui il runner dichiara «ho letto questa
 * pagina», non è il punto in cui la scansione si ferma.
 */
export async function recordSourceRun(
  sourceUrl: string,
  status: EsitoRun,
  details: DettagliRun,
  opzioni: OpzioniTelemetria = {},
): Promise<void> {
  try {
    const url = normalizzaUrl(sourceUrl);
    if (!url) return;
    const ponte = ponteDi(opzioni);
    const precedente = await precedenteDi(url, ponte);
    const adesso = opzioni.adesso ?? new Date();
    // Quarantena a termine: dopo la finestra la fonte riparte dai contatori a zero
    // (se è ancora morta, le regole la isolano di nuovo al primo run fallito).
    const base = precedente && quarantenaScaduta(precedente, adesso) ? null : precedente;
    const stato = valutaRun(
      url,
      base,
      status,
      details ?? { itemsCount: 0 },
      adesso,
    );
    memoria.set(url, stato);

    const era = precedente?.isQuarantined === true;
    if (stato.isQuarantined && !era) {
      console.warn(
        `⛔ telemetria fonti: FONTE IN QUARANTENA (${stato.quarantineReason}, ${stato.consecutiveFailures} run falliti): ${url}`,
      );
    } else if (era && !stato.isQuarantined) {
      console.log(`✅ telemetria fonti: fonte riabilitata: ${url}`);
    }

    const errore = ponte ? await ponte.salva(stato) : null;
    if (errore) avvisa(url, `source_health non scrivibile (${errore})`);
  } catch (err) {
    // Error boundary: la telemetria non ferma mai la scansione.
    console.warn(
      `⚠ telemetria fonti: run non registrato (${messaggio(err)}) — la scansione prosegue.`,
    );
  }
}

/** Stato di salute: memoria del run, poi DB, poi neutro. Non lancia mai. */
export async function getSourceHealth(
  sourceUrl: string,
  opzioni: OpzioniTelemetria = {},
): Promise<SourceHealthStatus> {
  const url = normalizzaUrl(sourceUrl);
  if (!url) return statoVuoto('');
  try {
    return (await precedenteDi(url, ponteDi(opzioni))) ?? statoVuoto(url);
  } catch (err) {
    avvisa(url, `stato non leggibile (${messaggio(err)})`);
    return memoria.get(url) ?? statoVuoto(url);
  }
}

/** Gli URL isolati che i giri ordinari devono saltare (`filtraFontiSane`). */
export async function fontiInQuarantena(
  opzioni: OpzioniTelemetria = {},
): Promise<Set<string>> {
  const tutte = await caricaTutte(ponteDi(opzioni));
  return fontiIsolate(tutte, opzioni.adesso);
}

/**
 * Reset manuale: la fonte torna candidabile con i contatori a zero. Serve dopo
 * aver corretto un parser o cambiato l'URL nel portale — e non è obbligatorio
 * quando la fonte torna a pubblicare, perché un `success` riabilita da solo.
 */
export async function riabilitaFonte(
  sourceUrl: string,
  opzioni: OpzioniTelemetria = {},
): Promise<void> {
  const url = normalizzaUrl(sourceUrl);
  if (!url) return;
  try {
    const ponte = ponteDi(opzioni);
    const stato: SourceHealthStatus = {
      ...((await precedenteDi(url, ponte)) ?? statoVuoto(url)),
      consecutiveFailures: 0,
      isQuarantined: false,
      quarantineReason: null,
      quarantinedAt: null,
      lastError: null,
      lastRunAt: (opzioni.adesso ?? new Date()).toISOString(),
    };
    memoria.set(url, stato);
    const errore = ponte ? await ponte.salva(stato) : null;
    if (errore) avvisa(url, `source_health non scrivibile (${errore})`);
  } catch (err) {
    console.warn(`⚠ telemetria fonti: riabilitazione non riuscita (${messaggio(err)}).`);
  }
}

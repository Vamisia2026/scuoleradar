/**
 * ScuoleRadar.it — DIGEST GIORNALIERO (modulo puro).
 *
 * Regola di servizio (split per tier):
 *   · **PRO** → alert INDIVIDUALI in TEMPO REALE su Telegram (appena scrapati);
 *   · **BASE** → nessun alert in tempo reale: UN SOLO riepilogo al giorno, alle
 *     17:00 italiane, con TUTTE le opportunità della giornata.
 * L'email resta un riepilogo quotidiano per entrambi i tier (riepilogo = un unico
 * messaggio, mai un flusso di email).
 *
 * Questo modulo contiene SOLO la parte deterministica e testabile:
 *   · ora/data locale italiana senza dipendenze (`Intl`, fuso `Europe/Rome`);
 *   · finestra di invio (18:00) e descrizione per log/UI;
 *   · ordinamento delle voci (scadenza più vicina in cima) e raggruppamento.
 *
 * Nessuna dipendenza da rete, DB o DOM: usabile da script Node, Edge e frontend.
 * È VOLUTAMENTE senza import: così non trascina moduli Node-only (resend/telegram)
 * nel programma TypeScript del frontend.
 */

/** Fuso orario ufficiale del servizio (scuole italiane). */
export const FUSO_ITALIA = 'Europe/Rome';

/**
 * Vista MINIMA di un'opportunità richiesta da questo modulo: solo i campi usati
 * per ordinare/raggruppare. I chiamanti passano i loro tipi completi (es.
 * `DettagliNotifica`) senza che il modulo li debba importare.
 */
export interface VoceOrdinabile {
  /** Codice provincia (es. "AT"). */
  province?: string | null;
  /** Titolo dell'avviso (ordinamento stabile a parità di scadenza). */
  title?: string | null;
  /** Scadenza ISO, se dichiarata dalla fonte. */
  scadenza?: string | null;
}

/** Ora locale (0–23) di invio del riepilogo giornaliero: fine giornata scolastica. */
export const ORA_DIGEST = 17;

/** Ora locale italiana (0–23) di un istante. Fallback robusto in UTC. */
export function oraLocaleItalia(istante: Date = new Date()): number {
  try {
    const formattato = new Intl.DateTimeFormat('it-IT', {
      hour: '2-digit',
      hour12: false,
      timeZone: FUSO_ITALIA,
    }).format(istante);
    const ora = Number(String(formattato).replace(/\D/g, ''));
    return Number.isFinite(ora) ? ora % 24 : istante.getUTCHours();
  } catch {
    return istante.getUTCHours();
  }
}

/** Data locale italiana in formato `YYYY-MM-DD`. */
export function dataLocaleItalia(istante: Date = new Date()): string {
  try {
    // `en-CA` produce direttamente l'ordine ISO (YYYY-MM-DD).
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: FUSO_ITALIA,
    }).format(istante);
  } catch {
    return istante.toISOString().slice(0, 10);
  }
}

/** Data estesa italiana, es. "12 settembre 2026" (per oggetto/email). */
export function etichettaDataItalia(istante: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: FUSO_ITALIA,
    }).format(istante);
  } catch {
    return dataLocaleItalia(istante);
  }
}

/**
 * True se è l'ora del digest. I cron girano in UTC, quindi si schedula su DUE
 * orari UTC (estate/inverno) e si invia SOLO quando in Italia sono le 18:00.
 * `forzato` serve al lancio manuale (workflow_dispatch / admin).
 */
export function eOraDelDigest(istante: Date = new Date(), forzato = false): boolean {
  return forzato || oraLocaleItalia(istante) === ORA_DIGEST;
}

/** Descrizione leggibile della finestra di invio (log, admin, doc). */
export function descrizioneFinestraDigest(): string {
  return `ogni giorno alle 17:00 (ora italiana, ${FUSO_ITALIA})`;
}

/** Scadenza in millisecondi, `null` quando assente/non valida. */
function tempoScadenza(iso?: string | null): number | null {
  const s = (iso ?? '').trim();
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Ordina le voci del digest: prima le scadenze più vicine (urgenza), poi quelle
 * senza scadenza dichiarata; a parità, ordine alfabetico di provincia/titolo per
 * una lista stabile e leggibile.
 */
export function ordinaVociDigest<T extends VoceOrdinabile>(voci: T[]): T[] {
  return [...voci].sort((a, b) => {
    const ta = tempoScadenza(a.scadenza);
    const tb = tempoScadenza(b.scadenza);
    if (ta !== null && tb !== null && ta !== tb) return ta - tb;
    if (ta !== null && tb === null) return -1;
    if (ta === null && tb !== null) return 1;
    const pa = (a.province ?? '').localeCompare(b.province ?? '');
    if (pa !== 0) return pa;
    return (a.title ?? '').localeCompare(b.title ?? '');
  });
}

/* ------------------- Ledger giornaliero (anti-spam email) ------------------- */

/**
 * Chiave del ledger "digest già inviato in questo giorno" per un utente.
 *
 * Perché serve: il Riepilogo deve essere UNO al giorno. Il cron può girare più
 * volte (due orari UTC per coprire estate/inverno, retry del runner, doppio
 * trigger) e i `notifications_log` da soli proteggono dalle voci duplicate, non
 * dal secondo MESSAGGIO con voci nuove. Registrando questa chiave SOLO dopo un
 * invio riuscito, un secondo run nello stesso giorno (ora italiana) non manda
 * nulla — tranne i lanci forzati (admin) che la ignorano.
 *
 * Formato: `utente|<uuid>:digest|<YYYY-MM-DD>` (stesso schema di `chiaveLedger`).
 */
export function chiaveDigestGiorno(userId: string, giorno: string): string {
  return `utente|${userId}:digest|${giorno}`;
}

/** Raggruppa le voci per provincia (riepiloghi e log per area). */
export function raggruppaPerProvincia<T extends VoceOrdinabile>(voci: T[]): Map<string, T[]> {
  const mappa = new Map<string, T[]>();
  for (const v of ordinaVociDigest(voci)) {
    const chiave = (v.province ?? '').trim().toUpperCase() || 'N/D';
    const gruppo = mappa.get(chiave);
    if (gruppo) gruppo.push(v);
    else mappa.set(chiave, [v]);
  }
  return mappa;
}

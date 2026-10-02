/**
 * ScuoleRadar.it — Dipartimento Notizie · Cadenza e tetti del feed.
 *
 * Le finestre temporali (lookback) e i tetti di articoli del dipartimento, con
 * le funzioni che li applicano: garanzia settimanale, tetto della finestra di
 * ingestione e cadenza settimanale bloccata (1–3 articoli/settimana).
 */

import type { NewsArticle } from '../types';

/**
 * CADENZA SETTIMANALE: minimo 1, massimo `MAX_ARTICOLI_SETTIMANA` articoli
 * datati negli ultimi 7 giorni. Espone l'esito per i log della pipeline e per i
 * test (`npm run test:notizie-feed`, `npm run test:notizie-rate`).
 */
export function verificaCadenzaSettimanale(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
): { recenti: number; ok: boolean; min: number; max: number } {
  const soglia = oggi.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recenti = articoli.filter((a) => {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    return !Number.isNaN(t) && t >= soglia;
  }).length;
  return {
    recenti,
    ok: recenti >= 1 && recenti <= MAX_ARTICOLI_SETTIMANA,
    min: 1,
    max: MAX_ARTICOLI_SETTIMANA,
  };
}

/** Tetto settimanale "di riferimento": ~3 articoli ad alto valore a settimana. */
export const MAX_ARTICOLI_SETTIMANA = 3;

/**
 * Finestra di LOOKBACK (giorni) della pipeline Notizie: copre l'avvio
 * dell'anno scolastico (presa di servizio, interpelli, supplenze…). Le notizie
 * pubblicate oltre questa finestra non vengono acquisite; le voci senza data
 * restano ammesse (non dimostrabili come "vecchie").
 */
export const FINESTRA_LOOKBACK_GIORNI = 15;

/**
 * Finestra di lookback per gli ATTI NAZIONALI STRUTTURALI (contratti collettivi,
 * decreti e ordinanze ministeriali): un CCNL firmato o un decreto nazionale
 * restano vincolanti per mesi, quindi una finestra di 15 giorni li
 * scarterebbe. NON si applica alle pagine di notizie quotidiane.
 */
export const FINESTRA_LOOKBACK_NAZIONALE_GIORNI = 60;

/**
 * Tetto articoli ad alto valore nella finestra di lookback: ~3 a settimana su
 * 15 giorni → 6 (copre le due settimane di avvio anno scolastico).
 */
export const MAX_ARTICOLI_FINESTRA = 6;

/**
 * Applica il tetto articoli: al massimo `max` articoli con data di
 * pubblicazione nella finestra di lookback (`FINESTRA_LOOKBACK_GIORNI`, 15 gg).
 * Gli articoli più rilevanti (punteggio, poi data) vengono tenuti; gli esuberi
 * sono scartati. Gli articoli più vecchi della finestra non vengono toccati
 * (accumulo).
 */
export function limitaArticoliSettimanali(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
  max: number = MAX_ARTICOLI_FINESTRA,
): { mantenuti: NewsArticle[]; rimossi: NewsArticle[] } {
  const soglia = oggi.getTime() - FINESTRA_LOOKBACK_GIORNI * 24 * 60 * 60 * 1000;
  const recenti: NewsArticle[] = [];
  const storici: NewsArticle[] = [];
  for (const a of articoli) {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    // Gli articoli SENZA data di fonte (pagine operative USR "evergreen") vanno
    // negli storici: NON consumano il tetto settimanale. Se li trattassimo come
    // recenti occuperebbero tutti gli slot del cap (max 6) bloccando ogni nuovo
    // articolo → bacheca "ferma".
    if (!Number.isNaN(t) && t >= soglia) recenti.push(a);
    else storici.push(a);
  }
  recenti.sort(
    (a, b) =>
      b.relevance_score - a.relevance_score ||
      (b.published_at || '').localeCompare(a.published_at || ''),
  );
  const tenuti = recenti.slice(0, max);
  const rimossi = recenti.slice(max);
  return { mantenuti: [...storici, ...tenuti], rimossi };
}

/* ---------------------- Cadenza settimanale (1–3 / settimana) ---------------------- */

/**
 * CADENZA SETTIMANALE BLOCCATA (1–3 articoli/settimana): mantiene al massimo
 * `max` articoli **datati** nella finestra di 7 giorni; gli altri articoli
 * recenti vengono scartati, mentre lo storico (più vecchio di 7 giorni) resta
 * intatto e non consuma la cadenza.
 *
 * Criterio di scelta: prima la **data più recente**, poi il punteggio. La
 * freschezza vince: il feed mostra sempre gli aggiornamenti nazionali del
 * momento (`newsArticles` è ordinato per data decrescente).
 */
export function limitaCadenzaSettimanale(
  articoli: NewsArticle[],
  oggi: Date = new Date(),
  max: number = MAX_ARTICOLI_SETTIMANA,
): { mantenuti: NewsArticle[]; rimossi: NewsArticle[] } {
  const soglia = oggi.getTime() - 7 * 24 * 60 * 60 * 1000;
  const recenti: NewsArticle[] = [];
  const storici: NewsArticle[] = [];
  for (const a of articoli) {
    const t = a.published_at ? new Date(a.published_at).getTime() : Number.NaN;
    if (!Number.isNaN(t) && t >= soglia) recenti.push(a);
    else storici.push(a);
  }
  recenti.sort(
    (a, b) =>
      (b.published_at || '').localeCompare(a.published_at || '') ||
      b.relevance_score - a.relevance_score,
  );
  return { mantenuti: [...storici, ...recenti.slice(0, max)], rimossi: recenti.slice(max) };
}

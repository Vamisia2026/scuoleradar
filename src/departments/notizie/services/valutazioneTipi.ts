/**
 * ScuoleRadar.it — Dipartimento Notizie · Contratto della valutazione.
 *
 * Vocabolario condiviso fra motore di rilevanza (`valutaRilevanza`), filtro
 * assistito (`promptFiltroLLM`) e ingestione: la voce in ingresso e l’esito
 * del giudizio editoriale. Modulo puro di soli tipi.
 */

export interface ValutazioneNotizia {
  rilevante: boolean;
  categoria: string | null;
  deadline: string | null;
  motivo?: string;
}

export interface VoceInValutazione {
  title: string;
  description?: string;
  /** URL della fonte ufficiale (serve al gate NAZIONALE e agli atti MIM). */
  url?: string;
  /** Data di pubblicazione dichiarata dalla fonte (ISO), se disponibile. */
  data?: string | null;
}

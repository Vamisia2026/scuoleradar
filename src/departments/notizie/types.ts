/**
 * ScuoleRadar.it — Dipartimento Notizie (Blog Engine).
 *
 * Dominio isolato: nessuna dipendenza dagli stati interni degli altri
 * dipartimenti (CV, CFU, Moduli, Assistente AI). Si integra con il resto
 * dell'app solo tramite router (react-router-dom) e primitive UI condivise.
 */

/** Articolo di notizia del dipartimento Notizie. */
export interface NewsArticle {
  /** Identificativo univoco (uuid/string). */
  id: string;
  /** Titolo dell'articolo. */
  title: string;
  /** Categoria (es. GPS, Mobilità, Concorsi). */
  category: string;
  /** Data di scadenza in formato ISO (es. "2026-09-15") oppure null. */
  deadline_date: string | null;
  /** 3 punti chiave mostrati nel box "In Sintesi". */
  summary_points: string[];
  /** Corpo dell'articolo in HTML semplice. */
  content_html: string;
  /** Link ufficiale alla fonte (MIM / Gazzetta Ufficiale). */
  official_source_url: string;
  /** Link al PDF ufficiale (se disponibile) oppure null. */
  official_pdf_url: string | null;
  /** Punteggio di rilevanza 0-100 (ordinamento). */
  relevance_score: number;
  /** Data di pubblicazione in formato ISO. */
  published_at: string;
}

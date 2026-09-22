/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board (Radar Live).
 *
 * Etichette di riga della tavola aeroportuale: risoluzione best-effort di
 * città/scuola/link a partire dalla riga grezza della tabella `interpelli`.
 * Funzioni PURE (nessun React, nessuna rete): l'unica dipendenza è il dataset
 * delle province. Regola di prodotto: mai inventare un'etichetta — se il dato
 * non è ricavabile con certezza si restituisce `null` e la cella resta vuota.
 */
import { province } from '@/data/province';

/** Riga reale della tabella `interpelli` (solo i campi serviti alla tavola). */
export interface InterpelloLive {
  id: string;
  title: string;
  school_name: string | null;
  /** Codice meccanografico: serve a risolvere il nome reale della scuola. */
  school_code?: string | null;
  province: string;
  class_codes: string[] | null;
  /** Materia/settore inferito dallo scraper quando manca una classe esplicita. */
  materia: string | null;
  expiration_date: string | null;
  created_at: string | null;
  source_url: string | null;
}

/** Nome completo della provincia (es. MI → Milano) come fonte primaria della città. */
export function nomeProvincia(codice?: string): string | null {
  return province.find((p) => p.codice === codice)?.nome ?? null;
}

/**
 * Estrae la città dall'interpello quando è affidabile:
 *  - nome provincia completo presente nel titolo (es. "... , Milano");
 *  - nessuna deduzione "creativa" (se non trovata → null, non si mostra nulla).
 */
export function estraiCitta(r: InterpelloLive): string | null {
  if (!r.title) return null;
  const nome = nomeProvincia(r.province);
  if (nome && r.title.includes(nome)) return nome;
  return null;
}

/**
 * Fallback scuola: quando school_name è vuoto prova a ricavare l'istituto
 * dal titolo (ultimo blocco dopo " — ", prima della virgola/città).
 * Rifiuta segmenti generici (non utili a scansionare la riga).
 */
export function estraiScuolaDaTitolo(r: InterpelloLive): string | null {
  if (!r.title) return null;
  const frame = (r.title.split(/[—–]/).pop() ?? '').trim();
  if (!frame) return null;
  const parte = (frame.split(',')[0] ?? '').replace(/\s+/g, ' ').trim();
  if (!parte || parte.length < 3 || /\d/.test(parte)) return null;
  const generici =
    /^(interpello|avviso|bando|selezione|esperto|supplenza|scuola|istituto|liceo|secondaria|primaria|infanzia|sostegno|posta|religione|posto)\b/i.test(
      parte,
    );
  return generici ? null : parte;
}

/**
 * URL http(s) assoluto e valido, altrimenti `null`.
 * Garantisce che la tabella esponga SOLO link apribili (mai relativi/malformati).
 */
export function urlValido(url?: string | null): string | null {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    new URL(u);
    return u;
  } catch {
    return null;
  }
}

/** True se il link punta a un documento PDF (risorsa specifica, non un tabellone). */
export function ePdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** Host del link: chiarisce la destinazione nel tooltip (nessun link ambiguo). */
export function hostDi(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board (Radar Live).
 * Etichette di riga della tavola aeroportuale: risoluzione best-effort di
 * città/scuola/link a partire dalla riga grezza della tabella interpelli.
 * Funzioni PURE (nessun React, nessuna rete): l'unica dipendenza è il dataset
 * delle province. Regola di prodotto: se il nome dell'istituto manca o non è 
 * rilevabile con certezza, restituisce "Scuola non specificata / Più plessi" 
 * per garantire la massima copertura e visibilità dei risultati sul monitor.
 */
import { province } from '@/data/province';
import { nomeIstitutoPresentabile } from '@/lib/nomeIstituto';

/** Riga reale della tabella interpelli (solo i campi serviti alla tavola). */
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
  source_url?: string | null;
}

/** Nome completo della provincia (es. MI → Milano) come fonte primaria della città. */
export function nomeProvincia(codice?: string): string | null {
  return province.find((p) => p.codice === codice)?.nome ?? null;
}

/**
 * Estrae la città dall'interpello quando è affidabile:
 * nome provincia completo presente nel titolo (es. "... , Milano");
 * nessuna deduzione "creativa" (se non trovata → null, non si mostra nulla).
 */
export function estraiCitta(r: InterpelloLive): string | null {
  if (!r.title) return null;
  const nome = nomeProvincia(r.province);
  if (nome && r.title.includes(nome)) return nome;
  return null;
}

/**
 * Fallback scuola rigoroso: quando school_name è vuoto o non valido,
 * prova a ricavare l'istituto dal titolo escludendo materie, classi e termini generici.
 */
export function estraiScuolaDaTitolo(r: InterpelloLive): string | null {
  if (!r.title) return null;
  const t = r.title.trim();

  const lower = t.toLowerCase();
  if (
    lower.startsWith('matematica') ||
    lower.startsWith('conversazione') ||
    lower.startsWith('annotazione') ||
    lower.includes('classe di concorso')
  ) {
    return null;
  }

  const frame = (t.split(/[—–]/).pop() ?? '').trim();
  if (!frame) return null;
  const parte = (frame.split(',')[0] ?? '').replace(/\s+/g, ' ').trim();

  if (!parte || parte.length < 3 || /\d/.test(parte)) return null;

  const generici = /^(interpello|avviso|bando|selezione|esperto|supplenza|scuola|istituto|liceo|secondaria|primaria|infanzia|sostegno|posta|religione|posto|matematica|fisica)\b/i.test(
    parte,
  );
  return generici ? null : parte;
}

/**
 * Nome della scuola mostrato in BACHECA con fallback robusto:
 * se manca un nome verificato, restituisce la dicitura standard per popolare il monitor.
 */
export function risolviNomeScuola(r: InterpelloLive): string {
  const nomePulito =
    nomeIstitutoPresentabile(r.school_name) ??
    estraiScuolaDaTitolo(r);

  if (!nomePulito) {
    return "Scuola non specificata / Più plessi";
  }

  return nomePulito;
}

/**
 * Filtro di validità per il tabellone: accetta scadenze valide future 
 * o avvisi pubblicati negli ultimi 60 giorni anche se privi di scadenza esatta.
 */
export function eInterpelloVisibile(r: InterpelloLive, oggi: Date = new Date()): boolean {
  const scadenza = (r.expiration_date ?? '').trim();
  
  if (scadenza) {
    // Controllo base di attività sulla scadenza
    const dataScad = new Date(scadenza);
    if (!isNaN(dataScad.getTime()) && dataScad >= oggi) {
      return true;
    }
  }

  // Fallback 60 giorni sulla data di creazione se manca la scadenza
  if (!scadenza && r.created_at) {
    const dataCreazione = new Date(r.created_at);
    const limiteDueMesi = new Date(oggi);
    limiteDueMesi.setMonth(limiteDueMesi.getMonth() - 2);

    if (!isNaN(dataCreazione.getTime()) && dataCreazione >= limiteDueMesi) {
      return true;
    }
  }

  return false;
}

/** URL http(s) assoluto e valido, altrimenti null. */
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

/** True se il link punta a un documento PDF. */
export function ePdf(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf');
  } catch {
    return false;
  }
}

/** Host del link. */
export function hostDi(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}
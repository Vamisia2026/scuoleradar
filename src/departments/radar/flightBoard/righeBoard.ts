/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board (Radar Live).
 * Etichette di riga della tavola aeroportuale: risoluzione best-effort di
 * città/link a partire dalla riga grezza della tabella interpelli.
 * Funzioni PURE (nessun React, nessuna rete): l'unica dipendenza è il dataset
 * delle province.
 *
 * REGOLA (§26.59, 05/10/2026): la scelta del nome MOSTRATO e lo scarto delle righe
 * vivono in `lib/liveBoard.ts` (`nomeScuolaBoard`/`preparaRigheBoard`) — un solo punto
 * di verità, e il gate è STRETTO: senza un istituto reale la riga non entra. Qui
 * restano solo le etichette di presentazione: le vecchie `risolviNomeScuola` (dicitura
 * fissa "Scuola non specificata / Più plessi") ed `eInterpelloVisibile` erano codice
 * MORTO e duplicavano la regola: rimosse, così non possono divergere.
 */
import { province } from '@/data/province';

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
  /**
   * True quando l'anagrafica della riga è incompleta (nome ricostruito da registro o
   * titolo, oppure stato `parziale`): il nome mostrato è comunque quello di un istituto
   * REALE (§26.59) e l'interfaccia lo dichiara — senza mai nascondere l'avviso.
   */
  anagrafica_parziale?: boolean;
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
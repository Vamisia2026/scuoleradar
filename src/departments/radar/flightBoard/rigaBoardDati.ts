/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Da una riga di `interpelli` alle informazioni che la tavola mostra ma il
 * database non contiene: la tipologia (classe di concorso o categoria), la
 * banda di urgenza/anzianità della scadenza e le date brevi. Nessun rendering,
 * nessuna rete, nessuno stato: il JSX sta in `components/RigaBoard.tsx`.
 *
 * REGOLA DI DESIGN (§badge-urgenza):
 *  - I token di colore dei badge vivono SOLO in `URGENZA_TOKENS` qui sotto.
 *  - Sia `calcolaUrgenza` (scadenza esplicita) sia il fallback per anzianità
 *    leggono dallo stesso oggetto. Non esistono stringhe di classe Tailwind
 *    duplicate in questo file o altrove.
 *  - Il ritorno pubblico è SEMPRE `{ label, className }` — mai `undefined`,
 *    mai forme alternative — così il consumatore non può "perdere" il colore.
 *  - I token sono quelli originali del sistema: verde / giallo / rosso /
 *    neutro. Nessuna classe arbitraria, nessun `bg-black`.
 */
import { calcolaUrgenza } from '@/lib/urgency';
import { materiaClasse } from '@/data/classiConcorso';
import type { InterpelloLive } from './righeBoard';

// ---------------------------------------------------------------------------
// Token del design system — unica fonte di verità per i badge urgenza
// ---------------------------------------------------------------------------

/**
 * Token Tailwind associati alle bande di urgenza. Le chiavi sono semantiche,
 * non cromatiche: se il design system un giorno cambierà palette, si aggiorna
 * solo questo oggetto.
 */
export const URGENZA_TOKENS = {
  verde:
    'bg-emerald-100 text-emerald-800 border border-emerald-200',
  giallo:
    'bg-amber-100 text-amber-800 border border-amber-200',
  rosso:
    'bg-rose-100 text-rose-800 border border-rose-200',
  neutro:
    'bg-slate-100 text-slate-700 border border-slate-200',
} as const;

export type UrgenzaBand = keyof typeof URGENZA_TOKENS;

/** Forma pubblica del badge: label testuale + className Tailwind già validata. */
export interface BadgeUrgenza {
  label: string;
  className: string;
}

// ---------------------------------------------------------------------------
// Date brevi
// ---------------------------------------------------------------------------

/** Data breve `it-IT` («12 set») da una stringa ISO; stringa vuota se assente o non valida. */
export function dataItBreve(iso?: string | null): string {
  const s = (iso ?? '').trim();
  if (!s) return '';
  const d = new Date(s.length <= 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Normalizzazione del ritorno di calcolaUrgenza
// ---------------------------------------------------------------------------

/**
 * Adatta il ritorno di `calcolaUrgenza` alla forma pubblica `BadgeUrgenza`.
 *
 * `calcolaUrgenza` può restituire token cromatici diretti o una banda
 * semantica; qui accettiamo entrambe le forme e mappiamo sulla banda corretta.
 * Se il valore ricevuto non è riconoscibile, NON inventiamo una label o una
 * classe: ritorniamo `null`, e il chiamante applica il fallback per anzianità.
 */
function normalizzaUrgenzaDaScadenza(
  esito: unknown,
): BadgeUrgenza | null {
  if (!esito || typeof esito !== 'object') return null;

  const obj = esito as Record<string, unknown>;

  // Forma 1: { label: string, band: UrgenzaBand } → arricchiamo con className.
  if (typeof obj.label === 'string' && typeof obj.band === 'string') {
    const band = obj.band as UrgenzaBand;
    if (band in URGENZA_TOKENS) {
      return { label: obj.label, className: URGENZA_TOKENS[band] };
    }
    return null;
  }

  // Forma 2: { label: string, className: string } già pronta.
  // Accettiamo solo se className è non vuota e non contiene 'black'
  // (regressione nota del consumer che sostituiva i token con nero).
  if (typeof obj.label === 'string' && typeof obj.className === 'string') {
    const cls = obj.className.trim();
    if (!cls || /\bbg-black\b/.test(cls)) return null;
    return { label: obj.label, className: cls };
  }

  // Forma 3: stringa secca (token o banda) → normalizziamo a label generica.
  if (typeof esito === 'string') {
    const band = esito as UrgenzaBand;
    if (band in URGENZA_TOKENS) {
      return { label: 'Urgente', className: URGENZA_TOKENS[band] };
    }
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Fallback per anzianità (nessuna scadenza esplicita)
// ---------------------------------------------------------------------------

const GIORNI_FINESTRA_INTERPELLO = 60;

/**
 * Badge per gli avvisi senza `expiration_date`: la banda è dedotta dall'età
 * di pubblicazione, riusando la finestra di 60 giorni tipica degli interpelli.
 *
 *  - entro 30 giorni dalla pubblicazione  → verde  («In corso»)
 *  - 30-44 giorni                         → giallo («In scadenza»)
 *  - oltre 44 giorni                      → rosso  («Ultimi giorni»)
 *
 * Se `createdAt` è assente o non parsabile, si ritorna `neutro`, non un
 * colore a caso e non un nero.
 */
function urgenzaDaAnzianita(createdAt?: string | null): BadgeUrgenza {
  const raw = (createdAt ?? '').trim();
  if (!raw) {
    return { label: 'Senza data', className: URGENZA_TOKENS.neutro };
  }

  const pub = new Date(raw.length <= 10 ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(pub.getTime())) {
    return { label: 'Senza data', className: URGENZA_TOKENS.neutro };
  }

  const diffGiorni =
    (Date.now() - pub.getTime()) / (1000 * 60 * 60 * 24);

  if (diffGiorni <= 30) {
    return {
      label: 'In corso',
      className: URGENZA_TOKENS.verde,
    };
  }

  const residui = Math.max(0, Math.round(GIORNI_FINESTRA_INTERPELLO - diffGiorni));

  if (diffGiorni <= 44) {
    return {
      label: residui > 0 ? `Scade tra ${residui}g` : 'In scadenza',
      className: URGENZA_TOKENS.giallo,
    };
  }

  return {
    label: residui > 0 ? `Scade tra ${residui}g` : 'Ultimi giorni',
    className: URGENZA_TOKENS.rosso,
  };
}

// ---------------------------------------------------------------------------
// API pubblica per il badge urgenza
// ---------------------------------------------------------------------------

/**
 * Restituisce il badge di urgenza per una riga del tabellone.
 *
 * Ordine di risoluzione:
 *   1. Se `expirationDate` è valorizzata e valida, si usa `calcolaUrgenza`
 *      (fonte primaria del colour coding). Se il suo ritorno non è
 *      normalizzabile, si ricade sul fallback per anzianità.
 *   2. Se `expirationDate` manca o non è parsabile, si usa l'anzianità
 *      calcolata da `createdAt`.
 *   3. Se anche `createdAt` manca, si ritorna la banda `neutro`.
 *
 * La funzione è pura: nessun accesso a stato, rete o DOM.
 */
export function ottieniUrgenzaOAnzianita(
  expirationDate?: string | null,
  createdAt?: string | null,
): BadgeUrgenza {
  if (expirationDate && expirationDate.trim()) {
    const normalizzato = normalizzaUrgenzaDaScadenza(
      calcolaUrgenza(expirationDate),
    );
    if (normalizzato) return normalizzato;
    // Se `calcolaUrgenza` non produce un badge valido, NON forziamo un
    // colore arbitrario: ricadiamo sull'anzianità, che è una sorgente
    // indipendente e sempre disponibile.
  }

  return urgenzaDaAnzianita(createdAt);
}

// ---------------------------------------------------------------------------
// Tipologia (classe di concorso o categoria)
// ---------------------------------------------------------------------------

/** Determina la tipologia o categoria dal titolo o dai codici se mancanti (es. ATA, Sostegno, Comune). */
export function inferisciTipologia(
  r: InterpelloLive,
): { codice: string; descrizione: string | null } {
  const codiceGrezzo = r.class_codes?.[0]?.trim();
  if (codiceGrezzo) {
    const desc = materiaClasse(codiceGrezzo, r.materia);
    return { codice: codiceGrezzo, descrizione: desc };
  }

  const testo = `${r.title} ${r.materia ?? ''}`.toLowerCase();
  if (
    testo.includes('ata') ||
    testo.includes('collaboratore scolastico') ||
    testo.includes('assistente amministrativo') ||
    testo.includes('cs') ||
    testo.includes('aa')
  ) {
    return { codice: 'ATA', descrizione: 'Personale ATA / Servizi Generali' };
  }
  if (
    testo.includes('sostegno') ||
    testo.includes('adsu') ||
    testo.includes('adee') ||
    testo.includes('adaa')
  ) {
    return { codice: 'SOSTEGNO', descrizione: 'Posto di Sostegno' };
  }
  if (testo.includes('educativo') || testo.includes('educatore')) {
    return { codice: 'EDUC', descrizione: 'Personale Educativo' };
  }

  return { codice: 'INTERPELLO', descrizione: 'Avviso di Reclutamento' };
}
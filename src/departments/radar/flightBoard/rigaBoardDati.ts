/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Da una riga di `interpelli` alle informazioni che la tavola mostra ma il
 * database non contiene: la tipologia (classe di concorso o categoria), la
 * banda di urgenza/anzianità della scadenza e le date brevi. Nessun rendering,
 * nessuna rete, nessuno stato: il JSX sta in `components/RigaBoard.tsx`.
 *
 * REGOLA DI PRODOTTO (§scadenza-prioritaria):
 *  - Se `expiration_date` è presente e parsabile, il badge DEVE derivare da
 *    essa. Non si cade MAI su `created_at`, nemmeno se `calcolaUrgenza`
 *    restituisce una forma non riconosciuta: in quel caso la banda viene
 *    calcolata internamente da `calcolaBandaDaScadenza`.
 *  - Il campo `fonte` del badge rende esplicito al componente da dove
 *    proviene l'informazione, così il rendering mostra "Scade il 15 ott"
 *    oppure "Pubblicato il 12 set" senza ambiguità.
 *  - `created_at` entra in gioco SOLO quando `expiration_date` è assente,
 *    vuota o non parsabile (tipico dei post WordPress senza scadenza
 *    tabellare).
 *
 * REGOLA DI DESIGN (§badge-urgenza):
 *  - I token di colore vivono SOLO in `URGENZA_TOKENS`.
 *  - Il ritorno pubblico è SEMPRE `{ label, className, fonte }`.
 */
import { calcolaUrgenza } from '@/lib/urgency';
import { materiaClasse } from '@/data/classiConcorso';
import type { InterpelloLive } from './righeBoard';

// ---------------------------------------------------------------------------
// Token del design system
// ---------------------------------------------------------------------------

/**
 * Token Tailwind associati alle bande di urgenza. Le chiavi sono semantiche,
 * non cromatiche: se il design system cambierà palette, si aggiorna solo
 * questo oggetto.
 */
export const URGENZA_TOKENS = {
  verde: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  giallo: 'bg-amber-100 text-amber-800 border border-amber-200',
  rosso: 'bg-rose-100 text-rose-800 border border-rose-200',
  neutro: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const;

export type UrgenzaBand = keyof typeof URGENZA_TOKENS;

/**
 * Da dove deriva il badge. Il componente lo usa per decidere il prefisso
 * testuale ("Scade il…", "Pubblicato il…") e per le aria-label.
 */
export type FonteBadge = 'scadenza' | 'pubblicazione' | 'nessuna';

/** Forma pubblica del badge. */
export interface BadgeUrgenza {
  /** Etichetta testuale già composta (es. "Scade tra 3g"). */
  label: string;
  /** Classi Tailwind già validate, mai `undefined`, mai `bg-black`. */
  className: string;
  /** Origine dell'informazione: determina il prefisso di rendering. */
  fonte: FonteBadge;
  /** ISO della data di riferimento (scadenza o pubblicazione). Per tooltip. */
  dataRif?: string;
}

// ---------------------------------------------------------------------------
// Parsing date robusto
// ---------------------------------------------------------------------------

/**
 * Converte una stringa ISO `YYYY-MM-DD` (o ISO completo) in Date, oppure
 * `null`. Non lancia. Non usa librerie esterne.
 *
 * Accetta anche le forme `YYYY/MM/DD` e `YYYY.MM.DD` che alcuni portali
 * USR producono. Le forme `dd/mm/yyyy` NON sono accettate qui: se arrivano
 * dal database significa che a monte c'è un problema di normalizzazione,
 * e preferiamo non indovinare.
 */
function parseDataISO(raw?: string | null): Date | null {
  const s = (raw ?? '').trim();
  if (!s) return null;

  // Estrae la parte data se c'è un orario separato da spazio o 'T'.
  const parteData = s.split(/[T ]/)[0];
  const m = parteData.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})$/);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const d = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() < 2000 || d.getUTCFullYear() > 2100) return null;
  return d;
}

/** Data breve `it-IT` («12 set») da una stringa ISO; stringa vuota se assente o non valida. */
export function dataItBreve(iso?: string | null): string {
  const d = parseDataISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Normalizzazione del ritorno di calcolaUrgenza
// ---------------------------------------------------------------------------

/** Mappa nomi di colore comuni a bande canoniche. */
const COLOR_TO_BAND: Readonly<Record<string, UrgenzaBand>> = {
  green: 'verde',
  verde: 'verde',
  success: 'verde',
  emerald: 'verde',
  yellow: 'giallo',
  giallo: 'giallo',
  warning: 'giallo',
  amber: 'giallo',
  red: 'rosso',
  rosso: 'rosso',
  danger: 'rosso',
  rose: 'rosso',
  gray: 'neutro',
  grey: 'neutro',
  grigio: 'neutro',
  neutral: 'neutro',
  slate: 'neutro',
  neutro: 'neutro',
};

/**
 * Adatta il ritorno di `calcolaUrgenza` alla forma pubblica `BadgeUrgenza`.
 *
 * Accetta deliberatamente molte forme perché `calcolaUrgenza` è un modulo
 * esterno che può essere cambiato senza preavviso. Le forme riconosciute:
 *
 *    A. { label, band }                     → arricchiamo className
 *    B. { label, className }                → accettato se className valida
 *    C. { label, color|tone|variant }       → mappiamo color→band
 *    D. { text,   className|color|band }    → stesso trattamento
 *    E. stringa secca (band o color name)   → label generica
 *
 * Ritorna `null` SOLO se nessuna forma è riconoscibile. In quel caso il
 * chiamante NON cade su `created_at` (la scadenza è presente), ma calcola
 * la banda internamente.
 */
function normalizzaUrgenzaDaScadenza(esito: unknown): BadgeUrgenza | null {
  if (esito == null) return null;

  // Forma E: stringa secca.
  if (typeof esito === 'string') {
    const band = COLOR_TO_BAND[esito.toLowerCase()];
    if (band) {
      return { label: 'Urgente', className: URGENZA_TOKENS[band], fonte: 'scadenza' };
    }
    return null;
  }

  if (typeof esito !== 'object') return null;
  const obj = esito as Record<string, unknown>;

  // Riconosce la label in 'label' o 'text'.
  const label =
    typeof obj.label === 'string'
      ? obj.label
      : typeof obj.text === 'string'
        ? obj.text
        : null;
  if (!label) return null;

  // Riconosce la classe diretta.
  if (typeof obj.className === 'string') {
    const cls = obj.className.trim();
    if (cls && !/\bbg-black\b/.test(cls)) {
      return { label, className: cls, fonte: 'scadenza' };
    }
  }

  // Banda semantica esplicita.
  if (typeof obj.band === 'string') {
    const band = COLOR_TO_BAND[obj.band.toLowerCase()];
    if (band) {
      return { label, className: URGENZA_TOKENS[band], fonte: 'scadenza' };
    }
  }

  // Nome colore in 'color' | 'tone' | 'variant'.
  for (const key of ['color', 'tone', 'variant'] as const) {
    const v = obj[key];
    if (typeof v === 'string') {
      const band = COLOR_TO_BAND[v.toLowerCase()];
      if (band) {
        return { label, className: URGENZA_TOKENS[band], fonte: 'scadenza' };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Calcolo banda dalla scadenza (fallback interno, MAI created_at)
// ---------------------------------------------------------------------------

/**
 * Assegna una banda in base alla distanza temporale dalla scadenza.
 *
 *    scaduta o entro 48 ore   → rosso    (imminente/scaduta)
 *    entro 7 giorni           → giallo   (vicina)
 *    oltre 7 giorni           → verde    (lontana)
 */
function calcolaBandaDaScadenza(scad: Date): UrgenzaBand {
  const diffOre = (scad.getTime() - Date.now()) / (1000 * 60 * 60);
  if (diffOre <= 0) return 'rosso';
  if (diffOre <= 48) return 'rosso';
  if (diffOre <= 24 * 7) return 'giallo';
  return 'verde';
}

/** Etichetta leggibile basata sui giorni rimanenti. */
function etichettaDaScadenza(scad: Date): string {
  const diffMs = scad.getTime() - Date.now();
  const diffGiorni = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return 'Scaduto';
  if (diffGiorni === 0) return 'Scade oggi';
  if (diffGiorni === 1) return 'Scade domani';
  return `Scade tra ${diffGiorni}g`;
}

/**
 * Costruisce il badge dalla sola scadenza, senza passare da `calcolaUrgenza`.
 */
function badgeDaScadenza(scad: Date, labelPreferita?: string): BadgeUrgenza {
  const band = calcolaBandaDaScadenza(scad);
  const label = labelPreferita ?? etichettaDaScadenza(scad);
  return {
    label,
    className: URGENZA_TOKENS[band],
    fonte: 'scadenza',
    dataRif: scad.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// Fallback per anzianità (SOLO quando manca la scadenza)
// ---------------------------------------------------------------------------

const GIORNI_FINESTRA_INTERPELLO = 60;

/**
 * Badge per gli avvisi senza `expiration_date`: la banda è dedotta dall'età
 * di pubblicazione, riusando la finestra di 60 giorni tipica degli interpelli.
 *
 * Questa funzione è chiamata SOLO quando la scadenza è assente.
 */
function urgenzaDaAnzianita(createdAt?: string | null): BadgeUrgenza {
  const pub = parseDataISO(createdAt);
  if (!pub) {
    return {
      label: 'Senza data',
      className: URGENZA_TOKENS.neutro,
      fonte: 'nessuna',
    };
  }

  const diffGiorni = (Date.now() - pub.getTime()) / (1000 * 60 * 60 * 24);
  const dataRif = pub.toISOString().slice(0, 10);

  if (diffGiorni <= 30) {
    return {
      label: 'In corso',
      className: URGENZA_TOKENS.verde,
      fonte: 'pubblicazione',
      dataRif,
    };
  }

  const residui = Math.max(0, Math.round(GIORNI_FINESTRA_INTERPELLO - diffGiorni));

  if (diffGiorni <= 44) {
    return {
      label: residui > 0 ? `Scade tra ${residui}g` : 'In scadenza',
      className: URGENZA_TOKENS.giallo,
      fonte: 'pubblicazione',
      dataRif,
    };
  }

  return {
    label: residui > 0 ? `Scade tra ${residui}g` : 'Ultimi giorni',
    className: URGENZA_TOKENS.rosso,
    fonte: 'pubblicazione',
    dataRif,
  };
}

// ---------------------------------------------------------------------------
// API pubblica
// ---------------------------------------------------------------------------

/**
 * Restituisce il badge di urgenza per una riga del tabellone.
 *
 * Ordine di risoluzione RIGOROSO:
 *   1. Se `expirationDate` è presente: la priorità è ASSOLUTA sulla scadenza.
 *   2. Solo se `expirationDate` è assente/vuota: si usa l'anzianità da `createdAt`.
 */
export function ottieniUrgenzaOAnzianita(
  expirationDate?: string | null,
  createdAt?: string | null,
): BadgeUrgenza {
  const scadRaw = (expirationDate ?? '').trim();

  if (scadRaw) {
    const scad = parseDataISO(scadRaw);

    if (!scad) {
      return {
        label: 'Scadenza non valida',
        className: URGENZA_TOKENS.neutro,
        fonte: 'scadenza',
      };
    }

    const normalizzato = normalizzaUrgenzaDaScadenza(calcolaUrgenza(scadRaw));
    if (normalizzato) {
      return {
        ...normalizzato,
        fonte: 'scadenza',
        dataRif: scad.toISOString().slice(0, 10),
      };
    }

    return badgeDaScadenza(scad);
  }

  return urgenzaDaAnzianita(createdAt);
}

// ---------------------------------------------------------------------------
// Tipologia (classe di concorso o categoria)
// ---------------------------------------------------------------------------

/** Determina la tipologia o categoria dal titolo o dai codici se mancanti. */
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
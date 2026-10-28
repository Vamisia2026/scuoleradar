/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`): tipologia, badge della scadenza, date
 * brevi. Nessun rendering, nessuna rete: il JSX sta in `components/RigaBoard.tsx`.
 *
 * REGOLA DI PRODOTTO (§26.67, §26.82, §26.89):
 *  - Il badge della colonna «Scadenza» deriva SOLO da `expiration_date`:
 *    `created_at` non è nemmeno un parametro, nemmeno quando la scadenza manca
 *    (la cella mostra `—` con la banda neutra «Scadenza n/d», mai un surrogato
 *    spacciato per scadenza).
 *  - Banda, etichetta e colori arrivano da `lib/scadenzaSemaforo.stileScadenza`:
 *    UNA regola per tabellone, scheda avviso e feed della dashboard.
 *  - I giorni sono di CALENDARIO, semaforo a TRE luci: < 24 ore rosso pieno
 *    (rose-500, «Scade oggi») · 24–72 ore oro brillante (amber-400, «Scade
 *    domani» / «Ultime 72h») · dal terzo giorno all'orizzonte di 15 verde pieno
 *    (emerald-500, «In corso») · oltre l'orizzonte ardesia «Scadenza fuori
 *    finestra» (fine incarico, avvio progetto: non è un termine per candidarsi).
 *    Le tre luci d'allarme sono tinte piene BRILLANTI con etichetta quasi nera
 *    (`text-slate-950`, §26.98) e nessuna banda pulsa: le etichette dicono lo
 *    STATO, non un conto alla rovescia — il colore non deve invitare a correre.
 *  - Il campo `fonte` dichiara la provenienza: `scadenza` o `nessuna`
 *    (il vuoto si dichiara, non si riempie).
 *  - La denominazione della scuola viene SEMPRE dalla fonte; se il decode del
 *    meccanografico fallisce si restituisce `null`, mai «SCUOLA NON SPECIFICATA».
 */
import { materiaClasse } from '@/data/classiConcorso';
import { giorniRimanenti } from '@/lib/scadenza';
import { SCADENZA_TOKENS, stileScadenza } from '@/lib/scadenzaSemaforo';
import type { InterpelloLive } from './righeBoard';

// I token vivono in `lib/scadenzaSemaforo.SCADENZA_TOKENS` (un solo posto per
// tabellone, scheda avviso e feed): qui si ri-esportano, senza una seconda palette.
export { SCADENZA_TOKENS };

/** `scadenza` = data vera dichiarata dalla fonte · `nessuna` = dato assente. */
export type FonteBadge = 'scadenza' | 'nessuna';

/** Forma pubblica del badge. */
export interface BadgeUrgenza {
  /** Etichetta testuale già composta (es. "Scade tra 3g"). */
  label: string;
  /** Classi Tailwind già validate, mai `undefined`, mai `bg-black`. */
  className: string;
  /** Origine dell'informazione: determina il prefisso di rendering. */
  fonte: FonteBadge;
  /** ISO della data di riferimento (la scadenza). Per tooltip. */
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

/**
 * Mesi brevi italiani: tabella LOCALE, così l'etichetta non dipende dalla
 * disponibilità dell'ICU ridotto (stessa scelta di `lib/alertInterpello.ts`).
 */
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'] as const;

/**
 * Data breve italiana («12 set») da una stringa ISO; stringa vuota se assente
 * o non valida.
 *
 * Formattazione in UTC: la scadenza è una DATA di calendario, non un istante
 * locale. Con `toLocaleDateString` un fuso a est di Greenwich (+1/+2 in Italia)
 * stampava il giorno SUCCESSIVO alla scadenza reale (12 set → 13 set): la
 * colonna «Scadenza» dichiarava un giorno che non era quello dell'avviso.
 */
export function dataItBreve(iso?: string | null): string {
  const d = parseDataISO(iso);
  if (!d) return '';
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MESI_BREVI[d.getUTCMonth()]}`;
}

// ---------------------------------------------------------------------------
// Badge dalla scadenza (INTERNO, deterministico)
// ---------------------------------------------------------------------------

/**
 * Costruisce il badge dalla sola scadenza. Percorso unico e deterministico:
 * la banda, l'etichetta e le classi arrivano da `lib/scadenzaSemaforo.stileScadenza`
 * (UNA regola per tabellone, scheda avviso e feed della dashboard, §26.82-§26.89).
 */
function badgeDaScadenza(scad: Date): BadgeUrgenza {
  const stile = stileScadenza(giorniRimanenti(scad.toISOString().slice(0, 10)));
  return {
    label: stile.label,
    className: stile.className,
    fonte: 'scadenza',
    dataRif: scad.toISOString().slice(0, 10),
  };
}

// ---------------------------------------------------------------------------
// API pubblica — il badge della colonna «Scadenza»
// ---------------------------------------------------------------------------

/**
 * Badge di urgenza della colonna «Scadenza» del tabellone.
 *
 * Colour coding di prodotto (UNICA fonte di verità,
 * `lib/scadenzaSemaforo.stileScadenza`, §26.89 / §26.98):
 *   0 giorni (< 24h)     → rosso pieno    (rose-500)    «Scade oggi»
 *   1–2 giorni (24–72h)  → oro brillante  (amber-400)   «Scade domani» · «Ultime 72h»
 *   3 … 15 giorni        → verde pieno    (emerald-500) «In corso»
 *   oltre 15 giorni      → ardesia        «Scadenza fuori finestra»
 *
 * Ordine di risoluzione RIGOROSO:
 *   1. `expirationDate` assente → banda NEUTRA dichiarata («Scadenza n/d»).
 *   2. `expirationDate` presente ma non parsabile → «Scadenza non valida»,
 *      mai un colore d'allarme su un dato che non si sa leggere.
 *   3. `expirationDate` presente e parsabile → banda dai giorni mancanti
 *      calcolata internamente. `created_at` non è nemmeno un parametro.
 */
export function badgeScadenza(expirationDate?: string | null): BadgeUrgenza {
  const scadRaw = (expirationDate ?? '').trim();

  if (!scadRaw) {
    return {
      label: 'Scadenza n/d',
      className: SCADENZA_TOKENS.neutro,
      fonte: 'nessuna',
    };
  }

  const scad = parseDataISO(scadRaw);

  if (!scad) {
    return {
      label: 'Scadenza non valida',
      className: SCADENZA_TOKENS.neutro,
      fonte: 'scadenza',
    };
  }

  return badgeDaScadenza(scad);
}

// ---------------------------------------------------------------------------
// Tipologia (classe di concorso o categoria)
// ---------------------------------------------------------------------------

/**
 * Determina la tipologia o categoria dal titolo o dai codici se mancanti.
 *
 * NB: riguarda la CATEGORIA dell'avviso (classe di concorso, ATA, sostegno,
 * educativo). La denominazione della scuola NON passa da qui: viene da
 * `lib/liveBoard.nomeScuolaRiga` (§26.59), l'unico gate del nome.
 */
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
/**
 * ScuoleRadar.it — Dipartimento Radar · DATI DERIVATI di una riga del tabellone
 * «Radar Live» (`FlightBoardInterpelli`).
 *
 * Da una riga di `interpelli` alle informazioni che la tavola mostra ma il
 * database non contiene: la tipologia (classe di concorso o categoria), la
 * banda di urgenza/anzianità della scadenza e le date brevi. Nessun rendering,
 * nessuna rete, nessuno stato: il JSX sta in `components/RigaBoard.tsx`.
 *
 * REGOLA DI PRODOTTO (§scadenza-prioritaria, §26.67):
 *  - Il badge della colonna «Scadenza» deriva SOLO da `expiration_date`:
 *    `created_at` non entra MAI nel calcolo, nemmeno quando la scadenza manca.
 *    La data di pubblicazione NON è una scadenza: la cella mostra il trattino
 *    `—` con la banda neutra «Scadenza n/d», mai un surrogato spacciato per
 *    scadenza.
 *  - Se `expiration_date` è presente e parsabile, la banda viene calcolata
 *    INTERNAMENTE ed è deterministica: `calcolaUrgenza` non è più consultato.
 *    Così le soglie di prodotto non possono essere scavalcate da un modulo
 *    esterno che cambia palette o etichette sotto (es. sfumature arancioni
 *    a 30 giorni, conflitti con il giallo del design system).
 *  - Il campo `fonte` del badge rende esplicito al componente da dove
 *    proviene l'informazione: `scadenza` (scadenza vera) oppure `nessuna`
 *    (nessun dato — il vuoto si dichiara, non si riempie).
 *
 * REGOLA DI DESIGN (§badge-urgenza):
 *  - I token di colore vivono SOLO in `URGENZA_TOKENS`.
 *  - Il ritorno pubblico è SEMPRE `{ label, className, fonte }`.
 *
 * COLOUR CODING (§badge-urgenza, aggiornato):
 *   differenza <= 2 giorni (<= 48h) → ROSSO   «Scaduto» / «Scade oggi» /
 *                                              «Scade domani» / «Ultime 48h»
 *   differenza 3–10 giorni           → GIALLO  «Scade tra Xg»
 *   differenza > 10 giorni           → VERDE   «In corso»
 * I giorni sono di CALENDARIO (regola condivisa), mai una differenza fra istanti.
 *
 * PALETTE PIENA (§26.72, direttiva 15/10/2026): le tre bande di urgenza usano
 * colori SATURI (emerald-700 / amber-600 / rose-700) su testo BIANCO in grassetto,
 * così il colore si vede anche di sfuggita e su schermo piccolo. Le tinte pastello
 * (…-100) erano troppo deboli per un segnale di urgenza. L'unica eccezione resta
 * `neutro` (grigio tenue): NON è una banda di urgenza ma l'assenza di un dato
 * pubblicato, e non deve gridare come una scadenza vicina.
 *
 * REGOLA DI PRODOTTO (§denominazione-fonte):
 *  La denominazione della scuola mostrata in riga proviene SEMPRE dalla
 *  fonte (`school_name` / testo dell'avviso) quando disponibile. Il decode
 *  del codice meccanografico è solo un'ultima spiaggia e, se fallisce, NON
 *  deve produrre «SCUOLA NON SPECIFICATA»: si restituisce `null` e il
 *  chiamante decide come rendere il vuoto.
 */
import { materiaClasse } from '@/data/classiConcorso';
import { giorniRimanenti } from '@/lib/scadenza';
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
  verde: 'bg-emerald-700 text-white font-bold shadow-sm',
  giallo: 'bg-amber-600 text-white font-bold shadow-sm',
  rosso: 'bg-rose-700 text-white font-bold shadow-sm',
  neutro: 'bg-slate-100 text-slate-700 border border-slate-200',
} as const;

export type UrgenzaBand = keyof typeof URGENZA_TOKENS;

/**
 * Da dove deriva il badge: `scadenza` = scadenza vera dichiarata dalla fonte,
 * `nessuna` = nessun dato di scadenza (la cella mostra il trattino `—`).
 */
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
// Calcolo banda ed etichetta dalla scadenza (INTERNO, deterministico)
// ---------------------------------------------------------------------------

/**
 * Assegna una banda in base ai giorni di calendario che mancano alla scadenza
 * (`ceil`: 47h → 2g, 49h → 3g).
 *   <= 2 giorni (<= 48h) → rosso   (scaduta / oggi / domani / ultime 48h)
 *   3–10 giorni          → giallo  (vicina)
 *   > 10 giorni          → verde   (in corso)
 */
function calcolaBandaDaScadenza(scad: Date): UrgenzaBand {
  const giorni = giorniRimanenti(scad.toISOString().slice(0, 10)) ?? Number.POSITIVE_INFINITY;
  if (giorni <= 2) return 'rosso';
  if (giorni <= 10) return 'giallo';
  return 'verde';
}

/** Etichetta leggibile basata sui giorni rimanenti (`ceil`). */
function etichettaDaScadenza(scad: Date): string {
  const giorni = giorniRimanenti(scad.toISOString().slice(0, 10)) ?? Number.POSITIVE_INFINITY;

  if (giorni < 0) return 'Scaduto';
  if (giorni <= 2) {
    if (giorni === 0) return 'Scade oggi';
    if (giorni === 1) return 'Scade domani';
    return 'Ultime 48h';
  }
  if (giorni <= 10) return `Scade tra ${giorni}g`;
  return 'In corso';
}

/**
 * Costruisce il badge dalla sola scadenza. Percorso unico e deterministico:
 * nessuna dipendenza esterna, nessuna euristica sul colore.
 */
function badgeDaScadenza(scad: Date): BadgeUrgenza {
  const band = calcolaBandaDaScadenza(scad);
  return {
    label: etichettaDaScadenza(scad),
    className: URGENZA_TOKENS[band],
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
 * Colour coding di prodotto (unica fonte di verità):
 *   <= 2 giorni (<= 48h) → rosso
 *   3–10 giorni          → giallo
 *   > 10 giorni          → verde
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
      className: URGENZA_TOKENS.neutro,
      fonte: 'nessuna',
    };
  }

  const scad = parseDataISO(scadRaw);

  if (!scad) {
    return {
      label: 'Scadenza non valida',
      className: URGENZA_TOKENS.neutro,
      fonte: 'scadenza',
    };
  }

  return badgeDaScadenza(scad);
}

// ---------------------------------------------------------------------------
// Denominazione della scuola — priorità alla fonte
// ---------------------------------------------------------------------------

/** Placeholder noti prodotti dai decoder di meccanografico quando falliscono. */
const PLACEHOLDER_SCUOLA =
  /scuola\s+non\s+specificata|non\s+specificat[oa]|n\/?d|sconosciut[oa]/i;

/**
 * Estrae il nome della scuola con PRECEDENZA ASSOLUTA alla fonte.
 *
 * Ordine:
 *   1. `school_name` (denominazione ufficiale già normalizzata a monte)
 *   2. `schoolName` / `denominazione` / `istituto` (alias difensivi)
 *   3. `null` → il chiamante renderizza il vuoto dichiarato.
 *
 * NON si tenta MAI di ricostruire la denominazione dal codice meccanografico:
 * quel decode fallace produceva «SCUOLA NON SPECIFICATA» e riempiva il vuoto
 * con una stringa-spazzatura. Il meccanografico resta utile solo per la
 * provincia (vedi `scripts/repair-piemonte-provinces.ts`), non per il nome.
 */
export function denominazioneScuola(r: InterpelloLive): string | null {
  const fonte = r as unknown as Record<string, unknown>;

  const candidati = [
    fonte.school_name,
    fonte.schoolName,
    fonte.denominazione,
    fonte.istituto,
  ];

  for (const c of candidati) {
    if (typeof c !== 'string') continue;
    const s = c.trim();
    if (!s) continue;
    if (PLACEHOLDER_SCUOLA.test(s)) continue;
    return s;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tipologia (classe di concorso o categoria)
// ---------------------------------------------------------------------------

/**
 * Determina la tipologia o categoria dal titolo o dai codici se mancanti.
 *
 * NB: questa funzione riguarda la CATEGORIA dell'avviso (classe di concorso,
 * ATA, sostegno, educativo). La denominazione della scuola NON passa da qui:
 * vedi `denominazioneScuola`, che ha priorità di fonte e non produce mai
 * «SCUOLA NON SPECIFICATA».
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
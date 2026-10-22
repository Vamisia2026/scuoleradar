/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board (Radar Live).
 * Etichette di riga della tavola aeroportuale: risoluzione best-effort di
 * città/link/provincia a partire dalla riga grezza della tabella interpelli.
 * Funzioni PURE (nessun React, nessuna rete): l'unica dipendenza è il dataset
 * delle province.
 *
 * REGOLA (§26.59): la scelta del nome MOSTRATO e lo scarto delle righe vivono
 * in `lib/liveBoard.ts` (`nomeScuolaBoard`/`preparaRigheBoard`) — un solo punto
 * di verità, gate STRETTO. Qui restano solo le etichette di presentazione.
 *
 * REGOLA (§26.60, 11/10/2026): la provincia di una riga è risolta con una
 * catena di fallback a 4 livelli (vedi `estraiProvincia`). Il valore `EE`
 * è l'ULTIMO fallback e non deve mai essere prodotto per righe che hanno
 * un codice meccanografico valido o una menzione geografica nel titolo.
 *
 * REGOLA (§26.61, 11/10/2026): l'urgenza e il colour coding della board
 * dipendono ESCLUSIVAMENTE da `expiration_date`. `created_at` non entra
 * MAI nel calcolo: è solo metadato di ordinamento storico.
 */
import { province } from '@/data/province';

// ---------------------------------------------------------------------------
// Tipi pubblici
// ---------------------------------------------------------------------------

/** Riga reale della tabella interpelli (solo i campi serviti alla tavola). */
export interface InterpelloLive {
  id: string;
  title: string;
  school_name: string | null;
  /** Codice meccanografico: serve a risolvere il nome reale della scuola
   *  e come sorgente di fallback per la provincia (prime 2 lettere). */
  school_code?: string | null;
  province: string;
  class_codes: string[] | null;
  materia: string | null;
  expiration_date: string | null;
  created_at: string | null;
  source_url?: string | null;
  /** Recapiti pubblicati dalla fonte: servono a ricavare la home `.edu.it`
   *  quando `source_url` punta a una piattaforma (Argo, Google Forms…). */
  contact_email?: string | null;
  school_pec?: string | null;
  /** Sito istituzionale dall'anagrafica MIM (`SITOWEBSCUOLA` → `school_site`,
   *  solo host, es. `www.iccarducci.edu.it`): è la PRIMA scelta di
   *  `fonteApribile` per la home `.edu.it` (§26.77). */
  school_site?: string | null;
  /** Stato dell'anagrafica: informativo, NON è più un badge di vetrina (§26.76). */
  anagrafica_parziale?: boolean;
}

/** Livello di urgenza calcolato dalla sola `expiration_date`. */
export type Urgenza =
  | 'scaduto'
  | 'imminente'
  | 'vicino'
  | 'lontano'
  | 'senza-scadenza';

/** Colore semantico associato all'urgenza (token UI, non CSS). */
export type ColoreUrgenza = 'verde' | 'giallo' | 'rosso' | 'grigio';

// ---------------------------------------------------------------------------
// Codici provincia ISTAT validi (incluso EE per estero/indefinita)
// ---------------------------------------------------------------------------

const PROVINCE_CODES: ReadonlySet<string> = new Set<string>([
  'AG','AL','AN','AO','AP','AQ','AR','AT','AV','BA','BG','BI','BL','BN','BO',
  'BR','BS','BT','BZ','CA','CB','CE','CH','CL','CN','CO','CR','CS','CT','CZ',
  'EN','FC','FE','FG','FI','FM','FR','GE','GO','GR','IM','IS','KR','LC','LE',
  'LI','LO','LT','LU','MB','MC','ME','MI','MN','MO','MS','MT','NA','NO','NU',
  'OR','PA','PC','PD','PE','PG','PI','PN','PO','PR','PT','PU','PV','PZ','RA',
  'RC','RE','RG','RI','RM','RN','RO','SA','SI','SO','SP','SR','SS','SU','SV',
  'TA','TE','TN','TO','TP','TR','TS','TV','UD','VA','VB','VC','VE','VI','VR',
  'VT','VV',
  // Codici speciali (non ISTAT ma accettati dallo schema)
  'EE',
]);

const FALLBACK_PROVINCE = 'EE';

/** True se il valore è un codice provincia accettato dallo schema. */
export function provinciaValida(code?: string | null): code is string {
  if (!code) return false;
  return PROVINCE_CODES.has(code.toUpperCase());
}

// ---------------------------------------------------------------------------
// Lookup nome → codice (reverse del dataset province)
// ---------------------------------------------------------------------------

/**
 * Reverse lookup costruito una volta a load-time. Ordinato per lunghezza
 * decrescente: "Reggio Emilia" deve vincere su "Reggio", "Forlì-Cesena"
 * su "Forlì". Le chiavi sono lowercase per il match case-insensitive.
 */
const NOME_TO_CODICE: ReadonlyArray<{ nome: string; codice: string }> = (() => {
  const list = province
    .map((p) => ({ nome: p.nome.toLowerCase(), codice: p.codice }))
    .sort((a, b) => b.nome.length - a.nome.length);
  return list;
})();

/** Nome completo della provincia (es. MI → Milano) come fonte primaria. */
export function nomeProvincia(codice?: string): string | null {
  if (!codice) return null;
  const upper = codice.toUpperCase();
  if (!provinciaValida(upper)) return null;
  return province.find((p) => p.codice === upper)?.nome ?? null;
}

// ---------------------------------------------------------------------------
// Estrazione provincia con catena di fallback a 4 livelli
// ---------------------------------------------------------------------------

/**
 * Livello 2: dal codice meccanografico. I primi 2 caratteri di un codice
 * meccanografico italiano SONO la sigla della provincia (es. ALIC80400Q → AL).
 * Accettiamo solo se la sigla è nell'elenco province valide, per evitare
 * falsi positivi su codici anomali o esteri.
 */
function provinciaDaCodiceMeccanografico(schoolCode?: string | null): string | null {
  if (!schoolCode) return null;
  const trimmed = schoolCode.trim().toUpperCase();
  if (trimmed.length < 2) return null;
  const sigla = trimmed.slice(0, 2);
  return provinciaValida(sigla) ? sigla : null;
}

/**
 * Livello 3: ricerca testuale di menzioni geografiche esplicite nel titolo,
 * nel nome della scuola o nell'URL di origine. Usa word-boundary per non
 * confondere "Roma" con "Romano" o "Asti" con "Astigiano".
 */
function provinciaDaTesto(r: InterpelloLive): string | null {
  const haystack = [
    r.title,
    r.school_name ?? '',
    r.source_url ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!haystack) return null;

  for (const { nome, codice } of NOME_TO_CODICE) {
    // Match con boundary: la parola non deve essere preceduta o seguita
    // da una lettera. In JS \b è ASCII-only, quindi per i nomi accentati
    // (Forlì, Cesena) usiamo un controllo manuale su lettere Unicode.
    const re = new RegExp(
      `(?<![a-z\\u00C0-\\u024F])${escapeRegex(nome)}(?![a-z\\u00C0-\\u024F])`,
      'i',
    );
    if (re.test(haystack)) return codice;
  }

  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Risolve la provincia di un interpello con catena di fallback a 4 livelli.
 *
 *   L1 — `province` è già un codice valido → usalo.
 *   L2 — `school_code` inizia con 2 lettere di provincia valida → usalo.
 *   L3 — titolo / school_name / source_url contengono il nome di una
 *        provincia italiana → usa il codice corrispondente.
 *   L4 — fallback estremo `EE`.
 *
 * Non lancia mai. Il chiamante può assumere che il valore restituito sia
 * SEMPRE in `PROVINCE_CODES`.
 */
export function estraiProvincia(r: InterpelloLive): string {
  // L1
  if (provinciaValida(r.province)) return r.province.toUpperCase();

  // L2
  const daCodice = provinciaDaCodiceMeccanografico(r.school_code);
  if (daCodice) return daCodice;

  // L3
  const daTesto = provinciaDaTesto(r);
  if (daTesto) return daTesto;

  // L4
  return FALLBACK_PROVINCE;
}

/**
 * Variante bulk: arricchisce un array di righe con la provincia risolta.
 * Utile quando il chiamante vuole una sola passata senza toccare la riga
 * originale (pattern immutabile).
 */
export function arricchisciProvince(
  righe: readonly InterpelloLive[],
): Array<InterpelloLive & { province_risolta: string }> {
  return righe.map((r) => ({ ...r, province_risolta: estraiProvincia(r) }));
}

// ---------------------------------------------------------------------------
// Città e scuola
// ---------------------------------------------------------------------------

/**
 * Estrae la città dall'interpello quando è affidabile:
 * nome provincia completo presente nel titolo (es. "... , Milano");
 * nessuna deduzione "creativa" (se non trovata → null).
 */
export function estraiCitta(r: InterpelloLive): string | null {
  if (!r.title) return null;
  const nome = nomeProvincia(estraiProvincia(r));
  if (nome && r.title.includes(nome)) return nome;
  return null;
}

/**
 * Fallback scuola rigoroso: quando `school_name` è vuoto o non valido,
 * prova a ricavare l'istituto dal titolo escludendo materie, classi e
 * termini generici.
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

  const generici =
    /^(interpello|avviso|bando|selezione|esperto|supplenza|scuola|istituto|liceo|secondaria|primaria|infanzia|sostegno|posta|religione|posto|matematica|fisica)\b/i;
  return generici.test(parte) ? null : parte;
}

// ---------------------------------------------------------------------------
// Scadenza: normalizzazione e urgenza
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Normalizza `expiration_date` a un oggetto Date, gestendo i formati che
 * i portali USR usano realmente:
 *
 *   - ISO completo           "2026-10-15T12:00:00Z"
 *   - ISO data               "2026-10-15"
 *   - Italiano con slash     "16/10/2026"
 *   - Italiano con trattino  "15-10-2026"
 *   - Italiano con punto     "15.10.2026"
 *
 * Restituisce `null` per input vuoto, non parsabile o non plausibile
 * (anno fuori dal range 2000-2100). NON ripiega mai su `created_at`.
 */
export function normalizzaDataScadenza(
  raw: string | null | undefined,
): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // ISO (con o senza orario): deleghiamo a Date, ma solo se il match è stretto.
  if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) {
    const d = new Date(s);
    return isPlausibile(d) ? d : null;
  }

  // Formato italiano dd[/.-]mm[/.-]yyyy (o yy)
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const yearRaw = m[3];
    const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    const d = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
    return isPlausibile(d) ? d : null;
  }

  return null;
}

function isPlausibile(d: Date): boolean {
  if (Number.isNaN(d.getTime())) return false;
  const y = d.getUTCFullYear();
  return y >= 2000 && y <= 2100;
}

/**
 * Giorni interi rimanenti fino alla scadenza. `null` se la data non è
 * parsabile. Valori negativi indicano scadenza già passata.
 *
 * Il parametro `now` è iniettabile per i test; in produzione si omette.
 */
export function giorniAllaScadenza(
  r: InterpelloLive,
  now: Date = new Date(),
): number | null {
  const scad = normalizzaDataScadenza(r.expiration_date);
  if (!scad) return null;
  const diff = scad.getTime() - now.getTime();
  return Math.floor(diff / MS_PER_DAY);
}

/**
 * Livello di urgenza, calcolato SOLO da `expiration_date`.
 *
 *   senza-scadenza  → data mancante o non parsabile
 *   scaduto         → giorni < 0
 *   imminente       → 0 ≤ giorni ≤ 2
 *   vicino          → 3 ≤ giorni ≤ 7
 *   lontano         → giorni > 7
 */
export function livelloUrgenza(
  r: InterpelloLive,
  now: Date = new Date(),
): Urgenza {
  const g = giorniAllaScadenza(r, now);
  if (g === null) return 'senza-scadenza';
  if (g < 0) return 'scaduto';
  if (g <= 2) return 'imminente';
  if (g <= 7) return 'vicino';
  return 'lontano';
}

/** Mappa il livello di urgenza al colore semantico della board. */
export function coloreUrgenza(livello: Urgenza): ColoreUrgenza {
  switch (livello) {
    case 'lontano':
      return 'verde';
    case 'vicino':
      return 'giallo';
    case 'imminente':
    case 'scaduto':
      return 'rosso';
    case 'senza-scadenza':
      return 'grigio';
  }
}

/**
 * Etichetta umana dell'urgenza. Utile per tooltip e aria-label.
 * Non contiene HTML: la presentazione visiva resta al componente.
 */
export function etichettaUrgenza(r: InterpelloLive, now: Date = new Date()): string {
  const g = giorniAllaScadenza(r, now);
  if (g === null) return 'Scadenza non indicata';
  if (g < 0) return `Scaduto da ${Math.abs(g)} ${Math.abs(g) === 1 ? 'giorno' : 'giorni'}`;
  if (g === 0) return 'Scade oggi';
  if (g === 1) return 'Scade domani';
  return `Scade tra ${g} giorni`;
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

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
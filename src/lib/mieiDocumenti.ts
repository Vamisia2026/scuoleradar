/**
 * ScuoleRadar.it — «I Miei Documenti»: storage personale dell'utente.
 *
 * Archivio DOCUMENTALE LOCALE (localStorage del browser): i file caricati
 * dall'utente vengono conservati come data URL insieme ai metadati, senza alcun
 * caricamento su server. La scelta è deliberata e va comunicata all'utente
 * (disclaimer nella sezione): nessun contenuto di terzi finisce sui nostri
 * sistemi e l'utente resta l'unico responsabile dei file che carica.
 *
 * Funzioni PURE (tranne `leggiMieiDocumenti`/`salvaMieiDocumenti` che toccano
 * localStorage) con esiti espliciti: i limiti di dimensione/quota NON vengono
 * mai inghiottiti in silenzio — l'utente riceve un messaggio chiaro.
 */

/** Documento caricato dall'utente (data URL: nessun upload su server). */
export interface MioDocumento {
  id: string;
  nome: string;
  /** MIME type dichiarato dal browser (es. `application/pdf`). */
  tipo: string;
  /** Dimensione in byte del file originale. */
  dimensione: number;
  /** Data ISO di caricamento (per l'ordinamento: più recenti in cima). */
  caricatoIl: string;
  /** Contenuto del file come data URL (base64). */
  dataUrl: string;
}

/** Chiave localStorage dello storage personale. */
export const STORAGE_KEY_MIEI_DOCUMENTI = 'scuoleradar:miei_documenti';

/** Numero massimo di documenti conservabili. */
export const LIMITE_DOCUMENTI = 6;

/** Dimensione massima del singolo documento (1 MB: sotto la quota del browser). */
export const LIMITE_BYTE_DOCUMENTO = 1_000_000;

/** Dimensione massima complessiva dell'archivio (3,5 MB). */
export const LIMITE_BYTE_TOTALE = 3_500_000;

/** Estensioni/MIME ammessi (documenti d'ufficio: niente eseguibili). */
export const TIPI_AMMESSI = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

/** Legge l'archivio personale (lista vuota se assente/corrotto/non disponibile). */
export function leggiMieiDocumenti(): MioDocumento[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MIEI_DOCUMENTI);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (d): d is MioDocumento =>
        typeof d === 'object' &&
        d !== null &&
        typeof (d as MioDocumento).id === 'string' &&
        typeof (d as MioDocumento).dataUrl === 'string',
    );
  } catch {
    return [];
  }
}

/**
 * Scrive l'archivio personale. Esito ESPLICITO: se la quota del browser è piena
 * o non disponibile l'utente deve saperlo (mai un salvataggio "finto").
 */
export function salvaMieiDocumenti(documenti: MioDocumento[]): { ok: true } | { ok: false; errore: string } {
  try {
    localStorage.setItem(STORAGE_KEY_MIEI_DOCUMENTI, JSON.stringify(documenti));
    return { ok: true };
  } catch {
    return {
      ok: false,
      errore:
        'Spazio del browser esaurito: rimuovi qualche documento (o svuota l’archivio) e riprova.',
    };
  }
}

/** Somma dei byte occupati dall'archivio. */
export function byteTotali(documenti: readonly MioDocumento[]): number {
  return documenti.reduce((tot, d) => tot + (Number.isFinite(d.dimensione) ? d.dimensione : 0), 0);
}

/** Dimensione leggibile (es. «820 KB»). */
export function formattaDimensione(byte: number): string {
  if (!Number.isFinite(byte) || byte <= 0) return '0 KB';
  if (byte < 1_000_000) return `${Math.max(1, Math.round(byte / 1000))} KB`;
  return `${(byte / 1_000_000).toFixed(1)} MB`;
}

/**
 * Valida un file in ingresso PRIMA della lettura: tipo, dimensione singola,
 * numero di documenti e spazio residuo. Restituisce `{ ok: true }` oppure il
 * motivo del rifiuto (messaggio pronto per l'utente).
 */
export function validaNuovoDocumento(
  esistente: readonly MioDocumento[],
  file: { name: string; type: string; size: number },
): { ok: true } | { ok: false; errore: string } {
  if (esistente.length >= LIMITE_DOCUMENTI) {
    return { ok: false, errore: `Puoi conservare al massimo ${LIMITE_DOCUMENTI} documenti: rimuovine uno.` };
  }
  if (!TIPI_AMMESSI.includes(file.type)) {
    return {
      ok: false,
      errore: 'Formato non ammesso: carica PDF, immagini (JPG/PNG), Word o testo.',
    };
  }
  if (file.size > LIMITE_BYTE_DOCUMENTO) {
    return {
      ok: false,
      errore: `File troppo grande (${formattaDimensione(file.size)}): il limite è ${formattaDimensione(LIMITE_BYTE_DOCUMENTO)}.`,
    };
  }
  if (byteTotali(esistente) + file.size > LIMITE_BYTE_TOTALE) {
    return {
      ok: false,
      errore: `Spazio personale quasi pieno (max ${formattaDimensione(LIMITE_BYTE_TOTALE)}): rimuovi qualche documento.`,
    };
  }
  return { ok: true };
}

/** Aggiunge il documento in cima (più recenti per primi) e restituisce la nuova lista. */
export function aggiungiMioDocumento(
  esistente: readonly MioDocumento[],
  nuovo: MioDocumento,
): MioDocumento[] {
  return [nuovo, ...esistente];
}

/** Rimuove un documento per id. */
export function rimuoviMioDocumento(esistente: readonly MioDocumento[], id: string): MioDocumento[] {
  return esistente.filter((d) => d.id !== id);
}

/**
 * ScuoleRadar.it — IMPRONTA dell'avviso (deduplica a livello di OPPORTUNITÀ).
 *
 * Perché esiste: `generaHashId(provincia, titolo, data)` include il TITOLO e la
 * DATA. La STESSA opportunità ripubblicata dalla scuola con una data diversa
 * (o con rumore nel titolo: protocolli, date, spazi) genera quindi un hash
 * NUOVO: l'avviso non è più "già presente" in `interpelli` e torna a essere
 * notificato un giorno dopo l'altro (bug "notifiche ripetute", es. gli avvisi
 * del Liceo Monti ripetuti a distanza di giorni).
 *
 * L'impronta è invece l'identità STABILE dell'opportunità:
 *   · titolo normalizzato (minuscolo, senza accenti/punteggiatura e senza numeri
 *     — date, protocolli, numeri d'ordine cambiano a ogni ripubblicazione);
 *   · scuola/ente emittente + provincia;
 *   · classi di concorso rilevate (ORDINATE e NORMALIZZATE: `A-022` ≡ `A-22`).
 * Due avvisi con la stessa impronta sono la stessa opportunità.
 *
 * Il modulo è PURO (nessuna rete, nessun DB): la finestra temporale entro cui
 * confrontare le impronte è una scelta del chiamante (`GIORNI_IMPRONTA`), così
 * una ripubblicazione legittima a distanza di mesi non resta soppressa per
 * sempre.
 */
import { normalizzaClasse } from './matchingEngine';

/** Finestra di default per il confronto delle impronte (giorni). */
export const GIORNI_IMPRONTA = 60;

/** Lunghezza minima del titolo normalizzato per considerare valida un'impronta. */
const MIN_TITOLO_IMPRONTA = 12;

/**
 * Token di riempimento che variano tra una pubblicazione e l'altra (protocolli,
 * preposizioni, articoli): non distinguono due opportunità diverse, quindi non
 * devono entrare nell'impronta — altrimenti la stessa notizia ripubblicata con
 * "del 12/09/2026" o "prot. n. 1234" genererebbe un'impronta diversa.
 */
const RIEMPITIVI = new Set([
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'del', 'della', 'dello', 'dei', 'degli', 'delle', 'dal', 'dalla',
  'nel', 'nella', 'al', 'alla', 'ai', 'agli', 'alle', 'di', 'da', 'per', 'con',
  'n', 'nr', 'num', 'numero', 'prot', 'protocollo',
]);

/**
 * Normalizza un testo per l'impronta: minuscole, senza accenti, senza numeri
 * (date/protocolli) e senza punteggiatura; via i token di riempimento; spazi
 * collassati.
 */
export function normalizzaPerImpronta(testo?: string | null): string {
  const base = (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]+/g, ' ');
  return base
    .split(/\s+/)
    .filter((t) => t.length > 2 && !RIEMPITIVI.has(t))
    .join(' ');
}

/** Dati minimi per calcolare l'impronta di un avviso. */
export interface DatiImpronta {
  titolo?: string | null;
  scuola?: string | null;
  provincia?: string | null;
  classi?: string[] | null;
}

/**
 * Impronta stabile dell'opportunità, oppure `null` quando non è calcolabile in
 * modo affidabile (titolo troppo corto/generico): in quel caso si preferisce NON
 * deduplicare, per non sopprimere un'opportunità diversa.
 */
export function improntaAvviso(dati: DatiImpronta): string | null {
  const titolo = normalizzaPerImpronta(dati.titolo);
  if (titolo.length < MIN_TITOLO_IMPRONTA) return null;
  const scuola = normalizzaPerImpronta(dati.scuola);
  const provincia = (dati.provincia ?? '').trim().toUpperCase();
  // CLASSI NORMALIZZATE (`A-022` ≡ `A-22` ≡ `A042`): le fonti scrivono il codice
  // in formati diversi e il parser può migliorare nel tempo. Senza questa
  // canonicalizzazione la STESSA opportunità produceva un'impronta diversa solo
  // perché il codice era scritto `A22` invece di `A-022` → di nuovo "nuova" →
  // nuovo alert (bug "notifiche ripetute", es. avvisi del Liceo Monti).
  const classi = [
    ...new Set(
      (dati.classi ?? [])
        .map((c) => normalizzaClasse(c))
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(',');
  // La scuola può mancare (avvisi degli uffici scolastici): l'impronta resta
  // valida perché include provincia + classi + titolo normalizzato.
  return `${provincia}|${scuola}|${classi}|${titolo}`;
}

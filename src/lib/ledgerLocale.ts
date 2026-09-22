/**
 * ScuoleRadar.it — LEDGER LOCALE anti-duplicato (Node-only, fallback).
 *
 * Perché esiste: il ledger di produzione vive su Supabase
 * (`notifications_log`, `channel_posts_log`). Finché quelle tabelle non sono
 * create, il controllo DB risponde "assente" e ogni run dello scraper
 * rimandava gli stessi avvisi (bug "notifiche ripetute"). Questo ledger su file
 * — committato dal workflow — è la RETE DI SICUREZZA che blocca i duplicati
 * anche senza migrazioni applicate.
 *
 * Formato: JSON con un array di chiavi `"<ambito>|<id>|<canale>"`, ordinate e
 * troncate (max 20.000 voci) per non crescere all'infinito.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const MAX_VOCI = 20_000;

/**
 * Percorso del ledger su file.
 *
 * Override con `SCUOLERADAR_LEDGER_PATH`: lo usano i TEST, altrimenti `test:dedup`
 * scriverebbe chiavi sintetiche nel ledger REALE del workspace, sporcando la
 * deduplica di produzione (e rischiando di sopprimere notifiche vere).
 * Il percorso è risolto a OGNI chiamata, così l'override può essere impostato
 * all'inizio dello script senza toccare l'ordine degli import.
 */
function percorso(): string {
  const override = (process.env.SCUOLERADAR_LEDGER_PATH ?? '').trim();
  return override || join(process.cwd(), '.scuoleradar', 'notifiche-ledger.json');
}

let cache: Set<string> | null = null;
let sporco = false;

/** Chiave canonica di deduplica. */
export function chiaveLedger(ambito: string, id: string, canale: string): string {
  return `${ambito}|${id}|${canale}`;
}

/**
 * Unione di più elenchi di chiavi: senza duplicati e preservando l'ordine di
 * arrivo (le voci più recenti restano in fondo, così il troncamento conserva le
 * ultime). Esportata perché la usa anche il merge del ledger fra esecuzioni
 * concorrenti (`scripts/unione-ledger.ts`).
 */
export function unioneChiavi(...liste: Array<Iterable<string>>): string[] {
  const visti = new Set<string>();
  for (const lista of liste) {
    for (const k of lista) if (typeof k === 'string' && k) visti.add(k);
  }
  return [...visti];
}

/**
 * Chiavi contenute nel file di ledger. MAI eccezioni: file assente = nessuna
 * chiave; file illeggibile = nessuna chiave + errore restituito al chiamante
 * (che decide se avvisare l'operatore).
 */
function chiaviDaFile(p: string): { chiavi: string[]; errore?: Error } {
  if (!existsSync(p)) return { chiavi: [] };
  try {
    // TOLLERANZA BOM: alcuni editor/strumenti scrivono l'UTF-8 con il BOM e
    // `JSON.parse` fallirebbe → il ledger verrebbe letto come VUOTO e la
    // deduplica si disattiverebbe in silenzio (rischio di notifiche duplicate).
    const grezzo = readFileSync(p, 'utf8').replace(/^\uFEFF/, '');
    const dati = JSON.parse(grezzo) as { chiavi?: string[] };
    return {
      chiavi: (dati.chiavi ?? []).filter((k): k is string => typeof k === 'string' && k.length > 0),
    };
  } catch (err) {
    return { chiavi: [], errore: err as Error };
  }
}

/** Legge il ledger (cache in memoria; file assente = ledger vuoto). */
export function ledgerLocale(): Set<string> {
  if (cache) return cache;
  const p = percorso();
  const { chiavi, errore } = chiaviDaFile(p);
  if (errore) {
    // MAI silenzioso: un ledger illeggibile disattiva la protezione anti-duplicato.
    console.warn(
      `⚠ Ledger locale ILLEGGIBILE (${p}): ${errore.message}. ` +
        'Deduplica ripartita da vuoto: possibile rischio di notifiche duplicate.',
    );
  }
  cache = new Set(chiavi);
  return cache;
}

/** True se la chiave è già stata inviata (ledger locale). */
export function ledgerLocaleGia(chiave: string): boolean {
  return ledgerLocale().has(chiave);
}

/**
 * Chiavi del ledger che iniziano con un prefisso (diagnostica e conteggio
 * frequenza: si leggono tutti gli invii di una identità).
 */
export function ledgerLocaleChiaviConPrefisso(prefisso: string): string[] {
  if (!prefisso) return [];
  const out: string[] = [];
  for (const chiave of ledgerLocale()) {
    if (chiave.startsWith(prefisso)) out.push(chiave);
  }
  return out;
}

/** Registra una chiave (scrittura su disco differita, best-effort). */
export function ledgerLocaleRegistra(chiave: string): void {
  if (!chiave) return;
  const set = ledgerLocale();
  if (set.has(chiave)) return;
  set.add(chiave);
  sporco = true;
}

/** Salva su disco il ledger (chiamare a fine run). Mai eccezioni. */
export function ledgerLocaleSalva(): void {
  if (!sporco || !cache) return;
  try {
    const p = percorso();
    // MERGE con il file su disco PRIMA di scrivere: un'altra esecuzione
    // (scraper/digest in parallelo, o un run partito da un checkout più vecchio)
    // può aver registrato chiavi DOPO la lettura iniziale. Senza questa unione il
    // salvataggio riscriverebbe il file con la sola cache in memoria → chiavi
    // PERSE su disco → le stesse notifiche ripartivano il giorno successivo
    // (bug "notifiche ripetute" a distanza di giorni).
    const chiavi = unioneChiavi(chiaviDaFile(p).chiavi, cache);
    // Troncamento: si conservano le voci più recenti (accodate in fondo).
    const ridotte = chiavi.length > MAX_VOCI ? chiavi.slice(chiavi.length - MAX_VOCI) : chiavi;
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, `${JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: ridotte }, null, 0)}\n`, 'utf8');
    // La cache torna allineata a quanto scritto davvero (anche le chiavi lette
    // dal disco: la prossima lettura non deve ripartire da una copia incompleta).
    cache = new Set(ridotte);
    sporco = false;
  } catch {
    // disco non scrivibile: il ledger DB resta la fonte primaria
  }
}

/** Percorso del ledger locale (per il commit nel workflow). */
export function percorsoLedgerLocale(): string {
  return percorso();
}

/**
 * Unisce il ledger di DUE file (tipicamente: quello prodotto da questo run e
 * quello presente nel branch remoto) e scrive l'unione sul percorso canonico.
 *
 * È l'operazione che il workflow esegue PRIMA del commit: scraper e digest girano
 * negli stessi minuti e scrivono lo stesso file, quindi un "vince l'ultimo"
 * perderebbe le chiavi dell'altro run → le stesse notifiche ripartirebbero nei
 * giorni successivi (bug "notifiche ripetute a distanza di giorni").
 *
 * Mai eccezioni: ritorna il numero di chiavi scritte nell'unione.
 */
export function unisciFileLedger(fileRun: string, fileRemoto: string): number {
  const daRun = chiaviDaFile(fileRun).chiavi;
  const daRemoto = chiaviDaFile(fileRemoto).chiavi;
  // Le chiavi del run vengono per ultime: il troncamento conserva le più recenti.
  const unite = unioneChiavi(daRemoto, daRun);
  try {
    const p = percorso();
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(
      p,
      `${JSON.stringify({ aggiornato: new Date().toISOString(), chiavi: unite }, null, 0)}\n`,
      'utf8',
    );
  } catch {
    // disco non scrivibile: il ledger DB resta la fonte primaria
  }
  return unite.length;
}

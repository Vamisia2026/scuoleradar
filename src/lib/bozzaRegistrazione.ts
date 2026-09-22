/**
 * ScuoleRadar.it — BOZZA DI REGISTRAZIONE (dati raccolti nel wizard da Guest).
 *
 * Il wizard Radar è il primo passo del funnel: un Guest inserisce anagrafica
 * (nome e cognome, anche composti tipo «Bison Productions»), genere ed età, sceglie
 * le province (da cui si deduce quella di residenza) e l'email di notifica. Alla
 * fine gli si chiede di creare l'account: quei dati NON devono andare persi né
 * essere richiesti una seconda volta.
 *
 * La bozza vive in `localStorage` (`sr_registrazione_bozza`) perché deve
 * sopravvivere alla chiusura della modale, al cambio di pagina e al ritorno da
 * Google OAuth. Viene iniettata nel form di registrazione (`AuthModal`) e ripulita
 * appena l'account esiste (dopo il salvataggio su `profiles`).
 *
 * Nessuna normalizzazione del NOME: gli spazi interni sono significativi
 * («Bison Productions» resta una stringa unica, mai spezzata in nome/cognome).
 */
export interface BozzaRegistrazione {
  nome: string;
  cognome: string;
  genere?: 'M' | 'F' | null;
  eta?: number | null;
  /** Provincia di residenza dedotta/scelta (codice a 2 lettere, es. 'RM'). */
  provincia?: string | null;
  /** Email di notifica già inserita nel wizard (evita di richiederla due volte). */
  email?: string;
}

/** Chiave localStorage della bozza di registrazione. */
export const STORAGE_KEY_BOZZA_REGISTRAZIONE = 'sr_registrazione_bozza';

/** Bozza vuota: nessun dato raccolto. */
export const bozzaRegistrazioneVuota: BozzaRegistrazione = { nome: '', cognome: '' };

/** `localStorage` se disponibile (mai eccezioni in ambiente senza DOM). */
function storageLocale(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Bozza salvata, oppure null se assente/illeggibile. */
export function leggiBozzaRegistrazione(): BozzaRegistrazione | null {
  const storage = storageLocale();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY_BOZZA_REGISTRAZIONE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BozzaRegistrazione>;
    const nome = typeof parsed.nome === 'string' ? parsed.nome : '';
    const cognome = typeof parsed.cognome === 'string' ? parsed.cognome : '';
    const genere = parsed.genere === 'M' || parsed.genere === 'F' ? parsed.genere : null;
    const eta = typeof parsed.eta === 'number' && Number.isFinite(parsed.eta) ? parsed.eta : null;
    const provincia = typeof parsed.provincia === 'string' && parsed.provincia ? parsed.provincia : null;
    const email = typeof parsed.email === 'string' && parsed.email ? parsed.email : '';
    return { nome, cognome, genere, eta, provincia, email };
  } catch {
    return null;
  }
}

/** Salva (sovrascrive) la bozza. */
export function salvaBozzaRegistrazione(bozza: BozzaRegistrazione): void {
  const storage = storageLocale();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_BOZZA_REGISTRAZIONE, JSON.stringify(bozza));
  } catch {
    // quota/privacy mode: la bozza resta valida in memoria per la sessione
  }
}

/**
 * Aggiorna SOLO i campi passati, mantenendo il resto della bozza. I valori vuoti
 * non cancellano quelli già raccolti (il wizard scrive a ogni tasto): un campo
 * svuotato per errore non deve far perdere il dato precedente.
 */
export function aggiornaBozzaRegistrazione(patch: Partial<BozzaRegistrazione>): BozzaRegistrazione {
  const attuale = leggiBozzaRegistrazione() ?? bozzaRegistrazioneVuota;
  const unita: BozzaRegistrazione = { ...attuale, ...patch };
  salvaBozzaRegistrazione(unita);
  return unita;
}

/** Cancella la bozza (account creato e dati salvati su `profiles`). */
export function svuotaBozzaRegistrazione(): void {
  const storage = storageLocale();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY_BOZZA_REGISTRAZIONE);
  } catch {
    // storage non disponibile
  }
}

/** true se la bozza contiene almeno un dato utile alla registrazione. */
export function bozzaHaDati(bozza: BozzaRegistrazione | null): boolean {
  if (!bozza) return false;
  return Boolean(
    bozza.nome.trim() ||
      bozza.cognome.trim() ||
      bozza.email?.trim() ||
      bozza.provincia ||
      bozza.genere ||
      bozza.eta,
  );
}

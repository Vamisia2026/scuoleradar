/**
 * ScuoleRadar.it — PROVA DEL RADAR: provincia scelta durante il test pubblico.
 *
 * Il box «Prova il Radar» dell'hero è il primo contatto con il servizio: quando
 * l'utente cerca su una provincia (es. Asti) quella scelta è un'INFORMAZIONE che
 * non deve andare persa. Qui vive la memoria di quella provincia, così il wizard
 * «Attiva il tuo Radar» la eredita automaticamente come provincia PRINCIPALE
 * (`provinceCodici[0]`, vedi `lib/provinceRadar.ts`) invece di chiederla di nuovo.
 *
 * Solo il codice provincia (es. 'AT') viene memorizzato, validato sul catalogo
 * `@/data/province`: nessun altro dato della prova viene conservato.
 */
import { province } from '../data/province';

/** Chiave localStorage della memoria della prova. */
export const STORAGE_KEY_PROVA_RADAR = 'sr_prova_radar';

/** `localStorage` se disponibile (mai eccezioni in ambiente senza DOM). */
function storageLocale(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Codice provincia valido (presente nel catalogo), oppure null. */
export function normalizzaProvinciaProva(codice?: string | null): string | null {
  const c = (codice ?? '').trim().toUpperCase();
  if (!c) return null;
  return province.some((p) => p.codice === c) ? c : null;
}

/** Salva la provincia su cui l'utente ha provato il Radar (ignora codici ignoti). */
export function salvaProvinciaProva(codice: string): void {
  const valido = normalizzaProvinciaProva(codice);
  if (!valido) return;
  const storage = storageLocale();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY_PROVA_RADAR, valido);
  } catch {
    // quota/privacy mode: la memoria resta valida solo per la sessione
  }
}

/** Provincia della prova, oppure null se non c'è (o non è più valida). */
export function leggiProvinciaProva(): string | null {
  const storage = storageLocale();
  if (!storage) return null;
  try {
    return normalizzaProvinciaProva(storage.getItem(STORAGE_KEY_PROVA_RADAR));
  } catch {
    return null;
  }
}

/** Cancella la memoria (usata dai test e dal reset completo dello stato). */
export function svuotaProvinciaProva(): void {
  const storage = storageLocale();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY_PROVA_RADAR);
  } catch {
    // storage non disponibile
  }
}

/**
 * Selezione iniziale delle province del wizard: le preferenze salvate hanno la
 * precedenza; se il profilo non ha ancora nessuna provincia, si eredita quella
 * provata nel box «Prova il Radar» (diventa così la provincia principale).
 */
export function provinceInizialiConProva(
  provinceSalvate: readonly string[] | undefined | null,
): string[] {
  const salvate = Array.isArray(provinceSalvate) ? [...provinceSalvate] : [];
  if (salvate.length > 0) return salvate;
  const daProva = leggiProvinciaProva();
  return daProva ? [daProva] : [];
}

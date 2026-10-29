/**
 * ScuoleRadar.it — PROVA DEL RADAR: provincia scelta durante il test pubblico.
 *
 * Il box «Prova il Radar» dell'hero è il primo contatto con il servizio: quando
 * l'utente cerca su una provincia (es. Asti) quella scelta è un'INFORMAZIONE che
 * non deve andare persa. Qui vive la memoria di quella provincia, in due pezzi:
 *
 *   · PROVINCIA PRINCIPALE (`sr_prova_radar`) — così il wizard «Attiva il tuo
 *     Radar» la eredita (`provinceCodici[0]`, vedi `lib/provinceRadar.ts`) invece
 *     di chiederla di nuovo;
 *   · MONITORAGGIO TEMPORANEO (`sr_prova_radar_monitoraggio`) — la provincia resta
 *     «sotto osservazione» per 7 giorni (`GIORNI_MONITORAGGIO_PROVA`) anche a chi
 *     non ha ancora un account: è il lead che la prova genera, e scade da solo
 *     (`leggiMonitoraggioProva` cancella il record scaduto alla prima lettura).
 *
 * Solo codici provincia validati sul catalogo `@/data/province` vengono
 * memorizzati: nessun altro dato della prova viene conservato (niente email,
 * niente IP, niente cronologia di ricerca).
 */
import { province } from '../data/province';

/** Chiave localStorage della memoria della prova. */
export const STORAGE_KEY_PROVA_RADAR = 'sr_prova_radar';

/**
 * Chiave del MONITORAGGIO TEMPORANEO acceso dalla prova: la provincia cercata
 * resta «sotto osservazione» per `GIORNI_MONITORAGGIO_PROVA` giorni, anche a chi
 * non ha ancora un account. Sta separata dalla provincia principale perché ha un
 * ciclo di vita suo (scade) e non deve sopravvivere alla scadenza.
 */
export const STORAGE_KEY_MONITORAGGIO_PROVA = 'sr_prova_radar_monitoraggio';

/** Durata del monitoraggio temporaneo acceso dalla prova (7 giorni). */
export const GIORNI_MONITORAGGIO_PROVA = 7;

/** Un giorno in millisecondi: la scadenza si calcola in tempo, non in date locali. */
const GIORNO_MS = 86_400_000;

/** Monitoraggio temporaneo attivo: provincia osservata e finestra di osservazione. */
export interface MonitoraggioProva {
  /** Codice provincia del catalogo (es. `AT`). */
  provincia: string;
  /** Istante di accensione (ISO). */
  iniziatoIl: string;
  /** Istante di scadenza (ISO): `iniziatoIl` + 7 giorni. */
  scadeIl: string;
}

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

/* --------------------- Monitoraggio temporaneo (7 giorni) --------------------- */

/**
 * Accende (o RINNOVA) il monitoraggio temporaneo sulla provincia appena cercata:
 * `iniziatoIl = adesso`, `scadeIl = adesso + 7 giorni`. Una provincia nuova
 * riparte da capo — il monitoraggio è della provincia, non dell'utente. Codice
 * ignoto → nessun monitoraggio (`null`), così un valore inventato non abilita
 * nulla. `adesso` è iniettabile: le guardie non dipendono dall'orologio.
 */
export function avviaMonitoraggioProva(
  codice: string,
  adesso: Date = new Date(),
): MonitoraggioProva | null {
  const provincia = normalizzaProvinciaProva(codice);
  const storage = storageLocale();
  if (!provincia || !storage) return null;
  const inizio = adesso.getTime();
  const monitoraggio: MonitoraggioProva = {
    provincia,
    iniziatoIl: new Date(inizio).toISOString(),
    scadeIl: new Date(inizio + GIORNI_MONITORAGGIO_PROVA * GIORNO_MS).toISOString(),
  };
  try {
    storage.setItem(STORAGE_KEY_MONITORAGGIO_PROVA, JSON.stringify(monitoraggio));
  } catch {
    // quota/privacy mode: il monitoraggio resta valido solo per la sessione
  }
  return monitoraggio;
}

/**
 * Monitoraggio ANCORA valido, oppure `null`. Un monitoraggio scaduto viene
 * CANCELLATO alla prima lettura: «attivo 7 giorni» non deve diventare «attivo per
 * sempre» solo perché nessuno è passato a spegnerlo.
 */
export function leggiMonitoraggioProva(adesso: Date = new Date()): MonitoraggioProva | null {
  const storage = storageLocale();
  if (!storage) return null;
  let monitoraggio: MonitoraggioProva | null = null;
  try {
    const grezzo = storage.getItem(STORAGE_KEY_MONITORAGGIO_PROVA);
    if (!grezzo) return null;
    const letto = JSON.parse(grezzo) as Partial<MonitoraggioProva>;
    const provincia = normalizzaProvinciaProva(letto.provincia);
    const scadenza = new Date(String(letto.scadeIl ?? '')).getTime();
    if (!provincia || Number.isNaN(scadenza)) {
      storage.removeItem(STORAGE_KEY_MONITORAGGIO_PROVA);
      return null;
    }
    monitoraggio = {
      provincia,
      iniziatoIl: String(letto.iniziatoIl ?? ''),
      scadeIl: new Date(scadenza).toISOString(),
    };
  } catch {
    return null;
  }
  if (monitoraggio && new Date(monitoraggio.scadeIl).getTime() <= adesso.getTime()) {
    storage.removeItem(STORAGE_KEY_MONITORAGGIO_PROVA);
    return null;
  }
  return monitoraggio;
}

/**
 * Giorni INTERI di monitoraggio residui (arrotondati per eccesso: mezza giornata
 * è ancora «1 giorno»). `null`/scaduto → `0`: la UI non deve mai scrivere un
 * numero negativo.
 */
export function giorniResiduiMonitoraggio(
  monitoraggio: MonitoraggioProva | null,
  adesso: Date = new Date(),
): number {
  if (!monitoraggio) return 0;
  const scadenza = new Date(monitoraggio.scadeIl).getTime();
  if (Number.isNaN(scadenza)) return 0;
  const residuo = scadenza - adesso.getTime();
  return residuo > 0 ? Math.ceil(residuo / GIORNO_MS) : 0;
}

/** Spegne il monitoraggio (reset completo dello stato, scadenza, cambio idea). */
export function chiudiMonitoraggioProva(): void {
  const storage = storageLocale();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY_MONITORAGGIO_PROVA);
  } catch {
    // storage non disponibile
  }
}

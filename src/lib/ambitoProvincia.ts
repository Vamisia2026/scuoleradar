/**
 * ScuoleRadar.it — AMBITO DI UNA PROVINCIA NEI GIRI DI LETTURA (§26.125).
 *
 * Perché esiste: un giro «solo Asti» (`table-reporter --province=AT`) filtrava i
 * target per `discovered_links.province` e scartava gli **hub regionali**. Ma il
 * Piemonte non ha un hub dedicato ad Asti: gli interpelli di Asti li pubblica
 * l'USR Piemonte, censito su `TO` (`fontiTerritoriali.ts`, sezione Piemonte).
 * Risultato: il filtro spegneva l'unica fonte che parla di Asti, e la provincia
 * sembrava vuota.
 *
 * La regola, in due righe:
 *  · un target della PROVINCIA richiesta entra sempre;
 *  · un **hub ISTITUZIONALE VERIFICATO** (whitelist `fonti.ts`, `origine =
 *    'whitelist'` oppure URL corrispondente a una fonte verificata) entra quando
 *    è della stessa REGIONE, perché un elenco regionale pubblica per tutte le sue
 *    province;
 *  · tutto il resto resta fuori.
 *
 * Le righe estratte restano comunque filtrate per provincia al momento
 * dell'upsert (`table-reporter` §26.119): leggere un hub regionale non significa
 * scrivere avvisi di altre province.
 *
 * PURO e senza dipendenze: la provincia → regione è la mappa unica di
 * `src/data/province.ts`. Guardia: `npm run test:crawl-provincia`.
 */
import { province } from '../data/province';

/** Da dove arriva un target: coda del database oppure whitelist verificata. */
export type OrigineTarget = 'db' | 'whitelist';

/** Ciò che serve sapere di un target per decidere se è «in ambito». */
export interface TargetAmbito {
  region?: string | null;
  province?: string | null;
  /** `'whitelist'` = fonte verificata del registro (`scripts/table-reporter.ts`). */
  origine?: OrigineTarget | null;
  /** true = l'URL corrisponde a una fonte verificata del registro (§26.94). */
  verificata?: boolean | null;
}

/** Codice provincia normalizzato (`'at '` → `'AT'`); `''` se assente. */
function codiceProvincia(valore?: string | null): string {
  return (valore ?? '').trim().toUpperCase();
}

/** Nome della regione di una provincia (`'AT'` → `'Piemonte'`), `null` se ignota. */
export function regioneDiProvincia(codice?: string | null): string | null {
  const c = codiceProvincia(codice);
  if (!c) return null;
  return province.find((p) => p.codice === c)?.regione ?? null;
}

/**
 * Regioni coinvolte da un filtro di province, in ordine alfabetico e senza
 * duplicati (`['AT', 'TO']` → `['Piemonte']`): dieci province della stessa
 * regione chiedono UN solo hub regionale.
 */
export function regioniDelleProvince(codici: readonly string[] | null | undefined): string[] {
  const regioni = new Set<string>();
  for (const codice of codici ?? []) {
    const regione = regioneDiProvincia(codice);
    if (regione) regioni.add(regione);
  }
  return [...regioni].sort((a, b) => a.localeCompare(b, 'it'));
}

/** True se il target è un hub istituzionale verificato (non una fonte locale). */
function eHubVerificato(target: TargetAmbito): boolean {
  return target.origine === 'whitelist' || target.verificata === true;
}

/**
 * True se il target va letto in un giro limitato alle `filtro` province.
 *
 * `filtro` vuoto = nessun filtro (tutto ammesso): è il giro nazionale e il
 * comportamento storico. Con il filtro valgono le due regole dell'intestazione:
 * provincia richiesta **oppure** hub verificato della stessa regione.
 */
export function targetInAmbitoProvincia(
  target: TargetAmbito,
  filtro: readonly string[] | null | undefined,
): boolean {
  const ammesse = (filtro ?? []).map(codiceProvincia).filter(Boolean);
  if (ammesse.length === 0) return true;
  if (ammesse.includes(codiceProvincia(target.province))) return true;
  if (!eHubVerificato(target)) return false;
  const regioneTarget = (target.region ?? '').trim().toLowerCase();
  if (!regioneTarget) return false;
  return regioniDelleProvince(ammesse).some((r) => r.toLowerCase() === regioneTarget);
}

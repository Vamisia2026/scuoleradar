/**
 * ScuoleRadar.it — ANAGRAFICA SCUOLE · CSV SCUANAGRAFE (parser e chiavi).
 *
 * Primo pezzo del modulo di anagrafica: la superficie pubblica resta
 * `lib/anagraficaScuole.ts` (lookup + arricchimento), mentre qui vivono il parser
 * RFC4180, la mappa riga CSV → scuola, le chiavi di confronto (codice, nome,
 * provincia) e i tipi condivisi. La separazione tiene i file sotto il limite di
 * righe della governance (`docs/MODULAR_ARCHITECTURE.md`).
 *
 * Formato dei file ufficiali del Ministero (prefissi in `PREFISSI_ANAGRAFICA`):
 * separatore `,`, campi quotati, UTF-8, `Non Disponibile` = dato assente.
 */
import { province } from '../data/province';

/** Valore ufficiale del MIM per "dato non pubblicato". */
const NON_DISPONIBILE = /^non\s*disponibile$/i;

/** Prefissi ufficiali dei file anagrafici (statale, paritarie, autonomie). */
export const PREFISSI_ANAGRAFICA = [
  'SCUANAGRAFESTAT',
  'SCUANAGRAFEPAR',
  'SCUANAAUTSTAT',
  'SCUANAAUTPAR',
] as const;

/** Una scuola dell'anagrafica, con i campi utili al prodotto già normalizzati. */
export interface ScuolaAnagrafica {
  /** `CODICESCUOLA` (sede/plesso): la chiave del lookup. */
  codice: string;
  /** `CODICEISTITUTORIFERIMENTO`, quando il file lo dichiara. */
  istitutoCodice: string | null;
  /** `DENOMINAZIONEISTITUTORIFERIMENTO` (il nome "vero" dell'istituto). */
  istitutoNome: string | null;
  /** `DENOMINAZIONESCUOLA` (può essere il nome del plesso). */
  nome: string;
  /** Email istituzionale (PEO) dichiarata dalla fonte. */
  email: string | null;
  /** PEC dichiarata dalla fonte. */
  pec: string | null;
  /** Nome provincia dichiarato dal file (es. «MONZA E BRIANZA»). */
  provinciaNome: string | null;
  /** Codice provincia (`MB`) risolto sull'elenco ufficiale, quando combacia. */
  provinciaCodice: string | null;
  /** Comune dichiarato dal file. */
  comune: string | null;
  /** Tipologia/ordine (es. «SCUOLA PRIMARIA», «SCUOLA INFANZIA NON STATALE»). */
  tipo: string | null;
  /** true se il file di provenienza è quello delle paritarie. */
  paritaria: boolean;
}

/** Nome normalizzato per i confronti: maiuscole, senza accenti, solo alfanumerici. */
export function normalizzaNomeScuola(testo?: string | null): string {
  return (testo ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/** Campo CSV → valore utile (`Non Disponibile`/vuoto → `null`). */
function campo(valore?: string | null): string | null {
  const pulito = (valore ?? '').replace(/\s+/g, ' ').trim();
  if (!pulito || NON_DISPONIBILE.test(pulito)) return null;
  return pulito;
}

/** Campo email CSV → valore utile in MINUSCOLO (`Non Disponibile`/vuoto → `null`). */
export function campoEmail(valore?: string | null): string | null {
  return campo(valore)?.toLowerCase() ?? null;
}

/**
 * Chiave del codice SCUOLA per l'indice dell'anagrafica.
 *
 * La validazione "MIM statale" di `emailScuola.ts` (`XXYY12345Z`) NON copre i
 * codici delle PARITARIE né delle autonomie (`UD1A036009`, `TB1E002003`: cifra in
 * terza posizione). Indicizzare con `normalizzaCodiceMeccanografico` scarterebbe
 * in silenzio 11.000+ scuole paritarie: qui la chiave è permissiva (maiuscolo,
 * solo alfanumerici, 6–16 caratteri) e la severità resta dove serve — nella
 * convenzione di posta, che vale solo per i codici statali.
 */
export function chiaveCodiceScuola(valore?: string | null): string | null {
  const pulito = (valore ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return pulito.length >= 6 && pulito.length <= 16 ? pulito : null;
}

/** Parole di raccordo ignorate nel confronto fra nomi di provincia. */
const CONNETTIVI_PROVINCIA = new Set([
  'E', 'ED', 'DEL', 'DELLA', 'DELLO', 'DEI', 'DEGLI', 'DI', 'D', 'SUL', 'SULLA',
]);

/**
 * Chiave di confronto del nome di provincia: parole di raccordo tolte e tutto il
 * resto normalizzato. Così «MONZA E BRIANZA» (anagrafica) e «Monza e della
 * Brianza» (elenco ufficiale) coincidono, come «FORLÌ-CESENA» e «FORLI CESENA».
 */
export function chiaveProvincia(nome?: string | null): string {
  return (nome ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^A-Z0-9]+/)
    .filter((parola) => parola && !CONNETTIVI_PROVINCIA.has(parola))
    .join('');
}

/** Codice provincia (`MB`) dal nome dichiarato dall'anagrafica, se riconoscibile. */
export function provinciaCodiceDaNome(nome?: string | null): string | null {
  const chiave = chiaveProvincia(nome);
  if (!chiave) return null;
  return province.find((p) => chiaveProvincia(p.nome) === chiave)?.codice ?? null;
}

/**
 * Parser CSV RFC4180 (separatore `,`, campi quotati, `""` = virgoletta dentro il
 * campo, a capo anche dentro le virgolette). Puro: si verifica in isolamento.
 */
export function parseCsv(testo: string): string[][] {
  const righe: string[][] = [];
  let riga: string[] = [];
  let campoCorrente = '';
  let dentroVirgolette = false;
  for (let i = 0; i < testo.length; i += 1) {
    const c = testo[i];
    if (dentroVirgolette) {
      if (c === '"') {
        if (testo[i + 1] === '"') {
          campoCorrente += '"';
          i += 1;
        } else {
          dentroVirgolette = false;
        }
      } else {
        campoCorrente += c;
      }
      continue;
    }
    if (c === '"') {
      dentroVirgolette = true;
      continue;
    }
    if (c === ',') {
      riga.push(campoCorrente);
      campoCorrente = '';
      continue;
    }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && testo[i + 1] === '\n') i += 1;
      riga.push(campoCorrente);
      campoCorrente = '';
      righe.push(riga);
      riga = [];
      continue;
    }
    campoCorrente += c;
  }
  if (campoCorrente !== '' || riga.length > 0) {
    riga.push(campoCorrente);
    righe.push(riga);
  }
  return righe.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Indice delle colonne per NOME: i file statali e paritari ne hanno di diverse. */
export function indiciColonne(intestazioni: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  intestazioni.forEach((h, i) => {
    out[h.trim().toUpperCase()] = i;
  });
  return out;
}

/** Riga CSV → scuola dell'anagrafica (`null` se senza codice meccanografico). */
export function scuolaDaCampi(
  campi: string[],
  colonne: Record<string, number>,
  paritaria: boolean,
): ScuolaAnagrafica | null {
  const leggi = (nome: string): string | null => campo(campi[colonne[nome] ?? -1]);
  const codice = chiaveCodiceScuola(leggi('CODICESCUOLA'));
  if (!codice) return null;
  const provinciaNome = leggi('PROVINCIA');
  return {
    codice,
    istitutoCodice: chiaveCodiceScuola(leggi('CODICEISTITUTORIFERIMENTO')),
    istitutoNome: leggi('DENOMINAZIONEISTITUTORIFERIMENTO'),
    nome: leggi('DENOMINAZIONESCUOLA') ?? '',
    email: campoEmail(leggi('INDIRIZZOEMAILSCUOLA')),
    pec: campoEmail(leggi('INDIRIZZOPECSCUOLA')),
    provinciaNome,
    provinciaCodice: provinciaCodiceDaNome(provinciaNome),
    comune: leggi('DESCRIZIONECOMUNE'),
    tipo: leggi('DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA'),
    paritaria,
  };
}

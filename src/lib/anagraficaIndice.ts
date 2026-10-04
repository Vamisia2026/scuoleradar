/**
 * ScuoleRadar.it — ANAGRAFICA SCUOLE · indice per codice e per nome.
 *
 * Secondo pezzo del modulo di anagrafica: scopre i file SCUANAGRAFE nella cartella
 * configurata (`SCUOLERADAR_ANAGRAFICA_DIR`, default `~/Downloads`), ne costruisce
 * l'indice — codice sede → scuola, codice istituto → sede rappresentativa, nome
 * normalizzato → candidati — e lo tiene in memoria per il processo (i file pesano
 * ~13 MB: mai ricaricati a ogni riga). La superficie pubblica resta
 * `lib/anagraficaScuole.ts`.
 *
 * Nessun file trovato NON è un errore: `disponibile: false` e chi chiama prosegue
 * come prima dell'introduzione dell'anagrafica.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import {
  PREFISSI_ANAGRAFICA,
  indiciColonne,
  normalizzaNomeScuola,
  parseCsv,
  scuolaDaCampi,
  type ScuolaAnagrafica,
} from './anagraficaCsv';

/** Esito della lettura di un file anagrafico (per la diagnostica). */
export interface FileAnagraficaLetto {
  file: string;
  righe: number;
  scartate: number;
}

/** Indice dell'anagrafica: lookup per codice e (per il fallback) per nome. */
export interface IndiceAnagrafica {
  perCodice: Map<string, ScuolaAnagrafica>;
  /** Codice ISTITUTO → sede rappresentativa (per i codici di istituto). */
  perIstituto: Map<string, ScuolaAnagrafica>;
  /** Nome normalizzato → candidati (per il matching per nome, solo se univoco). */
  perNome: Map<string, ScuolaAnagrafica[]>;
  totale: number;
  fileLetti: FileAnagraficaLetto[];
  /** true se almeno un file è stato trovato e letto. */
  disponibile: boolean;
}

/** Cartella dei file anagrafici: override d'ambiente, altrimenti `~/Downloads`. */
export function cartellaAnagrafica(): string {
  const override = (process.env.SCUOLERADAR_ANAGRAFICA_DIR ?? '').trim();
  return override || join(homedir(), 'Downloads');
}

/** Percorsi dei file anagrafici presenti nella cartella (ricercati per prefisso). */
export function fileAnagrafici(cartella: string = cartellaAnagrafica()): string[] {
  try {
    return readdirSync(cartella)
      .filter(
        (nome) =>
          /\.csv$/i.test(nome) &&
          PREFISSI_ANAGRAFICA.some((prefisso) => nome.toUpperCase().startsWith(prefisso)),
      )
      .sort()
      .map((nome) => join(cartella, nome));
  } catch {
    return []; // cartella assente/illeggibile: anagrafica non disponibile
  }
}

let cache: IndiceAnagrafica | null = null;

/**
 * Carica (una sola volta, salvo `refresh` o `cartella` esplicita) l'indice
 * dell'anagrafica. Un file mancante o illeggibile non ferma nulla: si indicizza
 * ciò che c'è e `disponibile` dice se il lookup ha senso.
 */
export function caricaAnagrafica(
  opts: { cartella?: string; refresh?: boolean } = {},
): IndiceAnagrafica {
  if (cache && !opts.refresh && !opts.cartella) return cache;
  const indice: IndiceAnagrafica = {
    perCodice: new Map(),
    perIstituto: new Map(),
    perNome: new Map(),
    totale: 0,
    fileLetti: [],
    disponibile: false,
  };
  for (const percorso of fileAnagrafici(opts.cartella)) {
    let testo: string;
    try {
      testo = readFileSync(percorso, 'utf8').replace(/^\uFEFF/, '');
    } catch {
      continue;
    }
    const righeCsv = parseCsv(testo);
    if (righeCsv.length < 2) continue;
    const colonne = indiciColonne(righeCsv[0]);
    const nomeFile = percorso.replace(/\\/g, '/').split('/').pop() ?? percorso;
    const paritaria = /AUTPAR|GRAFEPAR/i.test(nomeFile);
    let lette = 0;
    let scartate = 0;
    for (const campi of righeCsv.slice(1)) {
      const scuola = scuolaDaCampi(campi, colonne, paritaria);
      if (!scuola) {
        scartate += 1;
        continue;
      }
      lette += 1;
      indice.perCodice.set(scuola.codice, scuola);
      if (scuola.istitutoCodice && !indice.perIstituto.has(scuola.istitutoCodice)) {
        indice.perIstituto.set(scuola.istitutoCodice, scuola);
      }
      for (const chiaveNome of [scuola.istitutoNome, scuola.nome]) {
        const chiave = normalizzaNomeScuola(chiaveNome);
        if (chiave.length < 5) continue;
        const lista = indice.perNome.get(chiave);
        if (!lista) indice.perNome.set(chiave, [scuola]);
        else if (!lista.some((s) => s.codice === scuola.codice)) lista.push(scuola);
      }
    }
    indice.fileLetti.push({ file: nomeFile, righe: lette, scartate });
  }
  indice.totale = indice.perCodice.size;
  indice.disponibile = indice.perCodice.size > 0;
  if (!opts.cartella) cache = indice;
  return indice;
}

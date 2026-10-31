/**
 * scripts/lib/giroMvp.ts
 *
 * LA PARTE OPERATIVA DEL GIRO DELL'MVP (§26.126 · §26.127).
 *
 * Estratto da `scripts/crawl-mvp.ts` quando il file ha superato il tetto di 300
 * righe del gate strutturale: qui sta ciò che il giro FA (leggere gli argomenti,
 * stampare il piano e il termostato, lanciare il crawler), non la politica del
 * perimetro (`lib/mvpPerimetro`) né la regola della soglia
 * (`lib/termostatoCrawl`). Il file principale resta il racconto del giro.
 *
 * PERCHÉ IL CRAWLER GIRA NELLO STESSO PROCESSO PADRE (`stdio: 'inherit'`):
 * è l'unico modo per vedere «SCUOLE CONTATTATE» mentre accade, senza aspettare
 * la fine del giro. Gli argomenti sono espliciti — `--scuole-provincia` sempre,
 * perché il giro dell'MVP vuole l'anagrafica MIM anche quando le province
 * arrivano da un elenco.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { AMBIENTE_SGRANATURA } from '../../src/scraper/sgranatura.ts';
import {
  TUTTE_LE_SCUOLE,
  nomeProvincia,
  tettoScuole,
  type PianoScansione,
  type TettiScuole,
  type TettoScuoleProvincia,
} from '../../src/lib/mvpPerimetro.ts';
import type { LetturaTermostato, TaratureHub } from '../../src/lib/termostatoCrawl.ts';

/** Valore di un argomento `--chiave=valore` (stringa vuota se assente). */
export function argomento(chiave: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${chiave}=`));
  return arg ? arg.split('=').slice(1).join('=') : '';
}

/** Valore numerico di un argomento, con default dichiarato. */
export function numero(chiave: string, predefinito: number): number {
  const n = Number(argomento(chiave));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : predefinito;
}

/**
 * Intero positivo dell'argomento, `null` se assente o non valido. Serve dove il
 * default NON è un numero scritto nel codice ma una taratura (il termostato): un
 * valore rotto non deve diventare zero (cioè «nessuna scuola»), deve tornare al
 * regime deciso dal termostato.
 */
export function positivo(chiave: string): number | null {
  const grezzo = argomento(chiave).trim();
  if (!grezzo) return null;
  const n = Number(grezzo);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[crawl-mvp] --${chiave}=${grezzo} non è un numero positivo: lo ignoro.`);
    return null;
  }
  return Math.floor(n);
}

/**
 * Tetto di scuole dell'argomento: un numero, `tutte`, oppure `null` (assente).
 * `--max-scuole-domanda=tutte` è la forma esplicita del 100% dell'anagrafica.
 */
export function tettoDaArgomento(chiave: string): TettoScuoleProvincia | null {
  const grezzo = argomento(chiave).trim().toLowerCase();
  if (!grezzo) return null;
  if (grezzo === TUTTE_LE_SCUOLE || grezzo === 'tutti' || grezzo === 'all') return TUTTE_LE_SCUOLE;
  const n = Number(grezzo);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`[crawl-mvp] --${chiave}=${grezzo} non è un tetto: uso «tutte».`);
    return TUTTE_LE_SCUOLE;
  }
  return Math.floor(n);
}

/** Etichetta del tetto per i log: `tutte le scuole` o `N scuole`. */
export function etichettaTetto(tetto: TettoScuoleProvincia): string {
  return tetto === TUTTE_LE_SCUOLE ? 'tutte le scuole' : `${tetto} scuole`;
}

/**
 * Lancia `table-reporter` per le province indicate. `tetto` può essere `'tutte'`:
 * il reporter lo legge come «nessun tetto» (§26.127) e percorre l'anagrafica MIM
 * della provincia per intero. `hub` è la profondità concessa ai portali
 * regionali/provinciali, passata con le STESSE variabili della politica di
 * sgranatura (§26.101): il termostato non introduce una seconda verità sui tetti.
 */
export function eseguiCrawlerMvp(
  province: readonly string[],
  tetto: TettoScuoleProvincia,
  hub: TaratureHub,
  dryRun: boolean,
): number {
  if (province.length === 0) return 0;
  const argomenti = [
    'scripts/table-reporter.ts',
    `--province=${province.join(',')}`,
    '--scuole-provincia',
    `--max-scuole=${tetto}`,
    ...(dryRun ? ['--dry-run'] : []),
  ];
  const ambiente = {
    ...process.env,
    [AMBIENTE_SGRANATURA.perElenco]: String(hub.perElenco),
    [AMBIENTE_SGRANATURA.pagineElenco]: String(hub.pagineElenco),
    [AMBIENTE_SGRANATURA.perGiro]: String(hub.perGiro),
  };
  console.log(
    `\n[crawl-mvp] Crawler: ${province.join(', ')} · ${etichettaTetto(tetto)}/provincia · ` +
      `hub ${hub.perElenco} documenti per elenco su ${hub.pagineElenco} pagine` +
      `${dryRun ? ' · dry-run' : ''}`,
  );
  const tsx = 'node_modules/tsx/dist/cli.mjs';
  const esito = existsSync(tsx)
    ? spawnSync(process.execPath, [tsx, ...argomenti], { stdio: 'inherit', env: ambiente })
    : spawnSync('npx', ['tsx', ...argomenti], { stdio: 'inherit', env: ambiente, shell: true });
  return esito.status ?? 1;
}

/** Riga del piano: `· AT Asti — domanda · tutte le scuole` (o `fondo`). */
export function rigaPiano(
  provincia: string,
  piano: PianoScansione,
  tetti: TettiScuole,
): string {
  const intensita = piano.domanda.includes(provincia) ? 'domanda' : 'fondo';
  const fuori = piano.fuoriBaseline.includes(provincia) ? ' · fuori baseline' : '';
  const tetto = etichettaTetto(tettoScuole(provincia, piano, tetti));
  return `  · ${provincia} ${nomeProvincia(provincia)} — ${intensita}${fuori} · ${tetto}`;
}

/** Stampa il piano PRIMA della rete: è il contratto del giro. */
export function stampaPiano(piano: PianoScansione, tetti: TettiScuole, giorni: number): void {
  console.log(
    `\n[crawl-mvp] PIANO — baseline ${piano.baseline.length} province · ` +
      `domanda ${piano.domanda.length} (finestra ${giorni} giorni) · ` +
      `totale ${piano.tutte.length}`,
  );
  for (const provincia of piano.tutte) console.log(rigaPiano(provincia, piano, tetti));
  if (piano.fuoriBaseline.length > 0) {
    console.log(
      `[crawl-mvp] La domanda ALLARGA il perimetro: ${piano.fuoriBaseline.join(', ')} ` +
        '(province non capoluogo, lette solo perché richieste).',
    );
  }
  if (piano.scadute.length > 0) {
    console.log(
      `[crawl-mvp] Richieste fuori finestra (non accendono nulla): ${piano.scadute.join(', ')}.`,
    );
  }
  if (piano.sconosciute.length > 0) {
    console.log(`[crawl-mvp] Codici fuori catalogo ignorati: ${piano.sconosciute.join(', ')}.`);
  }
}

/**
 * Stampa la lettura del termostato: è la ragione per cui il giro ha QUESTA
 * intensità. Il numero è quello vero del database — nessun conteggio ritoccato,
 * nessuna riga creata per «arrivare a 1.000»: la soglia dice dove si vuole
 * arrivare, non dove si è (§26.127).
 */
export function stampaTermostato(lettura: LetturaTermostato, tetti: TettiScuole): void {
  console.log(`\n[crawl-mvp] TERMOSTATO — ${lettura.frase}`);
  console.log(
    `[crawl-mvp] Tetti del giro: domanda ${etichettaTetto(tetti.domanda)}/provincia · ` +
      `fondo ${tetti.fondo}/provincia`,
  );
}

/**
 * ScuoleRadar.it — SGRANATURA DEGLI ELENCHI E TETTI DELL'ATTACCO DI MASSA (§26.101).
 *
 * Perché esiste: gli Uffici Scolastici (e gli albi degli istituti) pubblicano gli
 * interpelli come RIGHE di un elenco, e la scadenza spesso non è nella riga ma nel
 * documento che la riga apre («Le domande vanno presentate entro le ore 12:00 del
 * 12/11/2026»). Senza aprire quel documento la voce resta «senza scadenza» e non
 * entra: il portale è letto, ma il Paese sembra vuoto. Questo modulo decide
 * **quali voci di un elenco meritano l'apertura** e **quanti** documenti si aprono
 * per elenco, per giro e per istituto — due decisioni che il runner deve poter
 * cambiare da ambiente (una campagna di massa) senza toccare il codice.
 *
 * LE DUE REGOLE, ENTRAMBE STRUTTURALI
 *  1. `vociDaSgranare` — una voce si apre solo se è un AVVISO: mai la pagina
 *     stessa, mai la home (`eUrlHome`), mai una sezione/indice (`eUrlIndicePortale`,
 *     direttiva §26.99 «un avviso si apre su un avviso»), mai un doppione.
 *     L'ordine della pagina si conserva: le prime righe sono le più recenti.
 *  2. `limitiSgranatura` — i tetti (documenti per elenco, documenti per giro,
 *     pagine e documenti per istituto, istituti per giro) con default dichiarati
 *     e override da ambiente VALIDATI: un valore assente, negativo o non numerico
 *     non azzera mai l'ingestione, ricade sul default.
 *
 * PURO: nessuna rete, nessun database, nessuna dipendenza da `process` (l'ambiente
 * arriva come parametro). Guardia: `npm run test:sgranatura` (incluso in `npm test`).
 */

import { eUrlIndicePortale } from '../lib/urlAvviso.ts';
import { eUrlHome } from './paginaElenco.ts';


/** Tetti dell'attacco di massa: quante aperture di documenti si concedono. */
export interface LimitiSgranatura {
  /** Documenti aperti per una singola pagina-elenco. */
  perElenco: number;
  /** Pagine di un elenco lette per target (1 = solo la prima, §26.102). */
  pagineElenco: number;
  /** Documenti aperti in un intero giro (è rete, non parsing). */
  perGiro: number;
  /**
   * Millisecondi concessi all'apertura dei documenti di UN elenco.
   * Perché esiste: il 29/10/2026 l'elenco dell'USR Liguria (135 voci) ha tenuto
   * fermo il giro nazionale per venti minuti — un portale lento non deve poter
   * congelare il Paese. Allo scadere del tempo si smette di aprire e si passa al
   * target successivo: le righe non lette restano nel giro seguente.
   */
  millisecondiElenco: number;
  /** Pagine di albo lette per istituto nel deep crawl. */
  paginePerAlbo: number;
  /** Istituti visitati in un giro di deep crawl. */
  istitutiPerGiro: number;
  /** Documenti aperti per istituto nel deep crawl. */
  documentiPerIstituto: number;
}

/**
 * Default dichiarati (§26.101). Prima del 29/10/2026 valevano 10 documenti per
 * elenco, 200 per giro, 60 istituti, 2 pagine e 6 documenti per istituto: un
 * elenco regionale da 60 avvisi perdeva 50 termini su 60, e il giro nazionale
 * toccava un terzo delle scuole citate. I numeri qui sotto moltiplicano la
 * profondità senza cambiare NESSUNA regola di qualità: la scadenza deve restare
 * dichiarata, la scuola certificata e il link quello del singolo avviso.
 */
export const LIMITI_SGRANATURA: LimitiSgranatura = {
  perElenco: 40,
  // §26.102 — un hub WordPress mostra 10 voci per pagina e ne tiene 200 in
  // archivio: leggere solo la prima pagina è un campione travestito da elenco.
  // Misurato il 29/10/2026: la pagina 2 dell'AT di Napoli dà altre 12 voci
  // apribili che il giro nazionale non aveva mai visto.
  pagineElenco: 3,
  // 2.500 e non 800: il giro di prova del 29/10/2026 su 74 target ha esaurito la
  // riserva di 800 a metà strada e i portali successivi non hanno aperto nulla
  // («0 aperti, riserva del giro: 0»). Duecentodieci target richiedono ~2.300
  // aperture: un tetto più basso è un campione travestito da giro nazionale.
  perGiro: 2_500,
  // Due minuti per elenco: bastano per ~40 documenti su un portale sano e
  // impediscono a un albo lento di fermare il giro (misurato: 135 voci = 20′).
  millisecondiElenco: 120_000,
  paginePerAlbo: 3,
  istitutiPerGiro: 150,
  documentiPerIstituto: 10,
};

/** Variabili d'ambiente che sovrascrivono i tetti (campagne di massa). */
export const AMBIENTE_SGRANATURA: Readonly<Record<keyof LimitiSgranatura, string>> = {
  perElenco: 'SGRANATURA_ELENCO',
  pagineElenco: 'SGRANATURA_PAGINE_ELENCO',
  perGiro: 'SGRANATURA_RUN',
  millisecondiElenco: 'SGRANATURA_MS_ELENCO',
  paginePerAlbo: 'SGRANATURA_PAGINE_ALBO',
  istitutiPerGiro: 'SGRANATURA_ISTITUTI',
  documentiPerIstituto: 'SGRANATURA_DOCUMENTI_ISTITUTO',
};

/** Oltre questo valore non è più un tetto: è un crawler del sito. */
export const TETTO_MASSIMO_SGRANATURA = 5_000;

/**
 * Tetto massimo dei MILLISECONDI per elenco: 30 minuti. La scala del tempo non è
 * quella dei conteggi — un tetto di 5.000 ms non sarebbe un limite, sarebbe la
 * fine della sgranatura (misurato: 135 voci su un albo lento valgono 20 minuti).
 */
export const TETTO_MASSIMO_MS_ELENCO = 1_800_000;

/** Intero valido in `[0, massimo]`, altrimenti il default. */
function tettoDaAmbiente(
  grezzo: string | undefined,
  predefinito: number,
  massimo: number = TETTO_MASSIMO_SGRANATURA,
): number {
  if (grezzo === undefined || grezzo.trim() === '') return predefinito;
  const n = Number(grezzo);
  if (!Number.isFinite(n) || n < 0) return predefinito;
  return Math.min(Math.floor(n), massimo);
}

/**
 * Tetti effettivi del giro: default dichiarati + override d'ambiente validati.
 * `base` serve ai test (nessun ambiente reale in gioco).
 */
export function limitiSgranatura(
  ambiente: Readonly<Record<string, string | undefined>> = {},
  base: LimitiSgranatura = LIMITI_SGRANATURA,
): LimitiSgranatura {
  const leggi = (chiave: keyof LimitiSgranatura): number =>
    tettoDaAmbiente(ambiente[AMBIENTE_SGRANATURA[chiave]], base[chiave]);
  return {
    perElenco: leggi('perElenco'),
    pagineElenco: leggi('pagineElenco'),
    perGiro: leggi('perGiro'),
    millisecondiElenco: tettoDaAmbiente(
      ambiente[AMBIENTE_SGRANATURA.millisecondiElenco],
      base.millisecondiElenco,
      TETTO_MASSIMO_MS_ELENCO,
    ),
    paginePerAlbo: leggi('paginePerAlbo'),
    istitutiPerGiro: leggi('istitutiPerGiro'),
    documentiPerIstituto: leggi('documentiPerIstituto'),
  };
}

/** Voce d'elenco apribile: quella del lettore universale, con URL garantita. */
export type VoceDaSgranare<T> = T & { directUrl: string };

export interface OpzioniSgranatura {
  /** URL della pagina che contiene le voci (non si apre mai sé stessa). */
  paginaUrl?: string;
  /** Tetto di voci restituite (`null`/assente = nessun tetto). */
  max?: number | null;
}

/** URL normalizzata per i confronti: senza frammento (l'ancora non è un avviso). */
function senzaFrammento(url: string): string {
  return url.split('#')[0].trim();
}

/**
 * §26.101 — FINESTRA ROTANTE SU UN ELENCO LUNGO.
 *
 * Perché serve: nel giro nazionale del 29/10/2026 i portali hanno dichiarato
 * **4.266** voci d'elenco senza scadenza, ma il tetto per pagina è 40 documenti:
 * senza rotazione si aprono SEMPRE le prime 40 righe (le più recenti) e
 * l'archivio sotto non viene mai letto — un campione, per l'ennesima volta, solo
 * più profondo. La finestra si sposta a ogni `giro` (nel runner: l'ora corrente,
 * così i tre run quotidiani leggono tre segmenti diversi) e, completato il ciclo,
 * riparte da capo: nessuna riga resta invisibile per sempre.
 *
 * `perElenco >= totale` (o `totale === 0`) → tutta la lista, come prima.
 */
export function finestraElenco(
  totale: number,
  perElenco: number,
  giro = 0,
): { da: number; a: number } {
  const n = Math.max(0, Math.floor(totale));
  const ampiezza = Math.max(1, Math.floor(perElenco));
  if (n === 0) return { da: 0, a: 0 };
  if (ampiezza >= n) return { da: 0, a: n };
  const passo = Math.abs(Math.floor(giro)) % n;
  const da = (passo * ampiezza) % n;
  return { da, a: Math.min(n, da + ampiezza) };
}

/**
 * Dalle voci di un elenco, quelle che sono AVVISI da aprire. Il criterio è
 * strutturale e NON conosce i portali: chi chiama non deve sapere che `mim.gov.it`
 * pubblica sezioni e che l'USP di Arezzo pubblica post.
 */
export function vociDaSgranare<T extends { directUrl?: string | null }>(
  voci: readonly T[],
  opzioni: OpzioniSgranatura = {},
): VoceDaSgranare<T>[] {
  const pagina = opzioni.paginaUrl ? senzaFrammento(opzioni.paginaUrl) : '';
  const max = opzioni.max === null || opzioni.max === undefined ? Infinity : Math.max(0, opzioni.max);
  const visti = new Set<string>();
  const out: VoceDaSgranare<T>[] = [];
  for (const voce of voci) {
    if (out.length >= max) break;
    const grezza = senzaFrammento(String(voce.directUrl ?? ''));
    if (!/^https?:\/\//i.test(grezza)) continue;
    // La pagina che stiamo leggendo non è un avviso: è l'elenco.
    if (pagina && grezza === pagina) continue;
    // Home dell'ente e sezioni/indici: si aprono gli avvisi, non gli elenchi.
    if (eUrlHome(grezza)) continue;
    if (eUrlIndicePortale(grezza)) continue;
    if (visti.has(grezza)) continue;
    visti.add(grezza);
    out.push({ ...voce, directUrl: grezza });
  }
  return out;
}

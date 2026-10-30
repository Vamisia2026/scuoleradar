/**
 * ScuoleRadar.it — IL BANDO VIVE NEL PDF: gusci vuoti e cimiteri di file (§26.115).
 *
 * Due pagine diverse, un solo problema. L'istituto pubblica la notizia come
 * **pagina HTML vuota** che contiene solo il link al PDF (Piacenza: titolo
 * «Interpelli», corpo zero, allegato `bando-A022.pdf`), oppure come **elenco di
 * file** senza una parola di contesto (il «cimitero»: dieci PDF in colonna,
 * nessun titolo). In entrambi i casi l'HTML non dice niente di utile e il dato
 * — data, classe, ore, requisiti — sta DENTRO il documento.
 *
 * LA REGOLA
 *  · `ePaginaSenzaContenuto`: la pagina non ha testo strutturato (solo
 *    etichette di menu). Misura il testo leggibile e la frase più lunga: un
 *    guscio ha le parole «Home | Albo | Contatti» e nient'altro;
 *  · `allegatiBando`: quali link sono ALLEGATI DI BANDO, ordinati per
 *    pertinenza (`bando` > `avviso`/`interpello`/`supplenza` > `domanda` >
 *    `allegato`). Riusa la regola di §26.95 (`linkScuola.linkAllegatiInterpello`:
 *    stesso istituto, mai piattaforma privata, mai file non pertinente) e
 *    aggiunge il divieto assoluto degli AGGREGATORI terzi (§26.109: il PDF di
 *    `scuolainterpelli.it` non è la fonte ufficiale, nemmeno se è pertinente);
 *  · `allegatiDaGuscio`: le due regole insieme, cioè l'unica domanda che pone il
 *    deep crawl — «questa pagina è un guscio con un bando dentro?»;
 *  · `titoloDaAllegato`: il titolo leggibile di un allegato (testo del link,
 *    altrimenti nome del file ripulito: `bando_A022_supplenza.pdf` →
 *    «Bando A022 supplenza»). Nessuna parola inventata.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, nessun database.
 * Guardia: `npm run test:allegati-bando` (incluso in `npm test`).
 */

import { eAggregatorePrivato } from '../lib/dominiIstituzionali.ts';
import { linkAllegatiInterpello } from './linkScuola.ts';

/** Un allegato di bando: URL, testo del link e pertinenza (più alto = meglio). */
export interface AllegatoBando {
  url: string;
  testo: string;
  punteggio: number;
}

/** Sotto questa soglia di testo leggibile la pagina è un GUSCIO. */
export const MINIMO_TESTO_PAGINA = 400;
/** Una frase di almeno questi caratteri è «contenuto»: un guscio ha solo etichette. */
export const MINIMO_FRASE = 120;

/** Pertinenza di un allegato, dalla più forte alla più debole. */
const PESI_ALLEGATO: ReadonlyArray<{ re: RegExp; peso: number }> = [
  { re: /\bband[oi]\b/i, peso: 4 },
  { re: /\bavvis[oi]\b/i, peso: 3 },
  { re: /\binterpell/i, peso: 3 },
  { re: /\bsupplenz/i, peso: 3 },
  { re: /\bdomand[ae]\b|\brequisit/i, peso: 2 },
  { re: /\ballegat/i, peso: 1 },
];

/** Entità HTML che compaiono nel testo di una pagina (le più comuni). */
const ENTITA: ReadonlyArray<[RegExp, string]> = [
  [/&nbsp;|&#160;/gi, ' '],
  [/&amp;/gi, '&'],
  [/&quot;/gi, '"'],
  [/&#39;|&apos;/gi, "'"],
  [/&lt;/gi, '<'],
  [/&gt;/gi, '>'],
];

/** Testo LEGGIBILE di una pagina: via script/stile/commenti, poi i tag. */
export function testoPagina(html?: string | null): string {
  if (typeof html !== 'string' || html.trim() === '') return '';
  let testo = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  for (const [re, valore] of ENTITA) testo = testo.replace(re, valore);
  return testo.replace(/\s+/g, ' ').trim();
}

/**
 * True se la pagina NON ha contenuto strutturato: poco testo leggibile oppure
 * nessuna frase (solo voci di menu, titoli, briciole di pane).
 */
export function ePaginaSenzaContenuto(
  html?: string | null,
  opzioni: { minimoCaratteri?: number; minimoFrase?: number } = {},
): boolean {
  const testo = testoPagina(html);
  if (testo.length < (opzioni.minimoCaratteri ?? MINIMO_TESTO_PAGINA)) return true;
  const minimoFrase = opzioni.minimoFrase ?? MINIMO_FRASE;
  return !testo.split(/[.!?;]\s+/).some((frase) => frase.trim().length >= minimoFrase);
}

/** Pertinenza di un allegato dal testo del link e dal nome del file. */
export function punteggioAllegato(testo?: string | null, url?: string | null): number {
  let nome = '';
  try {
    nome = decodeURIComponent((url ?? '').split('/').pop() ?? '');
  } catch {
    nome = (url ?? '').split('/').pop() ?? '';
  }
  const insieme = `${testo ?? ''} ${nome}`;
  return PESI_ALLEGATO.reduce((acc, voce) => (voce.re.test(insieme) ? acc + voce.peso : acc), 0);
}

/**
 * Gli allegati di bando di una pagina, dal più pertinente al meno. Nessun
 * aggregatore terzo, nessun duplicato, massimo `max`.
 */
export function allegatiBando(html: string, baseUrl: string, max = 2): AllegatoBando[] {
  const candidati = linkAllegatiInterpello(html, baseUrl, Math.max(1, max * 3));
  const visti = new Set<string>();
  const esito: AllegatoBando[] = [];
  for (const candidato of candidati) {
    if (visti.has(candidato.url) || eAggregatorePrivato(candidato.url)) continue;
    visti.add(candidato.url);
    esito.push({
      url: candidato.url,
      testo: candidato.testo,
      punteggio: punteggioAllegato(candidato.testo, candidato.url),
    });
  }
  return esito
    .map((allegato, indice) => ({ allegato, indice }))
    .sort((a, b) => b.allegato.punteggio - a.allegato.punteggio || a.indice - b.indice)
    .slice(0, Math.max(0, max))
    .map(({ allegato }) => allegato);
}

/**
 * L'unica domanda del deep crawl: la pagina è un GUSCIO con un bando dentro?
 * `[]` quando la pagina ha contenuto suo (allora decide il parser normale) o
 * quando non c'è nessun allegato pertinente.
 */
export function allegatiDaGuscio(html: string, baseUrl: string, max = 2): AllegatoBando[] {
  if (!ePaginaSenzaContenuto(html)) return [];
  return allegatiBando(html, baseUrl, max);
}

/** Nome del file senza estensione e senza separatori tecnici. */
function nomeLeggibile(url?: string | null): string {
  const grezzo = (url ?? '').split(/[?#]/)[0].split('/').pop() ?? '';
  let nome = grezzo;
  try {
    nome = decodeURIComponent(grezzo);
  } catch {
    // nome già leggibile: nessuna decodifica
  }
  return nome
    .replace(/\.(?:pdf|docx?|odt|xlsx?|zip)$/i, '')
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Etichette di link che non dicono nulla («Scarica», «PDF»). */
const RE_ETICHETTA_VUOTA = /^(?:scarica|download|clicca(?:\s+qui)?|apri|pdf|documento|allegato)$/i;

/**
 * Titolo leggibile di un allegato: il testo del link quando dice qualcosa,
 * altrimenti il nome del file ripulito. Mai una stringa vuota.
 */
export function titoloDaAllegato(testo?: string | null, url?: string | null): string {
  const pulito = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (pulito.length >= 8 && !RE_ETICHETTA_VUOTA.test(pulito)) return pulito.slice(0, 160);
  const nome = nomeLeggibile(url).slice(0, 160);
  if (!nome) return 'Allegato';
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

/**
 * ScuoleRadar.it — DAL DOCUMENTO ALLA RIGA: titolo, classi, ore, requisiti (§26.115).
 *
 * Perché esiste. Quando l'avviso è un PDF (`allegatiBando.ts`) la riga del
 * database non può nascere dal nome del file: `bando_A022_supplenza.pdf` non
 * dice se è una supplenza di 18 ore, per quale classe, con quale titolo
 * richiesto. Quei dati sono DENTRO il testo estratto (`pdfTesto.estraiTestoPdf`)
 * e vanno letti con regole esplicite, non con un'euristica che li inventa.
 *
 * I CAMPI (e da dove vengono)
 *  · **classi, codice, provincia, scadenza, recapiti** → `campiDocumento.ts`
 *    (§26.96): una sola verità, la stessa dell'HTML. Nessun duplicato qui;
 *  · **ore settimanali** → solo le forme dichiarate dal bando: «18 ore
 *    settimanali», «orario settimanale di 12 ore», «n. 6 ore». Un numero di ore
 *    senza etichetta non è un orario: può essere la durata di un corso;
 *  · **requisiti** → le frasi che nominano un titolo di studio, l'abilitazione,
 *    la classe di concorso o l'esperienza (max 3, così il dettaglio resta
 *    leggibile);
 *  · **titolo** → la riga con cui il documento si intitola («AVVISO …»,
 *    «BANDO …», «INTERPELLO …»), altrimenti il testo del link/nome del file
 *    ripulito. Se il titolo non dichiara un reclutamento si antepone
 *    «Interpello»: è l'ETICHETTA della categoria (la riga è un interpello per
 *    costruzione, viene da un albo di interpelli), non un'invenzione sul merito.
 *    Classi e ore si accodano solo se non ci sono già.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`.
 * Guardia: `npm run test:allegati-bando` (incluso in `npm test`).
 */

import { campiDaDocumento, type CampiDocumento } from './campiDocumento.ts';

/** Ciò che una riga sa del proprio documento, letto una volta sola. */
export interface DatiBando extends CampiDocumento {
  /** Ore settimanali dichiarate dal bando (`null` se non le scrive). */
  ore: number | null;
  /** Frasi che dichiarano i requisiti (max 3, già ripulite). */
  requisiti: string[];
}

/** Fonti del titolo: il documento, il link e i dati già estratti. */
export interface FontiTitolo {
  /** Testo del documento (PDF o pagina), per la riga «AVVISO …». */
  testo?: string | null;
  /** Testo del link o nome del file: fallback leggibile. */
  fallback?: string | null;
  classi?: readonly string[] | null;
  ore?: number | null;
}

/** Spazi compattati: i PDF spezzano le frasi a metà (`18 ore\nsettimanali`). */
function compatto(testo?: string | null): string {
  return (testo ?? '')
    .replace(/[\u00a0\u2007\u202f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Forme DICHIARATE dell'orario settimanale (l'etichetta è obbligatoria). */
const RE_ORE: readonly RegExp[] = [
  /\b(?:n\.?\s*)?(\d{1,2})\s*ore\s+(?:settimanali|orarie|sett\.)\b/i,
  /\borario\s+settimanale\s+(?:di\s+|pari\s+a\s+)?(\d{1,2})\s*ore\b/i,
  /\b(\d{1,2})\s*ore\s+(?:di\s+)?(?:insegnamento|lezione)\s+settimanali\b/i,
];

/** Ore settimanali dichiarate nel documento (`null` se non dichiarate). */
export function oreSettimanaliDaTesto(testo?: string | null): number | null {
  const t = compatto(testo);
  if (!t) return null;
  for (const re of RE_ORE) {
    const trovato = re.exec(t);
    if (!trovato) continue;
    const numero = Number(trovato[1]);
    // Un orario settimanale plausibile: 1–40 ore (oltre è un refuso o un totale).
    if (Number.isInteger(numero) && numero >= 1 && numero <= 40) return numero;
  }
  return null;
}

/** Parole che aprono una frase di requisito. */
const RE_PAROLA_REQUISITO =
  /\b(?:titolo\s+di\s+studio|laurea|abilitazion\w*|specializzazion\w*|classe\s+di\s+concors\w*|requisit\w*|esperienza\s+(?:documentata|pregressa|minima)|master\b|dottorato\b)/i;

/** Frasi candidate: lunghezza utile, senza spezzare i numeri di protocollo. */
const RE_FRASE = /[^.;]{25,180}/g;

/**
 * Frasi che dichiarano i requisiti, nell'ordine del documento, senza duplicati,
 * al massimo `max` (default 3). Vuoto quando il documento non li scrive.
 */
export function requisitiDaTesto(testo?: string | null, max = 3): string[] {
  const t = compatto(testo);
  if (!t) return [];
  const esito: string[] = [];
  const visti = new Set<string>();
  for (const trovato of t.matchAll(RE_FRASE)) {
    const frase = trovato[0].trim();
    if (!RE_PAROLA_REQUISITO.test(frase)) continue;
    const chiave = frase.toLowerCase();
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    esito.push(frase);
    if (esito.length >= Math.max(1, max)) break;
  }
  return esito;
}

/** Riga con cui il documento si intitola («AVVISO …», «BANDO …»). */
const RE_TITOLO_DOCUMENTO =
  /^[ \t]*((?:avviso|bando|interpello|supplenza|manifestazione\s+di\s+interesse|selezione|reclutamento)[^\n]{4,170})/im;

/** Parole che dichiarano un reclutamento nel titolo della riga. */
const RE_RECLUTAMENTO =
  /\b(?:interpell|supplenz|incaric|disponibilit|messa\s+a\s+disposizione|reclutament)/i;

/** La riga di intestazione del documento, ripulita (`null` se non c'è). */
export function intestazioneDaDocumento(testo?: string | null): string | null {
  if (!testo) return null;
  const trovato = RE_TITOLO_DOCUMENTO.exec(testo);
  if (!trovato) return null;
  const riga = compatto(trovato[1]).replace(/[\s,;:.\-–—]+$/, '');
  return riga.length >= 8 ? riga : null;
}

/**
 * Titolo leggibile e completo della riga: intestazione del documento (o testo
 * del link), etichetta «Interpello» se il reclutamento non è dichiarato, poi le
 * classi e le ore non ancora presenti. Mai una stringa vuota.
 */
export function titoloBandoDaDocumento(fonti: FontiTitolo): string {
  const base = compatto(intestazioneDaDocumento(fonti.testo) ?? fonti.fallback) || 'Interpello';
  let titolo = RE_RECLUTAMENTO.test(base) ? base : `Interpello ${base}`;

  const classi = (fonti.classi ?? [])
    .map((classe) => compatto(classe).toUpperCase())
    .filter((classe) => classe.length > 0);
  const mancanti = classi.filter((classe) => !titolo.toUpperCase().includes(classe));
  if (mancanti.length > 0) titolo += ` — ${[...new Set(mancanti)].join(', ')}`;

  const ore = fonti.ore ?? null;
  if (ore && !/\d+\s*ore/i.test(titolo)) titolo += ` — ${ore} ore`;
  return titolo.slice(0, 180).trim();
}

/**
 * Tutti i dati che una riga può leggere dal documento: i cinque campi di
 * `campiDocumento` più ore e requisiti. Una sola chiamata, una sola verità.
 */
export function datiBandoDaTesto(testo?: string | null): DatiBando {
  const grezzo = testo ?? '';
  return {
    ...campiDaDocumento(grezzo),
    ore: oreSettimanaliDaTesto(grezzo),
    requisiti: requisitiDaTesto(grezzo),
  };
}

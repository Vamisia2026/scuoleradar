/**
 * ScuoleRadar.it — LETTURA EURISTICA UNIVERSALE DI TABELLE E LISTE HTML (§26.84).
 *
 * I portali scolastici non hanno un CMS comune: `<table>` negli USR e nei
 * gestionali PHP legacy, griglie di `<div>` con `role="row"`/`role="cell"` (o la
 * classe `results-row`) in Liguria, liste di post WordPress altrove. Invece di
 * un parser per portale, qui si legge il SIGNIFICATO della pagina: le colonne
 * si mappano su RUOLI con parole chiave (oggetto, istituto, classe, date,
 * allegato) e ogni riga diventa una voce, oppure si scarta.
 *
 * Puro: nessuna rete, nessun LLM, nessuna dipendenza (l'HTML lo legge
 * `universalHtml.ts`); lavoro limitato a `MAX_HTML_CHARS`; stesso HTML + stesso
 * `sourceUrl` = stesse voci. Un layout non riconosciuto torna `success: false`
 * con `layoutDetected: 'unknown'` (segnale di quarantena, Task 4) invece di
 * lanciare: la scansione non si interrompe mai.
 *
 * Riuso: `pdfDeterminist` (§26.83) e `noiseFilter` (§26.80). Guardia:
 * `npm run test:universal-euristica` (incluso in `npm test`).
 */

import { isAdministrativeNoise } from './noiseFilter';
import { estraiCodiciClasse, parsePdfDeterminist } from './pdfDeterminist';
import { vociDaElenco } from './universalElenchi';
import { blocchi, celle, primoLink, testo } from './universalHtml';

/** Una voce apribile: solo ciò che la fonte dichiara, niente dati inventati. */
export interface ExtractedInterpello {
  title: string;
  schoolName?: string;
  schoolCode?: string;
  classCodes: string[];
  publicationDate?: string;
  expirationDate?: string;
  directUrl: string;
  contactEmail?: string;
}

/** Come è stata letta la pagina (serve alla quarantena e ai log del runner). */
export type LayoutRilevato = 'table' | 'aria_grid' | 'wp_posts' | 'link_list' | 'unknown';

export interface UniversalExtractionResult {
  success: boolean;
  items: ExtractedInterpello[];
  layoutDetected: LayoutRilevato;
  error?: string;
}

/** Oltre questa soglia si sta leggendo la coda della pagina, non l'elenco. */
export const MAX_HTML_CHARS = 400_000;
/** Tetto di voci per pagina: una griglia nazionale può averne centinaia. */
export const MAX_VOCI = 300;

/* ----------------------------- colonne e ruoli ----------------------------- */

type Ruolo = 'titolo' | 'scuola' | 'classe' | 'scadenza' | 'pubblicazione' | 'link';

/** Parole chiave delle intestazioni → ruolo. L'ordine è la precedenza. */
const PAROLE_COLONNA: readonly { ruolo: Ruolo; re: RegExp }[] = [
  { ruolo: 'titolo', re: /oggett|avvis|titol|descrizion|interpell/i },
  { ruolo: 'classe', re: /class|concors|materi|profil|disciplin|\bcdc\b|tipolog/i },
  { ruolo: 'scadenza', re: /scadenz|termin|chiusur|\bentro\b|fine\s+domande/i },
  { ruolo: 'pubblicazione', re: /pubblicat|pubblicazion|\bdata\b|inseriment|protocoll/i },
  { ruolo: 'scuola', re: /scuol|istitut|codice|meccanografic|denominazion/i },
  { ruolo: 'link', re: /allegat|link|download|dettagli|\bapri\b|azion|document|\bfile\b|pdf/i },
];

/** Ruolo semantico di un'intestazione (`null` = colonna non riconosciuta). */
function ruoloColonna(intestazione: string): Ruolo | null {
  const contenuto = testo(intestazione);
  if (!contenuto) return null;
  for (const parola of PAROLE_COLONNA) if (parola.re.test(contenuto)) return parola.ruolo;
  return null;
}

/** Codice meccanografico (GEIC85000H) e parola che rende un testo un NOME. */
const RE_MECCANOGRAFICO = /\b[A-Z]{2}[A-Z0-9]{8}\b/i;
const RE_NOME_ISTITUTO =
  /scuol|istitut|liceo|comprensiv|tecnico|professionale|ipsia|itis\b|cpia|convitto|direzion|magistral|artistico/i;
/** Etichette di servizio accanto al nome della scuola nei tabelloni. */
const RE_ETICHETTA_SCUOLA = /\b(?:statale|paritaria|privata|pareggiata)\b/gi;

const RE_DATA_ITALIANA = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/;

/** Data ISO di una cella «nuda» (`12/09/2027`): il significato lo dà la colonna. */
function dataIso(testoCella: string): string | undefined {
  const m = RE_DATA_ITALIANA.exec(testoCella);
  if (!m) return undefined;
  const anno = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const [mese, giorno] = [Number(m[2]), Number(m[1])];
  if (anno < 2000 || anno > 2100 || mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return undefined;
  const data = new Date(Date.UTC(anno, mese - 1, giorno));
  if (data.getUTCMonth() !== mese - 1 || data.getUTCDate() !== giorno) return undefined;
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`;
}

/**
 * Voce della riga: metadati dalle colonne mappate, il resto dal testo con le
 * regole di `pdfDeterminist`. `null` = riga non apribile, rumore o senza titolo.
 */
function voceDaRiga(
  celleHtml: string[],
  ruoli: (Ruolo | null)[],
  intestazioni: string[],
  baseUrl: string,
): ExtractedInterpello | null {
  const testi = celleHtml.map(testo);
  const indice = (ruolo: Ruolo): number => ruoli.indexOf(ruolo);
  const link = primoLink(celleHtml[indice('link')] ?? '', baseUrl) ?? primoLink(celleHtml.join(' '), baseUrl);
  if (!link) return null;

  const riga = testi.join(' · ');
  const piuLunga = testi
    .filter((c) => c.length >= 12 && c.split(' ').length >= 2 && !c.includes('@'))
    .sort((a, b) => b.length - a.length)[0];
  // Il titolo più lungo batte l'etichetta del pulsante («Stampa», «Apri»).
  const titolo = (testi[indice('titolo')] ?? '').trim() || piuLunga || link.testo;
  if (titolo.length < 8) return null;
  // Il TITOLO è l'atto (§26.72): la stessa regola vale riga per riga.
  if (isAdministrativeNoise(riga, titolo).isNoise) return null;

  const scheda = parsePdfDeterminist(riga);
  const iScadenza = indice('scadenza');
  const iClasse = indice('classe');
  const iScuola = indice('scuola');

  // La colonna dà il significato alla data nuda: «Scadenza» + «15/11/2027».
  const expirationDate =
    parsePdfDeterminist(`${intestazioni[iScadenza] ?? ''} ${testi[iScadenza] ?? ''}`).data.expirationDate ??
    scheda.data.expirationDate;
  const publicationDate = dataIso(testi[indice('pubblicazione')] ?? '') ?? scheda.data.publicationDate;

  const dallaColonna = iClasse >= 0 ? estraiCodiciClasse(testi[iClasse] ?? '') : [];
  const classCodes = dallaColonna.length > 0 ? dallaColonna : estraiCodiciClasse(`${titolo} ${riga}`);

  const cellaScuola = (testi[iScuola] ?? '').replace(RE_ETICHETTA_SCUOLA, '').trim();
  const codice = (cellaScuola.match(RE_MECCANOGRAFICO) ?? riga.match(RE_MECCANOGRAFICO) ?? [])[0];
  const nomeGrezzo = cellaScuola.replace(RE_MECCANOGRAFICO, ' ').replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  const schoolName = RE_NOME_ISTITUTO.test(nomeGrezzo) ? nomeGrezzo.slice(0, 120) : scheda.data.schoolName;

  return {
    title: titolo.slice(0, 300),
    ...(schoolName ? { schoolName } : {}),
    ...(codice ? { schoolCode: codice.toUpperCase() } : {}),
    classCodes,
    ...(publicationDate ? { publicationDate } : {}),
    ...(expirationDate ? { expirationDate } : {}),
    directUrl: link.url,
    ...(scheda.data.email ? { contactEmail: scheda.data.email } : {}),
  };
}

/**
 * Tabella o griglia: l'intestazione è la prima riga con almeno DUE colonne
 * semantiche (le tabelle Piemonte non hanno `<thead>`, la griglia Liguria usa
 * `role="columnheader"` o `<span>`); tutto ciò che la precede non è un dato.
 */
function vociDaRighe(righe: string[][], baseUrl: string): ExtractedInterpello[] {
  const testi = righe.map((celleRiga) => celleRiga.map(testo));
  const iHeader = testi.findIndex(
    (celleRiga) => celleRiga.filter((cella) => ruoloColonna(cella) !== null).length >= 2,
  );
  const ruoli: (Ruolo | null)[] = iHeader >= 0 ? testi[iHeader].map(ruoloColonna) : [];
  const intestazioni = iHeader >= 0 ? testi[iHeader] : [];
  const voci: ExtractedInterpello[] = [];
  for (let i = iHeader + 1; i < righe.length && voci.length < MAX_VOCI; i += 1) {
    const celleRiga = righe[i];
    if (!celleRiga) continue;
    const voce = voceDaRiga(celleRiga, ruoli, intestazioni, baseUrl);
    if (voce && !voci.some((v) => v.directUrl === voce.directUrl)) voci.push(voce);
  }
  return voci;
}

/* -------------------------------- i lettori -------------------------------- */

/** Tabella HTML: righe `<tr>` con `<td>`/`<th>` (una `<tr>` con tabella è layout). */
function daTabella(html: string, baseUrl: string): ExtractedInterpello[] {
  const righe = blocchi(html, (tag) => tag === 'tr')
    .map((b) => b.html)
    .filter((riga) => !/<table\b/i.test(riga))
    .map((riga) => celle(riga, 'table'));
  return vociDaRighe(righe, baseUrl);
}

const RE_RIGA_GRIGLIA = /class\s*=\s*["'][^"']*\b(?:results-row|results-head)\b/i;
const RE_RUOLO_RIGA = /role\s*=\s*["']?row\b/i;

/** Griglia di `<div>`: righe ARIA (`role="row"`) o classi da tabellone. */
function daGriglia(html: string, baseUrl: string): ExtractedInterpello[] {
  const righe = blocchi(
    html,
    (tag, attr) => tag !== 'tr' && (RE_RUOLO_RIGA.test(attr) || RE_RIGA_GRIGLIA.test(attr)),
  ).map((b): string[] => celle(b.html, RE_RUOLO_RIGA.test(b.attributi) ? 'aria' : 'div'));
  return vociDaRighe(righe, baseUrl);
}

const RE_TITOLO_POST = /<h[1-4]\b[^>]*>([\s\S]*?)<\/h[1-4]>/i;
const RE_BLOCCO_POST = /class\s*=\s*["'][^"']*\b(?:post|entry-content)\b/i;

/** Liste WordPress: un `<article>` / `.post` è una riga «titolo + corpo». */
function daWordPress(html: string, baseUrl: string): ExtractedInterpello[] {
  const titolo = (blocco: string): string => RE_TITOLO_POST.exec(blocco)?.[1] ?? '';
  return blocchi(html, (tag, attr) => tag === 'article' || RE_BLOCCO_POST.test(attr))
    .map((b) => voceDaRiga([titolo(b.html), b.html], ['titolo'], ['Titolo'], baseUrl))
    .filter((voce): voce is ExtractedInterpello => voce !== null)
    .filter((voce, i, tutte) => tutte.findIndex((v) => v.directUrl === voce.directUrl) === i)
    .slice(0, MAX_VOCI);
}

/* -------------------------------- ingresso --------------------------------- */

/**
 * Legge una pagina scolastica e restituisce gli avvisi apribili. Ordine dei
 * lettori: tabella → griglia → post WordPress → elenchi/card. Nessun layout
 * riconosciuto = `success: false` + `unknown` (quarantena, mai un'eccezione).
 */
export function parseUniversalHtml(html: string, sourceUrl: string): UniversalExtractionResult {
  if (typeof html !== 'string' || html.trim() === '') {
    return { success: false, items: [], layoutDetected: 'unknown', error: 'HTML vuoto' };
  }
  try {
    new URL(sourceUrl);
  } catch {
    return { success: false, items: [], layoutDetected: 'unknown', error: 'URL sorgente non valido' };
  }
  const documento = html.slice(0, MAX_HTML_CHARS);

  const tabelle = daTabella(documento, sourceUrl);
  if (tabelle.length > 0) return { success: true, items: tabelle, layoutDetected: 'table' };

  const griglia = daGriglia(documento, sourceUrl);
  if (griglia.length > 0) return { success: true, items: griglia, layoutDetected: 'aria_grid' };

  const post = daWordPress(documento, sourceUrl);
  if (post.length > 0) return { success: true, items: post, layoutDetected: 'wp_posts' };

  // Ultimo lettore (§26.93): elenchi e card senza wrapper semantico.
  const elenco = vociDaElenco(documento, sourceUrl);
  if (elenco.length > 0) return { success: true, items: elenco, layoutDetected: 'link_list' };

  return {
    success: false,
    items: [],
    layoutDetected: 'unknown',
    error: 'nessuna tabella, griglia o lista di avvisi riconosciuta',
  };
}


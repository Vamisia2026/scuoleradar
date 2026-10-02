/**
 * ScuoleRadar.it — Dipartimento Notizie · Link ufficiale punto-a-punto.
 *
 * Regola editoriale §5: l’unico link pubblicabile è il DOCUMENTO specifico.
 * Qui si distingue fra link diretto, pagina-contenitore (traccia pubblicabile,
 * mai ideale) e URL non valido (l’unico caso che blocca la pubblicazione).
 */

import { SEGNALI_LOGIN, SEGNALI_MOCKUP, èLinkPdf, validaUrlDeepLink } from './fontiUfficiali';

/**
 * Ultimi segmenti di percorso che indicano un CONTENITORE (indice, elenco,
 * archivio, directory di servizio) e non un documento specifico: un link che
 * termina così è VIETATO come fonte ufficiale di una notizia.
 */
const SEGMENTI_CONTENITORE = new Set([
  'indice', 'indici', 'index', 'elenco', 'elenchi', 'lista', 'liste', 'archivio',
  'archivi', 'atti', 'atto', 'albo', 'albo-pretorio', 'pubblicazioni', 'pubblicazione',
  'notizie', 'notizia', 'news', 'comunicati', 'comunicato', 'comunicazioni',
  'comunicazione', 'documenti', 'documento', 'normativa', 'urp', 'home', 'homepage',
  'pagina', 'pagine', 'ricerca', 'search', 'risultati', 'categoria', 'categorie',
  'tag', 'tags', 'servizi', 'servizio', 'contatti', 'contatto', 'sezione', 'sezioni',
  'dashboard', 'portale', 'accesso', 'area-riservata', 'sportello', 'agenda',
  'eventi', 'newsletter', 'tutti-gli-avvisi', 'istanzeonline',
]);

/**
 * Parole "neutre" (istituzionali/generiche): uno slug composto SOLO da queste
 * parole e senza numeri identifica un elenco/sezione (es.
 * `/interpelli-ricerca-supplenti`), non un avviso specifico.
 */
const PAROLE_NEUTRE = new Set([
  'a', 'ad', 'al', 'alla', 'alle', 'agli', 'allo', 'e', 'ed', 'di', 'del', 'della',
  'delle', 'dei', 'degli', 'il', 'lo', 'la', 'le', 'gli', 'i', 'in', 'per', 'con',
  'su', 'da', 'dal', 'dalla', 'dalle', 'dallo', 'dai', 'dagli', 'nel', 'nella',
  'nelle', 'negli', 'tra', 'fra', 'non', 'piu', 'come', 'sul', 'sulla',
  'scuola', 'scuole', 'scolastico', 'scolastica', 'istruzione', 'ministero',
  'ministeriale', 'regionale', 'ufficio', 'uffici', 'amministrazione', 'trasparente',
  'pubblica', 'pubblico', 'personale', 'docenti', 'ata',
  'elenco', 'elenchi', 'indice', 'indici', 'lista', 'liste', 'archivio', 'archivi',
  'atti', 'atto', 'albo', 'pubblicazioni', 'pubblicazione', 'notizie', 'notizia',
  'news', 'comunicati', 'comunicato', 'comunicazioni', 'comunicazione', 'documenti',
  'documento', 'normativa', 'urp', 'home', 'pagina', 'pagine', 'ricerca', 'search',
  'risultati', 'categoria', 'categorie', 'tag', 'servizi', 'servizio', 'contatti',
  'contatto', 'sezione', 'sezioni', 'interpelli', 'interpello', 'supplenze',
  'supplenza', 'supplenti', 'graduatorie', 'graduatoria', 'concorsi', 'concorso',
  'bandi', 'bando', 'avvisi', 'avviso', 'selezioni', 'selezione', 'mobilita',
  'assegnazioni', 'nomine', 'informazioni', 'strumenti', 'modulistica', 'ultime',
  'tutti', 'tutte', 'precedenti', 'successive',
]);

/** Finali di percorso SEMPRE considerati contenitori/indici/directory. */
const FINALI_CONTENITORE = [
  '/urp', '/amministrazione-trasparente', '/albo-pretorio', '/archivio', '/archivi',
  '/normativa', '/notizie', '/news', '/comunicati', '/comunicazioni', '/documenti',
  '/agenda', '/eventi', '/istanzeonline.htm', '/home', '/index',
];

/**
 * Parole che, in TESTA allo slug, indicano un ELENCO/INDICE anche quando lo slug
 * contiene altre parole ("elenco-circolari-2026", "archivio-note", "lista-avvisi"):
 * sono pagine da tracciare, non la fonte definitiva della notizia.
 */
const TESTE_CONTENITORE = new Set([
  'elenco', 'elenchi', 'indice', 'indici', 'lista', 'liste', 'archivio', 'archivi',
  'albo', 'pubblicazioni', 'documenti', 'atti', 'notizie', 'news', 'comunicazioni',
  'sezione', 'sezioni', 'categoria', 'categorie', 'raccolta', 'repertorio',
]);

export interface EsitoLinkDiretto {
  ok: boolean;
  motivo?: string;
}

/**
 * LINK UFFICIALE PUNTO-A-PUNTO (regola editoriale §5): l'unico link ammesso per
 * una notizia è l'URL DIRETTO del documento/avviso/comunicato specifico.
 * Sono VIETATI — e quindi bloccano la pubblicazione — homepage (anche dei
 * portali di servizio), indici ed elenchi, directory URP, pagine di ricerca o
 * paginazione e archivi "master".
 */
export function linkDirettoUfficiale(url?: string | null): EsitoLinkDiretto {
  const u = (url ?? '').trim();
  if (!u) return { ok: false, motivo: 'link ufficiale mancante' };
  const baseMotivo = validaUrlDeepLink(u);
  if (baseMotivo) return { ok: false, motivo: baseMotivo };

  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { ok: false, motivo: 'URL non valido' };
  }
  // Un PDF è sempre il documento specifico.
  if (èLinkPdf(u)) return { ok: true };

  const percorso = decodeURIComponent(parsed.pathname).toLowerCase();
  const senzaSlash = percorso.replace(/\/+$/, '') || '/';
  const segmenti = senzaSlash.split('/').filter(Boolean);

  // 1) Homepage di qualunque dominio (portali di servizio compresi).
  if (segmenti.length === 0) {
    return { ok: false, motivo: 'homepage del sito: serve il link diretto al documento' };
  }
  // 2) Ricerca/filtri/paginazione: contenitori, non documenti.
  const query = parsed.search.toLowerCase();
  if (
    /(?:^|[?&])(?:s|q|query|ricerca|search|page|pagina|p|offset|filtro|categoria|cat|tag|anno|mese)=/.test(
      query,
    )
  ) {
    return { ok: false, motivo: 'URL con parametri di ricerca/filtro (contenitore)' };
  }
  if (/\/(?:page|pagina)\/\d+$/.test(senzaSlash)) {
    return { ok: false, motivo: 'URL di paginazione (contenitore)' };
  }
  // 3) Finali di percorso noti (indici, URP, archivi, liste notizie).
  const finale = FINALI_CONTENITORE.find((f) => senzaSlash.endsWith(f));
  if (finale) return { ok: false, motivo: `pagina-contenitore ("…${finale}")` };

  // 4) Ultimo segmento che È un nome di contenitore (es. /…/elenco, /…/albo).
  const ultimo = segmenti[segmenti.length - 1].replace(/\.(?:html?|php|aspx?|jsp)$/i, '');
  if (SEGMENTI_CONTENITORE.has(ultimo)) {
    return { ok: false, motivo: `pagina-contenitore ("${ultimo}")` };
  }

  // 4-bis) Slug di ELENCO/INDICE anche con parole aggiuntive: inizia con una
  //    parola da contenitore ("elenco-circolari-2026", "archivio-note-2026").
  //    È una pagina da TRACCIARE, non la fonte definitiva della notizia.
  const paroleSlug = ultimo.split(/[-_]+/).filter((w) => w && !/^\d+$/.test(w));
  if (TESTE_CONTENITORE.has(paroleSlug[0] ?? '') && paroleSlug.length >= 2) {
    return { ok: false, motivo: `elenco/indice ("${ultimo}")` };
  }

  // 5) Slug "istituzionale puro" (solo parole neutre/anno, senza alcun termine
  //    identificativo): è un elenco/sezione (es. "elenco-interpelli-2026"), non
  //    un documento specifico.
  const parole = paroleSlug;
  if (parole.length > 0 && parole.every((w) => PAROLE_NEUTRE.has(w))) {
    return { ok: false, motivo: `elenco/sezione senza riferimento specifico ("${ultimo}")` };
  }

  return { ok: true };
}

/**
 * LINK VIETATI presenti in un frammento HTML: garantisce che l'articolo
 * pubblicato non contenga MAI collegamenti a contenitori/indici (solo al
 * documento specifico o a pagine interne di ScuoleRadar).
 */
export function linkVietatiInHtml(html: string): string[] {
  const fuori: string[] = [];
  for (const m of (html ?? '').matchAll(/href="([^"]+)"/gi)) {
    const href = (m[1] ?? '').trim();
    if (!/^https?:/i.test(href)) continue;
    if (/scuoleradar\.it/i.test(href)) continue; // link interni all'app
    const esito = linkDirettoUfficiale(href);
    if (!esito.ok) fuori.push(`${href} (${esito.motivo})`);
  }
  return fuori;
}

/* ------------------- Classificazione del link della fonte ------------------- */

export type ClasseLink = 'diretto' | 'contenitore' | 'non-valido';

export interface ValutazioneLink {
  classe: ClasseLink;
  motivo?: string;
}

/**
 * Classifica il link di una fonte in tre classi:
 *   · `diretto`     → documento/pagina specifica (la fonte ideale);
 *   · `contenitore` → pagina REALE ma generica (indice, elenco, sezione, home):
 *                     pubblicabile come ultima traccia, mai ideale;
 *   · `non-valido`  → mockup, login, URL malformato/non http: MAI pubblicabile.
 *
 * Regola editoriale: solo `non-valido` blocca la pubblicazione. Un contenitore
 * NON blocca la notizia: si pubblica con il link disponibile e si segnala che
 * la fonte è una pagina di elenco (vedi `etichettaLinkFonte`).
 */
export function classificaLink(url?: string | null): ValutazioneLink {
  const u = (url ?? '').trim();
  if (!u) return { classe: 'non-valido', motivo: 'link mancante' };

  // Blocco HARD: URL malformato/non http, segnaposto/mockup, pagine di accesso.
  // Tutto il resto è una pagina REALE: se non è un documento specifico è un
  // contenitore, quindi una traccia pubblicabile (mai un motivo per scartare).
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return { classe: 'non-valido', motivo: 'URL non valido' };
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return { classe: 'non-valido', motivo: 'Solo URL HTTP(S)' };
  }
  const indizi = `${parsed.hostname}${parsed.pathname}${parsed.search}`.toLowerCase();
  if (SEGNALI_MOCKUP.some((m) => indizi.includes(m))) {
    return { classe: 'non-valido', motivo: 'URL segnaposto/mockup non consentito' };
  }
  if (SEGNALI_LOGIN.some((s) => parsed.pathname.toLowerCase().includes(s))) {
    return { classe: 'non-valido', motivo: 'Pagina di login/area riservata' };
  }

  const esito = linkDirettoUfficiale(u);
  if (esito.ok) return { classe: 'diretto' };
  return { classe: 'contenitore', motivo: esito.motivo };
}

/**
 * Etichetta ONESTA del link pubblicato: descrive ciò che l'utente troverà
 * (documento specifico oppure pagina/elenco ufficiale), senza mai promettere
 * una candidatura diretta.
 */
export function etichettaLinkFonte(url?: string | null): string {
  const u = (url ?? '').trim();
  if (èLinkPdf(u)) return 'apri il documento ufficiale (PDF)';
  return classificaLink(u).classe === 'contenitore'
    ? 'apri la pagina ufficiale della fonte'
    : "apri l'avviso ufficiale";
}

/**
 * Link NON VALIDI (mockup, login, non http) presenti in un frammento HTML:
 * solo questi bloccano la pubblicazione. I link a pagine-contenitore reali sono
 * ammessi (con warning) perché restano una traccia verificabile della fonte.
 */
export function linkNonValidiInHtml(html: string): string[] {
  const fuori: string[] = [];
  for (const m of (html ?? '').matchAll(/href="([^"]+)"/gi)) {
    const href = (m[1] ?? '').trim();
    if (!/^https?:/i.test(href)) continue;
    if (/scuoleradar\.it/i.test(href)) continue;
    const valutazione = classificaLink(href);
    if (valutazione.classe === 'non-valido') fuori.push(`${href} (${valutazione.motivo})`);
  }
  return fuori;
}

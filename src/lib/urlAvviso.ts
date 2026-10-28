/**
 * ScuoleRadar.it — «UN AVVISO SI APRE SU UN AVVISO»: pagina INDICE/LANDING o URL specifico?
 *
 * Direttiva cliente 27/10/2026. I portali aggregati degli Uffici Scolastici
 * (USP Arezzo, USR Puglia/Bari, USP Livorno, ATP Cagliari, USR Friuli-Venezia
 * Giulia) pubblicano gli interpelli come POST di una SEZIONE:
 *
 *   https://www.arezzoistruzione.it/usparezzo/index.php/interpelli
 *   http://www.pugliausr.gov.it/index.php/docenti/reclutamento
 *   https://www.mim.gov.it/web/cagliari
 *   https://usrfvg.gov.it/it/home/menu/uffici/ufficio-territoriale-di-trieste/Interpelli/
 *
 * Quella pagina NON è un avviso: è l'elenco che CONTIENE gli avvisi. Pubblicarla
 * in bacheca come se fosse un bando produce tre difetti che il cliente ha
 * segnalato come bloccanti:
 *   1. una riga che non scade (la sezione non ha mai una scadenza) resta in
 *      vetrina come «Scadenza n/d» — un segnaposto;
 *   2. il click apre una lista, non il testo dell'opportunità, quindi la riga
 *      non è verificabile;
 *   3. la stessa sezione genera una riga per ogni scansione, gonfiando il conto
 *      degli «avvisi attivi» con lo stesso indirizzo.
 *
 * La regola vive QUI, in un modulo PURO e senza dipendenze, perché serve a due
 * consumatori che non possono divergere:
 *   · il tabellone pubblico — `departments/radar/flightBoard/linkFonte.ts`
 *     (una riga che aprirebbe un indice non entra in vetrina);
 *   · l'ingestione — `scraper/index.ts` (una pagina indice si ESPANDE nei suoi
 *     post/allegati e non viene mai salvata come avviso).
 *
 * Il riconoscimento è STRUTTURALE, non una lista di siti: segmento finale di
 * sezione, cartelle di indice (`index.php`), paginazione, archivi per data,
 * parametri di ricerca/categoria. Il criterio è asimmetrico di proposito:
 * dichiara «indice» solo ciò che è riconoscibile con certezza, perché un falso
 * positivo toglierebbe dalla bacheca un avviso vero (danno peggiore di un
 * falso negativo). Le prove stanno in `src/lib/__tests__/urlAvviso.test.ts`
 * sui cinque portali reali.
 */

/** Estensioni di un DOCUMENTO: il bando vive nel file, non nella pagina indice. */
const RE_DOCUMENTO = /\.(?:pdf|docx?|odt|rtf|xlsx?|ods|csv|zip|rar|p7m|txt|jpe?g|png)(?:$|[?#])/i;

/** Ultimi segmenti che sono la HOME o l'INDICE di una cartella. */
const SEGMENTI_HOME: ReadonlySet<string> = new Set([
  'index',
  'index.php',
  'index.php3',
  'index.html',
  'index.htm',
  'index.asp',
  'index.aspx',
  'index.jsp',
  'home',
  'default',
  'default.asp',
  'default.aspx',
]);

/**
 * Parole che descrivono una SEZIONE (un elenco di avvisi) e non un avviso.
 * Uno slug composto SOLO da queste parole (e dai connettivi) è una sezione:
 * `/interpelli/`, `/avvisi-pubblici/`, `/docenti/reclutamento/`,
 * `/interpelli-docenti-e-personale-educativo/`.
 */
const PAROLE_SEZIONE: ReadonlySet<string> = new Set([
  'avvisi', 'avviso', 'pubblici', 'pubblico', 'pubblicazioni', 'pubblicazione',
  'interpelli', 'interpello', 'bandi', 'bando', 'concorsi', 'concorso', 'gare', 'gara',
  'graduatorie', 'graduatoria', 'elenchi', 'elenco', 'indici', 'indice',
  'liste', 'lista', 'albi', 'albo', 'pretorio', 'circolari', 'circolare',
  'comunicazioni', 'comunicazione', 'notizie', 'notizia', 'news',
  'archivio', 'archivi', 'categorie', 'categoria', 'argomenti', 'argomento',
  'temi', 'tema', 'tags', 'tag', 'ricerca', 'reclutamento', 'supplenze', 'supplenza',
  'assunzioni', 'assunzione', 'mobilita', 'mobilità', 'personale', 'docenti', 'docente',
  'ata', 'educatori', 'educatore', 'educativo', 'educativa',
  'uffici', 'ufficio', 'servizi', 'servizio', 'aree', 'area', 'sezioni', 'sezione',
  'amministrazione', 'trasparente', 'trasparenza', 'documenti', 'documento',
  'modulistica', 'scadenze', 'scadenza', 'menu', 'home',
]);

/** Connettivi ammessi dentro uno slug di sezione (`interpelli-e-supplenze`). */
const CONNETTIVI: ReadonlySet<string> = new Set([
  'e', 'ed', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle',
  'per', 'a', 'al', 'allo', 'ai', 'agli', 'alla', 'alle',
  'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una',
  'in', 'su', 'con', 'da', 'dal', 'tra', 'fra', 'and', 'of', 'the',
]);

/** Parametri di query che identificano un CONTENUTO specifico (un id). */
const PARAMETRI_CONTENUTO: readonly string[] = [
  'id', 'p', 'post', 'post_id', 'news', 'news_id', 'article', 'articleid', 'art_id',
  'doc', 'doc_id', 'documento', 'file', 'allegato', 'content', 'item', 'notice',
  'avviso', 'pid', 'nid', 'page_id',
];

/**
 * Parametri di query che identificano un ELENCO: ricerca, categoria, tag,
 * paginazione, filtro. `view`/`option` sono la forma Joomla.
 */
const PARAMETRI_ELENCO: readonly string[] = [
  's', 'q', 'search', 'cerca', 'cat', 'tag', 'category', 'paged', 'page', 'feed',
  'author', 'm', 'sezione', 'section', 'filtro', 'filter', 'tipo', 'anno', 'mese',
  'archivio', 'archive', 'layout', 'start', 'offset', 'sort',
];

/** Chiave che, con valore numerico, è un identificatore di contenuto (`tx_news_pi1[news]=123`). */
const RE_CHIAVE_ID =
  /(?:^|[[_])(?:id|pid|nid|news|post|art|article|doc|file|allegato|notice|avviso|content)(?:[\]]|_|$)/i;

/** Paginazione nel percorso (`/page/2`, `/pagina/3`). */
const RE_PAGINAZIONE = /(?:^|\/)(?:page|pagina|paged|seite)\/\d+(?:\/|$)/i;

/** Articolo WordPress: `/2026/10/23/slug` (la data identifica il POST, non l'archivio). */
const RE_ARTICOLO_DATA = /\/\d{4}\/\d{1,2}(?:\/\d{1,2})?\/[^/]+\/?$/;

/** Archivio per data (`/2026/`, `/2026/10/`, `/2026/10/23/`): un elenco. */
const RE_ARCHIVIO_DATA = /\/\d{4}(?:\/\d{1,2}){0,2}\/?$/;

/** Segmenti del percorso, minuscoli e decodificati (mai un'eccezione). */
function segmentiDi(pathname: string): string[] {
  return pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).toLowerCase();
      } catch {
        return s.toLowerCase();
      }
    });
}

/** True se un parametro di query è un id (`id=12`, `tx_news_pi1[news]=7`). */
function parametriDiContenuto(params: URLSearchParams): boolean {
  for (const [chiave, valore] of params) {
    const k = chiave.toLowerCase();
    if (PARAMETRI_CONTENUTO.includes(k)) return true;
    // `view=article` / `view=item`: la forma Joomla di un contenuto singolo.
    if (k === 'view' && /^(?:article|item|single)$/i.test(valore.trim())) return true;
    if (RE_CHIAVE_ID.test(k) && /^\d+$/.test(valore.trim())) return true;
  }
  return false;
}

/** True se un parametro di query dichiara un elenco (`?s=…`, `?page=2`, `?view=category`). */
function parametriDiElenco(params: URLSearchParams): boolean {
  for (const [chiave, valore] of params) {
    const k = chiave.toLowerCase();
    if (k === 'view') return !/^(?:article|item|single)$/i.test(valore.trim());
    if (PARAMETRI_ELENCO.includes(k)) return true;
  }
  return false;
}

/**
 * True se l'ultimo segmento è un nome di SEZIONE e non di contenuto: solo
 * parole di sezione (più i connettivi), nessuna cifra, non uno slug lungo (uno
 * slug lungo è un titolo, quindi un contenuto).
 */
function eSegmentoSezione(segmento: string): boolean {
  const base = segmento.replace(/\.[a-z0-9]{1,5}$/i, '');
  const parole = base.split(/[-_+]+/).filter(Boolean);
  if (parole.length === 0 || parole.length > 6) return false;
  const sezione = parole.filter((p) => !CONNETTIVI.has(p));
  if (sezione.length === 0) return false;
  // Una cifra (id, protocollo, anno, classe A-022) identifica un contenuto.
  if (sezione.some((p) => /\d/.test(p))) return false;
  return sezione.every((p) => PAROLE_SEZIONE.has(p));
}

/**
 * True se l'URL è una pagina INDICE/LANDING — la sezione «Interpelli» di un
 * ente, la home di un sito, un archivio, una ricerca, una cartella di indice —
 * e NON la pagina (o il PDF) di un avviso specifico.
 *
 * Restituisce `false` anche per tutto ciò che non sa leggere (stringa vuota,
 * protocollo non http(s), URL non valido): non lancia mai e non dichiara
 * «indice» per un URL che non sa interpretare.
 */
export function eUrlIndicePortale(url?: string | null): boolean {
  const testo = (url ?? '').trim();
  if (!/^https?:\/\//i.test(testo)) return false;

  let pagina: URL;
  try {
    pagina = new URL(testo);
  } catch {
    return false;
  }

  const percorso = pagina.pathname;
  const query = pagina.search;

  // 1. Un DOCUMENTO è sempre specifico: il bando vive nel PDF/DOCX allegato.
  if (RE_DOCUMENTO.test(percorso) || RE_DOCUMENTO.test(query)) return false;

  // 2. Slug di ARTICOLO già riconosciuti altrove: Liferay (`/web/<ente>/-/<slug>`)
  //    e WordPress con data nel percorso. L'archivio di sola data resta un elenco.
  if (percorso.includes('/-/')) return false;
  if (RE_ARTICOLO_DATA.test(percorso)) return false;
  if (RE_ARCHIVIO_DATA.test(percorso)) return true;

  // 3. QUERY: prima l'id (contenuto), poi i filtri (elenco).
  if (parametriDiContenuto(pagina.searchParams)) return false;
  if (parametriDiElenco(pagina.searchParams)) return true;

  // 4. PERCORSO.
  const segmenti = segmentiDi(percorso);
  if (segmenti.length === 0) return true; // radice del dominio
  if (RE_PAGINAZIONE.test(percorso)) return true;

  const ultimo = segmenti[segmenti.length - 1];
  if (SEGMENTI_HOME.has(ultimo)) return true;

  // 5. e-portfolio MIM: `/web/<territorio>` è la sezione dell'ufficio.
  if (segmenti[0] === 'web' && segmenti.length === 2) return true;

  // 6. Una sola parola senza cifre né trattini: la radice di un sottosito
  //    (`/usparezzo`, `/usp_livorno`, `/didattica`) — una sezione, non un avviso.
  //    Un avviso ha sempre un id o una data, quindi una cifra.
  if (segmenti.length === 1 && !/\d/.test(ultimo) && !ultimo.includes('-')) return true;

  // 7. Segmento finale di sezione (con connettivi: `interpelli-e-supplenze`).
  return eSegmentoSezione(ultimo);
}

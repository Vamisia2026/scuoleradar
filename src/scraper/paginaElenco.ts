/**
 * ScuoleRadar.it — RICONOSCIMENTO DELLA PAGINA-ELENCO — Node-only, puro.
 *
 * Modulo estratto da `elenchi.ts` (§26.72, 16/10/2026) per rispettare le soglie
 * dimensionali per file: risponde a una sola domanda — «questa pagina è un
 * ELENCO di avvisi (indice/albo) o un avviso singolo?».
 *
 * L'euristica è doppia:
 *   • sul PERCORSO (`/avvisi/`, `/elenco-...`, `?sezione=bandi`), via `eUrlElenco`;
 *   • sul TITOLO («Elenco interpelli», «Avvisi pubblicati»), via `sembraTitoloElenco`.
 * La terza domanda — «questo link punta alla HOME/indice del sito?» — è risolta
 * da `eUrlHome`: serve a scartare i link di TESTATA (logo e titolo del sito).
 * La soglia di sicurezza (quante voci servono perché una pagina sia un indice)
 * resta in `elenchi.ts`, dove si contano le voci: qui solo i due indizi testuali.
 */

/** Percorsi tipici di una pagina INDICE/ELENCO. */
const RE_PATH_ELENCO =
  /(elenco|elenchi|indice|lista|liste|avvisi|interpelli|bandi|graduator|albo|pubblicazion|circolari|comunicazioni|scadenze|notizie)/i;

/** Titoli tipici di una pagina INDICE. */
const RE_TITOLO_ELENCO = /(elenco|elenchi|indice|lista|tutti gli|avvisi pubblicati|graduatorie|scadenze)/i;

/** True se l'URL "sembra" una pagina indice/elenco (euristica sul percorso). */
export function eUrlElenco(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    return RE_PATH_ELENCO.test(`${p.pathname}${p.search}`);
  } catch {
    return false;
  }
}

/** True se il titolo dichiara un elenco ("Elenco interpelli…", "Indice avvisi"). */
export function sembraTitoloElenco(titolo?: string | null): boolean {
  return RE_TITOLO_ELENCO.test((titolo ?? '').toLowerCase());
}

/** Data nell'URL di un articolo WordPress: `/2026/10/23/slug` oppure `/2026/10/slug`. */
const RE_DATA_IN_URL = /\/\d{4}\/\d{1,2}(?:\/\d{1,2})?\//;

/** Identificatore di post nella query (`?p=1234`, `?post_id=99`): non è paginazione. */
const RE_ID_POST = /[?&](?:p|post_id)=\d+/i;

/**
 * True se l'URL è con altissima probabilità la pagina di UN articolo (foglia) e
 * non l'indice di una sezione. Solo segnali STRUTTURALI, nessuna euristica sul
 * titolo, quindi le sezioni degli enti non vengono mai scambiate per articoli:
 *   · data nell'URL (WordPress: `/2026/10/23/…`);
 *   · segnaposto Liferay del MIM (`/web/<territorio>/-/<slug>`);
 *   · identificatore di post (`?p=123`).
 *
 * Due usi, entrambi sui lati opposti dello stesso errore:
 *   · `espandiElenchi` (`index.ts`) NON ri-espande un articolo: i «leggi anche»
 *     di un post non sono gli avvisi del post;
 *   · `scopriSezioniReclutamento` (`hub.ts`) NON segue un articolo come sezione:
 *     l'e-portfolio MIM linka i propri avvisi con slug «interpelli-…», che
 *     sembrano sezioni ma sono POST (verificato il 23/10/2026 su `/web/milano`,
 *     `/web/bergamo`: le 3 sezioni scoperte erano 3 articoli).
 */
export function eUrlArticolo(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  let p: URL;
  try {
    p = new URL(u);
  } catch {
    return false;
  }
  return p.pathname.includes('/-/') || RE_DATA_IN_URL.test(p.pathname) || RE_ID_POST.test(p.search);
}

/** File di INDICE: la radice di una cartella, non la pagina di un avviso. */
const RE_FILE_INDICE = /\/index\.(?:php\d?|html?|asp|aspx|jsp|shtml)$/i;

/**
 * True se l'URL è la HOME (o l'indice di una sezione) di un sito: radice del
 * dominio oppure file di indice (`index.php`) SENZA query né frammento.
 *
 * Serve a scartare i link di TESTATA — logo e titolo del sito, che riportano
 * sempre alla home. Molti portali NON usano `<header>`/`<nav>`: la testata è un
 * semplice `<div class="site-…">` e il suo link finiva nella raccolta degli
 * avvisi (USR Liguria, `provincia.php`: «Interpelli docenti Ambito di Genova» →
 * `index.php`). La home dell'ente non è mai un avviso, coerentemente con
 * `eUrlAvvisoDiretto` (che la esclude dai link di fonte).
 *
 * Una home CON query (`index.php?id=1234`) NON è "indice": identifica una pagina
 * specifica e resta un candidato valido.
 */
export function eUrlHome(url?: string | null): boolean {
  const u = (url ?? '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    if (p.search || p.hash) return false;
    const percorso = p.pathname.replace(/\/+$/, '');
    return percorso === '' || RE_FILE_INDICE.test(percorso);
  } catch {
    return false;
  }
}

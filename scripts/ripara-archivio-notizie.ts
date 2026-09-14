/**
 * ScuoleRadar.it — Manutenzione ARCHIVIO Notizie.
 *
 * Rigenera il copy di ogni articolo con le regole editoriali CORRENTI (taglio
 * azione + UN SOLO link diretto al documento) e rimuove le voci che non le
 * rispettano, senza buttare via la cronaca già pubblicata. Serve quando
 * cambiano le regole di copy/link: l'ingestione, da sola, non riscrive il copy
 * storico.
 *
 * Uso:
 *   npm run notizie:ripara-archivio            # ripara (git HEAD + archivio corrente)
 *   npm run notizie:ripara-archivio -- --dry    # mostra l'esito senza scrivere
 */

import { execSync } from 'node:child_process';
import process from 'node:process';
import type { NewsArticle } from '../src/departments/notizie/types.ts';
import {
  estraiArticoliDaTesto,
  FILE_ARCHIVIO_NOTIZIE,
  leggiArchivioNotizie,
  scriviArchivioNotizie,
} from '../src/departments/notizie/services/archivioNotizie.ts';
import {
  articoloValido,
  generaArticoloEditoriale,
  linkDirettoUfficiale,
  valutaRilevanza,
} from '../src/departments/notizie/services/relevanceEngine.ts';

const PERCORSO_ARCHIVIO = 'src/departments/notizie/data/notizieIngestite.ts';
const dry = process.argv.includes('--dry');

/** Legge una versione dell'archivio da git (es. "HEAD"), senza eseguirla. */
function daGit(revisione: string): NewsArticle[] {
  try {
    const testo = execSync(`git show ${revisione}:${PERCORSO_ARCHIVIO}`, { encoding: 'utf8' });
    return estraiArticoliDaTesto(testo);
  } catch {
    return [];
  }
}

/** Etichetta della fonte ufficiale mostrata nel copy. */
function fonteDi(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith('mim.gov.it')) return 'MIM';
    if (host.endsWith('gazzettaufficiale.it')) return 'Gazzetta Ufficiale';
    if (host.endsWith('aranagenzia.it')) return 'ARAN';
    return host.replace(/^www\./, '');
  } catch {
    return 'fonte ufficiale';
  }
}

const storici = daGit('HEAD');
const correnti = leggiArchivioNotizie();

// Fonde storico + corrente (la versione corrente vince: copy già rigenerata).
const perId = new Map<string, NewsArticle>();
for (const a of [...storici, ...correnti]) perId.set(a.id, a);

const riparati: NewsArticle[] = [];
const scartati: { id: string; motivo: string }[] = [];

for (const a of perId.values()) {
  const { content_html, summary_points } = generaArticoloEditoriale({
    title: a.title,
    categoria: a.category,
    deadline: a.deadline_date,
    fonte: fonteDi(a.official_source_url),
    official_url: a.official_source_url,
  });
  const candidato: NewsArticle = { ...a, content_html, summary_points };

  const diretto = linkDirettoUfficiale(candidato.official_source_url);
  if (!diretto.ok) {
    scartati.push({ id: candidato.id, motivo: `link non puntuale — ${diretto.motivo}` });
    continue;
  }
  if (!articoloValido(candidato)) {
    scartati.push({ id: candidato.id, motivo: 'non supera il gate editoriale (link/testo)' });
    continue;
  }
  if (!valutaRilevanza({ title: candidato.title, url: candidato.official_source_url }).rilevante) {
    scartati.push({ id: candidato.id, motivo: 'non più rilevante per relevanceEngine' });
    continue;
  }
  riparati.push(candidato);
}

riparati.sort((x, y) => Date.parse(y.published_at) - Date.parse(x.published_at));

console.log(`— ARCHIVIO NOTIZIE: ${perId.size} voci esaminate —`);
console.log(`  · pubblicabili (copy rigenerata): ${riparati.length}`);
for (const a of riparati) {
  console.log(`  ✓ ${a.published_at.slice(0, 10)} [${a.category}] ${a.title.slice(0, 70)}`);
}
if (scartati.length > 0) {
  console.log(`  · rimosse: ${scartati.length}`);
  for (const s of scartati) console.log(`  ✗ ${s.id.slice(0, 62)} — ${s.motivo}`);
}

if (dry) {
  console.log('(dry-run: nessuna scrittura)');
} else {
  scriviArchivioNotizie(riparati);
  console.log(`✓ Scritti ${riparati.length} articoli in ${FILE_ARCHIVIO_NOTIZIE}`);
}

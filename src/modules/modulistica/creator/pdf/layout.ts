/**
 * Modulistica · layout e stima pagine del documento stampabile.
 *
 * Estratto da `pdfGenerator.ts`: classificazione rigida compatto/esteso
 * (Regola d'oro 1), stima delle pagine A4 (parole + sezioni, con il minimo
 * garantito dai marcatori `data-min-pagine`) e indice automatico per i
 * documenti > 3 pagine.
 */
import { escapeHtml } from './testo';

/**
 * Regola d'oro 1 — Algoritmo di densità dinamica:
 * pesa il modulo contando le sezioni <h2> e decide il layout.
 *  - meno di 6 sezioni → `layout-compatto` (DEVE stare in 1 pagina A4);
 *  - 6 o più sezioni (PEI, PDP, Ricorsi complessi) → `layout-esteso` (2 pagine omogenee).
 *
 * Classificazione RIGIDA: se il corpo contiene un marcatore
 * `data-layout="compatto|esteso"` (documenti pedagogici/inclusivi forzati a
 * esteso, moduli rapidi forzati a compatto), questo ha precedenza sull'euristica.
 */
export function calcolaLayout(contenutoHtml: string): 'compatto' | 'esteso' {
  const richiesto = contenutoHtml.match(/data-layout="(compatto|esteso)"/)?.[1];
  if (richiesto === 'compatto' || richiesto === 'esteso') return richiesto;
  const sezioni = (contenutoHtml.match(/<h2[\s>]/gi) ?? []).length;
  return sezioni < 6 ? 'compatto' : 'esteso';
}

/**
 * Stima indicativa delle pagine A4 (layout compatto 10-11pt):
 *  - ~600 parole/pagina
 *  - ~6 sezioni <h2> per pagina (griglie, righe sottili, spazi ridotti)
 * Usata per decidere l'inserimento automatico dell'indice (solo > 3 pagine).
 */
export function stimaPagine(contenutoHtml: string): number {
  const senzaScript = contenutoHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const testo = senzaScript
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const parole = testo ? testo.split(' ').length : 0;
  const pagineDaParole = Math.max(1, Math.ceil(parole / 600));

  const sezioni = (contenutoHtml.match(/<h2[\s>]/gi) ?? []).length;
  const pagineDaSezioni = Math.max(1, Math.ceil(sezioni / 6));

  const stima = Math.max(pagineDaParole, pagineDaSezioni);

  // Classificazione rigida: i documenti estesi (pedagogici/inclusivi, marcati
  // con data-layout="esteso") non possono essere stimati a meno del minimo
  // garantito (data-min-pagine, es. PEI/PDP/relazioni/verbali GLO → 5 pagine).
  const minPagine = Number(contenutoHtml.match(/data-min-pagine="(\d+)"/)?.[1] ?? 0);
  if (minPagine > 0) return Math.max(stima, minPagine);
  return stima;
}

/** Inietta un indice con collegamenti interni alle SOLO macro-sezioni h2
 * (max ~10-15 voci; le sotto-sezioni h3 non compaiono nell'indice). */
export function aggiungiIndice(contenutoHtml: string): string {
  // In ambienti senza DOM (es. test Node/tsx) l'indice viene saltato.
  if (typeof DOMParser === 'undefined') return contenutoHtml;
  const doc = new DOMParser().parseFromString(contenutoHtml, 'text/html');
  const titoli = Array.from(doc.querySelectorAll('h2'));
  if (titoli.length < 3) return contenutoHtml;

  const voci: string[] = [];
  titoli.forEach((h, i) => {
    const testo = (h.textContent ?? '').replace(/\s+/g, ' ').trim() || `Sezione ${i + 1}`;
    h.id = `sezione-${i + 1}`;
    voci.push(`<li><a href="#sezione-${i + 1}">${escapeHtml(testo)}</a></li>`);
  });

  const indice = `<nav class="indice" aria-label="Indice dei contenuti"><h2>Indice dei contenuti</h2><ol>${voci.join('')}</ol></nav>`;
  doc.body.insertAdjacentHTML('afterbegin', indice);
  return doc.body.innerHTML;
}

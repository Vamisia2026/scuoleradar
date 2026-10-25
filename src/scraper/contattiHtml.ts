/**
 * ScuoleRadar.it — lettura del TESTO e dei RECAPITI da una pagina HTML (§26.90).
 *
 * Livello basso dell'arricchimento: nessuna rete, nessuno stato — solo HTML in
 * ingresso e testo/email/link in uscita. Serviva a due arricchitori (scadenze ed
 * email) e per questo vive qui invece che nel monolite `index.ts`: le regole si
 * provano su stringhe finte, senza server.
 *
 * Regola d'oro: i blocchi HTML vanno SEPARATI prima di leggere il testo, altrimenti
 * cheerio incolla parole di tag adiacenti (`…@istruzione.it` + `posta` →
 * `…@istruzione.itposta`, `15/09/2026` + `Scadenza` → `15/09/2026Scadenza`) e sia
 * l'email sia la data diventano illeggibili. Per questo esiste `testoLeggibile`.
 */

import * as cheerio from 'cheerio';
import { deoffuscaEmail, estraiEmails, eSorgenteVerificata, eUrlDocumento } from './parser.ts';

/**
 * Testo della pagina con SEPARATORI tra i blocchi HTML. Senza separatori cheerio
 * incolla le parole di tag adiacenti ("…@istruzione.it" + "posta" →
 * "…@istruzione.itposta", oppure "15/09/2026Scadenza"). Serve per email e scadenze.
 */
export function testoLeggibile(html: string): string {
  const separato = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(?:p|div|li|tr|td|th|h[1-6]|section|article|table|ul|ol|blockquote|span|a)>/gi, ' ');
  return cheerio.load(separato).text().replace(/\s+/g, ' ');
}

/** Email estratte da un HTML: testo della pagina (anche tabelle) + link `mailto:`. */
export function emailDaHtml(html: string): string[] {
  const emails = new Set<string>(estraiEmails(testoLeggibile(html)));
  const $ = cheerio.load(html);
  $('a[href^="mailto:"]').each((_, a) => {
    // De-offusca anche l'href: alcune fonti scrivono `mailto:` con entità HTML.
    const href = (
      deoffuscaEmail($(a).attr('href') ?? '').replace(/^mailto:/i, '').split(/[?;,]/)[0] ?? ''
    )
      .trim()
      .toLowerCase();
    if (href.includes('@')) emails.add(href);
  });
  return [...emails];
}

/** Sottolink documentali della pagina di dettaglio (allegati/circolari/avvisi). */
export function sottolinkCandidati(html: string, baseUrl: string, max = 2): string[] {
  const $ = cheerio.load(html);
  const out = new Set<string>();
  $('a[href]').each((_, a) => {
    const href = ($(a).attr('href') ?? '').trim();
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) return;
    let assoluto: string;
    try {
      assoluto = new URL(href, baseUrl).href;
    } catch {
      return;
    }
    if (!/^https?:\/\//i.test(assoluto)) return;
    if (!eUrlDocumento(assoluto) && !eSorgenteVerificata(assoluto)) return;
    if (
      /(bando|avviso|interpell|supplenz|allegato|circolare|documento|protocollo|convocazione|domanda|graduator)/i.test(
        assoluto,
      )
    ) {
      out.add(assoluto);
    }
  });
  return [...out].slice(0, max);
}

/** True per URL di cui NON possiamo leggere il testo (documenti binari). */
export function eDocumentoBinario(url: string): boolean {
  return /\.(pdf|docx?|odt|xlsx?|pptx?|zip)($|\?)/i.test(url);
}

import { useEffect } from 'react';
import type { NewsArticle } from '../types';

/**
 * ScuoleRadar.it — SEO & Structured Data per il Dipartimento Notizie.
 *
 * Imposta document.title, metatag OpenGraph/Twitter e JSON-LD
 * (NewsArticle per gli articoli, WebPage per le liste) senza dipendere da
 * librerie esterne (react-helmet non è nel progetto).
 * Solo client-side (SPA): i crawler moderni eseguono JS e leggono questi tag.
 */

const NOME_SITO = 'ScuoleRadar.it';
const JSONLD_ID = 'scuoleradar-jsonld-notizie';

interface SeoMetaProps {
  /** Titolo della pagina (senza il suffisso di sito). */
  titolo: string;
  /** Meta description (max ~160 caratteri consigliati). */
  descrizione: string;
  /** 'pagina' per liste/sezioni, 'articolo' per i singoli post. */
  tipo?: 'pagina' | 'articolo';
  /** Articolo da marcare con NewsArticle (obbligatorio se tipo === 'articolo'). */
  articolo?: NewsArticle | null;
  /** URL canonico (percorso, es. /notizie oppure /notizie/:id). */
  urlCanonica?: string;
}

/** Crea (o aggiorna) un <meta name|property="..."> nel <head>. */
function assicuraMeta(
  attributo: 'name' | 'property',
  chiave: string,
  contenuto: string,
): void {
  let el = document.head.querySelector<HTMLMetaElement>(
    `meta[${attributo}="${chiave}"]`,
  );
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attributo, chiave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenuto);
}

/** Inietta un <script type="application/ld+json"> sostituendo il precedente. */
function impostaJsonLd(dato: object): void {
  document.getElementById(JSONLD_ID)?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSONLD_ID;
  script.textContent = JSON.stringify(dato);
  document.head.appendChild(script);
}

/** Costruisce l'URL assoluto per og:url / canonical. */
function urlAssoluta(base: string, urlCanonica?: string): string {
  if (urlCanonica && urlCanonica.startsWith('http')) return urlCanonica;
  const percorso = urlCanonica ?? window.location.pathname;
  return `${base}${percorso.startsWith('/') ? percorso : `/${percorso}`}`;
}

export function SeoMeta({
  titolo,
  descrizione,
  tipo = 'pagina',
  articolo,
  urlCanonica,
}: SeoMetaProps) {
  useEffect(() => {
    const base = window.location.origin;
    const url = urlAssoluta(base, urlCanonica);
    const immagine = `${base}/logo.png`;

    document.title = `${titolo} — ${NOME_SITO}`;

    assicuraMeta('name', 'description', descrizione);
    assicuraMeta('property', 'og:type', tipo === 'articolo' ? 'article' : 'website');
    assicuraMeta('property', 'og:title', titolo);
    assicuraMeta('property', 'og:description', descrizione);
    assicuraMeta('property', 'og:url', url);
    assicuraMeta('property', 'og:site_name', NOME_SITO);
    assicuraMeta('property', 'og:locale', 'it_IT');
    assicuraMeta('property', 'og:image', immagine);
    assicuraMeta('name', 'twitter:card', 'summary');
    assicuraMeta('name', 'twitter:title', titolo);
    assicuraMeta('name', 'twitter:description', descrizione);
    assicuraMeta('name', 'twitter:image', immagine);

    if (tipo === 'articolo' && articolo) {
      impostaJsonLd({
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        headline: articolo.title,
        description: articolo.summary_points[0] ?? descrizione,
        datePublished: articolo.published_at || undefined,
        dateModified: articolo.published_at || undefined,
        articleSection: articolo.category,
        isAccessibleForFree: true,
        image: immagine,
        author: { '@type': 'Organization', name: 'Redazione ScuoleRadar' },
        publisher: {
          '@type': 'Organization',
          name: NOME_SITO,
          url: base,
          logo: { '@type': 'ImageObject', url: immagine },
        },
        url,
      });
    } else {
      impostaJsonLd({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: titolo,
        description: descrizione,
        url,
        isPartOf: { '@type': 'WebSite', name: NOME_SITO, url: base },
      });
    }

    return () => {
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [titolo, descrizione, tipo, articolo, urlCanonica]);

  return null;
}

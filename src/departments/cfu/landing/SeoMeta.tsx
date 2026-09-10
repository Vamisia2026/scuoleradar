import { useEffect } from 'react';

/**
 * ScuoleRadar.it — Dipartimento CFU · SEO meta (landing pubblica).
 * Imposta document.title, OpenGraph/Twitter e JSON-LD (WebPage + FAQPage)
 * senza dipendenze esterne. Client-side SPA: i crawler moderni eseguono JS.
 */

const NOME_SITO = 'ScuoleRadar.it';
const JSONLD_ID = 'scuoleradar-jsonld-cfu';

/** Tipo FAQ usato per la pagina pubblica e per il markup FAQPage (SEO). */
export interface DomandaFaq {
  domanda: string;
  risposta: string;
}

interface SeoMetaProps {
  titolo: string;
  descrizione: string;
  urlCanonica?: string;
  faq?: DomandaFaq[];
}

function assicuraMeta(attributo: 'name' | 'property', chiave: string, contenuto: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attributo}="${chiave}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attributo, chiave);
    document.head.appendChild(el);
  }
  el.setAttribute('content', contenuto);
}

function impostaJsonLd(dato: object): void {
  document.getElementById(JSONLD_ID)?.remove();
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = JSONLD_ID;
  script.textContent = JSON.stringify(dato);
  document.head.appendChild(script);
}

function urlAssoluta(base: string, urlCanonica?: string): string {
  if (urlCanonica && urlCanonica.startsWith('http')) return urlCanonica;
  const percorso = urlCanonica ?? window.location.pathname;
  return `${base}${percorso.startsWith('/') ? percorso : `/${percorso}`}`;
}

export function CfuSeoMeta({ titolo, descrizione, urlCanonica, faq }: SeoMetaProps) {
  useEffect(() => {
    const base = window.location.origin;
    const url = urlAssoluta(base, urlCanonica);
    const immagine = `${base}/logo.png`;
    document.title = `${titolo} — ${NOME_SITO}`;

    assicuraMeta('name', 'description', descrizione);
    assicuraMeta('property', 'og:type', 'website');
    assicuraMeta('property', 'og:title', titolo);
    assicuraMeta('property', 'og:description', descrizione);
    assicuraMeta('property', 'og:url', url);
    assicuraMeta('property', 'og:site_name', NOME_SITO);
    assicuraMeta('property', 'og:locale', 'it_IT');
    assicuraMeta('property', 'og:image', immagine);
    assicuraMeta('name', 'twitter:card', 'summary');
    assicuraMeta('name', 'twitter:title', titolo);
    assicuraMeta('name', 'twitter:description', descrizione);

    const grafo: unknown[] = [
      {
        '@type': 'WebPage',
        name: titolo,
        description: descrizione,
        url,
        isPartOf: { '@type': 'WebSite', name: NOME_SITO, url: base },
      },
    ];
    if (faq && faq.length > 0) {
      grafo.push({
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.domanda,
          acceptedAnswer: { '@type': 'Answer', text: f.risposta },
        })),
      });
    }
    impostaJsonLd({ '@context': 'https://schema.org', '@graph': grafo });

    return () => {
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [titolo, descrizione, urlCanonica, faq]);

  return null;
}

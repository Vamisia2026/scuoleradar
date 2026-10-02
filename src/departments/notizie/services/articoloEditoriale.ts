/**
 * ScuoleRadar.it — Dipartimento Notizie · Composizione dell’articolo.
 *
 * Trasforma i dati reali della fonte in un articolo di 3 paragrafi fluidi con UN
 * solo link (quello diretto al documento ufficiale) più, quando la notizia è una
 * procedura da presentare, il link al canale di domanda. Gli acronimi si
 * spiegano alla prima menzione (`editorialVoice.ts`), la voce è centralizzata.
 */

import { ARTICOLO, IMPATTO_COPY } from './articoloCopy';
import { espandiAcronimi } from './editorialVoice';
import { classificaLink, etichettaLinkFonte } from './linkUfficiale';

/* --------------------- Generazione articoli editoriali --------------------- */

export interface DatiArticoloEditoriale {
  title: string;
  categoria: string | null;
  deadline: string | null;
  fonte: string;
  descrizione?: string;
  /** URL ufficiale della fonte (per il link contestuale nel testo). */
  official_url?: string | null;
  /** Link diretto al canale di presentazione della domanda (Istanze Online, POLIS…). */
  application_url?: string | null;
  /** Etichetta del canale di presentazione ("Istanze Online (POLIS)"…). */
  application_label?: string | null;
}

/**
 * CANALI DI PRESENTAZIONE ufficiali: quando la notizia riguarda una domanda, una
 * istanza o una candidatura, il link diretto al canale va SEMPRE pubblicato
 * accanto a quello della fonte (regola "zero fluff": niente rinvii vaghi).
 */
const CANALI_DOMANDA: Array<{ re: RegExp; url: string; etichetta: string }> = [
  {
    re: /istanze\s*online|polis/i,
    url: 'https://www.istruzione.it/polis/Istanzeonline.htm',
    etichetta: 'Istanze Online (POLIS)',
  },
  {
    re: /\bunica\b|unic[aà]\s*istruzione/i,
    url: 'https://unica.istruzione.gov.it/',
    etichetta: 'Unica, il portale del Ministero',
  },
  {
    re: /\binpa\b/i,
    url: 'https://www.inpa.gov.it/',
    etichetta: 'InPA, il portale del reclutamento pubblico',
  },
  {
    re: /\binps\b/i,
    url: 'https://www.inps.it/',
    etichetta: 'INPS',
  },
  {
    re: /pnrr\s*istruzione|futura/i,
    url: 'https://pnrr.istruzione.it/',
    etichetta: 'PNRR Istruzione',
  },
];

/** Canale di presentazione citato nel testo (link diretto + etichetta onesta). */
export function linkDomandaUfficiale(
  testo: string,
): { url: string; etichetta: string } | null {
  const t = (testo ?? '').replace(/\s+/g, ' ');
  for (const canale of CANALI_DOMANDA) {
    if (canale.re.test(t)) return { url: canale.url, etichetta: canale.etichetta };
  }
  return null;
}

/**
 * Vero se il testo annuncia una PROCEDURA DA PRESENTARE (domanda, istanza,
 * candidatura, iscrizione): in quel caso la pubblicazione richiede il link
 * diretto al canale di presentazione, altrimenti l'avviso è incompleto.
 */
export function richiedePresentazioneDomanda(testo: string): boolean {
  return /(?:presentazione\s+delle\s+domande|presenta(?:re)?\s+(?:la\s+|le\s+)?(?:domanda|istanza|candidatura)|domanda\s+online|istanz[ae]\s+online|invio\s+della\s+domanda|candidatur[ae]|messa\s+a\s+disposizione|iscrizion[ei]\s+(?:al|alla|ai|online))/i.test(
    testo ?? '',
  );
}

function escapeHtmlEditoriale(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formattaDataItaliana(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Genera un articolo giornalistico naturale in 3 paragrafi fluidi, basato solo
 * sui dati reali della fonte. Nessun cliché da chatbot e nessuna sezione in
 * <h2>: si racconta il fatto, chi è coinvolto e come agire, con il link
 * contestuale alla procedura ufficiale.
 */
/** Etichetta ONESTA per il link della fonte (vedi `etichettaLinkFonte`). */
function etichettaLinkDiretto(url: string): string {
  return etichettaLinkFonte(url);
}

/**
 * Genera un articolo giornalistico naturale in 3 paragrafi fluidi, basato solo
 * sui dati reali della fonte. Taglio da cronaca utile: 1) che cosa cambia, 2)
 * perché conta per te, 3) che cosa fare — con UN SOLO link, quello diretto al
 * documento ufficiale.
 */
export function generaArticoloEditoriale(
  d: DatiArticoloEditoriale,
): { content_html: string; summary_points: string[] } {
  const cat = d.categoria ?? 'Scuole';
  const override = IMPATTO_COPY.find((o) => o.re.test(d.title));
  const a = override?.copy ?? ARTICOLO[cat] ?? ARTICOLO['Scuole'];
  const scadenza = d.deadline ? formattaDataItaliana(d.deadline) : null;

  // ACRONIMI: spiegati alla PRIMA occorrenza nell'articolo (titolo → sintesi →
  // corpo). La sigla già espansa non viene ripetuta nei passaggi successivi.
  const spiegati = new Set<string>();
  const titoloAcr = espandiAcronimi(d.title, spiegati).testo;
  const fattoAcr = espandiAcronimi(a.fatto, spiegati).testo;
  const chiAcr = espandiAcronimi(a.chi, spiegati).testo;
  const praticaAcr = espandiAcronimi(a.pratica, spiegati).testo;
  // Il "vai a controllare" generico è rumore: le indicazioni operative devono
  // portare a un link diretto, non a un rinvio. Si rimuovono le code vaghe del
  // copy di categoria prima di comporre il terzo paragrafo.
  const pulisciRinvio = (testo: string): string =>
    testo
      .replace(
        /\s*(?:Il testo completo è quello ufficiale|Le informazioni complete sono consultabili|I dettagli completi sono nel testo ufficiale)[^.]*\./gi,
        '',
      )
      .replace(
        /\s*(?:controlla|verifica|consulta)\s+(?:nel|il|sul)\s+(?:testo|sito|documento)\s+ufficiale[^.]*\./gi,
        '',
      )
      // Qualunque frase che rinvia al "testo ufficiale" è un rinvio vago: si
      // toglie del tutto (il link diretto sta già nel paragrafo).
      .replace(/\s*[^.]*?\b(?:nel|sul)\s+(?:testo|sito|documento)\s+ufficiale\b[^.]*\./gi, '')
      .trim();
  const comeBase = espandiAcronimi(a.come, spiegati).testo;
  const comePulito = pulisciRinvio(comeBase);
  // Se la sanificazione svuota le indicazioni (la frase era SOLO un rinvio), si
  // usa un default operativo: niente "leggi tutto", solo il fatto + il link.
  const comeAcr =
    comePulito.length >= 30
      ? comePulito
      : 'Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto.';

  // LINK DELLA FONTE: si usa SEMPRE la traccia disponibile (documento specifico
  // quando tracciato, altrimenti la pagina ufficiale/elenco). Non si pubblica
  // mai un link non valido (mockup/login), ma non si lascia MAI la notizia senza
  // fonte: una notizia vera non viene soppressa per un link poco profondo.
  const link = (d.official_url ?? '').trim();
  const classeLink = classificaLink(link);
  const hrefDiretto = classeLink.classe === 'non-valido' ? '' : link;
  const anchor = (testo: string): string =>
    hrefDiretto
      ? `<a href="${escapeHtmlEditoriale(hrefDiretto)}" target="_blank" rel="noopener noreferrer">${escapeHtmlEditoriale(testo)}</a>`
      : escapeHtmlEditoriale(testo);

  // CANALE DI PRESENTAZIONE: quando la notizia riguarda una domanda, il link
  // diretto va pubblicato INSIEME a quello della fonte (niente rinvii vaghi del
  // tipo "verifica nel testo ufficiale"). Se coincide con la fonte, non si duplica.
  const etichettaDomanda = d.application_label ?? 'il canale ufficiale di presentazione';
  const hrefDomanda =
    d.application_url && d.application_url !== hrefDiretto ? d.application_url : '';
  const anchorDomanda = (testo: string): string =>
    hrefDomanda
      ? `<a href="${escapeHtmlEditoriale(hrefDomanda)}" target="_blank" rel="noopener noreferrer">${escapeHtmlEditoriale(testo)}</a>`
      : escapeHtmlEditoriale(testo);

  // 1) Che cosa cambia, subito: la frase contiene SEMPRE un'informazione completa
  // (scadenza oppure canale di presentazione) e MAI una promessa di aggiornamento.
  const scadenzaMs = d.deadline ? new Date(d.deadline).getTime() : Number.NaN;
  const scadenzaPassata = !Number.isNaN(scadenzaMs) && scadenzaMs < Date.now();
  const par1 = `${fattoAcr} \u00ab${escapeHtmlEditoriale(titoloAcr)}\u00bb. ${
    scadenza && !scadenzaPassata
      ? `Hai tempo fino al ${scadenza}: non rimandare all'ultimo giorno.`
      : scadenzaPassata
        ? hrefDomanda
          ? `Il termine dell'avviso era il ${scadenza}; la procedura si presenta da ${anchorDomanda(etichettaDomanda)}.`
          : `Il termine indicato nell'avviso era il ${scadenza}.`
        : hrefDomanda
          ? `La procedura è attiva: si presenta da ${anchorDomanda(etichettaDomanda)}.`
          : `Cosa cambia in pratica e a chi serve è spiegato qui sopra; nel ${anchor('documento ufficiale')} trovi condizioni, requisiti e decorrenza.`
  }`;

  // 2) Perché conta (a chi serve, che cosa rischia).
  const par2 = `Riguarda ${chiAcr}. ${praticaAcr}`;

  // 3) Che cosa fare: canale di presentazione (se la procedura è da presentare) e
  // fonte ufficiale — entrambi come link diretti.
  const par3 = `${comeAcr}${
    hrefDomanda ? ` Presenta la domanda da ${anchorDomanda(etichettaDomanda)}.` : ''
  }${hrefDiretto ? ` Fonte ufficiale: ${anchor(etichettaLinkDiretto(hrefDiretto))}.` : ''}`;

  const content_html = `<p>${par1}</p>\n    <p>${par2}</p>\n    <p>${par3}</p>`;

  // "IN SINTESI": SOLO fatti diretti — che cosa cambia, chi è coinvolto, entro
  // quando, che cosa fare e da dove si presenta. Nessun preambolo retorico,
  // nessuna promessa: chi legge ha tutto quello che serve per agire.
  // `summary_points[0]` resta una frase autosufficiente perché è usata come
  // descrizione della card e come meta description (SEO).
  const summary_points = [
    `Cosa cambia: ${fattoAcr.replace(/[.\s]+$/, '')}.`,
    `Chi riguarda: ${chiAcr.replace(/[.\s]+$/, '')}.`,
    ...(scadenza ? [`Scadenza: ${scadenza} (termine indicato nell’avviso).`] : []),
    `Cosa devi fare: ${comeAcr.replace(/[.\s]+$/, '')}.`,
    ...(hrefDomanda ? [`Presenta la domanda: ${etichettaDomanda} (link diretto nell’articolo).`] : []),
  ];

  return { content_html, summary_points };
}

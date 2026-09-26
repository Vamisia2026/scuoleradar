/**
 * ScuoleRadar.it — Notizie ingestite (dati reali).
 *
 * File GENERATO automaticamente dal servizio di ingestione:
 *   npm run scrape:notizie
 * Non modificarlo a mano: il contenuto viene rigenerato ad ogni ingestione
 * (accelerazione ACCUMULATIVA con dedupe per id, REFRESH delle voci esistenti,
 * validazione URL HTTP 200, tetto di 6 articoli nella finestra di 15 giorni).
 *
 * POLICY NAZIONALE: sono ammesse SOLO fonti nazionali accreditate (MIM,
 * Gazzetta Ufficiale, ARAN, giurisdizione contabile/amministrativa). Le pagine
 * REGIONALI (USR) sono escluse: le voci regionali eventualmente presenti
 * vengono rimosse dall'igiene dell'archivio.
 *
 * POLICY LINK (§5): ogni articolo pubblica SOLO il link diretto al documento
 * specifico (dashboard articolo/PDF ufficiale). Home page, indici, elenchi,
 * directory URP e archivi "master" non sono ammessi: senza link puntuale
 * l'articolo non viene pubblicato.
 */
import type { NewsArticle } from '../types';

/** Notizie reali ingressate dalle fonti ufficiali NAZIONALI (MIM, Gazzetta Ufficiale, ARAN). */
export const notizieIngestite: NewsArticle[] = [
  {
    "id": "notizia-supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-se-mim",
    "title": "Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi",
    "category": "GPS",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online.",
      "Chi riguarda: docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria.",
      "Cosa devi fare: La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online «Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi». La procedura è attiva: si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria. La posizione in GPS decide l’ordine delle convocazioni: un punteggio sbagliato o un titolo non dichiarato pesa su tutte le chiamate dell’anno. Controlla con calma la sezione dei punteggi prima di inviare, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi",
    "official_pdf_url": null,
    "relevance_score": 95,
    "published_at": "2026-07-16T00:00:00.000Z"
  },
  {
    "id": "notizia-mobilita-dirigenti-scolastici-conferimento-e-mutamento-incar-mim",
    "title": "Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27: domanda online entro il 1°luglio",
    "category": "Mobilità",
    "deadline_date": "2026-07-01",
    "summary_points": [
      "Cosa cambia: Se chiedi un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online date e regole della mobilità: le trovi nell’avviso.",
      "Chi riguarda: docenti di ruolo e dirigenti scolastici che chiedono un movimento per il prossimo anno.",
      "Scadenza: 1 luglio 2026 (termine indicato nell’avviso).",
      "Cosa devi fare: La procedura è interamente online su Istanze Online con accesso SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica): rispetta la finestra temporale e allega i documenti che certificano le precedenze.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Se chiedi un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online date e regole della mobilità: le trovi nell’avviso «Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27: domanda online entro il 1°luglio». Il termine dell'avviso era il 1 luglio 2026; la procedura si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti di ruolo e dirigenti scolastici che chiedono un movimento per il prossimo anno. La domanda si costruisce su preferenze e precedenze: vincoli triennali, precedenze di legge e punteggi cambiano l’esito della richiesta. Una domanda incompleta o fuori termine resta senza effetto, quindi verifica i requisiti prima di compilare.</p>\n    <p>La procedura è interamente online su Istanze Online con accesso SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica): rispetta la finestra temporale e allega i documenti che certificano le precedenze. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-conferimento-e-mutamento-incarichi-per-il-2026-27-domanda-online-entro-il-1-luglio\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-conferimento-e-mutamento-incarichi-per-il-2026-27-domanda-online-entro-il-1-luglio",
    "official_pdf_url": null,
    "relevance_score": 93,
    "published_at": "2026-06-23T00:00:00.000Z"
  },
  {
    "id": "notizia-scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-n-mim",
    "title": "Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS (Graduatorie Provinciali per le Supplenze) e conferma del servizio svolto.",
    "category": "GPS",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online.",
      "Chi riguarda: docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria.",
      "Cosa devi fare: La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online «Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS (Graduatorie Provinciali per le Supplenze) e conferma del servizio svolto.». La procedura è attiva: si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria. La posizione in GPS decide l’ordine delle convocazioni: un punteggio sbagliato o un titolo non dichiarato pesa su tutte le chiamate dell’anno. Controlla con calma la sezione dei punteggi prima di inviare, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-",
    "official_pdf_url": null,
    "relevance_score": 95,
    "published_at": "2026-06-15T00:00:00.000Z"
  },
  {
    "id": "notizia-nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-forma-mim",
    "title": "Nuove Indicazioni Nazionali 2025, al via il percorso di formazione e accompagnamento per le scuole",
    "category": "Formazione",
    "deadline_date": "2026-09-16",
    "summary_points": [
      "Cosa cambia: Aggiornarsi conviene: è online un’opportunità di formazione per il personale scolastico.",
      "Chi riguarda: docenti, personale ATA (personale Amministrativo, Tecnico e Ausiliario) e dirigenti scolastici.",
      "Scadenza: 16 settembre 2026 (termine indicato nell’avviso).",
      "Cosa devi fare: Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto."
    ],
    "content_html": "<p>Aggiornarsi conviene: è online un’opportunità di formazione per il personale scolastico «Nuove Indicazioni Nazionali 2025, al via il percorso di formazione e accompagnamento per le scuole». Il termine indicato nell'avviso era il 16 settembre 2026.</p>\n    <p>Riguarda docenti, personale ATA (personale Amministrativo, Tecnico e Ausiliario) e dirigenti scolastici. La formazione pesa su punteggi, incarichi e crescita professionale: verifica requisiti, tempi e modalità di iscrizione prima che la finestra chiuda.</p>\n    <p>Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-formazione-e-accompagnamento-per-le-scuole-domani-16-settembre-il-ministro-interviene-al-semina\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-formazione-e-accompagnamento-per-le-scuole-domani-16-settembre-il-ministro-interviene-al-semina",
    "official_pdf_url": null,
    "relevance_score": 73,
    "published_at": "2026-09-15T00:00:00.000Z"
  },
  {
    "id": "notizia-welfare-per-il-personale-della-scuola-parte-la-polizza-sanit-mim",
    "title": "Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti",
    "category": "Welfare",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Una novità concreta per chi lavora a scuola: è stata annunciata.",
      "Chi riguarda: tutto il personale della scuola — docenti e ATA (personale Amministrativo, Tecnico e Ausiliario) — e le loro famiglie.",
      "Cosa devi fare: In caso di dubbi, chiedi alla segreteria della tua scuola."
    ],
    "content_html": "<p>Una novità concreta per chi lavora a scuola: è stata annunciata «Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti». Cosa cambia in pratica e a chi serve è spiegato qui sopra; nel <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">documento ufficiale</a> trovi condizioni, requisiti e decorrenza.</p>\n    <p>Riguarda tutto il personale della scuola — docenti e ATA (personale Amministrativo, Tecnico e Ausiliario) — e le loro famiglie. Non è una circolare operativa ma un cambio di condizioni: leggi coperture, decorrenza e modalità di adesione, per non restare fuori da un beneficio previsto per te.</p>\n    <p>In caso di dubbi, chiedi alla segreteria della tua scuola. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti",
    "official_pdf_url": null,
    "relevance_score": 65,
    "published_at": "2026-09-21T15:59:25.383Z"
  }
];

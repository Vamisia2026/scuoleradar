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
      "Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi",
      "Interessati: docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online «Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria. La posizione in GPS decide l’ordine delle convocazioni: un punteggio sbagliato o un titolo non dichiarato pesa su tutte le chiamate dell’anno. Controlla con calma la sezione dei punteggi prima di inviare, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
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
      "Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27: domanda online entro il 1°luglio",
      "Interessati: docenti di ruolo e dirigenti scolastici che chiedono un movimento per il prossimo anno.",
      "Scadenza indicata: 1 luglio 2026 (verifica apertura nel testo ufficiale)."
    ],
    "content_html": "<p>Se chiedi un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online date e regole della mobilità: le trovi nell’avviso «Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27: domanda online entro il 1°luglio». Il termine indicato era il 1 luglio 2026: controlla nel testo ufficiale se la procedura è ancora aperta.</p>\n    <p>Riguarda docenti di ruolo e dirigenti scolastici che chiedono un movimento per il prossimo anno. La domanda si costruisce su preferenze e precedenze: vincoli triennali, precedenze di legge e punteggi cambiano l’esito della richiesta. Una domanda incompleta o fuori termine resta senza effetto, quindi verifica i requisiti prima di compilare.</p>\n    <p>La procedura è interamente online su Istanze Online con accesso SPID o CIE: rispetta la finestra temporale e allega i documenti che certificano le precedenze. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-conferimento-e-mutamento-incarichi-per-il-2026-27-domanda-online-entro-il-1-luglio\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-conferimento-e-mutamento-incarichi-per-il-2026-27-domanda-online-entro-il-1-luglio",
    "official_pdf_url": null,
    "relevance_score": 93,
    "published_at": "2026-06-23T00:00:00.000Z"
  },
  {
    "id": "notizia-calendario-delle-festivita-e-degli-esami-anno-scolastico-202-mim",
    "title": "Calendario delle festività e degli esami - anno scolastico 2026/2027",
    "category": "Scuole",
    "deadline_date": null,
    "summary_points": [
      "Calendario delle festività e degli esami - anno scolastico 2026/2027",
      "Interessati: dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Ci sono novità sull’organizzazione dell’anno scolastico: le trovi nella comunicazione «Calendario delle festività e degli esami - anno scolastico 2026/2027». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/calendario-delle-festivita-e-degli-esami-anno-scolastico-2026-2027\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie. Qui stanno scadenze e adempimenti che ricadono su orari, incarichi e attività della scuola: leggerli adesso evita di rincorrere le comunicazioni interne all’ultimo momento.</p>\n    <p>I dettagli completi sono nel testo ufficiale. Se la novità riguarda la tua scuola, la segreteria comunicherà le scadenze interne. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/calendario-delle-festivita-e-degli-esami-anno-scolastico-2026-2027\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/calendario-delle-festivita-e-degli-esami-anno-scolastico-2026-2027",
    "official_pdf_url": null,
    "relevance_score": 70,
    "published_at": "2026-06-23T00:00:00.000Z"
  },
  {
    "id": "notizia-scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-n-mim",
    "title": "Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS e conferma del servizio svolto.",
    "category": "GPS",
    "deadline_date": null,
    "summary_points": [
      "Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS e conferma del servizio svolto.",
      "Interessati: docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole chiamano i docenti per gli incarichi annuali): è online «Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS e conferma del servizio svolto.». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda docenti e aspiranti docenti che aggiornano la propria posizione in graduatoria. La posizione in GPS decide l’ordine delle convocazioni: un punteggio sbagliato o un titolo non dichiarato pesa su tutte le chiamate dell’anno. Controlla con calma la sezione dei punteggi prima di inviare, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta soltanto online su Istanze Online (POLIS) con identità digitale SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Conserva la ricevuta di presentazione. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-",
    "official_pdf_url": null,
    "relevance_score": 95,
    "published_at": "2026-06-15T00:00:00.000Z"
  },
  {
    "id": "notizia-lettera-del-ministro-dell-istruzione-e-del-merito-giuseppe-v-mim",
    "title": "Lettera del Ministro dell’Istruzione e del Merito Giuseppe Valditara in occasione dell’inizio dell’Anno Scolastico 2026/2027",
    "category": "Scuole",
    "deadline_date": null,
    "summary_points": [
      "Lettera del Ministro dell’Istruzione e del Merito Giuseppe Valditara in occasione dell’inizio dell’Anno Scolastico 2026/2027",
      "Interessati: dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Ci sono novità sull’organizzazione dell’anno scolastico: le trovi nella comunicazione «Lettera del Ministro dell’Istruzione e del Merito Giuseppe Valditara in occasione dell’inizio dell’Anno Scolastico 2026/2027». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/lettera-del-ministro-dell-istruzione-e-del-merito-giuseppe-valditara-in-occasione-dell-inizio-dell-anno-scolastico-2026-2027\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie. Qui stanno scadenze e adempimenti che ricadono su orari, incarichi e attività della scuola: leggerli adesso evita di rincorrere le comunicazioni interne all’ultimo momento.</p>\n    <p>I dettagli completi sono nel testo ufficiale. Se la novità riguarda la tua scuola, la segreteria comunicherà le scadenze interne. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/lettera-del-ministro-dell-istruzione-e-del-merito-giuseppe-valditara-in-occasione-dell-inizio-dell-anno-scolastico-2026-2027\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/lettera-del-ministro-dell-istruzione-e-del-merito-giuseppe-valditara-in-occasione-dell-inizio-dell-anno-scolastico-2026-2027",
    "official_pdf_url": null,
    "relevance_score": 70,
    "published_at": "2026-09-18T10:47:09.685Z"
  },
  {
    "id": "notizia-welfare-per-il-personale-della-scuola-parte-la-polizza-sanit-mim",
    "title": "Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti",
    "category": "Scuole",
    "deadline_date": null,
    "summary_points": [
      "Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti",
      "Interessati: tutto il personale della scuola — docenti e ATA — e le loro famiglie.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Una novità concreta per chi lavora a scuola: è stata annunciata «Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda tutto il personale della scuola — docenti e ATA — e le loro famiglie. Non è una circolare operativa ma un cambio di condizioni: leggi coperture, decorrenza e modalità di adesione, per non restare fuori da un beneficio previsto per te.</p>\n    <p>Coperture, decorrenza e come aderire sono nel testo ufficiale. In caso di dubbi, chiedi alla segreteria della tua scuola. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti",
    "official_pdf_url": null,
    "relevance_score": 70,
    "published_at": "2026-09-18T10:47:09.468Z"
  },
  {
    "id": "notizia-ventesima-edizione-del-concorso-juvenes-translatores-2026-20-mim",
    "title": "Ventesima edizione del concorso Juvenes Translatores 2026-2027",
    "category": "Concorsi",
    "deadline_date": null,
    "summary_points": [
      "Ventesima edizione del concorso Juvenes Translatores 2026-2027",
      "Interessati: candidati in possesso dei requisiti richiesti per la classe di concorso o il profilo messo a bando.",
      "Come: apri il documento ufficiale dell'avviso."
    ],
    "content_html": "<p>Si apre la strada per entrare in ruolo o cambiare classe di concorso: è online il bando «Ventesima edizione del concorso Juvenes Translatores 2026-2027». Scadenza ufficiale non ancora pubblicata: la trovi <a href=\"https://www.mim.gov.it/web/guest/-/ventesima-edizione-del-concorso-juvenes-translatores-2026-2027-1\" target=\"_blank\" rel=\"noopener noreferrer\">nell'avviso ufficiale</a> — ti avvisiamo appena esce.</p>\n    <p>Riguarda candidati in possesso dei requisiti richiesti per la classe di concorso o il profilo messo a bando. La selezione prevede prove e valutazione dei titoli: requisiti, programmi e modalità cambiano da bando a bando, quindi leggi il testo prima di compilare. La domanda va presentata entro il termine indicato, con i titoli già autocertificati.</p>\n    <p>La domanda si presenta online sul Portale del Reclutamento (InPA) con SPID o CIE. Prepara in anticipo titoli, autocertificazione e ricevute. Testo ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/ventesima-edizione-del-concorso-juvenes-translatores-2026-2027-1\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/ventesima-edizione-del-concorso-juvenes-translatores-2026-2027-1",
    "official_pdf_url": null,
    "relevance_score": 90,
    "published_at": "2026-09-15T00:00:00.000Z"
  }
];

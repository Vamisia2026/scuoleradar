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
    "id": "notizia-welfare-per-il-personale-della-scuola-parte-la-polizza-sanit-mim",
    "title": "Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti",
    "category": "Welfare",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Una novità concreta per chi lavora a scuola: è stata annunciata.",
      "Chi riguarda: tutto il personale della scuola — docenti e ATA (personale Amministrativo, Tecnico e Ausiliario) — e le loro famiglie.",
      "Cosa devi fare: In caso di dubbi operativi, la segreteria della tua scuola saprà indirizzarti."
    ],
    "content_html": "<p>Una novità concreta per chi lavora a scuola: è stata annunciata «Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti». Cosa cambia in pratica e a chi serve è spiegato qui sopra; nel <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">documento ufficiale</a> trovi condizioni, requisiti e decorrenza.</p>\n    <p>Riguarda tutto il personale della scuola — docenti e ATA (personale Amministrativo, Tecnico e Ausiliario) — e le loro famiglie. Non si tratta di una circolare teorica ma di un cambio di condizioni pratiche: leggi con attenzione coperture, decorrenza e modalità di adesione per non perdere un beneficio a cui hai diritto.</p>\n    <p>In caso di dubbi operativi, la segreteria della tua scuola saprà indirizzarti. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria-interessati-oltre-un-milione-e-duecentomila-dipendenti",
    "official_pdf_url": null,
    "relevance_score": 65,
    "published_at": "2026-09-21T15:59:25.383Z"
  },
  {
    "id": "notizia-nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-forma-mim",
    "title": "Nuove Indicazioni Nazionali 2025, al via il percorso di formazione e accompagnamento per le scuole",
    "category": "Formazione",
    "deadline_date": "2026-09-16",
    "summary_points": [
      "Cosa cambia: Aggiornarsi e formarsi conviene: è online un’opportunità dedicata al personale scolastico.",
      "Chi riguarda: docenti, personale ATA (personale Amministrativo, Tecnico e Ausiliario) e dirigenti.",
      "Scadenza: 16 settembre 2026 (termine indicato nell’avviso).",
      "Cosa devi fare: Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto."
    ],
    "content_html": "<p>Aggiornarsi e formarsi conviene: è online un’opportunità dedicata al personale scolastico «Nuove Indicazioni Nazionali 2025, al via il percorso di formazione e accompagnamento per le scuole». Il termine indicato nell'avviso era il 16 settembre 2026.</p>\n    <p>Riguarda docenti, personale ATA (personale Amministrativo, Tecnico e Ausiliario) e dirigenti. La formazione incide su punteggi, competenze e percorsi di crescita: verifica subito i requisiti d’accesso, la durata e le modalità di iscrizione prima che i posti o i termini si esauriscano.</p>\n    <p>Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-formazione-e-accompagnamento-per-le-scuole-domani-16-settembre-il-ministro-interviene-al-semina\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/nuove-indicazioni-nazionali-2025-al-via-il-percorso-di-formazione-e-accompagnamento-per-le-scuole-domani-16-settembre-il-ministro-interviene-al-semina",
    "official_pdf_url": null,
    "relevance_score": 73,
    "published_at": "2026-09-15T00:00:00.000Z"
  },
  {
    "id": "notizia-supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-se-mim",
    "title": "Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi",
    "category": "GPS",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, ovvero gli elenchi provinciali da cui le scuole pescano per coprire i posti vacanti): è online.",
      "Chi riguarda: docenti e aspiranti docenti che puntano a un incarico annuale.",
      "Cosa devi fare: La domanda si presenta esclusivamente online su Istanze Online (il portale del Ministero per la gestione telematica delle istanze, accessibile tramite SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica)). Conserva sempre la ricevuta di invio.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, ovvero gli elenchi provinciali da cui le scuole pescano per coprire i posti vacanti): è online «Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi». La procedura è attiva: si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti e aspiranti docenti che puntano a un incarico annuale. La tua posizione in graduatoria decide l’ordine delle chiamate: un errore nel calcolo dei punteggi o un titolo dimenticato ti penalizza per tutto l’anno. Meglio ricontrollare con calma prima dell’invio, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta esclusivamente online su Istanze Online (il portale del Ministero per la gestione telematica delle istanze, accessibile tramite SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica)). Conserva sempre la ricevuta di invio. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
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
      "Cosa cambia: Se stai valutando un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online scadenze e regole della mobilità: le trovi nell’avviso.",
      "Chi riguarda: docenti di ruolo e dirigenti scolastici.",
      "Scadenza: 1 luglio 2026 (termine indicato nell’avviso).",
      "Cosa devi fare: Tutta la procedura è digitale e si gestisce su Istanze Online con credenziali SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Rispetta la finestra temporale e allega con cura i documenti per le precedenze.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Se stai valutando un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online scadenze e regole della mobilità: le trovi nell’avviso «Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27: domanda online entro il 1°luglio». Il termine dell'avviso era il 1 luglio 2026; la procedura si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti di ruolo e dirigenti scolastici. La procedura si regge su preferenze, vincoli triennali e precedenze di legge. Una mossa falsa o una domanda fuori termine significa restare bloccati un altro anno: verifica i requisiti prima di compilare.</p>\n    <p>Tutta la procedura è digitale e si gestisce su Istanze Online con credenziali SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica). Rispetta la finestra temporale e allega con cura i documenti per le precedenze. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-conferimento-e-mutamento-incarichi-per-il-2026-27-domanda-online-entro-il-1-luglio\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
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
      "Cosa cambia: Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, ovvero gli elenchi provinciali da cui le scuole pescano per coprire i posti vacanti): è online.",
      "Chi riguarda: docenti e aspiranti docenti che puntano a un incarico annuale.",
      "Cosa devi fare: La domanda si presenta esclusivamente online su Istanze Online (il portale del Ministero per la gestione telematica delle istanze, accessibile tramite SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica)). Conserva sempre la ricevuta di invio.",
      "Presenta la domanda: Istanze Online (POLIS) (link diretto nell’articolo)."
    ],
    "content_html": "<p>Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, ovvero gli elenchi provinciali da cui le scuole pescano per coprire i posti vacanti): è online «Scioglimento della riserva per l’inclusione a pieno titolo nella I fascia delle GPS (Graduatorie Provinciali per le Supplenze) e conferma del servizio svolto.». La procedura è attiva: si presenta da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>.</p>\n    <p>Riguarda docenti e aspiranti docenti che puntano a un incarico annuale. La tua posizione in graduatoria decide l’ordine delle chiamate: un errore nel calcolo dei punteggi o un titolo dimenticato ti penalizza per tutto l’anno. Meglio ricontrollare con calma prima dell’invio, perché dopo la scadenza non si corregge più.</p>\n    <p>La domanda si presenta esclusivamente online su Istanze Online (il portale del Ministero per la gestione telematica delle istanze, accessibile tramite SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d’Identità Elettronica)). Conserva sempre la ricevuta di invio. Presenta la domanda da <a href=\"https://www.istruzione.it/polis/Istanzeonline.htm\" target=\"_blank\" rel=\"noopener noreferrer\">Istanze Online (POLIS)</a>. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/scioglimento-della-riserva-per-l-inclusione-a-pieno-titolo-nella-i-fascia-delle-gps-e-conferma-del-servizio-svolto-",
    "official_pdf_url": null,
    "relevance_score": 95,
    "published_at": "2026-06-15T00:00:00.000Z"
  },
  {
    "id": "notizia-scuola-personale-ata-in-pagamento-oltre-120-milioni-tra-aume-mim",
    "title": "Scuola, personale ATA: in pagamento oltre 120 milioni tra aumenti e arretrati per circa 40.000 dipendenti. Valditara: \"Promessa mantenuta, continueremo a valorizzare chi lavora per la scuola",
    "category": "ATA",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Ci sono novità operative sull’organizzazione e sugli adempimenti della vita scolastica: le trovi nella comunicazione.",
      "Chi riguarda: dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie.",
      "Cosa devi fare: Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto."
    ],
    "content_html": "<p>Ci sono novità operative sull’organizzazione e sugli adempimenti della vita scolastica: le trovi nella comunicazione «Scuola, personale ATA (personale Amministrativo, Tecnico e Ausiliario): in pagamento oltre 120 milioni tra aumenti e arretrati per circa 40.000 dipendenti. Valditara: &quot;Promessa mantenuta, continueremo a valorizzare chi lavora per la scuola». Cosa cambia in pratica e a chi serve è spiegato qui sopra; nel <a href=\"https://www.mim.gov.it/web/guest/-/scuola-personale-ata-in-pagamento-oltre-120-milioni-tra-aumenti-e-arretrati-per-circa-40-000-dipendenti-valditara-promessa-mantenuta-continueremo-a-va\" target=\"_blank\" rel=\"noopener noreferrer\">documento ufficiale</a> trovi condizioni, requisiti e decorrenza.</p>\n    <p>Riguarda dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie. Qui trovi le scadenze che impattano su orari, adempimenti e gestione quotidiana: leggerle in anticipo evita di rincorrere le circolari interne all’ultimo minuto.</p>\n    <p>Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/scuola-personale-ata-in-pagamento-oltre-120-milioni-tra-aumenti-e-arretrati-per-circa-40-000-dipendenti-valditara-promessa-mantenuta-continueremo-a-va\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/scuola-personale-ata-in-pagamento-oltre-120-milioni-tra-aumenti-e-arretrati-per-circa-40-000-dipendenti-valditara-promessa-mantenuta-continueremo-a-va",
    "official_pdf_url": null,
    "relevance_score": 84,
    "published_at": "2026-10-10T10:42:06.676Z"
  },
  {
    "id": "notizia-presentazione-risultati-pnrr-scuola-mim",
    "title": "Presentazione Risultati PNRR (Piano Nazionale di Ripresa e Resilienza) Scuola",
    "category": "PNRR",
    "deadline_date": null,
    "summary_points": [
      "Cosa cambia: Ci sono fondi, scadenze e istruzioni da non perdere: è online l’avviso del PNRR (il Piano Nazionale di Ripresa e Resilienza) per la scuola.",
      "Chi riguarda: scuole, dirigenti, team di progetto e personale coinvolto nei bandi.",
      "Cosa devi fare: Candidature e rendicontazioni si gestiscono sulle piattaforme dedicate del Ministero. Rispetta rigorosamente i termini del bando."
    ],
    "content_html": "<p>Ci sono fondi, scadenze e istruzioni da non perdere: è online l’avviso del PNRR (il Piano Nazionale di Ripresa e Resilienza) per la scuola «Presentazione Risultati PNRR (Piano Nazionale di Ripresa e Resilienza) Scuola». Cosa cambia in pratica e a chi serve è spiegato qui sopra; nel <a href=\"https://www.mim.gov.it/web/guest/-/presentazione-risultati-pnrr-scuola\" target=\"_blank\" rel=\"noopener noreferrer\">documento ufficiale</a> trovi condizioni, requisiti e decorrenza.</p>\n    <p>Riguarda scuole, dirigenti, team di progetto e personale coinvolto nei bandi. I fondi PNRR sbloccano risorse per digitalizzazione, STEM (Scienza, Tecnologia, Ingegneria e Matematica) e divari territoriali: un termine o un allegato mancato fa perdere il finanziamento assegnato, senza possibilità di recupero.</p>\n    <p>Candidature e rendicontazioni si gestiscono sulle piattaforme dedicate del Ministero. Rispetta rigorosamente i termini del bando. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/presentazione-risultati-pnrr-scuola\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/presentazione-risultati-pnrr-scuola",
    "official_pdf_url": null,
    "relevance_score": 80,
    "published_at": "2026-10-10T10:42:06.546Z"
  },
  {
    "id": "notizia-comparto-e-area-istruzione-e-ricerca-settore-scuola-azioni-d-mim",
    "title": "Comparto e Area Istruzione e Ricerca - Settore Scuola: azioni di sciopero previste per il 16 ottobre 2026",
    "category": "CCNL",
    "deadline_date": "2026-10-16",
    "summary_points": [
      "Cosa cambia: Ci sono novità operative sull’organizzazione e sugli adempimenti della vita scolastica: le trovi nella comunicazione.",
      "Chi riguarda: dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie.",
      "Scadenza: 16 ottobre 2026 (termine indicato nell’avviso).",
      "Cosa devi fare: Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto."
    ],
    "content_html": "<p>Ci sono novità operative sull’organizzazione e sugli adempimenti della vita scolastica: le trovi nella comunicazione «Comparto e Area Istruzione e Ricerca - Settore Scuola: azioni di sciopero previste per il 16 ottobre 2026». Hai tempo fino al 16 ottobre 2026: non rimandare all'ultimo giorno.</p>\n    <p>Riguarda dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie. Qui trovi le scadenze che impattano su orari, adempimenti e gestione quotidiana: leggerle in anticipo evita di rincorrere le circolari interne all’ultimo minuto.</p>\n    <p>Le modalità operative e i requisiti sono quelli fissati dal documento ufficiale linkato qui sotto. Fonte ufficiale: <a href=\"https://www.mim.gov.it/web/guest/-/comparto-e-area-istruzione-e-ricerca-settore-scuola-azioni-di-sciopero-previste-per-il-16-ottobre-2026\" target=\"_blank\" rel=\"noopener noreferrer\">apri l'avviso ufficiale</a>.</p>",
    "official_source_url": "https://www.mim.gov.it/web/guest/-/comparto-e-area-istruzione-e-ricerca-settore-scuola-azioni-di-sciopero-previste-per-il-16-ottobre-2026",
    "official_pdf_url": null,
    "relevance_score": 92,
    "published_at": "2026-10-09T00:00:00.000Z"
  }
];

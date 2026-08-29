/**
 * ScuoleRadar.it — Notizie SEED (articoli editoriali fondamentali).
 *
 * Contenuti curati a mano per coprire i periodi in cui il servizio di
 * ingestione non ha ancora raccolto notizie ad alto valore: garantiscono
 * alla bacheca una base solida (Maggio–Agosto 2026) dal primo giorno.
 *
 * Questo file NON viene toccato dal cron: `newsService.ts` lo fonde con le
 * notizie ingestite (`notizieIngestite.ts`) deduplicando per id.
 */
import type { NewsArticle } from '../types';

/** Articoli editoriali fondamentali (seed) per la bacheca Notizie. */
export const notizieSeed: NewsArticle[] = [
  {
    id: 'notizia-seed-algoritmo-gps-conferimento-supplenze-2026-27',
    title:
      'Algoritmo GPS e Conferimento Supplenze 2026/27: Pubblicazione dei primi bollettini provinciali',
    category: 'GPS',
    deadline_date: null,
    summary_points: [
      'Al via le operazioni di attribuzione delle supplenze annuali e fino al termine delle attività didattiche.',
      'Indicazioni sulla presa di servizio del 1° settembre e sulla gestione delle rinunce.',
      'Come: consulta i bollettini provinciali e la tua posizione su Istanze Online.',
    ],
    content_html:
      '<p>Il Ministero dell\u2019Istruzione e del Merito (MIM) ha avviato le operazioni di attribuzione delle supplenze per l\u2019anno scolastico 2026/27, con la pubblicazione dei primi bollettini provinciali generati dall\u2019algoritmo di conferimento «Algoritmo GPS e Conferimento Supplenze 2026/27: Pubblicazione dei primi bollettini provinciali». I bollettini indicano sede e cattedra assegnate a ciascun docente in graduatoria.</p>\n    <p>Le assegnazioni riguardano i docenti iscritti nelle GPS (Graduatorie Provinciali per le Supplenze, le liste da cui le scuole convocano i docenti per gli incarichi annuali) e coprono sia le supplenze annuali sia quelle fino al termine delle attività didattiche. Per chi riceve la nomina la presa di servizio è fissata al 1° settembre 2026; chi intende rinunciare deve seguire la procedura indicata nell\u2019avviso, per evitare decadenze o sanzioni.</p>\n    <p>Consulta il bollettino della tua provincia e la tua posizione dal portale <a href="https://www.istanze.istruzione.it/" target="_blank" rel="noopener noreferrer">Istanze Online</a> con identità SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d\u2019Identità Elettronica) e segui le indicazioni della segreteria scolastica per la presa di servizio.</p>',
    official_source_url:
      'https://www.mim.gov.it/web/guest/-/algoritmo-gps-e-conferimento-supplenze-2026-27-pubblicazione-dei-primi-bollettini-provinciali',
    official_pdf_url: null,
    relevance_score: 95,
    published_at: '2026-08-26T00:00:00.000Z',
  },
  {
    id: 'notizia-seed-presa-di-servizio-1-settembre-2026',
    title:
      'Presa di servizio 1° settembre 2026: Adempimenti, documenti e presa in carico per il nuovo anno scolastico',
    category: 'Scuole',
    deadline_date: '2026-09-01',
    summary_points: [
      'Guida sintetica per docenti di ruolo e supplenti per la prima giornata di servizio.',
      'Dai documenti di rito alla registrazione a SIDI (Sistema Informativo dell\u2019Istruzione).',
      'Scadenza: presa di servizio obbligatoria il 1° settembre 2026.',
    ],
    content_html:
      '<p>La presa di servizio per il nuovo anno scolastico è fissata al 1° settembre 2026 per i docenti di ruolo e per i supplenti nominati tramite le Graduatorie Provinciali per le Supplenze (GPS). La mancata presentazione senza giustificato motivo comporta la decadenza dalla nomina, secondo la disciplina vigente per il personale scolastico.</p>\n    <p>Alla prima giornata di servizio il docente presenta alla segreteria i documenti di rito: documento di riconoscimento, codice fiscale, eventuali attestati e, per i supplenti, la documentazione che certifica i titoli dichiarati in domanda. La presa in carico avviene con la registrazione a SIDI (Sistema Informativo dell\u2019Istruzione) e, per chi ha un incarico a termine, con la sottoscrizione del contratto individuale.</p>\n    <p>Per ogni dettaglio operativo fai riferimento alle indicazioni della segreteria scolastica e alle comunicazioni ufficiali pubblicate sul sito del <a href="https://www.mim.gov.it/" target="_blank" rel="noopener noreferrer">Ministero dell\u2019Istruzione e del Merito</a>.</p>',
    official_source_url:
      'https://www.mim.gov.it/web/guest/-/presa-di-servizio-1-settembre-2026-adempimenti-documenti-e-presa-in-carico',
    official_pdf_url: null,
    relevance_score: 90,
    published_at: '2026-08-28T00:00:00.000Z',
  },
  {
    id: 'notizia-seed-aggiornamento-gps-2026-28-om',
    title:
      'Aggiornamento Graduatorie Provinciali per le Supplenze (GPS) 2026/28: Pubblicazione dell\u2019Ordinanza Ministeriale',
    category: 'GPS',
    deadline_date: null,
    summary_points: [
      'Apertura delle funzioni per l\u2019inserimento e l\u2019aggiornamento dei titoli per le GPS di I e II fascia.',
      'Pubblicata l\u2019Ordinanza Ministeriale per il biennio 2026/28.',
      'Come: presenta l\u2019istanza su Istanze Online entro la finestra ufficiale.',
    ],
    content_html:
      '<p>È stata pubblicata l\u2019Ordinanza Ministeriale che disciplina l\u2019aggiornamento delle Graduatorie Provinciali per le Supplenze (GPS, le liste da cui le scuole convocano i docenti per gli incarichi annuali) per il biennio 2026/28. Con la pubblicazione in Gazzetta Ufficiale si aprono le funzioni per l\u2019inserimento e l\u2019aggiornamento dei titoli per le GPS di I e II fascia.</p>\n    <p>La procedura riguarda i docenti già iscritti che devono aggiornare punteggi e titoli e chi intende presentare nuova istanza. Per la I fascia resta richiesta l\u2019inclusione nel GAE (Graduatoria Ad Esaurimento) o l\u2019abilitazione, mentre la II fascia è aperta a chi possiede i requisiti indicati nell\u2019Ordinanza.</p>\n    <p>La domanda si presenta esclusivamente online dal portale <a href="https://www.istanze.istruzione.it/" target="_blank" rel="noopener noreferrer">Istanze Online</a> con identità SPID (Sistema Pubblico di Identità Digitale) o CIE (Carta d\u2019Identità Elettronica), entro la finestra ufficiale indicata nell\u2019avviso. Conserva la ricevuta di presentazione.</p>',
    official_source_url: 'https://www.gazzettaufficiale.it/eli/id/2026/05/20/26A05100',
    official_pdf_url: null,
    relevance_score: 95,
    published_at: '2026-05-20T00:00:00.000Z',
  },
  {
    id: 'notizia-seed-pnrr-istruzione-scadenze',
    title:
      'PNRR Istruzione: scadenze e istanze per le scuole (Piano Nazionale di Ripresa e Resilienza)',
    category: 'PNRR',
    deadline_date: null,
    summary_points: [
      'Aggiornate le scadenze degli avvisi PNRR per le scuole: edilizia, digitalizzazione, nuove competenze e inclusione.',
      'Interessati: scuole, dirigenti scolastici e personale che partecipa ai bandi PNRR.',
      'Come: consulta gli avvisi sul sito del Ministero e sulle piattaforme dedicate.',
    ],
    content_html:
      '<p>Il Ministero dell\u2019Istruzione e del Merito (MIM) ha aggiornato le scadenze operative degli avvisi PNRR (Piano Nazionale di Ripresa e Resilienza) per il settore istruzione, con l\u2019avviso «PNRR Istruzione: scadenze e istanze per le scuole». Le finestre di presentazione riguardano gli interventi su edilizia, digitalizzazione, nuove competenze e inclusione, con scadenze differenziate per misura.</p>\n    <p>Gli avvisi sono rivolti alle istituzioni scolastiche e al personale coinvolto nella gestione dei progetti finanziati: un termine mancato nella presentazione dell\u2019istanza può far perdere la quota assegnata, quindi conviene verificare per tempo la scadenza della misura di interesse.</p>\n    <p>Le istanze e gli allegati si gestiscono online dalle piattaforme del <a href="https://www.mim.gov.it/" target="_blank" rel="noopener noreferrer">Ministero</a> e da quelle dedicate al PNRR Istruzione. Controlla la scadenza del bando e conserva la ricevuta di invio.</p>',
    official_source_url:
      'https://www.mim.gov.it/web/guest/-/pnrr-istruzione-scadenze-e-istanze-per-le-scuole',
    official_pdf_url: null,
    relevance_score: 82,
    published_at: '2026-07-08T00:00:00.000Z',
  },
];
/**
 * ScuoleRadar.it — CASI dimostrativi del tabellone «Radar Live».
 *
 * Elenco dei dieci casi (dati + esito atteso) usato da `righeDemo` in
 * `demoInterpelli.ts`. Sta in un file a parte perché il gate strutturale
 * (`scripts/check-architettura.ts`) ferma i file oltre le 300 righe e perché il
 * contenuto è una TABELLA di casi: tenerla separata dalle funzioni rende
 * immediato aggiungerne uno.
 *
 * La scadenza NON è una data assoluta ma `giorniAllaScadenza` (giorni di
 * calendario da oggi): un dato dimostrativo con date fisse, dopo una settimana,
 * mostrerebbe solo righe scadute — il contrario di ciò che serve vedere.
 *
 * Gli host `.edu.it` sono INVENTATI: la demo non deve mandare traffico a un sito
 * reale e nessuna scuola è chiamata in causa.
 */
import type { CasoDemo } from './demoInterpelliTipi.ts';

/** I dieci casi, nell'ordine in cui vanno letti (prima quelli che entrano). */
export const CASI_DEMO: readonly CasoDemo[] = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    hash_id: 'demo-01-argo-sito',
    title: 'Interpello supplenza A-022 Matematica — Istituto Comprensivo Carducci',
    province: 'MI',
    class_codes: ['A-22'],
    school_name: 'Istituto Comprensivo Carducci',
    school_code: null,
    materia: 'Matematica',
    // Portale privato: senza il sito dell'istituto il click aprirebbe un login.
    source_url: 'https://iccarducci.portaleargo.it/argoweb/graduatorie.jsp',
    giorniAllaScadenza: 3,
    contact_email: null,
    school_pec: null,
    school_site: 'www.iccarducci.edu.it',
    atteso: {
      esito: 'mostrata',
      fonte: 'sito-scuola',
      badge: 'In corso',
      nota: 'Argo → home .edu.it dal sito istituzionale (school_site)',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    hash_id: 'demo-02-forms-sito',
    title: 'Avviso di supplenza ADSS — Liceo Classico Monti',
    province: 'TO',
    class_codes: ['ADSS'],
    school_name: 'Liceo Classico Monti',
    school_code: null,
    materia: 'Sostegno',
    // Modulo Google: non è un avviso verificabile.
    source_url: 'https://forms.gle/8Xk2demo',
    giorniAllaScadenza: 1,
    contact_email: 'segreteria@liceomonti.edu.it',
    school_pec: null,
    school_site: 'www.liceomonti.edu.it',
    atteso: {
      esito: 'mostrata',
      fonte: 'sito-scuola',
      badge: 'Scade domani',
      nota: 'Google Forms → home .edu.it; badge rosso pieno (≤ 2 giorni)',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    hash_id: 'demo-03-nuvola-pec',
    title: 'Interpello posto comune scuola primaria — Istituto Comprensivo Marconi',
    province: 'BO',
    class_codes: [],
    school_name: 'Istituto Comprensivo Marconi',
    school_code: null,
    materia: 'Scuola primaria',
    // Nuvola/Spaggiari: link di piattaforma.
    source_url: 'https://icmarconi.madisoft.it/didattica/interpelli',
    giorniAllaScadenza: 12,
    // Nessun `school_site` (colonna vuota): la home si ricava dalla PEO .edu.it.
    contact_email: 'segreteria@icmarconi.edu.it',
    school_pec: null,
    school_site: null,
    atteso: {
      esito: 'mostrata',
      fonte: 'sito-scuola',
      badge: 'In corso',
      nota: 'Nuvola + school_site nullo → home .edu.it dalla PEO della riga',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    hash_id: 'demo-04-avviso-pdf',
    title: 'Interpello A-026 Matematica e Fisica — Liceo Scientifico Galilei',
    province: 'PD',
    class_codes: ['A-26'],
    school_name: 'Liceo Scientifico Galilei',
    school_code: null,
    materia: 'Matematica e Fisica',
    source_url: 'https://www.liceogalilei.edu.it/sites/default/files/interpello-a026.pdf',
    giorniAllaScadenza: 0,
    contact_email: null,
    school_pec: null,
    school_site: 'www.liceogalilei.edu.it',
    atteso: {
      esito: 'mostrata',
      fonte: 'avviso',
      badge: 'Scade oggi',
      nota: 'PDF sul sito dell’istituto: avviso vero + badge rosso «Scade oggi»',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    hash_id: 'demo-05-avviso-web',
    title: 'Supplenza biennio ITI Informatica — Istituto Tecnico Industriale Barsanti',
    province: 'FI',
    class_codes: ['B-16'],
    school_name: 'Istituto Tecnico Industriale Barsanti',
    school_code: null,
    materia: 'Informatica',
    source_url: 'https://www.itibarsanti.edu.it/avvisi/interpello-informatica',
    giorniAllaScadenza: 6,
    contact_email: null,
    school_pec: null,
    school_site: 'www.itibarsanti.edu.it',
    atteso: {
      esito: 'mostrata',
      fonte: 'avviso',
      badge: 'In corso',
      nota: 'Pagina dell’avviso sul sito dell’istituto: badge verde pieno (in corso)',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    hash_id: 'demo-06-avviso-lungo',
    title: 'Interpello A-012 Discipline letterarie — Liceo Statale Virgilio',
    province: 'RM',
    class_codes: ['A-12'],
    school_name: 'Liceo Statale Virgilio',
    school_code: null,
    materia: 'Discipline letterarie',
    source_url: 'https://www.liceovirgilio.edu.it/interpelli/a012-2026',
    // Ultimo giorno utile della finestra di candidatura (15 giorni): resta in bacheca.
    giorniAllaScadenza: 14,
    contact_email: null,
    school_pec: null,
    school_site: 'www.liceovirgilio.edu.it',
    atteso: {
      esito: 'mostrata',
      fonte: 'avviso',
      badge: 'In corso',
      nota: 'Bordo della finestra di candidatura (15 giorni): badge verde pieno',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    hash_id: 'demo-07-solo-piattaforma',
    title: 'Interpello supplenza tecnico pratico — IIS Volta',
    province: 'CO',
    class_codes: ['B-15'],
    school_name: 'IIS Volta',
    school_code: null,
    materia: 'Laboratori tecnico-pratici',
    // Piattaforma senza sito né recapiti `.edu.it`: nessuna home da pubblicare.
    source_url: 'https://iisvolta.portaleargo.it/argoweb/interpelli.jsp',
    giorniAllaScadenza: 5,
    // `@istruzione.it` è una casella di servizio del Ministero, non il sito.
    contact_email: 'segreteria@istruzione.it',
    school_pec: null,
    school_site: null,
    atteso: {
      esito: 'scartata',
      nota: 'solo Argo e un recapito @istruzione.it: nessuna fonte apribile → riga fuori',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    hash_id: 'demo-08-nome-da-titolo',
    title: 'Interpello A-034 Scienze motorie — Istituto Comprensivo Pascoli',
    province: 'NA',
    class_codes: ['A-34'],
    // Anagrafica mancante: il nome deve arrivare dal titolo, mai un segnaposto.
    school_name: null,
    school_code: null,
    materia: 'Scienze motorie',
    source_url: 'https://www.icpascoli.edu.it/avvisi/interpello-a034.pdf',
    giorniAllaScadenza: 3,
    contact_email: null,
    school_pec: null,
    school_site: null,
    atteso: {
      esito: 'mostrata',
      fonte: 'avviso',
      badge: 'In corso',
      nota: 'school_name nullo → nome ricavato dal titolo (nessuna etichetta «non specificata»)',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000009',
    hash_id: 'demo-09-segnaposto',
    title: 'Interpello posto di sostegno',
    province: 'BA',
    class_codes: ['ADEE'],
    // Segnaposto storico: non è una denominazione, il gate lo rifiuta.
    school_name: 'Scuola non specificata / Più plessi',
    school_code: null,
    materia: 'Sostegno',
    // Avviso vero su un sito `.edu.it`: la riga resta fuori SOLO per il nome.
    source_url: 'https://www.icnuovoplesso.edu.it/avvisi/interpello-sostegno',
    giorniAllaScadenza: 4,
    contact_email: null,
    school_pec: null,
    school_site: null,
    atteso: {
      esito: 'scartata',
      nota: 'segnaposto «Scuola non specificata / Più plessi» e nessun istituto nel titolo → riga fuori',
    },
  },
  {
    id: '11111111-1111-4111-8111-000000000010',
    hash_id: 'demo-10-titolo-data',
    title: 'PUBBLICATO IL 18/10/2026',
    province: 'VE',
    class_codes: [],
    school_name: 'Istituto Comprensivo Verdi',
    school_code: null,
    materia: null,
    source_url: 'https://www.icverdi.edu.it/avvisi/pubblicazione-18-10-2026',
    giorniAllaScadenza: 10,
    contact_email: null,
    school_pec: null,
    school_site: 'www.icverdi.edu.it',
    atteso: {
      esito: 'scartata',
      nota: 'titolo di sola pubblicazione: non descrive l’avviso → riga fuori',
    },
  },
];

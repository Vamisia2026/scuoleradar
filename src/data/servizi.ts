/**
 * ScuoleRadar.it — catalogo dei servizi mostrati sul sito pubblico.
 *
 * Ogni servizio associato a un DIPARTIMENTO dichiara il proprio `modulo`: la
 * visibilità sul sito (footer, griglia servizi, landing, pagina servizio) segue
 * così le feature flags (`src/config/features.ts`). Un modulo in `off` non deve
 * comparire «in chiaro» nel sito: `serviziVisibili()` applica il filtro.
 */
import type { DipartimentoId } from '@/config/features';

export interface Servizio {
  slug: string;
  emoji: string;
  titolo: string;
  sottotitolo: string;
  descrizione: string;
  caratteristiche: string[];
  destinatari: string;
  dashboard: string;
  sperimentazione: boolean;
  /** Dipartimento che governa la disponibilità (feature flags). Assente = sempre disponibile. */
  modulo?: DipartimentoId;
}

export const servizi: Servizio[] = [
  {
    slug: 'radar-interpelli',
    emoji: '📡',
    titolo: 'Radar Scuole',
    sottotitolo: 'Solo le opportunità che ti riguardano davvero',
    descrizione:
      "Il Radar monitora ogni giorno interpelli per supplenze, bandi per esperti, CPIA e progetti scolastici, filtrandoli in base a ordine di scuola, classi di concorso, materie e province. Ricevi solo le notifiche pertinenti, su Telegram e via email.",
    caratteristiche: [
      'Filtri per ordine di scuola, classe di concorso, materia e provincia',
      'Notifiche Telegram + email quando esce qualcosa di pertinente',
      'Prova PRO gratis per 30 giorni: poi 49€/anno (50% di sconto il 1° anno)',
      "Niente risultati sfocati: se non c'è nulla, te lo diciamo.",
    ],
    destinatari: 'Docenti di ogni ordine e grado, supplenti, aspiranti docenti e personale ATA.',
    dashboard: '/dashboard/radar',
    sperimentazione: false,
    modulo: 'radar',
  },
  {
    slug: 'il-mio-cv',
    emoji: '📄',
    titolo: 'Crea CV',
    sottotitolo: 'Trasforma il tuo vecchio CV in un layout moderno',
    descrizione:
      'Incolla il testo del tuo CV e lo ristrutturiamo in un layout ordinato e professionale, pronto da scaricare in PDF. Niente più formattazioni perse o sezioni confuse.',
    caratteristiche: [
      'Pulisce e organizza le sezioni in automatico',
      'Anteprima moderna in tempo reale',
      'Esportazione PDF in un click',
    ],
    destinatari: 'Docenti e supplenti che vogliono presentarsi al meglio in candidature e graduatorie.',
    dashboard: '/dashboard/cv',
    sperimentazione: false,
    modulo: 'cv_builder',
  },
  {
    slug: 'calcolo-cfu',
    emoji: '🎓',
    titolo: 'Calcolatore CFU',
    sottotitolo: 'Verifica i requisiti delle classi di concorso',
    descrizione:
      'Scegli la classe di concorso, indica classe di laurea ed esami (CFU e settore SSD) e leggi il verdetto requisito per requisito: cosa risulta soddisfatto, cosa manca e cosa va verificato, con le fonti normative applicate.',
    caratteristiche: [
      'Inserimento rapido di materia, CFU e settore (o "non lo so")',
      "Esito per requisito: soddisfatto, non soddisfatto o da verificare",
      'Carenze e fonti normative dichiarate, Dossier .txt da portare in segreteria',
    ],
    destinatari: 'Laureati e laureandi che vogliono capire le proprie classi di concorso.',
    dashboard: '/dashboard/calcolatore-cfu',
    sperimentazione: false,
    modulo: 'cfu',
  },
  {
    slug: 'assistente-ai',
    emoji: '🏛️',
    titolo: 'Assistente Sindacalista Virtuale',
    sottotitolo: 'Risposte immediate su mobilità, supplenze e carriera',
    descrizione:
      'L\'Assistente Sindacalista Virtuale risponde alle tue domande su graduatorie, mobilità, supplenze e requisiti, usando informazioni aggiornate e un linguaggio semplice.',
    caratteristiche: [
      'Risposte su misura per il tuo profilo',
      'Normativa aggiornata e fonti citate',
      'Linguaggio semplice, senza burocratese',
    ],
    destinatari: 'Chi vuole orientarsi senza dover spulciare circolari e FAQ.',
    dashboard: '/dashboard/assistente-ai',
    sperimentazione: true,
  },
  {
    slug: 'moduli',
    emoji: '📁',
    titolo: 'Modulistica',
    sottotitolo: "Documenti e modulistica pronti all'uso",
    descrizione:
      'Oltre 1.000 moduli per la scuola, pronti all\'uso. Disponibili gratuitamente per tutti gli utenti registrati, anche durante il mese di prova PRO.',
    caratteristiche: [
      'Modelli compilabili e scaricabili',
      'Autocertificazioni e dichiarazioni pronte',
      'Checklist per mobilità e supplenze',
    ],
    destinatari: 'Docenti e supplenti che vogliono risparmiare tempo sulla burocrazia.',
    dashboard: '/dashboard/moduli',
    sperimentazione: false,
    modulo: 'modulistica',
  },
];

export function servizioDaSlug(slug: string | undefined): Servizio | undefined {
  return servizi.find((s) => s.slug === slug);
}

/**
 * Servizi effettivamente disponibili per l'utente corrente: un servizio con
 * `modulo` compare solo se il dipartimento è visibile (`visibile(modulo)`, quindi
 * `on` per tutti, `test` per l'admin, `off` per nessuno). I servizi senza modulo
 * sono sempre disponibili.
 */
export function serviziVisibili(visibile: (id: DipartimentoId) => boolean): Servizio[] {
  return servizi.filter((s) => !s.modulo || visibile(s.modulo));
}

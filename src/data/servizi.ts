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
      '3 segnalazioni incluse gratis, poi PRO 49€/anno',
      "Niente risultati sfocati: se non c'è nulla, te lo diciamo.",
    ],
    destinatari: 'Docenti di ogni ordine e grado, supplenti, aspiranti docenti e personale ATA.',
    dashboard: '/dashboard/radar',
    sperimentazione: false,
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
  },
  {
    slug: 'calcolo-cfu',
    emoji: '🎓',
    titolo: 'Calcolatore CFU',
    sottotitolo: 'Scopri quali classi di concorso puoi ottenere',
    descrizione:
      'Inserisci i tuoi esami universitari (materia, CFU e settore scientifico-disciplinare) e verifica in modo indicativo le classi di concorso a cui risulti ammissibile, con il dettaglio dei CFU mancanti.',
    caratteristiche: [
      'Inserimento rapido di materia, CFU e settore',
      "Valutazione indicativa dell'ammissibilità",
      'Dettaglio dei CFU mancanti per ogni ambito',
    ],
    destinatari: 'Laureati e laureandi che vogliono capire le proprie classi di concorso.',
    dashboard: '/dashboard/cfu',
    sperimentazione: true,
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
    titolo: 'Moduli',
    sottotitolo: "Documenti e modulistica pronti all'uso",
    descrizione:
      'Oltre 1.000 moduli per la scuola, pronti all\'uso. Disponibili gratuitamente per tutti gli utenti registrati, anche con Account Base.',
    caratteristiche: [
      'Modelli compilabili e scaricabili',
      'Autocertificazioni e dichiarazioni pronte',
      'Checklist per mobilità e supplenze',
    ],
    destinatari: 'Docenti e supplenti che vogliono risparmiare tempo sulla burocrazia.',
    dashboard: '/dashboard/moduli',
    sperimentazione: false,
  },
];

export function servizioDaSlug(slug: string | undefined): Servizio | undefined {
  return servizi.find((s) => s.slug === slug);
}

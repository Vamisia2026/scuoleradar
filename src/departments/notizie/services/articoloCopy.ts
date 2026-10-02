/**
 * ScuoleRadar.it — Dipartimento Notizie · Copy di categoria degli articoli.
 * Le aperture in chiave AZIONE per categoria (ArticoloCopy) e i copy dedicati
 * alle notizie di impatto pratico: qui vive la voce dei paragrafi generati,
 * separata dalla logica di composizione (articoloEditoriale.ts).
 */

interface ArticoloCopy {
  /**
   * Apertura in chiave AZIONE: parte da che cosa cambia per chi legge e termina
   * con "…l'avviso / la circolare / il bando" (il titolo viene appeso in «…»).
   * Vietate le aperture istituzionali ("Il Ministero … ha comunicato che…").
   */
  fatto: string;
  chi: string;
  pratica: string;
  /**
   * Che cosa fare: spiega in modo chiaro dove e come agire, 
   * traducendo subito eventuali sigle o termini tecnici.
   */
  come: string;
  /** Nome del portale di servizio citato (menzione in testo, mai link). */
  portale: string;
}

const ARTICOLO_BASE: Record<string, ArticoloCopy> = {
  'GPS': {
    fatto: 'Puoi aggiornare punteggi, titoli e servizi delle GPS (Graduatorie Provinciali per le Supplenze, ovvero gli elenchi provinciali da cui le scuole pescano per coprire i posti vacanti): è online',
    chi: 'docenti e aspiranti docenti che puntano a un incarico annuale',
    pratica: 'La tua posizione in graduatoria decide l’ordine delle chiamate: un errore nel calcolo dei punteggi o un titolo dimenticato ti penalizza per tutto l’anno. Meglio ricontrollare con calma prima dell’invio, perché dopo la scadenza non si corregge più.',
    come: 'La domanda si presenta esclusivamente online su Istanze Online (il portale del Ministero per la gestione telematica delle istanze, accessibile tramite SPID o CIE). Conserva sempre la ricevuta di invio.',
    portale: 'Istanze Online',
  },
  'Mobilità': {
    fatto: 'Se stai valutando un trasferimento, un passaggio di cattedra o il rientro nella tua provincia, sono online scadenze e regole della mobilità: le trovi nell’avviso',
    chi: 'docenti di ruolo e dirigenti scolastici',
    pratica: 'La procedura si regge su preferenze, vincoli triennali e precedenze di legge. Una mossa falsa o una domanda fuori termine significa restare bloccati un altro anno: verifica i requisiti prima di compilare.',
    come: 'Tutta la procedura è digitale e si gestisce su Istanze Online con credenziali SPID o CIE. Rispetta la finestra temporale e allega con cura i documenti per le precedenze.',
    portale: 'Istanze Online',
  },
  'Concorsi': {
    fatto: 'Si aprono nuove strade per entrare in ruolo o cambiare classe di concorso: è online il bando',
    chi: 'candidati in possesso dei requisiti di accesso',
    pratica: 'Il concorso seleziona per prove e titoli: requisiti, programmi d’esame e tabelle di valutazione variano da un bando all’altro. Leggi il testo prima di procedere e preparati in anticipo con le autocertificazioni.',
    come: 'La candidatura va inviata online sul Portale del Reclutamento (InPA, la piattaforma unica per i concorsi pubblici), autenticandosi con SPID o CIE.',
    portale: 'InPA',
  },
  'Pensioni': {
    fatto: 'Se stai valutando l’uscita dal servizio, sono aggiornate tabelle, finestre e istruzioni per la pensione del personale scolastico: è online',
    chi: 'personale scolastico che si avvicina alla cessazione',
    pratica: 'Le finestre d’uscita e i requisiti contributivi sono rigidi: sbagliare i tempi di presentazione significa far slittare la decorrenza dell’assegno di mesi. Verifica la tua situazione contributiva prima di muoverti.',
    come: 'La domanda si presenta direttamente sul portale INPS (l’Istituto Nazionale della Previdenza Sociale) usando SPID o CIE. Controlla prima il tuo estratto conto contributivo.',
    portale: 'INPS',
  },
};

const ARTICOLO_ALTRE: Record<string, ArticoloCopy> = {
  'Sostegno': {
    fatto: 'Arrivano nuove indicazioni operative su ore di sostegno, inclusione e scadenze dei GLO: è online la circolare',
    chi: 'docenti di sostegno, consigli di classe, famiglie e membri del GLO (il Gruppo di Lavoro Operativo che pianifica il percorso di inclusione per ciascun alunno con disabilità)',
    pratica: 'Il PEI (Piano Educativo Individualizzato, il documento che delinea gli interventi didattici ed educativi) e i verbali vanno redatti rispettando scadenze fisse: un passaggio saltato rischia di compromettere le ore e le misure di supporto.',
    come: 'Le indicazioni di massima sono nel documento ufficiale, mentre le scadenze operative interne vengono fissate dalla segreteria della scuola.',
    portale: 'Ministero',
  },
  'Intelligenza Artificiale': {
    fatto: 'L’intelligenza artificiale entra a scuola con percorsi, strumenti e indicazioni per chi insegna: è online l’avviso',
    chi: 'docenti, dirigenti e innovatori scolastici',
    pratica: 'L’uso dell’intelligenza artificiale in classe tocca la privacy, la progettazione e i dati degli studenti: servono regole chiare d’istituto e strumenti tracciati. Le candidature hanno finestre strette: chi arriva tardi salta il turno.',
    come: 'Le iscrizioni ai percorsi si gestiscono sui canali dedicati, solitamente tramite la piattaforma Unica o Istanze Online con SPID o CIE.',
    portale: 'Unica',
  },
  'Graduatorie': {
    fatto: 'La tua posizione in graduatoria può muoversi: controlla i punteggi aggiornati nell’avviso',
    chi: 'docenti inseriti nelle graduatorie provinciali o d’istituto',
    pratica: 'La posizione in graduatoria determina direttamente l’ordine delle chiamate per le supplenze. Gli errori nei punteggi vanno segnalati subito nei giorni di pubblicazione, altrimenti restano validi per tutto l’anno.',
    come: 'Eventuali richieste di rettifica o reclami si inoltrano online su Istanze Online con SPID o CIE. Controlla subito la tua posizione.',
    portale: 'Istanze Online',
  },
  'Supplenze': {
    fatto: 'Cambiano le istruzioni e la gestione operativa per le supplenze brevi e annuali: è online l’avviso',
    chi: 'aspiranti supplenti e personale in attesa di incarico',
    pratica: 'Le convocazioni seguono finestre temporali strettissime e chi non risponde nei tempi previsti viene saltato. Tieni sempre d’occhio la casella di posta e la posizione in graduatoria.',
    come: 'La gestione delle proposte di assunzione e delle accettazioni transita interamente su Istanze Online con SPID o CIE.',
    portale: 'Istanze Online',
  },
  'Scuole': {
    fatto: 'Ci sono novità operative sull’organizzazione e sugli adempimenti della vita scolastica: le trovi nella comunicazione',
    chi: 'dirigenti, docenti, personale ATA (Amministrativo, Tecnico e Ausiliario) e famiglie',
    pratica: 'Qui trovi le scadenze che impattano su orari, adempimenti e gestione quotidiana: leggerle in anticipo evita di rincorrere le circolari interne all’ultimo minuto.',
    come: 'I dettagli completi sono nel testo ufficiale; per gli aspetti organizzativi locali, farà fede la circolare interna della tua scuola.',
    portale: 'Ministero',
  },
  'PNRR': {
    fatto: 'Ci sono fondi, scadenze e istruzioni da non perdere: è online l’avviso del PNRR (il Piano Nazionale di Ripresa e Resilienza) per la scuola',
    chi: 'scuole, dirigenti, team di progetto e personale coinvolto nei bandi',
    pratica: 'I fondi PNRR sbloccano risorse per digitalizzazione, STEM e divari territoriali: un termine o un allegato mancato fa perdere il finanziamento assegnato, senza possibilità di recupero.',
    come: 'Candidature e rendicontazioni si gestiscono sulle piattaforme dedicate del Ministero. Rispetta rigorosamente i termini del bando.',
    portale: 'PNRR Istruzione',
  },
};

export const ARTICOLO: Record<string, ArticoloCopy> = {
  ...ARTICOLO_BASE,
  ...ARTICOLO_ALTRE,
};

/**
 * COPY DEDICATO alle notizie di IMPATTO PRATICO: quando il titolo parla di
 * welfare/polizza, formazione o organizzazione, l'apertura dice subito che cosa
 * cambia (e per chi) invece del generico template di categoria.
 */
export const IMPATTO_COPY: Array<{ re: RegExp; copy: ArticoloCopy }> = [
  {
    re: /(?:welfare|polizza|sanitari|assistenza)/i,
    copy: {
      fatto: 'Una novità concreta per chi lavora a scuola: è stata annunciata',
      chi: 'tutto il personale della scuola — docenti e ATA — e le loro famiglie',
      pratica: 'Non si tratta di una circolare teorica ma di un cambio di condizioni pratiche: leggi con attenzione coperture, decorrenza e modalità di adesione per non perdere un beneficio a cui hai diritto.',
      come: 'I dettagli sulle coperture e le modalità per aderire sono nel testo ufficiale. In caso di dubbi operativi, la segreteria della tua scuola saprà indirizzarti.',
      portale: 'Ministero',
    },
  },
  {
    re: /(?:formazione|aggiornamento professionale|MIMeraviglIA)/i,
    copy: {
      fatto: 'Aggiornarsi e formarsi conviene: è online un’opportunità dedicata al personale scolastico',
      chi: 'docenti, personale ATA e dirigenti',
      pratica: 'La formazione incide su punteggi, competenze e percorsi di crescita: verifica subito i requisiti d’accesso, la durata e le modalità di iscrizione prima che i posti o i termini si esauriscano.',
      come: 'Requisiti e link di iscrizione sono indicati nel testo ufficiale: leggi tutto prima di procedere con la registrazione.',
      portale: 'Ministero',
    },
  },
  {
    re: /(?:sicurezza|edilizia|digitalizzazione|organico|cattedre)/i,
    copy: {
      fatto: 'Ci sono novità che ridisegnano l’organizzazione e le risorse delle scuole: è stato pubblicato',
      chi: 'il personale scolastico e gli istituti',
      pratica: 'Si tratta di decisioni che incidono direttamente su organici, orari e operatività quotidiana: leggerle adesso ti permette di capire in anticipo cosa cambia nella tua scuola.',
      come: 'Il testo integrale è disponibile nel documento ufficiale: verifica subito l’impatto specifico per il tuo istituto.',
      portale: 'Ministero',
    },
  },
];

export type { ArticoloCopy };
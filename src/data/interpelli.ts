export interface Interpello {
  id: string;
  titolo: string;
  istituto: string;
  provinciaCodice: string;
  provinciaNome: string;
  classeCodice: string;
  ordine: OrdineScuola;
  dataScadenza: string; // ISO date
  descrizione: string;
  linkFonte: string;
  compatibilita: number; // 0-100
}

import type { OrdineScuola } from './ordiniMaterie';

const oggi = new Date();
const giorni = (n: number) => {
  const d = new Date(oggi);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const interpelli: Interpello[] = [
  {
    id: 'i1',
    titolo: 'Docente di Matematica e Fisica',
    istituto: 'Liceo Scientifico Galileo Galilei',
    provinciaCodice: 'MI',
    provinciaNome: 'Milano',
    classeCodice: 'A-28',
    ordine: 'secondaria2',
    dataScadenza: giorni(2),
    descrizione:
      'Si ricerca docente per copertura supplenza annuale per la classe di concorso A-28. Posizione a tempo pieno, inserimento in organico di diritto. Richiesta abilitazione specifica.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-1',
    compatibilita: 100,
  },
  {
    id: 'i2',
    titolo: 'Docente di Discipline Letterarie',
    istituto: 'IIS G. Carducci',
    provinciaCodice: 'RM',
    provinciaNome: 'Roma',
    classeCodice: 'A-12',
    ordine: 'secondaria2',
    dataScadenza: giorni(1),
    descrizione:
      'Interpello per supplenza di classe A-12 presso l\'IIS Carducci. Si richiede titolo di accesso valido e disponibilità immediata.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-2',
    compatibilita: 100,
  },
  {
    id: 'i3',
    titolo: 'Docente di Lingua Inglese',
    istituto: 'Istituto Comprensivo Dante Alighieri',
    provinciaCodice: 'NA',
    provinciaNome: 'Napoli',
    classeCodice: 'A-22',
    ordine: 'secondaria2',
    dataScadenza: giorni(5),
    descrizione:
      'Ricerca docente di lingua inglese per supplenza annuale. Classe di concorso A-22. Possibilità di rinnovo.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-3',
    compatibilita: 100,
  },
  {
    id: 'i4',
    titolo: 'Docente di Matematica e Scienze (secondaria I grado)',
    istituto: 'Scuola Secondaria I grado Leonardo da Vinci',
    provinciaCodice: 'TO',
    provinciaNome: 'Torino',
    classeCodice: 'A-29',
    ordine: 'secondaria1',
    dataScadenza: giorni(3),
    descrizione:
      'Supplenza per classe A-29 presso scuola secondaria di I grado. Si richiede abilitazione e disponibilità al trasferimento.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-4',
    compatibilita: 100,
  },
  {
    id: 'i5',
    titolo: 'Docente di Filosofia e Storia',
    istituto: 'Liceo Classico G. Garibaldi',
    provinciaCodice: 'CT',
    provinciaNome: 'Catania',
    classeCodice: 'A-13',
    ordine: 'secondaria2',
    dataScadenza: giorni(7),
    descrizione:
      'Interpello per classe A-13. Posizione fino al termine delle lezioni. Richiesta titolo di accesso.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-5',
    compatibilita: 100,
  },
  {
    id: 'i6',
    titolo: 'Docente di Scienze Naturali',
    istituto: 'Liceo Scientifico A. Volta',
    provinciaCodice: 'FI',
    provinciaNome: 'Firenze',
    classeCodice: 'A-31',
    ordine: 'secondaria2',
    dataScadenza: giorni(9),
    descrizione:
      'Ricerca docente A-31 per supplenza annuale. Laboratori di chimica e biologia disponibili presso l\'istituto.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-6',
    compatibilita: 100,
  },
  {
    id: 'i7',
    titolo: 'Docente di Arte e Immagine',
    istituto: 'Liceo Artistico M. Boccioni',
    provinciaCodice: 'MI',
    provinciaNome: 'Milano',
    classeCodice: 'A-25',
    ordine: 'secondaria2',
    dataScadenza: giorni(12),
    descrizione:
      'Supplenza per classe A-25. Atelier e laboratori attrezzati. Possibilità di collaborazione a progetti espositivi.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-7',
    compatibilita: 100,
  },
  {
    id: 'i8',
    titolo: 'Docente di Musica (secondaria I grado)',
    istituto: 'IC P. Mascagni',
    provinciaCodice: 'BO',
    provinciaNome: 'Bologna',
    classeCodice: 'A-02',
    ordine: 'secondaria1',
    dataScadenza: giorni(4),
    descrizione:
      'Interpello per classe A-02. Sala musica e strumenti disponibili. Supplenza fino a fine anno scolastico.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-8',
    compatibilita: 100,
  },
  {
    id: 'i9',
    titolo: 'Docente di Lingua Francese',
    istituto: 'Liceo Linguistico J. Prévert',
    provinciaCodice: 'RM',
    provinciaNome: 'Roma',
    classeCodice: 'A-23',
    ordine: 'secondaria2',
    dataScadenza: giorni(6),
    descrizione:
      'Ricerca docente A-23 per supplenza annuale. Scambi culturali con istituti partner in Francia.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-9',
    compatibilita: 100,
  },
  {
    id: 'i10',
    titolo: 'Docente di Fisica',
    istituto: 'Liceo Scientifico E. Fermi',
    provinciaCodice: 'GE',
    provinciaNome: 'Genova',
    classeCodice: 'A-30',
    ordine: 'secondaria2',
    dataScadenza: giorni(8),
    descrizione:
      'Supplenza per classe A-30. Laboratorio di fisica moderno. Possibilità di partecipare a progetti PCTO.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-10',
    compatibilita: 100,
  },
  {
    id: 'i11',
    titolo: 'Docente di Discipline Letterarie e Latino',
    istituto: 'Liceo Classico T. Livio',
    provinciaCodice: 'PD',
    provinciaNome: 'Padova',
    classeCodice: 'A-11',
    ordine: 'secondaria1',
    dataScadenza: giorni(15),
    descrizione:
      'Interpello per classe A-11 presso scuola secondaria di I grado. Richiesta abilitazione.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-11',
    compatibilita: 100,
  },
  {
    id: 'i12',
    titolo: 'Docente di Scienze Giuridiche ed Economiche',
    istituto: 'ITCS G. Tagliacarne',
    provinciaCodice: 'BA',
    provinciaNome: 'Bari',
    classeCodice: 'A-32',
    ordine: 'secondaria2',
    dataScadenza: giorni(10),
    descrizione:
      'Ricerca docente A-32 per supplenza annuale. Indirizzo AFM. Possibilità di collaborazione con enti del territorio.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-12',
    compatibilita: 100,
  },
  {
    id: 'i13',
    titolo: 'Docente di Chimica (Laboratorio)',
    istituto: 'ITIS G. Marconi',
    provinciaCodice: 'VR',
    provinciaNome: 'Verona',
    classeCodice: 'B-02',
    ordine: 'secondaria2',
    dataScadenza: giorni(20),
    descrizione:
      'Interpello per classe B-02. Laboratorio chimico attrezzato. Supplenza fino al termine delle attività.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-13',
    compatibilita: 100,
  },
  {
    id: 'i14',
    titolo: 'Docente di Lingua Spagnola (secondaria I grado)',
    istituto: 'IC F. García Lorca',
    provinciaCodice: 'FI',
    provinciaNome: 'Firenze',
    classeCodice: 'A-05',
    ordine: 'secondaria1',
    dataScadenza: giorni(2),
    descrizione:
      'Ricerca docente A-05 per supplenza annuale presso scuola secondaria di I grado.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-14',
    compatibilita: 100,
  },
  {
    id: 'i15',
    titolo: 'Docente di Lingua Inglese (secondaria I grado)',
    istituto: 'IC J. London',
    provinciaCodice: 'MI',
    provinciaNome: 'Milano',
    classeCodice: 'A-03',
    ordine: 'secondaria1',
    dataScadenza: giorni(1),
    descrizione:
      'Supplenza per classe A-03. Progetti CLIL e gemellaggi con scuole europee. Disponibilità immediata.',
    linkFonte: 'https://www.istruzione.it/interpelli/esempio-15',
    compatibilita: 100,
  },
  {
    id: 'i16',
    titolo: 'Esperto esterno – Laboratori STEM e Robotica (PON/PNRR)',
    istituto: 'IC G. Rodari',
    provinciaCodice: 'NA',
    provinciaNome: 'Napoli',
    classeCodice: 'ESP-ESTERNI',
    ordine: 'pon',
    dataScadenza: giorni(6),
    descrizione:
      'Selezione esperto esterno per progetto PON "Competenze STEM e Robotica". 30 ore di laboratorio pomeridiano. Richiesta esperienza documentata.',
    linkFonte: 'https://www.istruzione.it/bandi/pon-esempio-16',
    compatibilita: 100,
  },
  {
    id: 'i17',
    titolo: 'Esperto esterno – Competenze Digitali (PON/PNRR)',
    istituto: 'Liceo Scientifico E. Majorana',
    provinciaCodice: 'BO',
    provinciaNome: 'Bologna',
    classeCodice: 'ESP-ESTERNI',
    ordine: 'pon',
    dataScadenza: giorni(11),
    descrizione:
      'Bando per esperto esterno su competenze digitali e coding nell\'ambito del PNRR. Percorso di 40 ore rivolto a classi terze e quarte.',
    linkFonte: 'https://www.istruzione.it/bandi/pon-esempio-17',
    compatibilita: 100,
  },
  {
    id: 'i18',
    titolo: 'Docente CPIA – Italiano L2 e Alfabetizzazione',
    istituto: 'CPIA 1 Napoli',
    provinciaCodice: 'NA',
    provinciaNome: 'Napoli',
    classeCodice: 'CPIA-ASSO',
    ordine: 'cpia',
    dataScadenza: giorni(4),
    descrizione:
      'Interpello per docente CPIA, percorsi di alfabetizzazione e apprendimento lingua italiana per cittadini adulti stranieri. Supplenza annuale.',
    linkFonte: 'https://www.istruzione.it/interpelli/cpia-esempio-18',
    compatibilita: 100,
  },
  {
    id: 'i19',
    titolo: 'Docente CPIA – Matematica e Scienze (Primo Livello)',
    istituto: 'CPIA 2 Roma',
    provinciaCodice: 'RM',
    provinciaNome: 'Roma',
    classeCodice: 'CPIA-ASSO',
    ordine: 'cpia',
    dataScadenza: giorni(9),
    descrizione:
      'Ricerca docente per percorsi di primo livello presso CPIA. Materie: matematica, scienze e tecnologia. Disponibilità serale richiesta.',
    linkFonte: 'https://www.istruzione.it/interpelli/cpia-esempio-19',
    compatibilita: 100,
  },
  {
    id: 'i20',
    titolo: 'Collaboratore Scolastico (Personale ATA)',
    istituto: 'IC G. Verga',
    provinciaCodice: 'CT',
    provinciaNome: 'Catania',
    classeCodice: 'ATA-CS',
    ordine: 'ata',
    dataScadenza: giorni(3),
    descrizione:
      'Interpello per collaboratore scolastico. Supplenza annuale, orario articolato su turni. Diploma di istruzione secondaria richiesto.',
    linkFonte: 'https://www.istruzione.it/interpelli/ata-esempio-20',
    compatibilita: 100,
  },
  {
    id: 'i21',
    titolo: 'Assistente Tecnico – Laboratorio Informatica (ATA)',
    istituto: 'ITIS A. Meucci',
    provinciaCodice: 'MI',
    provinciaNome: 'Milano',
    classeCodice: 'ATA-AT',
    ordine: 'ata',
    dataScadenza: giorni(7),
    descrizione:
      'Interpello per assistente tecnico presso laboratorio di informatica. Diploma tecnico settore informatico richiesto. Supplenza fino al termine delle attività.',
    linkFonte: 'https://www.istruzione.it/interpelli/ata-esempio-21',
    compatibilita: 100,
  },
  {
    id: 'i22',
    titolo: 'Esperto esterno – Orientamento Scolastico (PON)',
    istituto: 'Liceo Classico Q. Orazio Flacco',
    provinciaCodice: 'BA',
    provinciaNome: 'Bari',
    classeCodice: 'ESP-ESTERNI',
    ordine: 'pon',
    dataScadenza: giorni(14),
    descrizione:
      'Selezione esperto esterno per attività di orientamento scolastico e professionale nell\'ambito PON. 20 ore di intervento in presenza.',
    linkFonte: 'https://www.istruzione.it/bandi/pon-esempio-22',
    compatibilita: 100,
  },
];

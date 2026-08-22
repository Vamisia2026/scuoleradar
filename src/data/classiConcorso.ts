import type { OrdineScuola } from './ordiniMaterie';

export interface RequisitoCfu {
  ambito: string;
  cfu: number;
}

export interface ClasseConcorso {
  codice: string;
  denominazione: string;
  ordine: OrdineScuola;
  materie: string[];
  requisitiCfu: RequisitoCfu[];
}

export const classiConcorso: ClasseConcorso[] = [
  {
    codice: 'A-01',
    denominazione: 'Arte e immagine nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['arte'],
    requisitiCfu: [
      { ambito: 'Discipline delle arti figurative, storia dell\'arte e cinema', cfu: 24 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-02',
    denominazione: 'Musica nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['musica'],
    requisitiCfu: [
      { ambito: 'Discipline musicali (storia della musica, teoria e analisi)', cfu: 24 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-03',
    denominazione: 'Lingua inglese nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['inglese'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua inglese', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura inglese', cfu: 12 },
    ],
  },
  {
    codice: 'A-04',
    denominazione: 'Lingua francese nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['francese'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua francese', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura francese', cfu: 12 },
    ],
  },
  {
    codice: 'A-05',
    denominazione: 'Lingua spagnola nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['spagnolo'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua spagnola', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura spagnola', cfu: 12 },
    ],
  },
  {
    codice: 'A-11',
    denominazione: 'Discipline letterarie e latino',
    ordine: 'secondaria1',
    materie: ['italiano', 'storia', 'geografia', 'latino'],
    requisitiCfu: [
      { ambito: 'Discipline letterarie (italianistica, linguistica, letteratura)', cfu: 24 },
      { ambito: 'Lingua e letteratura latina', cfu: 12 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-12',
    denominazione: 'Discipline letterarie negli istituti di istruzione secondaria di II grado',
    ordine: 'secondaria2',
    materie: ['italiano', 'storia', 'latino'],
    requisitiCfu: [
      { ambito: 'Discipline letterarie (italianistica, linguistica, letteratura)', cfu: 24 },
      { ambito: 'Lingua e letteratura latina', cfu: 12 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-13',
    denominazione: 'Filosofia e storia',
    ordine: 'secondaria2',
    materie: ['filosofia', 'storia'],
    requisitiCfu: [
      { ambito: 'Filosofia e storia', cfu: 36 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-18',
    denominazione: 'Filosofia e scienze umane',
    ordine: 'secondaria2',
    materie: ['filosofia', 'scienze_umane', 'psicologia', 'pedagogia', 'storia'],
    requisitiCfu: [
      { ambito: 'Filosofia', cfu: 24 },
      { ambito: 'Scienze dell\'educazione, psicologia e antropologia', cfu: 18 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'A-19',
    denominazione: 'Filosofia e psicologia',
    ordine: 'secondaria2',
    materie: ['filosofia'],
    requisitiCfu: [
      { ambito: 'Filosofia', cfu: 24 },
      { ambito: 'Pedagogia, psicologia e antropologia', cfu: 24 },
    ],
  },
  {
    codice: 'A-22',
    denominazione: 'Lingua e cultura straniera – Inglese',
    ordine: 'secondaria2',
    materie: ['inglese'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua inglese', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura inglese', cfu: 12 },
      { ambito: 'Linguistica', cfu: 6 },
    ],
  },
  {
    codice: 'A-23',
    denominazione: 'Lingua e cultura straniera – Francese',
    ordine: 'secondaria2',
    materie: ['francese'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua francese', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura francese', cfu: 12 },
      { ambito: 'Linguistica', cfu: 6 },
    ],
  },
  {
    codice: 'A-24',
    denominazione: 'Lingua e Cultura straniera – Tedesco',
    ordine: 'secondaria2',
    materie: ['tedesco'],
    requisitiCfu: [
      { ambito: 'Lingua e traduzione - Lingua tedesca', cfu: 24 },
      { ambito: 'Filologia, letteratura e cultura tedesca', cfu: 12 },
      { ambito: 'Linguistica', cfu: 6 },
    ],
  },
  {
    codice: 'A-25',
    denominazione: 'Arte e immagine',
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [
      { ambito: 'Discipline delle arti figurative, storia dell\'arte e cinema', cfu: 36 },
      { ambito: 'Architettura e urbanistica', cfu: 12 },
    ],
  },
  {
    codice: 'A-26',
    denominazione: 'Musica',
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [
      { ambito: 'Discipline musicali (storia della musica, teoria e analisi)', cfu: 36 },
      { ambito: 'Storia dell\'arte e dello spettacolo', cfu: 12 },
    ],
  },
  {
    codice: 'A-28',
    denominazione: 'Matematica e fisica',
    ordine: 'secondaria2',
    materie: ['matematica', 'fisica'],
    requisitiCfu: [
      { ambito: 'Matematica', cfu: 24 },
      { ambito: 'Fisica', cfu: 18 },
      { ambito: 'Discipline informatiche', cfu: 6 },
    ],
  },
  {
    codice: 'A-29',
    denominazione: 'Matematica e scienze nella scuola secondaria di I grado',
    ordine: 'secondaria1',
    materie: ['matematica', 'scienze', 'tecnologia'],
    requisitiCfu: [
      { ambito: 'Matematica e informatica', cfu: 24 },
      { ambito: 'Fisica', cfu: 12 },
      { ambito: 'Scienze della Terra e biologia', cfu: 12 },
    ],
  },
  {
    codice: 'A-30',
    denominazione: 'Fisica',
    ordine: 'secondaria2',
    materie: ['fisica'],
    requisitiCfu: [
      { ambito: 'Fisica', cfu: 36 },
      { ambito: 'Matematica', cfu: 12 },
    ],
  },
  {
    codice: 'A-31',
    denominazione: 'Scienze naturali, chimiche e biologiche',
    ordine: 'secondaria2',
    materie: ['scienze', 'chimica', 'biologia', 'scienze_terra'],
    requisitiCfu: [
      { ambito: 'Scienze della Terra e biologia', cfu: 24 },
      { ambito: 'Chimica', cfu: 18 },
      { ambito: 'Fisica', cfu: 6 },
    ],
  },
  {
    codice: 'A-32',
    denominazione: 'Scienze giuridiche ed economiche',
    ordine: 'secondaria2',
    materie: ['diritto'],
    requisitiCfu: [
      { ambito: 'Scienze giuridiche', cfu: 24 },
      { ambito: 'Scienze economiche', cfu: 24 },
    ],
  },
  {
    codice: 'A-33',
    denominazione: 'Lingua e letteratura tedesca',
    ordine: 'secondaria2',
    materie: ['tedesco'],
    requisitiCfu: [
      { ambito: 'Lingua e letteratura tedesca', cfu: 36 },
      { ambito: 'Linguistica', cfu: 6 },
    ],
  },
  {
    codice: 'AB-24',
    denominazione: 'Filosofia e scienze umane',
    ordine: 'secondaria2',
    materie: ['filosofia', 'storia'],
    requisitiCfu: [
      { ambito: 'Filosofia', cfu: 24 },
      { ambito: 'Scienze dell\'educazione e psicologia', cfu: 18 },
      { ambito: 'Discipline storiche e geografiche', cfu: 12 },
    ],
  },
  {
    codice: 'B-02',
    denominazione: 'Laboratorio di chimica',
    ordine: 'secondaria2',
    materie: ['chimica'],
    requisitiCfu: [
      { ambito: 'Chimica', cfu: 36 },
      { ambito: 'Discipline chimiche applicate', cfu: 12 },
    ],
  },
  {
    codice: 'ESP-ESTERNI',
    denominazione: 'Esperti esterni per progetti PON / PNRR',
    ordine: 'pon',
    materie: ['digital_skills', 'stem', 'robotica', 'orientamento', 'progettazione', 'beni_culturali', 'agricoltura', 'sociale'],
    requisitiCfu: [
      { ambito: 'Competenze professionali coerenti con il progetto', cfu: 12 },
    ],
  },
  {
    codice: 'CPIA-ASSO',
    denominazione: 'Docente CPIA – Alfabetizzazione e primo livello',
    ordine: 'cpia',
    materie: ['italiano', 'matematica', 'italiano_l2', 'alfabetizzazione', 'educazione_adulti'],
    requisitiCfu: [
      { ambito: 'Discipline dell\'istruzione di base', cfu: 24 },
    ],
  },
  {
    codice: 'ATA-CS',
    denominazione: 'Collaboratore scolastico (Personale ATA)',
    ordine: 'ata',
    materie: ['collaboratore'],
    requisitiCfu: [
      { ambito: 'Diploma di istruzione secondaria', cfu: 0 },
    ],
  },
  {
    codice: 'ATA-AT',
    denominazione: 'Assistente tecnico (Personale ATA)',
    ordine: 'ata',
    materie: ['assistente_tecnico'],
    requisitiCfu: [
      { ambito: 'Diploma tecnico coerente con il laboratorio', cfu: 0 },
    ],
  },
  {
    codice: 'ATA-AA',
    denominazione: 'Assistente amministrativo (Personale ATA)',
    ordine: 'ata',
    materie: ['assistente_amministrativo'],
    requisitiCfu: [
      { ambito: 'Diploma di istruzione secondaria', cfu: 0 },
    ],
  },
];

export const classeByCodice = (codice: string): ClasseConcorso | undefined =>
  classiConcorso.find((c) => c.codice === codice);

export const classiByMateria = (materiaId: string): ClasseConcorso[] =>
  classiConcorso.filter((c) => c.materie.includes(materiaId));

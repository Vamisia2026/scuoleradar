import { materie as catalogoMaterie, type OrdineScuola } from './ordiniMaterie';

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
    codice: 'AAAA',
    denominazione: "Scuola dell'infanzia",
    ordine: 'infanzia',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'EEEE',
    denominazione: "Scuola primaria",
    ordine: 'primaria',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'EEEM',
    denominazione: "Scienze motorie e sportive nella scuola primaria",
    ordine: 'primaria',
    materie: ['ed_fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'ADAA',
    denominazione: "Sostegno nella scuola dell'infanzia",
    ordine: 'infanzia',
    materie: ['sostegno'],
    requisitiCfu: [],
  },
  {
    codice: 'ADEE',
    denominazione: "Sostegno nella scuola primaria",
    ordine: 'primaria',
    materie: ['sostegno'],
    requisitiCfu: [],
  },
  {
    codice: 'ADMM',
    denominazione: "Sostegno nella scuola secondaria di I grado",
    ordine: 'secondaria1',
    materie: ['sostegno'],
    requisitiCfu: [],
  },
  {
    codice: 'ADSS',
    denominazione: "Sostegno nella scuola secondaria di II grado",
    ordine: 'secondaria2',
    materie: ['sostegno'],
    requisitiCfu: [],
  },
  {
    codice: 'A-01',
    denominazione: "Arte e immagine nell'istruzione secondaria di I e II grado",
    ordine: 'secondaria1',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-02',
    denominazione: "Design dei metalli, dell'oreficeria, delle pietre dure e delle gemme",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-03',
    denominazione: "Design della ceramica",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-04',
    denominazione: "Design del libro",
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-05',
    denominazione: "Design del tessuto e della moda",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-06',
    denominazione: "Design del vetro",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-07',
    denominazione: "Discipline Audiovisive",
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-08',
    denominazione: "Discipline geometriche, architettura, design d'arredamento e scenotecnica",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-09',
    denominazione: "Discipline grafiche, pittoriche e scenografiche",
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-10',
    denominazione: "Discipline grafico-pubblicitarie",
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-11',
    denominazione: "Discipline letterarie e latino",
    ordine: 'secondaria2',
    materie: ['italiano','latino','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-12',
    denominazione: "Discipline letterarie negli istituti di istruzione secondaria di I grado e di II grado",
    ordine: 'secondaria2',
    materie: ['italiano','storia','geografia','latino'],
    requisitiCfu: [],
  },
  {
    codice: 'A-13',
    denominazione: "Discipline letterarie, latino e greco",
    ordine: 'secondaria2',
    materie: ['italiano','latino','greco','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-14',
    denominazione: "Discipline plastiche, scultoree e scenoplastiche",
    ordine: 'secondaria2',
    materie: ['arte'],
    requisitiCfu: [],
  },
  {
    codice: 'A-15',
    denominazione: "Discipline sanitarie",
    ordine: 'secondaria2',
    materie: ['scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'A-16',
    denominazione: "Disegno artistico e modellazione odontotecnica",
    ordine: 'secondaria2',
    materie: ['arte','scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'A-17',
    denominazione: "Disegno e storia dell'arte negli istituti di istruzione secondaria di II grado",
    ordine: 'secondaria2',
    materie: ['arte','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-18',
    denominazione: "Filosofia e Scienze umane",
    ordine: 'secondaria2',
    materie: ['filosofia','scienze_umane','psicologia','pedagogia','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-19',
    denominazione: "Filosofia e Storia",
    ordine: 'secondaria2',
    materie: ['filosofia','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-20',
    denominazione: "Fisica",
    ordine: 'secondaria2',
    materie: ['fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-21',
    denominazione: "Geografia",
    ordine: 'secondaria2',
    materie: ['geografia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-22',
    denominazione: "Lingue e culture straniere nell'istruzione secondaria di I e di II grado",
    ordine: 'secondaria2',
    materie: ['inglese','francese','spagnolo','tedesco'],
    requisitiCfu: [],
  },
  {
    codice: 'A-23',
    denominazione: "Lingua italiana per discenti di lingua straniera (alloglotti)",
    ordine: 'secondaria2',
    materie: ['italiano_l2','alfabetizzazione'],
    requisitiCfu: [],
  },
  {
    codice: 'A-24',
    denominazione: "Lingue e culture straniere negli istituti di istruzione secondaria di II grado",
    ordine: 'secondaria2',
    materie: ['inglese','francese','spagnolo','tedesco'],
    requisitiCfu: [],
  },
  {
    codice: 'A-25',
    denominazione: "Lingua inglese e seconda lingua comunitaria nella scuola secondaria di primo grado",
    ordine: 'secondaria1',
    materie: ['inglese','francese','spagnolo','tedesco'],
    requisitiCfu: [],
  },
  {
    codice: 'A-26',
    denominazione: "Matematica",
    ordine: 'secondaria2',
    materie: ['matematica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-27',
    denominazione: "Matematica e Fisica",
    ordine: 'secondaria2',
    materie: ['matematica','fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-28',
    denominazione: "Matematica e scienze nella scuola secondaria di I grado",
    ordine: 'secondaria1',
    materie: ['matematica','scienze','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-29',
    denominazione: "Musica negli istituti di istruzione secondaria di II grado (ad esaurimento)",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-30',
    denominazione: "Musica nell'istruzione secondaria di I e II grado",
    ordine: 'secondaria1',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-31',
    denominazione: "Scienze degli alimenti",
    ordine: 'secondaria2',
    materie: ['scienze','agricoltura'],
    requisitiCfu: [],
  },
  {
    codice: 'A-32',
    denominazione: "Scienze della geologia e della mineralogia",
    ordine: 'secondaria2',
    materie: ['scienze','scienze_terra'],
    requisitiCfu: [],
  },
  {
    codice: 'A-33',
    denominazione: "Scienze e tecnologie aeronautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-34',
    denominazione: "Scienze e tecnologie chimiche",
    ordine: 'secondaria2',
    materie: ['chimica','scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'A-35',
    denominazione: "Scienze e tecnologie della calzatura e della moda",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-36',
    denominazione: "Scienze e tecnologie della logistica",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-37',
    denominazione: "Scienze e tecnologie delle costruzioni, tecnologie e tecniche di rappresentazione grafica",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-38',
    denominazione: "Scienze e tecnologie delle costruzioni aeronautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-39',
    denominazione: "Scienze e tecnologie delle costruzioni navali",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-40',
    denominazione: "Scienze e tecnologie elettriche ed elettroniche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-41',
    denominazione: "Scienze e tecnologie informatiche",
    ordine: 'secondaria2',
    materie: ['informatica','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-42',
    denominazione: "Scienze e tecnologie meccaniche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-43',
    denominazione: "Scienze e tecnologie nautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-44',
    denominazione: "Scienze e tecnologie tessili, dell'abbigliamento e della moda",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-45',
    denominazione: "Scienze economico-aziendali",
    ordine: 'secondaria2',
    materie: ['diritto'],
    requisitiCfu: [],
  },
  {
    codice: 'A-46',
    denominazione: "Scienze giuridico-economiche",
    ordine: 'secondaria2',
    materie: ['diritto'],
    requisitiCfu: [],
  },
  {
    codice: 'A-47',
    denominazione: "Scienze matematiche applicate",
    ordine: 'secondaria2',
    materie: ['matematica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-48',
    denominazione: "Scienze motorie e sportive nell'istruzione secondaria di I e II grado",
    ordine: 'secondaria2',
    materie: ['ed_fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-49',
    denominazione: "Scienze motorie e sportive nella scuola secondaria di I grado",
    ordine: 'secondaria1',
    materie: ['ed_fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-50',
    denominazione: "Scienze naturali, chimiche e biologiche",
    ordine: 'secondaria2',
    materie: ['scienze','chimica','biologia','scienze_terra'],
    requisitiCfu: [],
  },
  {
    codice: 'A-51',
    denominazione: "Scienze, tecnologie e tecniche agrarie",
    ordine: 'secondaria2',
    materie: ['agricoltura','scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'A-52',
    denominazione: "Scienze, tecnologie e tecniche di produzioni animali",
    ordine: 'secondaria2',
    materie: ['agricoltura'],
    requisitiCfu: [],
  },
  {
    codice: 'A-53',
    denominazione: "Storia della musica e della danza",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-54',
    denominazione: "Storia dell'arte",
    ordine: 'secondaria2',
    materie: ['arte','storia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-55',
    denominazione: "Strumento musicale negli istituti di istruzione superiore di II grado",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-56',
    denominazione: "Strumento musicale nella scuola secondaria di I grado",
    ordine: 'secondaria1',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-57',
    denominazione: "Tecnica della danza classica",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-58',
    denominazione: "Tecnica della danza contemporanea",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-59',
    denominazione: "Tecniche di accompagnamento alla danza",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-60',
    denominazione: "Tecnologia nella scuola secondaria di I grado",
    ordine: 'secondaria1',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-61',
    denominazione: "Tecnologie e tecniche delle comunicazioni multimediali",
    ordine: 'secondaria2',
    materie: ['tecnologia','informatica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-62',
    denominazione: "Tecnologie e tecniche per la grafica",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'A-63',
    denominazione: "Tecnologie musicali",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-64',
    denominazione: "Teoria, analisi e composizione",
    ordine: 'secondaria2',
    materie: ['musica'],
    requisitiCfu: [],
  },
  {
    codice: 'A-65',
    denominazione: "Teoria e tecnica della comunicazione",
    ordine: 'secondaria2',
    materie: ['sociale'],
    requisitiCfu: [],
  },
  {
    codice: 'A-66',
    denominazione: "Trattamento testi, dati ed applicazioni. Informatica (ad esaurimento)",
    ordine: 'secondaria2',
    materie: ['informatica','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-01',
    denominazione: "Attività pratiche speciali (Insegnamento non più esistente)",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-02',
    denominazione: "Conversazione in lingua straniera",
    ordine: 'secondaria2',
    materie: ['inglese','francese','spagnolo','tedesco'],
    requisitiCfu: [],
  },
  {
    codice: 'B-03',
    denominazione: "Laboratori di Fisica",
    ordine: 'secondaria2',
    materie: ['fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'B-04',
    denominazione: "Laboratori di liuteria",
    ordine: 'secondaria2',
    materie: ['musica','arte'],
    requisitiCfu: [],
  },
  {
    codice: 'B-05',
    denominazione: "Laboratorio di logistica",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-06',
    denominazione: "Laboratorio di odontotecnica",
    ordine: 'secondaria2',
    materie: ['scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'B-07',
    denominazione: "Laboratorio di ottica",
    ordine: 'secondaria2',
    materie: ['scienze','fisica'],
    requisitiCfu: [],
  },
  {
    codice: 'B-08',
    denominazione: "Laboratori di produzioni industriali ed artigianali della ceramica",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-09',
    denominazione: "Laboratori di scienze e tecnologie aeronautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-10',
    denominazione: "Laboratori di scienze e tecnologie delle costruzioni aeronautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-11',
    denominazione: "Laboratori di scienze e tecnologie agrarie",
    ordine: 'secondaria2',
    materie: ['agricoltura','scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'B-12',
    denominazione: "Laboratori di scienze e tecnologie chimiche e microbiologiche",
    ordine: 'secondaria2',
    materie: ['chimica','biologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-13',
    denominazione: "Laboratori di scienze e tecnologie della calzatura e della moda",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-14',
    denominazione: "Laboratori di scienze e tecnologie delle costruzioni",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-15',
    denominazione: "Laboratori di scienze e tecnologie elettriche ed elettroniche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-16',
    denominazione: "Laboratori di scienze e tecnologie informatiche",
    ordine: 'secondaria2',
    materie: ['informatica','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-17',
    denominazione: "Laboratori di scienze e tecnologie meccaniche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-18',
    denominazione: "Laboratori di scienze e tecnologie tessili, dell'abbigliamento e della moda",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-19',
    denominazione: "Laboratori di servizi di ricettività alberghiera",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-20',
    denominazione: "Laboratori di servizi enogastronomici, settore cucina",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-21',
    denominazione: "Laboratori di servizi enogastronomici, settore sala e vendita",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-22',
    denominazione: "Laboratori di tecnologie e tecniche delle comunicazioni multimediali",
    ordine: 'secondaria2',
    materie: ['tecnologia','informatica'],
    requisitiCfu: [],
  },
  {
    codice: 'B-23',
    denominazione: "Laboratori per i servizi socio-sanitari",
    ordine: 'secondaria2',
    materie: ['sociale'],
    requisitiCfu: [],
  },
  {
    codice: 'B-24',
    denominazione: "Laboratorio di scienze e tecnologie nautiche",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-25',
    denominazione: "Laboratorio di scienze e tecnologie delle costruzioni navali",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-26',
    denominazione: "Laboratorio di tecnologie del legno",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-27',
    denominazione: "Laboratorio di tecnologie del marmo",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-28',
    denominazione: "Laboratorio di tecnologie orafe",
    ordine: 'secondaria2',
    materie: ['arte','tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-29',
    denominazione: "Gabinetto fisioterapico",
    ordine: 'secondaria2',
    materie: ['scienze'],
    requisitiCfu: [],
  },
  {
    codice: 'B-30',
    denominazione: "Addetto all'ufficio tecnico",
    ordine: 'secondaria2',
    materie: ['tecnologia'],
    requisitiCfu: [],
  },
  {
    codice: 'B-31',
    denominazione: "Esercitazioni pratiche per centralinisti telefonici",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-32',
    denominazione: "Esercitazioni di pratica professionale",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'B-33',
    denominazione: "Assistente di Laboratorio",
    ordine: 'secondaria2',
    materie: [],
    requisitiCfu: [],
  },
  {
    codice: 'ESP-ESTERNI',
    denominazione: 'Esperti esterni per progetti PON / PNRR',
    ordine: 'pon',
    materie: ['digital_skills','stem','robotica','orientamento','progettazione','beni_culturali','agricoltura','sociale'],
    requisitiCfu: [
      { ambito: "Competenze professionali coerenti con il progetto", cfu: 12 },
    ],
  },
  {
    codice: 'CPIA-ASSO',
    denominazione: 'Docente CPIA – Alfabetizzazione e primo livello',
    ordine: 'cpia',
    materie: ['italiano','matematica','italiano_l2','alfabetizzazione','educazione_adulti'],
    requisitiCfu: [
      { ambito: "Discipline dell'istruzione di base", cfu: 24 },
    ],
  },
  {
    codice: 'ATA-CS',
    denominazione: 'Collaboratore scolastico (Personale ATA)',
    ordine: 'ata',
    materie: ['collaboratore'],
    requisitiCfu: [
      { ambito: "Diploma di istruzione secondaria", cfu: 0 },
    ],
  },
  {
    codice: 'ATA-AT',
    denominazione: 'Assistente tecnico (Personale ATA)',
    ordine: 'ata',
    materie: ['assistente_tecnico'],
    requisitiCfu: [
      { ambito: "Diploma tecnico coerente con il laboratorio", cfu: 0 },
    ],
  },
  {
    codice: 'ATA-AA',
    denominazione: 'Assistente amministrativo (Personale ATA)',
    ordine: 'ata',
    materie: ['assistente_amministrativo'],
    requisitiCfu: [
      { ambito: "Diploma di istruzione secondaria", cfu: 0 },
    ],
  },
];

/**
 * Normalizza un codice di classe per il CONFRONTO: le fonti ufficiali scrivono
 * spesso il formato a 3 cifre (`A-026`) o compatto (`A042`), mentre il catalogo
 * usa il formato a 2 cifre (`A-26`). Senza normalizzazione la ricerca fallisce.
 */
const normalizzaCodice = (codice?: string | null): string => {
  const c = (codice ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return '';
  const m = c.match(/^([A-Z]{1,2})-0*(\d{1,3})$/) ?? c.match(/^([A-Z])0*(\d{2,3})$/);
  return m ? `${m[1]}-${Number(m[2])}` : c;
};

/** Dizionario id-materia → nome leggibile (dal catalogo `ordiniMaterie`). */
const nomeMateria = new Map(catalogoMaterie.map((m) => [m.id, m.nome]));

export const classeByCodice = (codice: string): ClasseConcorso | undefined => {
  const target = normalizzaCodice(codice);
  return classiConcorso.find((c) => normalizzaCodice(c.codice) === target);
};

export const classiByMateria = (materiaId: string): ClasseConcorso[] =>
  classiConcorso.filter((c) => c.materie.includes(materiaId));

/* --------------------------------- SOSTEGNO --------------------------------- */
/**
 * L'area SOSTEGNO (special education) è un MONDO DI ABILITAZIONI SEPARATO dalle
 * classi disciplinari: un docente di tedesco (A-22/A-25) NON è automaticamente
 * abilitato al sostegno (ADEE/ADMM/ADSS) e non deve riceverne gli avvisi. Questi
 * helper sono la fonte unica della distinzione, usata da matching, digest e UI.
 */

/**
 * Codici di sostegno del CATALOGO dell'app: ADAA (infanzia), ADEE (primaria),
 * ADMM (secondaria di I grado), ADSS (secondaria di II grado).
 */
export const codiciSostegno: string[] = classiConcorso
  .filter((c) => c.materie.includes('sostegno'))
  .map((c) => c.codice);

/**
 * Forma di TUTTI i codici sostegno pubblicati dagli uffici scolastici: la sigla
 * canonica del catalogo + le varianti numeriche usate dalle fonti (`AD24`, …).
 * In Italia ogni classe di sostegno inizia per `AD`, quindi il pattern è chiuso.
 */
const RE_CODICE_SOSTEGNO = /^AD(?:[A-Z]{2,3}|\d{2})$/;

/**
 * True se il codice è una classe di concorso di SOSTEGNO (ADAA, ADEE, ADMM, ADSS,
 * AD24, …). Falso per le classi disciplinari (A-22, A-25, B-02, AAAA, EEEE…).
 */
export function isCodiceSostegno(codice?: string | null): boolean {
  const c = (codice ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return false;
  return RE_CODICE_SOSTEGNO.test(c) || codiciSostegno.includes(c);
}

/**
 * Parole chiave che dichiarano il SOSTEGNO nel titolo/oggetto o nella materia
 * inferita dallo scraper. NB: "inclusione" è volutamente ESCLUSA perché troppo
 * generica (compare in bandi PNRR/progetti didattici non di sostegno e
 * taglierebbe opportunità legittime a chi non ha aderito).
 */
const RE_TESTO_SOSTEGNO = /\bsostegn|\b(?:adaa|adee|admm|adss)\b|\bad24\b/i;

/**
 * True se l'avviso è un avviso di SOSTEGNO: basta un codice sostegno rilevato nel
 * testo (`classi`) oppure un riferimento esplicito nel titolo ("Interpello
 * sostegno") / nella materia inferita ("Sostegno"). Serve a NON confondere un
 * interpello di sostegno con un interpello disciplinare che cita le stesse classi
 * di concorso (falso positivo storico: docente di tedesco → interpelli ADEE).
 */
export function eAvvisoSostegno(
  classi?: readonly string[] | null,
  titolo?: string | null,
  materia?: string | null,
): boolean {
  if ((classi ?? []).some((c) => isCodiceSostegno(c))) return true;
  return RE_TESTO_SOSTEGNO.test(`${titolo ?? ''} ${materia ?? ''}`);
}

/**
 * Materia ufficiale da mostrare ACCANTO al codice di classe di concorso
 * (es. `A-12 · Italiano, Storia, Geografia, Latino`). Priorità:
 *   1. materia esplicita dell'avviso (estratta dal testo dallo scraper);
 *   2. elenco materie ufficiale del dizionario (`classiConcorso`);
 *   3. denominazione estesa della classe (es. classi senza materie: infanzia/primaria).
 * Ritorna `null` se il codice non è riconosciuto e nessuna materia è fornita.
 */
export function materiaClasse(
  codice?: string | null,
  materiaEsplicita?: string | null,
): string | null {
  const esplicita = (materiaEsplicita ?? '').trim();
  if (esplicita) return esplicita;
  const classe = classeByCodice(codice ?? '');
  if (!classe) return null;
  const nomi = classe.materie.map((id) => nomeMateria.get(id) ?? id).filter(Boolean);
  return nomi.length > 0 ? nomi.join(', ') : classe.denominazione || null;
}

/**
 * Etichette leggibili per i profili ATA: le fonti citano spesso solo
 * l'abbreviazione, ma post/notifiche non devono MAI mostrare il solo codice.
 */
const ATA_ALIAS: Record<string, string> = {
  AA: 'Assistente amministrativo',
  AT: 'Assistente tecnico',
  CS: 'Collaboratore scolastico',
  DSGA: 'Direttore dei servizi generali e amministrativi',
};


/**
 * Etichetta leggibile `CODICE - Nome materia/classe` da usare nei post pubblici,
 * nelle notifiche (Telegram/email) e nelle schede. Esempio:
 *   `A-41 - Scienze e tecnologie informatiche`
 * Nome = denominazione UFFICIALE della classe di concorso (dizionario). Se
 * l'avviso specifica una materia diversa (es. supplenza su singola disciplina),
 * la si aggiunge tra parentesi. Se il codice è ignoto si ripiega sull'elenco
 * materie (`materiaClasse`), così non si mostra MAI il solo codice.
 */
export function etichettaClasseMateria(
  codice?: string | null,
  materiaEsplicita?: string | null,
): string {
  const code = (codice ?? '').trim();
  const esplicita = (materiaEsplicita ?? '').trim();
  const ufficiale =
    classeByCodice(code)?.denominazione?.trim() || ATA_ALIAS[code.toUpperCase()] || '';
  const fallback = ufficiale ? '' : (materiaClasse(code, '') ?? '');

  let nome = ufficiale || fallback;
  if (esplicita && esplicita.toLowerCase() !== nome.toLowerCase()) {
    nome = nome ? `${nome} (${esplicita})` : esplicita;
  }
  if (!code) return nome;
  return nome ? `${code} - ${nome}` : code;
}

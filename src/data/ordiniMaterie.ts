export type OrdineScuola =
  | 'infanzia'
  | 'primaria'
  | 'secondaria1'
  | 'secondaria2'
  | 'cpia'
  | 'serali'
  | 'pon'
  | 'ata';

export interface OrdineInfo {
  id: OrdineScuola;
  nome: string;
  descrizione: string;
}

export const ordiniScuola: OrdineInfo[] = [
  { id: 'infanzia', nome: 'Scuola dell\'Infanzia', descrizione: 'Bambini da 3 a 6 anni' },
  { id: 'primaria', nome: 'Scuola Primaria', descrizione: 'Bambini da 6 a 11 anni' },
  { id: 'secondaria1', nome: 'Scuola Secondaria di I grado', descrizione: 'Ragazzi da 11 a 14 anni' },
  { id: 'secondaria2', nome: 'Scuola Secondaria di II grado', descrizione: 'Ragazzi da 14 a 19 anni' },
  { id: 'cpia', nome: 'Scuole per Adulti / CPIA', descrizione: 'Istruzione per adulti e percorsi di alfabetizzazione' },
  { id: 'serali', nome: 'Corsi Serali e Sezioni Carcerarie', descrizione: 'Istruzione serale e percorsi detentivi' },
  { id: 'pon', nome: 'Progetti PON / PNRR & Esperti Esterni', descrizione: 'Esperti esterni e progetti finanziati' },
  { id: 'ata', nome: 'Personale ATA / Collaboratori scolastici', descrizione: 'Non docente: collaboratori, assistenti, coordinatori' },
];

export interface Materia {
  id: string;
  nome: string;
}

export const materie: Materia[] = [
  { id: 'italiano', nome: 'Italiano' },
  { id: 'matematica', nome: 'Matematica' },
  { id: 'storia', nome: 'Storia' },
  { id: 'geografia', nome: 'Geografia' },
  { id: 'scienze', nome: 'Scienze' },
  { id: 'inglese', nome: 'Lingua inglese' },
  { id: 'francese', nome: 'Lingua francese' },
  { id: 'spagnolo', nome: 'Lingua spagnola' },
  { id: 'tedesco', nome: 'Lingua tedesca' },
  { id: 'filosofia', nome: 'Filosofia' },
  { id: 'fisica', nome: 'Fisica' },
  { id: 'chimica', nome: 'Chimica' },
  { id: 'biologia', nome: 'Biologia' },
  { id: 'scienze_terra', nome: 'Scienze della Terra' },
  { id: 'arte', nome: 'Arte e immagine' },
  { id: 'musica', nome: 'Musica' },
  { id: 'ed_fisica', nome: 'Educazione fisica' },
  { id: 'tecnologia', nome: 'Tecnologia' },
  { id: 'diritto', nome: 'Diritto ed economia' },
  { id: 'latino', nome: 'Latino' },
  { id: 'greco', nome: 'Greco' },
  { id: 'religione', nome: 'Religione cattolica' },
  { id: 'informatica', nome: 'Informatica' },
  { id: 'educazione_civica', nome: 'Educazione civica' },
  { id: 'scienze_umane', nome: 'Scienze umane' },
  { id: 'psicologia', nome: 'Psicologia' },
  { id: 'pedagogia', nome: 'Pedagogia' },
  { id: 'sostegno', nome: 'Sostegno' },
  { id: 'alfabetizzazione', nome: 'Alfabetizzazione L2' },
  { id: 'italiano_l2', nome: 'Italiano per stranieri' },
  { id: 'mediazione', nome: 'Mediazione linguistica e culturale' },
  { id: 'educazione_adulti', nome: 'Educazione degli adulti' },
  { id: 'progettazione', nome: 'Progettazione e gestione progetti' },
  { id: 'digital_skills', nome: 'Competenze digitali' },
  { id: 'orientamento', nome: 'Orientamento scolastico e professionale' },
  { id: 'robotica', nome: 'Robotica e coding' },
  { id: 'stem', nome: 'STEM e laboratori scientifici' },
  { id: 'didattica_digitale', nome: 'Didattica digitale' },
  { id: 'intelligenza_artificiale', nome: 'Intelligenza artificiale' },
  { id: 'metodologie_innovative', nome: 'Metodologie didattiche innovative' },
  { id: 'educazione_linguistica', nome: 'Educazione linguistica' },
  { id: 'clil', nome: 'CLIL' },
  { id: 'coding_robotica', nome: 'Coding e Robotica' },
  { id: 'digital_storytelling', nome: 'Digital storytelling (narrazione digitale)' },
  { id: 'creativita_digitale', nome: 'Creatività digitale e making' },
  { id: 'beni_culturali', nome: 'Beni culturali e turismo' },
  { id: 'agricoltura', nome: 'Sistemi agricoli e agroalimentari' },
  { id: 'sociale', nome: 'Sociologia e servizio sociale' },
  { id: 'collaboratore', nome: 'Collaboratore scolastico (ATA)' },
  { id: 'assistente_tecnico', nome: 'Assistente tecnico (ATA)' },
  { id: 'assistente_amministrativo', nome: 'Assistente amministrativo (ATA)' },
  { id: 'coordinatore', nome: 'Coordinatore servizi generali (DSGA)' },
];

/**
 * MATERIE DI BASE (le discipline curricolari “da cattedra”).
 *
 * Non compaiono nella sezione delle COMPETENZE EXTRA del Radar: lì l'utente
 * cerca ciò che può proporre OLTRE la propria classe di concorso (bandi PNRR,
 * laboratori, progetti). Mostrare “Storia” o “Geografia” in quella lista era
 * fuorviante: la cattedra si intercetta già con le classi di concorso.
 */
export const MATERIE_GENERICHE: ReadonlySet<string> = new Set([
  'italiano',
  'matematica',
  'storia',
  'geografia',
  'scienze',
  'inglese',
  'francese',
  'spagnolo',
  'tedesco',
  'filosofia',
  'fisica',
  'chimica',
  'biologia',
  'scienze_terra',
  'arte',
  'musica',
  'ed_fisica',
  'tecnologia',
  'diritto',
  'latino',
  'greco',
  'religione',
  'informatica',
  'educazione_civica',
  'scienze_umane',
  'psicologia',
  'pedagogia',
]);

/** Materie/competenze proposte nella sezione “competenze extra” del Radar. */
export function materieCompetenzeExtra(): Materia[] {
  return materie.filter((m) => !MATERIE_GENERICHE.has(m.id));
}

/**
 * COMPETENZE E LABORATORI ad ALTA RICHIESTA (PNRR/PON, esperti esterni).
 *
 * Sono i profili che le scuole cercano più spesso nei bandi per esperti e tutor:
 * vengono PROPOSTI come chip a un click nella sezione “Le tue competenze e
 * laboratori extra da proporre”. Il testo scritto a mano resta sempre possibile.
 */
export interface CompetenzaSuggerita {
  /** Etichetta mostrata nel chip (linguaggio dei bandi scolastici). */
  nome: string;
  /** Id della materia di catalogo corrispondente (per il matching e il salvataggio). */
  materiaId: string;
}

export const competenzeSuggerite: CompetenzaSuggerita[] = [
  { nome: 'Intelligenza artificiale nella didattica', materiaId: 'intelligenza_artificiale' },
  { nome: 'Robotica educativa', materiaId: 'robotica' },
  { nome: 'Digital storytelling', materiaId: 'digital_storytelling' },
  { nome: 'Metodologia CLIL', materiaId: 'clil' },
  { nome: 'Creatività digitale', materiaId: 'creativita_digitale' },
];


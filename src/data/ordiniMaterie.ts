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
  { id: 'beni_culturali', nome: 'Beni culturali e turismo' },
  { id: 'agricoltura', nome: 'Sistemi agricoli e agroalimentari' },
  { id: 'sociale', nome: 'Sociologia e servizio sociale' },
  { id: 'collaboratore', nome: 'Collaboratore scolastico (ATA)' },
  { id: 'assistente_tecnico', nome: 'Assistente tecnico (ATA)' },
  { id: 'assistente_amministrativo', nome: 'Assistente amministrativo (ATA)' },
  { id: 'coordinatore', nome: 'Coordinatore servizi generali (DSGA)' },
];

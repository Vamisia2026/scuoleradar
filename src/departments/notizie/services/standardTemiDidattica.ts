/**
 * ScuoleRadar.it — Dipartimento Notizie · STANDARD EDITORIALE · INNOVAZIONE,
 * DIDATTICA E PEDAGOGIA.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Secondo blocco dell'allow-list: la scuola come dibattito culturale e
 * didattico, per ordine di scuola (infanzia/primaria, secondaria di I e II
 * grado). Sono gli unici temi con `fattoConcreto: true`: entrano nel feed SOLO
 * con una scadenza reale o un canale ufficiale di candidatura, mai come puro
 * comunicato, webinar o convegno.
 */
import type { TemaOperativo } from './standardTemiPersonale';
import { PAROLE_DIDATTICA_ORDINI, RIFERIMENTI_PEDAGOGICI } from './lessicoScuola';

/** Temi culturali e didattici: sotto filtro `fattoConcreto`. */
export const TEMI_DIDATTICA: TemaOperativo[] = [
  {
    categoria: 'Innovazione Digitale',
    area: 'Innovazione didattica e strumenti',
    autosufficiente: false,
    fattoConcreto: true,
    peso: 72,
    parole: [
      'pnsd', 'piano nazionale scuola digitale', 'animatore digitale',
      'team digitale', 'coding', 'robotica educativa', 'steam', 'stem',
      'intelligenza artificiale', 'ia generativa', 'didattica digitale',
      'didattica digitale integrata', 'ambienti di apprendimento innovativi',
      'laboratori digitali', 'transizione digitale', 'piattaforme digitali',
    ],
  },
  {
    categoria: 'Didattica',
    area: 'Innovazione didattica e strumenti',
    autosufficiente: false,
    fattoConcreto: true,
    peso: 68,
    parole: [
      ...PAROLE_DIDATTICA_ORDINI,
      'didattica', 'didattica laboratoriale', 'didattica orientativa',
      'curricolo', 'programmazione didattica', 'valutazione degli apprendimenti',
      'certificazione delle competenze', 'competenze chiave',
    ],
  },
  {
    categoria: 'Pedagogia',
    area: 'Pedagogia, filosofia e riferimenti culturali',
    autosufficiente: false,
    fattoConcreto: true,
    peso: 66,
    parole: [
      ...RIFERIMENTI_PEDAGOGICI,
      'pedagogia', 'pedagogic', 'storia della filosofia',
      'didattica della filosofia', 'epistemologia', 'divulgazione scientifica',
    ],
  },
];

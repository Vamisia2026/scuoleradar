/**
 * ScuoleRadar.it — Dipartimento Notizie · STANDARD EDITORIALE · INTELLIGENZA
 * ARTIFICIALE.
 *
 * Riferimento permanente: docs/BLOG_EDITORIAL_GUIDELINES.md
 *
 * Blocco AUTONOMO del tema 'Intelligenza Artificiale': l'IA nasceva dentro
 * 'Innovazione Digitale', confusa con PNSD, coding e robotica educativa. Ora ha
 * una categoria propria (`PESI_CATEGORIA`, copy dell'articolo, badge nel feed)
 * e un lessico proprio (`PAROLE_IA` in `lessicoScuola.ts`).
 *
 * POSIZIONE nell'allow-list (`editorialStandard.ts`): dopo i temi del personale
 * e PRIMA dei temi didattici. Così un nuovo tema non ruba il match ai temi
 * storici (una «formazione sull'IA per i docenti» resta 'Formazione'), ma vince
 * su 'Innovazione Digitale' e 'Didattica', che sono i temi da cui l'IA si
 * separa.
 *
 * REGOLE: `autosufficiente: false` (serve un contesto di personale scolastico)
 * e `fattoConcreto: true`: la notizia sull'IA entra in bacheca SOLO con una
 * scadenza reale o un canale ufficiale di domanda/candidatura, mai come
 * comunicato, webinar o convegno sull'intelligenza artificiale.
 */
import type { TemaOperativo } from './standardTemiPersonale';
import { PAROLE_IA } from './lessicoScuola';

/** Tema autonomo dell'intelligenza artificiale: sotto filtro `fattoConcreto`. */
export const TEMI_IA: TemaOperativo[] = [
  {
    categoria: 'Intelligenza Artificiale',
    area: 'Innovazione didattica e strumenti',
    autosufficiente: false,
    fattoConcreto: true,
    peso: 76,
    parole: PAROLE_IA,
  },
];

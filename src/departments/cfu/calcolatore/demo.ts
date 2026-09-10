/**
 * ScuoleRadar.it — Dipartimento CFU · Dati dimostrativi.
 *
 * Libretto di esempio usato dallo Step B per far vedere subito il percorso
 * completo (analisi → diagnosi → dossier) senza dover avere un documento a
 * portata di mano. I dati sono chiaramente marcati come dimostrativi nella UI.
 */

import type { Esame } from '../shared/types';

export const ETICHETTA_DEMO = 'Piano di studi di esempio';

/** Esami dimostrativi (un laureato in Matematica con esami pedagogici). */
export function caricaEsamiDemo(): Esame[] {
  return [
    {
      id: 'demo-mat05-1',
      denominazione: 'Analisi matematica I',
      cfu: 9,
      ssd: 'MAT/05',
      voto: 28,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-mat02-1',
      denominazione: 'Algebra',
      cfu: 9,
      ssd: 'MAT/02',
      voto: 27,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-mat03-1',
      denominazione: 'Geometria',
      cfu: 6,
      ssd: 'MAT/03',
      voto: 26,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-fis01-1',
      denominazione: 'Fisica generale I',
      cfu: 6,
      ssd: 'FIS/01',
      voto: 25,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-fis01-2',
      denominazione: 'Fisica generale II',
      cfu: 6,
      ssd: 'FIS/01',
      voto: 24,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-lin12-1',
      denominazione: 'Lingua inglese (livello B2)',
      cfu: 6,
      ssd: 'L-LIN/12',
      voto: 30,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
    {
      id: 'demo-mped01-1',
      denominazione: 'Pedagogia generale',
      cfu: 6,
      ssd: 'M-PED/01',
      voto: 28,
      fonte: 'manuale',
      affidabilita: 'alta',
    },
  ];
}

/**
 * Supporto del pannello Admin «Email & Automazioni» — tipi e funzioni pure.
 *
 * Modulo condiviso tra il tab (`TabEmailAutomazioni`), la riga di tabella
 * (`RigaAutomazione`) e l'hook di stato (`hooks/useAutomazioniEmail`): evita di
 * duplicare la definizione della bozza dei testi e dei gruppi del filtro.
 */
import { testoAnteprima, type GruppoAutomazione, type StatoAutomazione } from '@/config/automazioniEmail';

/** Ordine di presentazione dei gruppi (filtro rapido del pannello). */
export const GRUPPI: readonly GruppoAutomazione[] = ['Onboarding', 'Radar', 'Abbonamento', 'Beta'];

/** Bozza dei testi modificabili di UNA automazione. */
export interface BozzaTesti {
  oggetto: string;
  intro: string;
  corpo: string;
}

/** Bozza iniziale: testi salvati (stringa vuota = copy del codice). */
export function bozzaDaStato(stato: StatoAutomazione): BozzaTesti {
  return {
    oggetto: stato.oggetto ?? '',
    intro: stato.intro ?? '',
    corpo: stato.corpo ?? '',
  };
}

/** true se esistono testi personalizzati salvati per l'automazione. */
export function personalizzata(stato: StatoAutomazione): boolean {
  return Boolean(stato.oggetto || stato.intro || stato.corpo);
}

/** Filtro per gruppo: `tutti` oppure uno dei gruppi del catalogo. */
export type FiltroGruppo = 'tutti' | GruppoAutomazione;

/** Testi mostrati nell'anteprima (oggetto, intro e corpo già interpolati). */
export type TestiAnteprima = ReturnType<typeof testoAnteprima>;

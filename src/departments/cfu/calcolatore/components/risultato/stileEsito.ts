/**
 * Calcolatore CFU · stile e etichette del risultato V1.
 *
 * Un solo posto per tradurre lo STATO del motore in una lettura visiva:
 * colore, tono e parola. Nessun componente decide autonomamente come chiamare
 * un esito, così la stessa parola non assume due significati diversi in pagina.
 */
import type { StatoEsitoUtente } from '../../esitoUtente';
import type { EsitoRequisitoUtente } from '../../requisitoUtente';

/** Aspetto visivo di un esito di classe. */
export interface StileEsito {
  /** Etichetta breve mostrata come badge accanto al titolo. */
  readonly badge: string;
  /** Classi tailwind del contenitore principale. */
  readonly contenitore: string;
  /** Classi tailwind del badge. */
  readonly badgeClassi: string;
}

const STILI: Record<StatoEsitoUtente, StileEsito> = {
  ELIGIBLE: {
    badge: 'Ammissibile',
    contenitore: 'border-accent-200 bg-accent-50/60',
    badgeClassi: 'bg-accent-500 text-white',
  },
  CONDITIONALLY_ELIGIBLE: {
    badge: 'Ammissibile con integrazione',
    contenitore: 'border-secondary-200 bg-secondary-50/60',
    badgeClassi: 'bg-secondary-600 text-white',
  },
  INSUFFICIENT_DATA: {
    badge: 'Dati da completare',
    contenitore: 'border-slate-200 bg-slate-50',
    badgeClassi: 'bg-slate-600 text-white',
  },
  MANUAL_VERIFICATION_REQUIRED: {
    badge: 'Serve una verifica',
    contenitore: 'border-warning-200 bg-warning-50/60',
    badgeClassi: 'bg-warning-500 text-white',
  },
  NOT_ELIGIBLE: {
    badge: 'Accesso non consentito',
    contenitore: 'border-error-200 bg-error-50/50',
    badgeClassi: 'bg-error-600 text-white',
  },
};

export function stileEsito(stato: StatoEsitoUtente): StileEsito {
  return STILI[stato];
}

/** Etichetta e stile di una voce di requisito. */
export function stileRequisito(esito: EsitoRequisitoUtente): {
  etichetta: string;
  classi: string;
} {
  switch (esito) {
    case 'soddisfatto':
      return { etichetta: 'Soddisfatto', classi: 'bg-accent-500 text-white' };
    case 'non-soddisfatto':
      return { etichetta: 'Non soddisfatto', classi: 'bg-error-100 text-error-800 ring-1 ring-error-200' };
    case 'da-verificare':
      return { etichetta: 'Da verificare', classi: 'bg-warning-100 text-warning-800 ring-1 ring-warning-200' };
  }
}

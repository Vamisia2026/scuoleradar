/**
 * Header — tipi derivati dal contesto applicativo.
 *
 * Derivano da `useApp()` invece di essere ricopiati: se il contesto cambia
 * (nuovo piano, nuovo stato di caricamento), i sotto-componenti dell'header
 * restano allineati senza toccare le union a mano.
 */
import type { useApp } from '@/contexts/AppContext';

/** Piano dell'utente: 'base' | 'pro' | 'free_forever' (dal contesto). */
export type PianoUtente = ReturnType<typeof useApp>['piano'];

/** Stato di caricamento del piano: 'loading' | 'pronto' (dal contesto). */
export type StatoPiano = ReturnType<typeof useApp>['pianoStato'];

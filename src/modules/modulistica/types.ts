/**
 * ScuoleRadar.it — Tipi condivisi del modulo Modulistica.
 * Isolati nel modulo `src/modules/modulistica/` per non dipendere dal resto dell'app.
 */
import type { Modulo } from '@/data/moduli';

/** Viste della sezione Modulistica. */
export type VistaModulistica = 'catalogo' | 'genera' | 'miei';

/** Riga della tabella Supabase `user_saved_modules`. */
export interface ModuloSalvatoDB {
  id: string;
  module_key: string;
  module_source: 'generated' | 'catalogo';
  title: string;
  tipo: string;
  created_at: string;
}

/** Voce combinata (localStorage + DB) della lista "I miei Modelli Scaricati". */
export interface VoceModulo {
  key: string;
  source: 'generated' | 'catalogo';
  title: string;
  tipo: string;
  data: string;
  /** Modulo del catalogo corrispondente (per i download dal catalogo). */
  catalogo?: Modulo;
}

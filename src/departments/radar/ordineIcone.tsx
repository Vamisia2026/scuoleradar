/**
 * ScuoleRadar.it — Dipartimento Radar · icone degli ordini di scuola.
 *
 * FONTE UNICA delle icone di ordine: prima erano duplicate (con dimensioni
 * diverse) nel wizard e nella bacheca preferenze, con il rischio di divergenza
 * silenziosa quando si aggiunge un ordine di scuola.
 *
 * La dimensione è parametrica e la funzione ritorna un `Record` (non un
 * componente) per non toccare i call-site esistenti che indicizzano per ordine.
 */
import type { ReactNode } from 'react';
import { Baby, BookOpen, Briefcase, GraduationCap, Moon, School, Users, Wrench } from 'lucide-react';
import type { OrdineScuola } from '@/data/ordiniMaterie';

/** Dimensione delle icone: grande nel wizard, compatta nella bacheca preferenze. */
export type DimensioneIconaOrdine = 'h-5 w-5' | 'h-6 w-6';

/**
 * Mappa `ordine di scuola → icona` per la dimensione richiesta.
 * Un ordine di scuola nuovo va aggiunto SOLO qui.
 */
export function creaIconeOrdine(
  dimensione: DimensioneIconaOrdine = 'h-5 w-5',
): Record<OrdineScuola, ReactNode> {
  return {
    infanzia: <Baby className={dimensione} />,
    primaria: <School className={dimensione} />,
    secondaria1: <BookOpen className={dimensione} />,
    secondaria2: <GraduationCap className={dimensione} />,
    cpia: <Users className={dimensione} />,
    serali: <Moon className={dimensione} />,
    pon: <Briefcase className={dimensione} />,
    ata: <Wrench className={dimensione} />,
  };
}

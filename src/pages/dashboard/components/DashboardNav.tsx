/**
 * Dashboard · barra di navigazione tra i dipartimenti montati.
 *
 * Pill orizzontale scrollabile (mobile-first): una tab per dipartimento, con
 * badge «Novembre» sulla voce in evidenza. La lista arriva dal guscio
 * (`DashboardLayout`), così le rotte vivono in un solo punto.
 *
 * Presentazione pura: nessuno stato, nessun dato dal contesto.
 */
import { NavLink } from 'react-router-dom';
import type { DipartimentoId } from '@/config/features';

/** Voce della barra di navigazione della dashboard. */
export interface TabNav {
  /** Rotta di destinazione (path assoluto). */
  to: string;
  /** Etichetta mostrata (contiene già l'emoji del dipartimento). */
  label: string;
  /** true = match esatto della rotta (evita l'attivo sui path annidati). */
  end?: boolean;
  /** Voce in evidenza, con badge «Novembre». */
  accent?: boolean;
  /** Dipartimento che governa la visibilità della tab (feature flags). */
  modulo: DipartimentoId;
  /** Badge testuale facoltativo (es. «TEST» sui moduli non ancora pubblici). */
  badge?: string;
}

interface DashboardNavProps {
  /** Tab da mostrare, nell'ordine di visualizzazione. */
  tabs: TabNav[];
}

export function DashboardNav({ tabs }: DashboardNavProps) {
  return (
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white p-1.5 shadow-card">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-primary-500 text-white shadow-soft'
                    : t.accent
                      ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 hover:bg-accent-100'
                      : 'text-primary-700 hover:bg-primary-50'
                }`
              }
            >
              {t.label}
              {t.badge && (
                <span className="rounded-full bg-warning-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                  {t.badge}
                </span>
              )}
              {t.accent && (
                <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Novembre
                </span>
              )}
            </NavLink>
          ))}
        </nav>
  );
}

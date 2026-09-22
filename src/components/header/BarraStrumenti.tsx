/**
 * Header — Barra Servizi/Strumenti (livello inferiore, desktop).
 *
 * Mostra i link dell'area riservata con evidenziazione della rotta attiva e
 * badge accent sulla voce in promozione. Nessuna prop: i dati arrivano da
 * `strumentiLinks`; la visibilità (nascosta in dashboard) la decide il
 * contenitore, mentre le voci dei dipartimenti non disponibili sono filtrate
 * dalle feature flags (`useFeatureFlags`).
 */
import { NavLink } from 'react-router-dom';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { strumentiLinks } from './navLinks';

export function BarraStrumenti() {
  // Feature flags: le voci con dipartimento `off` (o `test` per i non admin)
  // spariscono dalla barra. Lo stato è condiviso → cambia senza reload.
  const { visibile } = useFeatureFlags();
  const voci = strumentiLinks.filter((l) => visibile(l.modulo));

  return (
        <div className="hidden border-t border-primary-100 bg-white md:block">
          <nav className="mx-auto flex w-max items-center justify-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {voci.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-soft'
                      : l.accent
                        ? 'bg-accent-50 text-accent-700 ring-1 ring-accent-200 hover:bg-accent-100'
                        : 'text-primary-700 hover:bg-primary-50'
                  }`
                }
              >
                {l.label}
                {l.accent && (
                  <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Novembre
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
  );
}

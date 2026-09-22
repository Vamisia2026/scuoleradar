/**
 * Header — navigazione istituzionale/informativa (visibile da `md` in su).
 *
 * Nessuna prop: è una navigazione statica definita dai dati condivisi in
 * `navLinks.ts`. La versione mobile equivalente vive in `MenuMobile`.
 */
import { NavLink } from 'react-router-dom';
import { navLinks } from './navLinks';

export function NavIstituzionale() {
  return (
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-primary-600 hover:bg-primary-50'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
  );
}

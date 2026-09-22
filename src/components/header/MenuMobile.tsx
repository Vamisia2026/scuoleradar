/**
 * Header — drawer di navigazione mobile (aperto dal toggle hamburger).
 *
 * Contiene: strumenti dell'area riservata, link informativi, riepilogo utente con
 * badge del piano e azioni (Area Personale, profilo, prezzi, uscita) oppure il
 * pulsante «Accedi» per gli ospiti. Presentazione pura: lo stato arriva dal
 * contenitore (`{menuOpen && <MenuMobile … />}`).
 */
import { Link, NavLink } from 'react-router-dom';
import { CreditCard, LogOut, User as UserIcon } from 'lucide-react';
import type { User } from '@/contexts/AppContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { BadgePianoRiga } from './BadgePianoRiga';
import { navLinks, strumentiLinks } from './navLinks';
import type { PianoUtente, StatoPiano } from './tipiUtente';

interface MenuMobileProps {
  /** Utente autenticato, oppure null → si mostra la CTA «Accedi». */
  user: User | null;
  avatarUrl: string | null;
  abbonato: boolean;
  piano: PianoUtente;
  pianoStato: StatoPiano;
  /** Chiude il drawer (click su una voce o azione). */
  chiudiMenu: () => void;
  logout: () => void;
  /** Apre la modale di autenticazione (modalità login). */
  openAuthModal: (mode?: 'login' | 'registrazione') => void;
}

export function MenuMobile({
  user,
  avatarUrl,
  abbonato,
  piano,
  pianoStato,
  chiudiMenu,
  logout,
  openAuthModal,
}: MenuMobileProps) {
  // Feature flags: i dipartimenti in stato `off` (o `test` per i non admin)
  // non compaiono nel drawer.
  const { visibile } = useFeatureFlags();
  const vociStrumenti = strumentiLinks.filter((l) => visibile(l.modulo));

  return (
        <div className="border-t border-primary-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wide text-primary-400">
              Strumenti
            </p>
            {vociStrumenti.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={chiudiMenu}
                className={`rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  l.accent
                    ? 'bg-accent-50 font-semibold text-accent-700 ring-1 ring-accent-200'
                    : 'text-primary-700 hover:bg-primary-50'
                }`}
              >
                {l.label}
                {l.accent && (
                  <span className="ml-1 rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Novembre
                  </span>
                )}
              </Link>
            ))}
            <p className="px-3 pt-2 text-xs font-bold uppercase tracking-wide text-primary-400">Info</p>
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                onClick={chiudiMenu}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-primary-50 text-primary-700' : 'text-primary-600 hover:bg-primary-50'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-primary-100 pt-3">
            {user ? (
              <>
                <div className="flex items-center justify-between px-3">
                  <span className="flex min-w-0 items-center gap-2">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={user.nome}
                        referrerPolicy="no-referrer"
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                        <UserIcon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="truncate text-sm font-medium text-primary-700">
                      {user.nome} {user.cognome}
                    </span>
                  </span>
                  <BadgePianoRiga pianoStato={pianoStato} piano={piano} abbonato={abbonato} />
                </div>
                <Link
                  to="/dashboard"
                  onClick={chiudiMenu}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <UserIcon className="h-4 w-4" />
                  Area Personale
                </Link>
                <Link
                  to="/dashboard/profilo"
                  onClick={chiudiMenu}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                >
                  <UserIcon className="h-4 w-4" />
                  Il mio profilo
                </Link>
                <Link
                  to="/prezzi"
                  onClick={chiudiMenu}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                >
                  <CreditCard className="h-4 w-4" />
                  Prezzi e abbonamento
                </Link>
                <button
                  onClick={() => {
                    logout();
                    chiudiMenu();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-error-200 px-4 py-2.5 text-sm font-medium text-error-600 transition hover:bg-error-50"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    openAuthModal('login');
                    chiudiMenu();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  Accedi
                </button>
              </>
            )}
          </div>
        </div>
  );
}

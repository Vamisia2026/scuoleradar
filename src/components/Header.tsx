import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { LogOut, User as UserIcon, Menu, X, Sparkles, ChevronDown, CreditCard } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { CreditiModal } from '@/components/CreditiModal';

/** Link istituzionali / di supporto (barra superiore). */
const navLinks = [
  { to: '/notizie', label: 'Notizie' },
  { to: '/prezzi', label: 'Prezzi' },
  { to: '/chi-siamo', label: 'Chi siamo' },
];

/** Strumenti principali: barra a pillole uniforme anche da utente non loggato. */
const strumentiLinks = [
  { to: '/dashboard/radar', label: '📡 Radar Interpelli' },
  { to: '/dashboard/cv', label: '📄 Crea il tuo CV' },
  { to: '/dashboard/cfu', label: '🎓 Calcolatore CFU' },
  { to: '/dashboard/moduli', label: '📁 Modulistica' },
  { to: '/dashboard/assistente-ai', label: '🤖 Sindacalista Virtuale' },
  { to: '/dashboard/purefocus', label: '🧘 PureFocus' },
];

export function Header() {
  const { user, abbonato, crediti, logout, openAuthModal } = useApp();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUtenteOpen, setMenuUtenteOpen] = useState(false);
  const [apriCrediti, setApriCrediti] = useState(false);

  const chiudiMenu = () => setMenuOpen(false);
  const chiudiMenuUtente = () => setMenuUtenteOpen(false);
  // Su /dashboard la navigazione a pillole è già fornita dalla barra del DashboardLayout.
  const isDashboard = pathname.startsWith('/dashboard');

  return (
    <header className="sticky top-0 z-30 border-b border-primary-100 bg-white/90 backdrop-blur">
      {/* Livello superiore (Top Bar): Logo | link istituzionali (centro) | Accedi */}
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <a href="/" className="justify-self-start focus:outline-none">
          <img
            src="/ScuoleRadar Logo Transparent Full Final.png"
            alt="ScuoleRadar.it"
            className="max-h-10 w-auto object-contain"
          />
        </a>

        {/* Link istituzionali/informativi — sempre centrati (desktop) */}
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

        {/* Azioni (destra, allineate a fine riga) */}
        <div className="flex items-center justify-self-end gap-2">
          {user ? (
            <div className="relative hidden md:block">
              <div className="flex items-center gap-0.5 rounded-full border border-primary-200 bg-white py-1 pl-1 pr-1 shadow-soft">
                <Link
                  to="/dashboard/radar"
                  aria-label="Torna al Radar interpelli"
                  className="flex items-center gap-2 rounded-full pr-2 transition hover:opacity-90"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
                    <UserIcon className="h-4 w-4" />
                  </span>
                  <span className="max-w-[110px] truncate text-sm font-semibold text-primary-800">
                    {user.nome}
                  </span>
                  {abbonato ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      <Sparkles className="h-3 w-3" /> PRO
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-500">
                      Base
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => setApriCrediti(true)}
                  aria-label="Acquista crediti a consumo"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-secondary-50 px-2 py-0.5 text-[11px] font-semibold text-secondary-700 transition hover:bg-secondary-100"
                >
                  <Sparkles className="h-3 w-3" />
                  Crediti: {crediti}
                </button>
                <button
                  onClick={() => setMenuUtenteOpen((o) => !o)}
                  aria-expanded={menuUtenteOpen}
                  aria-label="Menu utente"
                  className="inline-flex h-8 w-6 items-center justify-center rounded-full text-primary-400 transition hover:bg-primary-50"
                >
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${menuUtenteOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              </div>

              {menuUtenteOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={chiudiMenuUtente} />
                  <div
                    role="menu"
                    className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card"
                  >
                    <div className="border-b border-primary-100 bg-primary-50/60 px-4 py-3">
                      <p className="truncate text-sm font-bold text-primary-800">
                        {user.nome} {user.cognome}
                      </p>
                      <p className="truncate text-xs text-primary-500">{user.email}</p>
                      <span
                        className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                          abbonato ? 'bg-accent-500 text-white' : 'bg-primary-50 text-primary-600'
                        }`}
                      >
                        {abbonato ? (
                          <>
                            <Sparkles className="h-3 w-3" /> Piano PRO
                          </>
                        ) : (
                          'Piano Base'
                        )}
                      </span>
                    </div>
                    <nav className="p-1.5">
                      <Link
                        to="/dashboard/profilo"
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <UserIcon className="h-4 w-4 text-primary-400" />
                        Il mio profilo
                      </Link>
                      <Link
                        to="/prezzi"
                        onClick={chiudiMenuUtente}
                        className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                      >
                        <CreditCard className="h-4 w-4 text-primary-400" />
                        Prezzi e abbonamento
                      </Link>
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-error-600 transition hover:bg-error-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Esci
                      </button>
                    </nav>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              Accedi
            </button>
          )}

          {/* Toggle menu mobile */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
            className="inline-flex items-center justify-center rounded-lg p-2 text-primary-700 transition hover:bg-primary-50 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Livello inferiore (Barra Servizi/Strumenti) — sempre centrata */}
      {!isDashboard && (
        <div className="hidden border-t border-primary-100 bg-white md:block">
          <nav className="mx-auto flex w-max items-center justify-center gap-1 overflow-x-auto px-4 py-2 sm:px-6">
            {strumentiLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-500 text-white shadow-soft'
                      : 'text-primary-700 hover:bg-primary-50'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-primary-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <p className="px-3 pt-1 text-xs font-bold uppercase tracking-wide text-primary-400">
              Strumenti
            </p>
            {strumentiLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={chiudiMenu}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
              >
                {l.label}
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
                  <span className="truncate text-sm font-medium text-primary-700">
                    <UserIcon className="mr-1.5 inline h-4 w-4" />
                    {user.nome} {user.cognome}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      abbonato ? 'bg-accent-500 text-white' : 'bg-primary-50 text-primary-600'
                    }`}
                  >
                    {abbonato ? (
                      <>
                        <Sparkles className="h-3 w-3" /> PRO
                      </>
                    ) : (
                      'Base'
                    )}
                  </span>
                </div>
                <Link
                  to="/dashboard/radar"
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
      )}

      <CreditiModal open={apriCrediti} onClose={() => setApriCrediti(false)} />
    </header>
  );
}

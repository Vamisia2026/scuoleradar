import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Radar, LogOut, User as UserIcon, Menu, X, LayoutDashboard } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const navLinks = [
  { to: '/servizi', label: 'Servizi' },
  { to: '/prezzi', label: 'Prezzi' },
  { to: '/chi-siamo', label: 'Chi siamo' },
];

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 group">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white shadow-soft transition-transform group-hover:scale-105">
        <Radar className="h-5 w-5" />
      </span>
      <span className="text-lg font-bold tracking-tight text-primary-700">
        Scuole<span className="text-secondary-500">Radar</span>
        <span className="text-primary-400">.it</span>
      </span>
    </Link>
  );
}

export function Header() {
  const { user, logout, openAuthModal } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  const chiudiMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-30 border-b border-primary-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo to={user ? '/dashboard/radar' : '/'} />

        {/* Nav pubblica (desktop) */}
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

        {/* Azioni (desktop) */}
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link
                to="/dashboard/radar"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <span className="hidden items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 lg:flex">
                <UserIcon className="h-4 w-4" />
                {user.nome}
              </span>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 px-3 py-1.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
              >
                <LogOut className="h-4 w-4" />
                Esci
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 px-4 py-2 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
              >
                Accedi
              </button>
              <button
                onClick={() => openAuthModal('registrazione')}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
              >
                Inizia gratis
              </button>
            </>
          )}
        </div>

        {/* Toggle menu mobile */}
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          className="inline-flex items-center justify-center rounded-lg p-2 text-primary-700 transition hover:bg-primary-50 md:hidden"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Menu mobile */}
      {menuOpen && (
        <div className="border-t border-primary-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
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
                <span className="px-3 text-sm font-medium text-primary-700">
                  <UserIcon className="mr-1.5 inline h-4 w-4" />
                  {user.nome}
                </span>
                <Link
                  to="/dashboard/radar"
                  onClick={chiudiMenu}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </Link>
                <button
                  onClick={() => {
                    logout();
                    chiudiMenu();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                >
                  <LogOut className="h-4 w-4" />
                  Esci
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    openAuthModal('registrazione');
                    chiudiMenu();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  Inizia gratis
                </button>
                <button
                  onClick={() => {
                    openAuthModal('login');
                    chiudiMenu();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
                >
                  Accedi
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

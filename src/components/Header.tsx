/**
 * Header globale — involucro (shell) della testata: logo, griglia a tre colonne
 * e montaggio dei sotto-componenti. Ogni responsabilità è delegata a
 * `src/components/header/`:
 *
 *  - `NavIstituzionale`  → link informativi (desktop)
 *  - `MenuUtente`        → chip profilo + tendina (desktop)
 *  - `BarraStrumenti`    → barra servizi/strumenti (livello inferiore)
 *  - `MenuMobile`        → drawer mobile
 *  - `BadgePianoCompatto` / `BadgePianoRiga` → badge del piano
 *
 * Qui restano solo: stato di apertura dei menu, conteggio dei documenti
 * scaricati e la condizione di visibilità della barra strumenti.
 */
import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X, Menu } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
// Logo della testata come ASSET DI BUILD (non da `public/`): Vite lo emette
// hashato (`/assets/logo-<hash>.png`), quindi l'immagine è sempre quella giusta,
// con `base` diverso da `/` funziona comunque e non resta mai in cache stantia.
import logoScuoleRadar from '@/assets/logo.png';
import { BarraStrumenti } from './header/BarraStrumenti';
import { MenuMobile } from './header/MenuMobile';
import { MenuUtente } from './header/MenuUtente';
import { NavIstituzionale } from './header/NavIstituzionale';

export function Header() {
  const { user, abbonato, piano, pianoStato, logout, openAuthModal, avatarUrl } = useApp();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUtenteOpen, setMenuUtenteOpen] = useState(false);
  /** Fallback del logo: se l'asset non è caricabile si mostra il marchio testuale. */
  const [logoCaricato, setLogoCaricato] = useState(true);

  const chiudiMenu = () => setMenuOpen(false);
  const chiudiMenuUtente = () => setMenuUtenteOpen(false);

  // Documenti scaricati dall’utente (conteggio condiviso con la pagina Moduli).
  const moduliScaricati = useMemo(() => {
    try {
      const raw = localStorage.getItem('scuoleradar:moduli_scaricati');
      if (!raw) return 0;
      const arr = JSON.parse(raw) as unknown[];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  }, []);
  // Su /dashboard la navigazione a pillole è già fornita dalla barra del DashboardLayout.
  const isDashboard = pathname.startsWith('/dashboard');

  return (
    <header className="sticky top-0 z-30 border-b border-primary-100 bg-white/90 backdrop-blur">
      {/* Livello superiore (Top Bar): Logo | link istituzionali (centro) | Accedi */}
      <div className="mx-auto grid h-16 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="ScuoleRadar.it — torna alla home"
          className="justify-self-start rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {logoCaricato ? (
            <img
              src={logoScuoleRadar}
              alt="ScuoleRadar.it — logo"
              /* Dimensioni INTRINSECHE reali (882×212): il browser riserva il box
                 con il rapporto corretto, senza deformazioni né layout shift.
                 L'asset è il LOGO ORIGINALE (tile azzurra con radar bianco +
                 wordmark blu/arancione/azzurro) — nessuna monocromia. */
              width={882}
              height={212}
              loading="eager"
              decoding="async"
              onError={() => setLogoCaricato(false)}
              className="h-10 w-auto object-contain md:h-12"
            />
          ) : (
            /* Fallback: l'header non resta mai senza marchio (asset mancante,
               CDN, cache) — al posto dell'immagine compare il wordmark testuale. */
            <span className="text-lg font-extrabold tracking-tight text-primary-900 md:text-xl">
              Scuole<span className="text-primary-500">Radar</span>
              <span className="text-primary-400">.it</span>
            </span>
          )}
        </Link>

        {/* Link istituzionali/informativi — sempre centrati (desktop) */}
        <NavIstituzionale />

        {/* Azioni (destra, allineate a fine riga) */}
        <div className="flex items-center justify-self-end gap-2">
          {user ? (
            <MenuUtente
              user={user}
              avatarUrl={avatarUrl}
              abbonato={abbonato}
              piano={piano}
              pianoStato={pianoStato}
              moduliScaricati={moduliScaricati}
              menuUtenteOpen={menuUtenteOpen}
              setMenuUtenteOpen={setMenuUtenteOpen}
              chiudiMenuUtente={chiudiMenuUtente}
              logout={logout}
            />
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
      {!isDashboard && <BarraStrumenti />}

      {/* Menu mobile */}
      {menuOpen && (
        <MenuMobile
          user={user}
          avatarUrl={avatarUrl}
          abbonato={abbonato}
          piano={piano}
          pianoStato={pianoStato}
          chiudiMenu={chiudiMenu}
          logout={logout}
          openAuthModal={openAuthModal}
        />
      )}

    </header>
  );
}

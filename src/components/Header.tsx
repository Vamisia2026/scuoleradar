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
// Marchio della testata come ASSET DI BUILD (non da `public/`): Vite lo emette
// hashato (`/assets/marchio-radar-<hash>.png`), quindi l'immagine è sempre quella
// giusta, con `base` diverso da `/` funziona comunque e non resta mai in cache
// stantia. È la TESSERA UFFICIALE del marchio (campo azzurro #2B6F9E + radar
// bianco): lo stesso disegno del favicon, quindi scheda del browser e header
// mostrano esattamente lo stesso simbolo.
import marchioRadar from '@/assets/marchio-radar.png';
import { BarraStrumenti } from './header/BarraStrumenti';
import { MenuMobile } from './header/MenuMobile';
import { MenuUtente } from './header/MenuUtente';
import { NavIstituzionale } from './header/NavIstituzionale';

export function Header() {
  const { user, abbonato, piano, pianoStato, logout, openAuthModal, avatarUrl } = useApp();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuUtenteOpen, setMenuUtenteOpen] = useState(false);
  /** Fallback del marchio: se la tessera non è caricabile resta il wordmark testuale. */
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
      {/* Livello superiore (Top Bar): Logo | link istituzionali (centro) | Accedi.
          Altezza compatta (h-14): l'header non deve allontanare la hero. */}
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="ScuoleRadar.it — torna alla home"
          className="justify-self-start rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          {/* Lockup PULITO e originario: la tessera ufficiale del marchio (identica
              al favicon) accanto alla scritta «ScuoleRadar.it». Il nome resta testo
              vero — nitido a qualsiasi zoom e densità di pixel — invece di un logo
              immagine rimpicciolito, che è ciò che dava l'effetto «template». */}
          <span className="flex items-center gap-2.5">
            {logoCaricato && (
              <img
                src={marchioRadar}
                alt=""
                aria-hidden="true"
                /* Dimensioni INTRINSECHE reali (256×256): il browser riserva il box
                   quadrato corretto, senza deformazioni né layout shift. */
                width={256}
                height={256}
                loading="eager"
                decoding="async"
                onError={() => setLogoCaricato(false)}
                className="h-9 w-9 shrink-0 object-contain md:h-10 md:w-10"
              />
            )}
            <span className="text-lg font-extrabold tracking-tight md:text-xl">
              <span className="text-primary-700">Scuole</span>
              <span className="text-secondary-500">Radar</span>
              <span className="text-primary-400">.it</span>
            </span>
          </span>
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

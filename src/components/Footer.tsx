/**
 * Footer condiviso del sito (pagine pubbliche e dashboard).
 *
 * Estratto da `pages/LandingPage.tsx`: era importato da 11 pagine passando da
 * una pagina (`'./LandingPage'`), creando un accoppiamento improprio fra il
 * footer e la landing. Ora ogni pagina lo importa dalla sua sede naturale.
 *
 * È autonomo: legge `useApp()` (piano/utente), i servizi e l'accesso admin.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { ADMIN_EMAILS, AdminAccessModal } from '@/departments/admin';
import { serviziVisibili } from '@/data/servizi';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export function Footer() {
  const navigate = useNavigate();
  const { user } = useApp();
  // Feature flags: i servizi di un dipartimento in `off` spariscono anche dal
  // footer pubblico (niente link a moduli spenti «in chiaro» sul sito).
  const { visibile } = useFeatureFlags();
  const voci = serviziVisibili(visibile);
  // Trigger segreto Admin nascosto nella parola "riservati" (3 click).
  const [clicksSegreti, setClicksSegreti] = useState(0);
  const [adminModalAperto, setAdminModalAperto] = useState(false);

  return (
    <footer className="border-t border-primary-100 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-primary-700">
              <Radar className="h-5 w-5 text-primary-500" />
              <span className="font-semibold">ScuoleRadar.it</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-primary-500">
              Scansioniamo h24 opportunità per TUTTI i lavoratori della scuola. La piattaforma per chi
              vive la scuola ogni giorno.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary-800">Strumenti</h4>
            <ul className="mt-3 space-y-2 text-sm">
              {voci.map((s) => (
                <li key={s.slug}>
                  <Link
                    to={`/servizi/${s.slug}`}
                    className="text-primary-600 transition hover:text-primary-800"
                  >
                    {s.titolo}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold text-primary-800">Info</h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/prezzi" className="text-primary-600 transition hover:text-primary-800">
                  Prezzi
                </Link>
              </li>
              <li>
                <Link to="/chi-siamo" className="text-primary-600 transition hover:text-primary-800">
                  Chi siamo
                </Link>
              </li>
              <li>
                <Link to="/servizi" className="text-primary-600 transition hover:text-primary-800">
                  Tutti i servizi
                </Link>
              </li>
              <li>
                <Link to="/contatti" className="text-primary-600 transition hover:text-primary-800">
                  Contattaci
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 flex w-full flex-wrap items-center justify-center gap-x-1.5 border-t border-primary-100 pt-6 text-center text-sm text-primary-400">
          Realizzato con passione da
          <a
            href="https://vamisia.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-600 transition hover:text-primary-800"
          >
            Vamisia
          </a>
          <span aria-hidden="true">·</span>
          <span>© 2026 ScuoleRadar</span>
          <span aria-hidden="true">·</span>
          Tutti i diritti{' '}
          <button
            type="button"
            onClick={() => {
              const nuovo = clicksSegreti + 1;
              setClicksSegreti(nuovo);
              if (nuovo >= 3) {
                setClicksSegreti(0);
                const autorizzato = user?.email
                  ? ADMIN_EMAILS.includes(user.email.toLowerCase())
                  : false;
                if (autorizzato) {
                  navigate('/admin');
                } else {
                  setAdminModalAperto(true);
                }
              }
            }}
            className="inline cursor-default bg-transparent p-0 align-baseline text-primary-400 hover:text-primary-400"
          >
            riservati
          </button>
          .
        </p>
      </div>
      {adminModalAperto && (
        <AdminAccessModal aperto onChiudi={() => setAdminModalAperto(false)} />
      )}
    </footer>
  );
}
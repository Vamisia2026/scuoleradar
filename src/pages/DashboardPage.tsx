import { Link, NavLink, Outlet } from 'react-router-dom';
import { Radar, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/Header';
import { InterpelloCard } from '@/components/InterpelloCard';
import { PreferenzeRadar } from '@/components/PreferenzeRadar';
import { RadarStatusToggle } from '@/components/RadarStatusToggle';
import { useApp } from '@/contexts/AppContext';
import { interpelli } from '@/data/interpelli';
import { classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Footer } from './LandingPage';

interface TabNav {
  to: string;
  label: string;
  end?: boolean;
  accent?: boolean;
}

export function DashboardLayout() {
  const tabs: TabNav[] = [
    { to: '/dashboard/radar', label: '📡 Radar Scuole', end: true },
    // Feature in incubazione (temporaneamente nascoste dalla nav):
    //   📄 Crea CV · 🎓 Calcolatore CFU · 💬 Assistente Sindacalista Virtuale
    { to: '/dashboard/moduli', label: '📁 Moduli' },
    { to: '/dashboard/purefocus', label: '🧘 Pure Focus' },
    { to: '/dashboard/invita', label: '🎁 Invita un Collega', accent: true },
  ];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
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
              {t.accent && (
                <span className="rounded-full bg-accent-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Novembre
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="mt-3 min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

export function DashboardPage() {
  const {
    user,
    interpelliFiltrati,
    preferenze,
    abbonato,
    piano,
    openAuthModal,
    openRadarSetup,
    openRadarWizard,
  } = useApp();

  // Accesso PRO: abbonamento attivo, piano PRO (anche in prova) o Free Forever.
  const hasAccessoPro = abbonato || piano === 'pro' || piano === 'free_forever';

  // Utente BASE autenticato e onboarded → "Opportunità mappate" bloccato (paywall PRO).
  const feedBloccatoBase = Boolean(user) && Boolean(preferenze.onboarded) && !hasAccessoPro;

  // Opportunità attive: pulite dalle scadute e ordinate per scadenza (più prossime prima).
  const oraAttuale = Date.now();
  const opportunitaAttive = interpelliFiltrati
    .filter((i) => !i.dataScadenza || new Date(i.dataScadenza).getTime() > oraAttuale)
    .sort((a, b) => new Date(a.dataScadenza).getTime() - new Date(b.dataScadenza).getTime());

  // Vetrina Freemium: i visitatori non loggati vedono un campione dell'offerta
  // (max 3 opportunità attive) prima di essere invitati a registrarsi.
  const feedVetrina = !user && opportunitaAttive.length === 0 ? interpelli : opportunitaAttive;
  const interpelliVisibili = !user ? feedVetrina.slice(0, 3) : opportunitaAttive;

  // Onboarding iniziato (bozza salvata) ma non completato → banner di ripresa.
  const haBozzaOnboarding =
    !preferenze.onboarded &&
    (preferenze.ordini.length > 0 ||
      preferenze.classiCodici.length > 0 ||
      preferenze.materieId.length > 0 ||
      preferenze.materieCustom.length > 0 ||
      preferenze.provinceCodici.length > 0);

  // Etichette per lo stato vuoto del Radar (dalle preferenze dell'utente).
  const classeEtichetta = preferenze.classiCodici
    .map((c) => classeByCodice(c)?.denominazione ?? c)
    .filter(Boolean)
    .join(', ');
  const provinciaEtichetta = preferenze.provinceCodici
    .map((c) => province.find((p) => p.codice === c)?.nome ?? c)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-3">
      {/* UNICO stato/upsell Radar: barra di controllo consolidata (titolo + tier + descrizione + toggle + CTA PRO) */}
      {user && <RadarStatusToggle titolo="Radar Scuole" />}

      {/* Onboarding incompleto: bozza avviata ma Radar non ancora attivato (riprendi dal passo salvato) */}
      {user && haBozzaOnboarding && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm shadow-card">
          <div className="flex min-w-0 items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-500 text-white">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <p className="min-w-0 leading-relaxed text-warning-800">
              <strong>Finisci di completare il tuo Radar per attivarlo</strong>
              <span className="block text-xs text-warning-700">
                Hai già salvato una bozza: riprendi esattamente dal passo in cui ti eri fermato.
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={openRadarWizard}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Completa il Radar
          </button>
        </div>
      )}

      {/* Vetrina Freemium: hero Radar per visitatori non loggati (copy essenziale) */}
      {!user && (
        <div className="rounded-2xl border border-secondary-200 bg-secondary-50 p-5 shadow-card">
          <h3 className="text-xl font-bold text-primary-900">
            Smetti di cercare a mano. Monitoriamo noi la scuola per te.
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-primary-700">
            Imposta provincia e classe di concorso: ti avvisiamo istantaneamente su Telegram ed Email
            non appena esce un&apos;opportunità adatta a te.
          </p>
          <p className="mt-2 text-sm font-semibold text-secondary-700">
            🎁 Registrati oggi: per te 1 Mese PRO Gratis offerto da{' '}
            <a
              href="https://purefocus.one"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-secondary-300 underline-offset-2 transition hover:text-secondary-800"
            >
              PureFocus.one
            </a>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('registrazione')}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-soft transition hover:bg-primary-600"
            >
              <Radar className="h-4 w-4" />
              Attiva il tuo Radar
            </button>
          </div>
        </div>
      )}

      {/* Preferenze Radar — impostazioni e filtri del profilo (bacheca unificata) */}
      {user && <PreferenzeRadar />}

      {/* Feed — "Opportunità mappate" (PRO) / preview paywall (Base) */}
      <div className="mb-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Radar className="h-5 w-5 text-primary-600" />
          <h2 className="text-xl font-bold text-primary-800">Opportunità mappate</h2>
          {!feedBloccatoBase && (
            <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
              {opportunitaAttive.length}
            </span>
          )}
        </div>

        {feedBloccatoBase ? (
          <div className="animate-fade-in rounded-2xl border border-secondary-200 bg-secondary-50 p-6 text-center shadow-card">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-secondary-100">
              <Radar className="h-7 w-7 text-secondary-600" />
            </span>
            <h3 className="mt-3 text-lg font-bold text-primary-900">
              Opportunità riservate agli account PRO
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-relaxed text-primary-600">
              Questo strumento è disponibile per gli account PRO. Passa a PRO per consultare
              l&apos;archivio completo delle opportunità attive.
            </p>
            <Link
              to="/prezzi"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
            >
              Passa a PRO
            </Link>
          </div>
        ) : opportunitaAttive.length === 0 ? (
          <div className="animate-fade-in rounded-2xl border border-primary-100 bg-white p-8 text-left shadow-card">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-50">
              <Radar className="h-6 w-6 text-primary-400" />
            </span>
            {!preferenze.onboarded ? (
              <>
                <h3 className="mt-3 text-lg font-bold text-primary-800">Configura il tuo profilo</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  Scegli province, classi di concorso e materie per vedere solo le opportunità che ti
                  riguardano davvero.
                </p>
                <button
                  type="button"
                  onClick={openRadarSetup}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Completa il profilo
                </button>
              </>
            ) : (
              <>
                <h3 className="mt-3 text-lg font-bold text-primary-800">
                  Nessuna nuova opportunità oggi
                  {classeEtichetta ? ` per la classe ${classeEtichetta}` : ''}
                  {provinciaEtichetta ? ` in provincia di ${provinciaEtichetta}` : ''}.
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  Imposta il tuo Radar e rilassati: ti avvisiamo noi appena esce qualcosa di
                  interessante per te!
                </p>
                <button
                  type="button"
                  onClick={openRadarSetup}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Imposta il tuo Radar
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="animate-fade-in grid gap-3">
            {interpelliVisibili.map((i) => (
              <InterpelloCard key={i.id} interpello={i} />
            ))}
          </div>
        )}

        <p className="mt-3 max-w-2xl text-left text-xs text-primary-500">
          Interpelli, bandi per esperti, CPIA e progetti scolastici: mostriamo solo ciò che ti riguarda davvero.
        </p>
      </div>

    </div>
  );
}





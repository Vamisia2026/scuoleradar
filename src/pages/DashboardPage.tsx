import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BellRing, Sparkles, CheckCircle2, CreditCard, Radar, Database, SlidersHorizontal } from 'lucide-react';
import { Header } from '@/components/Header';
import { InterpelloCard } from '@/components/InterpelloCard';
import { useApp } from '@/contexts/AppContext';
import { AbbonamentoModal } from '@/components/AbbonamentoModal';
import { CreditiModal } from '@/components/CreditiModal';
import { Footer } from './LandingPage';

interface TabNav {
  to: string;
  label: string;
  end?: boolean;
  accent?: boolean;
}

export function DashboardLayout() {
  const tabs: TabNav[] = [
    { to: '/dashboard/radar', label: '📡 Radar Interpelli', end: true },
    { to: '/dashboard/cv', label: '📄 Il mio CV' },
    { to: '/dashboard/cfu', label: '🎓 Check CFU' },
    { to: '/dashboard/assistente-ai', label: '🤖 Assistente AI' },
    { to: '/dashboard/moduli', label: '📁 Moduli' },
    { to: '/dashboard/profilo', label: '⚙️ Profilo' },
    { to: '/dashboard/invita', label: '🎁 Invita un Collega', accent: true },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
                  10€
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <main className="mt-6 min-w-0">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}

export function DashboardPage() {
  const {
    interpelliFiltrati,
    preferenze,
    notificheUsate,
    abbonato,
    crediti,
    avviaCheckout,
    origineDati,
  } = useApp();
  const [showAbbonamento, setShowAbbonamento] = useState(false);
  const [showCrediti, setShowCrediti] = useState(false);

  const limiteRaggiunto = !abbonato && notificheUsate >= 3;

  return (
    <div className="space-y-6">
      {/* Notification counter */}
      <div
        className={`rounded-2xl border p-5 shadow-card ${
          abbonato
            ? 'border-accent-200 bg-accent-50'
            : limiteRaggiunto
              ? 'border-secondary-200 bg-secondary-50'
              : 'border-primary-100 bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${
                abbonato ? 'bg-accent-500 text-white' : 'bg-primary-500 text-white'
              }`}
            >
              {abbonato ? <CheckCircle2 className="h-5 w-5" /> : <BellRing className="h-5 w-5" />}
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-800">
                {abbonato
                  ? 'Sei abbonato: notifiche illimitate.'
                  : `Notifiche incluse utilizzate: ${notificheUsate} / 3`}
              </p>
              <p className="text-xs text-primary-500">
                {abbonato
                  ? 'Riceverai tutte le notifiche pertinenti, senza limiti.'
                  : 'Hai 3 notifiche incluse nell\u2019Offerta per provare il servizio.'}
              </p>
              {crediti > 0 && (
                <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary-50 px-2 py-0.5 text-xs font-semibold text-secondary-700">
                  <Sparkles className="h-3 w-3" />
                  {crediti} credito{crediti > 1 ? 'i' : ''} a consumo
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!abbonato && (
              <button
                onClick={() => setShowAbbonamento(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
              >
                <CreditCard className="h-4 w-4" />
                Abbonati 49€/anno
              </button>
            )}
            <button
              onClick={() => setShowCrediti(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-secondary-300 px-4 py-2 text-sm font-semibold text-secondary-700 transition hover:bg-secondary-50"
            >
              <Sparkles className="h-4 w-4" />
              Acquista crediti
            </button>
          </div>
        </div>
        {limiteRaggiunto && (
          <p className="mt-3 text-sm text-secondary-800">
            Hai usato le tue 3 notifiche incluse nell'Offerta. I contenuti restano accessibili, ma per ricevere
            nuove notifiche ti serve l'abbonamento.
          </p>
        )}
      </div>

      {/* Feed */}
      <div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Radar className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-primary-800">Opportunità mappate</h2>
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
            {interpelliFiltrati.length}
          </span>
          {origineDati === 'supabase' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-semibold text-accent-700">
              <Database className="h-3 w-3" />
              Dati reali da Supabase
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-500">
              Dati di esempio (fallback)
            </span>
          )}
        </div>

        {interpelliFiltrati.length === 0 ? (
          <div className="animate-fade-in rounded-2xl border border-primary-100 bg-white p-10 text-center shadow-card">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-50">
              <Radar className="h-7 w-7 text-primary-400" />
            </span>
            {!preferenze.onboarded ? (
              <>
                <h3 className="mt-4 text-lg font-bold text-primary-800">Configura il tuo profilo</h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  Scegli province, classi di concorso e materie per vedere solo le opportunità che ti
                  riguardano davvero.
                </p>
                <Link
                  to="/dashboard/profilo"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Completa il profilo
                </Link>
              </>
            ) : (
              <>
                <h3 className="mt-4 text-lg font-bold text-primary-800">
                  Se oggi non arriva niente, non c&apos;è nulla di rilevante.
                </h3>
                <p className="mx-auto mt-1 max-w-md text-sm text-primary-500">
                  I nostri radar controllano continuamente albi e interpelli per te. Torna domani,
                  oppure amplia le tue preferenze per ricevere più segnalazioni.
                </p>
                <Link
                  to="/dashboard/profilo"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary-200 px-5 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Rivedi le preferenze
                </Link>
              </>
            )}
          </div>
        ) : (
          <div className="animate-fade-in grid gap-4">
            {interpelliFiltrati.map((i) => (
              <InterpelloCard key={i.id} interpello={i} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-primary-500">
          Interpelli, bandi per esperti, CPIA e progetti scolastici: mostriamo solo ciò che ti riguarda davvero.
        </p>
      </div>

      <AbbonamentoModal
        open={showAbbonamento}
        onClose={() => setShowAbbonamento(false)}
        onConfirm={(promo) => avviaCheckout('pro_annuale', promo)}
      />
      <CreditiModal open={showCrediti} onClose={() => setShowCrediti(false)} />
    </div>
  );
}





import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { BellRing, Sparkles, CheckCircle2, CreditCard, Radar, Heart } from 'lucide-react';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { InterpelloCard } from '@/components/InterpelloCard';
import { useApp } from '@/contexts/AppContext';
import { Footer } from './LandingPage';

export function DashboardLayout() {
  const tabs = [
    { to: '/dashboard/radar', label: '📡 Radar Interpelli', end: true },
    { to: '/dashboard/cv', label: '📄 Il mio CV' },
    { to: '/dashboard/cfu', label: '🎓 Check CFU' },
    { to: '/dashboard/assistente-ai', label: '🤖 Assistente AI' },
    { to: '/dashboard/moduli', label: '📁 Moduli' },
    { to: '/dashboard/profilo', label: '⚙️ Profilo' },
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
                    : 'text-primary-700 hover:bg-primary-50'
                }`
              }
            >
              {t.label}
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
  const { interpelliFiltrati, notificheUsate, abbonato, abbonati } = useApp();
  const [showAbbonamento, setShowAbbonamento] = useState(false);

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
            </div>
          </div>
          {!abbonato && (
            <button
              onClick={() => setShowAbbonamento(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
            >
              <CreditCard className="h-4 w-4" />
              Abbonati 49€/anno
            </button>
          )}
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
        <div className="mb-4 flex items-center gap-2">
          <Radar className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold text-primary-800">Opportunità mappate</h2>
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-600">
            {interpelliFiltrati.length}
          </span>
        </div>

        {interpelliFiltrati.length === 0 ? (
          <div className="rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
            <Heart className="mx-auto h-10 w-10 text-primary-300" />
            <p className="mt-3 text-base font-medium text-primary-700">
              Se oggi non ti arriva niente, significa che non c'è nulla di rilevante.
            </p>
            <p className="mt-1 text-sm text-primary-500">
              Puoi dedicarti ad altro in tranquillità. Torna domani.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {interpelliFiltrati.map((i) => (
              <InterpelloCard key={i.id} interpello={i} />
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-sm text-primary-500">
          Interpelli, bandi per esperti, CPIA e progetti scolastici: mostriamo solo ciò che ti riguarda davvero.
        </p>
      </div>

      <AbbonamentoModal open={showAbbonamento} onClose={() => setShowAbbonamento(false)} onConfirm={abbonati} />
    </div>
  );
}

function AbbonamentoModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [pagato, setPagato] = useState(false);
  const navigate = useNavigate();

  const handleSimula = () => {
    setPagato(true);
    onConfirm();
  };

  const handleClose = () => {
    setPagato(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Abbonati a ScuoleRadar" size="sm">
      {pagato ? (
        <div className="text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h3 className="mt-4 text-lg font-bold text-primary-800">Pagamento simulato!</h3>
          <p className="mt-2 text-sm text-primary-600">
            Da ora riceverai tutte le notifiche pertinenti, senza limiti. Il contatore è stato azzerato.
          </p>
          <button
            onClick={() => {
              handleClose();
              navigate('/dashboard/radar');
            }}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            Vai alla dashboard
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <span className="text-sm font-medium">Piano PRO annuale</span>
            </div>
            <p className="mt-2 text-3xl font-bold">49€<span className="text-base font-normal">/anno</span></p>
            <p className="mt-1 text-sm text-primary-100">Si ripaga con un'ora di lavoro.</p>
          </div>

          <ul className="space-y-2 text-sm text-primary-700">
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-500" />
              Notifiche illimitate su Telegram ed email
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-500" />
              Accesso agli Strumenti Docente (CV e Verifica CFU)
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-500" />
              Incluso nel piano PRO: Accesso completo a PureFocus
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent-500" />
              Niente rinnovi automatici nascosti
            </li>
          </ul>

          <button
            onClick={handleSimula}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
          >
            <CreditCard className="h-4 w-4" />
            Simula pagamento
          </button>
          <p className="text-center text-xs text-primary-400">
            Pagamento simulato a scopo dimostrativo. Nessun addebito reale.
          </p>
        </div>
      )}
    </Modal>
  );
}

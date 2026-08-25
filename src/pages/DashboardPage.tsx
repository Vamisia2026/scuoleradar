import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BellRing, Sparkles, CheckCircle2, CreditCard, Radar, Database, SlidersHorizontal, Tag, Loader2, X } from 'lucide-react';
import { Header } from '@/components/Header';
import { Modal } from '@/components/Modal';
import { InterpelloCard } from '@/components/InterpelloCard';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
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
  onConfirm: (promo?: string) => Promise<{ ok: boolean; errore?: string }>;
}) {
  const { mostraToast } = useToast();
  const [invio, setInvio] = useState(false);
  const [promo, setPromo] = useState('');
  const [promoStato, setPromoStato] = useState<'idle' | 'verifica' | 'applicato' | 'errore'>('idle');
  const [promoMsg, setPromoMsg] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  // Pre-fill + auto-apply del promo da ?promo= (link referral salvato da PrezziPage)
  useEffect(() => {
    if (!open) return;
    const salvato = (() => {
      try {
        return localStorage.getItem('sr_promo') ?? '';
      } catch {
        return '';
      }
    })();
    if (salvato) {
      setPromo(salvato);
      void applicaPromo(salvato);
      try {
        localStorage.removeItem('sr_promo');
      } catch {
        // ignore
      }
    }
  }, [open]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const applicaPromo = async (codice: string) => {
    if (!supabase) return;
    const upp = codice.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!upp) {
      setPromoStato('idle');
      setPromoMsg('');
      return;
    }
    setPromoStato('verifica');
    const { data } = await supabase.rpc('valida_codice_promo', { p_codice: upp });
    const riga = Array.isArray(data) && data.length > 0
      ? (data[0] as { valido?: boolean; referrer_id?: string })
      : null;
    // Valido SOLO se appartiene a un altro utente (niente auto-promo)
    if (riga?.valido && riga.referrer_id && riga.referrer_id !== userId) {
      setPromo(upp);
      setPromoStato('applicato');
      setPromoMsg('Codice sconto applicato (-10€)');
    } else {
      setPromoStato('errore');
      setPromoMsg('Codice promo non valido o non applicabile');
    }
  };

  const handleProcedi = async () => {
    setInvio(true);
    try {
      const esito = await onConfirm(promoStato === 'applicato' ? promo : undefined);
      if (!esito.ok) {
        mostraToast('errore', esito.errore ?? 'Errore durante il pagamento. Riprova.');
      }
    } catch (err) {
      mostraToast('errore', (err as Error).message ?? 'Errore durante il pagamento. Riprova.');
    } finally {
      setInvio(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Abbonati a ScuoleRadar" size="sm">
      <div className="space-y-4">
        <div className="rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 p-5 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            <span className="text-sm font-medium">Piano PRO annuale</span>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {promoStato === 'applicato' ? (
              <>
                <span className="mr-1 text-lg font-normal text-white/60 line-through">49€</span>
                39€<span className="text-base font-normal">/anno</span>
              </>
            ) : (
              <>
                49€<span className="text-base font-normal">/anno</span>
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-primary-100">
            Ti ripaghi l&apos;abbonamento annuale con meno di due ore di lavoro.
          </p>
        </div>

        {/* Codice promo / sconto */}
        <div className="rounded-xl border border-primary-100 bg-slate-50 p-3">
          <label
            htmlFor="promo-input"
            className="text-xs font-semibold uppercase tracking-wide text-primary-500"
          >
            Codice promo / sconto
          </label>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              id="promo-input"
              type="text"
              value={promo}
              onChange={(e) => {
                setPromo(e.target.value.toUpperCase());
                setPromoStato('idle');
                setPromoMsg('');
              }}
              placeholder="ES. BARTOLOANSALDI"
              className="input font-mono text-sm"
              disabled={promoStato === 'applicato'}
            />
            {promoStato === 'applicato' ? (
              <button
                onClick={() => {
                  setPromo('');
                  setPromoStato('idle');
                  setPromoMsg('');
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
              >
                <X className="h-3.5 w-3.5" />
                Rimuovi
              </button>
            ) : (
              <button
                onClick={() => void applicaPromo(promo)}
                disabled={promoStato === 'verifica' || !promo}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
              >
                {promoStato === 'verifica' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Tag className="h-3.5 w-3.5" />
                )}
                Applica
              </button>
            )}
          </div>
          {promoStato === 'applicato' && (
            <p className="mt-1.5 text-xs font-semibold text-accent-600">✓ {promoMsg}</p>
          )}
          {promoStato === 'errore' && <p className="mt-1.5 text-xs text-error-600">{promoMsg}</p>}
        </div>

        <ul className="space-y-2 text-sm text-primary-700">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Notifiche mirate e personalizzate su Telegram ed Email (zero spam: solo ciò che ti
            serve, attivo tutto l&apos;anno e disattivabile in qualsiasi momento).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Accesso completo agli Strumenti Docente (CV, Verifica CFU, Modulistica ufficiale e
            Normativa).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Incluso nel piano PRO: Accesso completo a PureFocus (valore commerciale $29/anno).
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
            Rinnovo automatico trasparente, disdicibile in qualsiasi momento dal tuo profilo.
          </li>
        </ul>

        <button
          onClick={() => void handleProcedi()}
          disabled={invio}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-secondary-500 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
          {invio ? 'Creazione sessione di pagamento…' : 'Procedi al pagamento (Stripe)'}
        </button>
        <p className="text-center text-xs text-primary-400">
          Pagamento sicuro gestito da Stripe: i tuoi dati non transitano mai da ScuoleRadar.
          Nessun addebito automatico nascosto.
        </p>
      </div>
    </Modal>
  );
}

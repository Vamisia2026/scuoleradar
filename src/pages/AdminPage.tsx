/**
 * ScuoleRadar.it — Pannello Admin (refactor).
 *
 * Guardie:
 *  · ADMIN_EMAILS: bartoloansaldi@gmail.com / myvamisia@gmail.com
 *  · produzione richiede sessione Supabase + Edge Function `admin` deployata;
 *  · sviluppo (DEV) con sessione assente: accesso demo diretto con gli stessi
 *    indirizzi (il trigger segreto nel footer usa "Bartolino" in locale).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BadgeInfo, Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';
import { DEV, tokenAdmin } from './admin/adminService';
import { ADMIN_EMAILS, type TabAdmin } from './admin/types';
import { btnAdmin, btnGhost, btnPrim } from './admin/adminUi';
import { TabAccount, TabRadar, TabUtenti } from './admin/AdminTabs';

export function AdminPage() {
  const { user } = useApp();
  const [emailReale, setEmailReale] = useState<string | null>(null);
  const [verificato, setVerificato] = useState(false);
  const [sessioneReale, setSessioneReale] = useState(false);
  const [tab, setTab] = useState<TabAdmin>('utenti');

  useEffect(() => {
    let attivo = true;
    void (async () => {
      let email = user?.email ?? null;
      let token = null;
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) email = data.user.email;
        token = await tokenAdmin();
      }
      if (attivo) {
        setEmailReale(email ? email.toLowerCase() : null);
        setSessioneReale(Boolean(token) || !supabase);
        setVerificato(true);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [user]);

  const isAdmin = emailReale !== null && ADMIN_EMAILS.includes(emailReale);

  if (!verificato) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!supabase && !DEV) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24">
        <div className="mx-auto max-w-lg rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary-400" />
          <h1 className="mt-3 text-lg font-bold text-primary-800">Amministrazione</h1>
          <p className="mt-1 text-sm text-primary-500">
            Non disponibile in modalità demo: manca la configurazione Supabase.
          </p>
          <Link to="/" className={`${btnAdmin} ${btnPrim} mt-4`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24">
        <div className="mx-auto max-w-lg rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <ShieldCheck className="mx-auto h-10 w-10 text-red-400" />
          <h1 className="mt-3 text-lg font-bold text-primary-800">Accesso riservato</h1>
          <p className="mt-1 text-sm text-primary-500">
            Questa area è accessibile solo agli amministratori di ScuoleRadar.
          </p>
          <Link to="/" className={`${btnAdmin} ${btnPrim} mt-4`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  const tabAdmin: { id: TabAdmin; label: string }[] = [
    { id: 'utenti', label: '👥 Gestione Utenti' },
    { id: 'radar', label: '🛰️ Opportunità & Radar' },
    { id: 'account', label: '💳 Account & Abbonamento' },
  ];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <header className="border-b border-primary-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500 text-white shadow-soft">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold text-primary-800">Pannello Admin</h1>
              <p className="text-xs text-primary-400">ScuoleRadar · area riservata · {emailReale}</p>
            </div>
          </div>
          <Link to="/" className={`${btnAdmin} ${btnGhost}`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna al sito
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {DEV && !sessioneReale && (
          <p className="mb-3 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-[11px] text-warning-700">
            <BadgeInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Accesso amministratore locale (demo): le operazioni che richiedono il database mostrano dati
            di esempio. Per la gestione reale accedi con una sessione Supabase di un indirizzo autorizzato.
          </p>
        )}

        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white p-1.5 shadow-card">
          {tabAdmin.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'bg-primary-500 text-white shadow-soft' : 'text-primary-700 hover:bg-primary-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="mt-6">
          {tab === 'utenti' ? <TabUtenti /> : tab === 'radar' ? <TabRadar /> : <TabAccount />}
        </main>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Gift, Loader2, Pencil, RefreshCw, Search, Send, ShieldCheck, Trash2, Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/contexts/AppContext';

/** Unici indirizzi con accesso amministrativo (controllato ANCHE lato server nella edge function `admin`). */
const ADMIN_EMAILS = ['bartoloansaldi@gmail.com', 'myvamisia@gmail.com'];

type Tab = 'utenti' | 'opportunita' | 'referral';

interface Utente {
  id: string;
  email: string;
  nome: string | null;
  cognome: string | null;
  piano: string | null;
  abbonamento_scade_il: string | null;
  crediti: number | null;
  province_interesse: string[] | null;
  classi_concorso: string[] | null;
  ordini_scuola: string[] | null;
  telegram_chat_id: string | null;
  notifiche_usate: number | null;
  notifiche_anno: number | null;
  notifiche_blocco_inviato: boolean | null;
  notifiche_recap_inviato: boolean | null;
  step4_inviata_at: string | null;
  step5_inviata: boolean | null;
  referral_code: string | null;
  onboarded: boolean | null;
  created_at: string | null;
}

interface Opportunita {
  id: string;
  title: string;
  province: string | null;
  class_codes: string[] | null;
  school_name: string | null;
  school_code: string | null;
  source_url: string | null;
  expiration_date: string | null;
  hash_id: string | null;
  created_at: string | null;
}

interface ReferralRow {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  referral_code: string | null;
  creato: string | null;
  inviti: number;
  completati: number;
  premio: number;
}

async function chiamaAdmin<T>(action: string, payload?: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase non configurato');
  const { data, error } = await supabase.functions.invoke('admin', {
    body: { action, payload: payload ?? {} },
  });
  if (error) throw new Error((error as { message?: string }).message ?? 'Errore di comunicazione con l\'admin');
  const res = data as { ok?: boolean; error?: string };
  if (!res?.ok) throw new Error(res?.error ?? 'Errore admin');
  return data as T;
}

function fmtData(s: string | null | undefined): string {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('it-IT');
}

const inputCls =
  'w-full rounded-lg border border-primary-200 px-2 py-1 text-xs text-primary-800 focus:border-primary-400 focus:outline-none';
const btnCls = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition';
const btnPrim = 'bg-primary-500 text-white hover:bg-primary-600 shadow-soft';
const btnGhost = 'text-primary-600 hover:bg-primary-50';
const btnDanger = 'text-red-600 hover:bg-red-50';

export function AdminPage() {
  const { user } = useApp();
  const [emailReale, setEmailReale] = useState<string | null>(null);
  const [verificato, setVerificato] = useState(false);
  const [tab, setTab] = useState<Tab>('utenti');

  useEffect(() => {
    let attivo = true;
    void (async () => {
      let email = user?.email ?? null;
      if (supabase) {
        const { data } = await supabase.auth.getUser();
        if (data.user?.email) email = data.user.email;
      }
      if (attivo) {
        setEmailReale(email ? email.toLowerCase() : null);
        setVerificato(true);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [user]);

  const isAdmin = emailReale !== null && ADMIN_EMAILS.includes(emailReale);

  if (!supabase) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-24">
        <div className="mx-auto max-w-lg rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary-400" />
          <h1 className="mt-3 text-lg font-bold text-primary-800">Amministrazione</h1>
          <p className="mt-1 text-sm text-primary-500">
            Non disponibile in modalità demo: manca la configurazione Supabase.
          </p>
          <Link to="/" className={`${btnCls} ${btnPrim} mt-4`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  if (!verificato) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
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
          <Link to="/" className={`${btnCls} ${btnPrim} mt-4`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'utenti', label: '👥 Utenti' },
    { id: 'opportunita', label: '💼 Opportunità' },
    { id: 'referral', label: '🎁 Referral & Premi' },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
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
          <Link to="/" className={`${btnCls} ${btnGhost}`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Torna al sito
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-primary-100 bg-white p-1.5 shadow-card">
          {tabs.map((t) => (
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
          {tab === 'utenti' ? <TabUtenti /> : tab === 'opportunita' ? <TabOpportunita /> : <TabReferral />}
        </main>
      </div>
    </div>
  );
}

function TabUtenti() {
  const [utenti, setUtenti] = useState<Utente[] | null>(null);
  const [errore, setErrore] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Record<string, string | number>>({});

  const carica = useCallback(async () => {
    setErrore('');
    try {
      const data = await chiamaAdmin<{ utenti: Utente[] }>('list_users');
      setUtenti(data.utenti ?? []);
    } catch (e) {
      setErrore((e as Error).message);
      setUtenti(null);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const filtrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q || !utenti) return utenti ?? [];
    return (utenti ?? []).filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.nome?.toLowerCase().includes(q) ||
        u.cognome?.toLowerCase().includes(q) ||
        u.referral_code?.toLowerCase().includes(q),
    );
  }, [ricerca, utenti]);

  const iniziaModifica = (u: Utente) => {
    setEditId(u.id);
    setBozza({
      nome: u.nome ?? '',
      cognome: u.cognome ?? '',
      email: u.email ?? '',
      piano: u.piano ?? 'base',
      abbonamento_scade_il: u.abbonamento_scade_il ? String(u.abbonamento_scade_il).slice(0, 10) : '',
      crediti: u.crediti ?? 0,
    });
  };

  const salva = async (u: Utente) => {
    try {
      const updates: Record<string, unknown> = {
        nome: String(bozza.nome ?? '').trim() || null,
        cognome: String(bozza.cognome ?? '').trim() || null,
        email: String(bozza.email ?? '').trim(),
        piano: String(bozza.piano ?? 'base'),
        abbonamento_scade_il: bozza.abbonamento_scade_il ? String(bozza.abbonamento_scade_il) : null,
        crediti: Number(bozza.crediti ?? 0),
      };
      await chiamaAdmin('update_user', { id: u.id, updates });
      setEditId(null);
      void carica();
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-100 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary-800">
            <Users className="h-4 w-4 text-primary-500" /> Gestione Utenti
          </h2>
          <p className="mt-0.5 text-xs text-primary-400">
            Profili, piano, scadenza, filtri radar e log notifiche ({utenti?.length ?? '…'} utenti)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-400" />
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca nome, email, codice…"
              className={`${inputCls} w-56 pl-8`}
            />
          </div>
          <button type="button" onClick={() => void carica()} className={`${btnCls} ${btnGhost}`} title="Ricarica">
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </button>
        </div>
      </div>

      {errore && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
          {errore} — verifica che la edge function `admin` sia deployata e che il tuo account sia tra gli admin.
        </div>
      )}

      {!utenti && !errore ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-primary-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento utenti…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="bg-primary-50/60 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                <th className="px-4 py-2.5">Utente</th>
                <th className="px-3 py-2.5">Piano</th>
                <th className="px-3 py-2.5">Scadenza</th>
                <th className="px-3 py-2.5">Crediti</th>
                <th className="px-3 py-2.5">Filtri (province / classi)</th>
                <th className="px-3 py-2.5">Log notifiche</th>
                <th className="px-3 py-2.5">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filtrati.map((u) => {
                const inEdit = editId === u.id;
                return (
                  <tr key={u.id} className="align-top transition hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      {inEdit ? (
                        <div className="space-y-1">
                          <div className="flex gap-1">
                            <input className={inputCls} value={String(bozza.nome ?? '')} placeholder="Nome"
                              onChange={(e) => setBozza((b) => ({ ...b, nome: e.target.value }))} />
                            <input className={inputCls} value={String(bozza.cognome ?? '')} placeholder="Cognome"
                              onChange={(e) => setBozza((b) => ({ ...b, cognome: e.target.value }))} />
                          </div>
                          <input className={inputCls} value={String(bozza.email ?? '')}
                            onChange={(e) => setBozza((b) => ({ ...b, email: e.target.value }))} />
                        </div>
                      ) : (
                        <>
                          <div className="font-bold text-primary-800">
                            {u.nome || '—'} {u.cognome || ''}
                          </div>
                          <div className="text-primary-500">{u.email}</div>
                          <div className="mt-0.5 text-primary-400">
                            🎟 {u.referral_code ?? '—'} {u.onboarded ? '· onboarded' : ''}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <select
                          className={inputCls}
                          value={String(bozza.piano ?? 'base')}
                          onChange={(e) => setBozza((b) => ({ ...b, piano: e.target.value }))}
                        >
                          <option value="base">Base</option>
                          <option value="pro">PRO</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            u.piano === 'pro' ? 'bg-accent-100 text-accent-700' : 'bg-primary-100 text-primary-600'
                          }`}
                        >
                          {u.piano === 'pro' ? 'PRO' : 'Base'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <input
                          type="date"
                          className={inputCls}
                          value={String(bozza.abbonamento_scade_il ?? '')}
                          onChange={(e) => setBozza((b) => ({ ...b, abbonamento_scade_il: e.target.value }))}
                        />
                      ) : (
                        <span className="text-primary-600">{fmtData(u.abbonamento_scade_il)}</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <input
                          type="number"
                          min={0}
                          className={`${inputCls} w-20`}
                          value={String(bozza.crediti ?? 0)}
                          onChange={(e) => setBozza((b) => ({ ...b, crediti: e.target.value }))}
                        />
                      ) : (
                        <span className="text-primary-600">{u.crediti ?? 0}</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-primary-500">
                      <div>📍 {u.province_interesse?.length ? u.province_interesse.join(', ') : 'tutte'}</div>
                      <div>📚 {u.classi_concorso?.length ? u.classi_concorso.join(', ') : 'tutte'}</div>
                    </td>
                    <td className="px-3 py-3 text-primary-500">
                      <div>🗓 anno {u.notifiche_anno ?? 0} · usate {u.notifiche_usate ?? 0}</div>
                      <div>✅ blocco: {u.notifiche_blocco_inviato ? 'sì' : 'no'} · recap: {u.notifiche_recap_inviato ? 'sì' : 'no'}</div>
                      <div>⏳ step4: {fmtData(u.step4_inviata_at)} · step5: {u.step5_inviata ? 'sì' : 'no'}</div>
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={() => void salva(u)} className={`${btnCls} ${btnPrim}`}>
                            Salva
                          </button>
                          <button type="button" onClick={() => setEditId(null)} className={`${btnCls} ${btnGhost}`}>
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => iniziaModifica(u)} className={`${btnCls} ${btnGhost}`}>
                          <Pencil className="h-3.5 w-3.5" /> Modifica
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrati.length === 0 && (
            <div className="p-8 text-center text-sm text-primary-400">Nessun utente trovato.</div>
          )}
        </div>
      )}
    </section>
  );
}

function TabOpportunita() {
  const [lista, setLista] = useState<Opportunita[] | null>(null);
  const [errore, setErrore] = useState('');
  const [nota, setNota] = useState('');
  const [ricerca, setRicerca] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [bozza, setBozza] = useState<Record<string, string>>({});
  const [invioId, setInvioId] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setErrore('');
    try {
      const data = await chiamaAdmin<{ opportunita: Opportunita[] }>('list_opportunities');
      setLista(data.opportunita ?? []);
    } catch (e) {
      setErrore((e as Error).message);
      setLista(null);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const filtrate = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    if (!q || !lista) return lista ?? [];
    return (lista ?? []).filter(
      (o) =>
        o.title?.toLowerCase().includes(q) ||
        o.province?.toLowerCase().includes(q) ||
        o.school_name?.toLowerCase().includes(q) ||
        (o.class_codes ?? []).some((c) => c.toLowerCase().includes(q)),
    );
  }, [ricerca, lista]);

  const iniziaModifica = (o: Opportunita) => {
    setEditId(o.id);
    setBozza({
      title: o.title ?? '',
      province: o.province ?? '',
      school_name: o.school_name ?? '',
      source_url: o.source_url ?? '',
      expiration_date: o.expiration_date ? String(o.expiration_date).slice(0, 10) : '',
    });
  };

  const salva = async (o: Opportunita) => {
    try {
      const updates: Record<string, unknown> = {
        title: String(bozza.title ?? '').trim(),
        province: String(bozza.province ?? '').trim() || null,
        school_name: String(bozza.school_name ?? '').trim() || null,
        source_url: String(bozza.source_url ?? '').trim() || null,
        expiration_date: bozza.expiration_date ? String(bozza.expiration_date) : null,
      };
      await chiamaAdmin('update_opportunity', { id: o.id, updates });
      setEditId(null);
      setNota('✅ Opportunità aggiornata.');
      void carica();
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const elimina = async (o: Opportunita) => {
    if (!window.confirm(`Eliminare definitivamente «${o.title}»?`)) return;
    try {
      await chiamaAdmin('delete_opportunity', { id: o.id });
      setNota('🗑 Opportunità eliminata.');
      void carica();
    } catch (e) {
      setErrore((e as Error).message);
    }
  };

  const inviaNotifica = async (o: Opportunita) => {
    setInvioId(o.id);
    setNota('');
    setErrore('');
    try {
      const data = await chiamaAdmin<{ destinatariCompatibili: number; inviati: number; falliti: number }>(
        'dispatch_opportunity',
        { id: o.id },
      );
      setNota(
        `📨 Invio manuale: ${data.destinatariCompatibili ?? 0} destinatari compatibili, ` +
          `${data.inviati ?? 0} inviati, ${data.falliti ?? 0} falliti.`,
      );
    } catch (e) {
      setErrore((e as Error).message);
    } finally {
      setInvioId(null);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-100 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary-800">
            <Briefcase className="h-4 w-4 text-primary-500" /> Opportunità scraped ({lista?.length ?? '…'})
          </h2>
          <p className="mt-0.5 text-xs text-primary-400">
            Modifica/elimina gli interpelli e forza invii manuali per i test (dispatch via send-notification).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-400" />
            <input
              value={ricerca}
              onChange={(e) => setRicerca(e.target.value)}
              placeholder="Cerca titolo, provincia, classe…"
              className={`${inputCls} w-60 pl-8`}
            />
          </div>
          <button type="button" onClick={() => void carica()} className={`${btnCls} ${btnGhost}`} title="Ricarica">
            <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
          </button>
        </div>
      </div>

      {errore && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{errore}</div>
      )}
      {nota && (
        <div className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">{nota}</div>
      )}

      {!lista && !errore ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-primary-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento opportunità…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-primary-50/60 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                <th className="px-4 py-2.5">Titolo</th>
                <th className="px-3 py-2.5">Prov.</th>
                <th className="px-3 py-2.5">Classi</th>
                <th className="px-3 py-2.5">Scuola</th>
                <th className="px-3 py-2.5">Sorgente ufficiale</th>
                <th className="px-3 py-2.5">Scadenza</th>
                <th className="px-3 py-2.5">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filtrate.map((o) => {
                const inEdit = editId === o.id;
                const inInvio = invioId === o.id;
                return (
                  <tr key={o.id} className="align-top transition hover:bg-primary-50/40">
                    <td className="max-w-[320px] px-4 py-3">
                      {inEdit ? (
                        <input className={inputCls} value={bozza.title ?? ''} placeholder="Titolo"
                          onChange={(e) => setBozza((b) => ({ ...b, title: e.target.value }))} />
                      ) : (
                        <>
                          <div className="font-bold leading-snug text-primary-800">{o.title}</div>
                          <div className="mt-0.5 text-[11px] text-primary-400">
                            {fmtData(o.created_at)} · {o.hash_id?.slice(0, 8) ?? '—'}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <input className={`${inputCls} w-16`} value={bozza.province ?? ''} placeholder="MI"
                          onChange={(e) => setBozza((b) => ({ ...b, province: e.target.value }))} />
                      ) : (
                        <span className="inline-block rounded-full bg-primary-100 px-2 py-0.5 font-bold text-primary-600">
                          {o.province ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-primary-500">
                      {o.class_codes?.length ? o.class_codes.join(', ') : <span className="text-red-400">senza classi</span>}
                    </td>
                    <td className="max-w-[180px] px-3 py-3 text-primary-500">
                      {inEdit ? (
                        <input className={inputCls} value={bozza.school_name ?? ''} placeholder="Scuola"
                          onChange={(e) => setBozza((b) => ({ ...b, school_name: e.target.value }))} />
                      ) : (
                        <div className="truncate" title={o.school_name ?? ''}>{o.school_name ?? '—'}</div>
                      )}
                    </td>
                    <td className="max-w-[220px] px-3 py-3">
                      {inEdit ? (
                        <input className={inputCls} value={bozza.source_url ?? ''} placeholder="https://…"
                          onChange={(e) => setBozza((b) => ({ ...b, source_url: e.target.value }))} />
                      ) : o.source_url ? (
                        <a href={o.source_url} target="_blank" rel="noopener noreferrer"
                          className="break-all text-primary-600 underline hover:text-primary-800">
                          {o.source_url}
                        </a>
                      ) : (
                        <span className="text-red-400">mancante</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-primary-500">
                      {inEdit ? (
                        <input type="date" className={inputCls} value={bozza.expiration_date ?? ''}
                          onChange={(e) => setBozza((b) => ({ ...b, expiration_date: e.target.value }))} />
                      ) : (
                        fmtData(o.expiration_date)
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {inEdit ? (
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => void salva(o)} className={`${btnCls} ${btnPrim}`}>
                            Salva
                          </button>
                          <button type="button" onClick={() => setEditId(null)} className={`${btnCls} ${btnGhost}`}>
                            Annulla
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <button type="button" onClick={() => iniziaModifica(o)} className={`${btnCls} ${btnGhost}`}>
                            <Pencil className="h-3.5 w-3.5" /> Modifica
                          </button>
                          <button type="button" disabled={inInvio}
                            onClick={() => void inviaNotifica(o)}
                            className={`${btnCls} ${btnPrim} disabled:opacity-50`}>
                            {inInvio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            {inInvio ? 'Invio…' : 'Invia notifica'}
                          </button>
                          <button type="button" onClick={() => void elimina(o)} className={`${btnCls} ${btnDanger}`}>
                            <Trash2 className="h-3.5 w-3.5" /> Elimina
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrate.length === 0 && (
            <div className="p-8 text-center text-sm text-primary-400">Nessuna opportunità trovata.</div>
          )}
        </div>
      )}
    </section>
  );
}

function TabReferral() {
  const [rows, setRows] = useState<ReferralRow[] | null>(null);
  const [errore, setErrore] = useState('');

  const carica = useCallback(async () => {
    setErrore('');
    try {
      const data = await chiamaAdmin<{ referrals: ReferralRow[] }>('list_referrals');
      setRows(data.referrals ?? []);
    } catch (e) {
      setErrore((e as Error).message);
      setRows(null);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const totali = useMemo(() => {
    const t = { inviti: 0, completati: 0, premio: 0 };
    for (const r of rows ?? []) {
      t.inviti += r.inviti ?? 0;
      t.completati += r.completati ?? 0;
      t.premio += r.premio ?? 0;
    }
    return t;
  }, [rows]);

  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-100 p-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary-800">
            <Gift className="h-4 w-4 text-primary-500" /> Referral System — panoramica
          </h2>
          <p className="mt-0.5 text-xs text-primary-400">
            Codici invito, conversioni paganti (referrals completati) e premi Amazon da erogare.
          </p>
        </div>
        <button type="button" onClick={() => void carica()} className={`${btnCls} ${btnGhost}`} title="Ricarica">
          <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
        </button>
      </div>

      {errore && (
        <div className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{errore}</div>
      )}

      {!rows && !errore ? (
        <div className="flex items-center justify-center gap-2 p-8 text-sm text-primary-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento referral…
        </div>
      ) : (
        <>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-xl bg-primary-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Codici in uso</div>
              <div className="mt-1 text-2xl font-bold text-primary-800">
                {(rows ?? []).filter((r) => r.referral_code).length}
              </div>
            </div>
            <div className="rounded-xl bg-accent-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-accent-600">Inviti totali</div>
              <div className="mt-1 text-2xl font-bold text-accent-700">{totali.inviti}</div>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Premi Amazon in sospeso</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">
                €{totali.premio.toFixed(2)} <span className="text-xs font-semibold text-emerald-500">({totali.completati} conversione/i)</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-t border-primary-100">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-primary-50/60 text-[11px] uppercase tracking-wide text-primary-500">
                <tr>
                  <th className="px-4 py-2.5">Utente</th>
                  <th className="px-3 py-2.5">Codice invito</th>
                  <th className="px-3 py-2.5">Inviti</th>
                  <th className="px-3 py-2.5">Conversioni paganti</th>
                  <th className="px-3 py-2.5">Premio Amazon (€)</th>
                  <th className="px-3 py-2.5">Registrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-100">
                {(rows ?? []).map((r) => (
                  <tr key={r.id} className="transition hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <div className="font-bold text-primary-800">{r.nome || '—'} {r.cognome || ''}</div>
                      <div className="text-primary-500">{r.email ?? '—'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-md bg-primary-100 px-2 py-0.5 font-mono font-bold text-primary-700">
                        {r.referral_code ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-primary-600">{r.inviti ?? 0}</td>
                    <td className="px-3 py-3 text-primary-600">{r.completati ?? 0}</td>
                    <td className="px-3 py-3 font-bold text-emerald-600">€{(r.premio ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-3 text-primary-400">{fmtData(r.creato)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(rows ?? []).length === 0 && (
              <div className="p-8 text-center text-sm text-primary-400">Nessun dato referral.</div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
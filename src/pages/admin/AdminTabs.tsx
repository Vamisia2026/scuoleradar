/* Pannello Admin — tab Utenti / Radar / Account (refactor). */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarPlus,
  Copy,
  Download,
  Edit3,
  Eye,
  KeyRound,
  Loader2,
  Lock,
  Radar as RadarIcon,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  DEV,
  caricaUtenti,
  aggiornaUtente,
  inviaResetPassword,
  creaUtente,
  eliminaUtente,
  AdminApiError,
  type NuovoUtenteInput,
} from './adminService';
import {
  BadgeBeta,
  BadgePiano,
  BadgePianoCompatto,
  btnAdmin,
  btnDanger,
  btnGhost,
  btnPrim,
  Chips,
  ConfermaDialog,
  ConfermaStato,
  inputAdmin,
  nomeCognome,
  StatoRadarBadge,
} from './adminUi';
import { dataItaliana, type AdminUtente } from './types';

type IdColonna = 'id' | 'nome' | 'genere' | 'eta' | 'email' | 'telegram' | 'telefono' | 'province' | 'piano' | 'login' | 'azioni';

const COLONNE: { id: IdColonna; label: string; def: boolean }[] = [
  { id: 'id', label: 'User ID', def: true },
  { id: 'nome', label: 'Nome & Cognome', def: true },
  { id: 'genere', label: 'Genere', def: true },
  { id: 'eta', label: 'Età', def: true },
  { id: 'email', label: 'Email', def: true },
  { id: 'telegram', label: 'Telegram', def: true },
  { id: 'telefono', label: 'Phone', def: true },
  { id: 'province', label: 'Provincia', def: true },
  { id: 'piano', label: 'Piano', def: true },
  { id: 'login', label: 'Login', def: false },
  { id: 'azioni', label: 'Azioni', def: true },
];

function scaricaCsv(righe: AdminUtente[], nomeFile = 'utenti_admin.csv'): void {
  const headers = ['id', 'nome', 'cognome', 'genere', 'eta', 'email', 'piano', 'province', 'telegram', 'registrato_il'];
  const campi = (u: AdminUtente) => [
    u.id,
    u.nome ?? '',
    u.cognome ?? '',
    u.genere === 'M' ? 'Uomo' : u.genere === 'F' ? 'Donna' : '',
    u.eta ?? '',
    u.email,
    u.piano ?? 'base',
    (u.province_interesse ?? u.province_attive ?? []).join('|'),
    u.telegram_chat_id ?? '',
    u.created_at ?? '',
  ];
  const testo = [headers.join(';'), ...righe.map((u) => campi(u).map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + testo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

function loginType(u: AdminUtente): string {
  const lt = u.login_type?.trim();
  if (lt) return lt.toUpperCase();
  if (u.email) return 'GOOGLE';
  return '—';
}

function telefono(u: AdminUtente): string {
  const tel = u.telefono?.trim();
  return tel || '—';
}

/** Badge Genere: M → Uomo, F → Donna, altrimenti —. */
function badgeGenere(u: AdminUtente): string {
  if (u.genere === 'M') return 'Uomo';
  if (u.genere === 'F') return 'Donna';
  return '—';
}

/** Handle/ID Telegram: preferisce l'username (@…), poi chat ID, poi eventuale colonna legacy `telegram`. */
function testoTelegram(u: AdminUtente): string {
  const username = u.telegram_username?.trim();
  if (username) return username.startsWith('@') ? username : `@${username}`;
  const chat = u.telegram_chat_id?.trim();
  if (chat) return chat;
  const legacy = u.telegram?.trim();
  return legacy || '';
}

export function TabUtenti() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ricerca, setRicerca] = useState('');
  const [filtroPiano, setFiltroPiano] = useState('');
  const [filtroProvincia, setFiltroProvincia] = useState('');
  const [colonneMenu, setColonneMenu] = useState(false);
  const [colonne, setColonne] = useState<Set<IdColonna>>(() => new Set(COLONNE.filter((c) => c.def).map((c) => c.id)));
  const [conferma, setConferma] = useState<ConfermaStato | null>(null);
  const [dettaglio, setDettaglio] = useState<AdminUtente | null>(null);

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    setErrore(null);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      const messaggio = err instanceof AdminApiError ? err.message : (err as Error).message;
      console.error('[admin] caricamento utenti fallito', err);
      setErrore(messaggio);
      mostraToast('errore', messaggio);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    const prov = filtroProvincia.trim().toUpperCase();
    return utenti.filter((u) => {
      if (q) {
        const testo = `${u.id} ${u.email} ${u.nome ?? ''} ${u.cognome ?? ''}`.toLowerCase();
        if (!testo.includes(q)) return false;
      }
      if (filtroPiano && (u.piano ?? 'base') !== filtroPiano) return false;
      if (prov) {
        const province = u.province_interesse ?? u.province_attive ?? [];
        if (!province.some((p) => p.toUpperCase() === prov)) return false;
      }
      return true;
    });
  }, [utenti, ricerca, filtroPiano, filtroProvincia]);

  const aggiornaRiga = (id: string, updates: Record<string, unknown>): void => {
    setUtenti((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
  };

  const salva = async (id: string, updates: Record<string, unknown>, messaggio: string): Promise<void> => {
    try {
      await aggiornaUtente(id, updates);
      aggiornaRiga(id, updates);
      mostraToast('successo', messaggio);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    }
  };

  const resetPassword = (u: AdminUtente): void => {
    setConferma({
      titolo: 'Invia reset password',
      messaggio: `Invieremo una email di recupero a ${u.email}. Continuare?`,
      onConferma: async () => {
        try {
          await inviaResetPassword(u.email);
          mostraToast('successo', `Reset password inviato a ${u.email}`);
        } catch (err) {
          const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
          mostraToast('errore', msg);
        }
      },
    });
  };

  const toggleColonna = (c: IdColonna): void => {
    setColonne((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  // Aggiunta / eliminazione utenti (con conferma esplicita).
  const [nuovoAperto, setNuovoAperto] = useState(false);
  const [nuovo, setNuovo] = useState<NuovoUtenteInput>({
    email: '',
    password: 'Scuoleradar2026',
    nome: '',
    cognome: '',
    telefono: '',
    piano: 'base',
    isBetaTester: false,
  });
  const [creazione, setCreazione] = useState(false);
  const [eliminaTarget, setEliminaTarget] = useState<AdminUtente | null>(null);
  const [testoEliminazione, setTestoEliminazione] = useState('');

  const salvaNuovo = async (): Promise<void> => {
    const em = nuovo.email.trim().toLowerCase();
    if (!em || nuovo.password.length < 6) {
      mostraToast('errore', 'Servono una email valida e una password di almeno 6 caratteri.');
      return;
    }
    setCreazione(true);
    try {
      if (DEV) {
        // Demo locale: riga simulata (nessun account reale).
        const rigaDemo: AdminUtente = {
          id: `demo-${Date.now()}`,
          email: em,
          nome: nuovo.nome ?? '',
          cognome: nuovo.cognome ?? '',
          telefono: nuovo.telefono ?? '',
          piano: nuovo.piano ?? 'base',
          created_at: new Date().toISOString(),
          onboarded: true,
          province_interesse: [],
          classi_concorso: [],
          materie_id: [],
          telegram_chat_id: null,
          telegram_username: '',
          _demo: true,
        };
        setUtenti((prev) => [rigaDemo, ...prev]);
        mostraToast('successo', 'Utente aggiunto (modalità demo).');
      } else {
        await creaUtente(nuovo);
        mostraToast('successo', 'Utente creato con successo.');
        void carica();
      }
      setNuovoAperto(false);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    } finally {
      setCreazione(false);
    }
  };

  const richiediEliminazione = (u: AdminUtente): void => {
    setTestoEliminazione('');
    setEliminaTarget(u);
  };

  const confermaEliminazione = async (): Promise<void> => {
    if (!eliminaTarget) return;
    if (testoEliminazione.trim().toUpperCase() !== 'DELETE') {
      mostraToast('errore', 'Digita DELETE per confermare l\'eliminazione.');
      return;
    }
    setCreazione(true);
    try {
      if (DEV) {
        setUtenti((prev) => prev.filter((x) => x.id !== eliminaTarget.id));
        mostraToast('successo', 'Utente rimosso (modalità demo).');
      } else {
        await eliminaUtente(eliminaTarget.id);
        setUtenti((prev) => prev.filter((x) => x.id !== eliminaTarget.id));
        mostraToast('successo', 'Utente eliminato definitivamente.');
      }
      setEliminaTarget(null);
    } catch (err) {
      const msg = err instanceof AdminApiError ? err.message : (err as Error).message;
      mostraToast('errore', msg);
    } finally {
      setCreazione(false);
    }
  };

  const [modifica, setModifica] = useState<{ id: string; campo: string; valore: string } | null>(null);
  const [salvataggio, setSalvataggio] = useState(false);

  const iniziaModifica = (u: AdminUtente, campo: string, valore: string): void => {
    setModifica({ id: u.id, campo, valore });
  };

  const proponiSalvataggio = (id: string, campo: string, valore: string): void => {
    const updates: Record<string, unknown> = {};
    if (campo === 'nome') updates.nome = valore.trim();
    if (campo === 'cognome') updates.cognome = valore.trim();
    if (campo === 'telegram') updates.telegram_username = valore.trim();
    if (campo === 'telefono') updates.telefono = valore.trim();
    if (campo === 'province') {
      const lista = valore.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
      updates.province_interesse = lista;
      updates.province_attive = lista;
    }
    if (Object.keys(updates).length === 0) return;
    setConferma({
      titolo: 'Conferma modifica su database',
      messaggio: `Campo "${campo}" dell'utente ${id.slice(0, 8)}… sarà aggiornato: "${valore.trim() || '—'}". Procedere?`,
      onConferma: async () => {
        setSalvataggio(true);
        await salva(id, updates, `Campo "${campo}" aggiornato.`);
        setSalvataggio(false);
        setModifica(null);
      },
    });
  };

  const testoCell = (u: AdminUtente, campo: string): string => {
    if (campo === 'nome') return u.nome ?? '';
    if (campo === 'cognome') return u.cognome ?? '';
    if (campo === 'telegram') return testoTelegram(u);
    if (campo === 'telefono') return telefono(u);
    if (campo === 'province') return (u.province_interesse ?? u.province_attive ?? []).join(', ');
    return '';
  };

  const visibile = (c: IdColonna): boolean => colonne.has(c);

  return (
    <div>
      {/* Barra strumenti: filtri rapidi + esportazione */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-300" />
          <input
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            placeholder="Cerca per nome, email o ID…"
            className={`${inputAdmin} w-64 pl-8`}
          />
        </label>
        <select value={filtroPiano} onChange={(e) => setFiltroPiano(e.target.value)} className={`${inputAdmin} w-36`}>
          <option value="">Tutti i piani</option>
          <option value="base">Base</option>
          <option value="pro">PRO</option>
          <option value="free_forever">Free Forever</option>
        </select>
        <input
          value={filtroProvincia}
          onChange={(e) => setFiltroProvincia(e.target.value)}
          placeholder="Provincia (es. AT)"
          className={`${inputAdmin} w-32`}
        />
        <button type="button" onClick={() => { void carica(); }} className={`${btnAdmin} ${btnGhost}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Ricarica
        </button>
        <button type="button" onClick={() => setNuovoAperto(true)} className={`${btnAdmin} ${btnPrim}`}>
          <UserPlus className="h-3.5 w-3.5" /> Aggiungi Utente
        </button>

        <div className="relative ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setColonneMenu((v) => !v)}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Eye className="h-3.5 w-3.5" /> Colonne
          </button>
          {colonneMenu && (
            <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-primary-100 bg-white p-2 shadow-card">
              {COLONNE.filter((c) => c.id !== 'azioni').map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs text-primary-700 hover:bg-primary-50">
                  <input type="checkbox" checked={visibile(c.id)} onChange={() => toggleColonna(c.id)} />
                  {c.label}
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              scaricaCsv(filtrati);
              mostraToast('successo', 'CSV esportato.');
            }}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(
                  ['id;email;nome;cognome;piano;province;telegram',
                    ...filtrati.map((u) => [u.id, u.email, u.nome ?? '', u.cognome ?? '', u.piano ?? 'base', (u.province_interesse ?? u.province_attive ?? []).join('|'), u.telegram_chat_id ?? ''].join(';'))].join('\n'),
                )
                .then(() => mostraToast('successo', 'Dati copiati per Google Sheets.'));
            }}
            className={`${btnAdmin} ${btnGhost}`}
          >
            <Copy className="h-3.5 w-3.5" /> Google Sheets
          </button>
        </div>
      </div>

      {/* Nota demo / sviluppo */}
      {DEV && (
        <p className="mb-2 rounded-lg bg-warning-50 px-3 py-2 text-[11px] text-warning-700">
          Modalità sviluppo: senza sessione Supabase vengono mostrati dati demo e le modifiche non vengono
          scritte sul database (il pannello completo richiede il login reale).
        </p>
      )}

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento utenti…
        </div>
      ) : errore ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-sm text-red-600">
          {errore}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-primary-50/70 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                {visibile('id') && <th className="px-3 py-2.5">User ID</th>}
                {visibile('nome') && <th className="px-3 py-2.5">Nome &amp; Cognome</th>}
                {visibile('genere') && <th className="px-3 py-2.5">Genere</th>}
                {visibile('eta') && <th className="px-3 py-2.5">Età</th>}
                {visibile('email') && <th className="px-3 py-2.5">Email</th>}
                {visibile('telegram') && <th className="px-3 py-2.5">Telegram</th>}
                {visibile('telefono') && <th className="px-3 py-2.5">Phone</th>}
                {visibile('province') && <th className="px-3 py-2.5">Provincia</th>}
                {visibile('piano') && <th className="px-3 py-2.5">Piano</th>}
                {visibile('login') && <th className="px-3 py-2.5">Login</th>}
                {visibile('azioni') && <th className="px-3 py-2.5 text-right">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filtrati.map((u) => {
                const cellaTesto = (campo: string) =>
                  modifica?.id === u.id && modifica.campo === campo ? (
                    <input
                      autoFocus
                      value={modifica.valore}
                      onChange={(e) => setModifica({ ...modifica, valore: e.target.value })}
                      onBlur={() => proponiSalvataggio(u.id, campo, modifica.valore)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') proponiSalvataggio(u.id, campo, modifica.valore);
                        if (e.key === 'Escape') setModifica(null);
                      }}
                      className={`${inputAdmin} w-32`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => iniziaModifica(u, campo, testoCell(u, campo))}
                      title="Clic per modificare la cella"
                      className="group inline-flex max-w-[180px] items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-primary-50"
                    >
                      <span className="truncate">{testoCell(u, campo) || '—'}</span>
                      <Edit3 className="h-3 w-3 shrink-0 text-primary-300 opacity-0 transition group-hover:opacity-100" />
                    </button>
                  );
                return (
                  <tr
                    key={u.id}
                    onDoubleClick={() => setDettaglio(u)}
                    title="Doppio click per aprire la scheda completa"
                    className="cursor-pointer align-top transition hover:bg-primary-50/40"
                  >
                    {visibile('id') && (
                      <td className="px-3 py-2.5 font-mono text-[10px] text-primary-400">{u.id.slice(0, 13)}…</td>
                    )}
                    {visibile('nome') && (
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-primary-800">{cellaTesto('nome')}</span>
                          {u.is_beta_tester === true && <BadgeBeta />}
                        </div>
                        {cellaTesto('cognome')}
                      </td>
                    )}
                    {visibile('genere') && (
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            u.genere === 'F'
                              ? 'bg-pink-100 text-pink-700'
                              : u.genere === 'M'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-primary-50 text-primary-400'
                          }`}
                        >
                          {badgeGenere(u)}
                        </span>
                      </td>
                    )}
                    {visibile('eta') && (
                      <td className="px-3 py-2.5">
                        {typeof u.eta === 'number' ? (
                          <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">
                            {u.eta} anni
                          </span>
                        ) : (
                          <span className="text-primary-300">—</span>
                        )}
                      </td>
                    )}
                    {visibile('email') && <td className="px-3 py-2.5 text-primary-600">{u.email}</td>}
                    {visibile('telegram') && <td className="px-3 py-2.5">{cellaTesto('telegram')}</td>}
                    {visibile('telefono') && <td className="px-3 py-2.5">{cellaTesto('telefono')}</td>}
                    {visibile('province') && <td className="px-3 py-2.5">{cellaTesto('province')}</td>}
                    {visibile('piano') && (
                      <td className="px-3 py-2.5">
                        <BadgePianoCompatto utente={u} />
                      </td>
                    )}
                    {visibile('login') && <td className="px-3 py-2.5">{loginType(u)}</td>}
                    {visibile('azioni') && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setDettaglio(u)} className={`${btnAdmin} ${btnGhost}`} title="Apri scheda completa">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => resetPassword(u)} className={`${btnAdmin} ${btnGhost}`} title="Invia reset password">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => richiediEliminazione(u)} className={`${btnAdmin} ${btnDanger}`} title="Elimina definitivamente">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtrati.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-primary-400">
                    Nessun utente trovato con i filtri correnti.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {dettaglio && <DettaglioUtente utente={dettaglio} onChiudi={() => setDettaglio(null)} />}
      {nuovoAperto && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Aggiungi utente">
          <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={() => setNuovoAperto(false)} />
          <form
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-card animate-pop"
            onSubmit={(e) => { e.preventDefault(); void salvaNuovo(); }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-primary-800">Aggiungi Utente</h3>
              <button type="button" onClick={() => setNuovoAperto(false)} className="rounded-full p-1.5 text-primary-400 hover:bg-primary-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block col-span-2">
                <span className="text-[10px] font-bold uppercase text-primary-500">Email *</span>
                <input type="email" required value={nuovo.email} onChange={(e) => setNuovo({ ...nuovo, email: e.target.value })} placeholder="nome@scuoleradar.it" className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block col-span-2">
                <span className="text-[10px] font-bold uppercase text-primary-500">Password * (min 6)</span>
                <input type="password" required minLength={6} value={nuovo.password} onChange={(e) => setNuovo({ ...nuovo, password: e.target.value })} className={`${inputAdmin} mt-1`} />
                <span className="mt-0.5 block text-[10px] text-primary-400">
                  Default: Scuoleradar2026 — al primo accesso l'utente dovrà cambiarla.
                </span>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Nome</span>
                <input value={nuovo.nome ?? ''} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Cognome</span>
                <input value={nuovo.cognome ?? ''} onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Phone</span>
                <input value={nuovo.telefono ?? ''} onChange={(e) => setNuovo({ ...nuovo, telefono: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Piano</span>
                <select
                  value={nuovo.piano ?? 'base'}
                  onChange={(e) => {
                    const pianoSel = e.target.value;
                    setNuovo({
                      ...nuovo,
                      piano: pianoSel,
                      proTipo:
                        pianoSel === 'pro_mensile' ? 'mensile' : pianoSel === 'pro_annuale' ? 'annuale' : null,
                    });
                  }}
                  className={`${inputAdmin} mt-1`}
                >
                  <option value="base">Base</option>
                  <option value="pro_mensile">PRO Mensile</option>
                  <option value="pro_annuale">PRO Annuale</option>
                  <option value="free_forever">Free Forever</option>
                </select>
                <label className="col-span-2 mt-1 flex cursor-pointer items-center gap-1.5 text-xs text-primary-700">
                  <input
                    type="checkbox"
                    checked={nuovo.isBetaTester === true}
                    onChange={(e) => setNuovo({ ...nuovo, isBetaTester: e.target.checked })}
                  />
                  Beta Tester (segmentazione campagne email)
                </label>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setNuovoAperto(false)} className={`${btnAdmin} ${btnGhost}`}>Annulla</button>
              <button type="submit" disabled={creazione} className={`${btnAdmin} ${btnPrim}`}>
                {creazione ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Crea account
              </button>
            </div>
          </form>
        </div>
      )}

      {eliminaTarget && (
        <div className="fixed inset-0 z-[92] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Conferma eliminazione">
          <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={() => setEliminaTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-card animate-pop">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-primary-800">Eliminazione definitiva</h3>
                <p className="mt-1 text-xs leading-relaxed text-primary-500">
                  L'eliminazione è irreversibile (account, profilo e preferenze). Digita{' '}
                  <b className="text-primary-800">DELETE</b> per abilitare la conferma.
                </p>
              </div>
            </div>
            <input
              value={testoEliminazione}
              onChange={(e) => setTestoEliminazione(e.target.value)}
              placeholder="DELETE"
              className={`${inputAdmin} mt-3 font-mono`}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEliminaTarget(null)} className={`${btnAdmin} ${btnGhost}`}>Annulla</button>
              <button
                type="button"
                disabled={testoEliminazione.trim().toUpperCase() !== 'DELETE' || creazione}
                onClick={() => void confermaEliminazione()}
                className={`${btnAdmin} ${btnDanger} bg-red-600 text-white hover:bg-red-700`}
              >
                {creazione ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Conferma eliminazione definitiva
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfermaDialog
        stato={conferma}
        inCorso={salvataggio}
        onChiudi={() => {
          if (!salvataggio) setConferma(null);
        }}
      />
    </div>
  );
}

function DettaglioUtente({ utente, onChiudi }: { utente: AdminUtente; onChiudi: () => void }) {
  const colonna = (label: string, valore: ReactNode) => (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-primary-400">{label}</div>
      <div className="mt-0.5 text-xs text-primary-800">{valore}</div>
    </div>
  );
  const radarAttivo = utente.radar_attivo !== undefined ? Boolean(utente.radar_attivo) : Boolean(utente.onboarded);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Scheda utente">
      <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onChiudi} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-card animate-pop">
        <header className="flex items-center justify-between gap-3 border-b border-primary-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-primary-800">{nomeCognome(utente)}</h2>
              <p className="text-xs text-primary-400">{utente.email}</p>
            </div>
          </div>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="rounded-full p-2 text-primary-400 hover:bg-primary-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary-100 p-3">
            {colonna('User ID', <span className="font-mono text-[10px]">{utente.id}</span>)}
            {colonna('Piano', <BadgePiano piano={utente.piano} />)}
            {colonna('Registrato il', dataItaliana(utente.created_at))}
            {colonna('Scadenza abbonamento', dataItaliana(utente.abbonamento_scade_il))}
            {colonna('Telegram', utente.telegram_chat_id || '—')}
            {colonna('Phone', telefono(utente))}
            {colonna('Login type', loginType(utente))}
            {colonna('Onboarded', utente.onboarded ? 'Sì' : 'No')}
          </div>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Profilo utente &amp; filtri radar</h3>
            <div className="mt-2 space-y-2 text-xs text-primary-700">
              <p>
                <b>Classi di concorso:</b> <Chips valori={utente.classi_concorso} />
              </p>
              <p>
                <b>Materie:</b> <Chips valori={utente.materie_id} />
              </p>
              <p>
                <b>Province:</b> <Chips valori={utente.province_interesse ?? utente.province_attive} />
              </p>
              <p>
                <b>Ordini scuola:</b> <Chips valori={utente.ordini_scuola} />
              </p>
              <p>
                <b>Scuole preferite:</b> <Chips valori={utente.favorite_schools} />
              </p>
              <p>
                <b>Scuole escluse (blacklist):</b> <Chips valori={utente.ignored_schools} />
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Account &amp; storico</h3>
            <div className="mt-2 space-y-2 text-xs text-primary-700">
              <p>
                <b>Codice invito:</b> {utente.referral_code || '—'}
              </p>
              <p>
                <b>Referrer:</b> {utente.referrer_email || utente.referrer_id || '—'}
              </p>
              <p>
                <b>Coupon usato:</b> {utente.coupon_codice || '—'}
                {utente.coupon_tipo ? ` (${utente.coupon_tipo})` : ''}
              </p>
              <p>
                <b>Crediti a consumo:</b> {utente.crediti ?? 0}
              </p>
              <p>
                <b>Notifiche usate:</b> {utente.notifiche_usate ?? 0} / anno
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Stato radar</h3>
            <div className="mt-2">
              <StatoRadarBadge attivo={radarAttivo} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function TabRadar() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [ricerca, setRicerca] = useState('');

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      mostraToast('errore', err instanceof AdminApiError ? err.message : (err as Error).message);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrati = useMemo(() => {
    const q = ricerca.trim().toLowerCase();
    return utenti.filter((u) =>
      q ? `${u.email} ${u.nome ?? ''} ${u.cognome ?? ''}`.toLowerCase().includes(q) : true,
    );
  }, [utenti, ricerca]);

  const toggle = (u: AdminUtente): void => {
    const attuale = u.radar_attivo !== undefined ? Boolean(u.radar_attivo) : Boolean(u.onboarded);
    const nuovo = !attuale;
    // Se la colonna radar_attivo non esiste ancora nel DB mostriamo l'avviso.
    const colonnaAssente = u.radar_attivo === undefined && !DEV;
    if (colonnaAssente) {
      mostraToast('errore', 'Colonna radar_attivo non presente nel database: applica la migrazione admin.');
      return;
    }
    setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, radar_attivo: nuovo } : x)));
    void aggiornaUtente(u.id, { radar_attivo: nuovo }).then(() =>
      mostraToast('successo', `Radar ${nuovo ? 'attivato' : 'disattivato'} per ${u.email}.`),
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary-800">Opportunità &amp; controllo Radar</h2>
        <div className="flex items-center gap-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary-300" />
            <input value={ricerca} onChange={(e) => setRicerca(e.target.value)} placeholder="Cerca utente…" className={`${inputAdmin} w-56 pl-8`} />
          </label>
          <button type="button" onClick={() => void carica()} className={`${btnAdmin} ${btnGhost}`}>
            <RefreshCw className="h-3.5 w-3.5" /> Ricarica
          </button>
        </div>
      </div>

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrati.map((u) => {
            const attivo = u.radar_attivo !== undefined ? Boolean(u.radar_attivo) : Boolean(u.onboarded);
            return (
              <section key={u.id} className="rounded-2xl border border-primary-100 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-primary-800">{nomeCognome(u)}</p>
                    <p className="truncate text-xs text-primary-400">{u.email}</p>
                  </div>
                  <StatoRadarBadge attivo={attivo} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-primary-700">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-primary-400">Classi</div>
                    <Chips valori={u.classi_concorso} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-primary-400">Materie</div>
                    <Chips valori={u.materie_id} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-primary-400">Province</div>
                    <Chips valori={u.province_interesse ?? u.province_attive} />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase text-primary-400">Preferite / Escluse</div>
                    <span className="text-xs">
                      {u.favorite_schools?.length ?? 0} / {u.ignored_schools?.length ?? 0}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 border-t border-primary-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggle(u)}
                    className={`${btnAdmin} px-3 ${attivo ? 'bg-accent-500 text-white hover:bg-accent-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    <RadarIcon className="h-3.5 w-3.5" />
                    {attivo ? 'Disattiva radar' : 'Attiva radar'}
                  </button>
                  <span className="text-[10px] text-primary-400">
                    Toggle istantaneo dello stato radar utente.
                  </span>
                </div>
              </section>
            );
          })}
          {filtrati.length === 0 && (
            <p className="col-span-full p-10 text-center text-sm text-primary-400">Nessun utente.</p>
          )}
        </div>
      )}
    </div>
  );
}

const GIORNO_MS = 86_400_000;

function piuAnni(base: Date | null, giorni: number): Date {
  const b = base && !Number.isNaN(base.getTime()) ? base.getTime() : Date.now();
  return new Date(Math.max(b, Date.now()) + giorni * GIORNO_MS);
}

export function TabAccount() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [conferma, setConferma] = useState<ConfermaStato | null>(null);

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      mostraToast('errore', err instanceof AdminApiError ? err.message : (err as Error).message);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const azione = (u: AdminUtente, titolo: string, updates: Record<string, unknown>, descrizione: string): void => {
    setConferma({
      titolo,
      messaggio: `${descrizione} per ${u.email}? L'operazione viene salvata nel database.`,
      onConferma: async () => {
        await aggiornaUtente(u.id, updates);
        setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updates } : x)));
        mostraToast('successo', `${titolo}: operazione completata.`);
      },
    });
  };

  const upgradeProAnnuale = (u: AdminUtente): void =>
    azione(
      u,
      'Attiva PRO Annuale',
      { piano: 'pro', pro_tipo: 'annuale', abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 365).toISOString() },
      'Assegna il piano PRO annuale',
    );
  const upgradeProMensile = (u: AdminUtente): void =>
    azione(
      u,
      'Attiva PRO Mensile',
      { piano: 'pro', pro_tipo: 'mensile', abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 30).toISOString() },
      'Assegna il piano PRO mensile',
    );
  const downgradeBase = (u: AdminUtente): void =>
    azione(u, 'Downgrade a Base', { piano: 'base', pro_tipo: null, abbonamento_scade_il: null }, "Riporta l'account al piano Base");
  const freeForever = (u: AdminUtente): void =>
    azione(
      u,
      'Imposta Free Forever',
      { piano: 'free_forever', pro_tipo: null, abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 365).toISOString() },
      'Assegna il piano PRO gratuito a vita',
    );
  const regalaMese = (u: AdminUtente): void =>
    azione(u, 'Regala 1 mese gratuito', { abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 30).toISOString() }, 'Estende la scadenza di 30 giorni');

  // Codice invito personale: VISIBILE ma CONGELATO per default; l'admin può
  // sbloccarlo esplicitamente (per riga) prima di modificarlo.
  const [codiciSbloccati, setCodiciSbloccati] = useState<Set<string>>(() => new Set());

  const toggleBeta = (u: AdminUtente): void => {
    const valore = u.is_beta_tester !== true;
    setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_beta_tester: valore } : x)));
    void aggiornaUtente(u.id, { is_beta_tester: valore }).then(() =>
      mostraToast('successo', valore ? 'Utente marcato come Beta Tester.' : 'Flag Beta Tester rimosso.'),
    );
  };

  const toggleCodice = (id: string): void => {
    setCodiciSbloccati((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const salvaCodice = (u: AdminUtente, codice: string): void => {
    const nuovo = codice.trim().toUpperCase();
    if (!nuovo) return;
    azione(u, 'Aggiorna codice invito', { referral_code: nuovo }, "Modifica del codice invito personale dell'utente");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary-800">Account &amp; abbonamento</h2>
        <button type="button" onClick={() => void carica()} className={`${btnAdmin} ${btnGhost}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Ricarica
        </button>
      </div>

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-primary-50/70 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                <th className="px-3 py-2.5">Utente</th>
                <th className="px-3 py-2.5">Registrato</th>
                <th className="px-3 py-2.5">Piano</th>
                <th className="px-3 py-2.5">Scade il</th>
                <th className="px-3 py-2.5">Codice invito</th>
                <th className="px-3 py-2.5">Coupon / Referrer</th>
                <th className="px-3 py-2.5 text-right">Azioni rapide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {utenti.map((u) => {
                const piano = u.piano ?? 'base';
                const proTipo = String(u.pro_tipo ?? '').toLowerCase();
                const attivaAnnuale = piano === 'pro' && (!proTipo || proTipo.includes('annuale'));
                const attivaMensile = piano === 'pro' && proTipo.includes('mensile');
                const attivaBase = piano === 'base';
                const attivaFree = piano === 'free_forever';
                return (
                <tr key={u.id} className="align-top transition hover:bg-primary-50/40">
                  <td className="px-3 py-3">
                    <div className="font-bold text-primary-800">{nomeCognome(u)}</div>
                    <div className="text-primary-500">{u.email}</div>
                    {u.referral_code && (
                      <span className="mt-1 inline-block rounded-md bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] text-primary-600">
                        {u.referral_code}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-primary-600">{dataItaliana(u.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <BadgePianoCompatto utente={u} />
                      {u.is_beta_tester === true && <BadgeBeta />}
                    </div>
                    <label className="mt-1 flex cursor-pointer items-center gap-1 text-[10px] text-primary-500">
                      <input type="checkbox" checked={u.is_beta_tester === true} onChange={() => toggleBeta(u)} />
                      Beta Tester
                    </label>
                  </td>
                  <td className="px-3 py-3 text-primary-600">{dataItaliana(u.abbonamento_scade_il)}</td>
                  <td className="px-3 py-3">
                    {codiciSbloccati.has(u.id) ? (
                      <input
                        autoFocus
                        defaultValue={u.referral_code ?? ''}
                        placeholder="NUOVOCODICE"
                        onBlur={(e) => salvaCodice(u, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') toggleCodice(u.id);
                        }}
                        className={`${inputAdmin} w-36`}
                      />
                    ) : (
                      <span
                        title="Codice congelato: usa “Sblocca codice” per modificarlo"
                        className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 font-mono text-[10px] text-primary-600"
                      >
                        <Lock className="h-3 w-3 text-primary-300" />
                        {u.referral_code || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-primary-600">
                    <div>Coupon: {u.coupon_codice ? `${u.coupon_codice} (${u.coupon_tipo ?? '?'})` : '—'}</div>
                    <div>Referrer: {u.referrer_email || u.referrer_id || '—'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-pressed={attivaAnnuale}
                        onClick={attivaAnnuale ? undefined : () => upgradeProAnnuale(u)}
                        title={attivaAnnuale ? 'Piano attuale: PRO Annuale' : 'Assegna il piano PRO annuale'}
                        className={`${btnAdmin} ${
                          attivaAnnuale
                            ? 'cursor-default bg-orange-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        PRO Anno
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaMensile}
                        onClick={attivaMensile ? undefined : () => upgradeProMensile(u)}
                        title={attivaMensile ? 'Piano attuale: PRO Mensile' : 'Assegna il piano PRO mensile'}
                        className={`${btnAdmin} ${
                          attivaMensile
                            ? 'cursor-default bg-yellow-400 text-slate-900 shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        PRO Mese
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaBase}
                        onClick={attivaBase ? undefined : () => downgradeBase(u)}
                        title={attivaBase ? 'Piano attuale: Base' : 'Porta al piano Base'}
                        className={`${btnAdmin} ${
                          attivaBase
                            ? 'cursor-default bg-cyan-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Base
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaFree}
                        onClick={attivaFree ? undefined : () => freeForever(u)}
                        title={attivaFree ? 'Piano attuale: PRO Free Forever' : 'Assegna il piano PRO gratuito a vita'}
                        className={`${btnAdmin} ${
                          attivaFree
                            ? 'cursor-default bg-red-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Free Forever
                      </button>
                      <button type="button" onClick={() => regalaMese(u)} className={`${btnAdmin} ${btnGhost}`}>
                        <CalendarPlus className="h-3.5 w-3.5" /> +30gg
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCodice(u.id)}
                        className={`${btnAdmin} ${btnGhost}`}
                        title={codiciSbloccati.has(u.id) ? 'Blocca di nuovo il codice invito' : 'Sblocca la modifica del codice invito'}
                      >
                        {codiciSbloccati.has(u.id) ? <X className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                        {codiciSbloccati.has(u.id) ? 'Blocca codice' : 'Sblocca codice'}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Referral & Premi: sezione CONGELATA (sola lettura, niente esecuzione). */}
      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-600">Referral &amp; Premi — sezione congelata</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            La gestione dei premi referral è disattivata per evitare modifiche accidentali: nessuna azione
            di modifica viene eseguita da questo pannello (sola lettura lato dashboard utente).
          </p>
        </div>
      </section>

      <ConfermaDialog
        stato={conferma}
        onChiudi={() => setConferma(null)}
        onErrore={(msg) => mostraToast('errore', msg)}
      />
    </div>
  );
}

/**
 * Mini-onboarding anagrafico (guardia profilo): se l'utente autenticato ha
 * `nome` o `cognome` vuoti in `public.profiles`, gli viene chiesto di
 * completare i dati (Nome, Cognome, Genere, Età) prima di usare la dashboard.
 * Leggero e chiudibile: non blocca mai il sito pubblico.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2, UserRound, X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from './Toast';

const campoInput =
  'mt-1 w-full rounded-lg border border-primary-200 px-3 py-2 text-sm text-primary-800 focus:border-primary-400 focus:outline-none';

export function DatiProfiloModal() {
  const { mostraToast } = useToast();
  const { pathname } = useLocation();
  const { user, preferenze, profiloIncompleto, aggiornaAnagrafica } = useApp();

  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [genere, setGenere] = useState<'M' | 'F' | null>(null);
  const [eta, setEta] = useState('');
  const [caricamento, setCaricamento] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // La guardia riguarda l'area dashboard (non il sito pubblico né /onboarding).
  const inDashboard = pathname.startsWith('/dashboard');

  useEffect(() => {
    if (!inDashboard || !profiloIncompleto) {
      setAperto(false);
      return;
    }
    setNome(user?.nome?.trim() ?? '');
    setCognome(user?.cognome?.trim() ?? '');
    setGenere(preferenze.genere ?? user?.genere ?? null);
    setEta(preferenze.eta ?? user?.eta ?? null ? String(preferenze.eta ?? user?.eta ?? '') : '');
    setErrore(null);
    setAperto(true);
  }, [inDashboard, profiloIncompleto, user, preferenze.genere, preferenze.eta]);

  const salva = async (): Promise<void> => {
    const n = nome.trim();
    const c = cognome.trim();
    if (!n || !c) {
      setErrore('Nome e cognome sono obbligatori per completare il profilo.');
      return;
    }
    let etaNum: number | null = null;
    if (eta.trim()) {
      const v = Number.parseInt(eta, 10);
      if (!Number.isFinite(v) || v < 14 || v > 100) {
        setErrore("L'età deve essere un numero tra 14 e 100 (o lascia vuoto).");
        return;
      }
      etaNum = v;
    }
    setCaricamento(true);
    setErrore(null);
    try {
      await aggiornaAnagrafica({ nome: n, cognome: c, genere, eta: etaNum });
      mostraToast('successo', 'Dati anagrafici salvati. Buon lavoro!');
      setAperto(false);
    } catch (err) {
      const msg = (err as { message?: string }).message ?? 'Salvataggio non riuscito. Riprova.';
      setErrore(msg);
    } finally {
      setCaricamento(false);
    }
  };

  if (!aperto) return null;
  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Completa il tuo profilo">
      <div className="absolute inset-0 bg-primary-900/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-card animate-pop">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <UserRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-primary-800">Completa il tuo profilo</h2>
            <p className="mt-1 text-xs leading-relaxed text-primary-500">
              Ci mancano un paio di dati per personalizzare Radar Scuole e le nostre email.
              Bastano pochi secondi.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAperto(false)}
            aria-label="Chiudi (potrai completare più tardi)"
            className="rounded-full p-1.5 text-primary-400 transition hover:bg-primary-50 hover:text-primary-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Nome *</span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Es. Giuseppe"
              className={campoInput}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Cognome *</span>
            <input
              type="text"
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              placeholder="Es. Pampararo"
              className={campoInput}
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Genere</span>
            <select
              value={genere ?? ''}
              onChange={(e) => setGenere((e.target.value as 'M' | 'F' | '') || null)}
              className={campoInput}
            >
              <option value="">Preferisco non dire</option>
              <option value="F">Donna</option>
              <option value="M">Uomo</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary-500">Età</span>
            <input
              type="number"
              min={14}
              max={100}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              placeholder="(opzionale)"
              className={campoInput}
            />
          </label>
        </div>

        {errore && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errore}</p>}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setAperto(false)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary-600 transition hover:bg-primary-50"
          >
            Più tardi
          </button>
          <button
            type="button"
            onClick={() => void salva()}
            disabled={caricamento}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            {caricamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
            Salva e continua
          </button>
        </div>
      </div>
    </div>
  );
}


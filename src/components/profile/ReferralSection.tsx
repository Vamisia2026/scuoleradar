import { useMemo, useState, type ReactNode } from 'react';
import {
  Gift, Copy, Check, Pencil, Share2, Users, CheckCircle2, Euro, Loader2, Clock, Send,
} from 'lucide-react';
import { useReferral } from '@/hooks/useReferral';

const BASE_URL = 'https://scuoleradar.it';

/**
 * MODULO MARKETING — Programma "Invita un Collega" & Affiliazione.
 *
 * Contratto del modulo (sezione ISOLATA del profilo / tab dedicata):
 *  - Componente UI  : `ReferralSection` — nessun accoppiamento con gli altri
 *                     dipartimenti (Blog, Modulistica, Radar…).
 *  - Stato / logica : hook `useReferral` (`src/hooks/useReferral.ts`).
 *  - Dati           : tabella `referrals` + RPC `applica_promo`
 *                     (migration `20260822100000_add_referrals.sql`).
 *  - Ingressi       : tab "Invita un Collega" (`InvitaPage`) e Profilo utente.
 * Qualsiasi modifica va mantenuta dentro questi confini: nessun altro modulo
 * deve importare `ReferralSection` o `useReferral`.
 */
export function ReferralSection() {
  const { codice, stats, storico, caricamento, validaDisponibilita, salvaCodice } = useReferral();
  const [editMode, setEditMode] = useState(false);
  const [input, setInput] = useState('');
  const [disponibile, setDisponibile] = useState<boolean | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [salvataggio, setSalvataggio] = useState(false);
  const [errore, setErrore] = useState('');

  const linkReferral = useMemo(
    () => `${BASE_URL}/prezzi?promo=${encodeURIComponent(codice)}`,
    [codice],
  );

  const handleCopia = async () => {
    try {
      await navigator.clipboard.writeText(linkReferral);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2000);
    } catch {
      // clipboard non disponibile
    }
  };

  const handleInput = async (v: string) => {
    const upp = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setInput(upp);
    setErrore('');
    if (!upp || upp === codice) {
      setDisponibile(null);
      return;
    }
    setDisponibile(await validaDisponibilita(upp));
  };

  const handleSalva = async () => {
    setSalvataggio(true);
    setErrore('');
    const esito = await salvaCodice(input);
    setSalvataggio(false);
    if (!esito.ok) {
      setErrore(esito.errore ?? 'Errore durante il salvataggio');
      return;
    }
    setEditMode(false);
    setDisponibile(null);
    setInput('');
  };

  const testoCondivisione = encodeURIComponent(
    `Usa il codice promo ${codice} su scuoleradar.it 🎯 — -10€ sul piano PRO. ${linkReferral}`,
  );

  const formatData = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  if (caricamento) {
    return (
      <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <p className="flex items-center gap-2 text-sm text-primary-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Caricamento programma referral…
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
      <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
        <Gift className="h-4 w-4 text-secondary-500" />
        Programma &apos;Invita un Collega&apos; &amp; Affiliazione
      </h3>
      <p className="mt-1 text-sm text-primary-600">
        Regala 10€ di sconto su ogni nuovo abbonato e ricevi 10€ di ricompensa per ogni abbonamento
        confermato.
      </p>

      {/* Codice promo — stile Satispay */}
      <div className="mt-4 rounded-xl border border-primary-100 bg-primary-50 p-4">
        <p className="text-xs uppercase tracking-wide text-primary-500">Il tuo codice promo personale</p>
        <div className="mt-2.5 rounded-xl border-2 border-dashed border-secondary-300 bg-white px-4 py-3.5">
          <p className="font-mono text-2xl font-extrabold uppercase tracking-[0.15em] text-primary-900 sm:text-3xl">
            {codice || 'NOMECOGNOME'}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-primary-600">
            Usa il codice promo: <strong className="font-mono uppercase">{codice || 'NOMECOGNOME'}</strong> su{' '}
            <strong>scuoleradar.it</strong>
          </p>
        </div>

        {editMode ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => void handleInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleSalva()}
              placeholder="IL TUO CODICE"
              className="input w-52 font-mono text-sm"
              autoFocus
            />
            <button
              onClick={() => void handleSalva()}
              disabled={salvataggio || !input || disponibile === false}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:opacity-50"
            >
              {salvataggio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salva
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                setInput('');
                setErrore('');
                setDisponibile(null);
              }}
              className="rounded-lg px-2 py-2 text-xs font-medium text-primary-500 transition hover:text-primary-700"
            >
              Annulla
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditMode(true);
              setInput(codice);
              setDisponibile(null);
            }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Personalizza il codice
          </button>
        )}

        {editMode && (
          <p className="mt-2 text-xs">
            {disponibile === true && <span className="text-accent-600">✓ Codice disponibile</span>}
            {disponibile === false && <span className="text-error-600">✗ Codice già in uso</span>}
          </p>
        )}
        {errore && <p className="mt-2 text-xs text-error-600">{errore}</p>}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleCopia()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            {copiato ? <Check className="h-3.5 w-3.5 text-accent-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copiato ? 'Codice copiato!' : 'Copia codice'}
          </button>
          <a
            href={`https://wa.me/?text=${testoCondivisione}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-accent-600"
          >
            <Share2 className="h-3.5 w-3.5" />
            WhatsApp
          </a>
          <a
            href={`https://t.me/share/url?url=${encodeURIComponent(linkReferral)}&text=${testoCondivisione}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
          >
            <Send className="h-3.5 w-3.5" />
            Telegram
          </a>
        </div>
      </div>
      {/* KPI */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Kpi icon={<Users className="h-4 w-4" />} value={String(stats.totaleUsi)} label="Utilizzi Totali" />
        <Kpi
          icon={<CheckCircle2 className="h-4 w-4" />}
          value={String(stats.completati)}
          label="Abbonamenti sottoscritti"
        />
        <Kpi
          icon={<Euro className="h-4 w-4" />}
          value={`${stats.ricompenseTotali.toFixed(2)}€`}
          label="Ricompense totali"
        />
      </div>

      {/* Attività (anonima) */}
      <div className="mt-4">
        <h4 className="text-sm font-bold text-primary-700">Attività recente</h4>
        {storico.length === 0 ? (
          <p className="mt-2 text-sm text-primary-400">
            Nessuna attività per ora. Condividi il tuo link per iniziare!
          </p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-primary-100 text-xs uppercase tracking-wide text-primary-400">
                  <th className="py-2 pr-3 font-semibold">Data</th>
                  <th className="py-2 pr-3 font-semibold">Promo usato</th>
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Ricompensa</th>
                </tr>
              </thead>
              <tbody>
                {storico.map((r) => (
                  <tr key={r.id} className="border-b border-primary-50">
                    <td className="py-2 pr-3 text-primary-600">{formatData(r.created_at)}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-primary-700">{codice}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.status === 'completed'
                            ? 'bg-accent-50 text-accent-700'
                            : 'bg-primary-50 text-primary-500'
                        }`}
                      >
                        {r.status === 'completed' ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Clock className="h-3 w-3" />
                        )}
                        {r.status === 'completed' ? 'Abbonamento confermato' : 'In attesa'}
                      </span>
                    </td>
                    <td className="py-2 font-semibold text-accent-700">
                      +{Number(r.reward_amount).toFixed(2)}€
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-primary-400">
          Privacy-first: non mostriamo alcun dato personale delle persone che hanno usato il tuo
          codice.
        </p>
      </div>
    </section>
  );
}

function Kpi({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-primary-100 bg-slate-50 p-4">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
        {icon}
      </span>
      <p className="mt-2 text-2xl font-bold text-primary-800">{value}</p>
      <p className="text-xs text-primary-500">{label}</p>
    </div>
  );
}

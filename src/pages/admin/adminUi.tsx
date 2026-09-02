/* Piccoli atomi UI condivisi del Pannello Admin. */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Check, Loader2, ShieldAlert, X } from 'lucide-react';
import { classePiano, etichettaPiano, type AdminUtente } from './types';

export const inputAdmin =
  'w-full rounded-lg border border-primary-200 bg-white px-2.5 py-1.5 text-xs text-primary-800 focus:border-primary-400 focus:outline-none';
export const btnAdmin =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40';
export const btnPrim = 'bg-primary-500 text-white hover:bg-primary-600 shadow-soft';
export const btnGhost = 'text-primary-600 hover:bg-primary-50';
export const btnDanger = 'text-red-600 hover:bg-red-50';

export function BadgePiano({ piano }: { piano?: string | null }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold ${classePiano(
        piano,
      )}`}
    >
      {etichettaPiano(piano)}
    </span>
  );
}

/** Badge piano COMPATTO con color coding: B / PRO1M / PRO1A / FFE. */
export function BadgePianoCompatto({ utente }: { utente: AdminUtente }) {
  const piano = utente.piano ?? 'base';
  const tipo = String(
    utente.pro_tipo ?? ((utente as Record<string, unknown>).subscription_tier ?? ''),
  ).toLowerCase();

  let label = 'B';
  let classe = 'bg-cyan-100 text-cyan-700 ring-1 ring-inset ring-cyan-200';
  if (piano === 'free_forever') {
    label = 'FFE';
    classe = 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-300';
  } else if (piano === 'pro') {
    if (tipo.includes('mensile')) {
      label = 'PRO1M';
      classe = 'bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-300';
    } else if (tipo.includes('annuale')) {
      label = 'PRO1A';
      classe = 'bg-orange-500 text-white';
    } else {
      label = 'PRO';
      classe = 'bg-orange-500 text-white';
    }
  }
  const titolo =
    piano === 'pro'
      ? tipo.includes('mensile')
        ? 'PRO Mensile'
        : tipo.includes('annuale')
          ? 'PRO Annuale'
          : 'PRO'
      : piano === 'free_forever'
        ? 'PRO Free Forever'
        : 'Base';
  return (
    <span
      title={titolo}
      className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-black tracking-wide ${classe}`}
    >
      {label}
    </span>
  );
}

/** Badge dedicato "BETA" per i Beta Tester (segmentazione campagne). */
export function BadgeBeta() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-accent-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-accent-700 ring-1 ring-inset ring-accent-200">
      BETA
    </span>
  );
}

export function StatoRadarBadge({ attivo }: { attivo: boolean }) {
  return attivo ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-accent-700 ring-1 ring-inset ring-accent-200">
      <span className="h-1.5 w-1.5 rounded-full bg-accent-500" /> Radar attivo
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 ring-1 ring-inset ring-slate-200">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Radar inattivo
    </span>
  );
}

export function Chips({ valori, vuoto = '—' }: { valori?: string[] | null; vuoto?: string }) {
  const lista = (valori ?? []).filter(Boolean);
  if (lista.length === 0) return <span className="text-xs text-primary-300">{vuoto}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {lista.slice(0, 4).map((v) => (
        <span
          key={v}
          className="rounded-md bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold text-primary-600"
        >
          {v}
        </span>
      ))}
      {lista.length > 4 && (
        <span className="text-[10px] font-bold text-primary-400">+{lista.length - 4}</span>
      )}
    </span>
  );
}

export interface ConfermaStato {
  titolo: string;
  messaggio: string;
  onConferma: () => void | Promise<void>;
}

/** Piccolo dialogo di conferma "sicurezza prima di scrivere sul DB". */
export function ConfermaDialog({
  stato,
  onChiudi,
  inCorso = false,
  onErrore,
}: {
  stato: ConfermaStato | null;
  onChiudi: () => void;
  inCorso?: boolean;
  onErrore?: (messaggio: string) => void;
}) {
  const [localeInCorso, setLocaleInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  // Ogni nuovo stato di conferma riparte pulito (niente residui tra aperture).
  useEffect(() => {
    setLocaleInCorso(false);
    setErrore(null);
  }, [stato]);

  if (!stato) return null;
  const busy = inCorso || localeInCorso;

  const esegui = (): void => {
    if (busy) return;
    setLocaleInCorso(true);
    setErrore(null);
    void (async () => {
      try {
        await stato.onConferma();
        onChiudi();
      } catch (err) {
        const messaggio = err instanceof Error ? err.message : String(err);
        console.error('[admin] operazione non riuscita:', err);
        setErrore(messaggio);
        onErrore?.(messaggio);
        setLocaleInCorso(false);
      }
    })();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onChiudi} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-card animate-pop">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning-50 text-warning-600">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-primary-800">{stato.titolo}</h3>
            <p className="mt-1 text-xs leading-relaxed text-primary-500">{stato.messaggio}</p>
            {errore && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-medium text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {errore}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={onChiudi} disabled={busy} className={`${btnAdmin} ${btnGhost}`}>
            <X className="h-3.5 w-3.5" /> Annulla
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={esegui}
            className={`${btnAdmin} ${btnPrim} min-w-[150px] justify-center`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {busy ? 'Salvataggio…' : 'Conferma e salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Intestazione sezione compatta con descrizione. */
export function Sezione({ titolo, children, action }: { titolo: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-primary-800">{titolo}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Formatta la riga utente per il testo "Nome Cognome". */
export function nomeCognome(u: AdminUtente): string {
  return [u.nome, u.cognome].filter(Boolean).join(' ') || '—';
}

export function èDemo(u: AdminUtente): boolean {
  return Boolean((u as unknown as { _demo?: boolean })._demo);
}

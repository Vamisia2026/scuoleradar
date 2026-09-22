/**
 * Pannello Admin · «Email & Automazioni» — badge del trigger e interruttore.
 *
 * Presentazione pura: nessuno stato proprio. L'interruttore è un `role="switch"`
 * accessibile: il cambio è immediato (salvataggio su `app_settings` a cura
 * dell'hook `useAutomazioniEmail`).
 */
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { etichettaAbilitazione, type AutomazioneEmail } from '@/config/automazioniEmail';

/** Badge del tipo di trigger (evento puntuale o finestra temporale). */
export function BadgeTrigger({ automazione }: { automazione: AutomazioneEmail }) {
  const evento = automazione.trigger === 'evento';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        evento ? 'bg-secondary-100 text-secondary-700' : 'bg-primary-100 text-primary-700'
      }`}
    >
      {evento ? '⚡ Evento' : '⏱ Temporale'}
    </span>
  );
}

/** Interruttore di abilitazione: cambio immediato, lavoro in corso visibile. */
export function Interruttore({
  abilitata,
  inCorso,
  onCambia,
}: {
  abilitata: boolean;
  inCorso: boolean;
  onCambia: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={abilitata}
        disabled={inCorso}
        onClick={onCambia}
        title={abilitata ? 'Disattiva questa automazione' : 'Riattiva questa automazione'}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
          abilitata ? 'bg-accent-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
            abilitata ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold ${
          abilitata ? 'text-accent-700' : 'text-slate-500'
        }`}
      >
        {inCorso ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : abilitata ? (
          <BellRing className="h-3 w-3" />
        ) : (
          <BellOff className="h-3 w-3" />
        )}
        {etichettaAbilitazione(abilitata)}
      </span>
    </div>
  );
}

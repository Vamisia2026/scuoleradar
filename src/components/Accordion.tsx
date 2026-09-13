import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

/** Card collassabile (tendina): raggruppa le impostazioni riducendo lo scroll. */
export function Accordion({
  icona,
  titolo,
  badge,
  sommario,
  aperto,
  onToggle,
  children,
}: {
  icona: ReactNode;
  titolo: string;
  badge?: string;
  /**
   * Contenuto SEMPRE visibile sotto l'intestazione (anche a tendina chiusa):
   * usato per mostrare a colpo d'occhio i chip/tag già selezionati
   * ("pinned") con rimozione immediata.
   */
  sommario?: ReactNode;
  aperto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <button
        onClick={onToggle}
        aria-expanded={aperto}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left transition hover:bg-primary-50/50"
      >
        <span className="text-lg leading-none">{icona}</span>
        <h3 className="flex-1 text-sm font-bold text-primary-800">{titolo}</h3>
        {badge ? (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-primary-400 transition-transform ${aperto ? 'rotate-180' : ''}`}
        />
      </button>
      {sommario ? <div className="px-5 pb-3">{sommario}</div> : null}
      {aperto && <div className="border-t border-primary-100 px-5 py-4">{children}</div>}
    </section>
  );
}

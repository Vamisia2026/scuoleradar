/**
 * Dashboard · «Opportunità mappate» (accordion console con le card avviso).
 *
 * Tre stati: invito a completare il profilo (utente loggato senza preferenze),
 * coda vuota con le etichette dei filtri del profilo, elenco delle card con
 * color-coding di urgenza (<48h · entro 5 giorni · attiva). Per gli utenti Base
 * l'accordion resta bloccato: badge «🔒 PRO» e click che apre la vetrina.
 *
 * Presentazione pura: dati, stato di apertura e azioni arrivano dal contenitore.
 */
import { SlidersHorizontal } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { InterpelloCard } from '@/components/InterpelloCard';
import { classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import type { Interpello } from '@/data/interpelli';

/** Urgenza in base ai giorni rimanenti: <48h urgente · <5 giorni media · oltre regolare. */
type UrgenzaScadenza = 'urgente' | 'media' | 'regolare';

function urgenzaScadenza(dataScadenza: string): UrgenzaScadenza {
  const ms = new Date(dataScadenza).getTime() - Date.now();
  if (ms <= 2 * 86_400_000) return 'urgente'; // < 48 ore
  if (ms <= 5 * 86_400_000) return 'media'; // < 5 giorni
  return 'regolare';
}

const URGENZA_STILE: Record<UrgenzaScadenza, { etichetta: string; cls: string }> = {
  urgente: {
    etichetta: '⏳ Urgente · <48h',
    cls: 'bg-error-50 text-error-700 ring-1 ring-inset ring-error-200',
  },
  media: {
    etichetta: '🕐 Entro 5 giorni',
    cls: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-300',
  },
  regolare: {
    etichetta: '✓ Opportunità attiva',
    cls: 'bg-accent-50 text-accent-700 ring-1 ring-inset ring-accent-200',
  },
};

interface ElencoOpportunitaProps {
  /** Opportunità da mostrare (già filtrate, ordinate e limitate al piano). */
  lista: Interpello[];
  /** Totale delle opportunità attive (badge dell'accordion). */
  totale: number;
  /** Stato dell'accordion (console chiusa di default). */
  accordion: { aperto: boolean; onToggle: () => void };
  /** Accesso PRO: abilita elenco e conteggio, altrimenti badge di blocco. */
  hasAccessoPro: boolean;
  /** true quando l'utente è loggato ma non ha ancora configurato il profilo. */
  mostraInvitoProfilo: boolean;
  /** Apre la configurazione del profilo (CTA «Completa il profilo»). */
  onCompletaProfilo: () => void;
  /** Filtri del profilo, per le etichette dello stato vuoto. */
  filtri: { classiCodici: string[]; provinceCodici: string[] };
}

export function ElencoOpportunita({
  lista,
  totale,
  accordion,
  hasAccessoPro,
  mostraInvitoProfilo,
  onCompletaProfilo,
  filtri,
}: ElencoOpportunitaProps) {
  const { classiCodici, provinceCodici } = filtri;
  const { aperto, onToggle } = accordion;

  // Etichette per lo stato vuoto del Radar (dalle preferenze dell'utente).
  const classeEtichetta = classiCodici
    .map((c) => classeByCodice(c)?.denominazione ?? c)
    .filter(Boolean)
    .join(', ');
  const provinciaEtichetta = provinceCodici
    .map((c) => province.find((p) => p.codice === c)?.nome ?? c)
    .filter(Boolean)
    .join(', ');

  return (
      <Accordion
        icona="📡"
        titolo="Opportunità mappate"
        badge={
          hasAccessoPro
            ? `${totale} ${
                totale === 1 ? 'opportunità attiva' : 'opportunità attive'
              }`
            : '🔒 PRO'
        }
        aperto={aperto}
        onToggle={onToggle}
      >
        {mostraInvitoProfilo ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-center">
            <p className="text-sm text-primary-600">
              Configura prima il tuo profilo: il Radar potrà mostrarti le opportunità che ti
              riguardano davvero.
            </p>
            <button
              type="button"
              onClick={onCompletaProfilo}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Completa il profilo
            </button>
          </div>
        ) : totale === 0 ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-center text-sm text-primary-600">
            Nessuna nuova opportunità attiva al momento
            {classeEtichetta ? ` per ${classeEtichetta}` : ''}
            {provinciaEtichetta ? ` in ${provinciaEtichetta}` : ''}.
          </div>
        ) : (
          <div className="animate-fade-in space-y-3">
            {lista.map((i) => {
              const urg = urgenzaScadenza(i.dataScadenza);
              return (
                <div
                  key={i.id}
                  className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-primary-100 bg-slate-50 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary-400">
                      {new Date(i.dataScadenza).toLocaleDateString('it-IT', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${URGENZA_STILE[urg].cls}`}
                    >
                      {URGENZA_STILE[urg].etichetta}
                    </span>
                  </div>
                  <InterpelloCard interpello={i} />
                </div>
              );
            })}
          </div>
        )}
      </Accordion>
  );
}

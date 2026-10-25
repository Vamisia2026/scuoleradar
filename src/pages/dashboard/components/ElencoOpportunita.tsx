/**
 * Dashboard · «Opportunità mappate» (accordion console con le card avviso).
 *
 * Tre stati: invito a completare il profilo (utente loggato senza preferenze),
 * coda vuota con le etichette dei filtri del profilo, elenco delle card con il
 * badge della scadenza. Il badge NON ha una palette propria: usa
 * `lib/scadenza.stileScadenza` (rosso ≤ 48h · verde in corso · ardesia per
 * scaduto/assente/fuori finestra, §26.82). Per gli utenti Base l'accordion resta
 * bloccato: badge «🔒 PRO» e click che apre la vetrina.
 *
 * Presentazione pura: dati, stato di apertura e azioni arrivano dal contenitore.
 */
import { SlidersHorizontal } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { InterpelloCard } from '@/components/InterpelloCard';
import { etichettaScadenzaAvviso } from '@/lib/alertInterpello';
import { giorniRimanenti, stileScadenza } from '@/lib/scadenza';
import { classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import type { Interpello } from '@/data/interpelli';

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
              // UNA sola regola/palette per la scadenza (§26.82): la stessa del
              // «Radar Live» e della scheda avviso. Prima qui viveva una terza
              // scala (<48h / <5 giorni) con tinte pastello warning/accent che
              // contraddiceva il rosso/verde pieno del tabellone.
              const scadenza = stileScadenza(giorniRimanenti(i.dataScadenza));
              return (
                <div
                  key={i.id}
                  className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-primary-100 bg-slate-50 px-3 py-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-primary-400">
                      {etichettaScadenzaAvviso(i.dataScadenza, i.dataPubblicazione)}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${scadenza.className}`}
                    >
                      {scadenza.label}
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

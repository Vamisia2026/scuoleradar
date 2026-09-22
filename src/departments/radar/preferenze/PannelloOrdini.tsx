/**
 * Preferenze Radar — pannello «Ordini e Tipologie di Scuola».
 *
 * Selezione degli ordini (infanzia → ATA) che determinano le opportunità
 * monitorate. Presentazione pura: la selezione arriva dal contenitore.
 */
import { Check } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { ordiniScuola, type OrdineScuola } from '@/data/ordiniMaterie';
import { creaIconeOrdine } from '../ordineIcone';

/** Icone compatte (bacheca preferenze) degli ordini di scuola. */
const ordineIcons = creaIconeOrdine('h-5 w-5');

interface PannelloOrdiniProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Ordini di scuola selezionati. */
  ordini: OrdineScuola[];
  /** Aggiunge/rimuove un ordine di scuola. */
  toggleOrdine: (id: OrdineScuola) => void;
}

export function PannelloOrdini({
  accordionAperti,
  toggleAccordion,
  ordini,
  toggleOrdine,
}: PannelloOrdiniProps) {
  return (
      <Accordion
        icona="📂"
        titolo="Dove vuoi lavorare?"
        badge={ordini.length ? `${ordini.length} selezionati` : undefined}
        aperto={!!accordionAperti.ordini}
        onToggle={() => toggleAccordion('ordini')}
      >
        <p className="text-xs text-primary-500">
          Scegli gli ordini di scuola in cui vuoi insegnare o lavorare: il Radar cercherà in tutti
          quelli selezionati.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ordiniScuola.map((o) => {
            const selected = ordini.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => toggleOrdine(o.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-primary-200 hover:border-primary-300'
                }`}
              >
                <span className="text-primary-600">{ordineIcons[o.id]}</span>
                <span className="flex-1 font-medium text-primary-800">{o.nome}</span>
                {selected && <Check className="h-4 w-4 text-primary-600" />}
              </button>
            );
          })}
        </div>
      </Accordion>
  );
}

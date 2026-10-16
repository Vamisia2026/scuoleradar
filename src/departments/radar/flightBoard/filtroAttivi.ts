/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * La bacheca pubblica è fatta di OPPORTUNITÀ: entra solo una riga con una scadenza
 * dichiarata e non ancora passata (§26.71, direttiva 16/10/2026):
 *
 *   expiration_date.gte.<oggi>
 *
 * La finestra dei 60 giorni per gli avvisi che la fonte NON data è stata ritirata
 * da questa superficie: nei dati reali quelle righe sono pagine di archivio,
 * regolamenti e indici di classi di concorso («ADEE | AAAA», «A041 | EEEE | A043»),
 * non opportunità di lavoro — e facevano apparire «attivi» avvisi che il tabellone
 * non poteva mostrare. La finestra resta dove serve al *fetch* e alla pulizia
 * automatica (`lib/scadenza.ts` → `eAvvisoVivo`, `scripts/pulisci-scaduti.ts`).
 *
 * Il filtro è **lo stesso** per la lettura a pagine e per il conteggio: così il
 * numero di schermate e il totale degli avvisi parlano della stessa popolazione.
 *
 * L'espressione è in sintassi PostgREST (`client.from('interpelli').or(...)`).
 * Nessun ramo `expiration_date.is.null`: in PostgREST `null >= x` non è vero, quindi
 * `gte` esclude da sé le righe senza data e la regola ferrea resta in un solo punto
 * (`eOpportunitaConScadenza`, `lib/scadenza.ts`), applicata in memoria anche da
 * `preparaRigheBoard`: doppia difesa, un solo significato.
 *
 * Funzioni PURE (nessuna rete, nessun database, nessun orologio implicito: la data
 * si passa): la sintassi del filtro e la soglia sono verificabili senza toccare i
 * dati reali — `npm run test:board:filtro`.
 */
import { dataIsoLocale } from '@/lib/scadenza';

// La data LOCALE vive in un solo posto (`src/lib/scadenza.ts`, regola condivisa da
// bacheca, feed e migrazioni): qui si ri-esporta perché il tabellone e la sua
// guardia la importino dallo stesso modulo.
export { dataIsoLocale };

/**
 * Filtro della bacheca: scadenza dichiarata e non ancora passata (§26.71). Il
 * ramo «senza scadenza ma pubblicato nella finestra dei 60 giorni» non appartiene
 * più a questa superficie: quelle righe non sono opportunità attive.
 */
export function filtroAttivi(oggi: Date = new Date()): string {
  return `expiration_date.gte.${dataIsoLocale(oggi)}`;
}

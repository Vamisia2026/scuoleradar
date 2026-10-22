/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * La bacheca pubblica è fatta di OPPORTUNITÀ: entra solo una riga con una scadenza
 * dichiarata, non ancora passata e DENTRO L'ORIZZONTE dei 30 giorni (§26.71 e
 * §26.75, direttiva 22/10/2026):
 *
 *   and(expiration_date.gte.<oggi>,expiration_date.lte.<oggi+30>)
 *
 * Il secondo ramo non è un dettaglio: senza di esso il conteggio del database
 * includeva le «scadenze» che in realtà sono la FINE dell'incarico («supplenza
 * dal 23/10/2026 al 30/06/2027»), che il gate in memoria
 * (`eOpportunitaConScadenza`) scarta già — e il pill in alto diceva più avvisi di
 * quelli che il tabellone poteva paginare (§26.75, «1.405 avvisi» con 137 pagine).
 *
 * La finestra dei 60 giorni per gli avvisi che la fonte NON data è stata ritirata
 * da questa superficie: nei dati reali quelle righe sono pagine di archivio,
 * regolamenti e indici di classi di concorso («ADEE | AAAA», «A041 | EEEE | A043»),
 * non opportunità di lavoro. La finestra resta dove serve al *fetch* e alla
 * pulizia automatica (`lib/scadenza.ts` → `eAvvisoVivo`, `scripts/pulisci-scaduti.ts`).
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
import { dataIsoLocale, GIORNI_ORIZZONTE_OPPORTUNITA } from '@/lib/scadenza';

// La data LOCALE vive in un solo posto (`src/lib/scadenza.ts`, regola condivisa da
// bacheca, feed e migrazioni): qui si ri-esporta perché il tabellone e la sua
// guardia la importino dallo stesso modulo.
export { dataIsoLocale, GIORNI_ORIZZONTE_OPPORTUNITA };

/** Data locale del giorno `oggi + giorni` (orizzonte dell'opportunità). */
function ultimoGiornoUtile(oggi: Date, giorni: number): string {
  const limite = new Date(oggi);
  limite.setHours(12, 0, 0, 0);
  limite.setDate(limite.getDate() + giorni);
  return dataIsoLocale(limite);
}

/**
 * Filtro della bacheca: scadenza dichiarata, non ancora passata e non oltre
 * l'orizzonte dei `GIORNI_ORIZZONTE_OPPORTUNITA` (§26.71 / §26.75). Il ramo
 * «senza scadenza ma pubblicato nella finestra dei 60 giorni» non appartiene più
 * a questa superficie: quelle righe non sono opportunità attive.
 */
export function filtroAttivi(oggi: Date = new Date()): string {
  const dal = dataIsoLocale(oggi);
  const al = ultimoGiornoUtile(oggi, GIORNI_ORIZZONTE_OPPORTUNITA);
  return `and(expiration_date.gte.${dal},expiration_date.lte.${al})`;
}


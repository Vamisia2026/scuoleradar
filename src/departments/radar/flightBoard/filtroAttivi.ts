/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * La bacheca pubblica è fatta di OPPORTUNITÀ APERTE: entra solo una riga con una
 * scadenza dichiarata e non ancora passata. Dal §26.100 (direttiva 28/10/2026)
 * **non c'è più un tetto in avanti**:
 *
 *   expiration_date.gte.<oggi>
 *
 * Fino al §26.99 lo stesso filtro portava anche `lte.<oggi+15>`, la finestra di
 * candidatura di §26.82. Quella finestra risponde a «cosa posso candidare
 * adesso» ed è la regola del FEED e del matching; sulla vetrina pubblica, invece,
 * tagliava opportunità vere (un bando che scade fra un mese è aperto) e faceva
 * sembrare il tabellone più povero del database. Il cliente ha chiesto il volume
 * ATTIVO completo: qui si legge tutto ciò che non è scaduto, e le righe oltre
 * l'orizzonte portano la banda blu «Scadenza lontana» invece di sparire.
 *
 * Il requisito della DATA resta identico (§26.71): un elenco di classi di
 * concorso, una pagina di archivio o un regolamento non ha una scadenza e non
 * entra in bacheca. In PostgREST `null >= x` non è vero, quindi `gte` esclude da
 * sé le righe senza data e la regola ferrea resta in un solo punto
 * (`eOpportunitaAperta` / `eOpportunitaConScadenza`, `lib/scadenza.ts`),
 * applicata in memoria anche da `preparaRigheBoard`: doppia difesa, un solo
 * significato.
 *
 * La finestra dei 60 giorni per gli avvisi che la fonte NON data resta ritirata
 * da questa superficie: nei dati reali quelle righe sono pagine di archivio,
 * regolamenti e indici di classi di concorso («ADEE | AAAA», «A041 | EEEE | A043»),
 * non opportunità di lavoro. La finestra resta dove serve al *fetch* e alla
 * pulizia automatica (`lib/scadenza.ts` → `eAvvisoVivo`, `scripts/pulisci-scaduti.ts`).
 *
 * Il filtro è **lo stesso** per la lettura a pagine e per il conteggio: così il
 * numero di schermate e il totale degli avvisi parlano della stessa popolazione.
 *
 * L'espressione è in sintassi PostgREST (`client.from('interpelli').or(...)`).
 *
 * Funzioni PURE (nessuna rete, nessun database, nessun orologio implicito: la data
 * si passa): la sintassi del filtro e la soglia sono verificabili senza toccare i
 * dati reali — `npm run test:board:filtro`.
 */
import { dataIsoLocale, GIORNI_ORIZZONTE_OPPORTUNITA } from '@/lib/scadenza';

// La data LOCALE vive in un solo posto (`src/lib/scadenza.ts`, regola condivisa da
// bacheca, feed e migrazioni): qui si ri-esporta perché il tabellone e la sua
// guardia la importino dallo stesso modulo. L'orizzonte resta esportato per il
// badge (che lo legge da `lib/scadenzaSemaforo`): la bacheca non lo applica più.
export { dataIsoLocale, GIORNI_ORIZZONTE_OPPORTUNITA };

/**
 * Filtro della bacheca: scadenza dichiarata e non ancora passata, senza tetto in
 * avanti (§26.71 per il requisito della data, §26.100 per il volume).
 */
export function filtroAttivi(oggi: Date = new Date()): string {
  return `expiration_date.gte.${dataIsoLocale(oggi)}`;
}


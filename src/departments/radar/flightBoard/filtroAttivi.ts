/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * La bacheca non deve più dipendere da un `.gte('expiration_date', oggi)` che
 * scarta in silenzio tutto ciò che la fonte non data: la regola di prodotto è
 * **«attivo se ha una scadenza non ancora passata OPPURE se è stato pubblicato
 * negli ultimi 60 giorni»** (`GIORNI_FINESTRA_SENZA_SCADENZA`, `lib/scadenza.ts`).
 *
 * L'espressione è in sintassi PostgREST (`client.from('interpelli').or(...)`):
 *
 *   expiration_date.gte.<oggi>,and(expiration_date.is.null,created_at.gte.<limite>)
 *
 * cioè «scadenza non passata» OPPURE «scadenza assente ma pubblicato nella
 * finestra». La stessa regola è applicata anche in memoria da
 * `preparaRigheBoard`: doppia difesa, un solo significato.
 *
 * Funzioni PURE (nessuna rete, nessun database, nessun orologio implicito: la
 * data si passa): la sintassi del filtro e le due soglie sono verificabili senza
 * toccare i dati reali — `npm run test:board:filtro`.
 */
import {
  GIORNI_FINESTRA_SENZA_SCADENZA,
  dataIsoLocale,
  dataLimiteFinestraSenzaScadenza,
} from '@/lib/scadenza';

// La finestra di prodotto e la data LOCALE vivono in un solo posto (`src/lib/scadenza.ts`,
// regola condivisa da bacheca, feed e migrazioni): qui si ri-esportano perché il
// tabellone e la sua guardia le importino dallo stesso modulo.
export { GIORNI_FINESTRA_SENZA_SCADENZA, dataIsoLocale, dataLimiteFinestraSenzaScadenza };

/**
 * Filtro della bacheca: scadenza non ancora passata OPPURE senza scadenza ma
 * pubblicato nella finestra dei 60 giorni.
 */
export function filtroAttivi(oggi: Date = new Date()): string {
  const oggiIso = dataIsoLocale(oggi);
  const limite = dataLimiteFinestraSenzaScadenza(oggi);
  return `expiration_date.gte.${oggiIso},and(expiration_date.is.null,created_at.gte.${limite})`;
}

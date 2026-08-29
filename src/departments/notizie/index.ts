/**
 * ScuoleRadar.it — Dipartimento Notizie (Blog Engine).
 *
 * Punto di ingresso pubblico del dipartimento isolato `src/departments/notizie/`.
 * Espone solo la superficie necessaria al resto dell'app:
 *  - `NotizieGrid`      → vista a schede pubblica (nessuna autenticazione richiesta)
 *  - `NotizieDettaglio` → vista articolo con Fonti Ufficiali, condivisione
 *    WhatsApp e CTA finale di registrazione ScuoleRadar
 *  - `NewsArticle`      → modello dati del dominio
 *
 * Nessuna logica interna (servizi, dati, componenti) viene esposta all'esterno.
 */
export { NotizieGrid } from './components/NotizieGrid';
export { NotizieDettaglio } from './components/NotizieDettaglio';
export type { NewsArticle } from './types';

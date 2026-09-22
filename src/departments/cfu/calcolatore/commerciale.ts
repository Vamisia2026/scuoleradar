/**
 * ScuoleRadar.it — Dipartimento CFU · canale commerciale della V1.
 *
 * Il dipartimento resta ISOLATO: non importa il contesto applicativo. La pagina
 * (`CalcolatoreCFUDashboardPage`) risolve se l'utente ha il PRO e come aprire la
 * vetrina esistente, e le passa qui come valori/azioni.
 *
 * Regola di prodotto: il calcolo è GRATUITO. La CTA eventuale è discreta, non
 * blocca nulla e non promette funzioni che il prodotto non offre.
 */
export interface CommercialeCfu {
  /** true = accesso PRO attivo: si mostra solo la conferma, nessuna CTA. */
  readonly haPro: boolean;
  /** Apre la vetrina dei piani PRO esistente (meccanismo stabile dell'app). */
  readonly apriUpgrade: () => void;
}

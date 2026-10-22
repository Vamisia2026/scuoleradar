/**
 * ScuoleRadar.it — Dipartimento Radar · INTESTAZIONE del tabellone «Radar Live».
 *
 * Estratto da `FlightBoardInterpelli.tsx` (§26.76, 22/10/2026) per riportarlo sotto
 * il limite di 250 righe del gate strutturale: qui c'è SOLO la presentazione del
 * titolo e del contatore, nessuna query e nessuno stato.
 *
 * Il pill del totale è PIENO ad alto contrasto (§26.75): la tinta `emerald-50` era
 * illeggibile di sfuggita. Il numero arriva dal tabellone (righe davvero in
 * vetrina, lo stesso numero che genera le schermate): questo componente non lo
 * calcola e non lo arrotonda.
 */
export interface IntestazioneBoardProps {
  /** Etichetta già formattata (`metricaBoard`); `null` = nessun conteggio da mostrare. */
  etichettaTotale: string | null;
}

export function IntestazioneBoard({ etichettaTotale }: IntestazioneBoardProps) {
  return (
    <div className="mb-6">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
        Radar Live: Tutti gli Interpelli Scuola e Avvisi di Reclutamento in Italia
      </h2>
      <p className="mt-2 text-sm text-gray-600">
        Scansione in tempo reale h24 di tutti gli interpelli nazionali, supplenze brevi e annuali, bandi PNRR/PON e avvisi per Docenti di ogni ordine e grado, Personale ATA, Collaboratori Scolastici ed Esperti Esterni.
      </p>
      {etichettaTotale && (
        <div className="mt-3 flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
          {/* Pill del totale: colore PIENO ad alto contrasto (§26.75) — la
              tinta `emerald-50` era illeggibile di sfuggita. */}
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-700 text-white shrink-0">
            <span className="w-2 h-2 mr-2 bg-white rounded-full animate-pulse" />
            {etichettaTotale.toUpperCase()}
          </div>
          <h2 className="text-base sm:text-lg lg:text-xl font-extrabold text-blue-600 tracking-tight whitespace-nowrap">
            CLICKA SU UN’OFFERTA DI LAVORO QUALSIASI PER VEDERE CHE SONO AVVISI VERI, NON ESEMPI!
          </h2>
        </div>
      )}
    </div>
  );
}

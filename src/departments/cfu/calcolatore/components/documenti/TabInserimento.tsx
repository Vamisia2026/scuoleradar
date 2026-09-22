/**
 * Calcolatore CFU · selettore della modalità di inserimento (fase Esami).
 *
 * Due modalità, entrambe senza documenti: incolla l'elenco (riconoscimento del
 * testo) oppure inserimento manuale. Nessun caricamento file in V1.
 *
 * Presentazione pura: modalità attiva e azione arrivano dal contenitore.
 */

/** Modalità di inserimento degli esami nella fase Esami. */
export type ModalitaInserimento = 'manuale' | 'testo';

/** Etichette dei tab, nell'ordine di visualizzazione. */
const MODULI: { chiave: ModalitaInserimento; etichetta: string }[] = [
  { chiave: 'manuale', etichetta: 'Inserimento manuale' },
  { chiave: 'testo', etichetta: 'Incolla l\u2019elenco' },
];

interface TabInserimentoProps {
  /** Modalità correntemente attiva. */
  modalita: ModalitaInserimento;
  /** Cambia modalità (il contenitore azzera anche la nota di esito). */
  onCambia: (modalita: ModalitaInserimento) => void;
}

export function TabInserimento({ modalita, onCambia }: TabInserimentoProps) {
  return (
      <div className="flex flex-wrap gap-1.5">
        {MODULI.map((m) => (
          <button
            key={m.chiave}
            type="button"
            onClick={() => onCambia(m.chiave)}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold uppercase tracking-wide transition ${
              modalita === m.chiave
                ? 'bg-primary-800 text-white shadow-soft'
                : 'bg-slate-100 text-primary-600 hover:bg-slate-200'
            }`}
          >
            {m.etichetta}
          </button>
        ))}
      </div>
  );
}

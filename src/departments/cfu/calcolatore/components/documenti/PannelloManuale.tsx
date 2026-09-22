/**
 * Calcolatore CFU · pannello «Inserimento manuale» (fase Esami).
 *
 * Form a tre campi: denominazione, CFU e SETTORE SSD con scelta ESPLICITA
 * («dichiarato» oppure «non lo so»). Un esame senza settore non viene mai
 * trattato come se il settore ci fosse: la scelta è dell'utente.
 *
 * Validazione e creazione dell'esame restano nel contenitore (`StepEsami`).
 */
import type { FormEvent } from 'react';

/** Campi del form di inserimento manuale. */
export interface CampiEsameManuale {
  materia: string;
  cfu: string;
  ssd: string;
  /** true quando l'utente dichiara esplicitamente di non conoscere il settore. */
  ssdNonNoto: boolean;
}

export type CampoManuale = 'materia' | 'cfu' | 'ssd';

interface PannelloManualeProps {
  campi: CampiEsameManuale;
  onCambia: (campo: CampoManuale, valore: string) => void;
  onSsdNonNoto: (valore: boolean) => void;
  onAggiungi: (e: FormEvent) => void;
}

export function PannelloManuale({
  campi,
  onCambia,
  onSsdNonNoto,
  onAggiungi,
}: PannelloManualeProps) {
  return (
    <form onSubmit={onAggiungi} className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_5rem_auto]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
            Denominazione esame
          </span>
          <input
            value={campi.materia}
            onChange={(e) => onCambia('materia', e.target.value)}
            placeholder="Es. Lingua e letteratura latina"
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-primary-400">
            CFU
          </span>
          <input
            value={campi.cfu}
            onChange={(e) => onCambia('cfu', e.target.value)}
            inputMode="decimal"
            placeholder="6"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-[38px] items-center gap-1 self-end rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white transition hover:bg-primary-600"
        >
          + Aggiungi
        </button>
      </div>

      <div className="rounded-xl bg-slate-50 px-3.5 py-3 ring-1 ring-slate-200">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary-500">
          Settore SSD
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSsdNonNoto(false)}
            aria-pressed={!campi.ssdNonNoto}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
              campi.ssdNonNoto
                ? 'bg-white text-primary-500 ring-1 ring-slate-200 hover:bg-slate-100'
                : 'bg-primary-800 text-white shadow-soft'
            }`}
          >
            Conosco il settore
          </button>
          <button
            type="button"
            onClick={() => onSsdNonNoto(true)}
            aria-pressed={campi.ssdNonNoto}
            className={`rounded-xl px-3.5 py-2 text-sm font-bold transition ${
              campi.ssdNonNoto
                ? 'bg-primary-800 text-white shadow-soft'
                : 'bg-white text-primary-500 ring-1 ring-slate-200 hover:bg-slate-100'
            }`}
          >
            Non lo so
          </button>
          {campi.ssdNonNoto ? (
            <span className="text-sm font-medium text-primary-500">
              Il settore resterà non dichiarato: il calcolo lo segnalerà.
            </span>
          ) : (
            <input
              value={campi.ssd}
              onChange={(e) => onCambia('ssd', e.target.value)}
              placeholder="L-FIL-LET/04"
              className="input w-40 font-mono"
            />
          )}
        </div>
      </div>
    </form>
  );
}

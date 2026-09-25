/**
 * Wizard Radar — PASSO 3 · colonna «Competenze e laboratori extra».
 *
 * Serve a intercettare i bandi PNRR/PON per esperti: TAG popolari a un click,
 * chip di quelle scelte e parole chiave personali. NIENTE elenchi fissi di
 * discipline scolastiche (Italiano, Matematica…: sono coperte dalle classi di
 * concorso) e nessuna seconda casella di ricerca: si cerca nel campo unificato
 * del passo, che restituisce insieme classi e competenze.
 */
import { Check, Plus } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { competenzeSuggerite, materie } from '@/data/ordiniMaterie';
import type { SelezioneMaterie } from '../tipiSelezione';

interface SezioneCompetenzeExtraProps {
  selezione: SelezioneMaterie;
}

export function SezioneCompetenzeExtra({ selezione }: SezioneCompetenzeExtraProps) {
  const {
    materieId,
    materieCustom,
    toggleMateria,
    aggiungiCompetenzaSuggerita,
    removeCustomMateria,
  } = selezione;

  return (
    <div className="rounded-xl border border-primary-100 p-2.5">
      <h3 className="text-sm font-bold text-primary-700">
        In cosa puoi lavorare, oltre la tua classe di concorso?
      </h3>
      <p className="mt-0.5 text-[11px] leading-relaxed text-primary-500">
        Competenze e laboratori che puoi proporre per bandi PNRR/PON, progetti e corsi da esperto.
        Cercali nel campo qui sopra: se non li trovi, la stessa ricerca te li fa aggiungere come
        parola chiave.
      </p>

      {/* TAG POPOLARI (PNRR/PON): un click per aggiungerli al profilo. */}
      <p className="mt-2 text-[11px] font-semibold text-primary-700">
        Le più richieste dai bandi PNRR/PON:
      </p>
      <div className="mt-1 flex flex-wrap gap-1">
        {competenzeSuggerite.map((c) => {
          const attiva = materieId.includes(c.materiaId);
          return (
            <button
              key={c.materiaId}
              type="button"
              onClick={() => aggiungiCompetenzaSuggerita(c.materiaId)}
              aria-pressed={attiva}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition ${
                attiva
                  ? 'border-primary-500 bg-primary-50 text-primary-800'
                  : 'border-primary-200 bg-white text-primary-700 hover:border-primary-400'
              }`}
            >
              {attiva ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              {c.nome}
            </button>
          );
        })}
      </div>

      {(materieId.length > 0 || materieCustom.length > 0) && (
        <div className="mt-2 border-t border-primary-100 pt-2">
          <p className="text-[11px] font-semibold text-primary-700">
            Le tue competenze e laboratori extra da proporre:
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {materieId.map((id) => (
              <Pill
                key={id}
                label={materie.find((m) => m.id === id)?.nome ?? id}
                onRemove={() => toggleMateria(id)}
                color="primary"
              />
            ))}
            {materieCustom.map((m) => (
              <Pill key={m} label={m} onRemove={() => removeCustomMateria(m)} color="secondary" />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-primary-400">
            Tocca la ✕ per rimuovere una competenza o una parola chiave.
          </p>
        </div>
      )}
    </div>
  );
}

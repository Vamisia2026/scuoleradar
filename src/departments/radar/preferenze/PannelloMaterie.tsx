/**
 * Preferenze Radar — pannello «Materie e Competenze».
 *
 * Competenze PNRR/PON suggerite a un click, competenze/ laboratori scritti
 * dall'utente e filtri rapidi per categoria. Presentazione pura: lo stato delle
 * selezioni arriva dal contenitore `PreferenzeRadar`.
 */
import { Check, Plus } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import { competenzeSuggerite, materie, materieCompetenzeExtra } from '@/data/ordiniMaterie';

interface PannelloMaterieProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Materie selezionate dal catalogo. */
  materieId: string[];
  /** Competenze/laboratori scritti liberamente dall'utente. */
  materieCustom: string[];
  /** Testo corrente del campo «aggiungi competenza». */
  customMateriaInput: string;
  setCustomMateriaInput: (valore: string) => void;
  addCustomMateria: () => void;
  removeCustomMateria: (materia: string) => void;
  /** Seleziona/deseleziona una materia del catalogo. */
  toggleMateria: (id: string) => void;
  /** Aggiunge una delle competenze suggerite (PNRR/PON). */
  aggiungiCompetenzaSuggerita: (id: string) => void;
}

export function PannelloMaterie({
  accordionAperti,
  toggleAccordion,
  materieId,
  materieCustom,
  customMateriaInput,
  setCustomMateriaInput,
  addCustomMateria,
  removeCustomMateria,
  toggleMateria,
  aggiungiCompetenzaSuggerita,
}: PannelloMaterieProps) {
  return (
      <Accordion
        icona="📚"
        titolo="In cosa puoi lavorare, anche oltre la tua classe di concorso?"
        badge={
          materieId.length + materieCustom.length
            ? `${materieId.length + materieCustom.length} selezionate`
            : undefined
        }
        aperto={!!accordionAperti.materie}
        onToggle={() => toggleAccordion('materie')}
      >
        <p className="mt-1 text-xs text-primary-500">
          Le competenze che puoi proporre oltre la cattedra: servono per intercettare bandi PNRR/PON,
          progetti, corsi e laboratori da esperto.
        </p>

        {/* COMPETENZE PIÙ RICHIESTE (PNRR/PON): suggerimento a un click.
            Precompilano il profilo con le aree che le scuole cercano di più,
            al posto delle discipline curricolari (già coperte dalle classi). */}
        <p className="mt-3 text-xs font-semibold text-primary-700">
          Le più richieste dai bandi PNRR/PON — aggiungile con un click:
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {competenzeSuggerite.map((c) => {
            const attiva = materieId.includes(c.materiaId);
            return (
              <button
                key={c.materiaId}
                type="button"
                onClick={() => aggiungiCompetenzaSuggerita(c.materiaId)}
                aria-pressed={attiva}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  attiva
                    ? 'border-primary-500 bg-primary-50 text-primary-800'
                    : 'border-primary-200 bg-white text-primary-700 hover:border-primary-400'
                }`}
              >
                {attiva ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                {c.nome}
              </button>
            );
          })}
        </div>

        {materieId.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {materieId.map((id) => (
              <Pill
                key={id}
                label={materie.find((m) => m.id === id)?.nome ?? id}
                onRemove={() => toggleMateria(id)}
                color="primary"
              />
            ))}
          </div>
        )}

        <div className="mt-3 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
          {materieCompetenzeExtra().map((m) => {
            const selected = materieId.includes(m.id);
            return (
              <button
                key={m.id}
                onClick={() => toggleMateria(m.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                  selected ? 'bg-primary-50 text-primary-800' : 'text-primary-700 hover:bg-primary-50'
                }`}
              >
                <span>{m.nome}</span>
                {selected && <Check className="h-4 w-4 text-primary-600" />}
              </button>
            );
          })}
        </div>

        {/* Competenze e laboratori scritti dall'utente */}
        <h4 className="mt-5 text-sm font-bold text-primary-700">
          Le tue competenze e laboratori extra da proporre:
        </h4>
        <p className="mt-1 text-xs text-primary-500">
          Aggiungi ciò che sai fare e non trovi nell'elenco (es. laboratori, progetti, lingue,
          certificazioni): lo useremo per intercettare i bandi giusti.
        </p>
        {materieCustom.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {materieCustom.map((m) => (
              <Pill key={m} label={m} onRemove={() => removeCustomMateria(m)} color="primary" />
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={customMateriaInput}
            onChange={(e) => setCustomMateriaInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustomMateria();
              }
            }}
            placeholder="Es. Robotica educativa, Digital storytelling, Metodologia CLIL…"
            className="input"
          />
          <button
            onClick={addCustomMateria}
            disabled={!customMateriaInput.trim()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Aggiungi
          </button>
        </div>
      </Accordion>
  );
}

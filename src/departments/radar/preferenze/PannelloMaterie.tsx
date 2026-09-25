/**
 * Preferenze Radar — pannello «In cosa puoi lavorare».
 *
 * Unico campo di RICERCA UNIFICATA (classi di concorso + competenze + parole
 * chiave): niente elenchi fissi di discipline scolastiche — Italiano, Matematica,
 * Pedagogia… sono coperte dalle classi di concorso e dalla ricerca. Restano i tag
 * PNRR/PON a un click e i chip di ciò che l'utente ha scelto.
 *
 * Presentazione pura: stato e azioni arrivano dal contenitore `PreferenzeRadar`.
 */
import { Check, Plus } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import { competenzeSuggerite, materie } from '@/data/ordiniMaterie';
import { RicercaSelezioni } from '../components/RicercaSelezioni';
import type { GruppiRicercaSelezioni, SuggerimentoSelezione } from '@/lib/ricercaSelezioniRadar';

interface PannelloMaterieProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Materie selezionate dal catalogo. */
  materieId: string[];
  /** Parole chiave libere dell'utente. */
  materieCustom: string[];
  /** Testo corrente della ricerca unificata. */
  querySelezioni: string;
  setQuerySelezioni: (valore: string) => void;
  /** Risultati della ricerca unificata (classi + competenze + parola chiave). */
  gruppiSelezioni: GruppiRicercaSelezioni;
  /** Applica un risultato (classe o competenza). */
  onScegliSelezione: (suggerimento: SuggerimentoSelezione) => void;
  /** Aggiunge la parola digitata ai tag personali. */
  onParolaChiave: (testo: string) => void;
  /** Rimuove una parola chiave libera. */
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
  querySelezioni,
  setQuerySelezioni,
  gruppiSelezioni,
  onScegliSelezione,
  onParolaChiave,
  removeCustomMateria,
  toggleMateria,
  aggiungiCompetenzaSuggerita,
}: PannelloMaterieProps) {
  const totale = materieId.length + materieCustom.length;
  return (
    <Accordion
      icona="📚"
      titolo="In cosa puoi lavorare, anche oltre la tua classe di concorso?"
      badge={totale ? `${totale} selezionate` : undefined}
      aperto={!!accordionAperti.materie}
      onToggle={() => toggleAccordion('materie')}
    >
      <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
        Un solo campo di ricerca: le classi di concorso rispondono per codice, denominazione e
        materia collegata (es. «Pedagogia»); le competenze per laboratorio e bando PNRR/PON. Se non
        trovi qualcosa, la stessa ricerca te lo fa aggiungere come parola chiave.
      </p>

      <div className="mt-2">
        <RicercaSelezioni
          query={querySelezioni}
          setQuery={setQuerySelezioni}
          gruppi={gruppiSelezioni}
          onScegli={onScegliSelezione}
          onParolaChiave={onParolaChiave}
          placeholder="Cerca una classe di concorso o una competenza"
          helper="Classi di concorso e competenze PNRR/PON in un unico elenco di risultati."
        />
      </div>

      {/* TAG POPOLARI (PNRR/PON): suggerimento a un click. */}
      <p className="mt-3 text-xs font-semibold text-primary-700">
        Le più richieste dai bandi PNRR/PON — aggiungile con un click:
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
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

      {totale > 0 && (
        <>
          <h4 className="mt-4 text-sm font-bold text-primary-700">
            Le tue competenze e laboratori extra da proporre:
          </h4>
          <p className="mt-1 text-xs text-primary-500">
            Quello che hai scelto: tocca la ✕ per rimuoverlo. Le parole chiave sono i tuoi tag
            personali, cercati nel testo degli avvisi.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
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
        </>
      )}
    </Accordion>
  );
}

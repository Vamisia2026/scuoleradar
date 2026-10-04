/**
 * Preferenze Radar — pannello «Classi di Concorso».
 * Ricerca con tolleranza di formato (A-18 ≡ A18 ≡ a 18 ≡ «italiano» ≡ «CPIA»),
 * filtro per materia/ambito e tetto del piano.
 *
 * L'AREA SOSTEGNO non compare più qui: è inclusa in modo PERMANENTE e INVISIBILE
 * nel backend (nessun blocco visivo, nessun interruttore, nessun opt-out — §26.45).
 * Presentazione pura: selezione e vincoli arrivano dal contenitore.
 */
import { Check, Search } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import type { ClasseConcorso } from '@/data/classiConcorso';
import { materie } from '@/data/ordiniMaterie';
import { contieneClasse } from '@/lib/matchingEngine';
import type { PianoLimits } from '@/lib/planLimits';

interface PannelloClassiProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Codici delle classi di concorso selezionate. */
  classiCodici: string[];
  /** Classi già filtrate da ricerca e ambito. */
  classiFiltrate: ClasseConcorso[];
  /** Etichetta leggibile di una classe («A-18 · Filosofia e scienze umane»). */
  labelClasse: (codice: string) => string;
  /** Ambito/materia usato come filtro rapido. */
  materiaFilter: string;
  setMateriaFilter: (valore: string) => void;
  /** Testo di ricerca sulle classi. */
  queryClasse: string;
  setQueryClasse: (valore: string) => void;
  /** Tetto di classi del piano corrente. */
  maxClassiConcorso: number;
  /** Seleziona/deseleziona una classe di concorso. */
  toggleClasse: (codice: string) => void;
  /** Limiti del piano (per il copy Base/PRO). */
  limitiPiano: PianoLimits;
}

export function PannelloClassi({
  accordionAperti,
  toggleAccordion,
  classiCodici,
  classiFiltrate,
  labelClasse,
  materiaFilter,
  setMateriaFilter,
  queryClasse,
  setQueryClasse,
  maxClassiConcorso,
  toggleClasse,
  limitiPiano,
}: PannelloClassiProps) {
  return (
    <Accordion
      icona="🎓"
      titolo="Classi di concorso"
      badge={classiCodici.length ? `${classiCodici.length} selezionate` : undefined}
      sommario={
        classiCodici.length === 0 ? (
          <span className="text-primary-500">Nessuna classe selezionata: apri per scegliere le tue abilitazioni.</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {classiCodici.map((c) => (
              <Pill key={c} label={labelClasse(c)} onRemove={() => toggleClasse(c)} color="accent" />
            ))}
          </div>
        )
      }
      aperto={!!accordionAperti.classi}
      onToggle={() => toggleAccordion('classi')}
    >
      <p className="text-xs text-primary-600">
        {limitiPiano.piano === 'pro'
          ? 'PRO: puoi selezionare fino a 4 classi di concorso.'
          : `Piano Base: ${maxClassiConcorso} classi di concorso incluse. Passa a PRO per arrivare a 4.`}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={materiaFilter}
          onChange={(e) => {
            const valore = e.target.value;
            setMateriaFilter(valore);
            if (valore) setQueryClasse('');
          }}
          aria-label="Filtra per materia"
          className={`input ${
            materiaFilter
              ? '!border-blue-500 bg-white ring-2 ring-blue-500'
              : queryClasse.trim()
                ? 'bg-primary-50/60 opacity-80'
                : ''
          }`}
        >
          <option value="">Filtra per materia</option>
          {materie.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
          <input
            type="text"
            value={queryClasse}
            onChange={(e) => {
              const testo = e.target.value;
              setQueryClasse(testo);
              if (testo.trim()) setMateriaFilter('');
            }}
            placeholder="Classe (A-19) o materia (Italiano, CPIA…)"
            aria-label="Cerca classe di concorso o materia"
            className={`input pl-10 ${
              queryClasse.trim()
                ? '!border-blue-500 bg-white ring-2 ring-blue-500'
                : materiaFilter
                  ? 'bg-primary-50/60 opacity-80'
                  : ''
            }`}
          />
        </div>
      </div>

      <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
        {classiFiltrate.map((c) => {
          const selected = contieneClasse(classiCodici, c.codice);
          const atLimit = classiCodici.length >= maxClassiConcorso && !selected;
          return (
            <button
              key={c.codice}
              disabled={atLimit}
              onClick={() => toggleClasse(c.codice)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left text-sm transition ${
                selected
                  ? 'bg-accent-50 text-accent-800'
                  : atLimit
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-primary-50 text-primary-700'
              }`}
            >
              <span>
                <strong>{c.codice}</strong> – {c.denominazione}
              </span>
              {selected && <Check className="h-4 w-4 text-accent-600" />}
            </button>
          );
        })}
      </div>

    </Accordion>
  );
}
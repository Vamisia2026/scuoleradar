/**
 * Preferenze Radar — pannello «Classi di Concorso» (+ preferenza SOSTEGNO).
 *
 * Ricerca con tolleranza di formato (`A-18` ≡ `A18` ≡ `a 18`), filtro per
 * materia/ambito, tetto del piano e adesione esplicita al sostegno.
 * Presentazione pura: selezione e vincoli arrivano dal contenitore.
 */
import { Check, Search } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { Pill } from '@/components/Pill';
import { SostegnoToggle } from '@/components/SostegnoToggle';
import {
  codiciSostegno,
  isCodiceSostegno,
  type ClasseConcorso,
} from '@/data/classiConcorso';
import { materie } from '@/data/ordiniMaterie';
import { contieneClasse, normalizzaClasse } from '@/lib/matchingEngine';
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
  /** Adesione esplicita alle opportunità di sostegno. */
  sostegno: boolean;
  setSostegno: (prossimo: boolean) => void;
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
  sostegno,
  setSostegno,
  limitiPiano,
}: PannelloClassiProps) {
  return (
      <Accordion
        icona="🎓"
        titolo="Classi di concorso"
        badge={classiCodici.length ? `${classiCodici.length} selezionate` : undefined}
        sommario={
          <div className="flex flex-wrap gap-1.5">
            {classiCodici.length === 0 ? (
              <span className="text-xs text-primary-400">
                Nessuna classe selezionata: apri per scegliere le tue abilitazioni.
              </span>
            ) : (
              classiCodici.map((c) => (
                <Pill
                  key={c}
                  label={labelClasse(c)}
                  onRemove={() => toggleClasse(c)}
                  color="accent"
                />
              ))
            )}
          </div>
        }
        aperto={!!accordionAperti.classi}
        onToggle={() => toggleAccordion('classi')}
      >
        <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
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
              placeholder="Cerca classe (es. A-12)"
              aria-label="Cerca classe di concorso"
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

        {/* Preferenza SOSTEGNO — domanda esplicita: il sostegno è un'abilitazione
            separata, senza adesione gli avvisi ADEE/ADMM/ADSS non si ricevono. */}
        <SostegnoToggle
          attivo={sostegno}
          onCambia={setSostegno}
          classiSostegno={classiCodici.filter((c) => isCodiceSostegno(normalizzaClasse(c)))}
          idPrefisso="preferenze-sostegno"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-primary-400">
          Classi di sostegno del catalogo: {codiciSostegno.join(', ')}.
        </p>
      </Accordion>
  );
}

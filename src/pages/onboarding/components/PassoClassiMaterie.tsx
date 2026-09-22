/**
 * Onboarding · PASSO 2 — classi di concorso e materie/competenze.
 *
 * Due gruppi di props coerenti (`classi`, `materie`) destrutturati in testa:
 * ricerca con tolleranza di formato, selezione multipla e competenze scritte
 * dall'utente. Presentazione pura (nessuno stato proprio).
 */
import { Check, Plus, Search } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { type ClasseConcorso } from '@/data/classiConcorso';
import { materie, type Materia } from '@/data/ordiniMaterie';

/** Stato e azioni della sezione «Classi di concorso». */
export interface SelezioneClassiOnboarding {
  classiCodici: string[];
  classiFiltrate: ClasseConcorso[];
  queryClasse: string;
  setQueryClasse: (valore: string) => void;
  toggleClasse: (codice: string) => void;
}

/** Stato e azioni della sezione «Materie e competenze». */
export interface SelezioneMaterieOnboarding {
  materieId: string[];
  materieCustom: string[];
  materieFiltrate: Materia[];
  materiaFilter: string;
  setMateriaFilter: (valore: string) => void;
  queryMateria: string;
  setQueryMateria: (valore: string) => void;
  customMateriaInput: string;
  setCustomMateriaInput: (valore: string) => void;
  addCustomMateria: () => void;
  removeCustomMateria: (materia: string) => void;
  toggleMateria: (id: string) => void;
}

interface PassoClassiMaterieProps {
  classi: SelezioneClassiOnboarding;
  materieScelte: SelezioneMaterieOnboarding;
}

export function PassoClassiMaterie({ classi, materieScelte }: PassoClassiMaterieProps) {
  // Destrutturazione: il corpo JSX resta identico a quello della pagina.
  const { classiCodici, classiFiltrate, queryClasse, setQueryClasse, toggleClasse } = classi;
  const {
    materieId,
    materieCustom,
    materieFiltrate,
    materiaFilter,
    setMateriaFilter,
    queryMateria,
    setQueryMateria,
    customMateriaInput,
    setCustomMateriaInput,
    addCustomMateria,
    removeCustomMateria,
    toggleMateria,
  } = materieScelte;

  return (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Materie e classi di concorso</h2>
              <p className="mt-1 text-sm text-primary-600">
                Seleziona le classi per cui sei abilitato e le materie in cui sei competente.
                Puoi anche aggiungerne di personalizzate, anche non collegate a una classe specifica.
              </p>

              <div className="mt-5 space-y-5">
                {/* Classi di concorso */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-primary-700">Classi di concorso</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <select
                        value={materiaFilter}
                        onChange={(e) => setMateriaFilter(e.target.value)}
                        className="w-full appearance-none rounded-xl border border-primary-200 bg-white px-4 py-2.5 pr-10 text-sm text-primary-800"
                      >
                        <option value="">Filtra per materia</option>
                        {materie.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                      <input
                        type="text"
                        value={queryClasse}
                        onChange={(e) => setQueryClasse(e.target.value)}
                        placeholder="Es. A-18, A-22, Filosofia..."
                        className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800"
                      />
                    </div>
                  </div>

                  {classiCodici.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {classiCodici.map((c) => (
                        <Pill key={c} label={c} onRemove={() => toggleClasse(c)} color="accent" />
                      ))}
                    </div>
                  )}

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-primary-100 p-2">
                    {classiFiltrate.length === 0 ? (
                      <p className="p-4 text-center text-sm text-primary-400">Nessuna classe trovata.</p>
                    ) : (
                      classiFiltrate.map((c) => {
                        const selected = classiCodici.includes(c.codice);
                        return (
                          <button
                            key={c.codice}
                            onClick={() => toggleClasse(c.codice)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition ${
                              selected
                                ? 'border-accent-300 bg-accent-50'
                                : 'border-transparent hover:bg-primary-50'
                            }`}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-primary-800">
                                {c.codice} – {c.denominazione}
                              </span>
                              <span className="block text-xs text-primary-500">
                                {c.materie.join(', ')}
                              </span>
                            </span>
                            {selected && <Check className="h-5 w-5 text-accent-600" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Materie */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-primary-700">
                    Materie e competenze
                  </h3>
                  <p className="mb-3 text-xs text-primary-500">
                    Seleziona le materie in cui sei competente, anche se non collegate a una classe di concorso specifica.
                  </p>
                  {materieId.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
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
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                    <input
                      type="text"
                      value={queryMateria}
                      onChange={(e) => setQueryMateria(e.target.value)}
                      placeholder="Cerca materia…"
                      className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800"
                    />
                  </div>
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                    {materieFiltrate.length === 0 ? (
                      <p className="p-4 text-center text-sm text-primary-400">Nessuna materia trovata.</p>
                    ) : (
                      materieFiltrate.map((m) => {
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
                      })
                    )}
                  </div>
                </div>

                {/* Materia personalizzata */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-primary-700">
                    Aggiungi materia personalizzata
                  </h3>
                  <p className="mb-3 text-xs text-primary-500">
                    Scrivi una materia o competenza non presente nell'elenco.
                  </p>
                  {materieCustom.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {materieCustom.map((m) => (
                        <Pill key={m} label={m} onRemove={() => removeCustomMateria(m)} color="primary" />
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
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
                      placeholder="Es. Educazione motoria, Dizione, Robotica educativa…"
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
                </div>
              </div>
            </div>
  );
}

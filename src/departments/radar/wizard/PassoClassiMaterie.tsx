/**
 * Wizard Radar — PASSO 3 «Per quali insegnamenti sei abilitato?»
 * (classi di concorso + materie/competenze extra + sostegno).
 *
 * Il pannello è di sola presentazione: riceve due gruppi di props coerenti
 * (`classi`, `materie`) e i limiti del piano. Non conosce Supabase, il salvataggio
 * né gli step: ogni decisione resta nel contenitore del wizard.
 */
import { AlertCircle, Check, Plus, Search } from 'lucide-react';
import { Pill } from '@/components/Pill';
import { SostegnoToggle } from '@/components/SostegnoToggle';
import { codiciSostegno, isCodiceSostegno, type ClasseConcorso } from '@/data/classiConcorso';
import { competenzeSuggerite, materie, type Materia } from '@/data/ordiniMaterie';
import { contieneClasse, normalizzaClasse } from '@/lib/matchingEngine';
import type { PianoLimits } from '@/lib/planLimits';

/** Stato e azioni della sezione «Classi di concorso». */
export interface SelezioneClassi {
  classiCodici: string[];
  classiFiltrate: ClasseConcorso[];
  classiWarning: boolean;
  maxClassiConcorso: number;
  queryClasse: string;
  setQueryClasse: (valore: string) => void;
  toggleClasse: (codice: string) => void;
}

/** Stato e azioni della sezione «Materie e competenze extra». */
export interface SelezioneMaterie {
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
  aggiungiCompetenzaSuggerita: (id: string) => void;
  sostegno: boolean;
  toggleSostegno: (prossimo: boolean) => void;
}

interface PassoClassiMaterieProps {
  selezioneClassi: SelezioneClassi;
  selezioneMaterie: SelezioneMaterie;
  limitiPiano: PianoLimits;
}

export function PassoClassiMaterie({
  selezioneClassi,
  selezioneMaterie,
  limitiPiano,
}: PassoClassiMaterieProps) {
  // Destrutturazione: il corpo JSX resta identico a quello del contenitore.
  const {
    classiCodici,
    classiFiltrate,
    classiWarning,
    maxClassiConcorso,
    queryClasse,
    setQueryClasse,
    toggleClasse,
  } = selezioneClassi;
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
    aggiungiCompetenzaSuggerita,
    sostegno,
    toggleSostegno,
  } = selezioneMaterie;

  return (
            <div className="animate-fade-in overflow-y-hidden">
              <h2 className="text-lg font-bold text-primary-800">
                Per quali insegnamenti sei abilitato o qualificato?
              </h2>

              <div className="mt-2 space-y-2">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-primary-700">Classi di concorso</h3>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-600">
                      {classiCodici.length}/{maxClassiConcorso} selezionate
                    </span>
                  </div>
                  {limitiPiano.piano === 'base' && (
                    <p className="mb-2 text-xs text-secondary-700">
                      Piano Base: fino a 2 classi di concorso. Passa a PRO per aggiungerne fino a 4.
                    </p>
                  )}
                  {(classiWarning || classiCodici.length >= maxClassiConcorso) && (
                    <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-secondary-200 bg-secondary-50 px-3 py-2 text-xs text-secondary-800">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {limitiPiano.piano === 'pro'
                        ? `Sei al massimo: PRO include fino a ${maxClassiConcorso} classi di concorso.`
                        : 'Il piano Base include 2 classi di concorso. Passa a PRO per aggiungerne fino a 4.'}
                    </p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="relative">
                      <select
                        value={materiaFilter}
                        onChange={(e) => {
                          const valore = e.target.value;
                          setMateriaFilter(valore);
                          if (valore) setQueryClasse('');
                        }}
                        aria-label="Filtra per materia"
                        className={`w-full appearance-none rounded-xl border px-3 py-2 pr-9 text-sm transition ${
                          materiaFilter
                            ? 'border-blue-500 bg-white text-primary-800 ring-2 ring-blue-500'
                            : queryClasse.trim()
                              ? 'border-primary-100 bg-primary-50/60 text-primary-400 opacity-80'
                              : 'border-primary-200 bg-white text-primary-800 hover:border-primary-300'
                        }`}
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
                        onChange={(e) => {
                          const testo = e.target.value;
                          setQueryClasse(testo);
                          if (testo.trim()) setMateriaFilter('');
                        }}
                        placeholder="Es. A-18, A-22, Filosofia..."
                        aria-label="Cerca classe di concorso"
                        className={`w-full rounded-xl border py-2 pl-10 pr-3 text-sm transition ${
                          queryClasse.trim()
                            ? 'border-blue-500 bg-white text-primary-800 ring-2 ring-blue-500'
                            : materiaFilter
                              ? 'border-primary-100 bg-primary-50/60 text-primary-400 opacity-80'
                              : 'border-primary-200 bg-white text-primary-800 hover:border-primary-300'
                        }`}
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

                  <div className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-1">
                    {classiFiltrate.length === 0 ? (
                      <p className="p-4 text-center text-sm text-primary-400">Nessuna classe trovata.</p>
                    ) : (
                      classiFiltrate.map((c) => {
                        const selected = contieneClasse(classiCodici, c.codice);
                        const atLimit = classiCodici.length >= maxClassiConcorso && !selected;
                        return (
                          <button
                            key={c.codice}
                            type="button"
                            disabled={atLimit}
                            onClick={() => toggleClasse(c.codice)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left transition ${
                              selected
                                ? 'border-accent-300 bg-accent-50'
                                : atLimit
                                  ? 'cursor-not-allowed border-transparent opacity-50 hover:bg-transparent'
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

                  {/* Preferenza SOSTEGNO: domanda esplicita, subito dopo le classi
                      (il sostegno è un'abilitazione separata: senza adesione gli
                      avvisi ADEE/ADMM/ADSS non vengono notificati). */}
                  <SostegnoToggle
                    attivo={sostegno}
                    onCambia={toggleSostegno}
                    classiSostegno={classiCodici.filter((c) => isCodiceSostegno(normalizzaClasse(c)))}
                    idPrefisso="wizard-sostegno"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-primary-400">
                    Le classi di sostegno del catalogo sono {codiciSostegno.join(', ')}.
                  </p>
                </div>

                {/* Competenze extra */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-primary-700">
                    Le tue competenze e laboratori extra da proporre:
                  </h3>
                  <p className="mb-2 text-xs text-primary-500">
                    Servono per intercettare bandi PNRR/PON, progetti, corsi e laboratori da esperto.
                  </p>
                  {/* Suggerimenti ad ALTA RICHIESTA (PNRR/PON): un click per aggiungerli. */}
                  <p className="mb-1.5 text-xs font-semibold text-primary-700">
                    Le più richieste dai bandi PNRR/PON:
                  </p>
                  <div className="mb-3 flex flex-wrap gap-1.5">
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
                    <div className="mb-2 flex flex-wrap gap-1.5">
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
                  <div className="relative mb-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                    <input
                      type="text"
                      value={queryMateria}
                      onChange={(e) => setQueryMateria(e.target.value)}
                      placeholder="Cerca materia…"
                      className="w-full rounded-xl border border-primary-200 bg-white py-2 pl-10 pr-4 text-sm text-primary-800"
                    />
                  </div>
                  <div className="max-h-20 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-1">
                    {materieFiltrate.length === 0 ? (
                      <p className="p-4 text-center text-sm text-primary-400">Nessuna materia trovata.</p>
                    ) : (
                      materieFiltrate.map((m) => {
                        const selected = materieId.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleMateria(m.id)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                              selected
                                ? 'bg-primary-50 text-primary-800'
                                : 'text-primary-700 hover:bg-primary-50'
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

                {/* Competenze e laboratori scritti dall'utente */}
                <div>
                  <h3 className="mb-2 text-sm font-bold text-primary-700">
                    Altre competenze o laboratori da aggiungere:
                  </h3>
                  <p className="mb-2 text-xs text-primary-500">
                    Scrivi ciò che sai fare e non trovi nell'elenco (es. laboratori, progetti, certificazioni).
                  </p>
                  {materieCustom.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
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
                      placeholder="Es. Educazione motoria, Digital storytelling, Robotica educativa…"
                      className="w-full rounded-xl border border-primary-200 bg-white px-3 py-1.5 text-sm text-primary-800"
                    />
                    <button
                      type="button"
                      onClick={addCustomMateria}
                      disabled={!customMateriaInput.trim()}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-1.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:opacity-50"
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

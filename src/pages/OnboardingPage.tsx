import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Baby, School, BookOpen, GraduationCap, Search, Check, MapPin, Send, Mail, Radar, ArrowRight, ArrowLeft,
  Plus, Users, Moon, Briefcase, Wrench,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { ordiniScuola, materie, type OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Pill } from '@/components/Pill';

const ordineIcons: Record<OrdineScuola, React.ReactNode> = {
  infanzia: <Baby className="h-6 w-6" />,
  primaria: <School className="h-6 w-6" />,
  secondaria1: <BookOpen className="h-6 w-6" />,
  secondaria2: <GraduationCap className="h-6 w-6" />,
  cpia: <Users className="h-6 w-6" />,
  serali: <Moon className="h-6 w-6" />,
  pon: <Briefcase className="h-6 w-6" />,
  ata: <Wrench className="h-6 w-6" />,
};

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, completaOnboarding, salvaProfilo } = useApp();
  const [step, setStep] = useState(1);

  const [ordini, setOrdini] = useState<OrdineScuola[]>([]);
  const [classiCodici, setClassiCodici] = useState<string[]>([]);
  const [materieId, setMaterieId] = useState<string[]>([]);
  const [materieCustom, setMaterieCustom] = useState<string[]>([]);
  const [provinceCodici, setProvinceCodici] = useState<string[]>([]);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [emailNotifica, setEmailNotifica] = useState(user?.email ?? '');

  // search for classi
  const [queryClasse, setQueryClasse] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('');
  // custom materia input
  const [customMateriaInput, setCustomMateriaInput] = useState('');

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  const classiFiltrate = useMemo(() => {
    let list = classiConcorso;
    if (materiaFilter) list = list.filter((c) => c.materie.includes(materiaFilter));
    if (queryClasse.trim()) {
      const q = queryClasse.toLowerCase();
      list = list.filter(
        (c) => c.codice.toLowerCase().includes(q) || c.denominazione.toLowerCase().includes(q),
      );
    }
    return list;
  }, [queryClasse, materiaFilter]);

  const toggleOrdine = (id: OrdineScuola) => {
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  };

  const toggleClasse = (codice: string) => {
    setClassiCodici((prev) =>
      prev.includes(codice) ? prev.filter((c) => c !== codice) : [...prev, codice],
    );
  };

  const toggleMateria = (id: string) => {
    setMaterieId((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const addCustomMateria = () => {
    const val = customMateriaInput.trim();
    if (!val) return;
    if (!materieCustom.some((m) => m.toLowerCase() === val.toLowerCase())) {
      setMaterieCustom((prev) => [...prev, val]);
    }
    setCustomMateriaInput('');
  };

  const removeCustomMateria = (m: string) => {
    setMaterieCustom((prev) => prev.filter((x) => x !== m));
  };

  const toggleProvincia = (codice: string) => {
    setProvinceCodici((prev) =>
      prev.includes(codice) ? prev.filter((c) => c !== codice) : [...prev, codice],
    );
  };

  const canNext = () => {
    if (step === 1) return ordini.length > 0;
    if (step === 2) return classiCodici.length > 0 || materieId.length > 0 || materieCustom.length > 0;
    if (step === 3) return provinceCodici.length > 0;
    if (step === 4) return telegramUsername.trim() && emailNotifica.trim();
    return false;
  };

  const handleFinish = () => {
    const preferenzeFinali = {
      ordini,
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
      telegramUsername: telegramUsername.trim(),
      emailNotifica: emailNotifica.trim(),
      onboarded: true,
      favoriteSchools: [],
      ignoredSchools: [],
    };
    completaOnboarding(preferenzeFinali);
    // PASSO 3: persiste province e classi di concorso su Supabase (tabella profiles)
    void salvaProfilo(preferenzeFinali);
    navigate('/dashboard/radar');
  };

  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-primary-600">
              Passo {step} di {totalSteps}
            </span>
            <span className="text-sm text-primary-400">Onboarding</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100">
            <div
              className="h-full rounded-full bg-primary-500 transition-all duration-500"
              style={{ width: `${(step / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-primary-100 bg-white p-6 shadow-card sm:p-8">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">
                In quale ordine vuoi insegnare o lavorare?
              </h2>
              <p className="mt-1 text-sm text-primary-600">
                Puoi selezionare più opzioni. Il Radar cercherà opportunità per tutte le tipologie scelte.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {ordiniScuola.map((o) => {
                  const selected = ordini.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      onClick={() => toggleOrdine(o.id)}
                      className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                        selected
                          ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-500'
                          : 'border-primary-200 bg-white hover:border-primary-300'
                      }`}
                    >
                      <span
                        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                          selected ? 'bg-primary-500 text-white' : 'bg-primary-50 text-primary-600'
                        }`}
                      >
                        {ordineIcons[o.id]}
                      </span>
                      <span className="flex-1">
                        <span className="block font-semibold text-primary-800">{o.nome}</span>
                        <span className="block text-xs text-primary-500">{o.descrizione}</span>
                      </span>
                      {selected && <Check className="h-5 w-5 shrink-0 text-primary-600" />}
                    </button>
                  );
                })}
              </div>
              {ordini.length > 0 && (
                <p className="mt-4 text-sm font-medium text-primary-600">
                  Hai selezionato {ordini.length} {ordini.length === 1 ? 'tipologia' : 'tipologie'}.
                </p>
              )}
            </div>
          )}

          {step === 2 && (
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
                        placeholder="Es. A-12, Matematica…"
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
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                    {materie.map((m) => {
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
                        <Pill key={m} label={m} onRemove={() => removeCustomMateria(m)} color="secondary" />
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
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Province di interesse</h2>
              <p className="mt-1 text-sm text-primary-600">
                Seleziona le province in cui vuoi ricevere opportunità (interpelli, bandi, progetti).
              </p>

              {provinceCodici.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {provinceCodici.map((c) => (
                    <Pill
                      key={c}
                      label={province.find((p) => p.codice === c)?.nome ?? c}
                      onRemove={() => toggleProvincia(c)}
                      color="primary"
                    />
                  ))}
                </div>
              )}

              <div className="mt-5 max-h-80 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                {provinceSorted.map((p) => {
                  const selected = provinceCodici.includes(p.codice);
                  return (
                    <label
                      key={p.codice}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-primary-50 ${
                        selected ? 'bg-primary-50' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleProvincia(p.codice)}
                        className="h-4 w-4 rounded border-primary-300 text-primary-500"
                      />
                      <MapPin className="h-4 w-4 text-primary-400" />
                      <span className="text-sm text-primary-800">{p.nome}</span>
                      <span className="ml-auto text-xs text-primary-400">{p.codice}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Canali di notifica</h2>
              <p className="mt-1 text-sm text-primary-600">
                Riceverai le tue 3 notifiche incluse nell&apos;Offerta su Telegram, e in copia via email.
                Ti avviseremo di interpelli per supplenze, bandi per esperti, CPIA e progetti scolastici.
              </p>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Send className="h-4 w-4 text-primary-500" />
                    Username Telegram
                  </span>
                  <input
                    type="text"
                    value={telegramUsername}
                    onChange={(e) => setTelegramUsername(e.target.value)}
                    placeholder="@iltuousername"
                    className="input"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Mail className="h-4 w-4 text-primary-500" />
                    Email (backup)
                  </span>
                  <input
                    type="email"
                    value={emailNotifica}
                    onChange={(e) => setEmailNotifica(e.target.value)}
                    className="input"
                  />
                </label>

                <div className="rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-700">
                  Niente spam: solo notifiche di opportunità compatibili con il tuo profilo.
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            {step > 1 ? (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Indietro
              </button>
            ) : (
              <span />
            )}

            {step < totalSteps ? (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={!canNext()}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Radar className="h-4 w-4" />
                Attiva il Radar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

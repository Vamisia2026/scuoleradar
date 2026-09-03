import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Baby, School, BookOpen, GraduationCap, Search, Check, MapPin, Send, Mail, Radar, ArrowRight, ArrowLeft,
  Plus, Users, Moon, Briefcase, Wrench, AlertCircle,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { ordiniScuola, materie, type OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Pill } from '@/components/Pill';

/** Alias codici di laurea (LM) → classi di concorso correlate, per la ricerca CDC. */
const ALIAS_LAUREA_CLASSI: Record<string, string[]> = {
  lm85: ['A-18'], // Scienze pedagogiche → Filosofia e scienze umane
  lm14: ['A-12'], // Filologia moderna → Discipline letterarie
  lm40: ['A-27'], // Matematica → Matematica e Fisica
  lm37: ['A-22'], // Lingue e letterature moderne → Inglese
};

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
  const { user, preferenze, completaOnboarding, salvaProfilo } = useApp();
  const [step, setStep] = useState(1);

  const [ordini, setOrdini] = useState<OrdineScuola[]>([]);
  const [classiCodici, setClassiCodici] = useState<string[]>([]);
  const [materieId, setMaterieId] = useState<string[]>([]);
  const [materieCustom, setMaterieCustom] = useState<string[]>([]);
  const [provinceCodici, setProvinceCodici] = useState<string[]>([]);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [emailNotifica, setEmailNotifica] = useState(user?.email ?? '');
  /** Anagrafica (facoltativa): genere + età, precompilati da registrazione/profilo. */
  const [genereOnb, setGenereOnb] = useState<'M' | 'F' | null>(preferenze.genere ?? user?.genere ?? null);
  const [etaOnb, setEtaOnb] = useState(preferenze.eta ? String(preferenze.eta) : '');

  // Deeplink Telegram: https://t.me/ScuoleRadar_bot?start=<user_id> — il bot
  // collega automaticamente il Chat ID dell'utente al suo profilo (webhook /start).
  const [telegramDeepLink, setTelegramDeepLink] = useState('https://t.me/ScuoleRadar_bot');
  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (attivo && data.user) {
          setTelegramDeepLink(`https://t.me/ScuoleRadar_bot?start=${data.user.id}`);
        }
      })
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, []);
  /** True se il profilo ha già un Chat ID Telegram collegato (via bot o manuale). */
  const telegramCollegato = Boolean(preferenze.telegramChatId);

  // search for classi
  const [queryClasse, setQueryClasse] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('');
  // custom materia input
  const [customMateriaInput, setCustomMateriaInput] = useState('');
  // ricerca materie (Passo 2) e province (Passo 3)
  const [queryMateria, setQueryMateria] = useState('');
  const [queryProvincia, setQueryProvincia] = useState('');
  const [provinceWarning, setProvinceWarning] = useState(false);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  /** Fair use: massimo 4 province selezionabili nel piano attuale. */
  const LIMITE_PROVINCE = 4;

  const materieFiltrate = useMemo(() => {
    const q = queryMateria.trim().toLowerCase();
    if (!q) return materie;
    return materie.filter((m) => m.nome.toLowerCase().includes(q));
  }, [queryMateria]);

  const provinceFiltrate = useMemo(() => {
    const q = queryProvincia.trim().toLowerCase();
    if (!q) return provinceSorted;
    return provinceSorted.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.codice.toLowerCase().includes(q),
    );
  }, [queryProvincia, provinceSorted]);

  const classiFiltrate = useMemo(() => {
    let list = classiConcorso;
    if (materiaFilter) list = list.filter((c) => c.materie.includes(materiaFilter));
    if (queryClasse.trim()) {
      const q = queryClasse.toLowerCase();
      // Normalizza "LM-85"/"LM85" → "lm85" per il match sugli alias di laurea.
      const qAlias = q.replace(/[\s-]/g, '');
      const classiDaAlias = ALIAS_LAUREA_CLASSI[qAlias] ?? [];
      list = list.filter(
        (c) =>
          c.codice.toLowerCase().includes(q) ||
          c.denominazione.toLowerCase().includes(q) ||
          classiDaAlias.includes(c.codice),
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
    if (provinceCodici.includes(codice)) {
      setProvinceCodici((prev) => prev.filter((c) => c !== codice));
      setProvinceWarning(false);
      return;
    }
    // Fair use: blocca la 5ª selezione oltre il limite.
    if (provinceCodici.length >= LIMITE_PROVINCE) {
      setProvinceWarning(true);
      return;
    }
    setProvinceCodici((prev) => [...prev, codice]);
    setProvinceWarning(false);
  };

  const canNext = () => {
    if (step === 1) return ordini.length > 0;
    if (step === 2) return classiCodici.length > 0 || materieId.length > 0 || materieCustom.length > 0;
    if (step === 3) return provinceCodici.length > 0;
    if (step === 4) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNotifica.trim());
    return false;
  };

  const handleFinish = () => {
    let eta: number | null = null;
    if (etaOnb.trim()) {
      const n = Number.parseInt(etaOnb, 10);
      if (Number.isFinite(n) && n >= 14 && n <= 100) eta = n;
    }
    const preferenzeFinali = {
      genere: genereOnb,
      eta,
      ordini,
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
      telegramUsername: telegramUsername.trim(),
      telegramChatId: preferenze.telegramChatId || '',
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
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-b from-primary-50 to-white">
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
              {/* Anagrafica rapida (facoltativa): personalizza le email (Cara/Caro) e i dati admin */}
              <div className="mb-6 rounded-xl border border-primary-100 bg-primary-50/40 p-4">
                <p className="text-sm font-bold text-primary-800">Qualche dato su di te (facoltativo)</p>
                <p className="mt-0.5 text-xs text-primary-500">
                  Usato per personalizzare le email e per il pannello di gestione. Puoi saltarlo.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-primary-700">Genere</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGenereOnb('F')}
                        aria-pressed={genereOnb === 'F'}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          genereOnb === 'F'
                            ? 'border-accent-400 bg-accent-50 text-accent-700'
                            : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        Donna
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenereOnb('M')}
                        aria-pressed={genereOnb === 'M'}
                        className={`rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                          genereOnb === 'M'
                            ? 'border-accent-400 bg-accent-50 text-accent-700'
                            : 'border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                        }`}
                      >
                        Uomo
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-primary-700">Età (anni)</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={14}
                      max={100}
                      value={etaOnb}
                      onChange={(e) => setEtaOnb(e.target.value)}
                      className="input"
                      placeholder="Es. 34"
                    />
                  </div>
                </div>
              </div>
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

              {/* Ricerca + contatore fair use */}
              <div className="mt-4 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary-400" />
                  <input
                    type="text"
                    value={queryProvincia}
                    onChange={(e) => setQueryProvincia(e.target.value)}
                    placeholder="Cerca provincia (nome o sigla)…"
                    className="w-full rounded-xl border border-primary-200 bg-white py-2.5 pl-10 pr-4 text-sm text-primary-800"
                  />
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    provinceCodici.length >= LIMITE_PROVINCE
                      ? 'bg-secondary-100 text-secondary-700'
                      : 'bg-primary-50 text-primary-600'
                  }`}
                >
                  {provinceCodici.length}/{LIMITE_PROVINCE} province
                </span>
              </div>

              {(provinceWarning || provinceCodici.length >= LIMITE_PROVINCE) && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-secondary-200 bg-secondary-50 px-4 py-3 text-sm text-secondary-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  Puoi selezionare fino a {LIMITE_PROVINCE} province col tuo piano attuale.
                </div>
              )}

              <div className="mt-3 max-h-80 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
                {provinceFiltrate.length === 0 ? (
                  <p className="p-4 text-center text-sm text-primary-400">Nessuna provincia trovata.</p>
                ) : (
                  provinceFiltrate.map((p) => {
                    const selected = provinceCodici.includes(p.codice);
                    const atLimit = provinceCodici.length >= LIMITE_PROVINCE && !selected;
                    return (
                      <label
                        key={p.codice}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-primary-50 ${
                          selected ? 'bg-primary-50' : atLimit ? 'opacity-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          disabled={atLimit}
                          onChange={() => toggleProvincia(p.codice)}
                          className="h-4 w-4 rounded border-primary-300 text-primary-500"
                        />
                        <MapPin className="h-4 w-4 text-primary-400" />
                        <span className="text-sm text-primary-800">{p.nome}</span>
                        <span className="ml-auto text-xs text-primary-400">{p.codice}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-primary-800">Canali di notifica</h2>
              <p className="mt-1 text-sm text-primary-600">
                Ricevi gli avvisi direttamente su Telegram e via email.
              </p>

              <div className="mt-6 space-y-5">
                {/* Collegamento Telegram via deeplink ?start=<user_id> */}
                <div className="rounded-xl border border-primary-100 bg-primary-50 p-4">
                  <p className="text-sm font-semibold text-primary-800">Collega Telegram</p>
                  <p className="mt-1 text-xs leading-relaxed text-primary-600">
                    Premi il pulsante qui sotto: si aprirà il bot{' '}
                    <strong>@ScuoleRadar_bot</strong> con il tuo account già riconosciuto.
                    Nel bot premi <strong>Start</strong>: il collegamento avviene automaticamente
                    e riceverai le notifiche in tempo reale.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={telegramDeepLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
                    >
                      <Send className="h-4 w-4" />
                      Collega Telegram
                    </a>
                    {telegramCollegato && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
                        <Check className="h-3.5 w-3.5" /> Telegram collegato
                      </span>
                    )}
                  </div>
                  {!telegramCollegato && (
                    <p className="mt-2 text-xs text-primary-400">
                      Puoi completare il collegamento anche più tardi dalla pagina Profilo.
                    </p>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
                    <Send className="h-4 w-4 text-primary-500" />
                    Username Telegram (opzionale)
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

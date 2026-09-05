/**
 * Preferenze Radar — tutte le impostazioni e i filtri del profilo, spostati
 * sotto Radar Scuole (bacheca unificata). Include: Ordini e Tipologie di Scuola,
 * Classi di Concorso, Materie e Competenze, Province ("Dove vuoi cercare?"), Filtri
 * Avanzati Scuole, Canali di Notifica e Telegram.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby, Ban, BookOpen, Briefcase, Check, GraduationCap, Loader2, Mail, MapPin, Moon,
  Plus, School, Search, Send, Star, Users, Wrench,
} from 'lucide-react';
import { useApp, type Preferenze } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { interpelli } from '@/data/interpelli';
import { classiConcorso } from '@/data/classiConcorso';
import { materie, ordiniScuola, type OrdineScuola } from '@/data/ordiniMaterie';
import { province } from '@/data/province';
import { Pill } from '@/components/Pill';
import { Accordion } from '@/components/Accordion';
import { pianoLimits, limitaSelezione } from '@/lib/planLimits';

const ordineIcons: Record<OrdineScuola, React.ReactNode> = {
  infanzia: <Baby className="h-5 w-5" />,
  primaria: <School className="h-5 w-5" />,
  secondaria1: <BookOpen className="h-5 w-5" />,
  secondaria2: <GraduationCap className="h-5 w-5" />,
  cpia: <Users className="h-5 w-5" />,
  serali: <Moon className="h-5 w-5" />,
  pon: <Briefcase className="h-5 w-5" />,
  ata: <Wrench className="h-5 w-5" />,
};

export function PreferenzeRadar() {
  const { preferenze, setPreferenze, salvaProfilo, piano, hasProAccess, pianoStato } = useApp();

  // Limiti del piano corrente (Base: 1 provincia / 2 classi · PRO: 4/4).
  const limitiPiano = pianoLimits(piano, hasProAccess);
  const maxProvince = limitiPiano.maxProvince;
  const maxClassiConcorso = limitiPiano.maxClassiConcorso;

  const [ordini, setOrdini] = useState<OrdineScuola[]>(preferenze.ordini);
  const [classiCodici, setClassiCodici] = useState<string[]>(preferenze.classiCodici);
  const [materieId, setMaterieId] = useState<string[]>(preferenze.materieId);
  const [materieCustom, setMaterieCustom] = useState<string[]>(preferenze.materieCustom);
  const [provinceCodici, setProvinceCodici] = useState<string[]>(preferenze.provinceCodici);
  const [telegramUsername, setTelegramUsername] = useState(preferenze.telegramUsername);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState(preferenze.telegramChatId ?? '');

  // Deeplink Telegram: https://t.me/ScuoleRadar_bot?start=<user_id> (collega l'account)
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
  const [emailNotifica, setEmailNotifica] = useState(preferenze.emailNotifica);
  const [favoriteSchools, setFavoriteSchools] = useState<string[]>(preferenze.favoriteSchools);
  const [ignoredSchools, setIgnoredSchools] = useState<string[]>(preferenze.ignoredSchools);
  const [favoriteScuolaInput, setFavoriteScuolaInput] = useState('');
  const [ignoredScuolaInput, setIgnoredScuolaInput] = useState('');

  const [queryClasse, setQueryClasse] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('');
  const [customMateriaInput, setCustomMateriaInput] = useState('');
  const [statoSalvataggio, setStatoSalvataggio] = useState<'idle' | 'salvataggio' | 'salvato'>('idle');
  const primaEsecuzione = useRef(true);

  // Tutti gli accordion partono CHIUSI: la griglia resta compatta sopra la piega
  // e l'utente apre solo la sezione che gli serve.
  const [accordionAperti, setAccordionAperti] = useState<Record<string, boolean>>({
    ordini: false,
    classi: false,
    materie: false,
    province: false,
    filtri: false,
    canali: false,
  });
  const toggleAccordion = (chiave: string) =>
    setAccordionAperti((prev) => ({ ...prev, [chiave]: !prev[chiave] }));

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);
  const scuoleConosciute = useMemo(
    () => [...new Set(interpelli.map((i) => i.istituto).filter(Boolean))],
    [],
  );
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

  const toggleOrdine = (id: OrdineScuola) =>
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  const toggleClasse = (codice: string) => {
    if (classiCodici.includes(codice)) {
      setClassiCodici((prev) => prev.filter((c) => c !== codice));
      return;
    }
    // Vincolo di piano: Base max 2 classi di concorso · PRO max 4.
    if (classiCodici.length >= maxClassiConcorso) return;
    setClassiCodici((prev) => [...prev, codice]);
  };
  const toggleMateria = (id: string) =>
    setMaterieId((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  const addCustomMateria = () => {
    const val = customMateriaInput.trim();
    if (!val) return;
    if (!materieCustom.some((m) => m.toLowerCase() === val.toLowerCase())) {
      setMaterieCustom((prev) => [...prev, val]);
    }
    setCustomMateriaInput('');
  };
  const removeCustomMateria = (m: string) => setMaterieCustom((prev) => prev.filter((x) => x !== m));
  const toggleProvincia = (codice: string) => {
    if (provinceCodici.includes(codice)) {
      setProvinceCodici((prev) => prev.filter((c) => c !== codice));
      return;
    }
    // Vincolo di piano: Base 1 provincia · PRO fino a 4.
    if (provinceCodici.length >= maxProvince) return;
    setProvinceCodici((prev) => [...prev, codice]);
  };
  const addFavoriteScuola = () => {
    const val = favoriteScuolaInput.trim();
    if (!val) return;
    if (!favoriteSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setFavoriteSchools((prev) => [...prev, val]);
    }
    setFavoriteScuolaInput('');
  };
  const removeFavoriteScuola = (s: string) => setFavoriteSchools((prev) => prev.filter((x) => x !== s));
  const addIgnoredScuola = () => {
    const val = ignoredScuolaInput.trim();
    if (!val) return;
    if (!ignoredSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setIgnoredSchools((prev) => [...prev, val]);
    }
    setIgnoredScuolaInput('');
  };
  const removeIgnoredScuola = (s: string) => setIgnoredSchools((prev) => prev.filter((x) => x !== s));

  // Vincoli di piano: se il piano cambia (es. fine del trial PRO → Base) o il profilo
  // arriva con più selezioni del consentito, tronca province e classi al tetto corrente.
  useEffect(() => {
    if (pianoStato !== 'pronto') return;
    setClassiCodici((prev) =>
      prev.length > maxClassiConcorso ? prev.slice(0, maxClassiConcorso) : prev,
    );
    setProvinceCodici((prev) =>
      prev.length > maxProvince ? prev.slice(0, maxProvince) : prev,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- applicato quando cambia il piano
  }, [pianoStato, maxProvince, maxClassiConcorso]);

  // AUTOSAVE con debounce (500ms): ad ogni modifica sincronizza context + Supabase.
  useEffect(() => {
    if (primaEsecuzione.current) {
      primaEsecuzione.current = false;
      return;
    }
    const modifiche: Preferenze = {
      ordini,
      classiCodici: limitaSelezione(classiCodici, maxClassiConcorso),
      materieId,
      materieCustom,
      provinceCodici: limitaSelezione(provinceCodici, maxProvince),
      telegramUsername: telegramUsername.trim(),
      telegramChatId: telegramChatIdInput.trim(),
      emailNotifica: emailNotifica.trim(),
      onboarded: preferenze.onboarded,
      favoriteSchools,
      ignoredSchools,
    };
    setStatoSalvataggio('salvataggio');
    const timeout = setTimeout(() => {
      setPreferenze(modifiche);
      void salvaProfilo(modifiche).then(() => {
        setStatoSalvataggio('salvato');
        setTimeout(() => setStatoSalvataggio('idle'), 2500);
      });
    }, 500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autosave intenzionale
  }, [
    ordini,
    classiCodici,
    materieId,
    materieCustom,
    provinceCodici,
    telegramUsername,
    telegramChatIdInput,
    emailNotifica,
    favoriteSchools,
    ignoredSchools,
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary-800">Le tue preferenze Radar</h2>
        {statoSalvataggio === 'salvataggio' ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-primary-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Salvataggio in corso...
          </span>
        ) : statoSalvataggio === 'salvato' ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent-600">
            <Check className="h-4 w-4 text-accent-500" /> Salvato ✓
          </span>
        ) : null}
      </div>

      {/* Upsell piano unificato nella barra di stato Radar (Dashboard): NESSUN banner duplicato qui */}

      {/* Accordion preferenze — griglia responsive a 2 colonne (desktop) */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
      {/* Ordini e Tipologie di Scuola — accordion */}
      <Accordion
        icona="📂"
        titolo="Dove vuoi insegnare o lavorare?"
        badge={ordini.length ? `${ordini.length} selezionati` : undefined}
        aperto={!!accordionAperti.ordini}
        onToggle={() => toggleAccordion('ordini')}
      >
        <p className="text-xs text-primary-500">
          Scegli gli ordini di scuola in cui vuoi insegnare o lavorare: il Radar cercherà in tutti
          quelli selezionati.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {ordiniScuola.map((o) => {
            const selected = ordini.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => toggleOrdine(o.id)}
                className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${
                  selected
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-primary-200 hover:border-primary-300'
                }`}
              >
                <span className="text-primary-600">{ordineIcons[o.id]}</span>
                <span className="flex-1 font-medium text-primary-800">{o.nome}</span>
                {selected && <Check className="h-4 w-4 text-primary-600" />}
              </button>
            );
          })}
        </div>
      </Accordion>

      {/* Classi di Concorso — accordion */}
      <Accordion
        icona="🎓"
        titolo="Per quali insegnamenti sei abilitato o qualificato?"
        badge={classiCodici.length ? `${classiCodici.length} selezionate` : undefined}
        aperto={!!accordionAperti.classi}
        onToggle={() => toggleAccordion('classi')}
      >
        <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
          {limitiPiano.piano === 'pro'
            ? 'PRO: puoi selezionare fino a 4 classi di concorso.'
            : `Piano Base: ${maxClassiConcorso} classi di concorso incluse. Passa a PRO per arrivare a 4.`}
        </p>
        {classiCodici.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {classiCodici.map((c) => (
              <Pill key={c} label={c} onRemove={() => toggleClasse(c)} color="accent" />
            ))}
          </div>
        )}

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
            const selected = classiCodici.includes(c.codice);
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

      {/* Materie e Competenze — accordion */}
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
          Seleziona le competenze per intercettare bandi PNRR, progetti, corsi e laboratori.
        </p>

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

        {/* Custom materie */}
        <h4 className="mt-5 text-sm font-bold text-primary-700">
          Cerchi competenze particolari? Aggiungile qui.
        </h4>
        {materieCustom.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {materieCustom.map((m) => (
              <Pill key={m} label={m} onRemove={() => removeCustomMateria(m)} color="secondary" />
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
            placeholder="Es. Robotica educativa, Dizione…"
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

      {/* Province — "Dove vuoi cercare?" — accordion */}
      <Accordion
        icona="📍"
        titolo="Dove vuoi cercare?"
        badge={provinceCodici.length ? `${provinceCodici.length} selezionate` : undefined}
        aperto={!!accordionAperti.province}
        onToggle={() => toggleAccordion('province')}
      >
        <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
          {limitiPiano.piano === 'pro'
            ? 'PRO: puoi monitorare fino a 4 province.'
            : `Piano Base: ${maxProvince} provincia monitorabile. Passa a PRO per arrivare a 4.`}
        </p>
        <p className="mb-3 text-xs text-primary-500">
          Scegli dove vuoi cercare. Il Radar elimina la necessità di controllare manualmente decine
          di siti provinciali.
        </p>
        {provinceCodici.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
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

        <div className="mt-4 max-h-64 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
          {provinceSorted.map((p) => {
            const selected = provinceCodici.includes(p.codice);
            const atLimit = provinceCodici.length >= maxProvince && !selected;
            return (
              <label
                key={p.codice}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-primary-50 ${
                  selected ? 'bg-primary-50' : atLimit ? 'cursor-not-allowed opacity-50 hover:bg-transparent' : ''
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
          })}
        </div>
      </Accordion>

      {/* Filtri Avanzati Scuole — accordion */}
      <Accordion
        icona="🏫"
        titolo="Filtri Avanzati Scuole"
        badge={
          favoriteSchools.length + ignoredSchools.length
            ? `${favoriteSchools.length + ignoredSchools.length} scuole`
            : undefined
        }
        aperto={!!accordionAperti.filtri}
        onToggle={() => toggleAccordion('filtri')}
      >
        <p className="text-sm text-primary-500">
          Tieni d&apos;occhio le scuole che ti interessano (priorità) e nascondi quelle che non vuoi
          più vedere.
        </p>

        <datalist id="scuole-conosciute">
          {scuoleConosciute.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>

        <div className="mt-4 space-y-4">
          {/* Preferite (whitelist) */}
          <div className="rounded-xl border border-accent-200 bg-accent-50/50 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-accent-800">
              <Star className="h-4 w-4 text-accent-500" />
              Scuole preferite (Notifiche Prioritarie)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-accent-700">
              Hai una scuola che vuoi tenere d&apos;occhio? Aggiungila per ricevere le sue pubblicazioni
              anche se non c&apos;è un match perfetto col profilo.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={favoriteScuolaInput}
                onChange={(e) => setFavoriteScuolaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addFavoriteScuola()}
                placeholder="Es. Media Jona Asti, ITIS Artom Asti"
                list="scuole-conosciute"
                className="input"
              />
              <button
                onClick={addFavoriteScuola}
                disabled={!favoriteScuolaInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </button>
            </div>
            {favoriteSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {favoriteSchools.map((s) => (
                  <Pill key={s} label={s} onRemove={() => removeFavoriteScuola(s)} color="accent" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-primary-400">Nessuna scuola preferita.</p>
            )}
          </div>

          {/* Escluse (blacklist) */}
          <div className="rounded-xl border border-secondary-200 bg-secondary-50/50 p-4">
            <h4 className="flex items-center gap-1.5 text-sm font-semibold text-secondary-800">
              <Ban className="h-4 w-4 text-secondary-500" />
              Scuole escluse (Blacklist)
            </h4>
            <p className="mt-2 text-xs leading-relaxed text-secondary-700">
              C&apos;è una scuola che non vuoi più vedere? Mettila in blacklist: smetteremo di segnalartela.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={ignoredScuolaInput}
                onChange={(e) => setIgnoredScuolaInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addIgnoredScuola()}
                placeholder="Es. IC Castell'Alfero, IC Incisa Scapaccino"
                list="scuole-conosciute"
                className="input"
              />
              <button
                onClick={addIgnoredScuola}
                disabled={!ignoredScuolaInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Aggiungi
              </button>
            </div>
            {ignoredSchools.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {ignoredSchools.map((s) => (
                  <Pill key={s} label={s} onRemove={() => removeIgnoredScuola(s)} color="secondary" />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs text-primary-400">Nessuna scuola esclusa.</p>
            )}
          </div>
        </div>
      </Accordion>

      {/* Canali di Notifica e Telegram — accordion */}
      <Accordion
        icona="🔔"
        titolo="Canali di Notifica e Telegram"
        badge={
          [telegramUsername, telegramChatIdInput, emailNotifica].some(Boolean)
            ? 'configurati'
            : undefined
        }
        aperto={!!accordionAperti.canali}
        onToggle={() => toggleAccordion('canali')}
      >
        <p className="text-sm text-primary-500">
          Configura i canali su cui ricevere gli avvisi dei nuovi interpelli in tempo reale.
        </p>
        <p className="mt-2 rounded-xl bg-primary-50 px-3 py-2 text-xs text-primary-600">
          Piano PRO (mese di prova): notifiche e segnalazioni illimitate.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
              <Send className="h-4 w-4 text-primary-500" />
              Username Telegram
            </span>
            <input
              type="text"
              value={telegramUsername}
              onChange={(e) => setTelegramUsername(e.target.value)}
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

        <div className="mt-5 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-700">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary-500">
            Collega Telegram
          </p>
          {preferenze.telegramChatId ? (
            <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-xs font-semibold text-accent-700">
              <Check className="h-3.5 w-3.5" /> Telegram collegato
            </p>
          ) : null}
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Premi <strong>Collega Telegram</strong>: si aprirà il bot{' '}
              <a
                href="https://t.me/ScuoleRadar_bot"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-primary-700 underline"
              >
                @ScuoleRadar_bot
              </a>{' '}
              con il tuo account già riconosciuto.
            </li>
            <li>
              Nel bot premi <strong>Start</strong> (o invia il comando <code>/start</code>): il
              collegamento avviene automaticamente.
            </li>
            <li>
              Riceverai il messaggio di conferma e, da quel momento, le notifiche dei nuovi
              interpelli.
            </li>
          </ol>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={telegramChatIdInput}
              onChange={(e) => setTelegramChatIdInput(e.target.value)}
              placeholder="Chat ID (solo se preferisci il collegamento manuale)"
              className="input"
            />
            <a
              href={telegramDeepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Send className="h-4 w-4" />
              Collega Telegram
            </a>
          </div>
        </div>
        <p className="mt-3 text-xs text-primary-400">
          Con il pulsante "Collega Telegram" il tuo Chat ID viene salvato automaticamente nel profilo
          e usato per inviarti le notifiche Telegram.
        </p>
      </Accordion>
      </div>
    </div>
  );
}


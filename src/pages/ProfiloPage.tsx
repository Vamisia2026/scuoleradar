import { useMemo, useEffect, useState, type ReactNode } from 'react';
import {
  Save, Check, MapPin, Send, Mail, Search, GraduationCap, School, BookOpen, Baby, Users, Moon, Briefcase, Wrench, Plus,
  Star, Ban, Download, Trash2, FileText, Sparkles, ChevronDown,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/lib/supabase';
import { interpelli } from '@/data/interpelli';
import {
  conAggiuntaInCima,
  STORAGE_KEY_MODULI_SCARICATI,
  type ModuloScaricato,
} from '@/data/moduli';
import { ordiniScuola, materie, type OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { Pill } from '@/components/Pill';

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

/** Card collassabile del Profilo: riduce lo scroll raggruppando le impostazioni. */
function Accordion({
  icona,
  titolo,
  badge,
  aperto,
  onToggle,
  children,
}: {
  icona: ReactNode;
  titolo: string;
  badge?: string;
  aperto: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card">
      <button
        onClick={onToggle}
        aria-expanded={aperto}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left transition hover:bg-primary-50/50"
      >
        <span className="text-lg leading-none">{icona}</span>
        <h3 className="flex-1 text-sm font-bold text-primary-800">{titolo}</h3>
        {badge ? (
          <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-semibold text-primary-600">
            {badge}
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-primary-400 transition-transform ${aperto ? 'rotate-180' : ''}`}
        />
      </button>
      {aperto && <div className="border-t border-primary-100 px-5 py-4">{children}</div>}
    </section>
  );
}

export function ProfiloPage() {
  const { preferenze, setPreferenze, salvaProfilo, crediti, avviaCheckout } = useApp();

  const [ordini, setOrdini] = useState<OrdineScuola[]>(preferenze.ordini);
  const [classiCodici, setClassiCodici] = useState<string[]>(preferenze.classiCodici);
  const [materieId, setMaterieId] = useState<string[]>(preferenze.materieId);
  const [materieCustom, setMaterieCustom] = useState<string[]>(preferenze.materieCustom);
  const [provinceCodici, setProvinceCodici] = useState<string[]>(preferenze.provinceCodici);
  const [telegramUsername, setTelegramUsername] = useState(preferenze.telegramUsername);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState(preferenze.telegramChatId ?? '');

  // Deeplink Telegram: https://t.me/ScuoleRadar_bot?start=<user_id> (collega automaticamente l'account)
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
  const [salvato, setSalvato] = useState(false);

  // Sezioni collassabili del Profilo (accordion) per eliminare lo scroll infinito
  const [accordionAperti, setAccordionAperti] = useState<Record<string, boolean>>({});
  const toggleAccordion = (chiave: string) =>
    setAccordionAperti((prev) => ({ ...prev, [chiave]: !prev[chiave] }));

  // Storico dei modelli scaricati (condiviso con la pagina Moduli via localStorage)
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  // Scuole note dai dati disponibili: suggerimenti per i Filtri Avanzati Scuole.
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

  const toggleClasse = (codice: string) =>
    setClassiCodici((prev) => (prev.includes(codice) ? prev.filter((c) => c !== codice) : [...prev, codice]));

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

  const removeCustomMateria = (m: string) =>
    setMaterieCustom((prev) => prev.filter((x) => x !== m));

  const toggleProvincia = (codice: string) =>
    setProvinceCodici((prev) => (prev.includes(codice) ? prev.filter((c) => c !== codice) : [...prev, codice]));

  const addFavoriteScuola = () => {
    const val = favoriteScuolaInput.trim();
    if (!val) return;
    if (!favoriteSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setFavoriteSchools((prev) => [...prev, val]);
    }
    setFavoriteScuolaInput('');
  };

  const removeFavoriteScuola = (s: string) =>
    setFavoriteSchools((prev) => prev.filter((x) => x !== s));

  const addIgnoredScuola = () => {
    const val = ignoredScuolaInput.trim();
    if (!val) return;
    if (!ignoredSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setIgnoredSchools((prev) => [...prev, val]);
    }
    setIgnoredScuolaInput('');
  };

  const removeIgnoredScuola = (s: string) =>
    setIgnoredSchools((prev) => prev.filter((x) => x !== s));

  const handleSalva = () => {
    const modifiche = {
      ordini,
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
      telegramUsername: telegramUsername.trim(),
      telegramChatId: telegramChatIdInput.trim(),
      emailNotifica: emailNotifica.trim(),
      favoriteSchools,
      ignoredSchools,
    };
    setPreferenze(modifiche);
    // PASSO 3: persiste province e classi di concorso su Supabase (tabella profiles)
    void salvaProfilo({ ...modifiche, onboarded: preferenze.onboarded });
    setSalvato(true);
    setTimeout(() => setSalvato(false), 3000);
  };

  const formatDataScaricato = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const riscaricaModulo = (m: ModuloScaricato) => {
    setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
    alert(`Download simulato di "${m.nome}" (${m.tipo}).`);
  };

  const rimuoviModulo = (id: string) =>
    setModuliScaricati(moduliScaricati.filter((m) => m.id !== id));

  const svuotaStorico = () => setModuliScaricati([]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-primary-800">Il mio profilo</h2>
        <button
          onClick={handleSalva}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
        >
          {salvato ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {salvato ? 'Salvato' : 'Salva modifiche'}
        </button>
      </div>

      {/* Ordini e Tipologie di Scuola — accordion */}
      <Accordion
        icona="📂"
        titolo="Ordini e Tipologie di Scuola"
        badge={ordini.length ? `${ordini.length} selezionati` : undefined}
        aperto={!!accordionAperti.ordini}
        onToggle={() => toggleAccordion('ordini')}
      >
        <p className="text-xs text-primary-500">Puoi selezionare più opzioni.</p>
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
        titolo="Classi di Concorso"
        badge={classiCodici.length ? `${classiCodici.length} selezionate` : undefined}
        aperto={!!accordionAperti.classi}
        onToggle={() => toggleAccordion('classi')}
      >

        {classiCodici.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {classiCodici.map((c) => (
              <Pill key={c} label={c} onRemove={() => toggleClasse(c)} color="accent" />
            ))}
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <select
            value={materiaFilter}
            onChange={(e) => setMateriaFilter(e.target.value)}
            className="input"
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
              onChange={(e) => setQueryClasse(e.target.value)}
              placeholder="Cerca classe (es. A-12)"
              className="input pl-10"
            />
          </div>
        </div>

        <div className="mt-3 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-primary-100 p-2">
          {classiFiltrate.map((c) => {
            const selected = classiCodici.includes(c.codice);
            return (
              <button
                key={c.codice}
                onClick={() => toggleClasse(c.codice)}
                className={`flex w-full items-center justify-between gap-2 rounded-lg p-2.5 text-left text-sm transition ${
                  selected ? 'bg-accent-50 text-accent-800' : 'hover:bg-primary-50 text-primary-700'
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
        titolo="Materie e Competenze"
        badge={
          materieId.length + materieCustom.length
            ? `${materieId.length + materieCustom.length} selezionate`
            : undefined
        }
        aperto={!!accordionAperti.materie}
        onToggle={() => toggleAccordion('materie')}
      >
        <p className="mt-1 text-xs text-primary-500">
          Seleziona le materie in cui sei competente, anche non collegate a una classe specifica.
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
        <h4 className="mt-5 text-sm font-bold text-primary-700">Materie personalizzate</h4>
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

      {/* Province di Interesse — accordion */}
      <Accordion
        icona="📍"
        titolo="Province di Interesse"
        badge={provinceCodici.length ? `${provinceCodici.length} selezionate` : undefined}
        aperto={!!accordionAperti.province}
        onToggle={() => toggleAccordion('province')}
      >

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
          Le scuole preferite ricevono notifiche prioritarie e un badge dedicato; quelle escluse
          vengono nascoste dalla dashboard.
        </p>

        {/* Suggerimenti per la ricerca di Istituti (struttura pronta per il catalogo scuole) */}
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
              Scuole escluse (Nascondi Avvisi)
            </h4>
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

      {/* Sblocchi A la Carte (FASE 6) */}
      <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
            <Sparkles className="h-4 w-4 text-secondary-500" />
            Sblocchi A la Carte
          </h3>
          <span className="rounded-full bg-secondary-50 px-3 py-1 text-sm font-bold text-secondary-700">
            {crediti} disponibili
          </span>
        </div>
        <p className="mt-1 text-sm text-primary-600">
          Usa gli sblocchi per i servizi singoli (CV, Check CFU, modelli) oppure acquistane di nuovi
          quando ti servono. Nessun abbonamento automatico.
        </p>
        <button
          onClick={() => void avviaCheckout('alacarte')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-secondary-600"
        >
          <Sparkles className="h-4 w-4" />
          Acquista uno sblocco (5€)
        </button>
      </section>

      {/* Modelli scaricati di recente */}
      <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
            <FileText className="h-4 w-4 text-primary-500" />
            Modelli Scaricati di Recente
          </h3>
          {moduliScaricati.length > 0 && (
            <button
              onClick={svuotaStorico}
              className="text-xs font-medium text-primary-400 transition hover:text-error-600"
            >
              Svuota storico
            </button>
          )}
        </div>

        {moduliScaricati.length === 0 ? (
          <p className="mt-4 text-sm text-primary-400">
            Non hai ancora scaricato modelli. Visita la sezione <strong>Moduli</strong> per trovare
            documenti e template pronti all&apos;uso.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {moduliScaricati.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-primary-800">{m.nome}</p>
                  <p className="text-xs text-primary-400">
                    {m.tipo} · scaricato il {formatDataScaricato(m.scaricatoIl)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => riscaricaModulo(m)}
                    aria-label={`Scarica di nuovo ${m.nome}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Scarica
                  </button>
                  <button
                    onClick={() => rimuoviModulo(m.id)}
                    aria-label={`Rimuovi ${m.nome} dallo storico`}
                    className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

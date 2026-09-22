/**
 * Preferenze Radar — tutte le impostazioni e i filtri del profilo, spostati
 * sotto Radar Scuole (bacheca unificata). Include: Ordini e Tipologie di Scuola,
 * Classi di Concorso, Materie e Competenze, Province ("Dove vuoi cercare?"), Filtri
 * Avanzati Scuole, Canali di Notifica e Telegram.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useApp, type Preferenze } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { classiConcorso } from '@/data/classiConcorso';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { province } from '@/data/province';
import { pianoLimits, limitaSelezione } from '@/lib/planLimits';
import { normalizzaClasse, normalizzaClassi } from '@/lib/matchingEngine';
import { PannelloCanali } from './preferenze/PannelloCanali';
import { PannelloClassi } from './preferenze/PannelloClassi';
import { PannelloFiltriScuole } from './preferenze/PannelloFiltriScuole';
import { PannelloMaterie } from './preferenze/PannelloMaterie';
import { PannelloOrdini } from './preferenze/PannelloOrdini';
import { PannelloProvince } from './preferenze/PannelloProvince';

export function PreferenzeRadar() {
  const { preferenze, setPreferenze, salvaProfilo, piano, hasProAccess, pianoStato, interpelliFiltrati } =
    useApp();

  // Limiti del piano corrente (Base: 1 provincia / 2 classi · PRO: 4/4).
  // Piano non ancora confermato dal DB → tetti PRO: nessun troncamento mentre la
  // lettura è in corso (il piano "regalato" dal backend non deve tagliare nulla).
  const limitiPiano = pianoLimits(piano, hasProAccess, pianoStato === 'pronto');
  const maxProvince = limitiPiano.maxProvince;
  const maxClassiConcorso = limitiPiano.maxClassiConcorso;

  const [ordini, setOrdini] = useState<OrdineScuola[]>(preferenze.ordini);
  // Classi SEMPRE nel formato canonico del catalogo (`A-22`): una classe salvata
  // come `A-022`/`A042` resta selezionata anche dopo un ricaricamento.
  const [classiCodici, setClassiCodici] = useState<string[]>(
    normalizzaClassi(preferenze.classiCodici),
  );
  const [materieId, setMaterieId] = useState<string[]>(preferenze.materieId);
  const [materieCustom, setMaterieCustom] = useState<string[]>(preferenze.materieCustom);
  /** Preferenza SOSTEGNO (profiles.sostegno): avvisi ADAA/ADEE/ADMM/ADSS. */
  const [sostegno, setSostegno] = useState(preferenze.sostegno === true);
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
    // Suggerimenti (datalist) dal feed REALE dell'utente: nessun elenco
    // dimostrativo. Il campo resta comunque a testo libero.
    () => [...new Set(interpelliFiltrati.map((i) => i.istituto).filter(Boolean))],
    [interpelliFiltrati],
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

  /** Etichetta compatta di una classe di concorso per i chip "pinned". */
  const labelClasse = (codice: string): string => {
    const canonico = normalizzaClasse(codice);
    const d = classiConcorso.find((c) => c.codice === canonico)?.denominazione ?? '';
    return d ? `${canonico} · ${d.length > 44 ? `${d.slice(0, 42)}…` : d}` : canonico;
  };

  const toggleOrdine = (id: OrdineScuola) =>
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  /**
   * Selezione/deselezione di una classe di concorso. Il confronto avviene SEMPRE
   * su codici normalizzati (`A-18` ≡ `A18` ≡ `a 18`): la casella non può restare
   * "spenta" per un formato diverso da quello del catalogo, né duplicarsi.
   */
  const toggleClasse = (codice: string) => {
    const canonico = normalizzaClasse(codice);
    if (!canonico) return;
    const attuale = normalizzaClassi(classiCodici);
    if (attuale.includes(canonico)) {
      setClassiCodici(attuale.filter((c) => c !== canonico));
      return;
    }
    // Vincolo di piano: Base max 2 classi di concorso · PRO max 4.
    if (attuale.length >= maxClassiConcorso) return;
    setClassiCodici([...attuale, canonico]);
  };
  const toggleMateria = (id: string) =>
    setMaterieId((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  /**
   * Aggiunge al volo una COMPETENZA SUGGERITA (aree ad alta richiesta PNRR/PON):
   * è il “precompilato” della sezione competenze — un click e l'utente ha già un
   * profilo appetibile per i bandi per esperti, senza scrivere nulla.
   */
  const aggiungiCompetenzaSuggerita = (materiaId: string) =>
    setMaterieId((prev) => (prev.includes(materiaId) ? prev : [...prev, materiaId]));
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
      // Preferenza SOSTEGNO: autosalvata come tutte le altre (profiles.sostegno).
      sostegno,
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
    sostegno,
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
      <PannelloOrdini
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        ordini={ordini}
        toggleOrdine={toggleOrdine}
      />

      {/* Classi di Concorso — accordion */}
      <PannelloClassi
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        classiCodici={classiCodici}
        classiFiltrate={classiFiltrate}
        labelClasse={labelClasse}
        materiaFilter={materiaFilter}
        setMateriaFilter={setMateriaFilter}
        queryClasse={queryClasse}
        setQueryClasse={setQueryClasse}
        maxClassiConcorso={maxClassiConcorso}
        toggleClasse={toggleClasse}
        sostegno={sostegno}
        setSostegno={setSostegno}
        limitiPiano={limitiPiano}
      />

      {/* Materie e Competenze — accordion */}
      <PannelloMaterie
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        materieId={materieId}
        materieCustom={materieCustom}
        customMateriaInput={customMateriaInput}
        setCustomMateriaInput={setCustomMateriaInput}
        addCustomMateria={addCustomMateria}
        removeCustomMateria={removeCustomMateria}
        toggleMateria={toggleMateria}
        aggiungiCompetenzaSuggerita={aggiungiCompetenzaSuggerita}
      />

      {/* Province — dove vuoi cercare — accordion */}
      <PannelloProvince
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        provinceCodici={provinceCodici}
        provinceSorted={provinceSorted}
        toggleProvincia={toggleProvincia}
        maxProvince={maxProvince}
        limitiPiano={limitiPiano}
      />

      {/* Filtri Avanzati Scuole — accordion */}
      <PannelloFiltriScuole
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        favoriteSchools={favoriteSchools}
        favoriteScuolaInput={favoriteScuolaInput}
        setFavoriteScuolaInput={setFavoriteScuolaInput}
        addFavoriteScuola={addFavoriteScuola}
        removeFavoriteScuola={removeFavoriteScuola}
        ignoredSchools={ignoredSchools}
        ignoredScuolaInput={ignoredScuolaInput}
        setIgnoredScuolaInput={setIgnoredScuolaInput}
        addIgnoredScuola={addIgnoredScuola}
        removeIgnoredScuola={removeIgnoredScuola}
        scuoleConosciute={scuoleConosciute}
      />

      {/* Canali di Notifica e Telegram — accordion */}
      <PannelloCanali
        accordionAperti={accordionAperti}
        toggleAccordion={toggleAccordion}
        preferenze={preferenze}
        telegramDeepLink={telegramDeepLink}
        telegramUsername={telegramUsername}
        setTelegramUsername={setTelegramUsername}
        telegramChatIdInput={telegramChatIdInput}
        setTelegramChatIdInput={setTelegramChatIdInput}
        emailNotifica={emailNotifica}
        setEmailNotifica={setEmailNotifica}
      />
      </div>
    </div>
  );
}


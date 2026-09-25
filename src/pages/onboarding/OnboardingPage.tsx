import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Baby, School, BookOpen, GraduationCap, Users, Moon, Briefcase, Wrench } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { materie, type OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { separaParoleChiave } from '@/lib/ricercaSelezioniRadar';
import { NavigazioneOnboarding } from './components/NavigazioneOnboarding';
import { PassoAnagraficaOrdini } from './components/PassoAnagraficaOrdini';
import { PassoCanali } from './components/PassoCanali';
import { PassoClassiMaterie } from './components/PassoClassiMaterie';
import { PassoProvince } from './components/PassoProvince';

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
  // Feature flags: a fine onboarding si va al primo dipartimento disponibile.
  const { primaRottaVisibile } = useFeatureFlags();
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

  /**
   * Aggiunge le materie/competenze personalizzate scritte nel campo libero.
   * Più voci separate da virgola («Educazione motoria, Dizione, Robotica educativa»)
   * diventano tag INDIPENDENTI: mai un'unica stringa incollata.
   */
  const addCustomMateria = () => {
    const nuove = separaParoleChiave(customMateriaInput).filter(
      (voce) => !materieCustom.some((m) => m.toLowerCase() === voce.toLowerCase()),
    );
    if (nuove.length === 0) {
      setCustomMateriaInput('');
      return;
    }
    setMaterieCustom((prev) => [...prev, ...nuove]);
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
    navigate(primaRottaVisibile());
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
            <PassoAnagraficaOrdini
              genereOnb={genereOnb}
              setGenereOnb={setGenereOnb}
              etaOnb={etaOnb}
              setEtaOnb={setEtaOnb}
              ordini={ordini}
              toggleOrdine={toggleOrdine}
              ordineIcons={ordineIcons}
            />
          )}
          {step === 2 && (
            <PassoClassiMaterie
              classi={{ classiCodici, classiFiltrate, queryClasse, setQueryClasse, toggleClasse }}
              materieScelte={{
                materieId, materieCustom, materieFiltrate, materiaFilter, setMateriaFilter, queryMateria,
                setQueryMateria, customMateriaInput, setCustomMateriaInput, addCustomMateria,
                removeCustomMateria, toggleMateria,
              }}
            />
          )}
          {step === 3 && (
            <PassoProvince
              LIMITE_PROVINCE={LIMITE_PROVINCE}
              provinceCodici={provinceCodici}
              provinceFiltrate={provinceFiltrate}
              provinceWarning={provinceWarning}
              queryProvincia={queryProvincia}
              setQueryProvincia={setQueryProvincia}
              toggleProvincia={toggleProvincia}
            />
          )}
          {step === 4 && (
            <PassoCanali
              telegramCollegato={telegramCollegato}
              telegramDeepLink={telegramDeepLink}
              telegramUsername={telegramUsername}
              setTelegramUsername={setTelegramUsername}
              emailNotifica={emailNotifica}
              setEmailNotifica={setEmailNotifica}
            />
          )}
          {/* Navigation */}
          <NavigazioneOnboarding
            step={step}
            totalSteps={totalSteps}
            setStep={setStep}
            canNext={canNext}
            handleFinish={handleFinish}
          />
        </div>
      </div>
    </div>
  );
}

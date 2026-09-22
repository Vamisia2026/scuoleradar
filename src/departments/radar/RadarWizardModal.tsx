import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar, ArrowRight, ArrowLeft, AlertCircle, PartyPopper, Loader2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useApp, STORAGE_KEY_RADAR_WIZARD_PENDING, type Preferenze } from '@/contexts/AppContext';
import { track } from '@/lib/analytics';
import {
  aggiornaBozzaRegistrazione,
  leggiBozzaRegistrazione,
  salvaBozzaRegistrazione,
  svuotaBozzaRegistrazione,
  type BozzaRegistrazione,
} from '@/lib/bozzaRegistrazione';
import type { DatiAnagrafica } from '@/components/BloccoAnagrafica';
import { supabase } from '@/lib/supabase';
import { materieCompetenzeExtra, type OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { pianoLimits, limitaSelezione } from '@/lib/planLimits';
import { normalizzaClasse, normalizzaClassi } from '@/lib/matchingEngine';
import {
  STORAGE_KEY_RADAR_WIZARD_STEP,
  impostaPassoRadar,
  messaggioCampiMancanti,
  validaConfigRadar,
} from '@/lib/radarValidation';
import { PassoOrdini } from './wizard/PassoOrdini';
import { PassoProvince } from './wizard/PassoProvince';
import { PassoClassiMaterie } from './wizard/PassoClassiMaterie';
import { PassoNotifica } from './wizard/PassoNotifica';

/** Alias codici di laurea (LM) → classi di concorso correlate, per la ricerca CDC. */
const ALIAS_LAUREA_CLASSI: Record<string, string[]> = {
  lm85: ['A-18'], // Scienze pedagogiche → Filosofia e scienze umane
  lm14: ['A-12'], // Filologia moderna → Discipline letterarie
  lm40: ['A-27'], // Matematica → Matematica e Fisica
  lm37: ['A-22'], // Lingue e letterature moderne → Inglese
};

const TITOLI_STEP = [
  '',
  'Ordini di Scuola & PNRR',
  'Province',
  'Classi di Concorso / Materie',
  'Canali di Notifica',
];

// La chiave del passo wizard è condivisa in `lib/radarValidation.ts`.
// Limiti dinamici per piano (Base 1 provincia / 2 classi · PRO 4/4): vedi lib/planLimits.ts.

/**
 * Wizard "Attiva il tuo Radar" a 4 passi (modal):
 *  1. Ordini di Scuola & PNRR → 2. Province → 3. Classi/Materie → 4. Canali di Notifica.
 * Al termine salva le preferenze, attiva i canali di notifica (email/Telegram) e
 * mostra un modal di completamento.
 */
export function RadarWizardModal() {
  const navigate = useNavigate();
  const {
    user, preferenze, radarWizardOpen, closeRadarWizard, setPreferenze, completaOnboarding, salvaProfilo,
    aggiornaRadarAttivo, attivaTrialPro, openAuthModal, piano, hasProAccess, pianoStato, trialAttivo,
    loginConGoogle, aggiornaAnagrafica,
  } = useApp();

  const [fase, setFase] = useState<'wizard' | 'done'>('wizard');
  const [step, setStep] = useState(1);
  const [salvando, setSalvando] = useState(false);

  const [ordini, setOrdini] = useState<OrdineScuola[]>([]);
  const [classiCodici, setClassiCodici] = useState<string[]>([]);
  const [materieId, setMaterieId] = useState<string[]>([]);
  const [materieCustom, setMaterieCustom] = useState<string[]>([]);
  /** Preferenza SOSTEGNO: "includi anche le opportunità per il sostegno". */
  const [sostegno, setSostegno] = useState(false);
  const [provinceCodici, setProvinceCodici] = useState<string[]>([]);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [emailNotifica, setEmailNotifica] = useState('');
  const [classiWarning, setClassiWarning] = useState(false);
  /** Messaggio di blocco: campi obbligatori mancanti all'attivazione. */
  const [erroreAttivazione, setErroreAttivazione] = useState('');
  /**
   * Anagrafica dichiarata NEL WIZARD (nome/cognome/genere/età). Viaggia nella bozza
   * di registrazione (`sr_registrazione_bozza`): alla fine del percorso il form di
   * registrazione è già compilato e l'utente non deve reinserire nulla.
   */
  const [anagrafica, setAnagrafica] = useState<DatiAnagrafica>({
    nome: '',
    cognome: '',
    genere: null,
    eta: '',
  });
  /** Registrazione rapida con Google in corso (passo finale del wizard, Guest). */
  const [googleInCorso, setGoogleInCorso] = useState(false);

  // Limiti del piano corrente (Base: 1 provincia / 2 classi · PRO: 4/4) —
  // fonte condivisa in lib/planLimits.ts (uso anche per i banner di upsell).
  // Con il piano ancora in LETTURA dal DB valgono i tetti PRO: nessun troncamento
  // e nessun blocco per un PRO/promo assegnato dal backend (pianoStato === 'pronto'
  // è la condizione per applicare davvero i tetti Base).
  const limitiPiano = pianoLimits(piano, hasProAccess, pianoStato === 'pronto');
  const maxProvince = limitiPiano.maxProvince;
  const maxClassiConcorso = limitiPiano.maxClassiConcorso;

  // Livello account per la copy del Passo 4 (Canali di Notifica).
  const isFreeForever = piano === 'free_forever';
  const isProAttivo = isFreeForever || (piano === 'pro' && !trialAttivo);
  const isTrialAttivo = piano === 'pro' && trialAttivo;

  // All'apertura: prefill dalle preferenze salvate (ri-configurazione) e RIPRESA
  // del passo esatto in cui l'utente si era fermato (1..4), senza ripartire da 1.
  useEffect(() => {
    if (!radarWizardOpen) return;
    setFase('wizard');
    let passoRipreso = 1;
    try {
      const raw = Number(localStorage.getItem(STORAGE_KEY_RADAR_WIZARD_STEP) ?? '');
      if (Number.isInteger(raw) && raw >= 1 && raw <= 4) passoRipreso = raw;
    } catch {
      // localStorage non disponibile: si riparte dal primo passo
    }
    setStep(passoRipreso);
    setOrdini(preferenze.ordini ?? []);
    // Prefill NORMALIZZATO: una classe salvata come `A-022`/`A042` torna
    // selezionata come `A-22` (casella non più "spenta" dopo un ricaricamento).
    setClassiCodici(limitaSelezione(normalizzaClassi(preferenze.classiCodici), maxClassiConcorso));
    setMaterieId(preferenze.materieId ?? []);
    setMaterieCustom(preferenze.materieCustom ?? []);
    setSostegno(preferenze.sostegno === true);
    setProvinceCodici(limitaSelezione(preferenze.provinceCodici, maxProvince));
    setTelegramUsername(preferenze.telegramUsername ?? '');
    setEmailNotifica(preferenze.emailNotifica || user?.email || '');
    // ANAGRAFICA: prima la bozza di registrazione (dati inseriti in un giro
    // precedente del wizard o prima del ritorno da Google), poi le preferenze, poi
    // il profilo locale. Niente viene mai sovrascritto con un valore vuoto.
    const bozza = leggiBozzaRegistrazione();
    const etaDaBozza = bozza?.eta ?? preferenze.eta ?? user?.eta ?? null;
    setAnagrafica((prev) => ({
      nome: bozza?.nome || user?.nome || prev.nome,
      cognome: bozza?.cognome || user?.cognome || prev.cognome,
      genere: bozza?.genere ?? preferenze.genere ?? user?.genere ?? prev.genere ?? null,
      eta: etaDaBozza != null ? String(etaDaBozza) : prev.eta,
    }));
    setQueryClasse('');
    setQueryMateria('');
    setQueryProvincia('');
    setMateriaFilter('');
    setCustomMateriaInput('');
    setProvinceWarning(false);
    setClassiWarning(false);
  }, [radarWizardOpen, preferenze, user, maxProvince, maxClassiConcorso]);

  // Deeplink Telegram: https://t.me/ScuoleRadar_bot?start=<user_id> — il bot collega
  // automaticamente il Chat ID dell'utente al suo profilo (webhook /start).
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
  }, [radarWizardOpen]);

  /** True se il profilo ha già un Chat ID Telegram collegato (via bot o manuale). */
  const telegramCollegato = Boolean(preferenze.telegramChatId);

  const [queryClasse, setQueryClasse] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('');
  const [customMateriaInput, setCustomMateriaInput] = useState('');
  const [queryMateria, setQueryMateria] = useState('');
  const [queryProvincia, setQueryProvincia] = useState('');
  const [provinceWarning, setProvinceWarning] = useState(false);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  const materieFiltrate = useMemo(() => {
    // Solo COMPETENZE EXTRA: le discipline curricolari (Storia, Geografia, …)
    // non hanno senso in questa sezione e sono già coperte dalle classi.
    const extra = materieCompetenzeExtra();
    const q = queryMateria.trim().toLowerCase();
    if (!q) return extra;
    return extra.filter((m) => m.nome.toLowerCase().includes(q));
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
      // Tolleranza di ricerca: spazi e trattini vengono ignorati nel match
      // (es. "a-18", "a 18" e "a18" restituiscono tutte la classe A-18).
      const q = queryClasse.toLowerCase();
      const qNorm = q.replace(/[\s-]/g, '');
      const classiDaAlias = ALIAS_LAUREA_CLASSI[qNorm] ?? [];
      list = list.filter(
        (c) =>
          c.codice.toLowerCase().replace(/[\s-]/g, '').includes(qNorm) ||
          c.denominazione.toLowerCase().includes(q) ||
          classiDaAlias.includes(c.codice),
      );
    }
    return list;
  }, [queryClasse, materiaFilter]);

  const toggleOrdine = (id: OrdineScuola) => {
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  };

  /**
   * Selezione/deselezione di una classe di concorso su codici NORMALIZZATI
   * (`A-18` ≡ `A18` ≡ `a 18`): la scelta dell'utente non può perdersi e la
   * casella non può restare "spenta" per un formato diverso dal catalogo.
   */
  const toggleClasse = (codice: string) => {
    const canonico = normalizzaClasse(codice);
    if (!canonico) return;
    const attuale = normalizzaClassi(classiCodici);
    if (attuale.includes(canonico)) {
      setClassiCodici(attuale.filter((c) => c !== canonico));
      setClassiWarning(false);
      return;
    }
    // Piano Base: massimo 2 classi di concorso · PRO: massimo 4.
    if (attuale.length >= maxClassiConcorso) {
      setClassiWarning(true);
      return;
    }
    setClassiCodici([...attuale, canonico]);
    setClassiWarning(false);
  };

  const toggleMateria = (id: string) => {
    const prossime = materieId.includes(id)
      ? materieId.filter((m) => m !== id)
      : [...materieId, id];
    setMaterieId(prossime);
    // Sync IMMEDIATO della bozza (keyword predefinite): non si perdono cambiando passo.
    persistiDraft({ ...bozzaPreferenze(), materieId: prossime });
  };

  /**
   * Aggiunge al volo una COMPETENZA SUGGERITA (aree ad alta richiesta PNRR/PON):
   * è il “precompilato” della sezione competenze — un click e il profilo è già
   * appetibile per i bandi per esperti (AI, robotica, storytelling, CLIL…).
   */
  const aggiungiCompetenzaSuggerita = (materiaIdSuggerita: string) => {
    if (materieId.includes(materiaIdSuggerita)) return;
    const prossime = [...materieId, materiaIdSuggerita];
    setMaterieId(prossime);
    persistiDraft({ ...bozzaPreferenze(), materieId: prossime });
  };

  /**
   * Preferenza SOSTEGNO (Passo 3): persistita SUBITO nella bozza, così la scelta
   * non si perde cambiando passo o chiudendo/riaprendo il wizard.
   */
  const toggleSostegno = (prossimo: boolean) => {
    setSostegno(prossimo);
    persistiDraft({ ...bozzaPreferenze(), sostegno: prossimo });
  };

  const addCustomMateria = () => {
    const val = customMateriaInput.trim();
    if (!val) return;
    const giaPresente = materieCustom.some((m) => m.toLowerCase() === val.toLowerCase());
    if (giaPresente) {
      // Dedup: niente duplicati, il campo viene comunque pulito.
      setCustomMateriaInput('');
      return;
    }
    const next = [...materieCustom, val];
    setMaterieCustom(next);
    setCustomMateriaInput('');
    // Sync IMMEDIATO della bozza (localStorage + profilo): il tag non si perde
    // cambiando passo o chiudendo/riaprendo il wizard.
    persistiDraft({ ...bozzaPreferenze(), materieCustom: next });
  };

  const removeCustomMateria = (m: string) => {
    const next = materieCustom.filter((x) => x !== m);
    setMaterieCustom(next);
    persistiDraft({ ...bozzaPreferenze(), materieCustom: next });
  };

  const toggleProvincia = (codice: string) => {
    if (provinceCodici.includes(codice)) {
      setProvinceCodici((prev) => prev.filter((c) => c !== codice));
      setProvinceWarning(false);
      return;
    }
    if (provinceCodici.length >= maxProvince) {
      setProvinceWarning(true);
      return;
    }
    setProvinceCodici((prev) => [...prev, codice]);
    setProvinceWarning(false);
  };

  const canNext = () => {
    if (step === 1) return ordini.length > 0;
    if (step === 2) return provinceCodici.length > 0;
    if (step === 3) return classiCodici.length > 0 || materieId.length > 0 || materieCustom.length > 0;
    if (step === 4) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNotifica.trim());
    return false;
  };

  /**
   * Bozza cumulativa del profilo (tutte le sezioni compilate finora).
   * `onboarded` resta FALSE finché il passo 4/4 non viene completato.
   */
  const bozzaPreferenze = (): Preferenze => ({
    ...preferenze,
    ordini,
    classiCodici: limitaSelezione(classiCodici, maxClassiConcorso),
    materieId,
    materieCustom,
    provinceCodici: limitaSelezione(provinceCodici, maxProvince),
    telegramUsername: telegramUsername.trim(),
    telegramChatId: preferenze.telegramChatId || '',
    emailNotifica: emailNotifica.trim(),
    onboarded: false,
    favoriteSchools: preferenze.favoriteSchools ?? [],
    ignoredSchools: preferenze.ignoredSchools ?? [],
    // Preferenza SOSTEGNO (Passo 3 → profiles.sostegno).
    sostegno,
  });

  /** Persiste subito una bozza (context/localStorage + profilo Supabase). */
  const persistiDraft = (bozza: Preferenze) => {
    setPreferenze(bozza);
    if (user && supabase) void salvaProfilo(bozza);
  };

  /**
   * Provincia di RESIDENZA dedotta dal wizard: se l'utente ha scelto UNA sola
   * provincia di interesse è quella (indizio forte, resta modificabile nel form);
   * con più province o nessuna non si inventa nulla.
   */
  const provinciaDedotta = provinceCodici.length === 1 ? provinceCodici[0] : null;

  /**
   * Aggiorna l'anagrafica del wizard e la SALVA SUBITO nella bozza di registrazione:
   * chiudendo la modale (o passando da Google OAuth) i dati restano e il form finale
   * li trova già compilati.
   */
  const onChangeAnagrafica = (patch: Partial<DatiAnagrafica>) => {
    const prossima = { ...anagrafica, ...patch };
    setAnagrafica(prossima);
    const eta = Number.parseInt(prossima.eta, 10);
    const etaValida = Number.isFinite(eta) && eta >= 14 && eta <= 100 ? eta : null;
    aggiornaBozzaRegistrazione({
      nome: prossima.nome,
      cognome: prossima.cognome,
      genere: prossima.genere ?? null,
      eta: etaValida,
      provincia: provinciaDedotta,
      email: emailNotifica.trim(),
    });
  };

  /** Bozza completa (anagrafica + email + provincia dedotta) da consegnare al form. */
  const bozzaCompleta = (): BozzaRegistrazione => {
    const eta = Number.parseInt(anagrafica.eta, 10);
    const etaValida = Number.isFinite(eta) && eta >= 14 && eta <= 100 ? eta : null;
    return {
      nome: anagrafica.nome.trim(),
      cognome: anagrafica.cognome.trim(),
      genere: anagrafica.genere ?? null,
      eta: etaValida,
      provincia: provinciaDedotta,
      email: emailNotifica.trim(),
    };
  };

  /**
   * Registrazione rapida con GOOGLE dal passo finale del wizard (solo Guest): la
   * bozza è già salvata, quindi al ritorno da OAuth il wizard riprende con i dati
   * intatti e l'account nasce con anagrafica e preferenze già scelte.
   */
  const registraConGoogle = async (): Promise<void> => {
    salvaBozzaRegistrazione(bozzaCompleta());
    try {
      localStorage.setItem(STORAGE_KEY_RADAR_WIZARD_PENDING, '1');
    } catch {
      // localStorage non disponibile
    }
    setGoogleInCorso(true);
    try {
      await loginConGoogle();
    } catch (err) {
      console.warn('[wizard] Google OAuth non riuscito:', (err as Error).message);
    } finally {
      setGoogleInCorso(false);
    }
  };

  /**
   * Transizione di passo (Avanti/Indietro): salva SUBITO la bozza delle
   * preferenze (localStorage sr_preferenze + profilo Supabase per l'utente
   * autenticato) e memorizza il nuovo passo per la ripresa.
   */
  const vaiAlPasso = (nuovoPasso: number) => {
    if (nuovoPasso < 1 || nuovoPasso > 4) return;
    setErroreAttivazione('');
    persistiDraft(bozzaPreferenze());
    try {
      localStorage.setItem(STORAGE_KEY_RADAR_WIZARD_STEP, String(nuovoPasso));
    } catch {
      // localStorage non disponibile
    }
    setStep(nuovoPasso);
  };

  /** Salva preferenze + canali notifica, attiva radar_attivo=true e mostra il completamento. */
  const handleFinish = async (): Promise<void> => {
    // GUARDIA DI ATTIVAZIONE: il Radar NON si attiva con campi obbligatori
    // mancanti. Si mostra un avviso puntuale e si riporta l'utente al primo
    // passo incompleto (Ordini → Province → Classi/Materie).
    const validazione = validaConfigRadar({
      ordini,
      provinceCodici,
      classiCodici,
      materieId,
      materieCustom,
    });
    if (!validazione.valido) {
      setErroreAttivazione(messaggioCampiMancanti(validazione.mancanti));
      setClassiWarning(validazione.mancanti.includes('Classi di concorso o materie'));
      setProvinceWarning(validazione.mancanti.includes('Province'));
      impostaPassoRadar(validazione.primoPasso);
      setStep(validazione.primoPasso);
      return;
    }
    setErroreAttivazione('');

    const preferenzeFinali = {
      ordini,
      classiCodici: limitaSelezione(classiCodici, maxClassiConcorso),
      materieId,
      materieCustom,
      provinceCodici: limitaSelezione(provinceCodici, maxProvince),
      telegramUsername: telegramUsername.trim(),
      telegramChatId: preferenze.telegramChatId || '',
      emailNotifica: emailNotifica.trim(),
      onboarded: true,
      favoriteSchools: preferenze.favoriteSchools ?? [],
      ignoredSchools: preferenze.ignoredSchools ?? [],
      // Preferenza SOSTEGNO scelta al Passo 3 (senza, la fine del wizard la perderebbe).
      sostegno,
    };
    // Salva le preferenze (localStorage) anche per gli anonimi: la configurazione
    // non va mai persa.
    completaOnboarding(preferenzeFinali);

    if (user) {
      // Utente autenticato: persiste su Supabase, attiva il Radar e mostra il completamento.
      // Lo step NON viene resettato finché la modal resta attiva.
      setSalvando(true);
      try {
        await aggiornaRadarAttivo(true);
        await attivaTrialPro();
        await salvaProfilo(preferenzeFinali);
        // Anagrafica dichiarata nel wizard: si salva sul profilo (nome/cognome/
        // genere/età/provincia) solo se compilata. `aggiornaAnagrafica` è l'unico
        // scrittore canonico di questi campi, quindi la bozza non va riscritta a mano.
        const bozzaAnagrafica = bozzaCompleta();
        if (bozzaAnagrafica.nome && bozzaAnagrafica.cognome) {
          try {
            await aggiornaAnagrafica({
              nome: bozzaAnagrafica.nome,
              cognome: bozzaAnagrafica.cognome,
              genere: bozzaAnagrafica.genere ?? null,
              eta: bozzaAnagrafica.eta ?? null,
              provincia: bozzaAnagrafica.provincia ?? null,
            });
            // Dati su `profiles`: la bozza temporanea ha esaurito il suo scopo.
            svuotaBozzaRegistrazione();
          } catch (err) {
            console.warn('[wizard] anagrafica non salvata sul profilo:', (err as Error).message);
          }
        }
        // Analytics funnel: configurazione completata (solo conteggi, nessun dato personale).
        track('radar_configured', {
          provinces: preferenzeFinali.provinceCodici.length,
          classes:
            preferenzeFinali.classiCodici.length +
            preferenzeFinali.materieId.length +
            preferenzeFinali.materieCustom.length,
        });
        // Onboarding completato: azzera il passo salvato per il prossimo setup.
        try {
          localStorage.removeItem(STORAGE_KEY_RADAR_WIZARD_STEP);
        } catch {
          // localStorage non disponibile
        }
        setFase('done');
      } finally {
        setSalvando(false);
      }
      return;
    }

    // Nessun paywall: alla fine della configurazione si mostra SOLO il form di
    // registrazione account gratuito per salvare le preferenze e attivare i 3
    // avvisi inclusi. Dopo il login il wizard riapre già configurato (AppContext).
    // La BOZZA di registrazione viene salvata ADESSO: anagrafica (nome/cognome/
    // genere/età), email di notifica già inserita e provincia dedotta viaggiano nel
    // form finale, che quindi non richiede due volte gli stessi dati.
    salvaBozzaRegistrazione(bozzaCompleta());
    try {
      localStorage.setItem(STORAGE_KEY_RADAR_WIZARD_PENDING, '1');
    } catch {
      // localStorage non disponibile
    }
    closeRadarWizard();
    openAuthModal('registrazione');
  };

  const chiudi = () => closeRadarWizard();
  const vaiAlRadar = () => {
    closeRadarWizard();
    navigate('/dashboard/radar');
  };

  const totalSteps = 4;

  return (
    <Modal
      open={radarWizardOpen}
      onClose={chiudi}
      title={fase === 'done' ? 'Radar attivato! 🎉' : 'Attiva il tuo Radar'}
      size="lg"
    >
      {fase === 'done' ? (
        <div className="animate-fade-in py-4 text-center">
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-100">
            <PartyPopper className="h-8 w-8 text-accent-600" />
          </span>
          <h3 className="mt-4 text-xl font-bold text-primary-800">Il tuo Radar è attivo!</h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-primary-600">
            Preferenze salvate: {provinceCodici.length}{' '}
            {provinceCodici.length === 1 ? 'provincia' : 'province'},{' '}
            {classiCodici.length + materieId.length + materieCustom.length} tra classi e materie. Ti
            avviseremo appena esce un&apos;opportunità per te.
          </p>
          <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              onClick={vaiAlRadar}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
            >
              <Radar className="h-4 w-4" />
              Vai al Radar
            </button>
            <button
              onClick={chiudi}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-200 px-6 py-3 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
            >
              Chiudi
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Progress */}
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-primary-600">
                Passo {step} di {totalSteps}
              </span>
              <span className="text-xs font-semibold text-primary-400">{TITOLI_STEP[step]}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary-100">
              <div
                className="h-full rounded-full bg-primary-500 transition-all duration-500"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          {/* Passo 1: Ordini di Scuola & PNRR */}
          {step === 1 && (
            <PassoOrdini
              ordini={ordini}
              toggleOrdine={toggleOrdine}
              anagrafica={anagrafica}
              onChangeAnagrafica={onChangeAnagrafica}
            />
          )}

          {/* Passo 2: Province */}
          {step === 2 && (
            <PassoProvince
              provinceCodici={provinceCodici}
              toggleProvincia={toggleProvincia}
              provinceFiltrate={provinceFiltrate}
              queryProvincia={queryProvincia}
              setQueryProvincia={setQueryProvincia}
              maxProvince={maxProvince}
              provinceWarning={provinceWarning}
              limitiPiano={limitiPiano}
            />
          )}

          {/* Passo 3: Classi di Concorso / Materie */}
          {step === 3 && (
            <PassoClassiMaterie
              selezioneClassi={{ classiCodici, classiFiltrate, classiWarning, maxClassiConcorso, queryClasse, setQueryClasse, toggleClasse }}
              selezioneMaterie={{
                materieId, materieCustom, materieFiltrate, materiaFilter, setMateriaFilter, queryMateria,
                setQueryMateria, customMateriaInput, setCustomMateriaInput, addCustomMateria, removeCustomMateria,
                toggleMateria, aggiungiCompetenzaSuggerita, sostegno, toggleSostegno,
              }}
              limitiPiano={limitiPiano}
            />
          )}

          {/* Passo 4: Canali di Notifica */}
          {step === 4 && (
            <PassoNotifica
              notifica={{ telegramCollegato, telegramDeepLink, telegramUsername, setTelegramUsername, emailNotifica, setEmailNotifica }}
              piano={{ isProAttivo, isTrialAttivo }}
              rapida={{
                ospite: !user,
                googleInCorso,
                onGoogle: () => void registraConGoogle(),
              }}
            />
          )}

          {/* Blocco attivazione: campi obbligatori mancanti (warning chiaro e puntuale). */}
          {erroreAttivazione && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{erroreAttivazione}</span>
            </div>
          )}

          {/* Navigation — sticky in fondo al pannello: azioni sempre visibili anche a schermi bassi */}
          <div className="sticky bottom-0 z-10 mt-5 flex items-center justify-between border-t border-primary-100 bg-white pb-1 pt-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => vaiAlPasso(step - 1)}
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
                type="button"
                onClick={() => vaiAlPasso(step + 1)}
                disabled={!canNext()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={!canNext() || salvando}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
                {salvando ? 'Attivazione…' : 'Attiva il Radar'}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { classiConcorso } from '@/data/classiConcorso';
import { province } from '@/data/province';
import { pianoLimits } from '@/lib/planLimits';
import { normalizzaClasse, normalizzaClassi } from '@/lib/matchingEngine';
import { promuoviProvinciaPrincipale } from '@/lib/provinceRadar';
import {
  cercaClassiDiConcorso,
  cercaSelezioniRadar,
  separaParoleChiave,
  type SuggerimentoSelezione,
} from '@/lib/ricercaSelezioniRadar';
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
  'Dove vuoi lavorare?',
  'Dove vuoi cercare?',
  'Classi di concorso e competenze',
  'Canali di notifica',
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
    loginConGoogle, aggiornaAnagrafica, supabaseUserId, refreshProfilo,
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
    // NESSUN troncamento: se il profilo ha 4 classi/province salvate (prova PRO) si
    // rivedono TUTTE; i tetti del piano limitano solo ciò che il Radar usa.
    setClassiCodici(normalizzaClassi(preferenze.classiCodici));
    setMaterieId(preferenze.materieId ?? []);
    setMaterieCustom(preferenze.materieCustom ?? []);
    setSostegno(preferenze.sostegno === true);
    setProvinceCodici([...preferenze.provinceCodici]);
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
    setQuerySelezioni('');
    setQueryProvincia('');
    setProvinceWarning(false);
    setClassiWarning(false);
  }, [radarWizardOpen, preferenze, user, maxProvince, maxClassiConcorso]);

  /**
   * AUTENTICAZIONE COMPLETATA DENTRO IL WIZARD (Google / email, anche senza reload
   * via One Tap): appena arriva l'identità Supabase si RILEGGE il piano dal DB.
   * Così lo stato PRO viene riconosciuto SUBITO — badge, limiti (4 province e 4
   * classi) e copy del passo 4 — senza ricaricare la pagina e senza aspettare il
   * refresh periodico (60 s) o un nuovo click su «Accedi».
   */
  const identitaPrecedente = useRef<string | null>(null);
  useEffect(() => {
    if (!supabaseUserId) return;
    const identitaCambiata = identitaPrecedente.current !== supabaseUserId;
    identitaPrecedente.current = supabaseUserId;
    if (!radarWizardOpen) return;
    // Piano ancora in lettura (o utente appena cambiato): rileggi adesso.
    if (identitaCambiata || pianoStato !== 'pronto') void refreshProfilo();
  }, [radarWizardOpen, supabaseUserId, pianoStato, refreshProfilo]);

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

  const [querySelezioni, setQuerySelezioni] = useState('');
  const [queryProvincia, setQueryProvincia] = useState('');
  const [provinceWarning, setProvinceWarning] = useState(false);

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);

  /**
   * RICERCA UNIFICATA (una sola query per entrambe le colonne): classi di concorso
   * + competenze extra + parola chiave. Il motore è condiviso con le Preferenze
   * (`lib/ricercaSelezioniRadar.ts`): i risultati sono sempre gli stessi.
   */
  const gruppiSelezioni = useMemo(
    () => cercaSelezioniRadar(querySelezioni, { classiCodici, materieId, materieCustom }),
    [querySelezioni, classiCodici, materieId, materieCustom],
  );

  /**
   * Classi mostrate nella colonna: filtrate dalla STESSA query (codice,
   * denominazione o materia collegata), più gli alias laurea→classe (LM).
   */
  const classiFiltrate = useMemo(() => {
    const trovate = cercaClassiDiConcorso(querySelezioni, 200);
    const qNorm = querySelezioni.toLowerCase().replace(/[\s-]/g, '').trim();
    const alias = ALIAS_LAUREA_CLASSI[qNorm] ?? [];
    if (alias.length === 0) return trovate;
    const extra = classiConcorso.filter(
      (c) => alias.includes(c.codice) && !trovate.some((t) => t.codice === c.codice),
    );
    return [...trovate, ...extra];
  }, [querySelezioni]);

  /** Applica un risultato della ricerca unificata (classe, competenza o tag). */
  const scegliSelezione = (suggerimento: SuggerimentoSelezione) => {
    if (suggerimento.tipo === 'classe') {
      toggleClasse(suggerimento.chiave);
      return;
    }
    if (suggerimento.tipo === 'competenza') {
      aggiungiCompetenzaSuggerita(suggerimento.chiave);
      return;
    }
    aggiungiParolaChiave(suggerimento.chiave);
  };

  const provinceFiltrate = useMemo(() => {
    const q = queryProvincia.trim().toLowerCase();
    if (!q) return provinceSorted;
    return provinceSorted.filter(
      (p) => p.nome.toLowerCase().includes(q) || p.codice.toLowerCase().includes(q),
    );
  }, [queryProvincia, provinceSorted]);

  const toggleOrdine = (id: OrdineScuola) => {
    const prossimi = ordini.includes(id) ? ordini.filter((o) => o !== id) : [...ordini, id];
    setOrdini(prossimi);
    // Persistenza ISTANTANEA: uscendo dalla pagina la selezione è già salvata.
    persistiSelezione({ ordini: prossimi });
  };

  /**
   * Selezione/deselezione di una classe di concorso su codici NORMALIZZATI
   * (`A-18` ≡ `A18` ≡ `a 18`): la scelta dell'utente non può perdersi e la
   * casella non può restare "spenta" per un formato diverso dal catalogo.
   * Ogni click è persistito SUBITO (localStorage + profilo).
   */
  const toggleClasse = (codice: string) => {
    const canonico = normalizzaClasse(codice);
    if (!canonico) return;
    const attuale = normalizzaClassi(classiCodici);
    if (attuale.includes(canonico)) {
      const prossime = attuale.filter((c) => c !== canonico);
      setClassiCodici(prossime);
      setClassiWarning(false);
      persistiSelezione({ classiCodici: prossime });
      return;
    }
    // Piano Base: massimo 2 classi di concorso · PRO: massimo 4.
    if (attuale.length >= maxClassiConcorso) {
      setClassiWarning(true);
      return;
    }
    const prossime = [...attuale, canonico];
    setClassiCodici(prossime);
    setClassiWarning(false);
    persistiSelezione({ classiCodici: prossime });
  };

  const toggleMateria = (id: string) => {
    const prossime = materieId.includes(id)
      ? materieId.filter((m) => m !== id)
      : [...materieId, id];
    setMaterieId(prossime);
    // Sync IMMEDIATO (competenza predefinita): non si perde cambiando passo.
    persistiSelezione({ materieId: prossime });
  };

  /**
   * Aggiunge al volo una COMPETENZA SUGGERITA (aree ad alta richiesta PNRR/PON):
   * un click e il profilo è già appetibile per i bandi per esperti (AI, robotica,
   * stop motion, storytelling, CLIL, lingue…).
   */
  const aggiungiCompetenzaSuggerita = (materiaIdSuggerita: string) => {
    if (materieId.includes(materiaIdSuggerita)) return;
    const prossime = [...materieId, materiaIdSuggerita];
    setMaterieId(prossime);
    persistiSelezione({ materieId: prossime });
  };

  /**
   * Preferenza SOSTEGNO (Passo 3): persistita SUBITO, così la scelta non si perde
   * cambiando passo o chiudendo/riaprendo il wizard.
   */
  const toggleSostegno = (prossimo: boolean) => {
    setSostegno(prossimo);
    persistiSelezione({ sostegno: prossimo });
  };

  /**
   * Aggiunge una PAROLA CHIAVE personale (tag libero): arriva dalla ricerca
   * unificata («Aggiungi "Pedagogia" come tua parola chiave») e alimenta la CTA
   * anche quando l'utente la scrive a mano. Dedup case-insensitive e persistenza
   * IMMEDIATA: nessun testo digitato va perso.
   */
  const aggiungiParolaChiave = (testo: string) => {
    setQuerySelezioni('');
    // Più voci separate da virgola → più tag INDIPENDENTI (mai una stringa incollata).
    const nuove = separaParoleChiave(testo).filter(
      (voce) => !materieCustom.some((m) => m.toLowerCase() === voce.toLowerCase()),
    );
    if (nuove.length === 0) return;
    const next = [...materieCustom, ...nuove];
    setMaterieCustom(next);
    persistiSelezione({ materieCustom: next });
  };

  const removeCustomMateria = (m: string) => {
    const next = materieCustom.filter((x) => x !== m);
    setMaterieCustom(next);
    persistiSelezione({ materieCustom: next });
  };

  const toggleProvincia = (codice: string) => {
    if (provinceCodici.includes(codice)) {
      const prossime = provinceCodici.filter((c) => c !== codice);
      setProvinceCodici(prossime);
      setProvinceWarning(false);
      persistiSelezione({ provinceCodici: prossime });
      return;
    }
    if (provinceCodici.length >= maxProvince) {
      setProvinceWarning(true);
      return;
    }
    // Le province aggiunte dopo la prima sono "di contorno" (ordine = priorità).
    const prossime = [...provinceCodici, codice];
    setProvinceCodici(prossime);
    setProvinceWarning(false);
    persistiSelezione({ provinceCodici: prossime });
  };

  /**
   * Provincia PRINCIPALE = la prima selezionata. Promuovere una provincia di
   * contorno la porta in testa (l'ordine è la priorità) con salvataggio immediato.
   */
  const promuoviPrincipale = (codice: string) => {
    const prossime = promuoviProvinciaPrincipale(provinceCodici, codice);
    setProvinceCodici(prossime);
    persistiSelezione({ provinceCodici: prossime });
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
    classiCodici,
    materieId,
    materieCustom,
    provinceCodici,
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
   * Persistenza ISTANTANEA di una SELEZIONE (ordini, province, classi, competenze,
   * sostegno, tag): scrive subito su localStorage/context — e sul profilo se
   * autenticato — a OGNI click, così uscire dalla pagina non perde nulla.
   *
   * Differenza da `bozzaPreferenze()`: NON retrocede `onboarded`. Chi ha già
   * attivato il Radar e sta solo ritoccando le regole non deve ricadere nello
   * stato «bozza» (banner «finisci di completare»).
   */
  const persistiSelezione = (patch: Partial<Preferenze>) =>
    persistiDraft({ ...bozzaPreferenze(), ...patch, onboarded: preferenze.onboarded });

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
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
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
      dense
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
          {/* Progress — compatto: il passo deve restare tutto nel viewport */}
          <div className="mb-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-primary-600">
                Passo {step} di {totalSteps}
              </span>
              <span className="text-xs font-semibold text-primary-400">{TITOLI_STEP[step]}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-primary-100">
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
              onPromuoviPrincipale={promuoviPrincipale}
              provinceFiltrate={provinceFiltrate}
              queryProvincia={queryProvincia}
              setQueryProvincia={setQueryProvincia}
              maxProvince={maxProvince}
              provinceWarning={provinceWarning}
              limitiPiano={limitiPiano}
            />
          )}

          {/* Passo 3: Classi di Concorso / Materie — ricerca UNIFICATA + 2 colonne */}
          {step === 3 && (
            <PassoClassiMaterie
              selezioneClassi={{
                classiCodici,
                classiFiltrate,
                classiWarning,
                maxClassiConcorso,
                toggleClasse,
                sostegno,
                toggleSostegno,
              }}
              selezioneMaterie={{
                materieId,
                materieCustom,
                toggleMateria,
                aggiungiCompetenzaSuggerita,
                aggiungiParolaChiave,
                removeCustomMateria,
              }}
              ricerca={{
                query: querySelezioni,
                setQuery: setQuerySelezioni,
                gruppi: gruppiSelezioni,
                onScegli: scegliSelezione,
                onParolaChiave: aggiungiParolaChiave,
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
          <div className="sticky bottom-0 z-10 mt-3 flex items-center justify-between border-t border-primary-100 bg-white pb-0.5 pt-2">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => vaiAlPasso(step - 1)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-3.5 py-2 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
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
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Avanti
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={!canNext() || salvando}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
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

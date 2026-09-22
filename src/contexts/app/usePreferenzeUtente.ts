/**
 * Contesto App · preferenze, esami e notifiche dell'utente.
 *
 * Estratto da `AppContext.tsx`: stato persistito su localStorage
 * (`sr_preferenze`, `sr_esami`, `sr_notificati`), bonifica una-tantum dei codici
 * classe nel formato catalogo, scritture canoniche (`setPreferenze`,
 * `completaOnboarding`) e contatore notifiche (RPC server-side `incrementa_notifiche_utente`
 * con fallback locale in modalità demo).
 *
 * Dipendenze esterne: solo l'id Supabase, lo stato abbonamento e il contatore
 * `notificheUsate` (che resta nel provider).
 */
import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { normalizzaClassi } from '@/lib/matchingEngine';
import { supabase } from '@/lib/supabase';
import { defaultPreferenze } from './costanti';
import type { Esame, Preferenze } from './types';

/** Dipendenze esterne usate dagli handler di preferenze, esami e notifiche. */
export interface OpzioniPreferenzeUtente {
  /** Id Supabase dell'utente autenticato (RPC del contatore notifiche). */
  supabaseUserId: string | null;
  /** true se l'abbonamento è attivo: nessun contatore locale di backup. */
  abbonato: boolean;
  /** Contatore notifiche usate: stato del provider (azzerato al logout). */
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  /**
   * Tetti del piano CONFERMATO (`null` = piano ancora in lettura dal DB): mentre il
   * piano è incerto non si tronca nulla. Quando arriva, una selezione che supera i
   * tetti Base (es. ex PRO tornato Base) viene riallineata e persistita.
   */
  tetti: { province: number; classi: number } | null;
}

/** Stato e azioni di preferenze, esami e notifiche. */
export interface PreferenzeUtente {
  /** Preferenze del profilo (persistite su `sr_preferenze`). */
  preferenze: Preferenze;
  /** Setter grezzo delle preferenze (usato dai flussi di profilo/logout). */
  setPref: Dispatch<SetStateAction<Preferenze>>;
  /** Scrittura canonica: normalizza SEMPRE i codici classe. */
  setPreferenze: (p: Partial<Preferenze>) => void;
  /** Chiusura onboarding: come `setPreferenze` + `onboarded: true`. */
  completaOnboarding: (p: Partial<Preferenze>) => void;
  /** Esami caricati dall'utente (Step Documenti del calcolatore CFU). */
  esami: Esame[];
  setEsamiState: Dispatch<SetStateAction<Esame[]>>;
  setEsami: (e: Esame[]) => void;
  /** Id degli interpelli già notificati (evita doppie notifiche). */
  interpelliNotificati: string[];
  setNotificati: Dispatch<SetStateAction<string[]>>;
  /** Registra l'interpello notificato e incrementa il contatore (RPC/demo). */
  incrementaNotifica: (interpelloId: string) => void;
}

export function usePreferenzeUtente({
  supabaseUserId,
  abbonato,
  setNotificheUsate,
  tetti,
}: OpzioniPreferenzeUtente): PreferenzeUtente {
  const [preferenze, setPref] = useLocalStorage<Preferenze>('sr_preferenze', defaultPreferenze);
  const [esami, setEsamiState] = useLocalStorage<Esame[]>('sr_esami', []);
  const [interpelliNotificati, setNotificati] = useLocalStorage<string[]>('sr_notificati', []);

  /**
   * Applica le preferenze normalizzando SEMPRE i codici classe (`A-022` → `A-22`,
   * `A 18` → `A-18`, duplicati rimossi). Ogni scrittura — wizard, preferenze,
   * autosave — passa da qui: il formato in stato/DB è così canonico e una classe
   * scelta non può "sparire" per un disallineamento di formato.
   */
  const setPreferenze = useCallback(
    (p: Partial<Preferenze>) =>
      setPref((prev) => ({
        ...prev,
        ...p,
        classiCodici:
          p.classiCodici !== undefined ? normalizzaClassi(p.classiCodici) : prev.classiCodici,
      })),
    [setPref],
  );

  const completaOnboarding = useCallback(
    (p: Partial<Preferenze>) =>
      setPref((prev) => ({
        ...prev,
        ...p,
        classiCodici:
          p.classiCodici !== undefined ? normalizzaClassi(p.classiCodici) : prev.classiCodici,
        onboarded: true,
      })),
    [setPref],
  );

  /**
   * Bonifica UNA TANTUM delle preferenze locali (localStorage `sr_preferenze`):
   * le versioni precedenti potevano contenere classi in formato fonte (`A-022`,
   * `A042`), che nel catalogo risultavano non selezionate. La normalizzazione
   * avviene SOLO se c'è davvero qualcosa da correggere (nessun loop di render).
   */
  useEffect(() => {
    const normalizzate = normalizzaClassi(preferenze.classiCodici);
    const identiche =
      normalizzate.length === preferenze.classiCodici.length &&
      normalizzate.every((c, i) => c === preferenze.classiCodici[i]);
    if (identiche) return;
    console.log('[preferenze] classi normalizzate nel formato catalogo:', normalizzate);
    setPref((prev) => ({ ...prev, classiCodici: normalizzate }));
  }, [preferenze.classiCodici, setPref]);

  /**
   * Riallineamento ai tetti del piano CONFERMATO: se il piano è tornato Base (o se
   * la selezione eccede i limiti), si tronca e si PERSISTE — così un ex PRO non
   * continua a ricevere notifiche su 4 province. Con `tetti = null` (piano ancora
   * in lettura) non si tocca nulla: nessuna perdita durante il caricamento.
   */
  useEffect(() => {
    if (!tetti || !preferenze.onboarded) return;
    const province = preferenze.provinceCodici.slice(0, Math.max(0, tetti.province));
    const classi = normalizzaClassi(preferenze.classiCodici).slice(0, Math.max(0, tetti.classi));
    const provinceOk = province.length === preferenze.provinceCodici.length;
    const classiOk =
      classi.length === preferenze.classiCodici.length &&
      classi.every((c, i) => c === preferenze.classiCodici[i]);
    if (provinceOk && classiOk) return;
    console.warn('[piano] selezione oltre i tetti del piano confermato: riallineo preferenze.', {
      province:  `${preferenze.provinceCodici.length} → ${province.length}`,
      classi: `${preferenze.classiCodici.length} → ${classi.length}`,
    });
    setPref((prev) => ({ ...prev, provinceCodici: province, classiCodici: classi }));
  }, [tetti, preferenze.onboarded, preferenze.provinceCodici, preferenze.classiCodici, setPref]);

  const incrementaNotifica = useCallback(
    (interpelloId: string) => {
      setNotificati((prev) => (prev.includes(interpelloId) ? prev : [...prev, interpelloId]));
      // FASE 6 — contatore server-side via RPC (se l'utente è autenticato su Supabase)
      if (supabaseUserId) {
        void supabase?.rpc('incrementa_notifiche_utente', { p_user_id: supabaseUserId }).then(
          ({ data, error }) => {
            if (!error && Array.isArray(data) && data[0]) {
              setNotificheUsate(Number(data[0].notifiche_usate));
            }
          },
        );
      } else if (!abbonato) {
        // modalità demo (Supabase non configurato): comportamento locale di backup
        setNotificheUsate((n) => Math.min(n + 1, 3));
      }
    },
    [supabaseUserId, abbonato, setNotificati, setNotificheUsate],
  );

  const setEsami = useCallback((e: Esame[]) => setEsamiState(e), [setEsamiState]);

  return {
    preferenze,
    setPref,
    setPreferenze,
    completaOnboarding,
    esami,
    setEsamiState,
    setEsami,
    interpelliNotificati,
    setNotificati,
    incrementaNotifica,
  };
}

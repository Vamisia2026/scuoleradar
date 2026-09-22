/**
 * Contesto App · stato simulato per la DevToolbar (solo sviluppo).
 *
 * Estratto da `useProfiloAccount.ts` (a sua volta da `AppContext.tsx`):
 * `simulaStato` (guest/base/pro) e `resettaTutto` (purge dello stato locale
 * persistito e azzeramento del contesto).
 *
 * Non tocca il DB: è usato dalla DevToolbar e dal reset di sessione.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { defaultPreferenze } from './costanti';
import type { Esame, Preferenze, RuoloSimulato, User } from './types';

/** Dipendenze esterne: stati e setter che restano nel provider. */
export interface OpzioniStatoSimulato {
  /** Id dell'ultima sessione per cui il piano è stato caricato dal DB. */
  pianoSessionUserIdRef: MutableRefObject<string | null>;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPref: Dispatch<SetStateAction<Preferenze>>;
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setRadarAttivo: Dispatch<SetStateAction<boolean>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setSupabaseUserId: Dispatch<SetStateAction<string | null>>;
  setEsamiState: Dispatch<SetStateAction<Esame[]>>;
  setNotificati: Dispatch<SetStateAction<string[]>>;
}

/** Azioni di stato simulato esposte dal contesto. */
export interface StatoSimulato {
  simulaStato: (ruolo: RuoloSimulato) => void;
  resettaTutto: () => void;
}

export function useStatoSimulato({
  pianoSessionUserIdRef,
  setUser,
  setPref,
  setNotificheUsate,
  setAbbonato,
  setPiano,
  setPianoStato,
  setRadarAttivo,
  setCrediti,
  setSupabaseUserId,
  setEsamiState,
  setNotificati,
}: OpzioniStatoSimulato): StatoSimulato {
  // Stato simulato per la DevToolbar (solo sviluppo). Aggiorna all'istante context + UI.
  const simulaStato = useCallback(
    (ruolo: RuoloSimulato) => {
      if (ruolo === 'guest') {
        setUser(null);
        setPref(defaultPreferenze);
        setNotificheUsate(0);
        setAbbonato(false);
        setPiano('base');
        setPianoStato('pronto');
        pianoSessionUserIdRef.current = null;
        setRadarAttivo(false);
        return;
      }
      const utenteDemo: User = {
        nome: 'Mario',
        cognome: 'Rossi',
        email: 'mario.rossi@gmail.com',
        password: '',
      };
      setUser(utenteDemo);
      setAbbonato(ruolo === 'pro');
      setPiano(ruolo === 'pro' ? 'pro' : 'base');
      setPianoStato('pronto'); // simulazione demo: piano locale definito
      setNotificheUsate(0);
      setPref((prev) => ({
        ...prev,
        ordini: prev.ordini.length > 0 ? prev.ordini : ['secondaria1', 'secondaria2'],
        provinceCodici:
          prev.provinceCodici.length > 0 ? prev.provinceCodici : ['RM', 'TO', 'MI', 'NA'],
        onboarded: true,
      }));
    },
    [setUser, setPref, setNotificheUsate, setAbbonato, setPiano, setRadarAttivo],
  );

  const resettaTutto = useCallback(() => {
    ['sr_user', 'sr_preferenze', 'sr_esami', 'sr_notificati', 'sr_radar_wizard_step'].forEach((k) =>
      localStorage.removeItem(k),
    );
    setUser(null);
    setPref(defaultPreferenze);
    setNotificheUsate(0);
    setAbbonato(false);
    setPiano('base');
    setPianoStato('pronto');
    pianoSessionUserIdRef.current = null;
    setRadarAttivo(false);
    setCrediti(0);
    setSupabaseUserId(null);
    setEsamiState([]);
    setNotificati([]);
  }, [setUser, setPref, setNotificheUsate, setAbbonato, setPiano, setPianoStato, setRadarAttivo, setCrediti, setSupabaseUserId, setEsamiState, setNotificati]);

  return { simulaStato, resettaTutto };
}

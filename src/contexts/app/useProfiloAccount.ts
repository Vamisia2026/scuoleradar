/**
 * Contesto App · profilo utente: anagrafica, piano/Radar/trial e stato simulato.
 *
 * Facade sottile (wave 15): la logica vive nei moduli dedicati
 * `./useAnagraficaProfilo` (profilo su `profiles`, crediti, anagrafica),
 * `./useRadarTrial` (piano/abbonamento, Radar attivo, prova PRO) e
 * `./useStatoSimulato` (DevToolbar: `simulaStato`/`resettaTutto`).
 *
 * Firma e API pubblica restano identiche a prima: `AppContext.tsx` e gli altri
 * consumatori non cambiano una riga.
 */
import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { useAnagraficaProfilo, type DatiAnagrafici } from './useAnagraficaProfilo';
import { useRadarTrial } from './useRadarTrial';
import { useStatoSimulato } from './useStatoSimulato';
import type { Esame, Preferenze, RuoloSimulato, User } from './types';

export type { DatiAnagrafici };

/** Dipendenze esterne: stati e setter che continuano a vivere nel provider. */
export interface OpzioniProfiloAccount {
  /** Utente locale (fallback di genere/età quando `profiles` non li ha). */
  user: User | null;
  /** Preferenze correnti (payload di salvataggio su `profiles`). */
  preferenze: Preferenze;
  /** Piano corrente: `attivaTrialPro` non concede la prova se non è 'base'. */
  piano: 'base' | 'pro' | 'free_forever';
  /** Id Supabase dell'utente autenticato (RPC crediti). */
  supabaseUserId: string | null;
  /** Crediti correnti (valore di ritorno se la RPC fallisce). */
  crediti: number;
  /** Id dell'ultima sessione per cui il piano è stato (ri)caricato dal DB. */
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
  setTrialScadenza: Dispatch<SetStateAction<string | null>>;
  setProfiloIncompleto: Dispatch<SetStateAction<boolean>>;
  setEsamiState: Dispatch<SetStateAction<Esame[]>>;
  setNotificati: Dispatch<SetStateAction<string[]>>;
}

/** Azioni di profilo esposte dal contesto. */
export interface ProfiloAccount {
  simulaStato: (ruolo: RuoloSimulato) => void;
  resettaTutto: () => void;
  salvaProfilo: (p?: Preferenze) => Promise<void>;
  consumaCredito: () => Promise<{ ok: boolean; crediti: number }>;
  valutaProfiloIncompleto: (userId: string) => Promise<void>;
  aggiornaAnagrafica: (d: DatiAnagrafici) => Promise<void>;
  refreshProfilo: () => Promise<void>;
  aggiornaRadarAttivo: (attivo: boolean) => Promise<void>;
  attivaTrialPro: () => Promise<void>;
}

export function useProfiloAccount({
  user,
  preferenze,
  piano,
  supabaseUserId,
  crediti,
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
  setTrialScadenza,
  setProfiloIncompleto,
  setEsamiState,
  setNotificati,
}: OpzioniProfiloAccount): ProfiloAccount {
  // Anagrafica e profilo su `profiles`: salvaProfilo, consumaCredito,
  // valutaProfiloIncompleto, aggiornaAnagrafica.
  const { salvaProfilo, consumaCredito, valutaProfiloIncompleto, aggiornaAnagrafica } =
    useAnagraficaProfilo({
      user,
      preferenze,
      supabaseUserId,
      crediti,
      setUser,
      setPref,
      setCrediti,
      setProfiloIncompleto,
    });

  // Piano/abbonamento, Radar attivo e prova PRO: refreshProfilo,
  // aggiornaRadarAttivo, attivaTrialPro.
  const { refreshProfilo, aggiornaRadarAttivo, attivaTrialPro } = useRadarTrial({
    piano,
    pianoSessionUserIdRef,
    setPiano,
    setAbbonato,
    setPianoStato,
    setRadarAttivo,
    setCrediti,
    setNotificheUsate,
    setTrialScadenza,
  });

  // Stato simulato per la DevToolbar: simulaStato, resettaTutto.
  const { simulaStato, resettaTutto } = useStatoSimulato({
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
  });

  return {
    simulaStato,
    resettaTutto,
    salvaProfilo,
    consumaCredito,
    valutaProfiloIncompleto,
    aggiornaAnagrafica,
    refreshProfilo,
    aggiornaRadarAttivo,
    attivaTrialPro,
  };
}


/**
 * Contesto App · piano/abbonamento, Radar attivo e prova PRO.
 *
 * Estratto da `useProfiloAccount.ts` (a sua volta da `AppContext.tsx`):
 * `refreshProfilo` (rilettura del piano dal DB + self-heal della prova scaduta),
 * `aggiornaRadarAttivo` (profiles.radar_attivo) e `attivaTrialPro` (30 giorni).
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { supabase } from '@/lib/supabase';
import { pianoDaProfilo, provaProScaduta } from './helpers';

/** Dipendenze esterne: piano corrente, rif di sessione e setter del provider. */
export interface OpzioniRadarTrial {
  /** Piano corrente: `attivaTrialPro` non concede la prova se non è 'base'. */
  piano: 'base' | 'pro' | 'free_forever';
  /** Id dell'ultima sessione per cui il piano è stato (ri)caricato dal DB. */
  pianoSessionUserIdRef: MutableRefObject<string | null>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setRadarAttivo: Dispatch<SetStateAction<boolean>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  setTrialScadenza: Dispatch<SetStateAction<string | null>>;
}

/** Azioni di piano/Radar/prova esposte dal contesto. */
export interface RadarTrial {
  refreshProfilo: () => Promise<void>;
  aggiornaRadarAttivo: (attivo: boolean) => Promise<void>;
  attivaTrialPro: () => Promise<void>;
}

export function useRadarTrial({
  piano,
  pianoSessionUserIdRef,
  setPiano,
  setAbbonato,
  setPianoStato,
  setRadarAttivo,
  setCrediti,
  setNotificheUsate,
  setTrialScadenza,
}: OpzioniRadarTrial): RadarTrial {
  /**
   * Ricarica piano/abbonamento e contatori direttamente da `profiles`.
   * Usata per riflettere subito le modifiche fatte dal Pannello Admin sul piano
   * (es. passaggio a 'free_forever') senza richiedere logout/login.
   */
  const refreshProfilo = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) {
      console.warn('[refreshProfilo] nessun utente autenticato nella sessione attiva.');
      return;
    }
    console.log('[refreshProfilo] utente attivo →', { id: sess.user.id, email: sess.user.email ?? '' });
    // NB: NIENTE colonna `is_free_forever` qui: non esiste ancora nel DB remoto
    // e un errore 42703 farebbe fallire l'intero refresh (piano bloccato su
    // 'base'). Il piano si ricava da piano/subscription_tier (pianoDaProfilo).
    // `is_beta_tester` è una colonna OPZIONALE (migrazione 20260831170000): letta a
    // parte, così un errore 42703 non fa fallire il refresh del piano e un PRO
    // "regalato" (anche via codice beta) resta riconosciuto.
    const beta = await supabase
      .from('profiles')
      .select('is_beta_tester')
      .eq('id', sess.user.id)
      .maybeSingle();
    const isBetaTester = !beta.error && beta.data?.is_beta_tester === true;
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'piano, subscription_tier, abbonamento_scade_il, subscription_status, crediti, notifiche_usate, radar_attivo',
      )
      .eq('id', sess.user.id)
      .maybeSingle();
    if (error || !data) {
      console.warn('[refreshProfilo] query profiles (per id) fallita:', {
        userId: sess.user.id,
        email: sess.user.email ?? '',
        error: error?.message ?? 'nessuna riga profilo trovata',
      });
      // La riga manca o non è leggibile: la si crea/ricrea subito (upsert) e si
      // ritenta UNA volta, così il piano non resta indefinitamente in 'loading'
      // per una riga profilo assente.
      if (!error && !data) {
        await supabase
          .from('profiles')
          .upsert({ id: sess.user.id, email: sess.user.email ?? '' }, { onConflict: 'id' });
        const rilettura = await supabase
          .from('profiles')
          .select(
            'piano, subscription_tier, abbonamento_scade_il, subscription_status, crediti, notifiche_usate, radar_attivo, is_beta_tester',
          )
          .eq('id', sess.user.id)
          .maybeSingle();
        if (rilettura.error || !rilettura.data) {
          console.warn('[refreshProfilo] riga profilo ancora assente dopo l\'upsert.');
          return;
        }
        const profiloNuovo = rilettura.data;
        const pianoNuovo = pianoDaProfilo(profiloNuovo);
        setPiano(pianoNuovo);
        setAbbonato(pianoNuovo !== 'base');
        setCrediti(Number(profiloNuovo.crediti ?? 0));
        setNotificheUsate(Number(profiloNuovo.notifiche_usate ?? 0));
        setRadarAttivo(profiloNuovo.radar_attivo === true);
        setPianoStato('pronto');
        pianoSessionUserIdRef.current = sess.user.id;
        return;
      }
      return;
    }
    // Prova PRO (30 gg) scaduta → ritorno NATURALE su Base (stato + DB, cron
    // DB `reverti_prove_pro_scadute()` fa lo stesso ogni notte). I Beta Tester
    // sono esclusi da `provaProScaduta` (omaggio, non prova).
    if (provaProScaduta({ ...data, is_beta_tester: isBetaTester })) {
      data.piano = 'base';
      data.subscription_tier = 'base';
      data.subscription_status = 'inactive';
      data.abbonamento_scade_il = null;
      if (supabase) {
        const { error: errRevert } = await supabase
          .from('profiles')
          .update({
            piano: 'base',
            subscription_tier: 'base',
            subscription_status: 'inactive',
            current_period_end: null,
            abbonamento_scade_il: null,
          })
          .eq('id', sess.user.id);
        if (errRevert) {
          console.warn('[onboarding] ritorno a Base dopo prova scaduta non persistito:', errRevert.message);
        }
      }
    }
    // Diagnostica: mostra la riga (già normalizzata) restituita dal DB.
    console.log('[refreshProfilo] riga profiles (per id) →', data);
    const periodoOk = !data.abbonamento_scade_il || new Date(data.abbonamento_scade_il) > new Date();
    // Fonte canonica: colonna is_free_forever (se esiste) O alias testuali
    // piano/subscription_tier (più `is_beta_tester`) — mai lasciare il default
    // 'Base' in UI per una promo/PRO omaggio assegnata dal backend.
    const pianoCorrente = pianoDaProfilo({ ...data, is_beta_tester: isBetaTester });
    const pianoGratuitoVita = pianoCorrente === 'free_forever';
    const hasAccessoPro = pianoCorrente !== 'base';
    setPiano(pianoCorrente);
    setAbbonato(hasAccessoPro && (pianoGratuitoVita || periodoOk));
    setCrediti(Number(data.crediti ?? 0));
    setNotificheUsate(Number(data.notifiche_usate ?? 0));
    setRadarAttivo(data.radar_attivo === true);
    setTrialScadenza(
      pianoCorrente === 'pro' && String(data.subscription_status ?? '').toLowerCase() === 'trialing'
        ? data.abbonamento_scade_il
          ? String(data.abbonamento_scade_il)
          : null
        : null,
    );
    console.log('Logged user piano:', pianoCorrente, 'hasProAccess:', hasAccessoPro);
    // Piano confermato dal DB: il badge può uscire dallo stato di caricamento.
    setPianoStato('pronto');
    pianoSessionUserIdRef.current = sess.user.id;
  }, [setAbbonato, setCrediti, setNotificheUsate, setPiano, setPianoStato, setRadarAttivo, setTrialScadenza]);

  /**
   * Attiva/mette in pausa il Radar per l'utente autenticato (profiles.radar_attivo).
   * In pausa non si inviano notifiche ma province/classi/preferenze restano salvate.
   */
  const aggiornaRadarAttivo = useCallback(
    async (attivo: boolean): Promise<void> => {
      // Ottimistico: aggiorna subito la UI, poi persiste su Supabase.
      setRadarAttivo(attivo);
      if (!supabase) return;
      const { data: sess } = await supabase.auth.getUser();
      if (!sess.user) return;
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: sess.user.id, radar_attivo: attivo }, { onConflict: 'id' });
      if (error) {
        console.warn('[radar] aggiornamento radar_attivo fallito:', error.message);
        setRadarAttivo(!attivo);
      }
    },
    [setRadarAttivo],
  );

  /**
   * Trial PRO 30 giorni (sponsorizzato PureFocus): al termine dell'onboarding
   * un utente Base riceve il piano PRO con scadenza = oggi+30 giorni. Dopo la
   * scadenza l'utente torna naturalmente su Base (self-heal client + cron DB).
   */
  const attivaTrialPro = useCallback(async (): Promise<void> => {
    if (!supabase) return;
    if (piano !== 'base') return; // già PRO / Free Forever: nessuna prova da concedere
    const { data: sess } = await supabase.auth.getUser();
    if (!sess.user) return;
    const scadenza = new Date();
    scadenza.setDate(scadenza.getDate() + 30); // prova PRO 30 giorni esatti
    const iso = scadenza.toISOString();
    // UPSERT (non `update`): garantisce la riga `profiles` anche quando il trigger
    // su `auth.users` non l'ha ancora creata. Con `update` l'assenza della riga
    // non produce errore ma NON attiva la prova → il trial "si blocca".
    const { error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: sess.user.id,
          email: sess.user.email ?? undefined,
          piano: 'pro',
          abbonamento_scade_il: iso,
          subscription_tier: 'pro_annuale',
          subscription_status: 'trialing',
          current_period_end: iso,
        },
        { onConflict: 'id' },
      );
    if (error) {
      console.warn('[onboarding] attivazione prova PRO 30 giorni fallita:', error.message);
      return;
    }
    await refreshProfilo();
  }, [piano, refreshProfilo]);

  return { refreshProfilo, aggiornaRadarAttivo, attivaTrialPro };
}

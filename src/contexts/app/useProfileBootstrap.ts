/**
 * Contesto App · caricamento iniziale del profilo dal DB.
 *
 * Estratto da `useBootstrapProfilo.ts` (a sua volta da `AppContext.tsx`):
 * primo effetto di avvio — sessione Supabase, preferenze salvate, piano e
 * contatori, self-heal della prova PRO scaduta e verifica dell'anagrafica.
 */
import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { normalizzaClassi } from '@/lib/matchingEngine';
import { supabase } from '@/lib/supabase';
import { pianoDaProfilo, provaProScaduta } from './helpers';
import type { Preferenze } from './types';

/** Dipendenze esterne: setter del provider + verifica anagrafica. */
export interface OpzioniProfileBootstrap {
  /** Verifica nome/cognome su `profiles` → mini-onboarding anagrafico. */
  valutaProfiloIncompleto: (userId: string) => Promise<void>;
  /** Id dell'ultima sessione per cui il piano è stato caricato dal DB. */
  pianoSessionUserIdRef: MutableRefObject<string | null>;
  setPref: Dispatch<SetStateAction<Preferenze>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  setAvatarUrl: Dispatch<SetStateAction<string | null>>;
  setPiano: Dispatch<SetStateAction<'base' | 'pro' | 'free_forever'>>;
  setAbbonato: Dispatch<SetStateAction<boolean>>;
  setPianoStato: Dispatch<SetStateAction<'loading' | 'pronto'>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setNotificheUsate: Dispatch<SetStateAction<number>>;
  setRadarAttivo: Dispatch<SetStateAction<boolean>>;
  setTrialScadenza: Dispatch<SetStateAction<string | null>>;
}

/** Primo effetto di avvio: nessun valore di ritorno. */
export function useProfileBootstrap({
  valutaProfiloIncompleto,
  pianoSessionUserIdRef,
  setPref,
  setLoading,
  setAvatarUrl,
  setPiano,
  setAbbonato,
  setPianoStato,
  setCrediti,
  setNotificheUsate,
  setRadarAttivo,
  setTrialScadenza,
}: OpzioniProfileBootstrap): void {
  // All'avvio, se esiste una sessione Supabase, carica le preferenze salvate nel DB.
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let attivo = true;
    (async () => {
      try {
        const {
          data: { user: au },
        } = await supabase.auth.getUser();
        if (!attivo) return;
        setLoading(false);
        if (!au) return;
        const metaAu = (au.user_metadata ?? {}) as Record<string, unknown>;
        setAvatarUrl(String(metaAu.avatar_url ?? metaAu.picture ?? '').trim() || null);
        // NB: NIENTE colonna `is_free_forever` qui (assente nel DB remoto →
        // errore 42703 che bloccava il piano su 'base'). Il piano si ricava da
        // piano/subscription_tier tramite pianoDaProfilo.
        const COLONNE_PROFILO =
          'province_attive, province_interesse, classi_concorso, ordini_scuola, telegram_chat_id, piano, subscription_tier, abbonamento_scade_il, subscription_status, crediti, notifiche_usate, radar_attivo, favorite_schools, ignored_schools';
        const risposta = await supabase
          .from('profiles')
          .select(COLONNE_PROFILO)
          .eq('id', au.id)
          .maybeSingle();
        /**
         * Colonne OPZIONALI aggiunte da migrazioni successive (`sostegno`,
         * `is_beta_tester`): lette a PARTE, così un errore 42703 su una di esse non
         * fa fallire la lettura principale — era la causa del piano bloccato su
         * 'Base' per chi aveva una promo/PRO omaggio assegnata dal backend.
         */
        let sostegnoDb: boolean | null = null;
        let betaTester = false;
        const opzionali = await supabase
          .from('profiles')
          .select('sostegno, is_beta_tester')
          .eq('id', au.id)
          .maybeSingle();
        if (!opzionali.error && opzionali.data) {
          sostegnoDb = typeof opzionali.data.sostegno === 'boolean' ? opzionali.data.sostegno : null;
          betaTester = opzionali.data.is_beta_tester === true;
        } else if (opzionali.error) {
          const soloSostegno = await supabase
            .from('profiles')
            .select('sostegno')
            .eq('id', au.id)
            .maybeSingle();
          if (!soloSostegno.error && soloSostegno.data) {
            sostegnoDb = typeof soloSostegno.data.sostegno === 'boolean' ? soloSostegno.data.sostegno : null;
          } else {
            console.warn(
              '[profilo] colonne opzionali assenti (sostegno/is_beta_tester): uso i valori locali.',
            );
          }
        }
        const { data, error } = risposta;
        // Diagnostica caricamento profilo: id/email sessione + riga grezza restituita dal DB.
        console.log('[profilo] auth →', { id: au.id, email: au.email ?? '' });
        if (error) console.warn('[profilo] query profiles (per id) fallita:', error.message);
        if (data) console.log('[profilo] riga profiles →', data);
        if (!error && data) {
          // Prova PRO (30 gg) scaduta → ritorno naturale su Base (stato + DB).
          if (provaProScaduta({ ...data, is_beta_tester: betaTester })) {
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
                .eq('id', au.id);
              if (errRevert) {
                console.warn('[onboarding] ritorno a Base non persistito (avvio):', errRevert.message);
              }
            }
          }
          setPref((prev) => ({
            ...prev,
            ordini:
              data.ordini_scuola && data.ordini_scuola.length > 0 ? data.ordini_scuola : prev.ordini,
            provinceCodici:
              data.province_interesse && data.province_interesse.length > 0
                ? data.province_interesse
                : data.province_attive && data.province_attive.length > 0
                  ? data.province_attive
                  : prev.provinceCodici,
            classiCodici:
              data.classi_concorso && data.classi_concorso.length > 0
                ? normalizzaClassi(data.classi_concorso)
                : prev.classiCodici,
            telegramChatId: data.telegram_chat_id ? String(data.telegram_chat_id) : prev.telegramChatId,
            favoriteSchools:
              data.favorite_schools && data.favorite_schools.length > 0
                ? data.favorite_schools
                : prev.favoriteSchools,
            ignoredSchools:
              data.ignored_schools && data.ignored_schools.length > 0
                ? data.ignored_schools
                : prev.ignoredSchools,
            // Preferenza SOSTEGNO: si applica solo se la colonna esiste davvero
            // (boolean); senza migrazione resta il valore locale.
            sostegno: sostegnoDb ?? prev.sostegno,
          }));
          // FASE 6 — piano e scadenza letti dalle colonne REALI di profiles.
          // Fonte canonica: is_free_forever (se presente) oppure gli alias
          // testuali piano/subscription_tier (più `is_beta_tester`) — mai lasciare
          // il default 'Base' in UI per una promo/PRO omaggio assegnata dal backend.
          const pianoCorrente = pianoDaProfilo({ ...data, is_beta_tester: betaTester });
          const periodoOk =
            !data.abbonamento_scade_il || new Date(data.abbonamento_scade_il) > new Date();
          // Piano Free Forever: accesso PRO permanente — mai soggetto a scadenza
          // di pagamento; per gli altri piani casca automaticamente su base.
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
          // Piano confermato dal DB all'avvio: il badge può uscire dal loading.
          setPianoStato('pronto');
          pianoSessionUserIdRef.current = au.id;
        }
        // Mini-onboarding anagrafico: profilo senza nome/cognome?
        void valutaProfiloIncompleto(au.id);
      } catch (err) {
        if (attivo) setLoading(false);
        console.warn('Caricamento profilo da Supabase non riuscito:', (err as Error).message);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [setPref, valutaProfiloIncompleto]);
}

/**
 * Contesto App · anagrafica e profilo su Supabase.
 *
 * Estratto da `useProfiloAccount.ts` (a sua volta da `AppContext.tsx`):
 * salvataggio del profilo (`profiles`), crediti A la Carte a consumo,
 * verifica del profilo incompleto e aggiornamento dei dati anagrafici.
 */
import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { getModuliScaricati } from '@/data/moduli';
import { normalizzaClassi } from '@/lib/matchingEngine';
import { supabase } from '@/lib/supabase';
import type { Preferenze, User } from './types';

/** Dati anagrafici raccolti dal mini-onboarding (nome/cognome obbligatori). */
export interface DatiAnagrafici {
  nome: string;
  cognome: string;
  genere?: 'M' | 'F' | null;
  eta?: number | null;
  /** Provincia di residenza (codice, es. 'RM') — facoltativa: `profiles.provincia`. */
  provincia?: string | null;
}

/** Dipendenze esterne: stati e setter che restano nel provider. */
export interface OpzioniAnagraficaProfilo {
  /** Utente locale (fallback di genere/età quando `profiles` non li ha). */
  user: User | null;
  /** Preferenze correnti (payload di salvataggio su `profiles`). */
  preferenze: Preferenze;
  /** Id Supabase dell'utente autenticato (RPC crediti). */
  supabaseUserId: string | null;
  /** Crediti correnti (valore di ritorno se la RPC fallisce). */
  crediti: number;
  setUser: Dispatch<SetStateAction<User | null>>;
  setPref: Dispatch<SetStateAction<Preferenze>>;
  setCrediti: Dispatch<SetStateAction<number>>;
  setProfiloIncompleto: Dispatch<SetStateAction<boolean>>;
}

/** Azioni di anagrafica/profilo esposte dal contesto. */
export interface AnagraficaProfilo {
  salvaProfilo: (p?: Preferenze) => Promise<void>;
  consumaCredito: () => Promise<{ ok: boolean; crediti: number }>;
  valutaProfiloIncompleto: (userId: string) => Promise<void>;
  aggiornaAnagrafica: (d: DatiAnagrafici) => Promise<void>;
}

export function useAnagraficaProfilo({
  user,
  preferenze,
  supabaseUserId,
  crediti,
  setUser,
  setPref,
  setCrediti,
  setProfiloIncompleto,
}: OpzioniAnagraficaProfilo): AnagraficaProfilo {
  /**
   * PASSO 3 — Persiste le preferenze utente (province di interesse e classi di concorso)
   * direttamente nella tabella `profiles` di Supabase.
   * Richiede una sessione Supabase Auth attiva; altrimenti logga un avviso.
   */
  const salvaProfilo = useCallback(
    async (p?: Preferenze) => {
      if (!supabase) {
        console.warn('Supabase non configurato: profilo non salvato sul database.');
        return;
      }
      const {
        data: { user: authUser },
        error: errUser,
      } = await supabase.auth.getUser();
      if (errUser || !authUser) {
        console.warn('Nessuna sessione Supabase Auth: profilo non salvato (serve un login reale).');
        return;
      }
      const dati = p ?? preferenze;
      const genereFinale = (p?.genere ?? preferenze.genere ?? user?.genere) ?? null;
      const etaFinale = (p?.eta ?? preferenze.eta ?? user?.eta) ?? null;
      // Provincia di RESIDENZA (dato demografico, distinta dalle province del
      // Radar): dal payload esplicito, dalle preferenze o dal profilo locale.
      const provinciaFinale =
        (p?.provincia ?? preferenze.provincia ?? user?.provincia) || null;
      const payload: Record<string, unknown> = {
        id: authUser.id,
        email: authUser.email ?? dati.emailNotifica,
        genere: genereFinale,
        eta: etaFinale,
        provincia: provinciaFinale,
        province_attive: dati.provinceCodici,
        province_interesse: dati.provinceCodici,
        // CLASSI normalizzate in SCRITTURA (A-022 → A-22, dedup): il formato
        // canonico del catalogo evita che, al ricaricamento, una classe scelta
        // risulti non selezionata (casella deselezionata) o duplicata.
        classi_concorso: normalizzaClassi(dati.classiCodici),
        ordini_scuola: dati.ordini,
        moduli_scaricati: getModuliScaricati().map((m) => m.id),
        telegram_chat_id: dati.telegramChatId || null,
        favorite_schools: dati.favoriteSchools,
        ignored_schools: dati.ignoredSchools,
        // Preferenza SOSTEGNO (colonna dedicata, migrazione 20260914040000):
        // `=== true` normalizza anche le preferenze legacy senza il campo.
        sostegno: dati.sostegno === true,
      };
      // NOME e COGNOME: si aggiungono SOLO se valorizzati (mai azzerare un dato già
      // presente). Erano l'anello mancante del funnel Guest → registrazione: il
      // trigger DB di benvenuto salvava solo il nome, così il cognome inserito nel
      // wizard risultava «mancante» e il mini-onboarding lo richiedeva di nuovo.
      const nomeFinale = (user?.nome ?? '').trim();
      const cognomeFinale = (user?.cognome ?? '').trim();
      if (nomeFinale) payload.nome = nomeFinale;
      if (cognomeFinale) payload.cognome = cognomeFinale;
      let { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      // DB non ancora migrato (colonna assente → 42703/PGRST204): si risalva TUTTO
      // il resto senza il campo, altrimenti il profilo non si salva affatto.
      const MIGRAZIONE_COLONNA: Record<string, string> = {
        sostegno: '20260914040000_add_profiles_sostegno.sql',
        provincia: '20260922120000_add_profiles_provincia.sql',
      };
      const assente = Object.keys(MIGRAZIONE_COLONNA).find(
        (col) => error && new RegExp(col, 'i').test(error.message),
      );
      if (error && assente) {
        const payloadRidotto: Record<string, unknown> = { ...payload };
        delete payloadRidotto[assente];
        console.warn(
          `Colonna profiles.${assente} assente: applicare la migrazione ${MIGRAZIONE_COLONNA[assente]} (dato salvato solo in locale).`,
        );
        ({ error } = await supabase
          .from('profiles')
          .upsert(payloadRidotto, { onConflict: 'id' }));
      }
      if (error) {
        console.error('Errore salvataggio profilo su Supabase:', error.message);
      } else {
        console.log('✓ Profilo salvato su Supabase (tabella profiles).');
      }
    },
    [preferenze, user],
  );

  /** Consuma 1 credito a consumo (RPC atomica server-side) e aggiorna il saldo. */
  const consumaCredito = useCallback(async () => {
    if (!supabase || !supabaseUserId) return { ok: false, crediti: crediti };
    const { data, error } = await supabase.rpc('consuma_credito_utente', {
      p_user_id: supabaseUserId,
    });
    if (error) {
      console.error('consumaCredito:', error.message);
      return { ok: false, crediti: crediti };
    }
    const riga =
      Array.isArray(data) && data.length > 0
        ? (data[0] as { ok?: boolean; crediti?: number })
        : null;
    if (riga?.ok) setCrediti(Number(riga.crediti));
    return { ok: Boolean(riga?.ok), crediti: Number(riga?.crediti ?? crediti) };
  }, [supabaseUserId, crediti]);

  /**
   * Verifica su profiles se nome/cognome sono compilati: alimenta il flag
   * `profiloIncompleto` che fa scattare il mini-onboarding anagrafico.
   */
  const valutaProfiloIncompleto = useCallback(async (userId: string): Promise<void> => {
    if (!supabase) {
      setProfiloIncompleto(false);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('nome, cognome')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.warn('Verifica anagrafica profilo non riuscita:', error.message);
      setProfiloIncompleto(false);
      return;
    }
    const nome = String((data as { nome?: string | null } | null)?.nome ?? '').trim();
    const cognome = String((data as { cognome?: string | null } | null)?.cognome ?? '').trim();
    setProfiloIncompleto(!nome || !cognome);
  }, []);

  /** Salva i dati anagrafici sul profilo (profiles) e aggiorna lo stato locale. */
  const aggiornaAnagrafica = useCallback(
    async (d: DatiAnagrafici): Promise<void> => {
      if (!supabase) throw new Error('Supabase non configurato (modalità demo).');
      const { data: sess, error: errSess } = await supabase.auth.getUser();
      if (errSess || !sess.user) throw new Error('Sessione non attiva: effettua il login.');
      const nome = d.nome.trim();
      const cognome = d.cognome.trim();
      const provincia = d.provincia || null;
      const { error } = await supabase.from('profiles').upsert(
        {
          id: sess.user.id,
          email: sess.user.email ?? '',
          nome,
          cognome,
          genere: d.genere ?? null,
          eta: d.eta ?? null,
          // Colonna opzionale (migrazione 20260922120000): tollerata se assente?
          // No: qui l'utente sta SALVANDO i dati, quindi l'errore va mostrato.
          provincia,
        },
        { onConflict: 'id' },
      );
      if (error) throw error;
      setUser((prev) =>
        prev
          ? { ...prev, nome, cognome, genere: d.genere ?? null, eta: d.eta ?? null, provincia }
          : {
              nome,
              cognome,
              genere: d.genere ?? null,
              eta: d.eta ?? null,
              provincia,
              email: sess.user.email ?? '',
              password: '',
            },
      );
      setPref((prev) => ({ ...prev, genere: d.genere ?? null, eta: d.eta ?? null, provincia }));
      setProfiloIncompleto(false);
    },
    [setUser, setPref],
  );

  return { salvaProfilo, consumaCredito, valutaProfiloIncompleto, aggiornaAnagrafica };
}

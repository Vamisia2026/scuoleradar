/**
 * Contesto App · feed degli interpelli (stato, fetch e filtro del profilo).
 *
 * Estratto da `AppContext.tsx` (FASE 3 — Matching Engine): carica gli avvisi dal
 * DB (tabella `interpelli`, fallback legacy `notices`, altrimenti feed VUOTO —
 * nessun dato dimostrativo) e applica i filtri del profilo (province, ordini,
 * classi/materie normalizzate, competenze e parole chiave, scuole ignorate,
 * scadenze attive) + l'AREA SOSTEGNO sempre inclusa entro la provincia.
 *
 * `loading` resta nel provider: lo usano gli effetti di bootstrap del profilo.
 */
import { useEffect, useMemo, useState } from 'react';
import { classeByCodice } from '@/data/classiConcorso';
import { interpelli, type Interpello } from '@/data/interpelli';
import { limitaSelezione } from '@/lib/planLimits';
import {
  avvisoDiSostegno,
  competenzaCompatibileConAvviso,
  getFeedInterpelli,
  normalizzaClasse,
} from '@/lib/matchingEngine';
import { eInterpelloAttivo } from '@/lib/scadenza';
import { supabase } from '@/lib/supabase';
import { mapNoticiaToInterpello } from './helpers';
import type { Preferenze } from './types';

/** Feed di interpelli pronto per la dashboard. */
export interface FeedInterpelli {
  /** Avvisi ricevuti dal DB (vuoto se non c'è nulla di attivo). */
  fontiInterpelli: Interpello[];
  /** Origine degli avvisi mostrati. */
  origineDati: 'vuoto' | 'supabase';
  /** Avvisi del feed filtrati con le regole del profilo. */
  interpelliFiltrati: Interpello[];
}

export function useInterpelliFeed(
  preferenze: Preferenze,
  /**
   * Tetti del piano CONFERMATO (`null`/assente = piano non ancora letto: nessun
   * limite). Limitano l'**uso** — query al DB e filtri — senza toccare i dati
   * salvati: le province/classi oltre il tetto restano nelle preferenze e si
   * riattivano appena il piano torna PRO.
   */
  tetti?: { province: number; classi: number } | null,
): FeedInterpelli {
  // Fonte degli interpelli (FASE 3 — Matching Engine):
  // 1. tabella `interpelli` filtrata per province/classi del profilo,
  // 2. fallback sulla tabella legacy `notices`,
  // 3. se non c'è nessun avviso attivo → feed VUOTO (nessun dato dimostrativo:
  //    `interpelli` in `src/data/interpelli.ts` è intenzionalmente `[]`).
  const [fontiInterpelli, setFontiInterpelli] = useState<Interpello[]>(interpelli);
  const [origineDati, setOrigineDati] = useState<'vuoto' | 'supabase'>('vuoto');

  /**
   * SELEZIONE ATTIVA per il piano corrente (tetti confermati dal DB): il feed usa
   * le prime voci e ignora le eccedenti, ma i dati salvati restano INTATTI.
   */
  const provinceAttive = useMemo(
    () => limitaSelezione(preferenze.provinceCodici, tetti?.province ?? Number.POSITIVE_INFINITY),
    [preferenze.provinceCodici, tetti?.province],
  );
  const classiAttive = useMemo(
    () => limitaSelezione(preferenze.classiCodici, tetti?.classi ?? Number.POSITIVE_INFINITY),
    [preferenze.classiCodici, tetti?.classi],
  );

  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    (async () => {
      try {
        // Matching Engine: query `interpelli` per le province e le classi del profilo
        const feed = await getFeedInterpelli(supabase, {
          province: provinceAttive,
          classi: classiAttive,
        });
        if (!attivo) return;
        if (feed && feed.length > 0) {
          setFontiInterpelli(feed);
          setOrigineDati('supabase');
          console.log(
            `✓ Dashboard: ${feed.length} interpelli reali dal Matching Engine (tabella interpelli).`,
          );
          return;
        }

        // Fallback: tabella legacy `notices` (popolata dallo scraper)
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .order('expiration_date', { ascending: true })
          .limit(100);
        if (!attivo) return;
        if (!error && data && data.length > 0) {
          setFontiInterpelli(data.map(mapNoticiaToInterpello));
          setOrigineDati('supabase');
          console.log(`✓ Dashboard: ${data.length} interpelli reali caricati da Supabase (notices).`);
        } else {
          console.warn(
            error
              ? `Errore lettura notices: ${error.message}`
              : 'Nessun interpello attivo nel DB: feed vuoto (nessun dato dimostrativo).',
          );
          setFontiInterpelli(interpelli);
          setOrigineDati('vuoto');
        }
      } catch (err) {
        if (!attivo) return;
        console.warn('Fetch interpelli non riuscito: feed vuoto.', (err as Error).message);
        setFontiInterpelli(interpelli);
        setOrigineDati('vuoto');
      }
    })();
    return () => {
      attivo = false;
    };
  }, [provinceAttive, classiAttive]);

  const interpelliFiltrati = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
    // Normalizzazione classi (A-026 ≡ A-26 ≡ A042): senza di essa il feed
    // dell'utente può risultare VUOTO pur avendo interpelli compatibili.
    const classiSelezionateNorm = new Set(classiAttive.map(normalizzaClasse));
    const classiSelezionate = classiAttive
      .map((cod) => classeByCodice(cod))
      .filter(Boolean);
    const materieDelleClassi = new Set(classiSelezionate.flatMap((c) => c!.materie));
    const tutteLeMaterie = new Set([
      ...preferenze.materieId,
      ...preferenze.materieCustom.map((m) => m.toLowerCase()),
    ]);
    return fontiInterpelli.filter((i) => {
      const matchProvincia =
        provinceAttive.length === 0 || provinceAttive.includes(i.provinciaCodice);
      const matchOrdine =
        preferenze.ordini.length === 0 || preferenze.ordini.includes(i.ordine);
      const classe = classeByCodice(i.classeCodice);
      // Match per tutte le classi rilevate (i dati reali di notices hanno class_codes[]),
      // con confronto NORMALIZZATO dei codici (A-026 ≡ A-26 ≡ A042).
      const matchClasse =
        classiAttive.length === 0 ||
        (i.classiCodes?.some((c) => classiSelezionateNorm.has(normalizzaClasse(c))) ?? false) ||
        classiSelezionateNorm.has(normalizzaClasse(i.classeCodice));
      const matchMateria =
        tutteLeMaterie.size === 0 ||
        (classe ? classe.materie.some((m) => tutteLeMaterie.has(m)) : false);
      const matchMaterieDelleClassi =
        materieDelleClassi.size === 0 ||
        (classe ? classe.materie.some((m) => materieDelleClassi.has(m)) : false);
      // COMPETENZE E PAROLE CHIAVE (testo libero): la parola scritta dall'utente
      // («Lingua inglese», «Intelligenza artificiale») non è un id di catalogo,
      // quindi il confronto con `classe.materie` non poteva mai combaciare e la
      // sezione restava vuota. Il testo dell'avviso si confronta con la STESSA
      // funzione del motore di notifica: una sola regola, nessuna copia.
      const matchCompetenze = competenzaCompatibileConAvviso(
        { materieId: preferenze.materieId, materieCustom: preferenze.materieCustom },
        { materia: i.materia, titolo: i.titolo, classi: i.classiCodes },
      );
      // AREA SOSTEGNO: INCLUSIONE PERMANENTE (policy 04/10/2026). Gli avvisi di
      // sostegno (ADAA/ADEE/ADMM/ADSS — o titolo/materia che lo dichiarano) sono
      // sempre compatibili entro la provincia, esattamente come nel motore di
      // notifica (`avvisoDiSostegno`): stessa regola, un solo punto di verità.
      // Nessun opt-out e nessuna preferenza: la bacheca mostra le stesse
      // opportunità che il Radar consegna.
      const matchSostegno = avvisoDiSostegno({
        classi: i.classiCodes,
        titolo: i.titolo,
        materia: i.materia,
      });
      // Filtri Avanzati Scuole: nascondi gli avvisi delle scuole in ignoredSchools.
      // Il match considera istituto + titolo (i dati reali di notices non hanno un campo scuola).
      const scuolaTesto = `${i.istituto} ${i.titolo}`.toLowerCase();
      const matchScuolaNonEsclusa =
        preferenze.ignoredSchools.length === 0 ||
        !preferenze.ignoredSchools.some((s) => s && scuolaTesto.includes(s.toLowerCase()));
      // Esclude gli interpelli SCADUTI dalle liste attive pubbliche.
      const nonScaduto = eInterpelloAttivo(i.dataScadenza);
      return (
        matchProvincia &&
        matchOrdine &&
        (matchClasse || matchMateria || matchMaterieDelleClassi || matchCompetenze || matchSostegno) &&
        matchScuolaNonEsclusa &&
        nonScaduto
      );
    });
  }, [preferenze, fontiInterpelli, provinceAttive, classiAttive]);

  return { fontiInterpelli, origineDati, interpelliFiltrati };
}

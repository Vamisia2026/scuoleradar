/**
 * Contesto App · feed degli interpelli (stato, fetch e bacheca del profilo).
 *
 * Carica gli avvisi dal DB (tabella `interpelli`, fallback legacy `notices`,
 * altrimenti feed VUOTO — nessun dato dimostrativo) e lascia alla bacheca pura
 * (`src/lib/bachecaInterpelli.ts`) il filtro del profilo e il punteggio.
 *
 * LE 5 MODALI DEL RADAR (§26.56): ordine di scuola, classi di concorso, parole
 * chiave, provincia (raggio 60 km) e filtri scuole. La ricerca allarga le province
 * al raggio (`provinceDiRicerca`), il punteggio è la media delle modali applicabili
 * con il jolly del 3% (`valutaCompatibilita`) e le scuole preferite entrano
 * d'ufficio. La CONSEGNA non passa di qui: notifiche e digest restano strict
 * (§26.45).
 *
 * `loading` resta nel provider: lo usano gli effetti di bootstrap del profilo.
 */
import { useEffect, useMemo, useState } from 'react';
import { interpelli, type Interpello } from '@/data/interpelli';
import { bachecaInterpelli } from '@/lib/bachecaInterpelli';
import { limitaSelezione } from '@/lib/planLimits';
import { getFeedInterpelli } from '@/lib/matchingEngine';
import { provinceDiRicerca } from '@/lib/prossimitaGeografica';
import { supabase } from '@/lib/supabase';
import { mapNoticiaToInterpello } from './helpers';
import type { Preferenze } from './types';

/** Feed di interpelli pronto per la dashboard. */
export interface FeedInterpelli {
  /** Avvisi ricevuti dal DB (vuoto se non c'è nulla di attivo). */
  fontiInterpelli: Interpello[];
  /** Origine degli avvisi mostrati. */
  origineDati: 'vuoto' | 'supabase';
  /** Avvisi del feed filtrati con le regole del profilo e delle 5 modali. */
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

  /**
   * Province da CERCARE: le proprie + quelle entro il raggio dei 60 km
   * (Modalità 4). La consegna (notifiche/digest) resta strict sulle province
   * scelte.
   */
  const provinceRicerca = useMemo(() => provinceDiRicerca(provinceAttive), [provinceAttive]);

  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    (async () => {
      try {
        // Matching Engine: province (proprie + entro il raggio) e classi del profilo
        const feed = await getFeedInterpelli(supabase, {
          province: provinceRicerca,
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
  }, [provinceRicerca, classiAttive]);

  const interpelliFiltrati = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
    // BACHECA (pura): pertinenza, punteggio delle 5 modali, whitelist/blacklist
    // scuole e cap dinamico dei riempitivi vivono in un solo modulo testabile.
    return bachecaInterpelli(fontiInterpelli, {
      ordini: preferenze.ordini,
      classi: classiAttive,
      materieId: preferenze.materieId,
      materieCustom: preferenze.materieCustom,
      province: provinceAttive,
      favoriteSchools: preferenze.favoriteSchools,
      ignoredSchools: preferenze.ignoredSchools,
    }).lista;
  }, [preferenze, fontiInterpelli, provinceAttive, classiAttive]);

  return { fontiInterpelli, origineDati, interpelliFiltrati };
}

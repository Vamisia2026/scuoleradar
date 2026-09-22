/**
 * Contesto App · feed degli interpelli (stato, fetch e filtro del profilo).
 *
 * Estratto da `AppContext.tsx` (FASE 3 — Matching Engine): carica gli avvisi dal
 * DB (tabella `interpelli`, fallback legacy `notices`, altrimenti feed VUOTO —
 * nessun dato dimostrativo) e applica i filtri del profilo (province, ordini,
 * classi/materie normalizzate, scuole ignorate, scadenze attive).
 *
 * `loading` resta nel provider: lo usano gli effetti di bootstrap del profilo.
 */
import { useEffect, useMemo, useState } from 'react';
import { classeByCodice } from '@/data/classiConcorso';
import { interpelli, type Interpello } from '@/data/interpelli';
import { getFeedInterpelli, normalizzaClasse } from '@/lib/matchingEngine';
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

export function useInterpelliFeed(preferenze: Preferenze): FeedInterpelli {
  // Fonte degli interpelli (FASE 3 — Matching Engine):
  // 1. tabella `interpelli` filtrata per province/classi del profilo,
  // 2. fallback sulla tabella legacy `notices`,
  // 3. se non c'è nessun avviso attivo → feed VUOTO (nessun dato dimostrativo:
  //    `interpelli` in `src/data/interpelli.ts` è intenzionalmente `[]`).
  const [fontiInterpelli, setFontiInterpelli] = useState<Interpello[]>(interpelli);
  const [origineDati, setOrigineDati] = useState<'vuoto' | 'supabase'>('vuoto');

  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    (async () => {
      try {
        // Matching Engine: query `interpelli` per le province e le classi del profilo
        const feed = await getFeedInterpelli(supabase, {
          province: preferenze.provinceCodici,
          classi: preferenze.classiCodici,
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
  }, [preferenze.provinceCodici, preferenze.classiCodici]);

  const interpelliFiltrati = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
    // Normalizzazione classi (A-026 ≡ A-26 ≡ A042): senza di essa il feed
    // dell'utente può risultare VUOTO pur avendo interpelli compatibili.
    const classiSelezionateNorm = new Set(preferenze.classiCodici.map(normalizzaClasse));
    const classiSelezionate = preferenze.classiCodici
      .map((cod) => classeByCodice(cod))
      .filter(Boolean);
    const materieDelleClassi = new Set(classiSelezionate.flatMap((c) => c!.materie));
    const tutteLeMaterie = new Set([
      ...preferenze.materieId,
      ...preferenze.materieCustom.map((m) => m.toLowerCase()),
    ]);
    return fontiInterpelli.filter((i) => {
      const matchProvincia =
        preferenze.provinceCodici.length === 0 || preferenze.provinceCodici.includes(i.provinciaCodice);
      const matchOrdine =
        preferenze.ordini.length === 0 || preferenze.ordini.includes(i.ordine);
      const classe = classeByCodice(i.classeCodice);
      // Match per tutte le classi rilevate (i dati reali di notices hanno class_codes[]),
      // con confronto NORMALIZZATO dei codici (A-026 ≡ A-26 ≡ A042).
      const matchClasse =
        preferenze.classiCodici.length === 0 ||
        (i.classiCodes?.some((c) => classiSelezionateNorm.has(normalizzaClasse(c))) ?? false) ||
        classiSelezionateNorm.has(normalizzaClasse(i.classeCodice));
      const matchMateria =
        tutteLeMaterie.size === 0 ||
        (classe ? classe.materie.some((m) => tutteLeMaterie.has(m)) : false);
      const matchMaterieDelleClassi =
        materieDelleClassi.size === 0 ||
        (classe ? classe.materie.some((m) => materieDelleClassi.has(m)) : false);
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
        (matchClasse || matchMateria || matchMaterieDelleClassi) &&
        matchScuolaNonEsclusa &&
        nonScaduto
      );
    });
  }, [preferenze, fontiInterpelli]);

  return { fontiInterpelli, origineDati, interpelliFiltrati };
}

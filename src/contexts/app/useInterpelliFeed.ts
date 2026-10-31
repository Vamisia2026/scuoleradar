/**
 * Contesto App · feed degli interpelli (stato, fetch e bacheca del profilo).
 *
 * Carica gli avvisi dal DB (tabella `interpelli`, fallback legacy `notices`,
 * altrimenti feed VUOTO — nessun dato dimostrativo) e lascia alla bacheca pura
 * (`src/lib/bachecaInterpelli.ts`) il filtro del profilo e il punteggio.
 *
 * IL PUNTEGGIO HA DUE LIVELLI (§26.63). Le preferenze PRIMARIE — ordine di scuola,
 * classi di concorso (peso 2), provincia (raggio 60 km) — fanno il match, il voto
 * (media ponderata, `src/lib/mediaModali.ts`) e la PORTA D'INGRESSO della bacheca;
 * competenze e parole chiave libere sono un livello SECONDARIO che **sfuma** soltanto
 * il voto, dentro il tetto `CAP_COMPETENZE` (25 punti): non aprono la bacheca e non
 * promuovono un avviso sotto soglia. Il jolly in percentuale della «Modalità 3» è
 * RITIRATO (nessun override d'ufficio). La ricerca allarga le province al raggio
 * (`provinceDiRicerca`), le scuole preferite entrano d'ufficio e il voto arriva da
 * `valutaCompatibilita` (`src/lib/compatibilitaGraduata.ts`). La CONSEGNA non passa
 * di qui: notifiche e digest restano strict (§26.45).
 *
 * VETRINA MAI CORTA (§26.111). Il paracadute «5» della bacheca pesca dalla scorta
 * della STESSA area: se la provincia non ha cinque avvisi attivi (Asti: zero), la
 * pagina resterebbe vuota senza dirlo. Qui, sotto il minimo, il feed si allarga
 * prima alla REGIONE e poi all'ITALIA (`integraAmbiti`): ogni riga aggiunta porta
 * l'`ambito` dichiarato e arriva senza voto, così non sale mai in cima.
 *
 * `loading` resta nel provider: lo usano gli effetti di bootstrap del profilo.
 */
import { useEffect, useMemo, useState } from 'react';
import { interpelli, type Interpello } from '@/data/interpelli';
import { bachecaInterpelli } from '@/lib/bachecaInterpelli';
import { limitaSelezione } from '@/lib/planLimits';
import { getFeedInterpelli } from '@/lib/matchingEngine';
import { provinceDiRicerca } from '@/lib/prossimitaGeografica';
import { MINIMO_BACHECA } from '@/lib/riempitivi';
import { vetrinaConAmbiti, vetrinaVisibile } from '@/lib/vetrinaBacheca';
import { supabase } from '@/lib/supabase';
import { mapNoticiaToInterpello } from './helpers';
import type { Preferenze } from './types';

/**
 * Righe chieste al database per il feed della dashboard.
 *
 * Era **100**: un tetto arbitrario che mostrava 100 opportunità su 400 attive
 * senza dichiararlo — il conteggio dell'accordion e le card parlavano di una
 * popolazione troncata. 1.000 è la pagina massima che PostgREST consegna in una
 * risposta; oltre quella soglia si pagina (il «Radar Live» lo fa già con
 * `flightBoard/letturaBoard.ts`). Un limite ESPLICITO, non un numero scelto a
 * caso nel chiamante.
 */
const RIGHE_FEED = 1_000;

/** Feed di interpelli pronto per la dashboard. */
export interface FeedInterpelli {
  /** Avvisi ricevuti dal DB (vuoto se non c'è nulla di attivo). */
  fontiInterpelli: Interpello[];
  /** Origine degli avvisi mostrati. */
  origineDati: 'vuoto' | 'supabase';
  /** Avvisi del feed filtrati con le regole del profilo: porta d'ingresso primaria e voto a due livelli (§26.63). */
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
   * Feed LARGO (§26.111): gli avvisi fuori dalla provincia, chiesti al database
   * solo quando la vetrina della propria zona resta sotto `MINIMO_BACHECA`.
   * Effimero: non sostituisce `fontiInterpelli` e non entra mai nella bacheca.
   */
  const [fontiAmbito, setFontiAmbito] = useState<Interpello[]>([]);

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
          limit: RIGHE_FEED,
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

        // Calcolo della data limite a 15 giorni per il fallback su notices
        const oggiIso = new Date().toISOString();
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() + 15);
        const limiteIso = dataLimite.toISOString();

        // Fallback: tabella legacy `notices` (popolata dallo scraper) filtrata rigorosamente entro 15 giorni
        const { data, error } = await supabase
          .from('notices')
          .select('*')
          .gte('expiration_date', oggiIso)
          .lte('expiration_date', limiteIso)
          .order('expiration_date', { ascending: true })
          .order('id', { ascending: true })
          .limit(RIGHE_FEED);

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

  /**
   * BACHECA DEL PROFILO (pura): porta d'ingresso PRIMARIA, voto a due livelli
   * (§26.63), whitelist/blacklist scuole, cap dinamico dei riempitivi e
   * paracadute «5» che pesca dalla scorta dell'area (§26.106).
   */
  const bacheca = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
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

  /**
   * VETRINA della provincia: le righe della bacheca che la pagina mostrerà davvero
   * (gate identitario, §26.119). Il minimo si conta QUI: contarlo sulla bacheca
   * faceva credere al feed di avere già cinque posti pieni mentre la pagina ne
   * scartava cinque su cinque — l'utente vedeva zero con il Radar pieno.
   */
  const vetrina = useMemo<Interpello[]>(() => vetrinaVisibile(bacheca), [bacheca]);

  /** Quante opportunità mancano al minimo di vetrina (§26.111). */
  const mancantiVetrina = preferenze.onboarded
    ? Math.max(0, MINIMO_BACHECA - vetrina.length)
    : 0;

  /**
   * Integrazione fuori provincia: UNA query larga (senza filtro geografico, con
   * le classi del profilo) SOLO quando serve davvero, cioè quando la propria zona
   * non arriva a `MINIMO_BACHECA`. Nessun ciclo: la condizione dipende dalla
   * bacheca, mai dalla lista integrata.
   */
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    if (mancantiVetrina === 0) {
      setFontiAmbito([]);
      return;
    }
    let attivo = true;
    (async () => {
      try {
        const ampio = await getFeedInterpelli(client, { classi: classiAttive, limit: RIGHE_FEED });
        if (!attivo) return;
        setFontiAmbito(ampio ?? []);
        console.log(
          `✓ Dashboard: ${(ampio ?? []).length} avvisi fuori provincia caricati (la tua zona ne ha meno di ${MINIMO_BACHECA}).`,
        );
      } catch (err) {
        if (!attivo) return;
        setFontiAmbito([]);
        console.warn('Feed regionale/nazionale non disponibile.', (err as Error).message);
      }
    })();
    return () => {
      attivo = false;
    };
  }, [mancantiVetrina, classiAttive]);

  /**
   * VETRINA: provincia → regione → Italia, fino al minimo (§26.111), contando solo le
   * righe che la pagina mostrerà davvero (§26.119). La regola vive in un modulo PURO
   * (`lib/vetrinaBacheca`): contare la BACHECA invece della vetrina faceva credere al
   * feed di avere già cinque posti pieni mentre la pagina ne scartava cinque su cinque.
   */
  const interpelliFiltrati = useMemo<Interpello[]>(() => {
    if (!preferenze.onboarded) return [];
    return vetrinaConAmbiti(bacheca, { fuori: fontiAmbito, province: provinceAttive });
  }, [preferenze.onboarded, bacheca, fontiAmbito, provinceAttive]);

  return { fontiInterpelli, origineDati, interpelliFiltrati };
}

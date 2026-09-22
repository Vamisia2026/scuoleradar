/**
 * Scadenze — coda in rotazione per il carosello Revolver (dati + orologio).
 *
 * Estratto da `useRevolverCarosello.ts`: applica subito il fallback locale per
 * il render immediato, poi l'override remoto (`caricaScadenzeMaster`), tiene
 * fresco l'orologio (tick 30 s, incluso il rollover a mezzanotte) e calcola la
 * coda dei `limite` appuntamenti più vicini con il clone di testa per il loop.
 *
 * Solo dati: nessun riferimento al DOM, alla posizione del track o al gesto.
 */
import { useEffect, useMemo, useState } from 'react';
import type { DeadlineRecord, ScadenzaProiettata } from '../types';
import { codaScadenze } from '../engine';
import { caricaScadenzeMaster, scadenzeFallback } from '../deadlinesService';

/** Frequenza tick orologio con cui la coda verifica le scadenze. */
const TICK_OROLOGIO_MS = 30_000;

/** Coda pronta per il carosello (riusabile da qualunque vista delle scadenze). */
export interface CodaScadenze {
  /** I `limite` appuntamenti più vicini, ordinati per tempo. */
  coda: ScadenzaProiettata[];
  /** Coda + clone di testa: rende il ritorno ultimo→primo uno scorrimento LTR. */
  piste: ScadenzaProiettata[];
  /** Numero di slide logici (senza il clone di testa). */
  totale: number;
}

export function useCodaScadenze(limite: number): CodaScadenze {
  // Dati: prima il fallback locale (render immediato), poi l'override remoto.
  const [righe, setRighe] = useState<DeadlineRecord[]>(() => [...scadenzeFallback]);
  // Orologio del widget: avanza ogni 30 s → la coda si auto-aggiorna.
  const [ora, setOra] = useState<Date>(() => new Date());
  // Override dinamico: Supabase/API quando disponibile, altrimenti fallback.
  useEffect(() => {
    let attivo = true;
    caricaScadenzeMaster()
      .then((r) => {
        if (attivo) setRighe(r.lista);
      })
      .catch(() => {
        if (attivo) setRighe([...scadenzeFallback]);
      });
    return () => {
      attivo = false;
    };
  }, []);

  // Tick orologio: mantiene la coda fresca (incluso rollover a mezzanotte).
  useEffect(() => {
    const t = window.setInterval(() => setOra(new Date()), TICK_OROLOGIO_MS);
    return () => window.clearInterval(t);
  }, []);

  // Coda dei `limite` appuntamenti più vicini (10 default), ordinati per tempo.
  const coda = useMemo(
    () => codaScadenze(righe, ora, limite),
    [righe, ora, limite],
  );
  const totale = coda.length;
  // Il clone in coda al track rende il ritorno 9→0 uno scorrimento LTR continuo.
  const piste = useMemo(
    () => (totale > 0 ? [...coda, coda[0]] : []),
    [coda, totale],
  );

  return { coda, piste, totale };
}

/**
 * Scadenze — motore del carosello «Revolver» (behavior-only, nessun JSX).
 *
 * Estratto da `RevolverScadenze.tsx`: posizione del track, misura del viewport
 * (ResizeObserver), autoplay, snap del clone di testa, navigazione manuale
 * (`vaiA`/`avanti`/`indietro`) e gesture di trascinamento (touch + mouse, con
 * effetto gomma). Dati, orologio e coda arrivano da `useCodaScadenze`.
 *
 * Il componente resta di sola composizione: monta i sotto-componenti con i
 * valori restituiti da questo hook. Le costanti di temporizzazione vivono qui,
 * insieme al comportamento che le usa.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ScadenzaProiettata } from '../types';
import { useCodaScadenze } from './useCodaScadenze';

/** Durata transizione CSS del track (sincronizzata con index.css). */
const DURATA_TRANSIZIONE_MS = 620;
/** Soglia (px) oltre la quale uno swipe cambia slide (touch/mouse). */
const SOGLIA_SWIPE_PX = 44;
/** Distanza (px) oltre la quale il trascinamento rallenta (effetto gomma). */
const LIMITE_TRASCINAMENTO_PX = 140;

/** Parametri del carosello (dal componente pubblico). */
export interface UseRevolverCaroselloOptions {
  /** Lunghezza della coda mostrata (Queue Limit). */
  limite: number;
  /** Intervallo autoplay in ms. */
  intervallo: number;
}

/**
 * Stato e azioni del carosello, consumati dal JSX del contenitore.
 * I valori sono già pronti per il render: nessuna logica di presentazione.
 */
export interface RevolverCarosello {
  /** Viewport del carosello: riferimento per misura e pointer capture. */
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  /** Coda correntemente in rotazione (`limite` scadenze più vicine). */
  coda: ScadenzaProiettata[];
  /** Coda + clone di testa per il loop LTR continuo. */
  piste: ScadenzaProiettata[];
  /** Numero di slide logici (senza il clone di testa). */
  totale: number;
  /** Posizione del track (0..totale). */
  pos: number;
  /** Indice dello slide visibile (0..totale-1, clone di testa incluso). */
  indiceVisibile: number;
  /** Larghezza reale (px) di uno slide, misurata dal viewport. */
  larghezza: number;
  /** false = il track si muove senza transizione (snap del clone). */
  conAnimazione: boolean;
  /** true durante uno swipe/trascinamento. */
  trascinando: boolean;
  /** Offset corrente dello swipe in px (con effetto gomma). */
  dragX: number;
  /** true quando il mouse/focus è sopra il widget. */
  inPausa: boolean;
  /** true se l'utente richiede movimento ridotto. */
  ridotto: boolean;
  /** Aggiorna lo stato di pausa (hover/focus sul widget). */
  setInPausa: (valore: boolean) => void;
  /** Naviga a uno slide logico (0..totale-1). */
  vaiA: (indice: number) => void;
  /** Slide successivo (autoplay e freccia destra). */
  avanti: () => void;
  /** Slide precedente (freccia sinistra). */
  indietro: () => void;
  /** Swipe: inizio, movimento, rilascio, annullamento. */
  inizioTrascinamento: (x: number) => void;
  muoviTrascinamento: (x: number) => void;
  fineTrascinamento: () => void;
  annullaTrascinamento: () => void;
}

export function useRevolverCarosello({
  limite,
  intervallo,
}: UseRevolverCaroselloOptions): RevolverCarosello {
  // Coda in rotazione (dati master + orologio): hook dedicato `useCodaScadenze`.
  const { coda, piste, totale } = useCodaScadenze(limite);
  // Posizione del track (0..totale; `totale` = clone di testa per loop LTR).
  const [pos, setPos] = useState(0);
  const [conAnimazione, setConAnimazione] = useState(true);
  const [inPausa, setInPausa] = useState(false);
  const [ridotto, setRidotto] = useState(false);

  // Larghezza REALE (px) di uno slide = viewport del carosello. Il track si
  // sposta di multipli ESATTI di questa misura: così lo slide resta allineato
  // a QUALSIASI breakpoint (mobile/tablet/desktop), senza le ambiguità del
  // `translateX(percentuale)` su un flex-container a larghezza automatica.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [larghezza, setLarghezza] = useState(0);

  // Stato del trascinamento (swipe touch/mouse): offset corrente in px.
  const dragRef = useRef<{ attivo: boolean; partenzaX: number; deltaX: number }>({
    attivo: false,
    partenzaX: 0,
    deltaX: 0,
  });
  const [trascinando, setTrascinando] = useState(false);
  const [dragX, setDragX] = useState(0);

  // Rispetto di prefers-reduced-motion: nessun movimento se ridotto.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const aggiorna = (): void => setRidotto(mq.matches);
    aggiorna();
    if (mq.addEventListener) {
      mq.addEventListener('change', aggiorna);
      return () => mq.removeEventListener('change', aggiorna);
    }
    mq.addListener(aggiorna);
    return () => mq.removeListener(aggiorna);
  }, []);

  // Misura continua della larghezza dello slide: il carosello resta allineato
  // anche a rotazione schermo / passaggio di breakpoint (mobile ↔ tablet).
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const misura = (): void => setLarghezza(el.clientWidth);
    misura();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', misura);
      return () => window.removeEventListener('resize', misura);
    }
    const ro = new ResizeObserver(misura);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Se la coda si accorcia (item scaduti rimossi) riporta la posizione in range.
  useEffect(() => {
    if (totale === 0) {
      setPos(0);
      return;
    }
    setPos((p) => Math.min(p, totale));
  }, [totale]);

  const indiceVisibile = totale > 0 ? pos % totale : 0;

  /** Navigazione manuale verso uno slide logico (0..totale-1). */
  function vaiA(indice: number): void {
    if (totale === 0) return;
    const target = ((indice % totale) + totale) % totale;
    if (pos === totale) {
      // Se è esposto il clone di testa, riallinea prima a 0 senza transizione.
      setConAnimazione(false);
      setPos(0);
      window.setTimeout(() => {
        setConAnimazione(true);
        setPos(target);
      }, 30);
      return;
    }
    setConAnimazione(true);
    setPos(target);
  }

  // Autoplay: avanza di uno slide ogni `intervallo` (5 s di default).
  useEffect(() => {
    if (totale <= 1 || inPausa || ridotto || trascinando) return;
    const t = window.setTimeout(() => {
      setPos((p) => (p >= totale ? p : p + 1));
    }, intervallo);
    return () => window.clearTimeout(t);
  }, [pos, totale, inPausa, ridotto, trascinando, intervallo]);

  // Quando il track arriva sul clone di testa, riscatta a 0 senza transizione.
  useEffect(() => {
    if (totale === 0 || pos !== totale) return;
    const t = window.setTimeout(() => {
      setConAnimazione(false);
      setPos(0);
    }, DURATA_TRANSIZIONE_MS);
    return () => window.clearTimeout(t);
  }, [pos, totale]);

  // Riattiva la transizione subito dopo lo snap del clone.
  useEffect(() => {
    if (conAnimazione) return;
    const t = window.setTimeout(() => setConAnimazione(true), 60);
    return () => window.clearTimeout(t);
  }, [conAnimazione]);

  const avanti = (): void => vaiA(indiceVisibile + 1);
  const indietro = (): void => vaiA(indiceVisibile - 1);

  /* ----------------------- Swipe (touch + mouse) ----------------------- */

  /** Inizio trascinamento: memorizza il punto di partenza (clientX). */
  function inizioTrascinamento(x: number): void {
    if (totale <= 1) return;
    dragRef.current = { attivo: true, partenzaX: x, deltaX: 0 };
    setTrascinando(true);
    setDragX(0);
  }

  /**
   * Movimento: applica l'offset con un leggero attrito oltre la soglia
   * (effetto "gomma") per evitare scivolamenti eccessivi.
   */
  function muoviTrascinamento(x: number): void {
    const drag = dragRef.current;
    if (!drag.attivo) return;
    const delta = x - drag.partenzaX;
    drag.deltaX = delta;
    const oltre = Math.abs(delta) - LIMITE_TRASCINAMENTO_PX;
    const limitato =
      oltre > 0
        ? Math.sign(delta) * (LIMITE_TRASCINAMENTO_PX + oltre * 0.15)
        : delta;
    setDragX(limitato);
  }

  /** Rilascio: se lo spostamento supera la soglia cambia slide, altrimenti torna. */
  function fineTrascinamento(): void {
    const drag = dragRef.current;
    if (!drag.attivo) return;
    drag.attivo = false;
    const delta = drag.deltaX;
    drag.deltaX = 0;
    setTrascinando(false);
    setDragX(0);
    if (Math.abs(delta) >= SOGLIA_SWIPE_PX) {
      if (delta < 0) vaiA(indiceVisibile + 1);
      else vaiA(indiceVisibile - 1);
    }
  }

  /** Annullamento (pointercancel, uscita): riporta il track senza cambiare slide. */
  function annullaTrascinamento(): void {
    const drag = dragRef.current;
    if (!drag.attivo) return;
    drag.attivo = false;
    drag.deltaX = 0;
    setTrascinando(false);
    setDragX(0);
  }
  return {
    viewportRef,
    coda,
    piste,
    totale,
    pos,
    indiceVisibile,
    larghezza,
    conAnimazione,
    trascinando,
    dragX,
    inPausa,
    ridotto,
    setInPausa,
    vaiA,
    avanti,
    indietro,
    inizioTrascinamento,
    muoviTrascinamento,
    fineTrascinamento,
    annullaTrascinamento,
  };
}
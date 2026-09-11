/**
 * ScuoleRadar.it — Revolver Scadenze (Horizontal Carousel Widget).
 *
 * Carosello orizzontale SINISTRA→DESTRA che cicla automaticamente (default
 * 5 s) tra le prime `limite` scadenze attive della coda (10 = Queue Limit),
 * con transizione CSS fluida, dots + barra di avanzamento, controlli manuali
 * e pause al passaggio del mouse. L'orologio interno (tick 30 s) fa decadere
 * gli item scaduti e fa entrare in rotazione il successivo in ordine di tempo.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { DeadlineRecord, ScadenzaProiettata } from '../types';
import { codaScadenze, formattaPeriodo, LIMITE_CODA_SCADENZE } from '../engine';
import { caricaScadenzeMaster, scadenzeFallback } from '../deadlinesService';

/** Durata transizione CSS del track (sincronizzata con index.css). */
const DURATA_TRANSIZIONE_MS = 620;
/** Frequenza tick orologio con cui la coda verifica le scadenze. */
const TICK_OROLOGIO_MS = 30_000;
/** Soglia (px) oltre la quale uno swipe cambia slide (touch/mouse). */
const SOGLIA_SWIPE_PX = 44;
/** Distanza (px) oltre la quale il trascinamento rallenta (effetto gomma). */
const LIMITE_TRASCINAMENTO_PX = 140;

/**
 * RIGA 3 — Descrizione sintetica dell'evento/attività, in MAIUSCOLO.
 * Esempi: "LAVORETTO HALLOWEEN", "PROVE INVALSI", "IMMATRICOLAZIONE UNIVERSITÀ",
 * "DICHIARAZIONE 730", "TFA SOSTEGNO", "TASSE UNIVERSITARIE".
 */
function descrizioneScadenza(occ: ScadenzaProiettata): string {
  const categoria = (occ.record.category ?? '').toUpperCase().trim();
  const titolo = occ.record.title.toUpperCase();

  if (categoria === 'LAVORETTI') {
    const festa = occ.record.title
      .replace(/^Lavoretto\s*-\s*/i, '')
      .trim()
      .toUpperCase();
    return festa ? `LAVORETTO ${festa}` : 'LAVORETTO';
  }
  if (categoria === 'INVALSI') return 'PROVE INVALSI';

  if (categoria === 'UNIVERSITÀ') {
    if (/TFA|SOSTEGNO/.test(titolo)) return 'TFA SOSTEGNO';
    if (/60 CFU|PERCORSI FORMATIVI|PERCORSI ABILITANTI/.test(titolo)) return 'CORSI 60 CFU';
    if (/MASTER|PERFEZIONAMENTO/.test(titolo)) return 'MASTER E PERFEZIONAMENTO DOCENTI';
    if (/TASSE|CONTRIBUZION/.test(titolo)) return 'TASSE UNIVERSITARIE';
    if (/IMMATRICOL/.test(titolo)) return 'IMMATRICOLAZIONE UNIVERSITÀ';
    if (/ESAMI|APPELLI/.test(titolo)) return 'ISCRIZIONI ESAMI';
  }

  if (categoria === 'FISCO & INPS') {
    if (/\b730\b/.test(titolo)) return 'DICHIARAZIONE 730';
    if (/ISEE/.test(titolo)) return 'RINNOVO ISEE';
    if (/PENSIONAMENTO/.test(titolo)) return 'DOMANDA PENSIONAMENTO';
    if (/MOBILIT|TRASFERIMENTO/.test(titolo)) return 'DOMANDA MOBILITÀ';
    if (/GRADUATORIE|GPS/.test(titolo)) return 'GRADUATORIE GPS';
    if (/NASPI/.test(titolo)) return 'DOMANDA NASPI';
    if (/CARTA DEL DOCENTE/.test(titolo)) return 'CARTA DEL DOCENTE';
    if (/POLIZZA/.test(titolo)) return 'POLIZZA ASSICURATIVA';
    if (/PCTO/.test(titolo)) return 'RENDICONTAZIONE PCTO';
  }

  // Fallback generico: prima frase significativa del titolo (pulita da parentesi).
  return titolo
    .replace(/[()]/g, ' ')
    .split(/\s+-\s+/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * RIGA 4 — Target / ordine di scuola. Compilato SOLO se la scadenza è
 * specifica (es. INFANZIA E PRIMARIA, SECONDARIA I GRADO, UNIVERSITÀ).
 * Vuoto per destinazioni generali (Tutti, Tutti i Gradi, Docenti/ATA,
 * GPS/Mobilità/730).
 */
function targetScadenza(occ: ScadenzaProiettata): string | null {
  const target = (occ.record.target ?? '').trim();
  if (!target) return null;
  const basso = target.toLowerCase();
  const generico =
    /^(tutti(\s.*)?|scuola|docenti(\s+e\s+ata)?(\s+di ruolo)?(\s+precari)?|precari scuola)$/.test(
      basso,
    );
  if (generico) return null;
  return target
    .toUpperCase()
    .replace(/\s*\/\s*/g, ' E ')
    .replace('SEC I GRADO', 'SECONDARIA I GRADO')
    .replace('SEC II GRADO', 'SECONDARIA II GRADO');
}

export interface RevolverScadenzeProps {
  /** Lunghezza della coda mostrata (Queue Limit). Default 10. */
  limite?: number;
  /** Intervallo autoplay in ms. Default 5000 (5 secondi). */
  intervallo?: number;
  /** Etichetta del widget (aria-label + header). */
  titolo?: string;
  /** Classi extra sul contenitore radice. */
  className?: string;
}

export function RevolverScadenze({
  limite = LIMITE_CODA_SCADENZE,
  intervallo = 5000,
  titolo = 'Prossime scadenze',
  className = '',
}: RevolverScadenzeProps) {
  // Dati: prima il fallback locale (render immediato), poi l'override remoto.
  const [righe, setRighe] = useState<DeadlineRecord[]>(() => [...scadenzeFallback]);
  // Orologio del widget: avanza ogni 30 s → la coda si auto-aggiorna.
  const [ora, setOra] = useState<Date>(() => new Date());
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

  return (
    <section
      aria-roledescription="carousel"
      aria-label={titolo}
      onMouseEnter={() => setInPausa(true)}
      onMouseLeave={() => setInPausa(false)}
      onFocus={() => setInPausa(true)}
      onBlur={() => setInPausa(false)}
      className={`flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden bg-white ${className}`}
    >
      <header className="w-full min-w-0 px-4 pb-0.5 pt-2.5 text-center sm:pb-1 sm:pt-3">
        <p className="text-sm font-black uppercase leading-none tracking-[0.16em] text-secondary-500 sm:text-base">
          {titolo}
        </p>
      </header>

      <div
        ref={viewportRef}
        className={`relative min-h-[170px] flex-1 touch-pan-y select-none overflow-hidden sm:min-h-[152px] ${
          trascinando ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          inizioTrascinamento(e.clientX);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => muoviTrascinamento(e.clientX)}
        onPointerUp={fineTrascinamento}
        onPointerCancel={annullaTrascinamento}
      >
        {totale > 0 && (
          <span
            key={indiceVisibile}
            aria-hidden="true"
            className="revolver-progress absolute left-0 top-0 z-10 h-0.5 w-full rounded-r-full bg-secondary-400/80"
            style={{
              animationDuration: `${intervallo}ms`,
              animationPlayState: inPausa || ridotto || trascinando ? 'paused' : 'running',
            }}
          />
        )}

        {totale > 0 ? (
          <div
            className={`revolver-track flex h-full ${
              conAnimazione ? '' : 'revolver-no-anim'
            } ${trascinando ? 'revolver-dragging' : ''}`}
            style={{ transform: `translateX(${-pos * larghezza + dragX}px)` }}
          >
            {piste.map((occ, i) => {
              const target = targetScadenza(occ);
              const descrizione = descrizioneScadenza(occ);
              return (
                <div
                  key={`${occ.record.id}-${i}`}
                  aria-hidden={i !== pos}
                  className="flex h-full w-full shrink-0 flex-col items-center justify-center gap-2 px-4 text-center sm:gap-2.5 sm:px-8"
                >
                  <p className="font-display text-base font-black uppercase leading-none tracking-tight text-primary-900 sm:text-2xl">
                    {formattaPeriodo(occ)}
                  </p>
                  <p
                    title={descrizione}
                    className="line-clamp-2 max-w-[95%] text-xs font-bold uppercase leading-snug tracking-[0.05em] text-primary-700 sm:text-sm"
                  >
                    {descrizione}
                  </p>
                  {target && (
                    <span className="inline-flex items-center rounded-full bg-primary-100/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-600 sm:text-[11px]">
                      {target}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <CalendarClock className="h-6 w-6 text-primary-200" aria-hidden="true" />
            <p className="text-xs font-semibold text-primary-500">
              Nessuna scadenza imminente.
            </p>
          </div>
        )}

        {totale > 1 && (
          <>
            <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-10 items-center justify-start pl-0.5">
              <button
                type="button"
                onClick={indietro}
                aria-label="Scadenza precedente"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-600 shadow-soft transition hover:bg-primary-50 hover:text-primary-800 active:scale-95 sm:h-8 sm:w-8"
              >
                <ChevronLeft className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-10 items-center justify-end pr-0.5">
              <button
                type="button"
                onClick={avanti}
                aria-label="Prossima scadenza"
                className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-primary-100 bg-white/90 text-primary-600 shadow-soft transition hover:bg-primary-50 hover:text-primary-800 active:scale-95 sm:h-8 sm:w-8"
              >
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4" aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Progress indicator: dots/impaginazione (target touch ≥ ~24px su mobile) */}
      <div className="flex min-h-0 flex-wrap items-center justify-center gap-0.5 px-4 pb-2 pt-1 sm:gap-1 sm:pb-2.5">
        {coda.map((occ, i) => (
          <button
            key={occ.record.id}
            type="button"
            onClick={() => vaiA(i)}
            aria-label={`Vai alla scadenza ${i + 1}: ${occ.record.title}`}
            aria-current={i === indiceVisibile ? 'true' : undefined}
            className="group flex items-center justify-center rounded-full p-1.5"
          >
            <span
              className={`block h-2 rounded-full transition-all duration-300 ${
                i === indiceVisibile
                  ? 'w-6 bg-primary-500'
                  : 'w-2 bg-primary-200 group-hover:bg-primary-300'
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}

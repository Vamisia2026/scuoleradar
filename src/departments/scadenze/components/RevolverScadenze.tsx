/**
 * ScuoleRadar.it — Revolver Scadenze (Horizontal Carousel Widget).
 *
 * Carosello orizzontale SINISTRA→DESTRA che cicla automaticamente (default
 * 5 s) tra le prime `limite` scadenze attive della coda (10 = Queue Limit),
 * con transizione CSS fluida, dots + barra di avanzamento, controlli manuali
 * e pause al passaggio del mouse. L'orologio interno (tick 30 s) fa decadere
 * gli item scaduti e fa entrare in rotazione il successivo in ordine di tempo.
 *
 * Questo file è solo il contenitore: struttura, viewport e composizione.
 *  - `hooks/useCodaScadenze`        → dati master, orologio, coda + clone;
 *  - `hooks/useRevolverCarosello`   → misura viewport, posizione, autoplay, swipe;
 *  - `components/TracciaRevolver`   → track `revolver-track` + slide;
 *  - `components/SlideScadenza`     → RIGHE 1-4 della card;
 *  - `components/FrecceRevolver`    → control bar precedente/successiva;
 *  - `components/IndicatoriRevolver`→ dots di impaginazione.
 * Gli stili delle animazioni (`revolver-track`, `revolver-progress`,
 * `revolver-no-anim`, `revolver-dragging`) vivono in `index.css`.
 */

import { CalendarClock } from 'lucide-react';
import { LIMITE_CODA_SCADENZE } from '../engine';
import { useRevolverCarosello } from '../hooks/useRevolverCarosello';
import { FrecceRevolver } from './FrecceRevolver';
import { IndicatoriRevolver } from './IndicatoriRevolver';
import { TracciaRevolver } from './TracciaRevolver';

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
  // Motore del carosello: stato, orologio, autoplay e swipe in un hook dedicato.
  const {
    viewportRef, coda, piste, totale, pos, indiceVisibile, larghezza,
    conAnimazione, trascinando, dragX, inPausa, ridotto,
    avanti, indietro, vaiA, setInPausa,
    inizioTrascinamento, muoviTrascinamento, fineTrascinamento, annullaTrascinamento,
  } = useRevolverCarosello({ limite, intervallo });

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
          <TracciaRevolver
            piste={piste}
            pos={pos}
            larghezza={larghezza}
            dragX={dragX}
            conAnimazione={conAnimazione}
            trascinando={trascinando}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <CalendarClock className="h-6 w-6 text-primary-200" aria-hidden="true" />
            <p className="text-xs font-semibold text-primary-500">
              Nessuna scadenza imminente.
            </p>
          </div>
        )}

        {totale > 1 && <FrecceRevolver avanti={avanti} indietro={indietro} />}
      </div>

      <IndicatoriRevolver coda={coda} indiceVisibile={indiceVisibile} vaiA={vaiA} />
    </section>
  );
}

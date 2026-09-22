/**
 * Scadenze — track del Revolver (`revolver-track`).
 *
 * Il track si sposta di multipli ESATTI della larghezza reale dello slide
 * (misurata dal viewport): resta allineato a qualsiasi breakpoint. La classe
 * `revolver-no-anim` disattiva la transizione durante lo snap del clone di
 * testa, `revolver-dragging` durante lo swipe (durate in index.css).
 *
 * Presentazione pura: posizione, misura e stato del gesto arrivano dal
 * contenitore (motore `useRevolverCarosello`).
 */
import type { ScadenzaProiettata } from '../types';
import { SlideScadenza } from './SlideScadenza';

interface TracciaRevolverProps {
  /** Coda + clone di testa (non vuota: il contenitore rende il vuoto altrove). */
  piste: ScadenzaProiettata[];
  /** Posizione del track (0..totale). */
  pos: number;
  /** Larghezza reale (px) di uno slide. */
  larghezza: number;
  /** Offset dello swipe in px. */
  dragX: number;
  /** false = snap senza transizione (clone di testa). */
  conAnimazione: boolean;
  /** true durante lo swipe. */
  trascinando: boolean;
}

export function TracciaRevolver({
  piste,
  pos,
  larghezza,
  dragX,
  conAnimazione,
  trascinando,
}: TracciaRevolverProps) {
  return (
          <div
            className={`revolver-track flex h-full ${
              conAnimazione ? '' : 'revolver-no-anim'
            } ${trascinando ? 'revolver-dragging' : ''}`}
            style={{ transform: `translateX(${-pos * larghezza + dragX}px)` }}
          >
              {piste.map((occ, i) => (
                <SlideScadenza key={`${occ.record.id}-${i}`} occ={occ} attivo={i === pos} />
              ))}
          </div>
  );
}

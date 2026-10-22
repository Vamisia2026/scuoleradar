/**
 * ScuoleRadar.it — Fixture condivise delle guardie del «Prova il Radar».
 *
 * Modulo di supporto delle guardie (mai importato da `src/`): la riga di prova
 * minimale e lo stub di `localStorage` vivono qui, così le guardie del responso
 * della prova partono dallo stesso dato e la copia non diverge (§26.61).
 */

import type { RigaProvaRadar } from '../../src/lib/provaRadarEngine.ts';

/**
 * Data di riferimento della guardia: `new Date()` non viene mai usato nei test,
 * così il responso non cambia con l'orologio della macchina.
 */
export const OGGI = new Date('2026-09-27T00:00:00');

/** Riga di prova minimale (id esplicito; ogni altro campo è sostituibile). */
export function rigaProva(patch: Partial<RigaProvaRadar> & { id: string }): RigaProvaRadar {
  // Scadenza relativa a OGGI REALE (5 giorni): resta dentro l'orizzonte delle
  // opportunità (§26.75, 30 giorni) e non dipende dal riferimento `OGGI` della
  // fixture, che il motore non usa per il giudizio «avviso vivo».
  const scad = new Date();
  scad.setDate(scad.getDate() + 5);
  return {
    title: 'Interpello supplenza',
    school_name: 'Liceo di prova',
    province: 'AT',
    expiration_date: scad.toISOString().slice(0, 10),
    source_url: 'https://www.scuoleradar.it',
    ...patch,
  };
}

/**
 * Storage in memoria: `localStorage` non esiste in Node, quindi si inietta uno stub
 * (l'astrazione lo legge a ogni chiamata: nessun mock del modulo).
 */
export function installaStorageInMemoria(): void {
  const memoria = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => memoria.get(k) ?? null,
    setItem: (k: string, v: string) => void memoria.set(k, v),
    removeItem: (k: string) => void memoria.delete(k),
    clear: () => memoria.clear(),
    key: (i: number) => [...memoria.keys()][i] ?? null,
    get length() {
      return memoria.size;
    },
  } as unknown as Storage;
}

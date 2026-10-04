/**
 * ScuoleRadar.it — VISUAL EDITOR (click-to-edit, solo sviluppo): casella di scrittura di un blocco.
 *
 * È il cuore dell'esperienza «clicca il testo e scrivi»: mostra il testo contiguo del blocco
 * scelto e permette di salvarlo (Ctrl/⌘+Invio oppure «Salva») o di riportarlo al testo del
 * codice. Il testo vive su UNA riga: l'editor non introduce a capo, perché nel DOM il contenuto
 * è un solo nodo di testo (`suUnaRiga` lo garantisce).
 *
 * Il pannello la monta con `key` sulla chiave del blocco: a ogni apertura la bozza riparte dal
 * testo attuale, senza stati da tenere allineati a mano.
 */
import { useState } from 'react';
import { Check, RotateCcw } from 'lucide-react';
import { suUnaRiga, type BloccoEditabile } from '@/lib/visualEditorScansione';
import { PULSANTE, PULSANTE_PIENO } from '@/components/dev/visualEditorUi';

/** Proprietà della casella: il blocco aperto e le due azioni di scrittura. */
export interface PropsVisualEditorCasella {
  /** Blocco selezionato: da qui vengono testo attuale e testo di default del codice. */
  blocco: BloccoEditabile;
  /** Scrive il testo (campo vuoto = torna al testo del codice). */
  onScrivi: (chiave: string, valore: string) => void;
  /** Riporta il blocco al testo del codice. */
  onRipristina: (chiave: string) => void;
}

export function VisualEditorCasella({ blocco, onScrivi, onRipristina }: PropsVisualEditorCasella) {
  const [bozza, setBozza] = useState(blocco.testo);
  // Altezza proporzionata al testo, entro limiti ragionevoli: si vede subito quanto si scrive.
  const righe = Math.min(8, Math.max(2, Math.ceil(bozza.length / 40)));

  return (
    <div className="mt-2">
      <textarea
        value={bozza}
        onChange={(evento) => setBozza(evento.target.value)}
        onKeyDown={(evento) => {
          // Ctrl/⌘+Invio salva; Esc risale al provider, che chiude la casella.
          if (evento.key === 'Enter' && (evento.metaKey || evento.ctrlKey)) {
            onScrivi(blocco.chiave, suUnaRiga(bozza));
          }
        }}
        autoFocus
        rows={righe}
        spellCheck
        className="w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-sky-700 focus:bg-white"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={PULSANTE_PIENO}
          onClick={() => onScrivi(blocco.chiave, suUnaRiga(bozza))}
        >
          <Check className="h-3 w-3" />
          Salva
        </button>
        {blocco.modificato && (
          <button type="button" className={PULSANTE} onClick={() => onRipristina(blocco.chiave)}>
            <RotateCcw className="h-3 w-3" />
            Ripristina
          </button>
        )}
        <span className="ml-auto text-[11px] text-slate-400">Ctrl+Invio salva · Esc chiude</span>
      </div>
      {blocco.modificato && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
          Nel codice: <span className="italic">«{blocco.originale}»</span>
        </p>
      )}
    </div>
  );
}

/**
 * Modulistica · bancone conversazionale dell'Archivista Capo.
 *
 * Risposta dell'utente (discreta, secondaria), messaggio dell'Archivista in
 * grande con fade-in morbido, micro-indicatore durante la consultazione e campo
 * di risposta libera — mai bottoni rigidi. I quattro contenuti sono fratelli:
 * il componente li restituisce in un Fragment, senza aggiungere nodi al DOM.
 *
 * Presentazione pura: stato e azioni arrivano dal contenitore.
 */
import type { FormEvent } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { Fase } from '../archivistaTipi';

interface ConversazioneArchivistaProps {
  /** Fase corrente del bancone (attesa, domanda, …). */
  fase: Fase;
  /** Messaggio grande dell'Archivista. */
  messaggio: string;
  /** Ultima risposta scritta dall'utente. */
  rispostaUtente: string | null;
  /** true mentre l'Archivista consulta il registro. */
  busy: boolean;
  /** Testo del campo di risposta libera. */
  input: string;
  /** Aggiorna il campo di risposta. */
  setInput: (valore: string) => void;
  /** Submit del form (click su «Invia» o tasto Enter). */
  invia: (e: FormEvent) => void;
}

export function ConversazioneArchivista({
  fase,
  messaggio,
  rispostaUtente,
  busy,
  input,
  setInput,
  invia,
}: ConversazioneArchivistaProps) {
  return (
    <>
          {/* Risposta dell'utente — discreta e secondaria */}
          {rispostaUtente && (
            <p className="mx-auto mb-8 max-w-md text-sm italic leading-relaxed text-primary-400">
              → {rispostaUtente}
            </p>
          )}

          {/* Messaggio dell'Archivista — GRANDE, fade-in morbido (500ms) */}
          <p
            key={messaggio}
            className="animate-fade-in-lenta text-2xl font-bold leading-snug text-primary-900 sm:text-4xl"
          >
            {messaggio}
          </p>

          {/* Pausa d'attesa dignitosa: micro-indicatore sobrio mentre
              l'Archivista consulta il registro (2 secondi simulati). */}
          {fase === 'attesa' && (
            <div className="animate-fade-in-lenta mx-auto mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              L\u2019Archivista Capo consulta il registro\u2026
            </div>
          )}


          {/* Input libero: SEMPRE attivo durante la conversazione (risposta
              naturale in testo libero, mai bottoni rigidi). */}
          {fase === 'domanda' && !busy && (
            <form onSubmit={invia} className="mx-auto mt-6 flex max-w-md items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Scrivi qui la tua risposta…"
                className="input !py-3 text-base"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="inline-flex h-12 shrink-0 items-center gap-1.5 rounded-xl bg-secondary-500 px-5 text-sm font-bold text-white shadow-soft transition hover:bg-secondary-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                Invia
              </button>
            </form>
          )}
    </>
  );
}

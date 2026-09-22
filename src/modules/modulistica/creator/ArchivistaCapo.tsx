import { useEffect, useRef } from 'react';
import type { DocumentoGenerato } from './cacheService';
import { ConversazioneArchivista } from './components/ConversazioneArchivista';
import { EsitoArchivista } from './components/EsitoArchivista';
import { IntestazioneArchivista } from './components/IntestazioneArchivista';
import { useIntervistaArchivista } from './hooks/useIntervistaArchivista';

interface ArchivistaCapoProps {
  /** Query scritta nella barra di ricerca in alto (avvia la consultazione). */
  queryIniziale: string;
  /** Chiamato quando il documento è pronto (apre l'anteprima). */
  onDocumentoPronto: (modulo: DocumentoGenerato, cache: boolean) => void;
  /** Torna alla vista archivio. */
  onTornaAllArchivio: () => void;
  /** Accesso richiesto / sessione assente → il parent gestisce l'avviso. */
  onAccessoRichiesto: () => void;
}


/**
 * Bancone dell'Archivista Capo — stile "Indovina Chi?".
 *
 * NESSUNA chat: una sola domanda alla volta a schermo, con la risposta
 * dell'Archivista GRANDE e rassicurante (effetto fade-in), opzioni chiare
 * o input minimale. Nessuno storico infinito di messaggi.
 */
export function ArchivistaCapo({
  queryIniziale,
  onDocumentoPronto,
  onTornaAllArchivio,
  onAccessoRichiesto,
}: ArchivistaCapoProps) {
  const {
    fase,
    messaggio,
    rispostaUtente,
    input,
    busy,
    pronto,
    setInput,
    invia,
    ricomincia,
    apriPronto,
  } = useIntervistaArchivista({ queryIniziale, onDocumentoPronto, onAccessoRichiesto });
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll: all'apertura la conversazione è sempre al centro dello schermo.
  useEffect(() => {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  return (
    <div
      ref={containerRef}
      className={`animate-fade-in finestra-conversazione mt-4 overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card ${
        fase === 'attesa' ? '-translate-y-1 opacity-90' : ''
      }`}
    >
      {/* Intestazione minima */}
      <IntestazioneArchivista onRicomincia={ricomincia} onTornaAllArchivio={onTornaAllArchivio} />

      {/* Bancone */}
      <div className="flex min-h-[460px] flex-col items-center justify-center bg-slate-50/60 px-6 py-12 text-center">
        <div className="w-full max-w-2xl">
          <ConversazioneArchivista
            fase={fase}
            messaggio={messaggio}
            rispostaUtente={rispostaUtente}
            busy={busy}
            input={input}
            setInput={setInput}
            invia={invia}
          />

          <EsitoArchivista
            fase={fase}
            messaggio={messaggio}
            pronto={pronto}
            onApriDocumento={apriPronto}
            onRicomincia={ricomincia}
          />
        </div>
      </div>
    </div>
  );
}


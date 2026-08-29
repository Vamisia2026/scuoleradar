import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ScuoleRadar.it — "Recupero dell'Archivista Capo".
 *
 * Frasi brevi e professionali mostrate in sequenza mentre il documento
 * viene recuperato/generato (rotazione ogni ~2.5 secondi): danno la
 * sensazione di un archivista esperto che lavora con precisione.
 */
const FRASI = [
  'Consulto il registro d\u2019archivio: un momento\u2026',
  'Individuata la cartella pertinente: verifico la versione più recente\u2026',
  'Controllo i riferimenti normativi aggiornati per il caso in esame\u2026',
  'Quasi pronto: preparo il documento per la stampa\u2026',
  'Un momento: preparo il foglio richiesto\u2026',
];

export function PensieriArchivista({ etichetta }: { etichetta?: string }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndice((i) => (i + 1) % FRASI.length), 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="animate-fade-in rounded-2xl border border-primary-100 bg-white p-6 shadow-card">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-white">
          <Loader2 className="h-5 w-5 animate-spin" />
        </span>
        <div className="min-w-0">
          {etichetta && (
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary-400">{etichetta}</p>
          )}
          <p key={indice} className="animate-fade-in mt-1 text-sm leading-relaxed text-primary-700">
            {FRASI[indice]}
          </p>
        </div>
      </div>
    </div>
  );
}

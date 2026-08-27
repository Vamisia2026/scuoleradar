import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * ScuoleRadar.it — "Pensieri dell'Archivista Premuroso".
 *
 * Frasi calde ed empatiche mostrate in sequenza durante ricerca/generazione
 * del documento (rotazione ogni ~3 secondi). Danno l'impressione di un
 * collega che lavora con cura, non di un processo automatico.
 */
const FRASI = [
  'Stiamo spulciando tra i moduli per trovare quello che si adatta meglio al tuo caso specifico…',
  'Abbiamo individuato un paio di modelli simili: li stiamo confrontando per darti esattamente quello più preciso…',
  "Diamo un'ultima controllata al testo per assicurarci che sia formattato alla perfezione e pronto da stampare.",
  'Stiamo verificando i riferimenti normativi aggiornati, così il documento resti valido e affidabile…',
  'Quasi fatto: stiamo componendo il documento con cura, come lo faremmo per un collega…',
];

export function PensieriArchivista({ etichetta }: { etichetta?: string }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setIndice((i) => (i + 1) % FRASI.length), 3000);
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

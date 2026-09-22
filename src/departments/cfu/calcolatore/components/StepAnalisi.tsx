import { useEffect, useRef, useState } from 'react';
import { Loader2, SearchCheck } from 'lucide-react';

/** Passaggi mostrati durante il calcolo: descrivono SOLO ciò che il motore fa. */
const MESSAGGI_CALCOLO = [
  'Confronto gli esami inseriti con i requisiti dichiarati dalla norma…',
  'Applico le fonti normative verificate per la classe selezionata…',
  'Calcolo coperture, carenze e punti da verificare…',
];

interface StepAnalisiProps {
  classeCodice: string;
  classeDenominazione: string;
  esamiInseriti: number;
  cfuInseriti: number;
  /** Classe di laurea dichiarata ('' = non dichiarata). */
  classeLaurea: string;
  /** Data della procedura dichiarata ('' = non dichiarata). */
  dataProcedura: string;
  /** Chiamato quando il calcolo può partire davvero (contenitore). */
  onCompletata: () => void;
}

/**
 * Fase 3-bis — Calcolo.
 *
 * Nessuna animazione che prometta letture inesistenti: qui si dichiara cosa
 * stiamo confrontando. Il calcolo vero avviene nel contenitore (`valutaClasseV1`)
 * esattamente quando questa fase lo richiede.
 */
export function StepAnalisi({
  classeCodice,
  classeDenominazione,
  esamiInseriti,
  cfuInseriti,
  classeLaurea,
  dataProcedura,
  onCompletata,
}: StepAnalisiProps) {
  const [indice, setIndice] = useState(0);
  const completatoRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndice((attuale) => {
        const successivo = attuale + 1;
        if (successivo >= MESSAGGI_CALCOLO.length && !completatoRef.current) {
          completatoRef.current = true;
          window.clearInterval(timer);
          window.setTimeout(() => onCompletata(), 250);
        }
        return Math.min(successivo, MESSAGGI_CALCOLO.length);
      });
    }, 550);
    return () => window.clearInterval(timer);
    // Il calcolo parte una sola volta per ogni visita di questa fase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-900 text-accent-300">
          <SearchCheck className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
            Calcolo · 03b
          </p>
          <h3 className="text-xl font-extrabold text-primary-900 sm:text-2xl">
            Verifico la classe {classeCodice}
          </h3>
          <p className="text-sm font-medium text-primary-500">{classeDenominazione}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
          {MESSAGGI_CALCOLO[Math.min(indice, MESSAGGI_CALCOLO.length - 1)]}
        </div>
        <ul className="mt-4 space-y-2">
          {MESSAGGI_CALCOLO.map((messaggio, posizione) => (
            <li
              key={messaggio}
              className={`flex items-center gap-2 text-sm leading-relaxed transition ${
                posizione < indice
                  ? 'text-accent-700'
                  : posizione === indice
                    ? 'text-primary-700'
                    : 'text-slate-300'
              }`}
            >
              <span
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                  posizione < indice ? 'bg-accent-500' : 'bg-slate-100'
                }`}
              >
                {posizione < indice && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              {messaggio}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary-500">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono">
          Classe {classeCodice}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          {esamiInseriti} esami · {cfuInseriti} CFU inseriti
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          Titolo: {classeLaurea || 'non dichiarato'}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          Procedura: {dataProcedura || 'non dichiarata'}
        </span>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { FileSearch, Loader2 } from 'lucide-react';
import type { AllegatoCfu, DiagnosiCFU, Esame, ObiettivoUtenteCfu } from '../../shared/types';
import { OBIETTIVI_UTENTE } from '../obiettivi';
import { analizzaPercorsoDiStudi } from '../analisi';

const MESSAGGI_ANALISI = [
  'Apro la cartella della tua carriera…',
  'Esamino i documenti in memoria: nessun contenuto viene salvato.',
  'Riconosco CFU/ECTS e settori SSD di ogni esame…',
  'Confronto i requisiti con la matrice delle classi di concorso (Tabelle A/B).',
  'Impagino il report di orientamento per il tuo obiettivo…',
];

interface StepAnalisiProps {
  esami: Esame[];
  allegati: AllegatoCfu[];
  obiettivo: ObiettivoUtenteCfu;
  onCompletata: (diagnosi: DiagnosiCFU) => void;
}

/**
 * Step C — Calcolo "in tempo reale": il calcolatore legge ed elabora la carriera.
 * Simula le fasi OCR/verifica e consegna poi l'orientamento al passo successivo.
 */
export function StepAnalisi({ esami, allegati, obiettivo, onCompletata }: StepAnalisiProps) {
  const [indice, setIndice] = useState(0);
  const completatoRef = useRef(false);
  const etichettaObiettivo = OBIETTIVI_UTENTE.find((o) => o.chiave === obiettivo)?.etichetta ?? '';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndice((attuale) => {
        const successivo = attuale + 1;
        if (successivo >= MESSAGGI_ANALISI.length && !completatoRef.current) {
          completatoRef.current = true;
          window.clearInterval(timer);
          window.setTimeout(() => {
            onCompletata(analizzaPercorsoDiStudi(esami));
          }, 500);
        }
        return Math.min(successivo, MESSAGGI_ANALISI.length);
      });
    }, 620);
    return () => window.clearInterval(timer);
    // L'analisi parte una sola volta per ogni visita di questo step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-900 text-accent-300">
          <FileSearch className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
            Calcolo · 03
          </p>
          <h3 className="text-xl font-extrabold text-primary-900 sm:text-2xl">
            Sto calcolando i tuoi CFU…
          </h3>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-100 bg-white p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
          {MESSAGGI_ANALISI[Math.min(indice, MESSAGGI_ANALISI.length - 1)]}
        </div>
        <ul className="mt-4 space-y-2">
          {MESSAGGI_ANALISI.map((messaggio, posizione) => (
            <li
              key={messaggio}
              className={`flex items-center gap-2 text-sm leading-relaxed transition ${
                posizione < indice ? 'text-accent-700' : posizione === indice ? 'text-primary-700' : 'text-slate-300'
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
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          Obiettivo: {etichettaObiettivo}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1">
          {esami.length} esami riconosciuti · {esami.reduce((s, e) => s + e.cfu, 0)} CFU
        </span>
        {allegati.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1">
            {allegati.length} documento/i letto/i in memoria
          </span>
        )}
      </div>
    </div>
  );
}

import { FileText } from 'lucide-react';
import type { VoceRequisitoUtente } from '../../requisitoUtente';
import { stileRequisito } from './stileEsito';

interface VoceRequisitoProps {
  voce: VoceRequisitoUtente;
}

/** Riga di UN requisito: etichetta, esito, dettaglio, integrabilità e fonte verbatim. */
export function VoceRequisito({ voce }: VoceRequisitoProps) {
  const stile = stileRequisito(voce.esito);
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="max-w-2xl text-sm font-bold leading-snug text-primary-800">{voce.etichetta}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${stile.classi}`}
        >
          {stile.etichetta}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-primary-600">{voce.dettaglio}</p>
      {voce.esito === 'non-soddisfatto' && voce.integrabilita !== 'non-dichiarata' && (
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-primary-700">
          {voce.integrabilita === 'integrabile'
            ? 'La norma dichiara questi CFU integrabili.'
            : 'La norma non ammette integrazione di questi CFU.'}
        </p>
      )}
      {voce.estratto && (
        <details className="mt-2">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary-400">
            <FileText className="h-3.5 w-3.5" /> Testo della fonte
          </summary>
          <p className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-primary-600">
            {voce.estratto}
          </p>
        </details>
      )}
    </li>
  );
}

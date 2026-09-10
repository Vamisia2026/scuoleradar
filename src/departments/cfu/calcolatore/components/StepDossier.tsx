import { useState } from 'react';
import { ArrowLeft, CheckCircle2, FileText, RotateCcw } from 'lucide-react';
import type { DossierCFU } from '../../shared/types';
import { testoDossier } from '../../dossier/dossierService';

interface StepDossierProps {
  dossier: DossierCFU;
  onScarica: () => void;
  onTornaDiagnosi: () => void;
  onRicomincia: () => void;
}

/** Step E — Dossier Requisiti ScuoleRadar pronto per la consegna in segreteria. */
export function StepDossier({ dossier, onScarica, onTornaDiagnosi, onRicomincia }: StepDossierProps) {
  const [scaricato, setScaricato] = useState(false);
  const dataLeggibile = new Date(dossier.generatoIl).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const scarica = () => {
    onScarica();
    setScaricato(true);
  };

  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Dossier · 05
        </p>
        <h3 className="text-2xl font-extrabold leading-tight text-primary-900">
          Dossier Requisiti ScuoleRadar
        </h3>
        <p className="max-w-3xl text-base leading-relaxed text-primary-600 sm:text-lg">
          Il documento di sintesi da allegare alla richiesta di chiarimento presso la segreteria o
          l&apos;istituzione scolastica: percorso di studi, ambiti coperti, classi accessibili e CFU
          mancanti.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-primary-800 to-primary-950 px-5 py-3">
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-accent-200">
            <FileText className="h-4 w-4" />
            {dossier.id}
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-primary-100 ring-1 ring-white/15">
            Generato il {dataLeggibile}
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-b-2xl bg-slate-50 px-5 py-4 font-mono text-xs leading-relaxed text-primary-700">
          {testoDossier(dossier)}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={scarica}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent-500 px-5 py-2.5 text-sm font-bold text-white shadow-soft transition hover:bg-accent-600"
        >
          <FileText className="h-4 w-4" />
          {scaricato ? 'Scaricato di nuovo (.txt)' : 'Genera e scarica il Dossier (.txt)'}
        </button>
        <span className="text-xs font-medium text-primary-400">
          In produzione il Dossier sarà esportato anche in PDF per la consegna ufficiale.
        </span>
      </div>

      <div className="rounded-xl border border-accent-200 bg-accent-50/60 px-4 py-3">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-accent-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {dossier.esami.length} esami · {dossier.cfuTotali} CFU/ECTS ·{' '}
          {dossier.classiAccessibili.length} classi accessibili ·{' '}
          {dossier.classiSecondarie.length} obiettivi da integrare. Il dossier include sempre la
          nota metodologica e l&apos;avvertenza di verifica ufficiale.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onTornaDiagnosi}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna all&apos;orientamento
        </button>
        <button
          type="button"
          onClick={onRicomincia}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-500 transition hover:bg-primary-50"
        >
          <RotateCcw className="h-4 w-4" />
          Nuovo calcolo
        </button>
      </div>
    </div>
  );
}

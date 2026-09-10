import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { ETICHETTE_AMBITI, type DiagnosiCFU, type EsitoClasse } from '../../shared/types';
import { DISCLAIMER_INDICATIVO } from '../../shared/normativa';

interface StepDiagnosiProps {
  diagnosi: DiagnosiCFU;
  onModificaEsami: () => void;
  onVaiDossier: () => void;
}

function CardClasse({ esito }: { esito: EsitoClasse }) {
  const { classe } = esito;
  return (
    <div
      className={`rounded-2xl border p-4 ${
        esito.accessibile ? 'border-accent-200 bg-accent-50/50' : 'border-primary-100 bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-primary-800">
          <span className="rounded-lg bg-primary-900 px-2 py-0.5 font-mono text-[11px] text-white">
            {classe.codice}
          </span>
          {classe.denominazione}
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-400 ring-1 ring-primary-100">
            Tabella {classe.tabella}
          </span>
        </p>
        {esito.accessibile ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-500 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-soft">
            <CheckCircle2 className="h-3 w-3" />
            AMMISSIBILE
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2.5 py-0.5 text-[11px] font-bold text-warning-700 ring-1 ring-warning-200">
            <AlertTriangle className="h-3 w-3" />
            Mancano {esito.cfuMancanti} CFU
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {esito.coperture.map((c) => (
          <li key={c.ambito} className="text-sm text-primary-600">
            <span className="font-semibold">{ETICHETTE_AMBITI[c.ambito]}:</span>{' '}
            <span className="font-bold text-primary-800">{c.cfuPosseduti} CFU</span>
            <span className="text-primary-400"> disponibili</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Step D — Diagnosi strutturata. */
export function StepDiagnosi({ diagnosi, onModificaEsami, onVaiDossier }: StepDiagnosiProps) {
  const dataLeggibile = new Date(diagnosi.dataAnalisi).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const matriciDemo =
    [...diagnosi.classiAccessibili, ...diagnosi.classiSecondarie].some(
      (e) => e.classe.requisitiDemo,
    ) ?? false;

  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Orientamento · 04
        </p>
        <h3 className="text-2xl font-extrabold leading-tight text-primary-900 sm:text-3xl">
          Ecco il tuo orientamento
        </h3>
        <p className="text-xs font-medium text-primary-400">
          Elaborata il {dataLeggibile} · {diagnosi.esamiAnalizzati.length} esami ·{' '}
          {diagnosi.cfuTotali} CFU/ECTS totali
        </p>
      </div>

      <section
        aria-label="Punti di forza"
        className="rounded-2xl border border-accent-200 bg-white p-4 shadow-soft"
      >
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-accent-700">
          <Sparkles className="h-4 w-4" /> Punti di forza
        </h4>
        <ul className="mt-2.5 space-y-1.5">
          {diagnosi.puntiDiForza.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm text-primary-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
              {p}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Classi accessibili">
        <h4 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-primary-700">
          Classi di concorso accessibili ({diagnosi.classiAccessibili.length})
        </h4>
        {diagnosi.classiAccessibili.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-primary-500">
            Con i CFU attuali non risulti ancora ammissibile alle classi della matrice: guarda gli
            obiettivi secondari qui sotto e integra gli ambiti mancanti.
          </p>
        ) : (
          <div className="space-y-2">
            {diagnosi.classiAccessibili.map((esito) => (
              <CardClasse key={esito.classe.codice} esito={esito} />
            ))}
          </div>
        )}
      </section>

      <section aria-label="Obiettivi secondari">
        <h4 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-warning-700">
          Obiettivi secondari: CFU da integrare ({diagnosi.classiSecondarie.length})
        </h4>
        {diagnosi.classiSecondarie.length === 0 ? (
          <p className="rounded-xl bg-accent-50 px-4 py-3 text-sm font-medium text-accent-800">
            Nessun obiettivo da integrare: tutte le classi della matrice risultano coperte.
          </p>
        ) : (
          <div className="space-y-2">
            {diagnosi.classiSecondarie.map((esito) => (
              <CardClasse key={esito.classe.codice} esito={esito} />
            ))}
          </div>
        )}
      </section>

      <div className="rounded-xl border border-primary-100 bg-primary-50/60 px-4 py-3">
        <p className="text-sm leading-relaxed text-primary-600">
          <strong>Nota metodologica:</strong> {diagnosi.notaMetodologica}
        </p>
        {matriciDemo && (
          <p className="mt-1.5 text-sm leading-relaxed text-primary-500">
            La matrice delle classi in questa fondazione è dimostrativa: i requisiti verranno
            sostituiti dalle Tabelle A/B ufficiali. {DISCLAIMER_INDICATIVO}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={onModificaEsami}
          className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Modifica gli esami
        </button>
        <button
          type="button"
          onClick={onVaiDossier}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
        >
          Genera il Dossier per la scuola
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}


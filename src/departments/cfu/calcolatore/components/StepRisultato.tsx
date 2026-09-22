import { ArrowLeft, FileText, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import type { EsitoUtenteV1 } from '../esitoUtente';
import type { CommercialeCfu } from '../commerciale';
import { SezioneNote } from './risultato/SezioneNote';
import { SezioneRequisiti } from './risultato/SezioneRequisiti';
import { stileEsito } from './risultato/stileEsito';

interface StepRisultatoProps {
  esito: EsitoUtenteV1;
  /** Canale commerciale (dalla pagina): assente = nessuna CTA mostrata. */
  commerciale?: CommercialeCfu;
  /** Ritorna alla fase Esami per correggere i dati. */
  onModificaEsami: () => void;
  /** Apre la fase Dossier (export .txt del risultato). */
  onVaiDossier: () => void;
  /** Riavvia il percorso da zero. */
  onRicomincia: () => void;
}

/**
 * Fase 4 — Risultato: il momento centrale del percorso.
 *
 * Struttura fissa in quattro passi: verdetto → perché → cosa manca → cosa fare.
 * Ogni frase arriva dall'adapter `esitoUtente.ts`: qui non si calcola nulla.
 */
export function StepRisultato({
  esito,
  commerciale,
  onModificaEsami,
  onVaiDossier,
  onRicomincia,
}: StepRisultatoProps) {
  const stile = stileEsito(esito.stato);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-bold uppercase tracking-widest text-primary-400">
          Risultato · 04
        </p>
        <h3 className="text-2xl font-extrabold leading-tight text-primary-900 sm:text-3xl">
          {esito.titolo}
        </h3>
      </div>

      <section
        aria-label="Verdetto"
        className={`rounded-2xl border p-4 shadow-soft sm:p-5 ${stile.contenitore}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-primary-800">
            <span className="rounded-lg bg-primary-900 px-2 py-0.5 font-mono text-[11px] text-white">
              {esito.classeCodice}
            </span>
            {esito.classeDenominazione}
          </p>
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${stile.badgeClassi}`}>
            {stile.badge}
          </span>
        </div>
        <ul className="mt-3 space-y-1.5">
          {esito.spiegazioneStato.map((frase) => (
            <li key={frase} className="text-sm leading-relaxed text-primary-700">
              {frase}
            </li>
          ))}
        </ul>
      </section>

      <SezioneRequisiti esito={esito} />
      <SezioneNote esito={esito} />

      <section
        aria-label="Dossier"
        className="rounded-2xl border border-primary-100 bg-primary-50/60 px-4 py-3.5"
      >
        <p className="text-sm leading-relaxed text-primary-700">
          <strong>Dossier Requisiti:</strong> un file di testo con classe, verdetto, requisiti
          verificati, carenze e fonti normative: da portare in segreteria o all&apos;USR come traccia
          della verifica.
        </p>
        <button
          type="button"
          onClick={onVaiDossier}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
        >
          <FileText className="h-4 w-4" />
          Genera il Dossier (.txt)
        </button>
      </section>

      <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-primary-500">
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
          Calcolo tracciato sulle fonti normative indicate
        </li>
        <li className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-accent-500" />
          Nessun documento caricato o conservato
        </li>
      </ul>

      {commerciale && (
        <section
          aria-label="Piano ScuoleRadar"
          className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
        >
          <p className="flex items-start gap-2 text-sm leading-relaxed text-primary-600">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary-500" />
            {commerciale.haPro
              ? 'Il Calcolatore CFU è incluso nel tuo piano PRO: nessun costo aggiuntivo, nessun limite su questa verifica.'
              : 'Il Calcolatore CFU è gratuito, Dossier compreso. Se ti serve anche il resto di ScuoleRadar (Radar interpelli, Modulistica e gli altri strumenti) puoi vedere cosa include il PRO.'}
          </p>
          {!commerciale.haPro && (
            <button
              type="button"
              onClick={commerciale.apriUpgrade}
              className="mt-2 text-sm font-bold text-secondary-700 underline decoration-secondary-300 underline-offset-2 transition hover:text-secondary-900"
            >
              Guarda i piani PRO
            </button>
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onModificaEsami}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Modifica esami e dati
          </button>
        </div>
        <button
          type="button"
          onClick={onRicomincia}
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-primary-500 transition hover:bg-primary-50"
        >
          <RotateCcw className="h-4 w-4" />
          Nuova verifica
        </button>
      </div>
    </div>
  );
}

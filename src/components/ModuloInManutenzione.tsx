/**
 * ScuoleRadar.it — pagina di cortesia per un dipartimento NON disponibile.
 *
 * Mostrata al posto della pagina quando lo stato del dipartimento è `off`
 * (o `test` per un utente non admin): vedi `FeatureGate`. Tono «in arrivo»,
 * mai un errore tecnico — l'utente deve capire che il resto del sito funziona.
 */
import { Link } from 'react-router-dom';
import { ArrowLeft, Wrench } from 'lucide-react';
import {
  trovaDipartimento,
  type DipartimentoId,
  type StatoDipartimento,
} from '@/config/features';
import { descrizioneStato, etichettaStato } from '@/config/statoDipartimenti';

interface ModuloInManutenzioneProps {
  /** Dipartimento non disponibile. */
  dipartimento: DipartimentoId;
  /** Stato che ha causato il blocco (`off` oppure `test`). */
  stato: StatoDipartimento;
}

export function ModuloInManutenzione({ dipartimento, stato }: ModuloInManutenzioneProps) {
  const info = trovaDipartimento(dipartimento);
  const nome = info?.nome ?? dipartimento;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-10">
      <div className="w-full rounded-2xl border border-primary-100 bg-white p-8 text-center shadow-card">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-2xl">
          {info?.emoji ?? '🚧'}
        </span>
        <h1 className="mt-4 text-xl font-bold text-primary-800">{nome}: in arrivo</h1>
        <p className="mt-2 text-sm leading-relaxed text-primary-500">
          Stiamo rifinendo questo servizio e lo apriremo a breve. Nel frattempo puoi continuare a
          usare gli altri strumenti di ScuoleRadar dalla tua area personale.
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-400">
          <Wrench className="h-3.5 w-3.5" />
          {etichettaStato(stato)} · {descrizioneStato(stato)}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-primary-600"
          >
            <ArrowLeft className="h-4 w-4" /> Area personale
          </Link>
          <Link
            to="/notizie"
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 px-4 py-2.5 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
          >
            Leggi le notizie
          </Link>
        </div>
      </div>
    </div>
  );
}

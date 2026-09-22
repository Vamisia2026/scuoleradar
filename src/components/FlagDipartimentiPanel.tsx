/**
 * ScuoleRadar.it — pannello di controllo delle FEATURE FLAGS dei dipartimenti.
 *
 * Componente di PRESENTAZIONE puro (nessuno stato proprio): riceve gli stati e
 * il callback di cambio. È riusato da:
 *   · DEV Toolbar (`src/components/DevToolbar`) in forma compatta;
 *   · pannello Admin, tab «Dipartimenti» (`@/departments/admin`).
 *
 * Il selettore a 3 posizioni (OFF | TEST | ON) mostra accanto a ogni voce la
 * provenienza dello stato (`ambiente` = variabile d'ambiente, `locale` = toggle
 * in browser, `default` = valore del codice).
 */
import {
  STATI_DIPARTIMENTO,
  type Dipartimento,
  type DipartimentoId,
  type StatoDipartimento,
} from '@/config/features';
import { descrizioneStato, etichettaStato, type OrigineStato } from '@/config/statoDipartimenti';

/** Layout del pannello: `card` (Admin) oppure `lista` (DEV Toolbar). */
type VariantePannelloDipartimenti = 'card' | 'lista';

interface FlagDipartimentiPanelProps {
  /** Stato effettivo di ogni dipartimento. */
  stati: Record<DipartimentoId, StatoDipartimento>;
  /** Dipartimenti da mostrare (default: tutti, nell'ordine di `DIPARTIMENTI`). */
  dipartimenti: readonly Dipartimento[];
  /** Cambio di stato richiesto dall'utente. */
  onCambia: (id: DipartimentoId, stato: StatoDipartimento) => void;
  /** Provenienza dello stato (opzionale: mostrata come nota tecnica). */
  origine?: (id: DipartimentoId) => OrigineStato;
  /** Layout compatto (card ridotte) invece del layout del pannello Admin. */
  compatta?: boolean;
  /**
   * `lista` = una riga per dipartimento con i tre pulsanti OFF | TEST | ON sempre a
   * schermo: è la forma usata nella DEV Toolbar laterale, dove i toggle devono
   * essere visibili senza aprire altre modali. Default `card` (pannello Admin).
   */
  variante?: VariantePannelloDipartimenti;
}

/** Classi del pulsante attivo, per stato. */
const CLASSI_ATTIVO: Record<StatoDipartimento, string> = {
  off: 'bg-error-500 text-white shadow-soft',
  test: 'bg-warning-500 text-white shadow-soft',
  on: 'bg-accent-500 text-white shadow-soft',
};

/** Nota tecnica della provenienza. */
function notaOrigine(origine: OrigineStato): string {
  if (origine === 'ambiente') return 'variabile d’ambiente';
  if (origine === 'locale') return 'impostato qui';
  return 'default';
}

/** Sigla della provenienza, mostrata solo quando NON è il default. */
function siglaOrigine(origine: OrigineStato): string | null {
  if (origine === 'ambiente') return 'env';
  if (origine === 'locale') return 'salvato qui';
  return null;
}

/**
 * Selettore a 3 posizioni (OFF | TEST | ON), condiviso dai due layout: stesse
 * classi di stato, due densità (`compatta` = riga della DEV Toolbar laterale).
 */
function SelettoreStati({
  nome,
  attuale,
  daAmbiente,
  compatta,
  onCambia,
}: {
  nome: string;
  attuale: StatoDipartimento;
  daAmbiente: boolean;
  compatta: boolean;
  onCambia: (stato: StatoDipartimento) => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Stato del dipartimento ${nome}`}
      className={`inline-flex shrink-0 rounded-xl border border-primary-100 bg-slate-50 ${
        compatta ? 'p-0.5' : 'p-1'
      }`}
    >
      {STATI_DIPARTIMENTO.map((s) => {
        const selezionato = attuale === s;
        return (
          <button
            key={s}
            type="button"
            // Con `FEATURE_*` impostata lato ambiente il toggle locale è inefficace:
            // si disabilita per non illudere l'utente.
            disabled={daAmbiente}
            aria-pressed={selezionato}
            onClick={() => onCambia(s)}
            title={daAmbiente ? 'Stato forzato da variabile d’ambiente' : descrizioneStato(s)}
            className={`rounded-lg font-bold uppercase tracking-wide transition ${
              compatta ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${selezionato ? CLASSI_ATTIVO[s] : 'text-primary-600 hover:bg-white'} ${
              daAmbiente ? 'cursor-not-allowed opacity-60' : ''
            }`}
          >
            {etichettaStato(s)}
          </button>
        );
      })}
    </div>
  );
}

export function FlagDipartimentiPanel({
  stati,
  dipartimenti,
  onCambia,
  origine,
  compatta = false,
  variante = 'card',
}: FlagDipartimentiPanelProps) {
  /* Layout LISTA (DEV Toolbar): una riga per dipartimento, toggle sempre a schermo. */
  if (variante === 'lista') {
    return (
      <div className="space-y-1.5">
        {dipartimenti.map((d) => {
          const attuale = stati[d.id];
          const provenienza = origine?.(d.id);
          const daAmbiente = provenienza === 'ambiente';
          const sigla = provenienza ? siglaOrigine(provenienza) : null;
          return (
            <div
              key={d.id}
              title={`${d.nome} — ${descrizioneStato(attuale)}`}
              className="flex items-center justify-between gap-2 rounded-xl border border-primary-100 bg-white px-2.5 py-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span aria-hidden className="text-base leading-none">
                  {d.emoji}
                </span>
                <span className="truncate text-xs font-semibold text-primary-800">{d.nome}</span>
                {sigla && (
                  <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-500">
                    {sigla}
                  </span>
                )}
              </span>
              <SelettoreStati
                nome={d.nome}
                attuale={attuale}
                daAmbiente={daAmbiente}
                compatta
                onCambia={(stato) => onCambia(d.id, stato)}
              />
            </div>
          );
        })}
      </div>
    );
  }

  /* Layout CARD (pannello Admin): descrizione estesa per ogni dipartimento. */
  return (
    <div className={compatta ? 'space-y-2' : 'space-y-3'}>
      {dipartimenti.map((d) => {
        const attuale = stati[d.id];
        const provenienza = origine?.(d.id);
        const daAmbiente = provenienza === 'ambiente';
        return (
          <section
            key={d.id}
            className={`rounded-2xl border border-primary-100 bg-white shadow-card ${
              compatta ? 'p-3' : 'p-4'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
                  <span aria-hidden>{d.emoji}</span>
                  {d.nome}
                  {d.notificheAutomatiche && (
                    <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                      notifiche
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-primary-500">{d.descrizione}</p>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-400">
                {etichettaStato(attuale)}
                {provenienza ? ` · ${notaOrigine(provenienza)}` : ''}
              </p>
            </div>

            <div className="mt-3">
              <SelettoreStati
                nome={d.nome}
                attuale={attuale}
                daAmbiente={daAmbiente}
                compatta={compatta}
                onCambia={(stato) => onCambia(d.id, stato)}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-primary-500">{descrizioneStato(attuale)}</p>
          </section>
        );
      })}
    </div>
  );
}

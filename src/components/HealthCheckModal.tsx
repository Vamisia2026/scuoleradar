import { useEffect, useState } from 'react';
import { Loader2, RotateCcw, RotateCw, Trash2 } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { eseguiHealthCheck, type HealthCheckResult } from '@/services/healthCheck';
import { supabase } from '@/lib/supabase';
import {
  CATALOGO_PROMO,
  leggiOverridePromo,
  salvaOverridePromo,
  type CatalogoPromo,
  type StatoPromo,
} from '@/lib/promo';

const BADGE: Record<
  HealthCheckResult['status'],
  { etichetta: string; emoji: string; cls: string }
> = {
  ok: {
    etichetta: 'OK',
    emoji: '🟢',
    cls: 'border-accent-200 bg-accent-50 text-accent-700',
  },
  warning: {
    etichetta: 'WARNING',
    emoji: '🟡',
    cls: 'border-warning-200 bg-warning-50 text-warning-700',
  },
  error: {
    etichetta: 'ERROR',
    emoji: '🔴',
    cls: 'border-error-200 bg-error-50 text-error-700',
  },
};

/** Badge di stato per la sezione "Promo Codes / Coupons". */
const PROMO_BADGE: Record<StatoPromo, { etichetta: string; cls: string }> = {
  attivo: { etichetta: 'Attivo', cls: 'border-accent-200 bg-accent-50 text-accent-700' },
  disattivato: { etichetta: 'Disattivato', cls: 'border-primary-200 bg-slate-100 text-primary-500' },
  scaduto: { etichetta: 'Scaduto', cls: 'border-warning-200 bg-warning-50 text-warning-700' },
};

/**
 * Modal "System Health Check" (solo sviluppo/admin) — layout COMPATTO a 2 colonne:
 * niente scroll verticale: tutti i check sono visibili in un'unica schermata.
 */
export function HealthCheckModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [risultati, setRisultati] = useState<HealthCheckResult[]>([]);
  const [inCorso, setInCorso] = useState(false);

  const esegui = async () => {
    setInCorso(true);
    const r = await eseguiHealthCheck();
    setRisultati(r);
    setInCorso(false);
  };

  useEffect(() => {
    if (open) void esegui();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const conteggio = (stato: HealthCheckResult['status']) =>
    risultati.filter((r) => r.status === stato).length;

  /* ----------------- Gestione rapida Promo Codes / Coupons (solo dev) ----------------- */
  const [overridePromo, setOverridePromo] = useState<Record<string, StatoPromo>>(() =>
    leggiOverridePromo(),
  );
  const [statiPromoDb, setStatiPromoDb] = useState<
    Record<string, { attivo?: boolean; scade_il?: string | null }>
  >({});

  // Stato reale di `promo_codes` quando accessibile (di solito il client non ha RLS su
  // quella tabella: in caso di errore si resta sul catalogo di default + override locale).
  useEffect(() => {
    if (!open || !supabase) return;
    let attivo = true;
    void (async () => {
      try {
        const { data } = await supabase.from('promo_codes').select('codice, attivo, scade_il');
        if (!attivo || !data) return;
        const mappa: Record<string, { attivo?: boolean; scade_il?: string | null }> = {};
        for (const r of data as Array<{
          codice: string;
          attivo?: boolean | null;
          scade_il?: string | null;
        }>) {
          mappa[String(r.codice)] = {
            attivo: r.attivo ?? true,
            scade_il: r.scade_il ?? null,
          };
        }
        setStatiPromoDb(mappa);
      } catch {
        // nessun accesso (RLS) → si resta su catalogo di default + override locale
      }
    })();
    return () => {
      attivo = false;
    };
  }, [open, supabase]);

  /** Stato effettivo di un codice: override locale > stato DB > default del catalogo. */
  const statoEffettivoPromo = (voce: CatalogoPromo): StatoPromo => {
    const ovr = overridePromo[voce.codice];
    if (ovr) return ovr;
    const rigaDb = statiPromoDb[voce.codice];
    if (rigaDb) {
      if (rigaDb.scade_il && new Date(rigaDb.scade_il).getTime() <= Date.now()) return 'scaduto';
      if (rigaDb.attivo === false) return 'disattivato';
    }
    return voce.defaultStato;
  };

  const aggiornaOverridePromo = (next: Record<string, StatoPromo>) => {
    setOverridePromo(next);
    salvaOverridePromo(next);
  };

  /** Singolo click: disattiva/rimuove il coupon (override locale, persistito). */
  const disattivaPromo = (codice: string) =>
    aggiornaOverridePromo({ ...overridePromo, [codice]: 'disattivato' });

  /** Singolo click: riattiva il coupon rimuovendo l'override locale (torna al default). */
  const riattivaPromo = (codice: string) => {
    const next = { ...overridePromo };
    delete next[codice];
    aggiornaOverridePromo(next);
  };

  /**
   * Catalogo mostrato nel DEV panel: SOLO promo di sistema (campagne/marketing).
   * I codici referral automatici "Invita un collega" (origine 'referral') sono esclusi.
   */
  const promoDiSistema = CATALOGO_PROMO.filter((v) => v.origine !== 'referral');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="System Health Check"
      size="xl"
      zClass="z-[9999]"
    >
      <div className="space-y-2">
        {/* Intestazione compatta: conteggi + riesegui */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
            <span className="rounded-full border border-accent-200 bg-accent-50 px-2 py-0.5 text-accent-700">
              🟢 {conteggio('ok')} OK
            </span>
            <span className="rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-warning-700">
              🟡 {conteggio('warning')} WARNING
            </span>
            <span className="rounded-full border border-error-200 bg-error-50 px-2 py-0.5 text-error-700">
              🔴 {conteggio('error')} ERROR
            </span>
          </div>
          <button
            type="button"
            onClick={() => void esegui()}
            disabled={inCorso}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-primary-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-700 transition hover:bg-primary-50 disabled:opacity-60"
          >
            <RotateCcw className="h-3 w-3" />
            Riesegui
          </button>
        </div>

        {/* Griglia compatta a 2 colonne: nessun scroll verticale */}
        {inCorso && risultati.length === 0 ? (
          <p className="flex items-center gap-2 rounded-lg border border-primary-100 bg-primary-50 px-3 py-4 text-xs text-primary-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Esecuzione dei test in corso…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {risultati.map((r) => (
              <div
                key={r.name}
                className={`flex items-start gap-2 rounded-lg border p-2 ${
                  r.status === 'ok'
                    ? 'border-accent-100 bg-white'
                    : r.status === 'warning'
                      ? 'border-warning-200 bg-warning-50/60'
                      : 'border-error-200 bg-error-50/60'
                }`}
              >
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${BADGE[r.status].cls}`}
                >
                  {BADGE[r.status].emoji} {BADGE[r.status].etichetta}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-primary-800">{r.name}</p>
                    {r.latencyMs !== undefined && (
                      <span className="shrink-0 text-[10px] tabular-nums text-primary-400">
                        {r.latencyMs}ms
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-snug text-primary-600">{r.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gestione rapida Promo Codes / Coupons */}
        <section className="rounded-lg border border-primary-100 bg-white p-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-primary-500">
              Promo Codes / Coupons
            </p>
            <span className="text-[10px] font-semibold text-primary-400">
              {promoDiSistema.filter((v) => statoEffettivoPromo(v) === 'attivo').length} attivi ·{' '}
              {promoDiSistema.filter((v) => statoEffettivoPromo(v) !== 'attivo').length} inattivi
            </span>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {promoDiSistema.map((voce) => {
              const stato = statoEffettivoPromo(voce);
              const attivo = stato === 'attivo';
              return (
                <div
                  key={voce.codice}
                  className="flex items-start justify-between gap-1.5 rounded-md border border-primary-100 bg-primary-50/50 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate font-mono text-xs font-bold text-primary-800"
                      title={voce.descrizione}
                    >
                      {voce.codice}
                    </p>
                    <span
                      className={`mt-0.5 inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${PROMO_BADGE[stato].cls}`}
                    >
                      {PROMO_BADGE[stato].etichetta}
                    </span>
                    <p
                      className="mt-1 line-clamp-2 text-[10px] leading-tight text-primary-500"
                      title={voce.descrizione}
                    >
                      {voce.descrizione}
                    </p>
                  </div>
                  {attivo ? (
                    <button
                      type="button"
                      onClick={() => disattivaPromo(voce.codice)}
                      aria-label={`Disattiva ${voce.codice}`}
                      title="Disattiva / rimuovi (override locale)"
                      className="rounded-md p-1 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => riattivaPromo(voce.codice)}
                      aria-label={`Riattiva ${voce.codice}`}
                      title="Riattiva (rimuovi override locale)"
                      className="rounded-md p-1 text-primary-400 transition hover:bg-accent-50 hover:text-accent-600"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-primary-400">
            Gestione rapida DEV: sono mostrati SOLO i promo di sistema (campagne/marketing) — i codici
            referral automatici &quot;Invita un collega&quot; (es. sconto -10€) sono esclusi. L&apos;override
            viene salvato in localStorage (<code className="font-mono">sr_promo_stati_dev</code>); i
            coupon Stripe veri restano configurati server-side (secrets /{' '}
            <code className="font-mono">promo_codes</code>).
          </p>
        </section>
      </div>
    </Modal>
  );
}


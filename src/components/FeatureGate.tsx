/**
 * ScuoleRadar.it — guardia di rotta per i DIPARTIMENTI con feature flags.
 *
 * Avvolge l'elemento di una `<Route>`:
 *   · stato `off`  → se l'utente non è admin (né in DEV forzato) mostra
 *     `ModuloInManutenzione` al posto della pagina;
 *   · stato `test` → la pagina resta accessibile SOLO all'admin; per gli altri
 *     utenti vale `ModuloInManutenzione`;
 *   · stato `on`   → pagina normale.
 *
 * Quando l'admin vede un modulo `off`/`test` compare in testa un banner
 * («visibile solo a te») per non dimenticare di aver lasciato un override.
 */
import type { ReactNode } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { trovaDipartimento, type DipartimentoId, type StatoDipartimento } from '@/config/features';
import { etichettaStato } from '@/config/statoDipartimenti';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { ModuloInManutenzione } from './ModuloInManutenzione';

interface FeatureGateProps {
  /** Dipartimento che governa la rotta. */
  modulo: DipartimentoId;
  children: ReactNode;
}

/** Banner informativo mostrato all'admin quando il modulo non è pubblico. */
function AvvisoStatoModulo({
  dipartimento,
  stato,
}: {
  dipartimento: DipartimentoId;
  stato: StatoDipartimento;
}) {
  const nome = trovaDipartimento(dipartimento)?.nome ?? dipartimento;
  const inTest = stato === 'test';
  return (
    <div
      role="status"
      className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
        inTest
          ? 'border-warning-500/40 bg-warning-50 text-warning-700'
          : 'border-error-500/30 bg-error-50 text-error-700'
      }`}
    >
      <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="leading-relaxed">
        <strong>{nome}</strong> è in modalità <strong>{etichettaStato(stato)}</strong>: la vedi solo
        tu (admin/DEV), la navbar mostra la tab solo al tuo account.{' '}
        {inTest
          ? 'Le notifiche automatiche di questo modulo partono esclusivamente verso l’account di test.'
          : 'Il modulo è disattivato per tutti gli altri utenti e le notifiche automatiche sono bloccate.'}
      </p>
    </div>
  );
}

export function FeatureGate({ modulo, children }: FeatureGateProps) {
  const { stato, visibile, eAdmin } = useFeatureFlags();
  const attuale = stato(modulo);

  if (!visibile(modulo)) {
    return <ModuloInManutenzione dipartimento={modulo} stato={attuale} />;
  }
  if (attuale === 'on') return <>{children}</>;

  return (
    <>
      {eAdmin && <AvvisoStatoModulo dipartimento={modulo} stato={attuale} />}
      {!eAdmin && (
        <p className="mb-3 flex items-center gap-1.5 rounded-xl border border-primary-100 bg-white px-3 py-2 text-xs text-primary-500">
          <ShieldCheck className="h-3.5 w-3.5" /> Modulo in anteprima riservata.
        </p>
      )}
      {children}
    </>
  );
}

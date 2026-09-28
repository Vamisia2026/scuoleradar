/**
 * PureFocus — sponsor esterno (purefocus.one) incluso nel piano PRO.
 *
 * Vetrina pulita condivisa (`PureFocusCard`): wordmark ufficiale del partner,
 * badge verde «INCLUSO NEL PIANO PRO», descrizione e link a purefocus.one, più la
 * CTA dinamica in base allo stato dell'utente (PRO → accesso diretto; Base →
 * «Passa a PRO»).
 */
import { useApp } from '@/contexts/AppContext';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { PureFocusCard } from '@/components/PureFocusCard';

export function PureFocusPage() {
  const { hasProAccess } = useApp();

  return (
    <DepartmentErrorBoundary
      dipartimento="PureFocus"
      titolo="La pagina PureFocus non è disponibile"
      messaggio="Il contenuto sponsor non può essere mostrato in questo momento. Il resto della dashboard e gli altri servizi di ScuoleRadar funzionano regolarmente."
      etichettaRiprova="Riapri PureFocus"
      className="mt-0"
    >
      <div className="space-y-6">
        <PureFocusCard hasProAccess={hasProAccess} />
      </div>
    </DepartmentErrorBoundary>
  );
}

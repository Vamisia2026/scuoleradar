/**
 * Dashboard · reindirizzamento d'ingresso (`/dashboard` senza sezione).
 *
 * Porta l'utente al PRIMO dipartimento visibile secondo le feature flags: il
 * Radar quando è pubblico, altrimenti il primo modulo `on`/`test` disponibile
 * per l'utente. Se nessun dipartimento è accessibile, apre il profilo (che non
 * dipende da nessun modulo) evitando di atterrare su una pagina «in arrivo».
 *
 * La regola vive nell'hook (`primaRottaVisibile`): questa rotta, il redirect
 * post-login e quello post-onboarding condividono la STESSA fonte, così non
 * esistono due implementazioni divergenti.
 */
import { Navigate } from 'react-router-dom';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

export function ReindirizzaDipartimentoPrincipale() {
  const { primaRottaVisibile } = useFeatureFlags();
  return <Navigate to={primaRottaVisibile()} replace />;
}

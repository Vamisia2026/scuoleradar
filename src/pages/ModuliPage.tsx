import { ModuliModule } from '@/modules/modulistica';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';

/**
 * Pagina Modulistica — thin wrapper sul modulo isolato `src/modules/modulistica/`.
 * Tutta la logica (archivio, creatore, cache, pdf) vive nel modulo;
 * la pagina resta solo un punto di montaggio per il router.
 *
 * Il boundary protegge l'intero dipartimento: se l'archivio o il generatore
 * vanno in errore, il resto della dashboard (menu, altre sezioni) continua a
 * funzionare.
 */
export function ModuliPage() {
  return (
    <DepartmentErrorBoundary
      dipartimento="Modulistica"
      titolo="Il dipartimento Modulistica non è disponibile"
      messaggio="L'archivio dei moduli non può essere aperto in questo momento. Dal menu qui sopra puoi usare gli altri servizi di ScuoleRadar e riprovare più tardi."
    >
      <ModuliModule />
    </DepartmentErrorBoundary>
  );
}

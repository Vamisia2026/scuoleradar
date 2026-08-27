import { ModuliModule } from '@/modules/modulistica';

/**
 * Pagina Modulistica — thin wrapper sul modulo isolato `src/modules/modulistica/`.
 * Tutta la logica (archivio, creatore, cache, pdf) vive nel modulo;
 * la pagina resta solo un punto di montaggio per il router.
 */
export function ModuliPage() {
  return <ModuliModule />;
}

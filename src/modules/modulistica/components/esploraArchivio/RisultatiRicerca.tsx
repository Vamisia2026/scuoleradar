/**
 * Modulistica · Archivio — vista dei risultati di ricerca (globale sul catalogo).
 *
 * Tre stati: consultazione in corso (skeleton), nessun risultato (con suggerimenti
 * di parole alternative) e griglia dei moduli trovati, con avviso sui refusi
 * corretti. Presentazione pura: risultati e stato arrivano da `EsploraArchivio`.
 */
import { SearchX } from 'lucide-react';
import type { DocumentoModulistica } from '@/data/moduli';
import type { DocConPercorso } from './alberoCatalogo';
import { CardModulo } from './CardModulo';
import { SkeletonConsultazione } from './SkeletonConsultazione';

interface RisultatiRicercaProps {
  /** Documenti trovati (con il percorso per il breadcrumb della card). */
  risultatiRicerca: DocConPercorso[];
  /** Token corretti automaticamente (es. «sostengo» → «sostegno»). */
  refusiCorretti: { originale: string; corretto: string }[];
  /** true durante la consultazione (~2s) dopo l'invio della ricerca. */
  consultando: boolean;
  /** Query commessa, mostrata nel messaggio «nessun risultato». */
  filtro?: string;
  /** Modalità compatta: riduce i margini interni. */
  compatto: boolean;
  /** Apre un documento terminale. */
  onApriDocumento: (doc: DocumentoModulistica, percorso: string[]) => void;
}

export function RisultatiRicerca({
  risultatiRicerca,
  refusiCorretti,
  consultando,
  filtro,
  compatto,
  onApriDocumento,
}: RisultatiRicercaProps) {
  return (
      <div className={`animate-fade-in ${compatto ? 'mt-2' : 'mt-4'}`}>
        {consultando ? (
          <SkeletonConsultazione />
        ) : risultatiRicerca.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary-100 p-10 text-center">
            <SearchX className="h-8 w-8 text-primary-200" />
            <p className="max-w-md text-sm leading-relaxed text-primary-500">
              Nessun modulo corrisponde a «{filtro}». Prova con parole più generiche, ad esempio
              «sostegno», «PEI», «delega», «permesso».
            </p>
          </div>
        ) : (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-wide text-primary-400">
              Ricerca nell&apos;archivio · {risultatiRicerca.length} moduli trovati
            </p>
            {refusiCorretti.length > 0 && (
              <p className="mt-1 text-left text-xs font-medium text-primary-400">
                Mostro i risultati per{' '}
                <span className="font-semibold text-primary-600">
                  {refusiCorretti.map((r) => r.corretto).join(', ')}
                </span>{' '}
                (ricerca originale: {refusiCorretti.map((r) => r.originale).join(', ')})
              </p>
            )}
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${compatto ? 'mt-3' : 'mt-4'}`}
            >
              {risultatiRicerca.map(({ doc, percorso }, index) => (
                <CardModulo
                  key={doc.id}
                  doc={doc}
                  percorso={percorso}
                  onApri={onApriDocumento}
                  index={index}
                />
              ))}
            </div>
          </>
        )}
      </div>
  );
}

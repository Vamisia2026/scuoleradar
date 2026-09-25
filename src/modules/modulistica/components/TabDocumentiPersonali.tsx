/**
 * Modulistica — TERZA TAB «I Miei Documenti».
 *
 * Spazio di archiviazione PERSONALE dell'utente: trascinamento (drag & drop) o
 * selezione di PDF, JPG, PNG e Word, con apertura e rimozione. Riusa il componente
 * di piattaforma `components/documenti/MieiDocumenti`, lo stesso montato nella
 * sezione «Documenti» del profilo: limiti, disclaimer e comportamento restano
 * identici nelle due superfici (una sola implementazione da mantenere).
 *
 * Nessun paywall: sono file dell'utente, non moduli del catalogo.
 */
import { FolderUp } from 'lucide-react';
import { MieiDocumenti } from '@/components/documenti/MieiDocumenti';

interface TabDocumentiPersonaliProps {
  /** Layout compatto (barra strumenti della dashboard in modalità ridotta). */
  compatto?: boolean;
}

export function TabDocumentiPersonali({ compatto }: TabDocumentiPersonaliProps) {
  return (
    <div className={compatto ? 'mt-3' : 'mt-4'}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <FolderUp className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-base font-bold text-primary-800">I Miei Documenti</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
            Il tuo spazio personale: carica titoli, certificazioni, autocertificazioni o moduli
            compilati e ritrovali quando ti servono. Trascina i file nell&apos;area qui sotto oppure
            scegli dal computer.
          </p>
        </div>
      </div>
      <div className="mt-3">
        <MieiDocumenti />
      </div>
    </div>
  );
}

/**
 * Profilo · «Documenti» → tab 1 «Moduli scaricati».
 *
 * Archivio dei MODULI UFFICIALI passati dall'utente (storico locale condiviso con
 * la pagina Modulistica via `scuoleradar:moduli_scaricati`): riscarica, rimozione
 * singola e svuotamento. Il rimando alla Modulistica segue le FEATURE FLAGS: se il
 * dipartimento è spento non compare alcun link morto.
 */
import { Link } from 'react-router-dom';
import { Download, FolderOpen, Trash2 } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useToast } from '@/components/Toast';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { conAggiuntaInCima, STORAGE_KEY_MODULI_SCARICATI, type ModuloScaricato } from '@/data/moduli';

/** Data leggibile (it-IT) dello scaricamento, con fallback all'ISO. */
function formatDataScaricato(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

export function ModuliScaricati() {
  const { visibile } = useFeatureFlags();
  const { mostraToast } = useToast();
  // Storico condiviso con la pagina Moduli (stessa chiave localStorage).
  const [moduliScaricati, setModuliScaricati] = useLocalStorage<ModuloScaricato[]>(
    STORAGE_KEY_MODULI_SCARICATI,
    [],
  );

  const riscaricaModulo = (m: ModuloScaricato) => {
    setModuliScaricati(conAggiuntaInCima(moduliScaricati, m));
    // Nessun dialogo di "download simulato": il documento esiste già in archivio e
    // viene aperto/riscaricato come file statico dalla pagina Modulistica.
    mostraToast('successo', 'Modulo già pronto: aprilo in "Modelli Scaricati" per vederlo e stamparlo.');
  };

  const rimuoviModulo = (id: string) =>
    setModuliScaricati(moduliScaricati.filter((m) => m.id !== id));

  const svuotaStorico = () => setModuliScaricati([]);

  return (
    <div>
      {moduliScaricati.length === 0 ? (
        <p className="text-sm text-primary-400">
          Non hai ancora scaricato moduli ufficiali. Visita la Modulistica per trovare documenti e
          template pronti all&apos;uso.
        </p>
      ) : (
        <ul className="space-y-2">
          {moduliScaricati.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-primary-100 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-primary-800">{m.nome}</p>
                <p className="text-xs text-primary-400">
                  {m.tipo} · scaricato il {formatDataScaricato(m.scaricatoIl)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => riscaricaModulo(m)}
                  aria-label={`Scarica di nuovo ${m.nome}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-white px-3 py-2 text-xs font-semibold text-primary-700 transition hover:bg-primary-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  Scarica
                </button>
                <button
                  onClick={() => rimuoviModulo(m.id)}
                  aria-label={`Rimuovi ${m.nome} dallo storico`}
                  className="rounded-lg p-2 text-primary-400 transition hover:bg-error-50 hover:text-error-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-primary-100 pt-3">
        {visibile('modulistica') && (
          <Link
            to="/dashboard/moduli?tab=miei"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-600"
          >
            <FolderOpen className="h-3.5 w-3.5" /> Vai alla pagina Modulistica
          </Link>
        )}
        {moduliScaricati.length > 0 && (
          <button
            onClick={svuotaStorico}
            className="text-xs font-medium text-primary-400 transition hover:text-error-600"
          >
            Svuota archivio
          </button>
        )}
      </div>
    </div>
  );
}

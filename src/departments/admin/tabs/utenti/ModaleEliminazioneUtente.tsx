/**
 * Dipartimento Admin · tab Utenti — conferma di eliminazione definitiva.
 *
 * Richiede la digitazione di «DELETE» per abilitare il pulsante (doppia barriera:
 * dialog + parola di conferma). Presentazione pura: target, testo digitato e
 * azione arrivano dal contenitore `TabUtenti`.
 */
import { Loader2, Trash2 } from 'lucide-react';
import { btnAdmin, btnDanger, btnGhost, inputAdmin } from '../../adminUi';
import type { AdminUtente } from '../../types';

interface ModaleEliminazioneUtenteProps {
  /** Chiude la modale annullando l'operazione. */
  setEliminaTarget: (utente: AdminUtente | null) => void;
  /** Testo digitato dall'operatore (deve essere «DELETE»). */
  testoEliminazione: string;
  setTestoEliminazione: (valore: string) => void;
  /** true mentre l'operazione è in corso (disabilita i pulsanti). */
  creazione: boolean;
  /** Esegue l'eliminazione definitiva. */
  confermaEliminazione: () => Promise<void>;
}

export function ModaleEliminazioneUtente({
  setEliminaTarget,
  testoEliminazione,
  setTestoEliminazione,
  creazione,
  confermaEliminazione,
}: ModaleEliminazioneUtenteProps) {
  return (
        <div className="fixed inset-0 z-[92] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Conferma eliminazione">
          <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={() => setEliminaTarget(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-card animate-pop">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-primary-800">Eliminazione definitiva</h3>
                <p className="mt-1 text-xs leading-relaxed text-primary-500">
                  L'eliminazione è irreversibile (account, profilo e preferenze). Digita{' '}
                  <b className="text-primary-800">DELETE</b> per abilitare la conferma.
                </p>
              </div>
            </div>
            <input
              value={testoEliminazione}
              onChange={(e) => setTestoEliminazione(e.target.value)}
              placeholder="DELETE"
              className={`${inputAdmin} mt-3 font-mono`}
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setEliminaTarget(null)} className={`${btnAdmin} ${btnGhost}`}>Annulla</button>
              <button
                type="button"
                disabled={testoEliminazione.trim().toUpperCase() !== 'DELETE' || creazione}
                onClick={() => void confermaEliminazione()}
                className={`${btnAdmin} ${btnDanger} bg-red-600 text-white hover:bg-red-700`}
              >
                {creazione ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Conferma eliminazione definitiva
              </button>
            </div>
          </div>
        </div>
  );
}

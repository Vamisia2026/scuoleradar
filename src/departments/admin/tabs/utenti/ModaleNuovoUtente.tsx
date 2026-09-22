/**
 * Dipartimento Admin · tab Utenti — modale «Aggiungi utente».
 *
 * Form di creazione account (nome, cognome, genere, età, email, telegram,
 * telefono) con stato di invio e chiusura. Presentazione pura: i campi del form
 * (`nuovo`) e la funzione di salvataggio arrivano dal contenitore.
 */
import { Loader2, UserPlus, X } from 'lucide-react';
import { btnAdmin, btnGhost, btnPrim, inputAdmin } from '../../adminUi';
import type { NuovoUtenteInput } from '../../adminService';

interface ModaleNuovoUtenteProps {
  /** Valori correnti del form di creazione. */
  nuovo: NuovoUtenteInput;
  setNuovo: (valori: NuovoUtenteInput) => void;
  /** true mentre la creazione è in corso (disabilita i pulsanti). */
  creazione: boolean;
  /** Invia il form e crea l'account. */
  salvaNuovo: () => Promise<void>;
  /** Chiude la modale (overlay, X, Annulla). */
  setNuovoAperto: (aperto: boolean) => void;
}

export function ModaleNuovoUtente({
  nuovo,
  setNuovo,
  creazione,
  salvaNuovo,
  setNuovoAperto,
}: ModaleNuovoUtenteProps) {
  return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Aggiungi utente">
          <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={() => setNuovoAperto(false)} />
          <form
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-card animate-pop"
            onSubmit={(e) => { e.preventDefault(); void salvaNuovo(); }}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-primary-800">Aggiungi Utente</h3>
              <button type="button" onClick={() => setNuovoAperto(false)} className="rounded-full p-1.5 text-primary-400 hover:bg-primary-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block col-span-2">
                <span className="text-[10px] font-bold uppercase text-primary-500">Email *</span>
                <input type="email" required value={nuovo.email} onChange={(e) => setNuovo({ ...nuovo, email: e.target.value })} placeholder="nome@scuoleradar.it" className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block col-span-2">
                <span className="text-[10px] font-bold uppercase text-primary-500">Password * (min 6)</span>
                <input type="password" required minLength={6} value={nuovo.password} onChange={(e) => setNuovo({ ...nuovo, password: e.target.value })} className={`${inputAdmin} mt-1`} />
                <span className="mt-0.5 block text-[10px] text-primary-400">
                  Default: Scuoleradar2026 — al primo accesso l'utente dovrà cambiarla.
                </span>
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Nome</span>
                <input value={nuovo.nome ?? ''} onChange={(e) => setNuovo({ ...nuovo, nome: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Cognome</span>
                <input value={nuovo.cognome ?? ''} onChange={(e) => setNuovo({ ...nuovo, cognome: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Phone</span>
                <input value={nuovo.telefono ?? ''} onChange={(e) => setNuovo({ ...nuovo, telefono: e.target.value })} className={`${inputAdmin} mt-1`} />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold uppercase text-primary-500">Piano</span>
                <select
                  value={nuovo.piano ?? 'base'}
                  onChange={(e) => {
                    const pianoSel = e.target.value;
                    setNuovo({
                      ...nuovo,
                      piano: pianoSel,
                      proTipo:
                        pianoSel === 'pro_mensile' ? 'mensile' : pianoSel === 'pro_annuale' ? 'annuale' : null,
                    });
                  }}
                  className={`${inputAdmin} mt-1`}
                >
                  <option value="base">Base</option>
                  <option value="pro_mensile">PRO Mensile</option>
                  <option value="pro_annuale">PRO Annuale</option>
                  <option value="free_forever">Free Forever</option>
                </select>
                <label className="col-span-2 mt-1 flex cursor-pointer items-center gap-1.5 text-xs text-primary-700">
                  <input
                    type="checkbox"
                    checked={nuovo.isBetaTester === true}
                    onChange={(e) => setNuovo({ ...nuovo, isBetaTester: e.target.checked })}
                  />
                  Beta Tester (segmentazione campagne email)
                </label>
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setNuovoAperto(false)} className={`${btnAdmin} ${btnGhost}`}>Annulla</button>
              <button type="submit" disabled={creazione} className={`${btnAdmin} ${btnPrim}`}>
                {creazione ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Crea account
              </button>
            </div>
          </form>
        </div>
  );
}

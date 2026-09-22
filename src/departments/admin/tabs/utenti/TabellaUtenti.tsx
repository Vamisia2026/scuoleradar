/**
 * Dipartimento Admin · tab Utenti — tabella dell'elenco utenti.
 *
 * Colonne configurabili, modifica inline (nome, genere, età, piano, province,
 * telegram, telefono) con conferma, azioni di riga (dettaglio, reset password,
 * eliminazione) e stato vuoto. Presentazione pura: righe, stato di editing e
 * handler arrivano dal contenitore `TabUtenti`.
 */
import { Edit3, Eye, KeyRound, Trash2 } from 'lucide-react';
import { BadgeBeta, BadgePianoCompatto, btnAdmin, btnDanger, btnGhost, inputAdmin } from '../../adminUi';
import type { AdminUtente } from '../../types';
import { badgeGenere, loginType, type IdColonna } from './utentiHelpers';

interface TabellaUtentiProps {
  /** Righe da mostrare (già filtrate dal contenitore). */
  filtrati: AdminUtente[];
  /** true se la colonna è visibile. */
  visibile: (colonna: IdColonna) => boolean;
  /** Testo mostrato nella cella in editing. */
  testoCell: (utente: AdminUtente, campo: string) => string;
  /** Cella attualmente in modifica (id riga + campo + valore). */
  modifica: { id: string; campo: string; valore: string } | null;
  setModifica: (stato: { id: string; campo: string; valore: string } | null) => void;
  /** Apre l'editor inline di una cella. */
  iniziaModifica: (utente: AdminUtente, campo: string, valore: string) => void;
  /** Propone il salvataggio (con dialog di conferma). */
  proponiSalvataggio: (id: string, campo: string, valore: string) => void;
  /** Invia il reset password all'utente. */
  resetPassword: (utente: AdminUtente) => void;
  /** Apre la conferma di eliminazione definitiva. */
  richiediEliminazione: (utente: AdminUtente) => void;
  /** Apre la scheda di dettaglio. */
  setDettaglio: (utente: AdminUtente) => void;
}

export function TabellaUtenti({
  filtrati,
  visibile,
  testoCell,
  modifica,
  setModifica,
  iniziaModifica,
  proponiSalvataggio,
  resetPassword,
  richiediEliminazione,
  setDettaglio,
}: TabellaUtentiProps) {
  return (
        <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="bg-primary-50/70 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                {visibile('id') && <th className="px-3 py-2.5">User ID</th>}
                {visibile('nome') && <th className="px-3 py-2.5">Nome &amp; Cognome</th>}
                {visibile('genere') && <th className="px-3 py-2.5">Genere</th>}
                {visibile('eta') && <th className="px-3 py-2.5">Età</th>}
                {visibile('email') && <th className="px-3 py-2.5">Email</th>}
                {visibile('telegram') && <th className="px-3 py-2.5">Telegram</th>}
                {visibile('telefono') && <th className="px-3 py-2.5">Phone</th>}
                {visibile('province') && <th className="px-3 py-2.5">Provincia</th>}
                {visibile('piano') && <th className="px-3 py-2.5">Piano</th>}
                {visibile('login') && <th className="px-3 py-2.5">Login</th>}
                {visibile('azioni') && <th className="px-3 py-2.5 text-right">Azioni</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {filtrati.map((u) => {
                const cellaTesto = (campo: string) =>
                  modifica?.id === u.id && modifica.campo === campo ? (
                    <input
                      autoFocus
                      value={modifica.valore}
                      onChange={(e) => setModifica({ ...modifica, valore: e.target.value })}
                      onBlur={() => proponiSalvataggio(u.id, campo, modifica.valore)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') proponiSalvataggio(u.id, campo, modifica.valore);
                        if (e.key === 'Escape') setModifica(null);
                      }}
                      className={`${inputAdmin} w-32`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => iniziaModifica(u, campo, testoCell(u, campo))}
                      title="Clic per modificare la cella"
                      className="group inline-flex max-w-[180px] items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-primary-50"
                    >
                      <span className="truncate">{testoCell(u, campo) || '—'}</span>
                      <Edit3 className="h-3 w-3 shrink-0 text-primary-300 opacity-0 transition group-hover:opacity-100" />
                    </button>
                  );
                return (
                  <tr
                    key={u.id}
                    onDoubleClick={() => setDettaglio(u)}
                    title="Doppio click per aprire la scheda completa"
                    className="cursor-pointer align-top transition hover:bg-primary-50/40"
                  >
                    {visibile('id') && (
                      <td className="px-3 py-2.5 font-mono text-[10px] text-primary-400">{u.id.slice(0, 13)}…</td>
                    )}
                    {visibile('nome') && (
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-primary-800">{cellaTesto('nome')}</span>
                          {u.is_beta_tester === true && <BadgeBeta />}
                        </div>
                        {cellaTesto('cognome')}
                      </td>
                    )}
                    {visibile('genere') && (
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            u.genere === 'F'
                              ? 'bg-pink-100 text-pink-700'
                              : u.genere === 'M'
                                ? 'bg-sky-100 text-sky-700'
                                : 'bg-primary-50 text-primary-400'
                          }`}
                        >
                          {badgeGenere(u)}
                        </span>
                      </td>
                    )}
                    {visibile('eta') && (
                      <td className="px-3 py-2.5">
                        {typeof u.eta === 'number' ? (
                          <span className="inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-600">
                            {u.eta} anni
                          </span>
                        ) : (
                          <span className="text-primary-300">—</span>
                        )}
                      </td>
                    )}
                    {visibile('email') && <td className="px-3 py-2.5 text-primary-600">{u.email}</td>}
                    {visibile('telegram') && <td className="px-3 py-2.5">{cellaTesto('telegram')}</td>}
                    {visibile('telefono') && <td className="px-3 py-2.5">{cellaTesto('telefono')}</td>}
                    {visibile('province') && <td className="px-3 py-2.5">{cellaTesto('province')}</td>}
                    {visibile('piano') && (
                      <td className="px-3 py-2.5">
                        <BadgePianoCompatto utente={u} />
                      </td>
                    )}
                    {visibile('login') && <td className="px-3 py-2.5">{loginType(u)}</td>}
                    {visibile('azioni') && (
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setDettaglio(u)} className={`${btnAdmin} ${btnGhost}`} title="Apri scheda completa">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => resetPassword(u)} className={`${btnAdmin} ${btnGhost}`} title="Invia reset password">
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={() => richiediEliminazione(u)} className={`${btnAdmin} ${btnDanger}`} title="Elimina definitivamente">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtrati.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-10 text-center text-primary-400">
                    Nessun utente trovato con i filtri correnti.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
  );
}

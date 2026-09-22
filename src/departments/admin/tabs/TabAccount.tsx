/**
 * Dipartimento Admin · tab «Account» — piani, crediti e codice referral.
 *
 * Azioni rapide sul piano (upgrade PRO annuale/mensile, ritorno a Base, Free
 * Forever, regalo di un mese), gestione codice referral + flag beta tester e
 * sezione «Referral & Premi» in sola lettura (congelata).
 * Include i due utility di data usati solo qui (`GIORNO_MS`, `piuAnni`).
 */
import { useEffect, useState } from 'react';
import { CalendarPlus, Edit3, Loader2, Lock, RefreshCw, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { AdminApiError, aggiornaUtente, caricaUtenti } from '../adminService';
import {
  BadgeBeta,
  BadgePianoCompatto,
  ConfermaDialog,
  type ConfermaStato,
  btnAdmin,
  btnGhost,
  inputAdmin,
  nomeCognome,
} from '../adminUi';
import { dataItaliana, type AdminUtente } from '../types';

const GIORNO_MS = 86_400_000;

function piuAnni(base: Date | null, giorni: number): Date {
  const b = base && !Number.isNaN(base.getTime()) ? base.getTime() : Date.now();
  return new Date(Math.max(b, Date.now()) + giorni * GIORNO_MS);
}

export function TabAccount() {
  const { mostraToast } = useToast();
  const [utenti, setUtenti] = useState<AdminUtente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [conferma, setConferma] = useState<ConfermaStato | null>(null);

  const carica = async (): Promise<void> => {
    setCaricamento(true);
    try {
      setUtenti(await caricaUtenti());
    } catch (err) {
      mostraToast('errore', err instanceof AdminApiError ? err.message : (err as Error).message);
    } finally {
      setCaricamento(false);
    }
  };
  useEffect(() => {
    void carica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const azione = (u: AdminUtente, titolo: string, updates: Record<string, unknown>, descrizione: string): void => {
    setConferma({
      titolo,
      messaggio: `${descrizione} per ${u.email}? L'operazione viene salvata nel database.`,
      onConferma: async () => {
        await aggiornaUtente(u.id, updates);
        setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, ...updates } : x)));
        mostraToast('successo', `${titolo}: operazione completata.`);
      },
    });
  };

  const upgradeProAnnuale = (u: AdminUtente): void =>
    azione(
      u,
      'Attiva PRO Annuale',
      { piano: 'pro', pro_tipo: 'annuale', abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 365).toISOString() },
      'Assegna il piano PRO annuale',
    );
  const upgradeProMensile = (u: AdminUtente): void =>
    azione(
      u,
      'Attiva PRO Mensile',
      { piano: 'pro', pro_tipo: 'mensile', abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 30).toISOString() },
      'Assegna il piano PRO mensile',
    );
  const downgradeBase = (u: AdminUtente): void =>
    azione(u, 'Downgrade a Base', { piano: 'base', pro_tipo: null, abbonamento_scade_il: null }, "Riporta l'account al piano Base");
  const freeForever = (u: AdminUtente): void =>
    azione(
      u,
      'Imposta Free Forever',
      { piano: 'free_forever', pro_tipo: null, abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 365).toISOString() },
      'Assegna il piano PRO gratuito a vita',
    );
  const regalaMese = (u: AdminUtente): void =>
    azione(u, 'Regala 1 mese gratuito', { abbonamento_scade_il: piuAnni(u.abbonamento_scade_il ? new Date(u.abbonamento_scade_il) : null, 30).toISOString() }, 'Estende la scadenza di 30 giorni');

  // Codice invito personale: VISIBILE ma CONGELATO per default; l'admin può
  // sbloccarlo esplicitamente (per riga) prima di modificarlo.
  const [codiciSbloccati, setCodiciSbloccati] = useState<Set<string>>(() => new Set());

  const toggleBeta = (u: AdminUtente): void => {
    const valore = u.is_beta_tester !== true;
    setUtenti((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_beta_tester: valore } : x)));
    void aggiornaUtente(u.id, { is_beta_tester: valore }).then(() =>
      mostraToast('successo', valore ? 'Utente marcato come Beta Tester.' : 'Flag Beta Tester rimosso.'),
    );
  };

  const toggleCodice = (id: string): void => {
    setCodiciSbloccati((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const salvaCodice = (u: AdminUtente, codice: string): void => {
    const nuovo = codice.trim().toUpperCase();
    if (!nuovo) return;
    azione(u, 'Aggiorna codice invito', { referral_code: nuovo }, "Modifica del codice invito personale dell'utente");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-primary-800">Account &amp; abbonamento</h2>
        <button type="button" onClick={() => void carica()} className={`${btnAdmin} ${btnGhost}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Ricarica
        </button>
      </div>

      {caricamento ? (
        <div className="flex items-center justify-center gap-2 p-12 text-primary-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Caricamento…
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-primary-50/70 text-[11px] uppercase tracking-wide text-primary-500">
              <tr>
                <th className="px-3 py-2.5">Utente</th>
                <th className="px-3 py-2.5">Registrato</th>
                <th className="px-3 py-2.5">Piano</th>
                <th className="px-3 py-2.5">Scade il</th>
                <th className="px-3 py-2.5">Codice invito</th>
                <th className="px-3 py-2.5">Coupon / Referrer</th>
                <th className="px-3 py-2.5 text-right">Azioni rapide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-primary-100">
              {utenti.map((u) => {
                const piano = u.piano ?? 'base';
                const proTipo = String(u.pro_tipo ?? '').toLowerCase();
                const attivaAnnuale = piano === 'pro' && (!proTipo || proTipo.includes('annuale'));
                const attivaMensile = piano === 'pro' && proTipo.includes('mensile');
                const attivaBase = piano === 'base';
                const attivaFree = piano === 'free_forever';
                return (
                <tr key={u.id} className="align-top transition hover:bg-primary-50/40">
                  <td className="px-3 py-3">
                    <div className="font-bold text-primary-800">{nomeCognome(u)}</div>
                    <div className="text-primary-500">{u.email}</div>
                    {u.referral_code && (
                      <span className="mt-1 inline-block rounded-md bg-primary-50 px-1.5 py-0.5 font-mono text-[10px] text-primary-600">
                        {u.referral_code}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-primary-600">{dataItaliana(u.created_at)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <BadgePianoCompatto utente={u} />
                      {u.is_beta_tester === true && <BadgeBeta />}
                    </div>
                    <label className="mt-1 flex cursor-pointer items-center gap-1 text-[10px] text-primary-500">
                      <input type="checkbox" checked={u.is_beta_tester === true} onChange={() => toggleBeta(u)} />
                      Beta Tester
                    </label>
                  </td>
                  <td className="px-3 py-3 text-primary-600">{dataItaliana(u.abbonamento_scade_il)}</td>
                  <td className="px-3 py-3">
                    {codiciSbloccati.has(u.id) ? (
                      <input
                        autoFocus
                        defaultValue={u.referral_code ?? ''}
                        placeholder="NUOVOCODICE"
                        onBlur={(e) => salvaCodice(u, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') toggleCodice(u.id);
                        }}
                        className={`${inputAdmin} w-36`}
                      />
                    ) : (
                      <span
                        title="Codice congelato: usa “Sblocca codice” per modificarlo"
                        className="inline-flex items-center gap-1 rounded-md bg-primary-50 px-2 py-1 font-mono text-[10px] text-primary-600"
                      >
                        <Lock className="h-3 w-3 text-primary-300" />
                        {u.referral_code || '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-primary-600">
                    <div>Coupon: {u.coupon_codice ? `${u.coupon_codice} (${u.coupon_tipo ?? '?'})` : '—'}</div>
                    <div>Referrer: {u.referrer_email || u.referrer_id || '—'}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-pressed={attivaAnnuale}
                        onClick={attivaAnnuale ? undefined : () => upgradeProAnnuale(u)}
                        title={attivaAnnuale ? 'Piano attuale: PRO Annuale' : 'Assegna il piano PRO annuale'}
                        className={`${btnAdmin} ${
                          attivaAnnuale
                            ? 'cursor-default bg-orange-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        PRO Anno
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaMensile}
                        onClick={attivaMensile ? undefined : () => upgradeProMensile(u)}
                        title={attivaMensile ? 'Piano attuale: PRO Mensile' : 'Assegna il piano PRO mensile'}
                        className={`${btnAdmin} ${
                          attivaMensile
                            ? 'cursor-default bg-yellow-400 text-slate-900 shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        PRO Mese
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaBase}
                        onClick={attivaBase ? undefined : () => downgradeBase(u)}
                        title={attivaBase ? 'Piano attuale: Base' : 'Porta al piano Base'}
                        className={`${btnAdmin} ${
                          attivaBase
                            ? 'cursor-default bg-cyan-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Base
                      </button>
                      <button
                        type="button"
                        aria-pressed={attivaFree}
                        onClick={attivaFree ? undefined : () => freeForever(u)}
                        title={attivaFree ? 'Piano attuale: PRO Free Forever' : 'Assegna il piano PRO gratuito a vita'}
                        className={`${btnAdmin} ${
                          attivaFree
                            ? 'cursor-default bg-red-500 text-white shadow-soft'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Free Forever
                      </button>
                      <button type="button" onClick={() => regalaMese(u)} className={`${btnAdmin} ${btnGhost}`}>
                        <CalendarPlus className="h-3.5 w-3.5" /> +30gg
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleCodice(u.id)}
                        className={`${btnAdmin} ${btnGhost}`}
                        title={codiciSbloccati.has(u.id) ? 'Blocca di nuovo il codice invito' : 'Sblocca la modifica del codice invito'}
                      >
                        {codiciSbloccati.has(u.id) ? <X className="h-3.5 w-3.5" /> : <Edit3 className="h-3.5 w-3.5" />}
                        {codiciSbloccati.has(u.id) ? 'Blocca codice' : 'Sblocca codice'}
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Referral & Premi: sezione CONGELATA (sola lettura, niente esecuzione). */}
      <section className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500">
          <Lock className="h-4 w-4" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-600">Referral &amp; Premi — sezione congelata</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            La gestione dei premi referral è disattivata per evitare modifiche accidentali: nessuna azione
            di modifica viene eseguita da questo pannello (sola lettura lato dashboard utente).
          </p>
        </div>
      </section>

      <ConfermaDialog
        stato={conferma}
        onChiudi={() => setConferma(null)}
        onErrore={(msg) => mostraToast('errore', msg)}
      />
    </div>
  );
}

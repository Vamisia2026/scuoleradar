/**
 * Dipartimento Admin · tab Utenti — scheda di dettaglio di un singolo utente.
 *
 * Modale in sola lettura: identità, recapiti, piano, stato Radar, preferenze e
 * date. Componente autosufficiente (riceve solo `utente` e `onChiudi`), estratto
 * da `AdminTabs.tsx` con markup invariato.
 */
import type { ReactNode } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { BadgePiano, Chips, StatoRadarBadge, nomeCognome } from '../../adminUi';
import { dataItaliana, type AdminUtente } from '../../types';
import { loginType, telefono } from './utentiHelpers';

export function DettaglioUtente({ utente, onChiudi }: { utente: AdminUtente; onChiudi: () => void }) {
  const colonna = (label: string, valore: ReactNode) => (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-primary-400">{label}</div>
      <div className="mt-0.5 text-xs text-primary-800">{valore}</div>
    </div>
  );
  const radarAttivo = utente.radar_attivo !== undefined ? Boolean(utente.radar_attivo) : Boolean(utente.onboarded);
  return (
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-label="Scheda utente">
      <div className="absolute inset-0 bg-primary-900/40 backdrop-blur-sm" onClick={onChiudi} />
      <div className="relative flex h-full w-full max-w-xl flex-col bg-white shadow-card animate-pop">
        <header className="flex items-center justify-between gap-3 border-b border-primary-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-white">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-primary-800">{nomeCognome(utente)}</h2>
              <p className="text-xs text-primary-400">{utente.email}</p>
            </div>
          </div>
          <button type="button" onClick={onChiudi} aria-label="Chiudi" className="rounded-full p-2 text-primary-400 hover:bg-primary-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-primary-100 p-3">
            {colonna('User ID', <span className="font-mono text-[10px]">{utente.id}</span>)}
            {colonna('Piano', <BadgePiano piano={utente.piano} />)}
            {colonna('Registrato il', dataItaliana(utente.created_at))}
            {colonna('Scadenza abbonamento', dataItaliana(utente.abbonamento_scade_il))}
            {colonna('Telegram', utente.telegram_chat_id || '—')}
            {colonna('Phone', telefono(utente))}
            {colonna('Login type', loginType(utente))}
            {colonna('Onboarded', utente.onboarded ? 'Sì' : 'No')}
          </div>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Profilo utente &amp; filtri radar</h3>
            <div className="mt-2 space-y-2 text-xs text-primary-700">
              <p>
                <b>Classi di concorso:</b> <Chips valori={utente.classi_concorso} />
              </p>
              <p>
                <b>Materie:</b> <Chips valori={utente.materie_id} />
              </p>
              <p>
                <b>Province:</b> <Chips valori={utente.province_interesse ?? utente.province_attive} />
              </p>
              <p>
                <b>Ordini scuola:</b> <Chips valori={utente.ordini_scuola} />
              </p>
              <p>
                <b>Scuole preferite:</b> <Chips valori={utente.favorite_schools} />
              </p>
              <p>
                <b>Scuole escluse (blacklist):</b> <Chips valori={utente.ignored_schools} />
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Account &amp; storico</h3>
            <div className="mt-2 space-y-2 text-xs text-primary-700">
              <p>
                <b>Codice invito:</b> {utente.referral_code || '—'}
              </p>
              <p>
                <b>Referrer:</b> {utente.referrer_email || utente.referrer_id || '—'}
              </p>
              <p>
                <b>Coupon usato:</b> {utente.coupon_codice || '—'}
                {utente.coupon_tipo ? ` (${utente.coupon_tipo})` : ''}
              </p>
              <p>
                <b>Crediti a consumo:</b> {utente.crediti ?? 0}
              </p>
              <p>
                <b>Notifiche usate:</b> {utente.notifiche_usate ?? 0} / anno
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-primary-100 p-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-primary-500">Stato radar</h3>
            <div className="mt-2">
              <StatoRadarBadge attivo={radarAttivo} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/**
 * Dipartimento Admin · tab «Email & Automazioni».
 *
 * Console di controllo delle EMAIL TRANSZIONALI e di RICHIAMO del prodotto:
 * benvenuto, richiamo «Radar ancora spento» (24h), digest, alert in tempo reale,
 * promemoria di scadenza, drip abbonamento, preavvisi di rinnovo…
 *
 * Per ogni automazione la tabella mostra il TRIGGER (evento o finestra
 * temporale), l'OGGETTO corrente, l'ANTEPRIMA VISIVA del copy e l'INTERRUTTORE di
 * abilitazione: quando è OFF l'invio viene SALTATO (mai un errore all'utente).
 * Con «Anteprima & copy» si aprono l'anteprima del messaggio e l'editor dei testi
 * (oggetto, intro, corpo dove il messaggio nasce da un template centralizzato).
 *
 * Lo stato vive in `public.app_settings` (`email_automazione_<id>`), letto e
 * scritto tramite la Edge `admin`: nessun deploy necessario. Stato e azioni sono
 * nell'hook `hooks/useAutomazioniEmail`; la riga in `RigaAutomazione`.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, BadgeInfo, Loader2, Mail, RefreshCw } from 'lucide-react';
import { AUTOMAZIONI_EMAIL, testoAnteprima } from '@/config/automazioniEmail';
import { btnAdmin, btnGhost } from '../adminUi';
import { useAutomazioniEmail } from '../hooks/useAutomazioniEmail';
import { RigaAutomazione } from './RigaAutomazione';
import { GRUPPI, type FiltroGruppo } from './automazioniSupporto';

export function TabEmailAutomazioni() {
  const api = useAutomazioniEmail();
  const [gruppo, setGruppo] = useState<FiltroGruppo>('tutti');

  const elenco = useMemo(
    () => AUTOMAZIONI_EMAIL.filter((a) => gruppo === 'tutti' || a.gruppo === gruppo),
    [gruppo],
  );

  if (!api.caricato) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-primary-100 bg-white py-16 shadow-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Intestazione */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-primary-800">
            <Mail className="h-4 w-4" /> Email &amp; automazioni
          </h2>
          <p className="mt-0.5 text-xs text-primary-500">
            Trigger, oggetto, anteprima del copy e interruttore per ogni comunicazione automatica
            (transazionale e di richiamo). Stato attuale: {api.riepilogo.attive} attive ·{' '}
            {api.riepilogo.spente} disattivate · {api.riepilogo.testi} con testi personalizzati.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void api.carica()}
          disabled={api.inCaricamento}
          className={`${btnAdmin} ${btnGhost}`}
        >
          {api.inCaricamento ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Ricarica
        </button>
      </div>

      {/* Provenienza dello stato */}
      {api.demo ? (
        <p className="flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-[11px] leading-relaxed text-warning-700">
          <BadgeInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Stato NON letto da Supabase (demo/offline): gli interruttori valgono solo in questo browser.
          Con una sessione admin attiva le modifiche vengono salvate in
          <code className="mx-1 rounded bg-white px-1">public.app_settings</code>
          e applicate subito da Edge Function e notifier.
        </p>
      ) : (
        <p className="flex items-start gap-2 rounded-xl border border-primary-100 bg-primary-50/60 px-3 py-2 text-[11px] leading-relaxed text-primary-600">
          <BadgeInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Stato salvato in <code className="mx-1 rounded bg-white px-1">public.app_settings</code>{' '}
          (chiave <code className="mx-1 rounded bg-white px-1">email_automazione_&lt;id&gt;</code>):
          l'interruttore agisce su Edge Function (invii transazionali e cron) e notifier (digest,
          alert, promemoria) senza deploy.
        </p>
      )}

      {api.errore && (
        <p className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-[11px] text-error-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {api.errore}
        </p>
      )}

      {/* Filtro per gruppo */}
      <nav className="flex flex-wrap gap-1">
        {(['tutti', ...GRUPPI] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGruppo(g)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition ${
              gruppo === g
                ? 'bg-primary-500 text-white shadow-soft'
                : 'bg-white text-primary-600 ring-1 ring-primary-100 hover:bg-primary-50'
            }`}
          >
            {g === 'tutti' ? 'Tutte' : g}
          </button>
        ))}
      </nav>

      {/* Tabella delle automazioni */}
      <div className="overflow-x-auto rounded-2xl border border-primary-100 bg-white shadow-card">
        <table className="w-full min-w-[920px] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-primary-500">
              <th className="px-3 py-2.5">Automazione</th>
              <th className="px-3 py-2.5">Trigger temporale / evento</th>
              <th className="px-3 py-2.5">Oggetto</th>
              <th className="px-3 py-2.5">Anteprima copy</th>
              <th className="px-3 py-2.5">Invio</th>
            </tr>
          </thead>
          <tbody>
            {elenco.map((a) => {
              const stato = api.statoDi(a.id);
              return (
                <RigaAutomazione
                  key={a.id}
                  automazione={a}
                  stato={stato}
                  testi={testoAnteprima(a, stato)}
                  bozza={api.aperta === a.id ? api.bozza : null}
                  aperta={api.aperta === a.id}
                  inSalvataggio={api.inSalvataggio === a.id}
                  copiato={api.copiato === a.id}
                  onToggle={() => api.cambiaAbilitazione(a)}
                  onApri={() => api.apriEditor(a)}
                  onChiudi={api.chiudiEditor}
                  onCopia={() => api.copiaAnteprima(a)}
                  onBozza={api.aggiornaBozza}
                  onSalva={() => api.salvaTesti(a)}
                  onRipristina={() => api.ripristinaTesti(a)}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-primary-400">
        Il catalogo (nomi, trigger, copy del codice) è in{' '}
        <code className="rounded bg-white px-1">src/config/automazioniEmail.ts</code>: i testi qui
        salvati vengono applicati al momento dell&apos;invio da Edge Function e notifier. Ogni modifica è
        coperta da <code className="rounded bg-white px-1">npm run test:automazioni</code>.
      </p>
    </div>
  );
}

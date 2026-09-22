/**
 * Dipartimento Admin · tab «Dipartimenti» — feature flags a 3 stati.
 *
 * OFF  → il dipartimento sparisce da navbar/rotte e le notifiche sono bloccate;
 * TEST → visibile e accessibile solo all'admin, con notifiche automatiche
 *        dirottate sull'account di test;
 * ON   → pubblico, notifiche operative regolari.
 *
 * Il cambio è IMMEDIATO nel browser corrente (store condiviso + localStorage).
 * Per gli invii server-side (scraper, Edge Functions, cron) lo stato va
 * allineato con le variabili d'ambiente `FEATURE_<DIPARTIMENTO>`: la sezione
 * «Allineamento server» qui sotto riporta i comandi pronti da copiare.
 *
 * Il file vive in `components/` (regola UI di `docs/MODULAR_ARCHITECTURE.md`);
 * le altre tab storiche restano in `tabs/`.
 */
import { useState } from 'react';
import { Copy, Layers, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { FlagDipartimentiPanel } from '@/components/FlagDipartimentiPanel';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { DIPARTIMENTI } from '@/config/features';
import { etichettaStato } from '@/config/statoDipartimenti';
import { btnAdmin, btnGhost, btnPrim } from '../adminUi';

export function TabDipartimenti() {
  const { mostraToast } = useToast();
  const flags = useFeatureFlags();
  const [copiato, setCopiato] = useState(false);

  /** Righe `FEATURE_X=stato` per gli invii server-side (Node/Deno). */
  const righeAmbiente = DIPARTIMENTI.map(
    (d) => `FEATURE_${d.id.toUpperCase()}=${flags.stati[d.id]}`,
  ).join('\n');

  const copiaAmbiente = (): void => {
    const testo = `# Feature flags dipartimenti — allineamento server\n${righeAmbiente}`;
    void navigator.clipboard
      ?.writeText(testo)
      .then(() => {
        setCopiato(true);
        mostraToast('successo', 'Variabili copiate: incollale nei secrets/workflow.');
      })
      .catch(() => mostraToast('errore', 'Copia non riuscita: seleziona il testo manualmente.'));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-bold text-primary-800">
            <Layers className="h-4 w-4" /> Dipartimenti &amp; feature flags
          </h2>
          <p className="mt-0.5 text-xs text-primary-500">
            Stato di pubblicazione dei moduli: OFF (spento) · TEST (solo admin) · ON (pubblico).
          </p>
        </div>
        <button type="button" onClick={flags.azzera} className={`${btnAdmin} ${btnGhost}`}>
          <RefreshCw className="h-3.5 w-3.5" /> Ripristina default
        </button>
      </div>

      <p className="rounded-xl border border-warning-500/40 bg-warning-50 px-3 py-2 text-[11px] leading-relaxed text-warning-700">
        In stato <strong>TEST</strong> le notifiche automatiche (email Resend e Telegram) vengono
        dirottate sull’account di test dell’admin: nessun beta tester o utente normale riceve
        messaggi da un modulo in prova. In stato <strong>OFF</strong> ogni invio è bloccato.
        Il dirottamento si disattiva con <code>FEATURE_TEST_REDIRECT=0</code> (i canali non-admin
        vengono semplicemente scartati).
      </p>

      <FlagDipartimentiPanel
        stati={flags.stati}
        dipartimenti={DIPARTIMENTI}
        onCambia={flags.impostaStato}
        origine={flags.origine}
      />

      <section className="rounded-2xl border border-primary-100 bg-white p-4 shadow-card">
        <h3 className="text-sm font-bold text-primary-800">Allineamento server</h3>
        <p className="mt-1 text-xs leading-relaxed text-primary-500">
          Il toggle qui sopra vale per questo browser. Gli invii automatici avvengono lato
          server (scraper Node, Edge Functions, cron): imposta le stesse variabili nei secrets
          Supabase e nei workflow GitHub perché anche le notifiche seguano lo stato scelto.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-primary-700">
          {righeAmbiente}
        </pre>
        <button type="button" onClick={copiaAmbiente} className={`${btnAdmin} ${btnPrim} mt-3`}>
          <Copy className="h-3.5 w-3.5" /> {copiato ? 'Copiato' : 'Copia variabili'}
        </button>
      </section>

      <p className="text-[11px] text-primary-400">
        Stato corrente: {DIPARTIMENTI.map((d) => `${d.nome} ${etichettaStato(flags.stati[d.id])}`).join(' · ')}.
        {flags.eAdmin ? ' Sei riconosciuto come admin: vedi anche i moduli non pubblici.' : ''}
      </p>
    </div>
  );
}

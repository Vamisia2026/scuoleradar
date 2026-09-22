/**
 * Radar Status Toggle — Attivo / In Pausa (Profilo / Dashboard).
 *
 * SAFEGUARD: il Radar può essere attivato SOLO con criteri minimi validi
 * (almeno 1 Provincia E almeno 1 Classe di Concorso/Materia). Senza configurazione
 * si apre il setup Radar (soft); se chiuso/cancellato senza salvare criteri validi
 * il toggle torna su OFF con toast:
 *   "Non hai configurato il tuo Radar: il servizio rimane disattivato."
 */
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Radar } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import { pianoLimits } from '@/lib/planLimits';
import {
  impostaPassoRadar,
  messaggioCampiMancanti,
  validaConfigRadar,
} from '@/lib/radarValidation';
import {
  dataScadenzaBreve,
  etichettaScadenzaAbbonamento,
  inFinestraPreavviso,
} from '@/lib/abbonamento';
import { track } from '@/lib/analytics';
import { valutaConfigurazioneRadar } from './valutaConfigurazione';

interface RadarStatusToggleProps {
  /**
   * Titolo della card: nella Dashboard diventa il titolo principale "Radar Scuole"
   * (barra di controllo consolidata); altrove resta "Stato del Radar Scuole".
   */
  titolo?: string;
}

export function RadarStatusToggle({ titolo = 'Stato del Radar Scuole' }: RadarStatusToggleProps = {}) {
  const {
    radarAttivo,
    aggiornaRadarAttivo,
    preferenze,
    supabaseUserId,
    radarWizardOpen,
    openRadarWizard,
    piano,
    hasProAccess,
    trialAttivo,
    trialScadenza,
  } = useApp();
  const { mostraToast } = useToast();
  // Programma di notifica del piano (Base: digest 17:00 · PRO: real-time).
  const notificaPiano = pianoLimits(piano, hasProAccess);
  const [inCorso, setInCorso] = useState(false);
  /** true se attendiamo il salvataggio del wizard per decidere il revert. */
  const revertInSospeso = useRef(false);

  // Quando il setup Radar si chiude (salvato OPPURE cancellato con X/ESC/backdrop)
  // rivaluta i criteri: se ancora mancanti il Radar resta su OFF + toast di avviso.
  useEffect(() => {
    if (radarWizardOpen || !revertInSospeso.current) return;
    const timeout = setTimeout(() => {
      revertInSospeso.current = false;
      void valutaConfigurazioneRadar(preferenze, supabaseUserId).then((v) => {
        if (v.valido) return; // criteri salvati dal wizard → Radar attivo
        if (radarAttivo) void aggiornaRadarAttivo(false);
        mostraToast(
          'errore',
          messaggioCampiMancanti(v.mancanti) ||
            'Non hai configurato il tuo Radar: il servizio rimane disattivato.',
        );
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [
    radarWizardOpen,
    revertInSospeso,
    preferenze,
    supabaseUserId,
    radarAttivo,
    aggiornaRadarAttivo,
    mostraToast,
  ]);

  const cambia = async (valore: boolean): Promise<void> => {
    if (inCorso) return;
    setInCorso(true);
    try {
      if (!valore) {
        await aggiornaRadarAttivo(false);
        track('radar_status_toggled', { status: 'paused' });
        return;
      }
      // SAFEGUARD: il Radar si attiva SOLO con tutti i campi obbligatori
      // (Ordini + Province + Classi/Materie), stato locale + DB come fonte.
      const valutazione = await valutaConfigurazioneRadar(preferenze, supabaseUserId);
      if (valutazione.valido) {
        await aggiornaRadarAttivo(true);
        track('radar_status_toggled', { status: 'active' });
        return;
      }
      // Campi mancanti: BLOCCO + avviso puntuale + wizard sul primo passo da completare.
      // Se il wizard viene chiuso senza salvare, l'effect sopra riporta il toggle su OFF.
      mostraToast('errore', messaggioCampiMancanti(valutazione.mancanti));
      impostaPassoRadar(valutazione.primoPasso);
      revertInSospeso.current = true;
      openRadarWizard();
    } finally {
      setInCorso(false);
    }
  };

  const provinceCount = preferenze.provinceCodici.length;
  const classiCount =
    preferenze.classiCodici.length + preferenze.materieId.length + preferenze.materieCustom.length;
  const ordiniCount = preferenze.ordini.length;
  /** Sezioni obbligatorie ancora mancanti (messaggio puntuale in card). */
  const mancantiRadar = validaConfigRadar({
    ordini: preferenze.ordini,
    provinceCodici: preferenze.provinceCodici,
    classiCodici: preferenze.classiCodici,
    materieId: preferenze.materieId,
    materieCustom: preferenze.materieCustom,
  }).mancanti;

  /** Livello account mostrato nella barra di stato (Base / PRO / Trial PRO / Free Forever). */
  const etichettaTier =
    piano === 'free_forever'
      ? 'PRO (Free Forever)'
      : piano === 'pro' && trialAttivo
        ? 'PRO (mese gratuito)'
        : piano === 'pro'
          ? 'PRO'
          : 'BASE';

  /** Upsell: mostrato SOLO per il piano Base (nessun CTA per Trial PRO/PRO/Free Forever). */
  const mostraCtaPro = !hasProAccess && piano === 'base';

  return (
    <section className="rounded-2xl border border-primary-100 bg-white p-3 shadow-card sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              radarAttivo ? 'bg-emerald-100 text-emerald-600' : 'bg-warning-100 text-warning-700'
            }`}
          >
            <Radar className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-extrabold text-primary-900">{titolo}</h3>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ring-1 ring-inset ${
                  mostraCtaPro
                    ? 'bg-slate-100 text-slate-600 ring-slate-200'
                    : 'bg-secondary-50 text-secondary-700 ring-secondary-300'
                }`}
              >
                {etichettaTier}
              </span>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
              {radarAttivo
                ? notificaPiano.piano === 'pro'
                  ? 'In attività: ti avvisiamo in tempo reale (real-time) non appena esce un’opportunità per il tuo profilo.'
                  : 'In attività: riceverai un digest quotidiano alle 17:00 con le opportunità del giorno.'
                : 'In pausa: le tue preferenze restano salvate, ma non inviamo notifiche.'}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {radarAttivo ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-300">
                  🟢 RADAR ATTIVO
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-warning-700 ring-1 ring-inset ring-warning-300">
                  🟡 IN PAUSA
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                🕔 {notificaPiano.etichettaNotifiche}
              </span>
              {ordiniCount > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600">
                  {ordiniCount} {ordiniCount === 1 ? 'ordine di scuola' : 'ordini di scuola'}
                </span>
              )}
              {provinceCount > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600">
                  {provinceCount} {provinceCount === 1 ? 'provincia' : 'province'}
                </span>
              )}
              {classiCount > 0 && (
                <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-600">
                  {classiCount} tra classi e materie
                </span>
              )}
            </div>
            {mancantiRadar.length > 0 && (
              <p className="mt-1 text-[11px] text-error-600">{messaggioCampiMancanti(mancantiRadar)}</p>
            )}
            {/* Policy trial PRO 1 mese: promemoria di rinnovo nella finestra 3–5
                giorni, con gli STESSI numeri del cron DB `rinnovo-preavvisi-3-5g`
                (che invia email + Telegram). */}
            {trialAttivo && inFinestraPreavviso(trialScadenza) && (
              <div className="mt-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2">
                <p className="text-[11px] font-semibold leading-relaxed text-warning-800">
                  ⏳ Il tuo mese PRO gratuito termina{' '}
                  {etichettaScadenzaAbbonamento(trialScadenza)}
                  {dataScadenzaBreve(trialScadenza) ? ` (${dataScadenzaBreve(trialScadenza)})` : ''}. Ti abbiamo
                  inviato un promemoria per email.
                </p>
                <Link
                  to="/prezzi"
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-secondary-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-soft transition hover:bg-secondary-600"
                >
                  Continua con PRO
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Comandi: etichetta + interruttore + CTA PRO (solo piano Base) */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-bold uppercase tracking-wide ${radarAttivo ? 'text-emerald-600' : 'text-warning-700'}`}
            >
              {radarAttivo ? 'Attivo' : 'In pausa'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={radarAttivo}
              aria-label="Attiva o metti in pausa il Radar"
              disabled={inCorso}
              onClick={() => void cambia(!radarAttivo)}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-50 ${
                radarAttivo ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              {inCorso ? (
                <Loader2 className="absolute left-1/2 h-4 w-4 -translate-x-1/2 animate-spin text-white" />
              ) : (
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    radarAttivo ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              )}
            </button>
          </div>
          {mostraCtaPro && (
            <Link
              to="/prezzi"
              className="inline-flex items-center gap-1.5 rounded-lg bg-secondary-500 px-3 py-1.5 text-xs font-bold text-white shadow-soft transition hover:bg-secondary-600"
            >
              Passa a PRO
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

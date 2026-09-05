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
import { Loader2, Radar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useApp, type Preferenze } from '@/contexts/AppContext';
import { useToast } from '@/components/Toast';
import { track } from '@/lib/analytics';

/** Criteri minimi: 1 provincia + 1 classe/materia (stato locale, poi DB). */
async function haCriteriMinimi(preferenze: Preferenze, userId?: string | null): Promise<boolean> {
  const provLocal = preferenze.provinceCodici.length;
  const classiLocal =
    preferenze.classiCodici.length + preferenze.materieId.length + preferenze.materieCustom.length;
  if (provLocal > 0 && classiLocal > 0) return true;
  if (!supabase || !userId) return provLocal > 0 && classiLocal > 0;

  const { data } = await supabase
    .from('profiles')
    .select('province_interesse, province_attive, classi_concorso, materie_id')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return false;
  const prov =
    (Array.isArray(data.province_interesse) ? data.province_interesse.length : 0) +
    (Array.isArray(data.province_attive) ? data.province_attive.length : 0);
  const classi =
    (Array.isArray(data.classi_concorso) ? data.classi_concorso.length : 0) +
    (Array.isArray(data.materie_id) ? data.materie_id.length : 0);
  return prov > 0 && classi > 0;
}

export function RadarStatusToggle() {
  const { radarAttivo, aggiornaRadarAttivo, preferenze, supabaseUserId, radarWizardOpen, openRadarSetup } =
    useApp();
  const { mostraToast } = useToast();
  const [inCorso, setInCorso] = useState(false);
  /** true se attendiamo il salvataggio del wizard per decidere il revert. */
  const revertInSospeso = useRef(false);

  // Quando il setup Radar si chiude (salvato OPPURE cancellato con X/ESC/backdrop)
  // rivaluta i criteri: se ancora mancanti il Radar resta su OFF + toast di avviso.
  useEffect(() => {
    if (radarWizardOpen || !revertInSospeso.current) return;
    const timeout = setTimeout(() => {
      revertInSospeso.current = false;
      void haCriteriMinimi(preferenze, supabaseUserId).then((ok) => {
        if (ok) return; // criteri salvati dal wizard → Radar attivo
        if (radarAttivo) void aggiornaRadarAttivo(false);
        mostraToast(
          'errore',
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
      // SAFEGUARD: prima di attivare verifico i criteri minimi (DB come fonte).
      const ok = await haCriteriMinimi(preferenze, supabaseUserId);
      if (ok) {
        await aggiornaRadarAttivo(true);
        track('radar_status_toggled', { status: 'active' });
        return;
      }
      // Configurazione mancante → apre il setup Radar; se chiuso senza salvare,
      // l'effect sopra riporta il toggle su OFF con il toast.
      revertInSospeso.current = true;
      openRadarSetup();
    } finally {
      setInCorso(false);
    }
  };

  const provinceCount = preferenze.provinceCodici.length;
  const classiCount = preferenze.classiCodici.length + preferenze.materieId.length;

  return (
    <section className="rounded-2xl border border-primary-100 bg-white p-5 shadow-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              radarAttivo ? 'bg-emerald-100 text-emerald-600' : 'bg-warning-100 text-warning-700'
            }`}
          >
            <Radar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-primary-800">Stato del Radar Scuole</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-primary-500">
              {radarAttivo
                ? 'In attività: ti avvisiamo appena esce un’opportunità per il tuo profilo.'
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
            {(provinceCount === 0 || classiCount === 0) && (
              <p className="mt-1 text-[11px] text-error-600">
                Configura almeno 1 provincia e 1 classe di concorso per attivare il Radar.
              </p>
            )}
          </div>
        </div>

        {/* Interruttore */}
        <div className="flex shrink-0 items-center gap-3">
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
      </div>
    </section>
  );
}

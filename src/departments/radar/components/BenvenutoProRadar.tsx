/**
 * Radar — BENVENUTO PRO (primo accesso con piano PRO attivo).
 *
 * Mostrato UNA SOLA VOLTA per utente (chiave localStorage per id/email): dà il
 * benvenuto, si congratula per il mese di PRO in omaggio (prova PureFocus) e
 * invita SUBITO ad attivare il Radar — senza il quale il piano resta inutilizzato.
 *
 * Non è un modal bloccante a sorpresa: compare solo con piano CONFERMATO dal DB
 * (`pianoStato === 'pronto'`), profilo anagrafico completo e nessun altro modal
 * aperto; chiuderlo non impedisce di riaprirlo dalle CTA del Radar.
 */
import { useEffect, useState } from 'react';
import { CalendarClock, PartyPopper, Radar, Sparkles } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useApp } from '@/contexts/AppContext';

/** Prefisso della chiave localStorage «benvenuto PRO già mostrato». */
const PREFISSO_CHIAVE = 'sr_benvenuto_pro_';

/** Data leggibile (it-IT) della fine della prova PRO, o stringa vuota. */
function formattaScadenza(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export function BenvenutoProRadar() {
  const {
    user,
    supabaseUserId,
    loading,
    profiloIncompleto,
    piano,
    pianoStato,
    hasProAccess,
    trialAttivo,
    trialScadenza,
    preferenze,
    radarWizardOpen,
    openRadarSetup,
  } = useApp();

  /** Identificativo stabile per la chiave «già visto» (id Supabase o email). */
  const identificativo = supabaseUserId ?? user?.email ?? '';
  const chiave = identificativo ? `${PREFISSO_CHIAVE}${identificativo}` : '';

  // Parte da `true`: nessun benvenuto prima di sapere CHI è l'utente (niente flash).
  const [giaVisto, setGiaVisto] = useState(true);
  const [chiuso, setChiuso] = useState(false);

  useEffect(() => {
    if (!chiave) {
      setGiaVisto(true);
      return;
    }
    try {
      setGiaVisto(localStorage.getItem(chiave) === '1');
    } catch {
      // localStorage non disponibile: nessun benvenuto ripetuto (meglio saltarlo)
      setGiaVisto(true);
    }
  }, [chiave]);

  /** Regole Radar già presenti: cambia solo la copy della CTA (non il benvenuto). */
  const radarConfigurato =
    preferenze.provinceCodici.length > 0 &&
    (preferenze.classiCodici.length > 0 ||
      preferenze.materieId.length > 0 ||
      preferenze.materieCustom.length > 0);

  const elegibile =
    Boolean(identificativo) &&
    !loading &&
    pianoStato === 'pronto' &&
    hasProAccess &&
    !profiloIncompleto &&
    !radarWizardOpen &&
    !chiuso &&
    !giaVisto;

  /** Segna il benvenuto come visto: non ricompare ai prossimi accessi. */
  const segnaVisto = (): void => {
    try {
      if (chiave) localStorage.setItem(chiave, '1');
    } catch {
      // localStorage non disponibile: il benvenuto resta solo in memoria
    }
    setGiaVisto(true);
  };

  const chiudi = (): void => {
    setChiuso(true);
    segnaVisto();
  };

  /** CTA primaria: chiude il benvenuto e porta dritto al setup/Radar (wizard). */
  const attivaRadar = (): void => {
    setChiuso(true);
    segnaVisto();
    openRadarSetup();
  };

  if (!elegibile) return null;

  const scadenza = formattaScadenza(trialScadenza);
  const titolo = trialAttivo
    ? 'Benvenuto in PRO: il tuo mese è in omaggio 🎉'
    : piano === 'free_forever'
      ? 'Accesso PRO a vita attivo 🎉'
      : 'Il tuo piano PRO è attivo 🎉';

  return (
    <Modal open onClose={chiudi} title="Benvenuto in ScuoleRadar" size="md">
      <div className="text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-100">
          <PartyPopper className="h-7 w-7 text-accent-600" />
        </span>
        <h3 className="mt-3 text-xl font-bold text-primary-800">{titolo}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-primary-600">
          {trialAttivo ? (
            <>
              {/* COPY ETICO: valore del TEMPO restituito all'utente, nessuna gara con i colleghi. */}
              <strong>Un mese PRO, completamente gratis</strong>
              {scadenza ? (
                <>
                  {' '}
                  fino al <strong>{scadenza}</strong>
                </>
              ) : null}
              . Smetti di perdere ore a cercare sui siti delle scuole: ci pensa il Radar a trovare gli
              interpelli per te, così puoi dedicarti alla tua vita.
            </>
          ) : (
            <>
              Il tuo account ha accesso completo alla versione PRO: da adesso il Radar cerca le
              opportunità per te, così puoi dedicarti alla tua vita.
            </>
          )}
        </p>
      </div>

      <div className="mt-4 space-y-1.5 rounded-xl bg-accent-50 px-4 py-3 text-sm text-accent-800">
        <p className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          <span>
            Fino a <strong>4 province</strong> e <strong>4 classi di concorso</strong> monitorate.
          </span>
        </p>
        <p className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-accent-500" />
          <span>
            <strong>Avvisi istantanei</strong> su Telegram, non un riepilogo una volta al giorno.
          </span>
        </p>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-primary-600">
        Il Radar lavora al posto tuo: indicagli dove cerchi e per quali insegnamenti, e da quel
        momento le opportunità compatibili arrivano a te — senza che tu debba controllare i siti
        delle scuole.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-primary-100 pt-4 sm:flex-row-reverse">
        <button
          type="button"
          onClick={attivaRadar}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600"
        >
          <Radar className="h-4 w-4" />
          {radarConfigurato ? 'Apri il tuo Radar' : 'Attiva il Radar'}
        </button>
        <button
          type="button"
          onClick={chiudi}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 px-5 py-3 text-sm font-medium text-primary-700 transition hover:bg-primary-50"
        >
          Più tardi
        </button>
      </div>
    </Modal>
  );
}

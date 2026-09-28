/**
 * Interruttore della preferenza SOSTEGNO (special education).
 *
 * Il sostegno (ADAA/ADEE/ADMM/ADSS) è un'abilitazione SEPARATA dalle classi
 * disciplinari, ma le fonti lo pubblicano spesso citando anche le classi di
 * concorso: senza un'impostazione, un docente di tedesco (A-22/A-25) riceveva
 * interpelli di sostegno (falso positivo storico).
 *
 * REGOLA ATTUALE: il sostegno è INCLUSO di default — nessun avviso viene
 * filtrato via in silenzio (`defaultPreferenze.sostegno = true`, migrazione
 * `20260927120000_default_sostegno_incluso.sql`). Questo interruttore è l'OPZIONE
 * DI USCITA esplicita, nelle Preferenze Radar: chi lo spegne smette di ricevere
 * gli avvisi AD…; se ha una classe di sostegno tra le proprie preferenze gli
 * avvisi di quella classe arrivano comunque (adesione implicita).
 */
import { Check } from 'lucide-react';

export interface SostegnoToggleProps {
  /** Stato corrente: true = l'utente riceve anche le opportunità di sostegno. */
  attivo: boolean;
  /** Cambio di stato: il chiamante persiste subito (bozza/draft o profilo). */
  onCambia: (attivo: boolean) => void;
  /**
   * Classi di sostegno già selezionate tra le preferenze (es. ['ADEE']): valgono
   * come adesione implicita, quindi l'interruttore lo segnala apertamente.
   */
  classiSostegno?: string[];
  /** Prefisso degli id/aria (wizard e preferenze convivono nella stessa pagina). */
  idPrefisso?: string;
}

export function SostegnoToggle({
  attivo,
  onCambia,
  classiSostegno = [],
  idPrefisso = 'sostegno',
}: SostegnoToggleProps) {
  const idSwitch = `${idPrefisso}-switch`;
  const idDescrizione = `${idPrefisso}-descrizione`;
  const adesioneImplicita = !attivo && classiSostegno.length > 0;

  return (
    <div
      className={`mt-4 flex items-start gap-3 rounded-xl border p-3 transition ${
        attivo ? 'border-accent-300 bg-accent-50/70' : 'border-primary-100 bg-primary-50/50'
      }`}
    >
      <span className="text-xl leading-none" aria-hidden="true">
        🤝
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary-800">Opportunità di sostegno</p>
        <p id={idDescrizione} className="mt-1 text-xs leading-relaxed text-primary-500">
          {attivo ? (
            <>
              <strong>Incluse.</strong> Gli avvisi di sostegno (ADAA, ADEE, ADMM, ADSS) arrivano
              insieme agli altri: aggiungi tra le classi di concorso quelle di sostegno che ti
              interessano.
            </>
          ) : (
            <>
              <strong>Escluse.</strong> Su tua scelta il sostegno resta fuori dalle notifiche: puoi
              riattivarlo quando vuoi da qui.
            </>
          )}
        </p>
        {adesioneImplicita && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-primary-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
            <span>
              Hai selezionato {classiSostegno.join(', ')}: riceverai comunque gli avvisi di sostegno
              di quelle classi (per escluderli, rimuovile dall'elenco qui sopra).
            </span>
          </p>
        )}
      </div>

      <button
        type="button"
        id={idSwitch}
        role="switch"
        aria-checked={attivo}
        aria-label="Includi le opportunità per il sostegno"
        aria-describedby={idDescrizione}
        onClick={() => onCambia(!attivo)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          attivo ? 'bg-accent-500' : 'bg-primary-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            attivo ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

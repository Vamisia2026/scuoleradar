/**
 * Interruttore della preferenza SOSTEGNO (special education).
 *
 * È la risposta a una domanda esplicita, posta sia nel wizard Radar (Passo 3 —
 * Classi/Materie) sia nelle Preferenze Radar del profilo:
 *   «Vuoi che includiamo anche le opportunità per il sostegno?»
 *
 * Perché esiste: il sostegno (ADAA/ADEE/ADMM/ADSS) è un'abilitazione SEPARATA
 * dalle classi disciplinari, ma le fonti lo pubblicano spesso citando anche le
 * classi di concorso. Senza questa preferenza un docente di tedesco (A-22/A-25)
 * riceveva interpelli di sostegno (falso positivo storico).
 *
 * La preferenza è un GATE: senza adesione gli avvisi di sostegno non vengono
 * notificati. Per RICEVERLI serve anche una classe di sostegno tra le proprie
 * preferenze (ADEE, ADMM…): il messaggio lo dice chiaramente all'utente.
 */
import { Check } from 'lucide-react';

export interface SostegnoToggleProps {
  /** Stato corrente: true = l'utente vuole anche le opportunità di sostegno. */
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
        <p className="text-sm font-semibold text-primary-800">
          Vuoi che includiamo anche le opportunità per il sostegno?
        </p>
        <p id={idDescrizione} className="mt-1 text-xs leading-relaxed text-primary-500">
          {attivo ? (
            <>
              <strong>Sì.</strong> Gli avvisi di sostegno (ADAA, ADEE, ADMM, ADSS) non vengono più
              esclusi: aggiungi tra le classi di concorso quelle di sostegno che ti interessano per
              riceverli.
            </>
          ) : (
            <>
              <strong>No.</strong> Gli avvisi di sostegno vengono esclusi dal tuo Radar, anche
              quando citano le tue classi di concorso.
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

/**
 * Interruttore della preferenza SOSTEGNO (special education).
 *
 * Il sostegno (ADAA/ADEE/ADMM/ADSS) è un'abilitazione SEPARATA dalle classi
 * disciplinari, ma le fonti lo pubblicano spesso citando anche le classi di
 * concorso: senza un'impostazione, un docente di tedesco (A-22/A-25) riceveva
 * interpelli di sostegno (falso positivo storico).
 *
 * REGOLA ATTUALE (BLOCCATA SU ON): il sostegno è SEMPRE INCLUSO — non è più una
 * preferenza dell'utente e non esiste alcuna uscita. Gli avvisi AD… (ADAA, ADEE,
 * ADMM, ADSS) arrivano a tutti, insieme agli altri, e nessuno viene filtrato via
 * in silenzio (`defaultPreferenze.sostegno = true`, migrazione
 * `20260927120000_default_sostegno_incluso.sql`).
 *
 * Il componente NON è un interruttore: è lo STATO dichiarato, non cliccabile
 * (interruttore disegnato nella posizione ON con `aria-checked="true"` e
 * `aria-disabled="true"`). Le classi di sostegno eventualmente selezionate tra le
 * preferenze sono mostrate apertamente come adesione ESPLICITA.
 */
import { Check, Lock } from 'lucide-react';

export interface SostegnoToggleProps {
  /**
   * Classi di sostegno selezionate tra le preferenze (es. ['ADEE']): sono
   * l'adesione ESPLICITA e vengono mostrate apertamente sotto lo stato.
   */
  classiSostegno?: string[];
  /** Prefisso degli id/aria (wizard e preferenze convivono nella stessa pagina). */
  idPrefisso?: string;
}

export function SostegnoToggle({
  classiSostegno = [],
  idPrefisso = 'sostegno',
}: SostegnoToggleProps) {
  const idSwitch = `${idPrefisso}-switch`;
  const idDescrizione = `${idPrefisso}-descrizione`;
  const classiEsplicite = classiSostegno;

  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-accent-300 bg-accent-50/70 p-3">
      <span className="text-xl leading-none" aria-hidden="true">
        🤝
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-primary-800">Opportunità di sostegno</p>
        <p id={idDescrizione} className="mt-1 text-xs leading-relaxed text-primary-500">
          <strong>Incluse, sempre.</strong> Gli avvisi di sostegno (ADAA, ADEE, ADMM, ADSS)
          arrivano insieme a tutti gli altri:{' '}
          <span className="font-semibold text-accent-700">
            inclusione non disattivabile
            <Lock className="ml-1 inline h-3 w-3 align-[-1px]" aria-hidden="true" />
          </span>
          . Aggiungi tra le classi di concorso quelle che ti interessano.
        </p>
        {classiEsplicite.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-white/80 px-2 py-1.5 text-[11px] leading-relaxed text-primary-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-600" />
            <span>
              Hai selezionato {classiEsplicite.join(', ')}: quegli avvisi arrivano di sicuro,
              insieme a tutte le altre opportunità di sostegno.
            </span>
          </p>
        )}
      </div>

      {/* STATO dichiarato, NON interruttore: nessun `onClick`, nessuna uscita. */}
      <span
        id={idSwitch}
        role="switch"
        aria-checked="true"
        aria-disabled="true"
        aria-label="Opportunità di sostegno: sempre incluse, non disattivabili"
        aria-describedby={idDescrizione}
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-default items-center rounded-full bg-accent-500"
      >
        <Lock className="absolute left-1.5 h-3 w-3 text-white/90" aria-hidden="true" />
        <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white shadow" />
      </span>
    </div>
  );
}

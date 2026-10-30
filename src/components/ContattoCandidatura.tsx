/**
 * Interpello · RECAPITO DI CANDIDATURA — bottone `mailto` + natura (§26.116).
 *
 * Perché esiste: `contact_email` è il canale STANDARD con cui si risponde a un
 * avviso, e va mostrato come azione (non come stringa da copiare). Ma non tutte
 * le caselle sono equivalenti: accanto al bottone si dichiara la NATURA del
 * recapito (`lib/gerarchiaContatti.ETICHETTA_NATURA`) — PEO ministeriale,
 * segreteria, dirigenza, generica, PEC di ripiego — così l'utente sa sempre che
 * cosa sta usando e non scambia una PEC per la casella delle candidature.
 *
 * L'etichetta del bottone è quella UNICA di prodotto (`EMAIL_ETICHETTA_WEB`,
 * «Email candidature»): la parola «Candidati» è vietata come CTA dalle checklist
 * in `comunicazione/**`. Nessun blocco quando il recapito manca: la riga si
 * omette, mai «Email non disponibile» (§26.68).
 */
import { Mail } from 'lucide-react';
import { EMAIL_ETICHETTA_WEB, emailAvviso } from '@/lib/alertInterpello';
import { ETICHETTA_NATURA, naturaContatto } from '@/lib/gerarchiaContatti';

interface ContattoCandidaturaProps {
  /** Recapito della riga (`interpelli.contact_email`), anche `null`. */
  email?: string | null;
  /** Classi aggiuntive del contenitore (spaziatura del chiamante). */
  className?: string;
  /**
   * `primario` = azione in evidenza (scheda e dettaglio); `secondario` = accanto
   * a un'altra CTA (card della vetrina), per non contendere il colore pieno.
   */
  variante?: 'primario' | 'secondario';
}

const CLASSE_BOTTONE: Record<'primario' | 'secondario', string> = {
  primario:
    'inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700',
  secondario:
    'inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 transition hover:border-primary-400 hover:bg-primary-50',
};

export function ContattoCandidatura({
  email,
  className = '',
  variante = 'primario',
}: ContattoCandidaturaProps) {
  const recapito = emailAvviso(email);
  const natura = naturaContatto(recapito);
  if (!recapito || !natura) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <a href={`mailto:${recapito}`} className={CLASSE_BOTTONE[variante]}>
        <Mail className="h-4 w-4" />
        {EMAIL_ETICHETTA_WEB}
      </a>
      <span className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700 ring-1 ring-inset ring-primary-200">
        {ETICHETTA_NATURA[natura]}
      </span>
      <span className="break-all text-sm text-primary-700">{recapito}</span>
    </div>
  );
}
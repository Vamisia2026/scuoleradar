/**
 * Nota di supporto per gli ACCOUNT ISTITUZIONALI (domini scolastici `.edu.it` e
 * Google Workspace dell'istituto): molti istituti bloccano l'accesso Google verso
 * le app esterne, quindi il problema va spiegato PRIMA che accada — con le due
 * alternative reali (account Google personale, email/password) e il rimando alle
 * FAQ per l'Animatore Digitale che vuole autorizzare ScuoleRadar.
 *
 * Complementare a `OAuthBounceModal`, che interviene DOPO il rifiuto di Google.
 */
import { Link } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export function NotaAccessoScolastico({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
      <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <strong className="font-semibold text-primary-700">
          L'account della scuola non funziona?
        </strong>{' '}
        Alcuni istituti (.edu.it) bloccano l'accesso Google verso i servizi esterni: usa un{' '}
        <strong className="font-semibold text-primary-700">account Google personale</strong> oppure
        email e password. Sei l'Animatore Digitale?{' '}
        <Link
          to="/faq#animatore-digitale"
          onClick={onNavigate}
          className="font-semibold text-primary-700 underline hover:text-primary-900"
        >
          Come autorizzare ScuoleRadar nella tua scuola
        </Link>
        .
      </span>
    </p>
  );
}

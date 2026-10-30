/**
 * Interpello · AZIONI della card della vetrina.
 *
 * Estratte da `InterpelloCard` (limite di 250 righe del gate strutturale) e
 * riunite qui perché sono UNA sola decisione di interfaccia: dove mandare
 * l'utente. Nello stesso blocco convivono
 *   · il link DIRETTO alla fonte ufficiale (`etichettaFonteLink`: PDF, albo,
 *     avviso) — resta l'unico link alla fonte, mai duplicato;
 *   · il RECAPITO di candidatura come azione `mailto` con la NATURA dichiarata
 *     (§26.116: PEO ministeriale, segreteria, dirigenza, generica, PEC di ripiego);
 *   · il dettaglio dell'opportunità.
 * Se la fonte non è indicata la riga lo dice e resta il canale email.
 */
import { ArrowRight } from 'lucide-react';
import { etichettaFonteLink } from '@/lib/alertInterpello';
import { ContattoCandidatura } from './ContattoCandidatura';

interface InterpelloAzioniProps {
  /** Link ESTERNO alla fonte ufficiale, o `null` se non è indicata. */
  linkEsterno: string | null;
  /** Recapito di candidatura risolto (`interpelli.contact_email`). */
  contactEmail?: string | null;
  /** Apertura del dettaglio (modale della card). */
  onDettaglio: () => void;
}

export function InterpelloAzioni({ linkEsterno, contactEmail, onDettaglio }: InterpelloAzioniProps) {
  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {linkEsterno ? (
          <a
            href={linkEsterno}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
          >
            {etichettaFonteLink(linkEsterno)}
            <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <span className="text-sm text-primary-500">
            Fonte ufficiale non indicata: usa i recapiti dell&apos;avviso.
          </span>
        )}
        <button
          onClick={onDettaglio}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 transition hover:text-primary-800"
        >
          Vedi dettaglio
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </button>
      </div>
      <ContattoCandidatura email={contactEmail} variante="secondario" />
    </div>
  );
}
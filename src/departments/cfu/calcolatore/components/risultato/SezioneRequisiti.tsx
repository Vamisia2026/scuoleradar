import type { EsitoUtenteV1 } from '../../esitoUtente';
import { VoceRequisito } from './VoceRequisito';

interface SezioneRequisitiProps {
  esito: EsitoUtenteV1;
}

/** Elenco puntuale dei requisiti dichiarati dalla norma e del loro esito. */
export function SezioneRequisiti({ esito }: SezioneRequisitiProps) {
  return (
    <section aria-label="Requisiti della classe" className="space-y-3">
      <h4 className="text-sm font-extrabold uppercase tracking-wide text-primary-700">
        Requisiti verificati ({esito.requisitiSoddisfatti.length}/{esito.requisiti.length})
      </h4>
      <ul className="space-y-2">
        {esito.requisiti.map((voce) => (
          <VoceRequisito key={voce.id} voce={voce} />
        ))}
      </ul>
      {esito.requisiti.length === 0 && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-primary-500">
          Per questa classe non risultano requisiti strutturati applicabili: serve una verifica
          manuale sulla fonte ufficiale.
        </p>
      )}
    </section>
  );
}

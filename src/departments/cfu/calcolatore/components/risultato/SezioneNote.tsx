import { AlertTriangle, BookOpen, CheckCircle2, Info, ListChecks } from 'lucide-react';
import type { EsitoUtenteV1 } from '../../esitoUtente';

interface SezioneNoteProps {
  esito: EsitoUtenteV1;
}

/**
 * Le tre domande che chiudono il risultato:
 *  - cosa manca (deficit pubblicato dal motore oppure punti critici per requisito);
 *  - cosa devo verificare o completare (dati mancanti + verifiche esterne);
 *  - su cosa si basa (fonti normative, dati usati, nota tecnica).
 */
export function SezioneNote({ esito }: SezioneNoteProps) {
  return (
    <div className="space-y-4">
      <section aria-label="Cosa manca" className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-primary-700">
          <ListChecks className="h-4 w-4" /> Cosa manca
        </h4>
        {esito.deficitPubblicabile && esito.cfuMancantiTotali !== null && (
          <p className="rounded-xl border border-primary-100 bg-white px-4 py-3 text-sm leading-relaxed text-primary-700">
            {esito.cfuMancantiTotali > 0 ? (
              <>
                Crediti mancanti secondo la norma:{' '}
                <strong className="text-primary-900">{esito.cfuMancantiTotali} CFU</strong>.
              </>
            ) : (
              <>Nessun deficit di crediti: i requisiti di CFU risultano coperti.</>
            )}
          </p>
        )}
        {!esito.deficitPubblicabile && (
          <p className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-primary-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" />
            Il motore non pubblica un totale di CFU mancanti per questa classe: le carenze sono
            elencate requisito per requisito, senza stime.
          </p>
        )}
        {esito.cfuMancantiPerRequisito.length > 0 && (
          <ul className="space-y-1.5">
            {esito.cfuMancantiPerRequisito.map((voce) => (
              <li
                key={voce.etichetta}
                className="flex items-start justify-between gap-3 rounded-xl bg-white px-4 py-2.5 text-sm text-primary-700 ring-1 ring-slate-200"
              >
                <span className="leading-relaxed">{voce.etichetta}</span>
                <span className="shrink-0 font-bold text-primary-800">{voce.cfuMancanti} CFU</span>
              </li>
            ))}
          </ul>
        )}
        {esito.requisitiMancanti.map((voce) => (
          <p
            key={voce.id}
            className="flex items-start gap-2 rounded-xl bg-error-50/60 px-4 py-2.5 text-sm leading-relaxed text-error-800 ring-1 ring-error-100"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{voce.etichetta}</strong> — {voce.dettaglio}
            </span>
          </p>
        ))}
        {esito.requisitiMancanti.length === 0 && esito.cfuMancantiPerRequisito.length === 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-accent-50/60 px-4 py-3 text-sm leading-relaxed text-accent-900 ring-1 ring-accent-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            Nessun requisito non soddisfatto sui dati forniti.
          </p>
        )}
      </section>

      <section aria-label="Cosa devo fare" className="space-y-2">
        <h4 className="text-sm font-extrabold uppercase tracking-wide text-primary-700">
          Cosa devo fare adesso
        </h4>
        {esito.datiMancanti.map((dato) => (
          <p
            key={dato.etichetta}
            className="rounded-xl bg-primary-50/70 px-4 py-2.5 text-sm leading-relaxed text-primary-700 ring-1 ring-primary-100"
          >
            <strong className="text-primary-900">Manca: {dato.etichetta}.</strong> {dato.perche}
          </p>
        ))}
        {esito.cosaVerificare.map((frase) => (
          <p
            key={frase}
            className="flex items-start gap-2 rounded-xl bg-warning-50/70 px-4 py-2.5 text-sm leading-relaxed text-warning-900 ring-1 ring-warning-200"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {frase}
          </p>
        ))}
        {esito.percorsi.map((passo) => (
          <p
            key={passo}
            className="rounded-xl bg-secondary-50 px-4 py-2.5 text-sm leading-relaxed text-secondary-900 ring-1 ring-secondary-100"
          >
            {passo}
          </p>
        ))}
        {esito.datiMancanti.length === 0 &&
          esito.cosaVerificare.length === 0 &&
          esito.percorsi.length === 0 && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-primary-500">
              Non serve altro da parte tua su questa classe: se vuoi, scarica il dossier e portalo
              in segreteria.
            </p>
          )}
      </section>

      <section aria-label="Su cosa si basa" className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-primary-700">
          <BookOpen className="h-4 w-4" /> Su cosa si basa
        </h4>
        <ul className="space-y-1.5 text-sm leading-relaxed text-primary-600">
          {esito.datiUsati.map((dato) => (
            <li key={dato}>• {dato}</li>
          ))}
          {esito.riferimentoNormativo && <li>• Norma applicata: {esito.riferimentoNormativo}</li>}
          {esito.fonti.map((fonte) => (
            <li key={`${fonte.fonte}-${fonte.riferimento ?? ''}`}>
              • {fonte.fonte}
              {fonte.riferimento ? ` (${fonte.riferimento})` : ''} —{' '}
              {fonte.verificata ? 'fonte verificata' : 'fonte non verificata'}
            </li>
          ))}
          <li>• Esito tecnico del motore: {esito.esitoTecnico}</li>
        </ul>
        <p className="text-xs leading-relaxed text-primary-400">
          Nota: in questa versione non carichiamo né analizziamo documenti. Il calcolo usa solo i
          dati che hai inserito e le fonti normative indicate sopra.
        </p>
      </section>
    </div>
  );
}

/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/creativePayload.
 *
 * CONFINE CON L'ASSISTENTE CREATIVO (non implementato in questo task).
 * Il payload è l'UNICA superficie che l'Assistente Creativo potrà consumare:
 * una fotografia immutabile del risultato normativo, senza alcun potere di
 * creare o modificare un esito.
 *
 *   NORMATIVE ENGINE → risultato verificato/tracciabile → CREATIVE ASSISTANT
 *
 * L'invariante è verificabile a runtime (`verificaPayloadNonAutorevole`):
 * un payload che dichiarasse un potere sull'esito è invalido.
 */
import type { EsitoValutazione } from '../types';
import type { RiferimentoFonte } from './types';
import type {
  AnalisiDeficit,
  ConflittoNormativo,
  EsitoValutazioneRequisito,
  PayloadAssistantCreativo,
} from './requirementTypes';

export const NOTA_SEPARAZIONE_ASSISTENTE =
  'Payload di sola lettura prodotto dal motore normativo: l\'Assistente Creativo può ' +
  'tradurre in linguaggio il risultato, ma non creare, modificare o anticipare un esito ' +
  'di idoneità.';

export interface ParametriPayloadCreativo {
  readonly classeCodice: string;
  readonly denominazioneClasse: string | null;
  readonly stato: EsitoValutazione;
  readonly deficit: AnalisiDeficit;
  readonly fonti: readonly RiferimentoFonte[];
  readonly valutazioni: readonly EsitoValutazioneRequisito[];
  readonly conflitti: readonly ConflittoNormativo[];
}

/** Costruisce il payload in sola lettura per l'Assistente Creativo. */
export function creaPayloadAssistantCreativo(
  parametri: ParametriPayloadCreativo,
): PayloadAssistantCreativo {
  const noteTracciabilita = parametri.valutazioni.map(
    (valutazione) =>
      `Requisito ${valutazione.requisitoId} → ${valutazione.stato} ` +
      `(fonti: ${valutazione.fonti.map((fonte) => fonte.sourceId).join(', ') || 'nessuna'})`,
  );
  for (const conflitto of parametri.conflitti) {
    noteTracciabilita.push(
      `Conflitto ${conflitto.id} (${conflitto.tipo}) fra ${conflitto.sourceIds.join(', ')}: verifica manuale`,
    );
  }

  return {
    autorita: 'NORMATIVE_ENGINE',
    classeCodice: parametri.classeCodice,
    denominazioneClasse: parametri.denominazioneClasse,
    stato: parametri.stato,
    deficit: parametri.deficit,
    fonti: [...parametri.fonti],
    evidenze: parametri.valutazioni.flatMap((valutazione) => [...valutazione.evidenze]),
    noteTracciabilita,
    puoCreareEsito: false,
    puoModificareEsito: false,
    notaSeparazione: NOTA_SEPARAZIONE_ASSISTENTE,
  };
}

/** Guardia di non-autorevolezza: elenca le violazioni del confine (mai lancia). */
export function verificaPayloadNonAutorevole(payload: PayloadAssistantCreativo): string[] {
  const problemi: string[] = [];
  if (payload.autorita !== 'NORMATIVE_ENGINE') {
    problemi.push('autorita diversa da NORMATIVE_ENGINE.');
  }
  if (payload.puoCreareEsito !== false) problemi.push('il payload dichiara di poter creare un esito.');
  if (payload.puoModificareEsito !== false) {
    problemi.push('il payload dichiara di poter modificare un esito.');
  }
  if (payload.deficit.calcolabile && payload.deficit.cfuMancantiTotali === null) {
    problemi.push('deficit dichiarato calcolabile senza valore numerico.');
  }
  return problemi;
}

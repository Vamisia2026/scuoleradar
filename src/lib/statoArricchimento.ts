/**
 * ScuoleRadar.it — STATO dell'ANAGRAFICA di una riga d'interpello (modulo PURO).
 *
 * Direttive 04/10/2026 (§26.47) e 05/10/2026 (§26.59): un interpello GENUINO non si
 * perde MAI per un'anagrafica incompleta — l'esperienza sul campo è quella dei
 * 10 annunci di Padova. La riga entra comunque in `interpelli` con i dati grezzi del
 * bando, marcata `parziale`; la VETRINA pubblica però richiede un istituto REALE
 * risolto: senza nome la riga resta fuori dal tabellone (`lib/liveBoard.ts`).
 *
 * Qui vive l'unica regola che decide `completo` ↔ `parziale`, condivisa da:
 *   · scraper all'inserimento (`src/scraper/index.ts` → `mappaRigaInterpelli`);
 *   · manutenzione dati (`scripts/arricchisci-interpelli.ts`);
 *   · interfaccia (colonna `interpelli.stato_arricchimento` → vetrina e feed).
 *
 * Modulo PURO e isomorfo (nessun `node:fs`, nessuna rete): importabile sia dal
 * processo Node dello scraper sia dal browser. Verificato da
 * `npm run test:pipeline` (`scripts/test-pipeline-tollerante.ts`).
 */
import { normalizzaCodiceMeccanografico } from './emailScuola';
import { nomeIstitutoPresentabile } from './nomeIstituto';

/** Stato dell'anagrafica di una riga. */
export type StatoArricchimento = 'completo' | 'parziale';

/**
 * Dicitura GESTITA della scheda del singolo avviso quando l'istituto non è
 * risolvibile in chiaro: il segnaposto NEUTRO «Scuola non specificata / Più plessi»
 * dichiara che il nome dell'istituto non è ancora associato — nessun messaggio
 * tecnico e nessun nome inventato (direttiva cliente 04/10/2026).
 *
 * Da §26.59 (05/10/2026) NON entra più nella BACHECA: nel tabellone una riga senza
 * istituto reale resta fuori (`liveBoard.nomeScuolaBoard`). Resta il segnaposto della
 * card e della modale (`src/components/IstitutoEmittente.tsx`), dove l'avviso è già
 * dell'utente.
 */
export const SCUOLA_NON_SPECIFICATA = 'Scuola non specificata / Più plessi';

/** Vista minima di una riga per il calcolo dello stato. */
export interface RigaArricchibile {
  school_name?: string | null;
  school_code?: string | null;
  contact_email?: string | null;
  school_pec?: string | null;
}

/**
 * True se l'istituto della riga è IDENTIFICATO: una denominazione presentabile
 * (gate `nomeIstitutoPresentabile`) oppure un codice meccanografico valido.
 * Un nome grezzo non presentabile NON conta: identificato vuol dire mappato.
 */
export function istitutoIdentificato(riga: RigaArricchibile): boolean {
  return Boolean(
    nomeIstitutoPresentabile(riga.school_name) ??
      normalizzaCodiceMeccanografico(riga.school_code),
  );
}

/** True se la riga ha un recapito di candidatura (PEO/PEC) utilizzabile. */
export function recapitoPresente(riga: RigaArricchibile): boolean {
  return Boolean((riga.contact_email ?? '').trim() || (riga.school_pec ?? '').trim());
}

/**
 * Stato dell'anagrafica: `completo` quando l'istituto è identificato **e** c'è un
 * recapito di candidatura, `parziale` in ogni altro caso. `parziale` non è un
 * motivo di scarto: è solo l'etichetta onesta di una riga che entra lo stesso.
 */
export function statoArricchimento(riga: RigaArricchibile): StatoArricchimento {
  return istitutoIdentificato(riga) && recapitoPresente(riga) ? 'completo' : 'parziale';
}

/** Valore di `interpelli.stato_arricchimento` normalizzato; `null` se assente/ignoto. */
export function normalizzaStatoArricchimento(
  valore?: string | null,
): StatoArricchimento | null {
  const v = (valore ?? '').trim().toLowerCase();
  return v === 'completo' || v === 'parziale' ? v : null;
}

/**
 * True solo quando lo stato dichiara ESPLICITAMENTE `parziale`.
 *
 * Stato ASSENTE/IGNOTO (`null`, colonna non ancora migrata, valore non previsto)
 * non fa affermazioni: in quel caso decide il nome mostrato in vetrina
 * (`nomeScuolaBoard.approssimativo`), così una base dati non ancora migrata non
 * marca tutte le righe come «in aggiornamento».
 */
export function anagraficaInAggiornamento(stato?: string | null): boolean {
  return normalizzaStatoArricchimento(stato) === 'parziale';
}

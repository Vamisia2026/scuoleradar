/**
 * ScuoleRadar.it — Scraper · TAILORING del recapito all'inserimento (ponte).
 *
 * Ultimo passo della catena di arricchimento di una riga, dopo l'anagrafica
 * (`anagraficaInterpelli.ts`): se il recapito di candidatura manca ancora, il
 * Tailoring (`lib/tailoringContatti.ts`) prova le fonti che restano —
 *  · lo STORICO interno (`storicoContatti.ts`: stessa scuola già risolta);
 *  · la CONVENZIONE MIM sul codice meccanografico.
 *
 * Effetto voluto (§26.68): più righe nascono `completo`, quindi entrano nel
 * dispatch senza che il gate debba scartarle. Le righe che restano senza recapito
 * NON si perdono e non si nascondono: vengono CONTATE e segnalate alla revisione
 * interna (`riepilogoTailoring()` → alert admin nel run).
 *
 * Lo storico si imposta UNA volta per processo (`impostaStoricoContatti`, letto dal
 * chiamante async), così il mapper delle righe resta sincrono.
 *
 * Verificato da `npm run test:tailoring`.
 */
import {
  risolviContattoAvviso,
  type EsitoTailoring,
} from '../lib/tailoringContatti.ts';
import { risolviEmailUfficialeScuola } from '../lib/emailScuola.ts';
import type { InterpelloParsato } from './parser.ts';
import { contattoDaStorico, REGISTRO_STORICO_VUOTO, type RegistroStorico } from './storicoContatti.ts';

/** Quante righe da revisionare si riportano nel messaggio (esempi, non l'elenco). */
export const MAX_ESEMPI_REVISIONE = 5;

/** Riepilogo del run: cosa ha cucito il Tailoring e cosa resta da rivedere. */
export interface RiepilogoTailoring {
  /** true se lo storico interno è stato letto (altrimenti nessun appiglio). */
  storicoDisponibile: boolean;
  /** Righe dello storico con un recapito valido. */
  storicoRighe: number;
  /** Avvisi del run a cui il Tailoring ha aggiunto un recapito. */
  recuperati: number;
  /** Recuperati dallo storico interno. */
  daStorico: number;
  /** Recuperati dalla convenzione MIM (codice meccanografico). */
  daConvenzione: number;
  /** Righe rimaste SENZA recapito: da revisione interna (nessuno scarto). */
  daRevisionare: number;
  /** Esempi (max 5) delle righe da revisionare: istituto + titolo. */
  esempi: string[];
}

let registro: RegistroStorico = REGISTRO_STORICO_VUOTO;
let recuperati = 0;
let daStorico = 0;
let daConvenzione = 0;
let daRevisionare = 0;
const esempi: string[] = [];

/** Imposta lo storico del run (una sola lettura per processo). */
export function impostaStoricoContatti(nuovo: RegistroStorico): void {
  registro = nuovo;
}

/** Azzera i contatori (inizio del run e test). */
export function azzeraRiepilogoTailoring(): void {
  recuperati = 0;
  daStorico = 0;
  daConvenzione = 0;
  daRevisionare = 0;
  esempi.length = 0;
}

/** Registra una riga rimasta senza recapito (conteggio + esempi per la revisione). */
function registraDaRevisionare(a: InterpelloParsato): void {
  daRevisionare += 1;
  if (esempi.length >= MAX_ESEMPI_REVISIONE) return;
  const scuola = (a.schoolName ?? '').trim() || 'istituto non indicato';
  esempi.push(`${scuola.slice(0, 40)} — ${(a.title ?? '').trim().slice(0, 60)}`);
}

/**
 * Cucitura di UNA riga: restituisce l'avviso con il recapito recuperato, oppure
 * l'avviso di partenza quando non c'è nulla da fare. Non sovrascrive mai un dato
 * presente e non inventa indirizzi (solo la convenzione MIM e recapiti osservati).
 */
export function applicaTailoring(a: InterpelloParsato): InterpelloParsato {
  const esito: EsitoTailoring = risolviContattoAvviso({
    emailFonte: a.contactEmail,
    storico: contattoDaStorico(registro, {
      school_code: a.schoolCode,
      school_name: a.schoolName,
      province: a.province,
    }),
    convenzione: risolviEmailUfficialeScuola({
      schoolCode: a.schoolCode,
      testo: `${a.title ?? ''} ${a.schoolName ?? ''}`,
    }),
  });
  if (esito.daRevisionare) {
    registraDaRevisionare(a);
    return a;
  }
  // Già risolto a monte (fonte o anagrafica): il Tailoring non tocca nulla.
  if (esito.provenienza === 'fonte') return a;
  if (esito.provenienza === 'storico') daStorico += 1;
  if (esito.provenienza === 'convenzione') daConvenzione += 1;
  recuperati += 1;
  return {
    ...a,
    contactEmail: esito.email ?? a.contactEmail,
    schoolPec: (a.schoolPec ?? '').trim() ? a.schoolPec : (esito.pec ?? a.schoolPec ?? null),
  };
}

/** Contatori del run (file dichiarato: nessuna riga persa in silenzio). */
export function riepilogoTailoring(): RiepilogoTailoring {
  return {
    storicoDisponibile: registro.disponibile,
    storicoRighe: registro.righe,
    recuperati,
    daStorico,
    daConvenzione,
    daRevisionare,
    esempi: [...esempi],
  };
}

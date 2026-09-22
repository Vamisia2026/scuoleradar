/**
 * ScuoleRadar.it — Dipartimento CFU · Supporto per i test di aggregazione di stato.
 *
 * Helper condivisi dalle suite `statusTruthTable`, `statusInvariants`,
 * `statusAmbiguities`, `statusAuthorityDivergences` e `statusCoverageGuard`:
 *  - costruzione di requisiti/contesti SINTETICI per la matrice di verità;
 *  - confronto autorità legacy ↔ AGGREDITORE DI PRODUZIONE: il valore atteso è
 *    `RisultatoPipeline.stato` (calcolato da `pipeline/status.ts`) e viene
 *    ricalcolato dalle stesse fonti con `costruisciContestoAggregazione`, per
 *    provare che la pipeline usa davvero l'implementazione di produzione.
 *
 * Nessuna copia dell'algoritmo di aggregazione vive nei test.
 */
import { eseguiPipelineUniversale, type InputPipelineUniversale } from '../pipeline/pipeline';
import {
  aggregaStatoRequisiti,
  causaContestoNormativoDa,
  costruisciContestoAggregazione,
  type ContestoAggregazione,
  type EsitoAggregazione,
  type NaturaRequisitoAggregato,
  type RamoDisgiunzione,
  type RequisitoAggregato,
  type StatoRequisitoAggregato,
} from '../pipeline/status';
import type { EsitoValutazione, IntegrabilitaStatus, RisultatoPipeline } from '../types';

export type {
  ContestoAggregazione,
  EsitoAggregazione,
  NaturaRequisitoAggregato,
  RamoDisgiunzione,
  RequisitoAggregato,
  StatoRequisitoAggregato,
};

let conteggioAssert = 0;

export function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

export function conteggioAsserzioni(): number {
  return conteggioAssert;
}

/* --------------------- Costruzione di contesti sintetici (matrice) --------------------- */

export const TUTTI_GLI_STATI: readonly StatoRequisitoAggregato[] = [
  'SODDISFATTO',
  'NON_SODDISFATTO',
  'NON_SODDISFATTO_INTEGRABILE',
  'DATO_UTENTE_MANCANTE',
  'DATO_NORMATIVO_MANCANTE',
  'INCERTO',
  'NON_VALUTABILE',
];

export function requisito(
  id: string,
  stato: StatoRequisitoAggregato,
  natura: NaturaRequisitoAggregato = 'cfu',
  integrabilita: IntegrabilitaStatus = 'NOT_SPECIFIED',
): RequisitoAggregato {
  return { id, natura, stato, integrabilita };
}

/** Requisito disgiuntivo: i rami vengono collassati dall'aggregazione (A3). */
export function requisitoConRami(
  id: string,
  rami: readonly StatoRequisitoAggregato[],
  natura: NaturaRequisitoAggregato = 'cfu',
  integrabilita: IntegrabilitaStatus = 'NOT_SPECIFIED',
): RequisitoAggregato {
  const opzioni: RamoDisgiunzione[] = rami.map((stato, indice) => ({
    id: `${id}::ramo-${indice + 1}`,
    stato,
  }));
  return { id, natura, stato: 'NON_SODDISFATTO', integrabilita, opzioni };
}

/** Applica una dichiarazione di integrabilità ai requisiti CFU (fatto di requisito). */
export function conIntegrabilita(
  requisiti: readonly RequisitoAggregato[],
  integrabilita: IntegrabilitaStatus,
): RequisitoAggregato[] {
  return requisiti.map((requisito) =>
    requisito.natura === 'cfu' ? { ...requisito, integrabilita } : requisito,
  );
}

export function contesto(
  requisiti: readonly RequisitoAggregato[],
  extra: Partial<ContestoAggregazione> = {},
): ContestoAggregazione {
  return {
    requisiti,
    conflitti: [],
    causaContesto: 'risolta',
    regoleApplicabili: 1,
    ...extra,
  };
}

/** Tutti i vettori di stati di lunghezza 1..n (per lo sweep degli invarianti). */
export function tuttiIVettori(lunghezza: number): StatoRequisitoAggregato[][] {
  if (lunghezza === 0) return [[]];
  const precedenti = tuttiIVettori(lunghezza - 1);
  const out: StatoRequisitoAggregato[][] = [];
  for (const stato of TUTTI_GLI_STATI) {
    for (const vettore of precedenti) out.push([stato, ...vettore]);
  }
  return out;
}

export function daVettore(
  vettore: readonly StatoRequisitoAggregato[],
  integrabilita: IntegrabilitaStatus,
): ContestoAggregazione {
  return contesto(
    conIntegrabilita(
      vettore.map((stato, indice) => requisito(`r${indice + 1}`, stato)),
      integrabilita,
    ),
  );
}

/* --------------------- Pipeline: stato di produzione + tre viste --------------------- */

export interface ConfrontoTreVie {
  readonly risultato: RisultatoPipeline;
  /** Aggregazione ricalcolata dalle fonti (deve coincidere con `risultato.stato`). */
  readonly esito: EsitoAggregazione;
  /** Verdetto del decisore aggregato legacy (autorità per i consumatori). */
  readonly autorita: EsitoValutazione;
  /** Stato aggregato di produzione: `RisultatoPipeline.stato`. */
  readonly pipeline: EsitoValutazione;
}

export function valutaTutto(input: InputPipelineUniversale): ConfrontoTreVie {
  const risultato = eseguiPipelineUniversale(input);
  const fontiVerificate = new Set(risultato.fonti.fonti.map((fonte) => fonte.sourceId));
  const esito = aggregaStatoRequisiti(
    costruisciContestoAggregazione({
      requisiti: risultato.requisiti,
      valutazioni: risultato.valutazioniRequisito,
      conflitti: risultato.conflitti,
      regoleApplicabili: input.regole.filter((regola) => fontiVerificate.has(regola.id)),
      causaContesto: causaContestoNormativoDa({
        normativaRisolta: risultato.fonti.normativa !== null,
        dataProcedura:
          risultato.identificazione.dateRilevanza.procedureDate ??
          risultato.identificazione.dateRilevanza.dataDomanda ??
          null,
      }),
    }),
  );
  return {
    risultato,
    esito,
    autorita: risultato.valutazioneClasse?.stato ?? 'INSUFFICIENT_DATA',
    pipeline: risultato.stato,
  };
}

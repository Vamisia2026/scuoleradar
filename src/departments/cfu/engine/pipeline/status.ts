/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/status.
 *
 * STAGE 7 — STATO AGGREGATO: AUTORITÀ INTERNA DELLA PIPELINE (fasi 4-5).
 *
 * ⚠️ CONFINE DI AUTORITÀ:
 *  - DENTRO la pipeline questo modulo è l'UNICA definizione dello stato:
 *    `RisultatoPipeline.stato` = `aggregaStatoRequisiti` (R0-R10); nessuna copia
 *    dell'algoritmo vive nei test.
 *  - FUORI dalla pipeline resta autorevole `valutaRequisitoClasse` (esposto come
 *    `statoSolutore`): bridge, routing, report e UI non sono commutati; le
 *    divergenze sono dichiarate in `escalations`.
 *  - Fase 5: tutti i fatti usati qui sono FATTI DI REQUISITO (natura,
 *    integrabilità, rami della disgiunzione) o FATTI DI CONTESTO (causa del
 *    contesto non risolto). Nessuna deduzione dalle regole applicabili.
 *
 * REGOLE DI PRECEDENZA (la prima che scatta vince):
 *  R0   contesto non risolto per DATI UTENTE (data procedura)     → INSUFFICIENT_DATA
 *  R1   conflitto di fonti, o contesto non risolto per NORMATIVA  → MANUAL
 *  R1b  nessun requisito ricostruibile da fonti verificate        → MANUAL
 *  R2   requisito NON_VALUTABILE (natura non dichiarata)          → MANUAL
 *  R3   requisito INCERTO                                         → MANUAL
 *  R4   requisito titolo/accesso NON_SODDISFATTO                  → NOT_ELIGIBLE
 *  R5   CFU NON_SODDISFATTO con integrabilità PROHIBITED          → NOT_ELIGIBLE
 *  R5b  deficit dichiarato integrabile ma PROHIBITED (incoerenza) → MANUAL
 *  R6   requisito DATO_NORMATIVO_MANCANTE                         → MANUAL
 *  R7   requisito DATO_UTENTE_MANCANTE                            → INSUFFICIENT_DATA
 *  R8   CFU NON_SODDISFATTO con ALLOWED, o INTEGRABILE            → CONDITIONALLY_ELIGIBLE
 *  R9   CFU NON_SODDISFATTO con integrabilità non dichiarata      → MANUAL
 *  R10  tutti i requisiti SODDISFATTO                             → ELIGIBLE
 *
 * PRINCIPIO DI PRODOTTO: il motore è VERITIERO e `INSUFFICIENT_DATA` non è un
 * "non so" generico. Ogni stato non positivo risponde internamente a tre domande:
 * mancano DATI UTENTE (R0/R7 → può agire il candidato), mancano o confliggono
 * DATI NORMATIVI (R1/R1b/R5/R6/R9 → verifica manuale), oppure il requisito è
 * genuinamente irrisolto (R2/R3)? La verità normativa non si cambia per la
 * conversione.
 *
 * Ambiguità A1-A6, divergenze intenzionali e invarianti G/D: docs/CFU_STATUS_AGGREGATION_SPEC.md.
 */
import type { EsitoValutazione, NormativeRuleEntry } from '../types';
import type {
  ConflittoNormativo,
  DefinizioneRequisito,
  EsitoValutazioneRequisito,
} from './requirementTypes';

import {
  esitoDisgiunzione,
  statoAggregatoDaRequisito,
  STATI_RISCHIOSI,
  type CausaContestoNormativo,
  type ContestoAggregazione,
  type EsitoAggregazione,
  type NaturaRequisitoAggregato,
  type RequisitoAggregato,
  type StatoRequisitoAggregato,
} from './statusTypes';

/* Il contratto (vocabolario + operazioni per requisito) è ri-esportato:
   i consumatori e le suite importano tutto dal modulo di autorità. */
export * from './statusTypes';

/** I 5 stati semantici ufficiali del motore (nessuno stato aggiuntivo). */
export const STATI_SEMANTICI: readonly EsitoValutazione[] = [
  'ELIGIBLE',
  'CONDITIONALLY_ELIGIBLE',
  'INSUFFICIENT_DATA',
  'MANUAL_VERIFICATION_REQUIRED',
  'NOT_ELIGIBLE',
];

/** Requisiti con i fatti di aggregazione (rami collassati, integrabilità, A5). */
function statiDeiRequisiti(contesto: ContestoAggregazione): {
  readonly id: string;
  readonly natura: NaturaRequisitoAggregato;
  readonly tipo: string | null;
  readonly stato: StatoRequisitoAggregato;
  readonly integrabilita: RequisitoAggregato['integrabilita'];
}[] {
  return contesto.requisiti.map((requisito) => {
    // I rami (A3) non possono stabilire un requisito che è già irrisolto ai suoi
    // dati: uno stato rischioso del requisito prevale SEMPRE sui rami.
    const rischioso = STATI_RISCHIOSI.includes(requisito.stato);
    const conRami = !rischioso && requisito.opzioni && requisito.opzioni.length > 0;
    return {
      id: requisito.id,
      natura: requisito.natura,
      tipo: requisito.tipo ?? null,
      integrabilita: requisito.integrabilita,
      stato: conRami ? esitoDisgiunzione(requisito.opzioni!) : requisito.stato,
    };
  });
}

/** Aggregazione dello stato: pura, deterministica, con regola di precedenza tracciata. */
export function aggregaStatoRequisiti(contesto: ContestoAggregazione): EsitoAggregazione {
  const percorso: string[] = [`Requisiti valutati: ${contesto.requisiti.length}`];
  const requisiti = statiDeiRequisiti(contesto);
  const esito = (stato: EsitoValutazione, regola: string, dettaglio: string): EsitoAggregazione => ({
    stato,
    regola,
    dettaglio,
    percorso: [...percorso, `${regola}: ${dettaglio}`],
  });

  const conStato = (stato: StatoRequisitoAggregato) =>
    requisiti.filter((requisito) => requisito.stato === stato);
  const ids = (voci: readonly { id: string; tipo: string | null }[]): string =>
    voci.map((voce) => (voce.tipo ? `${voce.id} (${voce.tipo})` : voce.id)).join(', ');

  if (contesto.causaContesto === 'dato-utente') {
    return esito('INSUFFICIENT_DATA', 'R0-contesto-utente', 'contesto normativo non risolto per dati utente mancanti (data della procedura)');
  }
  if (contesto.conflitti.length > 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R1-conflitto', `conflitti: ${contesto.conflitti.join(', ')}`);
  }
  if (contesto.causaContesto === 'normativa') {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R1-contesto-normativo', 'nessuna norma utilizzabile per la data della procedura (contesto non risolto)');
  }
  if (contesto.regoleApplicabili === 0 || requisiti.length === 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R1b-requisiti-assenti', `${contesto.regoleApplicabili} fonte/i verificata/e senza requisiti ricostruibili`);
  }
  const nonValutabili = conStato('NON_VALUTABILE');
  if (nonValutabili.length > 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R2-tipo-non-gestito', `requisiti non valutabili: ${ids(nonValutabili)}`);
  }
  const incerti = conStato('INCERTO');
  if (incerti.length > 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R3-computazione-incerta', `requisiti incerti: ${ids(incerti)}`);
  }
  const titoliNonSoddisfatti = conStato('NON_SODDISFATTO').filter(
    (requisito) => requisito.natura !== 'cfu',
  );
  if (titoliNonSoddisfatti.length > 0) {
    return esito('NOT_ELIGIBLE', 'R4-titolo-non-soddisfatto', `titolo/accesso non soddisfatto: ${ids(titoliNonSoddisfatti)}`);
  }

  const cfuNonSoddisfatti = conStato('NON_SODDISFATTO').filter(
    (requisito) => requisito.natura === 'cfu',
  );
  const integrabili = conStato('NON_SODDISFATTO_INTEGRABILE');
  // A5: l'integrabilità è un FATTO DEL REQUISITO (dichiarato dalla fonte), non
  // più un insieme globale letto dalle regole applicabili.
  const vietati = cfuNonSoddisfatti.filter((requisito) => requisito.integrabilita === 'PROHIBITED');
  if (vietati.length > 0) {
    return esito('NOT_ELIGIBLE', 'R5-integrazione-vietata', `deficit non integrabili (fonte PROHIBITED): ${ids(vietati)}`);
  }
  const incoerenti = integrabili.filter((requisito) => requisito.integrabilita === 'PROHIBITED');
  if (incoerenti.length > 0) {
    // Deficit rappresentato come integrabile ma dichiarato PROHIBITED dalla fonte:
    // dichiarazioni incompatibili → mai un verdetto positivo, nessuna scelta automatica.
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R5b-incoerenza-integrabilita', `integrabilità incoerente per: ${ids(incoerenti)}`);
  }

  const datoNormativoMancante = conStato('DATO_NORMATIVO_MANCANTE');
  if (datoNormativoMancante.length > 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R6-dato-normativo-mancante', `informazione normativa assente: ${ids(datoNormativoMancante)}`);
  }
  const datoUtenteMancante = conStato('DATO_UTENTE_MANCANTE');
  if (datoUtenteMancante.length > 0) {
    return esito('INSUFFICIENT_DATA', 'R7-dato-utente-mancante', `dati utente mancanti: ${ids(datoUtenteMancante)}`);
  }

  const ammessi = cfuNonSoddisfatti.filter((requisito) => requisito.integrabilita === 'ALLOWED');
  if (ammessi.length > 0 || integrabili.length > 0) {
    return esito(
      'CONDITIONALLY_ELIGIBLE',
      'R8-integrazione-ammessa',
      `integrazione dichiarata dalle fonti per: ${ids([...ammessi, ...integrabili])}`,
    );
  }
  if (cfuNonSoddisfatti.length > 0) {
    return esito('MANUAL_VERIFICATION_REQUIRED', 'R9-integrabilita-non-dichiarata', `deficit con integrabilità non dichiarata: ${ids(cfuNonSoddisfatti)}`);
  }
  return esito('ELIGIBLE', 'R10-tutto-soddisfatto', 'tutti i requisiti sono soddisfatti');
}

/**
 * Motivi registrati nell'audit quando lo stato aggregato NON coincide con il
 * verdetto del decisore legacy, o quando esistono conflitti fra fonti.
 */
export function motiviEscalation(
  esito: EsitoAggregazione,
  statoSolutore: EsitoValutazione | null,
  conflitti: readonly ConflittoNormativo[],
): readonly string[] {
  const motivi: string[] = [];
  if (conflitti.length > 0) {
    motivi.push(`Conflitto fra fonti autorevoli (${conflitti.map((c) => c.id).join(', ')}): nessuna risoluzione automatica.`);
  }
  if (esito.stato !== statoSolutore) {
    motivi.push(
      `Aggregazione di stato della pipeline (${esito.regola}): ${esito.stato} — ${esito.dettaglio}; ` +
        `decisore aggregato legacy: ${statoSolutore ?? 'nessuno'}.`,
    );
  }
  return motivi;
}

export interface ParametriContestoAggregazione {
  readonly requisiti: readonly DefinizioneRequisito[];
  readonly valutazioni: readonly EsitoValutazioneRequisito[];
  readonly conflitti: readonly ConflittoNormativo[];
  /** Regole che hanno superato il Source Gate (uniche autorizzate a vincolare). */
  readonly regoleApplicabili: readonly NormativeRuleEntry[];
  /** Causa del contesto non risolto: fatto di CONTESTO, mai dedotta dai requisiti. */
  readonly causaContesto: CausaContestoNormativo;
}

/**
 * Costruisce il contesto di aggregazione dai FATTI DI REQUISITO (A5): natura e
 * integrabilità arrivano dal requisito; i rami della disgiunzione dall'esito per
 * requisito (A3). Un requisito senza natura dichiarata è `NON_VALUTABILE` (R2) e
 * non può rendere positivo un esito (la natura di comodo è quindi inerte).
 */
export function costruisciContestoAggregazione(
  parametri: ParametriContestoAggregazione,
): ContestoAggregazione {
  const perId = new Map<string, EsitoValutazioneRequisito>(
    parametri.valutazioni.map((valutazione) => [valutazione.requisitoId, valutazione]),
  );
  return {
    requisiti: parametri.requisiti.map((requisito: DefinizioneRequisito) => {
      const valutazione = perId.get(requisito.id);
      const natura = requisito.natura;
      const integrabilita = requisito.integrabilita;
      return {
        id: requisito.id,
        tipo: requisito.tipo,
        natura: natura ?? 'cfu',
        integrabilita,
        stato:
          natura === null || !valutazione
            ? ('NON_VALUTABILE' as const)
            : statoAggregatoDaRequisito(valutazione.stato, integrabilita),
        opzioni: valutazione?.rami?.map((ramo) => ({
          id: ramo.id,
          stato: statoAggregatoDaRequisito(ramo.stato, integrabilita),
        })),
      };
    }),
    conflitti: parametri.conflitti.map((conflitto) => conflitto.id),
    causaContesto: parametri.causaContesto,
    regoleApplicabili: parametri.regoleApplicabili.length,
  };
}

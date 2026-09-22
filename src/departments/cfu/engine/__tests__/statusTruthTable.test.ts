/**
 * ScuoleRadar.it — Dipartimento CFU · TABELLA DI VERITÀ dello stato aggregato.
 *
 * Matrice esplicita della semantica di stato della pipeline: le regole R0-R10 di
 * `pipeline/status.ts` (AUTORITÀ INTERNA DELLA PIPELINE, fase 4) vengono verificate
 * combinazione per combinazione, incluse le ambiguità A1-A6 risolte.
 *
 * ⚠️ Confine di autorità: il verdetto usato da UI e report resta quello del
 * decisore aggregato legacy (`valutaRequisitoClasse`, esposto come `statoSolutore`).
 * Qui si verifica lo stato INTERNO della pipeline (`RisultatoPipeline.stato`).
 * Gli invarianti G1-G4 sono in `statusInvariants.test.ts`.
 */
import { aggregaStatoRequisiti } from '../pipeline/status';
import {
  assert,
  conIntegrabilita,
  conteggioAsserzioni,
  contesto,
  requisito,
  requisitoConRami,
  type ContestoAggregazione,
} from './statusSpecFixtures';
import type { EsitoValutazione } from '../types';

interface CasoMatrice {
  readonly etichetta: string;
  readonly contesto: ContestoAggregazione;
  readonly atteso: EsitoValutazione;
  readonly regolaAttesa: string;
  readonly nota: string;
}

const MATRICE: readonly CasoMatrice[] = [
  {
    etichetta: 'tutti i requisiti soddisfatti',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'SODDISFATTO')]),
    atteso: 'ELIGIBLE', regolaAttesa: 'R10-tutto-soddisfatto',
    nota: 'unico caso di idoneità piena',
  },
  {
    etichetta: 'un requisito condizionale (integrazione dichiarata)',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'NON_SODDISFATTO_INTEGRABILE')]),
    atteso: 'CONDITIONALLY_ELIGIBLE', regolaAttesa: 'R8-integrazione-ammessa',
    nota: 'deficit dichiarato integrabile DALLA FONTE (non dedotto)',
  },
  {
    etichetta: 'un requisito in verifica manuale (calcolo incerto)',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'INCERTO')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R3-computazione-incerta',
    nota: 'mappature/OCR non affidabili non possono sostenere un giudizio',
  },
  {
    etichetta: 'A1 · un requisito con dati utente insufficienti',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'DATO_UTENTE_MANCANTE')]),
    atteso: 'INSUFFICIENT_DATA', regolaAttesa: 'R7-dato-utente-mancante',
    nota: 'dato mancante dell’utente: azionabile dal candidato',
  },
  {
    etichetta: 'A1 · dato utente mancante da solo: MAI NOT_ELIGIBLE',
    contesto: contesto([requisito('r1', 'DATO_UTENTE_MANCANTE')]),
    atteso: 'INSUFFICIENT_DATA', regolaAttesa: 'R7-dato-utente-mancante',
    nota: 'l’assenza di un dato utente non è un’inidoneità accertata',
  },
  {
    etichetta: 'A1 · negativa accertata + dato utente mancante (resta negativa)',
    contesto: contesto([requisito('r1', 'NON_SODDISFATTO', 'titolo'), requisito('r2', 'DATO_UTENTE_MANCANTE')]),
    atteso: 'NOT_ELIGIBLE', regolaAttesa: 'R4-titolo-non-soddisfatto',
    nota: 'un dato mancante NON rianima un titolo escluso dalla fonte',
  },
  {
    etichetta: 'un requisito non idoneo (deficit non integrabile)',
    contesto: contesto(
      conIntegrabilita(
        [requisito('r1', 'SODDISFATTO'), requisito('r2', 'NON_SODDISFATTO')],
        'PROHIBITED',
      ),
    ),
    atteso: 'NOT_ELIGIBLE', regolaAttesa: 'R5-integrazione-vietata',
    nota: 'la fonte esclude espressamente l’integrazione (fatto del requisito)',
  },
  {
    etichetta: 'A5 · deficit dichiarato integrabile dalla fonte',
    contesto: contesto([
      requisito('r1', 'SODDISFATTO'),
      requisito('r2', 'NON_SODDISFATTO', 'cfu', 'ALLOWED'),
    ]),
    atteso: 'CONDITIONALLY_ELIGIBLE', regolaAttesa: 'R8-integrazione-ammessa',
    nota: 'integrabilità dichiarata dal REQUISITO: mai dedotta dalle regole',
  },
  {
    etichetta: 'requisiti in conflitto fra fonti',
    contesto: contesto(
      [requisito('r1', 'SODDISFATTO'), requisito('r2', 'SODDISFATTO')],
      { conflitti: ['conflitto-1'] },
    ),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R1-conflitto',
    nota: 'conflitto registrato: MAI ELIGIBLE, nessuna risoluzione automatica',
  },
  {
    etichetta: 'tipo di requisito non supportato',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'NON_VALUTABILE')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R2-tipo-non-gestito',
    nota: 'nessuna strategia/natura dichiarata: nessun giudizio automatico',
  },
  {
    etichetta: 'A3 · alternativa con UN ramo conclusivo e uno incerto',
    contesto: contesto([requisitoConRami('r1', ['SODDISFATTO', 'INCERTO'])]),
    atteso: 'ELIGIBLE', regolaAttesa: 'R10-tutto-soddisfatto',
    nota: 'il ramo soddisfatto stabilisce l’OR da solo (incertezza non decisiva)',
  },
  {
    etichetta: 'A3 · alternativa con ramo conclusivo e ramo non valutabile',
    contesto: contesto([requisitoConRami('r1', ['SODDISFATTO', 'NON_VALUTABILE'])]),
    atteso: 'ELIGIBLE', regolaAttesa: 'R10-tutto-soddisfatto',
    nota: 'il ramo soddisfatto è conclusivo: il ramo non valutabile non lo ribalta',
  },
  {
    etichetta: 'A3 · alternativa con ramo CONDIZIONALE e ramo incerto',
    contesto: contesto([requisitoConRami('r1', ['NON_SODDISFATTO_INTEGRABILE', 'INCERTO'])]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R3-computazione-incerta',
    nota: 'un ramo solo COMPLETIBILE non soddisfa l’OR: resta l’incertezza',
  },
  {
    etichetta: 'A3 · alternativa con ramo condizionale e ramo fallito',
    contesto: contesto(
      [requisitoConRami('r1', ['NON_SODDISFATTO', 'NON_SODDISFATTO_INTEGRABILE'], 'cfu', 'ALLOWED')],
    ),
    atteso: 'CONDITIONALLY_ELIGIBLE', regolaAttesa: 'R8-integrazione-ammessa',
    nota: 'nessun ramo conclusivo: vale il ramo completabile dichiarato',
  },
  {
    etichetta: 'A2+A3 · alternativa fra dato utente e dato normativo mancante',
    contesto: contesto([requisitoConRami('r1', ['DATO_UTENTE_MANCANTE', 'DATO_NORMATIVO_MANCANTE'])]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R6-dato-normativo-mancante',
    nota: 'il dato NORMATIVO prevale: nessun dato utente può risolverlo',
  },
  {
    etichetta: 'A3 · alternativa con TUTTI i rami falliti (integrazione vietata)',
    contesto: contesto(
      [requisitoConRami('r1', ['NON_SODDISFATTO', 'NON_SODDISFATTO'], 'cfu', 'PROHIBITED')],
    ),
    atteso: 'NOT_ELIGIBLE', regolaAttesa: 'R5-integrazione-vietata',
    nota: 'nessun ramo soddisfatto e integrazione esclusa dalla fonte',
  },
  {
    etichetta: 'deficit certo ma integrabilità non dichiarata',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'NON_SODDISFATTO')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R9-integrabilita-non-dichiarata',
    nota: 'deficit certo ma integrabilità non dichiarata: nessuna deduzione',
  },
  {
    etichetta: 'A4 · misto condizionale + verifica manuale',
    contesto: contesto([requisito('r1', 'NON_SODDISFATTO_INTEGRABILE'), requisito('r2', 'INCERTO')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R3-computazione-incerta',
    nota: 'il percorso condizionale non è pubblicabile finché un vincolo è irrisolto',
  },
  {
    etichetta: 'A4 · misto condizionale + dato utente mancante',
    contesto: contesto([requisito('r1', 'NON_SODDISFATTO_INTEGRABILE'), requisito('r2', 'DATO_UTENTE_MANCANTE')]),
    atteso: 'INSUFFICIENT_DATA', regolaAttesa: 'R7-dato-utente-mancante',
    nota: 'percorso condizionale non pubblicato; gap azionabile dal candidato (A1)',
  },
  {
    etichetta: 'A2 · misto dato mancante utente + normativo',
    contesto: contesto([requisito('r1', 'DATO_UTENTE_MANCANTE'), requisito('r2', 'DATO_NORMATIVO_MANCANTE')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R6-dato-normativo-mancante',
    nota: 'l’assenza di informazione NORMATIVA prevale: mai declassata a dati insufficienti',
  },
  {
    etichetta: 'A6 · accesso con ammissibilità non provata da fonte primaria',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'DATO_NORMATIVO_MANCANTE', 'accesso')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R6-dato-normativo-mancante',
    nota: 'assenza di prova ≠ classe non ammessa: MAI NOT_ELIGIBLE',
  },
  {
    etichetta: 'A6 · accesso con esclusione documentata dalla fonte',
    contesto: contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'NON_SODDISFATTO', 'accesso')]),
    atteso: 'NOT_ELIGIBLE', regolaAttesa: 'R4-titolo-non-soddisfatto',
    nota: 'il requisito di accesso non è integrabile con CFU',
  },
  {
    etichetta: 'titolo mandatorio non soddisfatto (anche con CFU integrabili)',
    contesto: contesto([
      requisito('r1', 'NON_SODDISFATTO', 'titolo'),
      requisito('r2', 'NON_SODDISFATTO_INTEGRABILE', 'cfu', 'ALLOWED'),
    ]),
    atteso: 'NOT_ELIGIBLE', regolaAttesa: 'R4-titolo-non-soddisfatto',
    nota: 'il titolo duro prevale: nessuna integrazione di CFU lo sostituisce',
  },
  {
    etichetta: 'integrabilità incoerente (requisito integrabile ma fonte PROHIBITED)',
    contesto: contesto([requisito('r1', 'NON_SODDISFATTO_INTEGRABILE', 'cfu', 'PROHIBITED')]),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R5b-incoerenza-integrabilita',
    nota: 'dichiarazioni incompatibili: nessuna scelta automatica',
  },
  {
    etichetta: 'R0 · contesto non risolto per DATI UTENTE mancanti',
    contesto: contesto([requisito('r1', 'SODDISFATTO')], { causaContesto: 'dato-utente' }),
    atteso: 'INSUFFICIENT_DATA', regolaAttesa: 'R0-contesto-utente',
    nota: 'data della procedura mancante: il candidato può risolverla',
  },
  {
    etichetta: 'R1 · contesto non risolto per causa NORMATIVA',
    contesto: contesto([requisito('r1', 'SODDISFATTO')], { causaContesto: 'normativa' }),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R1-contesto-normativo',
    nota: 'nessuna norma utilizzabile: verifica manuale, mai "dati insufficienti"',
  },
  {
    etichetta: 'R1b · nessuna regola autorevole applicabile',
    contesto: contesto([], { regoleApplicabili: 0 }),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R1b-requisiti-assenti',
    nota: 'assenza di normativa verificata ≠ inidoneità e ≠ dati utente mancanti',
  },
  {
    etichetta: 'R1b · regole applicabili ma nessun requisito ricostruibile',
    contesto: contesto([], { regoleApplicabili: 1 }),
    atteso: 'MANUAL_VERIFICATION_REQUIRED', regolaAttesa: 'R1b-requisiti-assenti',
    nota: 'nessun requisito verificato ⇒ niente è stabilito: mai ELIGIBLE',
  },
];

/* ------------------------------ Verifica della matrice ------------------------------ */

function main(): void {
  console.log('Tabella di verità dello stato aggregato (autorità interna della pipeline)');
  for (const caso of MATRICE) {
    const esito = aggregaStatoRequisiti(caso.contesto);
    assert(
      esito.stato === caso.atteso,
      `${caso.etichetta}: atteso ${caso.atteso}, ottenuto ${esito.stato} (${caso.nota})`,
    );
    assert(
      esito.regola === caso.regolaAttesa,
      `${caso.etichetta}: regola applicata ${caso.regolaAttesa}, ottenuta ${esito.regola}`,
    );
    assert(esito.percorso.length >= 2, `${caso.etichetta}: percorso logico tracciato`);
    assert(
      aggregaStatoRequisiti(caso.contesto).stato === esito.stato,
      `${caso.etichetta}: aggregazione deterministica (stesso input → stesso stato)`,
    );
  }
  console.log(`  ✓ Matrice di verità: ${MATRICE.length} combinazioni con regola di precedenza tracciata.`);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main();

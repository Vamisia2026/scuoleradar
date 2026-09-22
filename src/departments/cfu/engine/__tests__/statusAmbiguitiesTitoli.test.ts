/**
 * ScuoleRadar.it — Dipartimento CFU · AMBIGUITÀ A4-A6 (risolte in fase 4).
 *
 * Completano la risoluzione delle ambiguità della specifica di stato (A1-A3 in
 * `statusAmbiguities.test.ts`):
 *
 *  A4 percorso condizionale mai pubblicato con un requisito irrisolto
 *     (salvo rami non decisivi → A3).
 *  A5 informazione normativa per requisito: migrazione RINVIATA (guardia sulla
 *     mappatura di produzione).
 *  A6 classe di laurea: esclusione documentata ⇒ NOT_ELIGIBLE; ammissibilità
 *     documentata ⇒ soddisfatto; assenza di prova primaria ⇒ MANUAL (mai
 *     inidoneità: "manca l'estratto verbatim" ≠ "classe non ammessa").
 *
 * ⚠️ Confine di autorità: nessun consumatore legacy è commutato; il verdetto per
 * UI/report resta `valutaRequisitoClasse`.
 */
import { aggregaStatoRequisiti, statoAggregatoDaRequisito } from '../pipeline/status';
import { naturaDaTipo } from '../pipeline/conversions';
import { TIPI_GESTITI_DALL_AGGREGATORE } from '../pipeline/strategies';
import {
  assert,
  conteggioAsserzioni,
  contesto,
  requisito,
  requisitoConRami,
  valutaTutto,
  type StatoRequisitoAggregato,
} from './statusSpecFixtures';
import {
  EXAMS_COMPLETI,
  inputMock,
  regolaMock,
  shaFixture,
  TITOLO_MOCK,
} from './universalPipelineFixtures';
import type { EsitoValutazione, IntegrabilitaStatus } from '../types';
import type { StatoRequisito } from '../pipeline/requirementTypes';
/* ------------------------------------- A4 ------------------------------------- */

function testA4PercorsoCondizionale(): void {
  // Il percorso condizionale NON è pubblicato mentre un requisito è irrisolto.
  const irrisolti: { etichetta: string; stato: StatoRequisitoAggregato; atteso: EsitoValutazione }[] = [
    { etichetta: 'calcolo incerto', stato: 'INCERTO', atteso: 'MANUAL_VERIFICATION_REQUIRED' },
    { etichetta: 'dato normativo mancante', stato: 'DATO_NORMATIVO_MANCANTE', atteso: 'MANUAL_VERIFICATION_REQUIRED' },
    { etichetta: 'tipo non valutabile', stato: 'NON_VALUTABILE', atteso: 'MANUAL_VERIFICATION_REQUIRED' },
    { etichetta: 'dato utente mancante', stato: 'DATO_UTENTE_MANCANTE', atteso: 'INSUFFICIENT_DATA' },
  ];
  for (const caso of irrisolti) {
    const esito = aggregaStatoRequisiti(
      contesto([requisito('condizionale', 'NON_SODDISFATTO_INTEGRABILE'), requisito('irrisolto', caso.stato)]),
    );
    assert(
      esito.stato === caso.atteso,
      `A4 [${caso.etichetta}]: ${esito.stato}, atteso ${caso.atteso} (mai CONDITIONALLY)`,
    );
  }

  // Eccezione: l'irrisolto è un RAMO NON DECISIVO di una disgiunzione (A3).
  const ramoNonDecisivo = aggregaStatoRequisiti(
    contesto([
      requisito('condizionale', 'NON_SODDISFATTO_INTEGRABILE'),
      requisitoConRami('disgiunzione', ['SODDISFATTO', 'INCERTO']),
    ]),
  );
  assert(
    ramoNonDecisivo.stato === 'CONDITIONALLY_ELIGIBLE' && ramoNonDecisivo.regola === 'R8-integrazione-ammessa',
    `A4: il ramo non decisivo non blocca il condizionale (${ramoNonDecisivo.stato}/${ramoNonDecisivo.regola})`,
  );
  console.log('  ✓ A4: percorso condizionale pubblicato solo se nessun requisito è irrisolto.');
}

/* ------------------------------------- A5 ------------------------------------- */

function testA5RinvioMigrazione(): void {
  // A5 (fase 5): natura e integrabilità sono FATTI DEL REQUISITO, dichiarati alla
  // risoluzione. La mappatura di produzione non produce `DATO_NORMATIVO_MANCANTE`
  // (che resta disponibile per dichiarazioni esplicite future, es. ammissibilità
  // della classe di laurea non provata) e un deficit dichiarato ALLOWED diventa
  // `NON_SODDISFATTO_INTEGRABILE` (integrazione dichiarata DALLA FONTE).
  const statiRequisito: readonly StatoRequisito[] = [
    'SODDISFATTO',
    'NON_SODDISFATTO',
    'COMPUTAZIONE_INCERTA',
    'DATI_INSUFFICIENTI',
    'NON_VALUTABILE',
  ];
  const dichiarazioni: readonly IntegrabilitaStatus[] = ['ALLOWED', 'PROHIBITED', 'NOT_SPECIFIED'];
  for (const stato of statiRequisito) {
    for (const dichiarazione of dichiarazioni) {
      const aggregato = statoAggregatoDaRequisito(stato, dichiarazione);
      assert(
        aggregato !== 'DATO_NORMATIVO_MANCANTE',
        `A5: la mappatura di produzione non emette DATO_NORMATIVO_MANCANTE (${stato}/${dichiarazione} → ${aggregato})`,
      );
      if (stato === 'NON_SODDISFATTO') {
        assert(
          aggregato === (dichiarazione === 'ALLOWED' ? 'NON_SODDISFATTO_INTEGRABILE' : 'NON_SODDISFATTO'),
          `A5: deficit ${dichiarazione} → ${aggregato}`,
        );
      }
    }
  }
  for (const tipo of TIPI_GESTITI_DALL_AGGREGATORE) {
    assert(naturaDaTipo(tipo) !== null, `A5: il tipo coperto ${tipo} dichiara la propria natura`);
  }
  const nonDichiarato = aggregaStatoRequisiti(contesto([requisito('r1', 'SODDISFATTO')]));
  assert(
    nonDichiarato.stato === 'ELIGIBLE',
    'A5: integrabilità non dichiarata rileva solo con un deficit (nessuna deduzione a priori)',
  );
  console.log('  ✓ A5: natura e integrabilità sono fatti del requisito (mappatura verificata).');
}


/* ------------------------------------- A6 ------------------------------------- */

function testA6ClasseDiLaurea(sha: string): void {
  // 1. Esclusione DOCUMENTATA dalla fonte primaria → NOT_ELIGIBLE.
  const esclusione = valutaTutto(
    inputMock([{ ...regolaMock(sha), classiLaureaAmmesse: ['LM-14'] }], { esami: EXAMS_COMPLETI }),
  );
  assert(
    esclusione.pipeline === 'NOT_ELIGIBLE' && esclusione.esito.regola === 'R4-titolo-non-soddisfatto',
    `A6 [esclusione documentata]: ${esclusione.pipeline} (${esclusione.esito.regola})`,
  );

  // 2. Ammissibilità DOCUMENTATA (TITOLO_MOCK è fra le classi dichiarate) → soddisfatto.
  const ammissibile = valutaTutto(inputMock([regolaMock(sha)], { esami: EXAMS_COMPLETI }));
  assert(
    ammissibile.pipeline === 'ELIGIBLE' && ammissibile.esito.regola === 'R10-tutto-soddisfatto',
    `A6 [ammissibilità documentata]: ${ammissibile.pipeline} (${ammissibile.esito.regola})`,
  );
  assert(
    ammissibile.risultato.requisiti.some((strutturato) => strutturato.tipo === 'titolo.accesso.classe'),
    'A6: requisito di accesso presente quando la fonte dichiara le classi ammesse',
  );

  // 3. ASSENZA di prova primaria (nessuna classe dichiarata) → nessuna inidoneità.
  const senzaProva = valutaTutto(
    inputMock([{ ...regolaMock(sha), classiLaureaAmmesse: [] }], { esami: EXAMS_COMPLETI }),
  );
  assert(
    !senzaProva.risultato.requisiti.some((strutturato) => strutturato.tipo === 'titolo.accesso.classe'),
    'A6: nessun requisito di accesso se la fonte non dichiara classi ammesse',
  );
  assert(
    senzaProva.pipeline !== 'NOT_ELIGIBLE',
    `A6 [assenza di prova]: mai inidoneità (${senzaProva.pipeline})`,
  );

  // 3b. Prova NON verificabile (fonte non validata dal Source Gate): la regola che
  //     escluderebbe la classe è esclusa ⇒ nessuna fonte verificata (R1b) ⇒ MANUAL.
  const fonteNonVerificata = valutaTutto(
    inputMock([{ ...regolaMock(sha, { sourceStatus: 'UNVERIFIED' }), classiLaureaAmmesse: ['LM-14'] }]),
  );
  assert(
    fonteNonVerificata.pipeline === 'MANUAL_VERIFICATION_REQUIRED',
    `A6 [prova non verificabile]: verifica manuale (${fonteNonVerificata.pipeline})`,
  );
  assert(
    fonteNonVerificata.pipeline !== 'NOT_ELIGIBLE',
    'A6 [prova non verificabile]: mai inidoneità da prova assente',
  );

  // Livello di aggregazione: un requisito di accesso con informazione normativa
  // assente è incertezza normativa, non inidoneità.
  const accessoIncertezza = aggregaStatoRequisiti(
    contesto([requisito('accesso', 'DATO_NORMATIVO_MANCANTE', 'accesso'), requisito('cfu', 'SODDISFATTO')]),
  );
  assert(
    accessoIncertezza.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `A6: accesso non provato ⇒ MANUAL (${accessoIncertezza.stato})`,
  );
  assert(accessoIncertezza.stato !== 'NOT_ELIGIBLE', 'A6: accesso non provato ⇒ mai NOT_ELIGIBLE');
  console.log('  ✓ A6: esclusione documentata ≠ assenza di prova (3 casi + guardia di aggregazione).');
}

/* ------------------------------ Runner ------------------------------ */


async function main(): Promise<void> {
  console.log('Ambiguità A4-A6 risolte — aggregazione di stato (nessun verdetto utente cambia)');
  assert(TITOLO_MOCK.classe === 'LM-99-TEST', 'fixture: classe del titolo di test');
  const sha = await shaFixture();
  testA4PercorsoCondizionale();
  testA5RinvioMigrazione();
  testA6ClasseDiLaurea(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


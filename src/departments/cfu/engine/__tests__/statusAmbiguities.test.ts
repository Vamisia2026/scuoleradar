/**
 * ScuoleRadar.it — Dipartimento CFU · AMBIGUITÀ A1-A6 (risolte in fase 4).
 *
 * Ogni ambiguità della specifica di stato diventa una REGOLA ESPLICITA e un test
 * dedicato, sia sul livello di aggregazione (`pipeline/status.ts`) sia — dove la
 * rappresentazione lo consente — sul livello di pipeline (fixture di test).
 *
 *  A1 dato utente mancante → INSUFFICIENT_DATA (azionabile dal candidato);
 *     mai NOT_ELIGIBLE da solo; se c'è anche incertezza normativa vale A2.
 *  A2 incertezza normativa + dato utente mancante → MANUAL (mai declassata).
 *  A3 disgiunzione: soddisfatta SOLO da un ramo conclusivo.
 *
 * A4 (percorso condizionale), A5 (migrazione rinviata) e A6 (classe di laurea)
 * sono verificati in `statusAmbiguitiesTitoli.test.ts`.
 *
 * ⚠️ Confine di autorità: nessun consumatore legacy è commutato; il verdetto per
 * UI/report resta `valutaRequisitoClasse`.
 */
import { aggregaStatoRequisiti, esitoDisgiunzione } from '../pipeline/status';
import {
  assert,
  conIntegrabilita,
  conteggioAsserzioni,
  contesto,
  requisito,
  requisitoConRami,
  valutaTutto,
  type StatoRequisitoAggregato,
} from './statusSpecFixtures';
import {
  esameMock,
  EXAMS_PARZIALI,
  inputMock,
  regolaMock,
  shaFixture,
} from './universalPipelineFixtures';
import type { EsameCanonico, EsitoValutazione, IntegrabilitaStatus } from '../types';

/* ------------------------------------- A1 ------------------------------------- */

function testA1DatoUtenteMancante(sha: string): void {
  // Aggregazione: un solo gap utente → dati insufficienti, MAI negativa.
  const soloGap = aggregaStatoRequisiti(contesto([requisito('r1', 'DATO_UTENTE_MANCANTE')]));
  assert(soloGap.stato === 'INSUFFICIENT_DATA', `A1: gap utente → INSUFFICIENT_DATA (${soloGap.stato})`);
  assert(soloGap.regola === 'R7-dato-utente-mancante', 'A1: regola R7 applicata');

  // Negativa già accertata da fonte + gap utente: la negativa resta.
  const negativa = aggregaStatoRequisiti(
    contesto([requisito('titolo', 'NON_SODDISFATTO', 'titolo'), requisito('r2', 'DATO_UTENTE_MANCANTE')]),
  );
  assert(negativa.stato === 'NOT_ELIGIBLE', 'A1: la negativa accertata non è ribaltata dal gap');

  // Pipeline reale (fixture): CFU non numerici → dato utente azionabile.
  const esami: EsameCanonico[] = [...EXAMS_PARZIALI, { ...esameMock('bad', 'X-TEST/01', 12), cfu: Number.NaN }];
  const anomali = valutaTutto(inputMock([regolaMock(sha)], { esami }));
  assert(anomali.risultato.dati.cfuNonValidi === true, 'A1: CFU non validi rilevati dalla pipeline');
  assert(
    anomali.pipeline === 'INSUFFICIENT_DATA' && anomali.esito.regola === 'R7-dato-utente-mancante',
    `A1: pipeline → INSUFFICIENT_DATA (R7), ottenuto ${anomali.pipeline} (${anomali.esito.regola})`,
  );
  assert(
    anomali.risultato.deficit.cfuMancantiTotali === null,
    'A1: nessun deficit pubblicato con dati non numerici',
  );
  console.log('  ✓ A1: dato utente mancante → INSUFFICIENT_DATA, mai NOT_ELIGIBLE.');
}

/* ------------------------------------- A2 ------------------------------------- */

function testA2PrecedenzaNormativa(): void {
  const misto = aggregaStatoRequisiti(
    contesto([requisito('r1', 'DATO_UTENTE_MANCANTE'), requisito('r2', 'DATO_NORMATIVO_MANCANTE')]),
  );
  assert(
    misto.stato === 'MANUAL_VERIFICATION_REQUIRED' && misto.regola === 'R6-dato-normativo-mancante',
    `A2: prevale l'incertezza normativa (${misto.stato}/${misto.regola})`,
  );
  // Vale anche dentro una disgiunzione (collasso per gravità).
  const inOr = esitoDisgiunzione([
    { id: 'a', stato: 'DATO_UTENTE_MANCANTE' },
    { id: 'b', stato: 'DATO_NORMATIVO_MANCANTE' },
  ]);
  assert(inOr === 'DATO_NORMATIVO_MANCANTE', `A2: collasso OR → normativo (${inOr})`);
  console.log('  ✓ A2: l’incertezza normativa non è mai declassata a dati insufficienti.');
}

/* ------------------------------------- A3 ------------------------------------- */

interface CasoRami {
  readonly etichetta: string;
  readonly rami: readonly StatoRequisitoAggregato[];
  readonly collassato: StatoRequisitoAggregato;
  /** Integrabilità dichiarata dal requisito disgiuntivo (A5), 'NOT_SPECIFIED' di default. */
  readonly integrabilita: IntegrabilitaStatus;
  readonly statoAggregato: EsitoValutazione;
  readonly regola: string;
}

/** I sette casi richiesti dalla revisione (A3), con l'esito atteso. */
const CASI_OR: readonly CasoRami[] = [
  {
    etichetta: 'A conclusivo + B incerto → soddisfatto',
    rami: ['SODDISFATTO', 'INCERTO'],
    collassato: 'SODDISFATTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'ELIGIBLE', regola: 'R10-tutto-soddisfatto',
  },
  {
    etichetta: 'A solo condizionale + B incerto → NON soddisfatto',
    rami: ['NON_SODDISFATTO_INTEGRABILE', 'INCERTO'],
    collassato: 'INCERTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'MANUAL_VERIFICATION_REQUIRED', regola: 'R3-computazione-incerta',
  },
  {
    etichetta: 'A non valutabile + B conclusivo → soddisfatto (B basta da sé)',
    rami: ['NON_VALUTABILE', 'SODDISFATTO'],
    collassato: 'SODDISFATTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'ELIGIBLE', regola: 'R10-tutto-soddisfatto',
  },
  {
    etichetta: 'A dati utente insufficienti + B conclusivo → soddisfatto',
    rami: ['DATO_UTENTE_MANCANTE', 'SODDISFATTO'],
    collassato: 'SODDISFATTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'ELIGIBLE', regola: 'R10-tutto-soddisfatto',
  },
  {
    etichetta: 'A incertezza normativa + B conclusivo → soddisfatto',
    rami: ['DATO_NORMATIVO_MANCANTE', 'SODDISFATTO'],
    collassato: 'SODDISFATTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'ELIGIBLE', regola: 'R10-tutto-soddisfatto',
  },
  {
    etichetta: 'entrambi incerti → MANUAL',
    rami: ['INCERTO', 'DATO_NORMATIVO_MANCANTE'],
    collassato: 'INCERTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'MANUAL_VERIFICATION_REQUIRED', regola: 'R3-computazione-incerta',
  },
  {
    etichetta: 'entrambi falliti + integrazione vietata → NOT_ELIGIBLE',
    rami: ['NON_SODDISFATTO', 'NON_SODDISFATTO'],
    collassato: 'NON_SODDISFATTO',
    integrabilita: 'PROHIBITED',
    statoAggregato: 'NOT_ELIGIBLE', regola: 'R5-integrazione-vietata',
  },
  {
    etichetta: 'entrambi falliti + integrazione ammessa → CONDITIONALLY_ELIGIBLE',
    rami: ['NON_SODDISFATTO', 'NON_SODDISFATTO'],
    collassato: 'NON_SODDISFATTO',
    integrabilita: 'ALLOWED',
    statoAggregato: 'CONDITIONALLY_ELIGIBLE', regola: 'R8-integrazione-ammessa',
  },
  {
    etichetta: 'entrambi falliti + integrabilità non dichiarata → MANUAL',
    rami: ['NON_SODDISFATTO', 'NON_SODDISFATTO'],
    collassato: 'NON_SODDISFATTO',
    integrabilita: 'NOT_SPECIFIED',
    statoAggregato: 'MANUAL_VERIFICATION_REQUIRED', regola: 'R9-integrabilita-non-dichiarata',
  },
];

function testA3Disgiunzione(sha: string): void {
  for (const caso of CASI_OR) {
    const collassato = esitoDisgiunzione(caso.rami.map((stato, indice) => ({ id: `r${indice}`, stato })));
    assert(
      collassato === caso.collassato,
      `A3 [${caso.etichetta}]: collasso ${collassato}, atteso ${caso.collassato}`,
    );
    const esito = aggregaStatoRequisiti(
      contesto(
        conIntegrabilita(
          [requisitoConRami('disgiunzione', caso.rami), requisito('altro', 'SODDISFATTO')],
          caso.integrabilita,
        ),
      ),
    );
    assert(esito.stato === caso.statoAggregato, `A3 [${caso.etichetta}]: stato ${esito.stato}, atteso ${caso.statoAggregato}`);
    assert(esito.regola === caso.regola, `A3 [${caso.etichetta}]: regola ${esito.regola}, attesa ${caso.regola}`);
  }

  // Proibizione della regola semplicistica: uno stato "positivo all'apparenza"
  // (deficit completabile) NON soddisfa la disgiunzione.
  for (const rami of [
    ['NON_SODDISFATTO_INTEGRABILE', 'INCERTO'],
    ['NON_SODDISFATTO_INTEGRABILE', 'DATO_UTENTE_MANCANTE'],
    ['NON_SODDISFATTO_INTEGRABILE', 'NON_SODDISFATTO_INTEGRABILE'],
  ] as StatoRequisitoAggregato[][]) {
    assert(
      esitoDisgiunzione(rami.map((stato, indice) => ({ id: `r${indice}`, stato }))) !== 'SODDISFATTO',
      `A3: rami ${rami.join('+')} non soddisfano l'OR (nessun ramo conclusivo)`,
    );
  }

  // Pipeline reale (fixture): la disgiunzione Z-TEST/01 oppure Z-TEST/02.
  const unRamo = valutaTutto(
    inputMock([regolaMock(sha)], {
      esami: [...EXAMS_PARZIALI.filter((esame) => esame.ssd !== 'Z-TEST/01'), esameMock('z2', 'Z-TEST/02', 12)],
    }),
  );
  assert(
    unRamo.risultato.valutazioniRequisito.find((valutazione) => valutazione.requisitoId.includes('disgiunzione'))!
      .stato === 'SODDISFATTO',
    'A3 (pipeline): un ramo della disgiunzione raggiunge il minimo ⇒ requisito soddisfatto',
  );
  const nessunRamo = valutaTutto(
    inputMock([regolaMock(sha)], {
      esami: [...EXAMS_PARZIALI.filter((esame) => esame.ssd !== 'Z-TEST/01'), esameMock('z2', 'Z-TEST/02', 6)],
    }),
  );
  const disgiunzione = nessunRamo.risultato.valutazioniRequisito.find((valutazione) =>
    valutazione.requisitoId.includes('disgiunzione'),
  )!;
  assert(
    disgiunzione.stato === 'NON_SODDISFATTO' && disgiunzione.valori.cfuMancanti === 6,
    `A3 (pipeline): nessun ramo al minimo ⇒ NON_SODDISFATTO (${disgiunzione.stato})`,
  );
  assert(
    nessunRamo.pipeline === 'CONDITIONALLY_ELIGIBLE',
    `A3 (pipeline): deficit con integrazione dichiarata ⇒ CONDITIONALLY (${nessunRamo.pipeline})`,
  );
  console.log('  ✓ A3: OR soddisfatto solo da un ramo conclusivo (9 casi + guardia + pipeline reale).');
}



/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Ambiguità A1-A3 risolte — aggregazione di stato (nessun verdetto utente cambia)');
  const sha = await shaFixture();
  testA1DatoUtenteMancante(sha);
  testA2PrecedenzaNormativa();
  testA3Disgiunzione(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


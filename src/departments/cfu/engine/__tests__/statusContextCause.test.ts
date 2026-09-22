/**
 * ScuoleRadar.it — Dipartimento CFU · CONFINE R0/R1 (fase 5).
 *
 * Il sistema NON usa `INSUFFICIENT_DATA` come "non so" generico. La distinzione
 * è esplicita e verificata qui:
 *  - mancano/incompleti DATI UTENTE (es. data della procedura) → INSUFFICIENT_DATA (R0);
 *  - mancano DATI NORMATIVI (nessuna norma utilizzabile, nessuna fonte verificata) →
 *    MANUAL_VERIFICATION_REQUIRED (R1/R1b);
 *  - fonti normative in CONFLITTO → MANUAL_VERIFICATION_REQUIRED (R1-conflitto);
 *  - negativa accertata da fonte + dato utente mancante NON correlato → NOT_ELIGIBLE.
 *
 * ⚠️ Confine di autorità: il verdetto per UI/report resta `valutaRequisitoClasse`.
 */
import {
  aggregaStatoRequisiti,
  causaContestoNormativoDa,
  verdettoPositivo,
} from '../pipeline/status';
import {
  assert,
  conteggioAsserzioni,
  contesto,
  requisito,
  valutaTutto,
} from './statusSpecFixtures';
import {
  esameMock,
  EXAMS_PARZIALI,
  inputMock,
  regolaMock,
  shaFixture,
  VINCOLI_MOCK,
} from './universalPipelineFixtures';

/* ------------------------- Causa del contesto (funzione pura) ------------------------- */

function testCausaContesto(): void {
  assert(
    causaContestoNormativoDa({ normativaRisolta: true, dataProcedura: '2024-03-15' }) === 'risolta',
    'contesto risolto ⇒ causa "risolta"',
  );
  assert(
    causaContestoNormativoDa({ normativaRisolta: false, dataProcedura: null }) === 'dato-utente',
    'senza data della procedura la causa è un DATO UTENTE (azionabile dal candidato)',
  );
  assert(
    causaContestoNormativoDa({ normativaRisolta: false, dataProcedura: '2024-03-15' }) === 'normativa',
    'con la data dichiarata, un contesto non risolto è una causa NORMATIVA',
  );
  console.log('  ✓ Causa del contesto: dato utente vs normativa (nessun "non so" generico).');
}

/* --------------------------------- 1. Dati utente --------------------------------- */

function testDatiUtente(sha: string): void {
  // Aggregazione: causa "dato-utente" (R0) e gap utente a livello di requisito (R7).
  const causaUtente = aggregaStatoRequisiti(
    contesto([requisito('r1', 'SODDISFATTO')], { causaContesto: 'dato-utente' }),
  );
  assert(
    causaUtente.stato === 'INSUFFICIENT_DATA' && causaUtente.regola === 'R0-contesto-utente',
    `R0: causa utente ⇒ INSUFFICIENT_DATA (${causaUtente.stato}/${causaUtente.regola})`,
  );
  const gapRequisito = aggregaStatoRequisiti(
    contesto([requisito('r1', 'SODDISFATTO'), requisito('r2', 'DATO_UTENTE_MANCANTE')]),
  );
  assert(
    gapRequisito.stato === 'INSUFFICIENT_DATA' && gapRequisito.regola === 'R7-dato-utente-mancante',
    `R7: gap utente sui requisiti ⇒ INSUFFICIENT_DATA (${gapRequisito.regola})`,
  );

  // Pipeline: senza data della procedura l'identificazione è incompleta → R0.
  const senzaData = valutaTutto(
    inputMock([regolaMock(sha)], {
      dateRilevanza: { enrollmentDate: '2019-10-01', awardedDate: '2022-11-18' },
    }),
  );
  assert(
    senzaData.risultato.identificazione.datiMancanti.includes('data della procedura'),
    'pipeline: data della procedura elencata fra i dati mancanti',
  );
  assert(
    senzaData.pipeline === 'INSUFFICIENT_DATA' && senzaData.esito.regola === 'R0-contesto-utente',
    `pipeline: R0-contesto-utente (${senzaData.pipeline}/${senzaData.esito.regola})`,
  );
  console.log('  ✓ Dati utente mancanti → INSUFFICIENT_DATA (R0/R7), mai un "non so" normativo.');
}

/* ------------------------------- 2. Dati normativi ------------------------------- */

function testDatiNormativi(sha: string): void {
  const causaNormativa = aggregaStatoRequisiti(
    contesto([requisito('r1', 'SODDISFATTO')], { causaContesto: 'normativa' }),
  );
  assert(
    causaNormativa.stato === 'MANUAL_VERIFICATION_REQUIRED' &&
      causaNormativa.regola === 'R1-contesto-normativo',
    `R1: causa normativa ⇒ MANUAL (${causaNormativa.stato}/${causaNormativa.regola})`,
  );
  assert(!verdettoPositivo(causaNormativa.stato), 'R1: mai un verdetto positivo');

  // Pipeline: tutte le fonti escluse dal Source Gate ⇒ nessuna fonte verificata (R1b).
  const fontiEscluse = valutaTutto(inputMock([regolaMock(sha, { sourceStatus: 'UNVERIFIED' })]));
  assert(
    fontiEscluse.risultato.fonti.fonti.length === 0 && fontiEscluse.risultato.requisiti.length === 0,
    'pipeline: nessuna fonte verificata e nessun requisito',
  );
  assert(
    fontiEscluse.pipeline === 'MANUAL_VERIFICATION_REQUIRED' &&
      fontiEscluse.esito.regola === 'R1b-requisiti-assenti',
    `pipeline: R1b-requisiti-assenti (${fontiEscluse.pipeline}/${fontiEscluse.esito.regola})`,
  );
  console.log('  ✓ Dati normativi mancanti → MANUAL_VERIFICATION_REQUIRED (R1/R1b).');
}

/* ---------------------------- 3. Fonti normative in conflitto ---------------------------- */

function testConflittiNormativi(sha: string): void {
  const conflitto = aggregaStatoRequisiti(
    contesto([requisito('r1', 'SODDISFATTO')], { conflitti: ['conflitto-1'] }),
  );
  assert(
    conflitto.stato === 'MANUAL_VERIFICATION_REQUIRED' && conflitto.regola === 'R1-conflitto',
    `R1: conflitto ⇒ MANUAL (${conflitto.stato}/${conflitto.regola})`,
  );

  // Pipeline: soglie incompatibili fra due fonti (fixture dichiaratamente fittizia).
  const soglieIncompatibili = valutaTutto(
    inputMock([
      regolaMock(sha),
      regolaMock(sha, {
        id: 'TEST-MOCK::T-11::BIS',
        vincoli: VINCOLI_MOCK.map((vincolo) =>
          vincolo.tipo === 'singoloSsd' ? { ...vincolo, min: 18 } : vincolo,
        ),
      }),
    ]),
  );
  assert(
    soglieIncompatibili.risultato.conflitti.length === 1,
    'pipeline: conflitto di soglie registrato',
  );
  assert(
    soglieIncompatibili.pipeline === 'MANUAL_VERIFICATION_REQUIRED' &&
      soglieIncompatibili.esito.regola === 'R1-conflitto',
    `pipeline: R1-conflitto (${soglieIncompatibili.pipeline}/${soglieIncompatibili.esito.regola})`,
  );
  assert(
    soglieIncompatibili.risultato.deficit.cfuMancantiTotali === null,
    'pipeline: conflitto ⇒ nessun deficit pubblicato',
  );
  console.log('  ✓ Fonti normative in conflitto → MANUAL_VERIFICATION_REQUIRED (R1-conflitto).');
}


/* ------------------- 4. Negativa accertata + dato utente non correlato ------------------- */

function testNegativaAccertata(sha: string): void {
  const esito = aggregaStatoRequisiti(
    contesto([requisito('accesso', 'NON_SODDISFATTO', 'accesso'), requisito('cfu', 'DATO_UTENTE_MANCANTE')]),
  );
  assert(
    esito.stato === 'NOT_ELIGIBLE',
    `negativa accertata: resta NOT_ELIGIBLE anche con un gap utente (${esito.stato})`,
  );

  // Pipeline: classe di laurea esclusa dalla fonte + CFU non numerici (gap utente).
  const esami = [...EXAMS_PARZIALI, { ...esameMock('bad', 'X-TEST/01', 12), cfu: Number.NaN }];
  const reale = valutaTutto(
    inputMock([{ ...regolaMock(sha), classiLaureaAmmesse: ['LM-14'] }], { esami }),
  );
  assert(reale.risultato.dati.cfuNonValidi === true, 'pipeline: dato utente non numerico rilevato');
  assert(
    reale.pipeline === 'NOT_ELIGIBLE' && reale.esito.regola === 'R4-titolo-non-soddisfatto',
    `pipeline: R4 prevale sul gap utente (${reale.pipeline}/${reale.esito.regola})`,
  );
  console.log('  ✓ Negativa accertata da fonte mai ribaltata da un dato mancante non correlato.');
}

/* --------------------------------- Invarianti R0/R1 --------------------------------- */

function testInvariantiCausa(): void {
  const vettori = [
    [requisito('r1', 'SODDISFATTO')],
    [requisito('r1', 'NON_SODDISFATTO'), requisito('r2', 'DATO_UTENTE_MANCANTE')],
    [requisito('r1', 'DATO_NORMATIVO_MANCANTE')],
  ];
  for (const vettore of vettori) {
    for (const causa of ['dato-utente', 'normativa'] as const) {
      const esito = aggregaStatoRequisiti(contesto(vettore, { causaContesto: causa }));
      if (causa === 'dato-utente') {
        assert(
          esito.stato === 'INSUFFICIENT_DATA' && esito.regola === 'R0-contesto-utente',
          `INV: causa utente ⇒ sempre INSUFFICIENT_DATA (${esito.stato})`,
        );
      } else {
        assert(
          esito.stato !== 'INSUFFICIENT_DATA',
          `INV: causa normativa ⇒ MAI INSUFFICIENT_DATA (${esito.stato})`,
        );
        assert(!verdettoPositivo(esito.stato), 'INV: causa normativa mai positiva');
      }
    }
  }
  console.log('  ✓ Invarianti: INSUFFICIENT_DATA riservato ai dati utente.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Confine R0/R1 — causa del contesto (nessun verdetto utente cambia)');
  const sha = await shaFixture();
  testCausaContesto();
  testDatiUtente(sha);
  testDatiNormativi(sha);
  testConflittiNormativi(sha);
  testNegativaAccertata(sha);
  testInvariantiCausa();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


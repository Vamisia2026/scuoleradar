/**
 * ScuoleRadar.it — Dipartimento CFU · Universal Pipeline — SEMANTICA (MOCK).
 *
 * Verifica i confini SEMANTICI della pipeline su FIXTURE DI TEST:
 * conflitti fra fonti autorevoli, Source Gate v2, conflitto di vigenza,
 * tipi di requisito futuri (mai idoneità automatica), identificazione
 * incompleta e payload per l'Assistente Creativo.
 */
import { eseguiPipelineUniversale } from '../pipeline/pipeline';
import { estendiRegistroStrategie, REGISTRO_STRATEGIE_DEFAULT } from '../pipeline/strategies';
import { verificaPayloadNonAutorevole } from '../pipeline/creativePayload';
import {
  assert,
  CONTESTO_MOCK,
  conteggioAsserzioni,
  esameMock,
  EXAMS_PARZIALI,
  inputMock,
  regolaMock,
  shaFixture,
  VINCOLI_MOCK,
} from './universalPipelineFixtures';
import type { DefinizioneRequisito, TipoRequisito } from '../pipeline/requirementTypes';
import type { EsameCanonico, NormativaTemporalContext } from '../types';

/* --------------------------- Test 1: conflitti fra fonti --------------------------- */

function testConflitti(sha: string): void {
  const regolaA = regolaMock(sha);
  const regolaB = regolaMock(sha, {
    id: 'TEST-MOCK::T-11::BIS',
    vincoli: VINCOLI_MOCK.map((vincolo) =>
      vincolo.tipo === 'singoloSsd' ? { ...vincolo, min: 18 } : vincolo,
    ),
  });
  const risultato = eseguiPipelineUniversale(inputMock([regolaA, regolaB]));

  assert(risultato.conflitti.length === 1, 'conflitto fra fonti rilevato');
  const conflitto = risultato.conflitti[0]!;
  assert(conflitto.tipo === 'soglia-incompatibile', 'conflitto: tipo soglia incompatibile');
  assert(
    conflitto.sourceIds.includes(regolaA.id) &&
      conflitto.sourceIds.includes('TEST-MOCK::T-11::BIS'),
    'conflitto: entrambe le fonti coinvolte',
  );
  assert(conflitto.risolvibileAutomaticamente === false, 'conflitto: mai risolto in autonomia');
  assert(risultato.stato === 'MANUAL_VERIFICATION_REQUIRED', 'conflitto → MANUAL_VERIFICATION_REQUIRED');
  assert(risultato.escalations.length >= 1, 'conflitto: escalation registrata');
  assert(risultato.deficit.calcolabile === false && risultato.deficit.cfuMancantiTotali === null, 'conflitto: nessun deficit pubblicato');
  assert(risultato.payloadAssistantCreativo.noteTracciabilita.some((nota) => nota.includes('Conflitto')), 'payload: conflitto tracciato per l\'assistente');
  console.log('  ✓ Conflitti: soglie incompatibili → MANUAL + fonti registrate.');
}

/* ------------------- Test 2: Source Gate v2 e conflitto di vigenza ------------------- */

function testFontiNonRisolte(sha: string): void {
  const nonVerificata = regolaMock(sha, { sourceStatus: 'UNVERIFIED' });
  const senzaFonte = eseguiPipelineUniversale(inputMock([nonVerificata]));
  assert(senzaFonte.fonti.fonti.length === 0, 'source gate: nessuna fonte attivabile');
  assert(senzaFonte.fonti.regoleEscluse.length === 1, 'source gate: regola esclusa e registrata');
  assert(
    senzaFonte.fonti.regoleEscluse[0]!.motivo.includes('UNVERIFIED'),
    "source gate: motivo dell'esclusione tracciato",
  );
  assert(senzaFonte.requisiti.length === 0, 'source gate: nessun requisito risolto');
  // Fase 5: nessuna fonte verificabile è un problema NORMATIVO (R1b), non un dato
  // utente mancante: INSUFFICIENT_DATA è riservato ai dati del candidato.
  assert(
    senzaFonte.stato === 'MANUAL_VERIFICATION_REQUIRED' &&
      senzaFonte.escalations.some((escalation) => escalation.includes('R1b-requisiti-assenti')),
    `source gate: MANUAL_VERIFICATION_REQUIRED (R1b), ottenuto ${senzaFonte.stato}`,
  );
  assert(senzaFonte.deficit.cfuMancantiTotali === null, 'source gate: nessun deficit (mai 0)');

  const contestoBis: NormativaTemporalContext = {
    ...CONTESTO_MOCK,
    id: 'ctx-T-11::TEST-MOCK-BIS',
    validFrom: '2024-01-01',
  };
  const multiplo = eseguiPipelineUniversale(
    inputMock([regolaMock(sha)], { contestiNormativi: [CONTESTO_MOCK, contestoBis] }),
  );
  assert(multiplo.conflitti.some((conflitto) => conflitto.tipo === 'contesto-temporale-multiplo'), 'più contesti in vigore → conflitto registrato');
  // Fase 5: il contesto non risolto per causa NORMATIVA (contesti multipli) è
  // MANUAL_VERIFICATION_REQUIRED → il verdetto legacy coincide (INSUFFICIENT_DATA
  // resta riservato ai dati utente mancanti).
  assert(
    multiplo.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `più contesti (causa normativa, R1) → MANUAL, ottenuto ${multiplo.stato}`,
  );
  assert(multiplo.escalations.some((escalation) => escalation.includes('Conflitto')), 'più contesti: conflitto di vigenza tracciato nelle escalation');
  assert(multiplo.statoSolutore === 'INSUFFICIENT_DATA', 'decisore legacy: contesto non risolto');
  assert(multiplo.deficit.cfuMancantiTotali === null, 'più contesti: nessun deficit inventato (mai 0)');
  console.log('  ✓ Source Gate v2 preservato + conflitto di vigenza → MANUAL.');
}


/* ------------- Test 3: tipi di requisito futuri (mai idoneità automatica) ------------- */

function testTipoSconosciuto(sha: string): void {
  const requisitoFuturo: DefinizioneRequisito = {
    // Tipo NON ancora nel vocabolario: simulazione di una classe futura.
    tipo: 'cfu.ambito.TEST' as unknown as TipoRequisito,
    id: 'futuro::v-T-ambito',
    parametri: { tipo: 'cfu.ssd.singolo', ssd: 'X-TEST/01', min: 12, max: null, nota: null },
    classeCodice: 'T-11',
    vincoloId: null,
    sourceIds: [],
    evidenze: [],
    effectiveFrom: null,
    effectiveTo: null,
    strategiaId: 'test.futuro.v1',
    // Tipo futuro: nessuna natura dichiarata (A5) ⇒ NON_VALUTABILE (R2).
    natura: null,
    integrabilita: 'NOT_SPECIFIED',
  };

  const senzaStrategia = eseguiPipelineUniversale(
    inputMock([regolaMock(sha)], { catalogoRequisiti: [requisitoFuturo] }),
  );
  const valSenzaStrategia = senzaStrategia.valutazioniRequisito.find(
    (valutazione) => valutazione.requisitoId === requisitoFuturo.id,
  )!;
  assert(valSenzaStrategia.stato === 'NON_VALUTABILE', 'tipo senza strategia → NON_VALUTABILE');
  assert(senzaStrategia.stato === 'MANUAL_VERIFICATION_REQUIRED', 'tipo non coperto dal decisore: nessuna idoneità automatica');

  const registro = estendiRegistroStrategie(REGISTRO_STRATEGIE_DEFAULT, {
    'cfu.ambito.TEST': (requisito) => ({
      stato: 'SODDISFATTO',
      valori: { cfuRichiesti: null, cfuPosseduti: null, cfuMancanti: null },
      datiUsati: [],
      provenienzaDati: [],
      spiegazione: [`Requisito ${requisito.id}: strategia di test registrata a runtime.`],
    }),
  });
  const conStrategia = eseguiPipelineUniversale(
    inputMock([regolaMock(sha)], {
      catalogoRequisiti: [requisitoFuturo],
      registroStrategie: registro,
    }),
  );
  const valConStrategia = conStrategia.valutazioniRequisito.find(
    (valutazione) => valutazione.requisitoId === requisitoFuturo.id,
  )!;
  assert(valConStrategia.stato === 'SODDISFATTO', 'estensione: strategia registrata a runtime');
  assert(conStrategia.escalations.some((escalation) => escalation.includes('cfu.ambito.TEST')), 'tipo non coperto → escalation registrata');
  assert(conStrategia.stato === 'MANUAL_VERIFICATION_REQUIRED', 'tipo non coperto: lo stato resta MANUAL');
  assert(conStrategia.deficit.cfuMancantiTotali === null, 'tipo non coperto: nessun deficit pubblicato');
  console.log('  ✓ Tipi futuri: estendibili via registro, mai idoneità automatica.');
}

/* ---------------------- Test 4: identificazione incompleta ---------------------- */

function testIdentificazioneIncompleta(sha: string): void {
  const risultato = eseguiPipelineUniversale(
    inputMock([regolaMock(sha)], {
      titolo: null,
      dateRilevanza: { enrollmentDate: '2019-10-01', awardedDate: '2022-11-18' },
    }),
  );
  assert(risultato.identificazione.datiMancanti.includes('data della procedura'), 'identificazione: data della procedura mancante elencata');
  assert(risultato.identificazione.datiMancanti.includes('titolo accademico'), 'identificazione: titolo mancante elencato');
  assert(risultato.identificazione.sistemaAccademico === 'non-dichiarato', 'identificazione: sistema accademico non dichiarato');
  assert(risultato.stato === 'INSUFFICIENT_DATA', 'identificazione incompleta → INSUFFICIENT_DATA');
  assert(risultato.deficit.calcolabile === false && risultato.deficit.cfuMancantiTotali === null, 'identificazione incompleta: deficit non calcolabile (mai 0)');
  assert(verificaPayloadNonAutorevole(risultato.payloadAssistantCreativo).length === 0, 'payload: confine assistente rispettato anche senza idoneità');
  console.log('  ✓ Stage 1: identificazione incompleta elencata, nessuna idoneità dedotta.');
}

/* --------------------- Test 5: CFU non validi (dato utente, mai idoneità automatica) --------------------- */

function testDatiNonValidiOstaLIdoneita(sha: string): void {
  const esami: EsameCanonico[] = [
    ...EXAMS_PARZIALI,
    { ...esameMock('bad', 'X-TEST/01', 12), cfu: Number.NaN },
  ];
  const risultato = eseguiPipelineUniversale(inputMock([regolaMock(sha)], { esami }));
  assert(risultato.dati.cfuNonValidi === true, 'dati: CFU non validi rilevati');
  // A1 (fase 4): il dato non numerico è AZIONABILE dal candidato → dati
  // insufficienti, con la regola di precedenza esplicitata nell'escalation.
  assert(
    risultato.stato === 'INSUFFICIENT_DATA',
    `dati inaffidabili: atteso INSUFFICIENT_DATA, ottenuto ${risultato.stato}`,
  );
  assert(risultato.escalations.some((escalation) => escalation.includes('R7-dato-utente-mancante')), 'dati inaffidabili → escalation con la regola R7 applicata');
  assert(risultato.deficit.cfuMancantiTotali === null, 'dati inaffidabili: nessun deficit pubblicato (mai 0)');
  console.log('  ✓ Dati non affidabili: dato utente azionabile, deficit non pubblicato.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Universal Pipeline — semantica su FIXTURE DI TEST (nessuna norma reale)');
  const sha = await shaFixture();
  testConflitti(sha);
  testFontiNonRisolte(sha);
  testTipoSconosciuto(sha);
  testIdentificazioneIncompleta(sha);
  testDatiNonValidiOstaLIdoneita(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

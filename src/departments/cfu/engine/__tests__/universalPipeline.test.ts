/**
 * ScuoleRadar.it — Dipartimento CFU · Universal Requirement Pipeline (MOCK).
 *
 * Verifica gli stadi 1-7 della pipeline su FIXTURE DI TEST (fixtures.ts):
 * identificazione, fonti con Source Gate, normalizzazione, requisiti
 * strutturati + round-trip, esiti auditabili, stati semantici e deficit.
 * Conflitti, tipi futuri e casi limite sono in `universalPipelineSemantica`.
 */
import { eseguiPipelineUniversale } from '../pipeline/pipeline';
import { normalizzaDatiAccademici } from '../pipeline/normalization';
import { vincoloDaRequisito } from '../pipeline/conversions';
import { verificaPayloadNonAutorevole } from '../pipeline/creativePayload';
import {
  assert,
  canonico,
  conteggioAsserzioni,
  EXAMS_PARZIALI,
  EXCERPT_SINGOLO,
  inputMock,
  regolaMock,
  senzaId,
  shaFixture,
  TITOLO_MOCK,
  VINCOLI_MOCK,
} from './universalPipelineFixtures';
import type { EsameCanonico } from '../types';

/* --------------------------- Test 1: stadi 1→8 (ELIGIBLE) --------------------------- */

function testEligibile(sha: string): void {
  const regola = regolaMock(sha);
  const risultato = eseguiPipelineUniversale(inputMock([regola]));

  assert(risultato.identificazione.classeCodice === 'T-11', 'identificazione: classe obiettivo');
  assert(
    risultato.identificazione.sistemaAccademico === 'italiano',
    'identificazione: sistema accademico',
  );
  assert(
    risultato.identificazione.dateRilevanza.procedureDate === '2024-03-15',
    'identificazione: date conservate',
  );
  assert(
    risultato.identificazione.datiMancanti.length === 0,
    'identificazione: nessun dato mancante',
  );

  assert(risultato.fonti.fonti.length === 1, 'fonti: 1 fonte applicabile verificata');
  assert(risultato.fonti.fonti[0]!.sourceId === regola.id, 'fonti: identità della fonte');
  assert(risultato.fonti.fonti[0]!.verificata === true, 'fonti: Source Gate v2 superato');
  assert(
    risultato.fonti.fonti[0]!.effectiveFrom === '2024-02-10',
    'fonti: vigenza dichiarata dal contesto',
  );

  assert(
    risultato.requisiti.length === VINCOLI_MOCK.length + 1,
    'requisiti: 4 vincoli + requisito di accesso',
  );
  const requisitoSingolo = risultato.requisiti.find((r) => r.vincoloId === 'v-T-singolo')!;
  assert(Boolean(requisitoSingolo), 'requisito singolo presente');
  assert(requisitoSingolo.tipo === 'cfu.ssd.singolo', 'requisito: tipo strutturato');
  assert(requisitoSingolo.sourceIds[0] === regola.id, 'requisito: fonte tracciata');
  assert(
    requisitoSingolo.evidenze[0]!.estrattoVerbatim === EXCERPT_SINGOLO,
    'requisito: evidenza verbatim',
  );
  assert(requisitoSingolo.strategiaId.length > 0, 'requisito: strategia risolta');
  assert(requisitoSingolo.effectiveFrom === '2024-02-10', 'requisito: vigenza dichiarata');
  const accesso = risultato.requisiti.find((r) => r.tipo === 'titolo.accesso.classe')!;
  assert(Boolean(accesso) && accesso.sourceIds.length === 1, 'requisito accesso classe tracciato');

  for (const vincolo of VINCOLI_MOCK) {
    const requisito = risultato.requisiti.find((r) => r.vincoloId === vincolo.id)!;
    const ricostruito = vincoloDaRequisito(requisito);
    assert(Boolean(ricostruito), `round-trip: vincolo ricostruito (${vincolo.id})`);
    assert(
      canonico(senzaId(ricostruito!)) === canonico(senzaId(vincolo)),
      `round-trip esatto requisito ↔ vincolo per ${vincolo.id}`,
    );
  }

  assert(
    risultato.valutazioniRequisito.length === risultato.requisiti.length,
    'valutazioni: una per requisito',
  );
  assert(
    risultato.valutazioniRequisito.every((valutazione) => valutazione.stato === 'SODDISFATTO'),
    'valutazioni: tutti i requisiti soddisfatti',
  );
  const valSingolo = risultato.valutazioniRequisito.find(
    (valutazione) => valutazione.requisitoId === requisitoSingolo.id,
  )!;
  assert(valSingolo.valori.cfuPosseduti === 12, 'esito: CFU posseduti calcolati');
  assert(valSingolo.valori.cfuRichiesti === 12, 'esito: CFU richiesti dalla fonte');
  assert(valSingolo.datiUsati.includes('x1'), 'esito: dati utente usati tracciati');
  assert(valSingolo.spiegazione.length >= 2, 'esito: percorso logico esplicito');
  assert(valSingolo.fonti.length === 1 && valSingolo.evidenze.length === 1, 'esito: fonti+evidenze');

  assert(risultato.stato === 'ELIGIBLE', `stato finale ELIGIBLE, ottenuto ${risultato.stato}`);
  assert(risultato.stato === risultato.statoSolutore, 'caso positivo: nessuna escalation');
  assert(risultato.escalations.length === 0, 'caso positivo: nessuna escalation registrata');
  assert(
    risultato.deficit.calcolabile === true && risultato.deficit.cfuMancantiTotali === 0,
    'deficit: 0 CFU calcolabile',
  );
  assert(
    verificaPayloadNonAutorevole(risultato.payloadAssistantCreativo).length === 0,
    'payload: non autorevole, nessuna violazione del confine',
  );
  assert(
    risultato.payloadAssistantCreativo.stato === risultato.stato,
    'payload: stato identico a quello del motore',
  );
  console.log('  ✓ Stadi 1-8: ELIGIBLE, requisiti strutturati, round-trip, audit completo.');
}


/* --------------------------- Test 2: normalizzazione --------------------------- */

function testNormalizzazione(): void {
  const gsd: EsameCanonico = {
    id: 'n1',
    denominazione: 'Esame GSD (TEST)',
    cfu: 9,
    gsd: 'MATH-01/A',
    fonte: 'manuale',
    provenienza: [],
  };
  const cfuIgnoti: EsameCanonico = {
    id: 'n2',
    denominazione: 'Esame senza CFU (TEST)',
    cfu: Number.NaN,
    ssd: 'X-TEST/01',
    fonte: 'manuale',
    provenienza: [],
  };
  const dati = normalizzaDatiAccademici({ esami: [gsd, cfuIgnoti], titolo: TITOLO_MOCK });

  assert(dati.mappature.length === 2, 'normalizzazione: mappatura per ogni esame');
  const mappaturaGsd = dati.mappature.find((m) => m.esameId === 'n1')!;
  assert(
    mappaturaGsd.tipoCodice === 'gsd' && mappaturaGsd.gsd === 'MATH-01/A',
    'normalizzazione: GSD classificato come GSD',
  );
  assert(
    dati.esami[0]!.gsd === 'MATH-01/A' && dati.esami[0]!.ssd === null,
    'normalizzazione: GSD conservato (nessuna conversione in SSD)',
  );
  const mappaturaIgnota = dati.mappature.find((m) => m.esameId === 'n2')!;
  assert(mappaturaIgnota.cfuNormalizzato === null, 'normalizzazione: CFU non valido → null (mai 0)');
  assert(
    Number.isNaN(mappaturaIgnota.cfuGrezzo),
    'normalizzazione: dato grezzo immutato (NaN conservato)',
  );
  assert(dati.cfuNonValidi === true, 'normalizzazione: flag CFU non validi');
  assert(dati.cfuTotali === 9, 'normalizzazione: totale dai soli CFU validi');
  assert(dati.anomalie.length === 1, 'normalizzazione: anomalia registrata per il controllo umano');
  console.log('  ✓ Stage 3: SSD/GSD, CFU non validi (mai 0), dati grezzi immutati.');
}

/* --------------------------- Test 3: deficit e stati (6-7) --------------------------- */

function testStatiDeficit(sha: string): void {
  const manual = eseguiPipelineUniversale(
    inputMock([regolaMock(sha, { integrabilita: 'NOT_SPECIFIED' })], { esami: EXAMS_PARZIALI }),
  );
  assert(manual.stato === 'MANUAL_VERIFICATION_REQUIRED', 'NOT_SPECIFIED → MANUAL');
  assert(manual.stato === manual.statoSolutore, 'NOT_SPECIFIED: stato del decisore preservato');
  assert(manual.deficit.calcolabile === false, 'NOT_SPECIFIED: deficit non calcolabile');
  assert(manual.deficit.cfuMancantiTotali === null, 'NOT_SPECIFIED: MAI 0 CFU mancanti');
  const valSingolo = manual.valutazioniRequisito.find((v) =>
    v.requisitoId.endsWith('v-T-singolo'),
  )!;
  assert(
    valSingolo.stato === 'NON_SODDISFATTO' && valSingolo.valori.cfuMancanti === 12,
    'NOT_SPECIFIED: il deficit per requisito resta evidenza (12 CFU)',
  );

  const condizionale = eseguiPipelineUniversale(
    inputMock([regolaMock(sha)], { esami: EXAMS_PARZIALI }),
  );
  assert(
    condizionale.stato === 'CONDITIONALLY_ELIGIBLE',
    'ALLOWED + deficit → CONDITIONALLY_ELIGIBLE',
  );
  assert(
    condizionale.deficit.calcolabile === true && condizionale.deficit.cfuMancantiTotali === 12,
    'CONDITIONALLY: deficit pubblicato = 12 CFU',
  );
  assert(condizionale.deficit.perRequisito.length === 1, 'CONDITIONALLY: voce di deficit per gruppo');
  assert(condizionale.deficit.causaDeterminante === 'cfu', 'CONDITIONALLY: causa determinante CFU');

  const nonIdoneo = eseguiPipelineUniversale(
    inputMock([regolaMock(sha, { integrabilita: 'PROHIBITED' })], { esami: EXAMS_PARZIALI }),
  );
  assert(nonIdoneo.stato === 'NOT_ELIGIBLE', 'PROHIBITED → NOT_ELIGIBLE');
  assert(nonIdoneo.deficit.cfuMancantiTotali === 12, 'NOT_ELIGIBLE: deficit esatto pubblicato');

  const vincoliConTitolo = VINCOLI_MOCK.map((vincolo) =>
    vincolo.tipo === 'titoloAbilitante' ? { ...vincolo, necessario: true } : vincolo,
  );
  const titolo = eseguiPipelineUniversale(
    inputMock([regolaMock(sha, { vincoli: vincoliConTitolo })]),
  );
  assert(titolo.stato === 'NOT_ELIGIBLE', 'titolo necessario assente → NOT_ELIGIBLE');
  assert(
    titolo.deficit.causaDeterminante === 'titolo' && titolo.deficit.cfuMancantiTotali === 0,
    'NOT_ELIGIBLE: causa titolo, nessun deficit di CFU',
  );
  const valTitolo = titolo.valutazioniRequisito.find((v) => v.tipo === 'titolo.abilitante')!;
  assert(
    valTitolo.stato === 'NON_SODDISFATTO' && valTitolo.valori.cfuMancanti === null,
    'titolo: nessun deficit CFU inventato',
  );
  console.log('  ✓ Stage 6-7: MANUAL (deficit nullo), CONDITIONALLY, NOT_ELIGIBLE (CFU/titolo).');
}


/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Universal Requirement Pipeline — stadi 1-8 su FIXTURE DI TEST (nessuna norma reale)');
  const sha = await shaFixture();
  assert(sha.length === 64, 'SHA-256 della fixture calcolato (integrità sorgente)');
  testNormalizzazione();
  testEligibile(sha);
  testStatiDeficit(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

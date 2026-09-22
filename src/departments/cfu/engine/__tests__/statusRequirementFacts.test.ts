/**
 * ScuoleRadar.it — Dipartimento CFU · FATTI DI REQUISITO (A5) + RAMI OR (A3) — fase 5.
 *
 * Verifica che l'aggregazione legga SOLO fatti del requisito:
 *  - `natura` (dichiarata alla risoluzione dal tipo);
 *  - `integrabilita` (dichiarata dalla fonte per quel requisito);
 *  - `rami` della disgiunzione (valutati dalla strategia, mai ricostruiti a valle).
 * Un tipo senza natura dichiarata è NON_VALUTABILE (R2); uno stato rischioso del
 * requisito prevale sempre sui rami.
 *
 * ⚠️ Confine di autorità: il verdetto per UI/report resta `valutaRequisitoClasse`.
 */
import { aggregaStatoRequisiti, costruisciContestoAggregazione } from '../pipeline/status';
import {
  assert,
  conIntegrabilita,
  conteggioAsserzioni,
  contesto,
  requisito,
  requisitoConRami,
  valutaTutto,
} from './statusSpecFixtures';
import {
  EXAMS_PARZIALI,
  inputMock,
  regolaMock,
  shaFixture,
} from './universalPipelineFixtures';
import type { DefinizioneRequisito, EsitoValutazioneRequisito } from '../pipeline/requirementTypes';

/** Valutazione sintetica di un requisito (solo i campi letti dall'aggregazione). */
function valutazione(requisitoId: string, stato: EsitoValutazioneRequisito['stato']): EsitoValutazioneRequisito {
  return {
    requisitoId,
    tipo: 'cfu.ssd.singolo',
    stato,
    fonti: [],
    evidenze: [],
    valori: { cfuRichiesti: null, cfuPosseduti: null, cfuMancanti: null },
    datiUsati: [],
    provenienzaDati: [],
    spiegazione: ['valutazione sintetica di test'],
  };
}

/** Requisito sintetico con natura dichiarata (o non dichiarata) e integrabilità. */
function requisitoStrutturato(
  id: string,
  natura: DefinizioneRequisito['natura'],
  integrabilita: DefinizioneRequisito['integrabilita'],
): DefinizioneRequisito {
  return {
    id,
    tipo: 'cfu.ssd.singolo',
    parametri: { tipo: 'cfu.ssd.singolo', ssd: 'X-TEST/01', min: 12, max: null, nota: null },
    classeCodice: 'T-11',
    vincoloId: null,
    sourceIds: [],
    evidenze: [],
    effectiveFrom: null,
    effectiveTo: null,
    strategiaId: 'cfu.ssd.v1',
    natura,
    integrabilita,
  };
}

/* ----------------------- 1. Fatti di requisito dalla risoluzione ----------------------- */

function testFattiDiRequisito(sha: string): void {
  const risultato = valutaTutto(inputMock([regolaMock(sha)])).risultato;
  const cfu = risultato.requisiti.filter((r) => r.tipo.startsWith('cfu.ssd.'));
  assert(cfu.length > 0, 'requisiti CFU presenti');
  assert(cfu.every((r) => r.natura === 'cfu'), 'natura CFU dichiarata alla risoluzione');
  assert(cfu.every((r) => r.integrabilita === 'ALLOWED'), 'integrabilità presa DALLA FONTE e dichiarata sul requisito (ALLOWED)');
  const titolo = risultato.requisiti.find((r) => r.tipo === 'titolo.abilitante')!;
  assert(titolo.natura === 'titolo', 'natura del requisito di titolo');
  assert(titolo.integrabilita === 'NOT_SPECIFIED', 'l’integrabilità riguarda i CFU: su un titolo resta non dichiarata');
  const accesso = risultato.requisiti.find((r) => r.tipo === 'titolo.accesso.classe')!;
  assert(accesso.natura === 'accesso', 'natura del requisito di accesso');

  // La dichiarazione della fonte cambia il fatto di requisito (e quindi la regola).
  const senzaIntegrazione = valutaTutto(
    inputMock([regolaMock(sha, { integrabilita: 'NOT_SPECIFIED' })], { esami: EXAMS_PARZIALI }),
  );
  assert(
    senzaIntegrazione.risultato.requisiti
      .filter((r) => r.natura === 'cfu')
      .every((r) => r.integrabilita === 'NOT_SPECIFIED'),
    'fonte senza clausola di integrazione ⇒ requisito NOT_SPECIFIED',
  );
  assert(
    senzaIntegrazione.pipeline === 'MANUAL_VERIFICATION_REQUIRED' &&
      senzaIntegrazione.esito.regola === 'R9-integrabilita-non-dichiarata',
    `deficit non dichiarato ⇒ R9 (${senzaIntegrazione.pipeline})`,
  );
  const vietato = valutaTutto(
    inputMock([regolaMock(sha, { integrabilita: 'PROHIBITED' })], { esami: EXAMS_PARZIALI }),
  );
  assert(
    vietato.pipeline === 'NOT_ELIGIBLE' && vietato.esito.regola === 'R5-integrazione-vietata',
    `deficit con integrazione vietata ⇒ R5 (${vietato.pipeline})`,
  );
  console.log('  ✓ A5: natura e integrabilità sono fatti del requisito (dalla risoluzione).');
}

/* --------------------- 2. Il contesto non ha più scorciatoie di fonte --------------------- */

function testContestoDiSoliFattiDiRequisito(): void {
  // Il contratto del contesto non contiene più alcuna informazione di FONTE:
  // niente insieme globale di integrabilità, niente bandiera "normativa risolta".
  const chiavi = Object.keys(contesto([])).sort();
  assert(
    chiavi.join(',') === 'causaContesto,conflitti,regoleApplicabili,requisiti',
    `contratto di contesto senza scorciatoie di fonte (${chiavi.join(',')})`,
  );

  // Dichiarazioni DIVERSE per requisito: ogni deficit è giudicato sul PROPRIO fatto.
  const misto = aggregaStatoRequisiti(
    contesto([
      requisito('vietato', 'NON_SODDISFATTO', 'cfu', 'PROHIBITED'),
      requisito('ammesso', 'NON_SODDISFATTO', 'cfu', 'ALLOWED'),
    ]),
  );
  assert(
    misto.stato === 'NOT_ELIGIBLE' && misto.regola === 'R5-integrazione-vietata',
    `deficit vietato prevale sul deficit ammesso (${misto.stato}/${misto.regola})`,
  );
  const soloAmmesso = aggregaStatoRequisiti(contesto([requisito('ammesso', 'NON_SODDISFATTO', 'cfu', 'ALLOWED')]));
  assert(
    soloAmmesso.stato === 'CONDITIONALLY_ELIGIBLE' && soloAmmesso.regola === 'R8-integrazione-ammessa',
    `deficit ammesso ⇒ CONDITIONALLY (${soloAmmesso.stato})`,
  );
  const nonDichiarato = aggregaStatoRequisiti(contesto([requisito('dubbio', 'NON_SODDISFATTO')]));
  assert(
    nonDichiarato.stato === 'MANUAL_VERIFICATION_REQUIRED' &&
      nonDichiarato.regola === 'R9-integrabilita-non-dichiarata',
    `deficit non dichiarato ⇒ MANUAL (${nonDichiarato.stato})`,
  );
  const ammessiSuTitolo = aggregaStatoRequisiti(
    contesto(conIntegrabilita([requisito('titolo', 'NON_SODDISFATTO', 'titolo')], 'ALLOWED')),
  );
  assert(ammessiSuTitolo.stato === 'NOT_ELIGIBLE', 'l’integrabilità non si applica ai titoli: resta NOT_ELIGIBLE (R4)');
  console.log('  ✓ Contesto composto di soli fatti di requisito + causa di contesto.');
}

/* ------------------------- 3. Natura non dichiarata ⇒ NON_VALUTABILE ------------------------- */

function testNaturaNonDichiarata(sha: string): void {
  const costruito = costruisciContestoAggregazione({
    requisiti: [requisitoStrutturato('senza-natura', null, 'ALLOWED')],
    valutazioni: [valutazione('senza-natura', 'SODDISFATTO')],
    conflitti: [],
    regoleApplicabili: [regolaMock(sha)],
    causaContesto: 'risolta',
  });
  assert(costruito.requisiti[0]!.stato === 'NON_VALUTABILE', 'tipo senza natura dichiarata ⇒ NON_VALUTABILE (nessun verdetto automatico)');
  const esito = aggregaStatoRequisiti(costruito);
  assert(
    esito.stato === 'MANUAL_VERIFICATION_REQUIRED' && esito.regola === 'R2-tipo-non-gestito',
    `natura non dichiarata ⇒ R2 (${esito.stato}/${esito.regola})`,
  );
  console.log('  ✓ Tipo senza natura dichiarata: mai un verdetto positivo (R2).');
}

/* --------------------------------- 4. Rami OR (A3) --------------------------------- */

function testRamiDisgiunzione(sha: string): void {
  const confronto = valutaTutto(inputMock([regolaMock(sha)]));
  const disgiunzione = confronto.risultato.valutazioniRequisito.find((v) =>
    v.requisitoId.includes('disgiunzione'),
  )!;
  assert(Boolean(disgiunzione.rami) && disgiunzione.rami!.length === 2, 'rami della disgiunzione valutati dalla strategia');
  assert(disgiunzione.rami!.every((ramo) => ramo.id.startsWith('opt-')), 'i rami conservano gli id delle opzioni dichiarate dalla fonte');
  assert(disgiunzione.rami!.filter((ramo) => ramo.stato === 'SODDISFATTO').length === 1, 'un solo ramo raggiunge il proprio minimo (crediti non sommati fra opzioni)');
  assert(disgiunzione.stato === 'SODDISFATTO', 'il requisito è SODDISFATTO dal ramo conclusivo (stessa regola di A3)');
  const nonDisgiuntivo = confronto.risultato.valutazioniRequisito.find((v) =>
    v.requisitoId.includes('v-T-singolo'),
  )!;
  assert(nonDisgiuntivo.rami === undefined, 'nessun ramo per i requisiti non disgiuntivi');

  // L'aggregazione riceve i rami DAL risultato del requisito (nessuna ricostruzione).
  const costruito = costruisciContestoAggregazione({
    requisiti: confronto.risultato.requisiti,
    valutazioni: confronto.risultato.valutazioniRequisito,
    conflitti: [],
    regoleApplicabili: [regolaMock(sha)],
    causaContesto: 'risolta',
  });
  const requisitoDisgiuntivo = costruito.requisiti.find((r) => r.id.includes('disgiunzione'))!;
  assert(
    requisitoDisgiuntivo.opzioni?.length === 2 &&
      requisitoDisgiuntivo.opzioni.some((opzione) => opzione.stato === 'SODDISFATTO'),
    'l’aggregazione collassa i rami presi dall’esito del requisito',
  );

  // Guardia: uno stato rischioso del requisito prevale sui rami.
  const rischioso = aggregaStatoRequisiti(
    contesto([requisitoConRami('r1', ['SODDISFATTO', 'SODDISFATTO'], 'cfu', 'NOT_SPECIFIED')], {
      causaContesto: 'risolta',
    }),
  );
  assert(rischioso.stato === 'ELIGIBLE', 'rami tutti conclusivi ⇒ requisito soddisfatto');
  const conGap = aggregaStatoRequisiti(
    contesto([
      { ...requisitoConRami('r1', ['SODDISFATTO']), stato: 'DATO_UTENTE_MANCANTE' },
    ]),
  );
  assert(
    conGap.stato === 'INSUFFICIENT_DATA',
    `un requisito irrisolto non è "salvato" dai rami (${conGap.stato})`,
  );
  console.log('  ✓ Rami OR presi dall’esito del requisito: A3 invariata.');
}


/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Fatti di requisito (A5) e rami OR (A3) — nessun verdetto utente cambia');
  const sha = await shaFixture();
  testFattiDiRequisito(sha);
  testContestoDiSoliFattiDiRequisito();
  testNaturaNonDichiarata(sha);
  testRamiDisgiunzione(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


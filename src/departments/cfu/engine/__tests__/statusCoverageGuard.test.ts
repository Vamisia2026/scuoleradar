/**
 * ScuoleRadar.it — Dipartimento CFU · COPERTURA DEI TIPI di requisito (guardia).
 *
 * Verifica il comportamento quando il catalogo contiene un requisito di un tipo
 * NON ancora nel vocabolario (`DefinizioneRequisito.tipo` fuori tassonomia):
 *  - la pipeline lo valuta (se esiste una strategia) o lo dichiara NON_VALUTABILE;
 *  - l'aggregazione di stato richiede che il tipo dichiari la propria NATURA:
 *    senza dichiarazione il requisito è `NON_VALUTABILE` (R2) e NESSUN tipo nuovo
 *    può entrare in un verdetto positivo;
 *  - il decisore legacy NON conosce il tipo e lo ignora (divergenza intenzionale,
 *    contratto completo in `statusAuthorityDivergences.test.ts`).
 *
 * ⚠️ Verifica di sicurezza: nessun verdetto utente viene modificato qui.
 */
import { naturaDaTipo } from '../pipeline/conversions';
import { REGISTRO_STRATEGIE_DEFAULT, estendiRegistroStrategie, TIPI_GESTITI_DALL_AGGREGATORE } from '../pipeline/strategies';
import type { DefinizioneRequisito, TipoRequisito } from '../pipeline/requirementTypes';
import { assert, conteggioAsserzioni, valutaTutto } from './statusSpecFixtures';
import { inputMock, regolaMock, shaFixture } from './universalPipelineFixtures';

/** Strategia di test per un tipo futuro (registrata a runtime). */
const STRATEGIA_FUTURA = () => ({
  stato: 'SODDISFATTO' as const,
  valori: { cfuRichiesti: null, cfuPosseduti: null, cfuMancanti: null },
  datiUsati: [],
  provenienzaDati: [],
  spiegazione: ['strategia di test registrata a runtime'],
});

/** Requisito di un tipo NON ancora nel vocabolario (classe futura). */
const REQUISITO_FUTURO: DefinizioneRequisito = {
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
  // Tipo futuro: nessuna natura dichiarata (A5) ⇒ NON_VALUTABILE nell'aggregazione.
  natura: null,
  integrabilita: 'NOT_SPECIFIED',
};

function testCopertura(sha: string): void {
  // Natura dichiarata: nessun tipo coperto può restare senza dichiarazione.
  assert(naturaDaTipo('cfu.ambito.TEST') === null, 'tipo futuro: nessuna natura dichiarata');
  assert(naturaDaTipo('cfu.ssd.singolo') === 'cfu', 'tipo CFU: natura dichiarata');
  assert(naturaDaTipo('titolo.abilitante') === 'titolo', 'titolo: natura dichiarata');
  assert(naturaDaTipo('titolo.accesso.classe') === 'accesso', 'accesso: natura dichiarata');
  for (const tipo of TIPI_GESTITI_DALL_AGGREGATORE) {
    assert(naturaDaTipo(tipo) !== null, `tipo coperto dal decisore legacy con natura dichiarata: ${tipo}`);
  }

  // Caso A — nessuna strategia registrata: il requisito è NON_VALUTABILE.
  const senzaStrategia = valutaTutto(
    inputMock([regolaMock(sha)], { catalogoRequisiti: [REQUISITO_FUTURO] }),
  );
  assert(
    senzaStrategia.risultato.valutazioniRequisito.some(
      (valutazione) => valutazione.requisitoId === REQUISITO_FUTURO.id && valutazione.stato === 'NON_VALUTABILE',
    ),
    'tipo futuro senza strategia: esito NON_VALUTABILE',
  );
  assert(
    senzaStrategia.autorita === 'ELIGIBLE',
    'legacy: il tipo non coperto NON entra nel verdetto (autorità ELIGIBLE)',
  );
  assert(
    senzaStrategia.pipeline === 'MANUAL_VERIFICATION_REQUIRED' &&
      senzaStrategia.esito.regola === 'R2-tipo-non-gestito',
    'pipeline: verifica manuale richiesta (R2)',
  );

  // Caso B — strategia registrata a runtime: il requisito è valutato ma il tipo
  // non dichiara la sua natura di aggregazione ⇒ mai un verdetto positivo.
  const conStrategia = valutaTutto(
    inputMock([regolaMock(sha)], {
      catalogoRequisiti: [REQUISITO_FUTURO],
      registroStrategie: estendiRegistroStrategie(REGISTRO_STRATEGIE_DEFAULT, {
        'cfu.ambito.TEST': STRATEGIA_FUTURA,
      }),
    }),
  );
  assert(
    conStrategia.risultato.valutazioniRequisito.some(
      (valutazione) => valutazione.requisitoId === REQUISITO_FUTURO.id && valutazione.stato === 'SODDISFATTO',
    ),
    'tipo futuro con strategia: requisito valutato (SODDISFATTO)',
  );
  assert(
    conStrategia.esito.regola === 'R2-tipo-non-gestito' && conStrategia.pipeline === 'MANUAL_VERIFICATION_REQUIRED',
    'pipeline: natura non dichiarata ⇒ nessun verdetto positivo',
  );
  assert(
    conStrategia.autorita === 'ELIGIBLE' && conStrategia.pipeline !== conStrategia.autorita,
    'divergenza documentata: legacy ignora il tipo, la pipeline richiede verifica manuale',
  );
  console.log('  ✓ Guardia di copertura: un tipo senza natura dichiarata non può diventare positivo.');
  console.log('  ✓ Divergenza documentata: legacy ELIGIBLE vs pipeline MANUAL (R2).');
}

async function main(): Promise<void> {
  console.log('Copertura dei tipi di requisito — aggregazione di stato della pipeline');
  const sha = await shaFixture();
  testCopertura(sha);
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

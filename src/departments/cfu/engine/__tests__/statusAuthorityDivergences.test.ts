/**
 * ScuoleRadar.it — Dipartimento CFU · DIVERGENZE INTENZIONALI autorità ↔ pipeline.
 *
 * Contratto di divergenza (fase 4). Le due viste sono:
 *  1. AUTORITÀ = `valutaRequisitoClasse` (verdetto usato da bridge, routing, report, UI);
 *  2. PIPELINE = `RisultatoPipeline.stato` (aggregazione R0-R10, autorità INTERNA).
 * Per ogni divergenza sono dichiarati: stato legacy, stato della pipeline, REGOLA
 * applicata (R0-R10) e MOTIVO. Le divergenze sono INTENZIONALI (il verdetto legacy
 * non è conservativo: conflitto risolto in silenzio, tipo non coperto ignorato,
 * dato utente non numerico); nessun consumatore legacy è commutato.
 * Chiude verificando che sui casi REALI del Core Set (A-11, A-12, A-22 · LM-14) le
 * due viste COINCIDONO: nessuna divergenza sui dati reali.
 */
import { verdettoPositivo } from '../pipeline/status';
import { estendiRegistroStrategie, REGISTRO_STRATEGIE_DEFAULT } from '../pipeline/strategies';
import { valutaClasseViaEngineBridge } from '../bridge/legacyAdapter';
import { assert, conteggioAsserzioni, valutaTutto, type ConfrontoTreVie } from './statusSpecFixtures';
import {
  esameMock,
  EXAMS_PARZIALI,
  inputMock,
  regolaMock,
  shaFixture,
  VINCOLI_MOCK,
} from './universalPipelineFixtures';
import {
  ESAMI_DEFICIT,
  ESAMI_ELIGIBILE,
  parametriBridge,
  preparaCatalogoCoreSet,
} from './bridgeParityFixtures';
import type { Esame } from '../../shared/types';
import type { DefinizioneRequisito, TipoRequisito } from '../pipeline/requirementTypes';
import type { EsameCanonico, EsitoValutazione } from '../types';

/* --------------- Requisito di un tipo NON ancora nel vocabolario (classe futura) --------------- */

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

const STRATEGIA_FUTURA = () => ({
  stato: 'SODDISFATTO' as const,
  valori: { cfuRichiesti: null, cfuPosseduti: null, cfuMancanti: null },
  datiUsati: [],
  provenienzaDati: [],
  spiegazione: ['strategia di test registrata a runtime'],
});

/* --------------------------- Caso con ACCORDO fra le due viste --------------------------- */

function testAccordi(sha: string): void {
  const casi: { etichetta: string; confronto: ConfrontoTreVie; atteso: EsitoValutazione }[] = [
    {
      etichetta: 'integrazione dichiarata (ALLOWED) + deficit',
      confronto: valutaTutto(inputMock([regolaMock(sha)], { esami: EXAMS_PARZIALI })),
      atteso: 'CONDITIONALLY_ELIGIBLE',
    },
    {
      etichetta: 'integrabilità non dichiarata (NOT_SPECIFIED) + deficit',
      confronto: valutaTutto(
        inputMock([regolaMock(sha, { integrabilita: 'NOT_SPECIFIED' })], { esami: EXAMS_PARZIALI }),
      ),
      atteso: 'MANUAL_VERIFICATION_REQUIRED',
    },
    {
      etichetta: 'integrazione vietata (PROHIBITED) + deficit',
      confronto: valutaTutto(
        inputMock([regolaMock(sha, { integrabilita: 'PROHIBITED' })], { esami: EXAMS_PARZIALI }),
      ),
      atteso: 'NOT_ELIGIBLE',
    },
  ];

  for (const caso of casi) {
    assert(caso.confronto.autorita === caso.atteso, `${caso.etichetta}: autorità = ${caso.atteso}`);
    assert(
      caso.confronto.pipeline === caso.confronto.autorita,
      `${caso.etichetta}: pipeline e autorità concordano (${caso.confronto.pipeline})`,
    );
    assert(
      caso.confronto.esito.stato === caso.confronto.pipeline,
      `${caso.etichetta}: ` + 'lo stato della pipeline è prodotto dall’aggregazione di produzione',
    );
    assert(
      caso.confronto.risultato.escalations.length === 0,
      `${caso.etichetta}: nessuna escalation (le viste coincidono)`,
    );
  }
  console.log('  ✓ 3 casi di accordo (ALLOWED / NOT_SPECIFIED / PROHIBITED): le due viste coincidono.');
}

/* --------------------- Divergenze INTENZIONALI (legacy non conservativo) --------------------- */

interface CasoDivergenza {
  readonly etichetta: string;
  readonly confronto: ConfrontoTreVie;
  /** Verdetto del decisore aggregato legacy (autorità per i consumatori). */
  readonly attesoAutorita: EsitoValutazione;
  /** Stato aggregato dalla pipeline (autorità interna). */
  readonly attesoPipeline: EsitoValutazione;
  /** Regola di precedenza R0-R10 applicata dalla pipeline. */
  readonly regolaAttesa: string;
  /** Perché le due viste divergono (motivo dichiarato, non un incidente). */
  readonly motivo: string;
}

function testDivergenze(sha: string): void {
  const regolaConSogliaDiversa = regolaMock(sha, {
    id: 'TEST-MOCK::T-11::BIS',
    vincoli: VINCOLI_MOCK.map((vincolo) =>
      vincolo.tipo === 'singoloSsd' ? { ...vincolo, min: 18 } : vincolo,
    ),
  });
  const esamiAnomali: EsameCanonico[] = [
    ...EXAMS_PARZIALI,
    { ...esameMock('bad', 'X-TEST/01', 12), cfu: Number.NaN },
  ];
  const registroEsteso = estendiRegistroStrategie(REGISTRO_STRATEGIE_DEFAULT, {
    'cfu.ambito.TEST': STRATEGIA_FUTURA,
  });

  const divergenze: CasoDivergenza[] = [
    {
      etichetta: '(1) conflitto fra fonti con soglie incompatibili',
      confronto: valutaTutto(inputMock([regolaMock(sha), regolaConSogliaDiversa])),
      attesoAutorita: 'ELIGIBLE', attesoPipeline: 'MANUAL_VERIFICATION_REQUIRED',
      regolaAttesa: 'R1-conflitto',
      motivo:
        'il decisore legacy unisce i vincoli per id con first-wins silenzioso e ignora il conflitto',
    },
    {
      etichetta: '(2) tipo di requisito non supportato (nessuna strategia)',
      confronto: valutaTutto(inputMock([regolaMock(sha)], { catalogoRequisiti: [REQUISITO_FUTURO] })),
      attesoAutorita: 'ELIGIBLE', attesoPipeline: 'MANUAL_VERIFICATION_REQUIRED',
      regolaAttesa: 'R2-tipo-non-gestito',
      motivo: 'il decisore legacy non conosce il tipo e lo ignora; la pipeline non può giudicarlo',
    },
    {
      etichetta: '(3) tipo non supportato con strategia registrata a runtime',
      confronto: valutaTutto(
        inputMock([regolaMock(sha)], {
          catalogoRequisiti: [REQUISITO_FUTURO],
          registroStrategie: registroEsteso,
        }),
      ),
      attesoAutorita: 'ELIGIBLE', attesoPipeline: 'MANUAL_VERIFICATION_REQUIRED',
      regolaAttesa: 'R2-tipo-non-gestito',
      motivo:
        'il requisito è valutato ma il tipo non dichiara la NATURA di aggregazione: mai verdetto positivo',
    },
    {
      etichetta: '(4) CFU non numerici (dato utente non affidabile)',
      confronto: valutaTutto(inputMock([regolaMock(sha)], { esami: esamiAnomali })),
      attesoAutorita: 'CONDITIONALLY_ELIGIBLE', attesoPipeline: 'INSUFFICIENT_DATA',
      regolaAttesa: 'R7-dato-utente-mancante',
      motivo:
        'A1: il dato è azionabile dal candidato ⇒ dati insufficienti, non verifica manuale né idoneità con deficit NaN',
    },
  ];

  for (const divergenza of divergenze) {
    const { autorita, pipeline, esito, risultato } = divergenza.confronto;
    assert(autorita === divergenza.attesoAutorita, `${divergenza.etichetta}: autorità ${autorita}`);
    assert(pipeline === divergenza.attesoPipeline, `${divergenza.etichetta}: pipeline ${pipeline}`);
    assert(esito.regola === divergenza.regolaAttesa, `${divergenza.etichetta}: regola ${esito.regola}`);
    assert(autorita !== pipeline, `${divergenza.etichetta}: divergenza attesa e dichiarata`);
    assert(!verdettoPositivo(pipeline), `${divergenza.etichetta}: la pipeline non pubblica un verdetto positivo`);
    assert(risultato.escalations.length > 0, `${divergenza.etichetta}: divergenza tracciata nelle escalation`);
    assert(
      risultato.escalations.some((escalation) => escalation.includes(divergenza.regolaAttesa)),
      `${divergenza.etichetta}: escalation con la regola applicata`,
    );
    console.log(
      `  ! [${divergenza.etichetta}] autorità=${autorita} · pipeline=${pipeline} (${esito.regola}) — ${divergenza.motivo}`,
    );
  }
  console.log(`  ✓ ${divergenze.length} divergenze INTENZIONALI, tutte non positive e tracciate.`);
}


/* --------------------------- Casi REALI: Core Set DM 22/12/2023 --------------------------- */

function testCoreSetReale(): void {
  preparaCatalogoCoreSet();
  const casi: { etichetta: string; classe: string; esami: Esame[] }[] = [
    { etichetta: 'A-11 ELIGIBLE (96 CFU)', classe: 'A-11', esami: ESAMI_ELIGIBILE },
    { etichetta: 'A-11 con deficit reale', classe: 'A-11', esami: ESAMI_DEFICIT },
    { etichetta: 'A-12 ELIGIBLE', classe: 'A-12', esami: ESAMI_ELIGIBILE },
    { etichetta: 'A-22 ELIGIBLE', classe: 'A-22', esami: ESAMI_ELIGIBILE },
  ];

  for (const caso of casi) {
    const esito = valutaClasseViaEngineBridge(parametriBridge(caso.esami, caso.classe));
    assert(
      !esito.motivoFallback,
      `${caso.etichetta}: nessun fallback legacy (regole reali attive)`,
    );
    assert(
      esito.pipeline?.stato === esito.esitoMotore,
      `${caso.etichetta}: aggregazione della pipeline ≡ autorità legacy (${esito.esitoMotore})`,
    );
    assert(
      esito.pipeline?.statoSolutore === esito.esitoMotore,
      `${caso.etichetta}: verdetto autorevole invariato (statoSolutore = esitoMotore)`,
    );
    assert(
      esito.payloadAssistantCreativo?.stato === esito.esitoMotore,
      `${caso.etichetta}: payload assistente allineato al verdetto`,
    );
  }

  // Attese storiche esplicite: nessun numero reale cambia in fase 4.
  const eligibile = valutaClasseViaEngineBridge(parametriBridge(ESAMI_ELIGIBILE, 'A-11'));
  assert(eligibile.esitoMotore === 'ELIGIBLE' && eligibile.cfuMancanti === 0, 'A-11 96 CFU → ELIGIBLE, deficit 0');
  const conDeficit = valutaClasseViaEngineBridge(parametriBridge(ESAMI_DEFICIT, 'A-11'));
  assert(conDeficit.esitoMotore === 'MANUAL_VERIFICATION_REQUIRED' && conDeficit.cfuMancanti === 6, 'A-11 deficit → MANUAL_VERIFICATION_REQUIRED, 6 CFU');
  console.log('  ✓ Core Set reale (A-11 ELIGIBLE/deficit, A-12, A-22): autorità e pipeline COINCIDONO.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Divergenze intenzionali autorità ↔ pipeline (nessun verdetto utente cambia)');
  const sha = await shaFixture();
  testAccordi(sha);
  testDivergenze(sha);
  testCoreSetReale();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


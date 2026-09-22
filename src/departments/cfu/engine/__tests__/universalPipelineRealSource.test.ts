/**
 * ScuoleRadar.it — Dipartimento CFU · Universal Pipeline su FONTE REALE.
 *
 * Fonte primaria: DM 22/12/2023 — G.U. N. 34 (10/02/2024) — Tabella A,
 * classe A-11 (LM-14). Verifica che la pipeline universale:
 *  - usi il database normativo reale (seed A-11) senza inventare nulla;
 *  - produca lo STESSO esito del decisore esistente (`valutaRequisitoClasse`);
 *  - non pubblichi deficit quando la norma non dichiara l'integrabilità
 *    (NOT_SPECIFIED), pur conservando il calcolo per requisito come evidenza;
 *  - esponga un payload di sola lettura per il futuro Assistente Creativo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_A11_METADATA, installaSeedA11 } from '../seeds/a11Seed';
import { trovaRegolePerClasse } from '../normativeDatabase';
import { valutaRequisitoClasse } from '../requirementSolver';
import { sha256Hex } from '../sourceGate';
import { eseguiPipelineUniversale, type InputPipelineUniversale } from '../pipeline/pipeline';
import { verificaPayloadNonAutorevole } from '../pipeline/creativePayload';
import { valutaClasseViaEngineBridge } from '../bridge/legacyAdapter';
import { seminaRegoleA11NelRegistro } from '../seeds/progressiveRegistry';
import { creaSourceRegistry } from '../traceability/sourceRegistry';
import type { Esame } from '../../shared/types';
import type {
  DateRilevanza,
  EsameCanonico,
  NormativeRuleEntry,
  TitoloAccademicoCanonico,
} from '../types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

const TITOLO_LM14: TitoloAccademicoCanonico = {
  denominazione: 'Laurea magistrale in Filologia moderna',
  classe: 'LM-14',
  classeLegacy: null,
  paese: null,
  titoloEstero: false,
};

const DATE: DateRilevanza = {
  enrollmentDate: '2019-10-01',
  awardedDate: '2022-11-18',
  procedureDate: '2024-03-15',
};

function esame(id: string, ssd: string, cfu: number): EsameCanonico {
  return { id, denominazione: `Esame ${ssd}`, cfu, ssd, fonte: 'manuale', provenienza: [] };
}

/** Carriera LM-14 completa per A-11 (96 CFU nei settori della regola). */
const ESAMI_ELIGIBILE: EsameCanonico[] = [
  esame('e1', 'L-FIL-LET/04', 12),
  esame('e2', 'L-FIL-LET/05', 12),
  esame('e3', 'L-FIL-LET/12', 12),
  esame('e4', 'L-FIL-LET/10', 12),
  esame('e5', 'L-FIL-LET/01', 6),
  esame('e6', 'M-STO/01', 18),
  esame('e7', 'L-ANT/02', 12),
  esame('e8', 'L-LIN/01', 12),
];

/** Carriera con deficit: L-FIL-LET/04 = 6, totale 84 CFU. */
const ESAMI_DEFICIT: EsameCanonico[] = [
  esame('d1', 'L-FIL-LET/04', 6),
  esame('e2', 'L-FIL-LET/05', 12),
  esame('e3', 'L-FIL-LET/12', 12),
  esame('e4', 'L-FIL-LET/10', 12),
  esame('e5', 'L-FIL-LET/01', 6),
  esame('d6', 'M-STO/01', 12),
  esame('e7', 'L-ANT/02', 12),
  esame('e8', 'L-LIN/01', 12),
];

function inputA11(esami: EsameCanonico[], regole: NormativeRuleEntry[]): InputPipelineUniversale {
  return {
    classeCodice: 'A-11',
    denominazioneClasse: SEED_A11_METADATA.articoloTabellaNota ?? 'Classe A-11',
    esami,
    titolo: TITOLO_LM14,
    dateRilevanza: DATE,
    regole,
    ora: '2024-03-15T09:00:00.000Z',
  };
}

/* ------------------------------ Integrità della fonte ------------------------------ */

async function verificaFonteReale(): Promise<void> {
  const percorso = join(
    process.cwd(),
    'src',
    'departments',
    'cfu',
    'engine',
    SEED_A11_METADATA.rawSourceFilePath,
  );
  const contenuto = readFileSync(percorso, 'utf8');
  assert(contenuto === SEED_A11_METADATA.testoVerbatim, 'estrattoVerbatim = file raw verbatim');
  assert(
    (await sha256Hex(contenuto)) === SEED_A11_METADATA.rawSourceSha256,
    'SHA-256 del file raw coerente',
  );
  console.log('  ✓ Fonte reale A-11: file raw e hash verificati.');
}

/* ------------------------------ Test 1: parità ELIGIBLE ------------------------------ */

function testParitaEligibile(regole: NormativeRuleEntry[]): void {
  const input = inputA11(ESAMI_ELIGIBILE, regole);
  const pipeline = eseguiPipelineUniversale(input);
  const solutore = valutaRequisitoClasse('A-11', ESAMI_ELIGIBILE, {
    regole,
    titolo: TITOLO_LM14,
    normativa: pipeline.fonti.normativa,
    ora: input.ora,
  });

  assert(pipeline.stato === 'ELIGIBLE', `pipeline ELIGIBLE, ottenuto ${pipeline.stato}`);
  assert(pipeline.stato === solutore.stato, 'parità: stato identico al decisore esistente');
  assert(pipeline.escalations.length === 0, 'fonte reale: nessuna escalation');
  assert(pipeline.fonti.fonti.length === 1, 'fonti: una regola autorevole applicabile');
  assert(
    pipeline.fonti.fonti[0]!.sourceId === SEED_A11_METADATA.ruleId,
    'fonti: id della regola A-11 reale',
  );
  assert(pipeline.fonti.fonti[0]!.effectiveFrom === '2024-02-10', 'fonti: vigenza dichiarata dal contesto reale');
  assert(pipeline.fonti.fonti[0]!.rawSourceSha256 === SEED_A11_METADATA.rawSourceSha256, 'fonti: hash della fonte');
  assert(pipeline.requisiti.length === 6, `requisiti: 5 vincoli + accesso classe, ottenuti ${pipeline.requisiti.length}`);
  assert(
    pipeline.requisiti.filter((requisito) => requisito.tipo !== 'titolo.accesso.classe').every(
      (requisito) => requisito.id.startsWith(`${SEED_A11_METADATA.ruleId}::`),
    ),
    'requisiti: id tracciabili verso la regola di origine',
  );
  assert(
    pipeline.valutazioniRequisito
      .filter((valutazione) => valutazione.tipo !== 'titolo.accesso.classe')
      .every((valutazione) => valutazione.stato === 'SODDISFATTO'),
    'valutazioni: tutti i requisiti CFU soddisfatti',
  );
  assert(pipeline.deficit.calcolabile === true && pipeline.deficit.cfuMancantiTotali === 0, 'deficit: 0 CFU pubblicabile');
  assert(verificaPayloadNonAutorevole(pipeline.payloadAssistantCreativo).length === 0, "payload: nessuna violazione del confine con l'assistente");
  assert(pipeline.payloadAssistantCreativo.noteTracciabilita.some((nota) => nota.includes(SEED_A11_METADATA.ruleId)), 'payload: tracciabilità verso la regola reale');

  // Il BRIDGE (ora instradato sulla pipeline) deve concordare con la decisione
  // reale e propagare l'identità della fonte seminata dal DM reale.
  const registro = creaSourceRegistry();
  seminaRegoleA11NelRegistro(registro);
  const bridged = valutaClasseViaEngineBridge({
    esami: ESAMI_ELIGIBILE.map(({ id, denominazione, cfu, ssd }): Esame => ({
      id,
      denominazione,
      cfu,
      ssd: ssd ?? null,
      fonte: 'manuale',
    })),
    classeCodice: 'A-11',
    registry: registro,
    denominazioneClasse: 'A-11',
    tabella: 'A',
    normativa: pipeline.fonti.normativa!,
    classeLaureaTitolo: 'LM-14',
    ora: input.ora,
  });
  assert(bridged.esitoMotore === solutore.stato, 'bridge reale: stato identico al decisore');
  assert(bridged.cfuMancanti === solutore.cfuMancantiTotali, 'bridge reale: deficit identico');
  assert(
    bridged.fonti?.[0]?.rawSourceSha256 === SEED_A11_METADATA.rawSourceSha256,
    'bridge reale: hash della fonte reale propagato nei metadati',
  );
  assert(
    verificaPayloadNonAutorevole(bridged.payloadAssistantCreativo!).length === 0,
    'bridge reale: payload non autorevole',
  );
  console.log('  ✓ A-11 ELIGIBLE: parità con il decisore + audit verso la fonte reale.');
}

/* --------------------- Test 2: parità con deficit reale (NOT_SPECIFIED) --------------------- */

function testParitaDeficit(regole: NormativeRuleEntry[]): void {
  const pipeline = eseguiPipelineUniversale(inputA11(ESAMI_DEFICIT, regole));
  const solutore = pipeline.valutazioneClasse!;

  assert(
    pipeline.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `A-11 deficit: atteso MANUAL (NOT_SPECIFIED), ottenuto ${pipeline.stato}`,
  );
  assert(pipeline.stato === solutore.stato, 'parità: stato identico al decisore esistente');
  assert(pipeline.deficit.calcolabile === false, 'NOT_SPECIFIED: deficit non pubblicabile');
  assert(pipeline.deficit.cfuMancantiTotali === null, 'NOT_SPECIFIED: MAI 0 CFU mancanti');
  assert(solutore.cfuMancantiTotali === 24, `decisore: aggregato conservato per audit (24), ottenuto ${solutore.cfuMancantiTotali}`);

  for (const esito of solutore.esitiVincoli) {
    if (esito.tipo === 'titoloAbilitante') continue;
    const valutazione = pipeline.valutazioniRequisito.find((voce) =>
      voce.requisitoId.endsWith(`::${esito.vincoloId}`),
    );
    assert(Boolean(valutazione), `parità: requisito per il vincolo ${esito.vincoloId}`);
    assert(
      valutazione!.valori.cfuPosseduti === esito.cfuPosseduti &&
        valutazione!.valori.cfuMancanti === esito.cfuMancanti,
      `parità CFU per il vincolo ${esito.vincoloId}`,
    );
  }

  const deficit04 = pipeline.valutazioniRequisito.find((valutazione) =>
    valutazione.requisitoId.endsWith('::v-A11-LFILLET04'),
  )!;
  assert(Boolean(deficit04), 'evidenza: requisito L-FIL-LET/04 presente');
  assert(deficit04.stato === 'NON_SODDISFATTO' && deficit04.valori.cfuMancanti === 6, 'evidenza per requisito: 6 CFU mancanti in L-FIL-LET/04');
  assert(deficit04.evidenze[0]!.posizioneFonte.includes('A-11'), 'evidenza: posizione nella fonte reale');
  assert(pipeline.payloadAssistantCreativo.deficit.cfuMancantiTotali === null, "payload: nessun deficit pubblicato all'assistente");
  console.log('  ✓ A-11 deficit: parità per requisito, deficit aggregato NON pubblicato.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Universal Pipeline su FONTE REALE — A-11 · DM 22/12/2023 · G.U. 34/2024 · LM-14');
  await verificaFonteReale();
  const installato = await installaSeedA11();
  assert(installato, 'seed A-11 installato nel database autorevole');
  const regole = trovaRegolePerClasse('A-11');
  assert(regole.length === 1, 'una regola autorevole per A-11');
  testParitaEligibile(regole);
  testParitaDeficit(regole);
  console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

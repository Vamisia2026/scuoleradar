/**
 * ScuoleRadar.it — Dipartimento CFU · Parità del BRIDGE con la pipeline.
 *
 * Prova che instradare `valutaClasseViaEngineBridge` attraverso la PIPELINE
 * UNIVERSALE non cambia il comportamento esternamente visibile: per ogni caso
 * reale del Core Set DM 22/12/2023 (A-11, A-12, A-22 · LM-14) l'esito
 * instradato è confrontato campo-per-campo con la composizione PRE-REFACTOR
 * (`bridgeParityFixtures.vecchiaComposizione`), e i metadati estesi della
 * pipeline (fonti, requisiti, deficit, conflitti, payload) sono verificati.
 */
import { valutaClasseViaEngineBridge } from '../bridge/legacyAdapter';
import {
  assert,
  conteggioAsserzioni,
  ESAMI_DEFICIT,
  ESAMI_ELIGIBILE,
  parametriBridge,
  preparaCatalogoCoreSet,
  vecchiaComposizione,
  verificaMetadatiPipeline,
  verificaParita,
} from './bridgeParityFixtures';
import type { Esame } from '../../shared/types';

/* --------------------------- Parità Core Set LM-14 --------------------------- */

function testParitaCoreSet(): void {
  const casi: { classe: string; esami: Esame[] }[] = [
    { classe: 'A-11', esami: ESAMI_ELIGIBILE },
    { classe: 'A-11', esami: ESAMI_DEFICIT },
    { classe: 'A-12', esami: ESAMI_ELIGIBILE },
    { classe: 'A-22', esami: ESAMI_ELIGIBILE },
  ];

  for (const caso of casi) {
    const parametri = parametriBridge(caso.esami, caso.classe);
    const nuovo = valutaClasseViaEngineBridge(parametri);
    const atteso = vecchiaComposizione(parametri);
    const etichetta = `${caso.classe} (${caso.esami.length} esami)`;
    verificaParita(etichetta, atteso, nuovo);
    verificaMetadatiPipeline(etichetta, nuovo);
  }

  // Attese storiche esplicite (coerenti con legacyAdapter/progressiveWiring).
  const eligibileA11 = valutaClasseViaEngineBridge(parametriBridge(ESAMI_ELIGIBILE, 'A-11'));
  assert(eligibileA11.esitoMotore === 'ELIGIBLE', 'A-11 96 CFU → ELIGIBLE');
  assert(eligibileA11.cfuMancanti === 0, 'A-11 96 CFU → deficit 0');
  assert(eligibileA11.verificaManualeRichiesta === false, 'A-11 ELIGIBLE → nessuna verifica manuale');
  assert(eligibileA11.accessibile === true, 'A-11 ELIGIBLE → accessibile');
  assert(eligibileA11.regoleApplicate.length === 5, 'A-11 → 5 regole applicate');
  assert(
    eligibileA11.deficit?.calcolabile === true && eligibileA11.deficit.cfuMancantiTotali === 0,
    'A-11 ELIGIBLE → deficit pubblicabile 0',
  );

  const deficitA11 = valutaClasseViaEngineBridge(parametriBridge(ESAMI_DEFICIT, 'A-11'));
  assert(
    deficitA11.esitoMotore === 'MANUAL_VERIFICATION_REQUIRED',
    'A-11 deficit → MANUAL_VERIFICATION_REQUIRED',
  );
  assert(deficitA11.cfuMancanti === 6, 'A-11 deficit → 6 CFU (L-FIL-LET/04)');
  assert(deficitA11.verificaManualeRichiesta === true, 'A-11 deficit → verifica manuale');
  assert(deficitA11.accessibile === false, 'A-11 deficit → non accessibile');
  assert(
    deficitA11.deficit?.calcolabile === false && deficitA11.deficit.cfuMancantiTotali === null,
    'A-11 deficit → deficit aggregato non pubblicabile (mai 0)',
  );
  const conDeficit = deficitA11.valutazioniRequisito?.filter(
    (valutazione) => (valutazione.valori.cfuMancanti ?? 0) > 0,
  );
  assert(conDeficit?.length === 1, 'A-11 deficit → un solo requisito con deficit CFU');
  assert(conDeficit?.[0]?.valori.cfuMancanti === 6, 'A-11 deficit → 6 CFU mancanti');
  assert(
    Boolean(conDeficit?.[0]?.requisitoId.includes('LFILLET04')),
    'A-11 deficit → il requisito con deficit è quello di L-FIL-LET/04 (id di fonte)',
  );
  console.log('  ✓ Core Set LM-14 (A-11 ELIGIBLE/deficit, A-12, A-22): parità campo-per-campo.');
}

/* ------------------------------ Runner ------------------------------ */

function main(): void {
  console.log('Bridge ↔ Pipeline Parità — Core Set DM 22/12/2023 (LM-14)');
  preparaCatalogoCoreSet();
  testParitaCoreSet();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main();

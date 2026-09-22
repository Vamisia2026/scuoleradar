/**
 * ScuoleRadar.it — Dipartimento CFU · Parità del ROUTING con la pipeline.
 *
 * Copre i casi coperti da `progressiveWiring` e `multiClassScan` dopo
 * l'instradamento del bridge sulla pipeline universale:
 *  - NEW_ENGINE: A-11/A-12/A-22 con i numeri attesi dalla scan multi-classe
 *    (Marco, 48 CFU, LM-14 → 90/72/74) e metadati di pipeline propagati;
 *  - LEGACY_FALLBACK: A-26 e A-99 (logica legacy demo) invariate;
 *  - fallback del bridge su registro vuoto (nessuna regola attiva).
 */
import { valutaClasseConRouting } from '../../calcolatore/analisi';
import { valutaClasseViaEngineBridge, type EsitoClasseAdapter } from '../bridge/legacyAdapter';
import { creaSourceRegistry } from '../traceability/sourceRegistry';
import {
  assert,
  conteggioAsserzioni,
  ESAMI_A26,
  ESAMI_MARCO,
  parametriBridge,
  preparaCatalogoCoreSet,
  vecchiaComposizione,
  verificaParita,
} from './bridgeParityFixtures';

/* ------------------ Numeri attesi dalla scan multi-classe (Marco) ------------------ */

function testNumeriMultiClassScan(): void {
  const attesi: { classe: string; cfu: number }[] = [
    { classe: 'A-11', cfu: 90 },
    { classe: 'A-12', cfu: 72 },
    { classe: 'A-22', cfu: 74 },
  ];
  for (const atteso of attesi) {
    const parametri = parametriBridge(ESAMI_MARCO, atteso.classe);
    const nuovo = valutaClasseViaEngineBridge(parametri);
    verificaParita(`Marco ${atteso.classe}`, vecchiaComposizione(parametri), nuovo);
    assert(
      nuovo.cfuMancanti === atteso.cfu && nuovo.verificaManualeRichiesta === true,
      `Marco ${atteso.classe}: deficit ${atteso.cfu} + verifica manuale`,
    );
    assert(
      nuovo.deficit?.calcolabile === false && nuovo.deficit.cfuMancantiTotali === null,
      `Marco ${atteso.classe}: NOT_SPECIFIED → deficit aggregato non pubblicato (mai 0)`,
    );
  }
  console.log('  ✓ Marco (48 CFU · LM-14): deficit 90/72/74 invariati, aggregato non pubblicabile.');
}

/* ------------------------- Routing NEW_ENGINE / LEGACY_FALLBACK ------------------------- */

function testRoutingInvariato(): void {
  const newEngine = valutaClasseConRouting({
    esami: ESAMI_MARCO,
    classeCodice: 'A-11',
    denominazione: 'Discipline letterarie e latino',
    tabella: 'A',
    classeLaureaTitolo: 'LM-14',
  });
  assert(newEngine.engineSource === 'NEW_ENGINE', 'A-11: routed a NEW_ENGINE');
  assert(newEngine.isEngineDriven === true, 'A-11: engine-driven');
  assert(newEngine.cfuMancanti === 90, 'A-11: deficit 90 CFU (invariato)');
  assert(newEngine.accessibile === false, 'A-11: non accessibile');
  assert(
    newEngine.verificaManualeRichiesta === true,
    'A-11: verifica manuale richiesta (NOT_SPECIFIED)',
  );
  assert(
    Boolean(newEngine.fonti?.length) && Boolean(newEngine.deficit),
    'A-11: metadati di pipeline propagati anche attraverso il routing',
  );
  assert(
    newEngine.pipeline?.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `A-11: pipeline.stato (candidato) sulla superficie di routing — ottenuto ${newEngine.pipeline?.stato}`,
  );
  assert(
    newEngine.pipeline?.statoSolutore === newEngine.esitoMotore,
    'A-11: verdetto autorevole invariato (stato = statoSolutore)',
  );
  assert(
    newEngine.valutazioniRequisito?.length === newEngine.pipeline?.requisiti.length,
    'A-11: esiti per requisito esposti sulla superficie di routing',
  );
  assert(
    newEngine.payloadAssistantCreativo?.puoModificareEsito === false,
    'A-11: payload assistente non autorevole nel routing',
  );

  const a26 = valutaClasseConRouting({
    esami: ESAMI_MARCO,
    classeCodice: 'A-26',
    denominazione: 'Matematica',
    tabella: 'A',
  });
  assert(a26.engineSource === 'LEGACY_FALLBACK', 'A-26: LEGACY_FALLBACK (classe non seminata)');
  assert(a26.isEngineDriven === false, 'A-26: non engine-driven');
  assert(a26.cfuMancanti === 24, 'A-26: deficit legacy demo 24 CFU (invariato)');
  assert(a26.accessibile === false, 'A-26: non accessibile');

  const a99 = valutaClasseConRouting({
    esami: ESAMI_MARCO,
    classeCodice: 'A-99',
    denominazione: 'Classe non nota',
    tabella: 'A',
  });
  assert(a99.engineSource === 'LEGACY_FALLBACK', 'A-99: LEGACY_FALLBACK');
  assert(a99.isEngineDriven === false, 'A-99: non engine-driven');
  assert(a99.cfuMancanti === 0, 'A-99: nessun deficit calcolato (legacy)');
  assert(a99.accessibile === false, 'A-99: non accessibile');
  console.log('  ✓ Routing invariato: NEW_ENGINE (A-11) e LEGACY_FALLBACK (A-26, A-99).');
}

/* ------------------------------- Fallback del bridge ------------------------------- */

function testFallbackBridge(): void {
  const registroVuoto = creaSourceRegistry();
  const fallback = valutaClasseViaEngineBridge({
    esami: ESAMI_A26,
    classeCodice: 'A-99',
    registry: registroVuoto,
    denominazioneClasse: 'Classe non ancora in catalogo engine',
    tabella: 'A',
    normativa: { decreto: 'DM 22/12/2023', tabella: 'A', dataAggiornamentoNormativa: '2024-02-10' },
  });
  assert(
    fallback.esitoMotore === 'MANUAL_VERIFICATION_REQUIRED',
    'fallback: MANUAL_VERIFICATION_REQUIRED senza eccezioni',
  );
  assert(fallback.accessibile === false, 'fallback: non accessibile');
  assert(Boolean(fallback.motivoFallback), 'fallback: motivo esplicito');
  assert(fallback.regoleApplicate.length === 0, 'fallback: nessuna regola applicata');
  assert(fallback.fonti === undefined, 'fallback: nessun metadato di pipeline (nessuna fonte)');
  assert(fallback.isEngineDriven === true, 'fallback: resta engine-driven');

  // Nessuna classe del Core Set perde regole: il fallback non assorbe i casi reali.
  for (const classe of ['A-11', 'A-12', 'A-22']) {
    const esito: EsitoClasseAdapter = valutaClasseViaEngineBridge(
      parametriBridge(ESAMI_MARCO, classe),
    );
    assert(!esito.motivoFallback, `${classe}: nessun fallback (regole attive presenti)`);
  }
  console.log('  ✓ Fallback del bridge invariato (registro vuoto) e mai attivato sul Core Set.');
}

/* ------------------------------ Runner ------------------------------ */

function main(): void {
  console.log('Routing ↔ Pipeline Parità — NEW_ENGINE / LEGACY_FALLBACK (progressiveWiring)');
  preparaCatalogoCoreSet();
  testNumeriMultiClassScan();
  testRoutingInvariato();
  testFallbackBridge();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main();

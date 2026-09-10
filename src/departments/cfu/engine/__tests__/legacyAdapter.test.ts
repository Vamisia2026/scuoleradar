/**
 * ScuoleRadar.it — Dipartimento CFU · Legacy Adapter test.
 *
 * Verifica che il Bridge Adapter produca conclusioni IDENTICHE al solver
 * diretto dell'engine (valutaRequisitoClasse con la regola A-11 del DM
 * 22/12/2023) mentre restituisce lo shape legacy `EsitoClasse` (+ metadati).
 */
import type { Esame } from '../../shared/types';
import {
  esamiLegacyInCanonici,
  valutaClasseViaEngineBridge,
} from '../bridge/legacyAdapter';
import { valutaRequisitoClasse } from '../requirementSolver';
import { REGOLA_A11_LM14 } from '../sources/dm22122023_A11';
import {
  creaEvidence,
  creaProposition,
  creaRule,
  creaSource,
  dominioClasseConcorso,
  dominioClasseLaurea,
  type Evidence,
  type Proposition,
  type Rule,
  type Source,
} from '../traceability/traceabilityChain';
import { creaSourceRegistry, type SourceRegistry } from '../traceability/sourceRegistry';
import type {
  NormativaApplicata,
  TitoloAccademicoCanonico,
} from '../types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

const NORMATIVA_DM22: NormativaApplicata = {
  decreto: 'DM 22/12/2023',
  tabella: 'A',
  dataAggiornamentoNormativa: '2024-02-10',
};

const TITOLO_LM14: TitoloAccademicoCanonico = {
  denominazione: 'Laurea Magistrale in Filologia moderna',
  classe: 'LM-14',
  classeLegacy: null,
  paese: null,
  titoloEstero: false,
};

const HASH_DEMO = 'aa'.repeat(32);

/* ------------------------------ Fixture esami legacy ------------------------------ */

const ESAMI_ELIGIBILE: Esame[] = [
  { id: 'e1', denominazione: 'Lingua e letteratura latina', cfu: 12, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e2', denominazione: 'Filologia classica', cfu: 12, ssd: 'L-FIL-LET/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e3', denominazione: 'Linguistica italiana', cfu: 12, ssd: 'L-FIL-LET/12', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e4', denominazione: 'Filologia (L-FIL-LET/01)', cfu: 6, ssd: 'L-FIL-LET/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e5', denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e6', denominazione: 'Storia romana', cfu: 12, ssd: 'L-ANT/03', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e7', denominazione: 'Storia medievale I', cfu: 18, ssd: 'M-STO/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e8', denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01', fonte: 'manuale', affidabilita: 'alta' },
];

const ESAMI_DEFICIT_04: Esame[] = [
  { id: 'e1', denominazione: 'Lingua e letteratura latina', cfu: 6, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e2', denominazione: 'Filologia classica', cfu: 18, ssd: 'L-FIL-LET/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e3', denominazione: 'Linguistica italiana', cfu: 12, ssd: 'L-FIL-LET/12', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e4', denominazione: 'Filologia (L-FIL-LET/01)', cfu: 6, ssd: 'L-FIL-LET/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e5', denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e6', denominazione: 'Storia romana', cfu: 12, ssd: 'L-ANT/03', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e7', denominazione: 'Storia medievale I', cfu: 18, ssd: 'M-STO/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e8', denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01', fonte: 'manuale', affidabilita: 'alta' },
];

/* ------------------------------ SourceRegistry A-11 (speculare al DM) ------------------------------ */

// Helper per costruire una singola chain rule e registrarla.
function aggiungiRule(
  registro: SourceRegistry,
  parametri: {
    id: string;
    evidenceId: string;
    testo: string;
    fonte: Source;
    vincolo: Rule['vincolo'];
  },
): void {
  const evidenza: Evidence = creaEvidence({
    id: parametri.evidenceId,
    sourceHash: parametri.fonte.hash,
    testo: parametri.testo,
    coordinate: { pagina: 1, riga: 2 },
    stato: 'ACTIVE',
  });
  const proposizione: Proposition = creaProposition({
    id: `prop-${parametri.id}`,
    contenutoAtomico: parametri.testo,
    evidenze: [evidenza],
    stato: 'ACTIVE',
  });
  const regola: Rule = creaRule({
    id: parametri.id,
    proposizioneId: proposizione.id,
    vincolo: parametri.vincolo,
    dominii: [dominioClasseConcorso('A-11'), dominioClasseLaurea('LM-14')],
    stato: 'ACTIVE',
  });
  registro.registraSource(parametri.fonte);
  registro.registraProposition(proposizione);
  registro.registraRule(regola);
}

/** Registro speculare ai vincoli reali della regola A-11 dell'engine. */
function costruisciRegistroA11(): SourceRegistry {
  const registro = creaSourceRegistry();
  const fonte = creaSource({
    id: 'src-bridge-demo-A11',
    hash: HASH_DEMO,
    autorita: 'MIM',
    titolo: 'DM 22/12/2023 — Tabella A — A-11 (LM-14) — copia bridge dimostrativa',
    tipoDocumento: 'tabella',
    pubblicazione: {
      riferimento: 'G.U. N. 34 del 10/02/2024',
      data: '2024-02-10',
      articoloNota: 'Tabella A — Classe A-11',
    },
    rawFilePath: 'sources/raw/bridge-demo-A11.txt',
    stato: 'ACTIVE',
  });

  aggiungiRule(registro, {
    id: 'bridge-A11-totale',
    evidenceId: 'ev-bridge-totale',
    testo: 'almeno 96 CFU nei settori scientifico-disciplinari L-FIL-LET/, L-ANT/, M-STO/, L-LIN/01',
    fonte,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/', 'L-ANT/', 'M-STO/', 'L-LIN/01'],
      minCfu: 96,
    },
  });
  aggiungiRule(registro, {
    id: 'bridge-A11-0405',
    evidenceId: 'ev-bridge-0405',
    testo:
      'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04',
    fonte,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/04', 'L-FIL-LET/05'],
      minCfu: 24,
    },
  });
  aggiungiRule(registro, {
    id: 'bridge-A11-04',
    evidenceId: 'ev-bridge-04',
    testo:
      'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04',
    fonte,
    vincolo: { tipo: 'singoloSsdMinCfu', ssd: 'L-FIL-LET/04', minCfu: 12 },
  });
  aggiungiRule(registro, {
    id: 'bridge-A11-1012',
    evidenceId: 'ev-bridge-1012',
    testo: 'almeno 12 CFU tra L-FIL-LET/10 e L-FIL-LET/12',
    fonte,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/10', 'L-FIL-LET/12'],
      minCfu: 12,
    },
  });
  aggiungiRule(registro, {
    id: 'bridge-A11-LANT',
    evidenceId: 'ev-bridge-lant',
    testo: 'almeno 12 CFU tra L-ANT/02 o L-ANT/03',
    fonte,
    vincolo: {
      tipo: 'disgiunzioneMinCfu',
      opzioni: [
        { id: 'opt-lant-02', ssd: ['L-ANT/02'], minCfu: 12 },
        { id: 'opt-lant-03', ssd: ['L-ANT/03'], minCfu: 12 },
      ],
    },
  });
  return registro;
}


/* ------------------------------ Test: equivalenza col solver diretto ------------------------------ */

function testBridge(): void {
  const registro = costruisciRegistroA11();
  const denominazione = 'Discipline letterarie e latino nei licei e nell’istituto magistrale';

  /* Scenario A — carriera ELIGIBILE. */
  const esitiDirettiEligibile = valutaRequisitoClasse('A-11', esamiLegacyInCanonici(ESAMI_ELIGIBILE), {
    regole: [REGOLA_A11_LM14],
    titolo: TITOLO_LM14,
    normativa: NORMATIVA_DM22,
    mappature: [],
  });
  const esitoBridgeEligibile = valutaClasseViaEngineBridge({
    esami: ESAMI_ELIGIBILE,
    classeCodice: 'A-11',
    registry: registro,
    denominazioneClasse: denominazione,
    tabella: 'A',
    normativa: NORMATIVA_DM22,
    classeLaureaTitolo: 'LM-14',
  });

  // Conclusioni identiche al solver diretto.
  assert(esitiDirettiEligibile.stato === 'ELIGIBLE', 'solver diretto: ELIGIBLE');
  assert(esitoBridgeEligibile.esitoMotore === esitiDirettiEligibile.stato, 'stato identico (A)');
  assert(esitoBridgeEligibile.accessibile === true, 'bridge: accessibile (A)');
  assert(esitoBridgeEligibile.cfuMancanti === esitiDirettiEligibile.cfuMancantiTotali, 'cfuMancanti identici (A)');
  assert(esitoBridgeEligibile.cfuMancanti === 0, 'nessun deficit (A)');

  // Shape legacy rispettato + flag engine.
  assert(esitoBridgeEligibile.classe.codice === 'A-11', 'classe.codice legacy');
  assert(esitoBridgeEligibile.classe.denominazione === denominazione, 'classe.denominazione legacy');
  assert(esitoBridgeEligibile.classe.tabella === 'A', 'classe.tabella legacy');
  assert(esitoBridgeEligibile.classe.requisitiDemo === false, 'risultato engine non demo');
  assert(Array.isArray(esitoBridgeEligibile.coperture), 'coperture legacy (array) presente');
  assert(esitoBridgeEligibile.isEngineDriven === true, 'isEngineDriven: true');
  assert(esitoBridgeEligibile.verificaManualeRichiesta === false, 'nessuna verifica manuale (A)');
  assert(esitoBridgeEligibile.regoleApplicate.length === 5, '5 regole applicate via SourceRegistry');
  assert(esitoBridgeEligibile.audit.length > 0, 'audit motore presente');

  /* Scenario B — carriera con deficit (solo 6 CFU in L-FIL-LET/04). */
  const esitiDirettiDeficit = valutaRequisitoClasse('A-11', esamiLegacyInCanonici(ESAMI_DEFICIT_04), {
    regole: [REGOLA_A11_LM14],
    titolo: TITOLO_LM14,
    normativa: NORMATIVA_DM22,
    mappature: [],
  });
  const esitoBridgeDeficit = valutaClasseViaEngineBridge({
    esami: ESAMI_DEFICIT_04,
    classeCodice: 'A-11',
    registry: registro,
    denominazioneClasse: denominazione,
    tabella: 'A',
    normativa: NORMATIVA_DM22,
    classeLaureaTitolo: 'LM-14',
  });

  assert(esitiDirettiDeficit.stato === 'MANUAL_VERIFICATION_REQUIRED', 'solver diretto: MANUAL (B)');
  assert(esitoBridgeDeficit.esitoMotore === esitiDirettiDeficit.stato, 'stato identico (B)');
  assert(esitoBridgeDeficit.accessibile === false, 'bridge: non accessibile (B)');
  assert(
    esitoBridgeDeficit.cfuMancanti === esitiDirettiDeficit.cfuMancantiTotali,
    'deficit identico (B)',
  );
  assert(esitoBridgeDeficit.cfuMancanti === 6, 'deficit esatto = 6 CFU (B)');
  assert(esitoBridgeDeficit.verificaManualeRichiesta === true, 'MANUAL ⇒ flag verifica (B)');
  assert(esitoBridgeDeficit.isEngineDriven === true, 'isEngineDriven: true (B)');

  /* Fallback — registro senza regole attive per la classe richiesta. */
  const registroVuoto = creaSourceRegistry();
  const esitoFallback = valutaClasseViaEngineBridge({
    esami: ESAMI_ELIGIBILE,
    classeCodice: 'A-99',
    registry: registroVuoto,
    denominazioneClasse: 'Classe non ancora in catalogo engine',
    tabella: 'A',
    normativa: NORMATIVA_DM22,
  });
  assert(
    esitoFallback.esitoMotore === 'MANUAL_VERIFICATION_REQUIRED',
    'fallback: MANUAL_VERIFICATION_REQUIRED (nessun crash)',
  );
  assert(esitoFallback.accessibile === false, 'fallback: non accessibile');
  assert(esitoFallback.verificaManualeRichiesta === true, 'fallback: verifica manuale richiesta');
  assert(Boolean(esitoFallback.motivoFallback), 'fallback: motivo esplicito');
  assert(
    esitoFallback.motivoFallback!.includes('verifica manuale'),
    'fallback: messaggio di verifica manuale',
  );
  assert(esitoFallback.isEngineDriven === true, 'fallback: resta engine-driven');
  assert(esitoFallback.regoleApplicate.length === 0, 'fallback: nessuna regola applicata');

  console.log('  ✓ Bridge A-11 (ELIGIBLE): stato/cfu identici al solver diretto.');
  console.log('  ✓ Bridge A-11 (deficit): MANUAL identico, deficit = 6 CFU.');
  console.log('  ✓ Fallback A-99: MANUAL_VERIFICATION_REQUIRED senza eccezioni.');
  console.log('  ✓ Shape legacy (classe/coperture/cfuMancanti/accessibile) + isEngineDriven: true.');
}

console.log('Legacy Adapter — Bridge tra calcolatore legacy e CFU Engine');
testBridge();
console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);


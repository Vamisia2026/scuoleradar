/**
 * ScuoleRadar.it — Dipartimento CFU · Multi-Class Scan test ("Altre Strade").
 *
 * Scansione multi-classe pura (nessuna UI): il candidato "Marco" (LM-14) viene
 * valutato su più classi di concorso con i soli entry point esistenti
 * `valutaClasseConRouting` e `analizzaPercorsoDiStudi`. Si verifica che ogni
 * classe produca un esito strutturato e INDIPENDENTE (nessuna contaminazione di
 * stato tra classi) e che A-11 (seminata) vada su NEW_ENGINE mentre le classi
 * non seminate (A-12/A-22/A-26/A-99) vadano su LEGACY_FALLBACK.
 */
import {
  analizzaPercorsoDiStudi,
  valutaClasseConRouting,
  type EsitoClasseConRouting,
} from '../calcolatore/analisi';
import type { Esame } from '../shared/types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ Candidato Marco (LM-14) ------------------------------ */

const MARCO_ESAMI: Esame[] = [
  { id: 'm1', denominazione: 'Letteratura italiana', cfu: 12, ssd: 'L-FIL-LET/10', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'm2', denominazione: 'Lingua e letteratura latina', cfu: 6, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'm3', denominazione: 'Storia moderna', cfu: 12, ssd: 'M-STO/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'm4', denominazione: 'Storia romana', cfu: 6, ssd: 'L-ANT/03', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'm5', denominazione: 'Lingua e traduzione — inglese', cfu: 12, ssd: 'L-LIN/12', fonte: 'manuale', affidabilita: 'alta' },
];

const CLASSI_SCAN = ['A-11', 'A-12', 'A-22', 'A-26', 'A-99'] as const;

/** CFU totali di Marco (48). */
function cfuTotaliMarco(): number {
  return MARCO_ESAMI.reduce((somma, esame) => somma + esame.cfu, 0);
}

/** Classi del Core Set seminate nel SourceRegistry (LM-14 → titolo richiesto). */
const CLASSI_CORE_SET_LM14 = ['A-11', 'A-12', 'A-22'] as const;

function flagVerificaManuale(esito: EsitoClasseConRouting): boolean {
  const flag = (esito as { verificaManualeRichiesta?: boolean }).verificaManualeRichiesta;
  return flag === true;
}

/** Traccia la fonte (DM) presente negli audit engine, quando disponibile. */
function riferimentoDM(esito: EsitoClasseConRouting): string {
  const audit = (esito as { audit?: readonly { messaggio?: string; normativa?: { decreto?: string } }[] })
    .audit;
  if (!audit) return '—';
  const trovaDM = audit.some((voce) => {
    const testo = voce.messaggio ?? '';
    return testo.includes('DM 22/12/2023') || voce.normativa?.decreto === 'DM 22/12/2023';
  });
  return trovaDM ? 'DM 22/12/2023 (G.U. N. 34 del 10/02/2024)' : '—';
}

/* ------------------------------ Scan multi-classe via valutaClasseConRouting ------------------------------ */

interface RigaScan {
  classeCodice: string;
  engineSource: string;
  isEngineDriven: boolean;
  accessibile: boolean;
  cfuMancanti: number;
  verificaManuale: boolean | 'n/d (legacy)';
  riferimento: string;
}

function eseguiScanMultiClasse(): RigaScan[] {
  const righe: RigaScan[] = [];
  for (const classeCodice of CLASSI_SCAN) {
    const esito = valutaClasseConRouting({
      esami: MARCO_ESAMI,
      classeCodice,
      denominazione: `Classe ${classeCodice}`,
      tabella: 'A',
      classeLaureaTitolo: (CLASSI_CORE_SET_LM14 as readonly string[]).includes(classeCodice)
        ? 'LM-14'
        : undefined,
    });

    // Contratto legacy sempre rispettato (nessun crash, nessuna mutazione).
    assert(Boolean(esito.classe), `${classeCodice}: classe presente`);
    assert(esito.classe.codice === classeCodice, `${classeCodice}: codice isolato`);
    assert(typeof esito.cfuMancanti === 'number', `${classeCodice}: cfuMancanti numerico`);
    assert(typeof esito.accessibile === 'boolean', `${classeCodice}: accessibile booleano`);
    assert(
      esito.engineSource === 'NEW_ENGINE' || esito.engineSource === 'LEGACY_FALLBACK',
      `${classeCodice}: engineSource valido`,
    );
    assert(
      esito.isEngineDriven === (esito.engineSource === 'NEW_ENGINE'),
      `${classeCodice}: isEngineDriven coerente con engineSource`,
    );

    righe.push({
      classeCodice: esito.classe.codice,
      engineSource: esito.engineSource,
      isEngineDriven: esito.isEngineDriven,
      accessibile: esito.accessibile,
      cfuMancanti: esito.cfuMancanti,
      verificaManuale:
        esito.engineSource === 'NEW_ENGINE' ? flagVerificaManuale(esito) : 'n/d (legacy)',
      riferimento: esito.engineSource === 'NEW_ENGINE' ? riferimentoDM(esito) : 'matrice demo legacy',
    });
  }
  return righe;
}

function stampaMatrice(righe: RigaScan[]): void {
  console.log('┌────────┬───────────────┬──────────────┬─────────────┬──────────────┬──────────────┬────────────────────────────────────────────┐');
  console.log('│ Classe │ engineSource  │ engineDriven │ accessibile │ cfuMancanti  │ manuale      │ riferimento                                │');
  console.log('├────────┼───────────────┼──────────────┼─────────────┼──────────────┼──────────────┼────────────────────────────────────────────┤');
  for (const riga of righe) {
    console.log(
      `│ ${riga.classeCodice.padEnd(6)} │ ${riga.engineSource.padEnd(13)} │ ${String(riga.isEngineDriven).padEnd(12)} │ ${String(riga.accessibile).padEnd(11)} │ ${String(riga.cfuMancanti).padEnd(12)} │ ${String(riga.verificaManuale).padEnd(12)} │ ${riga.riferimento.padEnd(42)} │`,
    );
  }
  console.log('└────────┴───────────────┴──────────────┴─────────────┴──────────────┴──────────────┴────────────────────────────────────────────┘');
}

function testMultiClasseScan(): void {
  const righe = eseguiScanMultiClasse();
  assert(righe.length === CLASSI_SCAN.length, 'scan completo su tutte le classi richieste');

  for (const classeCodice of ['A-11', 'A-12', 'A-22']) {
    const riga = righe.find((r) => r.classeCodice === classeCodice);
    assert(Boolean(riga), `${classeCodice} presente nella matrice`);
    assert(riga!.engineSource === 'NEW_ENGINE', `${classeCodice} valutata dal nuovo engine`);
    assert(riga!.isEngineDriven === true, `${classeCodice}: isEngineDriven true`);
    assert(riga!.riferimento.includes('DM 22/12/2023'), `${classeCodice}: traceability DM preservata`);
    assert(riga!.accessibile === false, `${classeCodice}: Marco (48 CFU) non ancora ammissibile`);
    assert(riga!.cfuMancanti > 0, `${classeCodice}: deficit quantificato > 0`);
    assert(riga!.verificaManuale === true, `${classeCodice}: NOT_SPECIFIED ⇒ verifica manuale richiesta`);
  }

  for (const classe of ['A-99']) {
    const riga = righe.find((r) => r.classeCodice === classe);
    assert(Boolean(riga), `${classe} presente`);
    assert(riga!.engineSource === 'LEGACY_FALLBACK', `${classe}: LEGACY_FALLBACK`);
    assert(riga!.isEngineDriven === false, `${classe}: non engine-driven`);
    assert(riga!.accessibile === false, `${classe}: non accessibile`);
  }

  const rigaA26 = righe.find((r) => r.classeCodice === 'A-26');
  assert(Boolean(rigaA26), 'A-26 presente');
  assert(rigaA26!.engineSource === 'LEGACY_FALLBACK', 'A-26: classe demo → LEGACY_FALLBACK');
  assert(rigaA26!.cfuMancanti === 24, 'A-26: logica legacy demo attiva (24 CFU matematici mancanti)');
  assert(rigaA26!.isEngineDriven === false, 'A-26: legacy');

  // Nessuna contaminazione di stato tra chiamate ripetute.
  const secondaChiamata = eseguiScanMultiClasse();
  for (let indice = 0; indice < righe.length; indice += 1) {
    assert(
      righe[indice]!.engineSource === secondaChiamata[indice]!.engineSource &&
        righe[indice]!.accessibile === secondaChiamata[indice]!.accessibile &&
        righe[indice]!.cfuMancanti === secondaChiamata[indice]!.cfuMancanti,
      `${righe[indice]!.classeCodice}: scan ripetuto identico (nessuna contaminazione)`,
    );
  }

  stampaMatrice(righe);
  console.log('  ✓ Multi-class scan: esiti indipendenti e riproducibili per ogni classe.');
}


/* ------------------------------ Entry legacy analizzaPercorsoDiStudi ------------------------------ */

function testAnalizzaPercorsoMultiClasse(): void {
  const diagnosi = analizzaPercorsoDiStudi(MARCO_ESAMI);

  assert(diagnosi.esamiAnalizzati.length === 5, 'diagnosi: i 5 esami di Marco preservati');
  assert(diagnosi.cfuTotali === cfuTotaliMarco(), 'diagnosi: 48 CFU totali');
  assert(diagnosi.cfuTotali === 48, 'diagnosi: cfuTotali = 48');
  assert(Array.isArray(diagnosi.cfuPerAmbito), 'diagnosi: cfuPerAmbito array');

  const tuttiGliEsiti = [...diagnosi.classiAccessibili, ...diagnosi.classiSecondarie];
  assert(tuttiGliEsiti.length > 0, 'diagnosi: esiti classi presenti');
  assert(
    tuttiGliEsiti.every(
      (esito) => (esito as EsitoClasseConRouting).engineSource === 'LEGACY_FALLBACK',
    ),
    'diagnosi: le classi della matrice demo restano su logica legacy',
  );
  assert(
    [...diagnosi.classiAccessibili, ...diagnosi.classiSecondarie].some(
      (esito) => esito.classe.codice === 'A-26' || esito.classe.codice === 'A-20',
    ),
    'diagnosi: matrice A-26/A-20 presente',
  );

  const classeTarget = tuttiGliEsiti.find((esito) => esito.classe.codice === 'A-26');
  assert(Boolean(classeTarget), 'A-26 tra gli esiti della diagnosi');
  assert(classeTarget!.cfuMancanti === 24, 'A-26 nella diagnosi: deficit legacy = 24');

  console.log('  ✓ analizzaPercorsoDiStudi: multi-classe su matrice demo senza effetti collaterali.');
}

/* ------------------------------ Runner ------------------------------ */

console.log('Multi-Class Scan — Marco (LM-14) valutato su A-11, A-12, A-22, A-26, A-99');
console.log(`Esami: ${MARCO_ESAMI.length} · CFU totali: ${cfuTotaliMarco()} · Titolo: LM-14`);
testMultiClasseScan();
testAnalizzaPercorsoMultiClasse();
console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);


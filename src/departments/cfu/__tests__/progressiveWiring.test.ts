/**
 * ScuoleRadar.it — Dipartimento CFU · Progressive Wiring test.
 *
 * Verifica che il calcolatore LEGACY (`calcolatore/analisi.ts`) deleghi al nuovo
 * engine quando esiste una regola ATTIVA nel SourceRegistry condiviso e che
 * ricada esplicitamente sulla logica legacy in tutti gli altri casi, con
 * metadata `engineSource: 'NEW_ENGINE' | 'LEGACY_FALLBACK'` e con un data
 * contract 100% compatibile con la UI legacy (EsitoClasse).
 */
import {
  analizzaPercorsoDiStudi,
  valutaClasseConRouting,
} from '../calcolatore/analisi';
import type { Esame, EsitoClasse } from '../shared/types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ Fixture esami (shape legacy) ------------------------------ */

/** Carriera LM-14 completa per A-11 (96 CFU, tutti i vincoli verbatim). */
const ESAMI_A11_ELIGIBILE: Esame[] = [
  { id: 'e1', denominazione: 'Lingua e letteratura latina', cfu: 12, ssd: 'L-FIL-LET/04', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e2', denominazione: 'Filologia classica', cfu: 12, ssd: 'L-FIL-LET/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e3', denominazione: 'Linguistica italiana', cfu: 12, ssd: 'L-FIL-LET/12', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e4', denominazione: 'Filologia (L-FIL-LET/01)', cfu: 6, ssd: 'L-FIL-LET/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e5', denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e6', denominazione: 'Storia romana', cfu: 12, ssd: 'L-ANT/03', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e7', denominazione: 'Storia medievale I', cfu: 18, ssd: 'M-STO/01', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'e8', denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01', fonte: 'manuale', affidabilita: 'alta' },
];

/** Carriera matematica per la classe demo legacy A-26 (24 CFU ambito matematica). */
const ESAMI_A26_LEGACY: Esame[] = [
  { id: 'm1', denominazione: 'Analisi matematica I', cfu: 12, ssd: 'MAT/05', fonte: 'manuale', affidabilita: 'alta' },
  { id: 'm2', denominazione: 'Algebra', cfu: 12, ssd: 'MAT/02', fonte: 'manuale', affidabilita: 'alta' },
];

/* ------------------------------ Helper: verifica del data contract legacy ------------------------------ */

function verificaContrattoLegacy(esito: EsitoClasse, etichetta: string): void {
  assert(Boolean(esito.classe), `${etichetta}: classe presente`);
  assert(typeof esito.classe.codice === 'string' && esito.classe.codice.length > 0, `${etichetta}: classe.codice`);
  assert(typeof esito.classe.denominazione === 'string', `${etichetta}: classe.denominazione`);
  assert(esito.classe.tabella === 'A' || esito.classe.tabella === 'B', `${etichetta}: classe.tabella`);
  assert(
    esito.classe.ordineScuola === 'secondaria-1-grado' ||
      esito.classe.ordineScuola === 'secondaria-2-grado',
    `${etichetta}: classe.ordineScuola`,
  );
  assert(Array.isArray(esito.classe.requisiti), `${etichetta}: classe.requisiti`);
  assert(typeof esito.classe.requisitiDemo === 'boolean', `${etichetta}: classe.requisitiDemo`);
  assert(Array.isArray(esito.coperture), `${etichetta}: coperture`);
  assert(typeof esito.cfuMancanti === 'number', `${etichetta}: cfuMancanti`);
  assert(typeof esito.accessibile === 'boolean', `${etichetta}: accessibile`);
}

/* ------------------------------ Test 1: A-11 → NEW_ENGINE via Bridge ------------------------------ */

function testA11RottaSuNewEngine(): void {
  const esito = valutaClasseConRouting({
    esami: ESAMI_A11_ELIGIBILE,
    classeCodice: 'A-11',
    denominazione: 'Discipline letterarie e latino nei licei e nell’istituto magistrale',
    tabella: 'A',
    classeLaureaTitolo: 'LM-14',
  });

  assert(
    esito.engineSource === 'NEW_ENGINE',
    `A-11 attesa su NEW_ENGINE, ottenuto ${esito.engineSource}`,
  );
  assert(esito.isEngineDriven === true, 'A-11: isEngineDriven true');
  assert(esito.accessibile === true, 'A-11: carriera ammissibile via engine');
  assert(esito.cfuMancanti === 0, 'A-11: nessun CFU mancante');
  assert(esito.classe.codice === 'A-11', 'A-11: classe.codice corretto');
  verificaContrattoLegacy(esito, 'A-11 (NEW_ENGINE)');

  // Il result resta tipizzabile come EsitoClasse legacy (data contract).
  const legacyView: EsitoClasse = esito;
  assert(legacyView.accessibile === true, 'A-11: view legacy accessibile');
  console.log('  ✓ A-11 (regole ATTIVE seminate): routed a NEW_ENGINE via Bridge.');
}

/* ------------------------------ Test 2: A-26 → LEGACY_FALLBACK ------------------------------ */

function testA26RicadeSuLegacy(): void {
  const esito = valutaClasseConRouting({
    esami: ESAMI_A26_LEGACY,
    classeCodice: 'A-26',
    denominazione: 'Matematica',
    tabella: 'A',
  });

  assert(
    esito.engineSource === 'LEGACY_FALLBACK',
    `A-26 (non seminata) attesa su LEGACY_FALLBACK, ottenuto ${esito.engineSource}`,
  );
  assert(esito.isEngineDriven === false, 'A-26: non engine-driven');
  // La logica legacy demo (24 CFU ambito matematico-informatico) resta attiva.
  assert(esito.accessibile === true, 'A-26: calcolo legacy accessibile (24 CFU matematici)');
  assert(esito.cfuMancanti === 0, 'A-26: deficit legacy = 0');
  assert(esito.classe.codice === 'A-26', 'A-26: classe.codice legacy');
  assert(esito.classe.requisitiDemo === true, 'A-26: classe demo legacy');
  verificaContrattoLegacy(esito, 'A-26 (LEGACY_FALLBACK)');
  console.log('  ✓ A-26 (non seminata): routed a LEGACY_FALLBACK senza eccezioni.');
}

/* ------------------------------ Test 3: A-99 → fallback legacy senza crash ------------------------------ */

function testA99MaiInCatastoSicuro(): void {
  let esito:
    | { engineSource?: string; accessibile?: boolean; classe?: { codice?: string } }
    | undefined;
  try {
    esito = valutaClasseConRouting({
      esami: ESAMI_A11_ELIGIBILE,
      classeCodice: 'A-99',
      denominazione: 'Classe non nota',
      tabella: 'A',
    });
  } catch {
    assert(false, 'A-99 non deve MAI lanciare eccezioni');
  }
  assert(Boolean(esito), 'A-99: esito presente');
  assert(esito!.engineSource === 'LEGACY_FALLBACK', 'A-99: fallback legacy esplicito');
  assert(esito!.accessibile === false, 'A-99: non accessibile');
  assert(esito!.classe?.codice === 'A-99', 'A-99: shape legacy con codice richiesto');
  verificaContrattoLegacy(esito as EsitoClasse, 'A-99 (LEGACY_FALLBACK)');
  console.log('  ✓ A-99 (classe sconosciuta): fallback legacy, nessun throw.');
}

/* ------------------------------ Test 4: entry legacy analizzaPercorsoDiStudi intatta ------------------------------ */

function testEntryLegacyAnalizzaIntatta(): void {
  const diagnosi = analizzaPercorsoDiStudi(ESAMI_A26_LEGACY);
  assert(diagnosi.esamiAnalizzati.length === 2, 'diagnosi: esami preservati');
  assert(diagnosi.cfuTotali === 24, 'diagnosi: cfuTotali = 24');
  assert(Array.isArray(diagnosi.classiAccessibili), 'diagnosi: classiAccessibili array');
  assert(Array.isArray(diagnosi.classiSecondarie), 'diagnosi: classiSecondarie array');
  assert(
    [...diagnosi.classiAccessibili, ...diagnosi.classiSecondarie].some(
      (e) => e.classe.codice === 'A-26',
    ),
    'diagnosi: matrice legacy ancora valutata (A-26 presente)',
  );
  const primoEsito = diagnosi.classiAccessibili[0] ?? diagnosi.classiSecondarie[0];
  assert(Boolean(primoEsito), 'diagnosi: almeno un esito classe');
  verificaContrattoLegacy(primoEsito!, 'diagnosi');
  console.log('  ✓ analizzaPercorsoDiStudi: firma e output legacy invariati (nessuna UI toccata).');
}

/* ------------------------------ Runner ------------------------------ */

console.log('Progressive Wiring — calcolatore legacy → CFU Engine con fallback esplicito');
testA11RottaSuNewEngine();
testA26RicadeSuLegacy();
testA99MaiInCatastoSicuro();
testEntryLegacyAnalizzaIntatta();
console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);


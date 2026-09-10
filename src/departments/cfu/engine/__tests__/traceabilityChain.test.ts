/**
 * ScuoleRadar.it — Dipartimento CFU · Traceability Chain test.
 *
 * Dimostra la catena minima Source → Evidence → Proposition → Relation → Rule
 * su dati dimostrativi basati sul testo verbatim già ingerito
 * (DM 22/12/2023 — G.U. N. 34 del 10/02/2024 — Tabella A, classe A-11 / LM-14).
 * Nessuna dipendenza esterna: solo TypeScript puro + registri in-memory.
 */
import {
  creaEvidence,
  creaProposition,
  creaRegistroCatena,
  creaRelation,
  creaRule,
  creaSource,
  tracciaRegola,
  tracciaRelazione,
  validaRegola,
  validaRelation,
  valutaVincoloCFU,
  type Evidence,
  type Rule,
  type Source,
} from '../traceability/traceabilityChain';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/** Hash dimostrativo — SHA-256 del file raw già verificato dal Source Gate. */
const HASH_FONTE =
  '1a691b6006cb1d0cfd2ae20fb66d47eeba993ed5a742a35955952b19133cdd0a';

/* ------------------------------ 1. Source ------------------------------ */

function costruisciCatena() {
  const source: Source = creaSource({
    id: 'src-dm22122023-tabella-A',
    hash: HASH_FONTE,
    autorita: 'MIM',
    titolo: 'DM 22/12/2023 — Tabella A — Classe A-11 (titolo LM-14)',
    tipoDocumento: 'tabella',
    pubblicazione: {
      riferimento: 'G.U. N. 34 del 10/02/2024',
      data: '2024-02-10',
      articoloNota: 'Tabella A — Classe A-11',
    },
    rawFilePath: 'sources/raw/DM_22_12_2023_A11_LM14.txt',
    stato: 'ACTIVE',
  });

  /* ------------------------------ 2. Evidence ------------------------------ */

  const eGruppo2405: Evidence = creaEvidence({
    id: 'ev-gruppo-2405',
    sourceHash: HASH_FONTE,
    testo:
      'almeno 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, con almeno 12 CFU in L-FIL-LET/04',
    coordinate: { pagina: 1, riga: 3 },
  });
  const eGruppo1012: Evidence = creaEvidence({
    id: 'ev-gruppo-1012',
    sourceHash: HASH_FONTE,
    testo: 'almeno 12 CFU tra L-FIL-LET/10 e L-FIL-LET/12',
    coordinate: { pagina: 1, riga: 4 },
  });
  const eDisgiunzioneLant: Evidence = creaEvidence({
    id: 'ev-disgiunzione-lant',
    sourceHash: HASH_FONTE,
    testo: 'almeno 12 CFU tra L-ANT/02 o L-ANT/03',
    coordinate: { pagina: 1, riga: 5 },
  });
  const eNotaAccesso: Evidence = creaEvidence({
    id: 'ev-nota-accesso-diretto',
    sourceHash: HASH_FONTE,
    testo: 'Le lauree che comprendono i CFU indicati sono titoli di accesso diretti',
    coordinate: { pagina: 1, riga: 6 },
  });

  /* ------------------------------ 3. Proposition ------------------------------ */

  const pGruppo2405 = creaProposition({
    id: 'prop-2405',
    contenutoAtomico:
      'La laurea magistrale LM-14 richiede almeno 24 CFU complessivi tra L-FIL-LET/04 e L-FIL-LET/05.',
    evidenze: [eGruppo2405],
    stato: 'ACTIVE',
  });
  const pSotto0405 = creaProposition({
    id: 'prop-sotto-04',
    contenutoAtomico:
      'Dei 24 CFU tra L-FIL-LET/04 e L-FIL-LET/05, almeno 12 devono essere in L-FIL-LET/04.',
    evidenze: [eGruppo2405],
    stato: 'ACTIVE',
  });
  const p1012 = creaProposition({
    id: 'prop-1012',
    contenutoAtomico:
      'Sono richiesti almeno 12 CFU complessivi tra L-FIL-LET/10 e L-FIL-LET/12.',
    evidenze: [eGruppo1012],
    stato: 'UNCERTAIN',
  });
  const pLant = creaProposition({
    id: 'prop-lant',
    contenutoAtomico:
      'Sono richiesti almeno 12 CFU in ALMENO UNO tra L-ANT/02 e L-ANT/03.',
    evidenze: [eDisgiunzioneLant],
    stato: 'ACTIVE',
  });
  const pAccessoDiretto = creaProposition({
    id: 'prop-accesso-diretto',
    contenutoAtomico:
      'Le lauree che comprendono i CFU indicati nella riga sono titoli di accesso diretti alla classe.',
    evidenze: [eNotaAccesso],
    stato: 'PROPOSED',
  });

  /* ------------------------------ 4. Relation ------------------------------ */

  const relApplicazione = creaRelation({
    id: 'rel-applies-a11-2024',
    tipo: 'APPLIES_FROM',
    soggetto: { tipo: 'proposition', id: pAccessoDiretto.id },
    oggetto: { tipo: 'contesto', id: 'procedure-concorsuali-dal-2024-02-10' },
    evidenze: [eNotaAccesso],
    stato: 'ACTIVE',
    nota: 'Il titolo di accesso diretto vale dalla pubblicazione in G.U. (10/02/2024).',
  });


  /* ------------------------------ 5. Rule (computabili) ------------------------------ */

  const regola2405: Rule = creaRule({
    id: 'rule-2405',
    proposizioneId: pGruppo2405.id,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/04', 'L-FIL-LET/05'],
      minCfu: 24,
    },
  });
  const regola04: Rule = creaRule({
    id: 'rule-04-singolo',
    proposizioneId: pSotto0405.id,
    vincolo: { tipo: 'singoloSsdMinCfu', ssd: 'L-FIL-LET/04', minCfu: 12 },
  });
  const regola1012: Rule = creaRule({
    id: 'rule-1012',
    proposizioneId: p1012.id,
    vincolo: {
      tipo: 'gruppoSsdMinCfu',
      ssd: ['L-FIL-LET/10', 'L-FIL-LET/12'],
      minCfu: 12,
    },
    stato: 'MANUAL_VERIFICATION_REQUIRED',
    nota: 'La resa "tra … e …" come cumulativo richiede verifica manuale.',
  });
  const regolaLant: Rule = creaRule({
    id: 'rule-lant-or',
    proposizioneId: pLant.id,
    vincolo: {
      tipo: 'disgiunzioneMinCfu',
      opzioni: [
        { id: 'opzione-lant-02', ssd: ['L-ANT/02'], minCfu: 12 },
        { id: 'opzione-lant-03', ssd: ['L-ANT/03'], minCfu: 12 },
      ],
    },
  });

  /* ------------------------------ Registro condiviso ------------------------------ */

  const registro = creaRegistroCatena({
    fonti: [source],
    proposizioni: [pGruppo2405, pSotto0405, p1012, pLant, pAccessoDiretto],
    relazioni: [relApplicazione],
    regole: [regola2405, regola04, regola1012, regolaLant],
  });

  return {
    source,
    eGruppo2405,
    eNotaAccesso,
    pGruppo2405,
    pSotto0405,
    relApplicazione,
    regola2405,
    regola04,
    regola1012,
    regolaLant,
    registro,
  };
}

/* ------------------------------ Test ------------------------------ */

function testCatena(): void {
  const {
    source,
    eGruppo2405,
    eNotaAccesso,
    pGruppo2405,
    pSotto0405,
    relApplicazione,
    regola2405,
    regola04,
    regola1012,
    regolaLant,
    registro,
  } = costruisciCatena();

  // Validazione strutturale: ogni regola e relazione è tracciata e registrata.
  for (const regola of [regola2405, regola04, regola1012, regolaLant]) {
    const verifica = validaRegola(regola, registro);
    assert(verifica.valida, `catena regola ${regola.id} valida: ${verifica.problemi.join('; ')}`);
  }
  const verificaRelazione = validaRelation(relApplicazione, registro);
  assert(
    verificaRelazione.valida,
    `catena relation valida: ${verificaRelazione.problemi.join('; ')}`,
  );

  // Tracciabilità al 100%: Rule → Proposition → Evidence → Source hash.
  for (const regola of [regola2405, regola04, regola1012, regolaLant]) {
    const catena = tracciaRegola(regola, registro);
    assert(Boolean(catena), `catena di ${regola.id} ricostruita`);
    assert(
      catena!.fonteHash.length === 1 && catena!.fonteHash[0] === HASH_FONTE,
      `${regola.id} risale all'unica Source (hash ${HASH_FONTE})`,
    );
    assert(
      catena!.proposizioneId === regola.proposizioneId,
      `${regola.id} referenzia la propria proposizione`,
    );
  }
  const catena04 = tracciaRegola(regola04, registro);
  assert(
    catena04!.evidenze.includes(eGruppo2405.id),
    'rule-04 condivide la evidence del rigo L-FIL-LET/04',
  );

  const catenaRelazione = tracciaRelazione(relApplicazione);
  assert(
    catenaRelazione.fonteHash.length === 1 && catenaRelazione.fonteHash[0] === HASH_FONTE,
    'relation tracciata alla stessa Source',
  );
  assert(catenaRelazione.evidenze.includes(eNotaAccesso.id), 'relation supportata da Evidence');
  assert(catenaRelazione.evidenze.length >= 1, 'relation con Evidence obbligatorie');

  // Computabilità pura dei vincoli.
  const creditiOk = new Map<string, number>([
    ['L-FIL-LET/04', 12],
    ['L-FIL-LET/05', 12],
    ['L-FIL-LET/12', 12],
    ['L-ANT/02', 12],
  ]);
  assert(valutaVincoloCFU(regola2405.vincolo, creditiOk).soddisfatto === true, 'gruppo 24 ok');
  assert(valutaVincoloCFU(regola04.vincolo, creditiOk).soddisfatto === true, 'singolo 04 ok');
  assert(valutaVincoloCFU(regola1012.vincolo, creditiOk).soddisfatto === true, 'gruppo 10/12 ok');
  const esitoLant = valutaVincoloCFU(regolaLant.vincolo, creditiOk);
  assert(esitoLant.soddisfatto === true && esitoLant.cfuMancanti === 0, 'OR L-ANT/02 soddisfatto');

  const creditiSplit = new Map<string, number>([
    ['L-ANT/02', 6],
    ['L-ANT/03', 6],
  ]);
  const esitoSplit = valutaVincoloCFU(regolaLant.vincolo, creditiSplit);
  assert(esitoSplit.soddisfatto === false, '6+6 non soddisfa la disgiunzione');
  assert(esitoSplit.cfuMancanti === 6, 'deficit 6 sulla migliore opzione');

  // Immutabilità runtime.
  let mutazioneBloccata = false;
  try {
    (source as unknown as { titolo: string }).titolo = 'alterata';
  } catch {
    mutazioneBloccata = true;
  }
  assert(mutazioneBloccata === true, 'Source immutabile (Object.freeze)');

  console.log('  ✓ Source immutabile con hash:', source.hash.slice(0, 12) + '…');
  console.log('  ✓ Evidence → Proposition → Rule: tracciabilità 100% verso la Source.');
  console.log('  ✓ Relation APPLIES_FROM con Evidence obbligatorie e tracciabilità.');
  console.log('  ✓ Rule computabili: gruppo, singolo, disgiunzione (6+6 ≠ 12).');
  console.log('  ✓ Stati della catena in uso:', [
    source.stato,
    pGruppo2405.stato,
    pSotto0405.stato,
    regola1012.stato,
    relApplicazione.stato,
  ].join(' / '));
}

/* ------------------------------ Runner ------------------------------ */

console.log('Traceability Chain — Source → Evidence → Proposition → Relation → Rule (modello minimo)');
testCatena();
console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);

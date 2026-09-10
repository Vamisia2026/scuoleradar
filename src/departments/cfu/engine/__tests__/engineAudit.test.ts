/**
 * ScuoleRadar.it — Dipartimento CFU · Engine Audit test (no legal data).
 *
 * Verifica la meccanica del motore SENZA inventare requisiti normativi:
 *  - anti-hallucination (DB vuoto ⇒ INSUFFICIENT_DATA);
 *  - date model attivo;
 *  - minUnoDeiSsd senza doppio conteggio;
 *  - prefix wildcard SSD (prefissi macro CUN, nessuna enumerazione manuale);
 *  - disgiunzione esplicita (EXPLICIT_OR_CONDITION) con OR nell'audit;
 *  - integrabilità tristate;
 *  - SOURCE GATE v2: SHA-256 file integrity, atomic constraint traceability,
 *    registrazione e runtime GRACEFUL (mai eccezioni).
 *
 * I codici sono marcati TEST e NON rappresentano normativa.
 */
import { risolviNormativa } from '../normativeResolver';
import { valutaRequisitoClasse } from '../requirementSolver';
import { caricaRegoleRequisiti } from '../normativeDatabase';
import {
  sha256Hex,
  validaProvenienzaRegola,
  verificaFileRaw,
} from '../sourceGate';
import type {
  EsameCanonico,
  IntegrabilitaStatus,
  NormativaApplicata,
  NormativeRuleEntry,
  TitoloAccademicoCanonico,
  VincoloCfu,
} from '../types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

const NORMATIVA_TEST: NormativaApplicata = {
  decreto: 'DPR 19/2016',
  tabella: 'A',
  dataAggiornamentoNormativa: '2016-02-14',
};

const TITOLO_TEST: TitoloAccademicoCanonico = {
  denominazione: 'Titolo di prova',
  classe: 'TEST-99',
  paese: null,
  titoloEstero: false,
};

/** Testo fittizio che include le frasi atomiche usate nei vincoli di prova. */
const ESTRATTO_TEST =
  'TEST-ONLY: totale 96 CFU; minimo 12 CFU nel settore X-TEST/01; ' +
  'minimo 12 CFU in uno dei settori Y-TEST/01 o Y-TEST/02. ' +
  'macro L-FIL-LET/ con minimo 12 CFU in QUALSIASI sottocodice (TEST). ' +
  'Nessuna norma reale.';

/** Contenuto del "file raw" di prova (SHA-256 calcolato sull'intero testo). */
const FONTE_TEST_FILE = `${ESTRATTO_TEST}\n`;

const EXCERPT_SINGOLO = 'minimo 12 CFU nel settore X-TEST/01';
const EXCERPT_GRUPPO =
  'minimo 12 CFU in uno dei settori Y-TEST/01 o Y-TEST/02';
const EXCERPT_PREFISSO =
  'macro L-FIL-LET/ con minimo 12 CFU in QUALSIASI sottocodice (TEST)';
const LOCATION_TEST = 'TEST — riga audit (nessuna norma)';

function esame(ssd: string, cfu: number): EsameCanonico {
  return {
    id: `${ssd}-${cfu}`,
    denominazione: `Esame ${ssd}`,
    cfu,
    ssd,
    fonte: 'manuale',
    provenienza: [],
  };
}

function vincoloSingolo(ssd: string, min: number): VincoloCfu {
  return {
    id: `minimo-${ssd}`,
    tipo: 'singoloSsd',
    ssd,
    min,
    sourceExcerpt: EXCERPT_SINGOLO,
    sourceLocation: LOCATION_TEST,
  };
}

function vincoloGruppo(): VincoloCfu {
  return {
    id: 'gruppo-test',
    tipo: 'gruppoSsd',
    ssd: ['Y-TEST/01', 'Y-TEST/02'],
    min: 12,
    minUnoDeiSsd: 12,
    distribuzione: 'TEST: 12 CFU in ALMENO UNO dei due settori.',
    sourceExcerpt: EXCERPT_GRUPPO,
    sourceLocation: LOCATION_TEST,
  };
}

function vincoloPrefissoMacro(): VincoloCfu {
  return {
    id: 'prefisso-test',
    tipo: 'gruppoSsd',
    // PREFIX PATTERN CUN: copre L-FIL-LET/01 … L-FIL-LET/15 senza enumerarli.
    ssd: ['L-FIL-LET/'],
    min: 12,
    sourceExcerpt: EXCERPT_PREFISSO,
    sourceLocation: LOCATION_TEST,
  };
}

function vincoloDisgiunzione(): VincoloCfu {
  return {
    id: 'disgiunzione-test',
    tipo: 'disgiunzioneSsd',
    opzioni: [
      { id: 'opt-y-test-01', ssd: ['Y-TEST/01'], min: 12, nota: '12 CFU in Y-TEST/01' },
      { id: 'opt-y-test-02', ssd: ['Y-TEST/02'], min: 12, nota: '12 CFU in Y-TEST/02' },
    ],
    disgiunzioneEsplicita: 'At least 12 CFU required in EITHER Y-TEST/01 OR Y-TEST/02',
    sourceExcerpt: EXCERPT_GRUPPO,
    sourceLocation: LOCATION_TEST,
  };
}

/** Hash fittizio valido nel FORMATO (64 hex) per i soli test statici. */
const SHA_PLACEHOLDER = '0'.repeat(64);

function regolaTest(
  id: string,
  vincoli: VincoloCfu[],
  integrabilita?: IntegrabilitaStatus,
): NormativeRuleEntry {
  return {
    id,
    rawSourceFilePath: 'sources/raw/TEST-AUDIT.txt',
    estrattoVerbatim: ESTRATTO_TEST,
    rawSourceSha256: SHA_PLACEHOLDER,
    sourceStatus: 'VERIFIED',
    provisione: 'TEST — nessun contenuto normativo reale',
    decreto: 'DPR 19/2016',
    tabella: 'A',
    classeCodice: 'TEST-CLASSE',
    vincoli,
    integrabilita,
    fonte: 'TEST-ONLY (nessuna norma)',
    dataAggiornamentoNormativa: '2016-02-14',
  };
}

/* ------------------------------ 1. Anti-hallucination ------------------------------ */

function testAntiHallucination(): void {
  const risultato = valutaRequisitoClasse('TEST-CLASSE', [esame('X-TEST/01', 12)], {
    regole: [],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    risultato.stato === 'INSUFFICIENT_DATA',
    `Nessuna regola deve dare INSUFFICIENT_DATA, ottenuto ${risultato.stato}`,
  );
  console.log('  ✓ Anti-hallucination: DB regole vuoto ⇒ INSUFFICIENT_DATA.');
}

/* ------------------------------ 2. Date model (resolver attivo) ------------------------------ */

function testDateModel(): void {
  const contestiTest = [
    {
      id: 'ctx-test-dm',
      decreto: 'DM 259/2017' as const,
      tabella: 'A' as const,
      validFrom: '2024-01-01',
      fonte: 'TEST-ONLY',
      dataAggiornamentoNormativa: '2024-01-01',
    },
  ];

  const risolto = risolviNormativa(
    {
      enrollmentDate: '2019-10-01',
      awardedDate: '2022-11-18',
      procedureDate: '2024-06-01',
    },
    contestiTest,
  );
  assert(risolto.stato === 'transitorio', 'awardedDate presente ⇒ stato transitorio');
  assert(risolto.normativa?.decreto === 'DM 259/2017', 'procedureDate deve selezionare il contesto');

  const senzaProcedura = risolviNormativa(
    { enrollmentDate: '2019-10-01', awardedDate: '2022-11-18' },
    contestiTest,
  );
  assert(senzaProcedura.stato === 'non-risolto', 'senza procedureDate ⇒ non-risolto');

  const fuoriFinestra = risolviNormativa(
    { enrollmentDate: '2019-10-01', awardedDate: '2022-11-18', procedureDate: '2023-01-01' },
    contestiTest,
  );
  assert(fuoriFinestra.stato === 'non-risolto', 'data fuori finestra ⇒ non-risolto');
  console.log('  ✓ Date model: enrollment/awarded/procedure usati attivamente dal resolver.');
}

/* ------------------------------ 3. minUnoDeiSsd (no double-count) ------------------------------ */

function testMinUnoDeiSsd(): void {
  const gruppo = regolaTest('test-minuno', [vincoloGruppo()]);

  const divisi = valutaRequisitoClasse(
    'TEST-CLASSE',
    [esame('Y-TEST/01', 6), esame('Y-TEST/02', 6)],
    { regole: [gruppo], titolo: TITOLO_TEST, normativa: NORMATIVA_TEST },
  );
  const esitoDivisi = divisi.esitiVincoli[0];
  assert(esitoDivisi.cfuPosseduti === 12, 'totale gruppo = 12 (nessun doppio conteggio)');
  assert(esitoDivisi.cfuMancanti === 6, 'minUno non rispettato ⇒ deficit 6');
  assert(esitoDivisi.soddisfatto === false, '6+6 non deve soddisfare il minimo "in uno dei"');

  const singolo = valutaRequisitoClasse('TEST-CLASSE', [esame('Y-TEST/01', 12)], {
    regole: [gruppo],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    singolo.esitiVincoli[0].soddisfatto === true,
    '12 CFU in un solo SSD del gruppo devono soddisfare il vincolo',
  );
  console.log('  ✓ minUnoDeiSsd: nessun doppio conteggio; split 6+6 non soddisfa, 12 singolo sì.');
}

/* ------------------------------ 3b. Prefix wildcard SSD (CUN) ------------------------------ */

function testPrefissoMacro(): void {
  const regola = regolaTest('test-prefix', [vincoloPrefissoMacro()]);

  // L-FIL-LET/01 + L-FIL-LET/15 NON sono elencati nel vincolo: il prefix
  // wildcard li copre entrambi → nessuna enumerazione manuale necessaria.
  const coperto = valutaRequisitoClasse(
    'TEST-CLASSE',
    [esame('L-FIL-LET/01', 7), esame('L-FIL-LET/15', 5)],
    { regole: [regola], titolo: TITOLO_TEST, normativa: NORMATIVA_TEST },
  );
  const esitoCoperto = coperto.esitiVincoli[0];
  assert(esitoCoperto.cfuPosseduti === 12, 'prefix L-FIL-LET/ copre /01 e /15 (12 CFU)');
  assert(esitoCoperto.soddisfatto === true, 'prefisso macro deve soddisfare il minimo');

  const insufficiente = valutaRequisitoClasse(
    'TEST-CLASSE',
    [esame('L-FIL-LET/09', 11)],
    { regole: [regola], titolo: TITOLO_TEST, normativa: NORMATIVA_TEST },
  );
  assert(insufficiente.esitiVincoli[0].cfuMancanti === 1, 'deficit corretto con prefix wildcard');

  const estraneo = valutaRequisitoClasse(
    'TEST-CLASSE',
    [esame('M-STO/01', 12)],
    { regole: [regola], titolo: TITOLO_TEST, normativa: NORMATIVA_TEST },
  );
  assert(estraneo.esitiVincoli[0].cfuPosseduti === 0, 'M-STO/01 non è coperto da L-FIL-LET/');

  // Un prefisso NON registrato nella tassonomia CUN è rifiutato dal gate
  // strutturale (MAI approssimato): stato MANUAL con motivazione esplicita.
  const junk = {
    ...vincoloPrefissoMacro(),
    id: 'prefisso-junk',
    ssd: ['X-FAKE/'],
  } as VincoloCfu;
  const rifiutato = valutaRequisitoClasse('TEST-CLASSE', [esame('X-FAKE/01', 12)], {
    regole: [regolaTest('test-prefix-junk', [junk])],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    rifiutato.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `prefisso non registrato → MANUAL, ottenuto ${rifiutato.stato}`,
  );
  assert(
    rifiutato.audit.some((voce) => voce.messaggio.includes('tassonomia CUN')),
    'motivazione del rifiuto deve citare la tassonomia CUN',
  );
  console.log('  ✓ Prefix wildcard SSD: macro CUN coprono i sottocodici senza enumerazione.');
}

/* ------------------------------ 3c. Disgiunzione esplicita (OR formale) ------------------------------ */

function testDisgiunzioneEsplicita(): void {
  const regola = regolaTest('test-disgiunzione', [vincoloDisgiunzione()]);

  const divisi = valutaRequisitoClasse(
    'TEST-CLASSE',
    [esame('Y-TEST/01', 6), esame('Y-TEST/02', 6)],
    { regole: [regola], titolo: TITOLO_TEST, normativa: NORMATIVA_TEST },
  );
  const esitoDivisi = divisi.esitiVincoli[0];
  assert(esitoDivisi.tipo === 'disgiunzioneSsd', 'esito con tipo disgiunzioneSsd');
  assert(esitoDivisi.cfuPosseduti === 6, '6+6 NON si somma tra opzioni alternative');
  assert(esitoDivisi.cfuMancanti === 6, 'deficit = 12 − 6 della migliore opzione');
  assert(esitoDivisi.soddisfatto === false, 'split 6+6 non soddisfa la disgiunzione');
  assert(
    divisi.audit.some((voce) => voce.messaggio.includes('At least 12 CFU required in EITHER Y-TEST/01 OR Y-TEST/02')),
    "audit deve dichiarare la disgiunzione esplicita EITHER … OR",
  );

  const solo02 = valutaRequisitoClasse('TEST-CLASSE', [esame('Y-TEST/02', 12)], {
    regole: [regola],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    solo02.esitiVincoli[0].soddisfatto === true,
    '12 CFU in UNA sola opzione devono soddisfare la disgiunzione',
  );
  console.log('  ✓ Disgiunzione esplicita: EXPLICIT_OR_CONDITION, 6+6≠12, EITHER…OR in audit.');
}

/* ------------------------------ 4. Integrabilità tristate ------------------------------ */

function testTristateIntegrabilita(): void {
  const vincoloUnico = vincoloSingolo('X-TEST/01', 12);
  const esamiConDeficit = [esame('X-TEST/01', 6)];

  const casi: { stato: IntegrabilitaStatus | undefined; atteso: string }[] = [
    { stato: 'NOT_SPECIFIED', atteso: 'MANUAL_VERIFICATION_REQUIRED' },
    { stato: undefined, atteso: 'MANUAL_VERIFICATION_REQUIRED' },
    { stato: 'PROHIBITED', atteso: 'NOT_ELIGIBLE' },
    { stato: 'ALLOWED', atteso: 'CONDITIONALLY_ELIGIBLE' },
  ];

  for (const caso of casi) {
    const regola = regolaTest(`test-${caso.stato ?? 'absent'}`, [vincoloUnico], caso.stato);
    const esito = valutaRequisitoClasse('TEST-CLASSE', esamiConDeficit, {
      regole: [regola],
      titolo: TITOLO_TEST,
      normativa: NORMATIVA_TEST,
    });
    assert(
      esito.stato === caso.atteso,
      `integrabilita=${caso.stato ?? 'assente'} atteso ${caso.atteso}, ottenuto ${esito.stato}`,
    );
  }

  const mista = valutaRequisitoClasse('TEST-CLASSE', esamiConDeficit, {
    regole: [
      regolaTest('mix-1', [vincoloUnico], 'PROHIBITED'),
      regolaTest('mix-2', [vincoloUnico], 'ALLOWED'),
    ],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    mista.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `mix PROHIBITED/ALLOWED atteso MANUAL, ottenuto ${mista.stato}`,
  );
  console.log('  ✓ Integrabilità tristate: ALLOWED/PROHIBITED/NOT_SPECIFIED e mix.');
}


/* ------------------------------ 5. Source Gate v2 ------------------------------ */

async function testSourceGateV2(): Promise<void> {
  // 5.1 SHA-256 (WebCrypto) deterministico.
  const shaA = await sha256Hex(FONTE_TEST_FILE);
  const shaB = await sha256Hex(FONTE_TEST_FILE);
  assert(/^[0-9a-f]{64}$/.test(shaA), 'sha256 deve essere esadecimale a 64 caratteri');
  assert(shaA === shaB, 'sha256 deterministico');

  // 5.2 Ogni vincolo atomico ha excerpt + location e cita l'estratto.
  const regolaBase = regolaTest('sha-rule', [
    vincoloSingolo('X-TEST/01', 12),
    vincoloGruppo(),
  ]);
  for (const vincolo of regolaBase.vincoli) {
    assert(Boolean(vincolo.sourceExcerpt), `sourceExcerpt presente (${vincolo.id})`);
    assert(Boolean(vincolo.sourceLocation), `sourceLocation presente (${vincolo.id})`);
    assert(
      ESTRATTO_TEST.includes(vincolo.sourceExcerpt),
      `sourceExcerpt del vincolo ${vincolo.id} citato nell'estratto`,
    );
  }

  // 5.3 File integro: verifica SHA-256 parola-per-parola ok.
  const regolaIntegra: NormativeRuleEntry = { ...regolaBase, rawSourceSha256: shaA };
  const verificaOk = await verificaFileRaw(regolaIntegra, FONTE_TEST_FILE);
  assert(verificaOk.stato === 'verificata', 'file integro deve superare la verifica SHA-256');

  // 5.4 File alterato di un solo carattere → hash diverso → non verificabile.
  const fileAlterato = `${FONTE_TEST_FILE}x`;
  const verificaAlterato = await verificaFileRaw(regolaIntegra, fileAlterato);
  assert(
    verificaAlterato.stato === 'non-verificabile',
    'file alterato deve essere rifiutato',
  );
  assert(
    verificaAlterato.stato === 'non-verificabile' &&
      verificaAlterato.motivo.includes('SHA-256'),
    'motivo del rifiuto deve citare SHA-256',
  );

  // 5.5 Registrazione GRACEFUL con raw corrotto: rifiutata, nessuna eccezione.
  let esitoRegistrazione;
  try {
    esitoRegistrazione = await caricaRegoleRequisiti([regolaIntegra], {
      [regolaIntegra.rawSourceFilePath]: fileAlterato,
    });
  } catch {
    assert(false, 'caricaRegoleRequisiti NON deve lanciare eccezioni');
  }
  assert(esitoRegistrazione!.registrate.length === 0, 'nessuna regola corrotta registrata');
  assert(
    esitoRegistrazione!.rifiutate.some((r) => r.id === 'sha-rule'),
    'regola con file corrotto rifiutata in modo graceful',
  );

  // 5.6 Orphan/UNVERIFIED: gate statico invalido, registrazione rifiutata, runtime INSUFFICIENT_DATA.
  const orfana: NormativeRuleEntry = {
    ...regolaTest('orfana', []),
    rawSourceFilePath: '',
    estrattoVerbatim: '',
    rawSourceSha256: '',
    sourceStatus: 'UNVERIFIED',
  };
  assert(validaProvenienzaRegola(orfana).valida === false, 'orfana fallisce il gate statico');

  let esitoOrfana;
  try {
    esitoOrfana = await caricaRegoleRequisiti([orfana]);
  } catch {
    assert(false, 'registrazione orfana NON deve lanciare eccezioni');
  }
  assert(esitoOrfana!.rifiutate.length === 1, 'orfana rifiutata in modo graceful');

  const nonVerificata: NormativeRuleEntry = {
    ...regolaTest('non-verificata', [vincoloSingolo('X-TEST/01', 12)], 'ALLOWED'),
    sourceStatus: 'UNVERIFIED',
  };
  const esitoSolver = valutaRequisitoClasse('TEST-CLASSE', [esame('X-TEST/01', 6)], {
    regole: [nonVerificata],
    titolo: TITOLO_TEST,
    normativa: NORMATIVA_TEST,
  });
  assert(
    esitoSolver.stato === 'INSUFFICIENT_DATA',
    `regola UNVERIFIED deve dare INSUFFICIENT_DATA, ottenuto ${esitoSolver.stato}`,
  );

  console.log('  ✓ Source Gate v2: SHA-256 integrità file + traceability atomica + fallback graceful.');
}

/* ------------------------------ Run ------------------------------ */

async function main(): Promise<void> {
  console.log('Engine Audit — meccanica + Source Gate v2 (nessun dato normativo inventato)');
  testAntiHallucination();
  testDateModel();
  testMinUnoDeiSsd();
  testPrefissoMacro();
  testDisgiunzioneEsplicita();
  testTristateIntegrabilita();
  await testSourceGateV2();
  console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


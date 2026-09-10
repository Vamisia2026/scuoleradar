/**
 * ScuoleRadar.it — Dipartimento CFU · Vertical Slice #1 (REAL SOURCE).
 *
 * Fonte primaria: DM 22/12/2023 — G.U. N. 34 (10/02/2024) — Tabella A,
 * classe A-11 «Discipline letterarie e latino nei licei e nell'istituto
 * magistrale», laurea magistrale LM-14.
 *
 * Pipeline: documentParser → normalizer → normativeResolver →
 *           requirementSolver → reportEngine
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  costruisciFascicoloDaOcr,
  type PaginaOcr,
  type RigaOcr,
} from '../documentParser';
import { normalizzaFascicolo } from '../normalizer';
import { risolviNormativa } from '../normativeResolver';
import { generaReportCarriera } from '../reportEngine';
import { installaSeedA11, SEED_A11_METADATA } from '../seeds/a11Seed';
import { trovaRegolePerClasse } from '../normativeDatabase';
import { sha256Hex } from '../sourceGate';
import type {
  DateRilevanza,
  EsameCanonico,
  FascicoloAccademicoCanonico,
  NormativeRuleEntry,
} from '../types';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ Fonte e date ------------------------------ */

const DATA: {
  qualification: { enrollmentDate: string; awardedDate: string };
  procedure: { date: string };
} = {
  qualification: { enrollmentDate: '2019-10-01', awardedDate: '2022-11-18' },
  procedure: { date: '2024-03-15' },
};

function dateRilevanza(): DateRilevanza {
  return {
    enrollmentDate: DATA.qualification.enrollmentDate,
    awardedDate: DATA.qualification.awardedDate,
    procedureDate: DATA.procedure.date,
  };
}

/* ------------------------------ Raw source integrity ------------------------------ */

async function verificaRawFonte(): Promise<string> {
  const pathAssoluto = join(
    process.cwd(),
    'src',
    'departments',
    'cfu',
    'engine',
    SEED_A11_METADATA.rawSourceFilePath,
  );
  const contenuto = readFileSync(pathAssoluto, 'utf8');

  assert(contenuto.trim().length > 0, 'file raw non vuoto');
  const shaReale = await sha256Hex(contenuto);
  assert(
    shaReale === SEED_A11_METADATA.rawSourceSha256,
    'SHA-256 del file raw deve corrispondere al rawSourceSha256 dichiarato',
  );
  assert(
    contenuto === SEED_A11_METADATA.testoVerbatim,
    'estrattoVerbatim deve coincidere ESATTAMENTE con il file raw',
  );
  console.log('  ✓ Raw source verificata: SHA-256 =', shaReale);
  return contenuto;
}

/* ------------------------------ Transcript fixtures ------------------------------ */

interface EsameFixture {
  denominazione: string;
  cfu: number;
  ssd: string;
}

/**
 * ELIGIBILE: 96 CFU con tutte le condizioni verbatim soddisfatte.
 * Include esami che contano SOLO tramite prefix wildcard macro CUN
 * (L-FIL-LET/01, L-ANT/03, M-STO/01) — nessun elenco manuale nel vincolo.
 */
const ESAMI_ELIGIBILE: EsameFixture[] = [
  { denominazione: 'Lingua e letteratura latina', cfu: 12, ssd: 'L-FIL-LET/04' },
  { denominazione: 'Filologia classica', cfu: 12, ssd: 'L-FIL-LET/05' },
  { denominazione: 'Linguistica italiana', cfu: 12, ssd: 'L-FIL-LET/12' },
  { denominazione: 'Filologia (L-FIL-LET/01)', cfu: 6, ssd: 'L-FIL-LET/01' },
  { denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02' },
  { denominazione: 'Storia romana', cfu: 12, ssd: 'L-ANT/03' },
  { denominazione: 'Storia medievale I', cfu: 18, ssd: 'M-STO/01' },
  { denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01' },
];

/**
 * MANCANTE: totale 96 (anch'esso via prefix wildcard), ma solo 6 CFU in
 * L-FIL-LET/04 (minimo 12) → l'unico vincolo atomico insoddisfatto è
 * v-A11-LFILLET04 con deficit esatto 6.
 */
const ESAMI_MANCANTE: EsameFixture[] = [
  { denominazione: 'Lingua e letteratura latina', cfu: 6, ssd: 'L-FIL-LET/04' },
  { denominazione: 'Filologia classica', cfu: 18, ssd: 'L-FIL-LET/05' },
  { denominazione: 'Linguistica italiana', cfu: 12, ssd: 'L-FIL-LET/12' },
  { denominazione: 'Filologia (L-FIL-LET/01)', cfu: 6, ssd: 'L-FIL-LET/01' },
  { denominazione: 'Storia greca', cfu: 12, ssd: 'L-ANT/02' },
  { denominazione: 'Storia romana', cfu: 12, ssd: 'L-ANT/03' },
  { denominazione: 'Storia medievale I', cfu: 18, ssd: 'M-STO/01' },
  { denominazione: 'Glottologia', cfu: 12, ssd: 'L-LIN/01' },
];

function fascicoloDaEsami(esami: EsameFixture[]): FascicoloAccademicoCanonico {
  const righe: RigaOcr[] = esami.map((esame, indice) => ({
    numero: indice + 1,
    testo: `${esame.denominazione} — ${esame.cfu} CFU — ${esame.ssd}`,
    confidenza: 0.98,
  }));
  const pagine: PaginaOcr[] = [{ documentId: 'libretto-LM14', pagina: 1, righe }];
  const { fascicolo } = costruisciFascicoloDaOcr(pagine, {
    denominazione: 'Laurea Magistrale in Filologia moderna',
  });

  const normalizzato = normalizzaFascicolo(fascicolo);
  normalizzato.titolo = {
    denominazione: 'Laurea Magistrale in Filologia moderna',
    classe: 'LM-14',
    dataInizio: DATA.qualification.enrollmentDate,
    dataLaurea: DATA.qualification.awardedDate,
    paese: null,
    titoloEstero: false,
    raw: fascicolo.titolo ?? null,
  };
  return normalizzato;
}

async function eseguiPipeline(esami: EsameFixture[]) {
  const attivato = await installaSeedA11();
  assert(attivato === true, 'seed A-11 VERIFIED deve attivarsi');
  const regole: NormativeRuleEntry[] = trovaRegolePerClasse('A-11');
  assert(regole.length === 1, 'deve esserci esattamente una regola A-11');

  const fascicolo = fascicoloDaEsami(esami);
  const risoluzione = risolviNormativa(dateRilevanza());
  assert(Boolean(risoluzione.normativa), 'contesto normativo risolto');
  assert(risoluzione.normativa?.decreto === 'DM 22/12/2023', 'decreto atteso DM 22/12/2023');

  const report = generaReportCarriera({
    esami: fascicolo.esami as EsameCanonico[],
    titolo: fascicolo.titolo,
    regole,
    mappature: [],
    dateRilevanza: dateRilevanza(),
    classiObiettivo: ['A-11'],
  });

  return { fascicolo, risoluzione, report, regole };
}


/* ------------------------------ Scenario A: ELIGIBLE ------------------------------ */

async function testEligibile(): Promise<void> {
  const { report } = await eseguiPipeline(ESAMI_ELIGIBILE);

  assert(report.esiti.length === 1, 'report deve contenere A-11');
  const esito = report.esiti[0];
  assert(esito.stato === 'ELIGIBLE', `atteso ELIGIBLE, ottenuto ${esito.stato}`);
  assert(
    esito.regoleApplicate?.includes(SEED_A11_METADATA.ruleId) === true,
    'deve citare il ruleId esatto',
  );
  assert(report.auditTrail.length > 0, 'Audit Trail presente');
  assert(
    esito.audit.some((voce) => voce.tipo === 'info' && voce.messaggio.includes('soddisfatti')),
    "audit info 'vincoli soddisfatti'",
  );

  const vincolo04 = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-LFILLET04');
  assert(Boolean(vincolo04), 'vincolo L-FIL-LET/04 presente');
  assert(vincolo04!.cfuPosseduti === 12, 'L-FIL-LET/04 = 12 CFU');
  assert(
    vincolo04
      ? vincolo04.contributi.some(
          (c) => c.fonte?.pagina === 1 && typeof c.fonte?.riga === 'number',
        )
      : false,
    'provenienza page/line sul vincolo contributivo',
  );

  const vincoloTotale = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-totale');
  assert(Boolean(vincoloTotale), 'vincolo totale (prefix wildcard) presente');
  assert(vincoloTotale!.cfuPosseduti === 96, 'v-A11-totale = 96 CFU via macro prefix CUN');
  assert(
    vincoloTotale!.contributi.length >= 3,
    'provenienza page/line sugli esami coperti dai prefissi macro',
  );

  const vincoloLant = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-LANT');
  assert(Boolean(vincoloLant), 'vincolo disgiunzione L-ANT presente');
  assert(vincoloLant!.tipo === 'disgiunzioneSsd', 'v-A11-LANT è una disgiunzione formale');
  assert(vincoloLant!.soddisfatto === true, 'disgiunzione L-ANT/02 o L-ANT/03 soddisfatta');
  assert(vincoloLant!.cfuPosseduti === 12, 'opzione migliore della disgiunzione = 12 CFU');
  assert(
    esito.audit.some((voce) =>
      voce.messaggio.includes('At least 12 CFU required in EITHER L-ANT/02 OR L-ANT/03'),
    ),
    'audit dichiara la disgiunzione esplicita EITHER L-ANT/02 OR L-ANT/03',
  );

  console.log(`\n— AUDIT TRACE — Scenario ELIGIBLE (rule ${SEED_A11_METADATA.ruleId})`);
  for (const voce of esito.audit) console.log(`  [${voce.tipo}] ${voce.messaggio}`);
  for (const voce of report.auditTrail) console.log(`  [report:${voce.tipo}] ${voce.messaggio}`);
  console.log('  ✓ Scenario A: ELIGIBLE con Audit Trail e provenienza page/line.');
}

/* ------------------------------ Scenario B: deficit L-FIL-LET/04 ------------------------------ */

async function testMancante(): Promise<void> {
  const { report } = await eseguiPipeline(ESAMI_MANCANTE);

  const esito = report.esiti[0];
  // Integrabilità NOT_SPECIFIED nel testo → lo stato del motore è MANUAL
  // (nessuna deduzione automatica né di idoneità né di non-ammissibilità).
  assert(
    esito.stato === 'MANUAL_VERIFICATION_REQUIRED',
    `atteso MANUAL_VERIFICATION_REQUIRED (NOT_SPECIFIED), ottenuto ${esito.stato}`,
  );

  const vincolo04 = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-LFILLET04');
  assert(Boolean(vincolo04), 'vincolo L-FIL-LET/04 presente');
  assert(vincolo04!.cfuPosseduti === 6, 'L-FIL-LET/04 posseduti = 6');
  assert(vincolo04!.cfuMancanti === 6, 'deficit esatto = 6 CFU');
  assert(
    esito.audit.some((voce) => voce.messaggio.includes('NOT_SPECIFIED')),
    "audit deve citare NOT_SPECIFIED",
  );

  const vincoloTotale = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-totale');
  assert(Boolean(vincoloTotale), 'vincolo totale presente anche nel deficit');
  assert(vincoloTotale!.cfuPosseduti === 96, 'il totale 96 resta soddisfatto via prefix macro');
  assert(vincoloTotale!.soddisfatto === true, 'v-A11-totale soddisfatto');

  const vincoloLant = esito.esitiVincoli.find((v) => v.vincoloId === 'v-A11-LANT');
  assert(Boolean(vincoloLant), 'vincolo disgiunzione L-ANT presente');
  assert(vincoloLant!.tipo === 'disgiunzioneSsd', 'v-A11-LANT è una disgiunzione formale');
  assert(vincoloLant!.soddisfatto === true, 'L-ANT/02 (12) soddisfa l\u2019opzione OR');
  assert(
    esito.audit.some((voce) =>
      voce.messaggio.includes('At least 12 CFU required in EITHER L-ANT/02 OR L-ANT/03'),
    ),
    'audit del deficit dichiara la disgiunzione esplicita',
  );

  console.log(`\n— AUDIT TRACE — Scenario DEFICIT (rule ${SEED_A11_METADATA.ruleId})`);
  for (const voce of esito.audit) console.log(`  [${voce.tipo}] ${voce.messaggio}`);
  for (const vincolo of esito.esitiVincoli) {
    console.log(
      `  vincolo ${vincolo.vincoloId}: posseduti=${vincolo.cfuPosseduti} ` +
        `mancanti=${vincolo.cfuMancanti} soddisfatto=${vincolo.soddisfatto}`,
    );
  }
  console.log('  ✓ Scenario B: disallowed (MANUAL, NOT_SPECIFIED) con deficit L-FIL-LET/04 = 6.');
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Vertical Slice #1 — Classe A-11 · DM 22/12/2023 · G.U. N. 34 del 10/02/2024 · LM-14');
  await verificaRawFonte();
  await testEligibile();
  await testMancante();
  console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});


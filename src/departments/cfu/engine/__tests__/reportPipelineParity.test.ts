/**
 * ScuoleRadar.it — Dipartimento CFU · Parità del REPORT con la pipeline.
 *
 * Prova che `generaReportCarriera` — ora guidato dalla PIPELINE UNIVERSALE —
 * produce lo stesso report di prima: contratto, stati, deficit, esiti per
 * vincolo, percorso what-if, classi e audit sono confrontati con la
 * composizione pre-refactor (`valutaRequisitoClasse` per classe) su FONTI REALI
 * (DM 22/12/2023 — Tabella A — A-11 · A-12 · A-22, LM-14).
 */
import {
  calcolaPercorsoWhatIf,
  generaReportCarriera,
  type InputReportCarriera,
} from '../reportEngine';
import { risolviNormativa } from '../normativeResolver';
import { valutaRequisitoClasse } from '../requirementSolver';
import { trovaRegolePerClasse } from '../normativeDatabase';
import { installaSeedA11 } from '../seeds/a11Seed';
import { REGOLA_A12_LM14, REGOLA_A22_LM14 } from '../sources/dm22122023_A12_A22_LM14';
import type {
  DateRilevanza,
  EsameCanonico,
  NormativaApplicata,
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

const ORA = '2024-03-15T09:00:00.000Z';

const DATE: DateRilevanza = {
  enrollmentDate: '2019-10-01',
  awardedDate: '2022-11-18',
  procedureDate: '2024-03-15',
};

const TITOLO_LM14: TitoloAccademicoCanonico = {
  denominazione: 'Laurea magistrale in Filologia moderna',
  classe: 'LM-14',
  classeLegacy: null,
  paese: null,
  titoloEstero: false,
};

function esame(id: string, ssd: string, cfu: number): EsameCanonico {
  return { id, denominazione: `Esame ${ssd}`, cfu, ssd, fonte: 'manuale', provenienza: [] };
}

/** Carriera LM-14 con 96 CFU (tutti i vincoli A-11 della fonte reale). */
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

/** Carriera con deficit su L-FIL-LET/04 (6 CFU): A-11 → MANUAL + 6 CFU totali. */
const ESAMI_DEFICIT: EsameCanonico[] = [
  esame('d1', 'L-FIL-LET/04', 6),
  esame('d2', 'L-FIL-LET/05', 18),
  esame('d3', 'L-FIL-LET/12', 12),
  esame('d4', 'L-FIL-LET/10', 12),
  esame('d5', 'L-FIL-LET/01', 6),
  esame('d6', 'M-STO/01', 18),
  esame('d7', 'L-ANT/02', 12),
  esame('d8', 'L-LIN/01', 12),
];

/** Serializzazione canonica condivisa (chiavi ordinate) per confronti strutturali. */
import { canonico } from './universalPipelineFixtures';

/** Composizione PRE-REFACTOR della singola classe (riferimento di parità). */
function riferimentoClasse(
  codiceClasse: string,
  input: InputReportCarriera,
  normativa: NormativaApplicata,
) {
  const valutazione = valutaRequisitoClasse(codiceClasse, input.esami, {
    regole: input.regole,
    mappature: input.mappature,
    titolo: input.titolo,
    normativa,
    ora: input.ora,
  });
  const regola = input.regole.find(
    (voce) =>
      voce.classeCodice === codiceClasse &&
      voce.decreto === normativa.decreto &&
      voce.tabella === normativa.tabella,
  );
  return {
    valutazione,
    regola,
    percorso:
      valutazione.stato === 'CONDITIONALLY_ELIGIBLE' && regola
        ? calcolaPercorsoWhatIf(valutazione, regola, [codiceClasse])
        : undefined,
  };
}

/* ------------------------- Parità per classe (una o più) ------------------------- */

function verificaParitaReport(
  etichetta: string,
  esami: EsameCanonico[],
  regole: NormativeRuleEntry[],
): void {
  const input: InputReportCarriera = {
    esami,
    titolo: TITOLO_LM14,
    regole,
    dateRilevanza: DATE,
    ora: ORA,
  };
  const report = generaReportCarriera(input);
  assert(Boolean(report.normativa), `${etichetta}: contesto normativo risolto`);
  const normativa = report.normativa!;

  // Il report risolve il contesto con lo stesso resolver usato prima.
  assert(
    canonico(report.normativa) === canonico(risolviNormativa(DATE).normativa),
    `${etichetta}: contesto normativo identico al resolver`,
  );
  assert(report.esiti.length === regole.length, `${etichetta}: una valutazione per classe (${regole.length})`);

  for (const esito of report.esiti) {
    const riferimento = riferimentoClasse(esito.codiceClasse, input, normativa);
    const attesa = riferimento.valutazione;
    assert(
      esito.stato === attesa.stato,
      `${etichetta} ${esito.codiceClasse}: stato identico (${attesa.stato})`,
    );
    assert(
      esito.cfuMancantiTotali === attesa.cfuMancantiTotali,
      `${etichetta} ${esito.codiceClasse}: deficit identico (${attesa.cfuMancantiTotali})`,
    );
    assert(
      esito.motivazione === attesa.motivazione,
      `${etichetta} ${esito.codiceClasse}: motivazione identica`,
    );
    assert(
      canonico(esito.esitiVincoli) === canonico(attesa.esitiVincoli),
      `${etichetta} ${esito.codiceClasse}: esiti per vincolo identici`,
    );
    assert(
      (esito.regoleApplicate ?? []).join('|') === (attesa.regoleApplicate ?? []).join('|'),
      `${etichetta} ${esito.codiceClasse}: regole applicate identiche`,
    );
    assert(
      esito.denominazioneClasse === (riferimento.regola?.denominazioneClasse ?? esito.codiceClasse),
      `${etichetta} ${esito.codiceClasse}: denominazione identica`,
    );
    assert(
      canonico(esito.percorsoWhatIf ?? null) === canonico(riferimento.percorso ?? null),
      `${etichetta} ${esito.codiceClasse}: percorso what-if identico`,
    );
    assert(
      // Gli id delle voci sono contatori di processo: si confronta il CONTENUTO
      // (tipo + messaggio) dell'audit prodotto dal decisore.
      attesa.audit.every((voce) =>
        esito.audit.some((altra) => altra.messaggio === voce.messaggio && altra.tipo === voce.tipo),
      ),
      `${etichetta} ${esito.codiceClasse}: audit del decisore preservato nella pipeline`,
    );
    assert(
      esito.audit.some((voce) => voce.messaggio.startsWith('[requirement-evaluation]')),
      `${etichetta} ${esito.codiceClasse}: audit strutturato per requisito presente`,
    );
  }

  const classiEligibiliAttese = report.esiti
    .filter((esito) => esito.stato === 'ELIGIBLE')
    .map((esito) => esito.codiceClasse);
  assert(
    report.classiEligibili.join('|') === classiEligibiliAttese.join('|'),
    `${etichetta}: classiEligibili coerenti (${classiEligibiliAttese.join(', ') || 'nessuna'})`,
  );
  const classiCondizionaliAttese = report.esiti
    .filter((esito) => esito.stato === 'CONDITIONALLY_ELIGIBLE')
    .map((esito) => esito.codiceClasse);
  assert(
    report.classiCondizionali.join('|') === classiCondizionaliAttese.join('|'),
    `${etichetta}: classiCondizionali coerenti`,
  );
  assert(
    report.auditTrail.length >=
      report.esiti.reduce((somma, esito) => somma + esito.audit.length, 0),
    `${etichetta}: auditTrail contiene l'audit di tutte le classi`,
  );
  assert(report.raccomandazioni.length > 0, `${etichetta}: raccomandazioni presenti`);
  assert(typeof report.suggerimentoRiallocazione.cfuEccedentiRiallocabili === 'number', `${etichetta}: suggerimento di riallocazione calcolato`);
  assert(canonico(report.esitoEstero) === 'null', `${etichetta}: titolo estero assente`);

  // Attese storiche esplicite (coerenti con la Vertical Slice #1).
  const a11 = report.esiti.find((esito) => esito.codiceClasse === 'A-11')!;
  if (esami === ESAMI_ELIGIBILE) {
    assert(a11.stato === 'ELIGIBLE', `${etichetta}: A-11 96 CFU → ELIGIBLE`);
    assert(a11.cfuMancantiTotali === 0, `${etichetta}: A-11 → deficit 0`);
    assert(report.classiEligibili.includes('A-11'), `${etichetta}: A-11 fra le classi eligibili`);
    assert(
      report.raccomandazioni.some((raccomandazione) => raccomandazione.includes('A-11')),
      `${etichetta}: raccomandazione su A-11 presente`,
    );
  } else {
    assert(a11.stato === 'MANUAL_VERIFICATION_REQUIRED', `${etichetta}: A-11 deficit → MANUAL`);
    assert(a11.cfuMancantiTotali === 6, `${etichetta}: A-11 deficit → 6 CFU`);
    assert(
      report.raccomandazioni.some((raccomandazione) => raccomandazione.includes('verifica manuale')),
      `${etichetta}: raccomandazione di verifica manuale presente`,
    );
  }
  console.log(`  ✓ ${etichetta}: report identico al flusso pre-refactor.`);
}

/* ------------------------------ Runner ------------------------------ */

async function main(): Promise<void> {
  console.log('Report ↔ Pipeline Parità — A-11 · A-12 · A-22 (DM 22/12/2023, LM-14)');
  const installato = await installaSeedA11();
  assert(installato, 'seed A-11 installato nel database autorevole');
  const regoleA11 = trovaRegolePerClasse('A-11');
  assert(regoleA11.length === 1, 'una regola autorevole per A-11');

  verificaParitaReport('A-11 ELIGIBLE', ESAMI_ELIGIBILE, regoleA11);
  verificaParitaReport('A-11 deficit', ESAMI_DEFICIT, regoleA11);
  verificaParitaReport('Core Set LM-14', ESAMI_ELIGIBILE, [
    ...regoleA11,
    REGOLA_A12_LM14,
    REGOLA_A22_LM14,
  ]);
  console.log(`\nTutti i ${conteggioAssert} assert sono passati.`);
}

main().catch((errore) => {
  console.error(errore);
  process.exit(1);
});

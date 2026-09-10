/**
 * ScuoleRadar.it — Dipartimento CFU · engine/reportEngine.
 *
 * Modulo 5 — Motore di report.
 * Genera l'outcome strutturato per classe, l'Audit Trail completo e le
 * raccomandazioni di carriera, incluse:
 *  - percorsi "What If" (CFU minimi per sbloccare la classe obiettivo);
 *  - riallocazione dei CFU eccedenti verso percorsi alternativi;
 *  - lavorazione esplicita dei titoli esteri (guida riconoscimento MUR).
 *
 * Sicurezza: nessuna conclusione positiva può nascere qui — tutte le
 * valutazioni provengono dal requirementSolver e risalgono a regole del
 * database autorevole.
 */
import type {
  DateRilevanza,
  EsameCanonico,
  EsitoClasseReport,
  EsitoVincolo,
  NormativaApplicata,
  NormativeRuleEntry,
  PercorsoWhatIf,
  ProfiloTitoloEstero,
  ReportCarriera,
  SsdMappingRuleEntry,
  SuggerimentoRiallocazione,
  TitoloAccademicoCanonico,
  ValutazioneRequisito,
  VoceAudit,
} from './types';
import { risolviNormativa } from './normativeResolver';
import { valutaRequisitoClasse } from './requirementSolver';

export interface InputReportCarriera {
  esami: EsameCanonico[];
  titolo?: TitoloAccademicoCanonico | null;
  /** Regole autorevoli disponibili (già caricate dal database normativo). */
  regole: NormativeRuleEntry[];
  mappature?: SsdMappingRuleEntry[];
  dateRilevanza: DateRilevanza;
  /** Classi obiettivo su cui concentrare l'orientamento (opzionale). */
  classiObiettivo?: string[];
  titoloEstero?: ProfiloTitoloEstero;
  ora?: string;
}

let idAuditReportProgressivo = 0;

function voceAudit(
  fase: VoceAudit['fase'],
  tipo: VoceAudit['tipo'],
  messaggio: string,
  extras: { normativa?: NormativaApplicata | null; now?: string } = {},
): VoceAudit {
  idAuditReportProgressivo += 1;
  return {
    id: `report-audit-${idAuditReportProgressivo}`,
    fase,
    tipo,
    messaggio,
    normativa: extras.normativa ?? undefined,
    createdAt: extras.now ?? new Date().toISOString(),
  };
}

/** Regola di una classe applicabile nel contesto valutato. */
function regolaDiClasse(
  codiceClasse: string,
  regole: NormativeRuleEntry[],
  normativa: NormativaApplicata,
): NormativeRuleEntry | undefined {
  return regole.find(
    (regola) =>
      regola.classeCodice === codiceClasse &&
      regola.decreto === normativa.decreto &&
      regola.tabella === normativa.tabella,
  );
}

function cfuTotali(esami: EsameCanonico[]): number {
  return esami.reduce((somma, esame) => somma + esame.cfu, 0);
}

function consumoValutazione(valutazione: ValutazioneRequisito): number {
  return valutazione.esitiVincoli.reduce(
    (somma, esito: EsitoVincolo) =>
      esito.tipo === 'titoloAbilitante' ? somma : somma + esito.cfuPosseduti,
    0,
  );
}

/**
 * Costruisce il percorso "What If" SOLO quando la regola dichiara
 * l'integrabilità: passi costruiti dai soli vincoli della regola applicata.
 */
export function calcolaPercorsoWhatIf(
  valutazione: ValutazioneRequisito,
  regola: NormativeRuleEntry,
  classiSbloccabili: string[],
): PercorsoWhatIf {
  const passi = valutazione.esitiVincoli
    .filter((esito) => esito.cfuMancanti > 0)
    .map((esito) => {
      const vincolo = regola.vincoli.find((vincolo) => vincolo.id === esito.vincoloId);
      if (!vincolo || vincolo.tipo === 'titoloAbilitante') return null;
      if (vincolo.tipo === 'singoloSsd') {
        return {
          vincoloId: vincolo.id,
          ssd: vincolo.ssd,
          cfuConsigliati: esito.cfuMancanti,
          nota: vincolo.nota,
        };
      }
      if (vincolo.tipo === 'disgiunzioneSsd') {
        // Passo What-If per OR esplicito: i CFU consigliati sbloccano l'opzione
        // migliore (la frase disgiuntiva formale è esposta come nota).
        return {
          vincoloId: vincolo.id,
          gruppo: vincolo.opzioni.flatMap((opzione) => opzione.ssd),
          cfuConsigliati: esito.cfuMancanti,
          nota: vincolo.disgiunzioneEsplicita,
        };
      }
      return {
        vincoloId: vincolo.id,
        gruppo: vincolo.ssd,
        cfuConsigliati: esito.cfuMancanti,
        nota: vincolo.distribuzione,
      };
    })
    .filter((passo): passo is NonNullable<typeof passo> => passo !== null);

  return {
    classeObiettivo: regola.classeCodice,
    cfuMinimiDaAggiungere: valutazione.cfuMancantiTotali,
    passi,
    classiSbloccabili,
  };
}

/** CFU eccedenti = totale esami − consumo della classe migliore ammissibile. */
export function suggerisciRiallocazione(
  esami: EsameCanonico[],
  valutazioni: ValutazioneRequisito[],
): SuggerimentoRiallocazione {
  const totale = cfuTotali(esami);
  const rilevanti = valutazioni.filter((v) => v.stato !== 'INSUFFICIENT_DATA');
  const consumoMigliore =
    rilevanti.length > 0 ? Math.max(...rilevanti.map(consumoValutazione)) : 0;
  const eccedenti = Math.max(0, Math.round((totale - consumoMigliore) * 10) / 10);

  const proposte = rilevanti
    .filter((v) => v.stato === 'CONDITIONALLY_ELIGIBLE')
    .slice(0, 3)
    .flatMap((valutazione) =>
      valutazione.esitiVincoli
        .filter((esito) => esito.cfuMancanti > 0 && esito.tipo !== 'titoloAbilitante')
        .map((esito) => ({
          da: 'CFU eccedenti',
          a: esito.tipo === 'singoloSsd' ? esito.vincoloId : `gruppo ${valutazione.codiceClasse}`,
          cfu: Math.min(esito.cfuMancanti, eccedenti),
          nota: `Riallocazione consigliata per ${valutazione.codiceClasse} (vincolo ${esito.vincoloId}).`,
        })),
    );

  return { cfuEccedentiRiallocabili: eccedenti, proposte };
}

/* ------------------------------ Titoli esteri (MUR) ------------------------------ */

/**
 * Flusso esplicito per titoli conseguiti all'estero. La guida MUR è
 * procedurale (documentazione e passi) e non produce giudizi di idoneità.
 */
export function elaboraTitoloEstero(profilo: ProfiloTitoloEstero) {
  const audit: VoceAudit[] = [];
  const now = new Date().toISOString();

  const haDocumentazione =
    profilo.haTraduzioneGiurata === true &&
    (profilo.haDichiarazioneDiValore === true || profilo.haAttestatoComparabilita === true);

  if (!haDocumentazione) {
    audit.push(
      voceAudit('report', 'warning', `Titolo estero (${profilo.paese}): serve documentazione MUR.`, {
        now,
      }),
    );
    return {
      stato: 'RICONOSCIMENTO_MUR_RICHIESTO' as const,
      valutazioneParziale: null,
      guidaMUR: {
        richiesto: true,
        ente: 'MUR' as const,
        passi: [
          'Verifica accordi bilaterali o convenzioni con l\u2019Italia (CIMEA/MUR).',
          'Richiedi la traduzione giurata del titolo e dell\u2019elenco esami.',
          'Ottieni la Dichiarazione di Valore (DV) oppure l\u2019Attestato di Comparabilità (CIMEA).',
          'Presenta la domanda di riconoscimento al MUR o all\u2019università competente.',
          'Ripeti il calcolo CFU con il titolo riconosciuto per ottenere la classe di concorso.',
        ],
        documenti: [
          'Titolo di studio originale',
          'Elenco esami e votazioni (transcript)',
          'Traduzione giurata',
          'Dichiarazione di Valore / Attestato CIMEA',
        ],
      },
      audit,
    };
  }

  audit.push(
    voceAudit('report', 'info', `Titolo estero documentato (${profilo.paese}): confronto ammissibile.`, {
      now,
    }),
  );
  return {
    stato: 'CONFRONTO_SSD_AMMISSIBILE' as const,
    valutazioneParziale: null,
    guidaMUR: {
      richiesto: false,
      ente: 'MUR' as const,
      passi: [
        'Confronta il titolo estero con le classi di laurea italiane (tabella MUR).',
        'Usa il risultato del confronto per la classe di concorso obiettivo.',
      ],
      documenti: ['Dichiarazione di Valore / Attestato CIMEA'],
    },
    audit,
  };
}


/* ------------------------------ Report finale ------------------------------ */

export function generaReportCarriera(input: InputReportCarriera): ReportCarriera {
  const ora = input.ora ?? new Date().toISOString();
  const risoluzione = risolviNormativa(input.dateRilevanza);
  const normativa = risoluzione.normativa ?? null;
  const auditTrail: VoceAudit[] = [
    voceAudit('report', 'info', risoluzione.motivazione, { normativa, now: ora }),
  ];

  // Se il contesto normativo non è risolto: nessuna valutazione, nessun guess.
  if (!normativa) {
    return {
      id: `REPORT-${Date.now()}`,
      generatoIl: ora,
      normativa: null,
      statoNormativa: risoluzione.stato,
      esiti: [],
      classiEligibili: [],
      classiCondizionali: [],
      percorsiWhatIf: [],
      suggerimentoRiallocazione: { cfuEccedentiRiallocabili: 0, proposte: [] },
      raccomandazioni: [
        'Contesto normativo non risolvibile: nessuna valutazione automatica possibile.',
        risoluzione.stato === 'transitorio'
          ? 'Regime transitorio ambiguro: la selezione del decreto richiede verifica manuale.'
          : 'Popola il database normativo autorevole prima di eseguire il calcolo.',
      ],
      auditTrail,
      esitoEstero: null,
    };
  }

  const codiciRegole = [...new Set(input.regole.map((regola) => regola.classeCodice))];
  const codiciDaValutare = input.classiObiettivo?.length
    ? input.classiObiettivo.filter((codice) => codiciRegole.includes(codice))
    : codiciRegole;

  const esiti: EsitoClasseReport[] = codiciDaValutare.map((codiceClasse) => {
    const valutazione = valutaRequisitoClasse(codiceClasse, input.esami, {
      regole: input.regole,
      mappature: input.mappature,
      titolo: input.titolo,
      normativa,
      ora,
    });
    const regola = regolaDiClasse(codiceClasse, input.regole, normativa);
    const percorso =
      valutazione.stato === 'CONDITIONALLY_ELIGIBLE' && regola
        ? calcolaPercorsoWhatIf(valutazione, regola, [codiceClasse])
        : undefined;

    return {
      ...valutazione,
      denominazioneClasse: regola?.denominazioneClasse ?? codiceClasse,
      percorsoWhatIf: percorso,
    };
  });

  const classiEligibili = esiti
    .filter((esito) => esito.stato === 'ELIGIBLE')
    .map((esito) => esito.codiceClasse);
  const classiCondizionali = esiti
    .filter((esito) => esito.stato === 'CONDITIONALLY_ELIGIBLE')
    .map((esito) => esito.codiceClasse);
  const percorsiWhatIf = esiti
    .map((esito) => esito.percorsoWhatIf)
    .filter((percorso): percorso is PercorsoWhatIf => Boolean(percorso));

  auditTrail.push(...esiti.flatMap((esito) => esito.audit));

  const suggerimentoRiallocazione = suggerisciRiallocazione(input.esami, esiti);
  const raccomandazioni: string[] = [];

  if (classiEligibili.length > 0) {
    raccomandazioni.push(`Con i CFU attuali risulti ammissibile per: ${classiEligibili.join(', ')}.`);
  }
  for (const esito of esiti) {
    if (esito.stato === 'CONDITIONALLY_ELIGIBLE' && esito.percorsoWhatIf) {
      raccomandazioni.push(
        `Per ${esito.codiceClasse} la regola dichiara integrazione: servono ${esito.percorsoWhatIf.cfuMinimiDaAggiungere} CFU aggiuntivi.`,
      );
    } else if (esito.stato === 'MANUAL_VERIFICATION_REQUIRED') {
      raccomandazioni.push(`Per ${esito.codiceClasse}: verifica manuale richiesta prima del giudizio.`);
    } else if (esito.stato === 'NOT_ELIGIBLE') {
      raccomandazioni.push(`Per ${esito.codiceClasse}: requisito duro non soddisfatto (regola esplicita).`);
    }
  }
  if (suggerimentoRiallocazione.cfuEccedentiRiallocabili > 0) {
    raccomandazioni.push(
      `Hai ${suggerimentoRiallocazione.cfuEccedentiRiallocabili} CFU eccedenti riallocabili verso percorsi alternativi.`,
    );
  }
  if (raccomandazioni.length === 0) {
    raccomandazioni.push('Nessuna raccomandazione automatica disponibile senza regole autorevoli.');
  }

  let esitoEstero: ReportCarriera['esitoEstero'] = null;
  if (input.titoloEstero) {
    const elaborazione = elaboraTitoloEstero(input.titoloEstero);
    esitoEstero = elaborazione as ReportCarriera['esitoEstero'];
    auditTrail.push(...elaborazione.audit);
    if (elaborazione.stato === 'RICONOSCIMENTO_MUR_RICHIESTO') {
      raccomandazioni.push(
        'Titolo estero: completa la procedura di riconoscimento MUR/CIMEA prima del calcolo definitivo.',
      );
    }
  }

  return {
    id: `REPORT-${Date.now()}`,
    generatoIl: ora,
    normativa,
    statoNormativa: risoluzione.stato,
    esiti,
    classiEligibili,
    classiCondizionali,
    percorsiWhatIf,
    suggerimentoRiallocazione,
    raccomandazioni,
    auditTrail,
    esitoEstero,
  };
}


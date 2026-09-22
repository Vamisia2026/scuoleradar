/**
 * ScuoleRadar.it — Dipartimento CFU · engine/requirementSolver.
 *
 * Modulo 4 — Evaluator a vincoli (constraint solver).
 *
 * Vincoli di sicurezza (STRICT):
 *  - valuta SOLO regole presenti nel database autorevole (regole esplicite);
 *  - se una regola, mappatura storica, disposizione transitoria o eccezione è
 *    mancante/ambigua → MANUAL_VERIFICATION_REQUIRED oppure INSUFFICIENT_DATA;
 *  - MAI indovinare: nessun ELIGIBLE senza regola normativa esplicita e
 *    tracciabile (audit con id regola + fonte);
 *  - le mappature SSD storico / GSD NON implicano equivalenza legale: ogni
 *    credito mappato è contato solo se la mappatura dichiara l'applicabilità
 *    alla provisione specifica valutata.
 */
import type {
  EsameCanonico,
  EsitoVincolo,
  NormativaApplicata,
  NormativeRuleEntry,
  Provenienza,
  SsdMappingRuleEntry,
  TitoloAccademicoCanonico,
  ValutazioneRequisito,
  VincoloCfu,
  VoceAudit,
} from './types';
import { validaProvenienzaRegola } from './sourceGate';
import {
  eCodiceSsdValido,
  ePrefissoMacroSsd,
  requisitoSsdCopre,
  TASSONOMIA_PREFISSI_SSD_CUN,
} from './ssdTaxonomy';

export interface OpzioniValutazione {
  /** Regole autorevoli già filtrate per classe/decreto/tabella. */
  regole: NormativeRuleEntry[];
  mappature?: SsdMappingRuleEntry[];
  titolo?: TitoloAccademicoCanonico | null;
  /** Contesto normativo risolto; null = non risolvibile (no guess). */
  normativa?: NormativaApplicata | null;
  ora?: string;
}

export interface CfuPerCodice {
  cfu: number;
  contributi: Provenienza[];
  /** True se esistevano mappature potenzialmente utili ma non applicabili alla provisione. */
  bloccatoDaMappatura: boolean;
}

let idAuditProgressivo = 0;

function voceAudit(
  fase: VoceAudit['fase'],
  tipo: VoceAudit['tipo'],
  messaggio: string,
  extras: { normativa?: NormativaApplicata | null; provenienza?: Provenienza[]; now?: string } = {},
): VoceAudit {
  idAuditProgressivo += 1;
  return {
    id: `audit-${idAuditProgressivo}`,
    fase,
    tipo,
    messaggio,
    normativa: extras.normativa ?? undefined,
    provenienza: extras.provenienza,
    createdAt: extras.now ?? new Date().toISOString(),
  };
}

/** Struttura della regola valida per l'elaborazione (assenza ⇒ ambiguità). */
function regolaAmbiguo(regola: NormativeRuleEntry): string | null {
  if (!regola.id || !regola.fonte) return 'Regola senza id/fonte dichiarata.';
  const problemaRequisito = (requisito: string, dove: string): string | null => {
    if (!requisito || requisito.trim().length === 0) {
      return `Vincolo ${dove}: requisito disciplinare vuoto.`;
    }
    if (ePrefissoMacroSsd(requisito)) {
      const registrato = TASSONOMIA_PREFISSI_SSD_CUN.some((voce) => voce.prefisso === requisito);
      if (!registrato) {
        return `Vincolo ${dove}: prefisso macro non presente nella tassonomia CUN (${requisito}).`;
      }
      return null;
    }
    if (!eCodiceSsdValido(requisito)) {
      return `Vincolo ${dove}: requisito non in formato SSD canonico (${requisito}).`;
    }
    return null;
  };
  for (const vincolo of regola.vincoli) {
    if (vincolo.tipo === 'singoloSsd') {
      if (vincolo.min < 0) {
        return `Vincolo ${vincolo.id}: soglia minima negativa.`;
      }
      if (ePrefissoMacroSsd(vincolo.ssd)) {
        return `Vincolo ${vincolo.id}: un vincolo singolo non può usare un prefisso macro (${vincolo.ssd}).`;
      }
      const problema = problemaRequisito(vincolo.ssd, vincolo.id);
      if (problema) return problema;
    }
    if (vincolo.tipo === 'gruppoSsd') {
      if (!vincolo.ssd || vincolo.ssd.length === 0) {
        return `Vincolo ${vincolo.id}: gruppo SSD vuoto.`;
      }
      if (vincolo.min < 0) {
        return `Vincolo ${vincolo.id}: credito minimo di gruppo negativo.`;
      }
      for (const requisito of vincolo.ssd) {
        const problema = problemaRequisito(requisito, vincolo.id);
        if (problema) return problema;
      }
      const haPrefissi = vincolo.ssd.some((requisito) => ePrefissoMacroSsd(requisito));
      if (haPrefissi && (vincolo.minPerSsd !== undefined || vincolo.minUnoDeiSsd !== undefined)) {
        return `Vincolo ${vincolo.id}: minPerSsd/minUnoDeiSsd non consentiti con prefissi macro — per un OR esplicito usare 'disgiunzioneSsd'.`;
      }
      if (vincolo.distribuzione && vincolo.minPerSsd === undefined && vincolo.minUnoDeiSsd === undefined) {
        return `Vincolo ${vincolo.id}: nota di distribuzione non strutturata (minPerSsd/minUnoDeiSsd assenti).`;
      }
      if (vincolo.minPerSsd !== undefined && vincolo.minPerSsd < 0) {
        return `Vincolo ${vincolo.id}: minPerSsd negativo.`;
      }
      if (vincolo.minUnoDeiSsd !== undefined && vincolo.minUnoDeiSsd < 0) {
        return `Vincolo ${vincolo.id}: minUnoDeiSsd negativo.`;
      }
    }
    if (vincolo.tipo === 'disgiunzioneSsd') {
      if (!vincolo.opzioni || vincolo.opzioni.length === 0) {
        return `Vincolo ${vincolo.id}: disgiunzione senza opzioni.`;
      }
      if (!vincolo.disgiunzioneEsplicita || vincolo.disgiunzioneEsplicita.trim().length === 0) {
        return `Vincolo ${vincolo.id}: frase disgiuntiva esplicita assente.`;
      }
      for (const opzione of vincolo.opzioni) {
        if (!opzione.ssd || opzione.ssd.length === 0) {
          return `Vincolo ${vincolo.id}: opzione ${opzione.id} senza SSD.`;
        }
        if (opzione.min < 0) {
          return `Vincolo ${vincolo.id}: opzione ${opzione.id} con minimo negativo.`;
        }
        for (const requisito of opzione.ssd) {
          const problema = problemaRequisito(requisito, `${vincolo.id} → ${opzione.id}`);
          if (problema) return problema;
        }
      }
    }
    if (vincolo.tipo === 'titoloAbilitante' && !vincolo.denominazione) {
      return `Vincolo ${vincolo.id}: denominazione titolo abilitante mancante.`;
    }
  }
  return null;
}

/**
 * Riscontro di un singolo esame verso UN requisito disciplinare (codice SSD
 * esatto oppure prefisso macro CUN, es. "L-FIL-LET/"). Conta:
 *  1. esami con SSD canonico coperto dal requisito (uguaglianza O prefix match);
 *  2. esami la cui mappatura (storica o GSD) dichiara l'applicabilità alla
 *     provisione corrente e arriva a un codice coperto dal requisito.
 */
function riscontroEsame(
  requisito: string,
  esame: EsameCanonico,
  mappature: SsdMappingRuleEntry[],
  provisioni: string[],
): { conteggiato: boolean; bloccato: boolean } {
  const diretta = Boolean(esame.ssd) && requisitoSsdCopre(requisito, esame.ssd as string);
  const codiciSorgente = [esame.gsd, esame.ssdOrigine, esame.ssd].filter(
    (c): c is string => Boolean(c),
  );
  const candidati = mappature.filter(
    (m) => codiciSorgente.includes(m.da) && requisitoSsdCopre(requisito, m.a),
  );
  const applicabile = candidati.some((m) =>
    (m.applicabileAProvisioni ?? []).some((provisione) => provisioni.includes(provisione)),
  );
  if (diretta || applicabile) return { conteggiato: true, bloccato: false };
  return { conteggiato: false, bloccato: candidati.length > 0 };
}

/**
 * Crediti canonici per un singolo requisito richiesto (codice esatto o
 * prefisso macro). Per gruppi multi-requisito usare `conteggioUnione`
 * (nessun doppio conteggio tra requisiti sovrapposti).
 */
export function creditiPerCodiceRichiesto(
  requisito: string,
  esami: EsameCanonico[],
  mappature: SsdMappingRuleEntry[],
  provisioni: string[],
): CfuPerCodice {
  let cfu = 0;
  const contributi: Provenienza[] = [];
  let bloccatoDaMappatura = false;

  for (const esame of esami) {
    const riscontro = riscontroEsame(requisito, esame, mappature, provisioni);
    if (riscontro.conteggiato) {
      cfu += esame.cfu;
      contributi.push(...esame.provenienza);
    }
    if (riscontro.bloccato) bloccatoDaMappatura = true;
  }

  return { cfu, contributi, bloccatoDaMappatura };
}

/**
 * Unione (senza doppio conteggio) dei crediti che rispondono ad ALMENO UNO dei
 * requisiti del gruppo: codici esatti E/O prefissi macro CUN. Un esame che
 * soddisfa più requisiti sovrapposti è conteggiato una sola volta.
 */
function conteggioUnione(
  requisiti: string[],
  esami: EsameCanonico[],
  mappature: SsdMappingRuleEntry[],
  provisioni: string[],
): { cfu: number; contributi: Provenienza[]; bloccato: boolean } {
  let cfu = 0;
  const contributi: Provenienza[] = [];
  let bloccato = false;

  for (const esame of esami) {
    const riscontri = requisiti.map((requisito) =>
      riscontroEsame(requisito, esame, mappature, provisioni),
    );
    const conteggiato = riscontri.some((riscontro) => riscontro.conteggiato);
    // Parità col comportamento storico: una mappatura candidata non dichiarata
    // applicabile resta un blocco anche se l'esame è conteggiato altrove.
    if (riscontri.some((riscontro) => riscontro.bloccato)) bloccato = true;
    if (conteggiato) {
      cfu += esame.cfu;
      contributi.push(...esame.provenienza);
    }
  }

  return { cfu, contributi, bloccato };
}

/**
 * Contesto di valutazione di UN vincolo. Esportato per consentire alla
 * pipeline universale (`engine/pipeline/`) di riusare ESATTAMENTE questa
 * funzione: nessuna duplicazione della semantica di conteggio.
 */
export interface ContestoValutazione {
  esami: EsameCanonico[];
  mappature: SsdMappingRuleEntry[];
  /** Provisioni (regole) alle quali le mappature devono essere dichiarate applicabili. */
  provisioni: string[];
  now: string;
}

export interface RisultatoVincolo {
  esito: EsitoVincolo;
  bloccatoDaMappatura: boolean;
  /**
   * Esiti per RAMO di una disgiunzione esplicita: misurati QUI, una volta sola,
   * con la stessa semantica di conteggio (crediti non sommati fra opzioni).
   * Assente per gli altri tipi di vincolo.
   */
  rami?: readonly EsitoRamoVincolo[];
}

/** Esito di UN ramo (opzione) di una disgiunzione esplicita. */
export interface EsitoRamoVincolo {
  readonly id: string;
  readonly soddisfatto: boolean;
  readonly cfuPosseduti: number;
  readonly min: number;
}

/**
 * Valuta un singolo vincolo CFU/titolo sui dati canonici. Unica fonte di verità
 * per conteggio crediti, prefix wildcard SSD, disgiunzioni e blocco mappature.
 */
export function valutaVincolo(vincolo: VincoloCfu, contesto: ContestoValutazione): RisultatoVincolo {
  let bloccatoDaMappatura = false;

  if (vincolo.tipo === 'titoloAbilitante') {
    return {
      esito: {
        vincoloId: vincolo.id,
        tipo: 'titoloAbilitante',
        soddisfatto: !vincolo.necessario,
        cfuPosseduti: 0,
        cfuMancanti: 0,
        dettaglio: vincolo.denominazione,
        contributi: [],
      },
      bloccatoDaMappatura: false,
    };
  }

  if (vincolo.tipo === 'singoloSsd') {
    const cr = creditiPerCodiceRichiesto(
      vincolo.ssd,
      contesto.esami,
      contesto.mappature,
      contesto.provisioni,
    );
    const mancanti = Math.max(0, vincolo.min - cr.cfu);
    return {
      esito: {
        vincoloId: vincolo.id,
        tipo: 'singoloSsd',
        soddisfatto: cr.cfu >= vincolo.min,
        cfuPosseduti: cr.cfu,
        cfuMancanti: mancanti,
        dettaglio: vincolo.nota,
        contributi: cr.contributi,
      },
      bloccatoDaMappatura: cr.bloccatoDaMappatura,
    };
  }

  // DISGIUNZIONE ESPLICITA (EXPLICIT_OR_CONDITION): ogni opzione è misurata
  // singolarmente; il vincolo è soddisfatto se ALMENO UNA opzione raggiunge il
  // proprio minimo. I crediti NON si sommano tra opzioni (6+6 NON vale 12).
  if (vincolo.tipo === 'disgiunzioneSsd') {
    const risultati = vincolo.opzioni.map((opzione) => {
      const unioneOpzione = conteggioUnione(
        opzione.ssd,
        contesto.esami,
        contesto.mappature,
        contesto.provisioni,
      );
      bloccatoDaMappatura = bloccatoDaMappatura || unioneOpzione.bloccato;
      return { opzione, unioneOpzione };
    });

    let migliore = risultati[0];
    let deficitMigliore = Math.max(0, migliore.opzione.min - migliore.unioneOpzione.cfu);
    for (const ris of risultati.slice(1)) {
      const deficit = Math.max(0, ris.opzione.min - ris.unioneOpzione.cfu);
      if (
        deficit < deficitMigliore ||
        (deficit === deficitMigliore && ris.unioneOpzione.cfu > migliore.unioneOpzione.cfu)
      ) {
        migliore = ris;
        deficitMigliore = deficit;
      }
    }

    const soddisfatta = risultati.some(
      (ris) => ris.unioneOpzione.cfu >= ris.opzione.min,
    );
    return {
      esito: {
        vincoloId: vincolo.id,
        tipo: 'disgiunzioneSsd',
        soddisfatto: soddisfatta,
        cfuPosseduti: migliore.unioneOpzione.cfu,
        cfuMancanti: deficitMigliore,
        dettaglio: vincolo.disgiunzioneEsplicita,
        contributi: migliore.unioneOpzione.contributi,
      },
      bloccatoDaMappatura,
      // Esiti per ramo (A3): misurati una volta sola, mai ricostruiti a valle.
      rami: risultati.map((ris) => ({
        id: ris.opzione.id,
        soddisfatto: ris.unioneOpzione.cfu >= ris.opzione.min,
        cfuPosseduti: ris.unioneOpzione.cfu,
        min: ris.opzione.min,
      })),
    };
  }

  // Gruppo SSD (codici esatti e/o prefissi macro CUN): totali per singolo
  // requisito (usati da minPerSsd/minUnoDeiSsd) + UNIONE senza doppio conteggio
  // per il credito complessivo del gruppo.
  const perCodice: number[] = vincolo.ssd.map((requisito) =>
    creditiPerCodiceRichiesto(
      requisito,
      contesto.esami,
      contesto.mappature,
      contesto.provisioni,
    ).cfu,
  );
  const unione = conteggioUnione(
    vincolo.ssd,
    contesto.esami,
    contesto.mappature,
    contesto.provisioni,
  );
  const cfuGruppo = unione.cfu;
  const contributiGruppo: Provenienza[] = unione.contributi;
  bloccatoDaMappatura = bloccatoDaMappatura || unione.bloccato;
  let mancantiGruppo = Math.max(0, vincolo.min - cfuGruppo);

  if (vincolo.minPerSsd) {
    for (let indice = 0; indice < vincolo.ssd.length; indice += 1) {
      const mancantiSingolo = Math.max(0, vincolo.minPerSsd - perCodice[indice]);
      mancantiGruppo = Math.max(mancantiGruppo, mancantiSingolo);
    }
  }

  if (vincolo.minUnoDeiSsd) {
    const miglioreSsd = perCodice.length > 0 ? Math.max(...perCodice) : 0;
    mancantiGruppo = Math.max(mancantiGruppo, Math.max(0, vincolo.minUnoDeiSsd - miglioreSsd));
  }

  return {
    esito: {
      vincoloId: vincolo.id,
      tipo: 'gruppoSsd',
      soddisfatto: cfuGruppo >= vincolo.min && mancantiGruppo === 0,
      cfuPosseduti: cfuGruppo,
      cfuMancanti: mancantiGruppo,
      dettaglio: vincolo.distribuzione,
      contributi: contributiGruppo,
    },
    bloccatoDaMappatura,
  };
}

/**
 * Regole autorevoli APPLICABILI al contesto risolto (classe + decreto +
 * tabella). Unica implementazione: la usano il solver e la pipeline universale
 * (nessuna duplicazione del filtro normativo).
 */
export function regoleApplicabili(
  codiceClasse: string,
  regole: readonly NormativeRuleEntry[],
  normativa: NormativaApplicata,
): NormativeRuleEntry[] {
  return regole.filter(
    (regola) =>
      regola.classeCodice === codiceClasse &&
      regola.decreto === normativa.decreto &&
      regola.tabella === normativa.tabella,
  );
}

/** Classi di laurea ammesse dichiarate dalle regole applicabili (senza deduzione). */
export function classiAmmesseDalleRegole(regole: readonly NormativeRuleEntry[]): string[] {
  const insiemi = regole
    .map((regola) => regola.classiLaureaAmmesse)
    .filter((voci): voci is string[] => Boolean(voci));
  const unione = new Set(insiemi.flat());
  return [...unione];
}

/**
 * Verifica delle classi di laurea ammesse dichiarate dalle regole (tristate:
 * ok / not-eligible / non-verificabile). Esportata: la strategia
 * `titolo.accesso.classe` della pipeline universale usa QUESTA funzione.
 */
export function verificaClasseLaurea(
  regole: NormativeRuleEntry[],
  titolo?: TitoloAccademicoCanonico | null,
): { esito: 'ok' | 'not-eligible' | 'non-verificabile'; motivazione?: string } {
  const ammesse = classiAmmesseDalleRegole(regole);
  if (ammesse.length === 0) return { esito: 'ok' };
  const classe = titolo?.classe ?? titolo?.classeLegacy ?? null;
  if (!classe) {
    return {
      esito: 'non-verificabile',
      motivazione: 'Classe di laurea del titolo non dichiarata: verifica manuale richiesta.',
    };
  }
  return ammesse.includes(classe)
    ? { esito: 'ok' }
    : {
        esito: 'not-eligible',
        motivazione: `Classe "${classe}" non compresa tra quelle dichiarate ammesse (${ammesse.join(', ')}).`,
      };
}

/**
 * Valuta una classe di concorso applicando STRETTAMENTE le regole del database
 * autorevole. Nessuna regola/mappatura dichiarata → nessun giudizio positivo.
 */
export function valutaRequisitoClasse(
  codiceClasse: string,
  esami: EsameCanonico[],
  opzioni: OpzioniValutazione,
): ValutazioneRequisito {
  const audit: VoceAudit[] = [];
  const now = opzioni.ora ?? new Date().toISOString();
  const normativa = opzioni.normativa ?? null;
  const mappature = opzioni.mappature ?? [];

  if (!normativa) {
    audit.push(
      voceAudit('solve', 'warning', 'Contesto normativo non risolto: valutazione non possibile.', {
        normativa,
        now,
      }),
    );
    return {
      codiceClasse,
      stato: 'INSUFFICIENT_DATA',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: 'Contesto normativo non risolvibile dal database autorevole.',
      audit,
    };
  }

  if (esami.length === 0 || !opzioni.titolo) {
    audit.push(voceAudit('solve', 'warning', 'Esami o titolo mancanti: dati insufficienti.', { normativa, now }));
    return {
      codiceClasse,
      stato: 'INSUFFICIENT_DATA',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: 'Servono esami riconosciuti e il titolo di studio.',
      audit,
    };
  }

  const regole = regoleApplicabili(codiceClasse, opzioni.regole, normativa);


  if (regole.length === 0) {
    audit.push(
      voceAudit(
        'solve',
        'warning',
        `Nessuna regola autorevole per ${codiceClasse} (${normativa.decreto} Tabella ${normativa.tabella}).`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'INSUFFICIENT_DATA',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: 'Regola normativa assente nel database autorevole per il contesto.',
      audit,
    };
  }

  // SOURCE GATE (difensivo, senza eccezioni): regole UNVERIFIED / con fonte
  // non valida non possono mai sostenere un giudizio positivo.
  const regoleNonVerificate = regole.filter((regola) => !validaProvenienzaRegola(regola).valida);
  if (regoleNonVerificate.length > 0) {
    audit.push(
      voceAudit(
        'solve',
        'warning',
        `Regole presenti ma NON verificate dal Source Gate (${regoleNonVerificate
          .map((regola) => regola.id)
          .join(', ')}): nessun giudizio emesso.`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'INSUFFICIENT_DATA',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: 'Regole disponibili ma fonte non verificata: nessun giudizio automatico.',
      audit,
    };
  }

  const ambiguita = regole.map(regolaAmbiguo).find((problema) => problema !== null);
  if (ambiguita) {
    audit.push(
      voceAudit('solve', 'warning', `Regola ambigua o incompleta: ${ambiguita}`, {
        normativa,
        now,
      }),
    );
    return {
      codiceClasse,
      stato: 'MANUAL_VERIFICATION_REQUIRED',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: `Verifica manuale richiesta: ${ambiguita}`,
      regoleApplicate: regole.map((regola) => regola.id),
      audit,
    };
  }

  const verificaClasse = verificaClasseLaurea(regole, opzioni.titolo);
  if (verificaClasse.esito === 'not-eligible') {
    audit.push(voceAudit('solve', 'errore', verificaClasse.motivazione ?? '', { normativa, now }));
    return {
      codiceClasse,
      stato: 'NOT_ELIGIBLE',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: verificaClasse.motivazione,
      regoleApplicate: regole.map((regola) => regola.id),
      audit,
    };
  }
  if (verificaClasse.esito === 'non-verificabile') {
    audit.push(
      voceAudit('solve', 'warning', verificaClasse.motivazione ?? '', { normativa, now }),
    );
    return {
      codiceClasse,
      stato: 'MANUAL_VERIFICATION_REQUIRED',
      esitiVincoli: [],
      cfuMancantiTotali: 0,
      motivazione: verificaClasse.motivazione,
      regoleApplicate: regole.map((regola) => regola.id),
      audit,
    };
  }

  // Unisce i vincoli dichiarati dalle regole applicabili (id univoci, niente inventiva).
  const vincoli = new Map<string, VincoloCfu>();
  for (const regola of regole) {
    for (const vincolo of regola.vincoli) {
      if (!vincoli.has(vincolo.id)) vincoli.set(vincolo.id, vincolo);
    }
  }
  const provisioni = regole.map((regola) => regola.provisione);
  const contesto: ContestoValutazione = { esami, mappature, provisioni, now };

  let bloccatoDaMappatura = false;
  let bloccatoDaSsdAssente = false;
  const esitiVincoli: EsitoVincolo[] = [];
  for (const vincolo of vincoli.values()) {
    const risultato = valutaVincolo(vincolo, contesto);
    esitiVincoli.push(risultato.esito);
    bloccatoDaMappatura = bloccatoDaMappatura || risultato.bloccatoDaMappatura;
    if (vincolo.tipo === 'disgiunzioneSsd') {
      // L'audit deve dichiarare ESPLICITAMENTE la disgiunzione formale valutata.
      audit.push(
        voceAudit(
          'solve',
          risultato.esito.soddisfatto ? 'info' : 'warning',
          `Vincolo ${vincolo.id} (disgiunzione esplicita): ${vincolo.disgiunzioneEsplicita}.`,
          { normativa, now },
        ),
      );
    }
  }


  if (esami.some((esame) => !esame.ssd && !esame.gsd)) {
    bloccatoDaSsdAssente = true;
    audit.push(
      voceAudit(
        'solve',
        'warning',
        'Esami senza codice disciplinare riconosciuto: non conteggiati (non sostituiscono dati mancanti).',
        { normativa, now },
      ),
    );
  }

  const cfuMancantiTotali = esitiVincoli.reduce((somma, esito) => somma + esito.cfuMancanti, 0);
  const tutteSoddisfatte = esitiVincoli.every((esito) => esito.soddisfatto);
  const vincoloDuroInsoddisfatto = esitiVincoli.find(
    (esito) => esito.tipo === 'titoloAbilitante' && !esito.soddisfatto,
  );

  if (vincoloDuroInsoddisfatto) {
    audit.push(
      voceAudit(
        'solve',
        'errore',
        `Requisito duro non soddisfatto: ${vincoloDuroInsoddisfatto.dettaglio ?? 'titolo abilitante'}.`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'NOT_ELIGIBLE',
      esitiVincoli,
      cfuMancantiTotali,
      motivazione: `Requisito duro non soddisfatto: ${vincoloDuroInsoddisfatto.dettaglio ?? 'titolo abilitante'}.`,
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  if (tutteSoddisfatte && !bloccatoDaMappatura) {
    audit.push(
      voceAudit(
        'solve',
        'info',
        `Classe ${codiceClasse}: vincoli soddisfatti tramite regole ${regole
          .map((regola) => regola.id)
          .join(', ')} (${regole[0]?.fonte}).`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'ELIGIBLE',
      esitiVincoli,
      cfuMancantiTotali: 0,
      motivazione: 'Tutti i vincoli dichiarati sono soddisfatti.',
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  if (bloccatoDaMappatura || bloccatoDaSsdAssente) {
    audit.push(
      voceAudit(
        'solve',
        'warning',
        bloccatoDaMappatura
          ? 'Mappatura SSD/GSD presente ma non dichiarata applicabile alla provisione valutata.'
          : 'Esami senza codice disciplinare: non è possibile escludere un impatto sui CFU mancanti.',
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'MANUAL_VERIFICATION_REQUIRED',
      esitiVincoli,
      cfuMancantiTotali,
      motivazione: 'Verifica manuale richiesta su mappature o codici non affidabili.',
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  // Stati di integrazione (tristate). Ordine conservativo:
  //  1) 'NOT_SPECIFIED' (o assente) su almeno una regola → MANUAL_VERIFICATION_REQUIRED;
  //  2) tutte 'PROHIBITED' → NOT_ELIGIBLE con deficit esatto e tracciabilità;
  //  3) mix PROHIBITED/ALLOWED su più regole → MANUAL (ambiguità, niente deduzione);
  //  4) almeno una regola 'ALLOWED' (senza NOT_SPECIFIED né mix) → CONDITIONALLY_ELIGIBLE.
  const statiIntegrabilita = regole.map((regola) => regola.integrabilita ?? 'NOT_SPECIFIED');
  const nonSpecificato = statiIntegrabilita.includes('NOT_SPECIFIED');
  const tuttiProibiti =
    regole.length > 0 && statiIntegrabilita.every((stato) => stato === 'PROHIBITED');
  const presenzaMista =
    statiIntegrabilita.includes('PROHIBITED') && statiIntegrabilita.includes('ALLOWED');

  if (nonSpecificato) {
    audit.push(
      voceAudit(
        'solve',
        'warning',
        `CFU mancanti (${cfuMancantiTotali}): l'integrabilità non è dichiarata dalla regola (NOT_SPECIFIED) — verifica manuale richiesta.`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'MANUAL_VERIFICATION_REQUIRED',
      esitiVincoli,
      cfuMancantiTotali,
      motivazione:
        "Integrabilità non dichiarata dalla norma (NOT_SPECIFIED): nessuna deduzione automatica.",
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  if (tuttiProibiti) {
    const deficitIds = esitiVincoli
      .filter((esito) => esito.cfuMancanti > 0)
      .map((esito) => esito.vincoloId)
      .join(', ');
    audit.push(
      voceAudit(
        'solve',
        'errore',
        `Classe ${codiceClasse}: deficit CFU dichiarati non integrabili (${cfuMancantiTotali}) sui vincoli ${deficitIds || '-'}.`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'NOT_ELIGIBLE',
      esitiVincoli,
      cfuMancantiTotali,
      motivazione: `Deficit CFU non integrabili: ${cfuMancantiTotali} (vincoli: ${deficitIds || '-'}).`,
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  if (presenzaMista) {
    audit.push(
      voceAudit(
        'solve',
        'warning',
        `CFU mancanti (${cfuMancantiTotali}): regole con integrabilità mista PROHIBITED/ALLOWED — verifica manuale richiesta.`,
        { normativa, now },
      ),
    );
    return {
      codiceClasse,
      stato: 'MANUAL_VERIFICATION_REQUIRED',
      esitiVincoli,
      cfuMancantiTotali,
      motivazione: 'Integrabilità mista tra regole applicabili: verifica manuale richiesta.',
      regoleApplicate: regole.map((regola) => regola.id),
      normativa,
      audit,
    };
  }

  return {
    codiceClasse,
    stato: 'CONDITIONALLY_ELIGIBLE',
    esitiVincoli,
    cfuMancantiTotali,
    motivazione: `Integrazione dichiarata dalle regole: servono ${cfuMancantiTotali} CFU aggiuntivi.`,
    regoleApplicate: regole.map((regola) => regola.id),
    normativa,
    audit,
  };
}


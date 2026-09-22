/**
 * ScuoleRadar.it — Dipartimento CFU · calcolatore/valutazioneV1.
 *
 * COLLEGAMENTO motore → adapter (nessun React qui).
 *
 * Unica lettura della superficie di routing (`valutaClasseConRouting`) per la
 * V1: legge il VERDETTO (`esitoMotore`), i requisiti valutati, il deficit e le
 * fonti, li normalizza nel contratto di `esitoUtente.ts` e produce il risultato
 * utente. `pipeline.stato` NON viene letto: non esiste un secondo verdetto.
 *
 * Nessuna modifica normativa: la valutazione resta quella del motore.
 */
import { valutaClasseConRouting } from './analisi';
import {
  creaEsitoUtente,
  type AnalisiDeficitMotore,
  type EsitoUtenteV1,
  type FonteMotore,
} from './esitoUtente';
import type {
  EsitoValutazioneMotore,
  ParametriRequisitoMotore,
  RequisitoMotore,
} from './requisitoUtente';
import type { ClasseCoperta } from './classi';
import type { DefinizioneRequisito, ParametriRequisito } from '../engine/pipeline/requirementTypes';
import type { Esame } from '../shared/types';

export interface ParametriValutazioneV1 {
  readonly classe: ClasseCoperta;
  readonly esami: readonly Esame[];
  /** Classe di laurea del titolo dichiarata; `null` = non dichiarata. */
  readonly classeLaurea: string | null;
  /** Data della procedura (ISO, es. 2026-03-01); `null` = non dichiarata. */
  readonly dataProcedura: string | null;
}

/** Informazioni tecniche mantenute accanto al risultato (audit, non UI). */
export interface TecnicaValutazioneV1 {
  readonly engineSource: string;
  readonly esitoMotore: string | null;
  readonly regoleApplicate: readonly string[];
}

export interface RisultatoValutazioneV1 {
  readonly utente: EsitoUtenteV1;
  readonly tecnica: TecnicaValutazioneV1;
}

/** Riduce i parametri del motore a ciò che serve per l'etichetta utente. */
function parametriMotore(parametri: ParametriRequisito): ParametriRequisitoMotore {
  switch (parametri.tipo) {
    case 'cfu.ssd.singolo':
      return { tipo: 'cfu.ssd.singolo', ssd: parametri.ssd, min: parametri.min };
    case 'cfu.ssd.gruppo':
      return { tipo: 'cfu.ssd.gruppo', ssd: [...parametri.ssd], min: parametri.min };
    case 'cfu.ssd.disgiunzione':
      return {
        tipo: 'cfu.ssd.disgiunzione',
        opzioni: parametri.opzioni.map((opzione) => ({
          ssd: [...opzione.ssd],
          min: opzione.min,
        })),
      };
    case 'titolo.abilitante':
      return {
        tipo: 'titolo.abilitante',
        denominazione: parametri.denominazione,
        necessario: parametri.necessario,
      };
    case 'titolo.accesso.classe':
      return { tipo: 'titolo.accesso.classe', classiAmmesse: [...parametri.classiAmmesse] };
  }
}

function requisitoMotore(requisito: DefinizioneRequisito): RequisitoMotore {
  const evidenza = requisito.evidenze[0];
  return {
    id: requisito.id,
    tipo: requisito.tipo,
    parametri: parametriMotore(requisito.parametri),
    integrabilita: requisito.integrabilita,
    estratto: evidenza?.estrattoVerbatim ?? null,
    posizioneFonte: evidenza?.posizioneFonte ?? null,
  };
}

function sommaCfu(esami: readonly Esame[]): number {
  return Math.round(esami.reduce((totale, esame) => totale + (esame.cfu ?? 0), 0) * 10) / 10;
}

/** Riferimento normativo compatto per la UI (decreto · tabella · aggiornamento). */
function riferimentoNormativo(
  normativa: { decreto: string; tabella: string; dataAggiornamentoNormativa: string } | null,
): string | null {
  if (!normativa) return null;
  return `${normativa.decreto} · Tabella ${normativa.tabella} · agg. ${normativa.dataAggiornamentoNormativa}`;
}

/** Valuta UNA classe obiettivo e restituisce il risultato in lingua utente. */
export function valutaClasseV1(parametri: ParametriValutazioneV1): RisultatoValutazioneV1 {
  const { classe } = parametri;
  const routing = valutaClasseConRouting({
    esami: [...parametri.esami],
    classeCodice: classe.codice,
    denominazione: classe.denominazione,
    tabella: classe.tabella,
    classeLaureaTitolo: parametri.classeLaurea ?? undefined,
    dataProcedura: parametri.dataProcedura ?? undefined,
  });
  const pipeline = routing.pipeline;
  const valutazioni: EsitoValutazioneMotore[] = (routing.valutazioniRequisito ?? []).map((voce) => ({
    requisitoId: voce.requisitoId,
    stato: voce.stato,
    cfuRichiesti: voce.valori.cfuRichiesti,
    cfuPosseduti: voce.valori.cfuPosseduti,
    cfuMancanti: voce.valori.cfuMancanti,
    spiegazione: voce.spiegazione,
  }));
  const deficit: AnalisiDeficitMotore | null = routing.deficit
    ? {
        calcolabile: routing.deficit.calcolabile,
        cfuMancantiTotali: routing.deficit.cfuMancantiTotali,
        causaDeterminante: routing.deficit.causaDeterminante,
        motivo: routing.deficit.motivo,
        perRequisito: routing.deficit.perRequisito.map((voce) => ({
          requisitoId: voce.requisitoId,
          cfuMancanti: voce.cfuMancanti,
        })),
      }
    : null;
  const fonti: FonteMotore[] = (routing.fonti ?? []).map((fonte) => ({
    fonte: fonte.fonte,
    riferimento: fonte.articoloTabellaNota ?? null,
    verificata: fonte.verificata,
  }));

  const utente = creaEsitoUtente({
    classeCodice: classe.codice,
    classeDenominazione: classe.denominazione,
    // Autorità V1: il verdetto esiste solo se la valutazione è passata dal motore.
    esitoMotore: routing.isEngineDriven ? (routing.esitoMotore ?? null) : null,
    motivazione: routing.motivazione ?? `Valutazione motore per la classe ${classe.codice}.`,
    motivoNonValutato:
      routing.motivoFallback ??
      (routing.isEngineDriven
        ? null
        : 'Per questa classe non risulta una copertura normativa verificata: la verifica richiede un controllo manuale.'),
    esamiConsiderati: pipeline?.dati.esami.length ?? parametri.esami.length,
    cfuConteggiati: pipeline?.dati.cfuTotali ?? sommaCfu(parametri.esami),
    requisiti: (pipeline?.requisiti ?? []).map(requisitoMotore),
    valutazioni,
    deficit,
    fonti,
    conflitti: routing.conflitti?.length ?? 0,
    datiMancanti: pipeline?.identificazione.datiMancanti ?? [],
    codiciMancanti: pipeline?.dati.codiciMancanti ?? false,
    cfuNonValidi: pipeline?.dati.cfuNonValidi ?? false,
    riferimentoNormativo: riferimentoNormativo(pipeline?.fonti.normativa ?? null),
    percorsi: [],
  });

  return {
    utente,
    tecnica: {
      engineSource: routing.engineSource,
      esitoMotore: routing.esitoMotore ?? null,
      regoleApplicate: [...(routing.regoleApplicate ?? [])],
    },
  };
}

/**
 * ScuoleRadar.it — Dipartimento CFU · engine/normativeResolver.
 *
 * Modulo 3 — Risoluzione del contesto temporale normativo.
 *
 * Vincoli di sicurezza:
 *  - la selezione decreto/tabella avviene SOLO dalle finestre di vigenza
 *    dichiarate nel database autorevole (`normativeDatabase.ts`);
 *  - nessuna data, regola o disposizione transitoria viene inventata qui;
 *  - se per la data domanda non esiste alcun contesto (o ne esistono più di
 *    uno senza regola di prevalenza dichiarata), il resolver NON sceglie:
 *    restituisce `non-risolto`/`transitorio` e i moduli a valle rispondono
 *    INSUFFICIENT_DATA o MANUAL_VERIFICATION_REQUIRED.
 */
import type {
  DateRilevanza,
  DecretoNormativo,
  EsitoRisoluzioneNormativa,
  NormativaTemporalContext,
} from './types';
import { contestiNormativi } from './normativeDatabase';

/** Vocabolario dei decreti riconosciuti (non è una regola di vigenza). */
export const DECRETI_DISPONIBILI: readonly DecretoNormativo[] = [
  'DPR 19/2016',
  'DM 259/2017',
  'DM 22/12/2023',
  'DM 639/2024',
];

/**
 * Risolve il contesto normativo alla data della domanda.
 * @param dateRilevanza date utente (domanda obbligatoria, laurea/inizio corsi facoltative).
 * @param contesti finestre autorevoli; default = registri del database normativo.
 */
export function risolviNormativa(
  dateRilevanza: DateRilevanza,
  contesti: NormativaTemporalContext[] = contestiNormativi,
): EsitoRisoluzioneNormativa {
  const dataInizioCorso = dateRilevanza.dataInizioCorso ?? dateRilevanza.enrollmentDate ?? null;
  const dataLaurea = dateRilevanza.dataLaurea ?? dateRilevanza.awardedDate ?? null;
  const dataDomanda = dateRilevanza.dataDomanda ?? dateRilevanza.procedureDate ?? '';

  if (!dataDomanda) {
    return {
      stato: 'non-risolto',
      normativa: null,
      contesto: null,
      motivazione: 'Data della domanda mancante: impossibile risolvere il contesto normativo.',
    };
  }

  const applicabili = contesti.filter((contesto) => {
    const inizio = new Date(contesto.validFrom).getTime();
    const fine = contesto.validUntil ? new Date(contesto.validUntil).getTime() : Number.POSITIVE_INFINITY;
    return inizio <= new Date(dataDomanda).getTime() && new Date(dataDomanda).getTime() <= fine;
  });

  if (applicabili.length === 0) {
    return {
      stato: 'non-risolto',
      normativa: null,
      contesto: null,
      motivazione:
        'Nessun contesto normativo dichiarato per la data della domanda nel database autorevole.',
    };
  }

  if (applicabili.length > 1) {
    return {
      stato: 'transitorio',
      normativa: null,
      contesto: null,
      motivazione:
        'Più contesti normativi risultano in vigore alla data della domanda senza una regola di prevalenza dichiarata: la selezione richiede verifica manuale.',
    };
  }

  const contesto = applicabili[0];
  const conStorico = Boolean(dataLaurea || dataInizioCorso);
  return {
    stato: conStorico ? 'transitorio' : 'applicabile',
    normativa: {
      decreto: contesto.decreto,
      tabella: contesto.tabella,
      nota: contesto.note,
      periodoTransitorio: conStorico
        ? 'Date di laurea/inizio corso presenti: la vigenza potrebbe dipendere da disposizioni transitorie dichiarate nel database.'
        : null,
      dataAggiornamentoNormativa: contesto.dataAggiornamentoNormativa,
    },
    contesto,
    motivazione: `Contesto normativo dichiarato in vigore: ${contesto.decreto} · Tabella ${contesto.tabella} (${contesto.fonte}).`,
  };
}

/** Alias di lettura rapida per audit trail. */
export function etichettaNormativa(
  normativa: import('./types').NormativaApplicata,
): string {
  return `${normativa.decreto} · Tabella ${normativa.tabella} · agg. ${normativa.dataAggiornamentoNormativa}`;
}

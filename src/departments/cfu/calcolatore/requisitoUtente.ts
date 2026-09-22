/**
 * ScuoleRadar.it — Dipartimento CFU · calcolatore/requisitoUtente.
 *
 * TRADUZIONE requisito → voce leggibile (modulo PURO, nessun React).
 *
 * I tipi di questo file sono il CONTRATTO MINIMO che il calcolatore riceve dal
 * motore: `valutazioneV1.ts` li costruisce dalla superficie di routing e
 * `esitoUtente.ts` li trasforma in testo per l'utente. Qui NON si decide nulla
 * di normativo: si etichetta e si formatta ciò che il motore ha già calcolato.
 *
 * Regole non negoziabili:
 *  - `cfuMancanti` resta `null` quando il motore non lo rende calcolabile
 *    (mai 0 di comodo, mai un numero inventato);
 *  - uno stato non deciso dal motore diventa `da-verificare`, MAI un "non
 *    soddisfatto" dedotto dalla UI.
 */

/** Tipi di requisito dichiarati dalle fonti (specchio di `pipeline/requirementTypes`). */
export type TipoRequisitoMotore =
  | 'cfu.ssd.singolo'
  | 'cfu.ssd.gruppo'
  | 'cfu.ssd.disgiunzione'
  | 'titolo.abilitante'
  | 'titolo.accesso.classe';

/** Stati del singolo requisito prodotti dal motore. */
export type StatoRequisitoMotore =
  | 'SODDISFATTO'
  | 'NON_SODDISFATTO'
  | 'COMPUTAZIONE_INCERTA'
  | 'DATI_INSUFFICIENTI'
  | 'NON_VALUTABILE';

/** Integrabilità dichiarata dalla fonte PER il requisito (mai dedotta). */
export type IntegrabilitaMotore = 'ALLOWED' | 'PROHIBITED' | 'NOT_SPECIFIED';

/** Parametri del requisito, ridotti a ciò che serve per l'etichetta utente. */
export type ParametriRequisitoMotore =
  | { readonly tipo: 'cfu.ssd.singolo'; readonly ssd: string; readonly min: number }
  | { readonly tipo: 'cfu.ssd.gruppo'; readonly ssd: readonly string[]; readonly min: number }
  | {
      readonly tipo: 'cfu.ssd.disgiunzione';
      readonly opzioni: readonly { readonly ssd: readonly string[]; readonly min: number }[];
    }
  | { readonly tipo: 'titolo.abilitante'; readonly denominazione: string; readonly necessario: boolean }
  | { readonly tipo: 'titolo.accesso.classe'; readonly classiAmmesse: readonly string[] };

/** Requisito dichiarato dalla fonte, con la sua evidenza verbatim. */
export interface RequisitoMotore {
  readonly id: string;
  readonly tipo: TipoRequisitoMotore;
  readonly parametri: ParametriRequisitoMotore;
  readonly integrabilita: IntegrabilitaMotore;
  /** Estratto verbatim della fonte che sostiene il requisito (quando presente). */
  readonly estratto: string | null;
  readonly posizioneFonte: string | null;
}

/** Esito del requisito prodotto dal motore (nessun ricalcolo qui). */
export interface EsitoValutazioneMotore {
  readonly requisitoId: string;
  readonly stato: StatoRequisitoMotore;
  readonly cfuRichiesti: number | null;
  readonly cfuPosseduti: number | null;
  readonly cfuMancanti: number | null;
  readonly spiegazione: readonly string[];
}

/** Esito del requisito nella lingua dell'utente. */
export type EsitoRequisitoUtente = 'soddisfatto' | 'non-soddisfatto' | 'da-verificare';

export interface VoceRequisitoUtente {
  readonly id: string;
  readonly tipo: TipoRequisitoMotore;
  readonly etichetta: string;
  readonly esito: EsitoRequisitoUtente;
  readonly dettaglio: string;
  readonly cfuMancanti: number | null;
  readonly integrabilita: 'integrabile' | 'non-integrabile' | 'non-dichiarata';
  readonly estratto: string | null;
}

/** Etichetta in italiano del requisito, ricavata dai parametri dichiarati. */
export function etichettaRequisito(parametri: ParametriRequisitoMotore): string {
  switch (parametri.tipo) {
    case 'cfu.ssd.singolo':
      return `Almeno ${parametri.min} CFU in ${parametri.ssd}`;
    case 'cfu.ssd.gruppo':
      return `Almeno ${parametri.min} CFU nei settori ${parametri.ssd.join(', ')}`;
    case 'cfu.ssd.disgiunzione': {
      const minimi = parametri.opzioni.map((opzione) => opzione.min);
      const unoUguale = minimi.length > 0 && minimi.every((min) => min === minimi[0]);
      if (unoUguale) {
        return `Almeno ${minimi[0]} CFU in uno fra ${parametri.opzioni
          .map((opzione) => opzione.ssd.join(' + '))
          .join(' oppure ')}`;
      }
      return `In uno fra: ${parametri.opzioni
        .map((opzione) => `${opzione.ssd.join(' + ')} (almeno ${opzione.min} CFU)`)
        .join(' oppure ')}`;
    }
    case 'titolo.abilitante':
      return parametri.necessario
        ? `Titolo necessario: ${parametri.denominazione}`
        : `Titolo dichiarato dalla norma: ${parametri.denominazione}`;
    case 'titolo.accesso.classe':
      return `Classe di laurea del titolo fra quelle ammesse: ${parametri.classiAmmesse.join(', ')}`;
  }
}

/** Requisito di crediti (gli unici per cui l'integrabilità è significativa). */
function eRequisitoCrediti(tipo: TipoRequisitoMotore): boolean {
  return tipo === 'cfu.ssd.singolo' || tipo === 'cfu.ssd.gruppo' || tipo === 'cfu.ssd.disgiunzione';
}

function traduciIntegrabilita(
  tipo: TipoRequisitoMotore,
  integrabilita: IntegrabilitaMotore,
): VoceRequisitoUtente['integrabilita'] {
  if (!eRequisitoCrediti(tipo)) return 'non-dichiarata';
  if (integrabilita === 'ALLOWED') return 'integrabile';
  if (integrabilita === 'PROHIBITED') return 'non-integrabile';
  return 'non-dichiarata';
}

function statoInEsitoUtente(stato: StatoRequisitoMotore | undefined): EsitoRequisitoUtente {
  if (stato === 'SODDISFATTO') return 'soddisfatto';
  if (stato === 'NON_SODDISFATTO') return 'non-soddisfatto';
  // Nessun esito o esito non deciso dal motore: mai "non soddisfatto" per deduzione.
  return 'da-verificare';
}

function ultimaSpiegazione(valutazione: EsitoValutazioneMotore | undefined): string {
  if (!valutazione || valutazione.spiegazione.length === 0) {
    return 'Il motore non ha prodotto una spiegazione per questo requisito.';
  }
  return valutazione.spiegazione[valutazione.spiegazione.length - 1]!;
}

function dettaglioRequisito(
  esito: EsitoRequisitoUtente,
  valutazione: EsitoValutazioneMotore | undefined,
): string {
  if (esito === 'soddisfatto') {
    const posseduti = valutazione?.cfuPosseduti ?? null;
    const richiesti = valutazione?.cfuRichiesti ?? null;
    return posseduti !== null && richiesti !== null
      ? `Requisito soddisfatto: ${posseduti} CFU conteggiati su ${richiesti} richiesti.`
      : 'Requisito soddisfatto sui dati forniti.';
  }
  if (esito === 'non-soddisfatto') {
    const mancanti = valutazione?.cfuMancanti ?? null;
    const richiesti = valutazione?.cfuRichiesti ?? null;
    if (mancanti !== null && richiesti !== null) {
      return `Requisito non soddisfatto: mancano ${mancanti} CFU sui ${richiesti} richiesti.`;
    }
    return `Requisito non soddisfatto. ${ultimaSpiegazione(valutazione)}`;
  }
  return ultimaSpiegazione(valutazione);
}

/** Costruisce la voce utente di UN requisito (definizione + esito del motore). */
export function creaVoceRequisito(
  requisito: RequisitoMotore,
  valutazione: EsitoValutazioneMotore | undefined,
): VoceRequisitoUtente {
  const esito = statoInEsitoUtente(valutazione?.stato);
  return {
    id: requisito.id,
    tipo: requisito.tipo,
    etichetta: etichettaRequisito(requisito.parametri),
    esito,
    dettaglio: dettaglioRequisito(esito, valutazione),
    cfuMancanti: valutazione?.cfuMancanti ?? null,
    integrabilita: traduciIntegrabilita(requisito.tipo, requisito.integrabilita),
    estratto: requisito.estratto,
  };
}

/** Frase sull'integrabilità di un requisito di CFU non soddisfatto. */
export function etichettaIntegrabilita(voce: VoceRequisitoUtente): string | null {
  if (voce.esito !== 'non-soddisfatto') return null;
  if (voce.integrabilita === 'integrabile') {
    return 'La norma dichiara questi CFU integrabili.';
  }
  if (voce.integrabilita === 'non-integrabile') {
    return 'La norma non ammette integrazione di questi CFU.';
  }
  return 'La norma non dichiara se questi CFU siano integrabili: serve una verifica.';
}

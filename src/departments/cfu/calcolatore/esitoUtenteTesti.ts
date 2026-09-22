/**
 * ScuoleRadar.it — Dipartimento CFU · calcolatore/esitoUtenteTesti.
 *
 * TESTI utente del risultato V1 (modulo PURO, nessuna dipendenza da React né
 * dall'adapter: importa solo le voci già tradotte). Definisce anche il
 * vocabolario di stato condiviso (`StatoEsitoUtente`).
 *
 * Qui NON si decide nulla: le frasi descrivono solo ciò che il motore ha
 * dichiarato. In particolare non esiste alcun testo che trasformi
 * "verifica manuale" in un "no" o che inventi CFU mancanti.
 */
import type { VoceRequisitoUtente } from './requisitoUtente';

/** I cinque stati ufficiali del motore, nella lettura dell'utente. */
export type StatoEsitoUtente =
  | 'ELIGIBLE'
  | 'CONDITIONALLY_ELIGIBLE'
  | 'INSUFFICIENT_DATA'
  | 'MANUAL_VERIFICATION_REQUIRED'
  | 'NOT_ELIGIBLE';

/** Informazione mancante per il calcolo, con il motivo per cui serve. */
export interface DatoMancanteUtente {
  readonly etichetta: string;
  readonly perche: string;
}

const MOTIVI_DATI_MANCANTI: Record<string, string> = {
  'classe di concorso obiettivo':
    'Senza la classe obiettivo non sappiamo quali requisiti confrontare con la tua carriera.',
  'titolo accademico': "L'accesso alla classe dipende dal titolo di studio conseguito.",
  'denominazione del titolo': 'Serve per identificare il titolo valutato nella verifica.',
  'classe di laurea del titolo':
    'La norma ammette solo determinate classi di laurea: senza questa informazione il requisito di accesso resta non verificabile.',
  'data della procedura':
    'La data della domanda o del concorso determina quale versione della norma si applica.',
};

/** Etichetta utente di un dato mancante + motivo per cui è necessario. */
export function creaDatoMancante(dato: string): DatoMancanteUtente {
  return {
    etichetta: dato,
    perche: MOTIVI_DATI_MANCANTI[dato] ?? 'Serve per completare la verifica dei requisiti.',
  };
}

/** Titolo del risultato per ciascuno stato. */
export function titoloPerStato(stato: StatoEsitoUtente, codice: string): string {
  switch (stato) {
    case 'ELIGIBLE':
      return `Requisiti soddisfatti per ${codice}`;
    case 'CONDITIONALLY_ELIGIBLE':
      return `Ammissibile con integrazione per ${codice}`;
    case 'INSUFFICIENT_DATA':
      return `Dati insufficienti per verificare ${codice}`;
    case 'MANUAL_VERIFICATION_REQUIRED':
      return `Serve una verifica per ${codice}`;
    case 'NOT_ELIGIBLE':
      return `Accesso non consentito a ${codice}`;
  }
}

export function eRequisitoDiAccesso(tipo: VoceRequisitoUtente['tipo']): boolean {
  return tipo === 'titolo.accesso.classe' || tipo === 'titolo.abilitante';
}

/** Requisito che determina il blocco: prima i requisiti di titolo/accesso. */
export function requisitoBloccante(
  mancanti: readonly VoceRequisitoUtente[],
): VoceRequisitoUtente | null {
  if (mancanti.length === 0) return null;
  return mancanti.find((voce) => eRequisitoDiAccesso(voce.tipo)) ?? mancanti[0]!;
}

/** Dati minimi per la frase di sintesi dello stato. */
export interface DatiFraseSpiegazione {
  readonly classeCodice: string;
  readonly motivazione: string;
  readonly haVerdettoMotore: boolean;
  readonly motivoNonValutato: string | null;
  readonly percorsiDisponibili: boolean;
}

/** Frase base che spiega lo stato (il resto lo aggiunge l'adapter coi dati reali). */
export function fraseBaseSpiegazione(
  dati: DatiFraseSpiegazione,
  stato: StatoEsitoUtente,
): string {
  if (!dati.haVerdettoMotore) {
    return (
      dati.motivoNonValutato ??
      'Il motore non ha emesso un verdetto per questa classe: la verifica richiede un controllo manuale.'
    );
  }
  switch (stato) {
    case 'ELIGIBLE':
      return `Tutti i requisiti dichiarati per la classe ${dati.classeCodice} risultano soddisfatti sui dati che hai fornito.`;
    case 'CONDITIONALLY_ELIGIBLE':
      return dati.percorsiDisponibili
        ? 'La norma consente di colmare i crediti mancanti seguendo i passi indicati.'
        : 'La fonte non descrive un percorso di integrazione automatico: le modalità vanno verificate con la segreteria didattica.';
    case 'INSUFFICIENT_DATA':
      return 'Aggiungi le informazioni mancanti e ripeti il calcolo: il verdetto può cambiare.';
    case 'MANUAL_VERIFICATION_REQUIRED':
      return 'Non è un "no": è un punto che il sistema non può decidere da solo con questi dati.';
    case 'NOT_ELIGIBLE':
      return "Il requisito indicato blocca l'accesso alla classe.";
  }
}

/** Dati tecnici che l'utente deve sapere quando il calcolo non è automatico. */
export interface DatiVerifica {
  readonly codiciMancanti: boolean;
  readonly cfuNonValidi: boolean;
  readonly conflitti: number;
  /**
   * true quando il motore ha PROVATO il positivo sui dati conteggiati: in quel
   * caso un settore non dichiarato su altri esami non può ribaltare l'esito e
   * non va segnalato (nessuna incertezza indotta).
   */
  readonly verdettoPositivo: boolean;
}

/** Elenco “cosa verificare / cosa completare” per i casi non decisi dal motore. */
export function frasiCosaVerificare(
  dati: DatiVerifica,
  daVerificare: readonly VoceRequisitoUtente[],
): string[] {
  const frasi: string[] = [];
  if (dati.codiciMancanti && !dati.verdettoPositivo) {
    frasi.push(
      'Dichiara il settore SSD per ogni esame (oppure "non lo so"): senza il settore la quota di crediti non è verificabile.',
    );
  }
  if (dati.cfuNonValidi && !dati.verdettoPositivo) {
    frasi.push(
      'Sono presenti crediti non numerici: finché restano, il conteggio dei CFU non è affidabile.',
    );
  }
  if (dati.conflitti > 0) {
    frasi.push(
      'Le fonti autorevoli disponibili non concordano su questo punto: il sistema non sceglie al posto tuo.',
    );
  }
  for (const voce of daVerificare.slice(0, 3)) {
    frasi.push(`Verifica con la segreteria o l'USR competente: ${voce.etichetta}.`);
  }
  return frasi;
}

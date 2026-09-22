/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/dossierTypes.
 *
 * CONTRATTO DEL FASCICOLO ACCADEMICO PERSISTENTE (fase 6.5 — decisione di prodotto):
 * l'utente conserva nel proprio profilo titoli, esami, CFU, SSD/GSD, certificazioni e
 * i documenti originali caricati, e potrà consultarli/scaricarli. Il fascicolo è la
 * base riusabile per calcolo CFU, verifica requisiti, precompilazione di documenti e
 * abbinamento alle opportunità.
 *
 * ⚠️ CONTRATTO, non implementazione: upload, storage, retention, deduplica e
 * risoluzione delle discrepanze NON sono implementati e nessun modulo del motore legge
 * questi tipi. Il CONTENUTO dei documenti resta fuori dal motore: `DocumentoCaricato` è
 * il riferimento (id, impronta, conservazione). Nessun identificativo dell'utente entra
 * nel motore (privacy by design): il collegamento al profilo è del livello di ingresso.
 *
 * Lineage non negoziabile: DOCUMENTO ORIGINALE → EVIDENZA → FATTO NORMALIZZATO →
 * (opz.) STIMA → (opz.) VERIFICA. La normalizzazione non distrugge mai l'originale.
 */
import type { EsameCanonico, TitoloAccademicoCanonico } from './resultTypes';

/** Natura del documento caricato (il formato è un fatto del file, non del contenuto). */
export type TipoDocumento =
  | 'certificato-laurea'
  | 'libretto-o-transcript'
  | 'certificazione' // attestato di un ente (lingua, informatica, abilitazioni…)
  | 'autocertificazione'
  | 'altro';

export type EsitoEstrazioneDocumento = 'in-attesa' | 'estratto' | 'parziale' | 'illeggibile';

/**
 * Conservazione dell'ORIGINALE: `originale` = file conservato e scaricabile;
 * `soli-dati` = originale eliminato secondo policy, restano i dati derivati (nessuna
 * prova fantasma: la provenienza resta, l'evidenza fisica no).
 */
export type ConservazioneDocumento = 'originale' | 'soli-dati';

/** Riferimento a un documento caricato e conservato nel fascicolo dell'utente. */
export interface DocumentoCaricato {
  readonly documentId: string;
  readonly tipo: TipoDocumento;
  /** Nome file originale, per il controllo umano. */
  readonly nome: string;
  readonly formato: 'pdf' | 'immagine';
  /** Data (ISO) di ricezione: base per la retention. */
  readonly ricevutoIl: string;
  readonly pagine: number;
  /** Impronta del file: identifica il documento senza conservarne il contenuto. */
  readonly improntaSha256: string | null;
  readonly esitoEstrazione: EsitoEstrazioneDocumento;
  readonly conservazione: ConservazioneDocumento;
}

/** Valore concorrente di uno stesso fatto logico, con la sua provenienza. */
export interface ValoreInDiscrepanza {
  readonly valore: string;
  /** Documento che dichiara il valore; null = dati utente o deduzione interna. */
  readonly documentId: string | null;
  readonly confidenza: number;
}

/** DISCREPANZA fra documenti (es. Doc A: 6 CFU, Doc B: 9 CFU): il motore non sceglie. */
export interface DiscrepanzaDato {
  /** Identità logica del fatto (chiave di deduplica), es. `esame::storia-moderna`. */
  readonly chiaveLogica: string;
  /** Campo in conflitto, es. `cfu`, `ssd`, `classe`, `dataLaurea`. */
  readonly campo: string;
  readonly valori: readonly ValoreInDiscrepanza[];
  /** `non-risolta` finché utente/revisore non decide; la decisione resta tracciata. */
  readonly stato: 'non-risolta' | 'risolta';
}

/**
 * AMBIGUITÀ DI IDENTITÀ (fase 6.7): due o più evidenze POTREBBERO riferirsi allo stesso
 * esame accademico, ma le prove disponibili non bastano per deciderlo (nome generico,
 * CFU incoerenti, anno diverso, codice assente…). La deduplica NON si pronuncia: nessuna
 * associazione silenziosa, nessun doppio conteggio silenzioso, nessuna evidenza scartata.
 */
export interface AmbiguitaIdentita {
  /** Chiave logica PROPOSTA per l'identità dell'esame (secondo i segnali disponibili). */
  readonly chiaveLogica: string;
  /** Id delle evidenze/fatti coinvolti (esami del fascicolo o righe di documento). */
  readonly evidenze: readonly string[];
  /** Perché l'identità non è decidibile, in chiaro (es. «nome generico», «CFU 6 vs 9»). */
  readonly motivo: string;
  /** `da-rivedere` finché utente/revisore non decide; la decisione resta tracciata. */
  readonly stato: 'da-rivedere' | 'risolta';
}

/** FASCICOLO ACCADEMICO dell'utente: vista aggregata e riusabile dei dati derivati. */
export interface DossierAccademico {
  readonly documenti: readonly DocumentoCaricato[];
  /** Uno o più titoli (una carriera può comprenderne più di uno). */
  readonly titoli: readonly TitoloAccademicoCanonico[];
  readonly esami: readonly EsameCanonico[];
  readonly discrepanze: readonly DiscrepanzaDato[];
  /**
   * Ambiguità di identità NON risolte: finché questa lista non è vuota l'elenco degli
   * esami NON è definitivo (non si può garantire l'assenza di doppio conteggio).
   */
  readonly ambiguitaIdentita: readonly AmbiguitaIdentita[];
}

/**
 * ScuoleRadar.it — Dipartimento CFU · engine/traceability/traceabilityChain.
 *
 * CATENA DI TRACCIABILITÀ NORMATIVA — modello minimo, puro, in-memory:
 *
 *    Source ──(location: page/paragraph/offset)──▶ Evidence ──▶ Proposition
 *                                                                  │
 *        Rule (vincolo computabile) ◀──derivata──┘                 │
 *        Relation (AMENDS/REPEALS/…) ──────────────────────────────┘
 *
 * Vincoli del modulo:
 *  - solo TypeScript puro: zero dipendenze, zero database, zero UI;
 *  - strutture IMMUTABILI (Object.freeze nelle factory di costruzione);
 *  - ogni entità porta uno `stato` della catena: 'ACTIVE' | 'PROPOSED' |
 *    'UNCERTAIN' | 'MANUAL_VERIFICATION_REQUIRED';
 *  - ogni `Evidence` è ancorata a un `Source` via hash e coordinate;
 *  - nessun resolver di applicabilità temporale qui (fuori scope).
 */

/** Stato della catena condiviso da tutte le entità. */
export type StatoCatena =
  | 'ACTIVE'
  | 'PROPOSED'
  | 'UNCERTAIN'
  | 'MANUAL_VERIFICATION_REQUIRED';

const RE_HASH_SHA256 = /^[0-9a-f]{64}$/;

/* ------------------------------ 1. Source ------------------------------ */

export type TipoDocumentoSorgente =
  | 'decreto-ministeriale'
  | 'gazzetta-ufficiale'
  | 'tabella'
  | 'allegato'
  | 'altro';

/** Riferimento di pubblicazione ufficiale dell'artefatto. */
export interface PubblicazioneNormativa {
  readonly riferimento: string;
  /** Data ISO di pubblicazione, quando nota. */
  readonly data?: string;
  /** Articolo/tabella/nota interna al documento (es. "Tabella A — Classe A-11"). */
  readonly articoloNota?: string;
}

/**
 * Artefatto documentale immutabile (es. un decreto ministeriale o un file raw
 * della Gazzetta Ufficiale). `hash` è l'identificatore di integrità (SHA-256
 * esadecimale dell'intero artefatto) ed è la radice della catena di tracciabilità.
 */
export interface Source {
  readonly id: string;
  /** SHA-256 esadecimale (64 char) dell'intero artefatto. */
  readonly hash: string;
  /** Autorità emanante (es. "MIM"). */
  readonly autorita: string;
  readonly titolo: string;
  readonly tipoDocumento: TipoDocumentoSorgente;
  readonly pubblicazione: PubblicazioneNormativa;
  /** Percorso del file raw di riferimento, se presente (es. 'sources/raw/…'). */
  readonly rawFilePath: string | null;
  readonly stato: StatoCatena;
}

export interface ParametriSource {
  id: string;
  hash: string;
  autorita: string;
  titolo: string;
  tipoDocumento: TipoDocumentoSorgente;
  pubblicazione: PubblicazioneNormativa;
  rawFilePath?: string | null;
  stato?: StatoCatena;
}

/** Crea e CONGELA una Source; lancia TypeError se l'hash non è SHA-256 hex. */
export function creaSource(parametri: ParametriSource): Source {
  if (!RE_HASH_SHA256.test(parametri.hash)) {
    throw new TypeError(`creaSource: hash non SHA-256 esadecimale (${parametri.hash}).`);
  }
  return Object.freeze<Source>({
    id: parametri.id,
    hash: parametri.hash,
    autorita: parametri.autorita,
    titolo: parametri.titolo,
    tipoDocumento: parametri.tipoDocumento,
    pubblicazione: Object.freeze({ ...parametri.pubblicazione }),
    rawFilePath: parametri.rawFilePath ?? null,
    stato: parametri.stato ?? 'ACTIVE',
  });
}

/* ------------------------------ 2. Evidence ------------------------------ */

/**
 * Coordinate fisiche di localizzazione dell'estratto dentro la Source
 * (pagina/paragrafo/riga e/o offset di caratteri sull'artefatto).
 */
export interface CoordinateEvidence {
  /** Pagina 1-based del documento, quando disponibile. */
  readonly pagina?: number;
  /** Paragrafo/sezione 1-based, quando disponibile. */
  readonly paragrafo?: number;
  /** Riga 1-based del file/estratto raw, quando disponibile. */
  readonly riga?: number;
  /** Offset di carattere iniziale (inclusivo) nel testo completo. */
  readonly offsetInizio?: number;
  /** Offset di carattere finale (esclusivo) nel testo completo. */
  readonly offsetFine?: number;
  readonly nota?: string;
}

/**
 * Estratto VERBATIM ancorato STRETTAMENTE a una Source: `sourceHash` + coordinate.
 */
export interface Evidence {
  readonly id: string;
  /** Hash SHA-256 della Source da cui l'estratto è stato copiato. */
  readonly sourceHash: string;
  /** Testo verbatim (mai parafrasato). */
  readonly testo: string;
  readonly coordinate: CoordinateEvidence;
  readonly stato: StatoCatena;
}

export interface ParametriEvidence {
  id: string;
  sourceHash: string;
  testo: string;
  coordinate?: CoordinateEvidence;
  stato?: StatoCatena;
}

/** Crea e CONGELA una Evidence, vincolando testo verbatim e coordinate minime. */
export function creaEvidence(parametri: ParametriEvidence): Evidence {
  const testo = parametri.testo.trim();
  if (!testo) throw new TypeError('creaEvidence: testo verbatim vuoto.');
  if (!RE_HASH_SHA256.test(parametri.sourceHash)) {
    throw new TypeError(`creaEvidence: sourceHash non SHA-256 esadecimale (${parametri.sourceHash}).`);
  }
  const coordinate: CoordinateEvidence = Object.freeze({ ...(parametri.coordinate ?? {}) });
  const haCoordinate =
    coordinate.pagina !== undefined ||
    coordinate.paragrafo !== undefined ||
    coordinate.riga !== undefined ||
    coordinate.offsetInizio !== undefined;
  if (!haCoordinate) {
    throw new TypeError(
      'creaEvidence: servono coordinate di localizzazione (pagina/paragrafo/riga/offset).',
    );
  }
  if (
    coordinate.offsetInizio !== undefined &&
    coordinate.offsetFine !== undefined &&
    coordinate.offsetInizio > coordinate.offsetFine
  ) {
    throw new TypeError('creaEvidence: offsetInizio non può superare offsetFine.');
  }
  return Object.freeze<Evidence>({
    id: parametri.id,
    sourceHash: parametri.sourceHash,
    testo,
    coordinate,
    stato: parametri.stato ?? 'ACTIVE',
  });
}

/* ------------------------------ 3. Proposition ------------------------------ */

/**
 * Enunciato normativo ATOMICO sostenuto da UNA O PIÙ Evidence (mai da nessuna
 * altra fonte). Un enunciato non supportato da verbatim non può esistere.
 */
export interface Proposition {
  readonly id: string;
  /** Enunciato atomico in forma strutturata (sintesi fedele delle Evidence). */
  readonly contenutoAtomico: string;
  /** Supporto testuale verbatim (>= 1, obbligatorio). */
  readonly evidenze: readonly Evidence[];
  readonly stato: StatoCatena;
}

export interface ParametriProposition {
  id: string;
  contenutoAtomico: string;
  evidenze: readonly Evidence[];
  stato?: StatoCatena;
}

/** Crea e CONGELA una Proposition: richiede almeno un'Evidence di supporto. */
export function creaProposition(parametri: ParametriProposition): Proposition {
  const evidenze = Object.freeze([...parametri.evidenze]);
  if (evidenze.length === 0) {
    throw new TypeError('creaProposition: servono almeno una Evidence di supporto.');
  }
  if (!parametri.contenutoAtomico.trim()) {
    throw new TypeError('creaProposition: contenutoAtomico vuoto.');
  }
  return Object.freeze<Proposition>({
    id: parametri.id,
    contenutoAtomico: parametri.contenutoAtomico,
    evidenze,
    stato: parametri.stato ?? 'ACTIVE',
  });
}

/* ------------------------------ 4. Relation ------------------------------ */

/** Tipi di collegamento normativo esplicito supportati. */
export type TipoRelazione = 'AMENDS' | 'REPEALS' | 'REPLACES' | 'APPLIES_FROM';

/** Riferimento generico di un estremo della relazione (id logico della catena). */
export interface RiferimentoCatena {
  readonly tipo: 'source' | 'proposition' | 'relation' | 'rule' | 'contesto';
  readonly id: string;
}

/**
 * Collegamento normativo esplicito tra estremi della catena. Le Evidence di
 * supporto sono OBBLIGATORIE: una relazione senza citazione verbatim non è
 * dichiarabile.
 */
export interface Relation {
  readonly id: string;
  readonly tipo: TipoRelazione;
  readonly soggetto: RiferimentoCatena;
  readonly oggetto: RiferimentoCatena;
  readonly evidenze: readonly Evidence[];
  readonly stato: StatoCatena;
  readonly nota?: string;
}

export interface ParametriRelation {
  id: string;
  tipo: TipoRelazione;
  soggetto: RiferimentoCatena;
  oggetto: RiferimentoCatena;
  evidenze: readonly Evidence[];
  stato?: StatoCatena;
  nota?: string;
}

/** Crea e CONGELA una Relation: le Evidence di supporto sono obbligatorie. */
export function creaRelation(parametri: ParametriRelation): Relation {
  const evidenze = Object.freeze([...parametri.evidenze]);
  if (evidenze.length === 0) {
    throw new TypeError('creaRelation: servono almeno una Evidence di supporto.');
  }
  return Object.freeze<Relation>({
    id: parametri.id,
    tipo: parametri.tipo,
    soggetto: Object.freeze({ ...parametri.soggetto }),
    oggetto: Object.freeze({ ...parametri.oggetto }),
    evidenze,
    stato: parametri.stato ?? 'ACTIVE',
    nota: parametri.nota,
  });
}


/* ------------------------------ 5. Rule (vincolo computabile) ------------------------------ */

/**
 * Vincolo matematico/logico computabile derivato da una Proposition.
 * Rappresentazione minima (nessun collegamento col motore esistente):
 *  - singolo SSD con minimo CFU;
 *  - gruppo di SSD con minimo complessivo (somma, senza doppio conteggio);
 *  - disgiunzione esplicita di opzioni (6+6 NON vale 12 in un'opzione).
 */
export type VincoloCFU =
  | {
      readonly tipo: 'singoloSsdMinCfu';
      readonly ssd: string;
      readonly minCfu: number;
    }
  | {
      readonly tipo: 'gruppoSsdMinCfu';
      readonly ssd: readonly string[];
      readonly minCfu: number;
    }
  | {
      readonly tipo: 'disgiunzioneMinCfu';
      readonly opzioni: readonly {
        readonly id: string;
        readonly ssd: readonly string[];
        readonly minCfu: number;
      }[];
    };

/** Dominio di valutazione usato dal SourceRegistry per il lookup delle Rule. */
export type TipoDominioValutazione =
  | 'classeConcorso'
  | 'classeLaurea'
  | 'ambitoDisciplinare';

/** Chiave di dominio (es. classe concorso "A-11", classe di laurea "LM-14"). */
export interface DominioValutazione {
  readonly tipo: TipoDominioValutazione;
  readonly codice: string;
}

export function dominioClasseConcorso(codice: string): DominioValutazione {
  return Object.freeze<DominioValutazione>({ tipo: 'classeConcorso', codice });
}

export function dominioClasseLaurea(codice: string): DominioValutazione {
  return Object.freeze<DominioValutazione>({ tipo: 'classeLaurea', codice });
}

export function dominioAmbitoDisciplinare(codice: string): DominioValutazione {
  return Object.freeze<DominioValutazione>({ tipo: 'ambitoDisciplinare', codice });
}

/** Regola computabile derivata da una Proposition (tracciata via id). */
export interface Rule {
  readonly id: string;
  /** Id della Proposition da cui la regola è stata estratta. */
  readonly proposizioneId: string;
  readonly vincolo: VincoloCFU;
  /** Espressione leggibile del vincolo (documentazione, mai fonte). */
  readonly formula: string;
  /**
   * Domini di valutazione ai quali la regola si applica (es. classe di laurea
   * LM-14, classe di concorso A-11). Assente/[] ⇒ nessun dominio dichiarato.
   */
  readonly dominii?: readonly DominioValutazione[];
  readonly stato: StatoCatena;
  readonly nota?: string;
}

export interface ParametriRule {
  id: string;
  proposizioneId: string;
  vincolo: VincoloCFU;
  dominii?: readonly DominioValutazione[];
  stato?: StatoCatena;
  nota?: string;
}

/** Rappresentazione leggibile e deterministica del vincolo. */
export function stringaVincolo(vincolo: VincoloCFU): string {
  if (vincolo.tipo === 'singoloSsdMinCfu') {
    return `min ${vincolo.minCfu} CFU in ${vincolo.ssd}`;
  }
  if (vincolo.tipo === 'gruppoSsdMinCfu') {
    return `min ${vincolo.minCfu} CFU complessivi in [${vincolo.ssd.join(', ')}]`;
  }
  return vincolo.opzioni
    .map((opzione) => `${opzione.minCfu} CFU in [${opzione.ssd.join(' o ')}]`)
    .join(' | oppure ');
}

/** Crea e CONGELA una Rule (nessuna logica applicativa qui). */
export function creaRule(parametri: ParametriRule): Rule {
  const formula = stringaVincolo(parametri.vincolo);
  return Object.freeze<Rule>({
    id: parametri.id,
    proposizioneId: parametri.proposizioneId,
    vincolo: Object.freeze({ ...parametri.vincolo }),
    formula,
    dominii: parametri.dominii
      ? Object.freeze([...parametri.dominii].map((dominio) => Object.freeze({ ...dominio })))
      : undefined,
    stato: parametri.stato ?? 'ACTIVE',
    nota: parametri.nota,
  });
}

/* ------------------------------ Registro in-memory ------------------------------ */

/**
 * Registro in-memory che tiene le istanze CONDIVISE della catena.
 * Le mappe sono chiavi: fonti → hash; evidenze/proposizioni/relazioni/regole → id.
 */
export interface RegistroCatena {
  readonly fonti: ReadonlyMap<string, Source>;
  readonly evidenze: ReadonlyMap<string, Evidence>;
  readonly proposizioni: ReadonlyMap<string, Proposition>;
  readonly relazioni: ReadonlyMap<string, Relation>;
  readonly regole: ReadonlyMap<string, Rule>;
}

export interface ParametriRegistroCatena {
  fonti?: readonly Source[];
  evidenze?: readonly Evidence[];
  proposizioni?: readonly Proposition[];
  relazioni?: readonly Relation[];
  regole?: readonly Rule[];
}

/**
 * Costruisce il registro raccogliendo le stesse istanze (reference identity)
 * usate da proposizioni/relazioni: nessuna copia, nessun doppione.
 */
export function creaRegistroCatena(parametri: ParametriRegistroCatena = {}): RegistroCatena {
  const evidenze = new Map<string, Evidence>();
  for (const evidence of parametri.evidenze ?? []) evidenze.set(evidence.id, evidence);
  for (const proposizione of parametri.proposizioni ?? []) {
    for (const evidence of proposizione.evidenze) evidenze.set(evidence.id, evidence);
  }
  for (const relazione of parametri.relazioni ?? []) {
    for (const evidence of relazione.evidenze) evidenze.set(evidence.id, evidence);
  }
  return Object.freeze<RegistroCatena>({
    fonti: new Map((parametri.fonti ?? []).map((fonte) => [fonte.hash, fonte])),
    evidenze,
    proposizioni: new Map((parametri.proposizioni ?? []).map((p) => [p.id, p])),
    relazioni: new Map((parametri.relazioni ?? []).map((r) => [r.id, r])),
    regole: new Map((parametri.regole ?? []).map((r) => [r.id, r])),
  });
}


/* ------------------------------ Valutazione pura del vincolo ------------------------------ */

export interface EsitoValutazioneVincolo {
  soddisfatto: boolean;
  cfuPosseduti: number;
  cfuMancanti: number;
}

function sommaCfu(ssd: readonly string[], crediti: ReadonlyMap<string, number>): number {
  return ssd.reduce((somma, codice) => somma + (crediti.get(codice) ?? 0), 0);
}

/**
 * Valuta un vincolo su una mappa di crediti {SSD → CFU}. Funzione PURA e
 * generica (nessun riferimento al motore esistente, nessuna logica di stato).
 */
export function valutaVincoloCFU(
  vincolo: VincoloCFU,
  crediti: ReadonlyMap<string, number>,
): EsitoValutazioneVincolo {
  if (vincolo.tipo === 'singoloSsdMinCfu') {
    const cfu = sommaCfu([vincolo.ssd], crediti);
    return {
      soddisfatto: cfu >= vincolo.minCfu,
      cfuPosseduti: cfu,
      cfuMancanti: Math.max(0, vincolo.minCfu - cfu),
    };
  }
  if (vincolo.tipo === 'gruppoSsdMinCfu') {
    const cfu = sommaCfu(vincolo.ssd, crediti);
    return {
      soddisfatto: cfu >= vincolo.minCfu,
      cfuPosseduti: cfu,
      cfuMancanti: Math.max(0, vincolo.minCfu - cfu),
    };
  }
  // Disgiunzione: ogni opzione è misurata singolarmente; i crediti non si sommano.
  const cfuOpzioni = vincolo.opzioni.map((opzione) => sommaCfu(opzione.ssd, crediti));
  const migliorCfu = cfuOpzioni.length > 0 ? Math.max(...cfuOpzioni) : 0;
  const minorDeficit =
    cfuOpzioni.length > 0
      ? Math.min(
          ...vincolo.opzioni.map((opzione, indice) =>
            Math.max(0, opzione.minCfu - cfuOpzioni[indice]),
          ),
        )
      : 0;
  return {
    soddisfatto: minorDeficit === 0,
    cfuPosseduti: migliorCfu,
    cfuMancanti: minorDeficit,
  };
}

/* ------------------------------ Tracciabilità verso la Source ------------------------------ */

/** Catena di tracciabilità materiale Rule → Proposition → Evidence → Source. */
export interface CatenaTracciabilita {
  regolaId: string;
  proposizioneId: string;
  evidenze: readonly string[];
  /** Hash SHA-256 unici delle Source raggiunte (>= 1 per una catena valida). */
  fonteHash: readonly string[];
}

/**
 * Ricostruisce la catena completa di una Rule attraverso il registro:
 * Rule → proposizione → evidence → hash delle Source. Se la proposizione non è
 * registrata la catena è indefinita (null, mai un risultato parziale).
 */
export function tracciaRegola(
  regola: Rule,
  registro: RegistroCatena,
): CatenaTracciabilita | null {
  const proposizione = registro.proposizioni.get(regola.proposizioneId);
  if (!proposizione) return null;
  const fonteHash = [...new Set(proposizione.evidenze.map((evidenza) => evidenza.sourceHash))];
  return {
    regolaId: regola.id,
    proposizioneId: proposizione.id,
    evidenze: proposizione.evidenze.map((evidenza) => evidenza.id),
    fonteHash,
  };
}

/** Catena di tracciabilità materiale Relation → Evidence → Source. */
export interface CatenaTracciabilitaRelazione {
  relazioneId: string;
  evidenze: readonly string[];
  fonteHash: readonly string[];
}

/** Ricostruisce la catena di una Relation direttamente dalle sue Evidence. */
export function tracciaRelazione(relazione: Relation): CatenaTracciabilitaRelazione {
  return {
    relazioneId: relazione.id,
    evidenze: relazione.evidenze.map((evidenza) => evidenza.id),
    fonteHash: [...new Set(relazione.evidenze.map((evidenza) => evidenza.sourceHash))],
  };
}


/* ------------------------------ Validazione della catena ------------------------------ */

export interface EsitoValidazioneCatena {
  valida: boolean;
  problemi: readonly string[];
}

function problemiEvidence(
  evidenza: Evidence,
  registro: RegistroCatena,
  contesto: string,
): string[] {
  const problemi: string[] = [];
  if (!evidenza.testo.trim()) {
    problemi.push(`${contesto}: Evidence ${evidenza.id} con testo verbatim vuoto.`);
  }
  if (!RE_HASH_SHA256.test(evidenza.sourceHash)) {
    problemi.push(`${contesto}: Evidence ${evidenza.id} con sourceHash non valido.`);
  }
  if (registro.evidenze.get(evidenza.id) !== evidenza) {
    problemi.push(`${contesto}: Evidence ${evidenza.id} non registrata (istanza diversa).`);
  }
  if (!registro.fonti.has(evidenza.sourceHash)) {
    problemi.push(
      `${contesto}: Evidence ${evidenza.id} riferisce una Source non registrata (${evidenza.sourceHash}).`,
    );
  }
  const { offsetInizio, offsetFine } = evidenza.coordinate;
  if (offsetInizio !== undefined && offsetFine !== undefined && offsetInizio > offsetFine) {
    problemi.push(`${contesto}: Evidence ${evidenza.id} con offset invertiti.`);
  }
  return problemi;
}

/**
 * Verifica la catena di una Rule: proposizione registrata, Evidence registrate
 * (stessa istanza), ancoraggio a una Source registrata e vincolo ben formato.
 */
export function validaRegola(
  regola: Rule,
  registro: RegistroCatena,
): EsitoValidazioneCatena {
  const problemi: string[] = [];
  if (registro.regole.get(regola.id) !== regola) {
    problemi.push(`Rule ${regola.id} non registrata (istanza diversa).`);
  }
  const proposizione = registro.proposizioni.get(regola.proposizioneId);
  if (!proposizione) {
    problemi.push(`Rule ${regola.id}: proposizione ${regola.proposizioneId} non registrata.`);
    return { valida: false, problemi };
  }
  if (proposizione.evidenze.length === 0) {
    problemi.push(`Rule ${regola.id}: proposizione senza Evidence di supporto.`);
  }
  for (const evidenza of proposizione.evidenze) {
    problemi.push(...problemiEvidence(evidenza, registro, `Rule ${regola.id}`));
  }
  const vincolo = regola.vincolo;
  if (vincolo.tipo === 'gruppoSsdMinCfu' && vincolo.ssd.length === 0) {
    problemi.push(`Rule ${regola.id}: gruppo SSD vuoto.`);
  }
  if (vincolo.tipo === 'disgiunzioneMinCfu' && vincolo.opzioni.length === 0) {
    problemi.push(`Rule ${regola.id}: disgiunzione senza opzioni.`);
  }
  return { valida: problemi.length === 0, problemi };
}

/**
 * Verifica la catena di una Relation: Evidence obbligatorie, registrate e
 * ancorate a Source registrate; gli estremi riferiti esistono nel registro
 * (salvo i riferimenti di 'contesto', fuori dal registro stesso).
 */
export function validaRelation(
  relazione: Relation,
  registro: RegistroCatena,
): EsitoValidazioneCatena {
  const problemi: string[] = [];
  if (registro.relazioni.get(relazione.id) !== relazione) {
    problemi.push(`Relation ${relazione.id} non registrata (istanza diversa).`);
  }
  if (relazione.evidenze.length === 0) {
    problemi.push(`Relation ${relazione.id}: Evidence di supporto obbligatorie assenti.`);
  }
  for (const evidenza of relazione.evidenze) {
    problemi.push(...problemiEvidence(evidenza, registro, `Relation ${relazione.id}`));
  }
  const estremi = [relazione.soggetto, relazione.oggetto];
  for (const estremo of estremi) {
    if (estremo.tipo === 'contesto') continue;
    const esiste =
      estremo.tipo === 'source'
        ? registro.fonti.has(estremo.id)
        : estremo.tipo === 'proposition'
          ? registro.proposizioni.has(estremo.id)
          : estremo.tipo === 'relation'
            ? registro.relazioni.has(estremo.id)
            : registro.regole.has(estremo.id);
    if (!esiste) {
      problemi.push(
        `Relation ${relazione.id}: estremo ${estremo.tipo}:${estremo.id} non presente nel registro.`,
      );
    }
  }
  return { valida: problemi.length === 0, problemi };
}


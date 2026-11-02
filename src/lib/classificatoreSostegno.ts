/**
 * ScuoleRadar.it — CLASSIFICATORE DEL SOSTEGNO A TRE STATI (§26.131).
 *
 * PERCHÉ ESISTE. Fino a §26.130 l'area sostegno si riconosceva con una sola
 * domanda binaria (`eAvvisoSostegno`: «il testo contiene *sostegn*?»). Misurato
 * sui dati reali: quella domanda è troppo larga in un verso — «piano di sostegno
 * didattico», «misure di sostegno agli alunni», «progetto sostegno» NON sono
 * cattedre e finivano nella stessa area di «interpello sostegno primaria ADEE» —
 * e troppo stretta nell'altro: i codici che gli uffici scrivono davvero (`AD01`,
 * `AD02`, `AD03`, `AD04`, `AD0D`) non erano mappati su un ordine di scuola, così
 * la pertinenza (§26.120) non poteva scartarli.
 *
 * LA REGOLA, in tre stati. Mai un booleano: chi consuma deve poter distinguere
 * «è un avviso di sostegno», «parla di sostegno ma non è un reclutamento» e «non
 * è sostegno» — e trattare il secondo come il primo è esattamente il falso
 * positivo che la direttiva vieta.
 *
 *   · `certo`   — un CODICE di sostegno (`AD…`) fra le classi o nel testo,
 *                 OPPURE la parola *sostegno* che co-occorre con un MARCATORE DI
 *                 RECLUTAMENTO (`interpello`, `supplenza`, `disponibilità`,
 *                 `avviso`). È l'unico stato che apre l'area sostegno.
 *   · `ambiguo` — la parola *sostegno* c'è ma nessun marcatore di reclutamento:
 *                 un progetto, un'inclusione, un piano didattico. NON è una
 *                 cattedra: non entra in bacheca e non viene scritto in database.
 *   · `nessuno` — nessun segnale di sostegno: la riga è quello che è, e il
 *                 classificatore non ha nulla da dire (nessun giudizio aggiunto).
 *
 * ORDINE DI SCUOLA dal codice (la tabella che le fonti usano davvero):
 *   ADAA · AD0D            → infanzia
 *   ADEE                   → primaria
 *   ADMM                   → secondaria di I grado
 *   ADSS · AD01…AD04       → secondaria di II grado
 * Un codice `AD…` FUORI tabella (es. `AD24`, sigla generica di alcuni uffici)
 * resta `certo` ma senza ordine: la pertinenza non scarta un dato che la fonte
 * non pubblica (§26.120).
 *
 * PURO: nessun database, nessuna rete. Il catalogo (`src/data/classiConcorso.ts`)
 * DELEGA qui, così la verità è una sola.
 * Guardia: `npm run test:sostegno:classificatore`.
 */

import type { OrdineScuola } from '../data/ordiniMaterie';

/** I tre stati. Ordine dichiarato: dal più forte al più debole. */
export type StatoSostegno = 'certo' | 'ambiguo' | 'nessuno';

/** Perché è stato deciso quello stato (log, contatori, guardie). */
export type MotivoSostegno =
  | 'codice'
  | 'prosa-marcatore'
  | 'prosa-senza-marcatore'
  | 'nessun-segnale';

/** Esito del classificatore: stato + ordine di scuola + prove raccolte. */
export interface ClassificazioneSostegno {
  esito: StatoSostegno;
  /** Ordine di scuola dichiarato dal codice (o dal campo), `null` se non deducibile. */
  ordine: OrdineScuola | null;
  /** Codici di sostegno riconosciuti, normalizzati (maiuscolo, senza separatori). */
  codici: string[];
  motivo: MotivoSostegno;
}

/**
 * Codici di sostegno → ordine di scuola. La tabella è CHIUSA e dichiarata: un
 * codice nuovo entra qui con la sua evidenza, non con un'euristica sul numero.
 */
export const ORDINE_PER_CODICE_SOSTEGNO: Readonly<Record<string, OrdineScuola>> = {
  ADAA: 'infanzia',
  AD0D: 'infanzia',
  ADEE: 'primaria',
  ADMM: 'secondaria1',
  ADSS: 'secondaria2',
  AD01: 'secondaria2',
  AD02: 'secondaria2',
  AD03: 'secondaria2',
  AD04: 'secondaria2',
};

/**
 * Forma di TUTTI i codici di sostegno (in Italia iniziano per `AD`): due/tre
 * lettere dopo il prefisso (`ADEE`, `ADSS`, `ADMM`, `ADAA`), due cifre (`AD24`,
 * `AD01`) oppure cifra+lettera (`AD0D`). Pattern CHIUSO: le classi disciplinari
 * (`A-22`, `B-02`, `AAAA`) non lo attraversano.
 */
const RE_CODICE_SOSTEGNO = /^AD(?:[A-Z]{2,3}|\d{2}|0[A-Z])$/;

/** La parola *sostegno* (e i suoi plurali/derivati): il segnale PROSA. */
const RE_PROSA_SOSTEGNO = /\bsostegn/i;

/**
 * MARCATORI DI RECLUTAMENTO — la guardia che rende la prosa una prova. Senza
 * uno di questi, «sostegno» descrive un progetto o un'inclusione, non una
 * cattedra: la direttiva nomina esattamente quattro parole (interpello,
 * supplenza, disponibilità, avviso) e il pattern resta su quelle.
 */
const RE_MARCATORE_RECLUTAMENTO = /\b(?:interpell|supplen|disponibilit|avvis)/i;

/** Codice normalizzato: maiuscolo, senza separatori (`ad 04` → `AD04`). */
export function normalizzaCodiceSostegno(codice?: string | null): string {
  return (codice ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s._\-–—]+/g, '');
}

/** True se il codice è una classe di SOSTEGNO (ADAA, ADEE, AD01, AD0D, AD24…). */
export function eCodiceSostegno(codice?: string | null): boolean {
  const c = normalizzaCodiceSostegno(codice);
  if (!c) return false;
  return RE_CODICE_SOSTEGNO.test(c);
}

/** Ordine di scuola di un codice di sostegno (`ADEE` → `primaria`), `null` se ignoto. */
export function ordineDaCodiceSostegno(codice?: string | null): OrdineScuola | null {
  const c = normalizzaCodiceSostegno(codice);
  if (!c) return null;
  return ORDINE_PER_CODICE_SOSTEGNO[c] ?? null;
}

/**
 * Codici di sostegno dentro un testo libero («interpello AD04 e AD0D»).
 * Serve al testo che arriva senza `class_codes` (allegati, oggetti di PEC).
 */
export function codiciSostegnoNelTesto(testo?: string | null): string[] {
  const t = (testo ?? '').toUpperCase();
  if (!t) return [];
  const out: string[] = [];
  for (const grezzo of t.match(/\bAD(?:[A-Z]{2,3}|\d{2}|0[A-Z])\b/g) ?? []) {
    if (!eCodiceSostegno(grezzo)) continue;
    const codice = normalizzaCodiceSostegno(grezzo);
    if (!out.includes(codice)) out.push(codice);
  }
  return out;
}

/** Ciò che serve sapere di un avviso per classificarlo. */
export interface IngressoSostegno {
  /** Titolo/oggetto dell'avviso: è il testo su cui si giudica la prosa. */
  titolo?: string | null;
  /** Corpo o sommario, quando disponibile (documento letto, descrizione). */
  testo?: string | null;
  /** Classi di concorso rilevate (`class_codes`, `classiCodes`). */
  classi?: readonly (string | null | undefined)[] | null;
  /** Materia inferita dallo scraper: `Sostegno` vale come prosa dichiarata. */
  materia?: string | null;
  /** Ordine pubblicato dalla fonte: vince sulla tabella dei codici. */
  ordine?: OrdineScuola | null;
}

/** Codici di sostegno dichiarati (classi + testo), senza duplicati. */
function codiciDichiarati(ingresso: IngressoSostegno): string[] {
  const out: string[] = [];
  const aggiungi = (codice: string): void => {
    if (!out.includes(codice)) out.push(codice);
  };
  for (const grezzo of ingresso.classi ?? []) {
    if (!eCodiceSostegno(grezzo)) continue;
    aggiungi(normalizzaCodiceSostegno(grezzo));
  }
  for (const codice of codiciSostegnoNelTesto(
    `${ingresso.titolo ?? ''} ${ingresso.testo ?? ''}`,
  )) {
    aggiungi(codice);
  }
  return out;
}

/** La prosa dichiara il sostegno? (parola chiave oppure materia `Sostegno`). */
function prosaDichiaraSostegno(ingresso: IngressoSostegno): boolean {
  const prosa = `${ingresso.titolo ?? ''} ${ingresso.testo ?? ''}`;
  if (RE_PROSA_SOSTEGNO.test(prosa)) return true;
  return (ingresso.materia ?? '').trim().toLowerCase() === 'sostegno';
}

/** Il testo dichiara un RECLUTAMENTO? (interpello, supplenza, disponibilità, avviso). */
function testoDichiaraReclutamento(ingresso: IngressoSostegno): boolean {
  const prosa = `${ingresso.titolo ?? ''} ${ingresso.testo ?? ''}`;
  if (RE_MARCATORE_RECLUTAMENTO.test(prosa)) return true;
  // `materia: 'Sostegno'` non è prosa: la scrive lo scraper su una riga di avviso
  // già riconosciuta come reclutamento (nessuna fonte la usa per i progetti).
  return (ingresso.materia ?? '').trim().toLowerCase() === 'sostegno';
}

/**
 * Classifica un avviso. L'ordine dei giudizi è deliberato:
 *   1. un CODICE di sostegno è la prova più forte (lo pubblica la fonte);
 *   2. la PROSA vale solo con un marcatore di reclutamento;
 *   3. senza marcatore la prosa è `ambiguo` — non un booleano «falso», perché
 *      «parla di sostegno» e «non parla di sostegno» non sono la stessa cosa;
 *   4. nessun segnale → `nessuno` (il classificatore non aggiunge giudizi).
 */
export function classificaSostegno(ingresso: IngressoSostegno): ClassificazioneSostegno {
  const codici = codiciDichiarati(ingresso);
  if (codici.length > 0) {
    const ordine =
      ingresso.ordine ??
      codici.map((c) => ordineDaCodiceSostegno(c)).find((o): o is OrdineScuola => o !== null) ??
      null;
    return { esito: 'certo', ordine, codici, motivo: 'codice' };
  }

  if (!prosaDichiaraSostegno(ingresso)) {
    return {
      esito: 'nessuno',
      ordine: ingresso.ordine ?? null,
      codici: [],
      motivo: 'nessun-segnale',
    };
  }

  if (!testoDichiaraReclutamento(ingresso)) {
    return {
      esito: 'ambiguo',
      ordine: ingresso.ordine ?? null,
      codici: [],
      motivo: 'prosa-senza-marcatore',
    };
  }

  return {
    esito: 'certo',
    ordine: ingresso.ordine ?? null,
    codici: [],
    motivo: 'prosa-marcatore',
  };
}

/**
 * L'unica porta che vale per bacheca, matching, digest e ingestione: un avviso
 * è dell'AREA SOSTEGNO solo se la classificazione è `certo`. `ambiguo` e
 * `nessuno` non lo sono — e `ambiguo` va inoltre escluso dalle bacheche.
 */
export function avvisoDiSostegnoCerto(ingresso: IngressoSostegno): boolean {
  return classificaSostegno(ingresso).esito === 'certo';
}

/** `true` solo per la prosa che parla di sostegno senza dichiarare un reclutamento. */
export function sostegnoAmbiguo(ingresso: IngressoSostegno): boolean {
  return classificaSostegno(ingresso).esito === 'ambiguo';
}

/** Etichetta leggibile dello stato (log e diagnostica, mai copy di prodotto). */
export const ETICHETTA_STATO_SOSTEGNO: Readonly<Record<StatoSostegno, string>> = {
  certo: 'sostegno dichiarato',
  ambiguo: 'sostegno citato senza reclutamento',
  nessuno: 'non è sostegno',
};


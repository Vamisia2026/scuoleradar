/**
 * ScuoleRadar.it — PERCHÉ UNA VOCE D'ELENCO NON DICHIARA LA SCADENZA (§26.118).
 *
 * Perché esiste: il runner scarta le voci senza termine e le conta
 * (`senzaScadenza`), ma un CONTATORE non dice se sta perdendo un'opportunità o
 * scartando contorno. Prima di cambiare una regola di prodotto (esporre o no le
 * «disponibilità aperte fino a revoca») serve un censimento per CAUSA, non un
 * numero solo: qui la classificazione è una funzione pura, così il censimento è
 * ripetibile e la stessa voce riceve sempre la stessa etichetta.
 *
 * Le cause, nell'ordine in cui si escludono:
 *   · `a_revoca`       — la fonte dichiara di non avere un termine («aperta fino
 *                        a revoca», «sempre aperta»): è un'informazione, non un
 *                        dato mancante;
 *   · `indice`         — titolo fatto di soli codici di classe o «classi di
 *                        concorso»: una pagina indice, non un avviso;
 *   · `amministrativo` — l'atto che il pre-filtro semantico già conosce
 *                        (`noiseFilter.isAdministrativeNoise`): nomine, decreti,
 *                        graduatorie, turni, formazione. Non è un'opportunità e
 *                        non lo sarebbe nemmeno con una data;
 *   · `archivio`       — archivio/storico, anno scolastico passato, esiti,
 *                        circolari, atti «esauriti»;
 *   · `data_passata`   — la voce cita una data che è già passata: il termine
 *                        c'era, ma è finito;
 *   · `non_dichiarata` — nessun segnale: è qui che può esserci l'opportunità
 *                        persa, ed è la sola fascia che merita una lettura.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`. Guardia:
 * `npm run test:motivo-senza-scadenza` (incluso in `npm test`).
 */

import { isAdministrativeNoise } from './noiseFilter.ts';
import { dateNelTesto } from './scadenzaTesto.ts';

/** Le sei cause, dalla più dichiarata alla più opaca. */
export type CausaSenzaScadenza =
  | 'a_revoca'
  | 'indice'
  | 'amministrativo'
  | 'archivio'
  | 'data_passata'
  | 'non_dichiarata';

/** Etichette leggibili per il censimento (log e CSV). */
export const ETICHETTA_CAUSA: Readonly<Record<CausaSenzaScadenza, string>> = {
  a_revoca: 'fino a revoca',
  indice: 'indice di classi',
  amministrativo: 'atto amministrativo',
  archivio: 'archivio/atto',
  data_passata: 'data già passata',
  non_dichiarata: 'senza alcun segnale',
};

/** Ciò che una voce dichiara di sé: titolo, link e (se c'è) un estratto. */
export interface VoceDaClassificare {
  titolo?: string | null;
  url?: string | null;
  testo?: string | null;
}

/** «Fino a revoca»: la fonte dice esplicitamente di non avere un termine. */
const RE_A_REVOCA =
  /\b(?:fino|sino)\s+(?:a|alla)\s+revoca\b|\bapert[ao]\s+fino\s+(?:a|alla)\s+revoca\b|\bsempre\s+ap(?:erta|erto)\b|\bdisponibilit[aà]\s+aperta\b/i;

/** Titolo fatto di soli codici («ADEE | AAAA | A043») o indice di classi. */
const RE_INDICE =
  /classi?\s+di\s+concors|\b[a-z]{1,4}\d{0,3}\s*[|·/]\s*[a-z]{1,4}\d{0,3}\s*[|·/]\s*[a-z]{1,4}\d{0,3}\b|\b(?:adee|eeee|aaaa|adss|adis)\b/i;

/** Archivio, atti conclusi, graduatorie, circolari: contorno, non opportunità. */
const RE_ARCHIVIO =
  /\barchivi|\bstoric[oi]\b|\bgraduatori|\besit[oi]\b|\bnomin[ae]\b|\bcontratt[oi]\b|\bdecret[oi]\b|\bcircolar|\bverbale|\bconvocazion|\besaurit|\bchius[oi]\b|\brevocate\b|\banno\s+scolastico\s+20\d\d|\ba\.?\s?s\.?\s*20\d\d/i;

/** Parole che rendono una voce candidabile (misura, non filtro). */
const RE_CANDIDABILE =
  /\binterpell|supplenz|disponibilit|incaric|selezion|reclutament|manifestazione\s+di\s+interesse|messa\s+a\s+disposizione/i;

/** Testo compatto su cui lavorano le regole (titolo + estratto). */
function compatto(testo?: string | null): string {
  return (testo ?? '').replace(/\s+/g, ' ').trim();
}

/** Causa della voce, nell'ordine dichiarato dal docblock. */
export function causaSenzaScadenza(
  voce: VoceDaClassificare,
  oggi: Date = new Date(),
): CausaSenzaScadenza {
  const testo = compatto(`${voce.titolo ?? ''} ${voce.testo ?? ''}`);
  if (RE_A_REVOCA.test(testo)) return 'a_revoca';
  if (RE_INDICE.test(compatto(voce.titolo))) return 'indice';
  // L'atto amministrativo lo riconosce il pre-filtro semantico di sempre: qui si
  // riusa il suo verdetto invece di duplicare le regex (§26.91).
  if (isAdministrativeNoise(testo, compatto(voce.titolo)).isNoise) return 'amministrativo';
  if (RE_ARCHIVIO.test(testo)) return 'archivio';
  const date = dateNelTesto(testo);
  if (date.length > 0) {
    const limite = new Date(oggi);
    limite.setHours(0, 0, 0, 0);
    const passata = date.some((d) => new Date(`${d.iso}T00:00:00`) < limite);
    if (passata) return 'data_passata';
  }
  return 'non_dichiarata';
}

/**
 * True se il titolo dichiara un reclutamento: serve a dire quante voci della
 * fascia `non_dichiarata` sarebbero davvero candidabili (misura, non filtro).
 */
export function titoloCandidabile(voce: VoceDaClassificare): boolean {
  return RE_CANDIDABILE.test(compatto(voce.titolo));
}

/* ---------------------------------------------------------------------------
 * §26.133 — LA DISPONIBILITÀ CHE NON DICHIARA UN TERMINE (Catania, 02/11/2026)
 * ---------------------------------------------------------------------------
 * Alcune fonti non pubblicano un interpello per scuola: pubblicano una TABELLA
 * DI DISPONIBILITÀ. L'avviso P.6 dell'USP di Catania del 20/10/2026 — «posti
 * comuni e di SOSTEGNO … a.s. 2026/27» — elenca **59 istituti** con le cattedre
 * libere e **nessun termine**: la lista vale finché l'Ufficio non pubblica la
 * successiva. Letta con la regola ferrea (§26.71) era una riga «senza scadenza»,
 * quindi fuori da ogni superficie: la disponibilità più concreta che esista —
 * la cattedra c'è, oggi — restava invisibile.
 *
 * Qui sta l'unica convenzione ammessa, e i suoi due limiti:
 *   · il termine è STIMATO e dichiarato tale nella riga («termine stimato»);
 *   · la stima parte dalla data di PUBBLICAZIONE dell'avviso, mai dalla data in
 *     cui lo si legge: una stima che scivola in avanti a ogni giro non è una
 *     stima, è una data inventata che si rinnova;
 *   · se la pagina non dichiara QUANDO è stata pubblicata, non si stima nulla
 *     (`scadenzaStimata` → `null`) e la voce resta senza termine, come prima.
 */

/**
 * Giorni di validità PRESUNTA di una disponibilità senza termine, contati dalla
 * pubblicazione. Trenta e non sette: gli Uffici ripubblicano la lista (P.4, P.5,
 * P.6…) con cadenza quasi settimanale — un termine di sette giorni renderebbe
 * invisibile la lista ancora in corso — e oltre il mese si tratterebbe di una
 * graduatoria esaurita, non di una disponibilità.
 */
export const GIORNI_SCADENZA_STIMATA = 30;

/**
 * La fonte dichiara una DISPONIBILITÀ (e non un interpello con un termine).
 * Niente `\b` finale: in JavaScript `à` NON è un carattere di parola, quindi
 * `\bdisponibilit[aà]\b` non trova mai «disponibilità» seguito da uno spazio —
 * l'ha pagato la prima stesura di questa regola (A del test, 02/11/2026).
 */
const RE_DISPONIBILITA = /\bdisponibilit[aà](?![a-zà-ÿ])/i;

/** La disponibilità è FINITA: su un atto esaurito o revocato non si stima nulla. */
const RE_CHIUSA = /\besaurit|\brevocat[ae]|\bchius[ao]\b|\bannullat[ao]\b|\bsospes[ao]\b/i;

/**
 * True se la voce è una DISPONIBILITÀ senza termine dichiarato — la sola fascia
 * a cui si applica la stima (§26.133). Tre condizioni, nell'ordine: la fonte si
 * dichiara «disponibilità», non è un atto chiuso e non è un atto amministrativo
 * (il pre-filtro semantico di sempre decide, §26.91).
 *
 * Nota: qui NON si usa `causaSenzaScadenza`, e la ragione è nei dati — il titolo
 * vero di questi avvisi contiene «anno scolastico 2026/2027», che la causa
 * `archivio` legge come anno passato. Per una disponibilità dell'anno in corso è
 * l'anno di VALIDITÀ, non un'etichetta di archivio.
 */
export function eDisponibilitaSenzaTermine(voce: VoceDaClassificare): boolean {
  const testo = compatto(`${voce.titolo ?? ''} ${voce.testo ?? ''}`);
  if (!RE_DISPONIBILITA.test(testo)) return false;
  if (RE_CHIUSA.test(testo)) return false;
  return !isAdministrativeNoise(testo, compatto(voce.titolo)).isNoise;
}

/**
 * Termine STIMATO di una disponibilità: `pubblicazione + giorni`, in ISO.
 * `null` quando la pubblicazione non è dichiarata o non è una data vera — la
 * stima non si inventa un punto di partenza (nessun «oggi», nessun orologio).
 */
export function scadenzaStimata(
  pubblicazione?: string | null,
  giorni: number = GIORNI_SCADENZA_STIMATA,
): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((pubblicazione ?? '').trim());
  if (!m) return null;
  const anno = Number(m[1]);
  const mese = Number(m[2]);
  const giorno = Number(m[3]);
  const base = Date.UTC(anno, mese - 1, giorno);
  const controllo = new Date(base);
  if (
    !Number.isFinite(base) ||
    controllo.getUTCFullYear() !== anno ||
    controllo.getUTCMonth() !== mese - 1 ||
    controllo.getUTCDate() !== giorno
  ) {
    return null;
  }
  const passi = Number.isFinite(giorni) ? Math.max(0, Math.floor(giorni)) : GIORNI_SCADENZA_STIMATA;
  const data = new Date(base + passi * 86_400_000);
  const due = (n: number): string => String(n).padStart(2, '0');
  return `${data.getUTCFullYear()}-${due(data.getUTCMonth() + 1)}-${due(data.getUTCDate())}`;
}

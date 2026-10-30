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

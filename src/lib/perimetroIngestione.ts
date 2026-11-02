/**
 * ScuoleRadar.it — PERIMETRO STRETTO DELL'INGESTIONE: **AT + CT** più le fonti
 * ufficiali in whitelist (§26.131).
 *
 * PERCHÉ ESISTE. Dal §26.126 il crawler lavorava una baseline NAZIONALE (i 20
 * capoluoghi di regione + Asti): 21 province per giro, decine di portali USR,
 * migliaia di scuole. Misurato sul campo (§26.130): il giro costa ore e produce
 * bacheche vuote — non perché il crawler sbagli, ma perché *le fonti giuste sono
 * poche e vanno lette bene*. La direttiva del 02/11/2026 ribalta la strategia:
 * due sole province, **Asti (pilota del Nord) e Catania (prova del Sud)**,
 * entrambe già abitate da utenti veri, più le fonti ufficiali che pubblicano per
 * loro anche quando parlano da Roma (USR, USP, elenchi nazionali in whitelist).
 *
 * COSA VUOL DIRE, in pratica:
 *   · un target di `discovered_links` entra nel giro SOLO se la sua provincia è
 *     nel perimetro oppure se il suo URL è una fonte ufficiale verificata
 *     (`CHIAVI_WHITELIST`): una scuola di Cuneo non si visita più;
 *   · `scripts/crawl-provincia.ts` rifiuta una provincia fuori perimetro invece
 *     di lavorare a metà;
 *   · la coda si RIPULISCE, non si allarga: `scripts/reset-coda-perimetro.ts`.
 *
 * PERCHÉ UN MODULO E NON UNA COSTANTE IN DUE SCRIPT. Il perimetro è una regola di
 * prodotto: se vive in due posti, il giorno in cui si aggiunge una provincia uno
 * dei due resta indietro — ed è sempre quello che scrive in database. Qui c'è la
 * verità; gli altri la leggono.
 *
 * PURO (nessuna rete, nessun database). Guardia: `npm run test:perimetro`.
 */
import { province } from '../data/province';

/**
 * Le province del perimetro. ORDINE = priorità di lavoro: Asti è la provincia
 * pilota (la più vecchia, la più misurata), Catania è la prova sul Sud.
 *
 * Aggiungere una provincia qui è l'UNICO modo per allargare il perimetro.
 */
export const PROVINCE_PERIMETRO: readonly string[] = ['AT', 'CT'];

/** Codice normalizzato (`' ct '` → `'CT'`); `''` se assente. */
function codice(valore?: string | null): string {
  return (valore ?? '').trim().toUpperCase();
}

/** True se la provincia è nel perimetro stretto (`AT`, `CT`). */
export function eProvinciaPerimetro(codiceProvincia?: string | null): boolean {
  return PROVINCE_PERIMETRO.includes(codice(codiceProvincia));
}

/**
 * Le province richieste che stanno FUORI perimetro, normalizzate, senza
 * duplicati e nell'ordine di arrivo. Serve a DICHIARARE uno scarto (log,
 * conteggi, diagnosi), mai a scartare in silenzio.
 */
export function fuoriPerimetro(codici: Iterable<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const grezzo of codici) {
    const c = codice(grezzo);
    if (!c || eProvinciaPerimetro(c) || out.includes(c)) continue;
    out.push(c);
  }
  return out;
}

/**
 * Nome leggibile di una provincia del perimetro (`'CT'` → `'Catania'`); un codice
 * che il catalogo non conosce resta il codice stesso — nessun nome inventato.
 */
export function nomeProvinciaPerimetro(codiceProvincia?: string | null): string {
  const c = codice(codiceProvincia);
  return province.find((p) => p.codice === c)?.nome ?? c;
}

/**
 * Il perimetro in una riga, per i log e i messaggi d'errore:
 * `AT (Asti) + CT (Catania)`.
 */
export function descrizionePerimetro(): string {
  return PROVINCE_PERIMETRO.map((c) => `${c} (${nomeProvinciaPerimetro(c)})`).join(' + ');
}

/**
 * Messaggio unico per chi chiede una provincia fuori perimetro: dice cosa è
 * successo, qual è il perimetro e come si allarga (§26.131). Uno script che
 * rifiuta deve spiegare, altrimenti sembra rotto.
 */
export function messaggioFuoriPerimetro(codiceProvincia?: string | null): string {
  const c = codice(codiceProvincia) || 'N/D';
  return (
    `La provincia ${c} è fuori dal perimetro di ingestione (${descrizionePerimetro()}). ` +
    'Il crawler lavora solo le province del perimetro più le fonti ufficiali in ' +
    'whitelist: per allargarlo si aggiunge il codice in PROVINCE_PERIMETRO ' +
    '(src/lib/perimetroIngestione.ts), non si forza il comando.'
  );
}

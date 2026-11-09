/**
 * ScuoleRadar.it — L'ORDINE DELLA VETRINA: prima il merito, poi la provincia di casa (§26.152).
 *
 * IL DIFETTO (visto su un profilo di Asti, 06/11/2026). La bacheca ordinava per
 * `compatibilita` decrescente e basta. Con la cascata generosa (§26.144) e il raggio dei
 * 60 km, la pagina di chi cerca in provincia di Asti si riempiva di righe di Torino (46 km) e
 * Alessandria (32 km). Non era un errore di punteggio: era un ordine che non conosceva la
 * differenza fra «la mia zona» e «la zona che il raggio ha aggiunto». Due righe di contorno
 * distanti un punto di voto (68 a Torino, 66 ad Asti) finivano col mettere Torino davanti ad
 * Asti, e la provincia scelta dall'utente spariva sotto la prima schermata.
 *
 * LE TRE DOMANDE, IN QUEST'ORDINE.
 *  1. QUANTO VALE? Prima le righe che il Radar ha agganciato (`compatibilita` ≥ soglia
 *     arancio), poi i RIEMPITIVI (`lib/riempitivi`: voto noto e sotto soglia). Un riempitivo
 *     non scavalca mai un match: sarebbe la pagliuzza che copre l'osso. Un voto ASSENTE resta
 *     neutro — vale come match, come in `lib/riempitivi` e in `DashboardPage` da sempre.
 *  2. DI CHI È LA CASA? Dentro la stessa fascia conta la PROVINCIA PRINCIPALE
 *     (`lib/provinceRadar`: la prima scelta dell'utente, quella che il Radar «privilegia nella
 *     presentazione degli avvisi»). Fra i riempitivi questa preferenza viene PRIMA del voto:
 *     quando due righe sono entrambe di contorno, la più vicina è quella che conta.
 *     Fra i match veri il voto resta davanti (`100` di Torino batte `72` di Asti) e la
 *     prossimità fa da spareggio: la casa è un criterio d'ordine, non un salvacondotto — la
 *     stessa asimmetria del bonus di `lib/distanzaProfilo`.
 *  3. POI LA SCADENZA più vicina e, in ultimo, l'ordine di arrivo: due giri della stessa
 *     giornata devono dare lo stesso tabellone (`sort` stabile, nessuna riga che salta).
 *
 * Niente rete, niente orologio, nessuna dipendenza dal framework: l'ordine è una funzione
 * della sola lista. Guardia: `npm run test:ordine-vetrina`.
 */
import { SOGLIA_COMPATIBILITA_ARANCIO } from './compatibilita';
import { normalizzaProvincia } from './prossimitaGeografica';

/** Ciò che serve per ordinare una riga di vetrina: il voto, la zona, la scadenza. */
export interface VoceVetrina {
  compatibilita?: number | null;
  dataScadenza?: string | null;
  provinciaCodice?: string | null;
}

/** Opzioni dell'ordine: la provincia principale del profilo e la soglia dei riempitivi. */
export interface OpzioniOrdine {
  /** Codice della provincia principale (`null`/assente = nessuna preferenza). */
  principale?: string | null;
  /** Soglia sotto la quale una riga è un riempitivo (default: soglia arancio, 70). */
  soglia?: number;
}

/** Il voto confrontabile: un valore assente o corrotto vale `null` (neutro). */
function voto(voce: VoceVetrina): number | null {
  const p = voce.compatibilita;
  return typeof p === 'number' && Number.isFinite(p) ? p : null;
}

/** Fascia d'ordine: 0 = match (o voto neutro), 1 = riempitivo. */
function fascia(voce: VoceVetrina, soglia: number): 0 | 1 {
  const p = voto(voce);
  return p !== null && p < soglia ? 1 : 0;
}

/** Voto per il confronto: il neutro vale `100`, come in `lib/riempitivi` e in bacheca. */
function confrontabile(voce: VoceVetrina): number {
  return voto(voce) ?? 100;
}

/** Millisecondi della scadenza: chi non ne ha una finisce in coda (`Infinity`). */
function scadenzaMs(voce: VoceVetrina): number {
  const t = voce.dataScadenza ? Date.parse(voce.dataScadenza) : Number.NaN;
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

/**
 * Ordina la vetrina senza mutare l'ingresso: merito (fascia) → casa → voto → scadenza →
 * ordine di arrivo. La provincia principale pesa prima del voto fra i riempitivi e dopo il
 * voto fra i match (vedi l'intestazione).
 */
export function ordinaVetrina<T extends VoceVetrina>(
  righe: readonly T[],
  opts: OpzioniOrdine = {},
): T[] {
  const soglia = opts.soglia ?? SOGLIA_COMPATIBILITA_ARANCIO;
  const principale = normalizzaProvincia(opts.principale);
  const casa = (voce: T): 0 | 1 =>
    principale && normalizzaProvincia(voce.provinciaCodice) === principale ? 0 : 1;
  return righe
    .map((voce, indice) => ({
      voce,
      indice,
      fascia: fascia(voce, soglia),
      casa: casa(voce),
      voto: confrontabile(voce),
      scadenza: scadenzaMs(voce),
    }))
    .sort((a, b) => {
      // 1. il merito prima del contorno: nessun riempitivo sopra un match.
      if (a.fascia !== b.fascia) return a.fascia - b.fascia;
      // 2. fra riempitivi la provincia di casa viene PRIMA del voto.
      if (a.fascia === 1 && a.casa !== b.casa) return a.casa - b.casa;
      // 3. il voto (fra i match resta davanti alla prossimità).
      if (a.voto !== b.voto) return b.voto - a.voto;
      // 4. spareggio: la provincia di casa, poi la scadenza, poi l'ordine di arrivo.
      if (a.casa !== b.casa) return a.casa - b.casa;
      if (a.scadenza !== b.scadenza) return a.scadenza - b.scadenza;
      return a.indice - b.indice;
    })
    .map((r) => r.voce);
}

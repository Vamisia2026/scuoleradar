/**
 * ScuoleRadar.it — SBARRAMENTO DI ORDINE e CATEGORIE D'EMERGENZA (modulo PURO, §26.148).
 *
 * La scala della distanza (§26.145) scontava i gradini ma lasciava in pagina anche il terzo:
 * «Sostegno infanzia» a un profilo che cerca le **superiori** scendeva a 9% e RESTAVA in
 * bacheca con il «Fondo Convento» addosso. Il 06/11/2026 Bartolo ha cambiato la regola: c'è una
 * distanza che non è una preferenza da mettere in coda, è **un altro mestiere**. Quelle righe
 * non si ordinano: si sbarrano («non me la far vedere»).
 *
 *   1. **SBARRAMENTO** — il TERZO gradino della sequenza (`DISTANZA_SBARRAMENTO`: infanzia ↔
 *      secondaria di II grado, e viceversa) non ha un voto: la riga **non entra**. Non è un
 *      match basso, non è un ripiego: è fuori dal profilo per costruzione, e nessun bonus di
 *      provincia può salvarla, perché il bonus vale solo sui voti e qui un voto non esiste.
 *      Il secondo gradino (primarie per chi cerca le superiori) RESTA: −55% e «Fondo Convento».
 *
 *   2. **CATEGORIE DI EMERGENZA** — ATA, CPIA, serali, PON sono fuori sequenza (`distanzaOrdini`
 *      vale `-1`): non hanno un «prima/dopo», quindi non le tocca la scala degli ordini. Restano
 *      tollerate — la geografia è l'unico sbarramento rigido (§26.144) — ma pagano
 *      `PENALITA_EMERGENZA` quando l'utente NON le ha scelte: sono il ripiego di sopravvivenza,
 *      e il numero lo deve dire. Chi le ha scelte (ordine `ata` o `cpia` nel profilo) non paga
 *      nulla: per lui sono il mestiere, non l'ultima spiaggia.
 *
 * Perché un modulo a sé: `lib/distanzaProfilo` era a 220 righe su 250 (gate strutturale) e queste
 * due regole sono un giudizio DIVERSO — una toglie la riga, l'altra la sconta. Tenerle separate
 * evita anche il ciclo di import: qui si legge la sequenza, in `distanzaProfilo` si compone il voto.
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, orologio mai letto.
 * Guardia: `npm run test:distanza` (incluso in `npm test`).
 */
import type { OrdineScuola } from '../data/ordiniMaterie';
import {
  ordineAvviso,
  type AvvisoCompatibilita,
  type ProfiloCompatibilita,
} from './matchingEngine';
import { distanzaOrdini, etichettaOrdine } from './punteggioOrdine';

/**
 * Il gradino che NON si sconta: dal terzo in poi la riga è di un altro mestiere.
 * Sulla sequenza (`SEQUENZA_ORDINI`) il 3 esiste in un solo caso, nei due sensi:
 * **infanzia ↔ secondaria di II grado**.
 */
export const DISTANZA_SBARRAMENTO = 3;
/**
 * Penalità delle categorie di EMERGENZA (ATA, CPIA, serali, PON) non scelte dall'utente:
 * −40%. Conti fatti: ATA in provincia principale `52 → +18 = 70 → −40% = 42` (senza bonus
 * `52 → 31`), una classe esatta in CPIA `100 → 60` — sotto ogni merito del proprio ordine,
 * che è esattamente dove deve stare un ripiego.
 */
export const PENALITA_EMERGENZA = 40;
/** Le tipologie fuori sequenza che valgono come «ripiego di sopravvivenza» quando non scelte. */
export const ORDINI_EMERGENZA: readonly OrdineScuola[] = ['ata', 'cpia', 'serali', 'pon'];

/** Esito dello sbarramento: `escluso` = la riga non si mostra, `motivo` = perché (per card e log). */
export interface EsitoSbarramento {
  escluso: boolean;
  motivo: string;
}

/** Uno sconto: punti percentuali (negativi) e frase già pronta per il tooltip. */
export interface Sconto {
  punti: number;
  motivo: string;
}

const NIENTE_DA_DICHIARARE: EsitoSbarramento = { escluso: false, motivo: '' };
const NESSUNO_SCONTO: Sconto = { punti: 0, motivo: '' };

/** Ordini scelti dal profilo, senza i valori vuoti. */
function ordiniScelti(profilo: Pick<ProfiloCompatibilita, 'ordini'>): readonly OrdineScuola[] {
  return (profilo.ordini ?? []).filter(Boolean);
}

/**
 * SBARRAMENTO DI ORDINE (§26.148): true quando **tutti** gli ordini scelti stanno al terzo
 * gradino dall'ordine dell'avviso — cioè quando il profilo e la riga non si toccano.
 *
 * Non si applica a ciò che è fuori sequenza (ATA, CPIA, serali, PON: `-1`) né quando un dato
 * manca (profilo senza ordini, avviso che non lo dichiara): l'assenza di informazione non è un
 * giudizio, e uno sbarramento è la cosa più cara che questo modulo possa fare.
 *
 * Con più ordini scelti vale il più VICINO, come nella penalità: chi ha scelto anche l'infanzia
 * non si vede sbarrare l'infanzia.
 */
export function sbarramentoOrdine(
  profilo: Pick<ProfiloCompatibilita, 'ordini'>,
  avviso: AvvisoCompatibilita,
): EsitoSbarramento {
  const chiesti = ordiniScelti(profilo);
  if (chiesti.length === 0) return NIENTE_DA_DICHIARARE;
  const ordine = ordineAvviso(avviso);
  if (!ordine) return NIENTE_DA_DICHIARARE;
  const distanze = chiesti.map((o) => distanzaOrdini(o, ordine)).filter((d) => d >= 0);
  if (distanze.length === 0) return NIENTE_DA_DICHIARARE;
  const distanza = Math.min(...distanze);
  if (distanza < DISTANZA_SBARRAMENTO) return NIENTE_DA_DICHIARARE;
  const riferimento = chiesti.find((o) => distanzaOrdini(o, ordine) === distanza) ?? chiesti[0];
  return {
    escluso: true,
    motivo:
      `ordine incompatibile (${etichettaOrdine(riferimento as OrdineScuola)} → ` +
      `${etichettaOrdine(ordine)}): la riga resta fuori dalla bacheca`,
  };
}

/**
 * PENALITÀ DELLE CATEGORIE DI EMERGENZA (§26.148): ATA, CPIA, serali e PON valgono come
 * ripiego di sopravvivenza per chi non le ha scelte, e pagano `PENALITA_EMERGENZA`.
 *
 * Non si applica quando: il profilo non dichiara ordini (dato assente), l'avviso è dentro la
 * sequenza (lì decide la scala degli ordini, §26.145), oppure l'utente ha scelto proprio quella
 * tipologia — chi cerca il CPIA non deve pagare il CPIA.
 */
export function penalitaEmergenza(
  profilo: Pick<ProfiloCompatibilita, 'ordini'>,
  avviso: AvvisoCompatibilita,
): Sconto {
  const chiesti = ordiniScelti(profilo);
  if (chiesti.length === 0) return NESSUNO_SCONTO;
  const ordine = ordineAvviso(avviso);
  if (!ordine || !ORDINI_EMERGENZA.includes(ordine)) return NESSUNO_SCONTO;
  if (chiesti.includes(ordine)) return NESSUNO_SCONTO;
  return {
    punti: -PENALITA_EMERGENZA,
    motivo:
      `categoria di emergenza (${etichettaOrdine(ordine)}): ` +
      `−${PENALITA_EMERGENZA}% (ripiego, non il tuo ordine)`,
  };
}

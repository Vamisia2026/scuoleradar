/**
 * ScuoleRadar.it — FINESTRA DELLA QUARANTENA DELLE FONTI (§26.85, §26.109, §26.110).
 *
 * `sourceHealthRules.ts` dice QUANDO una fonte va isolata (soglie e motivi);
 * questo modulo dice QUANTO dura e CHI salta il giro, ed è l'unico posto in cui
 * vive la finestra dei 60 giorni.
 *
 * Perché una scadenza: senza, un portale che cambia URL o riapre dopo un
 * restyling resterebbe invisibile per sempre — la quarantena diventerebbe una
 * condanna. Con la scadenza la fonte torna candidabile da sola dopo 60 giorni;
 * se è ancora morta le regole la isolano di nuovo al primo run fallito (e
 * riparte l'orologio), così il costo di riprova è di UN run ogni 60 giorni.
 *
 * Dalla §26.110 la stessa finestra serve alla «Linea Rossa» del pannello Admin:
 * `giorniResiduiQuarantena` e `quaranteneAttive` la espongono alla UI, che così
 * non ne tiene una copia (una seconda copia sarebbe la prima a divergere).
 *
 * Modulo PURO (nessuna rete, nessun database): si prova con date fisse.
 * Guardie: `npm run test:quarantena` e `npm run test:linea-rossa`.
 */
import { normalizzaUrl, type SourceHealthStatus } from './sourceHealthRules';

/** Giorni di isolamento dopo i quali la fonte torna candidabile da sola. */
export const GIORNI_QUARANTENA = 60;

const MS_GIORNO = 86_400_000;

/** Una fonte isolata come la racconta la telemetria (`source_health`). */
export interface FonteIsolata {
  /** URL della fonte, com'è nel registro. */
  url: string;
  /** `quarantined_at`: data dell'isolamento (`null` = riga scritta senza data). */
  dal: string | null;
  /** Motivo dichiarato dalle regole (`not_found`, `layout_changed`, …). */
  motivo?: string | null;
}

/**
 * Giorni che restano prima della riprova: `0` = quarantena scaduta (o senza
 * data leggibile, che vale scaduta). Un orologio indietro non regala tempo in
 * più: il massimo è la finestra intera, mai «61 giorni».
 */
export function giorniResiduiQuarantena(
  quarantinedAt: string | null | undefined,
  adesso: Date = new Date(),
): number {
  const dal = Date.parse(quarantinedAt ?? '');
  if (!Number.isFinite(dal)) return 0;
  const residuo = GIORNI_QUARANTENA * MS_GIORNO - (adesso.getTime() - dal);
  if (residuo <= 0) return 0;
  return Math.min(GIORNI_QUARANTENA, Math.ceil(residuo / MS_GIORNO));
}

/**
 * L'isolamento ha superato la finestra? Un isolamento senza data leggibile
 * (riga scritta a mano, `quarantined_at` nullo) non può durare per sempre:
 * vale come SCADUTO, cioè la fonte si riprova.
 */
export function quarantenaScaduta(
  stato: SourceHealthStatus,
  adesso: Date = new Date(),
): boolean {
  if (!stato.isQuarantined) return false;
  return giorniResiduiQuarantena(stato.quarantinedAt, adesso) === 0;
}

/**
 * Le quarantene ancora ATTIVE, con i giorni che mancano (le scadute escono).
 * `null` in ingresso = la telemetria non ha risposto: si restituisce `null`, non
 * una lista vuota, perché «nessuna fonte isolata» e «dato assente» sono due
 * fatti diversi — e la UI non deve trasformare il secondo nel primo (§26.110).
 */
export function quaranteneAttive(
  fonti: readonly FonteIsolata[] | null,
  adesso: Date = new Date(),
): Array<FonteIsolata & { giorni: number }> | null {
  if (fonti === null) return null;
  return fonti
    .map((fonte) => ({ ...fonte, giorni: giorniResiduiQuarantena(fonte.dal, adesso) }))
    .filter((fonte) => fonte.giorni > 0);
}

/**
 * Gli URL isolati che i giri ordinari devono saltare (`filtraFontiSane`).
 * Un isolamento scaduto NON entra nell'insieme: la fonte va riprovata e le
 * regole decideranno se lasciarla in quarantena o riabilitarla.
 */
export function fontiIsolate(
  tutte: readonly SourceHealthStatus[],
  adesso: Date = new Date(),
): Set<string> {
  const isolate = new Set<string>();
  for (const stato of tutte) {
    if (!stato.isQuarantined || quarantenaScaduta(stato, adesso)) continue;
    const url = normalizzaUrl(stato.sourceUrl);
    if (url) isolate.add(url);
  }
  return isolate;
}

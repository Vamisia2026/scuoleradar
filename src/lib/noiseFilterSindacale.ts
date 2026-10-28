/**
 * ScuoleRadar.it — VITA SINDACALE: i segnali di SCIOPERO e ASSEMBLEA (§26.91).
 *
 * Perché esiste: un albo che elenca interpelli pubblica anche scioperi e
 * assemblee sindacali. Non sono opportunità di lavoro e vanno scartati PRIMA del
 * parsing; ma sono segnali SOFT — un interpello che descrive l'assemblea di
 * domani resta un interpello e si salva con il suo indicatore di reclutamento
 * (`RECRUITMENT_INDICATORS`), mentre un titolo «Sciopero del personale» non ne
 * ha e cade subito.
 *
 * NOTA — rettifiche e graduatorie NON sono qui di proposito: una «rettifica
 * dell'avviso» con una scadenza nuova è un'interpellanza viva, e le pagine
 * «Graduatorie di istituto» contengono spesso anche gli interpelli. Le scarta il
 * gate di riga (`scraper/tabellaUst.ts`), dove una rettifica chiusa non dichiara
 * una scadenza futura e una graduatoria non dichiara scadenze.
 *
 * ORDINE: dal segnale più specifico al più generico, così la `reason` nei log e
 * nei test dice «assemblea sindacale» e non «assemblea». Le regole entrano in
 * `ADMIN_NOISE_PATTERNS` (`noiseFilter.ts`) con uno spread: la lista resta UNA.
 * Verificato da `npm run test:noise-filter` (incluso in `npm test`).
 */
import type { NoisePattern } from './noiseFilterTipi.ts';

/** Regole SOFT di vita sindacale, nell'ordine in cui vengono valutate. */
export const PATTERN_VITA_SINDACALE: readonly NoisePattern[] = [
  { re: /assemble[ae].{0,20}sindacal/i, reason: 'assemblea sindacale' },
  { re: /\bscioper[oi]\b/i, reason: 'sciopero' },
  { re: /\bassemble[ae]\b/i, reason: 'assemblea' },
];

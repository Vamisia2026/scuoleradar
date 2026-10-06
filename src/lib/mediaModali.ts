/**
 * ScuoleRadar.it — LA MEDIA PONDERATA DELLE MODALI (regola pura, un solo posto).
 *
 *   punteggio = Σ(punteggio modale × peso) / Σpesi     [sulle sole modali APPLICABILI]
 *
 * I PESI (`PESI_MODALI`) sono una decisione di PRODOTTO, non un numero nascosto nel
 * codice: vivono qui, in una riga modificabile.
 *
 *   · `classe` (2)  → requisito ABILITANTE: il suo scostamento incide il doppio
 *     (stessa gerarchia del motore §26.54: 100/80/70/60);
 *   · `ordine` (1) · `provincia` (1) → preferenze di CONTESTO.
 *
 * Le COMPETENZE (l'«oltre la classe») non sono una modale pesata: restano **FUORI** da
 * questo denominatore. Sono il LIVELLO SECONDARIO del punteggio (§26.63): la SFUMATURA
 * di `punteggioCompetenze.ts` — al massimo `CAP_COMPETENZE` = 25 punti — che
 * `compatibilitaGraduata.ts` somma al voto primario dentro il tetto. L'override 90/85
 * della «Modalità 3» (§26.58) e il jolly in percentuale sono **RITIRATI**.
 *
 * I pesi si RINORMALIZZANO su ciò che il profilo ha davvero: una modale senza dati
 * dell'utente non abbassa il voto (e nemmeno lo alza). Nessun peso supera la metà dei
 * pesi totali (2 su 4): il voto mediato non nasce mai da una sola modale — invariante
 * verificata da `npm run test:modali`.
 */
import { PUNTEGGIO_MATCH_NESSUNO } from './matchingEngine';

/** PESI delle modali nella MEDIA (`mediaPonderata`). */
export const PESI_MODALI = {
  ordine: 1,
  classe: 2,
  provincia: 1,
} as const;

/** Contributo di UNA modale applicabile alla media ponderata. */
export interface ContributoModale {
  /** Punteggio della modale (0-100). */
  punteggio: number;
  /** Peso della modale nella media (`PESI_MODALI`). */
  peso: number;
}

/**
 * Media PONDERATA `Σ(punteggio × peso) / Σpesi` dei contributi delle modali APPLICABILI:
 * i pesi si rinormalizzano su ciò che il profilo ha davvero. Nessuna modale applicabile
 * (profilo senza criteri) → `PUNTEGGIO_MATCH_NESSUNO`: senza criteri non si inventa un voto.
 */
export function mediaPonderata(contributi: readonly ContributoModale[]): number {
  const attivi = contributi.filter((c) => c.peso > 0 && Number.isFinite(c.punteggio));
  const pesoTotale = attivi.reduce((totale, c) => totale + c.peso, 0);
  if (pesoTotale === 0) return PUNTEGGIO_MATCH_NESSUNO;
  const somma = attivi.reduce((totale, c) => totale + c.punteggio * c.peso, 0);
  return Math.round(somma / pesoTotale);
}

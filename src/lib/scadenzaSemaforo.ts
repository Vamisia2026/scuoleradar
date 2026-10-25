/**
 * ScuoleRadar.it — SEMAFORO DELLA SCADENZA a TRE luci (UNICA regola, §26.89)
 * -------------------------------------------------------------------------
 * Il colore di un'opportunità è una promessa sul tempo che resta, quindi la
 * regola è UNA per tutte le superfici: tabellone «Radar Live»
 * (`radar/flightBoard/rigaBoardDati.badgeScadenza`), card e scheda dell'avviso,
 * feed della dashboard (`ElencoOpportunita`), responso della prova Radar.
 *
 *   🔴 rosso   `bg-rose-700`   0 giorni   → le prossime 24 ore  «Scade oggi»
 *   🟠 arancio `bg-orange-800` 1–2 giorni → 24–72 ore           «Scade domani»
 *                                                              «Ultime 72h»
 *   🟢 verde   `bg-emerald-700` 3 … 15 giorni, dentro l'orizzonte «In corso»
 *   ⚫ ardesia `bg-slate-600`   oltre l'orizzonte  «Scadenza fuori finestra»
 *              `bg-slate-700`   già passata       «Scaduto»
 *              `bg-slate-600`   data assente      «Scadenza n/d»
 *
 * **Perché il rosso si ferma a 24 ore e l'arancio arriva a 72.** Con il rosso
 * fisso a «Ultime 48h» due terzi della finestra utile erano già allarme: un
 * avviso con tre giorni di tempo sembrava chiuso, e l'allarme perdeva forza
 * proprio alla vigilia, quando serviva davvero. Le tre luci hanno una gerarchia
 * dichiarata: 🔴 sta per chiudersi · 🟠 è da fare adesso (la spinta operativa) ·
 * 🟢 c'è tempo. Le soglie si leggono nei giorni di CALENDARIO di
 * `lib/scadenza.giorniRimanenti` (mai una differenza fra istanti: un avviso che
 * scade oggi è «Scade oggi» anche alle 23:59), quindi «0 giorni» = meno di 24
 * ore, «1 giorno» = 24–48 ore, «2 giorni» = 48–72 ore: nessuna sovrapposizione
 * e nessun buco fra le tre luci.
 *
 * **Perché un modulo a parte.** `lib/scadenza.ts` era a 249 righe (oggi 174) e il
 * gate strutturale avvisa oltre le 250 (`W-DIM`, §26.83): la terza luce aggiunge una
 * soglia, un livello e un token, quindi lo split evita di comprimere la
 * documentazione per far quadrare il conto. La dipendenza è a senso unico —
 * questo file importa i giorni e l'orizzonte da `lib/scadenza.ts`, che NON lo
 * importa — quindi non si crea nessun ciclo fra moduli (`E-CICLO`).
 *
 * Nota sui token: `rose`, `emerald`, `slate` e `orange` sono gradini della
 * palette Tailwind (non di `theme.extend.colors`), quindi la guardia
 * `npm run test:palette` li valida contro la palette completa. `orange-800`
 * regge il testo bianco in grassetto con un contrasto di 7,3:1, come le altre
 * luci piene; nessuna tinta pastello e nessuna pulsazione: il colore dichiara
 * lo STATO, non invita a correre.
 */
import { GIORNI_ORIZZONTE_OPPORTUNITA } from './scadenza';

/**
 * Soglia della luce ROSSA (in giorni): 0 = solo il giorno della scadenza, cioè
 * le prossime 24 ore. Da domani il badge NON è più rosso: passa all'arancio.
 */
export const SOGLIA_ROSSO = 0;

/**
 * Soglia della luce ARANCIONE (in giorni): 1 … 2, cioè 24–72 ore. Oltre questa
 * soglia — e dentro l'orizzonte di candidatura — il badge è VERDE. Lo stesso
 * numero è la soglia del gruppo «urgente» dei promemoria via email
 * (`lib/resend.ts`), che resta così identico a prima.
 */
export const SOGLIA_ARANCIO = 2;

/**
 * Livello del semaforo. `critico`/`urgente`/`in-corso` sono le tre luci;
 * `scaduto`, `fuori-finestra` e `sconosciuto` sono gli stati SENZA allarme.
 */
export type LivelloScadenza =
  | 'scaduto'
  | 'critico'
  | 'urgente'
  | 'in-corso'
  | 'fuori-finestra'
  | 'sconosciuto';

export interface StileScadenza {
  livello: LivelloScadenza;
  /** Classi Tailwind del badge (token di `SCADENZA_TOKENS`, mai composte a mano). */
  className: string;
  /** Etichetta di STATO: «Scade oggi», «Ultime 72h», «In corso», «Scaduto»… */
  label: string;
}

/**
 * TOKEN del semaforo — UNICA palette dell'applicazione (§26.82, §26.89).
 * Tutte le luci sono piene, con testo bianco in grassetto: il badge deve
 * leggersi di sfuggita, anche su schermo piccolo.
 */
export const SCADENZA_TOKENS = {
  rosso: 'bg-rose-700 text-white font-bold',
  arancio: 'bg-orange-800 text-white font-bold',
  verde: 'bg-emerald-700 text-white font-bold',
  scaduto: 'bg-slate-700 text-white font-bold',
  neutro: 'bg-slate-600 text-white font-bold',
} as const;

/**
 * True quando il termine è vicino abbastanza da meritare l'avviso «In scadenza»
 * (rosso, arancio o già scaduto). La regola vive qui, non nel componente: card e
 * scheda non devono ricostruire l'elenco dei livelli d'allarme.
 */
export function eTermineProssimo(livello: LivelloScadenza): boolean {
  return livello === 'critico' || livello === 'urgente' || livello === 'scaduto';
}

/**
 * SEMAFORO della scadenza — UNA sola regola per tutta l'applicazione.
 *
 *   🔴 `critico`        → 0 giorni                              «Scade oggi»
 *   🟠 `urgente`        → 1 giorno «Scade domani» · 2 «Ultime 72h»
 *   🟢 `in-corso`       → 3 … `GIORNI_ORIZZONTE_OPPORTUNITA`     «In corso»
 *   ⚫ `scaduto`        → giorni negativi                       «Scaduto»
 *   ⚫ `fuori-finestra` → oltre l'orizzonte di candidatura
 *   ⚫ `sconosciuto`    → giorni `null` (data assente o illeggibile)
 *
 * `fuori-finestra` non è un errore di lettura: è il DATO CHE NON È UNA SCADENZA
 * di candidatura (fine incarico, avvio progetto, chiusura anno scolastico). La
 * vetrina lo scarta a monte (`eOpportunitaConScadenza`); qui serve alle superfici
 * che mostrano la riga comunque (scheda dell'avviso) perché non la colorino di
 * verde come se fosse aperta.
 */
export function stileScadenza(giorni: number | null): StileScadenza {
  if (giorni === null) {
    return { livello: 'sconosciuto', className: SCADENZA_TOKENS.neutro, label: 'Scadenza n/d' };
  }
  if (giorni < 0) {
    return { livello: 'scaduto', className: SCADENZA_TOKENS.scaduto, label: 'Scaduto' };
  }
  // Meno di 24 ore: l'UNICA luce rossa.
  if (giorni <= SOGLIA_ROSSO) {
    return { livello: 'critico', className: SCADENZA_TOKENS.rosso, label: 'Scade oggi' };
  }
  if (giorni === 1) {
    return { livello: 'urgente', className: SCADENZA_TOKENS.arancio, label: 'Scade domani' };
  }
  // 48–72 ore: l'ultimo gradino dell'arancio («azione richiesta»).
  if (giorni <= SOGLIA_ARANCIO) {
    return { livello: 'urgente', className: SCADENZA_TOKENS.arancio, label: 'Ultime 72h' };
  }
  if (giorni > GIORNI_ORIZZONTE_OPPORTUNITA) {
    return {
      livello: 'fuori-finestra',
      className: SCADENZA_TOKENS.neutro,
      label: 'Scadenza fuori finestra',
    };
  }
  return { livello: 'in-corso', className: SCADENZA_TOKENS.verde, label: 'In corso' };
}

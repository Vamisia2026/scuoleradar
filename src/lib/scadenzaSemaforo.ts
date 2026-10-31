/**
 * ScuoleRadar.it — SEMAFORO DELLA SCADENZA a TRE luci (UNICA regola, §26.89)
 * -------------------------------------------------------------------------
 * Il colore di un'opportunità è una promessa sul tempo che resta, quindi la
 * regola è UNA per tutte le superfici: tabellone «Radar Live»
 * (`radar/flightBoard/rigaBoardDati.badgeScadenza`), card e scheda dell'avviso,
 * feed della dashboard (`ElencoOpportunita`), responso della prova Radar.
 *
 *   🔴 rosso   `bg-error-600`    0 giorni   → le prossime 24 ore  «Scade oggi»
 *   🟠 arancio `bg-secondary-600` 1–2 giorni → 24–72 ore         «Scade domani»
 *   🟢 verde   `bg-accent-600`  3 … 15 giorni, entro l'orizzonte «In corso»
 *   🔵 blu     `bg-primary-500` oltre l'orizzonte  «Scadenza lontana»
 *   ⚫ ardesia  `bg-slate-600`   già passata       «Scaduto»
 *              `bg-slate-500`   data assente      «Scadenza n/d»
 * Tutte con etichetta BIANCA in grassetto (§26.100): nessun nero, nessun tono
 * spento, nessuna banda pastello.
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
 * **Perché le tinte sono quelle del BRAND e non di Tailwind (§26.120).** Fino al
 * 30/10/2026 il semaforo usava `rose-600`/`orange-700`/`emerald-700`/`sky-700`:
 * gradini della palette Tailwind (non di `theme.extend.colors`), quindi fuori
 * dalla palette ufficiale del prodotto. A schermo una card poteva sommare tre
 * tinte diverse — badge del match, badge della scadenza e badge del semaforo —
 * e il rosso acceso del ripiego sembrava un allarme anche quando non c'era
 * nulla da fare. Le quattro luci ora sono i gradini 500/600 della palette
 * (`error` · `secondary` · `accent` · `primary`), con il bianco in grassetto:
 * la regola del §26.100 (tinte piene, etichetta bianca) resta, il colore è
 * quello approvato. Il ROSSO resta un'eccezione dichiarata — «Scade oggi» — e
 * non viene più usato per dire «match basso».
 *
 *   🔴 `error-600`     #b9403c → 5,44:1 sul bianco (AA)
 *   🟠 `secondary-600` #bd5a14 → 4,53:1 sul bianco (AA)
 *   🟢 `accent-600`    #168044 → 4,99:1 sul bianco (AA)
 *   🔵 `primary-500`   #2b6f9e → 5,43:1 sul bianco (AA)
 *
 * Le tinte del §26.98 con il bianco stanno a 1,67–3,67:1 (sotto AA, quindi
 * vietate da §26.88) e con l'etichetta scura diventavano «muddy», cioè torbide a
 * dieci pixel. La vivacità si ottiene con la SATURAZIONE della tinta, non con la
 * sua luminosità. Le due bande neutre restano ardesia — `slate-600` «Scaduto»
 * (7,58:1) e `slate-500` «Scadenza n/d» (4,76:1) — mai un nero: il nero è
 * esattamente ciò che il cliente ha chiesto di togliere dalla tavola.
 *
 * Nota sui token: `error`, `secondary`, `accent` e `primary` sono i gradini di
 * `theme.extend.colors` (`tailwind.config.js`), quindi la guardia
 * `npm run test:palette` li valida contro la palette ufficiale; le due bande
 * neutre usano `slate` (Tailwind base, già impiegato in tutto il sito). I
 * rapporti di contrasto sono misurati da `npm run test:interpello-scadenza`
 * (funzione WCAG nel test, nessun numero copiato a mano).
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
 * Livello del semaforo. `critico`/`urgente`/`in-corso`/`fuori-finestra` sono le
 * quattro luci; `scaduto` e `sconosciuto` sono gli stati SENZA allarme.
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
 * TOKEN del semaforo — UNICA palette dell'applicazione (§26.89, §26.100).
 * Ogni banda è una tinta PIENA e SATURA con etichetta BIANCA in grassetto:
 * quattro luci di stato (rosso · arancio · verde · blu) e due bande neutre in
 * ardesia («Scaduto», «Scadenza n/d»). Nessun nero, nessun tono spento, nessuna
 * tinta pastello: il tabellone è la vetrina del servizio, non un bollettino.
 */
export const SCADENZA_TOKENS = {
  // «Scade oggi»: l'UNICO rosso delle superfici. È il gradino 600 di `error`
  // (#b9403c): pieno e saturo, ma della palette — non il `rose-600` di Tailwind.
  rosso: 'bg-error-600 text-white font-bold',
  // La chiave resta `arancio` perché il livello del semaforo è sempre `urgente`:
  // rinominarla obbligherebbe ogni superficie a cambiare per un colore.
  arancio: 'bg-secondary-600 text-white font-bold',
  verde: 'bg-accent-600 text-white font-bold',
  // Oltre l'orizzonte di candidatura la data non è un termine urgente, ma resta
  // un'informazione ATTIVA: blu pieno, non una banda ardesia (§26.100).
  lontana: 'bg-primary-500 text-white font-bold',
  scaduto: 'bg-slate-600 text-white font-bold',
  neutro: 'bg-slate-500 text-white font-bold',
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
 *   🔵 `fuori-finestra` → oltre l'orizzonte di candidatura      «Scadenza lontana»
 *   ⚫ `scaduto`        → giorni negativi                       «Scaduto»
 *   ⚫ `sconosciuto`    → giorni `null` (data assente o illeggibile)
 *
 * `fuori-finestra` non è un errore di lettura: è il DATO CHE NON È UNA SCADENZA
 * di candidatura (fine incarico, avvio progetto, chiusura anno scolastico). Dal
 * §26.100 la bacheca NON scarta più a monte la riga oltre l'orizzonte — il
 * cliente vuole vedere tutto il volume ATTIVO, non solo ciò che scade entro due
 * settimane — quindi la riga arriva qui: la banda BLU dichiara «c'è tempo, ma
 * non è un termine urgente» e non veste il verde di chi si candida adesso.
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
      className: SCADENZA_TOKENS.lontana,
      label: 'Scadenza lontana',
    };
  }
  return { livello: 'in-corso', className: SCADENZA_TOKENS.verde, label: 'In corso' };
}

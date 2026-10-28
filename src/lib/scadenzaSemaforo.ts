/**
 * ScuoleRadar.it — SEMAFORO DELLA SCADENZA a TRE luci (UNICA regola, §26.89)
 * -------------------------------------------------------------------------
 * Il colore di un'opportunità è una promessa sul tempo che resta, quindi la
 * regola è UNA per tutte le superfici: tabellone «Radar Live»
 * (`radar/flightBoard/rigaBoardDati.badgeScadenza`), card e scheda dell'avviso,
 * feed della dashboard (`ElencoOpportunita`), responso della prova Radar.
 *
 *   🔴 rosso   `bg-rose-500`    0 giorni   → le prossime 24 ore  «Scade oggi»
 *   🟡 oro     `bg-amber-400`   1–2 giorni → 24–72 ore           «Scade domani»
 *   🟢 verde   `bg-emerald-500` 3 … 15 giorni, dentro l'orizzonte «In corso»
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
 * **Perché la luce media è GIALLO ORO BRILLANTE (§26.97 → §26.98).** Fino a
 * §26.96 la luce media era ambra `amber-700` (#b45309): corretta sul contrasto
 * (5,02:1), ma a dieci pixel la sua tonalità (28°) restava a due passi dal rosso
 * `rose-700` (347°). Il §26.97 era passato a `yellow-700` (#a16207, 4,92:1 sul
 * bianco), un giallo senape scuro: distanza di tinta giusta, ma il tabellone
 * restava su toni spenti. La direttiva del 26/10/2026 (seconda) cambia il
 * REGISTRO: la tavola è bianca, il semaforo deve saltare all'occhio come la
 * barra DEV — tinte PIENE e LUMINOSE, etichetta quasi nera in grassetto
 * (`text-slate-950`), zero «Gotham City».
 *
 *   🔴 `rose-500`    #f43f5e → 5,50:1 su `slate-950` (AA)
 *   🟡 `amber-400`   #fbbf24 → 12,07:1 su `slate-950` (AAA)
 *   🟢 `emerald-500` #10b981 → 7,96:1 su `slate-950` (AAA)
 *
 * Il testo BIANCO del §26.97 non regge più questi gradini — `amber-400` sta a
 * 1,67:1, `emerald-500` a 2,54:1, `rose-500` a 3,67:1 sul bianco: tutti sotto
 * AA, quindi mai in palette (§26.88). L'etichetta scura è ciò che permette la
 * tinta più brillante restando leggibile. «Scaduto» e «Scadenza n/d» restano
 * ardesia con testo bianco: non sono allarmi e non devono lampeggiare.
 *
 * Nota sui token: `rose`, `emerald`, `slate` e `amber` sono gradini della
 * palette Tailwind (non di `theme.extend.colors`), quindi la guardia
 * `npm run test:palette` li valida contro la palette completa; i rapporti di
 * contrasto sono misurati da `npm run test:interpello-scadenza` (funzione WCAG
 * nel test, nessun numero copiato a mano).
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
 * TOKEN del semaforo — UNICA palette dell'applicazione (§26.82, §26.89, §26.98).
 * Le tre luci d'ALLARME sono tinte piene e brillanti con etichetta quasi nera in
 * grassetto: pop immediato e contrasto AA/AAA misurato. Le due bande ARDESIA —
 * «Scaduto» e «Scadenza n/d» — non sono allarmi: restano scritte in bianco.
 */
export const SCADENZA_TOKENS = {
  rosso: 'bg-rose-500 text-slate-950 font-bold',
  // La chiave resta `arancio` perché il livello del semaforo è sempre `urgente`:
  // rinominarla obbligherebbe ogni superficie a cambiare per un colore.
  arancio: 'bg-amber-400 text-slate-950 font-bold',
  verde: 'bg-emerald-500 text-slate-950 font-bold',
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

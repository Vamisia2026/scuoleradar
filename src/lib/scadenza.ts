/**
 * ScuoleRadar.it — Helper SCADENZA (puro, condiviso da UI e logica)
 *
 * Fornisce:
 *   · `giorniRimanenti(iso)`   → giorni (data-only) alla scadenza, `null` se assente;
 *   · `eScaduto(iso)`          → true se la scadenza è passata;
 *   · `eInterpelloAttivo(iso)` → filtro per ESCLUDERE gli scaduti dalle liste pubbliche;
 *   · `eAvvisoVivo(scadenza, pubblicazione)` → regola UNICA di lettura pubblica:
 *     con scadenza → non ancora passata; senza scadenza → pubblicato entro la
 *     finestra dei `GIORNI_FINESTRA_SENZA_SCADENZA` (60 giorni);
 *   · `eOpportunitaConScadenza(scadenza)` → REGOLA FERREA del feed (§26.71):
 *     senza una scadenza dichiarata e non ancora passata la riga NON è
 *     un'opportunità attiva (le pagine di archivio e gli indici di codici restano
 *     fuori da bacheca, punteggio e conteggi); dentro vale anche l'ORIZZONTE
 *     (`GIORNI_ORIZZONTE_OPPORTUNITA`, §26.82): un termine di candidatura oltre
 *     15 giorni non è una finestra di candidatura, è la FINE di un incarico o la
 *     data d'avvio di un progetto;
 *   · `stileScadenza(giorni)`  → UNICO badge della scadenza (§26.82): rosso
 *     imminente · verde in corso · ardesia per scaduto/assente/fuori finestra.
 */

/**
 * Soglia del badge ROSSO (in giorni): 0 (scade oggi), 1 (domani), 2 (ultime 48h).
 * Oltre questa soglia — e dentro l'orizzonte di candidatura — il badge è VERDE.
 */
export const SOGLIA_IMMINENTE = 2;

/**
 * Soglia «in avvicinamento» (3–7 giorni): NON è più una banda del badge (§26.82:
 * un solo semaforo, due soli colori d'allarme). Resta come livello informativo
 * dei PROMEMORIA via email (`lib/resend.ts`), dove serve distinguere un avviso
 * che scade domani da uno che scade fra sei giorni senza colorare nulla.
 */
export const SOGLIA_VICINA = 7;

export type LivelloScadenza =
  | 'scaduto'
  | 'imminente'
  | 'in-corso'
  | 'fuori-finestra'
  | 'sconosciuto';

export interface StileScadenza {
  livello: LivelloScadenza;
  /** Classi Tailwind del badge (token di `SCADENZA_TOKENS`, mai composte a mano). */
  className: string;
  /** Etichetta di STATO: «In corso», «Scade oggi», «Ultime 48h», «Scaduto»… */
  label: string;
}

/**
 * TOKEN del badge scadenza — UNICA palette dell'applicazione (§26.82).
 * Due soli colori d'allarme, pieni su testo bianco: 🔴 `rosso` = termine
 * imminente (oggi / domani / ultime 48h) · 🟢 `verde` = opportunità in corso
 * (3 giorni … orizzonte) · ⚫ `scaduto`/`neutro` = nessun allarme (già passata,
 * data assente o fuori finestra). Il giallo/arancio è stato rimosso da ogni
 * superficie: tabellone, scheda avviso e feed della dashboard coloravano lo
 * stesso dato con tre soglie diverse.
 */
export const SCADENZA_TOKENS = {
  rosso: 'bg-rose-700 text-white font-bold',
  verde: 'bg-emerald-700 text-white font-bold',
  scaduto: 'bg-slate-700 text-white font-bold',
  neutro: 'bg-slate-600 text-white font-bold',
} as const;

/** Mezzanotte (locale) del giorno indicato. */
function mezzanotte(oggi: Date): Date {
  const d = new Date(oggi);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Giorni rimanenti alla scadenza (confronto per GIORNO, non per orario).
 *   · positivo → giorni mancanti; · 0 → scade oggi; · negativo → già scaduto;
 *   · `null` → data assente o non valida.
 */
export function giorniRimanenti(iso?: string | null, oggi: Date = new Date()): number | null {
  if (!iso) return null;
  // Se la stringa inizia con YYYY-MM-DD si usa la PARTE DATA (locale), evitando
  // slittamenti di giorno dovuti ai fusi orari sui timestamptz (es. 00:00 UTC).
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  const d = m ? new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - mezzanotte(oggi).getTime()) / 86_400_000);
}

/** True se l'interpello è scaduto (scadenza precedente a oggi). */
export function eScaduto(iso?: string | null, oggi: Date = new Date()): boolean {
  const g = giorniRimanenti(iso, oggi);
  return g !== null && g < 0;
}

/**
 * True se l'interpello va tenuto nelle liste ATTIVE.
 * Senza scadenza → considerato attivo (non dimostrabile come scaduto).
 */
export function eInterpelloAttivo(iso?: string | null, oggi: Date = new Date()): boolean {
  return !eScaduto(iso, oggi);
}

/* ------------------------------------------------------------------ */
/* Finestra di validità degli avvisi che la fonte NON data (60 giorni) */
/* ------------------------------------------------------------------ */

/**
 * Finestra (in GIORNI di calendario, non «due mesi» che sarebbero 59–62) entro cui
 * un avviso SENZA scadenza esplicita resta pubblico. Regola di prodotto: una fonte
 * che non pubblica la scadenza non può tenere l'opportunità in vetrina per sempre —
 * dopo 60 giorni esce dalle liste pubbliche.
 */
export const GIORNI_FINESTRA_SENZA_SCADENZA = 60;

/**
 * Data LOCALE in formato ISO `YYYY-MM-DD`.
 * Mai `toISOString()`: alle 00:30 ora di Roma (UTC+2) la data UTC è ancora IERI e
 * gli avvisi che scadono oggi sparirebbero dalle liste.
 */
export function dataIsoLocale(data: Date): string {
  const mese = String(data.getMonth() + 1).padStart(2, '0');
  const giorno = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mese}-${giorno}`;
}

/** Primo giorno della finestra (estremo incluso) per gli avvisi senza scadenza. */
export function dataLimiteFinestraSenzaScadenza(oggi: Date = new Date()): string {
  const limite = new Date(oggi);
  limite.setDate(limite.getDate() - GIORNI_FINESTRA_SENZA_SCADENZA);
  return dataIsoLocale(limite);
}

/**
 * Regola UNICA di vetrina pubblica (card, bacheca «Radar Live», feed):
 *   · con scadenza   → la scadenza non è ancora passata;
 *   · senza scadenza → pubblicato negli ultimi `GIORNI_FINESTRA_SENZA_SCADENZA`
 *                      giorni (`created_at`).
 * Senza scadenza E senza una data di pubblicazione utilizzabile → NON è vivo: un
 * avviso non databile non può restare pubblico per sempre.
 */
export function eAvvisoVivo(
  scadenza?: string | null,
  pubblicazione?: string | null,
  oggi: Date = new Date(),
): boolean {
  if ((scadenza ?? '').trim()) return eInterpelloAttivo(scadenza, oggi);
  const dataPub = new Date(String(pubblicazione ?? '').trim());
  if (Number.isNaN(dataPub.getTime())) return false;
  // Confronto per GIORNO (come il filtro PostgREST `created_at.gte.<YYYY-MM-DD>`):
  // un avviso pubblicato esattamente 60 giorni fa è ancora nella finestra.
  const limite = new Date(oggi);
  limite.setHours(0, 0, 0, 0);
  limite.setDate(limite.getDate() - GIORNI_FINESTRA_SENZA_SCADENZA);
  const giornoPub = new Date(dataPub);
  giornoPub.setHours(0, 0, 0, 0);
  return giornoPub.getTime() >= limite.getTime();
}

/**
 * ORIZZONTE di un'opportunità (§26.82, direttiva 25/10/2026): un termine di
 * candidatura vive dentro le due settimane. Oltre i 15 giorni la «scadenza» dei
 * dati reali è la FINE dell'incarico, l'avvio del progetto o la chiusura
 * dell'anno scolastico («supplenza dal 23/10/2026 al 30/06/2027»).
 *
 * Era 30 giorni (§26.75): la finestra larga teneva in vetrina contratti annuali
 * già assegnati, che il badge verde presentava come opportunità lunghe. Il tetto
 * è UNO solo: `eOpportunitaConScadenza`, `filtroAttivi`, `table-reporter` e
 * `stileScadenza` leggono questo numero, mai una copia.
 */
export const GIORNI_ORIZZONTE_OPPORTUNITA = 15;

/**
 * REGOLA FERREA DELL'OPPORTUNITÀ (§26.71, direttiva 16/10/2026; finestra §26.82):
 * senza una `expiration_date` dichiarata — o con una data già passata, o oltre
 * l'orizzonte dei `GIORNI_ORIZZONTE_OPPORTUNITA` — la riga NON è un'opportunità
 * di lavoro attiva.
 *
 * Perché è una regola a parte e non un ramo di `eAvvisoVivo`: le righe che la
 * fonte non data sono, nella pratica misurata sulla banca dati, pagine di
 * archivio, regolamenti e **indici di classi di concorso** («ADEE | AAAA»,
 * «A041 | EEEE | A043»): contorno che non si candida e che, restando in vetrina
 * grazie alla finestra dei 60 giorni, gonfiava il conto degli avvisi attivi e il
 * punteggio di righe non lavorabili. Chi deve *scartare* un avviso dal feed
 * (bacheca «Radar Live», feed della dashboard) usa QUESTA regola; la finestra dei
 * 60 giorni di `eAvvisoVivo` resta per il *fetch*, la pulizia automatica e le
 * superfici che devono continuare a vedere una riga non databile
 * (`scripts/pulisci-scaduti.ts`, RPC `match_interpelli`).
 *
 * Un solo punto di verità: il verdetto è lo stesso per bacheca pubblica, feed
 * della dashboard, filtro PostgREST (`filtroAttivi`) e rispettivi filtri di lettura.
 */
export function eOpportunitaConScadenza(
  scadenza?: string | null,
  oggi: Date = new Date(),
  orizzonteGiorni: number = GIORNI_ORIZZONTE_OPPORTUNITA,
): boolean {
  if (!(scadenza ?? '').trim()) return false;
  if (!eInterpelloAttivo(scadenza, oggi)) return false;
  const giorni = giorniRimanenti(scadenza, oggi);
  if (giorni === null) return false;
  return giorni <= orizzonteGiorni;
}

/**
 * BADGE della scadenza — UNA sola regola per tutta l'applicazione (§26.82).
 *
 *   🔴 rosso   → 0 giorni «Scade oggi» · 1 «Scade domani» · 2 «Ultime 48h»
 *   🟢 verde   → 3 … `GIORNI_ORIZZONTE_OPPORTUNITA` giorni → «In corso»
 *   ⚫ ardesia → già passata («Scaduto»), data assente («Scadenza n/d») oppure
 *                OLTRE la finestra di candidatura («Scadenza fuori finestra»)
 *
 * I giorni sono di CALENDARIO (`giorniRimanenti`). Nessuna banda pulsa: il
 * pulsare faceva sembrare l'avviso un'offerta a tempo e non è un token del
 * design system. Nessun giallo/arancio: le soglie medie non dicono all'utente
 * nulla che il verde «In corso» già non dica, mentre il rosso resta l'unico
 * segnale di fretta.
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
  if (giorni === 0) {
    return { livello: 'imminente', className: SCADENZA_TOKENS.rosso, label: 'Scade oggi' };
  }
  if (giorni === 1) {
    return { livello: 'imminente', className: SCADENZA_TOKENS.rosso, label: 'Scade domani' };
  }
  if (giorni <= SOGLIA_IMMINENTE) {
    return { livello: 'imminente', className: SCADENZA_TOKENS.rosso, label: 'Ultime 48h' };
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
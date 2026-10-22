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
 *     (`GIORNI_ORIZZONTE_OPPORTUNITA`, §26.75): una «scadenza» a 8 mesi è la fine
 *     di un contratto, non il termine per candidarsi;
 *   · `stileScadenza(giorni)`  → semaforo del badge: 🟢 lungo · 🟡 vicino · 🔴 imminente.
 */

/** Soglie (in giorni) del semaforo di scadenza. */
export const SOGLIA_IMMINENTE = 2; // ≤ 2 giorni  → ROSSO (ultimi giorni / scade oggi)
export const SOGLIA_VICINA = 7;    // 3–7 giorni  → GIALLO (in avvicinamento)
//                                   > 7 giorni  → VERDE (lungo termine)

export type LivelloScadenza = 'scaduto' | 'imminente' | 'vicino' | 'lungo' | 'sconosciuto';

export interface StileScadenza {
  livello: LivelloScadenza;
  /** Classi Tailwind per il badge. */
  className: string;
  /** Etichetta breve ("In corso", "Tra 3 giorni", "Ultimi 2 giorni", "Scade oggi", "Scaduto"). */
  label: string;
}

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
 * ORIZZONTE di un'opportunità (§26.75, direttiva 22/10/2026): una candidatura si
 * apre a ridosso del termine. Oltre i 30 giorni la «scadenza» che si legge nei
 * dati reali non è un termine per candidarsi ma la FINE dell'incarico
 * («supplenza dal 23/10/2026 al 30/06/2027», «Durata Supplenza: fino al
 * 23/03/2027»): quelle righe restano fuori da bacheca e dal Radar Live.
 *
 * Perché serve un tetto esplicito: senza di esso il badge verde «In corso»
 * segnalava come lunghe opportunità che erano in realtà contratti annuali già
 * assegnati (sintomo misurato: 3 righe con scadenza 2027 su una popolazione di
 * 353 avvisi attivi).
 */
export const GIORNI_ORIZZONTE_OPPORTUNITA = 30;

/**
 * REGOLA FERREA DELL'OPPORTUNITÀ (§26.71, direttiva 16/10/2026; orizzonte §26.75):
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
 * Semaforo di scadenza per i badge — PALETTE PIENA ad alto contrasto
 * (§26.75, direttiva 22/10/2026): le tinte pastello (`…-100`, `…-200`) non si
 * leggono di sfuggita e sul tabellone convivevano con le bande sature del
 * «Radar Live». Qui valgono gli stessi token del tabellone
 * (`rigaBoardDati.URGENZA_TOKENS`): colore PIENO, testo BIANCO, grassetto.
 *   🟢 verde   → lungo termine (> 7 giorni)   `bg-emerald-700`
 *   🟠 arancio → in avvicinamento (3–7 giorni) `bg-amber-600`
 *   🔴 rosso   → imminente / ultimi giorni (≤ 2 giorni, "scade oggi") `bg-rose-700`
 *   ⚫ ardesia → scaduto o scadenza non indicata (assenza di dato, non allarme)
 */
export function stileScadenza(giorni: number | null): StileScadenza {
  if (giorni === null) {
    return { livello: 'sconosciuto', className: 'bg-slate-600 text-white font-bold', label: 'Scadenza n/d' };
  }
  if (giorni < 0) {
    return { livello: 'scaduto', className: 'bg-slate-700 text-white font-bold', label: 'Scaduto' };
  }
  if (giorni === 0) {
    return { livello: 'imminente', className: 'bg-rose-700 text-white font-bold animate-pulse', label: 'Scade oggi' };
  }
  if (giorni <= SOGLIA_IMMINENTE) {
    return {
      livello: 'imminente',
      className: 'bg-rose-700 text-white font-bold animate-pulse',
      label: `Ultimi ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`,
    };
  }
  if (giorni <= SOGLIA_VICINA) {
    return { livello: 'vicino', className: 'bg-amber-600 text-white font-bold', label: `Tra ${giorni} giorni` };
  }
  return { livello: 'lungo', className: 'bg-emerald-700 text-white font-bold', label: 'In corso' };
}
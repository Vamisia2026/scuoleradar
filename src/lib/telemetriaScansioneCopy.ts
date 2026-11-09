/**
 * ScuoleRadar.it — COME SI DICONO I NUMERI DEL BANNER (§26.149 · §26.150).
 *
 * Gemello di `telemetriaScansione`: là si decide **quando** dire una cosa (soglie, toni), qui si
 * decide **come** dirla (migliaia, «700+», singolari, frasi). Il distacco non è estetico:
 * `npm run test:architettura` tiene i file sotto le 250 righe, e un modulo che deve restare
 * leggibile mentre cresce si spezza per responsabilità, non a metà frase.
 *
 * REGOLA CHE VALE IN ENTRAMBI I MODULI: nessun numero inventato. Un campo non letto è `null` e
 * NON produce né una cifra né una rassicurazione — «0 fonti in errore» su un dato assente
 * sarebbe la bugia più facile di questo banner. Da §26.150 il banner è MARKETING («prova di
 * lavoro»), ma la cifra resta una misura: si arrotonda per difetto e si dichiara «+», non si
 * gonfia.
 */

/** Un numero in evidenza, già formattato: la UI non fa conti né separatori. */
export interface MisuraScansione {
  etichetta: string;
  valore: string;
}

/**
 * Migliaia all'italiana: `1284` → `1.284`.
 *
 * Non si usa `Intl.NumberFormat('it-IT')` perché il risultato dipende dai dati ICU della
 * macchina: su un Node con dati ridotti la stessa chiamata restituisce `1284`, quindi la
 * guardia sarebbe verde in locale e rossa in CI (o viceversa). I numeri qui sono conteggi
 * interi non negativi: l'inserimento del punto è deterministico e verificabile.
 */
export function migliaia(valore: number): string {
  return String(valore).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * LA CIFRA «PROVA DI LAVORO»: `712` → `700+`, `1.284` → `1.200+`, `48` → `48`.
 *
 * Il «+» è un arrotondamento PER DIFETTO alla centinaia: è sempre vero (712 opportunità sono
 * davvero «700 e più»), non è mai un numero inventato e resta leggibile a colpo d'occhio.
 * Sotto le 200 unità non si arrotonda: «150+» direbbe meno del numero che abbiamo misurato.
 */
export function almenoCentinaia(valore: number): string {
  if (!Number.isFinite(valore) || valore < 200) return migliaia(valore);
  return `${migliaia(Math.floor(valore / 100) * 100)}+`;
}

/**
 * FONTI ELABORATE CON SUCCESSO: sorgenti in ascolto meno quelle che hanno risposto male.
 * `null` se manca uno dei due numeri — senza il conto degli errori «tutte riuscite» sarebbe
 * un'affermazione non misurata, cioè esattamente ciò che questo modulo non fa mai.
 */
export function fontiElaborate(sorgenti: number | null, errori: number | null): number | null {
  if (sorgenti === null || errori === null) return null;
  return Math.max(0, sorgenti - errori);
}

/** «1.284 pagine lette nelle ultime 24 ore» — il numero che misura il lavoro del radar. */
export function fraseScansioni(n: number | null): string | null {
  if (n === null) return null;
  if (n === 0) return 'nessuna pagina letta nelle ultime 24 ore';
  return n === 1
    ? '1 pagina letta nelle ultime 24 ore'
    : `${migliaia(n)} pagine lette nelle ultime 24 ore`;
}

/** «128 fonti elaborate con successo» / «1 fonte elaborata con successo». */
export function fraseFonti(n: number | null): string | null {
  if (n === null) return null;
  return n === 1 ? '1 fonte elaborata con successo' : `${migliaia(n)} fonti elaborate con successo`;
}

/** «ultimo giro 14 minuti fa»: l'età del ciclo è la prima cosa che si legge. */
export function fraseGiro(quando: string): string {
  return `ultimo giro ${quando}`;
}

/**
 * Numeri in evidenza: si aggiunge solo ciò che è stato MISURATO, nell'ordine in cui contano
 * per chi guarda la bacheca — quanto ha letto il radar (scansioni), quante fonti ha chiuso
 * senza errori, quante opportunità ne sono uscite, su quante province.
 */
export function compilaMisure(numeri: {
  scansioni: number | null;
  fonti: number | null;
  avvisi: number | null;
  province: number | null;
}): readonly MisuraScansione[] {
  const misure: MisuraScansione[] = [];
  const aggiungi = (etichetta: string, valore: number | null, formatta = migliaia): void => {
    if (valore === null) return;
    misure.push({ etichetta, valore: formatta(valore) });
  };
  aggiungi('Scansioni 24h', numeri.scansioni);
  aggiungi('Fonti elaborate', numeri.fonti);
  aggiungi('Avvisi attivi', numeri.avvisi, almenoCentinaia);
  aggiungi('Copertura', numeri.province);
  return misure;
}

/** Prima lettera maiuscola (il dettaglio è una frase, non una lista di frammenti). */
export const maiuscola = (testo: string): string => testo.charAt(0).toUpperCase() + testo.slice(1);

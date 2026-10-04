/**
 * METRICHE del «Radar Live» — Flight Board degli interpelli in homepage.
 */

/**
 * La scala del tabellone non ha tetti: le schermate si contano sulle righe
 * DAVVERO presenti in vetrina — elementi presenti diviso `righePerPagina`,
 * arrotondati per eccesso — quindi il conto è ESATTO e DINAMICO, mai un numero
 * fisso. Il `+` di maggiorazione («32+») e la dicitura fissa
 * « - Aggiornamento automatico» sono stati rimossi il 03/10/2026 su direttiva
 * cliente: se le righe in bacheca aumentano, l'etichetta cresce di una schermata
 * solo quando se ne apre davvero una nuova.
 */

export function formattaNumeroIt(numero: number): string {
  return Math.trunc(Math.abs(numero))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface MetricaBoard {
  /** Numero ESATTO di schermate: righe in vetrina / `righePerPagina`. */
  pagine: number;
  etichettaPagine: string;
  etichettaTotale: string | null;
}

export function pagineBoard(caricate: number, righePerPagina: number): number {
  if (righePerPagina <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, caricate) / righePerPagina));
}

/** Indice di schermata normalizzato: mai 0, mai `NaN`, mai decimali. */
function indiceSchermata(valore: number): number {
  return Number.isFinite(valore) ? Math.max(1, Math.trunc(valore)) : 1;
}

/**
 * Etichetta delle schermate: «Schermata X di Y». `Y` è il numero esatto di
 * schermate delle righe in vetrina (`pagineBoard`) e `X` è sempre compreso fra 1
 * e `Y`: nessuna dicitura fissa, nessun «+», nessun valore che dica più di
 * quanto il tabellone mostra davvero.
 */
export function etichettaPagina(pagina: number, pagine: number): string {
  const totale = indiceSchermata(pagine);
  const corrente = Math.min(indiceSchermata(pagina), totale);
  return `Schermata ${corrente} di ${totale}`;
}

export function etichettaTotaleAvvisi(totaleReale: number | null, caricate: number): string | null {
  const reale = typeof totaleReale === 'number' && Number.isFinite(totaleReale) ? totaleReale : null;
  if (reale !== null) {
    if (reale <= 0) return null;
    return `${formattaNumeroIt(reale)} ${reale === 1 ? 'avviso attivo' : 'avvisi attivi'} in Italia`;
  }
  if (caricate <= 0) return null;
  return `${formattaNumeroIt(caricate)} ${caricate === 1 ? 'avviso' : 'avvisi'} in bacheca`;
}

export function metricaBoard(dati: {
  righeCaricate: number;
  totaleReale: number | null;
  righePerPagina: number;
  pagina?: number;
}): MetricaBoard {
  const { righeCaricate, totaleReale, righePerPagina } = dati;
  const pagine = pagineBoard(righeCaricate, righePerPagina);
  return {
    pagine,
    etichettaPagine: etichettaPagina(dati.pagina ?? 1, pagine),
    etichettaTotale: etichettaTotaleAvvisi(totaleReale, righeCaricate),
  };
}
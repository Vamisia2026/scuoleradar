/**
 * METRICHE del «Radar Live» — Flight Board degli interpelli in homepage.
 */

/**
 * La scala del tabellone non ha tetti: le pagine si contano sulle righe DAVVERO
 * presenti in bacheca, e in bacheca ci finiscono tutti gli avvisi attivi (la
 * lettura li prende a pagine: `letturaBoard.ts`). Il `+` dell'etichetta di pagina
 * resta per il caso in cui il database cresca fra il conteggio e la lettura:
 * mai un numero che dica più di quanto sappiamo.
 */

export function formattaNumeroIt(numero: number): string {
  return Math.trunc(Math.abs(numero))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export interface MetricaBoard {
  pagine: number;
  oltreIlLimite: boolean;
  etichettaPagine: string;
  etichettaTotale: string | null;
}

export function pagineBoard(caricate: number, righePerPagina: number): number {
  if (righePerPagina <= 0) return 1;
  return Math.max(1, Math.ceil(Math.max(0, caricate) / righePerPagina));
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

export function etichettaPagina(pagina: number, pagine: number, oltreIlLimite: boolean): string {
  return `Pagina ${Math.max(1, pagina)} di ${Math.max(1, pagine)}${oltreIlLimite ? '+' : ''} - Aggiornamento automatico`;
}

export function metricaBoard(dati: {
  righeCaricate: number;
  totaleReale: number | null;
  righePerPagina: number;
  pagina?: number;
}): MetricaBoard {
  const { righeCaricate, totaleReale, righePerPagina } = dati;
  const pagine = pagineBoard(righeCaricate, righePerPagina);
  const oltreIlLimite = typeof totaleReale === 'number' && totaleReale > righeCaricate;
  return {
    pagine,
    oltreIlLimite,
    etichettaPagine: etichettaPagina(dati.pagina ?? 1, pagine, oltreIlLimite),
    etichettaTotale: etichettaTotaleAvvisi(totaleReale, righeCaricate),
  };
}
/**
 * Modulistica · documento HTML completo (logo, titolo, indice, contenuto, pie).
 *
 * Estratto da `pdfGenerator.ts`: costanti ufficiali del documento (logo in data
 * URI e footer ripetuto su ogni pagina), tipo di ritorno e funzione che
 * assembla l'HTML pronto per anteprima, stampa e conversione in PDF.
 */
import { LOGO_DOCUMENTO_DATA_URI } from '../logoDataUri';
import { STILI_DOCUMENTO } from './stiliDocumento';
import { escapeHtml } from './testo';
import { aggiungiIndice, calcolaLayout, stimaPagine } from './layout';

/**
 * Logo del documento in DATA URI (base64, inline): si renderizza SEMPRE, in
 * ogni contesto di anteprima/stampa, senza dipendere da `/logo.png`.
 */
export const LOGO_DOCUMENTO = LOGO_DOCUMENTO_DATA_URI;

/** Footer ufficiale (testo esatto) stampato in calce a ogni pagina. */
export const FOOTER_UFFICIALE_DOCUMENTO =
  'Questo modulo è stato scaricato gratuitamente da scuoleradar.it';

export interface DocumentoPronto {
  html: string;
  pagineStimate: number;
  conIndice: boolean;
  /** Regola d'oro 1 — densità dinamica: 'compatto' (1 pagina) o 'esteso' (2 pagine). */
  layout: 'compatto' | 'esteso';
}

/**
 * Costruisce il documento HTML completo (header + titolo + indice + contenuto),
 * pronto per l'anteprima e per la stampa/conversione in PDF.
 */
export function costruisciDocumento(titolo: string, contenutoHtml: string): DocumentoPronto {
  const titoloPulito = (titolo ?? '').trim() || 'Documento ScuoleRadar';
  const pagineStimate = stimaPagine(contenutoHtml);
  const conIndice = pagineStimate > 3;
  const corpo = conIndice ? aggiungiIndice(contenutoHtml) : contenutoHtml;
  const layout = calcolaLayout(contenutoHtml);

  const html = `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(titoloPulito)} — Documento ScuoleRadar.it</title>
<style>${STILI_DOCUMENTO}</style>
</head>
<body class="${layout}">
<header class="intestazione-documento">
  <img src="${LOGO_DOCUMENTO}" alt="ScuoleRadar.it" />
</header>
<hr class="divisore" />
<h1 class="titolo-documento">${escapeHtml(titoloPulito)}</h1>
<div class="contenuto-documento">${corpo}</div>
<footer class="pie-documento-fisso">${FOOTER_UFFICIALE_DOCUMENTO}</footer>
</body>
</html>`;

  return { html, pagineStimate, conIndice, layout };
}

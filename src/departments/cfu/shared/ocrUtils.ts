/**
 * ScuoleRadar.it — Dipartimento CFU · Utility di riconoscimento del testo.
 *
 * La V1 non carica documenti: queste funzioni servono SOLO a riconoscere un
 * elenco di esami incollato dall'utente (denominazione, CFU/ECTS, codice SSD).
 * Nessuna classificazione di file, nessun OCR, nessun salvataggio.
 */

import type { AffidabilitaRiconoscimento, Esame } from './types';

export const REGEX_CFU_NUMERICO = /(?:cfu|ects|ecta?|crediti)[:=]?\s*(\d{1,3}(?:[.,]\d)?)/i;
export const REGEX_CFU_SEMPLICE = /\b(\d{1,2})\s*(?:cfu|ects|crediti)\b/i;

/** Normalizza il testo per il riconoscimento (minuscole, spazi, accenti). */
export function normalizzaTesto(testo: string): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Estrae il primo codice SSD (es. "m-ped/01" → "M-PED/01"). */
export function estraiSsd(testo: string): string | null {
  const match = (testo ?? '').match(/\b([A-Z]{1,4}(?:-[A-Z]{1,4})?)\/(\d{1,3})\b/i);
  if (!match) return null;
  const codifica = `${match[1].toUpperCase()}/${match[2]}`;
  // Codici ministeriali: M-PED/01, L-LIN/12, MAT/05, INF/01…
  return /^[A-Z]{1,4}(?:-[A-Z]{1,4})?\/\d{1,3}$/.test(codifica) ? codifica : null;
}

/** Estrae un numero di CFU/ECTS da un frammento di testo. */
export function estraiCfu(testo: string): number | null {
  const t = (testo ?? '').toLowerCase();
  const match = t.match(REGEX_CFU_NUMERICO) ?? t.match(REGEX_CFU_SEMPLICE);
  if (!match) return null;
  const valore = Number.parseFloat(match[1].replace(',', '.'));
  if (!Number.isFinite(valore) || valore <= 0) return null;
  return Math.round(valore * 10) / 10;
}

/** Rimuove da una riga le porzioni già attribuite (SSD/CFU) per isolare la materia. */
function pulisciDenominazione(riga: string, cfu: number | null, ssd: string | null): string {
  let resto = (riga ?? '').replace(/\s+/g, ' ').trim();
  if (ssd) resto = resto.replace(new RegExp(ssd.replace('/', '\\/'), 'i'), '');
  if (cfu !== null) {
    // Numero prima dell'etichetta: "6 CFU", "9,5 crediti"
    resto = resto.replace(/\b\d{1,3}(?:[.,]\d)?\s*(?:cfu|ects|crediti)\b/gi, '');
    // Etichetta prima del numero: "CFU: 6", "crediti 9"
    resto = resto.replace(/\b(?:cfu|ects|crediti)\s*[:=]?\s*\d{1,3}(?:[.,]\d)?\b/gi, '');
  }
  return resto
    .replace(/^[\s\-—–:;,.|]+/, '')
    .replace(/[\s\-—–:;,|.]+$/, '')
    .trim();
}

/** Riga esame riconosciuta dal parser di testo. */
export interface RigaEsameRiconosciuto {
  denominazione: string;
  cfu: number | null;
  ssd: string | null;
  affidabilita: AffidabilitaRiconoscimento;
}

/**
 * Converte il testo di un elenco esami in righe riconosciute.
 * Supporta formati tipici:
 *   "Materia — 6 CFU — M-PED/01", "Materia · 12 cfu", "Materia, 9, SSD MAT/05".
 */
export function parseEsamiDaTesto(testo: string): RigaEsameRiconosciuto[] {
  if (!testo?.trim()) return [];
  const righe = normalizzaTesto(testo).split('\n').filter(Boolean);
  const risultati: RigaEsameRiconosciuto[] = [];
  for (const riga of righe) {
    const ssd = estraiSsd(riga);
    const cfu = estraiCfu(riga);
    const denominazione = pulisciDenominazione(riga, cfu, ssd);
    if (!denominazione && cfu === null && ssd === null) continue;
    const conSsdECfu = Boolean(ssd && cfu);
    risultati.push({
      denominazione,
      cfu,
      ssd,
      affidabilita: conSsdECfu ? 'alta' : cfu !== null || ssd ? 'media' : 'bassa',
    });
  }
  return risultati;
}

/** Converte le righe riconosciute in `Esame[]` pronti per il calcolo. */
export function righeVersoEsami(righe: RigaEsameRiconosciuto[]): Esame[] {
  let contatore = 0;
  const adesso = Date.now();
  return righe
    .filter((riga) => riga.cfu !== null && riga.cfu > 0)
    .map((riga) => {
      contatore += 1;
      return {
        id: `testo-${contatore}-${adesso}`,
        denominazione: riga.denominazione || 'Esame non riconosciuto',
        cfu: riga.cfu ?? 0,
        ssd: riga.ssd,
        fonte: 'testo-incollato' as const,
        affidabilita: riga.affidabilita,
      };
    });
}

/**
 * ScuoleRadar.it — Dipartimento CFU · Utility di riconoscimento (OCR layer).
 *
 * Fondazione del motore di parsing: normalizzazione del testo, estrazione di
 * CFU/ECTS numerici e di codici SSD (M-PED/01, L-LIN/12, MAT/05…), parsing di
 * elenchi esami incollati e classificazione dei file allegati (JPG/PNG/PDF).
 *
 * NB: il riconoscimento visivo (foto del libretto) arriverà con un provider
 * OCR dedicato; queste funzioni già normalizzano e validano ciò che il
 * motore restituirà e producono esiti affidabili sul testo.
 */

import type { AffidabilitaRiconoscimento, AllegatoCfu, Esame } from './types';

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
 * Converte il testo di un intero libretto/elenco in righe esame riconosciute.
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

/** Converte le righe riconosciute in `Esame[]` pronti per l'analisi. */
export function righeVersoEsami(righe: RigaEsameRiconosciuto[]): Esame[] {
  let contatore = 0;
  const adesso = Date.now();
  return righe
    .filter((r) => r.cfu !== null && r.cfu > 0)
    .map((r) => {
      contatore += 1;
      return {
        id: `testo-${contatore}-${adesso}`,
        denominazione: r.denominazione || 'Esame non riconosciuto',
        cfu: r.cfu ?? 0,
        ssd: r.ssd,
        fonte: 'testo-incollato' as const,
        affidabilita: r.affidabilita,
      };
    });
}

/* ----------------------------- Allegati ----------------------------- */

/** Estensioni accettate (immagini + PDF). */
export const ESTENSIONI_AMMESSE = ['jpg', 'jpeg', 'png', 'pdf'];
export const MIME_AMMESSI = ['image/jpeg', 'image/png', 'application/pdf'];
/** Dimensione massima per singolo allegato (10 MB). */
export const DIMENSIONE_MASSIMA_ALLEGATO = 10 * 1024 * 1024;

export interface ClassificazioneFile {
  ammesso: boolean;
  tipo: 'immagine' | 'pdf' | null;
  motivo: string | null;
}

/** Verifica nome/MIME/dimensione di un file prima dell'analisi automatica. */
export function classificaFile(
  nomeFile: string,
  tipoMime: string,
  dimensioneByte: number,
): ClassificazioneFile {
  const estensione = (nomeFile ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (!MIME_AMMESSI.includes(tipoMime)) {
    return { ammesso: false, tipo: null, motivo: 'Formato non supportato: carica JPG, PNG o PDF.' };
  }
  if (!ESTENSIONI_AMMESSE.includes(estensione)) {
    return { ammesso: false, tipo: null, motivo: 'Estensione non riconosciuta.' };
  }
  if (dimensioneByte > DIMENSIONE_MASSIMA_ALLEGATO) {
    return { ammesso: false, tipo: null, motivo: 'File troppo grande: dimensione massima 10 MB.' };
  }
  return {
    ammesso: true,
    tipo: tipoMime === 'application/pdf' ? 'pdf' : 'immagine',
    motivo: null,
  };
}

/** Suggerimenti dai nomi tipici dei documenti universitari. */
export function suggerimentoDaNomeFile(nomeFile: string): string | null {
  const nome = (nomeFile ?? '').toLowerCase();
  if (/\blibretto\b/.test(nome)) return 'Libretto universitario';
  if (/\bstatino\b/.test(nome)) return 'Statino esami';
  if (/\btranscript\b|\bcarriera\b|\bautocertificazione\b/.test(nome)) {
    return 'Certificato di carriera';
  }
  const anno = nome.match(/20\d{2}/)?.[0] ?? null;
  return anno ? `Documento carriera ${anno}` : null;
}

/** Id univoco leggibile per un allegato. */
let idAllegati = 0;
export function allegatoDaFile(file: { name: string; type: string; size: number }): AllegatoCfu | null {
  const classificazione = classificaFile(file.name, file.type, file.size);
  if (!classificazione.ammesso || !classificazione.tipo) return null;
  idAllegati += 1;
  return {
    id: `allegato-${idAllegati}`,
    nomeFile: file.name,
    tipo: classificazione.tipo,
    dimensioneByte: file.size,
    suggerimento: suggerimentoDaNomeFile(file.name),
  };
}


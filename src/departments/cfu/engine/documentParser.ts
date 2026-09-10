/**
 * ScuoleRadar.it — Dipartimento CFU · engine/documentParser.
 *
 * Modulo 1 — Estrazione pura da documenti/OCR in un Fascicolo Accademico
 * Canonico (FascicoloAccademicoCanonico). Ogni esame conserva la provenienza
 * fisica (pagina + riga) e la confidenza OCR della riga sorgente.
 *
 * Isolato: nessuna dipendenza da UI o persistenza. I dati originali NON
 * vengono alterati (la normalizzazione avviene nel modulo `normalizer`).
 */
import type {
  EsameCanonico,
  FascicoloAccademicoCanonico,
  Provenienza,
  RiferimentoDocumento,
  SsdCode,
} from './types';

/** Riga OCR grezza proveniente da un documento. */
export interface RigaOcr {
  /** Numero riga (1-based) nella pagina. */
  numero: number;
  testo: string;
  /** Confidenza OCR della riga (0..1). */
  confidenza: number;
}

/** Pagina OCR di un documento. */
export interface PaginaOcr {
  documentId: string;
  /** Numero pagina (1-based). */
  pagina: number;
  righe: RigaOcr[];
}

/** Riconosce un codice SSD canonico dentro una stringa (es. M-PED/01, L-FIL-LET/04). */
const REGEX_SSD = /\b([A-Z]{1,6}(?:-[A-Z]{1,6}){0,3}\/\d{2,3})\b/;

/** Riconosce i crediti ("6 CFU", "9 cfu", "6/12 CFU"...). */
const REGEX_CFU = /(\d{1,3}(?:[,.]\d{1,2})?)\s*(?:CFU|ECTS)/i;

/** Ripulisce la denominazione rimuovendo marcatori già riconosciuti. */
function denominazionePulita(testo: string, ssdMatch?: string): string {
  return testo
    .replace(REGEX_CFU, ' ')
    .replace(REGEX_SSD, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[|—–-]\s*$/g, '')
    .trim()
    .replace(ssdMatch ?? '', '')
    .trim();
}

function riferimentoRiga(riga: RigaOcr, documentId: string, pagina: number): RiferimentoDocumento {
  return {
    documentId,
    pagina,
    riga: riga.numero,
    testo: riga.testo,
  };
}

function provenienzaOcr(
  riga: RigaOcr,
  documentId: string,
  pagina: number,
  qualita: number,
): Provenienza {
  return {
    fonte: riferimentoRiga(riga, documentId, pagina),
    confidenza: Math.max(0, Math.min(1, riga.confidenza * qualita)),
    metodo: 'ocr',
  };
}

/**
 * Estrae un singolo esame da una riga OCR.
 * Pattern atteso: "Denominazione — X CFU — SSD" (es. "Pedagogia generale — 6 CFU — M-PED/01").
 *
 * @returns `esame` se è stato possibile estrarre almeno denominazione + CFU.
 */
export function parseEsameDaRigaOcr(
  riga: RigaOcr,
  documentId: string,
  pagina: number,
): { esame?: EsameCanonico; avviso?: string } {
  const testo = riga.testo.trim();
  if (!testo) return {};

  const mCfu = testo.match(REGEX_CFU);
  if (!mCfu) {
    return { avviso: `Riga senza CFU riconosciuti (pag. ${pagina}, riga ${riga.numero}).` };
  }

  const cfu = Number.parseFloat(mCfu[1].replace(',', '.'));
  if (!Number.isFinite(cfu) || cfu <= 0) {
    return { avviso: `CFU non numerici validi nella riga ${riga.numero}.` };
  }

  const mSsd = testo.match(REGEX_SSD);
  const ssdRaw = mSsd ? mSsd[1].trim().toUpperCase() : null;
  const denominazione = denominazionePulita(testo, mSsd?.[1]);
  if (!denominazione) {
    return { avviso: `Denominazione esame non riconosciuta (riga ${riga.numero}).` };
  }

  const affidabilita = !ssdRaw ? 'media' : riga.confidenza >= 0.9 ? 'alta' : 'media';
  const qualita = ssdRaw ? 1 : 0.85;

  return {
    esame: {
      id: `esame-${documentId}-p${pagina}-r${riga.numero}`,
      denominazione,
      cfu: Math.round(cfu * 10) / 10,
      ssd: (ssdRaw as SsdCode | undefined) ?? null,
      ssdOrigine: ssdRaw,
      fonte: 'ocr-documento',
      affidabilita,
      provenienza: [provenienzaOcr(riga, documentId, pagina, qualita)],
    },
  };
}

/** Contesto del documento (informazioni di titolo rilevabili dalla copertina). */
export interface ContestoDocumento {
  denominazione?: string;
  istituzione?: string;
  dataLaurea?: string;
}

/**
 * Costruisce il Fascicolo Accademico Canonico da pagine OCR.
 * Le righe non interpretabili producono avvisi (candidati a verifica manuale),
 * senza interrompere l'estrazione delle righe valide.
 */
export function costruisciFascicoloDaOcr(
  pagine: PaginaOcr[],
  contesto?: ContestoDocumento,
): { fascicolo: FascicoloAccademicoCanonico; avvisi: string[] } {
  const esami: EsameCanonico[] = [];
  const avvisi: string[] = [];

  for (const pagina of pagine) {
    for (const riga of pagina.righe) {
      const risultato = parseEsameDaRigaOcr(riga, pagina.documentId, pagina.pagina);
      if (risultato.esame) esami.push(risultato.esame);
      if (risultato.avviso) avvisi.push(risultato.avviso);
    }
  }

  const documentId = pagine[0]?.documentId ?? 'documento-ignoto';
  const titolo =
    contesto && (contesto.denominazione || contesto.istituzione)
      ? {
          denominazione: contesto.denominazione ?? 'Titolo di studio',
          istituzione: contesto.istituzione ?? null,
          dataLaurea: contesto.dataLaurea ?? null,
          paese: null,
          titoloEstero: false,
        }
      : undefined;

  const fascicolo: FascicoloAccademicoCanonico = {
    documentId,
    esami,
    titolo: titolo ?? null,
    pagineAnalizzate: pagine.length,
    estrattoIl: new Date().toISOString(),
  };

  if (esami.length === 0) {
    avvisi.push(
      'Nessun esame riconosciuto dalle pagine OCR: servono dati manuali oppure un documento leggibile.',
    );
  }

  return { fascicolo, avvisi };
}

/** Confidenza media degli esami del fascicolo (0..1), utile per lo stato MANUAL_VERIFICATION. */
export function confidenzaMediaFascicolo(fascicolo: FascicoloAccademicoCanonico): number {
  if (fascicolo.esami.length === 0) return 0;
  const totale = fascicolo.esami.reduce(
    (somma, esame) =>
      somma +
      esame.provenienza.reduce((s, p) => s + p.confidenza, 0) /
        Math.max(1, esame.provenienza.length),
    0,
  );
  return Math.round((totale / fascicolo.esami.length) * 1000) / 1000;
}

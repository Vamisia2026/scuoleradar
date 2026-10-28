/**
 * ScuoleRadar.it — CAMPI DI UN DOCUMENTO D'INTERPELLO (§26.96).
 *
 * Perché esiste: quando l'avviso è un PDF (allegato dell'albo, file su Gecodoc,
 * scansione del portale) la pagina-elenco non dà NIENTE di ciò che serve: la
 * riga ha solo un titolo o un nome di file. I dati che rendono l'avviso
 * lavorabile stanno DENTRO il documento, e sono sempre gli stessi cinque:
 *
 *   `classe_di_concorso` · `scuola` (o codice meccanografico) · `provincia` ·
 *   `data_scadenza` · recapiti per «Radar Personale» (email/PEC/telefono).
 *
 * REGOLE DICHIARATE (le stesse di §26.72, §26.94, §26.95)
 *  · la SCADENZA passa da `lib/scadenzaTesto.scadenzaDaTesto`: senza etichetta
 *    («entro», «termine», «non oltre») una data non è un termine → `null`;
 *  · il CODICE MECCANOGRAFICO è valido solo se la lettera di provincia esiste
 *    nel catalogo condiviso (`lib/scanTargets.provinciaDaCodice`): un token di
 *    dieci caratteri qualsiasi non è una scuola;
 *  · la PROVINCIA si deriva SOLO dal codice (mai da un elenco di città
 *    duplicato qui) e vale `null` quando il codice manca;
 *  · le CLASSI usano `lib/pdfDeterminist.estraiCodiciClasse` (una sola regex per
 *    tutta l'app): `A022`, `A-22`, `AA24`, `ADSS`…, senza duplicati;
 *  · i RECAPITI sono quelli SCRITTI nel documento, deduplicati; la PEC è
 *    riconosciuta dall'etichetta che la precede o dal dominio, mai indovinata da
 *    un suffisso generico.
 *
 * Zero import da `node:*`, nessuna rete: puro e deterministico.
 * Guardia: `npm run test:piattaforme-documentali` (incluso in `npm test`).
 */

import { estraiCodiciClasse } from '../lib/pdfDeterminist.ts';
import { provinciaDaCodice } from '../lib/scanTargets.ts';
import { scadenzaDaTesto } from '../lib/scadenzaTesto.ts';

/** Recapiti dichiarati nel documento, già deduplicati e normalizzati. */
export interface RecapitiDocumento {
  email: string[];
  pec: string[];
  telefoni: string[];
}

/** I cinque campi che un documento deve dichiarare (tutti possono essere vuoti). */
export interface CampiDocumento {
  /** Classi di concorso normalizzate (`A22`, `AA24`, `ADSS`…), max 8. */
  classi: string[];
  /** Codice meccanografico (10 caratteri, provincia valida), altrimenti `null`. */
  codice: string | null;
  /** Codice provincia derivato dal meccanografico, altrimenti `null`. */
  provincia: string | null;
  /** Denominazione dell'istituto scritta nel documento, altrimenti `null`. */
  scuola: string | null;
  /** Scadenza DICHIARATA (ISO `YYYY-MM-DD`), altrimenti `null`. */
  scadenza: string | null;
  recapiti: RecapitiDocumento;
}

/** Codice meccanografico: due lettere di provincia, due di tipo, 5 cifre, una lettera. */
const RE_MECCANOGRAFICO = /\b([A-Z]{2})([A-Z]{2})(\d{5})([A-Z])\b/g;

/** Righe che possono contenere la denominazione dell'istituto. */
const RE_RIGA_SCUOLA =
  /^\s*((?:ISTITUTO|I\.?\s?C\.?|I\.?\s?I\.?\s?S\.?|I\.?\s?T\.?\s?[A-Z]*|LICE[OI]|SCUOLA|DIREZIONE\s+DIDATTICA|CONVITTO|CPIA)\b[^\n]{4,110})/im;

const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;
const RE_TELEFONO = /(?:\+39[\s./-]?)?\b0\d{1,3}(?:[\s./-]?\d{2,4}){2,3}\b/g;

/** Spazi compattati: i PDF spezzano le frasi a metà (`entro il\n15/11/2026`). */
function compatto(testo: string): string {
  return (testo ?? '').replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Codice meccanografico CERTIFICATO dal catalogo province: il primo token valido
 * del testo (`null` se non ce n'è nessuno). Il catalogo evita che un identificativo
 * di protocollo o un codice fiscale venga scambiato per una scuola.
 */
export function codiceMeccanograficoDaTesto(testo: string): string | null {
  for (const m of (testo ?? '').toUpperCase().matchAll(RE_MECCANOGRAFICO)) {
    if (provinciaDaCodice(m[1])) return `${m[1]}${m[2]}${m[3]}${m[4]}`;
  }
  return null;
}

/**
 * Recapiti del documento. La PEC si riconosce dall'etichetta che precede
 * l'indirizzo («PEC», «posta elettronica certificata») oppure dal dominio
 * (`pec.*`, `postacert.*`, `legalmail`); tutto il resto è posta ordinaria.
 */
export function recapitiDaTesto(testo: string): RecapitiDocumento {
  const fonte = compatto(testo);
  const email: string[] = [];
  const pec: string[] = [];
  for (const m of fonte.matchAll(RE_EMAIL)) {
    const indirizzo = m[0].replace(/[.,;:]+$/, '').toLowerCase();
    // L'etichetta vale solo se sta SUBITO prima dell'indirizzo: «PEC: a@… PEO:
    // b@…» non deve classificare b@ come PEC (l'etichetta di a@ è a 40 caratteri).
    const prima = fonte.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const dominio = indirizzo.split('@')[1] ?? '';
    const ePec =
      /(?:^|\.)pec\./i.test(dominio) ||
      /postacert|legalmail/i.test(dominio) ||
      /(?:\bPEC\b|posta\s+elettronica\s+certificata)\s*[:=–-]?\s*$/i.test(prima);
    const elenco = ePec ? pec : email;
    if (!elenco.includes(indirizzo) && elenco.length < 4) elenco.push(indirizzo);
  }
  const telefoni: string[] = [];
  for (const m of fonte.matchAll(RE_TELEFONO)) {
    const numero = m[0].replace(/\s+/g, ' ').trim();
    if (!telefoni.includes(numero) && telefoni.length < 3) telefoni.push(numero);
  }
  return { email, pec, telefoni };
}

/** Denominazione dichiarata nel documento (prima riga che nomina un istituto). */
function scuolaDaTesto(testo: string): string | null {
  const m = RE_RIGA_SCUOLA.exec(testo ?? '');
  if (!m) return null;
  const nome = m[1].replace(/\s+/g, ' ').replace(/[\s,;:.\-–—]+$/, '').trim();
  return nome.length >= 8 ? nome.slice(0, 120) : null;
}

/**
 * I cinque campi dell'avviso letti dal testo del documento. Funziona allo stesso
 * modo su un PDF (`pdfTesto.estraiTestoPdf`) e sul contenuto di una pagina
 * (`universalHtml.testo`): il formato non cambia la regola.
 */
export function campiDaDocumento(testo: string): CampiDocumento {
  const grezzo = testo ?? '';
  const codice = codiceMeccanograficoDaTesto(grezzo);
  return {
    classi: estraiCodiciClasse(grezzo),
    codice,
    provincia: codice ? codice.slice(0, 2) : null,
    scuola: scuolaDaTesto(grezzo),
    scadenza: scadenzaDaTesto(grezzo),
    recapiti: recapitiDaTesto(grezzo),
  };
}

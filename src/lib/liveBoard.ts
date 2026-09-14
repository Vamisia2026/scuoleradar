/**
 * ScuoleRadar.it — Qualità delle righe del "Radar Live" (Flight Board) — modulo puro.
 *
 * Il tabellone pubblico è la vetrina del servizio: una riga con "Scuola non
 * indicata" o "Scadenza n/d" fa sembrare il servizio rotto. Questa modulo decide
 * quali righe sono presentabili, arricchendole prima con i dati che abbiamo
 * (nome scuola dalla fonte/registro, scadenza valida) e scartando le altre.
 */

import { eInterpelloAttivo } from './scadenza';
import { enteEmittenteDaTitolo } from './matchingEngine';
import { nomeScuolaDaCodice, resolveSchoolByCode } from './school-lookup';

/** Sottoinsieme di `interpelli` necessario al tabellone. */
export interface RigaBoard {
  id: string;
  title: string;
  school_name: string | null;
  school_code?: string | null;
  province: string;
  expiration_date: string | null;
  source_url?: string | null;
}

/** Riga con i campi "vetrina" già risolti. */
export interface RigaBoardCompleta<R extends RigaBoard = RigaBoard> {
  riga: R;
  /** Nome della scuola mostrato nella riga (mai un placeholder). */
  scuola: string;
  /** Scadenza ISO valida (stringa non vuota). */
  scadenza: string;
}

/** Parole generiche che, DA SOLE, non identificano una scuola. */
const PAROLE_GENERICHE = new Set([
  'scuola', 'scuole', 'istituto', 'istituzione', 'liceo', 'licei', 'secondaria',
  'primaria', 'infanzia', 'sostegno', 'posta', 'posto', 'docente', 'docenti',
  'interpello', 'interpelli', 'avviso', 'avvisi', 'bando', 'bandi', 'selezione',
  'selezioni', 'esperto', 'esperti', 'personale', 'ata', 'supplenza', 'supplenze',
  'classe', 'classi', 'cattedra', 'cattedre', 'di', 'del', 'della', 'delle', 'dei',
  'degli', 'il', 'lo', 'la', 'le', 'gli', 'i', 'a', 'al', 'alla', 'allo', 'e', 'ed',
  'per', 'con', 'su', 'in', 'da', 'dal', 'dai', 'non', 'comune', 'grado',
]);

/** True se il segmento è composto SOLO da parole generiche. */
function soloGeneriche(segmento: string): boolean {
  const parole = segmento
    .toLowerCase()
    .split(/[^a-zà-ù0-9']+/)
    .filter(Boolean);
  return parole.length > 0 && parole.every((p) => PAROLE_GENERICHE.has(p));
}

/**
 * Estrae un nome di scuola presentabile dal titolo dell'avviso
 * (es. "… — Liceo “Augusto Monti”, Asti"). Null quando non è affidabile.
 */
export function scuolaDaTitolo(titolo?: string | null): string | null {
  const t = (titolo ?? '').trim();
  if (!t) return null;
  const frame = (t.split(/[—–]/).pop() ?? '').trim();
  if (!frame) return null;
  const parte = (frame.split(',')[0] ?? '').replace(/\s+/g, ' ').trim();
  if (parte.length < 4 || /\d{3,}/.test(parte)) return null;
  return soloGeneriche(parte) ? null : parte;
}

/**
 * Nome della scuola da mostrare, in ordine di affidabilità:
 *   1. `school_name` (estratto dallo scraper);
 *   2. registro scuole per codice meccanografico (solo nomi REALI, mai "Istituto <codice>");
 *   3. dal titolo;
 *   4. ente emittente (es. "USP Macerata");
 *   5. `null` → riga NON presentabile.
 */
export function nomeScuolaRiga(r: RigaBoard): string | null {
  const daCampo = (r.school_name ?? '').trim();
  if (daCampo.length >= 4) return daCampo;

  const dalRegistro = nomeScuolaDaCodice(r.school_code ?? null);
  if (dalRegistro) return dalRegistro;

  const dalTitolo = scuolaDaTitolo(r.title);
  if (dalTitolo) return dalTitolo;

  const ente = enteEmittenteDaTitolo(r.title, r.province);
  if (ente && !/^scuola$/i.test(ente)) return ente;

  return null;
}

/**
 * Prepara le righe del tabellone: arricchisce scuola e scadenza e SCARTA le
 * righe incomplete (niente "Scuola non indicata" / "Scadenza n/d" in vetrina).
 */
export function preparaRigheBoard<R extends RigaBoard>(righe: R[]): RigaBoardCompleta<R>[] {
  const pronte: RigaBoardCompleta<R>[] = [];
  for (const riga of righe ?? []) {
    const scadenza = (riga.expiration_date ?? '').trim();
    if (!scadenza || !eInterpelloAttivo(scadenza)) continue;
    const scuola = nomeScuolaRiga(riga);
    if (!scuola) continue;
    pronte.push({ riga, scuola, scadenza });
  }
  return pronte;
}

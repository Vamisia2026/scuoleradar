/**
 * ScuoleRadar.it — Qualità delle righe del "Radar Live" (Flight Board) — modulo puro.
 * Il tabellone pubblico è la vetrina del servizio: una riga con "Scuola non
 * indicata", "Scadenza n/d" o — peggio — un elenco di codici amministrativi al
 * posto del nome («EEEE | A246», «AAAA | A246») fa sembrare il servizio rotto.
 * 
 * REGOLA DI VETRINA: in una vista pubblica la colonna «Scuola» mostra un nome 
 * leggibile o, se non rilevabile, la dicitura standard "Scuola non specificata / Più plessi"
 * per non perdere risultati preziosi.
 */

import { eInterpelloAttivo } from './scadenza';
import { enteEmittenteDaTitolo } from './matchingEngine';
import { nomeScuolaDaCodice } from './school-lookup';
import { nomeIstitutoPresentabile } from './nomeIstituto';
import { pulisciTitoloAvviso } from './alertInterpello';

/**
 * Finestra (in giorni) entro cui un avviso SENZA scadenza resta in bacheca.
 */
export const GIORNI_FINESTRA_SENZA_SCADENZA = 60;

/** Sottoinsieme di interpelli necessario al tabellone. */
export interface RigaBoard {
  id: string;
  title: string;
  school_name: string | null;
  school_code?: string | null;
  province: string;
  expiration_date: string | null;
  created_at?: string | null;
  source_url?: string | null;
}

/** Riga con i campi "vetrina" già risolti. */
export interface RigaBoardCompleta<R extends RigaBoard = RigaBoard> {
  riga: R;
  /** Nome della scuola mostrato nella riga. */
  scuola: string;
  /** Scadenza ISO valida; null quando la fonte non ne pubblica una. */
  scadenza: string | null;
  /** True se la riga è in bacheca grazie alla finestra 60 giorni. */
  senzaScadenza: boolean;
}

function segmentoScuola(segmento: string): string | null {
  return nomeIstitutoPresentabile((segmento.split(',')[0] ?? '').trim());
}

export function titoloLeggibile(titolo?: string | null): string | null {
  const pulito = pulisciTitoloAvviso(titolo, null);
  return pulito && pulito !== 'Avviso ufficiale' ? pulito : null;
}

export function scuolaDaTitolo(titolo?: string | null): string | null {
  const t = (titolo ?? '').trim();
  if (!t) return null;
  const segmenti = t
    .split(/[—–]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segmenti.length === 0) return null;
  return (
    segmentoScuola(segmenti[segmenti.length - 1]) ??
    (segmenti.length > 1 ? segmentoScuola(segmenti[0]) : null)
  );
}

/**
 * Nome della scuola mostrato in BACHECA: se manca un nome verificato,
 * restituisce "Scuola non specificata / Più plessi" anziché scartare l'annuncio.
 */
export function nomeScuolaRiga(r: RigaBoard): string {
  const nomePulito =
    nomeIstitutoPresentabile(r.school_name) ??
    nomeIstitutoPresentabile(nomeScuolaDaCodice(r.school_code ?? null)) ??
    scuolaDaTitolo(r.title);

  if (!nomePulito) {
    return "Scuola non specificata / Più plessi";
  }

  return nomePulito;
}

export function nomePresentabileRiga(r: RigaBoard): string {
  return nomeScuolaRiga(r) || enteEmittenteDaTitolo(r.title, r.province) || "Scuola non specificata / Più plessi";
}

export function rigaPresentabileVetrina(r: RigaBoard): boolean {
  return Boolean(titoloLeggibile(r.title) ?? nomePresentabileRiga(r));
}

/**
 * Prepara le righe del tabellone includendo sia gli interpelli con scadenza attiva
 * sia quelli senza scadenza pubblicati negli ultimi 60 giorni.
 */
export function preparaRigheBoard<R extends RigaBoard>(
  righe: R[] | null | undefined,
): RigaBoardCompleta<R>[] {
  const pronte: RigaBoardCompleta<R>[] = [];
  const adesso = new Date();
  const limiteFinestra = new Date(adesso);
  limiteFinestra.setDate(limiteFinestra.getDate() - GIORNI_FINESTRA_SENZA_SCADENZA);

  for (const riga of righe ?? []) {
    const scadenza = (riga.expiration_date ?? '').trim();
    let scadenzaValida: string | null = null;
    let senzaScadenza = false;

    if (scadenza) {
      if (!eInterpelloAttivo(scadenza, adesso)) continue;
      scadenzaValida = scadenza;
    } else {
      const pubblicata = new Date(riga.created_at ?? '');
      if (Number.isNaN(pubblicata.getTime()) || pubblicata < limiteFinestra) continue;
      senzaScadenza = true;
    }

    const scuola = nomeScuolaRiga(riga);
    pronte.push({ riga, scuola, scadenza: scadenzaValida, senzaScadenza });
  }
  return pronte;
}

/**
 * Diversità geografica (round-robin per provincia) per evitare il monopolio di singole province.
 */
export function diversificaProvince<T extends { riga: { province?: string } }>(
  righe: T[] | null | undefined,
): T[] {
  const elenco = righe ?? [];
  const perProvincia = new Map<string, T[]>();
  for (const riga of elenco) {
    const chiave = (riga.riga.province ?? '').trim().toUpperCase();
    const gruppo = perProvincia.get(chiave);
    if (gruppo) gruppo.push(riga);
    else perProvincia.set(chiave, [riga]);
  }

  const gruppi = [...perProvincia.values()];
  const alternate: T[] = [];
  for (let giro = 0; alternate.length < elenco.length; giro += 1) {
    let aggiunteNelGiro = 0;
    for (const gruppo of gruppi) {
      const riga = gruppo[giro];
      if (!riga) continue;
      alternate.push(riga);
      aggiunteNelGiro += 1;
    }
    if (aggiunteNelGiro === 0) break;
  }
  return alternate;
}
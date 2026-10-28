/**
 * ScuoleRadar.it — WHITELIST NAZIONALE DEI TARGET DI INGESTIONE (§26.93).
 *
 * Perché esiste: il registro fonti (`src/scraper/fonti.ts`) contiene **93 URL
 * verificate** (73 hub USR/USP/ATP + 20 aggregatori) su 17 regioni e 54
 * province, ma `discovered_links` ne aveva solo 23 attive — tutte seminate a
 * mano per Piemonte/Liguria/Veneto/Emilia. Il motore sapeva leggere il Paese,
 * la coda no. Qui la whitelist diventa una LISTA DI TARGET pronta per la coda.
 *
 * REGOLE DICHIARATE
 *  · Solo fonti `attiva: true` (verificate HTTP: nessuna URL inventata);
 *  · un target per URL, senza duplicati fra hub e aggregatori;
 *  · `region` = prima regione dichiarata dalla fonte (null = nazionale: la
 *    provincia si rileva riga per riga, mai inventata);
 *  · `province` = capoluogo dichiarato nel registro (null se nazionale);
 *  · PURO: nessun database, nessuna rete. Chi scrive è
 *    `scripts/sync-targets-whitelist.ts`; chi legge in un giro nazionale è
 *    `scripts/table-reporter.ts --nazionale`.
 *
 * Guardia: `npm run test:whitelist` (incluso in `npm test`).
 */

import { fontiAttive, type FonteInterpelli, type TipoFonte } from './fonti.ts';

/** Un target della whitelist, nella forma attesa da `discovered_links`. */
export interface TargetWhitelist {
  url: string;
  /** Host dichiarato: `discovered_links.domain` è NOT NULL. */
  domain: string;
  region: string | null;
  province: string | null;
  /** Id della fonte nel registro (`fonti.ts`). */
  fonte: string;
  etichetta: string;
  tipo: TipoFonte;
}

/** URL canonica (`http(s)`, senza ancora) oppure `null`. */
export function normalizzaUrl(grezzo: string): string | null {
  try {
    const url = new URL(String(grezzo ?? '').trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

/** Chiave di confronto fra URL: host+percorso, senza slash finale né query. */
export function chiaveTarget(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return String(url ?? '').trim().toLowerCase().replace(/\/+$/, '');
  }
}

export interface OpzioniWhitelist {
  /**
   * `true` = solo hub istituzionali (pagine UST/USP da cui si leggono gli
   * interpelli). Gli aggregatori hanno già il loro lettore di post
   * (`src/scraper/index.ts`) e in ingestione tabellare sarebbero rumore.
   */
  soliHub?: boolean;
}

/**
 * Target nazionali dalla whitelist verificata. Dedup per URL: se lo stesso URL
 * compare in due blocchi del registro vale la PRIMA voce (ordine di priorità
 * dichiarato in `fonti.ts`).
 */
export function targetWhitelist(
  fonti: readonly FonteInterpelli[] = fontiAttive(),
  opzioni: OpzioniWhitelist = {},
): TargetWhitelist[] {
  const visti = new Set<string>();
  const out: TargetWhitelist[] = [];
  for (const fonte of fonti) {
    if (!fonte.attiva) continue;
    if (opzioni.soliHub && fonte.tipo !== 'hub-istituzionale') continue;
    const url = normalizzaUrl(fonte.url);
    if (!url) continue;
    const chiave = chiaveTarget(url);
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    out.push({
      url,
      domain: new URL(url).hostname.toLowerCase(),
      region: fonte.regioni[0] ?? null,
      province: fonte.capoluogo ?? null,
      fonte: fonte.id,
      etichetta: fonte.etichetta,
      tipo: fonte.tipo,
    });
  }
  return out;
}

export interface RiepilogoWhitelist {
  totale: number;
  hub: number;
  aggregatori: number;
  /** Regioni con almeno un target (ordinate). */
  regioni: string[];
  /** Province (codice) coperte da almeno un target. */
  province: string[];
  /** Target nazionali (aggregatore senza regione). */
  nazionali: number;
  perRegione: { regione: string; totale: number; hub: number }[];
}

/** Sintesi verificabile della whitelist (log e test: nessun numero inventato). */
export function riepilogoWhitelist(targets: readonly TargetWhitelist[]): RiepilogoWhitelist {
  const perRegione = new Map<string, { totale: number; hub: number }>();
  const province = new Set<string>();
  let hub = 0;
  let aggregatori = 0;
  let nazionali = 0;
  for (const t of targets) {
    if (t.tipo === 'hub-istituzionale') hub += 1;
    else aggregatori += 1;
    if (!t.region) nazionali += 1;
    else {
      const voce = perRegione.get(t.region) ?? { totale: 0, hub: 0 };
      voce.totale += 1;
      if (t.tipo === 'hub-istituzionale') voce.hub += 1;
      perRegione.set(t.region, voce);
    }
    if (t.province) province.add(t.province);
  }
  return {
    totale: targets.length,
    hub,
    aggregatori,
    regioni: [...perRegione.keys()].sort((a, b) => a.localeCompare(b, 'it')),
    province: [...province].sort(),
    nazionali,
    perRegione: [...perRegione.entries()]
      .map(([regione, voce]) => ({ regione, ...voce }))
      .sort((a, b) => a.regione.localeCompare(b.regione, 'it')),
  };
}

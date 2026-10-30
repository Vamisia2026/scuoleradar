/**
 * ScuoleRadar.it — PORTALI UFFICIALI MIM/USR/ATP del registro fonti (§26.109).
 *
 * La whitelist dei domini (`lib/dominiIstituzionali.ts`) ammette per costruzione
 * `*.edu.it`, `*.gov.it` e `*.istruzione.it`. Restano fuori gli uffici scolastici
 * che pubblicano ancora su un dominio `.it` storico — `istruzionepiemonte.it`,
 * `ustlucca.it`, `csalatina.it`, `atavellino.it` — che sono istituzionali a tutti
 * gli effetti e non vanno confusi con un aggregatore.
 *
 * L'elenco NON viene copiato a mano: si ricava dai target `hub-istituzionale`
 * ATTIVI del registro (`fonti.ts`), cioè dalle fonti verificate HTTP. Così, se
 * domani si aggiunge un ufficio, entra da solo; e se una voce del registro non è
 * un ente pubblico, la guardia `scripts/test-domini-istituzionali.ts` lo dice.
 *
 * PURO rispetto al database: legge il registro, non la rete.
 */

import { hostDa } from '../lib/dominiScuola.ts';
import { fontiAttive } from './fonti.ts';
import type { OpzioniDominio } from '../lib/dominiIstituzionali.ts';

/** Host (normalizzati, ordinati) dei portali USR/USP/UAT/UST del registro. */
export function portaliUfficiali(): string[] {
  const host = new Set<string>();
  for (const fonte of fontiAttive()) {
    if (fonte.tipo !== 'hub-istituzionale') continue;
    const normalizzato = hostDa(fonte.url);
    if (normalizzato) host.add(normalizzato);
  }
  return [...host].sort();
}

/**
 * Opzioni della regola dei domini pronte per lo scraper: un solo oggetto, così
 * discovery, estrazione dei link e presidio d'ingresso parlano la stessa lingua.
 */
export function opzioniDominio(): OpzioniDominio {
  return { portaliUfficiali: portaliUfficiali() };
}

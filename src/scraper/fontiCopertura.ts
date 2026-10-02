/**
 * ScuoleRadar.it — COPERTURA DICHIARATA del registro fonti (Node-only, PURO).
 *
 * Risponde a una domanda sola: *quali territori copre davvero il motore degli
 * interpelli?* Serve alle guardie di conformità (`npm run test:scraper:fonti`) e
 * alla verifica dal vivo (`npm run fonti:verifica`): la copertura è un dato
 * verificabile, non una dichiarazione di marketing.
 *
 * Nota di perimetro: parla solo di interpelli di lavoro (scraper). Le notizie del
 * MIM (`src/departments/notizie/`) sono un altro dominio e non entrano qui.
 */

import { province } from '../data/province.ts';
import { FONTI_INTERPELLI, fontiAttive, type FonteInterpelli } from './fonti.ts';

/** Regioni con almeno una fonte (per default solo quelle ATTIVE). */
export function regioniCoperte(attiveSolo = true): string[] {
  const out = new Set<string>();
  for (const f of attiveSolo ? fontiAttive() : FONTI_INTERPELLI) {
    for (const r of f.regioni) out.add(r);
  }
  return [...out].sort();
}

/** Regioni senza alcuna fonte ATTIVA (copertura dichiarata, mai simulata). */
export function regioniScoperte(): string[] {
  const tutte = new Set(province.map((p) => p.regione));
  for (const r of regioniCoperte(true)) tutte.delete(r);
  return [...tutte].sort();
}

/** Regioni registrate ma non interrogabili (con il motivo in `note`). */
export function fontiEscluse(): FonteInterpelli[] {
  return FONTI_INTERPELLI.filter((f) => !f.attiva);
}

/**
 * Capoluoghi di regione / hub metropolitani che il registro deve coprire con
 * almeno una fonte ATTIVA. Torino, Milano, Genova, Bologna, Firenze, Roma,
 * Napoli, Bari, Palermo, Venezia, Cagliari, Perugia.
 */
export const CAPOLUOGHI_PRINCIPALI: { provincia: string; nome: string }[] = [
  { provincia: 'TO', nome: 'Torino' },
  { provincia: 'MI', nome: 'Milano' },
  { provincia: 'GE', nome: 'Genova' },
  { provincia: 'BO', nome: 'Bologna' },
  { provincia: 'FI', nome: 'Firenze' },
  { provincia: 'RM', nome: 'Roma' },
  { provincia: 'NA', nome: 'Napoli' },
  { provincia: 'BA', nome: 'Bari' },
  { provincia: 'PA', nome: 'Palermo' },
  { provincia: 'VE', nome: 'Venezia' },
  { provincia: 'CA', nome: 'Cagliari' },
  { provincia: 'PG', nome: 'Perugia' },
];

/** Fonti attive il cui capoluogo di riferimento è la provincia indicata. */
export function fontiPerCapoluogo(provincia: string): FonteInterpelli[] {
  const c = (provincia ?? '').trim().toUpperCase();
  return fontiAttive().filter((f) => f.capoluogo === c);
}

/** Capoluoghi principali scoperti (nessuna fonte attiva): deve restare vuoto. */
export function capoluoghiScoperti(): string[] {
  return CAPOLUOGHI_PRINCIPALI.filter((c) => fontiPerCapoluogo(c.provincia).length === 0).map(
    (c) => c.nome,
  );
}

/** Sintesi per i log: fonti totali/attive, regioni coperte e scoperte. */
export function sintesiCopertura(): string {
  const attive = fontiAttive();
  const coperte = regioniCoperte(true);
  const scoperte = regioniScoperte();
  const hub = attive.filter((f) => f.tipo === 'hub-istituzionale').length;
  return (
    `Fonti attive: ${attive.length} (${hub} hub istituzionali, ${attive.length - hub} aggregatori) · ` +
    `regioni coperte: ${coperte.length}/20` +
    (scoperte.length > 0 ? ` · senza hub dedicato: ${scoperte.join(', ')}` : '')
  );
}

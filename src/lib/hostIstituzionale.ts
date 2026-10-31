/**
 * ScuoleRadar.it — L'HOST ISTITUZIONALE DI UNA SCUOLA (modulo PURO, §26.77 · §26.125).
 *
 * Estratto da `lib/scuoleMaster` il 31/10/2026: la regola «quale host può essere la
 * casa di un istituto» era cresciuta dentro la facciata dell'anagrafica e serviva a
 * due consumatori diversi — il link del tabellone (`school_site`) e la visura delle
 * scuole di una provincia. Vive qui una volta sola e `scuoleMaster` la riesporta,
 * così gli import esistenti non cambiano.
 *
 * Le tre esclusioni, in ordine: domini di SERVIZIO (`istruzione.it`, `mim.gov.it`),
 * piattaforme private (`piattaformeLink.ts`: Argo, Spagnoli/Nuvola, …) e caselle di
 * posta personale o di PEC (`gmail.com`, `legalmail.it`, `pec.it`, …). Un provider di
 * PEC non è la casa di una scuola: dal §26.125 è escluso anche dalla visura.
 */
import { ePiattaformaPrivata, hostDaUrl } from './piattaformeLink';

/** Host di servizio o di posta personale: mai la home di un istituto. */
export const HOST_NON_ISTITUZIONALE =
  /(?:^|\.)(?:istruzione\.it|mim\.gov\.it|gmail\.com|googlemail\.com|google\.com|libero\.it|hotmail\.(?:it|com)|outlook\.(?:it|com)|live\.(?:it|com)|yahoo\.(?:it|com)|tiscali\.it|virgilio\.it|alice\.it|tim\.it|fastwebnet\.it|icloud\.com|me\.com|aol\.com|protonmail\.com|msn\.com|posta\.it|email\.it|legalmail\.it|pec\.it|postecert\.it|arubapec\.it|pec\.email)$|^pec\./;

/** Dominio `*.edu.it` (forma preferita: è quella dell'anagrafica MIM). */
const RE_HOST_EDU_IT = /^(?:[a-z0-9-]+\.)+edu\.it$/;

/** True se l'host dichiarato può essere la home di un istituto. */
export function hostIstituzionale(host: string): boolean {
  if (!host) return false;
  if (HOST_NON_ISTITUZIONALE.test(host)) return false;
  return !ePiattaformaPrivata(`https://${host}`);
}

/**
 * Dominio ISTITUZIONALE contenuto in un recapito (PEO/PEC), altrimenti `null`.
 * L'anagrafica dichiara anche `.gov.it`, e un recapito su quel dominio è comunque
 * la casa dell'istituto. Ordine di preferenza: `.edu.it` → `.gov.it` → altro.
 */
export function dominioIstituzionale(recapito?: string | null): string | null {
  const trovati = [
    ...(recapito ?? '').toLowerCase().matchAll(/[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})/g),
  ]
    .map((m) => m[1].replace(/\.$/, ''))
    .filter(hostIstituzionale);
  return trovati.find((host) => RE_HOST_EDU_IT.test(host)) ?? trovati[0] ?? null;
}

/**
 * Home ISTITUZIONALE da un sito dichiarato o da un recapito: resta l'host nudo
 * (senza `www.`), perché la home si compone in un punto solo e un percorso
 * pubblicato dall'anagrafica può essere vecchio.
 *
 * Dal 26/10/2026 non si pretende più `*.edu.it`: l'anagrafica MIM dichiara anche
 * istituti con `.gov.it` o con il proprio dominio storico, e scartarli lasciava
 * senza home (e quindi senza `source_url`) righe di scuole vere.
 */
export function homeDaSito(sito?: string | null): string | null {
  const testo = (sito ?? '').trim();
  const host = hostDaUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(testo) ? testo : `https://${testo}`);
  return host && hostIstituzionale(host) ? `https://${host}` : null;
}

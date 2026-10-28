/**
 * ScuoleRadar.it — PIATTAFORME PRIVATE: un link che non è una fonte (modulo PURO).
 *
 * Perché esiste: le fonti pubblicano spesso indirizzi di PIATTAFORMA — Argo
 * (registro/portale), Nuvola–Spaggiari/ClasseViva, moduli Google
 * (Forms/Docs/Drive), cartelle OneDrive/SharePoint, WeTransfer — che dopo pochi
 * giorni chiedono un login, scadono o mostrano «modulo non più disponibile». Per
 * l'utente è un link rotto spacciato per «avviso ufficiale».
 *
 * L'elenco vive QUI perché serve a TRE strati diversi e la regola deve essere una
 * sola:
 *   · il tabellone (`departments/radar/flightBoard/linkFonte.ts`), che sostituisce
 *     il click con la home `.edu.it` dell'istituto;
 *   · l'ingestione (`lib/scuoleMaster.ts` → `table-reporter`), che certifica il
 *     dominio istituzionale e semina l'albo della scuola invece di inseguire il
 *     login di Argo;
 *   · il crawler delle piattaforme (§26.96, `src/scraper/allegatiPiattaforma.ts` e
 *     `src/scraper/fallbackPiattaforma.ts`), che deve sapere QUAL è la piattaforma
 *     per distinguere un muro di login da un DOCUMENTO servito dalla stessa
 *     piattaforma (un `.pdf` su Argo/Gecodoc è l'avviso vero) e per risalire dal
 *     codice meccanografico alla home della scuola quando la bacheca è vuota.
 *
 * Zero dipendenze e nessun accesso a `node:*`: è importabile anche dal browser
 * (il tabellone lo legge in pagina), mentre i consumatori Node lo riusano così
 * com'è.
 */

/**
 * Piattaforma SCOLASTICA riconosciuta dall'host. `login: true` = la pagina è un
 * muro di credenziali; `login: false` = la piattaforma serve DOCUMENTI (l'albo
 * pubblica lì i PDF, non un'area riservata).
 */
export interface PiattaformaScolastica {
  id: string;
  etichetta: string;
  host: RegExp;
  login: boolean;
}

/**
 * Registri elettronici, portali e gestori documentali delle scuole — UNA sola
 * dichiarazione in `src/**` (guardia: `npm run test:piattaforme-link`).
 * Il confronto è sempre sull'HOST, mai sul percorso: `/argo/avviso.pdf` su un
 * dominio di scuola resta un documento apribile.
 */
export const PIATTAFORME_SCOLASTICHE: readonly PiattaformaScolastica[] = [
  // Registro elettronico / portale Argo (direttiva cliente 22/10/2026: mai un
  // link a `portaleargo.it`, nemmeno nel formato per-istituto).
  { id: 'argo', etichetta: 'Argo', host: /(^|\.)argo\.it$/, login: true },
  { id: 'portaleargo', etichetta: 'Argo — portale per istituto', host: /(^|\.)portaleargo\.it$/, login: true },
  { id: 'argoweb', etichetta: 'Argo Web', host: /(^|\.)argoweb\.it$/, login: true },
  // Nuvola e ClasseViva (gruppo Spaggiari).
  { id: 'nuvola', etichetta: 'Nuvola (Madisoft)', host: /(^|\.)madisoft\.it$/, login: true },
  { id: 'spaggiari', etichetta: 'Spaggiari', host: /(^|\.)spaggiari\.eu$/, login: true },
  { id: 'spaggiari-it', etichetta: 'Spaggiari (.it)', host: /(^|\.)spaggiari\.it$/, login: true },
  { id: 'classeviva', etichetta: 'ClasseViva', host: /(^|\.)classeviva\.it$/, login: true },
  // §26.96 — Gecodoc: gestore documentale di molti albi pretori. La pagina è il
  // DOCUMENTO, non un login: non entra fra gli host «privati» ma il crawler lo
  // riconosce come piattaforma per leggerne i PDF.
  { id: 'gecodoc', etichetta: 'Gecodoc', host: /(^|\.)gecodoc\.(?:it|eu|com)$/, login: false },
];

/** Moduli Google, cartelle file e link brevi: nessun avviso verificabile. */
const HOST_MODULI_E_CARTELLE: readonly RegExp[] = [
  // Moduli e documenti Google.
  /(^|\.)docs\.google\.com$/,
  /(^|\.)drive\.google\.com$/,
  /(^|\.)forms\.google\.com$/,
  /(^|\.)forms\.gle$/,
  /(^|\.)script\.google\.com$/,
  /(^|\.)classroom\.google\.com$/,
  // Cartelle e file con scadenza.
  /(^|\.)1drv\.ms$/,
  /(^|\.)sharepoint\.com$/,
  /(^|\.)onedrive\.live\.com$/,
  /(^|\.)we\.tl$/,
  /(^|\.)wetransfer\.com$/,
];

/**
 * Host delle piattaforme che NON servono un avviso pubblico verificabile.
 * Il confronto è sull'HOST (senza `www.`), mai sul percorso: `/argo/avviso.pdf`
 * su un dominio di scuola resta un documento apribile.
 */
export const HOST_PIATTAFORMA_PRIVATA: readonly RegExp[] = [
  ...PIATTAFORME_SCOLASTICHE.filter((p) => p.login).map((p) => p.host),
  ...HOST_MODULI_E_CARTELLE,
];

/**
 * Host normalizzato di un URL `http(s)` (`www.` e punto finale rimossi), altrimenti
 * `null`: un protocollo diverso da http/https non è un link apribile.
 */
export function hostDaUrl(url?: string | null): string | null {
  const testo = (url ?? '').trim();
  if (!testo) return null;
  try {
    const parsed = new URL(testo);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.host.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return null;
  }
}

/**
 * True se il link punta a una piattaforma dell'elenco: una pagina che dopo pochi
 * giorni chiede il login o non esiste più. `www.` è irrilevante per il confronto.
 */
export function ePiattaformaPrivata(url?: string | null): boolean {
  const host = hostDaUrl(url);
  if (!host) return false;
  return HOST_PIATTAFORMA_PRIVATA.some((re) => re.test(host));
}

/**
 * QUAL piattaforma scolastica serve questo host (`null` se non è una
 * piattaforma). Serve a chi deve distinguere un muro di login da un documento:
 * `https://rmic81200p.gecodoc.it/albo/12` è l'albo della scuola, non una pagina
 * di credenziali (§26.96).
 */
export function piattaformaScolastica(url?: string | null): PiattaformaScolastica | null {
  const host = hostDaUrl(url);
  if (!host) return null;
  return PIATTAFORME_SCOLASTICHE.find((p) => p.host.test(host)) ?? null;
}

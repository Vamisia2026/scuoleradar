/**
 * ScuoleRadar.it — Dipartimento Radar · FONTE APRIBILE di una riga del «Radar Live».
 *
 * Direttiva cliente 22/10/2026: sul tabellone NON devono esistere link morti. Le
 * fonti pubblicano spesso indirizzi di PIATTAFORMA — Argo (registro/portale),
 * Nuvola–Spaggiari/ClasseViva, moduli Google (Forms/Docs/Drive), cartelle
 * OneDrive/SharePoint, WeTransfer — che dopo qualche giorno chiedono un login,
 * scadono o mostrano «modulo non più disponibile». Per l'utente è un link rotto
 * spacciato per «avviso ufficiale».
 *
 * Regola (una sola, in questo modulo):
 *   1. l'URL viene PRIMA ripulito (`pulisciUrlEsterna`: entità HTML, caporali,
 *      punteggiatura incollata) e poi validato (`urlValido`);
 *   2. se l'host è una piattaforma dell'elenco `HOST_PIATTAFORMA_PRIVATA`
 *      (`lib/piattaformeLink.ts`: UN elenco per tabellone e ingestione),
 *      l'avviso non è verificabile: si sostituisce con la HOME ISTITUZIONALE
 *      dell'istituto, presa dal sito dichiarato dall'anagrafica MIM
 *      (`school_site`, ex `SITOWEBSCUOLA`) e, in mancanza, dal dominio `.edu.it`
 *      della PEO/PEC che la scuola ha pubblicato nell'avviso (`contact_email`,
 *      poi `school_pec`);
 *   3. se non esiste né un avviso apribile né un dominio `.edu.it`, la funzione
 *      restituisce `null` e la riga NON entra in bacheca: meglio una riga in meno
 *      che una riga che promette un avviso e apre una pagina di login.
 *
 * ASSUNZIONE DICHIARATA: in Italia il dominio `*.edu.it` è l'unico assegnato per
 * convenzione alle istituzioni scolastiche, e la home risponde sul dominio nudo
 * (il più delle volte con redirect su `www.`). Non si tenta alcun `www.`
 * indovinato: si pubblica esattamente il dominio che la scuola ha scritto.
 * Per lo stesso motivo NON si accettano `istruzione.it` (caselle di servizio del
 * Ministero) né i domini personali (`gmail.com`, `libero.it`, `pec.it`…): non
 * sono il sito dell'istituto.
 *
 * Il tipo restituito distingue i due casi, così l'interfaccia può dire la verità:
 * `avviso` = pagina dell'avviso, `sito-scuola` = home ufficiale dell'istituto.
 */
import { pulisciUrlEsterna } from '@/lib/alertInterpello';
import { HOST_PIATTAFORMA_PRIVATA } from '@/lib/piattaformeLink';
import { urlValido } from './righeBoard';

/**
 * True se il link punta a una piattaforma dell'elenco: una pagina che dopo pochi
 * giorni chiede il login o non esiste più. `www.` è irrilevante per il confronto.
 *
 * L'elenco vive in `lib/piattaformeLink.ts` perché serve anche all'ingestione
 * (`lib/scuoleMaster.ts` → `table-reporter`): due elenchi divergerebbero, e la
 * regola «mai un link di login» diventerebbe una questione di superficie.
 */
export function ePiattaformaNonApribile(url?: string | null): boolean {
  const valido = urlValido(url);
  if (!valido) return false;
  try {
    const host = new URL(valido).host.toLowerCase().replace(/^www\./, '');
    return HOST_PIATTAFORMA_PRIVATA.some((re) => re.test(host));
  } catch {
    return false;
  }
}

/** Dominio `*.edu.it` contenuto in un recapito (PEO/PEC), altrimenti `null`. */
export function dominioIstituzionale(recapito?: string | null): string | null {
  const testo = (recapito ?? '').toLowerCase();
  const trovato = testo.match(/(?:^|[^a-z0-9._%+-])[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+edu\.it)\b/);
  return trovato?.[1] ?? null;
}

/** Home ufficiale dell'istituto dal primo recapito `.edu.it` disponibile. */
export function homepageIstituzionale(recapiti: ReadonlyArray<string | null | undefined>): string | null {
  for (const recapito of recapiti) {
    const dominio = dominioIstituzionale(recapito);
    if (dominio) return `https://${dominio}`;
  }
  return null;
}

/**
 * Dominio `.edu.it` del SITO ISTITUZIONALE dichiarato dall'anagrafica MIM
 * (`SITOWEBSCUOLA` → `interpelli.school_site`), altrimenti `null`.
 *
 * Accetta un host nudo (`www.iccarducci.edu.it`) o un URL completo: resta solo
 * l'host, senza `www.`, così la home si compone in un punto solo. Come per i
 * recapiti, un dominio che non è `*.edu.it` non è il sito di un istituto e vale
 * `null` (`istruzione.it`, `gmail.com`, `pec.it`…).
 */
export function dominioDaSito(sito?: string | null): string | null {
  const testo = (sito ?? '').trim().toLowerCase();
  if (!testo) return null;
  try {
    const conSchema = /^[a-z][a-z0-9+.-]*:\/\//.test(testo) ? testo : `https://${testo}`;
    const host = new URL(conSchema).host.replace(/^www\./, '').replace(/\.$/, '');
    return /^(?:[a-z0-9-]+\.)+edu\.it$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Home dell'istituto dal suo sito istituzionale (`school_site`), altrimenti `null`. */
export function homepageDaSito(sito?: string | null): string | null {
  const dominio = dominioDaSito(sito);
  return dominio ? `https://${dominio}` : null;
}

/** Fonte apribile: l'avviso vero, oppure la home ufficiale della scuola. */
export interface FonteApribile {
  url: string;
  /** `avviso` = pagina/PDF dell'avviso; `sito-scuola` = home dell'istituto. */
  tipo: 'avviso' | 'sito-scuola';
}

/** Campi della riga che servono a decidere dove può portare il click. */
export interface RigaConRecapiti {
  source_url?: string | null;
  /** Sito dell'istituto dall'anagrafica MIM (`SITOWEBSCUOLA`, solo host). */
  school_site?: string | null;
  contact_email?: string | null;
  school_pec?: string | null;
}

/**
 * Dove porta il click della riga: l'avviso se è apribile, altrimenti la home
 * `.edu.it` dell'istituto, altrimenti `null` (la riga non entra in bacheca).
 *
 * Ordine di risoluzione della home (§26.77): prima il SITO ISTITUZIONALE
 * dichiarato dall'anagrafica MIM (`school_site`), poi i recapiti pubblicati
 * nell'avviso (`contact_email`, `school_pec`). Il primo è un dato ufficiale e
 * indipendente dal bando; i secondi spesso mancano o sono caselle
 * `@istruzione.it` (scartate da `dominioIstituzionale`).
 */
export function fonteApribile(riga: RigaConRecapiti): FonteApribile | null {
  const url = urlValido(pulisciUrlEsterna(riga.source_url));
  if (url && !ePiattaformaNonApribile(url)) return { url, tipo: 'avviso' };
  const home =
    homepageDaSito(riga.school_site) ??
    homepageIstituzionale([riga.contact_email, riga.school_pec]);
  return home ? { url: home, tipo: 'sito-scuola' } : null;
}

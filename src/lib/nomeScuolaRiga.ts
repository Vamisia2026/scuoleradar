/**
 * ScuoleRadar.it — NOME DELLA SCUOLA di una riga del tabellone — modulo puro.
 *
 * Estratto da `liveBoard.ts` (§26.81, 22/10/2026) per rispettare il limite di 250
 * righe del gate strutturale: la REGOLA di vetrina resta là (`preparaRigheBoard`),
 * qui vive solo la domanda «quale scuola emette questo avviso?», che è l'unica
 * condizione d'ingresso della bacheca (§26.59).
 *
 * Ordine di affidabilità del nome (`nomeScuolaRiga`):
 *   1. `school_name` passato dal gate `nomeIstituto.ts`;
 *   2. registro scolastico per codice meccanografico;
 *   3. denominazione CERTIFICATA dal codice meccanografico statale (§26.81);
 *   4. nome leggibile ricavato dal titolo (`titoloBoard.ts`).
 * `null` = nessun istituto reale: la riga resta fuori dalla vetrina.
 *
 * Il nome GREZZO del bando (`nomeGrezzoDaBando`) NON è una sorgente di vetrina: da
 * §26.59 la stringa di una fonte non è un'anagrafica. Vive qui perché è il
 * giudizio «nome leggibile o dump di codici?» che serve al punto 3 e alle
 * verifiche di qualità dell'ingestione.
 */

import { normalizzaCodiceMeccanografico } from './emailScuola.ts';
import { nomeIstitutoPresentabile } from './nomeIstituto.ts';
import { nomeScuolaDaCodice } from './school-lookup.ts';
import { nomeScuolaDaTitolo } from './titoloBoard.ts';

/** Vista minima di una riga: quanto basta a risolvere la scuola emittente. */
export interface RigaConNome {
  title: string;
  school_name: string | null;
  school_code?: string | null;
}

/**
 * Nome GREZZO pubblicato dal BANDO. Da §26.59 NON è un ripiego di vetrina: la
 * stringa di una fonte non è un'anagrafica, quindi non fa entrare una riga
 * (`preparaRigheBoard`). Resta il giudizio PURO «nome leggibile o dump di codici?»,
 * usato dalle verifiche di qualità dell'ingestione. Si accetta SOLO se resta un nome
 * leggibile: un dump di codici («EEEE | A246», «BA02 | AR04», «ADEE») o una sequenza
 * amministrativa (date, protocolli, classi) vale `null`.
 */
export function nomeGrezzoDaBando(testo?: string | null): string | null {
  const pulito = (testo ?? '').replace(/\s+/g, ' ').trim();
  if (pulito.length < 4) return null;
  if (/\d{3,}/.test(pulito)) return null; // date, protocolli, progressivi
  if (/\b[A-Z]{1,2}-?\d{2,3}\b/i.test(pulito)) return null; // classi di concorso (A-22, A042)
  if (/\bAD[A-Z]{2,3}\b/i.test(pulito)) return null; // sostegno (ADEE, ADSS, AD24)
  if (/\b[A-Z]{1,3}\d{2,4}\b/i.test(pulito)) return null; // codici misti (A246, BA02)
  if (!/[A-Za-zÀ-ÿ]{4,}/.test(pulito)) return null; // nessuna parola "da nome"
  return pulito;
}

/**
 * Dichiarazioni di dato MANCANTE: non sono denominazioni, con o senza codice.
 * Il confronto ignora accenti, maiuscole e spazi doppi (stessa logica del
 * segnaposto di `nomeIstituto.ts`).
 */
const NON_UN_NOME =
  /^(?:n\.?\s?d\.?|n\/d|non\s+disponibile|da\s+definire|sconosciut[oa]|nessun[ao]?|scuola\s+non\s+specificata.*)$/i;

/**
 * Denominazione accettata perché il CODICE meccanografico la certifica (§26.81,
 * misurato il 22/10/2026 sulle scuole del Piemonte).
 *
 * Il Ministero scrive alcune denominazioni SENZA la testa d'istituto che
 * `nomeIstitutoPresentabile` pretende: `ALIC809001` → «RIVALTA B.DA - "N. BOBBIO"»
 * (ufficiale, dal file SCUANAGRAFE), `NOIC80800E` → «G. PASCOLI». Sono istituti
 * reali — il codice statale `XXYY12345Z` lo prova — ma il gate del nome le
 * scartava e le loro opportunità restavano invisibili in bacheca (5 righe su 248
 * il 22/10/2026, tutte Piemonte). Qui la prova d'identità è il CODICE: se è un
 * meccanografico statale valido, la stringa pubblicata entra purché sia una
 * denominazione leggibile (`nomeGrezzoDaBando`: niente dump di codici, di classi
 * di concorso, di date) e non una dichiarazione di dato mancante. Restano fuori,
 * come prima, le righe senza codice e le etichette di posto/materia.
 */
function nomeDaCodiceCertificato(r: RigaConNome): string | null {
  if (!normalizzaCodiceMeccanografico(r.school_code ?? null)) return null;
  const nome = nomeGrezzoDaBando(r.school_name);
  if (!nome) return null;
  const piatto = nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
  return NON_UN_NOME.test(piatto) ? null : nome;
}

/**
 * Nome REALE della scuola, in ordine di affidabilità (vedi intestazione del
 * modulo). `null` quando non resta un nome in chiaro: è il GATE STRETTO della
 * vetrina (§26.59) — senza un istituto reale la riga non entra.
 */
export function nomeScuolaRiga(r: RigaConNome): string | null {
  return (
    nomeIstitutoPresentabile(r.school_name) ??
    nomeIstitutoPresentabile(nomeScuolaDaCodice(r.school_code ?? null)) ??
    nomeDaCodiceCertificato(r) ??
    nomeScuolaDaTitolo(r.title)
  );
}

/** Nome della scuola per la colonna «Scuola»: solo un istituto REALE (§26.59). */
export interface NomeScuolaBoard {
  /** Denominazione risolta: mai vuota, mai un segnaposto. */
  nome: string;
  /** True se il nome NON viene da `school_name` (registro o titolo): anagrafica da completare. */
  approssimativo: boolean;
}

/**
 * Nome per la colonna «Scuola» della BACHECA — `null` quando la riga non ha un
 * istituto REALE risolto (`nomeScuolaRiga`): è il GATE STRETTO della vetrina
 * (§26.59) e `null` significa «riga fuori», non «mostra un ripiego». Nessun nome
 * grezzo del bando e nessun segnaposto: non sono anagrafiche.
 */
export function nomeScuolaBoard(r: RigaConNome): NomeScuolaBoard | null {
  const reale = nomeIstitutoPresentabile(r.school_name);
  if (reale) return { nome: reale, approssimativo: false };
  // §26.81: la denominazione pubblicata e CERTIFICATA dal codice meccanografico
  // statale è il nome dell'istituto, non un'approssimazione da completare.
  const certificato = nomeDaCodiceCertificato(r);
  if (certificato) return { nome: certificato, approssimativo: false };
  const risolto = nomeScuolaRiga(r);
  return risolto ? { nome: risolto, approssimativo: true } : null;
}

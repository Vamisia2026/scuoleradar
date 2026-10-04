/**
 * ScuoleRadar.it — Qualità delle righe del "Radar Live" (Flight Board) — modulo puro.
 * Il tabellone pubblico è la vetrina del servizio: una riga con «Scadenza n/d» o —
 * peggio — un elenco di codici amministrativi al posto del nome («EEEE | A246»,
 * «AAAA | A246») fa sembrare il servizio rotto.
 *
 * REGOLA DI VETRINA (direttiva cliente 04/10/2026, §26.47 — corregge la §26.20 del
 * 28/09/2026): un avviso GENUINO **non si scarta MAI** per un'anagrafica
 * incompleta — è il caso dei 10 annunci di Padova, spariti dalla bacheca perché
 * l'istituto non era mappato. La colonna «Scuola» mostra, in ordine:
 *   1. il nome REALE dell'istituto (`school_name`, registro, titolo — gate
 *      `nomeIstituto.ts`);
 *   2. il nome GREZZO pubblicato dal bando (`nomeGrezzoDaBando`), quando è un nome
 *      leggibile e non un dump di codici;
 *   3. il segnaposto GESTITO «Scuola non specificata / Più plessi» (`statoArricchimento.ts`).
 * I codici amministrativi restano FUORI dalla colonna (mai uno pseudo-nome), ma la
 * riga ENTRA comunque e viene marcata (`anagraficaParziale`), così l'interfaccia
 * può dichiarare gentilmente che l'anagrafica è in via di aggiornamento.
 */

import { eInterpelloAttivo } from './scadenza';
import { enteEmittenteDaTitolo } from './matchingEngine';
import { nomeScuolaDaCodice } from './school-lookup';
import { nomeIstitutoPresentabile } from './nomeIstituto';
import { pulisciTitoloAvviso } from './alertInterpello';
import {
  SCUOLA_NON_SPECIFICATA,
  anagraficaInAggiornamento,
} from './statoArricchimento';

// La dicitura gestita appartiene a `statoArricchimento.ts` (un solo punto di
// verità): qui si ri-esporta perché la vetrina sia importabile da un solo modulo.
export { SCUOLA_NON_SPECIFICATA };

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
  /** Stato dell'anagrafica (`completo` | `parziale` | null): mai un motivo di scarto. */
  stato_arricchimento?: string | null;
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
  /**
   * True quando l'anagrafica NON è completa: il nome mostrato è di ripiego (nome
   * grezzo del bando o segnaposto) oppure la riga è marcata `parziale`.
   * L'interfaccia dichiara il ripiego con «Scuola non specificata / Più plessi» —
   * e la riga resta.
   */
  anagraficaParziale: boolean;
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
 * Nome REALE della scuola, in ordine di affidabilità:
 *   1. `school_name` (comunque passato dal gate `nomeIstituto`);
 *   2. registro scuole per codice meccanografico;
 *   3. dal titolo (`scuolaDaTitolo`).
 * `null` quando non resta un nome in chiaro: è il segnale per il RIPIEGO della
 * vetrina (`nomeScuolaBoard`), mai un motivo di scarto della riga.
 */
export function nomeScuolaRiga(r: RigaBoard): string | null {
  return (
    nomeIstitutoPresentabile(r.school_name) ??
    nomeIstitutoPresentabile(nomeScuolaDaCodice(r.school_code ?? null)) ??
    scuolaDaTitolo(r.title)
  );
}

/**
 * Nome GREZZO pubblicato dal BANDO, usato come primo ripiego quando l'istituto
 * non è risolvibile in chiaro: è il dato che la fonte dichiara davvero, quindi
 * mostrarlo è onesto (e non inventa nulla). Si accetta SOLO se resta un nome
 * leggibile: un dump di codici («EEEE | A246», «BA02 | AR04», «ADEE») o una
 * sequenza amministrativa (date, protocolli, classi) vale `null` — al suo posto
 * interviene la dicitura gestita, mai uno pseudo-nome.
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

/** Nome da mostrare in bacheca, con il RIPIEGO dichiarato. */
export interface NomeScuolaBoard {
  /** Testo della colonna «Scuola»: mai vuoto. */
  nome: string;
  /** True se NON è la denominazione reale dell'istituto (nome grezzo o dicitura). */
  approssimativo: boolean;
}

/**
 * Nome per la colonna «Scuola» della BACHECA: non restituisce MAI `null`, perché
 * un avviso genuino non si scarta per un'anagrafica incompleta (direttiva
 * 04/10/2026). Catena: nome reale → nome grezzo del bando → segnaposto gestito
 * «Scuola non specificata / Più plessi»; `approssimativo` dice all'interfaccia
 * quando deve dichiararlo.
 */
export function nomeScuolaBoard(r: RigaBoard): NomeScuolaBoard {
  const reale = nomeScuolaRiga(r);
  if (reale) return { nome: reale, approssimativo: false };
  const grezzo = nomeGrezzoDaBando(r.school_name);
  if (grezzo) return { nome: grezzo, approssimativo: true };
  return { nome: SCUOLA_NON_SPECIFICATA, approssimativo: true };
}

/**
 * Etichetta della riga nella PROVA del Radar (responso): ultima risorsa
 * legittima l'ENTE emittente (es. «USP Torino»), mai un codice. `null` quando non
 * c'è nulla di presentabile: la riga resta fuori dalla prova
 * (`rigaPresentabileVetrina`).
 */
export function nomePresentabileRiga(r: RigaBoard): string | null {
  return nomeScuolaRiga(r) ?? enteEmittenteDaTitolo(r.title, r.province);
}

export function rigaPresentabileVetrina(r: RigaBoard): boolean {
  return Boolean(titoloLeggibile(r.title) ?? nomePresentabileRiga(r));
}

/**
 * Prepara le righe del tabellone: tiene gli interpelli con scadenza attiva e gli
 * avvisi senza scadenza pubblicati negli ultimi 60 giorni.
 *
 * ⛔ **Nessuno scarto per anagrafica** (direttiva 04/10/2026, §26.47): una riga
 * che non ha un nome d'istituto risolvibile entra COMUNQUE, con il nome grezzo del
 * bando o con la dicitura gestita, e viene marcata `anagraficaParziale`. Restano
 * fuori solo le righe che NON sono avvisi vivi (scadute o senza data di
 * pubblicazione utile) — mai un bando genuino.
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

    const { nome: scuola, approssimativo } = nomeScuolaBoard(riga);
    // Direttiva 04/10/2026 (§26.47): la riga ENTRA SEMPRE. Un avviso genuino non
    // si scarta per un'anagrafica incompleta (caso Padova: 10 annunci spariti). Il
    // nome mostrato è quello reale, altrimenti quello grezzo del bando, altrimenti
    // la dicitura gestita; `anagraficaParziale` lo dichiara all'interfaccia.
    const anagraficaParziale =
      approssimativo || anagraficaInAggiornamento(riga.stato_arricchimento);
    pronte.push({ riga, scuola, scadenza: scadenzaValida, senzaScadenza, anagraficaParziale });
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
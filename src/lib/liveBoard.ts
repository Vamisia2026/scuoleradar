/**
 * ScuoleRadar.it — Qualità delle righe del "Radar Live" (Flight Board) — modulo puro.
 * Il tabellone pubblico è la vetrina del servizio: una riga con «Scadenza n/d» o —
 * peggio — un elenco di codici amministrativi al posto del nome («EEEE | A246»,
 * «AAAA | A246») fa sembrare il servizio rotto.
 *
 * REGOLA DI VETRINA (§26.59, direttiva 05/10/2026 — ripristina il gate STRETTO e
 * corregge la §26.47/§26.48 del 04/10/2026): in vetrina entra SOLO una riga con il
 * nome di un istituto REALE risolto per anagrafica — `school_name` passato dal gate
 * `nomeIstituto.ts`, registro scolastico per codice meccanografico, oppure nome
 * leggibile ricavato dal titolo (`nomeScuolaRiga`). Restano FUORI:
 *   1. le righe con il solo nome GREZZO pubblicato dal bando (`nomeGrezzoDaBando`):
 *      è il dato della fonte, non un'anagrafica;
 *   2. le righe senza alcun nome risolvibile, per cui la §26.47 prevedeva la dicitura
 *      gestita «Scuola non specificata / Più plessi» (`statoArricchimento.ts`).
 * Motivo: il tabellone è la vetrina del servizio — una riga di cui non si sa quale
 * scuola emette l'avviso non è verificabile e fa sembrare il servizio rotto.
 * I codici amministrativi restano FUORI a monte (`nomeIstituto.ts`): non sono mai un
 * nome, per nessuna strada. La riga che entra ha sempre la sua scuola e
 * `anagraficaParziale` dichiara lo stato dell'anagrafica (`completo`/`parziale`).
 *
 * REGOLA FERREA DELLA SCADENZA (§26.71, direttiva 16/10/2026): la vetrina è fatta
 * di OPPORTUNITÀ — senza una `expiration_date` dichiarata e non ancora passata la
 * riga NON entra (`eOpportunitaConScadenza`). Le pagine di archivio, i regolamenti
 * e gli indici di classi di concorso che la fonte non data restano fuori: grazie
 * alla vecchia finestra dei 60 giorni entravano in bacheca come «Scadenza n/d» e
 * gonfiavano il conto degli avvisi attivi senza essere candidabili.
 */

import { eOpportunitaConScadenza, GIORNI_FINESTRA_SENZA_SCADENZA } from './scadenza.ts';
import { nomeScuolaDaCodice } from './school-lookup.ts';
import { nomeIstitutoPresentabile } from './nomeIstituto.ts';
import { pulisciTitoloAvviso } from './alertInterpello';
import { anagraficaInAggiornamento } from './statoArricchimento';

// La dicitura gestita appartiene a `statoArricchimento.ts` (un solo punto di
// verità): qui si ri-esporta perché la vetrina sia importabile da un solo modulo.
// Da §26.59 NON entra più in vetrina: la riga senza istituto reale resta fuori.
export { SCUOLA_NON_SPECIFICATA } from './statoArricchimento';

/**
 * Finestra (in giorni) entro cui un avviso SENZA scadenza resta in bacheca.
 * Il numero vive in `scadenza.ts` (regola condivisa con feed e migrazioni): qui si
 * ri-esporta perché il tabellone e i suoi test lo importino un solo significato.
 */
export { GIORNI_FINESTRA_SENZA_SCADENZA };

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
  /** Stato dell'anagrafica (`completo` | `parziale` | null): non è un motivo di scarto. */
  stato_arricchimento?: string | null;
}

/** Riga con i campi "vetrina" già risolti. */
export interface RigaBoardCompleta<R extends RigaBoard = RigaBoard> {
  riga: R;
  /** Nome della scuola mostrato nella riga. */
  scuola: string;
  /** Scadenza ISO valida; null quando la fonte non ne pubblica una. */
  scadenza: string | null;
  /**
   * True quando l'anagrafica NON è completa: il nome non viene da `school_name`
   * (registro o titolo) oppure la riga è marcata `parziale`.
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
 * `null` quando non resta un nome in chiaro: è il GATE STRETTO della vetrina
 * (§26.59) — senza un istituto reale la riga non entra (`preparaRigheBoard`).
 */
export function nomeScuolaRiga(r: RigaBoard): string | null {
  return (
    nomeIstitutoPresentabile(r.school_name) ??
    nomeIstitutoPresentabile(nomeScuolaDaCodice(r.school_code ?? null)) ??
    scuolaDaTitolo(r.title)
  );
}

/**
 * Nome GREZZO pubblicato dal BANDO. Da §26.59 NON è più un ripiego di vetrina: la
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
export function nomeScuolaBoard(r: RigaBoard): NomeScuolaBoard | null {
  const reale = nomeIstitutoPresentabile(r.school_name);
  if (reale) return { nome: reale, approssimativo: false };
  const risolto = nomeScuolaRiga(r);
  return risolto ? { nome: risolto, approssimativo: true } : null;
}

/**
 * Nome d'istituto della riga nelle viste pubbliche (`responso della prova`): è lo
 * stesso gate della bacheca — `nomeScuolaRiga`. Mai l'ente emittente al suo posto:
 * un avviso di cui non si conosce la scuola non è una riga di vetrina (§26.59).
 */
export function nomePresentabileRiga(r: RigaBoard): string | null {
  return nomeScuolaRiga(r);
}

/** True se la riga ha un istituto REALE risolto: unica condizione d'ingresso (§26.59). */
export function rigaPresentabileVetrina(r: RigaBoard): boolean {
  return nomeScuolaRiga(r) !== null;
}

/**
 * Prepara le righe del tabellone: tiene SOLO gli interpelli con una scadenza
 * dichiarata e non ancora passata **e con un istituto reale risolto** (§26.71:
 * niente «Scadenza n/d» in vetrina — le pagine di archivio e gli indici di codici
 * che la fonte non data non sono opportunità).
 *
 * ⛔ **GATE STRETTO del nome scuola** (§26.59, direttiva 05/10/2026): in vetrina
 * entra solo una riga di cui si sa QUALE scuola emette l'avviso (`nomeScuolaRiga`).
 * Restano fuori sia le righe con il solo nome grezzo del bando sia quelle senza
 * alcun nome risolvibile (la §26.47 le teneva dentro con il segnaposto): il
 * tabellone è la vetrina del servizio e una riga non verificabile non lo rappresenta.
 */
export function preparaRigheBoard<R extends RigaBoard>(
  righe: R[] | null | undefined,
): RigaBoardCompleta<R>[] {
  const pronte: RigaBoardCompleta<R>[] = [];
  const adesso = new Date();

  for (const riga of righe ?? []) {
    const scadenza = (riga.expiration_date ?? '').trim();

    // REGOLA FERREA (§26.71): senza una scadenza dichiarata e non ancora passata la
    // riga NON è un'opportunità attiva → fuori dalla vetrina. La finestra dei 60
    // giorni per gli avvisi che la fonte non data è ritirata da questa superficie:
    // nei dati reali quelle righe sono pagine di archivio, regolamenti e indici di
    // classi di concorso — contorno che non si candida.
    if (!eOpportunitaConScadenza(scadenza, adesso)) continue;
    const scadenzaValida: string | null = scadenza;

    const nome = nomeScuolaBoard(riga);
    // GATE STRETTO (§26.59): senza un istituto reale la riga non entra. Non si
    // ripiega sul nome grezzo del bando né sul segnaposto: una riga di cui non si
    // sa quale scuola emette l'avviso non è verificabile in vetrina.
    if (!nome) continue;
    const anagraficaParziale =
      nome.approssimativo || anagraficaInAggiornamento(riga.stato_arricchimento);
    pronte.push({
      riga,
      scuola: nome.nome,
      scadenza: scadenzaValida,
      anagraficaParziale,
    });
  }
  return pronte;
}

/**
 * MESCOLAMENTO GIORNALIERO DELL'ORDINE DELLE PROVINCE (§26.72, 15/10/2026).
 *
 * L'alternanza a giri da sola non basta: l'ordine dei gruppi seguiva l'ordine di
 * arrivo della query, quindi le prime schermate mostravano sempre le stesse
 * province e il tabellone sembrava fermo. Qui l'ordine dei gruppi viene mescolato
 * con un SEME derivato dal giorno:
 *   · STABILE per tutta la giornata — due richieste dello stesso giorno danno lo
 *     stesso tabellone (la paginazione non cambia sotto il dito dell'utente);
 *   · DIVERSO domani — in pochi giorni il tabellone ruota su tutta l'Italia;
 *   · deterministico e senza dipendenze: stessa data ⇒ stesso ordine (testabile).
 * Dentro ogni provincia l'ordine di arrivo resta INTATTO (cronologia decrescente).
 */
function semeDelGiorno(oggi: Date): number {
  const chiave = `${oggi.getFullYear()}-${oggi.getMonth() + 1}-${oggi.getDate()}`;
  let hash = 2166136261;
  for (let i = 0; i < chiave.length; i += 1) {
    hash ^= chiave.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Fisher-Yates deterministico (mai in loco): stesso seme ⇒ stesso ordine. */
function mescolaConSeme<T>(valori: T[], seme: number): T[] {
  const copia = [...valori];
  let stato = seme;
  const prossimo = (): number => {
    stato = (stato + 0x6d2b79f5) >>> 0;
    let t = stato;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(prossimo() * (i + 1));
    const scambio = copia[i];
    copia[i] = copia[j];
    copia[j] = scambio;
  }
  return copia;
}

/**
 * Diversità geografica: nessuna provincia monopolizza le prime pagine. I gruppi
 * (uno per provincia) vengono MESCOLATI con il seme del giorno e poi alternati a
 * giri (round-robin). `oggi` è iniettabile: i test fissano il giorno e ottengono
 * un ordine stabile; in produzione l'ordine ruota ogni giorno.
 */
export function diversificaProvince<T extends { riga: { province?: string } }>(
  righe: T[] | null | undefined,
  oggi: Date = new Date(),
): T[] {
  const elenco = righe ?? [];
  const perProvincia = new Map<string, T[]>();
  for (const riga of elenco) {
    const chiave = (riga.riga.province ?? '').trim().toUpperCase();
    const gruppo = perProvincia.get(chiave);
    if (gruppo) gruppo.push(riga);
    else perProvincia.set(chiave, [riga]);
  }

  const gruppi = mescolaConSeme([...perProvincia.values()], semeDelGiorno(oggi));
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




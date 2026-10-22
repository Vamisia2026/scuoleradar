/**
 * ScuoleRadar.it — Qualità delle righe del "Radar Live" (Flight Board) — modulo puro.
 * Il tabellone pubblico è la vetrina del servizio: una riga con «Scadenza n/d» o —
 * peggio — un elenco di codici amministrativi al posto del nome («EEEE | A246»,
 * «AAAA | A246») fa sembrare il servizio rotto.
 *
 * REGOLA DI VETRINA (§26.59, direttiva 05/10/2026 — ripristina il gate STRETTO e
 * corregge la §26.47/§26.48 del 04/10/2026): in vetrina entra SOLO una riga con il
 * nome di un istituto REALE risolto per anagrafica — `school_name` passato dal gate
 * `nomeIstituto.ts`, registro scolastico per codice meccanografico, denominazione
 * CERTIFICATA dal codice meccanografico statale (§26.81) oppure nome
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
 * REGOLA FERREA DELLA SCADENZA (§26.71, direttiva 16/10/2026; orizzonte §26.75,
 * 22/10/2026): la vetrina è fatta di OPPORTUNITÀ — senza una `expiration_date`
 * dichiarata, non ancora passata e DENTRO I 30 GIORNI la riga NON entra
 * (`eOpportunitaConScadenza`). Le pagine di archivio, i regolamenti e gli indici
 * di classi di concorso che la fonte non data restano fuori: grazie alla vecchia
 * finestra dei 60 giorni entravano in bacheca come «Scadenza n/d» e gonfiavano il
 * conto degli avvisi attivi senza essere candidabili. Lo stesso vale per le
 * «scadenze» che in realtà sono la FINE di un incarico annuale (2027): sembravano
 * opportunità lunghissime e restavano verdi per mesi.
 *
 * TITOLO UTILE (§26.76, 22/10/2026): un titolo composto dalla sola riga di
 * pubblicazione («PUBBLICATO IL 18/10/2026») non descrive nulla e non entra in
 * vetrina (`eTitoloSoloData` in `titoloBoard.ts`). La denominazione della scuola
 * ricavata dal titolo segue invece `nomeScuolaDaTitolo` (stesso modulo): segmenti
 * forti, poi teste d'istituto accorciate, sempre filtrate dal gate
 * `nomeIstitutoPresentabile` — mai un codice amministrativo al posto del nome.
 */

import { eOpportunitaConScadenza, GIORNI_FINESTRA_SENZA_SCADENZA } from './scadenza.ts';
import { nomeScuolaBoard, nomeScuolaRiga } from './nomeScuolaRiga.ts';
import { eTitoloSoloData, nomeScuolaDaTitolo } from './titoloBoard.ts';
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

/**
 * Diversità geografica delle schermate (§26.72): vive in `diversificaProvince.ts`
 * dal §26.76, per tenere questo modulo sotto le 250 righe del gate strutturale.
 * Si ri-esporta perché il tabellone e i suoi test la importino da un solo modulo.
 */
export { diversificaProvince } from './diversificaProvince.ts';

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

export function titoloLeggibile(titolo?: string | null): string | null {
  const pulito = pulisciTitoloAvviso(titolo, null);
  return pulito && pulito !== 'Avviso ufficiale' ? pulito : null;
}

/**
 * Nome d'istituto ricavato dal titolo (ultimo ripiego, dopo i dati certi).
 * La strategia vive in `titoloBoard.ts` (segmenti + teste d'istituto); qui resta
 * l'API storica usata dal tabellone e dalle verifiche.
 */
export function scuolaDaTitolo(titolo?: string | null): string | null {
  return nomeScuolaDaTitolo(titolo);
}

// La risoluzione del nome (gate §26.59 + denominazione certificata §26.81) vive in
// `nomeScuolaRiga.ts` dal 22/10/2026: `liveBoard.ts` è il gate della vetrina e sta
// al limite di 250 righe del gate strutturale. Si ri-esporta perché il tabellone e
// i suoi test la importino da un solo modulo.
export {
  nomeGrezzoDaBando,
  nomeScuolaBoard,
  nomeScuolaRiga,
  type NomeScuolaBoard,
} from './nomeScuolaRiga.ts';

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

    // TITOLO VUOTO (§26.76, 22/10/2026): «PUBBLICATO IL 18/10/2026» non descrive
    // l'opportunità — in bacheca occuperebbe una schermata senza dire niente.
    // La riga resta nel database (e nelle liste interne): qui non entra.
    if (eTitoloSoloData(riga.title)) continue;

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


/**
 * ScuoleRadar.it — Dipartimento Radar · LETTURA della bacheca «Radar Live».
 *
 * La bacheca pubblica non ha un tetto di prodotto: mostra TUTTI gli avvisi
 * attivi d'Italia. Supabase/PostgREST però non consegna più di `max-rows`
 * righe per richiesta, quindi una lettura singola tronca in silenzio tutto ciò
 * che sta oltre il tetto: con l'ordinamento per pubblicazione decrescente sono
 * proprio le righe più vecchie — quelle che il lettore non sospetta di perdere.
 * Qui la lettura è a PAGINE: si chiede la prima, poi si continua finché il
 * tabellone non copre tutto; la fine la dichiara la lettura, non la si presume.
 *
 * Regole:
 *  1. si chiedono pagine contigue larghe `RIGHE_PER_PAGINA_QUERY`
 *     (`intervalloPagina`), mai affettate lato client: la fetta la fa PostgREST;
 *  2. l'offset avanza di quante righe il server ha DAVVERO consegnato, non di
 *     quante ne sono state chieste: con un `max-rows` server più basso (500)
 *     avanzare di 1.000 salterebbe le righe in mezzo — di nuovo un troncamento
 *     silenzioso, solo più difficile da vedere;
 *  3. la sentinella di fine è una pagina VUOTA — non una pagina «corta»: una
 *     pagina corta è la normalità di un server che pagina meno di noi. Quando
 *     però è disponibile il conteggio esatto degli avvisi (`attese`), la lettura
 *     si ferma appena lo raggiunge: nessuna richiesta di troppo;
 *  4. le righe già viste non entrano due volte (`chiave`, di norma l'id): con un
 *     ordinamento non totalizzabile lato database la paginazione può ripetere una
 *     riga — il tabellone non deve mostrarla due volte;
 *  5. `MAX_PAGINE_LETTURA` è una GUARDIA ANTI-ANELLO, non un tetto di prodotto:
 *     se si supera, la lettura restituisce quello che ha e lo dichiara
 *     (`esaustiva: false`) invece di girare all'infinito;
 *  6. se una pagina non aggiunge righe nuove (server che ignora l'offset) la
 *     lettura si ferma e lo dichiara esaustiva: false — mai un ciclo infinito
 *     per una risposta che non avanza.
 *
 * Modulo PURO e isomorfo: non conosce Supabase, riceve la funzione di lettura
 * (`chiediPagina`) e la chiave di riga. Il test lo esegue con client finti.
 */

/** Righe per richiesta: il massimo che una risposta PostgREST può consegnare. */
export const RIGHE_PER_PAGINA_QUERY = 1_000;

/**
 * Guardia anti-anello (50 pagine = 50.000 avvisi attivi). Non è una scala di
 * prodotto: superarla è un'anomalia da dichiarare, mai un troncamento muto.
 */
export const MAX_PAGINE_LETTURA = 50;

/** Risposta di una pagina di lettura: la forma che serve a `leggiTutteLePagine`. */
export interface RispostaPagina<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/** Esito completo della lettura: righe, quante pagine e se il tabellone copre tutto. */
export interface LetturaBoard<T> {
  righe: T[];
  pagineLette: number;
  /** Righe già viste e quindi scartate (il tabellone non le mostra due volte). */
  duplicati: number;
  /** True solo quando non ci sono altre righe oltre quelle lette. */
  esaustiva: boolean;
  errore: string | null;
}

export interface OpzioniLettura<T> {
  /** Chiede una pagina. `da`/`a` sono inclusivi, come `.range()` di PostgREST. */
  chiediPagina: (da: number, a: number) => Promise<RispostaPagina<T>>;
  /** Identità della riga (di norma l'`id`): serve a scartare i doppioni. */
  chiave: (riga: T) => string;
  /** Conteggio esatto degli avvisi attivi, quando lo si conosce. */
  attese?: number | null;
}

/**
 * Intervallo `range` (inclusivo) che riprende dopo `giaRicevute` righe, sempre
 * largo `RIGHE_PER_PAGINA_QUERY`. L'offset parte dalle righe che il server ha
 * DAVVERO consegnato: è questo che rende la lettura completa anche quando il suo
 * `max-rows` è più basso della finestra richiesta.
 */
export function intervalloPagina(giaRicevute: number): { da: number; a: number } {
  const da = Math.max(0, Math.trunc(giaRicevute));
  return { da, a: da + RIGHE_PER_PAGINA_QUERY - 1 };
}

/**
 * Legge la bacheca a pagine fino all'esito dichiarato.
 * In caso di errore conserva le righe già lette (meglio una vetrina parziale di
 * una vetrina vuota) e restituisce il messaggio: `esaustiva` resta false, quindi
 * il `+` dell'etichetta continua a dire la verità.
 */
export async function leggiTutteLePagine<T>(opzioni: OpzioniLettura<T>): Promise<LetturaBoard<T>> {
  const { chiediPagina, chiave } = opzioni;
  const attese = typeof opzioni.attese === 'number' && opzioni.attese > 0 ? opzioni.attese : null;
  const righe: T[] = [];
  const viste = new Set<string>();
  let duplicati = 0;

  if (opzioni.attese === 0) {
    return { righe, pagineLette: 0, duplicati, esaustiva: true, errore: null };
  }

  /** Righe che il server ha già consegnato: l'offset riprende da qui. */
  let posizione = 0;

  for (let pagineLette = 1; pagineLette <= MAX_PAGINE_LETTURA; pagineLette += 1) {
    const { da, a } = intervalloPagina(posizione);
    const { data, error } = await chiediPagina(da, a);
    if (error) {
      return { righe, pagineLette: pagineLette - 1, duplicati, esaustiva: false, errore: error.message };
    }

    const pagina = data ?? [];
    if (pagina.length === 0) {
      return { righe, pagineLette, duplicati, esaustiva: true, errore: null };
    }
    posizione += pagina.length;

    let nuove = 0;
    for (const riga of pagina) {
      const k = chiave(riga);
      if (viste.has(k)) {
        duplicati += 1;
        continue;
      }
      viste.add(k);
      righe.push(riga);
      nuove += 1;
    }

    if (attese !== null && righe.length >= attese) {
      return { righe, pagineLette, duplicati, esaustiva: true, errore: null };
    }
    if (nuove === 0) {
      // Il server non sta avanzando (offset ignorato): fermarsi, e dirlo.
      return { righe, pagineLette, duplicati, esaustiva: false, errore: null };
    }
  }

  return { righe, pagineLette: MAX_PAGINE_LETTURA, duplicati, esaustiva: false, errore: null };
}

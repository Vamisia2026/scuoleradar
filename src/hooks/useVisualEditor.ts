/**
 * ScuoleRadar.it — CLICK-TO-EDIT («Visual Editor», solo sviluppo): ponte con React.
 *
 * Terzo pezzo del sistema: unisce le regole (`src/lib/visualEditorRegole.ts`) allo store per
 * rotta (`src/lib/visualEditorStore.ts`) e lo espone ai componenti come hook. In sintesi:
 *   · SCANSIONE della vista con `raccogliBlocchi` — un blocco per ogni testo CONTIGUO, quindi un
 *     paragrafo con dentro un grassetto resta una sola casella;
 *   · RIFLESSIONE degli override salvati della rotta e ripristino del default quando la modifica
 *     viene tolta;
 *   · SORVEGLIANZA del DOM (`MutationObserver` con attesa breve): i testi che compaiono dopo
 *     (filtri, tab, modali, righe del Radar) entrano nell'editor appena si disegnano;
 *   · INTERCETTAZIONE DEL CLICK (in fase di cattura, solo a editor acceso): il click su un testo
 *     apre la casella invece di navigare o aprire una modale;
 *   · API per il pannello: scrivere, ripristinare, azzerare la pagina o tutto, più l'elemento
 *     selezionato (serve all'anello di evidenziazione).
 *
 * Due accortezze sostanziali:
 *   · il DOM viene riscritto SOLO sostituendo il valore dei nodi di testo (`scriviBlocco`):
 *     nessun nodo aggiunto o rimosso, così React non trova il DOM «sorpreso»;
 *   · la chiave di un blocco è calcolata sul testo di DEFAULT del codice (in una `WeakMap` per
 *     gli elementi già toccati): l'override resta agganciato anche a testo a schermo modificato.
 *
 * L'hook è attivo solo in sviluppo (`import.meta.env.DEV`).
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { normalizzaTesto } from '@/lib/testiDomRegole';
import {
  CHIAVE_VISUAL_EDITOR_ATTIVO,
  azzeraOverrideRotta,
  azzeraTutteLeRotte,
  impostaOverrideRotta,
  overrideRotta,
  sottoscriviVisualEditor,
  type OverrideRotta,
} from '@/lib/visualEditorStore';
import { antenatoBlocco, type NodoDom } from '@/lib/visualEditorRegole';
import {
  nuovaMemoriaTocchi,
  scansionaVista,
  stessiBlocchi,
  type BloccoEditabile,
  type BloccoInPagina,
  type EsitoScansione,
  type MemoriaTocchi,
} from '@/lib/visualEditorScansione';

/** Attesa prima di riscansionare dopo una mutazione del DOM (i gruppi di scritture si uniscono). */
const ATTESA_SCANSIONE_MS = 60;

/** Tutto ciò che serve al badge e al pannello di modifica. */
export interface ApiVisualEditor {
  /** True in sviluppo: fuori da lì l'editor non esiste proprio. */
  disponibile: boolean;
  /** True se l'editor è acceso (e disponibile). */
  attivo: boolean;
  /** Accende/spegne l'editor (scelta ricordata fra i refresh). */
  impostaAttivo: (valore: boolean) => void;
  /** Rotta corrente: è la «pagina» delle modifiche. */
  rotta: string;
  /** Blocchi di testo trovati nella vista, in ordine di lettura. */
  blocchi: BloccoEditabile[];
  /** Modifiche salvate della rotta corrente (chiave → voce). */
  modifiche: OverrideRotta;
  /** Blocco selezionato (casella aperta), se c'è. */
  selezionato: BloccoEditabile | null;
  /** Elemento DOM del blocco selezionato: serve all'anello di evidenziazione. */
  elementoSelezionato: NodoDom | null;
  /** Apre/chiude la casella di un blocco. */
  seleziona: (chiave: string | null) => void;
  /** Blocco che contiene un elemento cliccato (o passato dal puntatore). */
  bloccoDaElemento: (elemento: NodoDom | null) => BloccoInPagina | null;
  /** Scrive il testo di un blocco (vuoto o uguale al default = torna al default). */
  scrivi: (chiave: string, valore: string) => void;
  /** Riporta un blocco al testo del codice. */
  ripristina: (chiave: string) => void;
  /** Riporta al codice tutti i testi di questa pagina. */
  azzeraRotta: () => void;
  /** Riporta al codice tutti i testi di tutte le pagine. */
  azzeraTutto: () => void;
}

/**
 * Editor «click-to-edit» della pagina corrente: va chiamato UNA sola volta, nel provider di
 * radice (`src/components/dev/VisualEditorProvider.tsx`). Riceve la rotta corrente invece di
 * leggerla da sé, così resta indipendente dal router e verificabile a mano.
 */
export function useVisualEditor(rotta: string): ApiVisualEditor {
  const disponibile = import.meta.env.DEV === true;
  const [voluto, setVoluto] = useLocalStorage<boolean>(CHIAVE_VISUAL_EDITOR_ATTIVO, false);
  // Doppia condizione: il flag salvato vale solo se siamo in sviluppo. In build di produzione
  // l'editor resta spento anche se il localStorage di una sessione di lavoro lo aveva acceso.
  const attivo = disponibile && voluto === true;

  // Le modifiche della rotta arrivano dallo store (fonte di verità), non da uno stato locale:
  // così restano coerenti anche con più schede aperte e con `useSyncExternalStore`.
  const modifiche = useSyncExternalStore(
    sottoscriviVisualEditor,
    () => overrideRotta(rotta),
    () => overrideRotta(rotta),
  );

  const [blocchi, setBlocchi] = useState<BloccoEditabile[]>([]);
  const [chiaveSelezionata, setChiaveSelezionata] = useState<string | null>(null);

  // Ultima scansione: elenco e indici sempre freschi (tenuti in un ref, così i click non
  // invecchiano) e re-render solo quando l'elenco cambia davvero.
  const esito = useRef<EsitoScansione>({
    blocchi: [],
    indice: new WeakMap<object, BloccoInPagina>(),
    elementi: new Map<string, NodoDom>(),
  });
  // Elementi già toccati: conservano la chiave calcolata sul testo di DEFAULT, perché adesso a
  // schermo c'è quello modificato e l'identità del blocco non deve cambiare.
  const memoria = useRef<MemoriaTocchi>(nuovaMemoriaTocchi());

  const scandisci = useCallback(() => {
    if (typeof document === 'undefined' || !document.body) return;
    const risultato = scansionaVista(
      document.body as unknown as NodoDom,
      overrideRotta(rotta),
      memoria.current,
    );
    esito.current = risultato;
    setBlocchi((precedenti) =>
      stessiBlocchi(precedenti, risultato.blocchi) ? precedenti : risultato.blocchi,
    );
  }, [rotta]);

  // Scansione iniziale + sorveglianza del DOM: filtri, tab, modali e righe che compaiono dopo
  // entrano nell'editor appena si disegnano (l'attesa breve unisce le scritture in gruppo).
  useEffect(() => {
    if (!disponibile || typeof document === 'undefined' || !document.body) return undefined;
    scandisci();
    if (typeof MutationObserver === 'undefined') return undefined; // ambienti senza osservatore: resta la scansione iniziale
    let attesa: number | null = null;
    const programma = () => {
      if (attesa !== null) return;
      attesa = window.setTimeout(() => {
        attesa = null;
        scandisci();
      }, ATTESA_SCANSIONE_MS);
    };
    const osservatore = new MutationObserver(programma);
    osservatore.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      osservatore.disconnect();
      if (attesa !== null) window.clearTimeout(attesa);
    };
  }, [disponibile, scandisci]);

  // Cambio pagina: la casella aperta non appartiene più a questa rotta.
  useEffect(() => {
    setChiaveSelezionata(null);
  }, [rotta]);

  // Click-to-edit: ascolto in fase di CATTURA, così il click apre la casella invece di far
  // navigare un link o aprire una modale. Vale solo a editor acceso e solo se il click cade
  // davvero su un blocco di testo: il resto della pagina resta usabile come sempre.
  useEffect(() => {
    if (!attivo || typeof document === 'undefined') return undefined;
    const suClic = (event: MouseEvent) => {
      const bersaglio = event.target;
      if (!(bersaglio instanceof Element)) return;
      if (bersaglio.closest('[data-sr-dev-toolbar],[data-sr-visual-editor]')) return;
      const blocco = antenatoBlocco(bersaglio as unknown as NodoDom, esito.current.indice);
      if (!blocco) return;
      event.preventDefault();
      event.stopPropagation();
      setChiaveSelezionata(blocco.chiave);
    };
    document.addEventListener('click', suClic, true);
    return () => document.removeEventListener('click', suClic, true);
  }, [attivo]);

  const bloccoDaElemento = useCallback(
    (elemento: NodoDom | null): BloccoInPagina | null =>
      antenatoBlocco(elemento, esito.current.indice),
    [],
  );

  const seleziona = useCallback((chiave: string | null) => setChiaveSelezionata(chiave), []);

  const impostaAttivo = useCallback(
    (valore: boolean) => {
      setVoluto(valore);
      if (!valore) setChiaveSelezionata(null);
    },
    [setVoluto],
  );

  const scrivi = useCallback(
    (chiave: string, valore: string) => {
      const blocco = blocchi.find((voce) => voce.chiave === chiave);
      if (!blocco) return;
      // Campo svuotato = «torna come nel codice»: un blocco senza testo uscirebbe dalla
      // scansione (servono almeno 2 lettere) e non si potrebbe più riaprire.
      const definitivo = normalizzaTesto(valore) === '' ? blocco.originale : valore;
      const alDefault = normalizzaTesto(definitivo) === normalizzaTesto(blocco.originale);
      impostaOverrideRotta(rotta, chiave, alDefault ? null : { t: blocco.originale, v: definitivo });
      scandisci();
    },
    [blocchi, rotta, scandisci],
  );

  const ripristina = useCallback(
    (chiave: string) => {
      if (impostaOverrideRotta(rotta, chiave, null)) scandisci();
    },
    [rotta, scandisci],
  );

  const azzeraRotta = useCallback(() => {
    setChiaveSelezionata(null);
    azzeraOverrideRotta(rotta);
    scandisci();
  }, [rotta, scandisci]);

  const azzeraTutto = useCallback(() => {
    setChiaveSelezionata(null);
    azzeraTutteLeRotte();
    scandisci();
  }, [scandisci]);

  const selezionato = chiaveSelezionata
    ? blocchi.find((voce) => voce.chiave === chiaveSelezionata) ?? null
    : null;
  const elementoSelezionato = selezionato
    ? esito.current.elementi.get(selezionato.chiave) ?? null
    : null;

  return {
    disponibile,
    attivo,
    impostaAttivo,
    rotta,
    blocchi,
    modifiche,
    selezionato,
    elementoSelezionato,
    seleziona,
    bloccoDaElemento,
    scrivi,
    ripristina,
    azzeraRotta,
    azzeraTutto,
  };
}


/**
 * ScuoleRadar.it — «EDITOR TESTI RAPIDO» (DEV Toolbar): ELENCO dei testi a schermo.
 *
 * Quarto pezzo del sistema dei testi, accanto a:
 *   · `src/data/editableTexts.ts`    → il DIZIONARIO (`chiave → testo di default`);
 *   · `src/lib/testiModificabili.ts` → gli OVERRIDE del dizionario (`sr_simple_text_overrides`);
 *   · `src/lib/testiInPagina.ts`     → il registro delle VISTE (quali chiavi sono a schermo).
 * Qui c'è la parte UNIVERSALE: nessun cablaggio e nessuna voce di dizionario — si scandisce il
 * DOM della pagina attiva (`testiDomNodi.ts` trova i nodi, `testiDomRegole.ts` li identifica,
 * `testiDomOverride.ts` conserva gli override scritti a mano) e si pubblica l'elenco che
 * l'editor mostra, con gli override GIÀ applicati e i default pronti per il reset.
 *
 * Scrivendo dall'editor l'override va in `localStorage: sr_dom_text_overrides`
 * (`chiave → { t, v }`) e la scansione successiva RISCRIVE il nodo: effetto immediato, nessun
 * reload e nessun codice da generare. Se React ri-renderizza e rimette la copy del codice,
 * l'override viene riapplicato — è l'hook `src/hooks/useTestiDom.ts` a osservare il DOM
 * (`MutationObserver`) e a richiamare qui.
 *
 * Contratto (identico allo store degli override): snapshot a riferimento STABILE per
 * `useSyncExternalStore` e notifica agli ascoltatori SOLO al cambiamento reale.
 *
 * Modulo PURO e isomorfo: nessun React, nessun accesso al `document` globale.
 */
import { azzeraOverrideDom, impostaOverrideDom, overrideDom } from './testiDomOverride.ts';
import { raccogli, scriviTesto, type NodoDom, type OccorrenzaDom } from './testiDomNodi.ts';
import { chiaveTestoDom, impronta, normalizzaTesto } from './testiDomRegole.ts';

export type { NodoDom } from './testiDomNodi.ts';

/** Un blocco di testo trovato (ed eventualmente riscritto) nella vista attiva. */
export interface TestoDomRilevato {
  /** Identità stabile dell'occorrenza: `p#1a2b3c#0` = tag + impronta del testo + n° occorrenza. */
  chiave: string;
  /** Tag del genitore del nodo di testo (`H2`, `P`, `LI`…). */
  tag: string;
  /** Punto della pagina in parole: «sezione · Paragrafo». */
  dove: string;
  /** Testo di default del codice (prima di ogni override). */
  originale: string;
  /** Testo visibile ADESSO: l'override se c'è, altrimenti l'originale. */
  testo: string;
  /** True se il testo scritto a mano è ancora attivo. */
  modificato: boolean;
}

/** Snapshot dell'elenco a schermo: riferimento STABILE finché la scansione non cambia nulla. */
let snapshot: TestoDomRilevato[] = [];
const ascoltatori = new Set<() => void>();

/**
 * Testo ORIGINALE delle occorrenze già toccate da un override. Serve a due cose: rimettere il
 * testo del codice al reset e NON perdere l'identità di un nodo il cui `nodeValue` ormai
 * contiene il testo scritto a mano (altrimenti la chiave cambierebbe e l'override si perderebbe).
 */
const toccati = new WeakMap<object, { chiave: string; originale: string }>();

/** Testi elencati adesso dall'editor (snapshot stabile per `useSyncExternalStore`). */
export function testiDomInPagina(): TestoDomRilevato[] {
  return snapshot;
}

/** Iscrive un ascoltatore del cambio elenco (ritorna la funzione di annullamento). */
export function sottoscriviTestiDom(ascoltatore: () => void): () => void {
  ascoltatori.add(ascoltatore);
  return () => {
    ascoltatori.delete(ascoltatore);
  };
}

/** Notifica SOLO quando l'elenco (o uno dei suoi testi) cambia davvero: niente render inutili. */
function pubblica(prossimo: TestoDomRilevato[]): void {
  const uguali =
    snapshot.length === prossimo.length &&
    snapshot.every(
      (voce, i) =>
        voce.chiave === prossimo[i].chiave &&
        voce.testo === prossimo[i].testo &&
        voce.originale === prossimo[i].originale &&
        voce.dove === prossimo[i].dove,
    );
  if (uguali) return;
  snapshot = prossimo;
  for (const ascoltatore of [...ascoltatori]) ascoltatore();
}

/**
 * Scansiona la vista attiva, APPLICA gli override salvati e pubblica l'elenco per l'editor.
 * L'ordine è quello di lettura (document order): la lista non si rimescola navigando.
 */
export function scansionaTestiDom(radice: NodoDom): TestoDomRilevato[] {
  const raccolte: OccorrenzaDom[] = [];
  raccogli(radice, raccolte);

  const occorrenze = new Map<string, number>();
  const override = overrideDom();
  const prossimo: TestoDomRilevato[] = [];

  for (const { nodo, tag, dove } of raccolte) {
    const noto = toccati.get(nodo);
    const originale = noto?.originale ?? normalizzaTesto(nodo.nodeValue ?? '');
    const base = `${tag}#${impronta(originale)}`;
    const occorrenza = occorrenze.get(base) ?? 0;
    occorrenze.set(base, occorrenza + 1);

    const chiave = noto?.chiave ?? chiaveTestoDom(tag, originale, occorrenza);
    const salvato = override[chiave];
    if (salvato) {
      scriviTesto(nodo, salvato.v);
      toccati.set(nodo, { chiave, originale });
      prossimo.push({ chiave, tag, dove, originale, testo: salvato.v, modificato: true });
    } else {
      // Nessun override (o appena tolto): il nodo mostra il testo del codice, subito.
      if (noto) {
        scriviTesto(nodo, noto.originale);
        toccati.delete(nodo);
      }
      prossimo.push({ chiave, tag, dove, originale, testo: originale, modificato: false });
    }
  }

  pubblica(prossimo);
  return prossimo;
}

/**
 * Scrive (o cancella, riscrivendo il testo di default) l'override di UNA occorrenza a schermo.
 * Chi chiama deve poi ricalcolare il DOM con una nuova `scansionaTestiDom`: lo fa l'hook
 * `src/hooks/useTestiDom.ts`, così il testo cambia all'istante e resta agganciato.
 */
export function impostaTestoDom(chiave: string, valore: string): void {
  const voce = snapshot.find((t) => t.chiave === chiave);
  if (!voce) return; // occorrenza non più a schermo: niente da scrivere
  const alDefault = normalizzaTesto(valore) === '' || normalizzaTesto(valore) === voce.originale;
  impostaOverrideDom(chiave, alDefault ? null : { t: voce.originale, v: valore });
}

/** Riporta tutti i testi ai default del codice: svuota lo store, i nodi tornano alla scansione dopo. */
export function azzeraTestiDom(): void {
  azzeraOverrideDom();
}

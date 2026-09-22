/**
 * Modulistica · Archivio — navigazione dell'albero del catalogo.
 *
 * Tipi e funzioni PURE dell'albero (macroarea → sottocategorie → documenti):
 * risoluzione del livello corrente dal percorso di id, nomi per il breadcrumb e
 * appiattimento del catalogo per la ricerca globale. Estratte da
 * `EsploraArchivio.tsx`.
 */
import {
  type DocumentoModulistica,
  type MacroAreaModulistica,
  type SottoCategoriaModulistica,
} from '@/data/moduli';

export interface Livello {
  sotto: SottoCategoriaModulistica[];
  documenti: DocumentoModulistica[];
}

/** Risolve il livello corrente partendo dalla macroarea e dal percorso di id. */
export function livelloCorrente(area: MacroAreaModulistica | null, percorso: string[]): Livello {
  let livello: Livello = { sotto: area?.sotto ?? [], documenti: [] };
  for (const id of percorso) {
    const figlio = livello.sotto.find((s) => s.id === id);
    if (!figlio) break;
    livello = { sotto: figlio.sotto ?? [], documenti: figlio.documenti ?? [] };
  }
  return livello;
}

/** Nomi del percorso (macroarea + sottocartelle) per il breadcrumb. */
export function nomiPercorso(area: MacroAreaModulistica | null, percorso: string[]): string[] {
  const nomi: string[] = area ? [area.nome] : [];
  let livello: Livello = { sotto: area?.sotto ?? [], documenti: [] };
  for (const id of percorso) {
    const figlio = livello.sotto.find((s) => s.id === id);
    if (!figlio) break;
    nomi.push(figlio.nome);
    livello = { sotto: figlio.sotto ?? [], documenti: figlio.documenti ?? [] };
  }
  return nomi;
}
export interface DocConPercorso {
  doc: DocumentoModulistica;
  percorso: string[];
}
/** Raccoglie tutti i documenti terminali del catalogo con il loro percorso (macroarea › cartella). */
export function raccogliDocumenti(aree: MacroAreaModulistica[]): DocConPercorso[] {
  const risultati: DocConPercorso[] = [];
  const visita = (nodi: SottoCategoriaModulistica[], percorso: string[]) => {
    for (const n of nodi) {
      const nuovo = [...percorso, n.nome];
      for (const doc of n.documenti ?? []) risultati.push({ doc, percorso: nuovo });
      if (n.sotto) visita(n.sotto, nuovo);
    }
  };
  for (const area of aree) visita(area.sotto, [area.nome]);
  return risultati;
}

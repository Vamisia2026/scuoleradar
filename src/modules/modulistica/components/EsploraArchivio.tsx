import { useMemo, useState } from 'react';
import { FolderOpen } from 'lucide-react';
import {
  macroAreeModulistica,
  type DocumentoModulistica,
  type MacroAreaModulistica,
  type SottoCategoriaModulistica,
} from '@/data/moduli';
import { GrigliaSottocategorie } from './esploraArchivio/GrigliaSottocategorie';
import { RisultatiRicerca } from './esploraArchivio/RisultatiRicerca';
import {
  livelloCorrente,
  nomiPercorso,
  raccogliDocumenti,
} from './esploraArchivio/alberoCatalogo';
import { correggiToken, matchaFuzzy, normalizzaTesto } from './esploraArchivio/ricercaFuzzy';

/** Numero di sottocategorie visibili per pagina (griglia 3×5 → 15). */
const PER_PAGINA = 15;

interface EsploraArchivioProps {
  macroArea: MacroAreaModulistica | null;
  /** Query COMMESSA della ricerca (si aggiorna solo su invio). */
  filtro?: string;
  /** "Labor Illusion": true durante la consultazione (~2s) dopo l'invio della ricerca. */
  consultando?: boolean;
  /** Modalità compatta: riduce i margini interni (ricerca in corso). */
  compatto?: boolean;
  /** Apre un documento terminale (profilo completo → generazione cache-first). */
  onApriDocumento: (doc: DocumentoModulistica, percorso: string[]) => void;
}







/**
 * Contenitore rettangolare principale dell'archivio (navigazione a matrioska):
 * si procede SOLO di sottocategoria in sottocategoria (griglia 3×5 paginata).
 * I documenti finali compaiono esclusivamente nella cartella finale
 * (1 solo modulo per cartella).
 */
export function EsploraArchivio({
  macroArea,
  filtro,
  consultando = false,
  compatto = false,
  onApriDocumento,
}: EsploraArchivioProps) {
  const [percorso, setPercorso] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);

  const livello = useMemo(() => livelloCorrente(macroArea, percorso), [macroArea, percorso]);
  const breadcrumb = useMemo(() => nomiPercorso(macroArea, percorso), [macroArea, percorso]);

  const documentiCatalogo = useMemo(() => raccogliDocumenti(macroAreeModulistica), []);

  /** Ricerca FUZZY: documenti pertinenti in tutto il catalogo, tollerante ai refusi. */
  const risultatiRicerca = useMemo(() => {
    const q = normalizzaTesto(filtro ?? '').trim();
    if (q.length < 2) return [];
    const parole = q.split(/\s+/).filter((w) => w.length >= 2);
    return documentiCatalogo
      .map(({ doc, percorso: via }) => {
        const nome = normalizzaTesto(doc.nome);
        const descrizione = normalizzaTesto(doc.descrizione);
        const profilo = normalizzaTesto(Object.values(doc.profilo ?? {}).join(' '));
        const percorsoTesto = normalizzaTesto(via.join(' '));
        let score = 0;
        for (const p of parole) {
          if (matchaFuzzy(p, nome)) score += 3;
          if (matchaFuzzy(p, descrizione)) score += 2;
          if (matchaFuzzy(p, profilo)) score += 2;
          if (matchaFuzzy(p, percorsoTesto)) score += 1;
        }
        return { doc, percorso: via, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [documentiCatalogo, filtro]);

  /** Refusi corretti dal fuzzy matching: es. ricerca "sosegno" → mostriamo "sostegno". */
  const refusiCorretti = useMemo(() => {
    if (risultatiRicerca.length === 0) return [];
    const q = normalizzaTesto(filtro ?? '').trim();
    const parole = q.split(/\s+/).filter((w) => w.length >= 2);
    const corretti: { originale: string; corretto: string }[] = [];
    const top = risultatiRicerca[0];
    const testi = [
      normalizzaTesto(top.doc.nome),
      normalizzaTesto(top.doc.descrizione),
      normalizzaTesto(Object.values(top.doc.profilo ?? {}).join(' ')),
      normalizzaTesto(top.percorso.join(' ')),
    ];
    for (const p of parole) {
      // Se da qualche parte nel catalogo esiste un match esatto, NON è un refuso.
      const esattoNelCatalogo = documentiCatalogo.some(({ doc, percorso: via }) => {
        const campi = [
          normalizzaTesto(doc.nome),
          normalizzaTesto(doc.descrizione),
          normalizzaTesto(Object.values(doc.profilo ?? {}).join(' ')),
          normalizzaTesto(via.join(' ')),
        ];
        return campi.some((x) => x.includes(p));
      });
      if (esattoNelCatalogo) continue;
      const corretto = correggiToken(p, ...testi);
      if (corretto && corretto !== p) corretti.push({ originale: p, corretto });
    }
    return corretti.slice(0, 3);
  }, [risultatiRicerca, documentiCatalogo, filtro]);

  const filtroAttivo = normalizzaTesto(filtro ?? '').trim().length >= 2;

  const totalePagine = Math.max(1, Math.ceil(livello.sotto.length / PER_PAGINA));
  const paginaSicura = Math.min(pagina, totalePagine);
  const sottoPagina = livello.sotto.slice((paginaSicura - 1) * PER_PAGINA, paginaSicura * PER_PAGINA);

  const scendi = (sotto: SottoCategoriaModulistica) => {
    const ultimo = percorso[percorso.length - 1];
    if (ultimo === sotto.id) return; // evita doppio click duplicato
    setPagina(1);
    setPercorso((prev) => [...prev, sotto.id]);
  };

  const sali = (indice: number) => {
    setPagina(1);
    setPercorso((prev) => prev.slice(0, indice));
  };

  if (filtroAttivo) {
    return (
      <RisultatiRicerca
        risultatiRicerca={risultatiRicerca}
        refusiCorretti={refusiCorretti}
        consultando={consultando}
        filtro={filtro}
        compatto={compatto}
        onApriDocumento={onApriDocumento}
      />
    );
  }

  if (!macroArea) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary-100 p-12 text-center">
        <FolderOpen className="h-10 w-10 text-primary-200" />
        <p className="max-w-md text-sm leading-relaxed text-primary-500">
          Scegli una macroarea qui sopra (Sostegno, Infanzia, Primaria…) e apri la cartella che ti
          serve: il contenitore mostrerà le sottocategorie e, scendendo, il documento esatto.
        </p>
      </div>
    );
  }
  return (
    <GrigliaSottocategorie
      macroArea={macroArea}
      percorso={percorso}
      breadcrumb={breadcrumb}
      livello={livello}
      sottoPagina={sottoPagina}
      totalePagine={totalePagine}
      paginaSicura={paginaSicura}
      setPagina={setPagina}
      scendi={scendi}
      sali={sali}
      compatto={compatto}
      onApriDocumento={onApriDocumento}
    />
  );
}


import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, FileText, FolderOpen, House, Loader2, SearchX } from 'lucide-react';
import {
  macroAreeModulistica,
  type DocumentoModulistica,
  type MacroAreaModulistica,
  type SottoCategoriaModulistica,
} from '@/data/moduli';

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

interface Livello {
  sotto: SottoCategoriaModulistica[];
  documenti: DocumentoModulistica[];
}

/** Risolve il livello corrente partendo dalla macroarea e dal percorso di id. */
function livelloCorrente(area: MacroAreaModulistica | null, percorso: string[]): Livello {
  let livello: Livello = { sotto: area?.sotto ?? [], documenti: [] };
  for (const id of percorso) {
    const figlio = livello.sotto.find((s) => s.id === id);
    if (!figlio) break;
    livello = { sotto: figlio.sotto ?? [], documenti: figlio.documenti ?? [] };
  }
  return livello;
}

/** Nomi del percorso (macroarea + sottocartelle) per il breadcrumb. */
function nomiPercorso(area: MacroAreaModulistica | null, percorso: string[]): string[] {
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

interface DocConPercorso {
  doc: DocumentoModulistica;
  percorso: string[];
}

/** Normalizza il testo per la ricerca: minuscole e senza accenti. */
function normalizzaTesto(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

/** Distanza di Levenshtein (iterativa, O(n·m)) per la tolleranza ai refusi. */
function distanzaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const righe = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prec = righe[0];
    righe[0] = j;
    for (let i = 1; i <= m; i++) {
      const salva = righe[i];
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      righe[i] = Math.min(righe[i] + 1, righe[i - 1] + 1, prec + costo);
      prec = salva;
    }
  }
  return righe[m];
}

/** Soglia di tolleranza ai refusi: 1 carattere per le parole corte, 2 per le lunghe. */
function sogliaRefuso(token: string): number {
  return token.length <= 4 ? 1 : 2;
}

/** True se il token trova un match esatto o fuzzy (parola a distanza ≤ soglia) nel testo. */
function matchaFuzzy(token: string, testo: string): boolean {
  if (testo.includes(token)) return true;
  const parole = testo.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
  return parole.some((parola) => distanzaLevenshtein(token, parola) <= sogliaRefuso(token));
}

/** Parola più vicina al token tra i testi dati (per il feedback "abbiamo corretto il refuso"). */
function correggiToken(token: string, ...testi: string[]): string | null {
  let migliore: string | null = null;
  let distMigliore = Number.POSITIVE_INFINITY;
  for (const t of testi) {
    for (const parola of t.split(/[^a-z0-9]+/)) {
      if (parola.length < 2) continue;
      const d = distanzaLevenshtein(token, parola);
      if (d <= sogliaRefuso(token) && d < distMigliore) {
        distMigliore = d;
        migliore = parola;
      }
    }
  }
  return migliore;
}

/** Raccoglie tutti i documenti terminali del catalogo con il loro percorso (macroarea › cartella). */
function raccogliDocumenti(aree: MacroAreaModulistica[]): DocConPercorso[] {
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

/** Card verticale compatta di un modulo (icona + titolo + descrizione + CTA in basso). */
function CardModulo({
  doc,
  percorso,
  onApri,
  index,
}: {
  doc: DocumentoModulistica;
  percorso: string[];
  onApri: (doc: DocumentoModulistica, percorso: string[]) => void;
  index: number;
}) {
  return (
    <div
      className="card-onda flex flex-col rounded-xl border border-primary-100 bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-300 hover:shadow-card"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
          <FileText className="h-5 w-5" />
        </span>
        <span className="shrink-0 rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
          {doc.tipo}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-bold leading-snug text-primary-800">{doc.nome}</p>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-primary-500">{doc.descrizione}</p>
      {percorso.length > 0 && (
        <p className="mt-1.5 truncate text-[11px] font-semibold text-primary-400">📁 {percorso.join(' › ')}</p>
      )}
      <button
        type="button"
        onClick={() => onApri(doc, percorso)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-secondary-500 px-4 py-2.5 text-xs font-bold text-white shadow-soft transition hover:bg-secondary-600"
      >
        <FileText className="h-3.5 w-3.5" />
        Apri documento
      </button>
    </div>
  );
}

/** Skeleton della consultazione archivio ("Labor Illusion": micro-spinner + card in caricamento). */
function SkeletonConsultazione() {
  return (
    <div>
      <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-primary-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Consultazione archivio in corso...
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col rounded-xl border border-primary-100 bg-slate-50 p-4">
            <div className="h-10 w-10 animate-pulse rounded-lg bg-primary-100" />
            <div className="mt-3 h-3.5 w-3/4 animate-pulse rounded bg-primary-100" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-primary-100" />
            <div className="mt-1 h-3 w-2/3 animate-pulse rounded bg-primary-100" />
            <div className="mt-4 h-8 w-full animate-pulse rounded-xl bg-secondary-100" />
          </div>
        ))}
      </div>
    </div>
  );
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
      <div className={`animate-fade-in ${compatto ? 'mt-2' : 'mt-4'}`}>
        {consultando ? (
          <SkeletonConsultazione />
        ) : risultatiRicerca.length === 0 ? (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-primary-100 p-10 text-center">
            <SearchX className="h-8 w-8 text-primary-200" />
            <p className="max-w-md text-sm leading-relaxed text-primary-500">
              Nessun modulo corrisponde a «{filtro}». Prova con parole più generiche, ad esempio
              «sostegno», «PEI», «delega», «permesso».
            </p>
          </div>
        ) : (
          <>
            <p className="text-center text-xs font-bold uppercase tracking-wide text-primary-400">
              Ricerca nell&apos;archivio · {risultatiRicerca.length} moduli trovati
            </p>
            {refusiCorretti.length > 0 && (
              <p className="mt-1 text-left text-xs font-medium text-primary-400">
                Mostro i risultati per{' '}
                <span className="font-semibold text-primary-600">
                  {refusiCorretti.map((r) => r.corretto).join(', ')}
                </span>{' '}
                (ricerca originale: {refusiCorretti.map((r) => r.originale).join(', ')})
              </p>
            )}
            <div
              className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${compatto ? 'mt-3' : 'mt-4'}`}
            >
              {risultatiRicerca.map(({ doc, percorso }, index) => (
                <CardModulo
                  key={doc.id}
                  doc={doc}
                  percorso={percorso}
                  onApri={onApriDocumento}
                  index={index}
                />
              ))}
            </div>
          </>
        )}
      </div>
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
    <div className={`animate-fade-in ${compatto ? 'mt-2' : 'mt-4'}`}>
      {/* Breadcrumb + tasto casa */}
      <nav className="flex flex-wrap items-center gap-1 text-xs" aria-label="Percorso">
        <button
          type="button"
          onClick={() => sali(0)}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary-500 transition hover:bg-primary-50 hover:text-primary-700"
          title="Torna alle macroaree"
        >
          <House className="h-3.5 w-3.5" />
          Macroaree
        </button>
        {breadcrumb.map((nome, i) => (
          <span key={`${i}-${nome}`} className="flex items-center gap-1">
            <span className="text-primary-300">/</span>
            {i === breadcrumb.length - 1 ? (
              <span className="rounded-lg bg-primary-50 px-2 py-1 font-bold text-primary-800">{nome}</span>
            ) : (
              <button
                type="button"
                onClick={() => sali(i)}
                className="rounded-lg px-2 py-1 font-medium text-primary-500 transition hover:bg-primary-50 hover:text-primary-700"
              >
                {nome}
              </button>
            )}
          </span>
        ))}
      </nav>

      {/* Descrizione della macroarea (visibile al primo livello, prima delle cartelle) */}
      {percorso.length === 0 && macroArea.descrizione && (
        <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm leading-relaxed text-primary-600">
          {macroArea.descrizione}
        </div>
      )}

      {/* Griglia sottocategorie 3×3 con paginazione */}
      {sottoPagina.length > 0 && (
        <div className={compatto ? 'mt-2' : 'mt-4'}>
          <div
            className={
              compatto ? 'grid grid-cols-2 gap-2.5 lg:grid-cols-3' : 'grid grid-cols-2 gap-3 lg:grid-cols-3'
            }
          >
            {sottoPagina.map((sotto) => (
              <button
                key={sotto.id}
                type="button"
                title="Doppio click per aprire la cartella"
                onClick={() => scendi(sotto)}
                onDoubleClick={() => scendi(sotto)}
                className={`group flex items-start gap-3 rounded-xl border border-primary-100 bg-slate-50 text-left transition hover:border-primary-300 hover:bg-white hover:shadow-soft ${
                  compatto ? 'p-3' : 'p-4'
                }`}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 transition group-hover:bg-primary-500 group-hover:text-white">
                  <FolderOpen className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-primary-800">
                    {sotto.nome}
                  </span>
                  {sotto.descrizione && (
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-primary-500">
                      {sotto.descrizione}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Frecce di paginazione */}
          {totalePagine > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Pagina precedente"
                disabled={paginaSicura <= 1}
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-primary-500">
                Pagina {paginaSicura} di {totalePagine}
              </span>
              <button
                type="button"
                aria-label="Pagina successiva"
                disabled={paginaSicura >= totalePagine}
                onClick={() => setPagina((p) => Math.min(totalePagine, p + 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-primary-200 bg-white text-primary-600 transition hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}


      {/* Cartella finale: i moduli compaiono SOLO in fondo all'albero */}
      {sottoPagina.length === 0 && livello.documenti.length > 0 && (
        <div className={compatto ? 'mt-3' : 'mt-6'}>
          <p className="text-center text-xs font-bold uppercase tracking-wide text-primary-400">
            Cartella finale · moduli disponibili
          </p>
          <div
            key={`cartella-${percorso.join('/')}`}
            className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${compatto ? 'mt-3' : 'mt-4'}`}
          >
            {livello.documenti.map((doc, index) => (
              <CardModulo
                key={doc.id}
                doc={doc}
                percorso={breadcrumb}
                onApri={onApriDocumento}
                index={index}
              />
            ))}
          </div>
        </div>
      )}

      {sottoPagina.length === 0 && livello.documenti.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-primary-100 p-8 text-left text-sm text-primary-400">
          Questa cartella è vuota. Torna indietro con il breadcrumb per scegliere un altro percorso.
        </p>
      )}
    </div>
  );
}


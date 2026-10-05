/**
 * ScuoleRadar.it — AREE DISCIPLINARI (modulo PURO, matrice curata).
 *
 * Le materie non sono caselle isolate: tra due discipline vicine esiste un ponte
 * (metodologico o tematico) che vale più di uno zero e meno di un match pieno.
 * Questo modulo riconosce le AREE di un testo (denominazione di classe, materia
 * dell'avviso, parola chiave scritta dall'utente) e i PONTI fra aree: è la base
 * condivisa delle Modali 2 (classi di concorso) e 3 (parole chiave), così la
 * stessa vicinanza disciplinare non viene reinterpretata due volte.
 *
 * È una matrice CORTA e ispezionabile di co-occorrenze di dominio — «Digitale» ↔
 * «Intelligenza artificiale», «Letteratura» ↔ «Teatro», «Arte» ↔ «Digitale»,
 * «Scientifico» ↔ «Digitale» — non un motore semantico (`docs/RADAR_ROADMAP_V2.md`
 * §4). Le «parole» sono RADICI (singolare/plurale combaciano senza tavole di
 * sinonimi); le sigle (`IA`/`AI`) valgono solo in MAIUSCOLO, altrimenti la
 * preposizione «ai» diventerebbe intelligenza artificiale.
 */

/** Livello del ponte fra due aree: temi che si toccano, mai un'equivalenza. */
export type LivelloPonte = 'affine' | 'contaminata';

/** Ponte riconosciuto fra due aree disciplinari. */
export interface PonteAree {
  livello: LivelloPonte;
  /** Etichetta leggibile («Digitale ↔ Intelligenza artificiale»). */
  etichetta: string;
}

/** Lingue straniere insegnabili: radice del token → nome leggibile. */
const LINGUE: Readonly<Record<string, string>> = {
  ingles: 'Inglese',
  frances: 'Francese',
  spagnol: 'Spagnolo',
  tedesc: 'Tedesco',
};

interface AreaDisciplinare {
  id: string;
  etichetta: string;
  /** Radici di parola o frasi normalizzate che identificano l'area. */
  parole: readonly string[];
  /** Sigle valide solo in MAIUSCOLO: «ai» minuscolo è una preposizione, «AI» è IA. */
  sigle?: RegExp;
}

const AREE: readonly AreaDisciplinare[] = [
  {
    id: 'lingue',
    etichetta: 'Lingue straniere',
    parole: ['lingu', 'linguistic', 'ingles', 'frances', 'spagnol', 'tedesc', 'clil', 'madrelingu'],
  },
  {
    id: 'digitale',
    etichetta: 'Digitale',
    parole: ['digital', 'informatic', 'coding', 'robotic', 'stem', 'tecnolog', 'maker', 'multimedial'],
  },
  {
    id: 'ia',
    etichetta: 'Intelligenza artificiale',
    parole: ['intelligenza artificial', 'machine learning', 'algoritm', 'llm'],
    sigle: /\b(?:IA|AI)\b/,
  },
  {
    id: 'umanistico',
    etichetta: 'Umanistico-letterario',
    parole: ['letteratur', 'letterari', 'letterat', 'italian', 'latin', 'grec', 'stori', 'filosof', 'grammatic'],
  },
  {
    id: 'teatro',
    etichetta: 'Teatro e arti performative',
    parole: ['teatr', 'recitazion', 'drammatizzazion', 'scenograf', 'spettacol'],
  },
  {
    id: 'arte',
    etichetta: 'Arte, musica e creatività',
    parole: ['art', 'artist', 'artistic', 'pittur', 'fotograf', 'creativ', 'music', 'orchestr', 'coro'],
  },
  {
    id: 'scientifico',
    etichetta: 'Scientifico',
    parole: ['matematic', 'fisic', 'chimic', 'scienz', 'biolog', 'scientific', 'laborator'],
  },
];

/** Ponte fra aree: la coppia è confrontata in entrambi i versi. */
interface PonteTematico {
  da: string;
  a: string;
  livello: LivelloPonte;
  etichetta: string;
}

const PONTI: readonly PonteTematico[] = [
  { da: 'digitale', a: 'ia', livello: 'affine', etichetta: 'Digitale ↔ Intelligenza artificiale' },
  { da: 'arte', a: 'digitale', livello: 'affine', etichetta: 'Arte ↔ Digitale' },
  { da: 'digitale', a: 'scientifico', livello: 'affine', etichetta: 'Scientifico ↔ Digitale' },
  { da: 'teatro', a: 'umanistico', livello: 'contaminata', etichetta: 'Letteratura ↔ Teatro' },
];


/** Etichetta leggibile di un'area (`etichettaArea('ia')` → «Intelligenza artificiale»). */
export function etichettaArea(id: string): string {
  return AREE.find((a) => a.id === id)?.etichetta ?? id;
}

/** Etichette leggibili e ordinate di un insieme di aree. */
export function etichetteAree(aree: Iterable<string>): string[] {
  return [...new Set(aree)].map(etichettaArea).sort((a, b) => a.localeCompare(b));
}

/** Minuscole, senza accenti, solo lettere/numeri separati da spazio singolo. */
export function normalizzaTesto(testo?: string | null): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Radice grezza di un token (vocale finale caduta): «digitale»/«digitali» → «digital». */
function radice(token: string): string {
  return token.length >= 4 && /[aeiou]$/.test(token) ? token.slice(0, -1) : token;
}

/** Radici dei token di un testo (per il confronto con le «parole» delle aree). */
export function radiciDi(testo?: string | null): Set<string> {
  return new Set(normalizzaTesto(testo).split(' ').filter(Boolean).map(radice));
}

/** Lingue riconosciute in un testo (nomi leggibili, es. `Inglese`). */
export function lingueDi(testo?: string | null): Set<string> {
  const out = new Set<string>();
  for (const token of radiciDi(testo)) {
    const lingua = LINGUE[token];
    if (lingua) out.add(lingua);
  }
  return out;
}

/**
 * Aree disciplinari riconosciute in un testo. Le «parole» sono RADICI (così
 * singolare/plurale combaciano); le frasi contengono uno spazio e si cercano nel
 * testo normalizzato; le sigle valgono solo in maiuscolo.
 *
 * Le radici di almeno 5 caratteri valgono anche come PREFISSO (`teatr` → «teatrale»,
 * `laborator` → «laboratorio»): la tabella resta corta senza perdere i derivati.
 * Le radici corte (3-4 caratteri: `art`, `coro`, `stem`) restano ESATTE, altrimenti
 * «articolo» diventerebbe «Arte».
 */
export function areeDi(testo?: string | null): Set<string> {
  const normalizzato = normalizzaTesto(testo);
  if (!normalizzato) return new Set();
  const tokens = radiciDi(testo);
  const elenco = [...tokens];
  const grezzo = testo ?? '';
  const out = new Set<string>();
  for (const area of AREE) {
    const presente =
      area.parole.some((p) =>
        p.includes(' ')
          ? normalizzato.includes(p)
          : tokens.has(p) || (p.length >= 5 && elenco.some((t) => t.startsWith(p))),
      ) || (area.sigle ? area.sigle.test(grezzo) : false);
    if (presente) out.add(area.id);
  }
  return out;
}

/** Aree in comune fra due insiemi, con le etichette leggibili. */
export function areeInComune(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return etichetteAree([...a].filter((x) => b.has(x)));
}

/**
 * Ponte più pertinente fra due insiemi di aree (`null` = nessun ponte noto).
 * A parità di rilevanza si sceglie il ponte «affine» (più leggero) e poi
 * l'etichetta in ordine alfabetico: selezione deterministica.
 */
export function ponteTraAree(a: ReadonlySet<string>, b: ReadonlySet<string>): PonteAree | null {
  const pertinenti = PONTI.filter(
    (p) => (a.has(p.da) && b.has(p.a)) || (a.has(p.a) && b.has(p.da)),
  );
  if (pertinenti.length === 0) return null;
  const ordinati = [...pertinenti].sort(
    (x, y) => x.livello.localeCompare(y.livello) || x.etichetta.localeCompare(y.etichetta),
  );
  return { livello: ordinati[0].livello, etichetta: ordinati[0].etichetta };
}

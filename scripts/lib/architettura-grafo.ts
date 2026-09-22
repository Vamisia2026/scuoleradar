/**
 * Governance strutturale — raccolta file, grafo degli import e supporto al report.
 *
 * Modulo di supporto di `scripts/check-architettura.ts` (regola:
 * docs/MODULAR_ARCHITECTURE.md). Tiene qui la meccanica (filesystem + parsing
 * degli import + ricerca di cicli) e le utility di lettura baseline/inventario,
 * lasciando al CLI la sola policy e le decisioni di esito.
 */
import process from 'node:process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

/** Radice del progetto (dove vive package.json). */
export const RADICE_PROGETTO = process.cwd();

/** Percorso della baseline del debito strutturale. */
export const PERCORSO_BASELINE = 'scripts/architettura-baseline.json';

/** Estensioni di codice sorvegliate. */
export const ESTENSIONI = ['.ts', '.tsx'];

export interface FileInfo {
  /** Percorso relativo POSIX, es. `src/lib/foo.ts`. */
  rel: string;
  righe: number;
  contenuto: string;
  /** Dominio/modulo di appartenenza (`departments/x` | `modules/y`), altrimenti null. */
  dominio: string | null;
  /** Specifier di import statici (relativi e alias `@/`). */
  import: string[];
}

/** Elenca ricorsivamente i file di codice sotto una cartella. */
export function percorsi(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const voce of readdirSync(dir, { withFileTypes: true })) {
    if (voce.name === 'node_modules' || voce.name.startsWith('.')) continue;
    const full = join(dir, voce.name);
    if (voce.isDirectory()) percorsi(full, out);
    else if (ESTENSIONI.includes(voce.name.slice(voce.name.lastIndexOf('.')))) out.push(full);
  }
  return out;
}

/** Normalizza un percorso con separatori POSIX. */
export const posix = (p: string): string => p.split(sep).join('/');

/** Estrae gli import statici (relativi e con alias `@/`) di un file. */
export function estraiImport(contenuto: string): string[] {
  const out: string[] = [];
  const re = /(?:from\s+|import\s*\(\s*)['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(contenuto)) !== null) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('@/')) out.push(spec);
  }
  return [...new Set(out)];
}

/** Risolve uno specifier nel percorso relativo alla radice (con estensione). */
export function risolvi(spec: string, fileRel: string): string | null {
  const base = spec.startsWith('@/')
    ? `src/${spec.slice(2)}`
    : posix(join(dirname(fileRel), spec));
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (existsSync(join(RADICE_PROGETTO, c))) return posix(c);
  }
  return null;
}

/** Dominio o modulo di appartenenza di un file (null per il codice condiviso). */
export function dominioDi(rel: string): string | null {
  const m = rel.match(/^src\/(?:departments|modules)\/([^/]+)\//);
  return m ? m[1] : null;
}

/** Raccoglie i file di codice sotto le radici indicate, con metrica e import. */
export function raccogli(radici: string[]): FileInfo[] {
  const files: FileInfo[] = [];
  for (const radice of radici) {
    for (const full of percorsi(join(RADICE_PROGETTO, radice))) {
      const rel = posix(relative(RADICE_PROGETTO, full));
      const contenuto = readFileSync(full, 'utf8');
      files.push({
        rel,
        righe: contenuto.split(/\r?\n/).length,
        contenuto,
        dominio: dominioDi(rel),
        import: estraiImport(contenuto),
      });
    }
  }
  return files;
}

/** Cicli nell'import graph (percorso rappresentativo per ogni ciclo trovato). */
export function trovaCicli(grafo: Map<string, string[]>, massimo = 20): string[][] {
  const colore = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const cicli: string[][] = [];
  const visita = (n: string): void => {
    colore.set(n, 1);
    stack.push(n);
    for (const m of grafo.get(n) ?? []) {
      const c = colore.get(m) ?? 0;
      if (c === 1) {
        const i = stack.indexOf(m);
        if (i >= 0) cicli.push([...stack.slice(i), m]);
      } else if (c === 0) {
        visita(m);
      }
      if (cicli.length >= massimo) return;
    }
    stack.pop();
    colore.set(n, 2);
  };
  for (const n of grafo.keys()) if ((colore.get(n) ?? 0) === 0) visita(n);
  return cicli;
}

/** Violazione rilevata dal gate (codice `E-*`/`W-*`, file e spiegazione). */
export interface Violazione {
  codice: string;
  file: string;
  messaggio: string;
}

/** Debito strutturale congelato: chiave `CODICE:percorso` → motivazione. */
export interface Baseline {
  nota: string;
  eccezioni: Record<string, string>;
}

/** Legge la baseline del debito; se assente o illeggibile la considera vuota. */
export function leggiBaseline(): Baseline {
  const percorso = join(RADICE_PROGETTO, PERCORSO_BASELINE);
  if (!existsSync(percorso)) {
    return { nota: 'Baseline assente: nessuna eccezione congelata.', eccezioni: {} };
  }
  try {
    return JSON.parse(readFileSync(percorso, 'utf8')) as Baseline;
  } catch {
    console.warn(`⚠ Baseline illeggibile (${PERCORSO_BASELINE}): la tratto come vuota.`);
    return { nota: 'Baseline illeggibile: rigenerare con --baseline.', eccezioni: {} };
  }
}

/** Inventario leggibile: dimensioni, violazioni per codice, file per dominio. */
export function stampaInventario(
  files: FileInfo[],
  violazioni: Violazione[],
  limiteErrore: number,
): void {
  console.log('— Inventario strutturale —');
  console.log(`• File di codice analizzati: ${files.length}`);
  const perCodice = new Map<string, number>();
  for (const v of violazioni) perCodice.set(v.codice, (perCodice.get(v.codice) ?? 0) + 1);
  const riepilogo = [...perCodice.entries()].sort().map(([c, n]) => `${c}=${n}`);
  console.log(`• Violazioni: ${violazioni.length} (${riepilogo.join(' · ') || 'nessuna'})`);
  const fuoriSoglia = files
    .filter((f) => f.righe > limiteErrore)
    .sort((a, b) => b.righe - a.righe);
  console.log(`• File oltre ${limiteErrore} righe: ${fuoriSoglia.length}`);
  for (const f of fuoriSoglia.slice(0, 10)) {
    console.log(`    ${String(f.righe).padStart(5)}  ${f.rel}`);
  }
  const perDominio = new Map<string, number>();
  for (const f of files) {
    const d = f.rel.match(/^src\/(?:departments|modules)\/([^/]+)\//)?.[1];
    if (d) perDominio.set(d, (perDominio.get(d) ?? 0) + 1);
  }
  const domini = [...perDominio.entries()].sort().map(([d, n]) => `${d}=${n}`);
  console.log(`• File per dominio: ${domini.join(' · ') || 'nessuno'}`);
}

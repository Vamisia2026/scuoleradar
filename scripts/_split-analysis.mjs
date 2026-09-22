/**
 * STRUMENTO TEMPORANEO DI REFACTORING (non fa parte dell'app).
 *
 * Per un file .tsx e una lista di blocchi [start,end,nome], calcola:
 *  - PROPS   → simboli locali del componente (stato/handler/memo) usati dal blocco
 *              → diventano proprietà del nuovo sotto-componente;
 *  - MODULO  → costanti dichiarate fuori dal componente → il sotto-componente le
 *              importa o le ricrea, NON le riceve come prop;
 *  - IMPORT  → simboli importati → vanno re-importati nel sotto-componente.
 *
 * Uso: node scripts/_split-analysis.mjs <file> '[[a,b,"Nome"],...]'
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2];
/**
 * Formato blocchi (niente JSON per evitare problemi di quoting in shell):
 *   "476-513:Passo1-Ordini;515-598:Passo2-Province"
 */
const blocks = (process.argv[3] ?? '')
  .split(';')
  .filter(Boolean)
  .map((spec) => {
    const [range, name] = spec.split(':');
    const [a, b] = range.split('-').map(Number);
    return [a, b, name ?? `${a}-${b}`];
  });
const src = readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

const KEYWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'switch', 'case',
  'break', 'continue', 'new', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined',
  'this', 'void', 'await', 'async', 'class', 'extends', 'super', 'in', 'of', 'do', 'default',
  'export', 'import', 'from', 'as', 'try', 'catch', 'finally', 'throw', 'delete', 'yield',
  'string', 'number', 'boolean', 'Record', 'Array', 'Partial', 'React', 'JSX',
]);

/* ---------- import bindings ---------- */
const importNames = new Set();
for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+['"][^'"]+['"]/g)) {
  for (const p of m[1].split(',')) {
    const n = p
      .trim()
      .replace(/^type\s+/, '')
      .split(/\s+as\s+/)
      .pop()
      .trim();
    if (n) importNames.add(n);
  }
}
for (const m of src.matchAll(/import\s+(\w+)\s*(?:,|from)/g)) importNames.add(m[1]);

/* ---------- component start (per distinguere modulo vs stato locale) ---------- */
const compIdx = lines.findIndex((l) => /^export function [A-Z]/.test(l));
const componentStart = compIdx >= 0 ? compIdx + 1 : 1;

/* ---------- dichiarazioni: nome → linea ---------- */
const decl = new Map();
lines.forEach((L, i) => {
  let m;
  if ((m = L.match(/^\s*(?:const|let|var)\s+(\w+)\s*[=:]/))) decl.set(m[1], i + 1);
  else if ((m = L.match(/^\s*(?:const|let|var)\s*\{([^}]*)\}/))) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(':').pop().trim();
      if (/^\w+$/.test(n)) decl.set(n, i + 1);
    }
  } else if ((m = L.match(/^\s*(?:const|let|var)\s*\[([^\]]*)\]/))) {
    // useState / useMemo con destructuring ad array: const [a, setA] = …
    for (const p of m[1].split(',')) {
      const n = p.trim();
      if (/^\w+$/.test(n)) decl.set(n, i + 1);
    }
  } else if ((m = L.match(/^\s*(?:async\s+)?function\s+(\w+)\s*\(/))) decl.set(m[1], i + 1);
  else if ((m = L.match(/^\s*(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/))) decl.set(m[1], i + 1);
});

/** Nomi dichiarati ALL'INTERNO del blocco: non sono props (sono locali del blocco). */
function dichiaratiNelBlocco(body) {
  const locali = new Set();
  for (const m of body.matchAll(/(?:const|let|var)\s+(\w+)\s*[=:]/g)) locali.add(m[1]);
  for (const m of body.matchAll(/(?:const|let|var)\s*\{([^}]*)\}/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim().split(':').pop().trim();
      if (/^\w+$/.test(n)) locali.add(n);
    }
  }
  for (const m of body.matchAll(/(?:const|let|var)\s*\[([^\]]*)\]/g)) {
    for (const p of m[1].split(',')) {
      const n = p.trim();
      if (/^\w+$/.test(n)) locali.add(n);
    }
  }
  return locali;
}

/* ---------- analisi per blocco ---------- */
console.log(`FILE ${file}  (componente da riga ${componentStart})`);
for (const [a, b, name] of blocks) {
  const body = lines.slice(a - 1, b).join('\n');
  const ids = new Set([...body.matchAll(/\b[A-Za-z_$][\w$]*\b/g)].map((m) => m[0]));
  const localiBlocco = dichiaratiNelBlocco(body);
  const props = [];
  const modulo = [];
  const imports = [];
  for (const n of [...ids].sort()) {
    if (KEYWORDS.has(n)) continue;
    if (localiBlocco.has(n)) continue;
    if (importNames.has(n)) imports.push(n);
    else if (decl.has(n)) (decl.get(n) < componentStart ? modulo : props).push(n);
  }
  console.log(`\n### ${name}  (righe ${a}-${b}, ${b - a + 1} righe)`);
  console.log(`  PROPS   (${props.length}): ${props.join(', ') || '-'}`);
  console.log(`  MODULO  (${modulo.length}): ${modulo.join(', ') || '-'}`);
  console.log(`  IMPORT  (${imports.length}): ${imports.join(', ') || '-'}`);
  console.log('  --- dichiarazioni delle props ---');
  for (const p of props) console.log(`    ${p} :: ${lines[decl.get(p) - 1].trim().slice(0, 160)}`);
  for (const p of modulo) console.log(`    [modulo] ${p} :: ${lines[decl.get(p) - 1].trim().slice(0, 160)}`);
}

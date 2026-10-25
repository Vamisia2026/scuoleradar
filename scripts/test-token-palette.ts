/**
 * ScuoleRadar.it — GUARDIA DELLA PALETTE: nessun token colore orfano (§26.88).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Tailwind scarta IN SILENZIO le classi il cui token non esiste: nessun
 * errore di build, nessun errore di typecheck, nessun warning. La classe resta nel JSX,
 * sembra corretta, e semplicemente non produce CSS — spariscono bordi, anelli, outline e
 * sfumature. È il difetto che fra §26.85 e §26.87 ha lasciato 33 classi inerti (18 su
 * `warning`, 15 su `error`) e una barra sfumata nel trasparente (`to-primary-950`).
 * Fino a §26.87 il collaudo era una procedura scritta a mano nella documentazione:
 * dipendeva da chi se la ricordava. Questo script la rende una condizione di `npm test`.
 *
 * COME FUNZIONA.
 *   1. Legge `theme.extend.colors` IMPORTANDO `tailwind.config.js` (nessuna seconda lista
 *      da tenere allineata a mano: la config è l'unica fonte di verità) e ne ricava, per
 *      ogni scala, i gradini che Tailwind sa davvero generare.
 *   2. Scansiona gli stessi `content` della config (`./index.html`, `./src/**`), quindi la
 *      guardia non può divergere dalla build se un giorno i glob cambiano.
 *   3. Fallisce se una classe colore usa un token che la palette non definisce.
 *   4. Si autodifende: prova di saper riconoscere un orfano e di essere nella catena.
 *
 * La REGOLA sta in `scripts/lib/paletteToken.ts` (quali token esistono, quali sono
 * orfani); qui stanno le asserzioni. Il distacco è lo stesso di `test-sanifica-interpelli`
 * ed è dovuto al limite di 250 righe del gate strutturale.
 *
 * Uso: npm run test:palette (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  GRADINI_TAILWIND,
  costruisciPalette,
  espandiContent,
  type ConfigTailwind,
} from './lib/paletteToken.ts';

let errori = 0;
function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${descrizione}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// Import dinamico su URL (non su un literal): la config è JS puro senza tipi, e così la
// guardia non ha bisogno di un file di dichiarazioni né di una copia dei colori.
const urlConfig = new URL('../tailwind.config.js', import.meta.url);
const config = ((await import(urlConfig.href)) as { default: ConfigTailwind }).default;
const palette = costruisciPalette(config.theme?.extend?.colors);

console.log('──────────────────────────────────────────────────────────');
console.log('🎨 GUARDIA PALETTE — nessun token colore orfano');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— 1. Palette dichiarata in tailwind.config.js —');
check('theme.extend.colors è leggibile', true, palette.scale.length > 0);
for (const s of palette.scale) {
  const gradini = [...s.gradini].sort((a, b) => Number(a) - Number(b));
  const nota = s.custom ? '' : ' (estende la palette Tailwind)';
  const quanti = gradini.length === 1 ? '1 gradino' : `${gradini.length} gradini`;
  console.log(`  · ${s.nome}${nota}: ${quanti} (${gradini.join(', ')})`);
}
const valoriNonHex = palette.scale.flatMap((s) =>
  s.valori.filter((v) => !/^#[0-9a-fA-F]{6}$/.test(v)).map((v) => `${s.nome}: ${v}`),
);
check('ogni valore di colore è un hex a 6 cifre (#rrggbb)', [], valoriNonHex);
const gradiniNonStandard = palette.scale
  .filter((s) => !s.custom)
  .flatMap((s) =>
    [...s.gradini]
      .filter((g) => g !== 'DEFAULT' && !GRADINI_TAILWIND.has(Number(g)))
      .map((g) => `${s.nome}-${g}`),
  );
check('le scale che estendono Tailwind usano solo gradini che Tailwind conosce', [], gradiniNonStandard);
const troncate = palette.scale.filter((s) => s.custom && s.senzaDefault && s.gradini.size < 10);
if (troncate.length > 0) {
  const elenco = troncate.map((s) => `${s.nome} ${s.gradini.size}`).join(', ');
  console.log(`  · scala non continua (nessun uso dei gradini intermedi): ${elenco}`);
}

// ── 2. Autotest: la guardia deve SAPER fallire ───────────────────────────────────────
// Un gate che non riconosce un orfano è peggio di nessun gate: prova casi veri e casi
// limite (opacità, prefisso composto, scala che fonde i default, token più lunghi).
console.log('\n— 2. Autotest dello scanner (la guardia si guarda) —');
const CASI: Array<[string, string, number]> = [
  ['orfano su scala custom (gradino non dichiarato)', 'rounded-full ring-success-200', 1],
  ['gradino dichiarato: nessun falso allarme', 'border-error-200', 0],
  ['opacità su gradino valido', 'ring-warning-200/40 text-error-200/70', 0],
  ['gradiente con i due estremi', 'from-primary-800 to-primary-950', 0],
  ['prefisso composto (border-t, border-l)', 'border-t-error-200 border-l-warning-100', 0],
  ['scala che fonde i default: gradino preso da Tailwind', 'text-slate-700 bg-sky-100', 0],
  ['scala che fonde i default: gradino inesistente', 'bg-sky-750', 1],
  ['scala senza DEFAULT usata senza gradino', 'bg-error', 1],
  ['token più lungo della classe', 'text-errorx-200 text-error-2000', 0],
];
for (const [descrizione, testo, attesi] of CASI) {
  check(descrizione, attesi, palette.orfaniDi(testo).length);
}

// ── 3. Scansione dei sorgenti, con gli stessi glob della config ───────────────────────
const content = config.content ?? [];
const { file, nonGestiti } = espandiContent(content);
console.log(`\n— 3. Scansione di ${file.length} file (i ${content.length} content della config) —`);
check('ogni voce di content è espandibile (nessun glob ignorato in silenzio)', [], nonGestiti);

const orfani: string[] = [];
const inUso = new Map<string, Set<string>>();
for (const percorso of file) {
  const righe = readFileSync(percorso, 'utf8').split('\n');
  righe.forEach((riga, indice) => {
    for (const classe of palette.orfaniDi(riga)) orfani.push(`${percorso}:${indice + 1} → ${classe}`);
    for (const { scala, gradino } of palette.gradiniValidiDi(riga)) {
      if (!inUso.has(scala)) inUso.set(scala, new Set());
      inUso.get(scala)?.add(gradino);
    }
  });
}
check('nessun token colore orfano nei sorgenti', [], orfani);

// ── 4. Riepilogo d'uso: quanti gradini dichiarati servono davvero ────────────────────
console.log('\n— 4. Gradini in uso (quelli non usati NON sono un errore: JIT li elimina) —');
for (const s of palette.scale) {
  const usati = inUso.get(s.nome) ?? new Set<string>();
  if (s.custom) {
    console.log(`  · ${s.nome}: ${usati.size}/${s.gradini.size} gradini in uso`);
  } else {
    const ridefiniti = [...usati].filter((g) => s.gradini.has(g)).length;
    console.log(`  · ${s.nome}: ${usati.size} in uso (${ridefiniti} ridefiniti qui, gli altri sono di Tailwind)`);
  }
}

// ── 5. Autodifesa: la guardia vale solo se è nella catena ────────────────────────────
// Stessa convenzione delle altre guardie del progetto: un gate invocabile a mano ma
// fuori da `npm test` non protegge nessuno.
console.log('\n— 5. La guardia è nella catena di `npm test` —');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato (`npm run test:palette`)', true, 'test:palette' in pkg.scripts);
check('guardia nella catena di `npm test`', true, (pkg.scripts.test ?? '').includes('scripts/test-token-palette.ts'));

console.log('\n──────────────────────────────────────────────────────────');
if (errori > 0) {
  console.log(`❌ ${errori} verifiche fallite — un token inesistente non produce CSS: correggi la palette o la classe`);
  process.exitCode = 1;
} else {
  console.log(`✅ Palette: nessun token orfano su ${file.length} file`);
}

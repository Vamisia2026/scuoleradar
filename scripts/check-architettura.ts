/**
 * AUDIT STRUTTURALE — applica la governance di `docs/MODULAR_ARCHITECTURE.md`.
 *
 * Controlli (E = errore, W = warning):
 *   E-DIM   file oltre 300 righe (SRP) — non ammesso se non è in baseline
 *   W-DIM   file oltre 250 righe (soglia di attenzione, split proattivo)
 *   E-ROOT  file di codice nella RADICE di un dominio/modulo (va in sottocartella)
 *   E-ENTRY dominio/modulo senza `index.ts` (entry point pubblico)
 *   W-UI    file `.tsx` fuori da `components/` o `pages/`
 *   W-HOOK  modulo `use*.ts(x)` fuori da `hooks/` o `contexts/`
 *   W-STRUT sottocartella di dominio fuori dal vocabolario documentato
 *   W-PROF  salita relativa profonda (`../../../..`) = accoppiamento fragile
 *   E-DOM   import che scavalca l'entry point pubblico di un altro dominio
 *   E-STRAT strato condiviso che importa verso l'alto (o dominio → UI applicativa)
 *   E-CICLO dipendenza circolare fra moduli
 *
 * Debito esistente: `scripts/architettura-baseline.json` congela le violazioni
 * già presenti (con motivazione). Il gate fallisce SOLO su violazioni NUOVE:
 * il debito non cresce mai, ma non si blocca il lavoro in corso.
 *
 * Uso:
 *   npm run test:architettura               # gate (exit 1 se ci sono novità)
 *   npm run test:architettura -- --report   # inventario completo, exit 0
 *   npm run test:architettura -- --baseline # congela lo stato attuale (deliberato)
 */
import process from 'node:process';
import { basename, join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import {
  PERCORSO_BASELINE,
  RADICE_PROGETTO,
  leggiBaseline,
  raccogli,
  risolvi,
  stampaInventario,
  trovaCicli,
  type FileInfo,
  type Violazione,
} from './lib/architettura-grafo.ts';

const LIMITE_ATTENZIONE = 250;
const LIMITE_ERRORE = 300;
const BASELINE = join(RADICE_PROGETTO, PERCORSO_BASELINE);

/** Radici di codice sorvegliate (SRP + struttura). */
const RADICI = ['src', 'scripts'];

const REPORT = process.argv.includes('--report');
const SCRIVI_BASELINE = process.argv.includes('--baseline');

/** Sottocartelle di primo livello ammesse dentro un dominio/modulo. */
const SOTTOCARTELLE_AMMESSE = [
  'components', 'hooks', 'services', 'data', 'engine', 'shared',
  'tabs', 'wizard', 'preferenze', 'flightBoard', 'calcolatore', 'dossier',
  'landing', 'creator', 'pdf', 'sources', 'bridge', 'traceability',
  'seeds', 'raw', '__tests__', 'test', 'tests', 'utils', 'types', 'modals',
];

/** File ammessi nella radice di un dominio/modulo o di una sua sottocartella. */
const FILE_RADICE_AMMESSI = ['index.ts', 'types.ts'];

/** Strati "bassi" (condivisi): non possono importare verso l'alto. */
const STRATI_BASSI = ['src/lib', 'src/data', 'src/hooks', 'src/types'];

const RADICE_DOMINIO = /^src\/(?:departments|modules)\/([^/]+)\//;

/** Controlli di forma: dimensione, cartella corretta, tipo di file, entry point. */
function violazioniStruttura(files: FileInfo[]): Violazione[] {
  const out: Violazione[] = [];
  for (const f of files) {
    if (f.righe > LIMITE_ERRORE) {
      out.push({
        codice: 'E-DIM',
        file: f.rel,
        messaggio: `${f.righe} righe (> ${LIMITE_ERRORE}): dividere in sotto-moduli (SRP)`,
      });
    } else if (f.righe > LIMITE_ATTENZIONE) {
      out.push({
        codice: 'W-DIM',
        file: f.rel,
        messaggio: `${f.righe} righe (> ${LIMITE_ATTENZIONE}): pianificare lo split`,
      });
    }

    const parti = f.rel.split('/');
    const domIdx = parti.findIndex((p) => p === 'departments' || p === 'modules');
    if (domIdx >= 0 && parti.length - domIdx - 2 === 1) {
      const nome = parti[parti.length - 1];
      if (!FILE_RADICE_AMMESSI.includes(nome)) {
        out.push({
          codice: 'E-ROOT',
          file: f.rel,
          messaggio:
            'file di codice nella radice del dominio: va in components/ | hooks/ | services/ | data/',
        });
      }
    }
    if (domIdx >= 0 && parti.length - domIdx - 2 > 1) {
      const sottocartella = parti[domIdx + 2];
      if (sottocartella && !SOTTOCARTELLE_AMMESSE.includes(sottocartella)) {
        out.push({
          codice: 'W-STRUT',
          file: f.rel,
          messaggio: `cartella "${sottocartella}" fuori dal vocabolario ammesso (components/ | hooks/ | services/ | data/ …): aggiornare la policy o spostare il file`,
        });
      }
    }

    if (f.rel.endsWith('.tsx') && f.rel !== 'src/App.tsx') {
      if (!/(?:^|\/)(?:components|pages)\//.test(f.rel)) {
        out.push({ codice: 'W-UI', file: f.rel, messaggio: 'componente fuori da components/ o pages/' });
      }
    }

    const nomeFile = basename(f.rel);
    if (/^use[A-Z0-9].*\.tsx?$/.test(nomeFile)) {
      if (!/(?:^|\/)hooks\//.test(f.rel) && !f.rel.startsWith('src/contexts/')) {
        out.push({
          codice: 'W-HOOK',
          file: f.rel,
          messaggio: 'hook fuori da hooks/ (o da contexts/): spostarlo in una cartella hooks/',
        });
      }
    }

    for (const spec of f.import) {
      const su = (spec.match(/\.\.\//g) ?? []).length;
      if (su >= 4) {
        out.push({
          codice: 'W-PROF',
          file: f.rel,
          messaggio: `import profondo "${spec}" (${su} livelli): usare alias @/ o un entry point`,
        });
      }
    }
  }

  const domini = [
    ...new Set(files.map((f) => f.rel.match(RADICE_DOMINIO)?.[0]).filter(Boolean) as string[]),
  ];
  for (const d of domini) {
    if (!existsSync(join(RADICE_PROGETTO, d, 'index.ts'))) {
      out.push({
        codice: 'E-ENTRY',
        file: `${d}index.ts`,
        messaggio: 'manca l’entry point pubblico index.ts del dominio/modulo',
      });
    }
  }
  return out;
}

/** Cicli nell'import graph (una voce per ciclo, con il percorso rappresentativo). */
function trovaCicli(grafo: Map<string, string[]>): string[][] {
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
      if (cicli.length >= 20) return;
    }
    stack.pop();
    colore.set(n, 2);
  };
  for (const n of grafo.keys()) if ((colore.get(n) ?? 0) === 0) visita(n);
  return cicli;
}

/** Controlli di gerarchia: cicli, salto delle entry point, strati bassi. */
function violazioniAccoppiamento(files: FileInfo[]): Violazione[] {
  const out: Violazione[] = [];
  const grafo = new Map<string, string[]>(files.map((f) => [f.rel, []]));

  for (const f of files) {
    const miei = grafo.get(f.rel)!;
    for (const spec of f.import) {
      const target = risolvi(spec, f.rel);
      if (!target) continue;
      miei.push(target);

      const suoDominio = target.match(RADICE_DOMINIO)?.[1] ?? null;
      if (suoDominio && suoDominio !== f.dominio && !/\/index\.tsx?$/.test(target)) {
        out.push({
          codice: 'E-DOM',
          file: f.rel,
          messaggio: `accoppiamento diretto con ${target}: si importa solo src/…/${suoDominio}/index.ts`,
        });
      }

      const strato = STRATI_BASSI.find((s) => f.rel.startsWith(`${s}/`));
      if (strato) {
        if (
          /^src\/(?:components|pages|departments|modules)\//.test(target) ||
          target === 'src/App.tsx'
        ) {
          out.push({
            codice: 'E-STRAT',
            file: f.rel,
            messaggio: `${strato} importa ${target}: dipendenza verso l’alto (strato condiviso)`,
          });
        }
      }

      if (
        (f.rel.startsWith('src/departments/') || f.rel.startsWith('src/modules/')) &&
        (target.startsWith('src/pages/') || target === 'src/App.tsx')
      ) {
        out.push({
          codice: 'E-STRAT',
          file: f.rel,
          messaggio: `dominio che importa la UI applicativa ${target}`,
        });
      }
    }
  }

  for (const ciclo of trovaCicli(grafo)) {
    out.push({
      codice: 'E-CICLO',
      file: ciclo[0],
      messaggio: `dipendenza circolare (${ciclo.length} passaggi): ${ciclo.join(' → ')}`,
    });
  }
  return out;
}

const BASELINE_REL = PERCORSO_BASELINE;

const chiave = (v: Violazione): string => `${v.codice}:${v.file}`;

function main(): void {
  const files = raccogli(RADICI);
  const violazioni = [...violazioniStruttura(files), ...violazioniAccoppiamento(files)];
  const errori = violazioni.filter((v) => v.codice.startsWith('E-'));
  const warning = violazioni.filter((v) => v.codice.startsWith('W-'));

  if (SCRIVI_BASELINE) {
    const eccezioni: Record<string, string> = {};
    for (const v of violazioni) eccezioni[chiave(v)] = v.messaggio.slice(0, 140);
    writeFileSync(
      BASELINE,
      `${JSON.stringify(
        {
          nota: 'Debito strutturale congelato dal gate (docs/MODULAR_ARCHITECTURE.md). Rimuovere una voce quando la violazione viene risolta: le eccezioni non più necessarie vengono segnalate dal gate.',
          eccezioni,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    console.log(`✓ Baseline aggiornata: ${violazioni.length} eccezioni in ${BASELINE_REL}`);
    return;
  }

  if (REPORT) {
    stampaInventario(files, violazioni, LIMITE_ERRORE);
    for (const v of violazioni) console.log(`  ${v.codice.padEnd(8)} ${v.file} — ${v.messaggio}`);
    return;
  }

  const baseline = leggiBaseline();
  const chiavi = new Set(violazioni.map(chiave));
  const nuove = violazioni.filter((v) => !(chiave(v) in baseline.eccezioni));
  const risolte = Object.keys(baseline.eccezioni).filter((k) => !chiavi.has(k));

  console.log('— Gate strutturale (docs/MODULAR_ARCHITECTURE.md) —');
  console.log(
    `• File analizzati: ${files.length} | violazioni: ${violazioni.length} (${errori.length} errori, ${warning.length} warning)`,
  );
  console.log(`• Debito congelato in baseline: ${violazioni.length - nuove.length}`);
  if (risolte.length > 0) {
    console.log(`✓ ${risolte.length} eccezione/i non più necessaria/e: rimuoverle da ${BASELINE_REL}`);
    for (const r of risolte.slice(0, 10)) console.log(`    – ${r}`);
  }
  if (nuove.length === 0) {
    console.log('✅ ARCHITETTURA: nessuna violazione nuova');
    return;
  }
  console.error(`❌ ARCHITETTURA: ${nuove.length} violazione/i nuova/e`);
  for (const v of nuove) console.error(`  ${v.codice.padEnd(8)} ${v.file} — ${v.messaggio}`);
  console.error(
    '  Azione: correggere (split del file, entry point index.ts, import via alias/entry) oppure — se è debito accettato — congelarlo con --baseline e motivarlo nella PR.',
  );
  process.exitCode = 1;
}

main();

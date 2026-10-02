/**
 * GUARDIA · SEPARAZIONE DEI DOMINI — Interpelli di lavoro vs Notizie MIM.
 *
 * Disposizione inderogabile: il motore degli interpelli (`src/scraper/`) e le
 * notizie editoriali (`src/departments/notizie/`) sono domini ISOLATI. Nessun
 * comunicato stampa, dichiarazione istituzionale, rassegna o evento può entrare
 * nella bacheca del Radar Live né nelle notifiche Telegram/email.
 *
 * La guardia verifica tre livelli:
 *   A. ISOLAMENTO STRUTTURALE — `src/scraper/**` non importa mai da
 *      `src/departments/**`, `src/modules/**`, `src/components/**`, `src/pages/**`;
 *   B. ISOLAMENTO DI SCRITTURA — `src/departments/notizie/**` non tocca la tabella
 *      `interpelli`/`notices` né importa il motore interpelli (nessun ritorno);
 *   C. FILTRO EDITORIALE — sul testo realistico, i contenuti editoriali vengono
 *      sempre scartati e le opportunità vere sempre ammesse.
 *
 * Uso: npm run test:scraper:domini (incluso in `npm test`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { eContenutoEditoriale, motivoScartoOpportunita } from '../src/scraper/qualitaOpportunita.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Elenco ricorsivo dei sorgenti `.ts`/`.tsx` di una cartella. */
function sorgenti(cartella: string, acc: string[] = []): string[] {
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) sorgenti(percorso, acc);
    else if (/\.tsx?$/.test(voce)) acc.push(percorso.replace(/\\/g, '/'));
  }
  return acc;
}

/** Import dichiarati in un file (specifier fra apici). */
function importDi(percorso: string): string[] {
  const testo = readFileSync(percorso, 'utf8');
  const out: string[] = [];
  for (const m of testo.matchAll(/from\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of testo.matchAll(/import\s+['"]([^'"]+)['"]/g)) out.push(m[1]);
  return out;
}

/* ---------- A. Isolamento strutturale del motore interpelli ---------- */

console.log('— A. Il motore interpelli NON dipende da altri domini/UI —');
const VIETATI_SCRAPER = ['departments/', 'modules/', 'components/', 'pages/', 'App.tsx'];
const fileScraper = sorgenti('src/scraper');
const dipendenzeVietate: string[] = [];
for (const f of fileScraper) {
  for (const spec of importDi(f)) {
    if (VIETATI_SCRAPER.some((v) => spec.includes(v))) dipendenzeVietate.push(`${f} → ${spec}`);
  }
}
check('nessuna dipendenza da departments/modules/UI', [], dipendenzeVietate);
check('file del motore presenti (>= 8)', true, fileScraper.length >= 8);
check(
  'nessun import del dominio Notizie nel motore',
  [],
  fileScraper.filter((f) => importDi(f).some((s) => /notizie/i.test(s))),
);

/* ---------- B. Le notizie NON scrivono nella bacheca interpelli ---------- */

console.log('\n— B. Il dominio Notizie non alimenta la bacheca interpelli —');
const fileNotizie = sorgenti('src/departments/notizie');
const scrittureInterpelli: string[] = [];
const importMotore: string[] = [];
for (const f of fileNotizie) {
  const testo = readFileSync(f, 'utf8');
  if (/from\(\s*['"]interpelli['"]\s*\)|from\(\s*['"]notices['"]\s*\)/.test(testo)) {
    scrittureInterpelli.push(f);
  }
  if (importDi(f).some((s) => /scraper\/|scraper$/.test(s))) importMotore.push(f);
}
check('nessuna query sulla tabella interpelli/notices', [], scrittureInterpelli);
check('nessun import del motore interpelli', [], importMotore);

/* ---------- C. Filtro editoriale (testo realistico) ---------- */

console.log('\n— C. Contenuti editoriali SEMPRE fuori dalla bacheca —');
const OGGI = new Date('2026-09-28T09:00:00');
const EDITORIALI = [
  'Comunicato stampa: presentato il piano scuola 2026/2027',
  'Il Ministro ha inaugurato l’anno scolastico a Taranto',
  'Conferenza stampa del Ministro sulla riforma della valutazione',
  'Lettera del Ministro agli studenti per l’avvio delle lezioni',
  'Intervista al Ministro: “La scuola cambia passo”',
  'Rassegna stampa del 28 settembre: le notizie del giorno',
  'Notizie per la scuola — aggiornamento settimanale',
  'Cerimonia di premiazione delle eccellenze agli esami di Stato',
];
for (const titolo of EDITORIALI) {
  check(
    `editoriale scartato: ${titolo.slice(0, 42)}…`,
    true,
    motivoScartoOpportunita({ title: titolo }, OGGI) !== null,
  );
}
check('riconoscimento diretto editoriali', true, EDITORIALI.every((t) => eContenutoEditoriale(t)));

console.log('\n— C2. Opportunità reali AMMESSE (nessun falso scarto) —');
const AMMESSE = [
  { title: 'Interpello supplenza A-022 Matematica — Liceo Manzoni, Milano', expirationDate: '2026-10-15' },
  { title: 'Avviso di selezione per esperto esterno PNRR — IC Via Roma, Napoli', expirationDate: null },
  { title: 'Interpello personale ATA collaboratore scolastico AA — USP Torino', expirationDate: '2026-10-02' },
  { title: 'Bando reclutamento esperto madrelingua inglese — Liceo Galilei, Firenze', expirationDate: '2026-11-30' },
];
for (const a of AMMESSE) {
  check(`ammessa: ${a.title.slice(0, 42)}…`, null, motivoScartoOpportunita(a, OGGI));
}

/* ---------- D. Lotto misto: in bacheca resta solo il reclutamento ---------- */

console.log('\n— D. Lotto misto (notizie + bandi): entra solo il reclutamento —');
const LOTTO = [...EDITORIALI, ...AMMESSE];
const tenuti = LOTTO.filter((a) => motivoScartoOpportunita(a, OGGI) === null);
check('ammessi esattamente i 4 bandi', 4, tenuti.length);
check(
  'nessun contenuto editoriale fra gli ammessi',
  [],
  tenuti.filter((a) => /comunicato|ministro|intervista|rassegna|cerimonia/i.test(a.title)),
);

console.log(`\n${errori === 0 ? '✅' : '❌'} SEPARAZIONE DOMINI: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;


/**
 * TEST — CENSIMENTO DELLE VOCI SENZA SCADENZA (§26.118).
 *
 * Il censimento serve a decidere se esporre le «disponibilità aperte fino a
 * revoca»: se la classificazione sbagliasse, la decisione si prenderebbe sui
 * numeri sbagliati. Qui i casi REALI letti sulle fonti il 30/10/2026, l'ordine
 * delle cause (chi vince quando più segnali convivono), la purezza del modulo e
 * la sua dimensione.
 *
 * Uso: npm run test:motivo-senza-scadenza  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ETICHETTA_CAUSA,
  causaSenzaScadenza,
  titoloCandidabile,
} from '../src/lib/motivoSenzaScadenza.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

// Il giorno del censimento: le date vanno giudicate rispetto a un orologio.
const OGGI = new Date('2026-10-30T10:00:00');

/* ---------------- 1) IL CASO CHE HA ORIGINATO LA DOMANDA (Liguria) --------- */
check(
  '«Disponibilità aperta fino a revoca» = a_revoca, non un dato mancante',
  'a_revoca',
  causaSenzaScadenza(
    { titolo: 'Interpello AAAA — Preventivo ≤ 10 giorni', testo: 'Periodo Non previsto Scadenza Disponibilità aperta fino a revoca' },
    OGGI,
  ),
);
check('«sino alla revoca» = a_revoca', 'a_revoca', causaSenzaScadenza({ titolo: 'Disponibilità sino alla revoca' }, OGGI));
check('«sempre aperta» = a_revoca', 'a_revoca', causaSenzaScadenza({ titolo: 'Bacheca sempre aperta per disponibilità' }, OGGI));

/* --------------------------- 2) PAGINE INDICE ----------------------------- */
check('soli codici separati = indice', 'indice', causaSenzaScadenza({ titolo: 'ADEE | AAAA | A043' }, OGGI));
check('«classi di concorso» = indice', 'indice', causaSenzaScadenza({ titolo: 'Classi di concorso e codici' }, OGGI));

/* ---------------------- 3) ARCHIVIO E ATTI CONCLUSI ----------------------- */
check('graduatoria definitiva = archivio', 'archivio', causaSenzaScadenza({ titolo: 'Graduatoria definitiva a.s. 2024/25' }, OGGI));
check('esiti della selezione = archivio', 'archivio', causaSenzaScadenza({ titolo: 'Esiti della selezione per collaboratore scolastico' }, OGGI));
check('circolare interna = archivio', 'archivio', causaSenzaScadenza({ titolo: 'Circolare n. 42 — orario estivo' }, OGGI));
check('decreto di nomina = archivio', 'archivio', causaSenzaScadenza({ titolo: 'Decreto di nomina commissione' }, OGGI));

/* -------------------- 3b) ATTI CHE IL PRE-FILTRO GIÀ CONOSCE -------------- */
check(
  'un atto di gara (CIG) = amministrativo, non un\'opportunità',
  'amministrativo',
  causaSenzaScadenza({ titolo: 'Avviso di gara CIG ABC123 per acquisto arredi' }, OGGI),
);
check(
  'amministrativo vince su archivio',
  'amministrativo',
  causaSenzaScadenza({ titolo: 'Bando CIG Z123456789 — fornitura, archivio 2024' }, OGGI),
);

/* ------------------------ 4) UNA DATA GIÀ PASSATA ------------------------- */
check(
  'termine citato e già passato = data_passata',
  'data_passata',
  causaSenzaScadenza({ titolo: 'Avviso interpello A022 — termine 12/11/2025' }, OGGI),
);
check(
  'una data FUTURA non basta a classificarla (resta non_dichiarata)',
  'non_dichiarata',
  causaSenzaScadenza({ titolo: 'Avviso interpello A022 — 12/12/2026' }, OGGI),
);

/* ------------- 5) LA FASCIA CHE MERITA UNA LETTURA: NESSUN SEGNALE --------- */
const opaca = { titolo: 'Interpello per supplenza A022 scuola primaria', url: 'https://x.example.it/a.pdf' };
check('nessun segnale = non_dichiarata', 'non_dichiarata', causaSenzaScadenza(opaca, OGGI));
check('il titolo dichiara un reclutamento', true, titoloCandidabile(opaca));
check('un titolo di servizio non è candidabile', false, titoloCandidabile({ titolo: 'Orario delle lezioni' }));

/* ---------------------- 6) ORDINE DELLE CAUSE ----------------------------- */
check(
  'a_revoca vince su archivio',
  'a_revoca',
  causaSenzaScadenza({ titolo: 'Archivio disponibilità aperta fino a revoca' }, OGGI),
);
check(
  'indice vince su archivio (il titolo è la prova più forte)',
  'indice',
  causaSenzaScadenza({ titolo: 'AAAA | EEEE', testo: 'archivio 2024' }, OGGI),
);

/* --------------------------- 7) ETICHETTE -------------------------------- */
check('ogni causa ha un\'etichetta leggibile', true, Object.values(ETICHETTA_CAUSA).every((e) => e.length > 3));

/* ------------------- 8) PUREZZA, DIMENSIONE, CATENA --------------------- */
const sorgente = readFileSync('src/lib/motivoSenzaScadenza.ts', 'utf8');
check('modulo puro: nessun node:* e nessuna rete', [false, false], [
  /from\s+'node:/.test(sorgente),
  /fetch\s*\(|XMLHttpRequest|cheerio/i.test(sorgente),
]);
check('il modulo resta sotto 200 righe', true, sorgente.replace(/\r?\n$/, '').split('\n').length <= 200);

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check(
  'script dedicato e guardia nella catena',
  [true, true],
  ['test:motivo-senza-scadenza' in pkg.scripts, (pkg.scripts.test ?? '').includes('scripts/test-motivo-senza-scadenza.ts')],
);

console.log(errori === 0 ? '\n✅ CENSIMENTO SENZA SCADENZA: cause distinte, decisione sui numeri.' : `\n❌ CENSIMENTO SENZA SCADENZA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

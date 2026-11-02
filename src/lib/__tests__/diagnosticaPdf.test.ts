/**
 * TEST — DIAGNOSTICA DEI PDF (`src/lib/diagnosticaPdf.ts`, §26.128).
 *
 * Perché serve: il giro del 31/10/2026 ha aperto 1.131 PDF, ne ha letti 1.130
 * con del testo e solo 16 hanno dichiarato una scadenza. Un contatore così non
 * dice se il documento era illeggibile, se era una graduatoria o se la data era
 * passata: la decisione successiva (allargare le regex, filtrare i file,
 * alzare i budget) si prenderebbe sui numeri sbagliati. Qui si fissa:
 *   1. i tre modi di essere illeggibile (vuoto, CID, tabella di sole cifre);
 *   2. che «senza scadenza» porti la causa di §26.118, non un'etichetta nuova;
 *   3. i confini della data (passata, valida, oltre 365 giorni);
 *   4. che i secchi SOMMINO al totale (è l'unica cosa che rende il numero utile);
 *   5. che il riepilogo nomini tutte e sei le cause;
 *   6. modulo PURO, compatto e in catena (`npm test`).
 *
 * Uso: npm run test:diagnostica-pdf  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MINIMO_DENSITA_ALFABETICA,
  ORDINE_CAUSE,
  analizzaPdf,
  contaLettere,
  densitaAlfabetica,
  nuovoContatorePdf,
  registraPdf,
  righeRiepilogoPdf,
  senzaScadenza,
  testoLeggibile,
} from '../diagnosticaPdf.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Il giorno della diagnosi: le date si giudicano rispetto a un orologio. */
const OGGI = new Date('2026-10-31T09:00:00');

/** Un avviso VERO: quello che un PDF leggibile contiene davvero. */
const TESTO_AVVISO =
  'Avviso di selezione per il conferimento di incarichi di supplenza temporanea. ' +
  'Le domande dovranno essere presentate secondo le modalita indicate nel bando allegato. ' +
  'Il dirigente scolastico rende noto che le domande pervenute saranno valutate dalla commissione.';

/* ------------- 1) ILLEGGIBILE: tre modi diversi di non essere un testo ------- */
console.log('\n— 1. Illeggibile —');
check('nessun testo (PDF scansionato) = illeggibile', 'illeggibile', analizzaPdf({ testo: '' }, OGGI).esito);
check(
  'testo di soli codici CID = illeggibile',
  'illeggibile',
  analizzaPdf({ testo: '<0035><0036><0037> ãÿ ¤§ ±¶' }, OGGI).esito,
);
check(
  'una tabella di date e voti non è un documento',
  'illeggibile',
  analizzaPdf({ testo: '12/11/2026 08:00-12:00 22/4 4,5/6 '.repeat(20) }, OGGI).esito,
);
check('un avviso vero è leggibile', true, testoLeggibile(TESTO_AVVISO));
check('nessuna lettera → densità 0', 0, densitaAlfabetica('12/11/2026 08:00 4,5/6'));
check(
  '40 lettere affogate in 400 cifre non sono un documento',
  false,
  testoLeggibile('a'.repeat(40) + ' ' + '1 '.repeat(200)),
);
check('un avviso vero supera la soglia di densità', true, densitaAlfabetica(TESTO_AVVISO) >= MINIMO_DENSITA_ALFABETICA);
check('le lettere si contano davvero', 14, contaLettere('A022 è un interpello'));

/* ------------- 2) SENZA SCADENZA: le cause di §26.118, non altre ------------ */
console.log('\n— 2. Senza scadenza (causa) —');
const senza = (titolo: string) => analizzaPdf({ titolo, testo: TESTO_AVVISO }, OGGI);
check('«fino a revoca» = a_revoca', 'a_revoca', senza('Disponibilità aperta fino a revoca').causa);
check('graduatoria = archivio', 'archivio', senza('Graduatoria definitiva a.s. 2024/25').causa);
check('interpello senza data = non_dichiarata', 'non_dichiarata', senza('Interpello per supplenza A022').causa);
check('senza scadenza porta sempre una causa', true, senza('Interpello per supplenza A022').causa !== null);
check('senza scadenza non è «illeggibile»', 'senza_scadenza', senza('Interpello per supplenza A022').esito);
// §26.128 — LA CAUSA SI LEGGE SULL'INTESTAZIONE: un documento vero cita la
// graduatoria a metà pagina e non per questo è un atto concluso. Se la regola di
// §26.118 leggesse il corpo intero, `archivio` si mangerebbe quasi ogni PDF.
const CODA_ARCHIVIO =
  'Interpello per supplenza temporanea classe A022.'.padEnd(220, ' ') +
  'Graduatoria definitiva pubblicata.';
check(
  'il corpo intero non decide la causa (solo l\'intestazione)',
  'non_dichiarata',
  analizzaPdf({ testo: CODA_ARCHIVIO }, OGGI).causa,
);
check(
  'la stessa parola in testa decide la causa',
  'archivio',
  analizzaPdf({ testo: 'Graduatoria definitiva a.s. 2024/25. ' + TESTO_AVVISO }, OGGI).causa,
);

/* -------------------- 3) LA DATA: passata, valida, lontana ------------------ */
console.log('\n— 3. La data —');
const conData = (deadline: string) => analizzaPdf({ testo: TESTO_AVVISO, deadline }, OGGI);
check('termine futuro dentro l\'anno = valida', 'valida', conData('2026-12-15').esito);
check('termine di oggi = valida', 'valida', conData('2026-10-31').esito);
check('termine già passato = passata', 'passata', conData('2026-10-01').esito);
check('oltre l\'orizzonte di ingestione = oltre_orizzonte', 'oltre_orizzonte', conData('2028-06-01').esito);
check(
  'il confine dell\'orizzonte è 365 giorni (2027-10-31 dentro, 2027-11-01 fuori)',
  ['valida', 'oltre_orizzonte'],
  [conData('2027-10-31').esito, conData('2027-11-01').esito],
);
check('una data non ISO non è un termine', true, analizzaPdf({ testo: TESTO_AVVISO, deadline: '15/12/2026' }, OGGI).causa !== null);

/* --------- 4) I SECCHI SOMMANO: è l'unica cosa che rende utile il numero ---- */
console.log('\n— 4. Il contatore —');
const contatore = nuovoContatorePdf();
registraPdf(contatore, { testo: '', deadline: null }, OGGI);
registraPdf(contatore, { testo: TESTO_AVVISO, deadline: null, titolo: 'Graduatoria definitiva' }, OGGI);
registraPdf(contatore, { testo: TESTO_AVVISO, deadline: '2026-12-15' }, OGGI);
registraPdf(contatore, { testo: TESTO_AVVISO, deadline: '2026-01-01' }, OGGI);
registraPdf(contatore, { testo: TESTO_AVVISO, deadline: '2029-01-01' }, OGGI);
check('cinque PDF aperti', 5, contatore.aperti);
check('aperti = leggibili + illeggibili', [5, 5], [contatore.aperti, contatore.leggibili + contatore.illeggibili]);
check(
  'conScadenza = valide + passate + oltre orizzonte',
  [3, 3],
  [contatore.conScadenza, contatore.valide + contatore.passate + contatore.oltreOrizzonte],
);
check(
  'i senza scadenza sono la somma delle sei cause',
  [1, 1],
  [contatore.aperti - contatore.conScadenza - contatore.illeggibili, senzaScadenza(contatore)],
);
check('tutte e sei le cause esistono nel contatore', 6, Object.keys(contatore.motivi).length);
check(
  'le cause sono le sei di §26.118, nell\'ordine dichiarato',
  ['a_revoca', 'indice', 'amministrativo', 'archivio', 'data_passata', 'non_dichiarata'],
  [...ORDINE_CAUSE],
);
check(
  'la causa registrata è quella del titolo (archivio, non la fascia opaca)',
  [1, 0],
  [contatore.motivi.archivio, contatore.motivi.non_dichiarata],
);

/* ------------------- 5) IL RIEPILOGO DICE «PERCHÉ» ------------------------ */
console.log('\n— 5. Il riepilogo —');
const righe = righeRiepilogoPdf(contatore);
const etichette = ['fino a revoca', 'indice di classi', 'atto amministrativo', 'archivio/atto', 'data già passata', 'senza alcun segnale'];
check('tre righe: leggibilità, termine, cause', 3, righe.length);
check('la prima riga dichiara i secchi di leggibilità', true, righe[0].includes('leggibili: 4') && righe[0].includes('illeggibili: 1'));
check('la seconda riga dichiara i secchi della data', true, righe[1].includes('valide: 1') && righe[1].includes('passate: 1'));
check('la terza riga nomina tutte e sei le cause', true, etichette.every((e) => righe[2].includes(e)));
check('un giro senza PDF non stampa righe', 0, righeRiepilogoPdf(nuovoContatorePdf()).length);
const soloTetto = nuovoContatorePdf();
soloTetto.oltreTetto = 3;
check('i file non aperti per dimensione si vedono lo stesso', true, righeRiepilogoPdf(soloTetto)[0].includes('non aperti per dimensione: 3'));

/* ---------------- 6) PUREZZA, DIMENSIONE, CATENA -------------------------- */
console.log('\n— 6. Igiene —');
const sorgente = readFileSync('src/lib/diagnosticaPdf.ts', 'utf8');
check('modulo puro: nessun node:* e nessuna rete', [false, false], [
  /from\s+'node:/.test(sorgente),
  /fetch\s*\(|XMLHttpRequest|cheerio/i.test(sorgente),
]);
check(
  'il modulo resta sotto il tetto di 250 righe del gate strutturale',
  true,
  sorgente.replace(/\r?\n$/, '').split('\n').length <= 250,
);

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato e guardia nella catena', [true, true], [
  'test:diagnostica-pdf' in pkg.scripts,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/diagnosticaPdf.test.ts'),
]);

console.log(
  errori === 0
    ? '\n✅ DIAGNOSTICA PDF: ogni documento in un secchio, i secchi sommano.'
    : `\n❌ DIAGNOSTICA PDF: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

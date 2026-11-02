/**
 * ScuoleRadar.it — GUARDIA DEL CLASSIFICATORE DEL SOSTEGNO A TRE STATI (§26.131).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Fino a §26.130 il sostegno era un booleano: «il testo contiene
 * *sostegn*?». Sui dati veri quella domanda produceva due difetti opposti —
 * falsi positivi («piano di sostegno didattico», «progetto sostegno») e falsi
 * negativi (i codici delle fonti `AD01…AD04`, `AD0D` non mappati su un ordine).
 *
 * Questa guardia fissa il CONTRATTO dei tre stati, uno per uno:
 *   · `certo`   — codice `AD…` (tabella dichiarata) OPPURE parola *sostegno* con
 *                 un marcatore di reclutamento (interpello/supplenza/disponibilità/avviso);
 *   · `ambiguo` — parola *sostegno* senza marcatore: NON è una cattedra;
 *   · `nessuno` — nessun segnale.
 * E fissa la conseguenza: solo `certo` apre l'area sostegno (`eAvvisoSostegno`,
 * matching, scala, bacheca); `ambiguo` non entra in bacheca e non si scrive.
 *
 * Esecuzione: `npm run test:sostegno:classificatore` (incluso in `npm run test:sostegno`).
 */
import { readFileSync } from 'node:fs';
import { eAvvisoSostegno, isCodiceSostegno } from '../src/data/classiConcorso.ts';
import {
  avvisoDiSostegnoCerto,
  classificaSostegno,
  codiciSostegnoNelTesto,
  eCodiceSostegno,
  ordineDaCodiceSostegno,
  sostegnoAmbiguo,
} from '../src/lib/classificatoreSostegno.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Codici di sostegno: la forma è chiusa, la tabella è dichiarata —');
check('ADEE è sostegno', true, eCodiceSostegno('ADEE'));
check('ADAA è sostegno', true, eCodiceSostegno('ADAA'));
check('ADMM è sostegno', true, eCodiceSostegno('ADMM'));
check('ADSS è sostegno', true, eCodiceSostegno('ADSS'));
check('AD01 è sostegno', true, eCodiceSostegno('AD01'));
check('AD04 è sostegno', true, eCodiceSostegno('AD04'));
check('AD0D è sostegno', true, eCodiceSostegno('AD0D'));
check('AD24 è sostegno (sigla generica delle fonti)', true, eCodiceSostegno('AD24'));
check('minuscolo con spazi « ad 04 »', true, eCodiceSostegno(' ad 04 '));
check('A-22 NON è sostegno', false, eCodiceSostegno('A-22'));
check('A-24 NON è sostegno', false, eCodiceSostegno('A-24'));
check('B-02 NON è sostegno', false, eCodiceSostegno('B-02'));
check('AAAA NON è sostegno', false, eCodiceSostegno('AAAA'));
check('EEEE NON è sostegno', false, eCodiceSostegno('EEEE'));
check('vuoto NON è sostegno', false, eCodiceSostegno(''));

console.log('\n— 2. Codice → ordine di scuola (la mappa che la pertinenza usa) —');
check('ADAA', 'infanzia', ordineDaCodiceSostegno('ADAA'));
check('AD0D', 'infanzia', ordineDaCodiceSostegno('AD0D'));
check('ADEE', 'primaria', ordineDaCodiceSostegno('ADEE'));
check('ADMM', 'secondaria1', ordineDaCodiceSostegno('ADMM'));
check('ADSS', 'secondaria2', ordineDaCodiceSostegno('ADSS'));
check('AD01', 'secondaria2', ordineDaCodiceSostegno('AD01'));
check('AD02', 'secondaria2', ordineDaCodiceSostegno('AD02'));
check('AD03', 'secondaria2', ordineDaCodiceSostegno('AD03'));
check('AD04', 'secondaria2', ordineDaCodiceSostegno('AD04'));
check('AD24 fuori tabella → nessun ordine (dato assente, non giudizio)', null, ordineDaCodiceSostegno('AD24'));
check('A-22 → nessun ordine', null, ordineDaCodiceSostegno('A-22'));

console.log('\n— 3. Stato «certo»: il codice vince su tutto —');
check(
  'codice fra le classi',
  { esito: 'certo', ordine: 'secondaria2', codici: ['AD04'], motivo: 'codice' },
  classificaSostegno({ classi: ['AD04'] }),
);
check(
  'codice dentro il titolo, senza class_codes',
  { esito: 'certo', ordine: 'primaria', codici: ['ADEE'], motivo: 'codice' },
  classificaSostegno({ titolo: 'Interpello scuola primaria — posto ADEE' }),
);
check(
  'ordine pubblicato dalla fonte vince sul codice',
  'infanzia',
  classificaSostegno({ classi: ['ADSS'], ordine: 'infanzia' }).ordine,
);
check(
  'codice fuori tabella: certo ma senza ordine',
  { esito: 'certo', ordine: null, codici: ['AD24'], motivo: 'codice' },
  classificaSostegno({ classi: ['AD24'] }),
);
check(
  'classi miste: solo il codice AD resta',
  ['AD03'],
  classificaSostegno({ classi: ['A-22', 'ad 03', 'B-02'] }).codici,
);
console.log('\n— 4. Stato «certo»: la prosa vale SOLO con un marcatore di reclutamento —');
for (const titolo of [
  'Interpello sostegno scuola dell’infanzia',
  'Supplenza su posto di sostegno',
  'Disponibilità per incarico di sostegno primaria',
  'Avviso per il conferimento di supplenze – sostegno',
]) {
  check(titolo, 'certo', classificaSostegno({ titolo }).esito);
}
check('materia «Sostegno» scritta dallo scraper', 'certo', classificaSostegno({ materia: 'Sostegno' }).esito);

console.log('\n— 5. Stato «ambiguo»: si parla di sostegno, ma non si recluta nessuno —');
for (const titolo of [
  'Piano di sostegno didattico annuale',
  'Progetto sostegno e inclusione',
  'Misure di sostegno agli alunni con BES',
]) {
  check(titolo, 'ambiguo', classificaSostegno({ titolo }).esito);
  check(`  · non è area sostegno`, false, avvisoDiSostegnoCerto({ titolo }));
  check(`  · è dichiarato ambiguo`, true, sostegnoAmbiguo({ titolo }));
}

console.log('\n— 6. Stato «nessuno»: il classificatore non aggiunge giudizi —');
check(
  'avviso disciplinare',
  { esito: 'nessuno', ordine: null, codici: [], motivo: 'nessun-segnale' },
  classificaSostegno({ classi: ['A-22'], titolo: 'Interpello A-22 tedesco' }),
);
check('bandi PNRR con «inclusione»', 'nessuno', classificaSostegno({ titolo: 'Avviso PNRR inclusione' }).esito);
check('testo vuoto', 'nessuno', classificaSostegno({}).esito);


console.log('\n— 7. Estrazione dei codici dal testo libero (allegati, oggetti di PEC) —');
check('due codici su una riga', ['AD04', 'AD0D'], codiciSostegnoNelTesto('Interpello AD04 e AD0D'));
check('nessun duplicato', ['ADEE'], codiciSostegnoNelTesto('ADEE — ADEE'));
check('codice minuscolo', ['AD02'], codiciSostegnoNelTesto('posto ad02'));
check('le classi disciplinari non entrano', [], codiciSostegnoNelTesto('A-22 e B-02'));
check('testo vuoto', [], codiciSostegnoNelTesto(''));

console.log('\n— 8. Fonte unica: il catalogo delega, non duplica —');
check('eAvvisoSostegno ≡ avvisoDiSostegnoCerto (catalogo → classificatore)', true, (() => {
  const casi: Array<[string[], string | null, string | null]> = [
    [['ADEE'], null, null],
    [['A-22', 'A-25'], 'Interpello sostegno', null],
    [[], 'Piano di sostegno didattico', null],
    [[], 'Progetto sostegno', null],
    [[], null, 'Sostegno'],
    [['A-022', 'B-02'], 'Interpello tedesco', null],
    [[], 'Avviso PNRR inclusione', null],
  ];
  return casi.every(([classi, titolo, materia]) =>
    eAvvisoSostegno(classi, titolo, materia) === avvisoDiSostegnoCerto({ classi, titolo, materia }),
  );
})());
check('isCodiceSostegno ≡ eCodiceSostegno', true, (() => {
  const casi = ['ADAA', 'ADEE', 'ADMM', 'ADSS', 'AD01', 'AD24', 'A-22', 'EEEE', '', ' ad 03 '];
  return casi.every((c) => isCodiceSostegno(c) === eCodiceSostegno(c));
})());

console.log('\n— 9. La prosa non promuove un avviso a «certo» senza reclutamento —');
const ambiguo = classificaSostegno({ titolo: 'Piano di sostegno didattico annuale' });
check('stato ambiguo, non certo', 'ambiguo', ambiguo.esito);
check('motivo dichiarato', 'prosa-senza-marcatore', ambiguo.motivo);
check('nessun codice inventato', [], ambiguo.codici);
check(
  'lo stesso testo diventa certo appena compare un marcatore',
  'certo',
  classificaSostegno({ titolo: 'Avviso — piano di sostegno didattico' }).esito,
);
check(
  'il testo di un allegato vale come il titolo',
  'certo',
  classificaSostegno({ titolo: 'Comunicazione', testo: 'Interpello su posto di sostegno ADMM' }).esito,
);

console.log('\n— 10. Cablaggio: chi consuma lo stato non lo reinventa —');
const leggi = (p: string): string => readFileSync(p, 'utf8');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const esito = leggi('src/lib/bachecaRipiego.ts');
const reporter = leggi('scripts/table-reporter.ts');
check('la bacheca scarta esplicitamente lo stato ambiguo', true, /sostegnoAmbiguo\(avviso\)/.test(bacheca));
check(
  'lo scarto avviene prima del punteggio',
  true,
  bacheca.indexOf('sostegnoAmbiguo(avviso)') < bacheca.indexOf('valutaCompatibilita(profilo, avviso'),
);
check('il conto è dichiarato nell’esito', true, /sostegnoAmbiguoScartato: number/.test(esito));
check('la bacheca lo restituisce', true, /sostegnoAmbiguoScartato,/.test(bacheca));
check(
  'l’ingestione scrive «Sostegno» solo sullo stato certo',
  true,
  /classificaSostegno\([^)]*\)\.esito === 'certo'/.test(reporter),
);
check('la bacheca non contiene più una regex sul sostegno', false, /sostegn\*/i.test(bacheca));


console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ SOSTEGNO: tre stati, codice prima della prosa, ambiguo fuori dalla bacheca.');
} else {
  console.log(`❌ SOSTEGNO: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

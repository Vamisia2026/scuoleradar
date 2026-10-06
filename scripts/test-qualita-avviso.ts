/**
 * TEST — LA RIGA DI FEED È UN AVVISO? (§26.65)
 * --------------------------------------------------------------------------
 * Le fonti pubblicano sulla stessa pagina gli AVVISI e il CONTENUTO DI CONTORNO
 * (voci di menu, titoli di sezione, indici di classi di concorso, numeri di
 * protocollo). Il contorno entrava nel feed come «opportunità»:
 *
 *   1. GIUDIZIO PURO (`lib/qualitaAvviso.ts`): una voce di menu, un titolo di
 *      sezione o un dump di codici NON è un avviso di lavoro; un avviso vero non
 *      si scarta per un dettaglio che non capiamo (il giudizio è generoso:
 *      basta una parola operativa, una classe o un istituto presentabile);
 *   2. BACHECA (`lib/bachecaInterpelli.ts`): lo scarto avviene a MONTE di ogni
 *      punteggio — è la ragione dei «60% piatti» — ed è CONTATO, mai silenzioso;
 *   3. VETRINA (`pages/dashboard/components/ElencoOpportunita.tsx`): una riga
 *      senza scadenza dichiarata non stampa più `Invalid Date`: mostra la data di
 *      pubblicazione o dichiara che la scadenza non c'è (`etichettaScadenzaAvviso`);
 *   4. STESSO GIUDIZIO nella pulizia del database (`scripts/pulisci-non-opportunita.ts`).
 *
 * Esecuzione: npm run test:qualita-avviso (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import type { Interpello } from '../src/data/interpelli.ts';
import { etichettaScadenzaAvviso } from '../src/lib/alertInterpello.ts';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import {
  eDumpDiCodici,
  eIndiceDiCodici,
  eRigaOpportunita,
  motivoRigaNonOpportunita,
} from '../src/lib/qualitaAvviso.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Interpello minimo di prova (fixture di guardia, mai dato dimostrativo). */
function interpello(over: Partial<Interpello>): Interpello {
  return {
    id: 'x',
    titolo: 'Interpello di arte',
    istituto: 'IIS Volta',
    provinciaCodice: 'AT',
    provinciaNome: 'Asti',
    classeCodice: 'A-01',
    classiCodes: ['A-01'],
    materia: 'Arte e immagine',
    ordine: 'primaria',
    dataScadenza: '2030-01-01',
    descrizione: 'Fixture di guardia',
    linkFonte: 'https://example.org/avviso',
    compatibilita: 100,
    ...over,
  };
}

/* ------------------------- 1) IL GIUDIZIO, PER UNA RIGA -------------------- */

console.log('— Un indice di codici non è un avviso —');
check('«A041 | B017» è un dump', 'titolo-dump-di-codici', motivoRigaNonOpportunita({ titolo: 'A041 | B017' }));
check('«EEEE | AAAA | ADEE» è un dump', true, eDumpDiCodici('EEEE | AAAA | ADEE'));
check('una sigla minuscola è comunque un codice', true, eDumpDiCodici('a039'));
check('titolo vuoto: niente da giudicare, non è un dump', false, eDumpDiCodici(''));
check('un titolo con parole non è un dump', false, eDumpDiCodici('Interpello di matematica'));

console.log('\n— Le voci di contorno restano fuori dal feed —');
check('«Presentazione» (voce di menu)', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'Presentazione' }));
check('«AREE TEMATICHE» (titolo di sezione)', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'AREE TEMATICHE' }));
check('«Calendario scolastico»', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'Calendario scolastico' }));
check('titolo di vetrina senza classi', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'Licei con curvatura biomedica' }));
check('numero di protocollo senza istituto', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'prot. 1234 del 12/09/2026' }));

console.log('\n— La tabella delle classi aperte non è un avviso —');
check('«A042 | ADAA | A028 | Primaria Lingua Inglese»', 'indice-di-codici', motivoRigaNonOpportunita({ titolo: 'A042 | ADAA | A028 | Primaria Lingua Inglese' }));
check('«EEEE | ADEE | ADAA | A028 | AM01 | Lingua inglese primaria»', 'indice-di-codici', motivoRigaNonOpportunita({ titolo: 'EEEE | ADEE | ADAA | A028 | AM01 | Lingua inglese primaria' }));
check('«BA02 – Conversazione in lingua straniera | BB02 –»', 'indice-di-codici', motivoRigaNonOpportunita({ titolo: 'BA02 – Conversazione in lingua straniera (FRANCESE) | BB02 –' }));
check('l’indice vince sul codice di classe estratto dalla pagina', 'indice-di-codici', motivoRigaNonOpportunita({ titolo: 'A042 | ADAA | A028 | Primaria Lingua Inglese', classi: ['A042'] }));
check('una sola voce di codice non fa indice', null, motivoRigaNonOpportunita({ titolo: 'Comunicazione | I.C. Manzoni | A042', scuola: 'I.C. Manzoni' }));
check('le iniziali non sono codici («I.C. Manzoni»)', null, motivoRigaNonOpportunita({ titolo: 'IC | I.C. Manzoni | A042', scuola: 'I.C. Manzoni' }));
check('la sigla di classe non è un’iniziale: indice', true, eIndiceDiCodici('ADEE | EEEE | Primaria'));
check('due voci ma con parola operativa: è un avviso', null, motivoRigaNonOpportunita({ titolo: 'Interpello A042 | A041', classi: ['A042'] }));
check('senza «|» nessun indice', false, eIndiceDiCodici('A042 ADAA'));

console.log('\n— Il giudizio è generoso: un avviso vero resta —');
check('una classe riconosciuta', null, motivoRigaNonOpportunita({ titolo: 'Attività', classi: ['A-11'] }));
check('il sostegno è un lavoro', null, motivoRigaNonOpportunita({ titolo: 'Attività', classi: ['ADAA'] }));
check('una parola operativa nel titolo', null, motivoRigaNonOpportunita({ titolo: 'Avviso di selezione per esperti PNRR' }));
check('una parola operativa nella materia', null, motivoRigaNonOpportunita({ titolo: 'DETERMINA N. 77', materia: 'supplenza' }));
check('un istituto vero non fa scartare la riga', null, motivoRigaNonOpportunita({ titolo: 'Determina dirigenziale n. 77', scuola: 'IIS Volta' }));
check('senza istituto la stessa riga è contorno', 'nessuna-traccia-di-opportunita', motivoRigaNonOpportunita({ titolo: 'Determina dirigenziale n. 77', scuola: '' }));
check('`eRigaOpportunita` è il complemento', true, eRigaOpportunita({ titolo: 'Interpello di supplenza' }) && !eRigaOpportunita({ titolo: 'Presentazione' }));

/* ------------------- 2) LA BACHECA SCARTA PRIMA DEL PUNTEGGIO --------------- */

console.log('\n— La bacheca non porta in vetrina il contorno —');
const profilo = {
  ordini: [],
  classi: ['A-01'],
  province: [],
  materieId: [],
  materieCustom: [],
  favoriteSchools: ['IIS Volta'],
  ignoredSchools: [],
};
const menu = interpello({
  id: 'menu',
  titolo: 'Presentazione',
  istituto: 'Presentazione',
  classiCodes: [],
  classeCodice: '',
  materia: null,
});
const esito = bachecaInterpelli([interpello({ id: 'ok' }), menu], profilo);
check('la voce di menu non entra in bacheca', ['ok'], esito.lista.map((v) => v.id));
check('lo scarto è DICHIARATO nel conto', 1, esito.righeNonOpportunita);
check('l’avviso vero entra d’ufficio (whitelist)', 1, esito.forzate);
const atto = interpello({
  id: 'atto',
  titolo: 'DETERMINA N. 77',
  classiCodes: [],
  classeCodice: '',
  materia: null,
});
check(
  'una riga senza classe ma con istituto vero NON è contorno (nessun falso scarto)',
  0,
  bachecaInterpelli([atto], { ...profilo, favoriteSchools: [] }).righeNonOpportunita,
);

/* ---------------------- 3) CABLAGGIO E VETRINA ----------------------------- */

console.log('\n— Un solo giudizio, dichiarato in bacheca e nel database —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
const giudizio = leggi('src/lib/qualitaAvviso.ts');
check('la bacheca usa il giudizio puro', true, /motivoRigaNonOpportunitaAvviso\(/.test(bacheca));
check('il segnale istituto passa dal gate dei nomi', true, /scuola: nomeIstitutoPresentabile\(riga\.istituto\)/.test(giudizio));
check('lo scarto avviene PRIMA del punteggio', true, bacheca.indexOf('motivoRigaNonOpportunitaAvviso(') < bacheca.indexOf('valutaCompatibilita('));
check('l’esito è nel tipo (log e guardie)', true, /righeNonOpportunita: number/.test(bacheca));
check('la pulizia del DB usa lo stesso giudizio', true, /motivoRigaNonOpportunitaAvviso\(/.test(leggi('scripts/pulisci-non-opportunita.ts')));

console.log('\n— Le date mancanti non diventano «Invalid Date» —');
check('scadenza vera: la data dichiarata', '15 set 2026', etichettaScadenzaAvviso('2026-09-15', '2026-09-01'));
check('senza scadenza: la data di pubblicazione', 'Pubblicato 12 set 2026', etichettaScadenzaAvviso('', '2026-09-12'));
check('senza date: dichiarato, mai inventato', 'Senza scadenza dichiarata', etichettaScadenzaAvviso('', null));
check('`null` non è una data', 'Senza scadenza dichiarata', etichettaScadenzaAvviso(null, null));
const elenco = leggi('src/pages/dashboard/components/ElencoOpportunita.tsx');
check('la lista non costruisce più la data a mano', false, /new Date\(i\.dataScadenza\)/.test(elenco));
check('la lista usa l’helper condiviso', true, /etichettaScadenzaAvviso\(i\.dataScadenza, i\.dataPubblicazione\)/.test(elenco));

/* ------------------------ 4) LA GUARDIA È NELLA CATENA -------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:qualita-avviso' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-qualita-avviso.ts'));

console.log(
  errori === 0
    ? '\n✅ QUALITÀ AVVISO: il contorno non è un’opportunità, e la vetrina non inventa date.'
    : `\n❌ QUALITÀ AVVISO: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


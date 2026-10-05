/**
 * TEST — MODALITÀ 5 «Filtri Avanzati Scuole» (whitelist/blacklist) + grafica.
 * --------------------------------------------------------------------------
 * Verifica la regola di prodotto:
 *
 *   1. BLACKLIST: se l'offerta fa capo a una scuola esclusa, l'avviso viene
 *      oscurato e scartato a prescindere dal punteggio;
 *   2. WHITELIST: se la scuola è preferita, l'offerta entra nel radar a
 *      prescindere dal punteggio (inclusione d'ufficio, `scuolaPreferita`);
 *   3. GRAFICA: con punteggio insufficiente la card mostra l'ETICHETTA DEDICATA
 *      («Scuola preferita nel radar») al posto di un voto basso; con punteggio
 *      buono evidenzia comunque che l'opportunità viene dalla scuola preferita;
 *   4. il cap dei riempitivi non può nascondere una scuola preferita.
 *
 * Esecuzione: npm run test:filtri-scuole (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import type { Interpello } from '../src/data/interpelli.ts';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import {
  ETICHETTA_SCUOLA_PREFERITA,
  descrizioneScuolaPreferita,
} from '../src/lib/compatibilita.ts';
import { giudizioScuole, scuolaEsclusa, scuolaPreferita, testoScuola } from '../src/lib/filtriScuole.ts';

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

/* -------------------------- 1) LE DUE LISTE PURE -------------------------- */

console.log('— Blacklist e whitelist: stesso confronto, esiti opposti —');
const volta = { istituto: 'IIS Volta di Torino', titolo: 'Interpello di diritto' };
check('il testo della scuola è istituto + titolo', 'iis volta di torino interpello di diritto', testoScuola(volta));
check('blacklist: scuola esclusa riconosciuta', true, scuolaEsclusa(['IIS Volta'], volta));
check('blacklist: il confronto ignora le maiuscole', true, scuolaEsclusa(['iis volta'], volta));
check('blacklist vuota: nessuna esclusione', false, scuolaEsclusa([], volta));
check('whitelist: scuola preferita riconosciuta', true, scuolaPreferita(['Liceo Dante'], { istituto: 'Liceo Dante Alighieri', titolo: 'Avviso' }));
check('whitelist: scuola diversa non è preferita', false, scuolaPreferita(['Liceo Dante'], volta));
check('la blacklist VINCE sulla whitelist', { escluso: true, preferita: false }, giudizioScuole({ favoriteSchools: ['Volta'], ignoredSchools: ['Volta'] }, interpello({})));
check('solo whitelist → inclusione d’ufficio', { escluso: false, preferita: true }, giudizioScuole({ favoriteSchools: ['Volta'], ignoredSchools: [] }, interpello({})));

/* ------------------- 2) ETICHETTA DEDICATA E INCLUSIONE D'UFFICIO ---------- */

console.log('\n— Grafica: etichetta dedicata e inclusione forzata —');
check('etichetta dedicata', 'Scuola preferita nel radar', ETICHETTA_SCUOLA_PREFERITA);
check('punteggio insufficiente → inclusione d’ufficio dichiarata', true, /inclusa d'ufficio/.test(descrizioneScuolaPreferita(45)));
check('punteggio buono → match dichiarato accanto', true, /match col profilo 85%/.test(descrizioneScuolaPreferita(85)));

const profilo = {
  ordini: [],
  classi: ['A-26'],
  province: [],
  materieId: [],
  materieCustom: [],
  favoriteSchools: ['IIS Volta'],
  ignoredSchools: [],
};
const esito = bachecaInterpelli([interpello({})], profilo);
const forzato = esito.lista[0];
check('scuola preferita: inclusa anche con classe estranea all’avviso', 1, esito.lista.length);
check('ed è marcata `scuolaPreferita` (la card lo dichiara)', true, forzato?.scuolaPreferita === true);
check('il punteggio resta quello delle modali (può essere insufficiente)', true, (forzato?.compatibilita ?? 100) < 60);
check('inclusione contata per log e guardie', 1, esito.forzate);

const senzaWhitelist = bachecaInterpelli([interpello({})], { ...profilo, favoriteSchools: [] });
check('senza whitelist lo stesso avviso NON entra (classe estranea)', 0, senzaWhitelist.lista.length);

const blacklistEsito = bachecaInterpelli([interpello({})], { ...profilo, ignoredSchools: ['Volta'] });
check('blacklist: l’avviso è oscurato anche se la scuola è preferita', 0, blacklistEsito.lista.length);
check('scarto contato per log e guardie', 1, blacklistEsito.esclusiBlacklist);

/* --------------------------- 3) CABLAGGIO GRAFICO -------------------------- */

console.log('\n— Cablaggio: card, modale e bacheca usano la stessa regola —');
const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
check('card: etichetta dedicata', true, /ETICHETTA_SCUOLA_PREFERITA/.test(card));
check('card: tooltip dell’inclusione d’ufficio', true, /descrizioneScuolaPreferita\(/.test(card));
check('card: niente più etichetta generica «Scuola Preferita»', false, />\s*Scuola Preferita\s*</.test(card));
check('card: il match resta accanto quando è buono', true, /banda\.visibile && \(/.test(card));
check('modale: stessa etichetta della card', true, /ETICHETTA_SCUOLA_PREFERITA/.test(modale) && /descrizioneScuolaPreferita\(/.test(modale));
check('bacheca: giudizio scuole applicato', true, /giudizioScuole\(/.test(bacheca));
check('bacheca: whitelist → inclusione d’ufficio nel punteggio', true, /forzata: scuole\.preferita/.test(bacheca));
check('bacheca: il flag resta sull’avviso', true, /scuolaPreferita: scuole\.preferita/.test(bacheca));
check('bacheca: il cap dei riempitivi protegge le preferite', true, /proteggi: \(v\) => v\.scuolaPreferita === true/.test(bacheca));
check('card e modale leggono lo stesso helper puro', true, /scuolaPreferita\(preferenze\.favoriteSchools/.test(card) && /scuolaPreferita\(preferenze\.favoriteSchools/.test(modale));

/* ------------------------ 4) LA GUARDIA È NELLA CATENA -------------------- */

console.log('\n— La guardia è nella catena di `npm test` —');
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:filtri-scuole' in catena.scripts);
check('guardia nella catena', true, (catena.scripts.test ?? '').includes('scripts/test-filtri-scuole.ts'));

console.log(
  errori === 0
    ? '\n✅ FILTRI SCUOLE: blacklist fuori, whitelist dentro con etichetta dedicata.'
    : `\n❌ FILTRI SCUOLE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


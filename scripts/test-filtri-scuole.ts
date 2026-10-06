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
 *   5. AMBITO PROVINCIALE: i suggerimenti del campo scuola si limitano alle
 *      province da cercare (le proprie + quelle entro i 60 km, `provinceDiRicerca`)
 *      e una scuola forzata FUORI ambito è dichiarata (avviso sotto il campo +
 *      badge sulla pill): mai un divieto, sempre una scelta detta.
 *   6. SUGGERIMENTI VERI (§26.65): nel campo scuola entrano solo ISTITUTI
 *      presentabili (`scuolePresentabili` → gate dei nomi §26.59, nel modulo
 *      dedicato `src/lib/scuolePresentabili.ts`) e il filtro è istantaneo su
 *      provincia + testo digitato (`cercaScuole`): le voci di menu del feed
 *      («Presentazione», «AREE TEMATICHE») non sono più suggerimenti.
 *   7. PROVINCIA PER LISTA (§26.67): il selettore di provincia sta DENTRO il
 *      campo scuola, sulla stessa riga del nome e di «Aggiungi», e preferite ed
 *      escluse ne hanno UNA ciascuna — niente più selettore unico di pannello col
 *      default «Tutte le tue province». Le OMONIMIE (`omonimieScuole`) sono
 *      l'unica ragione per cui il campo chiede di sceglierla.
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
import { provinceDiRicerca } from '../src/lib/prossimitaGeografica.ts';
import {
  ambitoScuola,
  cercaScuole,
  giudizioScuole,
  messaggioAmbitoScuola,
  scuolaEsclusa,
  scuolaPreferita,
  scuoleNote,
  suggerimentiScuole,
  testoScuola,
} from '../src/lib/filtriScuole.ts';
import { omonimieScuole, provinceSuggerite, scuolePresentabili } from '../src/lib/scuolePresentabili.ts';

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

/* ---------------------- 4) AMBITO PROVINCIALE DELLE SCUOLE ---------------- */

console.log('\n— Scuole note: nome + provincia dalla sorgente reale —');
const feed = [
  interpello({ id: '1', istituto: 'IIS Volta', provinciaCodice: 'AT', provinciaNome: 'Asti' }),
  interpello({ id: '2', istituto: 'IIS Volta', provinciaCodice: 'AT', provinciaNome: 'Asti' }),
  interpello({ id: '3', istituto: 'Liceo Manzoni', provinciaCodice: 'RM', provinciaNome: 'Roma' }),
  interpello({ id: '4', istituto: '   ', provinciaCodice: 'AT', provinciaNome: 'Asti' }),
];
const note = scuoleNote(feed);
check('senza doppioni (nome + provincia)', 2, note.length);
check('la provincia sta accanto al nome', 'Roma', note.find((n) => n.nome === 'Liceo Manzoni')?.provinciaNome);
check('scuola senza nome: fuori dall’elenco', false, note.some((n) => !n.nome));

console.log('\n— Suggerimenti VERI: solo istituti, filtro istantaneo (§26.65) —');
const conMenu = [...feed, interpello({ id: '5', istituto: 'Presentazione', provinciaCodice: 'AT', provinciaNome: 'Asti' })];
const presentabili = scuolePresentabili(conMenu);
check('una voce di menu non è un istituto', false, presentabili.some((n) => n.nome === 'Presentazione'));
check('gli istituti veri restano (2)', 2, presentabili.length);
const albignasego = scuolePresentabili([
  interpello({
    id: '6',
    istituto: 'IC ALBIGNASEGO Interpello per copertura posti',
    provinciaCodice: 'BS',
    provinciaNome: 'Brescia',
  }),
]);
check('la coda di procedura viene tagliata dal nome', 'IC ALBIGNASEGO', albignasego[0]?.nome);
check('selettore province: solo province con istituti reali', ['Brescia'], provinceSuggerite(albignasego).map((p) => p.nome));
const omonime = scuolePresentabili([
  interpello({ id: '7', istituto: 'IIS Volta', provinciaCodice: 'AT', provinciaNome: 'Asti' }),
  interpello({ id: '8', istituto: 'iis volta', provinciaCodice: 'RM', provinciaNome: 'Roma' }),
  interpello({ id: '9', istituto: 'Liceo Manzoni', provinciaCodice: 'RM', provinciaNome: 'Roma' }),
]);
check('omonimie: lo stesso nome in due province è dichiarato', ['IIS Volta'], omonimieScuole(omonime));
check('omonimie: un nome univoco non accende nessun avviso', [], omonimieScuole(scuolePresentabili(feed)));
check('omonimie: senza sigla di provincia non si dichiara nulla', [], omonimieScuole([{ nome: 'IIS Volta', provinciaCodice: '', provinciaNome: '' }]));
const sorgenteSuggerimenti = leggi('src/lib/scuolePresentabili.ts');
check(
  'suggerimenti: il gate dei nomi vive nel modulo dedicato (§26.65)',
  true,
  /export function scuolePresentabili/.test(sorgenteSuggerimenti) && /nomeIstitutoPresentabile/.test(sorgenteSuggerimenti),
);
check('suggerimenti: una sola copia, mai anche fra le liste', false, /export function scuolePresentabili/.test(leggi('src/lib/filtriScuole.ts')));
check('cercaScuole: filtro per provincia', [], cercaScuole(note, { provincia: 'RM', query: 'Volta' }));
check('cercaScuole: filtro per testo (sottostringa)', ['Liceo Manzoni'], cercaScuole(note, { provincia: '', query: 'manz' }).map((s) => s.nome));
check('cercaScuole: senza digitato elenca tutto l’ambito', 2, cercaScuole(note, { provincia: '', query: '' }).length);
check('cercaScuole: la tendina è limitata', 1, cercaScuole(note, { provincia: '', query: '', limite: 1 }).length);

check('la sigla è confrontabile (maiuscolo)', 'AT', note[0]?.provinciaCodice);
check('ambito di ricerca: le proprie province restano in testa', 'AT', provinceDiRicerca(['AT'])[0]);
check('ambito di ricerca: non si allarga all’altra parte d’Italia', false, provinceDiRicerca(['AT']).includes('RM'));
check('suggerimenti: solo le province da cercare', ['IIS Volta'], suggerimentiScuole(note, ['AT']).map((n) => n.nome));
check('scuola di un’altra provincia: fuori dai suggerimenti', false, suggerimentiScuole(note, ['AT']).some((n) => n.nome === 'Liceo Manzoni'));
check('nessuna provincia scelta: nessun suggerimento', [], suggerimentiScuole(note, []));

console.log('\n— Ambito di un nome: dentro, fuori, sconosciuta —');
check('provincia seguita → dentro', { stato: 'dentro' }, ambitoScuola(note, ['AT'], 'IIS Volta'));
check('stessa scuola, provincia non seguita → fuori', { stato: 'fuori', provincia: 'Roma' }, ambitoScuola(note, ['AT'], 'Liceo Manzoni'));
check('nome abbreviato riconosciuto (stesso confronto delle liste)', { stato: 'dentro' }, ambitoScuola(note, ['AT'], 'Volta'));
check('maiuscole/minuscole non contano', { stato: 'dentro' }, ambitoScuola(note, ['AT'], 'iis volta'));
check('scuola mai vista → sconosciuta', { stato: 'sconosciuta' }, ambitoScuola(note, ['AT'], 'IIS Galilei'));
check('campo vuoto → nessun avviso', { stato: 'sconosciuta' }, ambitoScuola(note, ['AT'], '   '));
check('la forzatura è DICHIARATA (fuori ambito)', true, /forzatura è dichiarata/.test(messaggioAmbitoScuola(ambitoScuola(note, ['AT'], 'Liceo Manzoni'))));
check('in ambito: nessuna forzatura', true, /senza forzature/.test(messaggioAmbitoScuola(ambitoScuola(note, ['AT'], 'IIS Volta'))));
check('sconosciuta: forzatura manuale dichiarata', true, /forzatura manuale/.test(messaggioAmbitoScuola({ stato: 'sconosciuta' })));

console.log('\n— Cablaggio: suggerimenti in ambito, forzatura visibile, nomi veri —');
const pannello = leggi('src/departments/radar/preferenze/PannelloFiltriScuole.tsx');
const campo = leggi('src/departments/radar/preferenze/components/CampoScuola.tsx');
const radar = leggi('src/departments/radar/PreferenzeRadar.tsx');
check('pannello: i suggerimenti portano con sé la provincia', true, /scuoleConosciute: ScuolaNota\[\]/.test(pannello));
check('pannello: PROVINCIA e SCUOLA sono due campi distinti (§26.65)', true, /<CampoScuola/.test(pannello) && /provinceSuggerite/.test(pannello));
check('pannello: il default «Tutte le tue province» non esiste più (§26.67)', false, /Tutte le tue province/.test(pannello));
check('pannello: UNA provincia per lista, non una per il pannello', 2, (pannello.match(/onProvinciaChange=/g) ?? []).length);
check('pannello: preferite ed escluse non condividono la scelta', true, /provinciaPreferite/.test(pannello) && /provinciaEscluse/.test(pannello));
check('campo: la tendina di provincia sta nella riga del nome + «Aggiungi»', true, /Seleziona provincia/.test(campo) && /sm:flex-row/.test(campo));
check('campo: la provincia è controllata dal pannello (nessun default muto)', true, /onProvinciaChange/.test(campo) && /provinceSuggerite: ProvinciaSuggerita\[\]/.test(campo));
check('campo: le omonimie dell’ambito sono dichiarate, non nascoste', true, /omonimieScuole\(scuoleConosciute\)/.test(campo));
check('campo: la sigla è solo l’etichetta del suggerimento', true, /value=\{s\.nome\} label=\{s\.provinciaCodice\}/.test(campo));
check('campo: filtro istantaneo per provincia + testo digitato', true, /cercaScuole\(scuoleConosciute, \{/.test(campo) && /query: value/.test(campo));
check('campo: ogni lista ha la sua tendina (useId)', true, /useId\(\)/.test(campo));
check('campo: avviso dell’ambito sotto il campo', true, /<NotaAmbito nome=\{value\}/.test(campo) && /messaggioAmbitoScuola\(ambito\)/.test(campo));
check('pannello: badge di forzatura sulle pill fuori ambito', true, /ambito\.stato === 'fuori' && <BadgeForzatura/.test(pannello));
check('radar: ambito calcolato con il raggio dei 60 km', true, /provinceDiRicerca\(provinceCodici\)/.test(radar));
check('radar: suggerimenti limitati all’ambito', true, /suggerimentiScuole\(note, provinceRicerca\)/.test(radar));
check('radar: i nomi vengono dal gate degli istituti', true, /scuolePresentabili\(interpelliFiltrati\)/.test(radar));
check('radar: le province del selettore vengono dai suggerimenti', true, /provinceSuggerite\(suggerimenti\)/.test(radar));
check('radar: nessun elenco statico di istituti (solo il feed reale)', true, /interpelliFiltrati/.test(radar) && !/scuoleDemo|ELENCO_SCUOLE/.test(radar));

/* ------------------------ 5) LA GUARDIA È NELLA CATENA -------------------- */

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


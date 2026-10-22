/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: BADGE della colonna «Scadenza».
 *
 * La colonna «Scadenza» della tavola «Radar Live» ha UNA sola fonte:
 * `expiration_date`. Qui si fissano le tre invarianti di prodotto:
 *
 *   1. il colore è quello dei GIORNI DI CALENDARIO mancanti da oggi (rosso
 *      imminente → verde lontano), con la regola condivisa
 *      (`lib/scadenza.giorniRimanenti`): scade oggi / entro 48h → rosso,
 *      3–7 giorni → arancio, oltre 7 giorni → verde (§26.75: le soglie sono le
 *      stesse di `SOGLIA_IMMINENTE`/`SOGLIA_VICINA` e di `livelloUrgenza`). Il
 *      conto NON è una differenza fra istanti: un avviso che scade oggi è «Scade
 *      oggi», mai «Scade domani» (era il bug corretto il 16/10/2026, §26.71);
 *   2. senza scadenza NON si inventa nulla: banda neutra «Scadenza n/d» — mai la
 *      data di pubblicazione spacciata per scadenza (il vecchio `Pubblicato 12
 *      set`) e mai un colore d'allarme;
 *   3. `created_at` non entra nel calcolo: non è nemmeno un parametro della
 *      funzione. L'invariante è nel TIPO, non solo nel test: una riga pubblicata
 *      ieri ma senza scadenza resta «Scadenza n/d».
 *
 * Uso: npm run test:board:scadenza  (incluso in `npm test`)
 */
import { badgeScadenza, dataItBreve, URGENZA_TOKENS } from '../rigaBoardDati';
import { dataIsoLocale } from '@/lib/scadenza';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/**
 * Data pura `YYYY-MM-DD` a `giorni` da OGGI, sul calendario LOCALE (la stessa
 * unità di misura del badge: `lib/scadenza.giorniRimanenti`). Con un ancoraggio
 * UTC il test cambiava esito a seconda dell'ora di esecuzione — e avrebbe
 * «vigilato» su un conto di giorni diverso da quello di prodotto.
 */
function fra(giorni: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + giorni);
  return dataIsoLocale(d);
}

console.log('— 0. Palette PIENA delle bande di urgenza (§26.72 / §26.75) —');
// Direttiva di prodotto: il colore di urgenza deve vedersi di sfuggita, anche su
// schermo piccolo → tinta SATURA con testo bianco in grassetto. Le tinte pastello
// (…-100, …-200) erano troppo deboli per un segnale di urgenza e sono state
// rimosse da TUTTO il tabellone (badge, pill del totale, marcatori di riga).
const ePieno = (token: string): boolean =>
  /\bbg-\w+-[5-9]00\b/.test(token) && token.includes('text-white') && token.includes('font-bold');
check('verde: colore pieno su testo bianco', true, ePieno(URGENZA_TOKENS.verde));
check('giallo: colore pieno su testo bianco', true, ePieno(URGENZA_TOKENS.giallo));
check('rosso: colore pieno su testo bianco', true, ePieno(URGENZA_TOKENS.rosso));
check('neutro: colore pieno su testo bianco', true, ePieno(URGENZA_TOKENS.neutro));
check('verde del design system: `bg-emerald-700`', true, URGENZA_TOKENS.verde.includes('bg-emerald-700'));
check('giallo del design system: `bg-amber-600`', true, URGENZA_TOKENS.giallo.includes('bg-amber-600'));
check('rosso del design system: `bg-rose-700`', true, URGENZA_TOKENS.rosso.includes('bg-rose-700'));
// Nessuna tinta pastello (…-50 / …-100 / …-200) in nessun token: la direttiva
// §26.75 chiede SOLO colori pieni ad alto contrasto.
check(
  'nessun token pastello (…-50/…-100/…-200)',
  [],
  Object.entries(URGENZA_TOKENS)
    .filter(([, token]) => /\bbg-\w+-(?:50|100|200)\b/.test(token))
    .map(([banda]) => banda),
);

console.log('\n— 1. Colore = giorni di CALENDARIO mancanti: rosso imminente, verde lontano —');
const oggi = badgeScadenza(fra(0));
check('scade oggi → etichetta', 'Scade oggi', oggi.label);
check('scade oggi → banda `URGENZA_TOKENS.rosso`', URGENZA_TOKENS.rosso, oggi.className);
check('scade oggi → ISO della scadenza per il tooltip', fra(0), oggi.dataRif);
check('nessuna banda pulsa: il pulsare non è un token', false, oggi.className.includes('animate-'));
check(
  'la banda è un token del design system (mai classi composte a mano)',
  true,
  Object.values(URGENZA_TOKENS).some((t) => t === oggi.className),
);

const due = badgeScadenza(fra(2));
check('entro 48h → etichetta', 'Ultime 48h', due.label);
check('entro 48h → rosso', URGENZA_TOKENS.rosso, due.className);

const tre = badgeScadenza(fra(3));
check('3 giorni → giallo', URGENZA_TOKENS.giallo, tre.className);
check('3 giorni → etichetta di STATO, non un conto alla rovescia', 'Ultima settimana', tre.label);
check('nessuna etichetta è un «Scade tra Ng»', false, /Scade tra \d/.test(tre.label));

const sette = badgeScadenza(fra(7));
check('7 giorni → giallo (soglia di prodotto: 3–7)', URGENZA_TOKENS.giallo, sette.className);
check('7 giorni → stessa etichetta di stato della banda', 'Ultima settimana', sette.label);
check('nessun conto alla rovescia nemmeno a 5 giorni', 'Ultima settimana', badgeScadenza(fra(5)).label);

const otto = badgeScadenza(fra(8));
check('8 giorni → verde (oltre la soglia dei 7)', URGENZA_TOKENS.verde, otto.className);
check('8 giorni → etichetta «In corso»', 'In corso', otto.label);

const lontano = badgeScadenza(fra(30));
check('30 giorni → etichetta', 'In corso', lontano.label);
check('30 giorni → verde (ultimo giorno dell’orizzonte)', URGENZA_TOKENS.verde, lontano.className);
check('30 giorni → ISO della scadenza per il tooltip', fra(30), lontano.dataRif);

console.log('\n— 2. Senza scadenza NON si inventa nulla (mai la pubblicazione) —');
const assente = badgeScadenza(null);
check('null → banda neutra piena (ardesia)', true, assente.className.includes('bg-slate-600'));
check('null → etichetta dichiarata', 'Scadenza n/d', assente.label);
check('null → fonte «nessuna»', 'nessuna', assente.fonte);
check('null → nessun colore d’allarme', false, /bg-(rose|amber|emerald)-/.test(assente.className));
check('null → nessun pulsare', false, assente.className.includes('animate-pulse'));
check('stringa vuota → stessa banda', 'Scadenza n/d', badgeScadenza('').label);
check('soli spazi → stessa banda', 'Scadenza n/d', badgeScadenza('   ').label);
check('undefined → stessa banda', 'Scadenza n/d', badgeScadenza(undefined).label);

const sporca = badgeScadenza('non-una-data');
check('data non parsabile → dichiarata, non colorata', 'Scadenza non valida', sporca.label);
check('data non parsabile → mai rossa', false, sporca.className === URGENZA_TOKENS.rosso);
check('data non parsabile → resta neutra', true, sporca.className.includes('bg-slate-600'));

console.log('\n— 3. La data della cella: ISO reale, vuota quando manca (trattino) —');
check('data ISO → «12 set»', '12 set', dataItBreve('2026-09-12'));
check('timestamptz di PostgREST → stessa data', '12 set', dataItBreve('2026-09-12T00:00:00+00:00'));
check('assente → stringa vuota: la cella usa il trattino', '', dataItBreve(null));
check('non parsabile → stringa vuota', '', dataItBreve('12/09/2026'));

console.log('\n— 4. «created_at» non può entrare nel calcolo —');
// L'invariante è nel contratto, non solo nei dati: la funzione riceve UNA data.
// Una riga pubblicata ieri e senza scadenza NON diventa «In corso» per anzianità.
check('un solo argomento nella firma', 1, badgeScadenza.length);
const ieri = badgeScadenza(fra(-1));
check('scadenza di ieri → «Scaduto», non «oggi»', 'Scaduto', ieri.label);
check('scadenza di ieri → banda rossa', URGENZA_TOKENS.rosso, ieri.className);
const senzaScadenza = badgeScadenza(null);
check('riga senza scadenza → mai «In corso»', false, senzaScadenza.label === 'In corso');
check('riga senza scadenza → mai una banda di colore', 'nessuna', senzaScadenza.fonte);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ BADGE SCADENZA: colore dai giorni mancanti, nessun surrogato quando la data manca.'
    : `\n❌ BADGE SCADENZA: ${errori} errore/i.`,
);
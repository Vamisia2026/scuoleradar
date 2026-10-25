/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: BADGE della colonna «Scadenza».
 *
 * La colonna «Scadenza» della tavola «Radar Live» ha UNA sola fonte:
 * `expiration_date`. Qui si fissano le tre invarianti di prodotto:
 *
 *   1. il colore è quello dei GIORNI DI CALENDARIO mancanti da oggi, con la
 *      regola condivisa (`lib/scadenza.giorniRimanenti` + il semaforo
 *      `lib/scadenzaSemaforo`): 🔴 rosso SOLO nelle prossime 24 ore («Scade
 *      oggi»), 🟠 arancio fra 24 e 72 ore («Scade domani», «Ultime 72h»), 🟢
 *      verde dal terzo giorno all'orizzonte dei 15 giorni («In corso»), oltre
 *      l'orizzonte → ardesia «Scadenza fuori finestra» (§26.89). Il conto NON è
 *      una differenza fra istanti: un avviso che scade oggi è «Scade oggi», mai
 *      «Scade domani» (era il bug corretto il 16/10/2026, §26.71);
 *   2. senza scadenza NON si inventa nulla: banda neutra «Scadenza n/d» — mai la
 *      data di pubblicazione spacciata per scadenza (il vecchio `Pubblicato 12
 *      set`) e mai un colore d'allarme;
 *   3. `created_at` non entra nel calcolo: non è nemmeno un parametro della
 *      funzione. L'invariante è nel TIPO, non solo nel test: una riga pubblicata
 *      ieri ma senza scadenza resta «Scadenza n/d».
 *
 * Uso: npm run test:board:scadenza  (incluso in `npm test`)
 */
import { badgeScadenza, dataItBreve, SCADENZA_TOKENS } from '../rigaBoardDati';
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

console.log('— 0. Palette UNICA e PIENA: tre luci, nessun giallo (§26.89) —');
// Direttiva di prodotto: il colore di urgenza deve vedersi di sfuggita, anche su
// schermo piccolo → tinta SATURA con testo bianco in grassetto. Le luci sono
// TRE (rosso · arancio · verde) e l'arancio è UNO: il giallo/ambra resta fuori,
// era la quarta scala dello stesso dato.
const ePieno = (token: string): boolean =>
  /\bbg-\w+-[5-9]00\b/.test(token) && token.includes('text-white') && token.includes('font-bold');
check('verde: colore pieno su testo bianco', true, ePieno(SCADENZA_TOKENS.verde));
check('arancio: colore pieno su testo bianco', true, ePieno(SCADENZA_TOKENS.arancio));
check('rosso: colore pieno su testo bianco', true, ePieno(SCADENZA_TOKENS.rosso));
check('scaduto: colore pieno su testo bianco', true, ePieno(SCADENZA_TOKENS.scaduto));
check('neutro: colore pieno su testo bianco', true, ePieno(SCADENZA_TOKENS.neutro));
check('verde del design system: `bg-emerald-700`', true, SCADENZA_TOKENS.verde.includes('bg-emerald-700'));
check('arancio del design system: `bg-orange-800`', true, SCADENZA_TOKENS.arancio.includes('bg-orange-800'));
check('rosso del design system: `bg-rose-700`', true, SCADENZA_TOKENS.rosso.includes('bg-rose-700'));
// Tre luci, tre tinte: se due token coincidessero il semaforo non sarebbe
// leggibile a colpo d'occhio (rosso vs arancio sono i due più vicini).
check('ogni banda ha una tinta DIVERSA (5 token distinti)', 5, new Set(Object.values(SCADENZA_TOKENS)).size);
check(
  'nessun giallo/ambra fra i token (una sola luce d’avviso media)',
  [],
  Object.entries(SCADENZA_TOKENS)
    .filter(([, token]) => /\b(?:bg-amber|bg-yellow)-/.test(token))
    .map(([banda]) => banda),
);
// Nessuna tinta pastello (…-50 / …-100 / …-200) in nessun token: la direttiva
// §26.75 chiede SOLO colori pieni ad alto contrasto.
check(
  'nessun token pastello (…-50/…-100/…-200)',
  [],
  Object.entries(SCADENZA_TOKENS)
    .filter(([, token]) => /\bbg-\w+-(?:50|100|200)\b/.test(token))
    .map(([banda]) => banda),
);

console.log('\n— 1. Colore = giorni di CALENDARIO mancanti: rosso < 24h · arancio 24–72h · verde ≥ 3 gg —');
const oggi = badgeScadenza(fra(0));
check('scade oggi → etichetta', 'Scade oggi', oggi.label);
check('scade oggi → banda `SCADENZA_TOKENS.rosso`', SCADENZA_TOKENS.rosso, oggi.className);
check('scade oggi → ISO della scadenza per il tooltip', fra(0), oggi.dataRif);
check('nessuna banda pulsa: il pulsare non è un token', false, oggi.className.includes('animate-'));
check(
  'la banda è un token del design system (mai classi composte a mano)',
  true,
  Object.values(SCADENZA_TOKENS).some((t) => t === oggi.className),
);

const domani = badgeScadenza(fra(1));
check('scade domani → etichetta', 'Scade domani', domani.label);
check('scade domani → ARANCIO, non più rosso (§26.89)', SCADENZA_TOKENS.arancio, domani.className);
check('scade domani → non è la luce rossa', false, domani.className === SCADENZA_TOKENS.rosso);

const due = badgeScadenza(fra(2));
check('entro 72h → etichetta', 'Ultime 72h', due.label);
check('entro 72h → arancio (azione richiesta)', SCADENZA_TOKENS.arancio, due.className);

// §26.89 — IL GIALLO NON ESISTE, L'ARANCIO SÌ: dal terzo giorno in poi l'avviso
// è «In corso» (verde), cioè lo stesso verdetto della scheda avviso e del feed.
const tre = badgeScadenza(fra(3));
check('3 giorni → verde (abbondanza, non più allarme)', SCADENZA_TOKENS.verde, tre.className);
check('3 giorni → etichetta di STATO, non un conto alla rovescia', 'In corso', tre.label);
check('nessuna etichetta è un «Scade tra Ng»', false, /Scade tra \d/.test(tre.label));

const sette = badgeScadenza(fra(7));
check('7 giorni → verde', SCADENZA_TOKENS.verde, sette.className);
check('7 giorni → stessa etichetta di stato', 'In corso', sette.label);
check('nessun conto alla rovescia nemmeno a 5 giorni', 'In corso', badgeScadenza(fra(5)).label);

const quindici = badgeScadenza(fra(15));
check('15 giorni → ultimo giorno della finestra di candidatura', SCADENZA_TOKENS.verde, quindici.className);
check('15 giorni → «In corso»', 'In corso', quindici.label);

// OLTRE la finestra la data NON è un termine per candidarsi (fine incarico,
// avvio progetto, chiusura anno scolastico): etichetta dichiarata, MAI verde.
const sedici = badgeScadenza(fra(16));
check('16 giorni → mai verde', false, sedici.className === SCADENZA_TOKENS.verde);
check('16 giorni → etichetta dichiarata', 'Scadenza fuori finestra', sedici.label);
check('16 giorni → banda neutra', SCADENZA_TOKENS.neutro, sedici.className);

const lontano = badgeScadenza(fra(30));
check('30 giorni → etichetta', 'Scadenza fuori finestra', lontano.label);
check('30 giorni → neutro (nessuna finzione di «In corso»)', SCADENZA_TOKENS.neutro, lontano.className);
check('30 giorni → ISO della scadenza per il tooltip', fra(30), lontano.dataRif);

console.log('\n— 2. Senza scadenza NON si inventa nulla (mai la pubblicazione) —');
const assente = badgeScadenza(null);
check('null → banda neutra piena (ardesia)', true, assente.className.includes('bg-slate-600'));
check('null → etichetta dichiarata', 'Scadenza n/d', assente.label);
check('null → fonte «nessuna»', 'nessuna', assente.fonte);
check('null → nessun colore d’allarme', false, /bg-(rose|orange|amber|emerald)-/.test(assente.className));
check('null → nessun pulsare', false, assente.className.includes('animate-pulse'));
check('stringa vuota → stessa banda', 'Scadenza n/d', badgeScadenza('').label);
check('soli spazi → stessa banda', 'Scadenza n/d', badgeScadenza('   ').label);
check('undefined → stessa banda', 'Scadenza n/d', badgeScadenza(undefined).label);

const sporca = badgeScadenza('non-una-data');
check('data non parsabile → dichiarata, non colorata', 'Scadenza non valida', sporca.label);
check('data non parsabile → mai rossa', false, sporca.className === SCADENZA_TOKENS.rosso);
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
check('scadenza di ieri → ardesia (nessun allarme su un avviso chiuso)', SCADENZA_TOKENS.scaduto, ieri.className);
const senzaScadenza = badgeScadenza(null);
check('riga senza scadenza → mai «In corso»', false, senzaScadenza.label === 'In corso');
check('riga senza scadenza → mai una banda di colore', 'nessuna', senzaScadenza.fonte);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ BADGE SCADENZA: colore dai giorni mancanti, nessun surrogato quando la data manca.'
    : `\n❌ BADGE SCADENZA: ${errori} errore/i.`,
);
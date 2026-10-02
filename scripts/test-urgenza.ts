/**
 * ScuoleRadar.it — GUARDIA URGENZA del «Radar Live» (helper `src/lib/urgency.ts`).
 *
 * Il tabellone pubblico colora la colonna «Scadenza» con una banda a 5 colori:
 * la scala deve essere MONOTONA (più giorni mancano, meno il colore allarma),
 * l'unica banda che pulsa è «Scade oggi» e il conteggio dei giorni resta per
 * GIORNO — le scadenze reali arrivano a mezzanotte UTC e un calcolo a ore
 * anticiperebbe di un giorno l'allarme («Ultime 48h» su una scadenza di domani).
 *
 * Uso: npm run test:urgenza (incluso in `npm test`)
 */
import {
  SOGLIA_ENTRO_3_GIORNI,
  SOGLIA_ENTRO_7_GIORNI,
  SOGLIA_ULTIME_48H,
  calcolaUrgenza,
} from '../src/lib/urgency';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** OGGI fisso per test deterministici: 2026-09-29. */
const OGGI = new Date('2026-09-29T12:00:00');

/** Scadenza a `giorni` da OGGI, in formato data pura (`YYYY-MM-DD`), senza fusi. */
const fra = (giorni: number): string => {
  const d = new Date(OGGI);
  d.setDate(d.getDate() + giorni);
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
};

console.log('— 1. Le cinque bande richieste dal tabellone —');
const scaduto = calcolaUrgenza(fra(-1), OGGI);
check('scaduto ieri → «Concluso»', 'concluso', scaduto.banda);
check('scaduto ieri → etichetta', 'Concluso', scaduto.label);
check('scaduto ieri → grigio', true, scaduto.className.includes('slate'));
check('scaduto ieri → nessuna pulsazione', false, scaduto.className.includes('animate-pulse'));

const oggi = calcolaUrgenza(fra(0), OGGI);
check('scade oggi → banda «oggi»', 'oggi', oggi.banda);
check('scade oggi → etichetta', 'Scade oggi', oggi.label);
check('scade oggi → rosso', true, oggi.className.includes('bg-red-600'));
check('scade oggi → UNICA banda che pulsa', true, oggi.className.includes('animate-pulse'));

const due = calcolaUrgenza(fra(2), OGGI);
check('domani e dopodomani → «ultime48»', 'ultime48', calcolaUrgenza(fra(1), OGGI).banda);
check('dopodomani → ancora «ultime48»', 'ultime48', due.banda);
check('ultime 48h → etichetta', 'Ultime 48h', due.label);
check('ultime 48h → rosso', true, due.className.includes('bg-red-600'));
check('ultime 48h → senza pulsazione (pulsa solo «scade oggi»)', false, due.className.includes('animate-pulse'));

const tre = calcolaUrgenza(fra(3), OGGI);
check('3 giorni → banda «entro3»', 'entro3', tre.banda);
check('3 giorni → arancio', true, tre.className.includes('bg-orange-500'));
check('3 giorni → etichetta compatta', 'Scade tra 3g', tre.label);

const sette = calcolaUrgenza(fra(7), OGGI);
check('4 giorni → banda «entro7»', 'entro7', calcolaUrgenza(fra(4), OGGI).banda);
check('7 giorni → ancora «entro7»', 'entro7', sette.banda);
check('entro 7 giorni → giallo', true, sette.className.includes('bg-amber-500'));
check('entro 7 giorni → etichetta compatta', 'Scade tra 7g', sette.label);

const lungo = calcolaUrgenza(fra(8), OGGI);
check('8 giorni → banda «inCorso»', 'inCorso', lungo.banda);
check('30 giorni → ancora «inCorso»', 'inCorso', calcolaUrgenza(fra(30), OGGI).banda);
check('in corso → verde', true, lungo.className.includes('bg-emerald-600'));
check('in corso → etichetta', 'In corso', lungo.label);

console.log('\n— 2. Soglie esportate (una sola verità, nessun numero sparso) —');
check('soglia ultime 48h = 2 giorni', 2, SOGLIA_ULTIME_48H);
check('soglia entro 3 giorni = 3', 3, SOGLIA_ENTRO_3_GIORNI);
check('soglia entro 7 giorni = 7', 7, SOGLIA_ENTRO_7_GIORNI);

console.log('\n— 3. Scala MONOTONA: il colore non allarma mai più del dovuto —');
const bande = Array.from({ length: 11 }, (_, k) => calcolaUrgenza(fra(k - 1), OGGI).banda);
check(
  'dallo scaduto all’in corso la banda non torna mai indietro',
  ['concluso', 'oggi', 'ultime48', 'ultime48', 'entro3', 'entro7', 'entro7', 'entro7', 'entro7', 'inCorso', 'inCorso'],
  bande,
);
check(
  'una sola pulsazione in tutta la scala',
  1,
  Array.from({ length: 11 }, (_, k) => calcolaUrgenza(fra(k - 1), OGGI)).filter((u) =>
    u.className.includes('animate-pulse'),
  ).length,
);

console.log('\n— 4. Le scadenze reali arrivano a mezzanotte UTC: mai un giorno in anticipo —');
check(
  'scadenza reale di dopodomani (`T00:00:00+00:00`) → «ultime48», non «oggi»',
  'ultime48',
  calcolaUrgenza(`${fra(2)}T00:00:00+00:00`, OGGI).banda,
);
check(
  'scadenza di oggi alle 23:00 UTC → «Scade oggi» (confronto per GIORNO)',
  'oggi',
  calcolaUrgenza(`${fra(0)}T23:00:00+00:00`, OGGI).banda,
);
check('ISO con orario a 3 giorni → «entro3»', 'entro3', calcolaUrgenza(`${fra(3)}T00:00:00+00:00`, OGGI).banda);

console.log('\n— 5. Nessun input rompe la funzione (righe senza scadenza dichiarate) —');
const assente = calcolaUrgenza(null, OGGI);
check('scadenza assente → «sconosciuto»', 'sconosciuto', assente.banda);
check('scadenza assente → etichetta dichiarata', 'Scadenza n/d', assente.label);
check('scadenza assente → grigio chiaro', true, assente.className.includes('bg-slate-100'));
check('stringa vuota → «sconosciuto»', 'sconosciuto', calcolaUrgenza('', OGGI).banda);
check('data non valida → «sconosciuto»', 'sconosciuto', calcolaUrgenza('non-una-data', OGGI).banda);
check('nessuna banda sconosciuta pulsa', false, assente.className.includes('animate-pulse'));

console.log('\n──────────────────────────────────────────────────────────');
console.log(errori === 0 ? '✅ URGENZA: bande coerenti e monotone' : `❌ URGENZA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

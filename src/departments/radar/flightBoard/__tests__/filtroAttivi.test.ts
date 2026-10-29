/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: FILTRO di lettura della bacheca.
 *
 * Dal §26.100 (direttiva 28/10/2026) la bacheca pubblica mostra il volume ATTIVO
 * completo: la regola di lettura è `eOpportunitaAperta` (`src/lib/scadenza.ts`) —
 * scadenza dichiarata, leggibile e non ancora passata — **senza tetto in avanti**,
 * e il filtro PostgREST è il suo gemello a un solo estremo:
 *
 *   expiration_date.gte.<oggi>
 *
 * Fino al §26.99 lo stesso filtro aveva anche `lte.<oggi+15>` (finestra di
 * candidatura, §26.82) e la finestra nascondeva opportunità vere: un bando che
 * scade fra un mese è aperto, e il tabellone sembrava più povero del database.
 * Qui si fissano le invarianti:
 *
 *   1. il REQUISITO della data resta (§26.71): senza una `expiration_date`
 *      dichiarata la riga non entra — nessun ramo `is.null`, che riammetterebbe
 *      indicatori di classi di concorso e pagine di archivio;
 *   2. nessun tetto in avanti: nessun `lte`, nessun `and(...)`, nessun ramo
 *      `created_at` (la finestra dei 60 giorni non è mai stata una porta
 *      d'ingresso della vetrina);
 *   3. la finestra di candidatura NON è sparita dal prodotto: `eOpportunitaConScadenza`
 *      la applica ancora al FEED e al matching (§26.82), e qui si verifica che le
 *      due regole restino distinte ma coerenti (chi passa la finestra passa anche
 *      la vetrina, mai il contrario);
 *   4. la data LOCALE, mai UTC: alle 00:30 di Roma `toISOString()` darebbe ieri e
 *      gli avvisi che scadono oggi uscirebbero dal tabellone.
 *
 * Uso: npm run test:board:filtro  (incluso in `npm test`)
 */
import { eOpportunitaAperta, eOpportunitaConScadenza } from '@/lib/scadenza';
import { preparaRigheBoard } from '@/lib/liveBoard';
import { GIORNI_ORIZZONTE_OPPORTUNITA, dataIsoLocale, filtroAttivi } from '../filtroAttivi';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Data fissa: 29 settembre 2026, ore 14:30 locali. */
const OGGI = new Date(2026, 8, 29, 14, 30);

console.log('— 1. La bacheca: scadenza dichiarata e non passata, SENZA tetto in avanti —');
check('senza scadenza NON è un’opportunità aperta', false, eOpportunitaAperta(null, OGGI));
check('scadenza vuota NON è un’opportunità aperta', false, eOpportunitaAperta('   ', OGGI));
check('scadenza non leggibile NON è un’opportunità aperta', false, eOpportunitaAperta('non-una-data', OGGI));
check('scadenza di ieri NON è un’opportunità aperta', false, eOpportunitaAperta('2026-09-28', OGGI));
check('scadenza di oggi È un’opportunità aperta', true, eOpportunitaAperta('2026-09-29', OGGI));
check('scadenza futura È un’opportunità aperta', true, eOpportunitaAperta('2026-10-10', OGGI));
// §26.100 — IL TETTO IN AVANTI NON ESISTE PIÙ: un bando che scade fra un mese o
// a fine anno scolastico è ancora APERTO, quindi resta in vetrina (banda blu
// «Scadenza lontana», non una riga nascosta).
check('a 16 giorni È un’opportunità aperta (nessun tetto)', true, eOpportunitaAperta('2026-10-15', OGGI));
check('a 90 giorni È un’opportunità aperta', true, eOpportunitaAperta('2026-12-28', OGGI));
check('«scadenza» 2027 È un’opportunità aperta (la riga non sparisce più)', true, eOpportunitaAperta('2027-06-30', OGGI));

console.log('\n— 1-bis. La finestra di CANDIDATURA resta al feed e al matching (§26.82) —');
check('feed: oggi dentro la finestra', true, eOpportunitaConScadenza('2026-09-29', OGGI));
check('feed: 15 giorni è il bordo della finestra', true, eOpportunitaConScadenza('2026-10-14', OGGI));
check('feed: 16 giorni è fuori finestra (promessa del feed, non della vetrina)', false, eOpportunitaConScadenza('2026-10-15', OGGI));
check('feed: la finestra resta un parametro, non un numero sparso', false, eOpportunitaConScadenza('2026-10-15', OGGI, 14));
check('feed: la finestra è dichiarata: 15 giorni', 15, GIORNI_ORIZZONTE_OPPORTUNITA);
// COERENZA fra le due porte: chi è candidabile adesso è anche in vetrina; il
// contrario no (la vetrina è più larga, mai più stretta).
const date = ['2026-09-28', '2026-09-29', '2026-10-05', '2026-10-14', '2026-10-15', '2027-06-30', null];
check(
  'ogni riga del feed è anche in vetrina (la vetrina non è più stretta)',
  [],
  date.filter((d) => eOpportunitaConScadenza(d, OGGI) && !eOpportunitaAperta(d, OGGI)),
);
check(
  'la vetrina è più larga del feed (16 giorni e 2027)',
  ['2026-10-15', '2027-06-30'],
  date.filter((d) => eOpportunitaAperta(d, OGGI) && !eOpportunitaConScadenza(d, OGGI)),
);

console.log('\n— 1-ter. La VETRINA in memoria segue la stessa regola (`preparaRigheBoard`) —');
/**
 * Riga minima del tabellone, con la scadenza a `giorni` da OGGI REALE: il gate in
 * memoria usa il proprio orologio (`new Date()`), quindi un ancoraggio fisso
 * farebbe invecchiare il caso — la stessa scelta della demo (`demoInterpelli`).
 */
function rigaBoard(id: string, giorni: number | null) {
  const adesso = new Date();
  const data = new Date(adesso);
  if (giorni !== null) data.setDate(data.getDate() + giorni);
  return {
    id,
    title: `Interpello A-022 Matematica — ${id}`,
    school_name: 'Istituto Comprensivo Carducci',
    province: 'MI',
    expiration_date: giorni === null ? null : dataIsoLocale(data),
    created_at: dataIsoLocale(adesso),
    source_url: 'https://www.iccarducci.edu.it/avvisi/interpello',
  };
}
const vetrina = preparaRigheBoard([
  rigaBoard('oltre-orizzonte', 30),
  rigaBoard('senza-data', null),
  rigaBoard('scaduta', -1),
  rigaBoard('domani', 1),
]);
check(
  'in vetrina restano solo le righe aperte — anche quella oltre l’orizzonte (§26.100)',
  ['oltre-orizzonte', 'domani'],
  vetrina.map((p) => p.riga.id),
);
check('la riga a 30 giorni NON è verde «In corso» né nascosta: resta', 1, vetrina.filter((p) => p.riga.id === 'oltre-orizzonte').length);

console.log('\n— 2. Sintassi PostgREST: un solo estremo, nessuna riga senza scadenza —');
const filtro = filtroAttivi(OGGI);
check('espressione completa (solo il giorno corrente)', 'expiration_date.gte.2026-09-29', filtro);
check('nessun tetto in avanti: nessun `lte`', false, filtro.includes('lte'));
check('nessun `and(...)`: un solo ramo', false, filtro.includes('and('));
check('nessun ramo `is.null` che riammetta le righe non datate', false, filtro.includes('is.null'));
check('nessun `created_at`: la finestra dei 60 giorni è ritirata', false, filtro.includes('created_at'));
check(
  'la scadenza esclude da sé le righe senza data (null ≥ x non è vero)',
  true,
  filtro.includes('expiration_date.gte.'),
);
check(
  'nessun OR di primo livello: una sola popolazione di avvisi',
  false,
  filtro.includes('or('),
);

console.log('\n— 3. Fuso orario: la data è quella di ROMA, non quella UTC —');
check('29/09/2026 ore 00:30 locali = 29/09, non il 28', '2026-09-29', dataIsoLocale(new Date('2026-09-29T00:30:00')));
check('ultimo minuto dell’anno', '2026-12-31', dataIsoLocale(new Date(2026, 11, 31, 23, 59)));
check('mese e giorno a due cifre', '2026-01-05', dataIsoLocale(new Date(2026, 0, 5, 8, 0)));
check(
  'la data del filtro è quella locale anche a cavallo di mezzanotte',
  'expiration_date.gte.2026-09-29',
  filtroAttivi(new Date('2026-09-29T00:30:00')),
);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ FILTRO RADAR LIVE: tutte le opportunità aperte, conteggio e lettura sulla stessa popolazione.'
    : `\n❌ FILTRO RADAR LIVE: ${errori} errore/i.`,
);

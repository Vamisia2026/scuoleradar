/**
 * ScuoleRadar.it — «Radar Live» su SCALA NAZIONALE: due garanzie di prodotto.
 *
 * Il tabellone non è più un elenco locale corto: qui si fissano le due regole che
 * lo tengono vivo quando la banca dati cresce (direttiva cliente 29/09/2026).
 *
 *   1. FINESTRA 60 GIORNI — un avviso che la fonte pubblica SENZA scadenza resta
 *      in bacheca se è stato creato negli ultimi 60 giorni (`scadenza: null`,
 *      `senzaScadenza: true`): mai una data inventata che poi verrebbe letta come
 *      una scadenza vera, mai un avviso perso in silenzio. Fuori finestra, senza
 *      data di pubblicazione, o con una scadenza ESPLICITA già passata: scartato.
 *   2. DIVERSITÀ GEOGRAFICA — le righe preparate si alternano per provincia
 *      (`diversificaProvince`): una provincia con molte pubblicazioni non occupa
 *      le prime pagine, e dentro ogni provincia l'ordine di arrivo (cronologia
 *      decrescente decisa dalla query) resta intatto.
 *
 * Uso: npm run test:board:scala  (incluso in `npm test`)
 * La vetrina (nomi istituto reali, codici mai in bacheca) è in `npm run test:board`.
 */
import { diversificaProvince, preparaRigheBoard } from '../src/lib/liveBoard.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const FUTURO = '2099-12-31';

/** Riga di prova: nome istituto REALE (supera il gate di vetrina), campi sovrascrivibili. */
interface RigaProva {
  id: string;
  title: string;
  school_name: string;
  province: string;
  expiration_date: string | null;
  created_at?: string;
}

function riga(campi: Partial<RigaProva> & { id: string }): RigaProva {
  return {
    title: 'Interpello supplenza — Liceo Scientifico Galilei',
    school_name: 'Liceo Scientifico Galilei',
    province: 'RM',
    expiration_date: FUTURO,
    ...campi,
  };
}

/** Data di pubblicazione (`n` giorni fa) calcolata a runtime: il test non scade. */
const giorniFa = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString();

console.log('— 1. Finestra dei 60 giorni: gli avvisi che la fonte NON data —');
const senzaData = preparaRigheBoard([
  riga({ id: 'recente-10g', expiration_date: null, created_at: giorniFa(10) }),
  riga({ id: 'al-limite-59g', expiration_date: null, created_at: giorniFa(59) }),
  riga({ id: 'fuori-finestra-61g', expiration_date: null, created_at: giorniFa(61) }),
  riga({ id: 'senza-data', expiration_date: null }),
  riga({ id: 'scaduto-con-data', expiration_date: '2020-01-31', created_at: giorniFa(1) }),
]);

check(
  'senza scadenza ma pubblicati da 10 e 59 giorni: ENTRANO',
  ['recente-10g', 'al-limite-59g'],
  senzaData.map((p) => p.riga.id),
);
check(
  'la scadenza mancante non diventa mai una data finta',
  [null, null],
  senzaData.map((p) => p.scadenza),
);
check(
  'le righe della finestra sono marcate `senzaScadenza`',
  [true, true],
  senzaData.map((p) => p.senzaScadenza),
);
check(
  'fuori finestra (61 giorni fa): SCARTATA',
  false,
  senzaData.some((p) => p.riga.id === 'fuori-finestra-61g'),
);
check(
  'senza scadenza E senza data di pubblicazione: SCARTATA',
  false,
  senzaData.some((p) => p.riga.id === 'senza-data'),
);
check(
  'scadenza esplicita già passata: mai in bacheca, nemmeno se pubblicato ieri',
  false,
  senzaData.some((p) => p.riga.id === 'scaduto-con-data'),
);
check(
  'con scadenza vera: riga non marcata e data intatta',
  [{ senzaScadenza: false, scadenza: FUTURO }],
  preparaRigheBoard([riga({ id: 'scadenza-vera' })]).map((p) => ({
    senzaScadenza: p.senzaScadenza,
    scadenza: p.scadenza,
  })),
);

console.log('\n— 2. Diversità geografica: nessuna provincia monopolizza le prime pagine —');
const monopolio = preparaRigheBoard([
  riga({ id: 'pd1', province: 'PD' }),
  riga({ id: 'pd2', province: 'PD' }),
  riga({ id: 'pd3', province: 'PD' }),
  riga({ id: 'pd4', province: 'PD' }),
  riga({ id: 'mi1', province: 'MI' }),
  riga({ id: 'rm1', province: 'RM' }),
  riga({ id: 'ba1', province: 'BA' }),
  riga({ id: 'to1', province: 'TO' }),
]);
check(
  'senza alternanza una sola provincia occupa le prime 4 righe',
  ['pd1', 'pd2', 'pd3', 'pd4'],
  monopolio.slice(0, 4).map((p) => p.riga.id),
);

const diverse = diversificaProvince(monopolio);
check(
  'con l’alternanza le prime 4 righe sono 4 province diverse',
  ['pd1', 'mi1', 'rm1', 'ba1'],
  diverse.slice(0, 4).map((p) => p.riga.id),
);
check(
  'la prima pagina (5 righe) tocca 5 province diverse',
  5,
  new Set(diverse.slice(0, 5).map((p) => p.riga.province)).size,
);
check(
  'la coda della provincia più numerosa resta in ordine di arrivo',
  ['pd2', 'pd3', 'pd4'],
  diverse.slice(5).map((p) => p.riga.id),
);
check('nessuna riga persa nell’alternanza', monopolio.length, diverse.length);
check(
  'una sola provincia: ordine invariato',
  ['pd1', 'pd2', 'pd3'],
  diversificaProvince(
    preparaRigheBoard([
      riga({ id: 'pd1', province: 'PD' }),
      riga({ id: 'pd2', province: 'PD' }),
      riga({ id: 'pd3', province: 'PD' }),
    ]),
  ).map((p) => p.riga.id),
);
check(
  'codice provincia in minuscolo: stesso gruppo, nessuna riga doppia',
  ['a', 'b'],
  diversificaProvince(
    preparaRigheBoard([riga({ id: 'a', province: 'pd' }), riga({ id: 'b', province: 'PD' })]),
  ).map((p) => p.riga.id),
);
check(
  'provincia assente: righe raggruppate insieme, mai scartate',
  2,
  diversificaProvince(
    preparaRigheBoard([riga({ id: 'x1', province: '' }), riga({ id: 'x2', province: '' })]),
  ).length,
);
check('diversità su lista vuota', 0, diversificaProvince([]).length);
check('diversità su input nullo', 0, diversificaProvince(null).length);
check('preparaRigheBoard su input nullo', 0, preparaRigheBoard(null).length);

console.log(
  errori === 0
    ? '\n✅ RADAR LIVE SU SCALA: finestra 60 giorni e alternanza per provincia.'
    : `\n❌ RADAR LIVE SU SCALA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

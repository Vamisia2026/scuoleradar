/**
 * ScuoleRadar.it — «Radar Live» su SCALA NAZIONALE: due garanzie di prodotto.
 *
 * Il tabellone non è più un elenco locale corto: qui si fissano le due regole che
 * lo tengono vivo quando la banca dati cresce (direttiva cliente 29/09/2026),
 * aggiornate dalla **regola ferrea della scadenza** (§26.71, 16/10/2026).
 *
 *   1. SOLO OPPORTUNITÀ CON SCADENZA — in vetrina entra una riga con una
 *      `expiration_date` dichiarata e non ancora passata. La finestra dei 60 giorni
 *      per gli avvisi che la fonte NON data è ritirata: nei dati reali erano pagine
 *      di archivio, regolamenti e indici di classi di concorso, e facevano
 *      sembrare «attivi» avvisi che non si candidano. Scartate anche le righe con
 *      una scadenza ESPLICITA già passata: mai una data inventata.
 *   2. DIVERSITÀ GEOGRAFICA — le righe preparate si alternano per provincia
 *      (`diversificaProvince`): una provincia con molte pubblicazioni non occupa
 *      le prime pagine, e dentro ogni provincia l'ordine di arrivo (cronologia
 *      decrescente decisa dalla query) resta intatto. L'ordine dei GRUPPI è
 *      mescolato con il SEME DEL GIORNO (§26.72, 15/10/2026): stabile per tutta
 *      la giornata (la paginazione non cambia sotto il dito dell'utente) e diverso
 *      da un giorno all'altro (il tabellone ruota sull'Italia). Il giorno è
 *      INIETTABILE (`oggi`), quindi qui il test resta deterministico.
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

console.log('— 1. Regola ferrea: senza una scadenza valida la riga NON è un’opportunità —');
const senzaData = preparaRigheBoard([
  riga({ id: 'recente-10g', expiration_date: null, created_at: giorniFa(10) }),
  riga({ id: 'al-limite-59g', expiration_date: null, created_at: giorniFa(59) }),
  riga({ id: 'fuori-finestra-61g', expiration_date: null, created_at: giorniFa(61) }),
  riga({ id: 'senza-data', expiration_date: null }),
  riga({ id: 'scaduto-con-data', expiration_date: '2020-01-31', created_at: giorniFa(1) }),
  riga({ id: 'scadenza-futura' }),
]);

check(
  'l’unica riga ammessa è quella con una scadenza futura',
  ['scadenza-futura'],
  senzaData.map((p) => p.riga.id),
);
check(
  'senza scadenza pubblicato ieri: FUORI (la finestra dei 60 giorni è ritirata)',
  false,
  senzaData.some((p) => p.riga.id === 'recente-10g' || p.riga.id === 'al-limite-59g'),
);
check(
  'scadenza esplicita già passata: mai in bacheca, nemmeno se pubblicato ieri',
  false,
  senzaData.some((p) => p.riga.id === 'scaduto-con-data'),
);
check(
  'nessuna riga in vetrina senza data: mai «Scadenza n/d» (§26.71)',
  [],
  senzaData.filter((p) => !p.scadenza).map((p) => p.riga.id),
);
check(
  'la scadenza dichiarata resta intatta (mai una data riscritta)',
  [{ scadenza: FUTURO }],
  senzaData.map((p) => ({ scadenza: p.scadenza })),
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

/** Giorno FISSO del test: l'ordine dei gruppi deriva dal seme del giorno. */
const GIORNO = new Date(2026, 9, 15, 12, 0, 0); // 15/10/2026

const diverse = diversificaProvince(monopolio, GIORNO);
check(
  'con l’alternanza le prime 4 righe sono di 4 province diverse',
  4,
  new Set(diverse.slice(0, 4).map((p) => p.riga.province)).size,
);
check(
  'la prima riga di OGNI provincia apre la prima pagina',
  ['BA', 'MI', 'PD', 'RM'],
  [...new Set(diverse.slice(0, 4).map((p) => p.riga.province))].sort(),
);
check(
  'la prima pagina (5 righe) tocca 5 province diverse',
  5,
  new Set(diverse.slice(0, 5).map((p) => p.riga.province)).size,
);
check(
  'dentro ogni provincia l’ordine di arrivo resta intatto',
  ['pd1', 'pd2', 'pd3', 'pd4'],
  diverse.filter((p) => p.riga.province === 'PD').map((p) => p.riga.id),
);
check('nessuna riga persa nell’alternanza', monopolio.length, diverse.length);

// ── Seme del giorno: la paginazione non si muove durante la giornata, il
//    tabellone ruota da un giorno all'altro.
const idOrdine = (giorno: Date): string =>
  diversificaProvince(monopolio, giorno)
    .map((p) => p.riga.id)
    .join(' ');
check(
  'stesso giorno, ore diverse: stesso tabellone (paginazione stabile)',
  true,
  idOrdine(new Date(2026, 9, 15, 0, 5, 0)) === idOrdine(new Date(2026, 9, 15, 23, 55, 0)),
);
check(
  'mescolamento deterministico: stessa data ⇒ stesso ordine (test riproducibile)',
  true,
  idOrdine(GIORNO) === idOrdine(new Date(2026, 9, 15, 12, 0, 0)),
);
const ordiniPrimaPagina = new Set<string>();
const testeDelMese = new Set<string>();
for (let i = 0; i < 30; i += 1) {
  const ordinato = diversificaProvince(monopolio, new Date(2026, 9, 1 + i, 12, 0, 0));
  ordiniPrimaPagina.add(
    ordinato
      .slice(0, 4)
      .map((p) => p.riga.province)
      .join('-'),
  );
  testeDelMese.add(ordinato[0].riga.province ?? '');
}
check(
  'in un mese il tabellone ruota su molti ordini di provincia (non sempre lo stesso)',
  true,
  ordiniPrimaPagina.size >= 10,
);
check(
  'nessuna provincia resta incollata in testa al tabellone',
  true,
  testeDelMese.size >= 3,
);
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
    ? '\n✅ RADAR LIVE SU SCALA: solo opportunità con scadenza, alternanza per provincia, rotazione giornaliera.'
    : `\n❌ RADAR LIVE SU SCALA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

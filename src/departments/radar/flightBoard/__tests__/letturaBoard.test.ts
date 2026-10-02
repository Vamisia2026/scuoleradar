/**
 * ScuoleRadar.it — Dipartimento Radar · Flight Board: LETTURA a pagine della bacheca.
 *
 * Il bug che questo test blocca: la bacheca leggeva gli avvisi con UNA query.
 * Supabase/PostgREST non consegna più di `max-rows` righe per richiesta, quindi
 * oltre quel tetto gli avvisi sparivano **in silenzio** — e con l'ordinamento per
 * pubblicazione decrescente sparivano proprio i più vecchi. Qui si fissano:
 *
 *   1. la geometria delle pagine (`intervalloPagina`): finestre sempre larghe
 *      `RIGHE_PER_PAGINA_QUERY`, con l'offset che riprende da quante righe il
 *      server ha DAVVERO consegnato (non da quante ne sono state chieste): con un
 *      `max-rows` a 500 avanzare di 1.000 salterebbe le righe in mezzo;
 *   2. la lettura completa: più pagine finché non finiscono le righe, con la
 *      stessa scala in tabellone del database (2.500 righe = 2.500 righe);
 *   3. la sentinella di fine: una pagina VUOTA, non una pagina «corta». Un
 *      `max-rows` server più basso (500) è la normalità, non la fine dei dati:
 *      è esattamente il caso che prima troncava la vetrina;
 *   4. il conteggio esatto (`attese`) chiude la lettura appena raggiunto: nessuna
 *      richiesta di troppo e nessuna pagina «corta» interpretata come fine;
 *   5. le guardie: mai un ciclo infinito (limite di pagine) né righe doppie
 *      (chiave ripetuta), e in caso di errore si conserva quel che si è letto
 *      dichiarando che la lettura NON è esaustiva.
 *
 * Uso: npm run test:board:lettura  (incluso in `npm test`)
 */
import {
  MAX_PAGINE_LETTURA,
  RIGHE_PER_PAGINA_QUERY,
  intervalloPagina,
  leggiTutteLePagine,
  type RispostaPagina,
} from '../letturaBoard';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

interface RigaFinta {
  id: string;
}

/** `n` righe finte con id contigui: l'ordine del tabellone è quello del database. */
function righeFinte(n: number): RigaFinta[] {
  return Array.from({ length: n }, (_, i) => ({ id: `r-${String(i).padStart(5, '0')}` }));
}

/**
 * Client finto deterministico. `tettoServer` simula il `max-rows` di PostgREST:
 * anche chiedendo 1.000 righe, il server ne consegna al massimo `tettoServer`.
 */
function clientFinto(righe: RigaFinta[], tettoServer = RIGHE_PER_PAGINA_QUERY) {
  const richieste: string[] = [];
  const chiediPagina = async (da: number, a: number): Promise<RispostaPagina<RigaFinta>> => {
    richieste.push(`${da}-${a}`);
    const dimensione = Math.min(a - da + 1, tettoServer);
    return { data: righe.slice(da, da + dimensione), error: null };
  };
  return { richieste, chiediPagina };
}

const chiave = (r: RigaFinta): string => r.id;

console.log('— 1. Geometria delle pagine: finestre piene, mai affettate lato client —');
check('righe per richiesta: il massimo di PostgREST', 1_000, RIGHE_PER_PAGINA_QUERY);
check('prima finestra', { da: 0, a: 999 }, intervalloPagina(0));
check('dopo 1.000 righe consegnate', { da: 1000, a: 1999 }, intervalloPagina(1000));
check(
  'dopo 500 righe consegnate (server con max-rows 500): riprende dal 500° posto, non dal 1.000°',
  { da: 500, a: 1499 },
  intervalloPagina(500),
);
check('posizione negativa riportata a zero', { da: 0, a: 999 }, intervalloPagina(-3));

console.log('\n— 2. Lettura completa: la bacheca copre TUTTO il database —');
const venticinque = righeFinte(2_500);
const pieno = clientFinto(venticinque);
const lettura = await leggiTutteLePagine({ chiediPagina: pieno.chiediPagina, chiave, attese: 2_500 });
check('2.500 avvisi in database = 2.500 righe in tabellone', 2_500, lettura.righe.length);
check('nessuna riga persa per strada', 2_500, new Set(lettura.righe.map(chiave)).size);
check('righe nell’ordine del database', 'r-00000', lettura.righe[0]?.id);
check('ultima riga presente', 'r-02499', lettura.righe[2_499]?.id);
check('conteggio raggiunto: nessuna pagina di troppo', 3, lettura.pagineLette);
check('pagine richieste', ['0-999', '1000-1999', '2000-2999'], pieno.richieste);
check('lettura esaustiva', true, lettura.esaustiva);
check('nessun doppione', 0, lettura.duplicati);
check('nessun errore', null, lettura.errore);

console.log('\n— 3. Sentinella di fine: pagina VUOTA, non pagina corta —');
const senzaConteggio = clientFinto(venticinque);
const esaustiva = await leggiTutteLePagine({ chiediPagina: senzaConteggio.chiediPagina, chiave });
check('senza conteggio: si legge finché non arriva la pagina vuota', 2_500, esaustiva.righe.length);
check('la pagina vuota è la quarta richiesta', 4, esaustiva.pagineLette);
check('comunque esaustiva', true, esaustiva.esaustiva);

console.log('\n— 4. Il bug vero: server con max-rows 500 — mai più troncamenti muti —');
const cap500 = clientFinto(venticinque, 500);
const conTetto = await leggiTutteLePagine({ chiediPagina: cap500.chiediPagina, chiave, attese: 2_500 });
check('conteggio disponibile: tutte le 2.500 righe nonostante il tetto a 500', 2_500, conTetto.righe.length);
check('nessuna riga saltata in mezzo', 2_500, new Set(conTetto.righe.map(chiave)).size);
check(
  'finestre richieste: l’offset avanza di 500, non di 1.000',
  ['0-999', '500-1499', '1000-1999', '1500-2499', '2000-2999'],
  cap500.richieste,
);
check('5 pagine piene da 500', 5, conTetto.pagineLette);
check('esaustiva: la scala del tabellone è quella del database', true, conTetto.esaustiva);
const cap500SenzaConteggio = clientFinto(venticinque, 500);
const senzaTetto = await leggiTutteLePagine({ chiediPagina: cap500SenzaConteggio.chiediPagina, chiave });
check('senza conteggio: la pagina corta NON è la fine', 2_500, senzaTetto.righe.length);
check('sesta richiesta vuota = fine dichiarata', 6, senzaTetto.pagineLette);
check('esaustiva', true, senzaTetto.esaustiva);

console.log('\n— 5. Guardia anti-anello: mai un ciclo infinito —');
const infinito = async (da: number, a: number): Promise<RispostaPagina<RigaFinta>> => ({
  data: Array.from({ length: a - da + 1 }, (_, i) => ({ id: `x-${da + i}` })),
  error: null,
});
const allInfinito = await leggiTutteLePagine({ chiediPagina: infinito, chiave });
check('limite di pagine dichiarato', 50, MAX_PAGINE_LETTURA);
check('la lettura si ferma al limite', MAX_PAGINE_LETTURA, allInfinito.pagineLette);
check('righe lette = 50 pagine piene', 50_000, allInfinito.righe.length);
check('non esaustiva: lo dichiara invece di tacere', false, allInfinito.esaustiva);
check('nessun errore: è una guardia, non un guasto', null, allInfinito.errore);

console.log('\n— 6. Server che ignora l’offset: nessuna riga doppia, nessun anello —');
const fermo = righeFinte(1_000);
const nonAvanza = await leggiTutteLePagine({
  chiediPagina: async () => ({ data: fermo, error: null }),
  chiave,
});
check('la pagina ripetuta non entra due volte', 1_000, nonAvanza.righe.length);
check('doppioni contati e scartati', 1_000, nonAvanza.duplicati);
check('due richieste: si ferma appena capisce che non avanza', 2, nonAvanza.pagineLette);
check('non esaustiva', false, nonAvanza.esaustiva);

console.log('\n— 7. Errore a metà: si tiene il letto e si dichiara la verità —');
const metaRotta = async (da: number): Promise<RispostaPagina<RigaFinta>> => {
  if (da === 0) return { data: righeFinte(1_000), error: null };
  return { data: null, error: { message: 'timeout' } };
};
const parziale = await leggiTutteLePagine({ chiediPagina: metaRotta, chiave, attese: 2_500 });
check('le righe lette restano in tabellone', 1_000, parziale.righe.length);
check('una sola pagina letta', 1, parziale.pagineLette);
check('errore restituito', 'timeout', parziale.errore);
check('non esaustiva: il `+` dell’etichetta resta vero', false, parziale.esaustiva);

console.log('\n— 8. Bacheca vuota: zero avvisi attivi, zero richieste —');
const vuoto = await leggiTutteLePagine<RigaFinta>({
  chiediPagina: async () => {
    throw new Error('la lettura non deve nemmeno partire con zero avvisi');
  },
  chiave,
  attese: 0,
});
check('nessuna riga', 0, vuoto.righe.length);
check('nessuna richiesta', 0, vuoto.pagineLette);
check('esaustiva', true, vuoto.esaustiva);

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ LETTURA RADAR LIVE: bacheca completa, nessun troncamento muto.'
    : `\n❌ LETTURA RADAR LIVE: ${errori} errore/i.`,
);

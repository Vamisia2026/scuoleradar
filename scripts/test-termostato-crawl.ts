/**
 * GUARDIA — IL TERMOSTATO DEL CRAWLER (§26.127).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. Il giro dell'MVP non ha più un'aggressività costante: la decide
 * il numero di avvisi ATTIVI in archivio (soglia di riferimento 1.000, fascia
 * morta 150 = 1.150). Questa guardia fissa le quattro cose che possono rompersi
 * in silenzio:
 *   1. i REGIMI — sotto 1.000 carenza, fino a 1.150 equilibrio, sopra saturo
 *      (senza isteresi il crawler cambierebbe regime a ogni avviso);
 *   2. il NUMERO VERO — il conteggio non si taglia alla soglia: il numero che si
 *      vede in vetrina resta quello del database e fluttua (mai «1.000 esatti»);
 *   3. le TARATURE — la provincia in domanda è `tutte` in OGNI regime; cambiano
 *      solo il campione di fondo e la profondità degli hub;
 *   4. il CABLAGGIO — il worker conta gli avvisi attivi, lo script legge il
 *      termostato e passa `--max-scuole` + le variabili della sgranatura.
 *
 * Esecuzione: `npm run test:termostato-crawl` (inclusa in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { TUTTE_LE_SCUOLE } from '../src/lib/mvpPerimetro.ts';
import {
  ISTERESI_AVVISI,
  SOGLIA_AVVISI_ATTIVI,
  TARATURE_TERMOSTATO,
  leggiTermostato,
  regimePer,
} from '../src/lib/termostatoCrawl.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* --------------------------- 1) Soglia e regimi --------------------------- */

console.log('\n— 1. Tre regimi, una soglia di riferimento (1.000) —');
check('la soglia di riferimento è 1.000', 1000, SOGLIA_AVVISI_ATTIVI);
check('la fascia morta sopra la soglia è 150', 150, ISTERESI_AVVISI);
check('archivio vuoto → carenza', 'carenza', regimePer(0));
check('999 avvisi → ancora carenza', 'carenza', regimePer(SOGLIA_AVVISI_ATTIVI - 1));
check('1.000 avvisi → equilibrio (soglia raggiunta)', 'equilibrio', regimePer(SOGLIA_AVVISI_ATTIVI));
check('1.149 → equilibrio (dentro la fascia morta)', 'equilibrio', regimePer(SOGLIA_AVVISI_ATTIVI + ISTERESI_AVVISI - 1));
check('1.150 → saturo (margine acquisito)', 'saturo', regimePer(SOGLIA_AVVISI_ATTIVI + ISTERESI_AVVISI));
check('10.000 avvisi → saturo', 'saturo', regimePer(10_000));
check('conteggio non finito → carenza (meglio leggere troppo)', 'carenza', regimePer(Number.NaN));
check('conteggio negativo → carenza', 'carenza', regimePer(-5));
check(
  'soglia e isteresi si possono fissare per una campagna',
  ['carenza', 'equilibrio', 'equilibrio', 'saturo'],
  [99, 100, 109, 110].map((n) => regimePer(n, 100, 10)),
);

/* -------------------- 2) Il numero è quello del database ------------------- */

console.log('\n— 2. Il conteggio non si taglia e non si «aggiusta» alla soglia —');
const alto = leggiTermostato(3421);
check('il conteggio letto è quello vero (3.421)', 3421, alto.attivi);
check('il margine è negativo, senza taglio', -2421, alto.margine);
check('sopra la soglia non «mancano» avvisi', 0, alto.mancanti);
check('la frase dichiara il numero vero', true, alto.frase.includes('3.421'));
check('la frase NON dichiara 1.000 come conteggio', false, /1\.000 avvisi attivi/.test(alto.frase));
const sotto = leggiTermostato(412);
check('sotto la soglia il margine è la distanza reale', 588, sotto.margine);
check('588 avvisi mancanti (dichiarati)', 588, sotto.mancanti);
check(
  'due conteggi diversi danno due righe di log diverse (nessun numero congelato)',
  false,
  leggiTermostato(412).frase === leggiTermostato(413).frase,
);
check(
  'il conteggio 1.000 e 1.400 non sono lo stesso regime (il numero si muove)',
  ['equilibrio', 'saturo'],
  [1000, 1400].map((n) => leggiTermostato(n).regime),
);

/* ----------------------------- 3) Le tarature ----------------------------- */

console.log('\n— 3. La domanda è sempre al 100%: il regime cambia il FONDO —');
check(
  'provincia in domanda: «tutte» in ogni regime',
  [TUTTE_LE_SCUOLE, TUTTE_LE_SCUOLE, TUTTE_LE_SCUOLE],
  (['carenza', 'equilibrio', 'saturo'] as const).map(
    (regime) => TARATURE_TERMOSTATO[regime].scuoleDomanda,
  ),
);
check('carenza: fondo esteso a 20 scuole/provincia', 20, TARATURE_TERMOSTATO.carenza.scuoleFondo);
check('equilibrio: fondo a 8 (default storico §26.101)', 8, TARATURE_TERMOSTATO.equilibrio.scuoleFondo);
check('saturo: fondo ridotto a 3', 3, TARATURE_TERMOSTATO.saturo.scuoleFondo);
check(
  'carenza: hub regionali letti a fondo (80 documenti, 6 pagine)',
  [80, 6],
  [TARATURE_TERMOSTATO.carenza.hub.perElenco, TARATURE_TERMOSTATO.carenza.hub.pagineElenco],
);
check(
  'saturo: hub letti con prudenza (25 documenti, 2 pagine)',
  [25, 2],
  [TARATURE_TERMOSTATO.saturo.hub.perElenco, TARATURE_TERMOSTATO.saturo.hub.pagineElenco],
);
check(
  'i regimi sono in ordine di spesa decrescente (fondo)',
  true,
  TARATURE_TERMOSTATO.carenza.scuoleFondo >
    TARATURE_TERMOSTATO.equilibrio.scuoleFondo &&
    TARATURE_TERMOSTATO.equilibrio.scuoleFondo > TARATURE_TERMOSTATO.saturo.scuoleFondo,
);
check(
  'la lettura porta con sé le tarature del regime scelto',
  TARATURE_TERMOSTATO.carenza.scuoleFondo,
  leggiTermostato(120).tarature.scuoleFondo,
);

/* ------------------- 4) Conteggio assente: nessun azzardo ------------------ */

console.log('\n— 4. Senza conteggio si resta sull’equilibrio, e lo si dichiara —');
const ignoto = leggiTermostato(null);
check('regime di equilibrio', 'equilibrio', ignoto.regime);
check('il guasto è dichiarato', true, ignoto.ignoto);
check('nessun margine inventato', null, ignoto.margine);
check('nessun avviso «mancante» inventato', 0, ignoto.mancanti);
check('la frase dice che il conteggio non c’è', true, /non disponibile/.test(ignoto.frase));
check('anche `undefined` non è un numero', true, leggiTermostato(undefined).ignoto);

/* --------------------------- 5) Il cablaggio ------------------------------ */

console.log('\n— 5. Cablaggio: worker → termostato → crawler —');
const domanda = leggi('scripts/lib/domandaProvincia.ts');
check(
  'il worker conta gli avvisi attivi con `head: true`',
  true,
  /from\('interpelli'\)/.test(domanda) && /count: 'exact', head: true/.test(domanda),
);
check(
  'il conteggio usa la stessa data del Radar Live (`dataIsoLocale`)',
  true,
  /gte\('expiration_date', dataIsoLocale\(oggi\)\)/.test(domanda),
);
check('la funzione si chiama `contaAvvisiAttivi`', true, /export async function contaAvvisiAttivi/.test(domanda));

const script = leggi('scripts/crawl-mvp.ts');
const motore = leggi('scripts/lib/giroMvp.ts');
check('lo script conta gli avvisi attivi', true, /contaAvvisiAttivi\(supabase\)/.test(script));
check('lo script legge il termostato', true, /leggiTermostato\(attivi/.test(script));
check('il tetto della domanda è «tutte» per default', true, /tettoDaArgomento\('max-scuole-domanda'\) \?\? TUTTE_LE_SCUOLE/.test(script));
check(
  'il fondo viene dal termostato (nessun 8 scritto a mano)',
  true,
  /MAX_SCUOLE_FONDO \?\? termostato\.tarature\.scuoleFondo/.test(script),
);
check(
  'la profondità degli hub passa dalle variabili della sgranatura',
  true,
  /AMBIENTE_SGRANATURA\.perElenco/.test(motore) && /AMBIENTE_SGRANATURA\.pagineElenco/.test(motore),
);
check(
  'il crawler riceve il tetto del regime (nessun numero fisso)',
  true,
  /`--max-scuole=\$\{tetto\}`/.test(motore),
);
check('nessun tetto di 60 scuole nel giro', false, /max-scuole-domanda', 60/.test(script));

const reporter = leggi('scripts/table-reporter.ts');
check('il reporter accetta `--max-scuole=tutte`', true, /tutte\|tutti\|all/.test(reporter));
check(
  '`tutte` non è zero: 0 spegne il deep crawl',
  true,
  /const TETTO_NESSUNO = Number\.MAX_SAFE_INTEGER/.test(reporter),
);
check('il log del reporter dice «tutte»', true, /ETICHETTA_MAX_SCUOLE/.test(reporter));

const perimetro = leggi('src/lib/mvpPerimetro.ts');
check(
  '`tettoScuole` lascia passare `tutte` senza numeri magici',
  true,
  /if \(tetto === TUTTE_LE_SCUOLE\) return TUTTE_LE_SCUOLE/.test(perimetro),
);

const pkg = leggi('package.json');
check('guardia dedicata al termostato', true, /"test:termostato-crawl": "tsx scripts\/test-termostato-crawl\.ts"/.test(pkg));
check('nella catena di `npm test`', true, /test-termostato-crawl\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ TERMOSTATO: l’intensità del giro segue il fabbisogno, il numero resta vero.');
} else {
  console.log(`❌ TERMOSTATO: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

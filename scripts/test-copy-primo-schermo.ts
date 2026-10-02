/**
 * Guardia COPY PRIMO SCHERMO — hero e Radar Live della homepage.
 *
 * Estratto da `test-copy-etico.ts` (che tornava oltre le 250 righe) per tenere il
 * gate etico sotto la soglia strutturale: qui vivono le verifiche di COPY e di
 * LAYOUT delle superfici che il visitatore incontra per prime.
 *
 *   1. hero su DUE righe, una frase per riga con `span block` (mai interruzioni
 *      forzate di markup): il titolo resta leggibile anche sui telefoni;
 *   2. colonna destra compatta: il box «Prova il Radar» NON viene stirato (nessun
 *      `h-full`, colonne `items-start` e ripartizione verticale a `lg:items-center`)
 *      e i due inviti all'azione («ATTIVA IL TUO RADAR», «ACCEDI») stanno SUBITO
 *      SOTTO il box su DUE colonne simmetriche della stessa larghezza
 *      (`sm:grid-cols-2`, pulsanti `w-full`): nessuno spazio bianco verticale in
 *      eccesso. Il responso resta a scorrimento (`max-h-[24rem]`);
 *   3. nessun riquadro ridondante fra il Radar Live e l'offerta PRO: la bacheca
 *      chiude senza interrompere la discesa verso il piano;
 *   4. Radar Live senza mock: stato iniziale vuoto, nessun array di seed, totale
 *      dal conteggio ESATTO del database e messaggio onesto («Nessun bando
 *      attivo al momento») quando la bacheca è vuota.
 *
 * Uso: npm run test:copy:schermo (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const heroLanding = leggi('src/components/landing/LandingHero.tsx');
/** Box «Prova il Radar» (simulatore pubblico) e bacheca interpelli del primo schermo. */
const simulatoreHero = leggi('src/departments/radar/SimulatorRadar.tsx');
const boardRadar = leggi('src/departments/radar/FlightBoardInterpelli.tsx');

console.log('— Primo schermo: hero e Radar Live —');
check(
  'landing: hero su DUE righe, una frase per riga (`span block`, niente a-capo forzati)',
  true,
  /<span className="block">Ogni giorno decine di opportunità\.<\/span>/.test(heroLanding) &&
    /<span className="block text-secondary-500">Noi intercettiamo solo quelle per te\.<\/span>/.test(
      heroLanding,
    ) &&
    !/<br\s*\/?>/.test(heroLanding),
);
check(
  'landing: box «Prova il Radar» non stirato, colonne compatte (niente spazio bianco)',
  true,
  /items-start/.test(heroLanding) &&
    /lg:items-center/.test(heroLanding) &&
    /<SimulatorRadar \/>/.test(heroLanding) &&
    !/SimulatorRadar[^>]{0,80}h-full/.test(heroLanding) &&
    /mt-3 grid w-full gap-3 sm:grid-cols-2/.test(heroLanding),
);
/** Posizioni nel MARKUP (i commenti citano le stesse etichette, quindi niente includes). */
const posizioneBox = heroLanding.indexOf('<SimulatorRadar');
const posizioneRadarCta = heroLanding.search(/ATTIVA IL TUO RADAR\s*<\/>/);
const posizioneAccedi = heroLanding.search(/Accedi\s*<\/button>/);
check(
  'landing: «ATTIVA IL TUO RADAR» e «ACCEDI» stanno SOTTO il box, simmetrici',
  true,
  posizioneBox > -1 &&
    posizioneRadarCta > posizioneBox &&
    posizioneAccedi > posizioneBox &&
    posizioneRadarCta < posizioneAccedi &&
    (heroLanding.match(/w-full items-center justify-center/g) ?? []).length >= 2,
);
check(
  'landing: responso del box a scorrimento (il box non cambia dimensione)',
  true,
  /max-h-\[24rem\][\s\S]{0,200}<ResponsoProva/.test(simulatoreHero),
);
check(
  'landing: nessun riquadro ridondante fra il Radar Live e l’offerta PRO',
  true,
  !/Tutti gli avvisi ufficiali/.test(boardRadar) && /RIMOSSO \(direttiva cliente\)/.test(boardRadar),
);

console.log('\n— Radar Live: dati solo reali (nessun mock, conteggio esatto) —');
check(
  'Radar Live: conteggio ESATTO dal database (`{ count: \'exact\' }`)',
  true,
  /select\('id', \{ count: 'exact', head: true \}\)/.test(boardRadar),
);
check(
  'Radar Live: stato iniziale VUOTO — nessuna costante di righe di seed',
  true,
  /useState<InterpelloLive\[\]>\(\[\]\)/.test(boardRadar) &&
    !/\b(?:const|let|var)\s+[A-Z_][A-Z0-9_]*(?:MOCK|DEMO|SEED|FALLBACK|FINT|PREDEFINIT)[A-Z0-9_]*\s*[:=]/i.test(
      boardRadar,
    ),
);
check(
  'Radar Live: bacheca vuota → «Nessun bando attivo al momento» (mai righe finte)',
  true,
  boardRadar.includes('Nessun bando attivo al momento') &&
    !/Math\.random/.test(boardRadar) &&
    !/totaleFinto|TOTALE_FISSO|CONTATORE_FINTO/.test(boardRadar),
);
check(
  'Radar Live: il badge usa il conteggio reale (mai un totale scritto a mano)',
  true,
  /\{metrica\.etichettaTotale &&/.test(boardRadar) &&
    !/aria-label="Radar Live"[\s\S]{0,4000}(?:\d{3,}\s*avvisi|8\.000|5\.000|500\+)/.test(boardRadar),
);
check(
  'Radar Live: in attesa finché la prima lettura non è conclusa (nessun messaggio prematuro)',
  true,
  /if \(!caricato\) return null;/.test(boardRadar) && /setCaricato\(true\)/.test(boardRadar),
);

console.log(errori === 0 ? '\n✅ COPY PRIMO SCHERMO: nessun problema' : `\n❌ COPY PRIMO SCHERMO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * Guardia — OPPORTUNITÀ: «scuola + fonte» sempre visibili, avvisi non vivi fuori.
 *
 * Due requisiti di prodotto, verificati sul CABLAGGIO (i comportamenti puri stanno
 * in `npm run test:interpello-scadenza`):
 *
 *   1. la SCUOLA EMITTENTE e un LINK DIRETTO alla fonte ufficiale devono essere
 *      visibili sia sulla CARD sia nella MODALE di dettaglio (e nella scheda
 *      pubblica `/interpello/:id`), con l'etichetta ONESTA della fonte;
 *   2. un avviso SENZA scadenza esplicita esce dalle superfici pubbliche dopo 60
 *      giorni dalla pubblicazione: la stessa finestra vale per feed, bacheca,
 *      matching (RPC + fallback) e pulizia automatica (`eAvvisoVivo`).
 *
 *   3. la COMPATIBILITÀ è colorata da un'unica banda condivisa (60 rosso · 70
 *      arancio · 80 verde) e l'area sostegno senza una classe AD… propria vale 60
 *      (suggerimento extra, mai priorità): card, modale, feed e ordine della
 *      bacheca parlano dello stesso punteggio.
 *
 * Uso: npm run test:opportunita  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';

const leggi = (p: string): string => readFileSync(p, 'utf8');
let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const card = leggi('src/components/InterpelloCard.tsx');
const modale = leggi('src/components/InterpelloDettaglioModal.tsx');
const istituto = leggi('src/components/IstitutoEmittente.tsx');
const scheda = leggi('src/pages/interpello/components/SchedaAvviso.tsx');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
const bachecaFeed = leggi('src/lib/bachecaInterpelli.ts');
const motore = leggi('src/lib/matchingEngine.ts');
const bacheca = leggi('src/departments/radar/flightBoard/filtroAttivi.ts');
const pulizia = leggi('scripts/pulisci-scaduti.ts');
const migrazione = leggi(
  'supabase/migrations/20261005120000_match_interpelli_finestra_senza_scadenza.sql',
);
const catena = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };

const linkFonte = (sorgente: string): boolean =>
  /etichettaFonteLink\(linkEsterno\)/.test(sorgente) &&
  /href=\{linkEsterno\}[\s\S]{0,120}target="_blank"[\s\S]{0,80}rel="noopener noreferrer"/.test(
    sorgente,
  );

console.log('— 1. Scuola emittente + fonte ufficiale: card E modale —');
check('la card mostra l’istituto emittente', true, /<IstitutoEmittente\b/.test(card));
check('la modale mostra l’istituto emittente', true, /<IstitutoEmittente\b/.test(modale));
check('la scheda pubblica mostra l’istituto emittente', true, /<IstitutoEmittente\b/.test(scheda));
check('la card espone il LINK diretto alla fonte, in nuova scheda', true, linkFonte(card));
check('la modale espone il LINK diretto alla fonte, in nuova scheda', true, linkFonte(modale));
check(
  'l’etichetta della fonte è quella ONESTA (mai “Candidati”)',
  false,
  /etichettaFonteLink[\s\S]{0,60}Candidat/i.test(card),
);
check(
  'la scuola non è mai una riga vuota: c’è la dicitura gestita',
  true,
  /SCUOLA_NON_SPECIFICATA/.test(istituto),
);
check(
  'card e modale condividono lo stesso componente per la scuola',
  true,
  /from '.\/IstitutoEmittente'/.test(card) && /from '.\/IstitutoEmittente'/.test(modale),
);

console.log('\n— 2. Finestra dei 60 giorni: una sola regola, tutte le superfici pubbliche —');
check('feed dashboard: usa eAvvisoVivo (via bacheca pura)', true, /eAvvisoVivo\(/.test(bachecaFeed));
check(
  'il feed non usa più la vecchia regola “solo scadenza”',
  false,
  /nonScaduto = eInterpelloAttivo/.test(feed),
);
check(
  'matching (fallback PostgREST): ramo senza scadenza con finestra created_at',
  true,
  /expiration_date\.is\.null,created_at\.gte\./.test(motore),
);
check(
  'bacheca «Radar Live»: la finestra arriva dal modulo condiviso',
  true,
  /from '@\/lib\/scadenza'/.test(bacheca),
);
check(
  'pulizia automatica: rimuove anche gli avvisi senza scadenza fuori finestra',
  true,
  /is\('expiration_date', null\)/.test(pulizia) && /lt\('created_at'/.test(pulizia),
);
check('RPC nativa: la finestra di 60 giorni vive nel database', true, /interval '60 days'/.test(migrazione));

console.log('\n— 3. La guardia è nella catena di `npm test` —');
check('script dedicato', true, 'test:opportunita' in catena.scripts);
check(
  'guardia di cablaggio nella catena',
  true,
  (catena.scripts.test ?? '').includes('scripts/test-opportunita-vive.ts'),
);
check(
  'la regola pura (eAvvisoVivo) è nella catena',
  true,
  (catena.scripts.test ?? '').includes('scripts/test-scadenza.ts'),
);

console.log('\n— 4. Compatibilità: banda condivisa (60/70/80) e sostegno EXTRA —');
const compat = leggi('src/lib/compatibilita.ts');
const graduata = leggi('src/lib/compatibilitaGraduata.ts');
const dashboard = leggi('src/pages/DashboardPage.tsx');
check('card: badge dalla banda condivisa', true, /bandaCompatibilita\(/.test(card) && /banda\.visibile/.test(card));
check('modale: stessa banda della card', true, /bandaCompatibilita\(/.test(modale) && /banda\.visibile/.test(modale));
check(
  'badge non più cablato al solo 100%',
  false,
  /compatibilita === 100/.test(card) || /compatibilita === 100/.test(modale),
);
check(
  'soglie: 60 rosso · 70 arancio · 80 verde',
  true,
  /SOGLIA_COMPATIBILITA_ROSSO = 60/.test(compat) &&
    /SOGLIA_COMPATIBILITA_ARANCIO = 70/.test(compat) &&
    /SOGLIA_COMPATIBILITA_VERDE = 80/.test(compat),
);
check('motore: il sostegno senza classe AD… vale 60 (extra)', true, /PUNTEGGIO_EXTRA_SOSTEGNO = 60/.test(motore));
check(
  'feed della dashboard: delega il punteggio alle modali di bacheca',
  true,
  /bachecaInterpelli\(/.test(feed) && /valutaCompatibilita\(/.test(bachecaFeed) && /punteggioCompatibilita\(/.test(graduata),
);
check(
  'bacheca: i match forti prima, il sostegno extra in coda',
  true,
  /const ca = a\.compatibilita \?\? 100;/.test(dashboard),
);
check(
  'guardia dedicata nella catena',
  true,
  (catena.scripts.test ?? '').includes('scripts/test-compatibilita-punteggio.ts'),
);

console.log(
  errori === 0
    ? '\n✅ OPPORTUNITÀ: scuola e fonte sempre visibili; gli avvisi non vivi escono dopo 60 giorni.'
    : `\n❌ OPPORTUNITÀ: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * ScuoleRadar.it — Dipartimento Radar · GUARDIA delle RIGHE DIMOSTRATIVE del tabellone
 * (`demoInterpelli.ts` + `demoInterpelliCasi.ts`).
 *
 * La demo serve a vedere — in sviluppo e in prova manuale — i quattro
 * comportamenti fissati dalla direttiva del 22/10/2026. Una demo che invecchia in
 * silenzio è peggio di nessuna demo: qui si verifica, con le funzioni VERE della
 * bacheca (`preparaDemo` replica la pipeline di `FlightBoardInterpelli.tsx`), che
 * ogni riga faccia ESATTAMENTE ciò che dichiara.
 *
 * Sezioni:
 *   1. struttura del dato (prefisso, uuid, host `.edu.it`, fonti dichiarate);
 *   2. esito: dentro con la fonte e il badge dichiarati, oppure fuori;
 *   3. i badge PIENI (rose-600 / orange-700 / emerald-700 su etichetta bianca) — un solo semaforo;
 *   4. un solo array filtrato → totale mostrato e schermate coerenti.
 *
 * Uso: `npm run test:board:demo` (incluso in `npm test`).
 */
import { PREFISSO_DEMO, righeDemo } from './demoInterpelli.ts';
import { descriviEsito, preparaDemo } from './demoInterpelliVerifica.ts';
import { badgeScadenza } from '../rigaBoardDati.ts';
import { dominioDaSito, dominioIstituzionale } from '../linkFonte.ts';
import { pagineBoard } from '../metricaBoard.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`,
  );
}
function vero(nome: string, condizione: boolean, dettaglio = ''): void {
  if (!condizione) errori += 1;
  console.log(`${condizione ? '✓' : '✗'} ${nome}${dettaglio ? ` — ${dettaglio}` : ''}`);
}

// `oggi` REALE: le scadenze demo sono relative, quindi la guardia resta valida in
// qualunque giorno giri (una data fissa la farebbe marcire in una settimana).
const oggi = new Date();
const righe = righeDemo(oggi);
const esiti = preparaDemo(righe, oggi);

console.log('— 1. Struttura del dato dimostrativo —');
check('numero di righe demo', 10, righe.length);
check('hash_id distinti', righe.length, new Set(righe.map((r) => r.hash_id)).size);
vero('ogni hash_id porta il prefisso', righe.every((r) => r.hash_id.startsWith(PREFISSO_DEMO)));
vero(
  'ogni id è un uuid distinto',
  new Set(righe.map((r) => r.id)).size === righe.length &&
    righe.every((r) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(r.id)),
);
vero(
  'school_site è un host .edu.it SENZA schema né percorso',
  righe.every(
    (r) => r.school_site === null || (!/[:/]/.test(r.school_site) && dominioDaSito(r.school_site) !== null),
  ),
);
vero(
  'la fonte è apribile (sito `.edu.it`) o una piattaforma nota',
  righe.every((r) => r.source_url.includes('.edu.it') || /argo|forms\.gle|madisoft/.test(r.source_url)),
);
vero(
  'nessun recapito ambiguo fuori da `.edu.it` (tranne il caso @istruzione.it)',
  righe.every(
    (r) =>
      (r.contact_email === null || r.contact_email.endsWith('.edu.it') || r.contact_email.endsWith('@istruzione.it')) &&
      (r.school_pec === null || r.school_pec.endsWith('.edu.it')),
  ),
);

console.log('— 2. Esito in bacheca: dentro con la fonte dichiarata, oppure fuori —');
for (const esito of esiti) {
  const { riga } = esito;
  const { atteso } = riga;
  check(`[${riga.hash_id}] esito`, atteso.esito, esito.esito);
  if (esito.esito === 'mostrata' && atteso.esito === 'mostrata') {
    check(`[${riga.hash_id}] tipo di fonte`, atteso.fonte, esito.fonte.tipo);
    check(`[${riga.hash_id}] etichetta del badge`, atteso.badge, esito.badge);
    if (atteso.fonte === 'avviso') {
      check(`[${riga.hash_id}] URL dell’avviso`, riga.source_url, esito.fonte.url);
    } else {
      vero(
        `[${riga.hash_id}] home .edu.it (mai un link di piattaforma)`,
        /^https:\/\/[a-z0-9.-]+\.edu\.it$/.test(esito.fonte.url),
        esito.fonte.url,
      );
      check(
        `[${riga.hash_id}] dominio della home`,
        dominioDaSito(riga.school_site) ??
          dominioIstituzionale(riga.contact_email) ??
          dominioIstituzionale(riga.school_pec),
        new URL(esito.fonte.url).hostname,
      );
    }
    vero(
      `[${riga.hash_id}] colonna «Scuola» senza segnaposto`,
      !/non\s+specificat/i.test(esito.scuola) && esito.scuola.length > 0,
      esito.scuola,
    );
  } else if (esito.esito === 'scartata' && atteso.esito === 'scartata') {
    vero(`[${riga.hash_id}] motivo dello scarto dichiarato`, esito.motivo.length > 0, esito.motivo);
  }
}

// Il nome ricavato dal TITOLO è il caso 8: se il gate cambia, la demo lo dice.
const daTitolo = esiti.find((e) => e.riga.hash_id === `${PREFISSO_DEMO}08-nome-da-titolo`);
check(
  'caso 8: nome dell’istituto ricavato dal titolo',
  'Istituto Comprensivo Pascoli',
  daTitolo?.esito === 'mostrata' ? daTitolo.scuola : null,
);

console.log('— 3. I badge PIENI, un solo semaforo a quattro luci (nessun pastello) —');
const className = (hash: string): string => {
  const riga = righe.find((r) => r.hash_id === `${PREFISSO_DEMO}${hash}`);
  return riga ? badgeScadenza(riga.expiration_date).className : '';
};
check('blu notte pieno (scade oggi)', true, className('04-avviso-pdf').includes('bg-primary-700'));
// §26.122 — il semaforo è una scala del BLU: da domani un gradino più chiaro.
check('blu pieno (scade domani)', true, className('02-forms-sito').includes('bg-primary-600'));
check('verde pieno (3 giorni)', true, className('01-argo-sito').includes('bg-accent-600'));
check('verde pieno (oltre 7 giorni)', true, className('03-nuvola-pec').includes('bg-accent-600'));
const tutteLeBande = righe.map((r) => badgeScadenza(r.expiration_date).className);
vero(
  'ogni badge ha etichetta BIANCA ad alto contrasto in grassetto (§26.100)',
  tutteLeBande.every((c) => c.includes('text-white') && c.includes('font-bold')),
);
vero(
  'nessuna etichetta quasi nera (`text-slate-950`)',
  tutteLeBande.every((c) => !c.includes('text-slate-950')),
);
vero('nessuna tinta pastello (…-100 / …-200)', tutteLeBande.every((c) => !/-100\b|-200\b/.test(c)));
vero(
  'nessun giallo/ambra: la luce media è `secondary-600` (§26.120)',
  tutteLeBande.every((c) => !/bg-(?:amber|yellow)-\d{3}/.test(c)),
);
vero(
  'nessun nero né ardesia scura sui badge delle righe demo',
  tutteLeBande.every((c) => !/bg-(?:black|slate-7|slate-8|slate-9)/.test(c)),
);

console.log('— 4. Un solo array filtrato: totale mostrato = schermate —');
const inVetrina = esiti.filter((e) => e.esito === 'mostrata');
const fuori = esiti.filter((e) => e.esito === 'scartata');
check('righe in vetrina', 7, inVetrina.length);
check('righe fuori', 3, fuori.length);
check('schermate da 5 righe', 2, pagineBoard(inVetrina.length, 5));
check(
  'copertura dei tre stati di scadenza',
  ['In corso', 'Scade domani', 'Scade oggi'].sort(),
  [...new Set(inVetrina.map((e) => (e.esito === 'mostrata' ? e.badge : '')))].sort(),
);
check(
  'copertura delle due fonti apribili',
  ['avviso', 'sito-scuola'],
  [...new Set(inVetrina.map((e) => (e.esito === 'mostrata' ? e.fonte.tipo : '')))].sort(),
);

console.log('\nRighe demo (esito atteso = esito reale):');
for (const e of esiti) console.log(`  ${descriviEsito(e)}`);

console.log(
  errori === 0 ? '\n✓ Righe demo coerenti con la bacheca.' : `\n✗ ${errori} verifiche fallite.`,
);
process.exitCode = errori === 0 ? 0 : 1;

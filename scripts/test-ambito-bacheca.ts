/**
 * TEST — VETRINA MAI CORTA (`src/lib/ambitoBacheca.ts`, §26.111).
 *
 * Perché serve: la dashboard promette di dire sempre COSA c'è. Il paracadute
 * «5 osso-da-mordere» (§26.106) completa con la scorta, ma la scorta è fatta delle
 * stesse righe già lette: se la provincia non ha cinque avvisi attivi (Asti,
 * 30/10/2026: zero) la pagina resta vuota e l'utente non distingue «non ce ne
 * sono» da «il Radar non ha guardato». Questa guardia fissa il contratto:
 *   1. provincia → regione → Italia, in quest'ordine, fino a `MINIMO_BACHECA`;
 *   2. ogni riga aggiunta DICHIARA il suo ambito (mai integrazione silenziosa);
 *   3. si aggiungono le più RECENTI, senza duplicare ciò che è già in vetrina;
 *   4. se tutto è vuoto la lista resta corta e il motivo è dichiarato;
 *   5. il modulo è PURO (niente rete, niente database, importabile dal browser);
 *   6. il feed lo usa e non tocca la CONSEGNA (§26.45): le righe fuori ambito
 *      arrivano senza voto, e solo se sono candidabili adesso (§26.82);
 *   7. il badge d'ambito è visibile in pagina (`ElencoOpportunita`).
 *
 * Uso: npm run test:ambito-bacheca  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  ETICHETTA_AMBITO,
  descrizioneAmbito,
  integraAmbiti,
  provinceDellaRegione,
  regioneDi,
  type RigaCandidata,
} from '../src/lib/ambitoBacheca.ts';
import { MINIMO_BACHECA } from '../src/lib/riempitivi.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const riga = (id: string, dataPubblicazione?: string): RigaCandidata =>
  dataPubblicazione ? { id, dataPubblicazione } : { id };

/* ------------------------ 1) LA GEOGRAFIA DELL'AMBITO --------------------- */

console.log('\n— 1. Provincia → regione: la geografia arriva dall’anagrafica —');
check('minimo di vetrina', 5, MINIMO_BACHECA);
check('Asti è in Piemonte', 'Piemonte', regioneDi('AT'));
check('codice in minuscolo tollerato', 'Piemonte', regioneDi('at'));
check('codice sconosciuto = nessuna regione', null, regioneDi('ZZ'));
check('codice assente = nessuna regione', null, regioneDi(null));

const piemonte = provinceDellaRegione(['AT']);
check('la regione di Asti porta Alessandria', true, piemonte.has('AL'));
check('la regione di Asti porta Torino', true, piemonte.has('TO'));
check('la regione di Asti non porta Milano', false, piemonte.has('MI'));
check('tutte le province del Piemonte (8)', 8, piemonte.size);
check('due regioni = due perimetri', true, provinceDellaRegione(['AT', 'MI']).has('MI'));
check('senza province non c’è perimetro', 0, provinceDellaRegione([]).size);
check('senza codice valido non c’è perimetro', 0, provinceDellaRegione(['ZZ']).size);

/* -------------------- 2) LA VETRINA SI FERMA AL MINIMO -------------------- */

console.log('\n— 2. Con cinque righe di provincia non si integra nulla —');
const cinque = [riga('p1'), riga('p2'), riga('p3'), riga('p4'), riga('p5')];
const sufficiente = integraAmbiti(cinque, {
  regionali: [riga('r1', '2026-10-29T09:00:00Z')],
  nazionali: [riga('n1', '2026-10-28T09:00:00Z')],
});
check('lista = solo provincia', 5, sufficiente.lista.length);
check('nessuna riga aggiunta', 0, sufficiente.aggiunti);
check('motivo dichiarato', 'sufficiente', sufficiente.motivo);
check('ambito delle righe proprie', ['provincia', 'provincia', 'provincia', 'provincia', 'provincia'], sufficiente.lista.map((r) => r.ambito));
check('ordine originale conservato', ['p1', 'p2', 'p3', 'p4', 'p5'], sufficiente.lista.map((r) => r.id));

/* --------------------- 3) ASTI: PRIMA LA REGIONE, POI ITALIA -------------- */

console.log('\n— 3. Asti con due avvisi: entrano i più recenti della regione —');
const due = [riga('at1', '2026-10-30T08:00:00Z'), riga('at2', '2026-10-29T08:00:00Z')];
const regionale = integraAmbiti(due, {
  regionali: [
    riga('al1', '2026-10-30T10:00:00Z'),
    riga('to1', '2026-10-30T11:00:00Z'),
    riga('cn1', '2026-10-28T10:00:00Z'),
    riga('vc1', '2026-10-27T10:00:00Z'),
  ],
  nazionali: [riga('mi1', '2026-10-26T10:00:00Z'), riga('rm1', '2026-10-25T10:00:00Z')],
});
check('vetrina completa a cinque', 5, regionale.lista.length);
check('tre aggiunte dalla regione', 3, regionale.daRegione);
check('nessuna dal resto d’Italia', 0, regionale.daNazionale);
check('motivo dichiarato', 'integrato', regionale.motivo);
check('i più recenti per primi', ['to1', 'al1', 'cn1'], regionale.lista.slice(2).map((r) => r.id));
check('badge della regione sulle aggiunte', ['regione', 'regione', 'regione'], regionale.lista.slice(2).map((r) => r.ambito));

console.log('\n— 4. Regione insufficiente: si allarga all’Italia —');
const misto = integraAmbiti([riga('at1', '2026-10-30T08:00:00Z')], {
  regionali: [riga('al1', '2026-10-29T08:00:00Z')],
  nazionali: [riga('mi1', '2026-10-28T08:00:00Z'), riga('rm1', '2026-10-27T08:00:00Z'), riga('pa1', '2026-10-26T08:00:00Z')],
});
check('una dalla regione', 1, misto.daRegione);
check('tre dal resto d’Italia', 3, misto.daNazionale);
check('quattro aggiunte in tutto', 4, misto.aggiunti);
check('badge nazionale sulle ultime', ['nazionale', 'nazionale', 'nazionale'], misto.lista.slice(2).map((r) => r.ambito));
check('motivo dichiarato', 'integrato', misto.motivo);

/* ------------------- 5) NIENTE DOPPIONI, NIENTE INVENZIONI ---------------- */

console.log('\n— 5. Ciò che è già in vetrina non si ripete —');
const dedup = integraAmbiti([riga('at1')], {
  regionali: [riga('at1', '2026-10-30T08:00:00Z'), riga('al1', '2026-10-29T08:00:00Z')],
  nazionali: [riga('al1', '2026-10-29T08:00:00Z'), riga('mi1', '2026-10-28T08:00:00Z')],
});
check('nessun identificativo doppio', 3, new Set(dedup.lista.map((r) => r.id)).size);
check('tre righe distinte disponibili', 3, dedup.lista.length);
check('riga propria una volta sola', 1, dedup.lista.filter((r) => r.id === 'at1').length);
check('la regione non si ripete nel nazionale', 1, dedup.lista.filter((r) => r.id === 'al1').length);

console.log('\n— 6. Ambito esaurito: la lista resta corta e lo DICHIARA —');
const vuoto = integraAmbiti([], { regionali: [], nazionali: [] });
check('lista vuota, nessun riempitivo inventato', 0, vuoto.lista.length);
check('motivo dichiarato', 'ambito-esaurito', vuoto.motivo);
check('nessuna aggiunta', 0, vuoto.aggiunti);

const parziale = integraAmbiti([], { regionali: [riga('al1')], nazionali: [] });
check('una sola riga disponibile', 1, parziale.lista.length);
check('motivo dichiarato', 'ambito-esaurito', parziale.motivo);
check('arriva dalla regione', 'regione', parziale.lista[0].ambito);

console.log('\n— 7. Minimo configurabile e ordine deterministico —');
const minimoDue = integraAmbiti(
  [],
  {
    regionali: [riga('x1', '2026-10-30T08:00:00Z'), riga('x2', '2026-10-30T08:00:00Z')],
    nazionali: [riga('x3')],
  },
  { minimo: 2 },
);
check('minimo esplicito rispettato', 2, minimoDue.lista.length);
check('a pari data vince l’identificativo', ['x1', 'x2'], minimoDue.lista.map((r) => r.id));

const senzaData = integraAmbiti(
  [],
  { regionali: [riga('niente'), riga('datata', '2026-10-30T08:00:00Z')], nazionali: [] },
  { minimo: 1 },
);
check('senza data non passa avanti a chi ha una data', ['datata'], senzaData.lista.map((r) => r.id));

/* ---------------------- 8) BADGE E DESCRIZIONI IN PAGINA ----------------- */

console.log('\n— 8. Ogni ambito ha un’etichetta e una spiegazione —');
check('tre ambiti etichettati', 3, Object.keys(ETICHETTA_AMBITO).length);
check('la provincia è nominata', true, /provincia/i.test(ETICHETTA_AMBITO.provincia));
check('la regione è nominata', true, /regione/i.test(ETICHETTA_AMBITO.regione));
check('l’Italia è nominata', true, /italia/i.test(ETICHETTA_AMBITO.nazionale));
check('la spiegazione della regione cita il minimo', true, descrizioneAmbito('regione').includes(String(MINIMO_BACHECA)));
check('la spiegazione nazionale cita il minimo', true, descrizioneAmbito('nazionale').includes(String(MINIMO_BACHECA)));
check('la spiegazione provinciale parla del profilo', true, /profilo/i.test(descrizioneAmbito('provincia')));

/* --------------------------- 9) PUREZZA E CABLAGGIO ---------------------- */

console.log('\n— 9. Modulo puro, usato dal feed, visibile in pagina —');
const sorgente = leggi('src/lib/ambitoBacheca.ts');
const codiceEseguibile = sorgente
  .split('\n')
  .filter((r) => !r.trim().startsWith('//') && !r.trim().startsWith('*'))
  .join('\n');
check('nessuna rete', false, /\bfetch\(|axios|supabase/i.test(codiceEseguibile));
check('nessun node:* (importabile dal browser)', false, /from\s+'node:/i.test(codiceEseguibile));
check('nessun punteggio ricalcolato', false, /punteggio|compatibilita/i.test(codiceEseguibile));
check('il minimo arriva dai riempitivi', true, /import \{ MINIMO_BACHECA \} from '\.\/riempitivi'/.test(sorgente));
check('sotto 300 righe', true, sorgente.split('\n').length <= 300);

const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
check('il feed integra gli ambiti', true, /integraAmbiti\(/.test(feed));
check('il feed chiede la query larga sotto il minimo', true, /mancantiVetrina/.test(feed));
check('il feed conosce il minimo di vetrina', true, /MINIMO_BACHECA/.test(feed));
check('il feed usa le province della regione', true, /provinceDellaRegione\(/.test(feed));
check('le righe fuori ambito passano il gate dei 15 giorni', true, /eOpportunitaConScadenza\(/.test(feed));
check('le righe fuori ambito non portano voto', true, /compatibilita: 0/.test(feed));

const elenco = leggi('src/pages/dashboard/components/ElencoOpportunita.tsx');
check('il badge d’ambito è in pagina', true, /ETICHETTA_AMBITO/.test(elenco));
check('la spiegazione è nel tooltip', true, /descrizioneAmbito\(/.test(elenco));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:ambito-bacheca' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-ambito-bacheca.ts'));

console.log(
  errori === 0
    ? '\n✅ AMBITO BACHECA: la vetrina non resta corta, e dice sempre da dove arriva.'
    : `\n❌ AMBITO BACHECA: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


/**
 * GUARDIA — L'ORDINE DELLA VETRINA (§26.152).
 * -----------------------------------------------------------------------------------
 * Il 06/11/2026 un profilo di Asti apriva la bacheca e trovava in testa Torino e
 * Alessandria: righe di contorno entrate col raggio dei 60 km, un punto di voto sopra le
 * righe della provincia scelta. Non era un punteggio sbagliato — era un ordine che non
 * conosceva la differenza fra «la mia zona» e «la zona che il raggio ha aggiunto».
 *
 * La regola (`lib/ordineVetrina`) risponde a tre domande in quest'ordine — merito, casa,
 * voto/scadenza — e questa guardia la mette alla prova sui casi che contano:
 *
 *   1. i riempitivi di casa non stanno sotto i riempitivi del raggio (il difetto del 06/11);
 *   2. un riempitivo non scavalca MAI un match vero, nemmeno se è della provincia principale;
 *   3. fra i match il voto resta davanti (la casa è un criterio d'ordine, non un salvacondotto);
 *   4. soglia, voto ignoto, scadenza, stabilità e nessuna mutazione della lista del contesto;
 *   5. il cablaggio: la bacheca usa questa regola e le passa la provincia principale.
 *
 * Uso: npm run test:ordine-vetrina  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { ordinaVetrina, type VoceVetrina } from '../src/lib/ordineVetrina.ts';
import { provinceDiRicerca } from '../src/lib/prossimitaGeografica.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Scadenza fra N giorni (le opportunità vivono in una finestra di 15 giorni, §26.71). */
const fra = (giorni: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** Riga minima per l'ordinatore: voto, provincia, scadenza. */
type RigaProva = VoceVetrina & { id: string };
const riga = (id: string, provinciaCodice: string, compatibilita: number | null, giorni = 5): RigaProva => ({
  id,
  provinciaCodice,
  compatibilita,
  dataScadenza: fra(giorni),
});
/** Gli id nell'ordine in cui l'ordinatore li mette (la provincia di casa è la principale). */
const ordine = (lista: readonly RigaProva[], principale?: string): string[] =>
  ordinaVetrina(lista, { principale }).map((r) => r.id);

console.log('— 1. La casa prima del voto fra i riempitivi: il difetto del 06/11/2026 —');
const riempitivi = [riga('to-basso', 'TO', 68), riga('at-basso', 'AT', 66)];
check('fra riempitivi la provincia principale batte il voto', ['at-basso', 'to-basso'], ordine(riempitivi, 'AT'));
check('senza preferenza resta il voto (comportamento storico)', ['to-basso', 'at-basso'], ordine(riempitivi));
const conMatch = [riga('at-basso', 'AT', 66), riga('to-match', 'TO', 92)];
check('nessun riempitivo di casa sopra un match vero', ['to-match', 'at-basso'], ordine(conMatch, 'AT'));
const matchForte = [riga('at-match', 'AT', 90), riga('to-match', 'TO', 92)];
check('fra match vince il voto (il più forte non si declassa)', ['to-match', 'at-match'], ordine(matchForte, 'AT'));
const matchPari = [riga('to-match', 'TO', 90), riga('at-match', 'AT', 90)];
check('a pari voto il match di casa viene prima', ['at-match', 'to-match'], ordine(matchPari, 'AT'));

console.log('\n— 2. Le altre regole: soglia, voto ignoto, scadenza, stabilità —');
const soglia = [riga('basso', 'AT', 69), riga('soglia', 'TO', 70), riga('alto', 'TO', 95)];
check('la soglia è quella dei riempitivi (70): 69 è contorno, 70 è match', ['alto', 'soglia', 'basso'], ordine(soglia, 'AT'));
const ignoto = [riga('at-basso', 'AT', 66), riga('ignoto', 'TO', null)];
check('un voto assente resta neutro (fascia match), come in `lib/riempitivi`', ['ignoto', 'at-basso'], ordine(ignoto, 'AT'));
const scadenze = [riga('comodo', 'TO', 90, 9), riga('urgente', 'TO', 90, 2)];
check('a pari merito decide la scadenza più vicina', ['urgente', 'comodo'], ordine(scadenze));
const senzaData = [{ ...riga('senza-data', 'TO', 90), dataScadenza: null }, riga('con-data', 'TO', 90)];
check('le righe senza scadenza finiscono in coda, senza spareggi inventati', ['con-data', 'senza-data'], ordine(senzaData));
check('l’ordine è stabile: due giri, lo stesso tabellone', ordine(riempitivi, 'AT'), ordine(riempitivi, 'AT'));
const ingresso = [riga('b', 'TO', 66), riga('a', 'AT', 65), riga('c', 'AL', 67)];
const copiaIngresso = ordine(ingresso);
ordinaVetrina(ingresso, { principale: 'AT' });
check('l’ordinatore non muta la lista del contesto (React)', copiaIngresso, ordine(ingresso));
check('il perimetro di Asti è quello del difetto: AT + TO (46 km) + AL (32 km) + VC (51 km)', ['AL', 'AT', 'TO', 'VC'], provinceDiRicerca(['AT']).slice().sort());

console.log('\n— 3. Il cablaggio: la bacheca ordina con questa regola —');
const dashboard = leggi('src/pages/DashboardPage.tsx');
check('la bacheca ordina con `ordinaVetrina`', true, /ordinaVetrina\(vetrinaVisibile\(interpelliFiltrati\)/.test(dashboard));
check('…e gli passa la provincia principale del profilo', true, /principale: perimetro\.principale/.test(dashboard));
check('nessun ordinamento per solo voto rimasto in pagina', false, /compatibilita \?\? 100/.test(dashboard));
const modulo = leggi('src/lib/ordineVetrina.ts');
check('il modulo è puro: niente React, niente rete', false, /from 'react'|\bfetch\(|supabase/i.test(modulo));
check('la soglia dei riempitivi è importata, non ricopiata', true, /SOGLIA_COMPATIBILITA_ARANCIO/.test(modulo));
check('la casa si confronta col codice normalizzato', true, /normalizzaProvincia\(voce\.provinciaCodice\)/.test(modulo));

console.log(`\n${errori === 0 ? '✅ ORDINE VETRINA: merito, poi la provincia di casa.' : `❌ ORDINE VETRINA: ${errori} controllo/i fallito/i`}`);
if (errori > 0) process.exitCode = 1;


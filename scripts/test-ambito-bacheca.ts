/**
 * GUARDIA — SCOPE PROVINCIALE DELLA BACHECA (§26.122, sostituisce §26.111).
 * -----------------------------------------------------------------------------------
 * PERCHÉ CAMBIA. Fino al 30/10/2026 questa guardia difendeva l'opposto: sotto i
 * cinque posti la vetrina si allargava prima alla REGIONE e poi all'ITALIA
 * (`ambitoBacheca.integraAmbiti`), e ogni riga aggiunta era dichiarata con un
 * badge d'ambito. La direttiva del 31/10/2026 ha revocato quella regola: le
 * «cinque opportunità» di un utente di Asti erano avvisi di Vercelli e di altre
 * regioni, senza voto e senza affinità di classe — un riempimento, non un match.
 * Oggi vale il contrario:
 *   1. la bacheca contiene SOLO le province scelte dal profilo (o entro i 60 km,
 *      che è una modale dichiarata dell'utente, non un automatismo);
 *   2. se non c'è nulla di pertinente la lista è VUOTA — zero è una risposta, e
 *      la pagina la dichiara con il motivo e con la strada per allargare;
 *   3. il feed non fa più la query larga «senza filtro geografico»;
 *   4. il modulo `ambitoBacheca` e la funzione `vetrinaConAmbiti` non esistono
 *      più: nessun codice morto che possa riaccendere l'allargamento.
 *
 * Uso: npm run test:ambito-bacheca  (incluso in `npm test`)
 */
import { existsSync, readFileSync } from 'node:fs';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import type { Interpello } from '../src/data/interpelli.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Data fra N giorni in ISO: la finestra delle opportunità è di 15 giorni (§26.71). */
const fra = (giorni: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

/** Interpello di prova: identità completa, sovrascrivibile campo per campo. */
const avviso = (overrides: Partial<Interpello> = {}): Interpello => ({
  id: 'a1',
  titolo: 'Interpello supplenza A-24 lingua inglese',
  istituto: 'I.I.S. A. CASTIGLIANO',
  provinciaCodice: 'AT',
  provinciaNome: 'Asti',
  classeCodice: 'A-24',
  classiCodes: ['A-24'],
  materia: null,
  ordine: 'secondaria2',
  dataScadenza: fra(5),
  descrizione: 'Interpello supplenza A-24',
  linkFonte: 'https://www.iiscastigliano.edu.it/avvisi/interpello-a24',
  compatibilita: 100,
  ...overrides,
});

const fuoriProvincia = avviso({
  id: 'mi1',
  provinciaCodice: 'MI',
  provinciaNome: 'Milano',
  istituto: 'Liceo Manzoni',
  linkFonte: 'https://www.liceomanzoni.edu.it/avvisi/interpello-a24',
});

/* ------------------ 1) LA PROVINCIA SCELTA È IL PERIMETRO ----------------- */

console.log('\n— 1. Solo le province scelte: la riga di Milano non entra —');
const misto = bachecaInterpelli([avviso(), fuoriProvincia], {
  ordini: ['secondaria2'],
  classi: ['A-24'],
  province: ['AT'],
});
check('la riga di Asti entra', true, misto.lista.some((r) => r.id === 'a1'));
check('la riga di Milano NON entra', false, misto.lista.some((r) => r.id === 'mi1'));

console.log('\n— 2. Nessun match pertinente → ZERO (non cinque righe di ripiego) —');
const vuota = bachecaInterpelli([fuoriProvincia], {
  ordini: ['secondaria2'],
  classi: ['A-24'],
  province: ['AT'],
});
check('la bacheca è vuota', 0, vuota.lista.length);
check('nessuna riga di ripiego fuori provincia', 0, vuota.ripieghiInBacheca);

console.log('\n— 3. Controllo positivo: scegliendo Milano la stessa riga entra —');
const conMilano = bachecaInterpelli([fuoriProvincia], {
  ordini: ['secondaria2'],
  classi: ['A-24'],
  province: ['MI'],
});
check('la riga entra quando la provincia è scelta', 1, conMilano.lista.length);

/* ------------------- 4) IL CODICE NON PUÒ RIACCENDERSI ------------------- */

console.log('\n— 4. L’allargamento regionale/nazionale non esiste più —');
const feed = leggi('src/contexts/app/useInterpelliFeed.ts');
check('il feed non chiama `vetrinaConAmbiti`', false, /vetrinaConAmbiti/.test(feed));
check('il feed non tiene uno stato `fontiAmbito`', false, /fontiAmbito/.test(feed));
check('il feed non conta `mancantiVetrina`', false, /mancantiVetrina/.test(feed));
check('il feed usa la vetrina provinciale', true, /vetrinaVisibile\(bacheca\)/.test(feed));

const vetrina = leggi('src/lib/vetrinaBacheca.ts');
check('`vetrinaConAmbiti` è rimossa', false, /export function vetrinaConAmbiti/.test(vetrina));
check('la vetrina non importa più l’ambito', false, /ambitoBacheca/.test(vetrina));
check('il modulo `ambitoBacheca` è stato eliminato', false, existsSync('src/lib/ambitoBacheca.ts'));

const elenco = leggi('src/pages/dashboard/components/ElencoOpportunita.tsx');
check('la pagina non importa più l’ambito', false, /ambitoBacheca/.test(elenco));
check(
  'lo stato vuoto dichiara che la ricerca NON si allarga',
  true,
  /non allarga la ricerca fuori dalle province/i.test(elenco),
);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ AMBITO BACHECA: solo le province scelte, e zero è una risposta dichiarata.');
} else {
  console.log(`❌ AMBITO BACHECA: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

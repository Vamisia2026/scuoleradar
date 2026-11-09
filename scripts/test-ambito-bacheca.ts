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
 * Dal §26.152 l'ordine della vetrina ha una guardia sua (`scripts/test-ordine-vetrina.ts`):
 * il merito prima dei riempitivi, e fra i riempitivi la PROVINCIA PRINCIPALE — così la zona
 * scelta dall'utente non sparisce sotto le righe entrate col raggio dei 60 km.
 * Qui resta la proprietà che la bacheca deve rispettare: il perimetro di Asti è AT + i vicini.
 *
 * Uso: npm run test:ambito-bacheca  (incluso in `npm test`)
 */
import { existsSync, readFileSync } from 'node:fs';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import {
  frasePerimetro,
  perimetroRicerca,
  provinciaNelPerimetro,
  riassuntoPerimetro,
} from '../src/lib/perimetroRicerca.ts';
import { provinceDiRicerca } from '../src/lib/prossimitaGeografica.ts';
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
check('nessuna riga fuori perimetro (l’unico sbarramento)', 1, vuota.fuoriPerimetro);

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

/* ------------------- 5) UNIONE, NON INTERSEZIONE (03/11/2026) ------------------- */

console.log('\n— 5. La classe non è una porta: si somma, non si interseca —');
check('la query del feed NON filtra per classe', true, /classi: \[\]/.test(feed));
check(
  'la query non passa le classi (era l’AND a monte)',
  false,
  /getFeedInterpelli\(supabase, \{[^}]*classiAttive/.test(feed),
);
check(
  'ma la bacheca riceve le classi del profilo: servono a VOTARE, non a escludere',
  true,
  /bachecaInterpelli\(fontiInterpelli, \{[\s\S]*?classi: classiAttive/.test(feed),
);

const senzaCodici = avviso({
  id: 'a2',
  titolo: 'Supplenza di matematica - scuola secondaria di II grado',
  classeCodice: null,
  classiCodes: [],
});
const unione = bachecaInterpelli([senzaCodici], {
  ordini: ['secondaria2'],
  classi: ['A-24'],
  province: ['AT'],
});
check(
  'l’avviso senza codici classe entra lo stesso (affinità d’ordine, non buco)',
  true,
  unione.lista.some((r) => r.id === 'a2'),
);

/* ------------------- 6) IL PERIMETRO SI DICHIARA (§26.150) ------------------- */

console.log('\n— 6. Il perimetro si DICHIARA: scelte + raggio dalla principale —');
const daAsti = perimetroRicerca(['AT']);
check('la principale è la prima scelta', 'AT', daAsti.principale);
check('perimetro = Asti + le vicine entro 60 km', ['AT', 'AL', 'TO', 'VC'], daAsti.perimetro);
check('le vicine arrivano con i chilometri', [['AL', 32], ['TO', 46], ['VC', 51]], daAsti.entroRaggio.map((v) => [v.codice, v.km]));
const fraseAsti = frasePerimetro(daAsti);
check('la frase nomina OGNI provincia del raggio, con la distanza', true, /Alessandria \(32 km\)/.test(fraseAsti) && /Torino \(46 km\)/.test(fraseAsti) && /Vercelli \(51 km\)/.test(fraseAsti));
check('il riassunto accanto al conteggio dice «Asti + 60 km»', 'Asti + 60 km: Alessandria 32 km · Torino 46 km · Vercelli 51 km', riassuntoPerimetro(daAsti));
/* L'AUDIT DEL 06/11/2026 — deselezionare non restringe: cambia il CENTRO. */
const quattro = perimetroRicerca(['TO', 'CN', 'AL', 'AT']);
check('quattro province: la principale è la prima', 'TO', quattro.principale);
check('quattro province: nessun raggio (tutte già scelte)', ['TO', 'CN', 'AL', 'AT'], quattro.perimetro);
check('…e niente da dichiarare oltre la selezione', 0, quattro.entroRaggio.length);
check(
  'DA 4 PROVINCE A 1 il perimetro resta di 4: è il raggio, non un filtro rotto',
  4,
  daAsti.perimetro.length,
);
const nonDichiarate = daAsti.perimetro.filter((c) => !daAsti.proprie.includes(c) && !daAsti.entroRaggio.some((v) => v.codice === c));
check('nessuna provincia entra senza essere dichiarata (scelta, oppure raggio con km)', [], nonDichiarate);
check('la query del feed chiede ESATTAMENTE il perimetro', daAsti.perimetro, provinceDiRicerca(['AT']));
check('fuori dal raggio', 'fuori', provinciaNelPerimetro(daAsti, 'MI'));
check('dentro il raggio', 'raggio', provinciaNelPerimetro(daAsti, 'TO'));
check('provincia scelta', 'propria', provinciaNelPerimetro(daAsti, 'AT'));
check('senza selezione non c’è perimetro', 'non-applicabile', provinciaNelPerimetro(perimetroRicerca([]), 'AT'));
check('la frase del vuoto non inventa una provincia', true, /Nessuna provincia scelta/.test(frasePerimetro(perimetroRicerca([]))));

/* La bacheca applica lo stesso confine, riga per riga. */
const alessandria = avviso({
  id: 'al1',
  provinciaCodice: 'AL',
  provinciaNome: 'Alessandria',
  istituto: 'Liceo G. Peano',
  linkFonte: 'https://www.liceopeano.edu.it/avvisi/interpello-a24',
});
const vercelli = avviso({
  id: 'vc1',
  provinciaCodice: 'VC',
  provinciaNome: 'Vercelli',
  istituto: 'Liceo G. B. Cavour',
  linkFonte: 'https://www.liceocavour.edu.it/avvisi/interpello-a24',
});
const profiloAsti = { ordini: ['secondaria2' as const], classi: ['A-24'], province: ['AT'] };
const vicinaAl = bachecaInterpelli([alessandria], profiloAsti);
check('Alessandria entra per il raggio (stessa regola del perimetro)', ['al1'], vicinaAl.lista.map((r) => r.id));
const motivoVicina = vicinaAl.lista[0]?.motivoCompatibilita ?? '';
check('…e la riga dichiara di essere fuori dalle province scelte, con i chilometri', true, /provincia vicina: fuori dalle province scelte \(32 km da AT\)/.test(motivoVicina));
check(
  'Vercelli (51 km) entra allo stesso modo: nessuna provincia «silenziosa»',
  ['vc1'],
  bachecaInterpelli([vercelli], profiloAsti).lista.map((r) => r.id),
);

/* Il cablaggio: il numero e la frase nascono dalla stessa funzione. */
check('il feed costruisce la query dal perimetro dichiarato', true, /perimetroRicerca\(provinceAttive\)/.test(feed));
check('il conteggio della bacheca porta la frase del perimetro', true, /riassuntoPerimetro/.test(elenco));
const pannello = leggi('src/departments/radar/preferenze/PannelloProvince.tsx');
check('le preferenze dichiarano il perimetro sotto le pillole', true, /frasePerimetro\(perimetro\)/.test(pannello));
check(
  '…e usano lo stesso tetto di piano della bacheca',
  true,
  /limitaSelezione\(provinceCodici, maxProvince\)/.test(pannello),
);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ AMBITO BACHECA: solo le province scelte, e zero è una risposta dichiarata.');
} else {
  console.log(`❌ AMBITO BACHECA: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

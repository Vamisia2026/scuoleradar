/**
 * ScuoleRadar.it — GUARDIA DELLA PERTINENZA DEL SOSTEGNO (§26.120).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La direttiva del 30/10/2026 ha chiesto di togliere dalla bacheca le
 * «cinque opportunità» che non c'entravano nulla col profilo: un avviso di sostegno
 * per l'INFANZIA proposto al 60% a un docente di Lingue della SECONDARIA, oppure un
 * avviso di sostegno in una provincia che l'utente non ha scelto (Vercelli per chi ha
 * scelto AT/AL/CN/TO). Il 60% non era un punteggio sbagliato: era una riga ripescata
 * dal paracadute «5» dopo essere stata esclusa dalla bacheca.
 *
 * La regola ha due lati e questa guardia li fissa entrambi:
 *   1. **motore** — `ordineAvviso` (ordine dal campo, dal codice di classe o dal
 *      titolo), `sostegnoPertinente` (stesso ordine di scuola del profilo) e
 *      `punteggioCompatibilita`, che NON assegna il 60% fuori ordine o fuori provincia;
 *   2. **bacheca** — la valutazione respinta resta respinta (`escluso`), non viene
 *      «graduata» dalla media delle modali, e la SCORTA del paracadute non la ripesca.
 * Il caso limite è dichiarato: se il profilo non ha ordini (la CONSEGNA non li legge)
 * o l'avviso non dichiara l'ordine, la regola non scarta nulla — mai un falso negativo
 * per un dato che la fonte non pubblica.
 *
 * Esecuzione: `npm run test:sostegno` (incluso in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { valutaCompatibilita } from '../src/lib/compatibilitaGraduata.ts';
import {
  PUNTEGGIO_EXTRA_SOSTEGNO,
  PUNTEGGIO_MATCH_NESSUNO,
  ordineAvviso,
  punteggioCompatibilita,
  sostegnoPertinente,
} from '../src/lib/matchingEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/** Il profilo della direttiva: docente di Lingue della secondaria, Piemonte. */
const profilo = {
  province: ['AT', 'AL', 'CN', 'TO'],
  classi: ['A-24', 'A-25'],
  ordini: ['secondaria2' as const],
};
const sostegnoInfanzia = {
  province: 'AT',
  classi: ['ADAA'],
  materia: 'Sostegno',
  titolo: 'Interpello sostegno scuola dell’infanzia',
};

console.log('— ordineAvviso: l’ordine di scuola si legge, non si indovina —');
check('dal CAMPO pubblicato dalla fonte', 'secondaria2', ordineAvviso({ ordine: 'secondaria2' }));
check('dal CODICE di classe (ADAA → infanzia)', 'infanzia', ordineAvviso({ classi: ['ADAA'] }));
check('dal CODICE di classe (A-22 → secondaria II)', 'secondaria2', ordineAvviso({ classi: ['A-22'] }));
check('dal TITOLO quando il codice tace', 'primaria', ordineAvviso({ titolo: 'Interpello sostegno scuola primaria' }));
check('nessun indizio → null (dato assente, non un giudizio)', null, ordineAvviso({ titolo: 'Interpello' }));


console.log('\n— sostegnoPertinente: l’area sostegno non è un lasciapassare fra ordini —');
check('sostegno della PROPRIA secondaria → pertinente', true, sostegnoPertinente(profilo, { classi: ['ADSS'] }));
check('sostegno INFANZIA per la secondaria → NON pertinente', false, sostegnoPertinente(profilo, sostegnoInfanzia));
check(
  'profilo senza ordini (CONSEGNA) → nessuna esclusione',
  true,
  sostegnoPertinente({ classi: ['A-24'] }, sostegnoInfanzia),
);
check(
  'avviso senza ordine riconoscibile → nessuna esclusione',
  true,
  sostegnoPertinente(profilo, { titolo: 'Interpello' }),
);

console.log('\n— punteggioCompatibilita: il 60% vive solo dove è plausibile —');
check(
  'fuori ordine, nella provincia scelta → 0 (niente 60%)',
  PUNTEGGIO_MATCH_NESSUNO,
  punteggioCompatibilita(profilo, sostegnoInfanzia, { provinceLimitrofe: true }),
);
check(
  'provincia solo LIMITROFA (VC entro 60 km) → 0, nemmeno come extra',
  PUNTEGGIO_MATCH_NESSUNO,
  punteggioCompatibilita(profilo, { ...sostegnoInfanzia, province: 'VC' }, { provinceLimitrofe: true }),
);
check(
  'stesso ordine + provincia scelta → resta il suggerimento EXTRA a 60',
  PUNTEGGIO_EXTRA_SOSTEGNO,
  punteggioCompatibilita(
    profilo,
    { province: 'AT', classi: ['ADSS'], materia: 'Sostegno', titolo: 'Interpello sostegno' },
    { provinceLimitrofe: true },
  ),
);

console.log('\n— valutaCompatibilita: una riga respinta resta respinta (non si «gradua») —');
const respinto = valutaCompatibilita(profilo, sostegnoInfanzia, { provinceLimitrofe: true });
check('fuori ordine → ESCLUSO', true, respinto.escluso);
check('e non porta punteggio (la media non lo salva)', 0, respinto.punteggio);
const limitrofo = valutaCompatibilita(
  profilo,
  { province: 'VC', classi: ['ADSS'], ordine: 'secondaria2', titolo: 'Interpello sostegno' },
  { provinceLimitrofe: true },
);
check('provincia solo limitrofa → ESCLUSO', true, limitrofo.escluso);
check('e non porta punteggio', 0, limitrofo.punteggio);
const pertinente = valutaCompatibilita(
  { ...profilo, materieCustom: ['Intelligenza Artificiale'] },
  { province: 'AT', classi: ['ADSS'], ordine: 'secondaria2', titolo: 'Interpello sostegno: intelligenza artificiale' },
  { provinceLimitrofe: true },
);
check('pertinente: resta al pavimento di 60', PUNTEGGIO_EXTRA_SOSTEGNO, pertinente.punteggio);
check('la competenza non lo promuove', null, pertinente.competenzaSecondaria);
check('e il jolly tace sul suggerimento extra', null, pertinente.jollySemantico);

console.log('\n— bacheca: la scorta del paracadute non ripesca fuori pertinenza —');
const bacheca = leggi('src/lib/bachecaInterpelli.ts');
check(
  'il ramo «non in Radar» non scrive più nella scorta',
  false,
  /if \(!valutazione\.escluso\) scorta\.push\(candidatoRipiego\(i, valutazione\)\)/.test(bacheca),
);
check('la geografia non sostituisce l’affinità di classe', true, /senzaAffinitaClasse/.test(bacheca));
check('il conto è dichiarato nell’esito', true, /senzaAffinitaClasse: number/.test(bacheca));

console.log('\n— Cablaggio —');
const pkg = leggi('package.json');
check('guardia dedicata in package.json', true, /"test:sostegno": "tsx scripts\/test-sostegno-pertinenza.ts"/.test(pkg));
check('guardia nella catena di `npm test`', true, /test-sostegno-pertinenza\.ts/.test(pkg));

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ SOSTEGNO: pertinenza per ordine di scuola e provincia scelta, scorta senza righe estranee.');
} else {
  console.log(`❌ SOSTEGNO: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}


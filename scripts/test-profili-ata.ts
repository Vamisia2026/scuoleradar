/**
 * GUARDIA — APERTURA A TUTTO IL PERSONALE DELLA SCUOLA (§26.126).
 * -----------------------------------------------------------------------------------
 * PERCHÉ ESISTE. La direttiva del 31/10/2026: «nessuna opportunità ATA o di
 * segreteria deve essere scartata a monte come fuori classe di concorso; il Radar
 * Live e il Radar Personale devono riflettere tutti i lavoratori della scuola».
 * Il difetto era preciso e misurabile: `rilevaClassi` conosceva solo i codici dei
 * docenti, un bando ATA entrava con `class_codes` VUOTO e la RPC `match_interpelli`
 * (overlap `&&`) non poteva agganciarlo a nessun profilo.
 *
 * Questa guardia fissa le tre gambe della correzione:
 *   1. RICONOSCIMENTO — «personale ATA» → famiglia intera; «collaboratori
 *      scolastici» / «assistenti amministrativi/tecnici» → profilo esplicito;
 *      nessun falso positivo da «data», «ATAC», «ATA24»;
 *   2. INGESTIONE — `rilevaClassi`, la forma del codice del table-reporter e
 *      `class_codes` portano davvero `ATA-AA`/`ATA-AT`/`ATA-CS`;
 *   3. CONSEGNA — matching e punteggio trattano il codice ATA come una classe
 *      esatta, e il gate di qualità non scarta il bando.
 *
 * Esecuzione: `npm run test:profili-ata` (inclusa in `npm test`).
 */
import { readFileSync } from 'node:fs';
import { classiConcorso } from '../src/data/classiConcorso.ts';
import { materie, ordiniScuola } from '../src/data/ordiniMaterie.ts';
import {
  CODICI_ATA,
  codiciAtaDaTesto,
  dichiaraPersonaleAta,
  eCodiceAta,
  etichettaProfiloAta,
  normalizzaCodiceAta,
} from '../src/lib/profiliAta.ts';
import {
  avvisoCompatibileConProfilo,
  normalizzaClasse,
  variantiClasseCodice,
} from '../src/lib/matchingEngine.ts';
import { punteggioClasse, PUNTEGGIO_CLASSE_ESATTA } from '../src/lib/punteggioClasse.ts';
import { rilevaClassi } from '../src/scraper/parser.ts';
import { motivoScartoOpportunita } from '../src/scraper/qualitaOpportunita.ts';
import { isAdministrativeNoise } from '../src/lib/noiseFilter.ts';
import { motivoRigaNonOpportunitaAvviso } from '../src/lib/qualitaAvviso.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');

/* --------------------- 1) Il catalogo e l'interfaccia --------------------- */

console.log('\n— 1. I tre profili ATA esistono davvero nel catalogo e nella UI —');
const ataCatalogo = classiConcorso.filter((c) => c.ordine === 'ata');
check('tre profili ATA a catalogo', [...CODICI_ATA], ataCatalogo.map((c) => c.codice).sort());
check(
  'tutti e tre con una materia del catalogo (mai un id orfano)',
  true,
  ataCatalogo.every(
    (c) => c.materie.length > 0 && c.materie.every((id) => materie.some((m) => m.id === id)),
  ),
);
check(
  "l'ordine «Personale ATA» è selezionabile nel wizard (Passo 1)",
  true,
  ordiniScuola.some((o) => o.id === 'ata'),
);
check('l’icona dell’ordine ATA è mappata', true, /ata:\s*</.test(leggi('src/departments/radar/ordineIcone.tsx')));

/* ------------------------- 2) Riconoscimento dal testo -------------------- */

console.log('\n— 2. Riconoscimento: profilo esplicito, famiglia, nessun falso positivo —');
check(
  '«personale ATA» → famiglia intera (il bando è aperto a tutti i profili)',
  ['ATA-AA', 'ATA-AT', 'ATA-CS'],
  codiciAtaDaTesto('Avviso di selezione per il conferimento di incarichi a personale ATA'),
);
check(
  '«collaboratore scolastico» → solo ATA-CS',
  ['ATA-CS'],
  codiciAtaDaTesto('Bando per collaboratore scolastico a.s. 2026/2027'),
);
check('«bidelli» (parola delle fonti) → ATA-CS', ['ATA-CS'], codiciAtaDaTesto('Supplenza bidelli - plesso centrale'));
check(
  '«assistente amministrativo» → solo ATA-AA',
  ['ATA-AA'],
  codiciAtaDaTesto('Interpello per assistente amministrativo, 36 ore'),
);
check('«personale di segreteria» → ATA-AA', ['ATA-AA'], codiciAtaDaTesto('Avviso per personale di segreteria'));
check(
  '«assistenti tecnici di laboratorio» → solo ATA-AT',
  ['ATA-AT'],
  codiciAtaDaTesto('Selezione assistenti tecnici di laboratorio informatico'),
);
check('titolo «ATA – a.s. 2026/27» → famiglia', ['ATA-AA', 'ATA-AT', 'ATA-CS'], codiciAtaDaTesto('ATA - a.s. 2026/27'));
check('«data» NON è un ATA', [], codiciAtaDaTesto('Interpello A-12 con scadenza in data 12/09/2026'));
check('«ATAC» NON è un ATA', [], codiciAtaDaTesto('Sciopero ATAC e mobilità urbana'));
check('«ATA24» (codice compatto) NON è un ATA', [], codiciAtaDaTesto('Classe ATA24 - graduatoria'));
check('testo vuoto → nessun profilo', [], codiciAtaDaTesto('   '));
check('solo famiglia richiesta → nessun profilo esplicito', [], codiciAtaDaTesto('Personale ATA', { famiglia: false }));
check('segnale booleano per il pre-filtro', true, dichiaraPersonaleAta('personale ATA') && !dichiaraPersonaleAta('data'));
check('normalizzazione delle grafie', 'ATA-CS', normalizzaCodiceAta('ata cs'));
check('normalizzazione del trattino tipografico', 'ATA-AT', normalizzaCodiceAta('ATA‑AT'));
check('codice fuori catalogo', false, eCodiceAta('ATA-DSGA'));
check('etichetta leggibile (mai il solo codice)', 'Collaboratore scolastico', etichettaProfiloAta('ATA-CS'));

/* --------------------- 3) Ingestione: il codice entra -------------------- */

console.log('\n— 3. Ingestione: il codice ATA arriva in `class_codes` —');
check(
  'rilevaClassi legge il bando ATA accanto alla classe docente',
  ['A-12', 'ATA-AA', 'ATA-AT', 'ATA-CS'],
  rilevaClassi('Supplenza A-12 e incarichi a personale ATA').sort(),
);
check('rilevaClassi: nessun codice per un bando senza classi', [], rilevaClassi('Pulizie dei locali scolastici'));
const reporter = leggi('scripts/table-reporter.ts');
check(
  'la forma del codice accetta i profili ATA',
  true,
  reporter.includes('ATA-(?:AA|AT|CS)'),
);
check(
  'class_codes riceve le classi ATA in ogni punto di costruzione del record',
  true,
  (reporter.match(/\.\.\.classiAtaDaTesto\(/g) ?? []).length >= 5,
);
check(
  '`extractSubjectAndClass` traduce un profilo esplicito in codice',
  true,
  /codiciAtaDaTesto\(text\)/.test(reporter),
);
check(
  'la funzione `classiArray` resta il punto unico di scrittura di `class_codes`',
  true,
  (reporter.match(/class_codes: classiArray\(/g) ?? []).length >= 5,
);

/* ------------------- 4) Consegna: matching e punteggio ------------------- */

console.log('\n— 4. Consegna: il profilo ATA aggancia il bando ATA —');
check('normalizzaClasse lascia intatto il codice ATA', 'ATA-AA', normalizzaClasse('ata aa'));
check(
  'varianti per la query DB: il codice ATA è già canonico (nessuna variante numerica)',
  ['ATA-AA'],
  variantiClasseCodice('ATA-AA'),
);
check(
  'profilo ATA-AA + avviso ATA-AA nella stessa provincia → consegnato',
  true,
  avvisoCompatibileConProfilo({ province: ['AT'], classi: ['ATA-AA'] }, { province: 'AT', classi: ['ATA-AA'] }).ok,
);
check(
  'profilo ATA-CS + avviso ATA-AA → non è un match per classe',
  'classe',
  avvisoCompatibileConProfilo({ province: ['AT'], classi: ['ATA-CS'] }, { province: 'AT', classi: ['ATA-AA'] }).motivo,
);
check(
  'famiglia ATA: il profilo ATA-AA aggancia il bando «personale ATA» (tre classi)',
  true,
  avvisoCompatibileConProfilo(
    { province: ['AT'], classi: ['ATA-AA'] },
    { province: 'AT', classi: codiciAtaDaTesto('personale ATA') },
  ).ok,
);
check(
  'punteggio: classe ATA esatta = 100, non «estranea»',
  PUNTEGGIO_CLASSE_ESATTA,
  punteggioClasse({ classi: ['ATA-AA'] }, { classi: ['ATA-AA'] })?.punteggio,
);

/* ------------------- 5) Gate di qualità: non si scarta ------------------ */

console.log('\n— 5. Gate di qualità: il bando ATA non è rumore né «non opportunità» —');
check(
  'motivoScartoOpportunita: bando ATA con scadenza → ammesso',
  null,
  motivoScartoOpportunita({
    title: 'Avviso di selezione per collaboratore scolastico',
    corpo: 'Domande entro il 12/11/2026 al protocollo della scuola.',
    expirationDate: '2099-12-31',
    classCodes: ['ATA-CS'],
  }),
);
check(
  'motivoScartoOpportunita: bando ATA senza classe dichiarata → ammesso lo stesso',
  null,
  motivoScartoOpportunita({
    title: 'Bando per il conferimento di incarichi a personale ATA',
    corpo: 'Candidature entro e non oltre il 20/11/2026.',
    expirationDate: '2099-12-31',
    classCodes: [],
  }),
);
check(
  'motivoRigaNonOpportunita: la riga ATA è un avviso',
  null,
  motivoRigaNonOpportunitaAvviso({
    titolo: 'Incarichi personale ATA',
    classiCodes: codiciAtaDaTesto('personale ATA'),
  }),
);
check(
  'il bando ATA sopravvive al rumore soft della vita scolastica',
  false,
  isAdministrativeNoise(
    'Circolare per le famiglie. Avviso di selezione per personale ATA: domande entro il 12/11/2026.',
    'Incarichi a personale ATA',
  ).isNoise,
);

console.log('\n' + '─'.repeat(70));
if (errori === 0) {
  console.log('✅ PERSONALE ATA: riconosciuto, indicizzato, consegnato. Nessun lavoratore della scuola tagliato fuori.');
} else {
  console.log(`❌ PERSONALE ATA: ${errori} controllo/i fallito/i`);
  process.exitCode = 1;
}

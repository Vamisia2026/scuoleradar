/**
 * GUARDIA · BANDI ATTIVI E GATE DEL LINK (niente scarti da "ping fallace").
 *
 * Disposizioni verificate qui:
 *   · SOLO BANDI ATTIVI — un bando scaduto non entra in bacheca; una scadenza
 *     ASSENTE non è una prova di scadenza (il record resta attivo);
 *   · SOLO CATEGORIE DI RECLUTAMENTO — docenti, ATA, PNRR/PON/POR, esperti
 *     esterni; il resto (notizie, eventi, fondi senza procedura) è fuori;
 *   · PING NON BLOCCANTE — se il bando è strutturato (classe/materia + email di
 *     candidatura) il record si accetta anche quando il server regionale
 *     risponde 403/timeout ai client automatici (blocco anti-bot);
 *   · ANTI-MOCK INTATTO — il link, verificato o no, deve restare una fonte
 *     ufficiale verificabile (`verificaAvviso`).
 *
 * Uso: npm run test:scraper:attivi (incluso in `npm test`)
 */
import {
  CATEGORIE_AMMESSE,
  SEGNALI_EDITORIALI,
  eCategoriaAmmessa,
  eRecordStrutturato,
  eTitoloInformativo,
  motivoScartoOpportunita,
  valutaGateLink,
} from '../src/scraper/qualitaOpportunita.ts';
import { verificaAvviso } from '../src/scraper/parser.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const OGGI = new Date('2026-09-28T09:00:00');

/* --------------------------- A · Bandi attivi --------------------------- */

console.log('— A. Solo bandi ATTIVI (una data assente non è una scadenza) —');
check(
  'bando scaduto → scartato',
  'bando scaduto',
  motivoScartoOpportunita({ title: 'Interpello supplenza A-022', expirationDate: '2026-09-01' }, OGGI),
);
check(
  'bando in scadenza oggi → ammesso',
  null,
  motivoScartoOpportunita({ title: 'Interpello supplenza A-022', expirationDate: '2026-09-28' }, OGGI),
);
check(
  'bando futuro → ammesso',
  null,
  motivoScartoOpportunita({ title: 'Interpello supplenza A-022', expirationDate: '2026-12-31' }, OGGI),
);
check(
  'bando senza scadenza → ammesso (non dimostrabile scaduto)',
  null,
  motivoScartoOpportunita({ title: 'Avviso selezione esperto esterno PNRR' }, OGGI),
);

/* --------------------- B · Categorie di reclutamento --------------------- */

console.log('\n— B. Solo procedure di reclutamento ammesse —');
check(
  'categorie ammesse: interpelli, esperti, PNRR, PON, POR, avvisi',
  ['Interpello / Supplenza', 'Bando Esperti', 'PNRR', 'PON', 'POR', 'Bando / Avviso'],
  [...CATEGORIE_AMMESSE],
);
check('interpello ammesso', true, eCategoriaAmmessa('Interpello / Supplenza'));
check('esperti ammessi', true, eCategoriaAmmessa('Bando Esperti'));
check('categoria "Altro" NON ammessa', false, eCategoriaAmmessa('Altro'));
check(
  'fondi senza procedura di reclutamento → fuori target',
  'categoria fuori target (Altro)',
  motivoScartoOpportunita({ title: 'Fondi strutturali per la scuola: dotazioni 2026' }, OGGI),
);
check(
  'bando PNRR per esperti → ammesso',
  null,
  motivoScartoOpportunita({ title: 'Avviso selezione esperti esterni PNRR — IC Manzoni, Milano' }, OGGI),
);
check('segnali editoriali registrati nel modulo', true, SEGNALI_EDITORIALI.length >= 10);

/* --------------- B2 · Esiti e atti informativi (non opportunità) --------------- */

console.log('\n— B2. Esiti/graduatorie: informazione, non opportunità aperta —');
check(
  'esiti di selezione → scartati',
  "atto informativo/esito (non un'opportunità aperta)",
  motivoScartoOpportunita({ title: 'Esiti procedura di selezione di n. 14 unità di personale ATA' }, OGGI),
);
check('graduatoria definitiva → scartata', true, eTitoloInformativo('Graduatoria definitiva per la selezione di esperti'));
check('revoca/annullamento → scartato', true, eTitoloInformativo('Annullamento dell’avviso di selezione prot. 123'));
check(
  'interpello che CITA le graduatorie resta ammesso',
  null,
  motivoScartoOpportunita({ title: 'Interpello supplenza A-022 da graduatorie di istituto — Liceo Manzoni' }, OGGI),
);
check(
  'feed strutturato: riga senza keyword ammessa (natura garantita dalla fonte)',
  null,
  motivoScartoOpportunita({ title: 'A-022 Matematica 18 ore — Liceo Manzoni, Milano' }, OGGI, { daFonteInterpelli: true }),
);
check(
  'feed strutturato: la notizia resta comunque fuori',
  true,
  motivoScartoOpportunita({ title: 'Comunicato stampa del Ministro sulla scuola' }, OGGI, { daFonteInterpelli: true }) !== null,
);

/* ------------------------ C · Record strutturato ------------------------ */

console.log('\n— C. Record STRUTTURATO = classe/materia + email di candidatura —');
check('classe + email → strutturato', true, eRecordStrutturato({ classCodes: ['A-022'], contactEmail: 'miic81200x@istruzione.it' }));
check('materia + email → strutturato', true, eRecordStrutturato({ materia: 'Matematica', contactEmail: 'miic81200x@istruzione.it' }));
check('classe senza email → NON strutturato', false, eRecordStrutturato({ classCodes: ['A-022'], contactEmail: null }));
check('email senza classe/materia → NON strutturato', false, eRecordStrutturato({ classCodes: [], contactEmail: 'miic81200x@istruzione.it' }));
check('email non valida → NON strutturato', false, eRecordStrutturato({ classCodes: ['A-022'], contactEmail: 'non-una-email' }));
check('record vuoto → NON strutturato', false, eRecordStrutturato({}));

/* ------------------------ D · Gate del link (anti-bot) ------------------------ */

console.log('\n— D. Ping fallace ≠ record scartato —');
const STRUTTURATO = {
  title: 'Interpello supplenza A-022 Matematica — Liceo Manzoni',
  link: 'https://www.liceomanzoni.edu.it/interpelli/avviso-a022',
  classCodes: ['A-022'],
  materia: 'Matematica',
  contactEmail: 'miic81200x@istruzione.it',
};
const INCOMPLETO = {
  title: 'Avviso generico di reclutamento',
  link: 'https://www.liceomanzoni.edu.it/interpelli/avviso',
  classCodes: [],
  materia: null,
  contactEmail: null,
};
const esito = (a: Parameters<typeof valutaGateLink>[0], r: boolean | null) => {
  const e = valutaGateLink(a, r);
  return { accetta: e.accetta, verificato: e.verificato };
};

check('link raggiungibile → accettato e verificato', { accetta: true, verificato: true }, esito(STRUTTURATO, true));
check(
  'ping non eseguito (già strutturato) → accettato, non verificato',
  { accetta: true, verificato: false },
  esito(STRUTTURATO, null),
);
check(
  '403/anti-bot + record STRUTTURATO → ACCETTATO (disposizione inderogabile)',
  { accetta: true, verificato: false },
  esito(STRUTTURATO, false),
);
check('403/anti-bot + record INCOMPLETO → scartato', false, valutaGateLink(INCOMPLETO, false).accetta);
check('ping non eseguito + record incompleto → scartato', false, valutaGateLink(INCOMPLETO, null).accetta);
check('link raggiungibile + record incompleto → accettato', true, valutaGateLink(INCOMPLETO, true).accetta);
check(
  'il motivo dello scarto è esplicito (mai silenzioso)',
  true,
  /record incompleto/.test(valutaGateLink(INCOMPLETO, false).motivo),
);
check(
  'il motivo di accettazione cita il blocco anti-bot',
  true,
  /anti-bot|strutturato/i.test(valutaGateLink(STRUTTURATO, false).motivo),
);

/* ------------------ E · L'anti-mock NON è stato indebolito ------------------ */

console.log('\n— E. Link ufficiale obbligatorio anche per i record strutturati —');
check(
  'link di prova sempre rifiutato',
  false,
  verificaAvviso({ title: STRUTTURATO.title, link: 'https://example.com/interpello-a022' }).ok,
);
check(
  'home dell’ente rifiutata come fonte di avviso',
  false,
  verificaAvviso({ title: STRUTTURATO.title, link: 'https://www.istruzionepiemonte.it/' }).ok,
);
check(
  'avviso ufficiale accettato',
  true,
  verificaAvviso({ title: STRUTTURATO.title, link: STRUTTURATO.link }).ok,
);

console.log(`\n${errori === 0 ? '✅' : '❌'} BANDI ATTIVI E GATE LINK: ${errori} errore/i`);
if (errori > 0) process.exitCode = 1;


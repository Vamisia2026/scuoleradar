/**
 * GUARDIA · BANDI ATTIVI E GATE DEL LINK (niente scarti da "ping fallace").
 *
 * Disposizioni verificate qui:
 *   · SOLO BANDI ATTIVI — un bando scaduto non entra in bacheca; una scadenza
 *     ASSENTE non è una prova di scadenza (il record resta attivo);
 *   · SOLO CATEGORIE DI RECLUTAMENTO — docenti, ATA, PNRR/PON/POR, esperti
 *     esterni; il resto (notizie, eventi, fondi senza procedura) è fuori;
 *   · PING NON BLOCCANTE — se il bando è strutturato (classe/materia + email di
 *     candidatura) non si pinga affatto: il record si accetta anche quando il
 *     server regionale risponde 403/timeout ai client automatici (blocco anti-bot);
 *   · NIENTE URL MORTI — la decisione sul link è quella di `lib/validitaLink.ts`
 *     applicata in ingresso (`presidioLinkIngresso.ts`, §26.104);
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
} from '../src/scraper/qualitaOpportunita.ts';
import { daControllareInIngresso, valutaIngressoPerLink } from '../src/scraper/presidioLinkIngresso.ts';
import { rilevaCategoriaAvviso, verificaAvviso } from '../src/scraper/parser.ts';

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

/* ---------- B3 · Righe provinciali: la tipologia del posto è il segnale ---------- */

console.log('\n— B3. Righe dei portali provinciali («Posto intero», «Spezzone») —');
// USR Liguria (`provincia.php`): la riga dichiara la TIPOLOGIA del posto e non
// ripete «interpello» (sta solo nel link «Vai all'interpello›»). Senza il segnale
// di tipologia l'intero elenco provinciale veniva scartato come «nessun segnale
// di opportunità»: 93 voci a GE, 0 in bacheca (23/10/2026).
const RIGA_LIGURIA = 'A042 Posto intero IPSIA A. ODERO – Genova STATALE Secondaria II grado 27/10/2026';
check('riga «Posto intero» → ammessa', null, motivoScartoOpportunita({ title: RIGA_LIGURIA }, OGGI));
check('categoria della riga «Posto intero»', 'Interpello / Supplenza', rilevaCategoriaAvviso(RIGA_LIGURIA));
check(
  'riga «Spezzone» → ammessa',
  null,
  motivoScartoOpportunita(
    { title: 'A041 Spezzone IIS A. P. GIANNINI – Chiavari STATALE Secondaria II grado 30/10/2026' },
    OGGI,
  ),
);
// «Preventivo ≤ 10 giorni» è la supplenza preventiva breve della stessa griglia.
const RIGA_PREVENTIVO = 'EEEE Preventivo ≤ 10 giorni IC SANTA MARGHERITA LIGURE – S. Margherita Ligure';
check('riga «Preventivo ≤ 10 giorni» → ammessa', null, motivoScartoOpportunita({ title: RIGA_PREVENTIVO }, OGGI));
check('categoria della riga «Preventivo»', 'Interpello / Supplenza', rilevaCategoriaAvviso(RIGA_PREVENTIVO));
check(
  'preventivo di spesa resta fuori target',
  // Il verdetto resta lo stesso (fuori), il motivo è più preciso: è una pagina
  // di viaggio d'istruzione, cioè RUMORE, prima ancora che una non-opportunità.
  "rumore amministrativo/informativo (viaggio d'istruzione)",
  motivoScartoOpportunita({ title: 'Preventivo di spesa per il viaggio di istruzione a Bruxelles' }, OGGI),
);
// Il confine resta: la tipologia del posto non apre la porta alle notizie.
check(
  'notizia con «posto» generico resta fuori target',
  'nessun segnale di opportunità di lavoro',
  motivoScartoOpportunita({ title: 'Il posto di docente nel nuovo organico 2026/27' }, OGGI),
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

console.log('\n— D. Ping fallace ≠ record scartato · 404 ≠ link vivo —');
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
const HOME = 'https://liceomanzoni.edu.it';
/** Verdetto in una riga: `accetta|link|stato` (la matrice completa è in `test-gate-link-ingresso.ts`). */
const v = (
  a: Parameters<typeof valutaIngressoPerLink>[0],
  e: Parameters<typeof valutaIngressoPerLink>[1],
  home: string | null = null,
) => {
  const r = valutaIngressoPerLink(a, e, home);
  return `${r.accetta ? 'ok' : 'fuori'}|${r.link}|${r.stato}`;
};

check('200 → avviso pubblicato', `ok|${INCOMPLETO.link}|ok`, v(INCOMPLETO, { status: 200 }));
check(
  '403/anti-bot + record STRUTTURATO → ACCETTATO (disposizione inderogabile)',
  `ok|${STRUTTURATO.link}|bloccato`,
  v(STRUTTURATO, { status: 403 }),
);
check(
  '403/anti-bot + record incompleto → accettato (non è un link morto)',
  `ok|${INCOMPLETO.link}|bloccato`,
  v(INCOMPLETO, { status: 403 }),
);
check('ping non eseguito (strutturato) → accettato', `ok|${STRUTTURATO.link}|non-verificabile`, v(STRUTTURATO, null));
check('404 + home ufficiale → si pubblica la home', `ok|${HOME}|assente`, v(INCOMPLETO, { status: 404 }, HOME));
check('404 senza home → riga fuori (mai URL morti)', 'fuori|null|assente', v(INCOMPLETO, { status: 404 }));
check(
  'timeout → link mantenuto (upsert irreversibile: nessuna prova di morte)',
  `ok|${INCOMPLETO.link}|instabile`,
  v(INCOMPLETO, { status: null, errore: 'timeout' }, HOME),
);
check('record strutturato → NON si pinga', false, daControllareInIngresso(STRUTTURATO));
check('record incompleto con link http → si pinga', true, daControllareInIngresso(INCOMPLETO));
check(
  'il motivo dello scarto è esplicito (mai silenzioso)',
  true,
  /nessuna home ufficiale/.test(valutaIngressoPerLink(INCOMPLETO, { status: 404 }).motivo),
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


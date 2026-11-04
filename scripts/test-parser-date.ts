/**
 * TEST PARSER — DATE (PUBBLICAZIONE vs SCADENZA)
 * ---------------------------------------------
 * Verifica che la data di PUBBLICAZIONE (intestazione/contesto) NON venga mai
 * assegnata alla SCADENZA, e che la scadenza reale sia estratta (parole chiave)
 * o calcolata (termine relativo) separatamente, senza inversioni.
 *
 * §26.139: verifica anche il CLASSIFICATORE unico delle date
 * (`lib/scadenzaTesto.classificaDateAvviso`) — una data già passata è la
 * PUBBLICAZIONE, una data oltre i 90 giorni / su una coda d'anno è
 * «Disponibilità aperta / Fine contratto» e resta in bacheca. Le guardie passano
 * un «oggi» DICHIARATO: stesso avviso, stesso esito, in qualunque giorno.
 *
 * §26.142: verifica la PRESUNZIONE di validità di un atto d'albo senza termine —
 * sette giorni dalla pubblicazione, solo dentro la finestra dei sette giorni e
 * solo per un albo / una sezione di reclutamento; con l'hash ancorato alla fonte.
 *
 * Esecuzione:
 *   npm run test:parser:date
 */

import {
  estraiDataPubblicazione,
  estraiDataScadenza,
  parseInterpello,
  type InterpelloInput,
} from '../src/scraper/parser.ts';

/** Interfaccia minima per l'ambiente (senza dipendere da @types/node). */
declare const process: { exitCode?: number };

let falliti = 0;

function check(descrizione: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) {
    falliti += 1;
    console.log(`  ✗ ${descrizione}`);
    console.log(`      atteso:   ${JSON.stringify(atteso)}`);
    console.log(`      ottenuto: ${JSON.stringify(ottenuto)}`);
  } else {
    console.log(`  ✓ ${descrizione}`);
  }
}

function avviso(title: string, opts: Partial<InterpelloInput> = {}): InterpelloInput {
  return { title, link: 'https://esempio.it/a', provincia: 'MI', source: 'fixture', ...opts };
}

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST PARSER — date: pubblicazione vs scadenza');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Data di PUBBLICAZIONE dall\'intestazione/titolo del post —');
check(
  'titolo post "Interpelli Scuola 12 settembre 2026"',
  '2026-09-12',
  estraiDataPubblicazione('Interpelli Scuola 12 settembre 2026'),
);
check(
  'titolo post "Interpelli scuola del 12/09/2026"',
  '2026-09-12',
  estraiDataPubblicazione('Interpelli scuola del 12/09/2026'),
);
check(
  'contesto "Pubblicato il 12 settembre 2026"',
  '2026-09-12',
  estraiDataPubblicazione('Pubblicato il 12 settembre 2026'),
);
check(
  'testo lungo senza indizi di pubblicazione → null',
  null,
  estraiDataPubblicazione(
    'Bando per il conferimento di incarichi di collaboratore scolastico presso gli istituti della provincia, con termine di presentazione delle domande fissato al 30/09/2026.',
  ),
);

console.log('\n— SCADENZA dichiarata con parole chiave (nessuna inversione) —');
check('"Scadenza: 15/09/2026"', '2026-09-15', estraiDataScadenza('Scadenza: 15/09/2026'));
check(
  '"Termine presentazione domande: 22 settembre 2026"',
  '2026-09-22',
  estraiDataScadenza('Termine presentazione domande: 22 settembre 2026'),
);
check('"Domande entro il 12/09/2026"', '2026-09-12', estraiDataScadenza('Domande entro il 12/09/2026'));
check(
  '"entro e non oltre il 20/09/2026"',
  '2026-09-20',
  estraiDataScadenza('Le domande vanno presentate entro e non oltre il 20/09/2026'),
);
check('"scadenza 2026-09-15" (ISO)', '2026-09-15', estraiDataScadenza('scadenza 2026-09-15'));
check(
  '"Scadenza 1° luglio 2026" (ordinale)',
  '2026-07-01',
  estraiDataScadenza('Scadenza 1° luglio 2026'),
);
check(
  'nessuna indicazione di scadenza → null',
  null,
  estraiDataScadenza('Si richiede titolo di accesso valido e disponibilità immediata.', null),
);

console.log('\n— Nessuna inversione: la prima data (pubblicazione) NON è la scadenza —');
// Riferimento FISSO (§26.139): con il classificatore delle date l'esito dipende da
// «oggi», quindi la guardia gli passa un giorno dichiarato — deterministica.
const RIFERIMENTO = { oggi: '2026-09-14' };
const conPubblicazione = parseInterpello(
  avviso('Interpello supplenza A-026 — Liceo scientifico, Milano', {
    dataPubblicazione: '2026-09-12',
    corpo: 'Scadenza: 15/09/2026. Si richiede titolo di accesso valido.',
    ...RIFERIMENTO,
  }),
);
check('publishedAt = data intestazione', '2026-09-12', conPubblicazione.publishedAt);
check('expirationDate = scadenza reale', '2026-09-15', conPubblicazione.expirationDate);

const soloPubblicazione = parseInterpello(
  avviso('Interpello supplenza A-026 Matematica', {
    dataPubblicazione: '2026-09-12',
    corpo: 'Si richiede titolo di accesso valido e disponibilità immediata.',
    ...RIFERIMENTO,
  }),
);
check('senza scadenza dichiarata: publishedAt valorizzato', '2026-09-12', soloPubblicazione.publishedAt);
check('senza scadenza dichiarata: expirationDate = null', null, soloPubblicazione.expirationDate);

const contestoCompleto = parseInterpello(
  avviso('Interpello A-026', {
    corpo: 'Pubblicato il 12/09/2026. Scadenza: 15/09/2026.',
    ...RIFERIMENTO,
  }),
);
check('"pubblicato il 12/09 + scadenza 15/09": publishedAt', '2026-09-12', contestoCompleto.publishedAt);
check('"pubblicato il 12/09 + scadenza 15/09": expirationDate', '2026-09-15', contestoCompleto.expirationDate);

console.log('\n— SCADENZA calcolata da termine relativo —');
const relativa = parseInterpello(
  avviso('Interpello supplenza A-026', {
    dataPubblicazione: '2026-09-10',
    corpo: 'Le istanze devono pervenire entro 7 giorni dalla pubblicazione del presente avviso.',
    ...RIFERIMENTO,
  }),
);
check('publicazione 10/09 + "entro 7 giorni" → 17/09', '2026-09-17', relativa.expirationDate);

console.log('\n— Hint esplicito (dataNota) —');
const conHint = parseInterpello(avviso('Interpello A-026', { dataNota: 'Scadenza 2026-09-30', ...RIFERIMENTO }));
check('dataNota esplicita vince sulla scadenza', '2026-09-30', conHint.expirationDate);

/* ------------- 5) DISCREZIONALITÀ DELLE DATE: passato e fine contratto ------------- */

console.log('\n— §26.139. Una data già passata è la PUBBLICAZIONE, non una scadenza —');
const passata = parseInterpello(
  avviso('Interpello A-026 Matematica — Liceo Majorana', {
    corpo: 'Avviso del 31/10/2026. Termine per la presentazione delle domande: 31/10/2026.',
    oggi: '2026-11-03',
  }),
);
check('data passata → publishedAt', '2026-10-31', passata.publishedAt);
check('data passata → nessuna scadenza perentoria', null, passata.expirationDate);
check('e la natura dichiara che è una pubblicazione', 'pubblicazione', passata.naturaScadenza);

const passataInColonna = parseInterpello(
  avviso('Interpello A-026', { dataNota: '2026-10-31', oggi: '2026-11-03' }),
);
check(
  'data passata DICHIARATA in colonna: resta la scadenza (la fonte l’ha dichiarata)',
  '2026-10-31',
  passataInColonna.expirationDate,
);
check('con natura «termine scaduto»', 'termine_scaduto', passataInColonna.naturaScadenza);

console.log('\n— §26.139. Oltre i 90 giorni / coda d’anno: «Disponibilità aperta / Fine contratto» —');
for (const [data, atteso] of [
  ['2027-04-30', 'disponibilita_aperta'],
  ['2027-06-30', 'disponibilita_aperta'],
  ['2027-08-31', 'disponibilita_aperta'],
] as const) {
  const lontana = parseInterpello(
    avviso('Interpello A-026', { corpo: `Disponibilità fino al ${data}.`, dataNota: data, oggi: '2026-11-03' }),
  );
  check(`${data}: la data resta in bacheca`, data, lontana.expirationDate);
  check(`${data}: natura`, atteso, lontana.naturaScadenza);
}
const imminente = parseInterpello(
  avviso('Interpello A-026', { corpo: 'Domande entro il 12/11/2026.', oggi: '2026-11-03' }),
);
check('termine ravvicinato: natura', 'termine_candidatura', imminente.naturaScadenza);
check('termine ravvicinato: la data resta', '2026-11-12', imminente.expirationDate);

console.log('\n— §26.142. Atto d’albo senza termine: la settimana PRESUNTA —');
const albo = parseInterpello(
  avviso('Avviso di selezione per il conferimento di incarichi — A.S. 2026/2027', {
    link: 'https://www.istituto.edu.it/albo-pretorio/avviso-4711',
    dataPubblicazione: '2026-11-01',
    corpo: 'Si pubblica il presente avviso. Non è indicata alcuna data nel testo.',
    oggi: '2026-11-03',
  }),
);
check('la riga NON si scarta: il termine è presunto', '2026-11-08', albo.expirationDate);
check('con la natura dichiarata', 'disponibilita_aperta', albo.naturaScadenza);
check('la pubblicazione resta quella della fonte', '2026-11-01', albo.publishedAt);
const alboVecchio = parseInterpello(
  avviso('Avviso di selezione per il conferimento di incarichi — A.S. 2026/2027', {
    link: 'https://www.istituto.edu.it/albo-pretorio/avviso-4700',
    dataPubblicazione: '2026-10-20',
    oggi: '2026-11-03',
  }),
);
check('pubblicato tredici giorni prima: nessuna presunzione', null, alboVecchio.expirationDate);
check('e la natura dice che la fonte non ha parlato', 'nessuna', alboVecchio.naturaScadenza);
check(
  'l’identità resta ancorata alla FONTE (hash invariato)',
  alboVecchio.hashId,
  albo.hashId,
);
const fuoriAlbo = parseInterpello(
  avviso('Avviso di selezione per il conferimento di incarichi — A.S. 2026/2027', {
    link: 'https://www.istituto.edu.it/notizie/2026/11/01/avviso-4712',
    dataPubblicazione: '2026-11-01',
    oggi: '2026-11-03',
  }),
);
check('fuori da un albo non si presume nulla', null, fuoriAlbo.expirationDate);
const alboConTermine = parseInterpello(
  avviso('Avviso di selezione — A.S. 2026/2027', {
    link: 'https://www.istituto.edu.it/albo-pretorio/avviso-4713',
    corpo: 'Domande entro il 12/11/2026.',
    oggi: '2026-11-03',
  }),
);
check('se la fonte dichiara il termine, la presunzione tace', '2026-11-12', alboConTermine.expirationDate);

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ PARSER DATE: tutti i controlli superati');
} else {
  console.log(`❌ PARSER DATE: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');

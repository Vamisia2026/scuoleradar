/**
 * TEST PARSER — DATE (PUBBLICAZIONE vs SCADENZA)
 * ---------------------------------------------
 * Verifica che la data di PUBBLICAZIONE (intestazione/contesto) NON venga mai
 * assegnata alla SCADENZA, e che la scadenza reale sia estratta (parole chiave)
 * o calcolata (termine relativo) separatamente, senza inversioni.
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
const conPubblicazione = parseInterpello(
  avviso('Interpello supplenza A-026 — Liceo scientifico, Milano', {
    dataPubblicazione: '2026-09-12',
    corpo: 'Scadenza: 15/09/2026. Si richiede titolo di accesso valido.',
  }),
);
check('publishedAt = data intestazione', '2026-09-12', conPubblicazione.publishedAt);
check('expirationDate = scadenza reale', '2026-09-15', conPubblicazione.expirationDate);

const soloPubblicazione = parseInterpello(
  avviso('Interpello supplenza A-026 Matematica', {
    dataPubblicazione: '2026-09-12',
    corpo: 'Si richiede titolo di accesso valido e disponibilità immediata.',
  }),
);
check('senza scadenza dichiarata: publishedAt valorizzato', '2026-09-12', soloPubblicazione.publishedAt);
check('senza scadenza dichiarata: expirationDate = null', null, soloPubblicazione.expirationDate);

const contestoCompleto = parseInterpello(
  avviso('Interpello A-026', {
    corpo: 'Pubblicato il 12/09/2026. Scadenza: 15/09/2026.',
  }),
);
check('"pubblicato il 12/09 + scadenza 15/09": publishedAt', '2026-09-12', contestoCompleto.publishedAt);
check('"pubblicato il 12/09 + scadenza 15/09": expirationDate', '2026-09-15', contestoCompleto.expirationDate);

console.log('\n— SCADENZA calcolata da termine relativo —');
const relativa = parseInterpello(
  avviso('Interpello supplenza A-026', {
    dataPubblicazione: '2026-09-10',
    corpo: 'Le istanze devono pervenire entro 7 giorni dalla pubblicazione del presente avviso.',
  }),
);
check('publicazione 10/09 + "entro 7 giorni" → 17/09', '2026-09-17', relativa.expirationDate);

console.log('\n— Hint esplicito (dataNota) —');
const conHint = parseInterpello(avviso('Interpello A-026', { dataNota: 'Scadenza 2026-09-30' }));
check('dataNota esplicita vince sulla scadenza', '2026-09-30', conHint.expirationDate);

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ PARSER DATE: tutti i controlli superati');
} else {
  console.log(`❌ PARSER DATE: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');

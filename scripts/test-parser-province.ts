/**
 * TEST PARSER — PROVINCIA & SCUOLA REALE
 * --------------------------------------
 * Verifica che `parseInterpello` estragga provincia e istituto DAI DATI DELLA
 * FONTE (titolo/contesto/codice meccanografico), senza applicare fallback fissi
 * su una provincia (in particolare niente "tutto su Torino").
 *
 * Esecuzione:
 *   npm run test:parser
 */

import {
  estraiEnteEmittente,
  estraiProvincia,
  estraiProvinciaDaCodiceScuola,
  estraiScuola,
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

/** Avviso grezzo con provincia di FONTE sbagliata (per provare la correzione). */
function avviso(
  title: string,
  opts: { provinciaFonte?: string; corpo?: string; schoolCode?: string } = {},
): InterpelloInput {
  return {
    title,
    link: 'https://esempio.it/avviso',
    provincia: opts.provinciaFonte ?? 'TO', // fonte (spesso generica) — NON deve vincere
    source: 'fixture',
    corpo: opts.corpo,
    schoolCode: opts.schoolCode,
  };
}

console.log('──────────────────────────────────────────────────────────');
console.log('🧪 TEST PARSER — provincia & istituto dai dati reali');
console.log('──────────────────────────────────────────────────────────');

console.log('\n— Provincia estratta dal testo (fonte "TO" di default) —');
const casiProvincia: [string, string, string][] = [
  ['Interpello supplenza A-026 Matematica e fisica — Liceo scientifico, Milano', 'MI', 'interpello Lombardia'],
  ['Avviso B-02 Lingue straniere — Istituto comprensivo, Firenze', 'FI', 'avviso Toscana'],
  ['Interpello supplenza sostegno ADEE — Scuola primaria, Brescia', 'BS', 'interpello Brescia'],
  ['Interpello ADSS sostegno secondaria di II grado — Bergamo', 'BG', 'solo città dopo il trattino'],
  ['Bando per esperto esterno PNRR — Biologia e chimica A-050, Pavia', 'PV', 'bando Pavia'],
  ['Interpello — Liceo, Reggio Emilia', 'RE', 'Reggio Emilia'],
  ['Interpello — Liceo, Reggio Calabria', 'RC', 'Reggio Calabria'],
  ['Interpello — Liceo, Prato', 'PO', 'Prato in contesto locativo'],
  ['Interpello di supplenza presso Novara', 'NO', 'comune dopo "presso"'],
];
for (const [title, attesa, nota] of casiProvincia) {
  const esito = parseInterpello(avviso(title));
  check(`"${title.slice(0, 45)}…" → ${attesa} (${nota})`, attesa, esito.province);
}

console.log('\n— Nessun fallback fisso: la fonte vince SOLO se il testo non ha indizi —');
check(
  'titolo senza comune → provincia della fonte (Lombardia/MI)',
  'MI',
  parseInterpello(avviso('Interpello supplenza A-026 Matematica', { provinciaFonte: 'MI' })).province,
);
check(
  'titolo senza comune → provincia della fonte (Piemonte/TO)',
  'TO',
  parseInterpello(avviso('Interpello supplenza A-026 Matematica', { provinciaFonte: 'TO' })).province,
);
check(
  'parola comune ("prato" non locativo) NON genera un falso comune',
  'TO',
  parseInterpello(avviso('Interpello supplenza per il prato della scuola', { provinciaFonte: 'TO' }))
    .province,
);

console.log('\n— Provincia dal codice meccanografico della scuola —');
check('MIIC81200P → MI', 'MI', estraiProvinciaDaCodiceScuola('MIIC81200P'));
check('BSIC81200P via schoolCode → BS', 'BS', parseInterpello(avviso('Interpello supplenza A-026', { schoolCode: 'BSIC81200P' })).province);
check('codice non valido → null', null, estraiProvinciaDaCodiceScuola('XXIC81200P'));

console.log('\n— Istituto emittente estratto dal testo —');
const casiScuola: [string, string | null, string][] = [
  ['Interpello supplenza 18 ore — Liceo "Augusto Monti" di Asti (Classe A-022)', 'Liceo "Augusto Monti" di Asti', 'liceo con nome proprio'],
  ['Avviso Personale ATA — Assistente amministrativo, IC "Giuseppe Giacosa" di Milano', 'IC "Giuseppe Giacosa" di Milano', 'istituto comprensivo'],
  ['Bando PNRR — Esperto esterno in Biologia (A-050), Liceo scientifico di Roma', 'Liceo scientifico di Roma', 'liceo scientifico di Roma'],
  ['Interpello ADSS sostegno secondaria di II grado — Bergamo', null, 'solo città: nessuna scuola'],
  ['Avviso B-02 Lingue straniere — Istituto comprensivo, Firenze', null, 'solo tipologia: nessuna scuola'],
  ['Bando per esperto esterno PNRR — Biologia e chimica A-050, Pavia', null, 'nessuna scuola citata'],
];
for (const [title, attesa, nota] of casiScuola) {
  check(`scuola · ${nota}`, attesa, estraiScuola(title));
}

console.log('\n— Estrazione puntuale (funzioni pure) —');
check('estraiProvincia("Torino") = TO', 'TO', estraiProvincia('Torino'));
check('estraiProvincia("nessun comune qui") = null', null, estraiProvincia('nessun comune qui'));
check('estraiScuola("nessun istituto") = null', null, estraiScuola('nessun istituto'));

console.log('\n— Ente emittente (USP / USR / Ambito) —');
check(
  'USP di Macerata (provincia MC)',
  'USP Macerata',
  estraiEnteEmittente('Interpello supplenza A-022 — USP di Macerata', 'MC')?.nome,
);
check(
  'Ufficio Scolastico Territoriale di Macerata',
  'USP Macerata',
  estraiEnteEmittente('Avviso Ufficio Scolastico Territoriale di Macerata', null)?.nome,
);
check(
  'USR Piemonte (regione esplicita)',
  'USR Piemonte',
  estraiEnteEmittente('Ufficio Scolastico Regionale per il Piemonte — avviso', 'TO')?.nome,
);
check(
  'USR dedotto dalla provincia',
  'USR Marche',
  estraiEnteEmittente('USR — comunicazione interpelli', 'MC')?.nome,
);
check(
  'Ambito Territoriale (città esplicita)',
  'USP Macerata',
  estraiEnteEmittente('Ambito Territoriale di Macerata', null)?.nome,
);
check(
  'Ufficio IV → USP della provincia',
  'USP Macerata',
  estraiEnteEmittente('Decreto Ufficio IV — nomine', 'MC')?.nome,
);
check(
  'nessun indizio → null (nessuna invenzione)',
  null,
  estraiEnteEmittente('Interpello supplenza A-026 Matematica', 'MC')?.nome ?? null,
);

const avvisoUsp = parseInterpello({
  title: 'Interpello supplenza A-022 Italiano — USP di Macerata',
  link: 'https://www.mim.gov.it/web/macerata/-/interpello-a022',
  provincia: 'MC',
  source: 'test',
});
check(
  'parseInterpello: schoolName canonicalizzato in "USP Macerata"',
  'USP Macerata',
  avvisoUsp.schoolName,
);

console.log('\n──────────────────────────────────────────────────────────');
if (falliti === 0) {
  console.log('✅ PARSER: tutti i controlli superati');
} else {
  console.log(`❌ PARSER: ${falliti} controllo/i fallito/i`);
  process.exitCode = 1;
}
console.log('──────────────────────────────────────────────────────────');

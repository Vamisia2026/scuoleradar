/**
 * ScuoleRadar.it — GUARDIA «nome istituto dalla riga della fonte»
 * (`src/scraper/scuolaDaRiga.ts`).
 *
 * Le tabelle delle fonti regionali pubblicano il nome dell'istituto in una colonna
 * ACCANTO al codice meccanografico. Il parser salvava il codice ma non il nome:
 * su 58 avvisi attivi solo 5 avevano `school_name` e **nessuno** era un istituto
 * reale («Conversazione in lingua straniera»), quindi la bacheca restava corta e
 * verde. Qui si fissano le regole di quella lettura, con le righe REALI delle
 * pagine (Piemonte, 29/09/2026) e i casi in cui NON si deve indovinare.
 *
 * Uso: npm run test:scuola-riga (incluso in `npm test`)
 */
import { RE_CODICE_MECCANOGRAFICO_RIGA, scuolaDaRiga } from '../src/scraper/scuolaDaRiga';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Righe REALI delle fonti: il nome sta accanto al codice —');
/** `[codice, riga della fonte (testo normalizzato), nome atteso]` */
const REALI: Array<[string, string, string]> = [
  [
    'ALIC81700X',
    'ALIC81700X IC ALESSANDRIA SPINETTA MARENGO ADEE - SOSTEGNO SCUOLA PRIMARIA Interna Diurno Disponibile fino a 10 giorni 29/09/2026 aperto 2026-09-3',
    'IC ALESSANDRIA SPINETTA MARENGO',
  ],
  [
    'ALIC832002',
    'ALIC832002 ISTITUTO COMPRENSIVO CASALE 1 ADAA - SOSTEGNO SCUOLA INFANZIA Interna Diurno Disponibile fino a 10 giorni 26/09/2026 aperto',
    'ISTITUTO COMPRENSIVO CASALE 1',
  ],
  [
    'ATIC81300N',
    'ATIC81300N I.C. CANELLI EEEE - PRIMARIA Interna Diurno Disponibile fino a 10 giorni 23/09/2026 aperto 2026-09-24 - -',
    'I.C. CANELLI',
  ],
  [
    'CNIC85700P',
    'CNIC85700P I.C. CUNEO CORSO SOLERI EEEE - PRIMARIA Interna Diurno Disponibile fino a 10 giorni 25/09/2026 aperto 2027-06-30 - -',
    'I.C. CUNEO CORSO SOLERI',
  ],
  [
    'VCIC80500N',
    'VCIC80500N IC LIVORNO-TRONZANO EEEE - PRIMARIA Interna Diurno Fino al 30 giugno 24/09/2026 aperto 2026-09-28 - -',
    'IC LIVORNO-TRONZANO',
  ],
  [
    'VCIC80600D',
    'VCIC80600D ISTITUTO COMPRENSIVO DON E. FERRARIS EEEE - PRIMARIA Interna Diurno Supplenza Temporanea fino al 2026-12-04 25/09/2026 aperto',
    'ISTITUTO COMPRENSIVO DON E. FERRARIS',
  ],
];
for (const [codice, riga, atteso] of REALI) {
  check(`riga ${codice}`, atteso, scuolaDaRiga(riga, codice));
}

console.log('\n— 2. Mai indovinare: nessun nome d\'istituto → nessun valore —');
/** La fonte pubblica una MATERIA dove dovrebbe stare la scuola: mai usarla. */
check(
  'etichetta di materia accanto al codice → nessun nome',
  null,
  scuolaDaRiga(
    'ALIC809001 Conversazione in lingua straniera BB02 - Conversazione in lingua straniera (INGLESE) 30/09/2026 aperto',
    'ALIC809001',
  ),
);
/** Nome verboso ma REALE: la finestra larga + il gate lo recuperano per intero. */
check(
  'nome lungo della fonte → recuperato per intero',
  'ISTITUTO COMPRENSIVO DI SCUOLA MATERNA, ELEMENTARE E MEDIA DI MOROZZO',
  scuolaDaRiga(
    'CNIC80200E ISTITUTO COMPRENSIVO DI SCUOLA MATERNA, ELEMENTARE E MEDIA DI MOROZZO EEEE - PRIMARIA Interna Diurno',
    'CNIC80200E',
  ),
);
/** «D'ASTI» perde l'apostrofo nell'HTML: resta il nome completo, mai «…D». */
check(
  'toponimo «ASTI» non è una sigla di sostegno → nome completo',
  'I.C. VILLAFRANCA D ASTI',
  scuolaDaRiga(
    'ATIC810006 I.C. VILLAFRANCA D ASTI ADAA - SOSTEGNO SCUOLA INFANZIA Interna Diurno Disponibile fino a 10 giorni 14/09/2026 aperto',
    'ATIC810006',
  ),
);
check('riga senza codice meccanografico → nessun nome', null, scuolaDaRiga('AAAA | EEEE | ADEE', null));
check(
  'codice dichiarato ma assente dalla riga → nessun nome',
  null,
  scuolaDaRiga('IC ALESSANDRIA SPINETTA MARENGO EEEE - PRIMARIA', 'ALIC81700X'),
);
check('riga vuota → nessun nome', null, scuolaDaRiga('', 'ALIC81700X'));
check('riga nulla → nessun nome', null, scuolaDaRiga(null, 'ALIC81700X'));
check('riga troppo corta → nessun nome', null, scuolaDaRiga('X', 'ALIC81700X'));

console.log('\n— 3. Il codice si riconosce anche da solo (stesso formato del parser) —');
check(
  'codice dal testo quando non viene passato',
  'IC ALESSANDRIA SPINETTA MARENGO',
  scuolaDaRiga(REALI[0][1], null),
);
check('formato codice: 10 caratteri, provincia + tipo + progressivo', true, RE_CODICE_MECCANOGRAFICO_RIGA.test('VCIC80500N'));
check('«AAAA» non è un codice meccanografico', false, RE_CODICE_MECCANOGRAFICO_RIGA.test('AAAA'));

console.log('\n— 4. Nome PRIMA del codice (fonti con colonne invertite) —');
check(
  'nome a sinistra del codice',
  'I.C. CUNEO CORSO SOLERI',
  scuolaDaRiga('I.C. CUNEO CORSO SOLERI CNIC85700P EEEE - PRIMARIA', 'CNIC85700P'),
);

console.log('\n──────────────────────────────────────────────────────────');
console.log(errori === 0 ? '✅ SCUOLA DA RIGA: nomi dalle fonti, mai etichette inventate' : `❌ SCUOLA DA RIGA: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

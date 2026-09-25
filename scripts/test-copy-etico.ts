/**
 * Verifica COPY ETICO (zero competizione, zero gergo, zero aiuti paternalistici).
 *
 * Regola di prodotto: ScuoleRadar non vende la "vittoria" sui colleghi né la fretta.
 * Il tono parla del **valore del tempo** che l'utente si riprende. Questo gate
 * scorre TUTTO `src/**` (UI, messaggi e testi) e fallisce se ricompare una delle
 * frasi vietate; verifica inoltre i testi chiave del PRO e che i campi di input
 * (registrazione, onboarding, wizard, anagrafica) NON usino placeholder con esempi
 * fittizi o nomi di persona.
 *
 * Uso: npm run test:copy:etico (incluso in `npm test`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Frasi VIETATE ovunque (gergo competitivo, senza ambiguità). */
const FRASI_VIETATE = [
  'prima degli altri',
  'prima di tutti',
  'beccare',
  'affrettati',
  'non perdere più una sola opportunità',
  'vantaggio sugli altri',
  'battiamo la concorrenza',
];

/**
 * Frasi di FRETTA ammesse solo come informazione di servizio (es. le convocazioni
 * «possono arrivare in poche ore», una formula legale «comunicato tempestivamente»):
 * sono quindi vietate SOLO nelle superfici di UI/marketing, dove il tono deve
 * parlare del valore del tempo restituito e non dell'urgenza.
 */
const FRASI_FRETTA_MARKETING = ['in poche ore', 'tempestivamente', 'prima che scada', 'prima di scadere'];
/** Radici scansionate con il vincolo di tono (UI e marketing). */
const RADICI_TONO = ['src/components', 'src/pages', 'src/departments/radar'];

/** Elenco ricorsivo dei sorgenti applicativi. */
function sorgenti(cartella: string, acc: string[] = []): string[] {
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) {
      sorgenti(percorso, acc);
    } else if (/\.tsx?$/.test(voce)) {
      acc.push(percorso.replace(/\\/g, '/'));
    }
  }
  return acc;
}

const file = sorgenti('src');
console.log(`— Scansione copy etico su ${file.length} sorgenti —`);
const trovate: string[] = [];
const trovateMarketing: string[] = [];
const fileMarketing = RADICI_TONO.flatMap((radice) => sorgenti(radice));
for (const percorso of file) {
  const testo = readFileSync(percorso, 'utf8').toLowerCase();
  for (const frase of FRASI_VIETATE) {
    if (testo.includes(frase)) trovate.push(`${percorso} → «${frase}»`);
  }
}
for (const percorso of fileMarketing) {
  const testo = readFileSync(percorso, 'utf8').toLowerCase();
  for (const frase of FRASI_FRETTA_MARKETING) {
    if (testo.includes(frase)) trovateMarketing.push(`${percorso} → «${frase}»`);
  }
}
check('nessuna frase competitiva nei sorgenti', [], trovate);
check(
  'nessuna spinta all’urgenza nelle superfici di UI/marketing',
  [],
  trovateMarketing,
);

const leggi = (p: string): string => readFileSync(p, 'utf8');
const authModal = leggi('src/components/AuthModal.tsx');
const benvenuto = leggi('src/departments/radar/components/BenvenutoProRadar.tsx');
const landing = leggi('src/pages/LandingPage.tsx');
const passoNotifica = leggi('src/departments/radar/wizard/PassoNotifica.tsx');

console.log('\n— Banner di benvenuto PRO: valore del tempo —');
check(
  'banner PRO: «Un mese PRO, completamente gratis»',
  true,
  authModal.includes('Un mese PRO, completamente gratis'),
);
check(
  'banner PRO: valore del tempo (niente fretta, niente gare)',
  true,
  /Smetti di perdere ore\s+a cercare sui siti delle\s+scuole/.test(authModal) &&
    /ci pensa il Radar a trovare gli\s+interpelli per te/.test(authModal) &&
    /dedicarti alla tua\s+vita/.test(authModal),
);
check(
  'benvenuto PRO: stessa copy orientata al valore del tempo',
  true,
  benvenuto.includes('completamente gratis') && /dedicarti alla tua\s+vita/.test(benvenuto),
);
check(
  'benvenuto PRO: CTA senza «subito»',
  true,
  benvenuto.includes("'Attiva il Radar'") && !benvenuto.includes('Attiva il Radar subito'),
);

console.log('\n— Landing e Passo 4: nessuna promessa di vantaggio sui colleghi —');
check('landing: il passo finale non promette «prima degli altri»', true, !/prima degli altri/i.test(landing));
check('landing: il passo finale è neutro e operativo', true, landing.includes('Candidati con i link ufficiali'));
check(
  'passo Telegram: collega il canale senza urgenza artificiale',
  true,
  !/scadono in poche ore|per non perdere le opportunità/i.test(passoNotifica) &&
    passoNotifica.includes('Telegram = avvisi ISTANTANEI'),
);

console.log('\n— Campi di input: nessun esempio fittizio nei placeholder —');
/**
 * I placeholder NON devono contenere dati fittizi o nomi di persona («Es. 34»,
 * «mario.rossi@gmail.com», «Mario Rossi»): il campo si spiega con il proprio nome.
 * Vale per registrazione, onboarding, wizard e anagrafica.
 */
const RE_PLACEHOLDER_ESEMPIO =
  /placeholder="[^"]*(?:Es\.|es\.|ES\.|Mario Rossi|mario\.rossi|@gmail|@email\.)/;
const esempiFittizi = fileMarketing.filter((p) => RE_PLACEHOLDER_ESEMPIO.test(readFileSync(p, 'utf8')));
check('nessun placeholder con esempi fittizi o nomi di persona', [], esempiFittizi);
check(
  'registrazione: campi spiegati dal solo nome del campo',
  true,
  /placeholder="Nome"/.test(authModal) &&
    /placeholder="Cognome"/.test(authModal) &&
    /placeholder="Età"/.test(authModal) &&
    /placeholder="La tua email"/.test(authModal),
);

console.log(errori === 0 ? '\n✅ COPY ETICO: nessun problema' : `\n❌ COPY ETICO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

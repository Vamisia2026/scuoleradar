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
 * Le verifiche di LAYOUT del primo schermo (hero su due righe, box «Prova il Radar»
 * allineato, niente riquadri ridondanti fra bacheca e offerta PRO) vivono in
 * `test-copy-primo-schermo.ts`: questo gate resta sotto le 250 righe strutturali.
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
const passoOrdini = leggi('src/departments/radar/wizard/PassoOrdini.tsx');
/** Blocco anagrafico (genere/età): l'UNICO punto del percorso in cui si chiedono. */
const bloccoAnagrafica = leggi('src/components/BloccoAnagrafica.tsx');

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
  'passo Telegram: canale immediato, senza formule deboli né urgenza artificiale',
  true,
  !/scadono in poche ore|per non perdere le opportunità/i.test(passoNotifica) &&
    passoNotifica.includes('Telegram — avvisi istantanei') &&
    passoNotifica.includes('riepilogo giornaliero') &&
    !/fortemente consigliato|Telegram =/i.test(passoNotifica),
);
check(
  'passo Telegram: nessun suggerimento su cosa scrivere nel campo',
  true,
  !/Modifica profilo|lo trovi su Telegram/i.test(passoNotifica),
);
check(
  'wizard: anagrafica a FINE percorso (Passo 4), mai in apertura, senza etichetta «account Base»',
  true,
  passoNotifica.includes('<BloccoAnagrafica') &&
    !passoOrdini.includes('BloccoAnagrafica') &&
    !/account Base/i.test(passoNotifica),
);

console.log('\n— Landing: Radar Live in testa, offerta PRO senza toni da televendita —');
/**
 * Superfici PUBBLICHE della homepage (pagina contenitore + sue sezioni).
 * Vale la regola stretta della checklist pagamenti: nessun termine da volantino
 * per un piano a pagamento e nessuna parola di pagamento accostata al periodo
 * incluso. La prova si comunica con «Prova Inclusa» / «30 giorni di PRO» più il
 * valore concreto (Radar attivo, PureFocus incluso).
 */
const superficiLanding = ['src/pages/LandingPage.tsx', ...sorgenti('src/components/landing')];
const offertaPro = leggi('src/components/landing/LandingOffertaPro.tsx');
/** Registro dei testi modificabili: la vetrina PRO rende i tre blocchi per chiave. */
const registroTesti = leggi('src/data/editableTexts.ts');
const heroLanding = leggi('src/components/landing/LandingHero.tsx');
check(
  'landing: niente «gratis/gratuito» né parole di pagamento (televendita)',
  [],
  superficiLanding.filter((p) => /gratis|gratuit|carta|addebito/i.test(readFileSync(p, 'utf8'))),
);
check(
  'landing: i giorni dell’offerta PRO arrivano da pricing.ts (30 giorni)',
  true,
  offertaPro.includes('GIORNI_TRIAL_PRO') && /from '@\/lib\/pricing'/.test(offertaPro),
);
check(
  'landing: offerta PRO senza importi, rinnovo o disdetta (sezione solo-benefici)',
  [],
  [/rinnovo/i, /disdici/i, /torni su Base/i, /quota annuale/i, /€/, /PREZZO_PRO/].filter((r) => r.test(offertaPro)),
);
/**
 * COPY AUTORIZZATA DAL CLIENTE (28/09/2026): la frase esatta e pulita richiesta —
 * «Siamo così sicuri… passerai automaticamente a un account Base.» — sostituisce la
 * vecchia formula difensiva. La guardia ora pretende **proprio quella** copy (e
 * l'assenza delle vie d'uscita), non più l'assenza della formula.
 */
check(
  'landing: offerta PRO con la copy esatta autorizzata e senza vie d’uscita',
  true,
  offertaPro.includes(
    'Siamo così sicuri che Scuole Radar ti piacerà che il primo mese PRO te lo offriamo noi. Se poi non vuoi abbonarti, passerai automaticamente a un account Base.',
  ) &&
    offertaPro.includes('ATTIVA IL TUO RADAR') &&
    !/Confronta i piani|Scopri i piani|Vedi tutti i piani/i.test(offertaPro) &&
    !/countdown|prezzo che cambia/.test(offertaPro),
);
check(
  'landing: i TRE blocchi dell’offerta PRO sono esattamente quelli previsti',
  true,
  // Copy nel registro testi, blocchi resi per chiave: la vetrina ne dichiara TRE.
  registroTesti.includes('Avvisi Telegram in tempo reale') && registroTesti.includes('Email riepilogativa tutti i giorni alle 17.00') &&
    registroTesti.includes('PureFocus incluso nel piano PRO') &&
    (offertaPro.match(/titolo: 'prezzi\.offerta\./g) ?? []).length === 3 &&
    !/<Link|to="\/prezzi"/.test(offertaPro),
);
check(
  "landing: il Radar Live è il primo contenuto dopo l'hero",
  true,
  landing.indexOf('<LandingHero') < landing.indexOf('<FlightBoardInterpelli') &&
    !landing.includes('LandingProvaRadar'),
);
check(
  'landing: offerta PRO PRIMA di «Cosa riceverai» (leva di conversione)',
  true,
  landing.indexOf('<LandingOffertaPro') > 0 &&
    landing.indexOf('<LandingOffertaPro') < landing.indexOf('<LandingBenefici'),
);
check(
  'landing: hero a due colonne col box «Prova il Radar», titolo senza <br> e spacing compatto',
  true,
  heroLanding.includes('<SimulatorRadar') &&
    heroLanding.includes("from '@/departments/radar'") &&
    /lg:grid-cols-\[minmax\(0,1fr\)_34rem\]/.test(heroLanding) &&
    !/<br\s*\/?>/.test(heroLanding) &&
    heroLanding.includes('pb-8 pt-6'),
);
check(
  'pagine pubbliche: mai «prova gratuita/o» (si dice «prova inclusa»)',
  [],
  sorgenti('src/pages').filter((p) => /prova\s+grat/iu.test(readFileSync(p, 'utf8'))),
);

console.log('\n— Campi di input: nessun esempio fittizio nei placeholder —');
/**
 * I placeholder NON devono contenere dati fittizi o nomi di persona (esempi
 * numerici preceduti da «Es.», indirizzi email di fantasia, nomi di persona): il
 * campo si spiega con il proprio nome. Vale per registrazione, onboarding, wizard
 * e anagrafica.
 */
const RE_PLACEHOLDER_ESEMPIO = /placeholder="[^"]*(?:Es\.|es\.|ES\.|@gmail|@email\.)/;
const esempiFittizi = fileMarketing.filter((p) => RE_PLACEHOLDER_ESEMPIO.test(readFileSync(p, 'utf8')));
check('nessun placeholder con esempi fittizi o nomi di persona', [], esempiFittizi);
check(
  'registrazione: campi spiegati dal solo nome del campo',
  true,
  /placeholder="Nome"/.test(authModal) &&
    /placeholder="Cognome"/.test(authModal) &&
    /placeholder="La tua email"/.test(authModal),
);
check(
  'genere ed età: SOLO a fine percorso (Passo 4), mai nel form di registrazione',
  true,
  !/placeholder="Età"/.test(authModal) &&
    !/label="Sesso"/.test(authModal) &&
    /placeholder="Età"/.test(bloccoAnagrafica) &&
    passoNotifica.includes('<BloccoAnagrafica'),
);

console.log(errori === 0 ? '\n✅ COPY ETICO: nessun problema' : `\n❌ COPY ETICO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * Guardia COPY PUBBLICO — posizionamento delle superfici pubbliche.
 *
 * Estratto da `test-copy-etico.ts` (che restava oltre le 250 righe) per tenere il
 * gate etico sotto la soglia strutturale: qui vivono le verifiche di copy e brand
 * delle superfici che il cliente vede per prime.
 *
 *   1. regalo di benvenuto PRO: «Buone notizie», mai «Sorpresa», e nessuna voce
 *      che permetta di rifiutarlo (il periodo PRO è incluso, non si sceglie);
 *   2. PureFocus: wordmark UFFICIALE tipografico («Pure» #0E0C0A + «Focus»
 *      #0047AB, senza spazi, font black), mai l'emoji 🧘; badge verde «Incluso nel
 *      piano PRO» e link in evidenza a purefocus.one;
 *   3. Chi siamo: CTA «Attiva il tuo radar» e nessun riferimento alla Carta del
 *      Docente in chiave difensiva;
 *   4. FAQ: punti di forza commerciali (app attendibile per la scuola, «Invita un
 *      Collega», PureFocus con Gmail, servizi in arrivo);
 *   5. pagina Prezzi: le FAQ sono commerciali (niente domande difensive) e la
 *      vetrina PureFocus ha la larghezza delle colonne dei piani;
 *   6. form rapido sotto l'hero: nome, cognome ed email finiscono nella bozza e si
 *      apre la modale di configurazione del Radar, già compilata (un solo
 *      passaggio, nessun doppione di modali);
 *   7. sostegno INCLUSO di default (nessun filtro silenzioso) e nessuna identità
 *      demo di fantasia nei sorgenti.
 *
 * Uso: npm run test:copy:pubblico (incluso in `npm test`)
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const benvenutoSoft = leggi('src/components/SoftOnboardingModal.tsx');
const benvenutoPro = leggi('src/departments/radar/components/BenvenutoProRadar.tsx');
const purefocus = leggi('src/components/PureFocusCard.tsx');
const chiSiamo = leggi('src/pages/ChiSiamoPage.tsx');
const faq = leggi('src/pages/FAQPage.tsx');
/** Superfici che mostrano il partner: nessuna può tornare all'emoji 🧘. */
const SUPERFICI_PUREFOCUS = [
  'src/components/PureFocusCard.tsx',
  'src/components/landing/LandingStrumenti.tsx',
  'src/components/landing/LandingPartnerPureFocus.tsx',
  'src/pages/PrezziPage.tsx',
  'src/pages/PureFocusPage.tsx',
];

console.log('— Regalo di benvenuto PRO: non si rifiuta —');
check(
  'benvenuto PRO: «Buone notizie», mai «Sorpresa»',
  true,
  /Buone notizie/.test(benvenutoSoft) && !/sorpresa/i.test(benvenutoSoft),
);
check(
  'benvenuto PRO: nessuna voce per rifiutare il regalo («Non ora» / «Più tardi»)',
  true,
  !/Non ora|Più tardi/i.test(benvenutoSoft) && !/Più tardi/.test(benvenutoPro),
);

console.log('\n— PureFocus: wordmark ufficiale, badge PRO e link —');
check(
  'wordmark «Pure» #0E0C0A + «Focus» #0047AB, senza spazi',
  true,
  purefocus.includes('#0E0C0A') &&
    purefocus.includes('#0047AB') &&
    /Pure\s*<\/span>[\s\S]{0,200}Focus\s*<\/span>/.test(purefocus),
);
check(
  'nessuna emoji 🧘 dove il partner è mostrato',
  [],
  SUPERFICI_PUREFOCUS.filter((p) => leggi(p).includes('🧘')),
);
check(
  'badge verde «Incluso nel piano PRO» e link in evidenza a purefocus.one',
  true,
  purefocus.includes('Incluso nel piano PRO') && purefocus.includes('https://purefocus.one'),
);

console.log('\n— Chi siamo e FAQ: punti di forza, non scuse —');
check(
  'Chi siamo: CTA «Attiva il tuo radar», zero rimandi alla Carta del Docente',
  true,
  chiSiamo.includes('Attiva il tuo radar') && !/Carta del Docente/.test(chiSiamo),
);
check(
  'FAQ: app attendibile, «Invita un Collega», PureFocus con Gmail, servizi in arrivo',
  true,
  /id: 'animatore-digitale'/.test(faq) &&
    /Invita un Collega/.test(faq) &&
    /gmail\.com/.test(faq) &&
    /Carta del Docente/.test(faq) &&
    /Assistente Sindacalista Virtuale/.test(faq),
);

console.log('\n— Pagina Prezzi: FAQ commerciali, partner alla larghezza dei piani —');
const prezzi = leggi('src/pages/PrezziPage.tsx');
check(
  'FAQ Prezzi: animatore digitale, «Invita un Collega», Gmail, servizi in arrivo',
  true,
  /Animatore Digitale/.test(prezzi) &&
    /Invita un Collega/.test(prezzi) &&
    /gmail\.com/.test(prezzi) &&
    /Assistente Sindacalista Virtuale/.test(prezzi) &&
    /Carta del Docente/.test(prezzi),
);
check(
  'FAQ Prezzi: nessuna domanda difensiva (cancellazione / sicurezza pagamenti)',
  [],
  [/cancellarmi/i, /pagamento è sicuro/i, /Nel prototipo il pagamento/i].filter((r) => r.test(prezzi)),
);
check(
  'vetrina PureFocus larga come le colonne dei piani (max-w-5xl)',
  true,
  /<div className="mx-auto max-w-5xl px-4 sm:px-6">\s*<PureFocusCard/.test(prezzi),
);
check(
  'fascia PureFocus della homepage alla stessa larghezza',
  true,
  /max-w-5xl/.test(leggi('src/components/landing/LandingPartnerPureFocus.tsx')),
);
check('wordmark PureFocus in sans-serif black', true, /font-black/.test(purefocus));

console.log('\n— Form rapido: un solo passaggio verso la configurazione del Radar —');
const regRapida = leggi('src/components/landing/LandingRegistrazioneRapida.tsx');
const landingPage = leggi('src/pages/LandingPage.tsx');
check(
  'form con Nome, Cognome ed Email e CTA «Attiva il tuo Radar»',
  true,
  /placeholder="Nome"/.test(regRapida) &&
    /placeholder="Cognome"/.test(regRapida) &&
    /placeholder="La tua email"/.test(regRapida) &&
    /Attiva il tuo Radar/.test(regRapida),
);
check(
  'i tre dati vanno nella BOZZA e aprono la modale di configurazione del Radar',
  true,
  /aggiornaBozzaRegistrazione/.test(landingPage) &&
    /handleRegistrazioneRapida[\s\S]{0,700}openRadarSetup\(\)/.test(landingPage) &&
    !/handleRegistrazioneRapida[\s\S]{0,700}openAuthModal\('registrazione'\)/.test(landingPage),
);
check(
  'sezione resa subito sotto l\'hero, per i visitatori',
  true,
  /<LandingHero[\s\S]{0,700}LandingRegistrazioneRapida/.test(landingPage),
);
check(
  'la sezione non apre modali proprie (prefill, non doppioni)',
  true,
  !/openAuthModal|Modal/.test(regRapida),
);

console.log('\n— Homepage: etichette e sezioni allineate al prodotto —');
/**
 * Etichette e sezioni della pagina pubblica: il primo passo di «Come funziona»
 * parla del Radar, «Cosa riceverai» parla delle opportunità della scuola e la
 * vetrina strumenti resta centrata (due moduli attivi = nessuno spostato a
 * sinistra).
 */
const benefici = leggi('src/components/landing/LandingBenefici.tsx');
const strumenti = leggi('src/components/landing/LandingStrumenti.tsx');
check(
  '«Come funziona»: il primo passo è «Imposta il tuo Radar»',
  true,
  /title="Imposta il tuo Radar"/.test(landingPage) && !/Imposta il tuo profilo/.test(landingPage),
);
check(
  '«Cosa riceverai»: opportunità della scuola inerenti al profilo',
  true,
  benefici.includes('Inserisci quello che ti interessa e vedrai solo le opportunità di lavoro nella scuola') &&
    !/opportunità davvero pertinenti/.test(benefici),
);
check(
  '«I nostri strumenti»: card centrate e bilanciate',
  true,
  /justify-center/.test(strumenti) && !/lg:grid-cols-3/.test(strumenti),
);

console.log('\n— Sostegno incluso di default, nessuna identità demo inventata —');
/**
 * Il sostegno non si chiede più e non si esclude di default: `sostegno: true` in
 * `defaultPreferenze` + colonna DB con default `true` (migrazione
 * `20260927120000_default_sostegno_incluso.sql`). L'uscita resta esplicita
 * (`SostegnoToggle` nelle Preferenze Radar).
 */
const preferenzeDefault = leggi('src/contexts/app/costanti.ts');
const migrazioneSostegno = leggi('supabase/migrations/20260927120000_default_sostegno_incluso.sql');
check(
  'preferenze di default: sostegno incluso',
  true,
  /sostegno: true/.test(preferenzeDefault) && !/sostegno: false/.test(preferenzeDefault),
);
check(
  'DB: default true e allineamento delle righe esistenti',
  true,
  /alter column sostegno set default true/i.test(migrazioneSostegno) &&
    /set sostegno = true/i.test(migrazioneSostegno),
);
check(
  'uscita esplicita disponibile (Preferenze Radar)',
  true,
  /<SostegnoToggle/.test(leggi('src/departments/radar/preferenze/PannelloClassi.tsx')),
);
/** Elenco ricorsivo dei sorgenti `.ts/.tsx` di una cartella. */
function sorgenti(cartella: string, acc: string[] = []): string[] {
  for (const voce of readdirSync(cartella)) {
    const percorso = join(cartella, voce);
    if (statSync(percorso).isDirectory()) sorgenti(percorso, acc);
    else if (/\.tsx?$/.test(voce)) acc.push(percorso.replace(/\\/g, '/'));
  }
  return acc;
}
/** Nome di prova rimosso ovunque: composto a runtime per non citarlo in chiaro qui. */
const NOMI_DI_PROVA = ['Mario' + ' Rossi', 'mario' + '.rossi', 'Maria' + ' Bianchi'];
check(
  'nessun nome di prova nei sorgenti e nei test',
  [],
  [...sorgenti('src'), ...sorgenti('scripts')].filter((p) =>
    NOMI_DI_PROVA.some((nome) => readFileSync(p, 'utf8').includes(nome)),
  ),
);

console.log(errori === 0 ? '\n✅ COPY PUBBLICO: nessun problema' : `\n❌ COPY PUBBLICO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

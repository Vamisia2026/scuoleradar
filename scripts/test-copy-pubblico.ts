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
 *   4. FAQ: punti di forza commerciali, con UN solo elenco condiviso fra `/faq` e
 *      `/prezzi` (i testi vivono nel registro `src/data/editableTexts.ts`);
 *   5. pagina Prezzi: le FAQ arrivano dall’elenco condiviso (niente domande difensive) e la
 *      vetrina PureFocus ha la larghezza delle colonne dei piani;
 *   6. form rapido (condiviso tra la sezione sotto l'hero e la chiusura PRO):
 *      nome, cognome ed email finiscono nella bozza e si apre la modale di
 *      configurazione del Radar, già compilata (un solo passaggio, un solo
 *      percorso: nessun doppione di modali);
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
// Copy FAQ nel registro testi: si verifica la copy E il cablaggio della pagina.
const faqTesti = leggi('src/data/editableTexts.ts');
const elencoFaq = leggi('src/data/faqPubbliche.ts');
check('FAQ: copy commerciale nel registro, elenco condiviso e pagine cablate', true,
  /from '@\/data\/faqPubbliche'/.test(faq) && /FAQ_PUBBLICHE\.map/.test(faq) && /testo\(f\.q\)/.test(faq) &&
  /id: 'animatore-digitale'/.test(elencoFaq) &&
  /Invita un Collega/.test(faqTesti) && /account Gmail/.test(faqTesti) && /Carta del Docente/.test(faqTesti) &&
  /buono Amazon da 10 Euro/.test(faqTesti) && /piano-conveniente/.test(faqTesti) &&
  /regala-pro-collega/.test(faqTesti));

console.log('\n— Pagina Prezzi: FAQ dall’elenco condiviso, partner alla larghezza dei piani —');
const prezzi = leggi('src/pages/PrezziPage.tsx');
check(
  'FAQ Prezzi: stesso elenco di /faq, copy dal registro (nessun doppione nel JSX)',
  true,
  /from '@\/data\/faqPubbliche'/.test(prezzi) && /FAQ_PUBBLICHE\.map/.test(prezzi) && /testo\(f\.q\)/.test(prezzi),
);
check(
  'FAQ: nessuna domanda difensiva (cancellazione / sicurezza pagamenti)',
  [],
  [/cancellarmi/i, /pagamento è sicuro/i, /Nel prototipo il pagamento/i].filter((r) => r.test(faqTesti)),
);
check(
  'FAQ: nessun rimando a funzioni non attive (CV, Archivista AI, Tabelle A/B)',
  [],
  [/strumento CV/i, /Archivista/i, /Tabelle A\/B/i, /in arrivo|sta arrivando/i].filter((r) => r.test(faqTesti)),
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
/**
 * La registrazione parziale è UN solo form condiviso (`FormRegistrazioneRapida`),
 * montato da DUE superfici: la sezione sotto l'hero e la chiusura della sezione
 * PRO. Due punti di ingresso visivi, un unico percorso di prefill: il gate
 * verifica il form condiviso e delega, non la copia.
 */
const formRapido = leggi('src/components/landing/FormRegistrazioneRapida.tsx');
const sezioneRapida = leggi('src/components/landing/LandingRegistrazioneRapida.tsx');
const offertaPro = leggi('src/components/landing/LandingOffertaPro.tsx');
const landingPage = leggi('src/pages/LandingPage.tsx');
check(
  'form con Nome, Cognome ed Email e CTA «ATTIVA IL TUO RADAR»',
  true,
  /placeholder="Nome"/.test(formRapido) &&
    /placeholder="Cognome"/.test(formRapido) &&
    /placeholder="La tua email"/.test(formRapido) &&
    /ATTIVA IL TUO RADAR/.test(formRapido),
);
check(
  'form rapido: tre campi nativi OBBLIGATORI (nessun `noValidate`)',
  [3, true],
  [(formRapido.match(/^\s*required\s*$/gm) ?? []).length, !/noValidate/.test(formRapido)],
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
  'nessuna superficie del form rapido apre modali proprie (prefill, non doppioni)',
  true,
  !/openAuthModal|Modal/.test(formRapido) && !/openAuthModal|Modal/.test(sezioneRapida),
);
check(
  'un solo form condiviso, attaccato alla copy PRO con la CTA esatta «ATTIVA IL TUO RADAR»',
  true,
  sezioneRapida.includes('<FormRegistrazioneRapida') &&
    /passerai automaticamente a un account Base[\s\S]{0,900}<FormRegistrazioneRapida[\s\S]{0,200}etichetta="ATTIVA IL TUO RADAR"/.test(offertaPro),
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

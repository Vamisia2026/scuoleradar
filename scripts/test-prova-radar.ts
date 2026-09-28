/**
 * Verifica la PROVA DEL RADAR (simulatore pubblico dell'hero).
 *
 * Tre garanzie di prodotto:
 *   1. MOTORE (`lib/provaRadarEngine.ts`): si prova con la SOLA provincia — niente
 *      classe di concorso — e si mostrano TUTTE le opportunità ATTIVE della
 *      provincia (supplenze, PON/POR, CPIA, ATA…); le scadute escono, le righe
 *      senza scadenza restano. Se la provincia non basta a riempire l'elenco si
 *      completa con il pool nazionale, senza duplicati e dichiarando quante righe
 *      sono davvero locali (`daProvincia`).
 *   2. MESSAGGIO (`messaggioConversione`): sotto i risultati c'è SEMPRE la stessa
 *      promessa PRO — «Abbiamo trovato [X] opportunità attive oggi su [Città]…» —
 *      con il conteggio esatto e nessuna via d'uscita verso altri piani.
 *   3. MEMORIA (`lib/provaRadar.ts`): la provincia provata diventa la provincia
 *      PRINCIPALE del wizard (nessuna richiesta duplicata), con validazione sul
 *      catalogo delle province.
 *
 * Uso: npm run test:prova-radar (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  CODA_CONVERSIONE_PROVA,
  LIMITE_RISULTATI_PROVA,
  messaggioConversione,
  messaggioRadarInScansione,
  righeAttive,
  selezionaRisultatiProva,
  type RigaProvaRadar,
} from '../src/lib/provaRadarEngine.ts';
import {
  leggiProvinciaProva,
  normalizzaProvinciaProva,
  provinceInizialiConProva,
  salvaProvinciaProva,
  svuotaProvinciaProva,
} from '../src/lib/provaRadar.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

/** Riga di prova minimale (id esplicito). */
function riga(patch: Partial<RigaProvaRadar> & { id: string }): RigaProvaRadar {
  return {
    title: 'Interpello supplenza',
    school_name: 'Liceo di prova',
    province: 'AT',
    expiration_date: '2099-01-01',
    source_url: 'https://www.scuoleradar.it',
    ...patch,
  };
}

const oggi = new Date('2026-09-27T00:00:00');

console.log('— Motore: la provincia intera, senza filtro di classe —');
const unaClasse = riga({ id: 'con-classe', class_codes: ['A-022'] });
const sostegno = riga({
  id: 'sostegno',
  class_codes: ['ADEE'],
  title: 'Supplenza sostegno ADEE',
  materia: 'Sostegno',
});
const esitoProvincia = selezionaRisultatiProva([unaClasse, sostegno], [], 5);
check('tutte le opportunità della provincia entrano (nessuna classe scelta)', 'provincia', esitoProvincia.gruppo);
check('elenco completo, nessun filtro silenzioso', ['con-classe', 'sostegno'], esitoProvincia.righe.map((r) => r.id));
check('tutte le righe mostrate sono della provincia', 2, esitoProvincia.daProvincia);

console.log('\n— Completamento nazionale: elenco sempre ricco, mai un duplicato —');
const nazionali = Array.from({ length: 6 }, (_, i) => riga({ id: `n${i}`, province: 'RM' }));
const completato = selezionaRisultatiProva([unaClasse], nazionali, LIMITE_RISULTATI_PROVA);
check('provincia sottile → elenco pieno', LIMITE_RISULTATI_PROVA, completato.righe.length);
check('la riga della provincia resta in testa', 'con-classe', completato.righe[0].id);
check('dichiarate locali SOLO le righe della provincia', 1, completato.daProvincia);
check(
  'una riga già mostrata non viene duplicata dal pool nazionale',
  ['con-classe', 'n1'],
  selezionaRisultatiProva([unaClasse], [unaClasse, riga({ id: 'n1', province: 'RM' })], 5).righe.map((r) => r.id),
);
check('pool nazionale senza righe locali → gruppo «nazionale»', 'nazionale', selezionaRisultatiProva([], nazionali, 5).gruppo);
const vuoto = selezionaRisultatiProva([], [], 5);
check('provincia e nazionale vuoti → gruppo «vuoto» e nessuna riga', true, vuoto.gruppo === 'vuoto' && vuoto.righe.length === 0);
const molte = Array.from({ length: 12 }, (_, i) => riga({ id: `r${i}` }));
check('il limite tiene il responso dentro uno schermo', LIMITE_RISULTATI_PROVA, selezionaRisultatiProva(molte, [], LIMITE_RISULTATI_PROVA).righe.length);

console.log('\n— Attivi: date estese, scaduti esclusi —');
check(
  'scaduto escluso, senza scadenza incluso',
  ['attivo', 'senza-data'],
  righeAttive(
    [
      riga({ id: 'attivo', expiration_date: '2026-10-10' }),
      riga({ id: 'scaduto', expiration_date: '2026-09-01' }),
      riga({ id: 'senza-data', expiration_date: null }),
    ],
    oggi,
  ).map((r) => r.id),
);

console.log('\n— Messaggio sotto i risultati: conteggio esatto, nessuna via d’uscita —');
check(
  'provincia completa: «Abbiamo trovato [X] opportunità attive oggi su [Città]» + promessa PRO',
  "Abbiamo trovato 5 opportunità attive oggi su Asti. Attiva ora il tuo radar personalizzato. Ti offriamo un mese PRO con notifiche Telegram in tempo reale e un'email di riepilogo ogni giorno alle 17.00",
  messaggioConversione(selezionaRisultatiProva(nazionali.slice(0, 5), [], 5), 'Asti'),
);
check(
  'elenco misto: dichiara quante sono davvero della provincia',
  `Abbiamo trovato 5 opportunità attive oggi, di cui 1 su Asti. ${CODA_CONVERSIONE_PROVA}`,
  messaggioConversione(completato, 'Asti'),
);
check(
  'provincia ferma: il conteggio diventa nazionale e resta onesto',
  `Abbiamo trovato 5 opportunità attive oggi in Italia. ${CODA_CONVERSIONE_PROVA}`,
  messaggioConversione(selezionaRisultatiProva([], nazionali, 5), 'Asti'),
);
check(
  'una sola opportunità: italiano corretto',
  `Abbiamo trovato 1 opportunità attiva oggi su Asti. ${CODA_CONVERSIONE_PROVA}`,
  messaggioConversione(selezionaRisultatiProva([unaClasse], [], 5), 'Asti'),
);
check(
  'nessun avviso vivo: si promette il Radar, mai «zero risultati»',
  `Appena esce un avviso su Asti te lo diciamo noi. ${CODA_CONVERSIONE_PROVA}`,
  messaggioRadarInScansione('Asti'),
);
check(
  'la promessa PRO è identica in ogni responso',
  true,
  CODA_CONVERSIONE_PROVA.startsWith('Attiva ora il tuo radar personalizzato.') &&
    /17\.00$/.test(CODA_CONVERSIONE_PROVA),
);

console.log('\n— Memoria della provincia: eredità nel wizard —');
check('codice valido normalizzato', 'AT', normalizzaProvinciaProva(' at '));
check('codice inesistente scartato', null, normalizzaProvinciaProva('ZZ'));
check('le preferenze salvate hanno la precedenza', ['TO', 'MI'], provinceInizialiConProva(['TO', 'MI']));

// Storage in memoria: `localStorage` non esiste in Node, quindi si inietta uno stub
// (l'astrazione lo legge a ogni chiamata: nessun mock del modulo).
const memoria = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
  key: (i: number) => [...memoria.keys()][i] ?? null,
  get length() {
    return memoria.size;
  },
} as unknown as Storage;

svuotaProvinciaProva();
check('senza preferenze e senza prova: nessuna provincia', [], provinceInizialiConProva([]));
salvaProvinciaProva('at');
check('provincia della prova salvata (normalizzata)', 'AT', leggiProvinciaProva());
check('provincia della prova ereditata come principale', ['AT'], provinceInizialiConProva([]));
salvaProvinciaProva('ZZ');
check('codice inesistente non sovrascrive la memoria', 'AT', leggiProvinciaProva());
svuotaProvinciaProva();
check('memoria azzerata', null, leggiProvinciaProva());

console.log('\n— Cablaggio: hero, motore condiviso, wizard —');
const simulatore = leggi('src/departments/radar/SimulatorRadar.tsx');
const wizard = leggi('src/departments/radar/RadarWizardModal.tsx');
const onboarding = leggi('src/pages/onboarding/OnboardingPage.tsx');
check(
  'simulatore: motore condiviso + completamento (provincia → nazionale)',
  true,
  simulatore.includes('provaRadarEngine') &&
    simulatore.includes('selezionaRisultatiProva') &&
    /LIMITE_PROVINCIA/.test(simulatore) &&
    /LIMITE_NAZIONALE/.test(simulatore),
);
check(
  'simulatore: NESSUN selettore di classe di concorso (si prova solo la provincia)',
  true,
  !/Classe di concorso/.test(simulatore) &&
    !/classiConcorso/.test(simulatore) &&
    /disabled=\{!provCodice\}/.test(simulatore),
);
check(
  'simulatore: categorie dichiarate (PON/POR, CPIA, ATA e bidelli)',
  true,
  /PON\/POR/.test(simulatore) && /CPIA/.test(simulatore) && /ATA e bidelli/.test(simulatore),
);
check('simulatore: la provincia provata viene memorizzata', true, /salvaProvinciaProva\(provincia\)/.test(simulatore));
check('wizard: eredita la provincia della prova', true, /provinceInizialiConProva\(preferenze\.provinceCodici\)/.test(wizard));
check('onboarding: stessa eredità (nessuna richiesta duplicata)', true, /provinceInizialiConProva/.test(onboarding));
check(
  'wizard: anagrafica ed email aperte già compilate dal form rapido della homepage',
  true,
  /leggiBozzaRegistrazione\(\)/.test(wizard) && /preferenze\.emailNotifica \|\| bozza\?\.email/.test(wizard),
);
check(
  'wizard: schermata di benvenuto con il testo ESATTO del regalo PRO',
  true,
  wizard.includes(
    'Buone notizie! Ti offriamo noi il primo mese PRO con Scuole Radar! Il tuo Radar Personalizzato è attivo, sfruttalo!',
  ),
);

// Il simulatore serve a VENDERE: il responso deve stare nel primo schermo
// (box largo 34rem, righe compatte) e non può dichiarare «zero risultati» solo
// perché il pool è pieno di avvisi già scaduti.
const landingHero = leggi('src/components/landing/LandingHero.tsx');
const responsoProva = leggi('src/departments/radar/components/ResponsoProva.tsx');
const queryProva = leggi('src/departments/radar/services/provaRadarQuery.ts');
check(
  'hero: box di prova largo 34rem, nessuna frase difensiva né filtro di prova',
  true,
  /lg:grid-cols-\[minmax\(0,1fr\)_34rem\]/.test(landingHero) &&
    landingHero.includes('<SimulatorRadar') &&
    !/Nessuna registrazione/.test(landingHero) &&
    !/<select/.test(landingHero) &&
    !/font-black uppercase tracking-\[0\.2em\]/.test(landingHero),
);
check(
  'responso compatto: voci serrate, un solo schermo',
  true,
  responsoProva.includes('mt-2.5 space-y-1') && responsoProva.includes('p-3.5'),
);
check(
  'responso: messaggio di conversione dal motore + CTA unica «Attiva il tuo Radar»',
  true,
  responsoProva.includes('messaggioConversione(esito, provincia)') &&
    responsoProva.includes('messaggioRadarInScansione') &&
    responsoProva.includes('Attiva il tuo Radar') &&
    !/Attiva le notifiche|zero risultati/i.test(responsoProva),
);
check(
  'pool del simulatore: solo avvisi VIVI (gli scaduti non consumano il limite)',
  true,
  /\.or\(`expiration_date\.gte\.\$\{sogliaAttiviIso\(\)\},expiration_date\.is\.null`\)/.test(queryProva) &&
    /export const LIMITE_PROVINCIA = 200/.test(queryProva) &&
    /order\('expiration_date', \{ ascending: true \}\)/.test(queryProva),
);

console.log(errori === 0 ? '\n✅ PROVA DEL RADAR: nessun problema' : `\n❌ PROVA DEL RADAR: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

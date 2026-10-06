/**
 * Verifica la PROVA DEL RADAR (simulatore pubblico dell'hero).
 *
 * Quattro garanzie di prodotto:
 *   1. MOTORE (`lib/provaRadarEngine.ts`): si prova con la SOLA provincia — niente
 *      classe di concorso e NESSUN ripiego nazionale — e si mostrano TUTTE le
 *      opportunità ATTIVE di quella provincia (supplenze, PON/POR, CPIA, ATA…);
 *      le scadute escono, le righe senza scadenza restano. Provincia ferma →
 *      responso vuoto (`gruppo: 'vuoto'`), mai avvisi di altre province spacciati
 *      per locali.
 *   2. NESSUN RIPIEGO NAZIONALE (cablaggio): la query del simulatore non ha più
 *      un giro nazionale (`LIMITE_NAZIONALE` rimosso) e `leggiInterpelliProva`
 *      accetta SOLO una provincia (`province = <codice>`): la provincia provata è
 *      un ingresso obbligatorio, non un filtro opzionale.
 *   3. MESSAGGIO (`messaggioConversione`): sotto i risultati c'è SEMPRE la stessa
 *      promessa PRO — «Abbiamo trovato [X] opportunità attive oggi su [Città]…» —
 *      con il conteggio esatto e nessuna via d'uscita verso altri piani.
 *   4. MEMORIA (`lib/provaRadar.ts`): la provincia provata diventa la provincia
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
} from '../src/lib/provaRadarEngine.ts';
import {
  leggiProvinciaProva,
  normalizzaProvinciaProva,
  provinceInizialiConProva,
  salvaProvinciaProva,
  svuotaProvinciaProva,
} from '../src/lib/provaRadar.ts';
// Riga di prova e stub di `localStorage`: fixture condivise delle guardie della prova.
import {
  OGGI as oggi,
  installaStorageInMemoria,
  rigaProva as riga,
} from './lib/fixtures-prova-radar.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

console.log('— Motore: la provincia intera, senza filtro di classe —');
const unaClasse = riga({ id: 'con-classe', class_codes: ['A-022'] });
const sostegno = riga({
  id: 'sostegno',
  class_codes: ['ADEE'],
  title: 'Supplenza sostegno ADEE',
  materia: 'Sostegno',
});
const esitoProvincia = selezionaRisultatiProva([unaClasse, sostegno], 5);
check('tutte le opportunità della provincia entrano (nessuna classe scelta)', 'provincia', esitoProvincia.gruppo);
check('elenco completo, nessun filtro silenzioso', ['con-classe', 'sostegno'], esitoProvincia.righe.map((r) => r.id));
check(
  'responso senza provenienza nazionale: campi SOLO {gruppo, righe}',
  ['gruppo', 'righe'],
  Object.keys(esitoProvincia).sort(),
);

console.log('\n— Nessun ripiego nazionale: si prova SOLO la provincia —');
check(
  'la firma del motore ha UN SOLO ingresso: non si può passare un pool nazionale',
  1,
  selezionaRisultatiProva.length,
);
check(
  'provincia sottile → responso corto e onesto (niente completamento)',
  1,
  selezionaRisultatiProva([unaClasse], LIMITE_RISULTATI_PROVA).righe.length,
);
check(
  'nessun avviso estraneo alla provincia entra nel responso',
  ['con-classe'],
  selezionaRisultatiProva([unaClasse], 5).righe.map((r) => r.id),
);
const vuoto = selezionaRisultatiProva([], 5);
check(
  'provincia senza avvisi vivi → gruppo «vuoto» e nessuna riga',
  true,
  vuoto.gruppo === 'vuoto' && vuoto.righe.length === 0,
);
const molte = Array.from({ length: 12 }, (_, i) => riga({ id: `r${i}` }));
check('il limite tiene il responso dentro uno schermo', LIMITE_RISULTATI_PROVA, selezionaRisultatiProva(molte, LIMITE_RISULTATI_PROVA).righe.length);

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

console.log('\n— Messaggio sotto i risultati: conteggio esatto DELLA PROVINCIA, nessuna via d’uscita —');
check(
  'provincia con risultati: «Abbiamo trovato [X] opportunità attive oggi su [Città]» + promessa PRO',
  "Abbiamo trovato 5 opportunità attive oggi su Asti. Attiva ora il tuo radar personalizzato. Ti offriamo un mese PRO con notifiche Telegram in tempo reale e un'email di riepilogo ogni giorno alle 17.00",
  messaggioConversione(selezionaRisultatiProva(molte.slice(0, 5), 5), 'Asti'),
);
check(
  'una sola opportunità: italiano corretto',
  `Abbiamo trovato 1 opportunità attiva oggi su Asti. ${CODA_CONVERSIONE_PROVA}`,
  messaggioConversione(selezionaRisultatiProva([unaClasse], 5), 'Asti'),
);
check(
  'provincia ferma: nessun conteggio nazionale («in Italia» mai più)',
  `Appena esce un avviso su Asti te lo diciamo noi. ${CODA_CONVERSIONE_PROVA}`,
  messaggioConversione(selezionaRisultatiProva([], 5), 'Asti'),
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

// Storage in memoria: lo stub condiviso sta in `scripts/lib/fixtures-prova-radar.ts`.
installaStorageInMemoria();

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
  'simulatore: motore condiviso e UNA sola lettura (la provincia provata)',
  true,
  simulatore.includes('provaRadarEngine') &&
    simulatore.includes('selezionaRisultatiProva') &&
    /LIMITE_PROVINCIA/.test(simulatore) &&
    !/LIMITE_NAZIONALE/.test(simulatore) &&
    !/leggiInterpelliProva\(null/.test(simulatore),
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

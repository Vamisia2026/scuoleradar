/**
 * Verifica «Documenti» del profilo e BENVENUTO PRO.
 *
 *  1. helper PURI dello storage personale (`lib/mieiDocumenti.ts`): validazione di
 *     tipo/dimensione/numero di file, spazio totale, formattazione, aggiunta e
 *     rimozione — con esiti ESPLICITI (mai un salvataggio silenziosamente perso);
 *  2. cablaggio UI: menu utente → «Documenti» con due tab («Moduli scaricati» ·
 *     «I Miei Documenti» con disclaimer), sezione montata nel profilo;
 *  3. Benvenuto PRO: componente nel dipartimento Radar, esportato e montato nella
 *     dashboard, con congratulazioni per il mese in omaggio e invito al Radar.
 *
 * Uso: npm run test:documenti
 */
import { readFileSync } from 'node:fs';
import {
  LIMITE_BYTE_DOCUMENTO,
  LIMITE_BYTE_TOTALE,
  LIMITE_DOCUMENTI,
  aggiungiMioDocumento,
  byteTotali,
  formattaDimensione,
  leggiMieiDocumenti,
  rimuoviMioDocumento,
  salvaMieiDocumenti,
  validaNuovoDocumento,
  type MioDocumento,
} from '../src/lib/mieiDocumenti.ts';

/* ----------------------------- Stub localStorage ----------------------------- */
const fintoStorage = {
  dati: new Map<string, string>(),
  /** Impostato a true per simulare la quota del browser esaurita. */
  quotaPiena: false,
  getItem(chiave: string): string | null {
    return this.dati.has(chiave) ? (this.dati.get(chiave) as string) : null;
  },
  setItem(chiave: string, valore: string): void {
    if (this.quotaPiena) throw new Error('QuotaExceededError');
    this.dati.set(chiave, valore);
  },
  removeItem(chiave: string): void {
    this.dati.delete(chiave);
  },
};
Object.defineProperty(globalThis, 'localStorage', { value: fintoStorage, configurable: true });

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

/** Documento fittizio (solo metadati: il contenuto non serve ai controlli). */
const doc = (id: string, dimensione = 1000): MioDocumento => ({
  id,
  nome: `${id}.pdf`,
  tipo: 'application/pdf',
  dimensione,
  caricatoIl: '2026-09-24T10:00:00.000Z',
  dataUrl: 'data:application/pdf;base64,AAAA',
});

const leggi = (percorso: string): string => readFileSync(percorso, 'utf8');

console.log('— Validazione dei file in ingresso (esiti espliciti) —');
check('PDF ammesso', { ok: true }, validaNuovoDocumento([], { name: 'a.pdf', type: 'application/pdf', size: 1000 }));
check(
  'eseguibile rifiutato',
  'Formato non ammesso: carica PDF, immagini (JPG/PNG), Word o testo.',
  (validaNuovoDocumento([], { name: 'virus.exe', type: 'application/x-msdownload', size: 1000 }) as { errore: string }).errore,
);
check(
  'file oltre 1 MB rifiutato',
  true,
  !validaNuovoDocumento([], { name: 'grosso.pdf', type: 'application/pdf', size: LIMITE_BYTE_DOCUMENTO + 1 }).ok,
);
check(
  'limite di numero documenti rispettato',
  true,
  !validaNuovoDocumento(
    Array.from({ length: LIMITE_DOCUMENTI }, (_, i) => doc(`d${i}`)),
    { name: 'nuovo.pdf', type: 'application/pdf', size: 1000 },
  ).ok,
);
check(
  'spazio complessivo non superabile',
  true,
  !validaNuovoDocumento([doc('pesante', LIMITE_BYTE_TOTALE)], {
    name: 'nuovo.pdf',
    type: 'application/pdf',
    size: 5000,
  }).ok,
);

console.log('\n— Metadati, spazio e formattazione —');
check('somma dei byte', 3000, byteTotali([doc('a', 1000), doc('b', 2000)]));
check('somma con lista vuota', 0, byteTotali([]));
check('formatta KB', '820 KB', formattaDimensione(820_000));
check('formatta MB', '1.5 MB', formattaDimensione(1_500_000));
check('formatta zero', '0 KB', formattaDimensione(0));

console.log('\n— Aggiunta / rimozione —');
check('aggiunta in cima (più recenti per primi)', ['nuovo', 'a'], aggiungiMioDocumento([doc('a')], doc('nuovo')).map((d) => d.id));
check('rimozione per id', ['a'], rimuoviMioDocumento([doc('a'), doc('b')], 'b').map((d) => d.id));

console.log('\n— Persistenza locale (archivio del browser) —');
check('salvataggio riuscito', { ok: true }, salvaMieiDocumenti([doc('a')]));
check('rilettura dell’archivio', ['a'], leggiMieiDocumenti().map((d) => d.id));
fintoStorage.quotaPiena = true;
check('quota piena: esito esplicito, non silenzioso', false, salvaMieiDocumenti([doc('b')]).ok);
fintoStorage.quotaPiena = false;
check('quota piena: archivio precedente intatto', ['a'], leggiMieiDocumenti().map((d) => d.id));
fintoStorage.dati.clear();
check('archivio assente: lista vuota', [], leggiMieiDocumenti());
fintoStorage.dati.set('scuoleradar:miei_documenti', '{non-json');
check('archivio corrotto: lista vuota (nessun crash)', [], leggiMieiDocumenti());
fintoStorage.dati.clear();

console.log('\n— Cablaggio UI: menu utente, «I Miei Documenti» e terza tab Modulistica —');
const menuUtente = leggi('src/components/header/MenuUtente.tsx');
check('menu utente: voce «I Miei Documenti»', true, menuUtente.includes('I Miei Documenti'));
check('menu utente: nessuna voce «Documenti scaricati»', false, menuUtente.includes('Documenti scaricati'));
check(
  'menu utente: apre la terza tab della Modulistica',
  true,
  menuUtente.includes('/dashboard/moduli?tab=documenti'),
);
check(
  'menu utente: fallback sul profilo se la Modulistica è spenta',
  true,
  menuUtente.includes('/dashboard/profilo?sezione=documenti') &&
    menuUtente.includes('visibile(\'modulistica\')'),
);
const documentiProfilo = leggi('src/components/profile/DocumentiProfilo.tsx');
check('profilo: tab «Moduli scaricati»', true, documentiProfilo.includes('Moduli scaricati'));
check('profilo: tab «I Miei Documenti»', true, documentiProfilo.includes('I Miei Documenti'));
check('profilo: due tab con ruolo ARIA', true, /role="tablist"/.test(documentiProfilo));
check(
  'profilo: monta lo storage condiviso di piattaforma',
  true,
  documentiProfilo.includes("@/components/documenti/MieiDocumenti"),
);

// Storage personale: componente di PIATTAFORMA (una sola implementazione per profilo e Modulistica).
const mieiDocumenti = leggi('src/components/documenti/MieiDocumenti.tsx');
const areaCaricamento = leggi('src/components/documenti/AreaCaricamentoDocumenti.tsx');
check('storage personale: disclaimer di responsabilità', true, mieiDocumenti.includes('tua totale responsabilità'));
check('storage personale: uso esclusivo dell’utente', true, mieiDocumenti.includes('uso esclusivo dell'));
check('storage personale: i file restano nel browser (trasparenza)', true, mieiDocumenti.includes('salvati nel tuo browser'));
check(
  'storage personale: TRASCINAMENTO dei file (drag & drop)',
  true,
  /onDrop=[\s\S]{0,200}dataTransfer/.test(areaCaricamento),
);
check(
  'storage personale: selezione dal computer + più file',
  true,
  /type="file"[\s\S]{0,80}multiple/.test(areaCaricamento),
);
check('storage personale: formati richiesti (PDF/JPG/PNG/Word)', true, areaCaricamento.includes('.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png'));
check(
  'storage personale: nessun upload su server (solo storage locale)',
  true,
  mieiDocumenti.includes('mieiDocumenti') && !/supabase|fetch\(/.test(mieiDocumenti + areaCaricamento),
);
check(
  'storage personale: area di rilascio estratta (SRP)',
  true,
  mieiDocumenti.includes('AreaCaricamentoDocumenti'),
);

// Modulistica: TERZA tab «I Miei Documenti».
const tipiModulistica = leggi('src/modules/modulistica/types.ts');
check('modulistica: vista «documenti» nel tipo', true, /\| 'documenti'/.test(tipiModulistica));
check(
  'modulistica: terza voce di navigazione',
  true,
  /onNaviga\('documenti'\)[\s\S]{0,400}I Miei Documenti/.test(
    leggi('src/modules/modulistica/components/ModuliNavigation.tsx'),
  ),
);
check(
  'modulistica: la tab rende lo storage personale',
  true,
  leggi('src/modules/modulistica/ModuliModule.tsx').includes("vista === 'documenti' && <TabDocumentiPersonali") &&
    leggi('src/modules/modulistica/components/TabDocumentiPersonali.tsx').includes('<MieiDocumenti />'),
);
check(
  'modulistica: deep link ?tab=documenti',
  true,
  /tab === 'miei' \|\| tab === 'documenti'/.test(leggi('src/modules/modulistica/hooks/useModulistica.ts')),
);
check(
  'modulistica: lo spazio personale NON è paywall PRO',
  true,
  /if \(v === 'miei' && !abbonato\)/.test(leggi('src/modules/modulistica/hooks/useModulistica.ts')),
);
check('archivio moduli: rimando alla Modulistica filtrato dalle flag', true, leggi('src/components/profile/ModuliScaricati.tsx').includes("visibile('modulistica')"));
check('profilo: monta la sezione Documenti', true, leggi('src/pages/ProfiloPage.tsx').includes('<DocumentiProfilo />'));

console.log('\n— Benvenuto PRO (primo accesso) —');
const benvenuto = leggi('src/departments/radar/components/BenvenutoProRadar.tsx');
check('benvenuto: mese PRO gratuito annunciato', true, /(1 mese di PRO in omaggio|completamente gratis)/.test(benvenuto));
check('benvenuto: invito ad attivare il Radar', true, /'Attiva il Radar'|Apri il tuo Radar/.test(benvenuto));
check('benvenuto: si mostra UNA sola volta (chiave per utente)', true, benvenuto.includes('sr_benvenuto_pro_'));
check('benvenuto: solo con piano confermato dal DB', true, benvenuto.includes("pianoStato === 'pronto'"));
check('benvenuto: solo con entitlement PRO', true, benvenuto.includes('hasProAccess'));
check('dipartimento radar: superficie pubblica', true, leggi('src/departments/radar/index.ts').includes('BenvenutoProRadar'));
check('dashboard: benvenuto montato', true, leggi('src/pages/DashboardPage.tsx').includes('<BenvenutoProRadar />'));

console.log('\n— Copy del mese PRO omaggio (AuthModal) —');
const authModal = leggi('src/components/AuthModal.tsx');
check('copy «Fanne buon uso» RIMOSSA', false, authModal.includes('Fanne buon uso'));
check(
  'copy ETICO: valore del tempo, nessuna competizione né fretta',
  true,
  authModal.includes('Un mese PRO, completamente gratis') &&
    !/prima di tutti|prima degli altri/.test(authModal),
);
check(
  'benvenuto PRO: copy coerente con l’omaggio e l’invito al Radar',
  true,
  benvenuto.includes('completamente gratis') || benvenuto.includes('mese di PRO in omaggio'),
);

console.log(errori === 0 ? '\n✅ DOCUMENTI & BENVENUTO PRO: nessun problema' : `\n❌ DOCUMENTI & BENVENUTO PRO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

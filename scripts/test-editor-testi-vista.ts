/**
 * Test — «EDITOR TESTI RAPIDO» CONTESTUALE: quali testi vede il pannello.
 *
 * Seconda metà della guardia `test-editor-testi` (che copre registro, store e copy):
 * qui si verifica il REGISTRO DELLE VISTE (`src/lib/testiInPagina.ts`) e il
 * cablaggio contestuale — cioè che l'editor mostri SOLO i testi della pagina che
 * l'utente ha davanti.
 *
 * Verifica:
 *  1. COMPORTAMENTO: una vista registrata espone solo le sue chiavi, due viste
 *     fanno l'unione, lo smontaggio (cambio rotta) le toglie, l'ordine è quello di
 *     registro, lo snapshot ha riferimento stabile e gli ascoltatori sono
 *     notificati solo al cambiamento reale (niente render inutili mentre si digita);
 *  2. CABLAGGIO: l'hook delle pagine registra le chiavi che legge, l'hook
 *     dell'editor NON si registra (non si auto-alimenta), il pannello non ha
 *     fisarmoniche né elenchi di altre pagine e il registro non espone più nessun
 *     raggruppamento cablato (`gruppiTesti()`, rimosso il 29/09/2026).
 *
 * Uso: npm run test:editor-testi (secondo script della catena; incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { CHIAVI_TESTO, type ChiaveTesto } from '../src/data/editableTexts.ts';
import {
  azzeraTestiInPagina,
  registraTestiInPagina,
  sincronizzaTestiInPagina,
  sottoscriviTestiInPagina,
  testiInPagina,
} from '../src/lib/testiInPagina.ts';

const leggi = (p: string): string => readFileSync(p, 'utf8');
let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Registro delle viste: quali testi sono «a schermo» —');
azzeraTestiInPagina();
check('nessuna vista montata → nessun testo a schermo', [], testiInPagina());

let notifiche = 0;
const annullaAscoltatore = sottoscriviTestiInPagina(() => {
  notifiche += 1;
});

// Una pagina con due testi, dichiarati in ordine INVERSO a quello di registro.
const vistaFaq = new Set<ChiaveTesto>(['faq.piano-conveniente.risposta', 'faq.carta-docente.domanda']);
const smontaFaq = registraTestiInPagina(vistaFaq);
check(
  'una vista → SOLO le sue chiavi, in ordine di registro',
  ['faq.carta-docente.domanda', 'faq.piano-conveniente.risposta'],
  testiInPagina(),
);
check('snapshot a riferimento STABILE finché non cambia', true, testiInPagina() === testiInPagina());
check('ascoltatore notificato al montaggio della vista', 1, notifiche);

// Chiave letta solo a dati caricati (render successivo): il riallineamento la prende.
vistaFaq.add('faq.invita-un-collega.domanda');
sincronizzaTestiInPagina();
check(
  'chiave letta dopo il montaggio: entra al riallineamento',
  ['faq.invita-un-collega.domanda', 'faq.carta-docente.domanda', 'faq.piano-conveniente.risposta'],
  testiInPagina(),
);
sincronizzaTestiInPagina();
check('riallineamento con le stesse chiavi: nessuna notifica in più', 2, notifiche);

// Seconda vista montata insieme (modale/sezione della stessa pagina): si somma.
const vistaPro = new Set<ChiaveTesto>(['prezzi.offerta.email.testo']);
const smontaPro = registraTestiInPagina(vistaPro);
check(
  'due viste → unione, sempre in ordine di registro',
  [
    'faq.invita-un-collega.domanda',
    'faq.carta-docente.domanda',
    'faq.piano-conveniente.risposta',
    'prezzi.offerta.email.testo',
  ],
  testiInPagina(),
);

smontaPro();
check('vista smontata (cambio pagina): le sue chiavi escono', 3, testiInPagina().length);
check('le chiavi della vista rimasta restano a schermo', true, testiInPagina().includes('faq.carta-docente.domanda'));

// StrictMode monta due volte lo STESSO insieme: nessun duplicato e nessun avviso.
const smontaDiNuovo = registraTestiInPagina(vistaFaq);
check('StrictMode: ri-registrare la stessa vista non duplica ne notifica', [3, 4], [
  testiInPagina().length,
  notifiche,
]);
smontaDiNuovo();
smontaFaq();
check('tutte le viste smontate → registro vuoto', [], testiInPagina());
check('ascoltatore notificato a ogni cambiamento reale', 5, notifiche);
annullaAscoltatore();

console.log('\n— 2. Cablaggio contestuale: pannello, hook e registro —');
const hook = leggi('src/hooks/useTestiEditabili.ts');
const pannello = leggi('src/components/EditorTestiRapido.tsx');
const registro = leggi('src/data/editableTexts.ts');
const devToolbar = leggi('src/components/DevToolbar.tsx');
check('registro: 22 chiavi, ordine di registro (= ordine dell’editor)', 22, CHIAVI_TESTO.length);
check(
  'registro: nessun raggruppamento cablato per pagina',
  [false, false],
  [/gruppiTesti|ETICHETTE_GRUPPI|GruppoTesti/.test(registro), /FAQ pubbliche · \/faq|Offerta PRO · homepage/.test(registro)],
);
const editorHook = hook.slice(hook.indexOf('export function useTestiInPagina'));
check(
  'hook: le pagine registrano le chiavi lette e si riallineano a ogni render',
  true,
  /lette\.current\.add\(chiave\)/.test(hook) &&
    /return registraTestiInPagina/.test(hook) &&
    /sincronizzaTestiInPagina\(\)/.test(hook),
);
check(
  'hook: l’editor legge la vista attiva e NON si registra come vista',
  [true, false],
  [/useSyncExternalStore\(sottoscriviTestiInPagina/.test(hook), /registraTestiInPagina/.test(editorHook)],
);
check(
  'pannello: elenca i testi SCANSITI dal DOM, senza fisarmoniche né elenchi cablati',
  [true, true, false],
  [
    pannello.includes('useTestiDomInPagina') && pannello.includes('testi.map') && pannello.includes('<textarea'),
    // Il Reset deve riportare ai default anche gli override del registro (testi non più a schermo).
    pannello.includes('useTestiInPagina') && /azzeraRegistro/.test(pannello),
    /gruppiTesti|<details|\bsummary\b/.test(pannello),
  ],
);
check(
  'pannello: dichiara rotta attiva, stato vuoto e salvataggio in localStorage',
  [true, true, true],
  [
    /useLocation/.test(pannello) && /pathname/.test(pannello),
    /Nessun testo rilevato/.test(pannello),
    /STORAGE_KEY_TESTI_DOM/.test(pannello),
  ],
);
check(
  'DEV Toolbar: monta il pannello contestuale e la scansione del DOM (sempre attiva in DEV)',
  [true, true],
  [/<EditorTestiRapido \/>/.test(devToolbar), /useScansioneTestiDom\(\)/.test(devToolbar)],
);

console.log(errori === 0 ? '\n✅ EDITOR TESTI (vista): nessun problema' : `\n❌ EDITOR TESTI (vista): ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

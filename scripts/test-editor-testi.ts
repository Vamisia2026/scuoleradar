/**
 * Test — «EDITOR TESTI RAPIDO» (DEV Toolbar) e REGISTRO dei testi modificabili.
 *
 * Verifica:
 *  1. REGISTRO (`src/data/editableTexts.ts`): chiavi uniche e ben formate, valori non
 *     vuoti, 8 FAQ pubbliche (domanda + risposta) e i 3 blocchi dell'offerta PRO;
 *  2. COPY trasferita nel registro: i testi dell'offerta restano senza prezzi e senza
 *     parole di televendita (la guardia `test:copy:etico` ora li legge nel registro);
 *  3. STORE (`src/lib/testiModificabili.ts`): scrittura/rilettura in
 *     `localStorage: sr_simple_text_overrides`, precedenza override → default, reset,
 *     notifica agli ascoltatori, tolleranza al JSON corrotto e chiavi fuori registro;
 *  4. CABLAGGIO: sezione UNIVERSALE nella DEV Toolbar (i testi che la pagina ha DAVVERO a
 *     schermo, scanditi dal DOM: `src/lib/testiDom.ts`), FAQ e vetrina PRO rese PER CHIAVE
 *     (nessuna copy duplicata nel JSX), override attivi solo in sviluppo, elenco condiviso con
 *     /prezzi (sblocco esplicito del 29/09/2026: della pagina Prezzi è cablata la sola sezione FAQ).
 *
 * Il REGISTRO DELLE VISTE ha la sua guardia (`scripts/test-editor-testi-vista.ts`) e la
 * SCANSIONE DEL DOM pure (`scripts/test-editor-testi-dom.ts` + `…-cablaggio.ts`): qui resta la
 * struttura del registro e dello store.
 *
 * Uso: npm run test:editor-testi (entrambi gli script; inclusi in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import {
  CHIAVI_TESTO,
  type ChiaveTesto,
  TESTI_EDITABILI,
  eChiaveTesto,
  testoDiDefault,
} from '../src/data/editableTexts.ts';
import {
  STORAGE_KEY_TESTI_RAPIDI,
  azzeraTesti,
  impostaTesto,
  overrideTesti,
  sottoscriviTesti,
  testoCorrente,
} from '../src/lib/testiModificabili.ts';

/**
 * Stub di `localStorage` installato PRIMA della prima lettura dello store (che poi
 * tiene il valore in cache): serve a provare che la digitazione nell'editor scrive
 * DAVVERO nella chiave `sr_simple_text_overrides`.
 */
const fintoStorage = {
  dati: new Map<string, string>(),
  getItem(chiave: string): string | null {
    return this.dati.get(chiave) ?? null;
  },
  setItem(chiave: string, valore: string): void {
    this.dati.set(chiave, valore);
  },
  removeItem(chiave: string): void {
    this.dati.delete(chiave);
  },
};
(globalThis as unknown as { localStorage: typeof fintoStorage }).localStorage = fintoStorage;
// Valore iniziale ILLEGGIBILE: lo store deve tollerarlo e ripartire dai default.
fintoStorage.setItem(STORAGE_KEY_TESTI_RAPIDI, '{non-json');

const leggi = (p: string): string => readFileSync(p, 'utf8');
let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— 1. Registro dei testi —');
const chiavi = CHIAVI_TESTO;
const faqDomande = chiavi.filter((c) => /^faq\..+\.domanda$/.test(c));
const faqRisposte = chiavi.filter((c) => /^faq\..+\.risposta$/.test(c));
const offertaTitoli = chiavi.filter((c) => /^prezzi\.offerta\..+\.titolo$/.test(c));
const offertaTesti = chiavi.filter((c) => /^prezzi\.offerta\..+\.testo$/.test(c));
check('22 chiavi nel registro (16 FAQ + 6 offerta)', 22, CHIAVI_TESTO.length);
check('chiavi univoche', CHIAVI_TESTO.length, new Set(CHIAVI_TESTO).size);
check('nessun valore vuoto', [], chiavi.filter((c) => TESTI_EDITABILI[c].trim() === ''));
check('8 FAQ pubbliche (domanda + risposta)', [8, 8], [faqDomande.length, faqRisposte.length]);
check('3 blocchi dell’offerta PRO (titolo + testo)', [3, 3], [offertaTitoli.length, offertaTesti.length]);
check(
  'ogni domanda ha la sua risposta',
  [],
  faqDomande.filter((c) => !faqRisposte.includes(c.replace(/\.domanda$/, '.risposta'))),
);
check('chiavi note riconosciute', [true, false], [
  eChiaveTesto('faq.piano-conveniente.domanda'),
  eChiaveTesto('faq.chiave-inventata.domanda'),
]);

console.log('\n— 2. Copy dell’offerta: nessuna cifra né parola di televendita —');
/**
 * Questi testi sono nati nel componente della vetrina e la guardia `test:copy:etico`
 * li sorvegliava lì: ora vivono nel registro, quindi la verifica si sposta qui.
 */
const testiOfferta = offertaTitoli.concat(offertaTesti).map((c) => testoDiDefault(c));
check('nessuna cifra nei testi dell’offerta', [], [/€/, /PREZZO_/].filter((r) => testiOfferta.some((t) => r.test(t))));
check(
  'nessuna parola di televendita o di pagamento nei testi dell’offerta',
  [],
  [/gratis|gratuit/i, /addebito/i, /rinnovo/i, /disdici/i, /torni su Base/i].filter((r) =>
    testiOfferta.some((t) => r.test(t)),
  ),
);

console.log('\n— 3. Store degli override (sr_simple_text_overrides) —');
check('chiave localStorage attesa', 'sr_simple_text_overrides', STORAGE_KEY_TESTI_RAPIDI);
check('JSON corrotto in storage → si riparte dai default', {}, overrideTesti());
check('prima modifica: si usa il default del codice', TESTI_EDITABILI['faq.piano-conveniente.domanda'], testoCorrente('faq.piano-conveniente.domanda'));

let notifiche = 0;
const annulla = sottoscriviTesti(() => {
  notifiche += 1;
});
impostaTesto('faq.piano-conveniente.domanda', 'Domanda riscritta dall’editor?');
check('testo sostituito all’istante', 'Domanda riscritta dall’editor?', testoCorrente('faq.piano-conveniente.domanda'));
check('ascoltatori notificati', 1, notifiche);
check('snapshot: 1 override', 1, Object.keys(overrideTesti()).length);
check(
  'override scritto in localStorage sotto la sua chiave',
  'Domanda riscritta dall’editor?',
  JSON.parse(fintoStorage.getItem(STORAGE_KEY_TESTI_RAPIDI) ?? '{}')['faq.piano-conveniente.domanda'],
);
impostaTesto('faq.piano-conveniente.domanda', 'Domanda riscritta dall’editor?');
check('stesso valore → nessuna scrittura né notifica inutile', 1, notifiche);
annulla();
impostaTesto('prezzi.offerta.email.titolo', 'Email del riepilogo');
check('dopo l’annullamento non arrivano notifiche', 1, notifiche);
check('2 override attivi', 2, Object.keys(overrideTesti()).length);
check(
  'le chiavi non toccate restano il default',
  testoDiDefault('faq.carta-docente.domanda'),
  testoCorrente('faq.carta-docente.domanda'),
);

console.log('\n— 4. Svuotare il campo e «Reset testi» —');
impostaTesto('prezzi.offerta.email.titolo', '');
check('campo svuotato → torna il default', testoDiDefault('prezzi.offerta.email.titolo'), testoCorrente('prezzi.offerta.email.titolo'));
check(
  'override tolto dallo storage',
  1,
  Object.keys(JSON.parse(fintoStorage.getItem(STORAGE_KEY_TESTI_RAPIDI) ?? '{}')).length,
);
azzeraTesti();
check('reset: nessun override', 0, Object.keys(overrideTesti()).length);
check('reset: chiave localStorage cancellata', null, fintoStorage.getItem(STORAGE_KEY_TESTI_RAPIDI));
check('reset: copy di nuovo quella del codice', TESTI_EDITABILI['faq.piano-conveniente.domanda'], testoCorrente('faq.piano-conveniente.domanda'));

console.log('\n— 5. Cablaggio: DEV Toolbar, FAQ, vetrina PRO —');
const devToolbar = leggi('src/components/DevToolbar.tsx');
const pannello = leggi('src/components/EditorTestiRapido.tsx');
const hook = leggi('src/hooks/useTestiEditabili.ts');
const faq = leggi('src/pages/FAQPage.tsx');
const vetrinaPro = leggi('src/components/landing/LandingOffertaPro.tsx');
const prezziPage = leggi('src/pages/PrezziPage.tsx');
const elencoFaq = leggi('src/data/faqPubbliche.ts');
const campioniFaq = ['faq.radar-personalizzati.risposta', 'faq.piano-conveniente.risposta',
  'faq.regala-pro-collega.risposta', 'faq.carta-docente.risposta'] as const;
const campioniOfferta = ['prezzi.offerta.telegram.titolo', 'prezzi.offerta.email.testo', 'prezzi.offerta.purefocus.titolo'] as const;
/** La copy non deve stare nel CODICE: i commenti (che citano i testi) non contano. */
const senzaCommenti = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

check(
  'DEV Toolbar: sezione importata e montata nel pannello',
  true,
  /import \{ EditorTestiRapido \} from '@\/components\/EditorTestiRapido'/.test(devToolbar) &&
    /<EditorTestiRapido \/>/.test(devToolbar),
);
check('DEV Toolbar: continua a vivere solo in sviluppo', true, /if \(!import\.meta\.env\.DEV\) return null/.test(devToolbar));
check('hook: gli override valgono SOLO in sviluppo', true, /import\.meta\.env\.DEV === true/.test(hook));
check('sezione: nome «Editor Testi Rapido»', true, pannello.includes('Editor Testi Rapido'));
check(
  'sezione UNIVERSALE: una textarea per ogni testo rilevato nel DOM, nessun raggruppamento',
  [true, false],
  [
    pannello.includes('<textarea') &&
      pannello.includes('testi.map') &&
      pannello.includes('useTestiDomInPagina') &&
      pannello.includes('imposta('),
    /gruppiTesti|<details|\bsummary\b/.test(pannello),
  ],
);
check(
  'sezione: rotta attiva e stato vuoto espliciti',
  [true, true],
  [/useLocation/.test(pannello) && /pathname/.test(pannello), /Nessun testo rilevato/.test(pannello)],
);
check('sezione: pulsante di reset ai default', true, pannello.includes('Reset testi') && pannello.includes('azzera'));
check('sezione: dichiara la chiave localStorage', true, pannello.includes('STORAGE_KEY_TESTI_DOM'));
check(
  'FAQ: resa per chiave (nessuna copy duplicata nel JSX)',
  [true, []],
  [
    /testo\(f\.q\)/.test(faq) && /testo\(f\.a\)/.test(faq),
    campioniFaq.filter((c) => senzaCommenti(faq).includes(TESTI_EDITABILI[c].slice(0, 60))),
  ],
);
check('FAQ: ancore pubbliche intatte (elenco condiviso)', true, /id: 'animatore-digitale'/.test(elencoFaq) && /id: 'invita-un-collega'/.test(elencoFaq));
check(
  'vetrina PRO: titoli e testi dei blocchi resi per chiave, zero copy nel codice',
  [2, 3, []],
  [
    (vetrinaPro.match(/testo\(punto\./g) ?? []).length, (vetrinaPro.match(/titolo: 'prezzi\.offerta\./g) ?? []).length,
    campioniOfferta.filter((c) => senzaCommenti(vetrinaPro).includes(TESTI_EDITABILI[c].slice(0, 40))),
  ],
);
/**
 * Voci riscritte su richiesta del cliente (29/09/2026): copy nel registro, una chiave per
 * campo. Il CONTENUTO approvato è sorvegliato da `test:copy:pubblico` (guardia di copy).
 */
const vociRichieste: ChiaveTesto[] = [
  'faq.invita-un-collega.risposta',
  'faq.purefocus-gmail.domanda',
  'faq.purefocus-gmail.risposta',
  'faq.regala-pro-collega.risposta',
  'faq.carta-docente.risposta',
  'faq.accesso-google-edu.risposta',
];
check('FAQ riscritte su richiesta del cliente (6 chiavi)', 6, vociRichieste.filter((c) => CHIAVI_TESTO.includes(c)).length);
check(
  'elenco condiviso: /faq e /prezzi rendono le stesse voci per chiave',
  true,
  /from '@\/data\/faqPubbliche'/.test(faq) &&
    /FAQ_PUBBLICHE\.map/.test(faq) &&
    /from '@\/data\/faqPubbliche'/.test(prezziPage) &&
    /FAQ_PUBBLICHE\.map/.test(prezziPage) &&
    /useTestiEditabili/.test(prezziPage) &&
    /testo\(f\.q\)/.test(prezziPage),
);
check('ancora pubblica #animatore-digitale nell’elenco condiviso', true, /id: 'animatore-digitale'/.test(elencoFaq));
check(
  'modulo 🔒 /prezzi: la sola sezione FAQ nel registro, listino e cifre restano nel file',
  [true, true, []],
  [
    /prezzo: '/.test(prezziPage),
    !/prezzi\.offerta\./.test(prezziPage),
    campioniFaq.filter((c) => senzaCommenti(prezziPage).includes(TESTI_EDITABILI[c].slice(0, 60))),
  ],
);

console.log(errori === 0 ? '\n✅ EDITOR TESTI: nessun problema' : `\n❌ EDITOR TESTI: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

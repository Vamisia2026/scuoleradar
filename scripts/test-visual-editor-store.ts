/**
 * Test — «VISUAL EDITOR» (click-to-edit, solo sviluppo): STORE per rotta e cablaggio dei file.
 *
 * Secondo pezzo della catena `test:visual-editor`: blocchi e scansione si verificano su un DOM
 * finto in `scripts/test-visual-editor.ts`; qui si controlla il resto —
 *
 *  1. STORE: una chiave `localStorage` per ROTTA (`sr_visual_editor:/prezzi`) con voce
 *     `chiave → { t, v }`, indice delle rotte toccate, snapshot a riferimento stabile per
 *     `useSyncExternalStore`, notifica agli ascoltatori SOLO su cambiamento reale;
 *  2. TOLLERANZA: JSON corrotto e voci malformate non fanno danni: si torna alla copy del codice;
 *  3. GIRO COMPLETO: una modifica scritta nello store, riletta da una pagina ricaricata, applicata
 *     al DOM da `scansionaVista` e sotto la stessa chiave che la scansione ricalcola;
 *  4. AZZERAMENTO ed ESPORTAZIONE: reset di pagina e globale (indice compreso), testo pronto da
 *     incollare nel codice, JSON di tutte le pagine;
 *  5. CABLAGGIO: `App.tsx` monta il provider dentro il router, il provider non fa nulla in
 *     produzione, l'hook osserva il DOM e intercetta il click in cattura, il pannello è marcato
 *     `data-sr-visual-editor`.
 *
 * Uso: npm run test:visual-editor (secondo script della catena; incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { chiaveTestoDom } from '../src/lib/testiDomRegole.ts';
import {
  CHIAVE_ROTTE_VISUAL_EDITOR,
  CHIAVE_VISUAL_EDITOR_ATTIVO,
  PREFISSO_STORAGE_VISUAL_EDITOR,
  azzeraOverrideRotta,
  azzeraTutteLeRotte,
  chiaveStorageRotta,
  esportaJsonRotte,
  esportaTestoRotta,
  impostaOverrideRotta,
  overrideRotta,
  overrideRottaSalvatiDaStorage,
  overrideTutteLeRotte,
  rotteSalvate,
  sottoscriviVisualEditor,
} from '../src/lib/visualEditorStore.ts';
import { nuovaMemoriaTocchi, scansionaVista } from '../src/lib/visualEditorScansione.ts';
import type { NodoDom } from '../src/lib/visualEditorRegole.ts';
import { el, type FintoElemento } from './lib/dom-finto.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}
const leggi = (p: string): string => readFileSync(p, 'utf8');
const testoDi = (nodo: FintoElemento, indice = 0): string => String(nodo.childNodes[indice].nodeValue);

/**
 * Stub di `localStorage` installato PRIMA della prima lettura dello store (che poi tiene la
 * cache): serve a provare che l'override finisca davvero nella chiave concordata.
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

/** Chiave vera di un blocco, come la calcola la scansione: `p#impronta#occorrenza`. */
const chiave = chiaveTestoDom('p', 'Vedi qui ora', 0);

console.log('— 1. Store per rotta: chiavi, persistenza, notifiche —');
check(
  'chiave per rotta, indice delle rotte e flag di accensione',
  ['sr_visual_editor:/prezzi', 'sr_visual_editor:_rotte', 'sr_visual_editor_attivo'],
  [chiaveStorageRotta('/prezzi'), CHIAVE_ROTTE_VISUAL_EDITOR, CHIAVE_VISUAL_EDITOR_ATTIVO],
);
check('prefisso delle chiavi dichiarato', 'sr_visual_editor:', PREFISSO_STORAGE_VISUAL_EDITOR);
let notifiche = 0;
const annulla = sottoscriviVisualEditor(() => {
  notifiche += 1;
});
check(
  'scrittura di una modifica',
  true,
  impostaOverrideRotta('/prezzi', chiave, { t: 'Vedi qui ora', v: 'Guarda qui adesso' }),
);
check(
  'la stessa modifica riscritta non cambia nulla (niente notifica)',
  [false, 1],
  [impostaOverrideRotta('/prezzi', chiave, { t: 'Vedi qui ora', v: 'Guarda qui adesso' }), notifiche],
);
check(
  'snapshot a riferimento stabile e voce in memoria',
  [true, 'Guarda qui adesso'],
  [overrideRotta('/prezzi') === overrideRotta('/prezzi'), overrideRotta('/prezzi')[chiave].v],
);
check(
  'la voce finisce nella chiave concordata, come { t, v }',
  true,
  (fintoStorage.getItem(chiaveStorageRotta('/prezzi')) ?? '').includes('"Guarda qui adesso"'),
);
check(
  'una pagina RICARICATA la ritrova',
  'Guarda qui adesso',
  overrideRottaSalvatiDaStorage('/prezzi')[chiave].v,
);
check(
  'indice ed esportazione completa delle rotte toccate',
  [true, ['/prezzi']],
  [rotteSalvate().includes('/prezzi'), Object.keys(overrideTutteLeRotte())],
);

console.log('\n— 2. Letture tolleranti —');
fintoStorage.setItem(chiaveStorageRotta('/faq'), '{rotto');
check('JSON corrotto ⇒ copy del codice, nessun crash', {}, overrideRottaSalvatiDaStorage('/faq'));
fintoStorage.setItem(
  chiaveStorageRotta('/x'),
  JSON.stringify({
    buona: { t: 'a', v: 'b' },
    vuota: { t: 'a', v: '' },
    stringa: 'ciao',
    numeri: { t: 1, v: 'b' },
  }),
);
check(
  'voci malformate scartate, voci buone tenute',
  { buona: { t: 'a', v: 'b' } },
  overrideRottaSalvatiDaStorage('/x'),
);

console.log('\n— 3. Giro completo: store → scansione → DOM —');
const paragrafo = el('p', 'Vedi qui ora');
const pagina = el('main', el('section', paragrafo));
const rilette = overrideRottaSalvatiDaStorage('/prezzi');
const esito = scansionaVista(pagina as unknown as NodoDom, rilette, nuovaMemoriaTocchi());
check(
  'la modifica riletta dallo storage si applica al DOM',
  ['Guarda qui adesso', true],
  [testoDi(paragrafo), esito.blocchi[0].modificato],
);
check(
  'e la chiave ricalcolata dalla scansione è quella dello store',
  chiave,
  esito.blocchi[0].chiave,
);

console.log('\n— 4. Azzeramento ed esportazione —');
const testo = esportaTestoRotta('/prezzi', overrideRotta('/prezzi'), '3 ottobre 2026');
check(
  'esportazione di testo: una riga per blocco, con «era» e «ora»',
  [true, true],
  [testo.includes('era: «Vedi qui ora»'), testo.includes('ora: «Guarda qui adesso»')],
);
check(
  'esportazione JSON: leggibile e rileggibile',
  'Guarda qui adesso',
  JSON.parse(esportaJsonRotte(overrideTutteLeRotte()))['/prezzi'][chiave].v,
);
check(
  'azzera la rotta (la seconda volta non c’è più niente da fare)',
  [true, false],
  [azzeraOverrideRotta('/prezzi'), azzeraOverrideRotta('/prezzi')],
);
check(
  'chiave e indice ripuliti',
  [null, false],
  [fintoStorage.getItem(chiaveStorageRotta('/prezzi')), rotteSalvate().includes('/prezzi')],
);
impostaOverrideRotta('/prezzi', chiave, { t: 'Vedi qui ora', v: 'Guarda qui adesso' });
impostaOverrideRotta('/faq', 'p#z#0', { t: 'c', v: 'd' });
check('reset globale: quante rotte ha svuotato', 2, azzeraTutteLeRotte());
check(
  'nessuna rotta resta toccata',
  [[], null],
  [rotteSalvate(), fintoStorage.getItem(CHIAVE_ROTTE_VISUAL_EDITOR)],
);
const primaDelSilenzio = notifiche;
annulla();
impostaOverrideRotta('/prezzi', chiave, { t: 'a', v: 'b' });
check('ascoltatore annullato: nessuna notifica in più', 0, notifiche - primaDelSilenzio);

console.log('\n— 5. Cablaggio: App, provider, hook, pannello —');
const app = leggi('src/App.tsx');
check(
  'App monta il provider dentro il router',
  true,
  /<VisualEditorProvider \/>/.test(app) && /BrowserRouter/.test(app),
);
const provider = leggi('src/components/dev/VisualEditorProvider.tsx');
check('provider: in produzione non monta nessun effetto', true, /import\.meta\.env\.DEV/.test(provider));
check(
  'provider: anello di evidenziazione non cliccabile e marcato',
  true,
  /data-sr-visual-editor/.test(provider) && /pointer-events-none/.test(provider),
);
const hook = leggi('src/hooks/useVisualEditor.ts');
check(
  'hook: osserva il DOM con attesa breve e intercetta il click in cattura',
  [true, true, true],
  [
    /new MutationObserver/.test(hook),
    /ATTESA_SCANSIONE_MS/.test(hook),
    /addEventListener\('click', suClic, true\)/.test(hook),
  ],
);
const pannello = leggi('src/components/dev/VisualEditorPannello.tsx');
check(
  'pannello: marcato data-sr-visual-editor (l’editor non elenca se stesso)',
  true,
  /data-sr-visual-editor/.test(pannello),
);
check(
  'pannello: esportazione del testo (codice) e JSON (tutte le pagine)',
  true,
  /esportaTestoRotta/.test(pannello) && /esportaJsonRotte/.test(pannello),
);
check(
  'store: la chiave per rotta è scritta come letterale nel modulo',
  true,
  leggi('src/lib/visualEditorStore.ts').includes("'sr_visual_editor:'"),
);

console.log(
  errori === 0
    ? '\n✅ VISUAL EDITOR (store + cablaggio): nessun problema'
    : `\n❌ VISUAL EDITOR (store + cablaggio): ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

console.log(
  errori === 0
    ? '\n✅ VISUAL EDITOR (store + cablaggio): nessun problema'
    : `\n❌ VISUAL EDITOR (store + cablaggio): ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


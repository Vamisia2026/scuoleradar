/**
 * Test — «EDITOR TESTI RAPIDO» UNIVERSALE: cablaggio dei file (DEV Toolbar, pannello, hook).
 *
 * Ultimo pezzo della catena `test-editor-testi`: il COMPORTAMENTO della scansione si verifica
 * eseguendola su un DOM finto (`scripts/test-editor-testi-dom.ts`); qui si controlla che i pezzi
 * siano collegati come dichiarato — la libreria resta pura, l'hook osserva il DOM e riapplica
 * gli override, la DEV Toolbar lo monta SEMPRE in sviluppo (non solo a pannello aperto) e il
 * pannello mostra un elenco costruito sui testi rilevati, senza elenchi cablati.
 *
 * Uso: npm run test:editor-testi (quarto script della catena; incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { STORAGE_KEY_TESTI_DOM } from '../src/lib/testiDomOverride.ts';

const leggi = (p: string): string => readFileSync(p, 'utf8');
let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Cablaggio: store, libreria, hook, pannello, DEV Toolbar —');
check('store: chiave localStorage concordata', 'sr_dom_text_overrides', STORAGE_KEY_TESTI_DOM);
check(
  'store: chiave scritta come letterale nel modulo',
  true,
  leggi('src/lib/testiDomOverride.ts').includes("'sr_dom_text_overrides'"),
);

const libreria = leggi('src/lib/testiDom.ts');
const nodi = leggi('src/lib/testiDomNodi.ts');
const regole = leggi('src/lib/testiDomRegole.ts');
check(
  'libreria: tre moduli puri e isomorfi (nessun React)',
  [false, false, false],
  [/from 'react'/.test(libreria), /from 'react'/.test(nodi), /from 'react'/.test(regole)],
);
check(
  'libreria: nessuna scansione all’import (il DOM lo passa l’hook)',
  false,
  /scansionaTestiDom\((document|window)/.test(libreria),
);
check(
  'nodi: esclude i pannelli DEV (marchio e DevToolbar in id/aria-label)',
  true,
  /data-sr-dev-toolbar/.test(nodi) && /devtoolbar/i.test(nodi),
);
check(
  'regole: identità dei testi e nomi leggibili fuori dalla lettura del DOM',
  true,
  /chiaveTestoDom/.test(regole) && /campoDi/.test(regole) && !/childNodes/.test(regole),
);

const hook = leggi('src/hooks/useTestiDom.ts');
check('hook: lavora sul DOM vero della pagina', true, /document\.body/.test(hook));
check(
  'hook: scansione immediata + osservatore con attesa (raggruppa i render)',
  [true, true, true],
  [
    /new MutationObserver/.test(hook),
    /childList: true/.test(hook) && /subtree: true/.test(hook) && /characterData: true/.test(hook),
    /ATTESA_MS/.test(hook),
  ],
);
check(
  'hook: il pannello scrive l’override e ricalcola il DOM subito (effetto immediato)',
  true,
  /impostaTestoDom\(chiave, valore\)[\s\S]{0,90}scandisciOra\(\)/.test(hook),
);
check(
  'hook: il reset azzera E riscrive il DOM (non solo lo store)',
  true,
  /azzeraTestiDom\(\)[\s\S]{0,40}scandisciOra\(\)/.test(hook),
);

const devToolbar = leggi('src/components/DevToolbar.tsx');
check(
  'DEV Toolbar: scansione montata SEMPRE in DEV (non solo a pannello aperto)',
  true,
  /useScansioneTestiDom\(\)/.test(devToolbar),
);
check('DEV Toolbar: il pannello è montato', true, /<EditorTestiRapido \/>/.test(devToolbar));

const pannello = leggi('src/components/EditorTestiRapido.tsx');
check(
  'pannello: una <textarea> per ogni testo rilevato + rotta attiva',
  [true, true],
  [
    /testi\.map/.test(pannello) && /<textarea/.test(pannello),
    /useLocation/.test(pannello) && /pathname/.test(pannello),
  ],
);
check(
  'pannello: Reset chiaro (DOM + registro) e riga di stato vuoto',
  true,
  /Reset testi/.test(pannello) && /azzeraRegistro/.test(pannello) && /Nessun testo rilevato/.test(pannello),
);
check('pannello: marchiato per essere escluso dalla propria scansione', true, /data-sr-dev-toolbar/.test(pannello));
check(
  'pannello: nessun elenco cablato (niente fisarmoniche né gruppi)',
  false,
  /gruppiTesti|<details|\bsummary\b/.test(pannello),
);

console.log(errori === 0 ? '\n✅ EDITOR TESTI (cablaggio DOM): nessun problema' : `\n❌ EDITOR TESTI (cablaggio DOM): ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

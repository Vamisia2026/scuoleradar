/**
 * Test — RENDER del selettore a 3 stati dei dipartimenti (OFF | TEST | ON).
 *
 * Perché esiste: i toggle della DEV Toolbar erano presenti nel sorgente ma non
 * visibili all'utente (forma a card troppo alta). Questo test renderizza il
 * componente con `react-dom/server` e conta i controlli REALI nel markup, così una
 * regressione di visibilità salta fuori subito:
 *   · `variante="lista"` → la forma usata dentro la DEV Toolbar (una riga per
 *     dipartimento, 6 righe × 3 pulsanti = 18 pulsanti);
 *   · `variante="card"`  → la forma del pannello Admin (6 card, sempre 18 pulsanti).
 *
 * Non serve un browser: il componente è di sola presentazione. La DEV Toolbar nel
 * suo insieme non è renderizzabile in Node (usa `import.meta.env` e AppContext):
 * la sua presenza è coperta dal cablaggio sorgente in `test-feature-flags.ts`.
 *
 * Uso: npm run test:flags  (e `npm test`)
 */
import { createElement } from 'react';
import ReactDOMServer from 'react-dom/server';
import {
  DIPARTIMENTI,
  type DipartimentoId,
  type StatoDipartimento,
} from '../src/config/features.ts';
import { FlagDipartimentiPanel } from '../src/components/FlagDipartimentiPanel.tsx';

/** Interfaccia minima per l'ambiente (come gli altri script di test). */
declare const process: { exitCode?: number };

const stati = {} as Record<DipartimentoId, StatoDipartimento>;
for (const d of DIPARTIMENTI) stati[d.id] = d.statoBase;

function rendi(variante: 'lista' | 'card'): string {
  return ReactDOMServer.renderToStaticMarkup(
    createElement(FlagDipartimentiPanel, {
      variante,
      stati,
      dipartimenti: DIPARTIMENTI,
      onCambia: () => undefined,
      origine: () => 'default',
    }),
  );
}

const lista = rendi('lista');
const card = rendi('card');
const conta = (frammento: string, testo = lista) => testo.split(frammento).length - 1;

let errori = 0;
function check(nome: string, atteso: number, ottenuto: number): void {
  const ok = atteso === ottenuto;
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${atteso} ottenuto=${ottenuto}`);
}

console.log('— Render della variante LISTA (DEV Toolbar) —');
check('6 righe (una per dipartimento)', 6, conta('justify-between'));
check('18 pulsanti OFF | TEST | ON', 18, conta('aria-pressed'));
check('6 pulsanti OFF', 6, conta('>OFF<'));
check('6 pulsanti TEST', 6, conta('>TEST<'));
check('6 pulsanti ON', 6, conta('>ON<'));
check('nessuna card nel layout lista', 0, conta('<section'));
for (const d of DIPARTIMENTI) {
  // Il nome compare 3 volte per riga: testo visibile, `title` e `aria-label`.
  check(`nome mostrato: ${d.nome}`, 3, conta(d.nome));
}

console.log('\n— Render della variante CARD (pannello Admin) —');
check('6 card (section)', 6, conta('<section', card));
check('18 pulsanti OFF | TEST | ON', 18, conta('aria-pressed', card));
check('note per card (descrizione + stato attuale)', DIPARTIMENTI.length * 2, conta('leading-relaxed', card));

process.exitCode = errori === 0 ? 0 : 1;
console.log(
  errori === 0
    ? '\n✅ Toggle dei dipartimenti: renderizzati in entrambe le varianti.'
    : `\n❌ ${errori} controllo/i fallito/i.`,
);

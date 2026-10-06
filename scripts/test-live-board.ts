/**
 * Verifica la VETRINA del "Radar Live" (Flight Board).
 *
 * DIREZIONE (§26.59, direttiva cliente 05/10/2026 — ripristina il gate STRETTO e
 * corregge la §26.47 del 04/10/2026): in pagina entra SOLO una riga con il nome di
 * un ISTITUTO REALE risolto per anagrafica — campo `school_name` al gate, registro
 * per codice meccanografico, oppure nome leggibile ricavato dal titolo. Restano
 * FUORI: (a) le righe con il solo nome GREZZO pubblicato dal bando, (b) quelle senza
 * alcun nome risolvibile (per cui la §26.47 prevedeva il segnaposto «Scuola non
 * specificata / Più plessi»), (c) — come sempre — le righe che non sono avvisi vivi:
 * scadute o senza data di pubblicazione utile per la finestra dei 60 giorni.
 * Nella colonna «Scuola» non finisce MAI un codice amministrativo («EEEE | A246»,
 * «AAAA | A246»), per nessuna strada.
 *
 * La finestra dei 60 giorni e l'alternanza per provincia (scala NAZIONALE del
 * tabellone) sono verificati a parte da `npm run test:board:scala`
 * (`scripts/test-live-board-scala.ts`).
 *
 * Uso: npm run test:board
 */
import {
  SCUOLA_NON_SPECIFICATA,
  preparaRigheBoard,
  scuolaDaTitolo,
} from '../src/lib/liveBoard.ts';
// Le righe di prova vivono in `scripts/lib/fixtures-board.ts`: la stessa fixture
// serve alle guardie della vetrina (§26.59).
import { RIGHE_BOARD } from './lib/fixtures-board.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}


const pronte = preparaRigheBoard(RIGHE_BOARD);
check(
  'in vetrina entrano SOLO le righe con un istituto REALE risolto (§26.59)',
  ['ok', 'da-codice', 'da-titolo', 'codici-classe', 'nome-con-coda', 'anagrafica-parziale'],
  pronte.map((p) => p.riga.id),
);
check(
  'senza istituto reale la riga resta FUORI (né nome grezzo né segnaposto)',
  [],
  pronte
    .filter((p) =>
      ['senza-scuola', 'solo-codici', 'etichetta-posto', 'client-codici', 'posto-montessori'].includes(
        p.riga.id,
      ),
    )
    .map((p) => p.riga.id),
);
check(
  'nessuna riga in vetrina mostra la dicitura gestita',
  [],
  pronte.filter((p) => p.scuola === SCUOLA_NON_SPECIFICATA).map((p) => p.riga.id),
);
check(
  'nome ricostruito (registro o titolo) → anagrafica parziale dichiarata',
  [true, true],
  ['da-codice', 'da-titolo'].map((id) =>
    Boolean(pronte.find((p) => p.riga.id === id)?.anagraficaParziale),
  ),
);
check(
  'nome dal campo `school_name` → anagrafica completa',
  false,
  Boolean(pronte.find((p) => p.riga.id === 'ok')?.anagraficaParziale),
);
check(
  'stato `parziale` con istituto reale: la riga ENTRA e lo dichiara',
  true,
  Boolean(pronte.find((p) => p.riga.id === 'anagrafica-parziale')?.anagraficaParziale),
);
check(
  'fuori restano anche gli avvisi non vivi (scaduto / fuori finestra)',
  [],
  pronte
    .filter((p) => ['senza-scadenza', 'scaduto'].includes(p.riga.id))
    .map((p) => p.riga.id),
);
check(
  'nome reale ripulito dalla coda di procedura',
  'I.C. Ferruccio Ulivi',
  pronte.find((p) => p.riga.id === 'nome-con-coda')?.scuola ?? null,
);
// La STRETTEZZA del gate è verificata anche da `npm run test:pipeline`
// (`scripts/test-pipeline-tollerante.ts`) e da `npm run test:nome-istituto`.
check(
  'nessun codice amministrativo in vetrina',
  [],
  pronte.filter((p) => /\||\d[A-Za-zÀ-ÿ]|[A-Za-zÀ-ÿ]\d/.test(p.scuola)).map((p) => p.riga.id),
);
check(
  'scuola risolta dal registro per codice',
  "I.I.S. 'L. Gigli'",
  pronte.find((p) => p.riga.id === 'da-codice')?.scuola ?? null,
);
check(
  'scuola risolta dal titolo',
  'Liceo Scientifico Galilei',
  pronte.find((p) => p.riga.id === 'da-titolo')?.scuola ?? null,
);
check(
  'nessuna riga mostra placeholder di scuola',
  [],
  pronte.filter((p) => /non indicata|non disponibile|n\/d/i.test(p.scuola)).map((p) => p.riga.id),
);
check(
  'ogni riga con scadenza dichiarata ha una data valida',
  [],
  pronte
    .filter((p) => p.scadenza !== null && !/^\d{4}-\d{2}-\d{2}/.test(p.scadenza))
    .map((p) => p.riga.id),
);
check(
  'nessuna riga entra senza scadenza se non per la finestra dei 60 giorni',
  [],
  pronte.filter((p) => p.scadenza === null && !p.senzaScadenza).map((p) => p.riga.id),
);
check('scuola dal titolo: frammento generico ignorato', null, scuolaDaTitolo('Avviso supplenza — Scuola'));
check(
  'scuola dal titolo: nome PRIMA del separatore quando dopo c’è la procedura',
  'IX IC Ricci Curbastro',
  scuolaDaTitolo('IX IC Ricci Curbastro – nterpello per la copertura di posti Art. 13 C.'),
);
check(
  'scuola dal titolo: frammento di procedura non è un nome di scuola',
  null,
  scuolaDaTitolo('annotazione_INTERPELLO – Classe di concorso A042 – 9H – Dal 01.10.2026'),
);
check(
  'scuola dal titolo: il nome dopo il separatore resta la prima scelta',
  'Liceo Scientifico Galilei',
  scuolaDaTitolo('Interpello supplenza — Liceo Scientifico Galilei'),
);
check(
  'scuola dal titolo: solo codici classe → nessun nome inventato',
  null,
  scuolaDaTitolo('ADEE | EEEE'),
);
check(
  'elenchi di codici classe («ADEE | EEEE») non sono nomi di scuola: riga FUORI (§26.59)',
  false,
  pronte.some((p) => p.riga.id === 'solo-codici'),
);
check(
  'ogni riga in vetrina ha una scuola reale (mai un segnaposto)',
  [],
  pronte.filter((p) => !p.scuola || p.scuola === SCUOLA_NON_SPECIFICATA).map((p) => p.riga.id),
);
check(
  'nessun codice classe esposto come nome scuola',
  [],
  pronte.filter((p) => /\|/.test(p.scuola)).map((p) => p.riga.id),
);
check('liste vuote non rompono il filtro', 0, preparaRigheBoard([]).length);

console.log(errori === 0 ? '\n✅ RADAR LIVE: nessun problema' : `\n❌ RADAR LIVE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;


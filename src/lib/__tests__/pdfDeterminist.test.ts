/**
 * TEST — LETTURA DETERMINISTICA DEL TESTO PDF (`src/lib/pdfDeterminist.ts`).
 *
 * La guardia deve leggere da sola i PDF scolastici completi (scadenza futura +
 * classe + PEC) e NON chiamare l'LLM; quando manca un dato critico deve passare
 * al modello SOLO una finestra ≤ 500 caratteri, mai il documento. La prova copre
 * anche la distinzione pubblicazione/scadenza, la normalizzazione dei codici
 * (`A022` → `A-22`) e il cablaggio in `scripts/pdf-ingest.ts` + `npm test`.
 *
 * Uso: npm run test:pdf-determinist  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  MAX_CHUNK_CHARS,
  SOGLIA_CONFIDENZA,
  estraiCodiciClasse,
  parsePdfDeterminist,
} from '../pdfDeterminist.ts';
import { risolviDocumentoPdf, valutaTestoPdf } from '../../../scripts/pdf-ingest.ts';

/** Interfaccia minima per l'ambiente (come gli altri test di prodotto). */
declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
/** Oggi fisso: il verdetto «futura» non deve dipendere dal giorno del test. */
const OGGI = new Date('2026-10-23T09:00:00');

/* ------------------- 1) UN AVVISO COMPLETO NON CHIAMA L'LLM ----------------- */

const AVVISO_COMPLETO = `ISTITUTO COMPRENSIVO "G. PASCOLI" — C.F. 85001230045
Prot. n. 4821/2026 del 21/10/2026

OGGETTO: Avviso di selezione per il conferimento di supplenza temporanea
classe di concorso A022 — Scienze e tecnologie informatiche.

Le domande devono essere presentate entro le ore 12:00 del 15/11/2026
esclusivamente via PEC all'indirizzo geic85000h@pec.istruzione.it
PEO: protocollo@icpascoli.edu.it`;

console.log('\n— Basta la via deterministica —');
const completo = parsePdfDeterminist(AVVISO_COMPLETO, OGGI);
check('nessun ripiego LLM', false, completo.needsLlmFallback);
check('success', true, completo.success);
check('scadenza estratta', '2026-11-15', completo.data.expirationDate);
check('classe normalizzata', ['A-22'], completo.data.classCodes);
check('PEC preferita al PEO', 'geic85000h@pec.istruzione.it', completo.data.email);
check('istituto riconosciuto', true, (completo.data.schoolName ?? '').includes('ISTITUTO COMPRENSIVO'));
check('confidenza sopra soglia', true, completo.confidence >= SOGLIA_CONFIDENZA);
check('nessun chunk quando non serve', undefined, completo.candidateChunk);

/* ------------------ 2) PUBBLICAZIONE ≠ SCADENZA (§26.72) ------------------- */

const CON_PUBBLICAZIONE = `Pubblicato il 12/09/2026
Avviso di supplenza classe A-12 — Scienze naturali.
Scadenza: 15/09/2026`;

console.log('\n— La pubblicazione non è la scadenza —');
const dueDate = parsePdfDeterminist(CON_PUBBLICAZIONE, new Date('2026-09-01T08:00:00'));
check('scadenza reale', '2026-09-15', dueDate.data.expirationDate);
check('pubblicazione distinta', '2026-09-12', dueDate.data.publicationDate);
check('avviso completo senza LLM', false, dueDate.needsLlmFallback);

/* -------------------- 3) NORMALIZZAZIONE DEI CODICI ----------------------- */

console.log('\n— I codici classe hanno una forma sola —');
check(
  'A022/A012/A042 → A-22/A-12/A-42, sigle intatte, segnaposto esclusi',
  ['A-22', 'A-12', 'B-02', 'A-28', 'ADSS', 'ADEE', 'AB25', 'A-42'],
  estraiCodiciClasse('A022, A-12, A012, B-02, A028, ADSS, ADEE, AB25, AAAA, A-042'),
);
check('minuscolo tollerato', ['A-22'], estraiCodiciClasse('classe a022'));
check('codice fuori range ignorato', [], estraiCodiciClasse('A-00 e A.123'));

/* ---------------------- 4) IL CHUNK È SOLO IL CHUNK ----------------------- */

const RIEMPITIVO =
  "Il presente avviso è pubblicato all'albo pretorio dell'istituto per la consultazione degli atti. ".repeat(40);
const LUNGO_SENZA_CLASSE = `INTESTAZIONE RISERVATA\n${RIEMPITIVO}\nTermine presentazione domande: 30/11/2026\n${RIEMPITIVO}`;

console.log('\n— Senza classe si passa solo la finestra utile —');
const senzaClasse = parsePdfDeterminist(LUNGO_SENZA_CLASSE, OGGI);
const chunk = senzaClasse.candidateChunk ?? '';
check('serve il ripiego', true, senzaClasse.needsLlmFallback);
check('nessun successo senza classe', false, senzaClasse.success);
check('chunk entro il tetto', true, chunk.length <= MAX_CHUNK_CHARS);
check('chunk centrato sulla scadenza', true, chunk.includes('Termine presentazione domande: 30/11/2026'));
check('testa del documento fuori dal chunk', false, chunk.includes('INTESTAZIONE'));
check('chunk più corto del documento', true, chunk.length < LUNGO_SENZA_CLASSE.length);

/* ------------------- 5) SCADENZA PASSATA E TESTO VUOTO -------------------- */

console.log('\n— Una scadenza passata non è un’opportunità —');
const scaduto = parsePdfDeterminist('Avviso di supplenza classe A-22. Scadenza: 10/01/2026.', OGGI);
check('data esposta', '2026-01-10', scaduto.data.expirationDate);
check('nessun successo', false, scaduto.success);
check('serve il ripiego', true, scaduto.needsLlmFallback);

const vuoto = parsePdfDeterminist('   \n\t ', OGGI);
check('vuoto: nessun successo', false, vuoto.success);
check('vuoto: confidenza 0', 0, vuoto.confidence);
check('vuoto: serve il ripiego', true, vuoto.needsLlmFallback);
check('vuoto: nessun chunk inventato', undefined, vuoto.candidateChunk);
check('vuoto: nessuna classe', [], vuoto.data.classCodes);

/* ------------------- 6) L'INGESTIONE CHIAMA L'LLM SOLO SE SERVE ------------ */

console.log('\n— L’LLM riceve solo il chunk, e solo quando serve —');
check('nessun fallback sui dati completi', null, valutaTestoPdf(AVVISO_COMPLETO, 'a.pdf', OGGI).fallback);
let chiamate = 0;
const diretto = await risolviDocumentoPdf(
  AVVISO_COMPLETO,
  'a.pdf',
  async () => {
    chiamate += 1;
    return null;
  },
  OGGI,
);
check('LLM mai invocato', 0, chiamate);
check('percorso deterministico', false, diretto.usatoLlm);

const richiesta = valutaTestoPdf(LUNGO_SENZA_CLASSE, 'lungo.pdf', OGGI).fallback;
check('fallback presente', true, richiesta !== null);
check('fallback = candidateChunk', senzaClasse.candidateChunk, richiesta?.chunk);
check('fallback entro 500 caratteri', true, (richiesta?.chunk ?? '').length <= MAX_CHUNK_CHARS);

let ricevuto = '';
const conLlm = await risolviDocumentoPdf(
  LUNGO_SENZA_CLASSE,
  'lungo.pdf',
  async (r) => {
    ricevuto = r.chunk;
    return { ok: true };
  },
  OGGI,
);
check('LLM usato quando manca la classe', true, conLlm.usatoLlm);
check('all’LLM arriva il chunk', senzaClasse.candidateChunk, ricevuto);
check('il documento intero non arriva all’LLM', false, ricevuto.includes('INTESTAZIONE'));

/* ---------------------- 7) PUREZZA E CABLAGGIO ---------------------------- */

console.log('\n— Modulo puro e cablato nella catena —');
const sorgente = leggi('src/lib/pdfDeterminist.ts');
check('zero import', false, /(^|\n)\s*import\s/.test(sorgente));
check('nessun require dinamico', false, /require\s*\(/.test(sorgente));
check('nessuna rete o LLM', false, /fetch\s*\(|axios|openai|grok|supabase|https?:\/\//i.test(sorgente));

const script = leggi('scripts/pdf-ingest.ts');
check('lo script importa il modulo', true, /from '\.\.\/src\/lib\/pdfDeterminist\.ts'/.test(script));
check('lo script chiama la guardia', true, /parsePdfDeterminist\(/.test(script));
check('il fallback è gated', true, /if \(!esito\.needsLlmFallback\)/.test(script));
check('passa solo il chunk', true, /candidateChunk/.test(script) && /MAX_CHUNK_CHARS/.test(script));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:pdf-determinist' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('src/lib/__tests__/pdfDeterminist.test.ts'),
);

console.log(
  errori === 0
    ? '\n✅ PDF DETERMINIST: si legge il documento, all’LLM solo la finestra utile.'
    : `\n❌ PDF DETERMINIST: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

/**
 * TEST — PURGHE D'INGESTIONE: atti conclusi e pagine di servizio
 * (`src/scraper/attiConclusi.ts`, `src/scraper/paginaServizio.ts`, §26.115).
 *
 * Perché serve: la bacheca non è un albo. Un albo pubblica il bando e, giorni
 * dopo, la graduatoria, l'esito, la nomina dell'assegnatario, il contratto
 * firmato: righe che ieri erano opportunità e oggi sono atti conclusi. E
 * pubblica anche le pagine che *spiegano* come candidarsi (la MAD di Perugia
 * 14), che non sono opportunità di nessun tipo.
 * Questa guardia fissa il contratto:
 *   1. l'atto in TESTA al titolo è sempre concluso (graduatoria, esiti, nomina,
 *      contratto, decreto, aggiudicazione, individuazione di una persona);
 *   2. l'atto NEL titolo vale solo se il titolo non dichiara un'apertura:
 *      «Interpello … da graduatorie di istituto» resta un'opportunità;
 *   3. «individuazione di esperti» (PNRR) è un bando, «individuazione del
 *      docente» è un atto: la differenza è l'oggetto, non la parola;
 *   4. una pagina didascalica senza scadenza e senza classe è di servizio, ma
 *      con una scadenza o una classe resta (è un bando che spiega anche come si
 *      invia la domanda);
 *   5. i due moduli sono PURI e la bacheca li usa davvero (una sola verità con
 *      `eTitoloInformativo`, che ora delega).
 *
 * Uso: npm run test:purghe-ingestione  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import { eAttoConcluso, valutaAttoConcluso } from '../src/scraper/attiConclusi.ts';
import { ePaginaServizio, motivoPaginaServizio } from '../src/scraper/paginaServizio.ts';
import {
  eTitoloInformativo,
  motivoScartoOpportunita,
} from '../src/scraper/qualitaOpportunita.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const leggi = (p: string): string => readFileSync(p, 'utf8');
const OGGI = new Date('2026-10-30T09:00:00Z');

/* ------------------------- 1) L'ATTO È IN TESTA -------------------------- */

console.log('\n— 1. Il titolo che comincia con l’atto è un atto concluso —');
const IN_TESTA: ReadonlyArray<[string, string]> = [
  ['Graduatoria provvisoria per supplenza A022 — I.C. Chieti', 'graduatoria'],
  ['Esiti della procedura di selezione di n. 14 unità di personale ATA', 'esito'],
  ['Esito valutazione titoli — interpello A013', 'esito'],
  ['Nomina supplente classe A022 — I.C. Cuneo', 'nomina'],
  ['Contratto individuale di lavoro a tempo determinato — A022', 'contratto'],
  ['Decreto di aggiudicazione del servizio di trasporto', 'decreto'],
  ['Aggiudicazione definitiva della procedura di gara', 'aggiudicazione'],
  ['Individuazione del docente destinatario di contratto — A022', 'individuazione'],
  ['Verbale della commissione giudicatrice', 'verbale'],
  ['Revoca dell’avviso di selezione prot. 123', 'decreto'],
  ['Pubblicazione della graduatoria definitiva di istituto', 'esito'],
];
for (const [titolo, tipo] of IN_TESTA) {
  check(`atto in testa: ${titolo.slice(0, 42)}…`, tipo, valutaAttoConcluso(titolo).tipo);
}
check(
  'il motivo dichiara il tipo',
  true,
  /atto concluso \(nomina\)/.test(valutaAttoConcluso('Nomina supplente A022').motivo ?? ''),
);

/* --------------- 2) L'ATTO NEL TITOLO, SENZA APERTURA ------------------- */

console.log('\n— 2. L’atto più avanti nel titolo vale solo senza apertura —');
check(
  'nomina dopo la formula di trasmissione',
  true,
  eAttoConcluso('Comunicazione dell’ufficio: nomina della supplente individuata'),
);
check(
  'aggiudicazione citata a metà titolo',
  true,
  eAttoConcluso('Determina a contrarre e successiva aggiudicazione del servizio'),
);
check(
  'interpello che CITA le graduatorie resta ammesso',
  false,
  eAttoConcluso('Interpello supplenza A-022 da graduatorie di istituto — Liceo Manzoni'),
);
check(
  'bando che parla di contratti resta ammesso',
  false,
  eAttoConcluso('Bando per il conferimento di incarico a seguito di esiti della selezione'),
);
check(
  'avviso di individuazione di esperti (PNRR) è un bando',
  false,
  eAttoConcluso('Avviso di individuazione di esperti interni per progetto PNRR'),
);
check(
  'individuazione di esperti in testa è un bando',
  false,
  eAttoConcluso('Individuazione di esperti esterni per PNRR'),
);
check(
  'pubblicazione dell’avviso di interpello non è un atto',
  false,
  eAttoConcluso('Pubblicazione dell’avviso di interpello n. 12/2026'),
);
check('titolo neutro: nessun giudizio', false, eAttoConcluso('Sciopero del personale scolastico'));
check('titolo vuoto: nessun giudizio', false, eAttoConcluso('   '));
check('titolo non stringa: nessun giudizio', false, eAttoConcluso(null));

/* ---------------------- 3) PAGINE INFORMATIVE/DI SERVIZIO ---------------- */

console.log('\n— 3. La pagina che spiega non è la pagina che recluta —');
const MAD = 'Messa a disposizione: come inviare la propria candidatura all’istituto';
check('MAD spiegata, senza scadenza né classe → servizio', true, ePaginaServizio({ titolo: MAD }));
check(
  'stessa pagina CON una scadenza → resta (è un bando)',
  null,
  motivoPaginaServizio({ titolo: MAD, scadenza: '2026-11-12' }),
);
check(
  'stessa pagina CON una classe → resta',
  null,
  motivoPaginaServizio({ titolo: MAD, classi: ['A022'] }),
);
check('classe vuota non salva la pagina', true, ePaginaServizio({ titolo: MAD, classi: ['  '] }));
check(
  'modalità di presentazione delle domande → servizio',
  true,
  ePaginaServizio({
    titolo: 'Modalità di presentazione delle domande',
    testo: 'Le istanze si inviano via PEC.',
  }),
);
check('FAQ → servizio', true, ePaginaServizio({ titolo: 'FAQ interpelli e supplenze' }));
check(
  'bando ordinario senza scadenza → NESSUNA accusa',
  null,
  motivoPaginaServizio({ titolo: 'Avviso di selezione per esperto PCTO — I.C. Manzoni' }),
);
check(
  'il motivo dichiara la causa',
  true,
  /pagina informativa\/di servizio/.test(motivoPaginaServizio({ titolo: MAD }) ?? ''),
);

/* ------------------------ 4) CABLAGGIO NELLA BACHECA --------------------- */

console.log('\n— 4. La conformità dell’opportunità usa le due regole —');
check(
  'esiti → messaggio storico, invariato',
  "atto informativo/esito (non un'opportunità aperta)",
  motivoScartoOpportunita(
    { title: 'Esiti procedura di selezione di n. 14 unità di personale ATA' },
    OGGI,
  ),
);
check(
  'nomina individuale → fuori',
  "atto informativo/esito (non un'opportunità aperta)",
  motivoScartoOpportunita({ title: 'Nomina supplente A022 — I.C. Cuneo' }, OGGI),
);
check(
  'pagina di servizio → fuori, col motivo dichiarato',
  true,
  (motivoScartoOpportunita({ title: MAD }, OGGI) ?? '').includes('pagina informativa/di servizio'),
);
check(
  'interpello vero → ammesso',
  null,
  motivoScartoOpportunita(
    { title: 'Interpello supplenza A-022 da graduatorie di istituto', classCodes: ['A022'] },
    OGGI,
  ),
);
check(
  'eTitoloInformativo delega alla regola unica',
  true,
  eTitoloInformativo('Nomina supplente A022 — I.C. Cuneo'),
);

/* ---------------------- 5) PUREZZA, DIMENSIONE, CATENA ------------------ */

console.log('\n— 5. Moduli puri, brevi, e in catena —');
for (const percorso of ['src/scraper/attiConclusi.ts', 'src/scraper/paginaServizio.ts']) {
  const sorgente = leggi(percorso);
  const codice = sorgente
    .split('\n')
    .filter((riga) => !riga.trim().startsWith('//') && !riga.trim().startsWith('*'))
    .join('\n');
  const nome = percorso.split('/').pop();
  check(`${nome}: nessuna rete`, false, /\bfetch\(|axios/i.test(codice));
  check(`${nome}: nessun node:* (gira anche nel browser)`, false, /from\s+'node:/i.test(codice));
  check(`${nome}: nessun database`, false, /supabase/i.test(codice));
  check(`${nome}: sotto 250 righe`, true, sorgente.split('\n').length <= 250);
}

const qualita = leggi('src/scraper/qualitaOpportunita.ts');
check('la conformità importa gli atti conclusi', true, /from '\.\/attiConclusi\.ts'/.test(qualita));
check('la conformità importa le pagine di servizio', true, /from '\.\/paginaServizio\.ts'/.test(qualita));
check('una sola verità: niente copia locale della regex', false, /RE_TITOLO_INFORMATIVO/.test(qualita));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:purghe-ingestione' in pkg.scripts);
check('guardia nella catena', true, (pkg.scripts.test ?? '').includes('scripts/test-purghe-ingestione.ts'));

console.log(
  errori === 0
    ? "\n✅ PURGHE D'INGESTIONE: l'albo non è la bacheca."
    : `\n❌ PURGHE D'INGESTIONE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

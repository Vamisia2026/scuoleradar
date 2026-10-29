/**
 * Test — PULIZIA PRE-PUBBLICAZIONE di `interpelli` (`scripts/lib/puliziaInterpelli.ts`).
 *
 * Direttiva cliente 22/10/2026: sul tabellone NON devono esistere link morti.
 * La regola è pura e vive in `scripts/lib/puliziaInterpelli.ts`; lo script
 * (`pulisci-dati-non-verificati.ts`) si limita a leggere, misurare e scrivere.
 * La guardia fissa:
 *   1. il SITO ISTITUZIONALE: `school_site` normalizzato all'host `.edu.it`,
 *      riempito dall'anagrafica MIM quando manca, mai inventato;
 *   2. il LINK: 404/410 o nessuna risposta → home ufficiale, altrimenti riga fuori;
 *      un link NON controllato resta (nessuna cancellazione per un controllo mancato);
 *   3. il NOME fittizio riportato a `NULL` (sigle di classe, «VISUALIZZA INTERPELLI»);
 *   4. l'ALLARME: oltre il 30% di scarti il piano si dichiara sospetto e lo script
 *      non applica nulla (probabile guasto di rete nostro);
 *   5. il cablaggio in `npm test`.
 *
 * Uso: npm run test:pulizia-interpelli  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { costruisciMappaDomini } from '../src/lib/dominiScuola.ts';
import type { EsitoPingLink } from '../src/lib/validitaLink.ts';
import {
  MINIMO_SCARTI_ALLARME,
  SOGLIA_SCARTI,
  costruisciPianoPulizia,
  descriviPiano,
  nomeScuolaDaAzzerare,
  type RigaPulizia,
} from './lib/puliziaInterpelli.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const AVVISO = 'https://www.iccarducci.edu.it/albo/avviso-1.pdf';
const HOME = 'https://iccarducci.edu.it';
/** Codice nel formato MIM: 2 lettere provincia + 2 tipo + 5 cifre + 1 controllo. */
const CODICE = 'RMIC815007';
const mappa = costruisciMappaDomini([{ codice: CODICE, sito: HOME }]);

/* ---------------- 1) IL NOME FITTIZIO ---------------- */

console.log('— 1. Nomi che non sono un istituto —');
check('sigla di classe', true, nomeScuolaDaAzzerare('EEEE'));
check('sigle accostate', true, nomeScuolaDaAzzerare('ADEE | EEEE'));
check('etichetta di pagina', true, nomeScuolaDaAzzerare('VISUALIZZA INTERPELLI'));
check('istituto vero', false, nomeScuolaDaAzzerare('I.C. Giosuè Carducci'));
check('istituto vero (lungo)', false, nomeScuolaDaAzzerare('Liceo Scientifico A. Monti'));
check('assente', false, nomeScuolaDaAzzerare(null));
check('vuoto', false, nomeScuolaDaAzzerare('   '));

/* ---------------- 2) IL SITO ISTITUZIONALE ---------------- */

console.log('\n— 2. `school_site`: host ufficiale, mai inventato —');
const sitoDaMappa = costruisciPianoPulizia(
  [{ id: 'a', school_code: 'RMIC815007', source_url: AVVISO }],
  { mappa, esiti: new Map<string, EsitoPingLink>([[AVVISO, { status: 200 }]]) },
);
check(
  'sito mancante riempito dall’anagrafica MIM',
  { school_site: 'iccarducci.edu.it' },
  sitoDaMappa.aggiorna[0]?.patch,
);
const sitoNormalizzato = costruisciPianoPulizia(
  [{ id: 'b', school_site: 'https://www.iccarducci.edu.it/avvisi?x=1', source_url: AVVISO }],
  { mappa },
);
check(
  'sito con percorso normalizzato all’host',
  { school_site: 'iccarducci.edu.it' },
  sitoNormalizzato.aggiorna[0]?.patch,
);
const sitoGiaOk = costruisciPianoPulizia([{ id: 'c', school_site: 'iccarducci.edu.it' }], { mappa });
check('sito già corretto: nessuna scrittura', 0, sitoGiaOk.aggiorna.length);
check('sito già corretto: conteggiato come presente', 1, sitoGiaOk.conteggi.sitoPresente);
const sitoSconosciuto = costruisciPianoPulizia([{ id: 'd', school_code: 'XXIC000000' }], { mappa });
check('codice sconosciuto: nessun sito inventato', 0, sitoSconosciuto.aggiorna.length);
check('codice sconosciuto: conteggiato come assente', 1, sitoSconosciuto.conteggi.sitoAssente);


/* ---------------- 3) IL LINK ---------------- */

console.log('\n— 3. Link: avviso vivo, home ufficiale, oppure riga fuori —');
const mortoConHome = costruisciPianoPulizia(
  [{ id: 'e', school_site: 'iccarducci.edu.it', source_url: AVVISO }],
  { mappa, esiti: new Map([[AVVISO, { status: 404 }]]) },
);
check(
  '404 + home → si pubblica la home (`source_url` riscritto)',
  HOME,
  mortoConHome.aggiorna[0]?.patch.source_url,
);
check('404 + home → nessuna cancellazione', 0, mortoConHome.cancella.length);
check('404 + home → conteggiato come sostituito', 1, mortoConHome.conteggi.linkSostituiti);

const mortoSenzaHome = costruisciPianoPulizia(
  [{ id: 'f', source_url: AVVISO }],
  { esiti: new Map([[AVVISO, { status: 410 }]]) },
);
check('410 senza home → riga fuori', 1, mortoSenzaHome.cancella.length);
check(
  '410 senza home → il motivo è dichiarato',
  true,
  (mortoSenzaHome.cancella[0]?.motivo ?? '').includes('nessuna home'),
);

const nonControllato = costruisciPianoPulizia([{ id: 'g', source_url: AVVISO }], { mappa });
check('link non controllato → la riga resta', 0, nonControllato.cancella.length);
check('link non controllato → conteggiato', 1, nonControllato.conteggi.linkNonVerificati);

const bloccato = costruisciPianoPulizia(
  [{ id: 'h', source_url: AVVISO }],
  { esiti: new Map([[AVVISO, { status: 403 }]]) },
);
check('403 anti-bot → la riga resta', 0, bloccato.cancella.length);
check('403 anti-bot → conteggiato come tenuto', 1, bloccato.conteggi.linkTenuti);

const vivo = costruisciPianoPulizia(
  [{ id: 'i', source_url: AVVISO }],
  { esiti: new Map([[AVVISO, { status: 200 }]]) },
);
check('link vivo → nessuna modifica', 0, vivo.aggiorna.length);
check('link vivo → nessuna cancellazione', 0, vivo.cancella.length);
check('link vivo → contato', 1, vivo.conteggi.linkControllati);

/* ---------------- 4) L'ALLARME SULLA RETE ---------------- */

console.log('\n— 4. Allarme: troppi link morti in un run —');
const righeMorte: RigaPulizia[] = Array.from({ length: MINIMO_SCARTI_ALLARME }, (_, i) => ({
  id: `m${i}`,
  source_url: `https://www.iccarducci.edu.it/albo/avviso-${i}.pdf`,
}));
const esitiMorti = new Map(
  righeMorte.map((r) => [r.source_url ?? '', { status: 404 }] as [string, EsitoPingLink]),
);
const allarme = costruisciPianoPulizia(righeMorte, { esiti: esitiMorti });
check('scarti sopra soglia → allarme', true, allarme.allarme.troppiScarti);
check('soglia dichiarata', SOGLIA_SCARTI, allarme.allarme.soglia);
check('il report dichiara l’allarme', true, descriviPiano(allarme).includes('⚠'));
const sano = costruisciPianoPulizia(
  [{ id: 'z', source_url: AVVISO }],
  { esiti: new Map([[AVVISO, { status: 404 }]]) },
);
check('un solo scarto → nessun allarme', false, sano.allarme.troppiScarti);
check('il report senza allarme non allarma', false, descriviPiano(sano).includes('⚠'));

/* ---------------- 5) IL CABLAGGIO ---------------- */

console.log('\n— 5. Cablaggio: script dedicato e catena di `npm test` —');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:pulizia-interpelli' in pkg.scripts);
check(
  'guardia nella catena di `npm test`',
  true,
  (pkg.scripts.test ?? '').includes('scripts/test-pulizia-interpelli.ts'),
);
check('comando di pulizia', 'tsx scripts/pulisci-dati-non-verificati.ts', pkg.scripts['dati:pulisci']);

console.log(
  errori === 0
    ? '\n✅ PULIZIA INTERPELLI: sito ufficiale, link verificato prima della bacheca.'
    : `\n❌ PULIZIA INTERPELLI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

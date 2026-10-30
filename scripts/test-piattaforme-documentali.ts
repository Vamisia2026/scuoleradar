/**
 * TEST — PIATTAFORME DOCUMENTALI, CAMPI DEL DOCUMENTO E VICOLO CIECO (§26.96).
 *
 * Perché serve: la direttiva del 27/10/2026 chiede tre cose che finora nessuna
 * guardia copriva:
 *   1. una tabella d'albo può linkare SOLO il PDF su un gestore documentale
 *      (Gecodoc, Argo, Nuvola/Spaggiari): quel file è l'avviso, la home della
 *      piattaforma resta un login → `eAllegatoPiattaforma` deve dire l'una e
 *      l'altra cosa, senza falsi positivi (`notgecodoc.it`, `.edu.it/argo/…`);
 *   2. i cinque campi si leggono DENTRO il documento — classe di concorso,
 *      scuola/codice meccanografico, provincia, scadenza DICHIARATA, recapiti —
 *      con le stesse regole di `lib/scadenzaTesto` e del catalogo province;
 *   3. una bacheca di piattaforma senza avvisi non è un vicolo cieco: dal
 *      codice meccanografico dell'URL si risale alla scuola, e senza codice NON
 *      si indovina nulla.
 *
 * Uso: npm run test:piattaforme-documentali  (incluso in `npm test`)
 */
import { readFileSync } from 'node:fs';
import {
  eAllegatoPiattaforma,
  eFileDocumento,
  piattaformaAllegato,
  urlDocumentoInHtml,
} from '../src/scraper/allegatiPiattaforma.ts';
import {
  campiDaDocumento,
  codiceMeccanograficoDaTesto,
  recapitiDaTesto,
} from '../src/scraper/campiDocumento.ts';
import {
  bachecaSenzaAvvisi,
  codiceDaUrlPiattaforma,
  meritaFallback,
} from '../src/scraper/fallbackPiattaforma.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(
    `${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`,
  );
}

const leggi = (p: string): string => readFileSync(p, 'utf8');

/* --------------------- 1) COSA È UN DOCUMENTO, COSA NO ------------------- */

console.log('\n— 1. Un file è un documento; una pagina di albo no —');
check('PDF della scuola', true, eFileDocumento('https://www.icmanzoni.edu.it/albo/interpello-a022.pdf'));
check('PDF in maiuscolo', true, eFileDocumento('https://GECODOC.it/AVVISO.PDF'));
check('PDF firmato (.p7m)', true, eFileDocumento('https://web.spaggiari.eu/documenti/avviso.pdf.p7m'));
check('endpoint di un gestore documentale', true, eFileDocumento('https://rmic81200p.gecodoc.it/documento/1234'));
check('viewer che porta il PDF in query', true, eFileDocumento('https://docs.google.com/viewer?url=https://x.it/a.pdf&embedded=true'));
check('pagina d’albo (niente documento)', false, eFileDocumento('https://www.icmanzoni.edu.it/albo/'));
check('home della piattaforma', false, eFileDocumento('https://web.spaggiari.eu/home/app.wp'));
check('stringa vuota / non URL', [false, false], [eFileDocumento(''), eFileDocumento('avviso')]);

/* -------------------- 2) ALLEGATO SU PIATTAFORMA (O NO) ------------------ */

console.log('\n— 2. Solo un FILE su una piattaforma documentale scavalca le regole —');
check('Gecodoc: il PDF è un allegato', 'gecodoc', piattaformaAllegato('https://rmic81200p.gecodoc.it/documento/1234')?.id);
check('Argo: il PDF è un allegato', 'portaleargo', piattaformaAllegato('https://www.portaleargo.it/argoweb/allegati/avviso.pdf')?.id);
check('Nuvola/Spaggiari: il PDF è un allegato', 'nuvola', piattaformaAllegato('https://nuvola.madisoft.it/avviso-a022.pdf')?.id);
check('Gecodoc: la HOME non è un allegato', false, eAllegatoPiattaforma('https://www.gecodoc.it/'));
check('Argo: il login non è un allegato', false, eAllegatoPiattaforma('https://www.portaleargo.it/argoweb/login'));
check('PDF su un sito di scuola: nessuna piattaforma', false, eAllegatoPiattaforma('https://www.icmanzoni.edu.it/albo/a022.pdf'));
check('dominio che CONTIENE «gecodoc»', false, eAllegatoPiattaforma('https://notgecodoc.it/albo/a022.pdf'));

/* ------------------- 3) IL PDF DENTRO LA PAGINA CONTENITORE -------------- */

console.log('\n— 3. Viewer della piattaforma: si trova il PDF scritto nell’HTML —');
const VIEWER = `<html><body><iframe src="/viewer/avviso-a022.pdf#page=1"></iframe></body></html>`;
check(
  'iframe relativo → URL assoluto',
  ['https://rmic81200p.gecodoc.it/viewer/avviso-a022.pdf'],
  urlDocumentoInHtml(VIEWER, 'https://rmic81200p.gecodoc.it/documento/1234', 1),
);
const ANCORA = `<div><a href="/albo/">Albo</a><a href="/documento/99">Apri</a></div>`;
check(
  'primo link a un documento (anche senza estensione)',
  ['https://www.gecodoc.it/documento/99'],
  urlDocumentoInHtml(ANCORA, 'https://www.gecodoc.it/albo/', 1),
);
check('pagina senza documenti', [], urlDocumentoInHtml('<p>Nessun allegato</p>', 'https://x.it/a', 1));
check('base non valida', [], urlDocumentoInHtml(ANCORA, 'non-un-url', 1));

/* ------------------- 4) I CINQUE CAMPI DENTRO IL DOCUMENTO -------------- */

console.log('\n— 4. Classe, codice, provincia, scadenza e recapiti dal documento —');
// Testo come lo restituisce `estraiTestoPdf` su un avviso vero (righe spezzate).
const DOCUMENTO = `ISTITUTO COMPRENSIVO "G. MARCONI" - AREZZO
Codice meccanografico: ARIC81200P     C.F. 80012345678
Oggetto: interpello per supplenza classe di concorso A022 - Italiano
Le domande vanno presentate entro le ore 12:00 del 12/11/2026
PEC: aric81200p@pec.istruzione.it    PEO: segreteria@icmarconi.edu.it
Telefono 0575 123456`;

check('codice meccanografico certificato', 'ARIC81200P', codiceMeccanograficoDaTesto(DOCUMENTO));
check(
  'provincia dal codice (mai da un elenco di città)',
  'AR',
  campiDaDocumento(DOCUMENTO).provincia,
);
check(
  'provincia assente senza codice',
  null,
  campiDaDocumento('Interpello entro il 12/11/2026, nessun codice').provincia,
);
check(
  'codice con provincia inesistente → null',
  null,
  codiceMeccanograficoDaTesto('Codice ZZIC81200P del 10/11/2026'),
);
const campi = campiDaDocumento(DOCUMENTO);
check(
  'classe di concorso A022 letta nel documento',
  true,
  campi.classi.some((c) => /^A-?0?22$/.test(c)),
);
check('scadenza DICHIARATA («entro … del»)', '2026-11-12', campi.scadenza);
check(
  'data di pubblicazione: NESSUNA scadenza inventata',
  null,
  campiDaDocumento('Avviso pubblicato il 10/11/2026 — prot. 1234').scadenza,
);
check('denominazione dell’istituto', true, /MARCONI/.test(campi.scuola ?? ''));

console.log('\n— 4b. Recapiti per «Radar Personale» —');
const recapiti = recapitiDaTesto(DOCUMENTO);
check('PEC riconosciuta dall’etichetta', ['aric81200p@pec.istruzione.it'], recapiti.pec);
check('posta ordinaria separata', ['segreteria@icmarconi.edu.it'], recapiti.email);
check('telefono del documento', true, recapiti.telefoni.some((t) => /0575/.test(t)));
check(
  'PEC riconosciuta dal dominio (senza etichetta)',
  ['protocollo@pec.cgn.legalmail.it'],
  recapitiDaTesto('scrivere a protocollo@pec.cgn.legalmail.it').pec,
);
check('nessun recapito dichiarato', { email: [], pec: [], telefoni: [] }, recapitiDaTesto('Nessun contatto'));

/* ------------------ 5) VICOLO CIECO: CODICE NELL'URL --------------------- */

console.log('\n— 5. Il codice meccanografico scritto nell’URL della piattaforma —');
check(
  'sottodominio Gecodoc',
  'ARIC81200P',
  codiceDaUrlPiattaforma('https://aric81200p.gecodoc.it/albo'),
);
check(
  'parametro della bacheca Argo',
  'ARIC81200P',
  codiceDaUrlPiattaforma('https://www.portaleargo.it/argoweb/login?scuola=ARIC81200P'),
);
check('Spaggiari senza codice: null', null, codiceDaUrlPiattaforma('https://web.spaggiari.eu/home/app.wp'));
check('codice con provincia inesistente: null', null, codiceDaUrlPiattaforma('https://zzic81200p.gecodoc.it/x'));

console.log('\n— 5b. Bacheca vuota e decisione del fallback —');
check('muro di login', true, bachecaSenzaAvvisi('<h1>Accedi al portale</h1><p>Inserisci le credenziali</p>'));
check('archivio dichiarato vuoto', true, bachecaSenzaAvvisi('<p>Non ci sono avvisi pubblicati</p>'));
check('bacheca piena non è un vicolo cieco', false, bachecaSenzaAvvisi('<ul><li>Interpello A022</li></ul>'));
check('HTML vuoto', true, bachecaSenzaAvvisi('   '));

const vicoloCieco = meritaFallback('https://aric81200p.gecodoc.it/albo', '<p>Nessun avviso</p>', 0);
check('piattaforma + bacheca vuota + codice → fallback', true, vicoloCieco.attivo);
check('codice da rileggere', 'ARIC81200P', vicoloCieco.codice);
const conAvvisi = meritaFallback('https://aric81200p.gecodoc.it/albo', '<p>Nessun avviso</p>', 3);
check('bacheca che pubblica avvisi → nessun fallback', false, conAvvisi.attivo);
const senzaCodice = meritaFallback('https://web.spaggiari.eu/home/app.wp', '', 0);
check('senza codice non si indovina la scuola', false, senzaCodice.attivo);
check(
  'motivo dichiarato',
  'bacheca vuota o muro di login: nessun codice meccanografico',
  senzaCodice.motivo,
);
const nonPiattaforma = meritaFallback('https://www.icmanzoni.edu.it/albo/', '', 0);
check('un sito di scuola non è una piattaforma', false, nonPiattaforma.attivo);

/* --------------------- 6) PUREZZA, DIMENSIONI, CABLAGGIO ---------------- */

console.log('\n— 6. Moduli puri, sotto le 250 righe, usati dal runner —');
const allegati = leggi('src/scraper/allegatiPiattaforma.ts');
const campiSorgente = leggi('src/scraper/campiDocumento.ts');
const fallbackSorgente = leggi('src/scraper/fallbackPiattaforma.ts');
for (const [nome, sorgente] of [
  ['allegatiPiattaforma', allegati],
  ['campiDocumento', campiSorgente],
  ['fallbackPiattaforma', fallbackSorgente],
] as const) {
  check(`${nome}: nessun database`, false, /supabase/i.test(sorgente));
  check(`${nome}: nessuna rete`, false, /\bfetch\s*\(/.test(sorgente));
  check(`${nome}: sotto 250 righe`, true, sorgente.split('\n').length <= 250);
}
check('la piattaforma si riconosce dall’elenco UNICO', true, /from '\.\.\/lib\/piattaformeLink\.ts'/.test(allegati));

const linkScuola = leggi('src/scraper/linkScuola.ts');
check('allegati di piattaforma ammessi nell’albo', true, /eAllegatoPiattaforma\(/.test(linkScuola));
check('linkScuola sotto 250 righe', true, linkScuola.split('\n').length <= 250);

const reporter = leggi('scripts/table-reporter.ts');
check(
  'il runner legge i campi del documento',
  true,
  // §26.115 — la facciata è `datiBandoDaTesto` (che delega a `campiDocumento`).
  /campiDaDocumento\(|datiBandoDaTesto\(/.test(reporter),
);
check('il runner legge il PDF dentro il viewer', true, /urlDocumentoInHtml\(/.test(reporter));
check('il runner usa la decisione di fallback', true, /meritaFallback\(/.test(reporter));
check('fallback chiamato su un target senza avvisi', true, /recuperaDaBachecaPiattaforma\(target\)/.test(reporter));
check('la bacheca vuota diventa un albo in coda', true, /promuoviPaginaAlbo\(pagina\.url, scuola\)/.test(reporter));
// §26.96 — la TABELLA d'albo (Arezzo/Gecodoc) non si ferma alla riga: se la
// scadenza non è nella cella, si legge il documento linkato, con un tetto.
check(
  'riga di tabella senza scadenza → documento letto',
  true,
  /await leggiAvvisoCompleto\(esito\.link/.test(reporter),
);
check('tetto dei documenti letti per pagina', true, /MAX_DOCUMENTI_UST/.test(reporter));
check('classi del documento nella riga di tabella', true, /class_code: classi\[0\]/.test(reporter));

const pkg = JSON.parse(leggi('package.json')) as { scripts: Record<string, string> };
check('script dedicato', true, 'test:piattaforme-documentali' in pkg.scripts);
check(
  'guardia nella catena',
  true,
  (pkg.scripts.test ?? '').includes('scripts/test-piattaforme-documentali.ts'),
);

console.log(
  errori === 0
    ? '\n✅ PIATTAFORME DOCUMENTALI: il PDF è l’avviso, il login no.'
    : `\n❌ PIATTAFORME DOCUMENTALI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


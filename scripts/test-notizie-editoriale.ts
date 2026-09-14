/**
 * Verifica il MOTORE EDITORIALE delle Notizie (taglio giornalistico):
 *  · la burocrazia vuota (soli riferimenti d'atto) NON si pubblica;
 *  · i titoli-lista ("Concorso", "Avviso") NON diventano notizie;
 *  · il materiale d'archivio (riferimenti solo a vecchi anni) resta fuori;
 *  · le notizie di IMPATTO (welfare, formazione, sicurezza…) passano;
 *  · `titoloAzione` riscrive i titoli in chiave AZIONE;
 *  · l'archivio pubblicato non contiene titoli burocratici o pigri.
 *
 * Uso: npm run test:notizie-editoriale
 */
import { readFileSync } from 'node:fs';
import {
  attoBurocraticoVuoto,
  classificaLink,
  generaArticoloEditoriale,
  linkDirettoUfficiale,
  linkNonValidiInHtml,
  linkVietatiInHtml,
  riferimentiObsoleti,
  titoloAzione,
  titoloInformativo,
  valutaRilevanza,
} from '../src/departments/notizie/services/relevanceEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Burocrazia vuota: i soli riferimenti d’atto NON si pubblicano —');
check('Decreto Direttoriale n. 1095', true, attoBurocraticoVuoto('Decreto Direttoriale n. 1095 del 10 settembre 2026'));
check('Ordinanza Ministeriale n. 163', true, attoBurocraticoVuoto('Ordinanza Ministeriale n. 163 del 7 agosto 2026'));
check('Decreto Ministeriale n. 179', true, attoBurocraticoVuoto('Decreto Ministeriale n. 179 del 2 settembre 2026'));
check(
  'decreto CON contenuto non è “vuoto”',
  false,
  attoBurocraticoVuoto('Decreto assegnazione comandi personale ATA anno 2026-2027'),
);
check(
  'titolo normale non è “vuoto”',
  false,
  attoBurocraticoVuoto('Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi'),
);
check(
  'atto respinto dal gate',
  false,
  valutaRilevanza({ title: 'Decreto Direttoriale n. 1095 del 10 settembre 2026' }).rilevante,
);
check(
  'ordinanza respinta dal gate',
  false,
  valutaRilevanza({ title: 'Ordinanza Ministeriale n. 163 del 7 agosto 2026' }).rilevante,
);

console.log('\n— Titoli pigri e materiale d’archivio —');
check('titolo "Concorso" NON informativo', false, titoloInformativo('Concorso'));
check('titolo "Avviso" NON informativo', false, titoloInformativo('Avviso'));
check(
  'titolo descrittivo informativo',
  true,
  titoloInformativo('Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi'),
);
check('titolo "Concorso" respinto', false, valutaRilevanza({ title: 'Concorso' }).rilevante);
check(
  'avviso 2020 (senza fonte recente) obsoleto',
  true,
  riferimentiObsoleti("Avviso n. 33 del 06/07/2020 per l'assegnazione delle risorse", null),
);
check(
  'contratto con fonte 2026 NON obsoleto',
  false,
  riferimentiObsoleti('CONTRATTO COLLETTIVO … TRIENNIO 2022-2024', '2026-08-06'),
);
check(
  'avviso 2020 respinto dal gate',
  false,
  valutaRilevanza({ title: "Avviso n. 33 del 06/07/2020 per l'assegnazione delle risorse di cui al DM 18/2020" })
    .rilevante,
);

console.log('\n— Notizie di IMPATTO: passano —');
check(
  'welfare/polizza personale AMMESSA',
  true,
  valutaRilevanza({
    title:
      'Welfare per il personale della scuola. Parte la polizza sanitaria: interessati oltre un milione e duecentomila dipendenti',
    data: '2026-09-10',
  }).rilevante,
);
check(
  'formazione personale ATA AMMESSA',
  true,
  valutaRilevanza({
    title: 'MIMeraviglIA: formazione per il personale ATA e per i dirigenti scolastici',
    data: '2026-09-10',
  }).rilevante,
);
check(
  'memorandum/diplomazia RESPINTO',
  false,
  valutaRilevanza({
    title: "Scuola, Italia-Argentina: firmano Memorandum d'Intesa. Il Ministro: «Più opportunità»",
    data: '2026-09-10',
  }).rilevante,
);

console.log('\n— Titoli AZIONE (niente copia-incolla istituzionale) —');
const casiTitolo: Array<{ input: string; cat?: string; deadline?: string | null; atteso: string }> = [
  {
    input: 'Decreto Direttoriale n. 1095 del 10 settembre 2026 – Assegnazione comandi personale ATA',
    atteso: 'Assegnazione comandi personale ATA',
  },
  {
    input: "Aggiornamento Graduatorie Provinciali per le Supplenze (GPS) 2026/28: Pubblicazione dell'Ordinanza Ministeriale",
    cat: 'GPS',
    atteso: 'Aggiornamento Graduatorie Provinciali per le Supplenze (GPS) 2026/28',
  },
  {
    input: 'Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi',
    cat: 'GPS',
    atteso: 'Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi',
  },
  {
    input: 'Rinnovo contratti scuola: termine di presentazione delle domande',
    cat: 'CCNL',
    deadline: '2026-10-05',
    atteso: 'Rinnovo contratti scuola: termine di presentazione delle domande — domande entro il 5 ott',
  },
];
for (const c of casiTitolo) {
  check(`titoloAzione("${c.input.slice(0, 45)}…")`, c.atteso, titoloAzione(c.input, c.cat, c.deadline ?? null));
}
check(
  'mai il titolo vuoto',
  true,
  titoloAzione('Decreto n. 1 del 1 gennaio 2026 –', 'Scuole', null).length > 0,
);

console.log('\n— Invariante sull’archivio pubblicato —');
const archivio = readFileSync('src/departments/notizie/data/notizieIngestite.ts', 'utf8');
const titoli = [...archivio.matchAll(/"title": "((?:[^"\\]|\\.)*)"/g)].map((m) =>
  m[1].replace(/\\"/g, '"').replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))),
);
check('archivio non vuoto', true, titoli.length > 0);
const burocratici = titoli.filter((t) => attoBurocraticoVuoto(t));
check('nessun titolo di burocrazia vuota', [], burocratici);
const pigri = titoli.filter((t) => !titoloInformativo(t));
check('nessun titolo pigro/non informativo', [], pigri);
const obsoleti = titoli.filter((t) => riferimentiObsoleti(t, null));
check('nessun titolo d’archivio obsoleto', [], obsoleti);

console.log('\n— LINK PUNTO-A-PUNTO: contenitori e indici VIETATI —');
const urlVietati = [
  'https://www.mim.gov.it/',
  'https://www.mim.gov.it/web/guest/notizie',
  'https://www.istruzione.it/polis/Istanzeonline.htm',
  'https://www.inpa.gov.it/',
  'https://www.inps.it/',
  'https://usrlombardia.istruzione.it/urp',
  'https://usrlombardia.istruzione.it/elenco-interpelli-2026/',
  'https://www.aranagenzia.it/atti/',
  'https://www.mim.gov.it/web/usr-lombardia/interpelli-ricerca-supplenti',
  'https://www.mim.gov.it/ricerca?q=supplenze',
  'https://www.mim.gov.it/web/guest/notizie/page/2',
  'https://www.mim.gov.it/albo-pretorio',
];
const ammessiMale = urlVietati.filter((u) => linkDirettoUfficiale(u).ok);
check('nessun contenitore/indice è "diretto"', [], ammessiMale);
// NEW POLICY: i contenitori NON bloccano più la notizia: sono tracciabili.
const classificati = urlVietati.filter((u) => classificaLink(u).classe !== 'contenitore');
check('i contenitori restano pubblicabili (classe "contenitore")', [], classificati);
check(
  'link mockup → classe "non-valido" (unico blocco)',
  'non-valido',
  classificaLink('https://example.com/avviso-123').classe,
);
check('link mancante → classe "non-valido"', 'non-valido', classificaLink(null).classe);

console.log('\n— LINK PUNTO-A-PUNTO: documenti specifici AMMESSI —');
const urlAmmessi = [
  'https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi',
  'https://www.mim.gov.it/web/guest/-/welfare-per-il-personale-della-scuola-parte-la-polizza-sanitaria',
  'https://www.aranagenzia.it/documento_pubblico/contratto-collettivo-nazionale-di-lavoro-relativo-al-personale-dellarea-istruzione-e-ricerca-triennio-2022-2024/',
  'https://www.gazzettaufficiale.it/atto/serie_generale/caricaDettaglioAtto/originario?atto.codiceRedazionale=26A00001',
  'https://usrlombardia.istruzione.it/albo/avviso-a022-manzoni.pdf',
];
const rifiutatiMale = urlAmmessi.filter((u) => !linkDirettoUfficiale(u).ok);
check('nessun documento specifico viene respinto', [], rifiutatiMale);
check(
  'link HTML a contenitore individuato nel testo',
  true,
  linkVietatiInHtml('<p>vedi <a href="https://www.mim.gov.it/web/guest/notizie">notizie</a></p>').length > 0,
);
check(
  'link HTML al documento specifico accettato',
  [],
  linkVietatiInHtml(
    '<p><a href="https://www.mim.gov.it/web/guest/-/calendario-delle-festivita-e-degli-esami-anno-scolastico-2026-2027">apri</a></p>',
  ),
);

console.log('\n— TONO: nessuna apertura burocratica, solo link diretti —');
const marcatore = 'notizieIngestite: NewsArticle[] = [';
const posArr = archivio.indexOf(marcatore);
const articoli = JSON.parse(
  archivio.slice(posArr + marcatore.length - 1, archivio.lastIndexOf(']') + 1),
) as Array<{
  id: string;
  title: string;
  content_html: string;
  official_source_url: string;
}>;
check('archivio leggibile come JSON', true, articoli.length > 0);
const aperturaVietata =
  /^(?:il ministero|il mim|il ministero dell|è stato pubblicato|la notizia riguarda|si comunica|si rende noto)/i;
const testoPar1 = (html: string) =>
  (html.match(/<p>([\s\S]*?)<\/p>/)?.[1] ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
const apertureBurocratiche = articoli
  .filter((a) => aperturaVietata.test(testoPar1(a.content_html)))
  .map((a) => a.id);
check('nessuna apertura istituzionale nel primo paragrafo', [], apertureBurocratiche);
check(
  'ogni articolo ha un link di fonte VALIDO (mail 0 senza fonte)',
  [],
  articoli.filter((a) => classificaLink(a.official_source_url).classe === 'non-valido').map((a) => a.id),
);
check(
  'nessun link NON VALIDO nel testo pubblicato',
  [],
  articoli.flatMap((a) => linkNonValidiInHtml(a.content_html)),
);
check(
  'ogni articolo contiene almeno il link ufficiale',
  [],
  articoli
    .filter((a) => !a.content_html.includes(`href="${a.official_source_url}"`))
    .map((a) => a.id),
);

console.log('\n— COPY AZIONE: generaArticoloEditoriale —');
const generato = generaArticoloEditoriale({
  title: 'Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi',
  categoria: 'GPS',
  deadline: '2099-12-31',
  fonte: 'MIM',
  official_url: 'https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi',
});
check(
  'apertura in chiave azione (nessun "Il Ministero")',
  false,
  /^\s*<p>\s*(?:Il Ministero|Il MIM)/i.test(generato.content_html),
);
check(
  'un solo URL nel testo: quello diretto',
  1,
  new Set([...generato.content_html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).size,
);
check(
  'scadenza futura presentata come invito all’azione',
  true,
  /Hai tempo fino al 31 dicembre 2099/.test(generato.content_html),
);
const generatoScaduto = generaArticoloEditoriale({
  title: 'Mobilità Dirigenti Scolastici, conferimento e mutamento incarichi per il 2026/27',
  categoria: 'Mobilità',
  deadline: '2020-07-01',
  fonte: 'MIM',
  official_url: 'https://www.mim.gov.it/web/guest/-/mobilita-dirigenti-scolastici-2026-27-domanda-online',
});
check(
  'scadenza passata: nessun invito all’azione fuorviante',
  true,
  /Il termine indicato era il 1 luglio 2020/.test(generatoScaduto.content_html),
);
const senzaLink = generaArticoloEditoriale({
  title: 'Concorso ordinario 2026: prova scritta e requisiti',
  categoria: 'Concorsi',
  deadline: null,
  fonte: 'MIM',
  official_url: 'https://www.mim.gov.it/web/guest/notizie',
});
check(
  'fonte = pagina/elenco → link presente con etichetta onesta',
  true,
  senzaLink.content_html.includes('href="https://www.mim.gov.it/web/guest/notizie"') &&
    senzaLink.content_html.includes('apri la pagina ufficiale della fonte'),
);
const conMock = generaArticoloEditoriale({
  title: 'Concorso ordinario 2026: prova scritta e requisiti',
  categoria: 'Concorsi',
  deadline: null,
  fonte: 'MIM',
  official_url: 'https://example.com/avviso-123',
});
check('link NON valido (mockup) → nessun link nel testo', false, conMock.content_html.includes('href="'));

console.log(
  errori === 0
    ? '\n✅ NOTIZIE EDITORIALE: nessun problema'
    : `\n❌ NOTIZIE EDITORIALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


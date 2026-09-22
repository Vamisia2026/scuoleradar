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
  classificaTemaPersonale,
  contieneFraseFluff,
  espandiAcronimi,
  generaArticoloEditoriale,
  linkDirettoUfficiale,
  linkDomandaUfficiale,
  linkNonValidiInHtml,
  linkVietatiInHtml,
  richiedePresentazioneDomanda,
  riferimentiObsoleti,
  titoloAzione,
  titoloDaUfficioStampa,
  titoloInformativo,
  valutaRilevanza,
  verificaCadenzaSettimanale,
} from '../src/departments/notizie/services/relevanceEngine.ts';
import type { NewsArticle } from '../src/departments/notizie/types.ts';

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
    atteso: 'Assegnazione comandi personale ATA (personale Amministrativo, Tecnico e Ausiliario)',
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
  /Il termine indicato nell['’]avviso era il 1 luglio 2020|Il termine dell['’]avviso era il 1 luglio 2020/.test(
    generatoScaduto.content_html,
  ),
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

console.log('\n— STANDARD STRETTO: niente fluff (comunicati, lettere, annunci politici) —');
const rifiutati = [
  'Lettera del Ministro dell’Istruzione e del Merito in occasione dell’avvio dell’anno scolastico',
  'Valditara: «Più fondi per fronteggiare l’emergenza caldo»',
  'Intervento del Ministro al seminario nazionale sulla didattica',
  'Ventesima edizione del concorso Juvenes Translatores 2026-2027 per le scuole',
  'Benessere a scuola: attivo "ascoltaMI", lo sportello di supporto psicologico',
];
for (const titolo of rifiutati) {
  check(
    `respinto: "${titolo.slice(0, 44)}…"`,
    false,
    valutaRilevanza({ title: titolo, data: '2026-09-18' }).rilevante,
  );
}
check(
  'lettera del Ministro classificata come ufficio stampa',
  true,
  titoloDaUfficioStampa('Lettera del Ministro dell’Istruzione e del Merito'),
);
const ammessi: Array<{ titolo: string; tema: string }> = [
  { titolo: 'Rinnovo CCNL scuola 2025-2027: firmata l’ipotesi di accordo sugli aumenti', tema: 'CCNL' },
  { titolo: 'Welfare per il personale della scuola: parte la polizza sanitaria', tema: 'Welfare' },
  { titolo: 'Mobilità docenti 2026/27: domande online entro il 20 settembre', tema: 'Mobilità' },
  { titolo: 'Interpelli e supplenze: nuove regole per la scelta delle sedi', tema: 'GPS' },
  { titolo: 'Pensioni docenti: riscatto della laurea, nuove modalità di domanda', tema: 'Pensioni' },
  { titolo: 'Organico di diritto 2026/27: cattedre e posti per la secondaria', tema: 'Organico' },
];
for (const caso of ammessi) {
  check(
    `ammesso (${caso.tema}): "${caso.titolo.slice(0, 40)}…"`,
    true,
    valutaRilevanza({ title: caso.titolo, data: '2026-09-18' }).rilevante,
  );
}
check('tema CCNL riconosciuto', 'CCNL', classificaTemaPersonale('Rinnovo del contratto collettivo: aumenti in busta paga'));
check('tema GPS riconosciuto', 'GPS', classificaTemaPersonale('Interpelli e supplenze: scelta delle sedi'));
check(
  'tema nullo sui contenuti di contorno',
  null,
  classificaTemaPersonale('Giornata nazionale dello sport a scuola: le foto della cerimonia'),
);

console.log('\n— TITOLI AZIONE: etichette da ufficio stampa eliminate —');
check(
  'via il "Comunicato stampa:"',
  'Interpelli: nuove regole per le supplenze',
  titoloAzione('Comunicato stampa: Interpelli: nuove regole per le supplenze', 'GPS', null),
);
check(
  'via il prefisso data + firma (rassegne)',
  false,
  /^\d{2}\/\d{2}\/\d{4}/.test(titoloAzione('05/09/2026 - Valditara: «Più fondi per la scuola»', 'Scuole', null)),
);
check(
  'acronimo spiegato nel titolo',
  true,
  /ATA \(personale Amministrativo, Tecnico e Ausiliario\)/.test(
    titoloAzione('Assegnazione comandi personale ATA per il 2026/27', 'Organico', null),
  ),
);

console.log('\n— ACRONIMI: spiegati alla prima occorrenza —');
const esame = espandiAcronimi(
  'Il MIM pubblica le GPS e il PNRR per il personale ATA. Il MIM conferma.',
);
check('MIM spiegato', true, esame.testo.includes('MIM (Ministero dell’Istruzione e del Merito)'));
check('GPS spiegato', true, esame.testo.includes('GPS (Graduatorie Provinciali per le Supplenze)'));
check('PNRR spiegato', true, esame.testo.includes('PNRR (Piano Nazionale di Ripresa e Resilienza)'));
check('ATA spiegato', true, esame.testo.includes('ATA (personale Amministrativo, Tecnico e Ausiliario)'));
check('MIM spiegato una sola volta', 1, (esame.testo.match(/MIM \(/g) ?? []).length);
check('sigle spiegate: 4', 4, esame.spiegati.length);

console.log('\n— SINTESI "IN SINTESI": solo fatti pratici —');
const conSintesi = generaArticoloEditoriale({
  title: 'Interpelli e supplenze: nuove regole per la scelta delle sedi',
  categoria: 'GPS',
  deadline: '2099-12-31',
  fonte: 'MIM',
  official_url: 'https://www.mim.gov.it/web/guest/-/interpelli-nuove-regole',
});
check('bullet "Cosa cambia"', true, conSintesi.summary_points[0].startsWith('Cosa cambia:'));
check('bullet "Chi riguarda"', true, conSintesi.summary_points[1].startsWith('Chi riguarda:'));
check('bullet "Scadenza"', true, conSintesi.summary_points[2].startsWith('Scadenza:'));
check('bullet "Cosa devi fare"', true, conSintesi.summary_points[3].startsWith('Cosa devi fare:'));
check(
  'nessun preambolo retorico nella sintesi',
  [],
  conSintesi.summary_points.filter((p) =>
    /^(?:il ministero|il mim|la notizia|si comunica|c’è una novità|vale la pena)/i.test(p),
  ),
);
check(
  'senza scadenza la sintesi resta di 3 bullet',
  3,
  generaArticoloEditoriale({
    title: 'Organico di diritto 2026/27: cattedre e posti per la secondaria',
    categoria: 'Organico',
    deadline: null,
    fonte: 'MIM',
    official_url: 'https://www.mim.gov.it/web/guest/-/organico-di-diritto-2026-27',
  }).summary_points.length,
);

console.log('\n— CADENZA SETTIMANALE: minimo 1, massimo 3 —');
const newsArticle = (id: string, data: string): NewsArticle => ({
  id,
  title: 'Organico di diritto 2026/27: cattedre e posti per la secondaria',
  category: 'Organico',
  deadline_date: null,
  summary_points: ['Cosa cambia: prova.'],
  content_html: '<p>prova</p>',
  official_source_url: 'https://www.mim.gov.it/web/guest/-/prova',
  official_pdf_url: null,
  relevance_score: 80,
  published_at: data,
});
const oggiCadenza = new Date('2026-09-21T12:00:00.000Z');
check('limite massimo esposto = 3', 3, verificaCadenzaSettimanale([], oggiCadenza).max);
check('1 articolo negli ultimi 7 giorni → ok', true, verificaCadenzaSettimanale([newsArticle('x1', '2026-09-20T00:00:00.000Z')], oggiCadenza).ok);
check('0 articoli → NON ok', false, verificaCadenzaSettimanale([], oggiCadenza).ok);
check(
  '4 articoli negli ultimi 7 giorni → NON ok',
  false,
  verificaCadenzaSettimanale(
    ['a', 'b', 'c', 'd'].map((id, i) => newsArticle(id, `2026-09-1${9 - i}T00:00:00.000Z`)),
    oggiCadenza,
  ).ok,
);

console.log('\n— ZERO FLUFF: nessuna promessa, nessun rinvio vago —');
const frasiVietate = [
  'La scadenza non è ancora pubblicata: ti avvisiamo appena esce.',
  "Scadenza ufficiale non ancora pubblicata: la trovi nell'avviso ufficiale — ti avvisiamo appena esce.",
  'Verifica apertura nel testo ufficiale.',
  'Il prossimo aggiornamento è in arrivo.',
];
for (const frase of frasiVietate) {
  check(`fluff rilevato: "${frase.slice(0, 42)}…"`, true, contieneFraseFluff(frase));
}
check(
  'testo operativo pulito',
  false,
  contieneFraseFluff('Hai tempo fino al 30 settembre: presenta la domanda da Istanze Online.'),
);

console.log('\n— DOMANDA + FONTE: doppio link diretto, sintesi azionabile —');
const conDomanda = generaArticoloEditoriale({
  title: 'Interpelli e supplenze: nuove regole per la scelta delle sedi',
  categoria: 'GPS',
  deadline: null,
  fonte: 'MIM',
  official_url: 'https://www.mim.gov.it/web/guest/-/interpelli-nuove-regole',
  application_url: 'https://www.istruzione.it/polis/Istanzeonline.htm',
  application_label: 'Istanze Online (POLIS)',
});
check('nessuna promessa nel testo generato', false, contieneFraseFluff(conDomanda.content_html));
check(
  'due link diretti: fonte + canale di presentazione',
  2,
  new Set([...conDomanda.content_html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])).size,
);
check(
  'il canale di presentazione è linkato',
  true,
  conDomanda.content_html.includes('https://www.istruzione.it/polis/Istanzeonline.htm'),
);
check(
  'bullet "Presenta la domanda" nella sintesi',
  true,
  conDomanda.summary_points.some((p) => p.startsWith('Presenta la domanda:')),
);
check(
  'canale riconosciuto dal testo',
  'https://www.istruzione.it/polis/Istanzeonline.htm',
  linkDomandaUfficiale('La domanda si presenta su Istanze Online con SPID.')?.url ?? null,
);
check('nessun canale in un testo generico', null, linkDomandaUfficiale('Sicurezza sui luoghi di lavoro: obblighi del datore.'));
check(
  'procedura da presentare riconosciuta',
  true,
  richiedePresentazioneDomanda('Presentazione delle domande entro il 30 settembre'),
);
check(
  'documento informativo senza procedura',
  false,
  richiedePresentazioneDomanda('Pubblicata la polizza sanitaria per il personale della scuola'),
);
check(
  'archivio senza frasi di fluff',
  [],
  articoli.filter((a) => contieneFraseFluff(`${a.title} ${a.content_html} ${a.summary_points.join(' ')}`)).map((a) => a.id),
);

console.log(
  errori === 0
    ? '\n✅ NOTIZIE EDITORIALE: nessun problema'
    : `\n❌ NOTIZIE EDITORIALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


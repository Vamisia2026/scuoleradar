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

console.log(
  errori === 0
    ? '\n✅ NOTIZIE EDITORIALE: nessun problema'
    : `\n❌ NOTIZIE EDITORIALE: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;


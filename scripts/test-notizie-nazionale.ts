/**
 * Verifica la POLICY NAZIONALE della sezione Notizie:
 *  · fonti: solo NAZIONALI accreditate (MIM, Gazzetta Ufficiale, ARAN…);
 *    le pagine regionali `/web/usr-*` sono respinte;
 *  · editoriale: atto nazionale numerato e recente AMESSO; cronaca di stampa,
 *    atto non recente e CCNL di altri comparti RESPINTI;
 *  · archivio: nessuna voce da fonte regionale/locale (invariante sui dati).
 *
 * Uso: npm run test:notizie-nazionale
 */
import { readFileSync } from 'node:fs';
import {
  èFonteNazionale,
  valutaRilevanza,
} from '../src/departments/notizie/services/relevanceEngine.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Perimetro NAZIONALE delle fonti —');
check('MIM nazionale', true, èFonteNazionale('https://www.mim.gov.it/web/guest/-/decreto-direttoriale-n-1095-del-10-settembre-2026'));
check('Gazzetta Ufficiale', true, èFonteNazionale('https://www.gazzettaufficiale.it/eli/id/2026/09/10/26G00178/sg'));
check('ARAN', true, èFonteNazionale('https://www.aranagenzia.it/documento_pubblico/contratto-collettivo-nazionale-di-lavoro-del-comparto-istruzione-e-ricerca-triennio-2022-2024/'));
check('Corte dei Conti', true, èFonteNazionale('https://www.corteconti.it/rss/notizie'));
check('pagina USR regionale RESPINTA', false, èFonteNazionale('https://www.mim.gov.it/web/usr-lombardia/calendario-scolastico-regionale'));
check('pagina USR Sardegna RESPINTA', false, èFonteNazionale('https://www.mim.gov.it/web/usr-sardegna/-/decreto-assegnazione-comandi-personale-ata-anno-2026-2027'));
check('dominio estraneo RESPINTO', false, èFonteNazionale('https://www.scuolainterpelli.it/interpelli-scuola-12-settembre-2026/'));

console.log('\n— Gate editoriale sugli ATTI NAZIONALI —');
const attoRecente = valutaRilevanza({
  title: 'Decreto Direttoriale n. 1095 del 10 settembre 2026',
  url: 'https://www.mim.gov.it/web/guest/-/decreto-direttoriale-n-1095-del-10-settembre-2026',
  data: '2026-09-11',
});
check('atto MIM recente AMESSO', true, attoRecente.rilevante);

const cronaca = valutaRilevanza({
  title: "04/08/2026 - Valditara: pronta la circolare per mettere un tetto agli stranieri in classe",
  url: 'https://www.mim.gov.it/web/guest/-/valditara-pronta-la-circolare',
  data: '2026-09-10',
});
check('cronaca di stampa RESPINTA', false, cronaca.rilevante);

const attoVecchio = valutaRilevanza({
  title: "Decreto Direttoriale n. 20 dell'11 maggio 2026",
  url: 'https://www.mim.gov.it/web/guest/-/decreto-direttoriale-n-20-dell-11-maggio-2026',
  data: '2026-09-10',
});
check('atto non recente RESPINTO', false, attoVecchio.rilevante);

const ccnlAltro = valutaRilevanza({
  title: 'CONTRATTO COLLETTIVO NAZIONALE DI LAVORO DELL’AREA SANITÀ TRIENNIO 2022 – 2024',
  url: 'https://www.aranagenzia.it/documento_pubblico/contratto-collettivo-nazionale-di-lavoro-dellarea-sanita-triennio-2022-2024/',
  data: '2026-02-27',
});
check('CCNL di altro comparto RESPINTO', false, ccnlAltro.rilevante);

const ccnlScuola = valutaRilevanza({
  title: 'CONTRATTO COLLETTIVO NAZIONALE DI LAVORO RELATIVO AL PERSONALE DELL’AREA ISTRUZIONE E RICERCA – TRIENNIO 2022-2024',
  url: 'https://www.aranagenzia.it/documento_pubblico/contratto-collettivo-nazionale-di-lavoro-relativo-al-personale-dellarea-istruzione-e-ricerca-triennio-2022-2024/',
  data: '2026-08-06',
});
check('CCNL Istruzione e Ricerca AMMESSO (categoria CCNL)', 'CCNL', ccnlScuola.categoria);

console.log('\n— Invariante sull\'archivio pubblicato —');
const archivio = readFileSync('src/departments/notizie/data/notizieIngestite.ts', 'utf8');
const url = [...archivio.matchAll(/"official_source_url": "([^"]+)"/g)].map((m) => m[1]);
check('archivio non vuoto', true, url.length > 0);
check('nessuna fonte regionale in archivio', 0, url.filter((u) => !èFonteNazionale(u)).length);
check('nessun host USR in archivio', 0, url.filter((u) => /\/web\/usr-/.test(u)).length);

console.log(errori === 0 ? '\n✅ NOTIZIE NAZIONALI: nessun problema' : `\n❌ NOTIZIE NAZIONALI: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

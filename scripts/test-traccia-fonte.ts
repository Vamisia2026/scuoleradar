/**
 * Verifica il TRACCIAMENTO della fonte granulare: da una pagina-contenitore
 * (indice, elenco, archivio circolari) il sistema deve risalire alla voce
 * SPECIFICA (sottopagina/circolare/PDF) che è la base fattuale della notizia.
 * Se non trova nulla di affidabile NON blocca e NON inventa: restituisce la
 * pagina di partenza come traccia.
 *
 * Uso: npm run test:traccia
 */
import {
  risolviFonteGranulare,
  scegliLinkSpecifico,
  tokenizza,
} from '../src/departments/notizie/services/tracciaFonte.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const INDICE = 'https://www.istruzione.lombardia.it/elenco-circolari-2026/';

const ELENCO = `
<html><head><title>Elenco circolari e note — USR Lombardia</title></head>
<body>
  <nav>
    <a href="/privacy">Privacy</a>
    <a href="https://www.facebook.com/usrlombardia">Facebook</a>
    <a href="/page/2">Pagina successiva</a>
    <a href="${INDICE}">Torna all'elenco</a>
  </nav>
  <main>
    <h1>Elenco circolari e note</h1>
    <ul>
      <li><a href="/circolari/2026/nota-1107-del-11-settembre-2026-comandi-personale-ata.pdf">Nota n. 1107 dell'11 settembre 2026 – Comandi personale ATA</a></li>
      <li><a href="/circolari/2026/nota-1095-del-10-settembre-2026-supplenze-e-gps.pdf">Nota n. 1095 del 10 settembre 2026 – Supplenze e GPS</a></li>
      <li><a href="/circolari/2026/calendario-scolastico-2026-2027.pdf">Calendario scolastico 2026/2027</a></li>
    </ul>
  </main>
</body></html>`;

console.log('— Matching della voce specifica su una pagina di elenco —');
const titolo = 'Nota n. 1095 del 10 settembre 2026: supplenze e GPS';
const trovato = scegliLinkSpecifico(ELENCO, INDICE, titolo);
check(
  'scelta la nota 1095 (numeri decisivi)',
  'https://www.istruzione.lombardia.it/circolari/2026/nota-1095-del-10-settembre-2026-supplenze-e-gps.pdf',
  trovato?.url ?? null,
);
check('riconosciuto come PDF', true, trovato?.pdf ?? null);
check('punteggio sopra soglia', true, (trovato?.punteggio ?? 0) >= 22);

console.log('\n— Rumore e contenitori esclusi —');
const rumore = ['privacy', 'facebook', 'page/2'].filter((f) => (trovato?.url ?? '').includes(f));
check('nessun link di navigazione scelto', [], rumore);
check(
  'la pagina-contenitore non viene scelta come fonte',
  false,
  (trovato?.url ?? '').includes('elenco-circolari'),
);

console.log('\n— Nessun match affidabile → null (nessuna invenzione) —');
const ALTRA_PAGINA = `
<html><body><ul>
  <li><a href="/circolari/2026/nota-77-del-2-marzo-2026-visite-fiscali.pdf">Nota n. 77 del 2 marzo 2026 – Visite fiscali</a></li>
  <li><a href="/circolari/2026/organico-di-diritto-2026-2027.pdf">Organico di diritto 2026/2027</a></li>
</ul></body></html>`;
check('titolo non presente nell’elenco → null', null, scegliLinkSpecifico(ALTRA_PAGINA, INDICE, titolo));

console.log('\n— Risoluzione della fonte (voce della pipeline) —');
check('tokenizer ignora le stopword', true, !tokenizza('la nota del ministero per la scuola').includes('la'));
check(
  'pagina non raggiungibile → resta la pagina di partenza',
  'https://www.istruzione.lombardia.it/elenco-inesistente-xyz/',
  (
    await risolviFonteGranulare({
      title: 'Nota di prova',
      link: 'https://www.istruzione.lombardia.it/elenco-inesistente-xyz/',
    })
  ).url,
);
check(
  'voce con fonte già specifica → url invariato (nessun tracciamento)',
  'https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi',
  (
    await risolviFonteGranulare({
      title: 'Supplenze e ruoli docenti 2026: al via la scelta delle 150 sedi',
      link: 'https://www.mim.gov.it/web/guest/-/supplenze-e-ruoli-docenti-2026-al-via-la-scelta-delle-150-sedi',
    })
  ).url,
);
const daDescrizione = await risolviFonteGranulare({
  title: 'Nota n. 1095 del 10 settembre 2026: supplenze e GPS',
  link: INDICE,
  description: ELENCO.slice(ELENCO.indexOf('<ul>'), ELENCO.indexOf('</ul>') + 5),
});
check(
  'voce da elenco: tracciata la nota specifica senza rete',
  'https://www.istruzione.lombardia.it/circolari/2026/nota-1095-del-10-settembre-2026-supplenze-e-gps.pdf',
  daDescrizione.url,
);
check('tracciamento dichiarato', true, daDescrizione.tracciato);
check('PDF collegato alla voce', true, (daDescrizione.pdf ?? '').endsWith('.pdf'));

console.log(errori === 0 ? '\n✅ TRACCIAMENTO FONTE: nessun problema' : `\n❌ TRACCIAMENTO FONTE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

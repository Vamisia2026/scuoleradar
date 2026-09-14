/**
 * Verifica l'ESPANSIONE degli ELENCHI (pagine indice) — es. elenchi USR.
 *
 * Regola: una pagina indice NON è un avviso. Ogni voce dell'elenco deve
 * diventare un avviso INDIPENDENTE, con il proprio link ufficiale, la propria
 * provincia e le proprie classi; la pagina indice non deve mai essere
 * pubblicata come se fosse un singolo avviso ("link alla lista master").
 *
 * Uso: npm run test:elenchi
 */
import {
  ePaginaElenco,
  eUrlElenco,
  espandiElencoInAvvisi,
  estraiVociElenco,
  sembraTitoloElenco,
} from '../src/scraper/elenchi.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const INDEX_URL = 'https://usrlombardia.istruzione.it/elenco-interpelli-2026/';

/** Elenco in stile USR: tabella con una voce per riga + lista + rumore di nav. */
const ELENCO = `
<html>
  <head><title>Elenco interpelli – USR Lombardia</title></head>
  <body>
    <nav>
      <a href="/privacy">Privacy</a>
      <a href="https://www.facebook.com/usrlombardia">Facebook</a>
      <a href="/">Home</a>
    </nav>
    <main>
      <h1>Elenco interpelli USR Lombardia</h1>
      <table>
        <tbody>
          <tr>
            <td>Interpello supplenza A-022 18 ore — Liceo Manzoni, Lecco</td>
            <td><a href="/albo/interpello-a022-manzoni.pdf">Avviso A-022 Manzoni</a></td>
          </tr>
          <tr>
            <td>Interpello sostegno ADEE — IC De Amicis, Milano</td>
            <td><a href="/albo/interpello-adee-deamicis.pdf">Avviso ADEE De Amicis</a></td>
          </tr>
        </tbody>
      </table>
      <ul>
        <li>
          <a href="/albo/avviso-ata-assistente-amministrativo-giacosa.pdf">
            Avviso ATA assistente amministrativo — IC Giacosa, Milano
          </a>
          <span>Termine presentazione domande: 30 settembre 2026</span>
        </li>
      </ul>
      <a href="/page/2">Pagina successiva</a>
    </main>
  </body>
</html>`;

console.log('— Riconoscimento della pagina indice —');
check('URL elenco riconosciuto', true, eUrlElenco(INDEX_URL));
check(
  'URL di un documento non è elenco',
  false,
  eUrlElenco('https://www.istruzione.lombardia.it/it/2026/09/documento-12345'),
);
check('titolo "Elenco interpelli…" riconosciuto', true, sembraTitoloElenco('Elenco interpelli 2026'));
check('pagina indice riconosciuta', true, ePaginaElenco(ELENCO, INDEX_URL, INDEX_URL));
check(
  'pagina di dettaglio NON è indice',
  false,
  ePaginaElenco(
    '<article><h1>Interpello A-022</h1><p>Supplenza 18 ore.</p><a href="/albo/doc-12345.pdf">Scarica avviso</a></article>',
    'https://www.istruzione.lombardia.it/it/2026/09/documento-12345',
    'https://www.istruzione.lombardia.it/it/2026/09/documento-12345',
  ),
);

console.log('\n— Estrazione delle voci (una per avviso) —');
const voci = estraiVociElenco(ELENCO, INDEX_URL);
check('una voce per avviso elencato (3)', 3, voci.length);
check('nessuna voce punta alla pagina indice', [], voci.filter((v) => v.url === INDEX_URL));
check('URL assoluti (relativi risolti)', true, voci.every((v) => /^https:\/\//.test(v.url)));
check(
  'PDF scelto come link della voce',
  true,
  voci.every((v) => v.url.endsWith('.pdf')),
);
check(
  'nessun link di rumore (privacy/facebook/pagina 2)',
  [],
  voci.filter((v) => /privacy|facebook|page\/2/.test(v.url)),
);
check('titoli descrittivi', true, voci.every((v) => v.titolo.length >= 12));
check('titoli distinti', 3, new Set(voci.map((v) => v.titolo)).size);

console.log('\n— Espansione in avvisi strutturati —');
const avvisi = espandiElencoInAvvisi(ELENCO, {
  baseUrl: INDEX_URL,
  provincia: 'MI',
  source: INDEX_URL,
});
const perTitolo = (re: RegExp) => avvisi.find((a) => re.test(a.title));
check('un avviso per voce (3)', 3, avvisi.length);
check(
  'province valide (codice a 2 lettere)',
  true,
  avvisi.every((a) => /^[A-Z]{2}$/.test(a.province)),
);
check('provincia REALE dedotta dal testo (Milano → MI)', 'MI', perTitolo(/milano/i)?.province ?? null);
check(
  'ogni avviso ha il PROPRIO link (mai la lista master)',
  true,
  avvisi.every((a) => Boolean(a.link) && a.link !== INDEX_URL),
);
check('link tutti distinti', 3, new Set(avvisi.map((a) => a.link)).size);
check('hash_id distinti', 3, new Set(avvisi.map((a) => a.hashId)).size);
check('classe A-022 rilevata', true, (perTitolo(/a-022/i)?.classCodes ?? []).includes('A-022'));
check('classe ADEE rilevata', true, (perTitolo(/adee/i)?.classCodes ?? []).includes('ADEE'));
const voceAta = avvisi.find((a) => /assistente amministrativo/i.test(a.title));
check('voce ATA presente come avviso a sé', true, Boolean(voceAta));
check('scadenza della voce estratta', '2026-09-30', voceAta?.expirationDate ?? null);

console.log('\n— Schede per SCUOLA con sotto-elenco (indice annidato) —');
/**
 * Forma tipica "una scheda per scuola": il titolo della scheda punta alla pagina
 * dell'istituto (INDICE), il sotto-elenco contiene gli avvisi veri. Regola: si
 * pubblicano le voci individuali, mai il link alla pagina-istituto/lista master.
 */
const ELENCO_A_CARTE = `
<html><head><title>Avvisi USR Lombardia — elenco per istituzione scolastica</title></head>
<body><section class="avvisi">
  <article class="card">
    <h3><a href="/istituti/ic-giacosa-milano">IC Giacosa — Milano</a></h3>
    <ul>
      <li><a href="/albo/giacosa-interpello-ata-aa.pdf">Interpello ATA AA — IC Giacosa Milano</a></li>
      <li><a href="/albo/giacosa-interpello-a022.pdf">Interpello A-022 — IC Giacosa Milano</a></li>
    </ul>
  </article>
</section></body></html>`;
const urlCarte = 'https://usrlombardia.istruzione.it/avvisi-per-istituzione-scolastica/';
const vociCarte = estraiVociElenco(ELENCO_A_CARTE, urlCarte);
check('due voci individuali estratte', 2, vociCarte.length);
check(
  'il link alla pagina-istituto (lista master) NON è una voce',
  [],
  vociCarte.filter((v) => /istituti\/ic-giacosa-milano/.test(v.url)),
);
const avvisiCarte = espandiElencoInAvvisi(ELENCO_A_CARTE, {
  baseUrl: urlCarte,
  provincia: 'MI',
});
check('due avvisi indipendenti', 2, avvisiCarte.length);
check(
  'nessun avviso punta all’indice della scuola',
  [],
  avvisiCarte.filter((a) => /istituti\/ic-giacosa-milano/.test(a.link ?? '')),
);
check(
  'ogni avviso ha un PDF diverso',
  2,
  new Set(avvisiCarte.map((a) => a.link)).size,
);

console.log(
  errori === 0 ? '\n✅ ELENCHI: nessun problema' : `\n❌ ELENCHI: ${errori} errore/i`,
);
process.exitCode = errori === 0 ? 0 : 1;

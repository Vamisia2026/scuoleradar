/**
 * ScuoleRadar.it — FIXTURE HTML per i test degli elenchi (`scripts/test-elenchi.ts`).
 *
 * Frammenti REALI (riprodotti, senza rete) dei due layout non-tabellari che la
 * suite deve coprire:
 *  - FONTE REGIONALE Umbria: elenco in `<table>` dove la scadenza sta in una
 *    colonna e la parola chiave («Data chiusura avviso») nell'INTESTAZIONE;
 *  - PORTALE PROVINCIALE (USR Liguria, `provincia.php`): GRIGLIA ARIA senza
 *    `<table>` (`div[role="row"]` + `role="cell"` + `role="columnheader"`).
 *
 * Entrambi i frammenti contengono menu di testata e footer: servono a provare che
 * i link di navigazione NON diventino avvisi. Uso: import dai test, mai in runtime.
 */

/** Pagina «avvisi pubblicati» della fonte regionale Umbria. */
export const URL_UMBRIA = 'https://www.uspumbria.istruzione.it/avvisi/';

/** Elenco Umbria: tabella-dati con la scadenza dichiarata nell'intestazione. */
export const TABELLA_UMBRIA = `
<html><head><title>Avvisi pubblicati — USR Umbria</title></head>
<body>
  <header>
    <nav><ul>
      <li><a href="/pon-pn-scuola-e-competenze">PON-PN Scuola e Competenze 2021-2027</a></li>
      <li><a href="/contatti">Contatti</a></li>
    </ul></nav>
  </header>
  <h1>Avvisi pubblicati</h1>
  <div class="wrap">
    <a href="/index.php">Interpelli docenti Umbria — avvisi e interpelli aperti</a>
  </div>
  <table class="avvisi">
    <thead>
      <tr>
        <th>Numero</th><th>Istituzione scolastica</th><th>Oggetto</th>
        <th>Data pubblicazione</th><th>Data chiusura avviso</th><th>Allegati</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1234</td>
        <td>IC Perugia 3 — Perugia</td>
        <td>Interpello A-022 supplenza 18 ore</td>
        <td>01/10/2026</td>
        <td>20/10/2026</td>
        <td><a href="/allegati/interpello-a022-perugia3.pdf">Avviso prot. 1234</a></td>
      </tr>
      <tr>
        <td>1235</td>
        <td>Liceo Properzio — Assisi</td>
        <td>Avviso selezione ADEE sostegno</td>
        <td>02/10/2026</td>
        <td>16 ottobre 2026</td>
        <td><a href="/allegati/selezione-adee-assisi.pdf">Avviso prot. 1235</a></td>
      </tr>
    </tbody>
  </table>
  <footer><a href="/privacy">Privacy</a></footer>
</body></html>`;

/** Elenco provinciale Liguria (`provincia.php`): griglia ARIA, nessun `<table>`. */
export const URL_LIGURIA = 'https://servizi.istruzioneliguria.gov.it/provincia.php?p=GE';

/** Griglia ARIA provinciale: righe `role="row"` con celle `role="cell"`. */
export const GRIGLIA_ARIA = `
<html><head><title>Avvisi di selezione — Provincia di Genova</title></head>
<body>
  <!-- TESTATA reale del portale: marchio e titolo del sito puntano alla home
       (index.php), il menu usa <nav> senza <header>. Nessun link di qui è un
       avviso. -->
  <div class="site-brand-wrap"><div class="site-brand shell">
    <a class="site-logo" href="index.php" aria-label="Torna alla home Interpelli docenti">
      <img src="/emblema.jpg" alt="Emblema della Repubblica Italiana">
    </a>
    <a class="site-titles" href="index.php">
      <span class="site-title">Interpelli docenti</span>
      <span class="site-sub">Ambito di Genova</span>
    </a>
  </div></div>
  <nav class="site-nav-band">
    <a href="index.php">Liguria</a>
    <a href="provincia.php?p=GE" aria-current="page">Genova</a>
  </nav>
  <h1>Avvisi di selezione — Provincia di Genova</h1>
  <div role="table" aria-label="Avvisi di selezione">
    <div role="row">
      <div role="columnheader">Protocollo</div>
      <div role="columnheader">Istituto</div>
      <div role="columnheader">Titolo</div>
      <div role="columnheader">Scadenza</div>
      <div role="columnheader">Allegati</div>
    </div>
    <div role="row">
      <div role="cell">9001</div>
      <div role="cell"><span>IC Genova</span><span>Bolzaneto</span></div>
      <div role="cell">Graduatoria ATA assistente amministrativo</div>
      <div role="cell">18/10/2026</div>
      <div role="cell"><a href="/albo/graduatoria-ata-bolzaneto.pdf">Documento prot. 9001</a></div>
    </div>
    <div role="row">
      <div role="cell"><i class="doc-icon">▤</i>9002</div>
      <div role="cell"><span>IC Genova</span><span>Sestri</span></div>
      <div role="cell">Interpello A-022 scienze motorie</div>
      <div role="cell">21/10/2026</div>
      <div role="cell"><a href="/albo/interpello-a022-sestri.pdf">Documento prot. 9002</a></div>
    </div>
    <div role="row">
      <div role="cell">9003</div>
      <div role="cell"><span>ITTL Nautico</span><span>San Giorgio</span></div>
      <div role="cell">Bando selezione tutor PCTO</div>
      <div role="cell">25/10/2026</div>
      <div role="cell"><a href="/albo/bando-tutor-pcto-sangiorgio.pdf">Documento prot. 9003</a></div>
    </div>
  </div>
</body></html>`;

/**
 * TEST GENERAZIONE PDF — MAD (temporaneo)
 * ----------------------------------------
 * Genera l'HTML di stampa di una Domanda di messa a disposizione (MAD)
 * usando la stylesheet condivisa di `pdfGenerator.ts` (costruisciDocumento),
 * per verificare il nuovo layout: anno sempreverde "20____ / 20____",
 * colonne etichette/campi 30/70, chiusura standard senza ruoli incongruenti,
 * documento compatto in 1-2 pagine.
 *
 * Esecuzione:
 *   npm run test:pdf
 * Poi apri `scripts/out/test-mad.html` nel browser e stampa con "Salva come PDF"
 * (o in anteprima dell'app usa il pulsante Stampa / Salva PDF).
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { costruisciDocumento } from '../src/modules/modulistica/creator/pdfGenerator.ts';

/** Corpo di una MAD rappresentativa, allineato ai nuovi template (cacheService). */
const corpo = `
  <table class="intestazione-formale">
    <tr><td class="campo-etichetta">Istituto Scolastico</td><td class="campo-compilazione"><div class="campo-scrittura"></div><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Anno Scolastico</td><td class="campo-compilazione">20____ / 20____</td></tr>
    <tr><td class="campo-etichetta">Protocollo n.</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Data</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>

  <h2>Quadro anagrafico del richiedente</h2>
  <table class="quadro-anagrafico">
    <tr><td class="campo-etichetta">Cognome e Nome</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Codice Fiscale</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Data e luogo di nascita</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Residenza</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Titolo di studio</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Classe di concorso</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Contatto (email / telefono)</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
    <tr><td class="campo-etichetta">Scuola destinataria</td><td class="campo-compilazione"><div class="campo-scrittura"></div></td></tr>
  </table>

  <h2>Oggetto e Motivazione della Richiesta</h2>
  <p>Domanda di messa a disposizione per l&apos;assegnazione di supplenze e incarichi di insegnamento per l&apos;anno scolastico indicato, con dichiarazione della disponibilità a essere convocati.</p>
  <div class="righe-scrittura"><div></div><div></div><div></div><div></div></div>

  <div class="griglia-2">
    <div>
      <h2>Tipologia di contratto richiesta</h2>
      <div class="crocette">
        <p class="voce"><span class="casella"></span>Supplenza breve / fino al termine delle lezioni</p>
        <p class="voce"><span class="casella"></span>Supplenza annuale</p>
        <p class="voce"><span class="casella"></span>Incarico a tempo determinato</p>
        <p class="voce"><span class="casella"></span>Messa a disposizione (MAD)</p>
      </div>
    </div>
    <div>
      <h2>Disponibilità oraria</h2>
      <div class="crocette">
        <p class="voce"><span class="casella"></span>Tempo pieno</p>
        <p class="voce"><span class="casella"></span>Part-time (indicare le ore)</p>
        <p class="voce"><span class="casella"></span>Solo mattino</p>
        <p class="voce"><span class="casella"></span>Solo pomeriggio</p>
      </div>
    </div>
  </div>

  <div class="blocco-firme">
    <h2>Luogo e Data</h2>
    <p class="micro-copy">Da sottoscrivere a cura del richiedente. Allegare eventuale documentazione integrativa.</p>
    <div class="chiusura-documento">
      <p>Luogo e data: <span class="riga-firma"></span></p>
      <p>Firma del richiedente (leggibile): <span class="riga-firma"></span></p>
    </div>

    <div class="convalida">
      <p><strong>Convalida dell&apos;Istituzione Scolastica</strong> — spazio per il sigillo e le iniziali di convalida.</p>
      <div class="riga-firma"></div>
      <p>Luogo e data di protocollo:</p>
      <div class="riga-firma"></div>
      <p>Firma del funzionario incaricato:</p>
      <div class="riga-firma"></div>
    </div>
  </div>

  <p class="nota-normativa">Modello conforme alle Linee Guida del Ministero dell&apos;Istruzione e del Merito — Riferimenti normativi: DPR 275/1999, O.M. 88/2024. Si allega copia del documento di identità del richiedente. Documento scaricato gratuitamente da ScuoleRadar.it.</p>
`;

const doc = costruisciDocumento('Domanda di messa a disposizione (MAD)', corpo);

const outFile = fileURLToPath(new URL('./out/test-mad.html', import.meta.url));
mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, doc.html, 'utf8');

console.log('──────────────────────────────────────────────');
console.log('📄 TEST GENERAZIONE PDF — MAD (layout A4)');
console.log(`   Output HTML: ${outFile}`);
console.log(`   Pagine stimate: ${doc.pagineStimate}`);
console.log(`   Layout dinamico: ${doc.layout} (${doc.layout === 'compatto' ? '1 pagina A4' : '2 pagine A4'})`);
console.log(`   Indice automatico: ${doc.conIndice ? 'sì' : 'no'}`);
console.log('   Da verificare: anno "20____ / 20____", colonne etichette/campi 30/70,');
console.log('   chiusura standard (Luogo/Data + Firma + Convalida), documento compatto.');
console.log('──────────────────────────────────────────────');

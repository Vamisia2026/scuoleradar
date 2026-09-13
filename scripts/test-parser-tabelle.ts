/**
 * Verifica l'INGESTIONE delle TABELLE multi-riga delle fonti provinciali:
 * ogni riga `<tr>` con un link ufficiale deve diventare un interpello strutturato
 * (titolo + link + classi), senza placeholder né dump grezzi.
 *
 * Uso: npm run test:parser:tabelle
 */
import { parsePostInterpelli } from '../src/scraper/index.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const post = `
<article class="post-content">
  <h1 class="entry-title">Interpelli Scuola 12 settembre 2026</h1>
  <p>Interpelli pubblicati da: TORINO</p>
  <table>
    <tbody>
      <tr>
        <td>Interpello supplenza Matematica A-041</td>
        <td><a href="https://www.istruzione.it/avvisi/torino-a041.pdf">Scarica avviso A-041</a></td>
      </tr>
      <tr>
        <td>Interpello sostegno ADEE scuola primaria</td>
        <td><a href="https://www.istruzione.it/avvisi/torino-adee.pdf">Scarica avviso ADEE</a></td>
      </tr>
      <tr>
        <td>Riga di intestazione senza link ufficiale</td>
        <td>—</td>
      </tr>
    </tbody>
  </table>
</article>`;

const avvisi = parsePostInterpelli(post, 'TO', 'https://www.scuolainterpelli.it/interpelli-scuola-12-settembre-2026/');

console.log(`— Righe tabella → interpelli: ${avvisi.length} —`);
check('una voce per riga con link (2)', 2, avvisi.length);
check(
  'link PDF prima voce',
  'https://www.istruzione.it/avvisi/torino-a041.pdf',
  avvisi[0]?.link ?? null,
);
check('titolo prima voce non vuoto', true, (avvisi[0]?.title ?? '').length > 8);
check('classe A-041 rilevata', true, (avvisi[0]?.classCodes ?? []).includes('A-041'));
check('classe ADEE rilevata (2ª voce)', true, (avvisi[1]?.classCodes ?? []).includes('ADEE'));
check('nessun placeholder "AAAA"/"EEEE"', true, !(avvisi.flatMap((a) => a.classCodes)).some((c) => /^(AAAA|EEEE)$/.test(c)));
check('provincia applicata', true, avvisi.every((a) => a.province === 'TO'));

console.log(errori === 0 ? '\n✅ PARSER TABELLE: nessun problema' : `\n❌ PARSER TABELLE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

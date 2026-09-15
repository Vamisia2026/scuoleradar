/**
 * TEST — POLICY DI ROUTING ESTERNO degli avvisi (Step 1).
 * -----------------------------------------------------------------
 * Garantisce che ogni link di avviso punti SOLO alla fonte originale
 * dell'istituzione e che la GUIDA OPERATIVA (Step 3) compaia quando la
 * destinazione è una pagina tabellare/"Stampa" o la fonte manca.
 *
 * Verifica:
 *   · lo scraper RIFIUTA come fonte qualsiasi URL della piattaforma (e di prova);
 *   · `eLinkEsterno`/`urlEsterna` classificano correttamente gli host;
 *   · `suggerimentoRicercaAvviso` è `null` sulle pagine di dettaglio e spiega
 *     come candidarsi su elenchi/"Stampa" e su avvisi senza fonte.
 *
 * Esecuzione: npm run test:link-esterno
 */

import { eSorgenteVerificata, verificaAvviso } from '../src/scraper/parser.ts';
import {
  ISTRUZIONE_AVVISO_UFFICIALE,
  eLinkEsterno,
  ePaginaRiepilogo,
  etichettaFonteLink,
  suggerimentoRicercaAvviso,
  urlEsterna,
} from '../src/lib/alertInterpello.ts';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Scraper: la piattaforma NON è una fonte ufficiale —');
check('scuoleradar.it rifiutato', false, eSorgenteVerificata('https://www.scuoleradar.it/interpello/abc123'));
check('scuoleradar.it → avviso scartato', false, verificaAvviso({ title: 'Interpello supplenza A-022', link: 'https://www.scuoleradar.it/interpello/abc' }).ok);
check('purefocus rifiutato', false, eSorgenteVerificata('https://purefocus.one/avviso'));
check('URL di prova rifiutato', false, eSorgenteVerificata('https://example.com/interpello'));
check('fonte istituzionale accettata', true, eSorgenteVerificata('https://www.istruzionepiemonte.it/interpello-a022-monti'));

console.log('\n— eLinkEsterno / urlEsterna —');
check('pagina istituzionale → esterna', true, eLinkEsterno('https://www.usp-asti.gov.it/interpelli/avviso-1'));
check('piattaforma → NON esterna', false, eLinkEsterno('https://scuoleradar.it/dashboard'));
check('dashboard → NON esterna', false, eLinkEsterno('https://www.scuoleradar.it/dashboard/radar'));
check('sottodominio piattaforma → NON esterno', false, eLinkEsterno('https://api.scuoleradar.it/x'));
check('localhost → NON esterno', false, eLinkEsterno('http://localhost:5173/avviso'));
check('esempio/example → NON esterno', false, eLinkEsterno('https://example.com/avviso'));
check('URL relativo → NON esterno', false, eLinkEsterno('/interpello/abc'));
check('urlEsterna ritorna l\'URL valido', 'https://www.usp-asti.gov.it/avviso', urlEsterna('https://www.usp-asti.gov.it/avviso'));
check('urlEsterna → null su link interno', null, urlEsterna('https://scuoleradar.it/interpello/x'));

console.log('\n— Etichette sulla destinazione —');
check('riepilogo riconosciuto', true, ePaginaRiepilogo('https://www.liceo.edu.it/albo?stampa=1'));
check('elenco riconosciuto', true, ePaginaRiepilogo('https://www.usp.it/interpelli/elenco'));
check('etichetta riepilogo', 'Apri la pagina di riepilogo', etichettaFonteLink('https://www.liceo.edu.it/albo?stampa=1'));
check('etichetta PDF', 'Apri il bando ufficiale (PDF)', etichettaFonteLink('https://www.liceo.edu.it/avviso.pdf'));
check('etichetta scheda esterna', "Apri la scheda dell'avviso", etichettaFonteLink('https://www.usp.it/interpello/123'));

console.log('\n— GUIDA OPERATIVA (Step 3) —');
check('pagina di dettaglio → nessuna guida', null, suggerimentoRicercaAvviso({ url: 'https://www.liceo.edu.it/avviso-123', classe: 'A-022', email: 'a@b.edu.it' }));
const guidaElenco = suggerimentoRicercaAvviso({
  url: 'https://www.liceo.edu.it/albo?stampa=1',
  classe: 'A-022',
  provincia: 'AT',
  email: 'astf01000x@istruzione.it',
});
check('elenco → guida presente', true, typeof guidaElenco === 'string' && guidaElenco.length > 40);
check('elenco → spiega come trovare la riga', true, /cerca la riga con «A-022»/i.test(guidaElenco ?? ''));
check('elenco → espone l\'email della scuola', true, (guidaElenco ?? '').includes('astf01000x@istruzione.it'));
const guidaSenzaFonte = suggerimentoRicercaAvviso({ classe: 'A-022', provincia: 'AT', email: null });
check('senza fonte → guida presente', true, typeof guidaSenzaFonte === 'string' && guidaSenzaFonte.length > 40);
check('senza fonte → chiede la riga alla segreteria', true, /segreteria/i.test(guidaSenzaFonte ?? ''));
check('senza email → nessun recapito inventato', false, /@/.test(guidaSenzaFonte ?? ''));

console.log('\n— Direttiva STANDARD "STAMPA" (Step 2) —');
check(
  'guida completa: usa l\'istruzione standard',
  true,
  (guidaElenco ?? '').includes(ISTRUZIONE_AVVISO_UFFICIALE),
);
const guidaCompatta = suggerimentoRicercaAvviso({
  url: 'https://www.liceo.edu.it/albo?stampa=1',
  classe: 'A-022',
  provincia: 'AT',
  email: 'astf01000x@istruzione.it',
  compatto: true,
});
check(
  'guida compatta (digest): usa la STESSA istruzione',
  true,
  (guidaCompatta ?? '').includes(ISTRUZIONE_AVVISO_UFFICIALE),
);
check(
  'guida compatta: più breve della completa',
  true,
  (guidaCompatta ?? '').length < (guidaElenco ?? '').length,
);
check('guida compatta: nessuna ripetizione dell\'email', false, /@/.test(guidaCompatta ?? ''));
check('guida compatta: spiega come trovare la riga', true, /cerca la riga con «A-022»/.test(guidaCompatta ?? ''));
check(
  'senza fonte: nessuna direttiva STAMPA (niente da aprire)',
  false,
  /STAMPA/.test(guidaSenzaFonte ?? ''),
);

console.log(errori === 0 ? '\n✅ LINK ESTERNO: nessun problema' : `\n❌ LINK ESTERNO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

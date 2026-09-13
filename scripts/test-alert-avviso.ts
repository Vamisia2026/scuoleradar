/**
 * Verifica l'AVVISO STRUTTURATO (gerarchia obbligatori/opzionali) e l'estrazione
 * ROBUSTA della scadenza dal parser.
 *
 * Uso: npm run test:alert
 */
import {
  avvisoNotificabile,
  costruisciAvviso,
  dataIsoValida,
  formatDataAvviso,
  righeTestoAvviso,
} from '../src/lib/alertInterpello.ts';
import { estraiDataScadenza } from '../src/scraper/parser.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Avviso COMPLETO (obbligatorie + opzionali) —');
const completo = costruisciAvviso({
  provincia: 'Torino (TO)',
  classCode: 'A-41',
  materia: null,
  scadenza: '2026-09-30',
  schoolName: 'ITIS A. Artom di Asti',
  pubblicazione: '2026-09-01',
});
check('completo', true, completo.completo);
check('mancanti', [], completo.mancanti);
check('obbligatorie (etichette)', ['Provincia', 'Ordine di scuola', 'Classe / Materia', 'Scadenza'], completo.obbligatorie.map((r) => r.etichetta));
check('ordine dedotto da A-41', 'Secondaria di II grado', completo.obbligatorie.find((r) => r.etichetta === 'Ordine di scuola')?.valore);
check('scadenza formattata', '30 set 2026', completo.obbligatorie.find((r) => r.etichetta === 'Scadenza')?.valore);
check('opzionali', ['Scuola', 'Pubblicato'], completo.opzionali.map((r) => r.etichetta));

console.log('\n— Avviso SENZA scadenza: opzionali assenti omessi —');
const senzaScadenza = costruisciAvviso({
  provincia: 'Milano',
  classCode: 'ADEE',
  scadenza: null,
  schoolName: null,
});
check('completo', false, senzaScadenza.completo);
check('mancanti', ['Scadenza'], senzaScadenza.mancanti);
check('scadenzaValida', false, senzaScadenza.scadenzaValida);
check('opzionali omessi', [], senzaScadenza.opzionali);
check('notificabile', false, avvisoNotificabile({ provincia: 'Milano', classCode: 'ADEE', scadenza: null }));

console.log('\n— Ordine ATA dai codici abbreviati —');
const ata = costruisciAvviso({ provincia: 'Roma', classCode: 'AA', scadenza: '2026-09-20' });
check('ordine ATA', 'Personale ATA', ata.obbligatorie.find((r) => r.etichetta === 'Ordine di scuola')?.valore);

console.log('\n— Classi mancanti → obbligatorio assente —');
const senzaClasse = costruisciAvviso({ provincia: 'Napoli', classCode: '', materia: null, scadenza: '2026-09-20' });
check('mancanti', ['Ordine di scuola', 'Classe / Materia'], senzaClasse.mancanti);

console.log('\n— Righe di testo (gerarchia + omissione scadenza) —');
const righe = righeTestoAvviso({ provincia: 'Torino', classCode: 'A-41', scadenza: null, schoolName: 'ITIS Artom' });
check('nessuna riga "Non indicata"', true, !righe.some((r) => /non indicata/i.test(r)));
check('contiene Scuola', true, righe.some((r) => r.startsWith('🏫')));
check('contiene Classe/Materia', true, righe.some((r) => r.startsWith('📚')));
check('nessuna Scadenza (assente)', false, righe.some((r) => r.startsWith('📅')));

console.log('\n— Date helper —');
check('dataIsoValida("")', false, dataIsoValida(''));
check('dataIsoValida("2026-09-30")', true, dataIsoValida('2026-09-30'));
check('formatDataAvviso', '05 ott 2026', formatDataAvviso('2026-10-05'));

console.log('\n— Parser: scadenza ROBUSTA (prima/dopo, formati) —');
const casi: [string, string | null][] = [
  ['Domande entro il 15/09/2026', '2026-09-15'],
  ['Scadenza: 30 settembre 2026', '2026-09-30'],
  ['Presentazione delle candidature 12/09/2026 ore 12:00', '2026-09-12'],
  ['15/09/2026 - termine di presentazione delle domande', '2026-09-15'],
  ['Manifestazione di interesse entro e non oltre il 20-09-2026', '2026-09-20'],
  ['Nessuna data dichiarata in questo avviso', null],
];
for (const [testo, atteso] of casi) {
  check(`scadenza "${testo.slice(0, 40)}…"`, atteso, estraiDataScadenza(testo));
}

console.log(errori === 0 ? '\n✅ ALERT AVVISO: nessun problema' : `\n❌ ALERT AVVISO: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

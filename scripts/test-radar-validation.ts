/**
 * Verifica la guardia di attivazione del Radar (`src/lib/radarValidation.ts`):
 * il Radar è attivabile SOLO con tutti i campi obbligatori (Ordini + Province +
 * Classi/Materie) e vengono indicate puntualmente le sezioni mancanti.
 *
 * Uso: npm run test:radar
 */
import {
  messaggioCampiMancanti,
  validaConfigRadar,
  type RadarConfigCampi,
} from '../src/lib/radarValidation.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const completo: RadarConfigCampi = {
  ordini: ['secondaria2'],
  provinceCodici: ['MI', 'TO'],
  classiCodici: ['A-41'],
  materieId: [],
  materieCustom: [],
};

console.log('— Configurazione completa —');
check('valido', true, validaConfigRadar(completo).valido);
check('mancanti', [], validaConfigRadar(completo).mancanti);

console.log('\n— Campi mancanti —');
check(
  'senza ordini',
  { valido: false, mancanti: ['Ordini di scuola'], primoPasso: 1 },
  validaConfigRadar({ ...completo, ordini: [] }),
);
check(
  'senza province',
  { valido: false, mancanti: ['Province'], primoPasso: 2 },
  validaConfigRadar({ ...completo, provinceCodici: [] }),
);
check(
  'senza classi né materie',
  { valido: false, mancanti: ['Classi di concorso o materie'], primoPasso: 3 },
  validaConfigRadar({ ...completo, classiCodici: [], materieId: [], materieCustom: [] }),
);
check(
  'tutto mancante → passo 1 + 3 sezioni',
  { valido: false, mancanti: ['Ordini di scuola', 'Province', 'Classi di concorso o materie'], primoPasso: 1 },
  validaConfigRadar({ ordini: [], provinceCodici: [], classiCodici: [], materieId: [], materieCustom: [] }),
);

console.log('\n— Solo materie (senza classi) è valido —');
check(
  'materieCustom valorizzate',
  true,
  validaConfigRadar({ ...completo, classiCodici: [], materieCustom: ['Matematica'] }).valido,
);

console.log('\n— Messaggio amichevole —');
check(
  'due mancanti',
  'Per attivare il Radar completa questi campi: Ordini di scuola e Province.',
  messaggioCampiMancanti(['Ordini di scuola', 'Province']),
);

console.log(errori === 0 ? '\n✅ RADAR VALIDATION: nessun problema' : `\n❌ RADAR VALIDATION: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

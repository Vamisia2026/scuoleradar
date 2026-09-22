/**
 * ScuoleRadar.it — Dipartimento CFU · Verifica del Dossier .txt della V1.
 *
 * Il Dossier deve raccontare ESATTAMENTE il risultato mostrato a schermo:
 *  - nessun dato dimostrativo o numero inventato;
 *  - totale dei CFU mancanti SOLO se il motore lo pubblica (`deficit.calcolabile`);
 *  - stato, requisiti, dati mancanti, cosa verificare e fonti sempre presenti;
 *  - data non dichiarata dichiarata come tale (mai sostituita con oggi).
 */
import { creaEsitoUtente } from '../calcolatore/esitoUtente';
import { creaTestoDossierV1, type ContestoDossierV1 } from '../dossier/dossierV1';
import { ingresso, requisitoAccesso, requisitoCfu } from './esitoUtenteV1Fixtures';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

const CONTESTO: ContestoDossierV1 = {
  classeLaurea: 'LM-14',
  dataProcedura: '',
  esamiInseriti: 6,
  cfuInseriti: 96,
};

/* ------------------------------ 1. Esito positivo pubblicato ------------------------------ */

function testDossierPositivo(): void {
  const esito = creaEsitoUtente(ingresso());
  const testo = creaTestoDossierV1(esito, CONTESTO);

  assert(testo.includes('DOSSIER REQUISITI SCUOLERADAR'), 'DOSSIER: intestazione presente');
  assert(testo.includes('A-11'), 'DOSSIER: classe in chiaro');
  assert(
    testo.includes(esito.classeDenominazione),
    'DOSSIER: denominazione della classe coerente col risultato',
  );
  assert(testo.includes('REQUISITI SODDISFATTI'), 'DOSSIER: verdetto tradotto in chiaro');
  assert(
    testo.includes(`Esito tecnico del motore: ${esito.esitoTecnico}`),
    'DOSSIER: stato tecnico tracciato',
  );
  assert(testo.includes('Classe di laurea del titolo: LM-14'), 'DOSSIER: titolo dichiarato riportato');
  assert(
    testo.includes('Data della procedura: non dichiarata'),
    'DOSSIER: data non dichiarata esplicitata (nessuna data inventata)',
  );
  assert(
    testo.includes('Crediti mancanti secondo la norma: 0 CFU'),
    'DOSSIER: deficit pubblicato dal motore riportato (0 legittimo)',
  );
  assert(
    testo.includes('Norma: DM 22/12/2023'),
    'DOSSIER: riferimento normativo presente',
  );
  assert(
    testo.includes('fonte verificata'),
    'DOSSIER: esito del Source Gate riportato per le fonti',
  );
  assert(
    testo.includes('non vengono caricati né analizzati'),
    'DOSSIER: politica "nessun documento" dichiarata',
  );

  const requisitiSoddisfatti = esito.requisitiSoddisfatti.length;
  const occorrenze = testo.split('[SODDISFATTO]').length - 1;
  assert(
    occorrenze === requisitiSoddisfatti,
    `DOSSIER: un blocco per requisito (${occorrenze} = ${requisitiSoddisfatti})`,
  );
}

/* ------------------------------ 2. Deficit NON pubblicabile ------------------------------ */

function testDossierDeficitNonPubblicabile(): void {
  const esito = creaEsitoUtente(
    ingresso({
      esitoMotore: 'MANUAL_VERIFICATION_REQUIRED',
      motivazione:
        'Integrabilità non dichiarata dalla norma (NOT_SPECIFIED): nessuna deduzione automatica.',
      requisiti: [requisitoCfu('r1'), requisitoAccesso('accesso')],
      valutazioni: [
        {
          requisitoId: 'r1',
          stato: 'NON_SODDISFATTO',
          cfuRichiesti: 96,
          cfuPosseduti: 84,
          cfuMancanti: 12,
          spiegazione: ['Deficit calcolato sui dati conteggiati: 12 CFU.'],
        },
        {
          requisitoId: 'accesso',
          stato: 'SODDISFATTO',
          cfuRichiesti: null,
          cfuPosseduti: null,
          cfuMancanti: null,
          spiegazione: ['Classe LM-14 ammessa.'],
        },
      ],
      deficit: {
        calcolabile: false,
        cfuMancantiTotali: null,
        causaDeterminante: 'nessuna',
        motivo: 'Verifica manuale richiesta: nessun deficit pubblicabile.',
        perRequisito: [],
      },
      datiMancanti: ['data della procedura'],
      codiciMancanti: true,
    }),
  );
  const testo = creaTestoDossierV1(esito, { ...CONTESTO, dataProcedura: '' });

  assert(
    testo.includes('VERIFICA MANUALE RICHIESTA'),
    'DOSSIER: verifica manuale dichiarata (mai un "no")',
  );
  assert(
    testo.includes('Totale CFU mancanti non pubblicato dal motore'),
    'DOSSIER: totale assente dichiarato come tale',
  );
  assert(
    !testo.includes('Crediti mancanti secondo la norma'),
    'DOSSIER: nessun totale inventato quando il deficit non è pubblicabile',
  );
  assert(
    testo.includes('Manca data della procedura'),
    'DOSSIER: dato mancante riportato con la sua spiegazione',
  );
  assert(
    testo.includes('Dichiara il settore SSD'),
    'DOSSIER: verifica richiesta riportata',
  );
  assert(
    testo.includes('[NON SODDISFATTO]'),
    'DOSSIER: requisito non soddisfatto elencato',
  );
  assert(testo.includes('12 CFU'), 'DOSSIER: carenza per requisito riportata');
}

/* ------------------------------ 3. Nessun dato dimostrativo ------------------------------ */

function testNessunDatoDemo(): void {
  const testo = creaTestoDossierV1(creaEsitoUtente(ingresso()), CONTESTO);
  for (const vietato of ['A-26', 'A-27', 'A-20', 'demo', 'Demo', 'dimostrativ']) {
    assert(!testo.includes(vietato), `DOSSIER: nessun riferimento dimostrativo ("${vietato}")`);
  }
}

/* ------------------------------ Esecuzione ------------------------------ */

testDossierPositivo();
testDossierDeficitNonPubblicabile();
testNessunDatoDemo();

console.log(`✓ Dossier .txt V1: ${conteggioAssert} assert superati.`);

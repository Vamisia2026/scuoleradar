/**
 * ScuoleRadar.it — Dipartimento CFU · Contratto V1 dell'esito utente (stati di cautela).
 *
 * Verifica le regole che proteggono l'utente da risposte inventate:
 *  - MANUAL_VERIFICATION_REQUIRED non è un "no" e indica cosa verificare;
 *  - NOT_ELIGIBLE indica il requisito decisivo e non mostra un "mancano N CFU"
 *    generico quando il deficit aggregato non è pubblicabile;
 *  - `null` non diventa mai `0`; senza verdetto del motore non si deduce nulla.
 */
import { creaEsitoUtente } from '../calcolatore/esitoUtente';
import { ingresso, requisitoAccesso, requisitoCfu } from './esitoUtenteV1Fixtures';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ 4. MANUAL_VERIFICATION_REQUIRED ------------------------------ */

function testVerificaManuale(): void {
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
    }),
  );
  assert(esito.stato === 'MANUAL_VERIFICATION_REQUIRED', 'MANUALE: stato preservato');
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('Non è un "no"')),
    'MANUALE: non trasformato in un "no"',
  );
  assert(esito.cfuMancantiTotali === null, 'MANUALE: nessun totale pubblicato (mai 0 di comodo)');
  assert(!esito.deficitPubblicabile, 'MANUALE: deficit non pubblicabile');
  assert(
    esito.requisitiMancanti[0]?.cfuMancanti === 12,
    'MANUALE: problema per requisito comunque visibile',
  );
  assert(
    esito.spiegazioneStato.some((frase) =>
      frase.includes('non dichiara se questi CFU siano integrabili'),
    ),
    'MANUALE: integrabilità non dichiarata spiegata',
  );
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('non pubblica un totale')),
    'MANUALE: totale assente dichiarato',
  );
}

/* ------------------------------ 5. NOT_ELIGIBLE ------------------------------ */

function testNonAmmissibile(): void {
  const esito = creaEsitoUtente(
    ingresso({
      esitoMotore: 'NOT_ELIGIBLE',
      motivazione: 'Classe "LM-13" non compresa tra quelle dichiarate ammesse (LM-14).',
      requisiti: [requisitoCfu('r1'), requisitoAccesso('accesso')],
      valutazioni: [
        {
          requisitoId: 'r1',
          stato: 'SODDISFATTO',
          cfuRichiesti: 96,
          cfuPosseduti: 96,
          cfuMancanti: 0,
          spiegazione: ['Soglia raggiunta.'],
        },
        {
          requisitoId: 'accesso',
          stato: 'NON_SODDISFATTO',
          cfuRichiesti: null,
          cfuPosseduti: null,
          cfuMancanti: null,
          spiegazione: ['Classe di laurea non ammessa.'],
        },
      ],
      deficit: {
        calcolabile: false,
        cfuMancantiTotali: null,
        causaDeterminante: 'titolo',
        motivo: 'Requisito di accesso non soddisfatto.',
        perRequisito: [],
      },
    }),
  );
  assert(esito.stato === 'NOT_ELIGIBLE', 'NON AMMISSIBILE: stato preservato');
  assert(esito.requisitiMancanti.length === 1, 'NON AMMISSIBILE: requisito bloccante isolato');
  assert(
    esito.requisitiMancanti[0]!.tipo === 'titolo.accesso.classe',
    'NON AMMISSIBILE: il blocco è il requisito di accesso',
  );
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('non si colma con crediti')),
    'NON AMMISSIBILE: spiegato che i crediti non bastano',
  );
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('Requisito decisivo')),
    'NON AMMISSIBILE: requisito decisivo indicato',
  );
  assert(esito.cfuMancantiTotali === null, 'NON AMMISSIBILE: nessun "mancano N CFU" generico');
}

/* ------------------------------ 6. Regole di integrità ------------------------------ */

function testRegoleIntegrita(): void {
  const senzaVerdetto = creaEsitoUtente(
    ingresso({
      esitoMotore: null,
      motivoNonValutato: 'Copertura normativa non disponibile per questa classe.',
      requisiti: [],
      valutazioni: [],
      deficit: null,
    }),
  );
  assert(
    senzaVerdetto.stato === 'MANUAL_VERIFICATION_REQUIRED',
    'SENZA VERDETTO: degrada a verifica manuale',
  );
  assert(
    senzaVerdetto.esitoTecnico === 'nessun verdetto emesso',
    'SENZA VERDETTO: stato tecnico dichiarato',
  );
  assert(
    senzaVerdetto.spiegazioneStato[0]?.includes('Copertura normativa') === true,
    'SENZA VERDETTO: motivo dichiarato, nessuna deduzione',
  );

  const zeroNonPubblicato = creaEsitoUtente(
    ingresso({
      deficit: {
        calcolabile: false,
        cfuMancantiTotali: 0,
        causaDeterminante: 'nessuna',
        motivo: 'Non pubblicabile.',
        perRequisito: [],
      },
    }),
  );
  assert(!zeroNonPubblicato.deficitPubblicabile, 'GUARDIA: deficit non pubblicabile rispettato');
  assert(zeroNonPubblicato.cfuMancantiTotali === null, 'GUARDIA: 0 non pubblicato come totale');

  const senzaDeficit = creaEsitoUtente(ingresso({ deficit: null }));
  assert(senzaDeficit.cfuMancantiTotali === null, 'GUARDIA: deficit assente → nessun totale');
  assert(senzaDeficit.cfuMancantiPerRequisito.length === 0, 'GUARDIA: nessun deficit inventato');
}

/* ------------------------------ Esecuzione ------------------------------ */

testVerificaManuale();
testNonAmmissibile();
testRegoleIntegrita();

console.log(`✓ Contratto esito utente V1 (stati di cautela): ${conteggioAssert} assert superati.`);

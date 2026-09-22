/**
 * ScuoleRadar.it — Dipartimento CFU · Valutazione V1 sul motore reale (parte 2).
 *
 * Casi di cautela: settore SSD non dichiarato, clausola non raggiunta con
 * integrabilità non dichiarata dalla fonte, copertura delle altre classi.
 * Verifica la regola di prodotto: nessuna incertezza indotta su un positivo
 * già provato, nessun totale inventato quando il motore non lo pubblica.
 */
import { valutaClasseV1 } from '../calcolatore/valutazioneV1';
import {
  classeCoperta,
  DATA_PROCEDURA,
  ESAME_SENZA_SETTORE,
  ESAMI_A11,
  esamiCon,
  esamiSenzaClausolaAntica,
} from './valutazioneV1Fixtures';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ 1. Esame senza settore SSD ------------------------------ */

function testEsameSenzaSettore(): void {
  // (a) Soglie già raggiunte: il settore mancante non può ribaltare il positivo.
  const soglieRaggiunte = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: esamiCon(ESAME_SENZA_SETTORE),
    classeLaurea: 'LM-14',
    dataProcedura: DATA_PROCEDURA,
  });
  assert(
    soglieRaggiunte.utente.stato === 'ELIGIBLE',
    'SSD MANCANTE (a): il positivo provato sui dati conteggiati resta positivo',
  );
  assert(
    soglieRaggiunte.utente.cosaVerificare.length === 0,
    'SSD MANCANTE (a): nessuna incertezza indotta su un positivo già provato',
  );

  // (b) Soglia NON raggiunta + esame senza settore: il settore non viene dedotto.
  const sogliaMancante = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: esamiSenzaClausolaAntica(ESAME_SENZA_SETTORE),
    classeLaurea: 'LM-14',
    dataProcedura: DATA_PROCEDURA,
  });
  assert(
    sogliaMancante.utente.stato === 'MANUAL_VERIFICATION_REQUIRED',
    'SSD MANCANTE (b): il settore non dichiarato richiede verifica (mai dedotto)',
  );
  assert(
    sogliaMancante.utente.cosaVerificare.some((frase) => frase.includes('settore SSD')),
    "SSD MANCANTE (b): l'utente è invitato a dichiarare il settore",
  );
  assert(
    sogliaMancante.utente.cfuMancantiTotali === null,
    'SSD MANCANTE (b): nessun totale di CFU pubblicato',
  );
  assert(
    sogliaMancante.utente.requisitiDaVerificare.length > 0,
    'SSD MANCANTE (b): requisiti non decidibili indicati',
  );
}

/* ------------------------------ 2. Clausola non raggiunta ------------------------------ */

function testClausolaMancante(): void {
  const { utente } = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: esamiSenzaClausolaAntica(),
    classeLaurea: 'LM-14',
    dataProcedura: DATA_PROCEDURA,
  });
  assert(
    utente.stato === 'MANUAL_VERIFICATION_REQUIRED',
    'CLAUSOLA MANCANTE: NOT_SPECIFIED ⇒ verifica manuale, non un "no"',
  );
  assert(!utente.deficitPubblicabile, 'CLAUSOLA MANCANTE: deficit non pubblicabile');
  assert(
    utente.cfuMancantiTotali === null,
    'CLAUSOLA MANCANTE: nessun totale (null non diventa 0)',
  );
  assert(
    utente.requisitiMancanti.some((voce) => voce.cfuMancanti !== null && voce.cfuMancanti > 0),
    'CLAUSOLA MANCANTE: carenze mostrate requisito per requisito',
  );
  assert(
    utente.spiegazioneStato.some((frase) =>
      frase.includes('non dichiara se questi CFU siano integrabili'),
    ),
    'CLAUSOLA MANCANTE: integrabilità non dichiarata spiegata, nessun percorso inventato',
  );
  assert(
    utente.percorsi.length === 0,
    'CLAUSOLA MANCANTE: nessun percorso di integrazione inventato',
  );
}

/* ------------------------------ 3. Copertura A-12 e A-22 ------------------------------ */

function testAltreClassi(): void {
  for (const codice of ['A-12', 'A-22']) {
    const { utente, tecnica } = valutaClasseV1({
      classe: classeCoperta(codice),
      esami: ESAMI_A11,
      classeLaurea: 'LM-14',
      dataProcedura: DATA_PROCEDURA,
    });
    assert(tecnica.engineSource === 'NEW_ENGINE', `${codice}: valutata dal motore`);
    assert(tecnica.esitoMotore !== null, `${codice}: verdetto emesso dal motore`);
    assert(utente.stato === tecnica.esitoMotore, `${codice}: esito utente = verdetto motore`);
    assert(utente.requisiti.length > 0, `${codice}: requisiti strutturati mostrati`);
    assert(utente.classeCodice === codice, `${codice}: classe coerente nell'esito`);
  }
}

/* ------------------------------ Esecuzione ------------------------------ */

testEsameSenzaSettore();
testClausolaMancante();
testAltreClassi();

console.log(`✓ Valutazione V1 sul motore reale (casi di cautela): ${conteggioAssert} assert superati.`);

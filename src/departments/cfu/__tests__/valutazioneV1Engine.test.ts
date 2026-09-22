/**
 * ScuoleRadar.it — Dipartimento CFU · Valutazione V1 sul motore reale (parte 1).
 *
 * Percorso utente end-to-end senza React: `classi.ts` (copertura) →
 * `valutaClasseV1` → `esitoUtente.ts`. Il motore NON viene modificato: si
 * controlla che la V1 mostri SOLO ciò che le regole reali dichiarano e che la
 * data della procedura raggiunga davvero la pipeline.
 */
import { classiCoperteAttive, notaCoperturaV1 } from '../calcolatore/classi';
import { valutaClasseV1 } from '../calcolatore/valutazioneV1';
import { classeCoperta, DATA_PROCEDURA, ESAMI_A11 } from './valutazioneV1Fixtures';

let conteggioAssert = 0;
function assert(condizione: boolean, messaggio: string): void {
  conteggioAssert += 1;
  if (!condizione) {
    throw new Error(`ASSERT FALLITO (${conteggioAssert}): ${messaggio}`);
  }
}

/* ------------------------------ 1. Copertura dichiarata ------------------------------ */

function testCopertura(): void {
  const classi = classiCoperteAttive();
  assert(classi.length === 3, 'COPERTURA: tre classi con regole attive');
  assert(
    classi.map((classe) => classe.codice).join(',') === 'A-11,A-12,A-22',
    'COPERTURA: solo le classi del Core Set',
  );
  for (const classe of classi) {
    assert(classe.denominazione.length > 5, `COPERTURA: denominazione presente (${classe.codice})`);
    assert(
      classe.classiLaureaAmmesse.includes('LM-14'),
      `COPERTURA: classe di laurea ammessa dichiarata (${classe.codice})`,
    );
    assert(classe.fonte.includes('DM 22/12/2023'), `COPERTURA: fonte reale citata (${classe.codice})`);
  }
  const nota = notaCoperturaV1();
  assert(nota.includes('A-11') && nota.includes('A-22'), 'COPERTURA: nota con le classi verificate');
  assert(nota.includes('non vengono proposte'), "COPERTURA: limite dichiarato all'utente");
}

/* ------------------------------ 2. ELIGIBLE dal motore reale ------------------------------ */

function testEligibile(): void {
  const { utente, tecnica } = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: ESAMI_A11,
    classeLaurea: 'LM-14',
    dataProcedura: DATA_PROCEDURA,
  });
  assert(tecnica.engineSource === 'NEW_ENGINE', 'A-11: valutazione dal motore (non legacy)');
  assert(tecnica.esitoMotore === 'ELIGIBLE', 'A-11: verdetto motore ELIGIBLE');
  assert(utente.stato === 'ELIGIBLE', 'A-11: esito utente ELIGIBLE');
  assert(utente.esitoTecnico === tecnica.esitoMotore, 'A-11: autorità coerente con il verdetto');
  assert(utente.requisitiMancanti.length === 0, 'A-11: nessun requisito mancante');
  assert(utente.requisitiDaVerificare.length === 0, 'A-11: nessun requisito da verificare');
  assert(utente.deficitPubblicabile, 'A-11: deficit pubblicabile');
  assert(utente.cfuMancantiTotali === 0, 'A-11: deficit 0 pubblicato');
  assert(utente.requisitiSoddisfatti.length >= 5, 'A-11: requisiti soddisfatti elencati');
  assert(utente.fonti.length > 0, 'A-11: fonti applicate riportate');
  assert(utente.fonti.every((fonte) => fonte.verificata), 'A-11: fonti passate dal Source Gate');
  assert(
    utente.riferimentoNormativo?.includes('DM 22/12/2023') === true,
    'A-11: riferimento normativo mostrato',
  );
  assert(utente.datiMancanti.length === 0, 'A-11: con titolo e data dichiarati non manca nulla');
  assert(utente.cosaVerificare.length === 0, 'A-11: nessuna verifica richiesta');
}

/* ------------------------------ 3. Dati utente mancanti ------------------------------ */

function testDatiMancanti(): void {
  const senzaTitolo = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: ESAMI_A11,
    classeLaurea: null,
    dataProcedura: null,
  });
  assert(
    senzaTitolo.utente.stato === 'MANUAL_VERIFICATION_REQUIRED',
    'SENZA TITOLO: il motore chiede verifica manuale (non "no")',
  );
  assert(
    senzaTitolo.utente.cfuMancantiTotali === null,
    'SENZA TITOLO: nessun totale di CFU pubblicato',
  );
  const etichette = senzaTitolo.utente.datiMancanti.map((dato) => dato.etichetta);
  assert(
    etichette.includes('classe di laurea del titolo'),
    'SENZA TITOLO: la classe di laurea risulta mancante',
  );
  assert(
    etichette.includes('data della procedura'),
    'SENZA TITOLO: la data della procedura risulta mancante',
  );
  assert(
    senzaTitolo.utente.datiMancanti.every((dato) => dato.perche.length > 20),
    'SENZA TITOLO: ogni dato mancante spiega perché serve',
  );
  assert(
    senzaTitolo.utente.requisitiDaVerificare.length > 0,
    'SENZA TITOLO: requisito non decidibile indicato',
  );

  const conData = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: ESAMI_A11,
    classeLaurea: null,
    dataProcedura: DATA_PROCEDURA,
  });
  const etichetteConData = conData.utente.datiMancanti.map((dato) => dato.etichetta);
  assert(
    !etichetteConData.includes('data della procedura'),
    'CON DATA: la data dichiarata non è più mancante (passthrough al motore)',
  );
  assert(
    etichetteConData.includes('classe di laurea del titolo'),
    'CON DATA: resta mancante solo la classe di laurea',
  );

  const conTitolo = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: ESAMI_A11,
    classeLaurea: 'LM-14',
    dataProcedura: null,
  });
  assert(
    conTitolo.utente.stato === 'ELIGIBLE',
    'CON TITOLO: senza data della procedura il verdetto resta positivo',
  );
  assert(
    conTitolo.utente.datiMancanti.map((dato) => dato.etichetta).includes('data della procedura'),
    'CON TITOLO: la data mancante è dichiarata senza bloccare il calcolo',
  );
}

/* ------------------------------ 4. Titolo non ammesso ------------------------------ */

function testTitoloNonAmmesso(): void {
  const { utente, tecnica } = valutaClasseV1({
    classe: classeCoperta('A-11'),
    esami: ESAMI_A11,
    classeLaurea: 'LM-13',
    dataProcedura: DATA_PROCEDURA,
  });
  assert(tecnica.esitoMotore === 'NOT_ELIGIBLE', 'LM-13: verdetto motore NOT_ELIGIBLE');
  assert(utente.stato === 'NOT_ELIGIBLE', 'LM-13: esito utente NOT_ELIGIBLE');
  assert(
    utente.requisitiMancanti.some((voce) => voce.tipo === 'titolo.accesso.classe'),
    'LM-13: il requisito di accesso è quello non soddisfatto',
  );
  assert(
    utente.spiegazioneStato.some((frase) => frase.includes('non si colma con crediti')),
    "LM-13: spiegato che i CFU non sbloccano l'accesso",
  );
  assert(
    utente.cfuMancantiTotali === null || utente.cfuMancantiTotali === 0,
    'LM-13: nessun deficit di CFU positivo inventato',
  );
  assert(
    utente.spiegazioneStato.some((frase) => frase.includes('LM-14')),
    'LM-13: il riferimento alle classi ammesse è mostrato',
  );
}

/* ------------------------------ Esecuzione ------------------------------ */

testCopertura();
testEligibile();
testDatiMancanti();
testTitoloNonAmmesso();

console.log(`✓ Valutazione V1 sul motore reale (base): ${conteggioAssert} assert superati.`);

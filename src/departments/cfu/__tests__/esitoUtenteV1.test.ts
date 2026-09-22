/**
 * ScuoleRadar.it — Dipartimento CFU · Contratto V1 dell'esito utente (stati positivi).
 *
 * Verifica l'ADAPTER PURO (`calcolatore/esitoUtente.ts`) su ELIGIBLE,
 * CONDITIONALLY_ELIGIBLE e INSUFFICIENT_DATA, incluse le regole di contenuto:
 * deficit pubblicato solo se calcolabile, nessun percorso inventato, dati
 * mancanti spiegati con il motivo per cui servono.
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

/* ------------------------------ 1. ELIGIBLE ------------------------------ */

function testEligible(): void {
  const esito = creaEsitoUtente(ingresso());
  assert(esito.stato === 'ELIGIBLE', 'ELIGIBLE: stato preservato dal motore');
  assert(esito.titolo.includes('A-11'), 'ELIGIBLE: titolo con la classe');
  assert(esito.requisitiSoddisfatti.length === 2, 'ELIGIBLE: requisiti soddisfatti elencati');
  assert(esito.requisitiMancanti.length === 0, 'ELIGIBLE: nessun requisito mancante');
  assert(esito.requisitiDaVerificare.length === 0, 'ELIGIBLE: nessun requisito da verificare');
  assert(esito.deficitPubblicabile, 'ELIGIBLE: deficit pubblicabile');
  assert(esito.cfuMancantiTotali === 0, 'ELIGIBLE: deficit a 0 pubblicato');
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('fonti verificate')),
    'ELIGIBLE: fonti citate',
  );
  assert(
    esito.riferimentoNormativo?.includes('DM 22/12/2023') === true,
    'ELIGIBLE: riferimento normativo',
  );
  assert(esito.datiUsati.length === 3, 'ELIGIBLE: dati principali usati');
  assert(esito.fonti.length === 1, 'ELIGIBLE: fonti normative riportate');
  assert(esito.esitoTecnico === 'ELIGIBLE', 'ELIGIBLE: stato tecnico conservato per audit');
}

/* ------------------------------ 2. CONDITIONALLY_ELIGIBLE ------------------------------ */

function testCondizionale(): void {
  const base = ingresso({
    esitoMotore: 'CONDITIONALLY_ELIGIBLE',
    motivazione: 'Integrabilità dichiarata dalla fonte (ALLOWED).',
    requisiti: [requisitoCfu('r1', 'ALLOWED')],
    valutazioni: [
      {
        requisitoId: 'r1',
        stato: 'NON_SODDISFATTO',
        cfuRichiesti: 96,
        cfuPosseduti: 84,
        cfuMancanti: 12,
        spiegazione: ['Deficit calcolato sui dati conteggiati: 12 CFU.'],
      },
    ],
    deficit: {
      calcolabile: true,
      cfuMancantiTotali: 12,
      causaDeterminante: 'cfu',
      motivo: 'Deficit calcolato dai requisiti non soddisfatti.',
      perRequisito: [{ requisitoId: 'r1', cfuMancanti: 12 }],
    },
  });
  const senzaPercorso = creaEsitoUtente(base);
  assert(senzaPercorso.stato === 'CONDITIONALLY_ELIGIBLE', 'CONDIZIONALE: stato preservato');
  assert(senzaPercorso.cfuMancantiTotali === 12, 'CONDIZIONALE: deficit aggregato pubblicato');
  assert(
    senzaPercorso.cfuMancantiPerRequisito[0]?.cfuMancanti === 12,
    'CONDIZIONALE: deficit per requisito etichettato',
  );
  assert(
    senzaPercorso.spiegazioneStato.some((frase) => frase.includes('Da integrare')),
    'CONDIZIONALE: requisito da integrare indicato',
  );
  assert(senzaPercorso.percorsi.length === 0, 'CONDIZIONALE: nessun percorso inventato');
  assert(
    senzaPercorso.spiegazioneStato.some((frase) => frase.includes('non descrive un percorso')),
    'CONDIZIONALE: dichiarato che la fonte non descrive un percorso',
  );

  const conPercorso = creaEsitoUtente({ ...base, percorsi: ['12 CFU in L-ANT/02'] });
  assert(conPercorso.percorsi.length === 1, 'CONDIZIONALE: percorso dichiarato mostrato');
  assert(
    conPercorso.spiegazioneStato.some((frase) => frase.includes('seguendo i passi indicati')),
    'CONDIZIONALE: percorso dichiarato coerente',
  );
}

/* ------------------------------ 3. INSUFFICIENT_DATA ------------------------------ */

function testDatiInsufficienti(): void {
  const esito = creaEsitoUtente(
    ingresso({
      esitoMotore: 'INSUFFICIENT_DATA',
      motivazione: 'Dati insufficienti per il giudizio.',
      requisiti: [requisitoCfu('r1'), requisitoAccesso('accesso')],
      valutazioni: [
        {
          requisitoId: 'r1',
          stato: 'DATI_INSUFFICIENTI',
          cfuRichiesti: 96,
          cfuPosseduti: null,
          cfuMancanti: null,
          spiegazione: ['Esami senza codice disciplinare: il deficit non è escludibile.'],
        },
        {
          requisitoId: 'accesso',
          stato: 'DATI_INSUFFICIENTI',
          cfuRichiesti: null,
          cfuPosseduti: null,
          cfuMancanti: null,
          spiegazione: ['Classe di laurea del titolo non dichiarata.'],
        },
      ],
      deficit: {
        calcolabile: false,
        cfuMancantiTotali: null,
        causaDeterminante: 'nessuna',
        motivo: 'Dati insufficienti: deficit non calcolabile.',
        perRequisito: [],
      },
      datiMancanti: ['classe di laurea del titolo'],
      codiciMancanti: true,
    }),
  );
  assert(esito.stato === 'INSUFFICIENT_DATA', 'INSUFFICIENTI: stato preservato');
  assert(esito.datiMancanti.length === 1, 'INSUFFICIENTI: dato mancante elencato');
  assert(
    esito.datiMancanti[0]!.etichetta === 'classe di laurea del titolo',
    'INSUFFICIENTI: etichetta del dato mancante',
  );
  assert(esito.datiMancanti[0]!.perche.length > 20, 'INSUFFICIENTI: motivo per cui serve il dato');
  assert(esito.requisitiDaVerificare.length === 2, 'INSUFFICIENTI: requisiti non decidibili elencati');
  assert(esito.cfuMancantiTotali === null, 'INSUFFICIENTI: nessun totale di CFU mancanti');
  assert(!esito.deficitPubblicabile, 'INSUFFICIENTI: deficit non pubblicabile');
  assert(
    esito.cosaVerificare.some((frase) => frase.includes('settore SSD')),
    'INSUFFICIENTI: richiesta esplicita del settore SSD',
  );
  assert(
    esito.spiegazioneStato.some((frase) => frase.includes('Aggiungi le informazioni mancanti')),
    'INSUFFICIENTI: invito a completare i dati',
  );
}

/* ------------------------------ Esecuzione ------------------------------ */

testEligible();
testCondizionale();
testDatiInsufficienti();

console.log(`✓ Contratto esito utente V1 (stati positivi): ${conteggioAssert} assert superati.`);

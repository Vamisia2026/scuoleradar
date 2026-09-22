/**
 * ScuoleRadar.it — Dipartimento CFU · INVARIANTI dello stato aggregato.
 *
 * Sweep esaustivo sullo spazio dei vettori di stato (1-3 requisiti) × le
 * dichiarazioni di integrabilità possibili, per dimostrare che l'aggregazione di
 * PRODUZIONE (`pipeline/status.ts`) è CONSERVATIVA:
 *  G1 uno stato rischioso (dato mancante, incerto, non valutabile), un conflitto
 *     o un contesto non risolto non possono produrre un verdetto positivo;
 *  G2 ELIGIBLE ⟺ tutti i requisiti sono conclusivamente soddisfatti;
 *  G3 l'introduzione di uno stato rischioso non può migliorare il verdetto;
 *  G3b un deficit dichiarato integrabile non è mai peggiore di uno semplice;
 *  G4 CONDITIONALLY_ELIGIBLE richiede una dichiarazione ESPLICITA di integrabilità.
 *
 * Invarianti aggiuntivi (fase 4):
 *  D1 un dato mancante (utente o normativo) non produce MAI NOT_ELIGIBLE da solo;
 *  D2 una negativa accertata da fonte (titolo/accesso) resta negativa anche con
 *     dati mancanti non correlati;
 *  D3 conflitto, tipo non gestito e contesto non risolto non sono mai positivi;
 *  D4 una disgiunzione è positiva SOLO con almeno un ramo conclusivo (A3).
 *
 * ⚠️ Confine di autorità: il verdetto per UI/report resta `valutaRequisitoClasse`.
 */
import {
  aggregaStatoRequisiti,
  esitoDisgiunzione,
  STATI_RISCHIOSI,
  verdettoPositivo,
  type StatoRequisitoAggregato,
} from '../pipeline/status';
import {
  assert,
  conIntegrabilita,
  conteggioAsserzioni,
  contesto,
  daVettore,
  requisito,
  requisitoConRami,
  tuttiIVettori,
} from './statusSpecFixtures';
import type { EsitoValutazione, IntegrabilitaStatus } from '../types';

// A5: l'integrabilità è un fatto del requisito (dichiarata dalla fonte). Lo sweep
// la applica a TUTTI i requisiti CFU del vettore: le dichiarazioni miste
// (requisito integrabile + requisito vietato) sono verificate a parte.
const DICHIARAZIONI: readonly IntegrabilitaStatus[] = ['NOT_SPECIFIED', 'ALLOWED', 'PROHIBITED'];

/** Vettori di prova: 1..3 requisiti (7 + 49 + 343). */
const VETTORI: readonly StatoRequisitoAggregato[][] = [...tuttiIVettori(1), ...tuttiIVettori(2), ...tuttiIVettori(3)];

function rango(stato: EsitoValutazione): number {
  return stato === 'ELIGIBLE' ? 2 : stato === 'CONDITIONALLY_ELIGIBLE' ? 1 : 0;
}

function testInvariantiDiSicurezza(): void {
  assert(VETTORI.length === 7 + 49 + 343, 'spazio dei vettori completo (1-3 requisiti)');

  for (const integrabilita of DICHIARAZIONI) {
    for (const vettore of VETTORI) {
      const esito = aggregaStatoRequisiti(daVettore(vettore, integrabilita));
      const rischioso = vettore.some((stato) => STATI_RISCHIOSI.includes(stato));

      // G1: uno stato rischioso non può produrre un verdetto positivo.
      if (rischioso) {
        assert(!verdettoPositivo(esito.stato), `G1: stato rischioso (${vettore.join('+')}) non può dare ${esito.stato}`);
      }
      // G2: ELIGIBLE solo con TUTTI i requisiti soddisfatti (e almeno uno).
      if (esito.stato === 'ELIGIBLE') {
        assert(vettore.length > 0 && vettore.every((stato) => stato === 'SODDISFATTO'), `G2: ELIGIBLE solo con tutti i requisiti soddisfatti (${vettore.join('+')})`);
      }
      // G4: CONDITIONALLY_ELIGIBLE solo con integrazione DICHIARATA dal requisito.
      if (esito.stato === 'CONDITIONALLY_ELIGIBLE') {
        assert(
          vettore.some((stato) => stato === 'NON_SODDISFATTO_INTEGRABILE') ||
            (vettore.some((stato) => stato === 'NON_SODDISFATTO') && integrabilita === 'ALLOWED'),
          `G4: CONDITIONALLY solo con integrazione dichiarata (${vettore.join('+')} / ${integrabilita})`,
        );
      }
      // D1: nessun dato mancante/incerto produce una negativa (senza deficit accertato).
      if (!vettore.some((stato) => stato === 'NON_SODDISFATTO' || stato === 'NON_SODDISFATTO_INTEGRABILE')) {
        assert(esito.stato !== 'NOT_ELIGIBLE', `D1: senza deficit accertato nessuna negativa (${vettore.join('+')} → ${esito.stato})`);
      }
    }
  }
  console.log(`  ✓ G1/G2/G4/D1 su ${VETTORI.length * DICHIARAZIONI.length} combinazioni (1-3 requisiti × integrabilità).`);
}

function testMonotonicitaIncertezza(): void {
  const vettori = [...tuttiIVettori(1), ...tuttiIVettori(2)];
  let coppie = 0;

  for (const integrabilita of DICHIARAZIONI) {
    for (const vettore of vettori) {
      const base = aggregaStatoRequisiti(daVettore(vettore, integrabilita));
      for (let indice = 0; indice < vettore.length; indice += 1) {
        for (const rischioso of STATI_RISCHIOSI) {
          if (vettore[indice] === rischioso) continue;
          const modificato = [...vettore];
          modificato[indice] = rischioso;
          const esito = aggregaStatoRequisiti(daVettore(modificato, integrabilita));
          coppie += 1;
          // G3: l'incertezza non migliora MAI il verdetto.
          assert(!verdettoPositivo(esito.stato), `G3: ${vettore.join('+')} → ${modificato.join('+')} non può dare ${esito.stato}`);
          assert(
            rango(esito.stato) <= rango(base.stato),
            `G3: ${vettore.join('+')} → ${modificato.join('+')} non può migliorare (${base.stato} → ${esito.stato})`,
          );
        }
      }
    }
  }
  assert(coppie > 0, 'G3: coppie di confronto verificate');
  console.log(`  ✓ G3 (monotonicità dell'incertezza): ${coppie} coppie verificate.`);
}

function testIntegrabileNonPeggioreDelSemplice(): void {
  // G3b: un deficit dichiarato INTEGRABILE dalle fonti non è mai peggiore di un
  // deficit "semplice" (evidenza in più, non deduzione).
  const vettori = [...tuttiIVettori(1), ...tuttiIVettori(2)];
  for (const integrabilita of DICHIARAZIONI) {
    for (const vettore of vettori) {
      for (let indice = 0; indice < vettore.length; indice += 1) {
        if (vettore[indice] === 'SODDISFATTO') continue;
        const conIntegrabile = [...vettore];
        conIntegrabile[indice] = 'NON_SODDISFATTO_INTEGRABILE';
        const conSemplice = [...vettore];
        conSemplice[indice] = 'NON_SODDISFATTO';
        assert(
          rango(aggregaStatoRequisiti(daVettore(conIntegrabile, integrabilita)).stato) >=
            rango(aggregaStatoRequisiti(daVettore(conSemplice, integrabilita)).stato),
          `G3b: deficit integrabile non peggiore del semplice (${conIntegrabile.join('+')} / ${integrabilita})`,
        );
      }
    }
  }
  console.log('  ✓ G3b: integrabilità dichiarata mai peggiore del deficit semplice.');
}

function testNegativaAccertataResiste(): void {
  // D2: un titolo/accesso non soddisfatto (negativa accertata da fonte) resta
  // NOT_ELIGIBLE anche se altri requisiti hanno dati mancanti o deficit integrabili.
  const altri: readonly StatoRequisitoAggregato[] = [
    'SODDISFATTO',
    'NON_SODDISFATTO',
    'NON_SODDISFATTO_INTEGRABILE',
    'DATO_UTENTE_MANCANTE',
  ];
  let combinazioni = 0;
  for (const integrabilita of DICHIARAZIONI) {
    for (const primo of altri) {
      for (const secondo of altri) {
        combinazioni += 1;
        const esito = aggregaStatoRequisiti(
          contesto(
            conIntegrabilita(
              [
                requisito('titolo', 'NON_SODDISFATTO', 'titolo'),
                requisito('cfu', primo),
                requisito('r3', secondo),
              ],
              integrabilita,
            ),
          ),
        );
        assert(
          esito.stato === 'NOT_ELIGIBLE' && esito.regola === 'R4-titolo-non-soddisfatto',
          `D2: negativa accertata non ribaltata (${primo}+${secondo} / ${integrabilita} → ${esito.stato})`,
        );
      }
    }
  }
  console.log(`  ✓ D2: negativa accertata da fonte mai ribaltata da dati mancanti (${combinazioni} combinazioni).`);
}


function testRischiIntrinseciMaiPositivi(): void {
  // D3: conflitto, tipo non gestito e contesto non risolto non sono mai positivi.
  const soddisfatti = [requisito('r1', 'SODDISFATTO'), requisito('r2', 'SODDISFATTO')];
  const casi: { etichetta: string; stato: EsitoValutazione }[] = [
    {
      etichetta: 'conflitto fra fonti',
      stato: aggregaStatoRequisiti(contesto(soddisfatti, { conflitti: ['c1'] })).stato,
    },
    {
      etichetta: 'tipo non gestito',
      stato: aggregaStatoRequisiti(contesto([...soddisfatti, requisito('r3', 'NON_VALUTABILE')])).stato,
    },
    {
      etichetta: 'contesto non risolto per dati utente',
      stato: aggregaStatoRequisiti(contesto(soddisfatti, { causaContesto: 'dato-utente' })).stato,
    },
    {
      etichetta: 'contesto non risolto per causa normativa',
      stato: aggregaStatoRequisiti(contesto(soddisfatti, { causaContesto: 'normativa' })).stato,
    },
    {
      etichetta: 'nessuna regola applicabile',
      stato: aggregaStatoRequisiti(contesto(soddisfatti, { regoleApplicabili: 0 })).stato,
    },
  ];
  for (const caso of casi) {
    assert(!verdettoPositivo(caso.stato), `D3: ${caso.etichetta} non può dare ${caso.stato}`);
  }
  console.log('  ✓ D3: conflitto, tipo non gestito e contesto non risolto mai positivi.');
}

function testDisgiunzioneSoloConRamoConclusivo(): void {
  // D4 (A3): il requisito disgiuntivo è positivo SOLO se un ramo è conclusivo
  // (`SODDISFATTO`): un ramo "completibile" o incerto non basta mai.
  const vettoriRami: readonly StatoRequisitoAggregato[][] = [
    ...tuttiIVettori(1),
    ...tuttiIVettori(2),
    ...tuttiIVettori(3),
  ];
  let verifiche = 0;
  for (const rami of vettoriRami) {
    const conclusivo = rami.some((stato) => stato === 'SODDISFATTO');
    const collassato = esitoDisgiunzione(rami.map((stato, indice) => ({ id: `ramo-${indice}`, stato })));
    assert(
      (collassato === 'SODDISFATTO') === conclusivo,
      `D4: collasso ${rami.join('+')} coerente con la presenza di un ramo conclusivo`,
    );
    const esito = aggregaStatoRequisiti(
      contesto([requisitoConRami('disgiunzione', rami), requisito('altro', 'SODDISFATTO')]),
    );
    // L'OR è CONCLUSIVAMENTE soddisfatto ⟺ un ramo è conclusivo; la piena idoneità
    // richiede quel ramo (un ramo solo completibile può dare al più il condizionale).
    assert(
      (esito.stato === 'ELIGIBLE') === conclusivo,
      `D4: ${rami.join('+')} → ${esito.stato} (ELIGIBLE solo con ramo conclusivo)`,
    );
    verifiche += 2;
  }
  assert(esitoDisgiunzione([]) === 'NON_VALUTABILE', 'D4: disgiunzione senza rami non è valutabile');
  console.log(`  ✓ D4: OR positivo solo con ramo conclusivo (${verifiche} verifiche sui rami).`);
}

function main(): void {
  console.log('Invarianti dello stato aggregato (autorità interna della pipeline)');
  testInvariantiDiSicurezza();
  testMonotonicitaIncertezza();
  testIntegrabileNonPeggioreDelSemplice();
  testNegativaAccertataResiste();
  testRischiIntrinseciMaiPositivi();
  testDisgiunzioneSoloConRamoConclusivo();
  console.log(`\nTutti i ${conteggioAsserzioni()} assert sono passati.`);
}

main();


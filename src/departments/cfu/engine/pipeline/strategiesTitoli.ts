/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/strategiesTitoli.
 *
 * STRATEGIE DEI REQUISITI DI TITOLO:
 *  - `titolo.abilitante` → requisito duro dichiarato dalla fonte;
 *  - `titolo.accesso.classe` → classi di laurea ammesse (verifica tristate).
 * Riusano le primitive del solver (`valutaVincolo`, `verificaClasseLaurea`).
 */
import { valutaVincolo, verificaClasseLaurea } from '../requirementSolver';
import { vincoloDaRequisito } from './conversions';
import { contestoSolver, nonValutabile, VALORI_NON_CFU, type ValutatoreRequisito } from './strategyTypes';

/** Strategia del requisito duro (titolo abilitante) dichiarato dalla fonte. */
export const valutaRequisitoTitoloAbilitante: ValutatoreRequisito = (requisito, contesto) => {
  const vincolo = vincoloDaRequisito(requisito);
  if (!vincolo || vincolo.tipo !== 'titoloAbilitante') {
    return nonValutabile('NON_VALUTABILE', [
      'Requisito titolo non ricostruibile dal vincolo dichiarato: nessun giudizio.',
    ]);
  }
  const { esito } = valutaVincolo(vincolo, contestoSolver(contesto));
  return {
    stato: esito.soddisfatto ? 'SODDISFATTO' : 'NON_SODDISFATTO',
    valori: VALORI_NON_CFU,
    datiUsati: [],
    provenienzaDati: [],
    spiegazione: [
      `Titolo abilitante: ${vincolo.denominazione} (necessario: ${vincolo.necessario ? 'sì' : 'no'}).`,
      esito.soddisfatto
        ? 'La fonte non lo richiede come condizione necessaria.'
        : 'La fonte lo richiede come condizione necessaria: nessun CFU lo sostituisce.',
    ],
  };
};

/**
 * Strategia della classe di accesso al titolo: riusa ESATTAMENTE la verifica
 * tristate del solver (`verificaClasseLaurea`), così requisito strutturato e
 * decisore aggregato non possono divergere.
 */
export const valutaRequisitoAccessoClasse: ValutatoreRequisito = (requisito, contesto) => {
  const verifica = verificaClasseLaurea([...contesto.regole], contesto.titolo);
  if (verifica.esito === 'not-eligible') {
    return nonValutabile('NON_SODDISFATTO', [
      verifica.motivazione ?? 'Classe di laurea non ammessa dalle regole applicabili.',
      'Requisito di accesso: non è un deficit di CFU e non è integrabile con crediti.',
    ]);
  }
  if (verifica.esito === 'non-verificabile') {
    return nonValutabile('DATI_INSUFFICIENTI', [
      verifica.motivazione ?? 'Classe di laurea del titolo non dichiarata.',
    ]);
  }
  const ammesse =
    requisito.parametri.tipo === 'titolo.accesso.classe'
      ? requisito.parametri.classiAmmesse.join(', ')
      : '-';
  return {
    stato: 'SODDISFATTO',
    valori: VALORI_NON_CFU,
    datiUsati: [],
    provenienzaDati: [],
    spiegazione: [
      `Classi ammesse dichiarate: ${ammesse}.`,
      'La classe del titolo rientra fra quelle dichiarate ammesse.',
    ],
  };
};

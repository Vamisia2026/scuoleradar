/**
 * ScuoleRadar.it — Dipartimento CFU · Fixture del contratto V1 dell'esito utente.
 *
 * Sostituiscono il motore: costruiscono un `IngressoEsitoUtente` completo e
 * leggibile, così le suite verificano il CONTRATTO dell'adapter (stati,
 * deficit, testi) senza dipendere da una regola normativa specifica.
 */
import type { IngressoEsitoUtente } from '../calcolatore/esitoUtente';
import type { RequisitoMotore } from '../calcolatore/requisitoUtente';

/** Requisito di CFU (gruppo SSD) con integrabilità dichiarabile. */
export function requisitoCfu(
  id: string,
  integrabilita: RequisitoMotore['integrabilita'] = 'NOT_SPECIFIED',
): RequisitoMotore {
  return {
    id,
    tipo: 'cfu.ssd.gruppo',
    parametri: { tipo: 'cfu.ssd.gruppo', ssd: ['L-FIL-LET/', 'L-ANT/'], min: 96 },
    integrabilita,
    estratto: 'almeno 96 CFU nei settori scientifico-disciplinari L-FIL-LET/, L-ANT/',
    posizioneFonte: 'G.U. 10/02/2024 - Tabella A - Classe A-11',
  };
}

/** Requisito di accesso (classi di laurea ammesse). */
export function requisitoAccesso(id: string): RequisitoMotore {
  return {
    id,
    tipo: 'titolo.accesso.classe',
    parametri: { tipo: 'titolo.accesso.classe', classiAmmesse: ['LM-14'] },
    integrabilita: 'NOT_SPECIFIED',
    estratto: null,
    posizioneFonte: null,
  };
}

/** Ingresso completo e valido: caso base "tutto soddisfatto" su A-11. */
export function ingresso(override: Partial<IngressoEsitoUtente> = {}): IngressoEsitoUtente {
  return {
    classeCodice: 'A-11',
    classeDenominazione: 'Discipline letterarie e latino',
    esitoMotore: 'ELIGIBLE',
    motivazione: 'Tutti i vincoli dichiarati sono soddisfatti.',
    esamiConsiderati: 6,
    cfuConteggiati: 96,
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
        stato: 'SODDISFATTO',
        cfuRichiesti: null,
        cfuPosseduti: null,
        cfuMancanti: null,
        spiegazione: ['Classe LM-14 ammessa.'],
      },
    ],
    deficit: {
      calcolabile: true,
      cfuMancantiTotali: 0,
      causaDeterminante: 'nessuna',
      motivo: 'Tutti i requisiti soddisfatti.',
      perRequisito: [],
    },
    fonti: [
      {
        fonte: 'DM 22/12/2023 - Tabella A - A-11',
        riferimento: 'G.U. 10/02/2024',
        verificata: true,
      },
    ],
    conflitti: 0,
    datiMancanti: [],
    codiciMancanti: false,
    cfuNonValidi: false,
    riferimentoNormativo: 'DM 22/12/2023 · Tabella A · agg. 2024-02-10',
    ...override,
  };
}

/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/strategies.
 *
 * STAGE 5 — REGISTRO DELLE STRATEGIE DI VALUTAZIONE DEI REQUISITI.
 * Un valutatore per TIPO di requisito: aggiungere una classe di concorso (o un
 * nuovo tipo di requisito) significa registrare dati + una strategia, MAI
 * scrivere funzioni per classe (niente `checkA11()`).
 *
 * Le implementazioni built-in sono in `strategiesCfu` e `strategiesTitoli`;
 * il contratto dei tipi è in `strategyTypes`.
 */
import { valutaRequisitoCfu } from './strategiesCfu';
import { valutaRequisitoAccessoClasse, valutaRequisitoTitoloAbilitante } from './strategiesTitoli';
import type { RegistroStrategieRequisito, ValutatoreRequisito } from './strategyTypes';

export * from './strategyTypes';
export * from './strategiesCfu';
export * from './strategiesTitoli';

/** Tipi di requisito il cui esito è coperto dal decisore normativo aggregato. */
export const TIPI_GESTITI_DALL_AGGREGATORE: readonly string[] = [
  'cfu.ssd.singolo',
  'cfu.ssd.gruppo',
  'cfu.ssd.disgiunzione',
  'titolo.abilitante',
  'titolo.accesso.classe',
];

function costruisci(
  voci: Readonly<Record<string, ValutatoreRequisito>>,
): RegistroStrategieRequisito {
  const congelato = Object.freeze({ ...voci });
  return {
    valutatori: congelato,
    tipiRegistrati: Object.freeze(Object.keys(congelato).sort()),
    valutatore: (tipo: string) => congelato[tipo],
  };
}

/** Registro con SOLO le strategie indicate (test/mock o classi specializzate). */
export function creaRegistroStrategie(
  voci: Readonly<Record<string, ValutatoreRequisito>>,
): RegistroStrategieRequisito {
  return costruisci(voci);
}

/** Registro di DEFAULT del motore (strategie built-in). */
export const REGISTRO_STRATEGIE_DEFAULT: RegistroStrategieRequisito = costruisci({
  'cfu.ssd.singolo': valutaRequisitoCfu,
  'cfu.ssd.gruppo': valutaRequisitoCfu,
  'cfu.ssd.disgiunzione': valutaRequisitoCfu,
  'titolo.abilitante': valutaRequisitoTitoloAbilitante,
  'titolo.accesso.classe': valutaRequisitoAccessoClasse,
});

/** Estende un registro esistente con nuove strategie (le voci nuove vincono). */
export function estendiRegistroStrategie(
  registro: RegistroStrategieRequisito,
  voci: Readonly<Record<string, ValutatoreRequisito>>,
): RegistroStrategieRequisito {
  return costruisci({ ...registro.valutatori, ...voci });
}

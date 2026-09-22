/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/types.
 *
 * FACCIATA dei modelli della pipeline universale: riesporta il modulo foglia
 * `resultTypes` (vocabolario condiviso + record canonici), `stageTypes`
 * (identificazione, fonti, normalizzazione) e `dossierTypes` (contratto del
 * fascicolo accademico persistente), mantenendo valido il percorso di import
 * storico usato dai moduli interni della pipeline.
 *
 * I modelli del requisito e il risultato della pipeline sono in
 * `requirementTypes.ts`.
 */
export * from './resultTypes';
export * from './stageTypes';
export * from './dossierTypes';




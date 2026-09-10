/**
 * ScuoleRadar.it — Dipartimento CFU · Motore di calcolo (foundation).
 *
 * Riceve gli esami riconosciuti (manuali, incollati o da documento) e produce
 * l'orientamento strutturato: CFU per ambito disciplinare, punti di forza, classi
 * accessibili e obiettivi secondari con il dettaglio dei CFU mancanti.
 *
 * NB: la matrice di classi qui sotto è la versione DEMO di avvio; la versione
 * produttiva caricherà le Tabelle A/B ufficiali (D.P.R. 19/2016) validata.
 * Ogni classe esposta marca `requisitiDemo: true` e la UI mostra il disclaimer.
 */

import {
  ETICHETTE_AMBITI,
  type AmbitoDisciplinare,
  type ClasseDiConcorso,
  type CoperturaAmbito,
  type DiagnosiCFU,
  type Esame,
  type EsitoClasse,
} from '../shared/types';
import { ambitoDaCodiceSsd, denominazioneSsd } from '../shared/ssdMatrix';
import { DISCLAIMER_INDICATIVO } from '../shared/normativa';

/* ------------------------------ Delegazione progressiva al CFU Engine ------------------------------ */

import {
  valutaClasseViaEngineBridge,
} from '../engine/bridge/legacyAdapter';
import {
  NORMATIVA_REF_DM22,
  assicuraCatalogoEngineDiDefault,
  registroEngineDiDefault,
} from '../engine/seeds/progressiveRegistry';
import type { NormativaApplicata } from '../engine/types';
import type { SourceRegistry } from '../engine/traceability/sourceRegistry';

/** Classi target della fondazione (matrice dimostrativa di 3 classi). */
export const CLASSI_DI_CONCORSO_MATRICE: ClasseDiConcorso[] = [
  {
    codice: 'A-26',
    denominazione: 'Matematica',
    tabella: 'A',
    ordineScuola: 'secondaria-2-grado',
    requisiti: [{ ambito: 'matematico-informatico', cfuRichiesti: 24 }],
    requisitiDemo: true,
  },
  {
    codice: 'A-27',
    denominazione: 'Matematica e Fisica',
    tabella: 'A',
    ordineScuola: 'secondaria-2-grado',
    requisiti: [
      { ambito: 'matematico-informatico', cfuRichiesti: 24 },
      { ambito: 'fisico', cfuRichiesti: 18 },
    ],
    requisitiDemo: true,
  },
  {
    codice: 'A-20',
    denominazione: 'Fisica',
    tabella: 'A',
    ordineScuola: 'secondaria-2-grado',
    requisiti: [{ ambito: 'fisico', cfuRichiesti: 24 }],
    requisitiDemo: true,
  },
];

/* ------------------------------ Routing esplicito: NEW_ENGINE / LEGACY_FALLBACK ------------------------------ */

/** Motore che ha effettivamente prodotto l'esito. */
export type EngineSource = 'NEW_ENGINE' | 'LEGACY_FALLBACK';

/** Esito legacy-compatibile con metadati espliciti di routing. */
export interface EsitoClasseConRouting extends EsitoClasse {
  readonly engineSource: EngineSource;
  readonly isEngineDriven: boolean;
}

export interface ParametriValutazioneRouting {
  readonly esami: Esame[];
  readonly classeCodice: string;
  /** Etichetta legacy (usata se la classe non è nella matrice demo). */
  readonly denominazione?: string;
  readonly tabella?: 'A' | 'B';
  /** Registro engine alternativo (default: registro condiviso progressive). */
  readonly registryEngine?: SourceRegistry;
  /** Contesto normativo alternativo (default: DM 22/12/2023 via progressive). */
  readonly normativaEngine?: NormativaApplicata;
  /** Classe di laurea del titolo (es. "LM-14") per il check engine. */
  readonly classeLaureaTitolo?: string;
}

/** Classe demo legacy per codice (o null se non presente nella matrice). */
function classeDemoPerCodice(codice: string): ClasseDiConcorso | undefined {
  return CLASSI_DI_CONCORSO_MATRICE.find((classe) => classe.codice === codice);
}

/**
 * Fallback legacy esplicito: calcola con la logica DEMO storica (ambiti) se la
 * classe è nella matrice; per classi ignote restituisce uno shape compatibile
 * non accessibile (nessuna eccezione, nessuna invenzione di requisiti).
 */
function valutaClasseConFallbackLegacy(
  parametri: ParametriValutazioneRouting,
): EsitoClasseConRouting {
  const classeDemo = classeDemoPerCodice(parametri.classeCodice);
  if (classeDemo) {
    const coperture = cfuPerAmbito(parametri.esami);
    const esito = valutaClasse(classeDemo, coperture);
    return { ...esito, engineSource: 'LEGACY_FALLBACK', isEngineDriven: false };
  }
  const classe: ClasseDiConcorso = {
    codice: parametri.classeCodice,
    denominazione: parametri.denominazione ?? parametri.classeCodice,
    tabella: parametri.tabella ?? 'A',
    ordineScuola: 'secondaria-2-grado',
    requisiti: [],
    requisitiDemo: false,
  };
  return {
    classe,
    coperture: [],
    cfuMancanti: 0,
    accessibile: false,
    engineSource: 'LEGACY_FALLBACK',
    isEngineDriven: false,
  };
}

/**
 * ENTRY POINT DI ROUTING: prova PRIMA il motore data-driven (SourceRegistry +
 * legacyAdapter) quando esistono regole ATTIVE per la classe; altrimenti esegue
 * la logica legacy originale. Mai eccezioni non gestite.
 */
export function valutaClasseConRouting(
  parametri: ParametriValutazioneRouting,
): EsitoClasseConRouting {
  const registry = parametri.registryEngine ?? registroEngineDiDefault;
  const normativa = parametri.normativaEngine ?? NORMATIVA_REF_DM22;
  if (!parametri.registryEngine) {
    assicuraCatalogoEngineDiDefault();
  }

  try {
    const attive = registry.cercaPerClasseConcorso(parametri.classeCodice).regoleAttive;
    if (attive.length > 0) {
      const bridge = valutaClasseViaEngineBridge({
        esami: parametri.esami,
        classeCodice: parametri.classeCodice,
        registry,
        denominazioneClasse: parametri.denominazione,
        tabella: parametri.tabella ?? 'A',
        normativa,
        classeLaureaTitolo: parametri.classeLaureaTitolo,
      });
      // Se il Bridge segnala un fallback interno (nessuna regola traducibile)
      // eseguiamo regolarmente la logica legacy.
      if (bridge.motivoFallback) {
        return valutaClasseConFallbackLegacy(parametri);
      }
      return { ...bridge, engineSource: 'NEW_ENGINE' as const, isEngineDriven: true };
    }
    return valutaClasseConFallbackLegacy(parametri);
  } catch {
    // Mai propagare: in caso di errore imprevisto torna la logica legacy.
    return valutaClasseConFallbackLegacy(parametri);
  }
}

/** Riepilogo CFU posseduti per ambito (esclude gli ambiti a zero, salvo 'altro'). */
export function cfuPerAmbito(esami: Esame[]): CoperturaAmbito[] {
  const mappa = new Map<AmbitoDisciplinare, number>();
  for (const esame of esami) {
    const ambito = ambitoDaCodiceSsd(esame.ssd);
    const valore = (esame.cfu ?? 0) > 0 ? esame.cfu : 0;
    mappa.set(ambito, (mappa.get(ambito) ?? 0) + valore);
  }
  return [...mappa.entries()]
    .filter(([, cfu]) => cfu > 0)
    .map(([ambito, cfu]) => ({ ambito, cfuPosseduti: Math.round(cfu * 10) / 10 }))
    .sort((a, b) => b.cfuPosseduti - a.cfuPosseduti);
}

function valutaClasse(classe: ClasseDiConcorso, coperture: CoperturaAmbito[]): EsitoClasse {
  let cfuMancanti = 0;
  const perClasse: CoperturaAmbito[] = [];
  for (const requisito of classe.requisiti) {
    const posseduti =
      coperture.find((c) => c.ambito === requisito.ambito)?.cfuPosseduti ?? 0;
    perClasse.push({ ambito: requisito.ambito, cfuPosseduti: posseduti });
    cfuMancanti += Math.max(0, requisito.cfuRichiesti - posseduti);
  }
  return {
    classe,
    coperture: perClasse,
    cfuMancanti: Math.round(cfuMancanti * 10) / 10,
    accessibile: cfuMancanti === 0,
  };
}

/** Punti di forza testuali ricavati dagli ambiti con più CFU. */
function puntiDiForza(coperture: CoperturaAmbito[]): string[] {
  const top = coperture.slice(0, 3);
  if (top.length === 0) {
    return ['Nessun esame riconosciuto: completa almeno un esame per iniziare il calcolo.'];
  }
  return top.map(
    (c) =>
      `${c.cfuPosseduti} CFU nell\u2019ambito ${ETICHETTE_AMBITI[c.ambito]}${c.ambito === 'altro' ? ' (SSD non in catalogo)' : ''}`,
  );
}

/** Esegue il calcolo del percorso di studi e restituisce l'orientamento strutturato. */
export function analizzaPercorsoDiStudi(
  esami: Esame[],
  opzioni?: { registryEngine?: SourceRegistry; normativaEngine?: NormativaApplicata },
): DiagnosiCFU {
  const coperture = cfuPerAmbito(esami);
  const esiti = CLASSI_DI_CONCORSO_MATRICE.map((classe) =>
    valutaClasseConRouting({
      esami,
      classeCodice: classe.codice,
      denominazione: classe.denominazione,
      tabella: classe.tabella,
      registryEngine: opzioni?.registryEngine,
      normativaEngine: opzioni?.normativaEngine,
    }),
  );
  const accessibili = esiti.filter((e) => e.accessibile);
  const secondarie = esiti
    .filter((e) => !e.accessibile)
    .sort((a, b) => a.cfuMancanti - b.cfuMancanti)
    .slice(0, 3);

  const senzaSsd = esami.filter((e) => !e.ssd).length;
  const note: string[] = [];
  if (senzaSsd > 0) {
    note.push(
      `${senzaSsd} esame/i senza SSD riconosciuto: attribuisci il settore per un calcolo completo.`,
    );
  }
  const ssdSconosciuti = esami.filter((e) => e.ssd && !denominazioneSsd(e.ssd)).length;
  if (ssdSconosciuti > 0) {
    note.push(`${ssdSconosciuti} SSD non ancora presenti nel catalogo: verranno conteggiati come "Altro".`);
  }

  return {
    esamiAnalizzati: esami,
    cfuTotali: Math.round(esami.reduce((somma, e) => somma + (e.cfu ?? 0), 0) * 10) / 10,
    cfuPerAmbito: coperture,
    puntiDiForza: puntiDiForza(coperture),
    classiAccessibili: accessibili,
    classiSecondarie: secondarie,
    dataAnalisi: new Date().toISOString(),
    notaMetodologica: note.length > 0 ? note.join(' ') : DISCLAIMER_INDICATIVO,
  };
}

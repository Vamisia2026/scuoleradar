/**
 * ScuoleRadar.it — Dipartimento CFU · engine/pipeline/requirements.
 *
 * STAGE 4 — RISOLUZIONE DEI REQUISITI.
 * Dalle regole autorevoli deriva i REQUISITI STRUTTURATI (id, tipo, parametri,
 * fonti, vigenza, strategia), li raggruppa per CHIAVE LOGICA e ne calcola
 * l'impronta dei parametri (base del confronto fra fonti). Le conversioni
 * requisito ↔ vincolo sono in `conversions.ts`.
 */
import type { NormativeRuleEntry, VincoloCfu } from '../types';
import { classiAmmesseDalleRegole } from '../requirementSolver';
import {
  naturaDaTipo,
  parametriDaVincolo,
  STRATEGIA_PER_TIPO,
  tipoRequisitoDaVincolo,
  type FinestraVigenza,
} from './conversions';
import type { DefinizioneRequisito, TipoRequisito } from './requirementTypes';

/** Chiave logica indipendente dalla fonte: individua lo STESSO requisito. */
export function chiaveLogicaRequisito(requisito: DefinizioneRequisito): string {
  const p = requisito.parametri;
  switch (p.tipo) {
    case 'cfu.ssd.singolo':
      return `cfu.ssd.singolo::${p.ssd}`;
    case 'cfu.ssd.gruppo':
      return `cfu.ssd.gruppo::${[...p.ssd].sort().join('|')}`;
    case 'cfu.ssd.disgiunzione':
      return `cfu.ssd.disgiunzione::${p.opzioni
        .map((opzione) => `${[...opzione.ssd].sort().join('+')}@${opzione.min}`)
        .sort()
        .join('|')}`;
    case 'titolo.abilitante':
      return `titolo.abilitante::${p.denominazione.toLowerCase()}`;
    default:
      return 'titolo.accesso.classe';
  }
}

/** Impronta dei soli parametri quantitativi (per il confronto fra fonti). */
export function improntaRequisito(requisito: DefinizioneRequisito): string {
  const p = requisito.parametri;
  switch (p.tipo) {
    case 'cfu.ssd.singolo':
      return JSON.stringify([p.tipo, p.ssd, p.min, p.max]);
    case 'cfu.ssd.gruppo':
      return JSON.stringify([p.tipo, [...p.ssd].sort(), p.min, p.minPerSsd, p.minUnoDeiSsd, p.max]);
    case 'cfu.ssd.disgiunzione':
      return JSON.stringify([
        p.tipo,
        p.opzioni.map((opzione) => [opzione.id, [...opzione.ssd].sort(), opzione.min]),
      ]);
    case 'titolo.abilitante':
      return JSON.stringify([p.tipo, p.denominazione, p.necessario]);
    default:
      return JSON.stringify([p.tipo, [...p.classiAmmesse].sort()]);
  }
}

/** Requisito strutturato derivato da UN vincolo di UNA regola autorevole. */
export function requisitoDaVincolo(
  regola: NormativeRuleEntry,
  vincolo: VincoloCfu,
  finestra: FinestraVigenza,
  classeCodice: string,
): DefinizioneRequisito {
  const tipo = tipoRequisitoDaVincolo(vincolo);
  const natura = naturaDaTipo(tipo);
  return {
    id: `${regola.id}::${vincolo.id}`,
    tipo,
    parametri: parametriDaVincolo(vincolo),
    classeCodice,
    vincoloId: vincolo.id,
    sourceIds: [regola.id],
    evidenze: [
      {
        sourceId: regola.id,
        estrattoVerbatim: vincolo.sourceExcerpt,
        posizioneFonte: vincolo.sourceLocation,
      },
    ],
    effectiveFrom: finestra?.validFrom ?? null,
    effectiveTo: finestra?.validUntil ?? null,
    strategiaId: STRATEGIA_PER_TIPO[tipo],
    // A5 (fase 5): natura e integrabilità sono FATTI DEL REQUISITO, dichiarati
    // qui alla risoluzione. L'integrabilità riguarda i deficit di CFU: per i
    // requisiti di titolo/accesso resta non dichiarata (nessuna deduzione).
    natura,
    integrabilita: natura === 'cfu' ? (regola.integrabilita ?? 'NOT_SPECIFIED') : 'NOT_SPECIFIED',
  };
}

/**
 * Requisito di accesso (classi di laurea ammesse) dichiarato dalle regole.
 * La lista è un campo STRUTTURATO della fonte: senza elenco dichiarato il
 * requisito non esiste (nessuna classe viene dedotta).
 */
export function requisitoAccessoClasse(
  classeCodice: string,
  regole: readonly NormativeRuleEntry[],
  finestra: FinestraVigenza,
): DefinizioneRequisito | null {
  const dichiaranti = regole.filter((regola) => (regola.classiLaureaAmmesse ?? []).length > 0);
  if (dichiaranti.length === 0) return null;
  return {
    id: `titolo.accesso.classe::${classeCodice}`,
    tipo: 'titolo.accesso.classe',
    parametri: {
      tipo: 'titolo.accesso.classe',
      classiAmmesse: classiAmmesseDalleRegole(dichiaranti),
    },
    classeCodice,
    vincoloId: null,
    sourceIds: dichiaranti.map((regola) => regola.id),
    evidenze: [],
    effectiveFrom: finestra?.validFrom ?? null,
    effectiveTo: finestra?.validUntil ?? null,
    strategiaId: STRATEGIA_PER_TIPO['titolo.accesso.classe'],
    // Requisito di accesso: natura dichiarata, integrabilità non applicabile
    // (non è un deficit di CFU: nessuna integrazione lo colma — R4).
    natura: 'accesso',
    integrabilita: 'NOT_SPECIFIED',
    nota:
      'Elenco delle classi di laurea ammesse dichiarato dalle regole: campo ' +
      'strutturato della fonte (nessun estratto atomico associato).',
  };
}

export interface GruppoRequisiti {
  readonly chiave: string;
  readonly tipo: TipoRequisito;
  readonly requisitoIds: readonly string[];
  readonly sourceIds: readonly string[];
  /** Impronte distinte dei parametri: > 1 implica potenziale conflitto. */
  readonly impronte: readonly string[];
}

/** Raggruppa i requisiti per chiave logica (individua dichiarazioni multiple). */
export function raggruppaRequisiti(
  requisiti: readonly DefinizioneRequisito[],
): GruppoRequisiti[] {
  const mappa = new Map<string, DefinizioneRequisito[]>();
  for (const requisito of requisiti) {
    const chiave = chiaveLogicaRequisito(requisito);
    const voci = mappa.get(chiave) ?? [];
    voci.push(requisito);
    mappa.set(chiave, voci);
  }
  return [...mappa.entries()].map(([chiave, voci]) => ({
    chiave,
    tipo: voci[0]!.tipo,
    requisitoIds: voci.map((voce) => voce.id),
    sourceIds: [...new Set(voci.flatMap((voce) => voce.sourceIds))],
    impronte: [...new Set(voci.map(improntaRequisito))],
  }));
}

export interface ParametriRisoluzioneRequisiti {
  readonly classeCodice: string;
  readonly regoleApplicabili: readonly NormativeRuleEntry[];
  readonly finestra: FinestraVigenza;
  /** Catalogo aggiuntivo dichiarato (classi configurate via dati). */
  readonly catalogoRequisiti?: readonly DefinizioneRequisito[];
}

export interface EsitoRisoluzioneRequisiti {
  readonly requisiti: readonly DefinizioneRequisito[];
  readonly gruppi: readonly GruppoRequisiti[];
}

/** Risolve i requisiti strutturati dalle regole applicabili + catalogo dati. */
export function risolviRequisiti(
  parametri: ParametriRisoluzioneRequisiti,
): EsitoRisoluzioneRequisiti {
  const requisiti: DefinizioneRequisito[] = [];

  for (const regola of parametri.regoleApplicabili) {
    for (const vincolo of regola.vincoli) {
      requisiti.push(
        requisitoDaVincolo(regola, vincolo, parametri.finestra, parametri.classeCodice),
      );
    }
  }
  const accesso = requisitoAccessoClasse(
    parametri.classeCodice,
    parametri.regoleApplicabili,
    parametri.finestra,
  );
  if (accesso) requisiti.push(accesso);

  for (const voce of parametri.catalogoRequisiti ?? []) {
    if (!requisiti.some((requisito) => requisito.id === voce.id)) requisiti.push(voce);
  }

  return { requisiti, gruppi: raggruppaRequisiti(requisiti) };
}


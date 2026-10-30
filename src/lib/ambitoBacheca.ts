/**
 * ScuoleRadar.it — VETRINA MAI CORTA: PROVINCIA → REGIONE → ITALIA (§26.111).
 *
 * Perché esiste: il paracadute «5 osso-da-mordere» (§26.106) completa la bacheca
 * con le migliori righe della SCORTA, ma la scorta è fatta delle stesse righe che
 * il database ha già restituito — quindi se la provincia non ha nemmeno cinque
 * avvisi attivi (Asti, 30/10/2026: zero righe), la vetrina resta vuota. Un utente
 * che apre la dashboard e trova il deserto non distingue «non ci sono avvisi per
 * te» da «il Radar non ha guardato»: la pagina deve dire sempre cosa c'è.
 *
 * LA REGOLA (una sola, in ordine di precedenza)
 *   1. le opportunità di PROVINCIA (bacheca + scorta, §26.106) sono la vetrina;
 *   2. se non arrivano a `MINIMO_BACHECA` (5), si integrano le più RECENTI della
 *      stessa REGIONE (le province della regione del profilo);
 *   3. se ancora non bastano, si integra il resto d'ITALIA.
 * Ogni riga aggiunta porta il suo `ambito` dichiarato (`regione` | `nazionale`):
 * card e accordion la etichettano, così l'integrazione non è mai silenziosa.
 *
 * COSA NON FA
 *  · non inventa righe: se anche regione e Italia sono vuote la lista resta
 *    corta e il motivo è dichiarato (`ambito-esaurito`);
 *  · non ricalcola il punteggio e non rivaluta il profilo: le righe fuori ambito
 *    arrivano senza voto (lo azzera il feed) e non salgono mai in cima;
 *  · non tocca la CONSEGNA: notifiche e digest restano strict (§26.45).
 *
 * Modulo PURO: nessuna rete, nessun `node:*`, importabile dal browser.
 * Guardia: `npm run test:ambito-bacheca` (incluso in `npm test`).
 */
import { MINIMO_BACHECA } from './riempitivi';
import { normalizzaProvincia } from './prossimitaGeografica';
import { province } from '../data/province';

/** Ambito di provenienza di una riga della vetrina. */
export type AmbitoBacheca = 'provincia' | 'regione' | 'nazionale';

/** Etichetta breve del badge d'ambito (card e accordion). */
export const ETICHETTA_AMBITO: Record<AmbitoBacheca, string> = {
  provincia: 'Nella tua provincia',
  regione: 'Stessa regione',
  nazionale: 'Resto d’Italia',
};

/** Perché quella riga è in vetrina (tooltip del badge). */
export function descrizioneAmbito(ambito: AmbitoBacheca): string {
  switch (ambito) {
    case 'provincia':
      return 'Avviso nella tua provincia (o entro il raggio dei 60 km), valutato sul tuo profilo.';
    case 'regione':
      return `La tua provincia ha meno di ${MINIMO_BACHECA} opportunità attive: il Radar mostra anche gli avvisi più recenti della tua REGIONE.`;
    case 'nazionale':
      return `Né la tua provincia né la tua regione arrivano a ${MINIMO_BACHECA} opportunità attive: il Radar mostra anche gli avvisi più recenti del resto d’Italia.`;
  }
}

/** Regione di un codice provincia (`null` se il codice non è in anagrafica). */
export function regioneDi(codice?: string | null): string | null {
  const c = normalizzaProvincia(codice);
  if (!c) return null;
  return province.find((p) => p.codice === c)?.regione ?? null;
}


/**
 * Province della STESSA regione delle province indicate (le proprie comprese):
 * è il perimetro dell'integrazione regionale.
 */
export function provinceDellaRegione(codici: readonly string[] | null | undefined): Set<string> {
  const regioni = new Set(
    (codici ?? []).map((c) => regioneDi(c)).filter((r): r is string => Boolean(r)),
  );
  if (regioni.size === 0) return new Set();
  return new Set(province.filter((p) => regioni.has(p.regione)).map((p) => p.codice));
}

/** Riga candidata: basta l'identificativo e (se c'è) la data di pubblicazione. */
export interface RigaCandidata {
  id: string;
  dataPubblicazione?: string | null;
}

/** Candidati fuori provincia, già divisi per ambito dal chiamante. */
export interface CandidatiAmbito<T extends RigaCandidata> {
  regionali: readonly T[];
  nazionali: readonly T[];
}

/** Esito dell'integrazione: lista pronta per la vetrina + conto dichiarato. */
export interface EsitoAmbiti<T extends RigaCandidata> {
  lista: (T & { ambito: AmbitoBacheca })[];
  /** Righe aggiunte fuori provincia (regione + nazione). */
  aggiunti: number;
  daRegione: number;
  daNazionale: number;
  motivo: 'sufficiente' | 'integrato' | 'ambito-esaurito';
}

export interface OpzioniAmbiti {
  /** Minimo di vetrina (default `MINIMO_BACHECA`). */
  minimo?: number;
}

/** Tempo di pubblicazione confrontabile (`-Infinity` se assente o illeggibile). */
function tempoPubblicazione(riga: RigaCandidata): number {
  const grezzo = riga.dataPubblicazione;
  if (!grezzo) return Number.NEGATIVE_INFINITY;
  const tempo = Date.parse(grezzo);
  return Number.isFinite(tempo) ? tempo : Number.NEGATIVE_INFINITY;
}

/**
 * Le più RECENTI non ancora in vetrina: pubblicazione decrescente, poi `id`
 * crescente (ordine deterministico, verificabile nelle guardie).
 */
function piuRecenti<T extends RigaCandidata>(
  righe: readonly T[],
  gia: ReadonlySet<string>,
): T[] {
  return righe
    .filter((r) => Boolean(r.id) && !gia.has(r.id))
    .slice()
    .sort((a, b) => tempoPubblicazione(b) - tempoPubblicazione(a) || a.id.localeCompare(b.id));
}

/**
 * Integra la vetrina con regione e Italia fino al minimo dichiarato.
 * PURA e totale: nessuna eccezione, nessun accesso alla rete.
 */
export function integraAmbiti<T extends RigaCandidata>(
  principali: readonly T[],
  candidati: CandidatiAmbito<T>,
  opzioni: OpzioniAmbiti = {},
): EsitoAmbiti<T> {
  const minimo = Math.max(0, opzioni.minimo ?? MINIMO_BACHECA);
  const lista: (T & { ambito: AmbitoBacheca })[] = principali.map((riga) => ({
    ...riga,
    ambito: 'provincia' as const,
  }));
  if (lista.length >= minimo) {
    return { lista, aggiunti: 0, daRegione: 0, daNazionale: 0, motivo: 'sufficiente' };
  }

  const gia = new Set(lista.map((riga) => riga.id));
  /** Quante righe sono già in vetrina: il tetto vale su regione + nazione insieme. */
  let presenze = lista.length;
  const raccogli = (
    righe: readonly T[],
    ambito: AmbitoBacheca,
  ): (T & { ambito: AmbitoBacheca })[] => {
    const scelte: (T & { ambito: AmbitoBacheca })[] = [];
    for (const riga of piuRecenti(righe, gia)) {
      if (presenze >= minimo) break;
      gia.add(riga.id);
      scelte.push({ ...riga, ambito });
      presenze += 1;
    }
    return scelte;
  };

  const regione = raccogli(candidati.regionali, 'regione');
  const nazione = raccogli(candidati.nazionali, 'nazionale');
  lista.push(...regione, ...nazione);

  return {
    lista,
    aggiunti: regione.length + nazione.length,
    daRegione: regione.length,
    daNazionale: nazione.length,
    motivo: lista.length >= minimo ? 'integrato' : 'ambito-esaurito',
  };
}

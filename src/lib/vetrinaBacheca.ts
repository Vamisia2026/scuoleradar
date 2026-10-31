/**
 * ScuoleRadar.it — VETRINA VISIBILE: la regola UNICA del gate identitario (§26.119).
 *
 * La dashboard mostra una riga solo se porta i campi IDENTITARI — Provincia, Ordine
 * di scuola, Classe/Materia — perché una card senza identità non dice all'utente
 * perché quella opportunità lo riguarda. Il gate esisteva già dentro `DashboardPage`.
 *
 * Il difetto che questo modulo chiude: il minimo dei cinque posti (§26.106/§26.111)
 * veniva contato sulle righe della BACHECA, non su quelle VISIBILI. Misurato il
 * 30/10/2026 su Asti: `bachecaInterpelli` restituiva 5 righe (tutte da paracadute),
 * la pagina ne scartava 5 su 5 perché senza classe → l'utente vedeva ZERO
 * opportunità con 395 avvisi attivi in Italia. Il feed quindi non chiedeva nemmeno
 * l'integrazione regionale/nazionale: credeva di avere già i suoi cinque.
 *
 * Da qui in poi il conto dei posti liberi si fa SOLO su `vetrinaVisibile`, cioè su
 * ciò che l'utente vedrà davvero. Il modulo è PURO (nessuna rete, nessun `node:*`).
 *
 * Guardia: `npm run test:ambito-bacheca` (inclusa in `npm test`).
 */
import type { Interpello } from '../data/interpelli';
import { costruisciAvviso } from './alertInterpello';
import { integraAmbiti, provinceDellaRegione } from './ambitoBacheca';
import { normalizzaProvincia } from './prossimitaGeografica';
import { MINIMO_BACHECA } from './riempitivi';
import { eOpportunitaAperta, eOpportunitaConScadenza } from './scadenza';

/** Campi identitari che mancano alla riga (`[]` = la vetrina può mostrarla). */
export function campiMancantiVetrina(riga: Interpello): string[] {
  return costruisciAvviso({
    provincia: riga.provinciaNome || riga.provinciaCodice,
    ordine: riga.ordine,
    classCode: riga.classeCodice,
    classCodes: riga.classiCodes,
    materia: riga.materia,
    scadenza: riga.dataScadenza,
    schoolName: riga.istituto,
  }).mancanti;
}

/** True se la riga è PRESENTABILE in vetrina: provincia, ordine e classe/materia. */
export function rigaVetrinaCompleta(riga: Interpello): boolean {
  const mancanti = campiMancantiVetrina(riga);
  return (
    !mancanti.includes('Provincia') &&
    !mancanti.includes('Ordine di scuola') &&
    !mancanti.includes('Classe / Materia')
  );
}

/**
 * Vetrina effettiva: le righe ANCORA APERTE (`eOpportunitaAperta`: scadenza
 * dichiarata e non passata, unica regola del tempo, §26.71/§26.100) e presentabili,
 * nell'ordine ricevuto. L'ordinamento resta al chiamante (la pagina ordina per voto
 * e scadenza; il feed conserva l'ordine della bacheca).
 */
export function vetrinaVisibile(
  lista: readonly Interpello[],
  oggi: Date = new Date(),
): Interpello[] {
  return lista.filter(
    (riga) => eOpportunitaAperta(riga.dataScadenza, oggi) && rigaVetrinaCompleta(riga),
  );
}

/** Fonti fuori zona già lette dal feed (query larga sotto il minimo, §26.111). */
export interface FontiAmbiti {
  /** Righe fuori dalla zona del profilo: possono essere regionali o nazionali. */
  fuori: readonly Interpello[];
  /** Province del profilo: definiscono il PERIMETRO regionale dell'integrazione. */
  province: readonly string[];
}

/**
 * VETRINA COMPLETA: provincia → regione → Italia, fino al minimo (§26.111), contando
 * solo le righe che la pagina mostrerà davvero (§26.119).
 *
 * Perché vive qui e non nell'hook: la regola ha due metà che devono restare una sola —
 * quali righe sono VISIBILI (gate identitario + scadenza aperta) e quante ne servono
 * alla vetrina. Tenerle nello stesso modulo puro permette di verificarle senza React
 * e impedisce che il conto torni a farsi sulle righe sbagliate (era il difetto per
 * cui l'utente vedeva zero con la bacheca «piena»).
 *
 * Le righe fuori zona arrivano SENZA voto (`compatibilita: 0`, `ripiego: false`):
 * non sono state valutate sul profilo e non possono salire in cima alla pagina.
 */
export function vetrinaConAmbiti(
  principali: readonly Interpello[],
  fonti: FontiAmbiti,
  opzioni: { minimo?: number; oggi?: Date } = {},
): Interpello[] {
  const minimo = opzioni.minimo ?? MINIMO_BACHECA;
  const oggi = opzioni.oggi ?? new Date();
  const visibili = vetrinaVisibile(principali, oggi);
  if (visibili.length >= minimo) return visibili;

  const gia = new Set(principali.map((riga) => riga.id));
  const perimetro = provinceDellaRegione(fonti.province);
  const candidati = fonti.fuori.filter(
    (riga) =>
      !gia.has(riga.id) &&
      eOpportunitaConScadenza(riga.dataScadenza, oggi) &&
      rigaVetrinaCompleta(riga),
  );
  const regionali = candidati.filter((riga) =>
    perimetro.has(normalizzaProvincia(riga.provinciaCodice)),
  );
  const nazionali = candidati.filter(
    (riga) => !perimetro.has(normalizzaProvincia(riga.provinciaCodice)),
  );
  return integraAmbiti(visibili, { regionali, nazionali }, { minimo }).lista.map((riga) =>
    riga.ambito === 'provincia' ? riga : { ...riga, compatibilita: 0, ripiego: false },
  );
}

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
 * §26.122 — LA VETRINA NON ESCE DALLE PROPRIE PROVINCE. Fino al 31/10/2026, sotto
 * i cinque posti, il feed allargava la ricerca prima alla REGIONE e poi all'ITALIA
 * (`integraAmbiti`): la pagina di un utente di Asti si riempiva con avvisi di
 * Vercelli o di un'altra regione, presentati senza voto perché non valutati sul
 * profilo. La direttiva del cliente è opposta e ora è la regola: si mostrano SOLO
 * le opportunità delle province scelte (o entro il raggio dei 60 km). Se non ce ne
 * sono, la dashboard dice «zero» con il motivo — mai un riempimento fuori zona.
 * Per questo `vetrinaConAmbiti` non esiste più: la vetrina è `vetrinaVisibile`.
 *
 * Guardia: `npm run test:ambito-bacheca` (lo scope provinciale) e
 * `npm run test:vetrina-bacheca` (gate identitario e scadenze), in `npm test`.
 */
import type { Interpello } from '../data/interpelli';
import { costruisciAvviso } from './alertInterpello';
import { eOpportunitaAperta } from './scadenza';

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

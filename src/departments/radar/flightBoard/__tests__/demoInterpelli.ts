/**
 * ScuoleRadar.it — Dipartimento Radar · RIGHE DIMOSTRATIVE del tabellone «Radar Live».
 *
 * Perché esiste: la direttiva del 22/10/2026 ha cambiato TRE comportamenti della
 * bacheca che sui dati reali si vedono solo a tratti (poche righe hanno un link di
 * piattaforma, poche hanno il sito istituzionale, quasi nessuna ha una scadenza
 * entro l'orizzonte dei 30 giorni). Per verificare — a occhio e con una guardia
 * automatica — che cosa mostra il tabellone serve un insieme di righe che copra
 * TUTTI i casi:
 *
 *   1. link di piattaforma (Argo, Nuvola, Google Forms) → il click apre la HOME
 *      `.edu.it` dell'istituto (`school_site`, poi i recapiti) — `../linkFonte.ts`;
 *   2. tre badge PIENI con etichetta fissa di stato («Scade oggi/domani» /
 *      «Ultima settimana» / «In corso»), soglie 2/7 giorni — `../rigaBoardDati.ts`;
 *   3. riga senza alcuna fonte apribile → NON entra in bacheca;
 *   4. riga con il solo segnaposto «Scuola non specificata / Più plessi» → NON
 *      entra; riga senza `school_name` ma con l'istituto nel titolo → entra col
 *      nome ricavato dal titolo; titolo di sola pubblicazione → NON entra.
 *
 * Il modulo NON tocca la rete: costruisce i payload e DICHIARA per ciascuno
 * l'esito atteso (`atteso`). Così `demoInterpelli.test.ts` verifica le funzioni
 * VERE della bacheca (`fonteApribile`, `preparaRigheBoard`, `badgeScadenza`) e
 * `seminaDemoBoard.ts` scrive gli stessi payload nel database di prova: la demo e
 * la sua verifica non possono divergere.
 *
 * Le date sono RELATIVE a `oggi` (`righeDemo(oggi)`): un dato dimostrativo con
 * date fisse, dopo una settimana, mostrerebbe solo righe scadute — cioè il
 * contrario di ciò che serve vedere.
 *
 * Dove sta: dentro il dipartimento (`flightBoard/__tests__/`), accanto alle altre
 * guardie della bacheca, perché è materiale di PROVA e parla solo con le funzioni
 * interne del tabellone. Tipi e funzioni comuni stanno in `demoInterpelliTipi.ts`,
 * la TABELLA dei casi in `demoInterpelliCasi.ts`: nessun import circolare.
 */
import { CASI_DEMO } from './demoInterpelliCasi.ts';
import { giornoDemo, type RigaDemo } from './demoInterpelliTipi.ts';

export { PREFISSO_DEMO } from './demoInterpelliTipi.ts';
export type { CasoDemo, EsitoAtteso, RigaDemo } from './demoInterpelliTipi.ts';

/**
 * Le righe dimostrative, con le scadenze calcolate da `oggi`.
 * I casi arrivano da `CASI_DEMO` (`giorniAllaScadenza` → `expiration_date`).
 */
export function righeDemo(oggi: Date = new Date()): RigaDemo[] {
  return CASI_DEMO.map(({ giorniAllaScadenza, ...caso }) => ({
    ...caso,
    expiration_date: giornoDemo(oggi, giorniAllaScadenza),
  }));
}

/**
 * Payload da scrivere in `interpelli`: le righe demo senza l'esito atteso.
 * `atteso` è una dichiarazione per la guardia, non una colonna del database: si
 * toglie da una copia della riga invece di elencare i campi uno per uno, così una
 * colonna nuova della tabella non richiede di aggiornare anche questo punto.
 */
export function payloadDemo(righe: readonly RigaDemo[]): Array<Record<string, unknown>> {
  return righe.map((riga) => {
    const payload: Record<string, unknown> = { ...riga };
    delete payload.atteso;
    return payload;
  });
}

/**
 * ScuoleRadar.it — VERIFICA delle righe dimostrative con le funzioni VERE della
 * bacheca (modulo puro, nessuna rete, nessun database).
 *
 * Replica in memoria la pipeline di `FlightBoardInterpelli.tsx`, così una riga
 * demo può dichiarare «entra con questa fonte e questo badge» oppure «non entra»
 * e la dichiarazione viene CONFRONTATA con il codice di produzione:
 *
 *   righe → filtro `fonteApribile` (link verificabile)
 *         → `preparaRigheBoard` (scadenza dentro l'orizzonte, titolo utile,
 *            istituto reale risolto)
 *         → `badgeScadenza` (etichetta della colonna «Scadenza»)
 *
 * Lo usano `demoInterpelli.test.ts` (guardia automatica) e `seminaDemoBoard.ts`
 * (riepilogo del dry-run): un solo modo di leggere l'esito, quindi la demo non
 * può raccontare una cosa e farne un'altra.
 */
import { fonteApribile, type FonteApribile } from '../linkFonte.ts';
import { badgeScadenza } from '../rigaBoardDati.ts';
import { nomeScuolaBoard, preparaRigheBoard } from '@/lib/liveBoard';
import { eTitoloSoloData } from '@/lib/titoloBoard';
import { eOpportunitaConScadenza } from '@/lib/scadenza';
import type { RigaDemo } from './demoInterpelliTipi.ts';

/** Esito di una riga demo nella pipeline della bacheca. */
export type EsitoRiga =
  | {
      riga: RigaDemo;
      esito: 'mostrata';
      fonte: FonteApribile;
      /** Etichetta del badge della colonna «Scadenza». */
      badge: string;
      /** Nome d'istituto mostrato nella colonna «Scuola». */
      scuola: string;
    }
  | { riga: RigaDemo; esito: 'scartata'; motivo: string };

/**
 * Perché una riga resta fuori. L'ordine dei controlli è quello di
 * `preparaRigheBoard` (scadenza → titolo → istituto), preceduto dal gate della
 * fonte che `FlightBoardInterpelli.tsx` applica PRIMA della preparazione.
 */
function motivoScarto(riga: RigaDemo, fonte: FonteApribile | null, oggi: Date): string {
  if (!fonte) {
    return 'nessuna fonte apribile: il click non porterebbe né a un avviso né a un sito .edu.it';
  }
  if (!eOpportunitaConScadenza(riga.expiration_date, oggi)) {
    return 'scadenza fuori dalla finestra di candidatura (15 giorni) o già passata';
  }
  if (eTitoloSoloData(riga.title)) return 'titolo di sola pubblicazione: non descrive l’avviso';
  if (!nomeScuolaBoard(riga)) return 'nessun istituto reale (segnaposto o titolo inutilizzabile)';
  return 'fuori dalla vetrina';
}

/**
 * Esegue la pipeline della bacheca sulle righe demo e restituisce, per OGNI riga,
 * l'esito effettivo. `oggi` serve sia alle date relative sia al giudizio di
 * scadenza: passare lo stesso istante ai due lati evita verdetti incoerenti.
 */
export function preparaDemo(righe: readonly RigaDemo[], oggi: Date = new Date()): EsitoRiga[] {
  const conFonte = righe.filter((r) => fonteApribile(r) !== null);
  const pronte = new Map(preparaRigheBoard(conFonte).map((p) => [p.riga.hash_id, p]));

  return righe.map((riga): EsitoRiga => {
    const fonte = fonteApribile(riga);
    const pronta = pronte.get(riga.hash_id);
    if (!pronta || !fonte) return { riga, esito: 'scartata', motivo: motivoScarto(riga, fonte, oggi) };
    return {
      riga,
      esito: 'mostrata',
      fonte,
      badge: badgeScadenza(pronta.scadenza).label,
      scuola: pronta.scuola,
    };
  });
}

/** Riga di riepilogo leggibile (`hash_id` · esito · fonte/badge o motivo). */
export function descriviEsito(e: EsitoRiga): string {
  return e.esito === 'mostrata'
    ? `${e.riga.hash_id.padEnd(24)} DENTRO · ${e.fonte.tipo.padEnd(10)} · ${e.badge.padEnd(16)} · ${e.scuola}`
    : `${e.riga.hash_id.padEnd(24)} FUORI  · ${e.motivo}`;
}

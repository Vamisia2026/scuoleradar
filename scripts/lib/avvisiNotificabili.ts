/**
 * ScuoleRadar.it — AVVISI NOTIFICABILI (conteggio gate-aware, solo-Node).
 *
 * Perché esiste. Il dispatch verso gli utenti è GATED: un avviso parte solo con link
 * diretto all'avviso ufficiale (`motivoAvvisoNonInviabile`). Da §26.68 il RECAPITO di
 * candidatura **non è più un requisito di blocco**: si conta a parte (`senzaRecapito`),
 * così il monitoraggio continua a misurare le righe da arricchire senza scartarle.
 * Il conteggio passa dallo STESSO giudizio del notifier e della bacheca:
 *   · `emailAvviso` → email trovata dalla fonte;
 *   · `risolviEmailUfficialeScuola` → PEO ricostruita dal codice meccanografico (MIM);
 *   · `avvisoSenzaRecapito` → avvertenza (non blocco) sul recapito non risolto;
 *   · `motivoRigaNonOpportunitaAvviso` → contorno del feed (§26.65).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  avvisoSenzaRecapito,
  emailAvviso,
  motivoAvvisoNonInviabile,
} from '../../src/lib/alertInterpello.ts';
import { risolviEmailUfficialeScuola } from '../../src/lib/emailScuola.ts';
import { motivoRigaNonOpportunitaAvviso } from '../../src/lib/qualitaAvviso.ts';

/** Conteggio degli avvisi di una finestra: notificabili, contorno e motivi di scarto. */
export interface ContoAvvisi {
  /** Avvisi che superano il gate (link diretto); `null` = lettura fallita. */
  notificabili: number | null;
  /** Righe che la bacheca scarta perché non sono opportunità (§26.65). */
  contorno: number;
  /**
   * Avvisi INVITABILI ma senza recapito di candidatura (§26.68): sono consegnabili
   * (l'avviso parte senza la riga contatto), restano misurati per l'arricchimento.
   * `0` quando la lettura è degradata (`notificabili: null`).
   */
  senzaRecapito: number;
  /** Istogramma dei motivi di scarto del gate (per report e allarmi). */
  motivi: Map<string, number>;
}

/**
 * Conta gli avvisi creati da `daISO` in poi col metro del dispatch.
 * `notificabili: null` = lettura NON riuscita (monitor degradato, mai «0 notifiche»).
 */
export async function contaAvvisiNotificabili(
  sb: SupabaseClient,
  daISO: string,
): Promise<ContoAvvisi> {
  const motivi = new Map<string, number>();
  const { data, error } = await sb
    .from('interpelli')
    .select('title,materia,class_codes,school_name,source_url,contact_email,school_code')
    .gte('created_at', daISO)
    .limit(1000);
  if (error || !Array.isArray(data)) return { notificabili: null, contorno: 0, senzaRecapito: 0, motivi };
  let notificabili = 0;
  let contorno = 0;
  let senzaRecapito = 0;
  for (const r of data) {
    if (
      motivoRigaNonOpportunitaAvviso({
        titolo: r.title,
        materia: r.materia,
        classiCodes: r.class_codes,
        istituto: r.school_name,
      })
    ) {
      contorno += 1;
    }
    // Recapito EFFETTIVO come nel notifier: email della fonte, altrimenti PEO dal
    // codice meccanografico — mai un recapito inventato.
    const recapito =
      emailAvviso(r.contact_email) ??
      risolviEmailUfficialeScuola({ schoolCode: r.school_code, testo: r.title })?.email ??
      null;
    const motivo = motivoAvvisoNonInviabile({ link: r.source_url });
    if (motivo) {
      motivi.set(motivo, (motivi.get(motivo) ?? 0) + 1);
      continue;
    }
    notificabili += 1;
    // Avviso consegnabile, ma senza recapito: si conta a parte (§26.68) — l'avviso
    // parte comunque, senza il blocco contatto.
    if (avvisoSenzaRecapito({ email: recapito })) senzaRecapito += 1;
  }
  return { notificabili, contorno, senzaRecapito, motivi };
}

/** Dettaglio compatto dei motivi di scarto del gate (per report e allarmi). */
export function dettaglioMotivi(motivi: Map<string, number>): string {
  if (motivi.size === 0) return '';
  const elenco = [...motivi.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([motivo, n]) => `${motivo}: ${n}`)
    .join(' · ');
  return ` → ${elenco}`;
}

/**
 * ScuoleRadar.it — AVVISI NOTIFICABILI (conteggio gate-aware, solo-Node).
 *
 * Perché esiste. Il dispatch verso gli utenti è GATED: un avviso parte solo con link
 * diretto all'avviso ufficiale E recapito di candidatura (`motivoAvvisoNonInviabile`).
 * Contare le righe grezze di `interpelli` fa sembrare «FERMO» un dispatch che invece
 * non ha nulla da consegnare. Qui il conteggio passa dallo STESSO giudizio del
 * notifier e della bacheca:
 *   · `emailAvviso` → email trovata dalla fonte;
 *   · `risolviEmailUfficialeScuola` → PEO ricostruita dal codice meccanografico (MIM);
 *   · `motivoRigaNonOpportunitaAvviso` → contorno del feed (§26.65).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { emailAvviso, motivoAvvisoNonInviabile } from '../../src/lib/alertInterpello.ts';
import { risolviEmailUfficialeScuola } from '../../src/lib/emailScuola.ts';
import { motivoRigaNonOpportunitaAvviso } from '../../src/lib/qualitaAvviso.ts';

/** Conteggio degli avvisi di una finestra: notificabili, contorno e motivi di scarto. */
export interface ContoAvvisi {
  /** Avvisi che superano il gate (link diretto + recapito); `null` = lettura fallita. */
  notificabili: number | null;
  /** Righe che la bacheca scarta perché non sono opportunità (§26.65). */
  contorno: number;
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
  if (error || !Array.isArray(data)) return { notificabili: null, contorno: 0, motivi };
  let notificabili = 0;
  let contorno = 0;
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
    const motivo = motivoAvvisoNonInviabile({ link: r.source_url, email: recapito });
    if (motivo) motivi.set(motivo, (motivi.get(motivo) ?? 0) + 1);
    else notificabili += 1;
  }
  return { notificabili, contorno, motivi };
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

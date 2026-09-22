/**
 * ScuoleRadar.it — Dipartimento Radar · valutazione della configurazione.
 *
 * Il Radar può essere acceso SOLO con criteri minimi validi (almeno 1 provincia
 * E almeno 1 classe di concorso/materia). Queste funzioni usano prima lo stato
 * locale (wizard in corso) e, se incompleto, il profilo salvato su DB: così non
 * si producono falsi negativi prima dell'idratazione del profilo.
 *
 * Responsabilità unica: dire SE la configurazione è valida (e cosa manca).
 * Nessun accesso a React, nessuna UI: le usano `RadarStatusToggle` e, in futuro,
 * qualsiasi altro punto di ingresso al setup Radar.
 */
import { supabase } from '@/lib/supabase';
import type { Preferenze } from '@/contexts/AppContext';
import { validaConfigRadar, type EsitoRadarConfig } from '@/lib/radarValidation';

/** Primo valore non vuoto tra quello del DB e quello locale. */
export function nonVuoto<T>(dbValore: T[] | null | undefined, locale: T[]): T[] {
  return Array.isArray(dbValore) && dbValore.length > 0 ? dbValore : locale;
}

/**
 * Valuta i campi OBBLIGATORI del Radar (Ordini + Province + Classi/Materie).
 * Usa prima lo stato locale (wizard in corso) e, se incompleto, il profilo
 * salvato su DB (evita falsi negativi prima dell'idratazione). Restituisce le
 * sezioni mancanti per un avviso puntuale e il passo del wizard da completare.
 */
export async function valutaConfigurazioneRadar(
  preferenze: Preferenze,
  userId?: string | null,
): Promise<EsitoRadarConfig> {
  const locale = validaConfigRadar({
    ordini: preferenze.ordini,
    provinceCodici: preferenze.provinceCodici,
    classiCodici: preferenze.classiCodici,
    materieId: preferenze.materieId,
    materieCustom: preferenze.materieCustom,
  });
  if (locale.valido) return locale;
  if (!supabase || !userId) return locale;

  const { data } = await supabase
    .from('profiles')
    .select('ordini_scuola, province_interesse, province_attive, classi_concorso, materie_id')
    .eq('id', userId)
    .maybeSingle();
  if (!data) return locale;

  return validaConfigRadar({
    ordini: nonVuoto(data.ordini_scuola, preferenze.ordini),
    provinceCodici: nonVuoto(data.province_interesse, nonVuoto(data.province_attive, preferenze.provinceCodici)),
    classiCodici: nonVuoto(data.classi_concorso, preferenze.classiCodici),
    materieId: nonVuoto(data.materie_id, preferenze.materieId),
    materieCustom: preferenze.materieCustom,
  });
}

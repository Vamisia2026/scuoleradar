/**
 * Radar — query REALE di `interpelli` per il box «Prova il Radar».
 *
 * Un solo punto di lettura — SEMPRE e SOLO per provincia — usato dal simulatore
 * pubblico: nessun pool nazionale, nessun ripiego, nessun dato di esempio. La
 * lettura è ampia e ordinata per scadenza, così il responso
 * (`lib/provaRadarEngine`) lavora su un pool vivo: supplenze, PON/POR, PNRR,
 * CPIA, ATA, esperti esterni.
 */
import type { RigaProvaRadar } from '@/lib/provaRadarEngine';
import { supabase } from '@/lib/supabase';

/** Campi di `interpelli` serviti al simulatore. */
const COLONNE_PROVA =
  'id, title, school_name, school_code, province, class_codes, materia, source_url, expiration_date';

/** Righe richieste alla provincia: il responso ne mostra poche, il pool è ampio. */
export const LIMITE_PROVINCIA = 200;
/** Feedback di scansione prima del responso (breve: il box resta scattante). */
export const ATTESA_SCANSIONE_MS = 900;

/**
 * Data (YYYY-MM-DD, locale) con un giorno di margine all'indietro: la usiamo come
 * soglia lato database per non far occupare il pool dagli avvisi già scaduti.
 * Il margine è volutamente prudente — il filtro per giornata esatto resta di
 * `righeAttive` (`lib/provaRadarEngine`), che tiene anche le righe senza data.
 */
function sogliaAttiviIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const mese = String(d.getMonth() + 1).padStart(2, '0');
  const giorno = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mese}-${giorno}`;
}

/**
 * Legge gli interpelli ATTIVI di UNA provincia: la provincia è OBBLIGATORIA — la
 * prova non ha ripieghi e non si legge mai «tutta l'Italia». In caso di errore
 * restituisce un elenco vuoto (il responso lo dichiara).
 */
export async function leggiInterpelliProva(
  provincia: string,
  limite: number,
): Promise<RigaProvaRadar[]> {
  if (!supabase || !provincia) return [];
  // SOLO avvisi ancora vivi: l'ordinamento per scadenza crescente porta in testa
  // gli scaduti e, senza questo filtro, il pool si esaurirebbe su righe che il
  // responso pubblico scarta — facendo dichiarare «zero risultati» a una
  // provincia che ha invece flusso pieno. Le righe senza scadenza restano
  // dentro (non sono dimostrabili come scadute).
  const { data, error } = await supabase
    .from('interpelli')
    .select(COLONNE_PROVA)
    .eq('province', provincia)
    .or(`expiration_date.gte.${sogliaAttiviIso()},expiration_date.is.null`)
    .order('expiration_date', { ascending: true })
    .limit(limite);
  if (error) {
    console.warn('Simulatore Radar — lettura interpelli:', error.message);
    return [];
  }
  return (data ?? []) as RigaProvaRadar[];
}

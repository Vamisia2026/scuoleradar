/**
 * ScuoleRadar.it — Dipartimento Radar · QUERY della bacheca «Radar Live».
 *
 * Un solo posto conosce le colonne servite al tabellone e la loro disponibilità
 * reale nel database. La paginazione resta in `letturaBoard.ts` (modulo puro); qui
 * c'è solo il pezzo che parla con Supabase.
 *
 * TOLLERANZA ALLA MIGRAZIONE (§26.77): `school_site` arriva con la migrazione
 * `20261022120000_add_interpelli_school_site.sql`. Se il frontend viene
 * pubblicato PRIMA che la migrazione sia applicata, una `select` con quella
 * colonna fallisce e il tabellone resterebbe vuoto — cioè il contrario del
 * servizio. La lettura quindi riprova senza `school_site`: si perdono le home
 * `.edu.it` (le righe con soli link di piattaforma restano fuori, come prima di
 * questa direttiva) ma la bacheca continua a vivere.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { RispostaPagina } from './letturaBoard';
import type { InterpelloLive } from './righeBoard';

/**
 * Colonne servite alla tavola: una sola definizione per tutte le pagine lette.
 *
 * `school_site` è il sito ISTITUZIONALE dichiarato dall'anagrafica MIM
 * (`SITOWEBSCUOLA`, solo host). Serve a `fonteApribile` per sostituire i link
 * alle piattaforme private (Argo, Nuvola/Spaggiari, Google Forms) con la home
 * `.edu.it` dell'istituto: senza questa colonna il tabellone non saprebbe dove
 * mandare l'utente e la riga resterebbe fuori.
 */
export const COLONNE_INTERPELLI =
  'id, title, school_name, school_code, province, class_codes, materia, expiration_date, created_at, source_url, contact_email, school_pec, school_site';

/** Le stesse colonne senza il sito istituzionale (migrazione non applicata). */
export const COLONNE_INTERPELLI_SENZA_SITO = COLONNE_INTERPELLI.replace(', school_site', '');

/**
 * True se l'errore dichiara che `school_site` non esiste: Postgres risponde
 * «column interpelli.school_site does not exist», PostgREST «Could not find the
 * 'school_site' column…». Entrambe le forme sono riconosciute.
 */
export function colonnaSitoAssente(messaggio?: string | null): boolean {
  const testo = messaggio ?? '';
  if (!/school_site/i.test(testo)) return false;
  return /does not exist|Could not find/i.test(testo);
}

/**
 * Crea la funzione `chiediPagina` per `leggiTutteLePagine`: stessa finestra,
 * stesso ordinamento (pubblicazione decrescente, poi scadenza più vicina) e
 * fallback una tantum quando `school_site` non esiste ancora.
 */
export function creaLettoreInterpelli(
  client: SupabaseClient,
  filtro: string,
): (da: number, a: number) => Promise<RispostaPagina<InterpelloLive>> {
  let conSito = true;

  return async (da, a) => {
    const esegui = (colonne: string) =>
      client
        .from('interpelli')
        .select(colonne)
        .or(filtro)
        .order('created_at', { ascending: false })
        .order('expiration_date', { ascending: true, nullsFirst: false })
        .order('id', { ascending: false })
        .range(da, a);

    let esito = await esegui(conSito ? COLONNE_INTERPELLI : COLONNE_INTERPELLI_SENZA_SITO);
    if (conSito && colonnaSitoAssente(esito.error?.message)) {
      console.warn(
        '[flight-board] colonna school_site assente (migrazione non applicata): lettura senza home .edu.it',
      );
      conSito = false;
      esito = await esegui(COLONNE_INTERPELLI_SENZA_SITO);
    }

    return {
      data: (esito.data ?? null) as InterpelloLive[] | null,
      error: esito.error ? { message: esito.error.message } : null,
    };
  };
}

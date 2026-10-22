/**
 * ScuoleRadar.it — Accesso TOLLERANTE alla tabella `interpelli` per i run di
 * manutenzione dati (`scripts/arricchisci-interpelli.ts` e simili).
 *
 * Perché un modulo a parte: la lettura e la scrittura devono continuare a
 * funzionare anche quando una migrazione NON è ancora stata applicata. Una
 * colonna recente (`school_pec`, `school_site`, `stato_arricchimento`) che il
 * database non conosce non deve far fallire l'intero arricchimento: la si toglie
 * dall'elenco, si riprova, e chi chiama sa quali colonne mancano (`assenti`).
 *
 * Direttiva 22/10/2026 (§26.77): `school_site` è la colonna che porta in vetrina
 * il sito ISTITUZIONALE dichiarato dall'anagrafica MIM (`SITOWEBSCUOLA`), usata
 * dalla bacheca al posto dei link ai portali privati.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Colonne necessarie all'arricchimento, tenute come LISTA (non come stringa):
 * serve poter togliere la colonna assente e riprovare la lettura.
 */
export const COLONNE_INTERPELLI: string[] = [
  'id',
  'title',
  'province',
  'school_name',
  'school_code',
  'contact_email',
  'school_pec',
  'school_site',
  'stato_arricchimento',
];

/** Vista minima di una riga d'interpello durante la manutenzione dati. */
export interface RigaInterpello {
  id: string;
  title: string | null;
  province: string | null;
  school_name: string | null;
  school_code: string | null;
  contact_email: string | null;
  school_pec: string | null;
  /** Sito istituzionale MIM (`SITOWEBSCUOLA`): alimenta il fallback `.edu.it` (§26.77). */
  school_site: string | null;
  stato_arricchimento?: string | null;
}

/** Esito della lettura: le righe e le colonne che il database non conosce. */
export interface LetturaInterpelli {
  righe: RigaInterpello[];
  /** Colonne tolte perché assenti (migrazione non applicata). */
  assenti: Set<string>;
}

/**
 * Nome della colonna assente, ricavato dal messaggio d'errore. Due forme reali:
 *   · Postgres  → «column interpelli.school_site does not exist»
 *   · PostgREST → «Could not find the 'school_site' column of … in the schema cache»
 * Il riconoscimento di entrambe è ciò che rende davvero tollerante il run.
 */
function colonnaAssente(messaggio: string): string | null {
  const postgrest = messaggio.match(/Could not find the '([^']+)' column/i)?.[1];
  if (postgrest) return postgrest;
  const postgres = messaggio.match(/column\s+(?:[A-Za-z_][\w]*\.)?([A-Za-z_][\w]*)\s+does not exist/i)?.[1];
  return postgres ?? null;
}

/**
 * Legge TUTTE le righe a pagine (PostgREST non consegna più di 1.000 righe per
 * richiesta). Una colonna assente viene tolta dall'elenco e la lettura riprova.
 */
export async function leggiTutteInterpelli(client: SupabaseClient): Promise<LetturaInterpelli> {
  const colonne = [...COLONNE_INTERPELLI];
  const assenti = new Set<string>();
  const tutte: RigaInterpello[] = [];

  for (let da = 0; da < 100_000; da += 1000) {
    const { data, error } = (await client
      .from('interpelli')
      .select(colonne.join(', '))
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(da, da + 999)) as never as { data: RigaInterpello[] | null; error: { message: string } | null };

    if (error) {
      const mancante = colonnaAssente(error.message);
      if (mancante && colonne.includes(mancante)) {
        console.warn(
          `⚠ Colonna interpelli.${mancante} assente (migrazione non applicata): ` +
            'l’arricchimento prosegue senza quella colonna.',
        );
        colonne.splice(colonne.indexOf(mancante), 1);
        assenti.add(mancante);
        da -= 1000;
        continue;
      }
      throw new Error(error.message);
    }

    const pagina = (data ?? []) as RigaInterpello[];
    tutte.push(...pagina);
    if (pagina.length < 1000) break;
  }

  return { righe: tutte, assenti };
}

/**
 * Aggiorna una riga togliendo dal payload SOLO la colonna che il database non
 * conosce: nessun aggiornamento si perde per intero a causa di un campo
 * opzionale. Restituisce il messaggio d'errore, oppure `null` se è andata.
 */
export async function aggiornaInterpello(
  client: SupabaseClient,
  id: string,
  patch: Record<string, string>,
): Promise<string | null> {
  let payload: Record<string, string> = { ...patch };
  for (let tentativo = 0; tentativo <= Object.keys(patch).length; tentativo += 1) {
    const { error } = (await client.from('interpelli').update(payload).eq('id', id)) as {
      error: { message: string } | null;
    };
    if (!error) return null;
    const colonna = colonnaAssente(error.message);
    if (colonna && colonna in payload) {
      const copia = { ...payload };
      delete copia[colonna];
      payload = copia;
      continue;
    }
    return error.message;
  }
  return null;
}


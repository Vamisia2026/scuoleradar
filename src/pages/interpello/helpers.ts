/**
 * Interpello · helper della scheda pubblica `/interpello/:id`.
 *
 * Estratti da `InterpelloDettaglioPage.tsx`: colonne necessarie alla query,
 * conversione della riga legacy della tabella `notices` e reindirizzamento
 * immediato alla fonte ufficiale esterna (comportamento richiesto dai deep link
 * delle notifiche). Usati solo dalla pagina: nessun consumer esterno.
 */
import { urlEsterna } from '@/lib/alertInterpello';
import type { Interpello } from '@/data/interpelli';

/** Colonne necessarie per ricostruire l'avviso strutturato. */
export const COLONNE_INTERPELLI =
  'id,hash_id,title,province,class_codes,school_name,school_code,source_url,expiration_date,created_at,contact_email,materia';

/** Converte una riga legacy della tabella `notices` (solo colonne disponibili). */
export function daNotices(r: {
  id: string;
  title: string | null;
  source_url: string | null;
  province: string | null;
  class_codes: string[] | null;
  expiration_date: string | null;
}): Interpello {
  return {
    id: r.id,
    titolo: r.title ?? 'Avviso ufficiale',
    istituto: '',
    provinciaCodice: (r.province ?? '').toUpperCase(),
    provinciaNome: (r.province ?? '').toUpperCase(),
    classeCodice: (r.class_codes ?? [])[0] ?? '',
    classiCodes: (r.class_codes ?? []).filter(Boolean),
    ordine: 'secondaria2',
    dataScadenza: r.expiration_date ?? '',
    descrizione: r.title ?? '',
    linkFonte: r.source_url ?? '',
    contactEmail: null,
    compatibilita: 100,
  };
}

/**
 * Reindirizza IMMEDIATAMENTE alla fonte ufficiale ESTERNA dell'avviso, quando
 * esiste un URL http(s) valido e NON interno alla piattaforma. È il comportamento
 * richiesto dai deep link delle notifiche: nessuna scheda interna intermedia,
 * nessun "Avviso non più disponibile" quando la pagina istituzionale è nota, e
 * nessun rimbalzo su ScuoleRadar (la scheda interna non è mai una "fonte").
 * Ritorna `true` se il redirect è stato avviato.
 */
export function reindirizzaAllaFonte(interpello: Interpello): boolean {
  const link = urlEsterna(interpello.linkFonte);
  if (!link) return false;
  try {
    window.location.replace(link);
  } catch {
    return false;
  }
  return true;
}

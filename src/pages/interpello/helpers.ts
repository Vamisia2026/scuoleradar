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
 * Apre IMMEDIATAMENTE la fonte ufficiale ESTERNA dell'avviso, quando esiste un
 * URL http(s) valido e NON interno alla piattaforma. È il comportamento richiesto
 * dai deep link delle notifiche: nessuna scheda interna intermedia, nessun
 * «Avviso non più disponibile» quando la pagina istituzionale è nota, e nessun
 * rimbalzo su ScuoleRadar (la scheda interna non è mai una «fonte»).
 *
 * §26.140 — IN UNA NUOVA SCHEDA. Prima si navigava nella scheda corrente
 * (`window.location.replace`): quando la fonte è un PDF servito come allegato, il
 * browser lo SCARICAVA sul disco e la pagina di ScuoleRadar spariva — l'utente
 * perdeva il contesto e si ritrovava un file in «Download». Ora il documento si
 * apre in una scheda nuova (il lettore PDF integrato lo mostra, il download
 * automatico non è più l'unica strada) e si resta sulla propria scheda. Se il
 * browser blocca l'apertura del popup (`window.open` → `null`), si ricade sulla
 * navigazione diretta: meglio la vecchia strada di nessuna strada.
 *
 * Ritorna `true` se l'apertura è stata avviata.
 */
export function reindirizzaAllaFonte(interpello: Interpello): boolean {
  const link = urlEsterna(interpello.linkFonte);
  if (!link) return false;
  try {
    // `noopener` passato come TERZO argomento farebbe tornare `null` anche a
    // scheda aperta (spec HTML): si apre normalmente e si azzera l'opener a mano.
    const scheda = window.open(link, '_blank');
    if (scheda) {
      scheda.opener = null;
      return true;
    }
  } catch {
    // popup bloccato: si prova la navigazione diretta, come prima del fix.
  }
  try {
    window.location.replace(link);
  } catch {
    return false;
  }
  return true;
}

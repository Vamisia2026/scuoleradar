import type { SupabaseClient } from '@supabase/supabase-js';
import type { Interpello } from '../data/interpelli';
import { classeByCodice } from '../data/classiConcorso';
import { province } from '../data/province';

/**
 * FASE 3 — Matching Engine.
 * Query sulla tabella `interpelli` di Supabase filtrando per le
 * province di interesse e le classi di concorso del profilo utente.
 *
 * Filtri:
 *  - province  → `in ('province', [...])`
 *  - classi    → `overlaps ('class_codes', [...])` (almeno una classe in comune)
 * Ordinati per scadenza (più urgenti in cima).
 *
 * Tutte le funzioni ricevono il client Supabase come parametro (null =
 * non configurato) così il modulo resta puro e testabile sia nel frontend
 * sia nello scraper Node.
 */

/** Riga della tabella `interpelli` (FASE 2 schema). */
export interface InterpelloDB {
  id: string;
  hash_id: string;
  title: string;
  province: string;
  class_codes: string[] | null;
  school_name: string | null;
  school_code: string | null;
  source_url: string;
  expiration_date: string | null;
  created_at: string | null;
}

export interface MatchingCriteri {
  /** Province di interesse (codici, es. ['AT', 'MI']) — vuoto = nessun filtro. */
  province?: string[];
  /** Classi di concorso del profilo (es. ['A-22', 'ADEE']) — vuoto = nessun filtro. */
  classi?: string[];
  /** Limite righe restituite. */
  limit?: number;
}

/** Converte una riga della tabella `interpelli` nel tipo `Interpello` usato dalla dashboard. */
export function mapInterpelloDBToInterpello(r: InterpelloDB): Interpello {
  const codici = (r.class_codes ?? []).filter(Boolean);
  const primaClasse = codici[0] ?? '';
  const classe = classeByCodice(primaClasse);
  const provinciaCodice = (r.province ?? '').toUpperCase();
  return {
    id: r.id,
    titolo: r.title ?? 'Avviso non classificato',
    istituto: r.school_name ?? '',
    provinciaCodice,
    provinciaNome: province.find((p) => p.codice === provinciaCodice)?.nome ?? provinciaCodice,
    classeCodice: primaClasse,
    classiCodes: codici,
    ordine: classe?.ordine ?? 'secondaria2',
    dataScadenza: r.expiration_date ?? '',
    descrizione: r.title ?? '',
    linkFonte: r.source_url ?? '',
    compatibilita: 100,
  };
}

/**
 * Query la tabella `interpelli` applicando i filtri del Matching Engine.
 * Restituisce `null` se Supabase non è configurato o in caso di errore
 * (il chiamante decide il fallback), altrimenti l'array di righe.
 */
export async function searchInterpelli(
  client: SupabaseClient | null,
  criteri: MatchingCriteri = {},
): Promise<InterpelloDB[] | null> {
  if (!client) return null;

  const { province: provinceFiltro, classi, limit } = criteri;
  let query = client.from('interpelli').select('*');

  if (provinceFiltro && provinceFiltro.length > 0) {
    query = query.in('province', provinceFiltro);
  }
  if (classi && classi.length > 0) {
    // overlaps = almeno una classe in comune tra class_codes (DB) e le classi del profilo
    query = query.overlaps('class_codes', classi);
  }

  const { data, error } = await query
    .order('expiration_date', { ascending: true })
    .limit(limit ?? 100);

  if (error) {
    console.warn('MatchingEngine — lettura tabella interpelli:', error.message);
    return null;
  }
  return (data ?? []) as InterpelloDB[];
}

/** Feed già mappato nel tipo `Interpello` per la Dashboard / Radar Opportunità. */
export async function getFeedInterpelli(
  client: SupabaseClient | null,
  criteri: MatchingCriteri,
): Promise<Interpello[] | null> {
  const righe = await searchInterpelli(client, criteri);
  if (!righe) return null;
  return righe.map(mapInterpelloDBToInterpello);
}

/* ------------------------- Utenti compatibili (FASE 4) ------------------------- */

/** Utente (profilo) compatibile con un interpello, pronto per la notifica. */
export interface UtenteCompatibile {
  /** UUID dell'utente (chiave per la RPC del contatore notifiche). */
  id: string;
  email: string;
  nome?: string;
  province: string[];
  classi: string[];
  /** Chat ID Telegram del profilo (FASE 5) — presente se l'utente ha collegato il bot. */
  telegramChatId?: string | null;
  /** Piano dell'utente ('base' | 'pro'): serve a selezionare il template di notifica. */
  piano?: string;
  /** True se il messaggio di blocco notifiche è già stato inviato (una tantum). */
  notificheBloccoInviato?: boolean;
  /** True se la email riepilogativa del blocco definitivo è già stata inviata (una tantum). */
  notificheRecapInviato?: boolean;
}

/**
 * FASE 4 — Trova nella tabella `profiles` gli utenti compatibili con un interpello:
 * email di notifica valida, provincia in comune e almeno una classe in comune.
 */
export async function findUtentiCompatibili(
  client: SupabaseClient | null,
  interpello: { province: string; classi: string[] },
): Promise<UtenteCompatibile[]> {
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('profiles')
      .select('id, email, email_notifica, nome, province_interesse, province_attive, classi_concorso, telegram_chat_id, piano, notifiche_blocco_inviato, notifiche_recap_inviato');

    if (error) {
      console.warn('MatchingEngine — lettura profiles (utenti compatibili):', error.message);
      return [];
    }

    const compatibili: UtenteCompatibile[] = [];
    for (const riga of data ?? []) {
      const email = String(riga.email_notifica ?? riga.email ?? '').trim();
      const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const chatId = riga.telegram_chat_id ? String(riga.telegram_chat_id).trim() : '';
      // Ammesso se ha almeno un canale di notifica (email valida o Telegram collegato)
      if (!emailValida && !chatId) continue;

      const provinceProfilo: string[] = riga.province_interesse ?? riga.province_attive ?? [];
      const classiProfilo: string[] = riga.classi_concorso ?? [];

      const matchProvincia =
        provinceProfilo.length === 0 || provinceProfilo.includes(interpello.province);
      const matchClasse =
        classiProfilo.length === 0 || interpello.classi.some((c) => classiProfilo.includes(c));
      if (!matchProvincia || !matchClasse) continue;

      compatibili.push({
        id: String(riga.id),
        email: emailValida ? email : '',
        nome: riga.nome ? String(riga.nome) : undefined,
        province: provinceProfilo,
        classi: classiProfilo,
        telegramChatId: chatId || null,
        piano: riga.piano ? String(riga.piano) : 'base',
        notificheBloccoInviato: Boolean(riga.notifiche_blocco_inviato),
        notificheRecapInviato: Boolean(riga.notifiche_recap_inviato),
      });
    }
    return compatibili;
  } catch (err) {
    console.warn('MatchingEngine — ricerca utenti compatibili fallita:', (err as Error).message);
    return [];
  }
}

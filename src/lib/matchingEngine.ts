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
  /** Email di candidatura della scuola (PEC/istituzionale), se presente. */
  contact_email: string | null;
  /** Materia/settore inferito dallo scraper quando manca una classe esplicita. */
  materia: string | null;
}

export interface MatchingCriteri {
  /** Province di interesse (codici, es. ['AT', 'MI']) — vuoto = nessun filtro. */
  province?: string[];
  /** Classi di concorso del profilo (es. ['A-22', 'ADEE']) — vuoto = nessun filtro. */
  classi?: string[];
  /** Limite righe restituite. */
  limit?: number;
}

/**
 * Ente emittente (USP/USR) riconosciuto dal TITOLO e dalla provincia dell'avviso.
 * Serve come fallback quando `school_name` è vuoto: evita la dicitura generica
 * "Scuola non indicata" per gli avvisi pubblicati da uffici scolastici.
 * Lato DB il parser (server) salva già il nome canonico; qui copriamo le righe
 * storiche prive di `school_name`.
 */
export function enteEmittenteDaTitolo(
  title?: string | null,
  provincia?: string | null,
): string | null {
  const t = (title ?? '').toLowerCase();
  if (!t) return null;
  const codice = (provincia ?? '').trim().toUpperCase();
  const prov = province.find((x) => x.codice === codice) ?? null;
  if (/\busr\b|ufficio scolastico regionale/.test(t)) {
    return prov?.regione ? `USR ${prov.regione}` : 'USR';
  }
  if (
    /ufficio scolastico (territoriale|provinciale)|\busp\b|ambito territoriale|\buat\b|ufficio\s+(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/.test(
      t,
    )
  ) {
    return prov?.nome ? `USP ${prov.nome}` : 'USP';
  }
  return null;
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
    istituto: r.school_name?.trim() || enteEmittenteDaTitolo(r.title, r.province) || '',
    provinciaCodice,
    provinciaNome: province.find((p) => p.codice === provinciaCodice)?.nome ?? provinciaCodice,
    classeCodice: primaClasse,
    classiCodes: codici,
    materia: r.materia ?? null,
    ordine: classe?.ordine ?? 'secondaria2',
    dataScadenza: r.expiration_date ?? '',
    descrizione: r.title ?? '',
    linkFonte: r.source_url ?? '',
    contactEmail: r.contact_email ?? null,
    compatibilita: 100,
  };
}

/**
 * Varianti di un codice classe per la query DB. Il catalogo usa `A-26`, ma le
 * fonti ufficiali salvano spesso `A-026` (o `A26`): la query `.overlaps` deve
 * intercettare TUTTI i formati, altrimenti il feed dell'utente risulta VUOTO.
 */
export function variantiClasseCodice(codice: string): string[] {
  const c = (codice ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return [];
  const m = c.match(/^([A-Z]{1,2})-?0*(\d{1,3})$/);
  if (!m) return [c];
  const prefisso = m[1];
  const numero = Number(m[2]);
  if (Number.isNaN(numero)) return [c];
  const d2 = String(numero).padStart(2, '0');
  const d3 = String(numero).padStart(3, '0');
  return [...new Set([`${prefisso}-${numero}`, `${prefisso}-${d2}`, `${prefisso}-${d3}`, `${prefisso}${d2}`, `${prefisso}${d3}`])];
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
    // Supporto MULTI-provincia (fino a 4 con PRO): filtro `in` su tutti i codici,
    // normalizzati in maiuscolo per non perdere match per differenze di formato.
    const province = [...new Set(provinceFiltro.map((p) => (p ?? '').trim().toUpperCase()).filter(Boolean))];
    if (province.length > 0) query = query.in('province', province);
  }
  if (classi && classi.length > 0) {
    // overlaps = almeno una classe in comune tra class_codes (DB) e le classi del
    // profilo, confrontando TUTTE le varianti di formato (A-26 ≡ A-026 ≡ A26).
    const varianti = [...new Set(classi.flatMap(variantiClasseCodice))];
    if (varianti.length > 0) query = query.overlaps('class_codes', varianti);
  }

  // Esclude gli interpelli SCADUTI dalle liste attive pubbliche
  // (senza scadenza → mantenuti: non dimostrabili come scaduti).
  const oggiIso = new Date().toISOString().slice(0, 10);
  const { data, error } = await query
    .or(`expiration_date.is.null,expiration_date.gte.${oggiIso}`)
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .limit(limit ?? 100);

  if (error) {
    console.warn('MatchingEngine — lettura tabella interpelli:', error.message);
    return null;
  }
  return (data ?? []) as InterpelloDB[];
}

/** Feed già mappato nel tipo `Interpello` per la Dashboard / Radar Scuole. */
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
 * Normalizza un codice di classe di concorso per il CONFRONTO profilo↔interpello.
 *
 * Il catalogo dell'app (`src/data/classiConcorso.ts`) usa il formato compatto
 * (`A-22`, `A-26`), mentre le fonti ufficiali citano spesso il formato a 3 cifre
 * (`A-022`, `A-026`) e alcune il formato senza trattino (`A042`). Un confronto
 * letterale (`'A-026' === 'A-26'` → false) fa fallire il match e l'utente non
 * riceve MAI le notifiche reali: qui entrambi i lati vengono ricondotti alla
 * forma `PREFISSO-NUMERO` senza zeri iniziali (`A-026` → `A-26`, `A-042` → `A-42`).
 * I codici sostegno (`ADEE`, `ADSS`, `AD24`, …) restano invariati.
 */
export function normalizzaClasse(codice?: string | null): string {
  const c = (codice ?? '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return '';
  // Formato con trattino (A-026, B-001, A-02) oppure compatto a una lettera (A042).
  const m = c.match(/^([A-Z]{1,2})-0*(\d{1,3})$/) ?? c.match(/^([A-Z])0*(\d{2,3})$/);
  if (!m) return c;
  return `${m[1]}-${Number(m[2])}`;
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
      .select('id, email, email_notifica, nome, province_interesse, province_attive, classi_concorso, telegram_chat_id, piano, radar_attivo, is_free_forever, notifiche_blocco_inviato, notifiche_recap_inviato');

    if (error) {
      console.warn('MatchingEngine — lettura profiles (utenti compatibili):', error.message);
      return [];
    }

    const compatibili: UtenteCompatibile[] = [];
    for (const riga of data ?? []) {
      // Fallback ROBUSTO: `email_notifica` spesso è stringa VUOTA ('' non è null,
      // quindi `??` non ricadrebbe su `email`) → l'utente risultava privo di canale
      // e veniva ESCLUSO dal matching, pur avendo un'email valida sul profilo.
      const email = String(riga.email_notifica || riga.email || '').trim();
      const emailValida = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      const chatId = riga.telegram_chat_id ? String(riga.telegram_chat_id).trim() : '';
      // Ammesso se ha almeno un canale di notifica (email valida o Telegram collegato)
      if (!emailValida && !chatId) continue;

      // Radar "In pausa" (radar_attivo=false): le preferenze restano salvate ma le
      // notifiche vengono sospese finché l'utente non riattiva il Radar.
      if (riga.radar_attivo === false) continue;

      const provinceProfilo: string[] = riga.province_interesse ?? riga.province_attive ?? [];
      const classiProfilo: string[] = riga.classi_concorso ?? [];
      // Confronto NORMALIZZATO delle classi (A-026 ≡ A-26 ≡ A042): senza questa
      // canonicalizzazione il catalogo (A-22) non incontrerebbe mai le classi
      // estratte dalle fonti (A-022) e l'utente non riceverebbe notifiche reali.
      const classiProfiloNormalizzate = new Set(classiProfilo.map(normalizzaClasse));

      const matchProvincia =
        provinceProfilo.length === 0 || provinceProfilo.includes(interpello.province);
      const matchClasse =
        classiProfilo.length === 0 ||
        interpello.classi.some((c) => classiProfiloNormalizzate.has(normalizzaClasse(c)));
      if (!matchProvincia || !matchClasse) continue;

      compatibili.push({
        id: String(riga.id),
        email: emailValida ? email : '',
        nome: riga.nome ? String(riga.nome) : undefined,
        province: provinceProfilo,
        classi: classiProfilo,
        telegramChatId: chatId || null,
        piano: riga.is_free_forever === true ? 'free_forever' : riga.piano ? String(riga.piano) : 'base',
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

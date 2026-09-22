import type { SupabaseClient } from '@supabase/supabase-js';
import type { Interpello } from '../data/interpelli';
import { classeByCodice, eAvvisoSostegno, isCodiceSostegno } from '../data/classiConcorso';
import { materie as catalogoMaterie } from '../data/ordiniMaterie';
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
  /**
   * Preferenza SOSTEGNO (`profiles.sostegno`): true = l'utente vuole ricevere
   * anche le opportunità di sostegno (ADAA/ADEE/ADMM/ADSS).
   */
  sostegno?: boolean;
}

/**
 * True se l'utente ha aderito all'area SOSTEGNO. L'adesione è ESPLICITA
 * (`profiles.sostegno`, preferenza chiesta nel wizard e nel profilo) oppure
 * IMPLICITA: chi ha selezionato una classe di sostegno (ADEE, ADMM…) tra le
 * proprie preferenze la vuole evidentemente ricevere — così la nuova preferenza
 * non toglie copertura a nessuno (nessun opt-out retroattivo).
 */
export function utenteAderisceSostegno(utente: {
  sostegno?: boolean | null;
  classi?: readonly string[] | null;
}): boolean {
  if (utente.sostegno === true) return true;
  return (utente.classi ?? []).some((c) => isCodiceSostegno(c));
}

/**
 * GUARDIA SOSTEGNO del matching (fonte unica per matching real-time e digest).
 *
 * Regola: gli avvisi di SOSTEGNO (`classi` con AD… oppure titolo/materia che lo
 * dichiarano) vengono consegnati SOLO a chi ha aderito alla preferenza. Gli
 * avvisi disciplinari passano invece inalterati.
 *
 * Perché: il sostegno è un'abilitazione separata, ma le fonti lo pubblicano
 * spesso citando anche le classi disciplinari (o i titoli di studio richiesti).
 * Un docente di tedesco (A-22/A-25) riceveva così interpelli di sostegno: con
 * questa guardia il falso positivo non è più possibile per chi non aderisce.
 */
export function sostegnoAmmesso(
  utente: { sostegno?: boolean | null; classi?: readonly string[] | null },
  avviso: { classi?: readonly string[] | null; titolo?: string | null; materia?: string | null },
): boolean {
  if (!eAvvisoSostegno(avviso.classi, avviso.titolo, avviso.materia)) return true;
  return utenteAderisceSostegno(utente);
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
 *
 * TOLLERANZA DI SCRITTURA (stessa classe, qualunque sia il formato digitato):
 *   `A-18` · `A18` · `a 18` · `A_18` · `A.18` · `A - 018` → **`A-18`**
 * I codici a 4 lettere (sostegno/ATA: `ADEE`, `EEEE`, `ADSS`, `AD24`, …) restano
 * invariati: la conversione riguarda SOLO il formato `lettera/e + numero`.
 */
export function normalizzaClasse(codice?: string | null): string {
  const c = (codice ?? '')
    .trim()
    .toUpperCase()
    // Separatori equivalenti (spazi, trattini, underscore, punti) → trattino unico.
    .replace(/[\s._–—-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!c) return '';
  // Formato con trattino (A-026, B-001, A-02) oppure compatto a una lettera (A042).
  const m = c.match(/^([A-Z]{1,2})-0*(\d{1,3})$/) ?? c.match(/^([A-Z])0*(\d{2,3})$/);
  if (!m) return c;
  return `${m[1]}-${Number(m[2])}`;
}

/**
 * Normalizza una LISTA di classi di concorso: applica `normalizzaClasse`,
 * elimina i valori vuoti e i duplicati (anche se scritti in formati diversi:
 * `A-022` e `A-22` sono la stessa classe). Usata al CARICAMENTO e al SALVATAGGIO
 * del profilo: così le classi scelte dall'utente non "spariscono" (casella
 * deselezionata) per un disallineamento di formato tra DB e catalogo.
 */
export function normalizzaClassi(classi?: readonly (string | null | undefined)[] | null): string[] {
  const out: string[] = [];
  const visti = new Set<string>();
  for (const c of classi ?? []) {
    const n = normalizzaClasse(c);
    if (!n || visti.has(n)) continue;
    visti.add(n);
    out.push(n);
  }
  return out;
}

/**
 * True se la lista di classi contiene (in QUALSIASI formato) il codice indicato.
 * È il confronto usato dalle caselle di selezione dell'interfaccia: evita che una
 * classe salvata come `A-022` appaia non selezionata rispetto al catalogo `A-22`.
 */
export function contieneClasse(
  classi: readonly (string | null | undefined)[] | null | undefined,
  codice?: string | null,
): boolean {
  const target = normalizzaClasse(codice);
  if (!target) return false;
  return (classi ?? []).some((c) => normalizzaClasse(c) === target);
}

/** Rimuove (in QUALSIASI formato) la classe indicata dalla lista. */
export function rimuoviClasse(
  classi: readonly (string | null | undefined)[] | null | undefined,
  codice?: string | null,
): string[] {
  const target = normalizzaClasse(codice);
  return normalizzaClassi(classi).filter((c) => c !== target);
}


/* ------------- Compatibilità profilo ↔ opportunità (STRICT) ------------- */

/** Motivo dello scarto di un'opportunità rispetto a un profilo. */
export type MotivoScarto =
  | 'sostegno'
  | 'profilo-senza-province'
  | 'profilo-senza-classi'
  | 'provincia'
  | 'classe';

/** Esito del confronto profilo ↔ opportunità (con motivo, per log e test). */
export interface EsitoCompatibilita {
  ok: boolean;
  motivo?: MotivoScarto;
}

/** Profilo minimo richiesto dal confronto (riga `profiles`). */
export interface ProfiloCompatibilita {
  province?: readonly string[] | null;
  classi?: readonly string[] | null;
  sostegno?: boolean | null;
}

/** Avviso minimo richiesto dal confronto (riga `interpelli` o avviso parsato). */
export interface AvvisoCompatibilita {
  province?: string | null;
  classi?: readonly string[] | null;
  materia?: string | null;
  titolo?: string | null;
}

/** Normalizza un codice provincia per il confronto (maiuscolo, senza spazi). */
export function normalizzaProvincia(codice?: string | null): string {
  return (codice ?? '').trim().toUpperCase();
}

/** Nomi/etichette delle materie coperte da una classe di concorso del catalogo. */
export function etichetteMaterieClasse(codice?: string | null): string[] {
  const classe = classeByCodice(normalizzaClasse(codice));
  if (!classe) return [];
  const nomi = classe.materie
    .map((id) => catalogoMaterie.find((m) => m.id === id)?.nome ?? '')
    .filter(Boolean);
  return [classe.denominazione, ...nomi];
}

/**
 * True se la MATERIA dichiarata dall'avviso è coperta da almeno una delle classi
 * del profilo. Serve agli avvisi che NON citano il codice classe (le fonti a
 * volte pubblicano solo "Interpello di Matematica"): senza questo confronto
 * finirebbero a TUTTI i profili (falso positivo), mentre con il confronto
 * arrivano solo a chi insegna quella materia.
 */
export function materiaCompatibileConClassi(
  materia?: string | null,
  classi?: readonly string[] | null,
): boolean {
  const tokens = (materia ?? '')
    .toLowerCase()
    .split(/[/,;·|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return false;
  for (const codice of classi ?? []) {
    const etichette = etichetteMaterieClasse(codice).map((e) => e.toLowerCase());
    if (etichette.length === 0) continue;
    const coperta = tokens.some((t) =>
      etichette.some((e) => e.includes(t) || t.includes(e)),
    );
    if (coperta) return true;
  }
  return false;
}

/**
 * REGOLA UNICA di compatibilità profilo ↔ opportunità (Radar e notifiche).
 *
 * STRICT: un'opportunità viene consegnata SOLO se
 *   1. l'avviso non è di sostegno oppure l'utente ha aderito al sostegno;
 *   2. il profilo ha almeno una PROVINCIA configurata e quella dell'avviso è tra
 *      esse (mai avvisi di un'altra provincia: era il bug "Torino/Piemonte →
 *      opportunità di Prato/Toscana" per i profili senza province salvate);
 *   3. il profilo ha almeno una CLASSE configurata e c'è intersezione con le
 *      classi dell'avviso (formato normalizzato A-022 ≡ A-22); se l'avviso non
 *      dichiara classi, la MATERIA deve ricadere tra quelle delle classi utente.
 *
 * `ignoraFiltri` serve SOLO a enumerare i profili notificabili (digest): salta i
 * controlli geografici/di classe, ma NON la guardia sostegno.
 */
export function avvisoCompatibileConProfilo(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  opts: { ignoraFiltri?: boolean } = {},
): EsitoCompatibilita {
  if (!sostegnoAmmesso(profilo, avviso)) return { ok: false, motivo: 'sostegno' };
  if (opts.ignoraFiltri === true) return { ok: true };

  const provinceProfilo = (profilo.province ?? []).map(normalizzaProvincia).filter(Boolean);
  if (provinceProfilo.length === 0) return { ok: false, motivo: 'profilo-senza-province' };
  const provinciaAvviso = normalizzaProvincia(avviso.province);
  if (!provinciaAvviso || !provinceProfilo.includes(provinciaAvviso)) {
    return { ok: false, motivo: 'provincia' };
  }

  const classiProfilo = (profilo.classi ?? []).map(normalizzaClasse).filter(Boolean);
  if (classiProfilo.length === 0) return { ok: false, motivo: 'profilo-senza-classi' };
  const classiAvviso = (avviso.classi ?? []).filter(Boolean);
  if (classiAvviso.length > 0) {
    const set = new Set(classiProfilo);
    return classiAvviso.some((c) => set.has(normalizzaClasse(c)))
      ? { ok: true }
      : { ok: false, motivo: 'classe' };
  }
  return materiaCompatibileConClassi(avviso.materia, classiProfilo)
    ? { ok: true }
    : { ok: false, motivo: 'classe' };
}

/**
 * FASE 4 — Trova nella tabella `profiles` gli utenti compatibili con un interpello:
 * email di notifica valida, provincia in comune e almeno una classe in comune
 * (più la GUARDIA SOSTEGNO: gli avvisi di sostegno solo a chi ha aderito).
 */
export async function findUtentiCompatibili(
  client: SupabaseClient | null,
  interpello: {
    province: string | null;
    classi: string[];
    /** Titolo dell'avviso: serve alla guardia sostegno (parole chiave). */
    titolo?: string | null;
    /** Materia inferita dallo scraper (es. "Sostegno"): guardia sostegno. */
    materia?: string | null;
  },
  opts: { ignoraFiltri?: boolean } = {},
): Promise<UtenteCompatibile[]> {
  if (!client) return [];

  /** Colonne storiche del profilo (quelle che esistono da sempre). */
  const COLONNE_PROFILO =
    'id, email, email_notifica, nome, province_interesse, province_attive, classi_concorso, telegram_chat_id, piano, radar_attivo, is_free_forever, notifiche_blocco_inviato, notifiche_recap_inviato';

  try {
    // `sostegno` è la preferenza dell'area sostegno (migrazione
    // `20260914040000_add_profiles_sostegno.sql`). Se il DB non è ancora migrato la
    // SELECT fallirebbe (42703/PGRST204) e NESSUN utente riceverebbe notifiche:
    // si rilegge quindi senza la colonna, trattandola come non valorizzata (vale
    // comunque l'adesione implicita via classe di sostegno).
    let { data, error } = await client
      .from('profiles')
      .select(`${COLONNE_PROFILO}, sostegno`);
    if (error && /sostegno/i.test(error.message)) {
      console.warn(
        'MatchingEngine — colonna `profiles.sostegno` assente: applicare la migrazione 20260914040000_add_profiles_sostegno.sql.',
      );
      ({ data, error } = await client.from('profiles').select(COLONNE_PROFILO));
    }

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

      // REGOLA UNICA (profilo ↔ opportunità): provincia E classe devono
      // combaciare davvero, con le classi normalizzate (A-026 ≡ A-26 ≡ A042) e la
      // guardia sostegno. La logica sta in `avvisoCompatibileConProfilo`, la stessa
      // usata dal digest e dal dispatch: nessuna copia divergente.
      const compatibilita = avvisoCompatibileConProfilo(
        { province: provinceProfilo, classi: classiProfilo, sostegno: riga.sostegno === true },
        {
          province: interpello.province,
          classi: interpello.classi,
          materia: interpello.materia,
          titolo: interpello.titolo,
        },
        { ignoraFiltri: opts.ignoraFiltri === true },
      );
      if (!compatibilita.ok) continue;

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
        sostegno: riga.sostegno === true,
      });
    }
    return compatibili;
  } catch (err) {
    console.warn('MatchingEngine — ricerca utenti compatibili fallita:', (err as Error).message);
    return [];
  }
}

/**
 * TUTTI i profili NOTIFICABILI (canale valido + Radar attivo), senza filtro di
 * provincia/classe: è l'insieme su cui gira il DIGEST GIORNALIERO, che poi decide
 * quali opportunità includere per ciascun utente.
 *
 * Riutilizza la stessa validazione di `findUtentiCompatibili` (province `null` =
 * nessun filtro geografico, classi vuote = nessun filtro classe): una sola
 * implementazione delle regole di eleggibilità, niente logica duplicata.
 */
export async function elencaUtentiNotificabili(
  client: SupabaseClient | null,
): Promise<UtenteCompatibile[]> {
  // `ignoraFiltri: true` → TUTTI i profili con un canale valido e Radar attivo,
  // anche quelli con province/classi configurate (il filtro per opportunità lo fa
  // poi `raccogliVociCanale`, che confronta classe per classe).
  return findUtentiCompatibili(client, { province: null, classi: [] }, { ignoraFiltri: true });
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Interpello } from '../data/interpelli';
import { classeByCodice, eAvvisoSostegno } from '../data/classiConcorso';
import { materie as catalogoMaterie } from '../data/ordiniMaterie';
import { province } from '../data/province';
import { normalizzaStatoArricchimento } from './statoArricchimento';

/**
 * FASE 3 — Matching Engine.
 * Query sugli interpelli di Supabase filtrando per le province di interesse e le
 * classi di concorso del profilo utente.
 *
 * DUE strade, UNA semantica:
 *  1. **RPC nativa** `public.match_interpelli` (migrazione
 *     `20261004110000_add_rpc_match_interpelli.sql`): il filtro vive nel database
 *     — province con `= any (array)`, classi con overlap `&&` sull'indice GIN
 *     *più* un confronto tollerante delle forme (`A-22` ≡ `A-022` ≡ `A22`), ramo
 *     sostegno ESPLICITO (inclusione permanente), «attivo» = senza scadenza o non
 *     scaduto. Nessun falso negativo da rigidità di formato, nessun taglio del
 *     `limit` prima del filtro in memoria;
 *  2. **Fallback PostgREST** (`in('province')` + `overlaps('class_codes')`) quando
 *     la RPC non è ancora applicata o risponde con errore: il feed non si rompe
 *     mai per una migrazione mancante.
 *
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
  /**
   * Stato dell'anagrafica della riga (`completo` | `parziale`): `parziale` NON è
   * un motivo di scarto — è solo l'etichetta onesta con cui l'interfaccia dichiara
   * il ripiego «Scuola non specificata / Più plessi» (direttiva 04/10/2026).
   */
  stato_arricchimento?: string | null;
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
    // Stato dell'anagrafica (`completo`/`parziale`/`null` per le righe storiche):
    // l'app dichiara il ripiego «Scuola non specificata / Più plessi» senza mai
    // nascondere nulla.
    statoArricchimento: normalizzaStatoArricchimento(r.stato_arricchimento),
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

/** Nome della RPC nativa del Matching Engine (`..._add_rpc_match_interpelli.sql`). */
export const RPC_MATCH_INTERPELLI = 'match_interpelli';

/**
 * Query la tabella `interpelli` applicando i filtri del Matching Engine.
 *
 * Ordine: **RPC nativa** `match_interpelli` → **query PostgREST equivalente**. La
 * RPC concentra la regola nel database (overlap `&&` sull'indice GIN, forme
 * tolleranti, ramo sostegno esplicito, «attivo» = senza scadenza o non scaduto);
 * la query PostgREST resta come rete di sicurezza per un ambiente in cui la
 * migrazione non è ancora applicata — il feed non si svuota mai per una
 * migrazione mancante.
 *
 * Restituisce `null` se Supabase non è configurato o se ANCHE il fallback
 * fallisce (il chiamante decide cosa mostrare), altrimenti l'array di righe.
 */
export async function searchInterpelli(
  client: SupabaseClient | null,
  criteri: MatchingCriteri = {},
): Promise<InterpelloDB[] | null> {
  if (!client) return null;

  const { province: provinceFiltro, classi, limit } = criteri;
  // Supporto MULTI-provincia (fino a 4 con PRO): codici normalizzati in maiuscolo
  // per non perdere match per differenze di formato.
  const provinceCercate = [
    ...new Set((provinceFiltro ?? []).map((p) => (p ?? '').trim().toUpperCase()).filter(Boolean)),
  ];
  // TUTTE le varianti di formato delle classi del profilo (A-26 ≡ A-026 ≡ A26):
  // senza di esse un avviso scritto in un formato diverso non arriverebbe mai.
  const varianti =
    classi && classi.length > 0 ? [...new Set(classi.flatMap(variantiClasseCodice))] : [];

  // 1) RPC NATIVA: il filtro vive nel database (una sola regola, indicizzata).
  const { data, error } = await client.rpc(RPC_MATCH_INTERPELLI, {
    p_province: provinceCercate.length > 0 ? provinceCercate : null,
    p_classi: varianti.length > 0 ? varianti : null,
    p_sostegno: true,
    p_limit: limit ?? 100,
  });
  if (!error) return (data ?? []) as InterpelloDB[];
  console.warn(
    `MatchingEngine — RPC ${RPC_MATCH_INTERPELLI} non utilizzabile (${error.message}): ` +
      'uso la query PostgREST equivalente.',
  );

  // 2) FALLBACK PostgREST (migrazione non applicata): stessa semantica.
  let query = client.from('interpelli').select('*');
  if (provinceCercate.length > 0) query = query.in('province', provinceCercate);
  if (varianti.length > 0) query = query.overlaps('class_codes', varianti);

  // Esclude gli interpelli SCADUTI dalle liste attive pubbliche
  // (senza scadenza → mantenuti: non dimostrabili come scaduti).
  const oggiIso = new Date().toISOString().slice(0, 10);
  const { data: righe, error: erroreFallback } = await query
    .or(`expiration_date.is.null,expiration_date.gte.${oggiIso}`)
    .order('expiration_date', { ascending: true, nullsFirst: false })
    .limit(limit ?? 100);

  if (erroreFallback) {
    console.warn('MatchingEngine — lettura tabella interpelli:', erroreFallback.message);
    return null;
  }
  return (righe ?? []) as InterpelloDB[];
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
   * `profiles.sostegno`: valore STORICO. Da questa versione NON è più un filtro
   * (l'area sostegno è sempre inclusa, senza opt-out): resta nel tipo e nel DB
   * solo per compatibilità delle righe già salvate.
   */
  sostegno?: boolean;
  /**
   * COMPETENZE EXTRA del catalogo (`profiles.materie_id`): «In cosa puoi
   * lavorare, anche oltre la tua classe di concorso?». Servono alla regola unica
   * per i profili configurati SOLO a competenze (nessuna classe di concorso).
   */
  materieId?: string[];
  /** PAROLE CHIAVE libere del profilo (`profiles.materie_custom`). */
  materieCustom?: string[];
}

/**
 * AREA SOSTEGNO — INCLUSIONE PERMANENTE (policy 04/10/2026).
 *
 * Gli avvisi di SOSTEGNO (ADAA/ADEE/ADMM/ADSS, riconosciuti da `eAvvisoSostegno`:
 * codice `AD…` fra le classi oppure titolo/materia che lo dichiarano) sono SEMPRE
 * consegnati. Non esiste più alcuna preferenza dell'utente, nessun interruttore e
 * nessun opt-out: la consegna non dipende da `profiles.sostegno`.
 *
 * Vale allo stesso modo per l'**alternativa all'insegnamento della religione
 * cattolica**: resta un'opportunità come le altre, senza filtri o preferenze
 * dedicate.
 *
 * Perché: la vecchia guardia (`sostegnoAmmesso`/`utenteAderisceSostegno`) toglieva
 * gli avvisi AD… a chi non aveva mai risposto alla domanda — un filtro applicato
 * all'insaputa dell'utente — e riduceva il volume di opportunità utili. La
 * consegna resta comunque geolocalizzata (provincia del profilo) e passa dal gate
 * di qualità (link diretto all'avviso + recapito di candidatura): nessun invio a
 * caso, solo l'area sostegno non è più una condizione di esclusione.
 */
export function avvisoDiSostegno(avviso: {
  classi?: readonly string[] | null;
  titolo?: string | null;
  materia?: string | null;
}): boolean {
  return eAvvisoSostegno(avviso.classi, avviso.titolo, avviso.materia);
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
  /** Competenze/laboratori extra del catalogo (`profiles.materie_id`). */
  materieId?: readonly string[] | null;
  /** Parole chiave libere scritte dall'utente (`profiles.materie_custom`). */
  materieCustom?: readonly string[] | null;
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
 * Normalizza un'etichetta di competenza per il confronto testuale: minuscole,
 * senza accenti/diacritici, solo lettere e numeri separati da spazio singolo.
 * («Intelligenza Artificiale» → «intelligenza artificiale», «attività» →
 * «attivita»). Unica normalizzazione per profilo e avviso: nessuna copia.
 */
export function normalizzaCompetenza(testo?: string | null): string {
  return (testo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Parole presenti nelle etichette delle competenze ma senza potere
 * discriminante: da sole NON identificano una competenza (un avviso con
 * «laboratorio» o «scuola» nel titolo non riguarda chi ha scritto «laboratori»).
 */
const TOKEN_COMPETENZA_GENERICI = new Set([
  'degli',
  'della',
  'delle',
  'dello',
  'nella',
  'nelle',
  'negli',
  'oltre',
  'altro',
  'altri',
  'altre',
  'attivita', // «attività» (già senza accenti dopo la normalizzazione)
  'classi',
  'classe',
  'laboratori',
  'laboratorio',
  'materie',
  'progetti',
  'progetto',
  'scuole',
  'scuola',
]);

/** Sotto questa lunghezza un token è troppo corto per identificare qualcosa. */
const MIN_CARATTERI_TOKEN_COMPETENZA = 4;

/**
 * Trasforma una parola nella sua RADICE grezza (vocale finale caduta): fa
 * combaciare singolare e plurale senza una tavola di sinonimi — «inglese»/
 * «inglesi» → «ingles», «motoria»/«motorie» → «motori», «digitale»/«digitali» →
 * «digital». Le varianti semantiche (IA ↔ Intelligenza Artificiale) restano
 * fuori: sono materia della roadmap V2 (`docs/RADAR_ROADMAP_V2.md` §4).
 */
function radiceCompetenza(token: string): string {
  if (token.length < MIN_CARATTERI_TOKEN_COMPETENZA) return token;
  return /[aeiou]$/.test(token) ? token.slice(0, -1) : token;
}

/** Token significativi e già radicizzati di un'etichetta di competenza. */
export function tokenCompetenza(testo?: string | null): string[] {
  return normalizzaCompetenza(testo)
    .split(' ')
    .map((t) => t.trim())
    .filter((t) => t.length >= MIN_CARATTERI_TOKEN_COMPETENZA)
    .filter((t) => !TOKEN_COMPETENZA_GENERICI.has(t))
    .map(radiceCompetenza);
}

/**
 * Etichette leggibili delle competenze extra del profilo: gli id del catalogo
 * (`materie_id`) si risolvono nel nome della materia — così il confronto avviene
 * su testo («Lingua inglese»), non su un id opaco — e le parole chiave libere
 * (`materie_custom`) restano il testo scritto dall'utente.
 */
export function etichetteCompetenzeProfilo(profilo: ProfiloCompatibilita): string[] {
  const daCatalogo = (profilo.materieId ?? [])
    .filter(Boolean)
    .map((id) => catalogoMaterie.find((m) => m.id === id)?.nome ?? String(id));
  const libere = (profilo.materieCustom ?? []).filter(Boolean).map((k) => String(k));
  return [...daCatalogo, ...libere].map((e) => e.trim()).filter(Boolean);
}

/**
 * True se una COMPETENZA o PAROLA CHIAVE dichiarata dall'utente compare nel testo
 * dell'avviso (materia inferita dallo scraper o titolo). Confronto per token
 * radicizzati: «Lingua inglese» intercetta «Interpello di Inglese», «Intelligenza
 * artificiale» intercetta «… e Intelligenza Artificiale». Vale SOLO per i profili
 * senza classi di concorso (si veda `avvisoCompatibileConProfilo`).
 */
export function competenzaCompatibileConAvviso(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
): boolean {
  const tokenProfilo = new Set(etichetteCompetenzeProfilo(profilo).flatMap(tokenCompetenza));
  if (tokenProfilo.size === 0) return false;
  const tokenAvviso = new Set(tokenCompetenza(`${avviso.materia ?? ''} ${avviso.titolo ?? ''}`));
  if (tokenAvviso.size === 0) return false;
  for (const token of tokenProfilo) {
    if (tokenAvviso.has(token)) return true;
  }
  return false;
}

/**
 * REGOLA UNICA di compatibilità profilo ↔ opportunità (Radar e notifiche).
 *
 * STRICT: un'opportunità viene consegnata SOLO se
 *   1. l'avviso APPARTIENE alla provincia del profilo (mai avvisi di un'altra
 *      provincia: era il bug "Torino/Piemonte → opportunità di Prato/Toscana" per
 *      i profili senza province salvate);
 *   2. il profilo ha almeno un criterio tra CLASSI di concorso e
 *      COMPETENZE/PAROLE CHIAVE (`materie_id` + `materie_custom`: è la stessa
 *      validità di `validaConfigRadar`). Con le classi: intersezione con le
 *      classi dell'avviso (formato normalizzato A-022 ≡ A-22) o, se l'avviso non
 *      dichiara classi, materia coperta dalle classi utente. SENZA classi (profilo
 *      configurato solo su «In cosa puoi lavorare, anche oltre la tua classe di
 *      concorso?»): la competenza/parola chiave deve comparire nel testo
 *      dell'avviso, altrimenti l'utente non riceverebbe MAI nulla pur avendo una
 *      configurazione valida (era il falso negativo dei profili solo-competenza).
 *      Per i profili CON classi la regola storica resta invariata: le competenze
 *      non allargano la consegna, quindi nessun ritorno dei falsi positivi.
 *   3. ECCEZIONE SOSTEGNO: gli avvisi dell'area sostegno (codici `AD…` oppure
 *      titolo/materia che la dichiarano — `avvisoDiSostegno`) NON passano dal
 *      controllo di classe: sono SEMPRE consegnati nella provincia del profilo
 *      (policy di inclusione permanente, nessuna preferenza e nessun opt-out).
 *
 * `ignoraFiltri` serve SOLO a enumerare i profili notificabili (digest): salta i
 * controlli geografici/di classe (compreso quello del sostegno).
 */
export function avvisoCompatibileConProfilo(
  profilo: ProfiloCompatibilita,
  avviso: AvvisoCompatibilita,
  opts: { ignoraFiltri?: boolean } = {},
): EsitoCompatibilita {
  if (opts.ignoraFiltri === true) return { ok: true };

  const provinceProfilo = (profilo.province ?? []).map(normalizzaProvincia).filter(Boolean);
  if (provinceProfilo.length === 0) return { ok: false, motivo: 'profilo-senza-province' };
  const provinciaAvviso = normalizzaProvincia(avviso.province);
  if (!provinciaAvviso || !provinceProfilo.includes(provinciaAvviso)) {
    return { ok: false, motivo: 'provincia' };
  }

  const classiProfilo = (profilo.classi ?? []).map(normalizzaClasse).filter(Boolean);
  const competenzeProfilo = etichetteCompetenzeProfilo(profilo);
  if (classiProfilo.length === 0 && competenzeProfilo.length === 0) {
    return { ok: false, motivo: 'profilo-senza-classi' };
  }
  // AREA SOSTEGNO (e alternativa all'IRC): inclusione PERMANENTE. Nella provincia
  // dell'utente l'avviso di sostegno non viene mai scartato per assenza di classe
  // in comune: nessuna preferenza, nessun opt-out, più opportunità utili.
  if (avvisoDiSostegno(avviso)) return { ok: true };
  const classiAvviso = (avviso.classi ?? []).filter(Boolean);
  if (classiProfilo.length > 0) {
    // Profilo con CLASSI: regola STORICA, invariata. Le competenze/parole chiave
    // NON allargano la consegna dei profili che hanno già una classe — è la
    // cautela che evita il ritorno dei falsi positivi.
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

  // Profilo SENZA classi (configurato solo su competenze e parole chiave):
  // l'unico criterio possibile è il testo dell'avviso. Se la competenza non
  // compare, resta il motivo `classe` — meglio nessun invio che un invio a caso.
  return competenzaCompatibileConAvviso(profilo, avviso)
    ? { ok: true }
    : { ok: false, motivo: 'classe' };
}

/**
 * FASE 4 — Trova nella tabella `profiles` gli utenti compatibili con un interpello:
 * email di notifica valida, provincia in comune e almeno una classe in comune.
 * Gli avvisi dell'AREA SOSTEGNO sono l'eccezione: vengono consegnati a tutti i
 * profili della provincia (inclusione permanente, nessuna preferenza).
 */
export async function findUtentiCompatibili(
  client: SupabaseClient | null,
  interpello: {
    province: string | null;
    classi: string[];
    /** Titolo dell'avviso: riconosce l'area sostegno (parole chiave). */
    titolo?: string | null;
    /** Materia inferita dallo scraper (es. "Sostegno"): area sostegno. */
    materia?: string | null;
  },
  opts: { ignoraFiltri?: boolean } = {},
): Promise<UtenteCompatibile[]> {
  if (!client) return [];

  /** Colonne storiche del profilo (quelle che esistono da sempre). */
  const COLONNE_PROFILO =
    'id, email, email_notifica, nome, province_interesse, province_attive, classi_concorso, telegram_chat_id, piano, radar_attivo, is_free_forever, notifiche_blocco_inviato, notifiche_recap_inviato';

  try {
    // Colonne opzionali: `sostegno` è un valore STORICO dell'area sostegno
    // (migrazione `20260914040000_add_profiles_sostegno.sql`) — non è più un
    // filtro, viene solo riletto per compatibilità — mentre
    // `materie_id`/`materie_custom` sono le COMPETENZE/PAROLE CHIAVE del passo
    // «In cosa puoi lavorare, anche oltre la tua classe di concorso?» (presenti
    // fin dalla prima creazione di `profiles`). Se il DB non ha `sostegno` la
    // SELECT fallirebbe (42703/PGRST204) e NESSUN utente riceverebbe notifiche:
    // si rilegge quindi senza la colonna, senza alcun effetto sulla consegna.
    let { data, error } = await client
      .from('profiles')
      .select(`${COLONNE_PROFILO}, sostegno, materie_id, materie_custom`);
    if (error && /sostegno/i.test(error.message)) {
      console.warn(
        'MatchingEngine — colonna `profiles.sostegno` assente: applicare la migrazione 20260914040000_add_profiles_sostegno.sql.',
      );
      ({ data, error } = await client
        .from('profiles')
        .select(`${COLONNE_PROFILO}, materie_id, materie_custom`));
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
      // COMPETENZE E PAROLE CHIAVE del profilo: senza queste due colonne il
      // matching non aveva alcun criterio per i profili configurati solo su «In
      // cosa puoi lavorare, anche oltre la tua classe di concorso?» (falso
      // negativo silenzioso: Radar acceso, zero opportunità).
      const competenzeCatalogo: string[] = riga.materie_id ?? [];
      const competenzeLibere: string[] = riga.materie_custom ?? [];

      // REGOLA UNICA (profilo ↔ opportunità): provincia E classe devono
      // combaciare davvero, con le classi normalizzate (A-026 ≡ A-26 ≡ A042) e
      // l'area SOSTEGNO sempre inclusa. La logica sta in
      // `avvisoCompatibileConProfilo`, la stessa usata dal digest e dal dispatch:
      // nessuna copia divergente.
      const compatibilita = avvisoCompatibileConProfilo(
        {
          province: provinceProfilo,
          classi: classiProfilo,
          sostegno: riga.sostegno === true,
          materieId: competenzeCatalogo,
          materieCustom: competenzeLibere,
        },
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
        // Trasmesse al digest, che ri-applica la stessa regola opportunità per
        // opportunità: senza di esse il filtro perdeva le competenze.
        materieId: competenzeCatalogo,
        materieCustom: competenzeLibere,
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

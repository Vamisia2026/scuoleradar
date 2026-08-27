// ============================================================
// Edge Function Supabase — Generatore Modulistica (DeepSeek + Cache)
//
// Sistema dinamico di ricerca, generazione e caching dei documenti
// scolastici ("Archivista Premuroso").
//
// Azioni (body JSON):
//   { azione: 'ricerca', query }             → cerca nel catalogo + cache;
//       risponde con esito 'prosegui' (con eventuale modello catalogo) oppure
//       esito 'chiarimento' con domande del tipo "Consigliamo di precisare se…".
//   { azione: 'genera', query, catalogoId? } → genera via DeepSeek con cache:
//       query_hash SHA-256 → se già presente in generated_modules restituisce
//       il documento salvato a costo API zero; altrimenti chiama DeepSeek e
//       salva il risultato in generated_modules.
//   { azione: 'salva', module_key, module_source, title, tipo } → inserisce
//       il modulo in user_saved_modules (per la tab "I miei Modelli Scaricati").
//   { azione: 'rimuovi', module_key }        → rimuove un modulo salvato.
//   { azione: 'miei' }                       → elenco dei moduli salvati dell'utente.
//
// Autenticazione: JWT verificato (default --verify-jwt). 'ricerca' funziona
// anche con token anonimo; 'genera'/'salva'/'rimuovi'/'miei' richiedono un
// utente autenticato (protegge il budget API DeepSeek).
//
// Secrets richiesti:
//   DEEPSEEK_API_KEY   (obbligatoria) — chiave API DeepSeek
//   DEEPSEEK_MODEL     (opzionale)    — modello, default 'deepseek-chat'
//
// Deploy:
//   supabase secrets set DEEPSEEK_API_KEY=sk-... --project-ref gwdmsgsshvdnfrplbjiv
//   supabase functions deploy genera-modulo --project-ref gwdmsgsshvdnfrplbjiv
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') ?? '';
const DEEPSEEK_MODEL = Deno.env.get('DEEPSEEK_MODEL') ?? 'deepseek-chat';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/** Header CORS per richieste dal browser. */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Decodifica il payload (base64url) di un JWT (la firma è verificata dal runtime). */
function decodeJwt(token: string): { sub?: string } | null {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as { sub?: string };
  } catch {
    return null;
  }
}

function risposta(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS },
  });
}

/** Normalizza una query per matching e hash (minuscole, spazi collassati). */
function normalizza(testo: string): string {
  return testo.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Hash SHA-256 (Web Crypto) della query normalizzata — chiave di cache. */
async function hashQuery(query: string): Promise<string> {
  const data = new TextEncoder().encode(query);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------- Catalogo ------------------------------- */

interface CatalogoModulo {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  descrizione: string;
  /** Parole chiave per il matching semantico (minuscole). */
  parole: string[];
}

/** Copia embedded del catalogo di src/data/moduli.ts (le Edge Function non importano da src). */
const CATALOGO: CatalogoModulo[] = [
  {
    id: 'supplenza-breve',
    nome: 'Domanda di supplenza breve',
    tipo: 'DOCX',
    categoria: 'Supplenze',
    descrizione: 'Modello compilabile per la domanda di supplenza breve da inviare alle scuole.',
    parole: ['supplenza breve', 'supplenza', 'incarico', 'supplente'],
  },
  {
    id: 'mad',
    nome: 'Domanda di messa a disposizione (MAD)',
    tipo: 'DOCX',
    categoria: 'Supplenze',
    descrizione: 'Modello aggiornato per la messa a disposizione per insegnamenti di ogni ordine e grado.',
    parole: ['messa a disposizione', 'mad', 'messa in disponibilità'],
  },
  {
    id: 'sostegno-disponibilita',
    nome: 'Domanda disponibilità incarico sostegno (ADEE/ADSS)',
    tipo: 'DOCX',
    categoria: 'Sostegno',
    descrizione: 'Modello per manifestare la disponibilità a incarichi di sostegno nelle classi ADEE/ADSS.',
    parole: ['sostegno', 'adee', 'adss', 'incarico sostegno', 'disponibilità'],
  },
  {
    id: 'pei-osservazioni',
    nome: 'Modello PEI – sezione osservazioni',
    tipo: 'PDF',
    categoria: 'Sostegno',
    descrizione: 'Schema di osservazione per il PEI e per gli aggiornamenti del piano di inclusione.',
    parole: ['pei', 'osservazioni', 'inclusione', 'piano educativo individualizzato'],
  },
  {
    id: 'autocertificazione-titoli',
    nome: 'Autocertificazione titoli di studio',
    tipo: 'PDF',
    categoria: 'Burocrazia',
    descrizione: 'Dichiarazione sostitutiva di certificazione dei titoli posseduti (DPR 445/2000).',
    parole: ['autocertificazione', 'titoli di studio', 'dichiarazione sostitutiva', 'dpr 445'],
  },
  {
    id: 'deleghe-privacy',
    nome: 'Modulo deleghe e consenso privacy',
    tipo: 'PDF',
    categoria: 'Burocrazia',
    descrizione: 'Modello di delega e informativa privacy per i rapporti con le segreterie scolastiche.',
    parole: ['delega', 'privacy', 'consenso', 'informativa'],
  },
  {
    id: 'checklist-mobilita',
    nome: 'Checklist mobilità annuale',
    tipo: 'PDF',
    categoria: 'Mobilità',
    descrizione: 'Elenco dei documenti e delle scadenze da seguire per la mobilità annuale.',
    parole: ['checklist', 'mobilità', 'mobilita', 'trasferimento'],
  },
  {
    id: 'lettera-presentazione',
    nome: 'Lettera di presentazione',
    tipo: 'DOCX',
    categoria: 'Candidature',
    descrizione: 'Template professionale per presentare la tua candidatura alle istituzioni scolastiche.',
    parole: ['lettera', 'presentazione', 'candidatura'],
  },
];

/* --------------------- Dimensioni di chiarimento --------------------- */

/** Tipologie di documento rilevabili dalla query. */
const DIMENSIONE_TIPO: Record<string, string[]> = {
  mad: ['messa a disposizione', 'mad'],
  supplenza: ['supplenza', 'interpello', 'incarico', 'supplente'],
  autocertificazione: ['autocertificazione', 'dichiarazione sostitutiva', 'dpr 445', 'titoli di studio'],
  lettera: ['lettera', 'presentazione'],
  pei: ['pei', 'osservazioni', 'inclusione', 'piano educativo individualizzato'],
  mobilita: ['mobilità', 'mobilita', 'trasferimento'],
  delega_privacy: ['delega', 'privacy', 'consenso'],
  checklist: ['checklist', 'elenco'],
};

/** Ordini di scuola rilevabili dalla query. */
const DIMENSIONE_ORDINE: Record<string, string[]> = {
  infanzia: ['infanzia', 'asilo', 'materna', "scuola dell'infanzia"],
  primaria: ['primaria', 'elementare'],
  secondaria1: ['secondaria di i grado', 'secondaria i', 'scuola media', 'medie', 'i grado'],
  secondaria2: ['secondaria di ii grado', 'secondaria ii', 'superiori', 'liceo', 'istituto tecnico', 'professionale', 'ii grado'],
  cpia: ['cpia', 'adulti', 'adulto', 'alfabetizzazione', 'italiano l2', 'serale', 'primo livello'],
  pon: ['pon', 'pnrr', 'esperto esterno', 'progetto'],
  ata: ['ata', 'collaboratore scolastico', 'assistente tecnico', 'assistente amministrativo', 'dsga'],
};

const STOPWORD = new Set([
  'per', 'con', 'che', 'gli', 'alla', 'allo', 'della', 'delle', 'dei', 'degli', 'una', 'uno',
  'un', 'il', 'lo', 'la', 'le', 'del', 'nel', 'nella', 'su', 'di', 'da', 'a', 'in', 'come',
  'quale', 'quali', 'mia', 'tuo',
]);

/** Verifica se la frase chiave p è contenuta nella query normalizzata q. */
function matchParole(q: string, p: string): boolean {
  const chiave = normalizza(p);
  if (q.includes(chiave)) return true;
  const paroleChiave = chiave.split(' ').filter((w) => w.length > 1);
  if (paroleChiave.length < 2) return false;
  const token = new Set(q.split(' '));
  return paroleChiave.every((w) => token.has(w));
}

/** Estrae le dimensioni rilevanti dalla query (tipo di documento e ordine di scuola). */
function trovaDimensioni(query: string): { tipo: string | null; ordine: string | null } {
  const q = normalizza(query);
  let tipo: string | null = null;
  for (const [key, parole] of Object.entries(DIMENSIONE_TIPO)) {
    if (parole.some((p) => matchParole(q, p))) {
      tipo = key;
      break;
    }
  }
  let ordine: string | null = null;
  for (const [key, parole] of Object.entries(DIMENSIONE_ORDINE)) {
    if (parole.some((p) => matchParole(q, p))) {
      ordine = key;
      break;
    }
  }
  return { tipo, ordine };
}

/* ------------------------------- Matching ------------------------------- */

/** Punteggio di affinità tra la query e un modulo del catalogo. */
function punteggioCatalogo(query: string, m: CatalogoModulo): number {
  const q = normalizza(query);
  const paroleQuery = q.split(' ').filter((w) => w.length >= 4 && !STOPWORD.has(w));
  if (paroleQuery.length === 0) return 0;
  let hit = 0;
  for (const kw of m.parole) {
    if (matchParole(q, kw)) hit += normalizza(kw).split(' ').length;
  }
  const testo = normalizza(`${m.nome} ${m.descrizione}`);
  for (const w of paroleQuery) {
    if (testo.includes(w)) hit += 1;
  }
  return hit / paroleQuery.length;
}

/** Punteggio di affinità tra la query e un documento già generato (per titolo). */
function punteggioTesto(query: string, testo: string): number {
  const q = normalizza(query);
  const paroleQuery = q.split(' ').filter((w) => w.length >= 4 && !STOPWORD.has(w));
  if (paroleQuery.length === 0) return 0;
  const t = normalizza(testo);
  let hit = 0;
  for (const w of paroleQuery) {
    if (t.includes(w)) hit += 1;
  }
  return hit / paroleQuery.length;
}

/** Cerca tra i documenti già in cache (generated_modules) per titolo. */
async function cercaGenerati(supabase: ReturnType<typeof createClient>, q: string) {
  try {
    const { data } = await supabase
      .from('generated_modules')
      .select('id, title')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!data) return [];
    return data
      .map((r) => ({
        id: String(r.id),
        title: String(r.title),
        punteggio: punteggioTesto(q, String(r.title)),
      }))
      .filter((r) => r.punteggio > 0.2)
      .sort((a, b) => b.punteggio - a.punteggio)
      .slice(0, 3);
  } catch (err) {
    console.warn('genera-modulo — cercaGenerati:', (err as Error).message);
    return [];
  }
}

/* --------------------------- Domande chiarimento --------------------------- */

interface DomandaChiarimento {
  id: string;
  testo: string;
  opzioni: string[];
}

function domandaTipo(): DomandaChiarimento {
  return {
    id: 'tipo',
    testo: 'Consigliamo di precisare il tipo di documento che ti serve…',
    opzioni: [
      'Messa a disposizione (MAD)',
      'Domanda di supplenza (interpello / incarico)',
      'Autocertificazione titoli di studio (DPR 445/2000)',
      'Lettera di presentazione per candidatura',
      'Modulo PEI / sostegno (osservazioni)',
      'Checklist mobilità / trasferimento',
      'Delega o consenso privacy',
      'Altro documento',
    ],
  };
}

function domandaOrdine(): DomandaChiarimento {
  return {
    id: 'ordine',
    testo: 'Consigliamo di precisare a quale ordine di scuola è destinato il documento…',
    opzioni: [
      "Scuola dell'Infanzia",
      'Scuola Primaria',
      'Scuola Secondaria di I grado',
      'Scuola Secondaria di II grado',
      'CPIA / educazione degli adulti',
      'Personale ATA (collaboratori, assistenti, DSGA)',
      'Progetti PON / PNRR (esperti esterni)',
    ],
  };
}

/* ------------------------------ Azione ricerca ------------------------------ */

/**
 * Cerca il documento più adatto alla query:
 * - match forte con il catalogo + dimensioni chiare → esito 'prosegui' (con catalogo)
 * - dimensioni chiare ma nessun catalogo forte → esito 'prosegui' (catalogo null)
 * - dimensioni mancanti / query ambigua → esito 'chiarimento' con domande
 *   dal tono dell'"Archivista Premuroso" (mai la forma impersonale "si consiglia").
 */
async function azioneRicerca(supabase: ReturnType<typeof createClient>, query: string) {
  const q = normalizza(query);
  if (q.length < 4) {
    return {
      esito: 'chiarimento',
      motivo: 'query_troppo_corta',
      domande: [domandaTipo(), domandaOrdine()],
      suggerimento: null,
    };
  }

  // 1) Match con il catalogo
  const punteggi = CATALOGO.map((m) => ({ id: m.id, punteggio: punteggioCatalogo(q, m) }));
  punteggi.sort((a, b) => b.punteggio - a.punteggio);
  const best = punteggi[0];
  const second = punteggi[1] ?? { punteggio: 0 };
  const distacco = best.punteggio - second.punteggio;

  // 2) Documenti già generati simili (cache)
  const generati = await cercaGenerati(supabase, q);
  const suggerimento = generati.length > 0 ? { id: generati[0].id, title: generati[0].title } : null;

  // 3) Dimensioni mancanti → chiarimento
  const dim = trovaDimensioni(q);
  const domande: DomandaChiarimento[] = [];
  if (!dim.tipo) domande.push(domandaTipo());
  if (!dim.ordine) domande.push(domandaOrdine());

  if (domande.length > 0) {
    return { esito: 'chiarimento', motivo: 'dimensioni_mancanti', domande, suggerimento };
  }

  // 4) Match forte e non ambiguo → prosegui con il modello del catalogo
  if (best.punteggio >= 0.7 && distacco >= 0.35) {
    const cat = CATALOGO.find((c) => c.id === best.id)!;
    return {
      esito: 'prosegui',
      catalogo: { id: cat.id, nome: cat.nome, tipo: cat.tipo, descrizione: cat.descrizione },
    };
  }

  // 5) Query chiara ma nessun catalogo dominante → generazione diretta
  return { esito: 'prosegui', catalogo: null };
}

/* ------------------------------ DeepSeek ------------------------------ */

/**
 * Prompt di sistema per DeepSeek ("Archivista Premuroso"):
 *  - dati generici con segnaposto [Tra Parentesi Quadre]
 *  - rispetto della normativa scolastica italiana
 *  - nota sulle Regioni a Statuto Speciale
 *  - HTML pulito pronto per rendering e conversione in PDF
 */
const SISTEMA_PROMPT = `Sei l'"Archivista Premuroso" di ScuoleRadar.it, un esperto di modulistica scolastica italiana. Hai il compito di redigere il documento richiesto dall'utente.

REGOLE NON NEGOZIABILI:
1. DATI GENERICI — Non inventare mai dati reali. Ogni dato personale o variabile va inserito SOLO come segnaposto tra parentesi quadre, es. [Nome e Cognome], [Data di nascita], [Luogo di nascita], [Codice Fiscale], [Residenza], [Indirizzo Email], [Telefono], [Data odierna], [Nome Scuola], [Codice Meccanografico], [Comune], [Provincia]. Scegli i segnaposto in base al contesto del documento.
2. NORMATIVA — Rispetta la normativa scolastica italiana vigente. Cita i riferimenti normativi pertinenti quando il documento lo richiede (es. DPR 275/1999, DPR 445/2000, D.Lgs. 297/1994, Legge 107/2015, D.Lgs. 59/2017, DL 36/2022, D.M. istitutivi delle classi di concorso), indicandoli con precisione.
3. REGIONI A STATUTO SPECIALE — Se la richiesta riguarda o può riguardare una Regione a Statuto Speciale (Valle d'Aosta, Trentino-Alto Adige/Südtirol, Friuli-Venezia Giulia, Sicilia, Sardegna), aggiungi una breve nota sulle eventuali peculiarità normative locali (competenze legislative, percorsi abilitanti, reclutamento) e usa il segnaposto [Regione a Statuto Speciale] dove rilevante.
4. HTML PER STAMPA/PDF — Produci SOLO HTML pulito e semantico, pronto per il rendering e la conversione in PDF:
   - Il documento inizia con un titolo <h1> (solo testo: niente logo, niente intestazioni di piattaforma).
   - Usa <h2> per le sezioni principali e <h3> per le sottosezioni, con testi brevi e descrittivi.
   - Usa <table> con <thead> e <tbody> per le tabelle dati; celle con padding 8px e righe alternate chiare (righe pari con sfondo #f9fafb).
   - Usa liste <ol>/<ul> per elenchi e campi da compilare.
   - Testo base 12pt con interlinea 1.3 (font di sistema Arial/Inter).
   - Nessun elemento <style>, <script>, <nav>, header, footer, banner o testo pubblicitario: intestazione, piè di pagina e indice sono gestiti automaticamente dalla piattaforma.
5. LINGUAGGIO — Scrivi in italiano corrente, professionale e vicino a chi lo usa; mantieni il rigore formale dei documenti ufficiali senza burocratese inutile.
6. RISPOSTA — Restituisci ESCLUSIVAMENTE l'HTML richiesto, senza commenti, senza markdown, senza triple backtick, senza testo introduttivo o finale.`;

/** Costruisce il prompt utente per DeepSeek a partire dalla query e dal modello di catalogo. */
function costruisciPromptUtente(query: string, catalogo: CatalogoModulo | null): string {
  const dim = trovaDimensioni(query);
  const dettagli: string[] = [];
  if (dim.tipo) dettagli.push(`Tipo di documento: ${dim.tipo}`);
  if (dim.ordine) dettagli.push(`Ordine di scuola: ${dim.ordine}`);
  const contesto = catalogo
    ? `\n\nModello di riferimento del catalogo ScuoleRadar da adattare al caso specifico: "${catalogo.nome}" (${catalogo.tipo}) — ${catalogo.descrizione}`
    : '';
  const dettagliStr = dettagli.length > 0 ? `\nContesto rilevato dalla richiesta: ${dettagli.join('; ')}.` : '';
  return `Redigi il documento richiesto dall'utente.\n\nRichiesta: ${query}${dettagliStr}${contesto}`;
}

/** Chiama l'API di DeepSeek (chat completions) e restituisce il contenuto testuale. */
async function chiamaDeepSeek(promptUtente: string): Promise<string> {
  if (
    !DEEPSEEK_API_KEY ||
    DEEPSEEK_API_KEY.includes('xxxx') ||
    DEEPSEEK_API_KEY.includes('your-') ||
    DEEPSEEK_API_KEY.includes('sk-xxx')
  ) {
    throw new Error('Generatore non configurato: manca il secret DEEPSEEK_API_KEY.');
  }
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: SISTEMA_PROMPT },
        { role: 'user', content: promptUtente },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message ?? `DeepSeek HTTP ${res.status}`;
    throw new Error(`DeepSeek: ${msg}`);
  }
  const contenuto = (data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
    ?.message?.content;
  if (!contenuto || !contenuto.trim()) throw new Error('DeepSeek ha risposto senza contenuto.');
  return contenuto;
}

/** Rimuove eventuali code fence markdown e wrapping da documento completo. */
function pulisciHtml(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/i, '');
  const body = s.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (body) s = body[1].trim();
  // Se non contiene tag HTML, lo avvolgiamo in un paragrafo.
  if (!/<[a-z][\s\S]*>/i.test(s)) s = `<p>${s}</p>`;
  return s;
}

/** Estrae il titolo dal primo <h1> presente nell'HTML. */
function estraiTitolo(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/** Rimuove il primo <h1> (il titolo viene reso dall'intestazione della piattaforma). */
function rimuoviPrimoH1(html: string): string {
  return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
}

/** Titolo di fallback derivato dalla query. */
function titoloDaQuery(query: string): string {
  const q = query.trim();
  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  return cap.length > 80 ? `${cap.slice(0, 77)}…` : cap;
}

/* ------------------------------ Azione genera ------------------------------ */

/**
 * Genera (o riusa in cache) il documento per la query.
 * - query_hash SHA-256 → lookup su generated_modules
 * - se presente: restituisce il documento salvato a costo API zero
 * - altrimenti: chiama DeepSeek e salva il risultato nella cache
 */
async function azioneGenera(
  supabase: ReturnType<typeof createClient>,
  query: string,
  catalogoId?: string,
) {
  const q = normalizza(query);
  if (q.length < 4) throw new Error('La richiesta è troppo breve per generare un documento.');

  const queryHash = await hashQuery(q);

  // Cache hit → costo API zero
  try {
    const { data: esistente, error: errCache } = await supabase
      .from('generated_modules')
      .select('*')
      .eq('query_hash', queryHash)
      .maybeSingle();
    if (!errCache && esistente) {
      return { esito: 'generato', cache: true, modulo: esistente };
    }
  } catch (err) {
    console.warn('genera-modulo — lookup cache:', (err as Error).message);
  }

  const catalogo = CATALOGO.find((c) => c.id === catalogoId) ?? null;
  const prompt = costruisciPromptUtente(q, catalogo);
  const raw = await chiamaDeepSeek(prompt);
  const pulito = pulisciHtml(raw);
  const html = rimuoviPrimoH1(pulito);
  const titolo = estraiTitolo(pulito) ?? titoloDaQuery(q);

  const riga = {
    query_hash: queryHash,
    query: q,
    title: titolo,
    content_html: html,
    meta: catalogo ? { catalogo_id: catalogo.id } : {},
  };

  try {
    const { data: nuovo, error } = await supabase
      .from('generated_modules')
      .upsert(riga, { onConflict: 'query_hash' })
      .select('*')
      .single();
    if (error) throw new Error(`Salvataggio nella cache fallito: ${error.message}`);
    return { esito: 'generato', cache: false, modulo: nuovo };
  } catch (err) {
    // Se la tabella non esiste (migration non applicata), restituiamo comunque il documento.
    console.warn('genera-modulo — upsert cache:', (err as Error).message);
    return {
      esito: 'generato',
      cache: false,
      modulo: {
        id: '',
        query_hash: queryHash,
        query: q,
        title: titolo,
        content_html: html,
        meta: {},
        created_at: '',
        updated_at: '',
      },
    };
  }
}

/* ----------------------- Azioni profilo utente ----------------------- */

/** Salva un modulo tra i "Modelli Scaricati" dell'utente (user_saved_modules). */
async function azioneSalva(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  body: Record<string, unknown>,
) {
  const moduleKey = String(body.module_key ?? '').trim();
  const title = String(body.title ?? '').trim();
  if (!moduleKey || !title) throw new Error('Parametri mancanti: module_key e title sono obbligatori.');

  const { data, error } = await supabase
    .from('user_saved_modules')
    .upsert(
      {
        user_id: userId,
        module_key: moduleKey,
        module_source: String(body.module_source ?? 'generated'),
        title,
        tipo: String(body.tipo ?? ''),
      },
      { onConflict: 'user_id,module_key' },
    )
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { esito: 'ok', salvo: true, riga: data };
}

/** Rimuove un modulo dai "Modelli Scaricati" dell'utente. */
async function azioneRimuovi(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  moduleKey: string,
) {
  if (!moduleKey) throw new Error('Parametro mancante: module_key.');
  const { error } = await supabase
    .from('user_saved_modules')
    .delete()
    .eq('user_id', userId)
    .eq('module_key', moduleKey);
  if (error) throw new Error(error.message);
  return { esito: 'ok', rimosso: true };
}

/** Elenco dei moduli salvati dell'utente (+ metadati dei documenti generati). */
async function azioneMiei(supabase: ReturnType<typeof createClient>, userId: string) {
  const { data, error } = await supabase
    .from('user_saved_modules')
    .select('id, module_key, module_source, title, tipo, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);

  // Recupera i metadati dei documenti generati collegati (per l'apertura rapida).
  const chiaviGen = (data ?? [])
    .filter((r) => String(r.module_key).startsWith('gen:'))
    .map((r) => String(r.module_key).slice(4));
  let generati: unknown[] = [];
  if (chiaviGen.length > 0) {
    try {
      const { data: gen } = await supabase
        .from('generated_modules')
        .select('id, title, query, created_at')
        .in('id', chiaviGen);
      generati = gen ?? [];
    } catch (err) {
      console.warn('genera-modulo — azioneMiei generati:', (err as Error).message);
    }
  }

  return { esito: 'ok', moduli: data ?? [], generati };
}

/* -------------------------------- serve -------------------------------- */

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return risposta({ ok: false, errore: 'Metodo non consentito' }, 405);
  }

  try {
    const auth = req.headers.get('Authorization') ?? '';
    const token = auth.replace('Bearer ', '').trim();
    const jwt = decodeJwt(token);
    const userId = jwt?.sub ?? null;

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const azione = String(body.azione ?? '').trim();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    switch (azione) {
      case 'ricerca': {
        const query = String(body.query ?? '').trim();
        const esito = await azioneRicerca(supabase, query);
        return risposta({ ok: true, ...esito });
      }
      case 'genera': {
        if (!userId) {
          return risposta({ ok: false, errore: 'Autenticazione richiesta per generare documenti.' }, 401);
        }
        const query = String(body.query ?? '').trim();
        const catalogoId = body.catalogoId ? String(body.catalogoId) : undefined;
        const esito = await azioneGenera(supabase, query, catalogoId);
        return risposta({ ok: true, ...esito });
      }
      case 'salva': {
        if (!userId) {
          return risposta({ ok: false, errore: 'Autenticazione richiesta.' }, 401);
        }
        const esito = await azioneSalva(supabase, userId, body);
        return risposta({ ok: true, ...esito });
      }
      case 'rimuovi': {
        if (!userId) {
          return risposta({ ok: false, errore: 'Autenticazione richiesta.' }, 401);
        }
        const esito = await azioneRimuovi(supabase, userId, String(body.module_key ?? ''));
        return risposta({ ok: true, ...esito });
      }
      case 'miei': {
        if (!userId) {
          return risposta({ ok: false, errore: 'Autenticazione richiesta.' }, 401);
        }
        const esito = await azioneMiei(supabase, userId);
        return risposta({ ok: true, ...esito });
      }
      default:
        return risposta({ ok: false, errore: `Azione sconosciuta: ${azione}` }, 400);
    }
  } catch (err) {
    console.error('genera-modulo — errore non gestito:', err);
    return risposta(
      { ok: false, errore: (err as Error).message ?? 'Errore interno del generatore.' },
      500,
    );
  }
});






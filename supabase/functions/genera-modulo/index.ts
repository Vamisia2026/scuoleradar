// ============================================================
// Edge Function Supabase — Generatore Modulistica (DeepSeek + Cache)
//
// Sistema di ricerca, intervista guidata, generazione e caching dei
// documenti scolastici ("Archivista Capo").
//
// Azioni (body JSON):
//   { azione: 'intervista', query, risposte } → intervista chirurgica:
//       una domanda alla volta (solo le dimensioni strettamente necessarie);
//       quando il profilo è completo risponde 'pronto' con l'impronta
//       dell'intervista (SHA-256 del profilo canonico) e, se già in cache
//       su generated_modules, il documento a costo API zero.
//   { azione: 'genera', query, profilo, catalogoId? } → genera via DeepSeek
//       con cache: la chiave di cache è l'impronta dell'intervista; se già
//       presente restituisce il documento salvato a costo API zero.
//   { azione: 'ricerca', query }             → ricerca nel catalogo + cache
//       (compatibilità legacy, con chiarimenti se ambigua).
//   { azione: 'salva', module_key, module_source, title, tipo } → inserisce
//       il modulo in user_saved_modules (per la tab "I miei Modelli Scaricati").
//   { azione: 'rimuovi', module_key }        → rimuove un modulo salvato.
//   { azione: 'miei' }                       → elenco dei moduli salvati dell'utente.
//
// Autenticazione: JWT verificato (default --verify-jwt). 'intervista' e
// 'ricerca' funzionano anche con token anonimo; 'genera'/'salva'/'rimuovi'/'miei'
// richiedono un utente autenticato (protegge il budget API DeepSeek).
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
  return testo
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
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
  sostegno: [
    'richiesta di sostegno',
    'richiesta sostegno',
    'sostegno',
    'assegnazione sostegno',
    'ore di sostegno',
  ],
  mad: ['messa a disposizione', 'mad'],
  supplenza: ['supplenza', 'interpello', 'incarico', 'supplente'],
  pei: ['pei', 'osservazioni', 'inclusione', 'piano educativo individualizzato', 'glho', 'glo'],
  certificazione: ['certificazione', 'l.104', 'legge 104', 'handicap', 'disabilità', 'disabilita'],
  autocertificazione: ['autocertificazione', 'dichiarazione sostitutiva', 'dpr 445', 'titoli di studio'],
  lettera: ['lettera', 'presentazione'],
  mobilita: ['mobilità', 'mobilita', 'trasferimento'],
  delega_privacy: ['delega', 'privacy', 'consenso'],
  checklist: ['checklist', 'elenco'],
  iscrizione: ['iscrizione', 'iscrivere', 'immatricolazione'],
};

/** Ordini di scuola rilevabili dalla query. */
const DIMENSIONE_ORDINE: Record<string, string[]> = {
  infanzia: ['infanzia', 'asilo', 'materna', "scuola dell'infanzia"],
  primaria: ['primaria', 'elementare'],
  secondaria1: ['secondaria di i grado', 'secondaria i', 'scuola media', 'medie', 'i grado'],
  secondaria2: [
    'secondaria di ii grado',
    'secondaria ii',
    'superiori',
    'liceo',
    'istituto tecnico',
    'professionale',
    'ii grado',
  ],
  universita: ['università', 'universita', 'ateneo', 'universitario', 'laurea'],
  enti: ['enti', 'ente locale', 'provincia', 'regione', 'segreteria', 'ufficio scolastico'],
  cpia: ['cpia', 'adulti', 'adulto', 'alfabetizzazione', 'italiano l2', 'serale', 'primo livello'],
  ata: ['ata', 'collaboratore scolastico', 'assistente tecnico', 'assistente amministrativo', 'dsga'],
};

/** Scopo della richiesta quando il documento è di tipo 'sostegno'. */
const DIMENSIONE_SCOPO_SOSTEGNO: Record<string, string[]> = {
  richiesta: ['richiesta', 'accertamento', 'assegnazione', 'richiedere'],
  incarico: ['incarico', 'disponibilità', 'disponibilita', 'adee', 'adss'],
  pei: ['pei', 'osservazioni', 'piano educativo', 'glho', 'glo', 'verbale'],
  autonomia: ['assistente', 'autonomia', 'educatore', 'comunicazione'],
};

/** Destinatario della richiesta (rilevante per il sostegno). */
const DIMENSIONE_DESTINATARIO: Record<string, string[]> = {
  istituzione_scolastica: [
    'istituzione scolastica',
    'istituto scolastico',
    'dirigente scolastico',
    'segreteria scolastica',
    'istituzione',
  ],
  npia_asl: ['npia', 'asl', 'neuropsichiatria', 'ausl', 'sanitaria'],
  comune: ["assistente all'autonomia", 'comune'],
};

/** Modello normativo: Regione a Statuto Speciale vs nazionale standard. */
const DIMENSIONE_REGIONE: Record<string, string[]> = {
  speciale: [
    'statuto speciale',
    'regione a statuto',
    "valle d'aosta",
    'trentino',
    'alto adige',
    'südtirol',
    'sudtirol',
    'friuli',
    'sicilia',
    'sardegna',
  ],
  nazionale: ['nazionale', 'standard', 'ordinario', 'modello nazionale'],
};

/** Tutte le dimensioni dell'intervista, in ordine di "necessità chirurgica". */
export const DIMENSIONI_INTERVISTA = [
  'tipo',
  'ordine',
  'scopo_sostegno',
  'destinatario',
  'regione',
] as const;

type Dimensione = {
  tipo: string | null;
  ordine: string | null;
  scopo_sostegno: string | null;
  destinatario: string | null;
  regione: string | null;
};

const STOPWORD = new Set([
  'per', 'con', 'che', 'gli', 'alla', 'allo', 'della', 'delle', 'dei', 'degli', 'una', 'uno',
  'un', 'il', 'lo', 'la', 'le', 'del', 'nel', 'nella', 'su', 'di', 'da', 'a', 'in', 'come',
  'quale', 'quali', 'mia', 'tuo',
]);

/**
 * Verifica se la frase chiave p compare nella query normalizzata q
 * rispettando i confini di parola: "i grado" non deve matchare "ii grado"
 * e "ata" non deve matchare "data".
 */
function matchParole(q: string, p: string): boolean {
  const chiave = normalizza(p);
  if (!chiave) return false;
  const escaped = chiave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-zà-ù0-9])${escaped}([^a-zà-ù0-9]|$)`, 'i').test(q);
}

/** Restituisce la prima chiave della mappa le cui parole chiave combaciano. */
function matchMappa(mappa: Record<string, string[]>, q: string): string | null {
  for (const [key, parole] of Object.entries(mappa)) {
    if (parole.some((p) => matchParole(q, p))) return key;
  }
  return null;
}

/** Estrae tutte le dimensioni rilevabili da un testo (query o risposta). */
function trovaDimensioni(testo: string): Dimensione {
  const q = normalizza(testo);
  return {
    tipo: matchMappa(DIMENSIONE_TIPO, q),
    ordine: matchMappa(DIMENSIONE_ORDINE, q),
    scopo_sostegno: matchMappa(DIMENSIONE_SCOPO_SOSTEGNO, q),
    destinatario: matchMappa(DIMENSIONE_DESTINATARIO, q),
    regione: matchMappa(DIMENSIONE_REGIONE, q),
  };
}

/** Risolve il valore di una dimensione a partire dal testo della risposta. */
function parseValoreDimensione(dimensione: string, testo: string): string | null {
  const mappe: Record<string, Record<string, string[]>> = {
    tipo: DIMENSIONE_TIPO,
    ordine: DIMENSIONE_ORDINE,
    scopo_sostegno: DIMENSIONE_SCOPO_SOSTEGNO,
    destinatario: DIMENSIONE_DESTINATARIO,
    regione: DIMENSIONE_REGIONE,
  };
  const mappa = mappe[dimensione];
  if (!mappa) return null;
  return matchMappa(mappa, normalizza(testo));
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

/* ------------------- Intervista dell'Archivista Capo ------------------- */

interface PassoIntervista {
  id: string;
  testo: string;
  opzioni: string[];
}

/** Passi dell'intervista chirurgica: una domanda alla volta, solo se serve. */
const PASSI_INTERVISTA: Array<{
  id: string;
  serve: (ctx: Dimensione) => boolean;
  testo: string;
  opzioni: string[];
}> = [
  {
    id: 'tipo',
    serve: (ctx) => !ctx.tipo,
    testo: 'Buongiorno, di che modulo hai bisogno?',
    opzioni: [
      'Richiesta di sostegno',
      'Messa a disposizione (MAD)',
      'Domanda di supplenza',
      'Modulo PEI / inclusione',
      'Certificazione (L.104/92)',
      'Autocertificazione titoli (DPR 445/2000)',
      'Lettera di presentazione',
      'Checklist mobilità',
      'Delega o consenso privacy',
      'Altro documento',
    ],
  },
  {
    id: 'ordine',
    serve: (ctx) => !ctx.ordine,
    testo:
      'Certo. Per quale ordine di scuola? (Infanzia, Primaria, Secondaria di I Grado, Secondaria di II Grado, Università, Enti)',
    opzioni: [
      "Scuola dell'Infanzia",
      'Scuola Primaria',
      'Scuola Secondaria di I Grado',
      'Scuola Secondaria di II Grado',
      'Università',
      'Enti / Istituzioni',
    ],
  },
  {
    id: 'scopo_sostegno',
    serve: (ctx) => ctx.tipo === 'sostegno' && !ctx.scopo_sostegno,
    testo:
      'Capito. Di cosa hai bisogno esattamente: una richiesta di accertamento/assegnazione del sostegno, la disponibilità a un incarico di sostegno o la documentazione PEI?',
    opzioni: [
      'Richiesta di accertamento / assegnazione del sostegno',
      'Disponibilità a incarico di sostegno (ADEE/ADSS)',
      'Documentazione PEI / inclusione',
      "Assistente all'Autonomia (Comune)",
    ],
  },
  {
    id: 'destinatario',
    serve: (ctx) =>
      ctx.tipo === 'sostegno' && ctx.scopo_sostegno !== 'incarico' && !ctx.destinatario,
    testo:
      "Il destinatario della richiesta è l'Istituzione Scolastica, la NPIA/ASL o il Comune per l'Assistente all'Autonomia?",
    opzioni: ['Istituzione Scolastica', 'NPIA/ASL', "Comune – Assistente all'Autonomia"],
  },
  {
    id: 'regione',
    serve: (ctx) => {
      const RILEVANTE: Record<string, boolean> = {
        sostegno: true,
        mad: true,
        supplenza: true,
        pei: true,
        certificazione: true,
        iscrizione: true,
      };
      return RILEVANTE[ctx.tipo ?? ''] === true && !ctx.regione;
    },
    testo:
      'La scuola si trova in una Regione a Statuto Speciale con normativa locale o serve il modello nazionale standard?',
    opzioni: ['Regione a Statuto Speciale', 'Modello nazionale standard'],
  },
];


/** Etichette leggibili per il prompt DeepSeek a partire dal profilo. */
const LABEL_PROFILO: Record<string, Record<string, string>> = {
  tipo: {
    sostegno: 'Richiesta di sostegno',
    mad: 'Messa a disposizione (MAD)',
    supplenza: 'Domanda di supplenza',
    pei: 'Documentazione PEI / inclusione',
    certificazione: 'Certificazione (L.104/92)',
    autocertificazione: 'Autocertificazione titoli (DPR 445/2000)',
    lettera: 'Lettera di presentazione',
    mobilita: 'Mobilità / trasferimento',
    delega_privacy: 'Delega o consenso privacy',
    checklist: 'Checklist',
    iscrizione: 'Iscrizione',
  },
  ordine: {
    infanzia: "Scuola dell'Infanzia",
    primaria: 'Scuola Primaria',
    secondaria1: 'Scuola Secondaria di I Grado',
    secondaria2: 'Scuola Secondaria di II Grado',
    universita: 'Università',
    enti: 'Enti / Istituzioni',
    cpia: 'CPIA / educazione degli adulti',
    ata: 'Personale ATA',
  },
  scopo_sostegno: {
    richiesta: 'richiesta di accertamento/assegnazione del sostegno',
    incarico: 'disponibilità a un incarico di sostegno',
    pei: 'documentazione PEI',
    autonomia: "assistente all'autonomia",
  },
  destinatario: {
    istituzione_scolastica: "l'Istituzione Scolastica",
    npia_asl: 'la NPIA/ASL',
    comune: "il Comune (Assistente all'Autonomia)",
  },
  regione: {
    speciale: 'Regione a Statuto Speciale con normativa locale',
    nazionale: 'modello nazionale standard',
  },
};

function etichettaDimensione(dimensione: string, valore: string): string {
  const label = LABEL_PROFILO[dimensione]?.[valore];
  if (label) return label;
  // Fallback: humanizza lo slug (es. "mensa_diete" → "Mensa diete").
  return valore
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Canonicalizza il profilo → stringa stabile per l'impronta SHA-256. */
function profiloCanonico(profilo: Record<string, string>): string {
  return Object.entries(profilo)
    .filter(([, v]) => Boolean(v))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('|');
}

/** Impronta dell'intervista: SHA-256 del profilo canonico (o della query se profilo vuoto). */
async function improntaDocumento(
  query: string,
  profilo: Record<string, string> | undefined,
): Promise<string> {
  const canonica = profiloCanonico(profilo ?? {});
  if (!canonica) return hashQuery(query);
  return hashQuery(`intervista:${canonica}`);
}

/** Associa il profilo a un eventuale modello statico del catalogo (bias del prompt). */
function catalogoDaProfilo(profilo: Record<string, string>): CatalogoModulo | null {
  const mappa: Record<string, string> = {
    mad: 'mad',
    supplenza: 'supplenza-breve',
    autocertificazione: 'autocertificazione-titoli',
    lettera: 'lettera-presentazione',
    mobilita: 'checklist-mobilita',
    delega_privacy: 'deleghe-privacy',
  };
  const id = mappa[profilo.tipo ?? ''];
  if (id) return CATALOGO.find((c) => c.id === id) ?? null;
  if (profilo.tipo === 'pei' || profilo.scopo_sostegno === 'pei') {
    return CATALOGO.find((c) => c.id === 'pei-osservazioni') ?? null;
  }
  if (profilo.scopo_sostegno === 'incarico') {
    return CATALOGO.find((c) => c.id === 'sostegno-disponibilita') ?? null;
  }
  return null;
}

/**
 * Azione `intervista`: una domanda alla volta.
 * - raccoglie il contesto (query + risposte già date)
 * - se manca una dimensione rilevante → risponde `domanda` (il prossimo passo)
 * - se il profilo è completo → risponde `pronto` con l'impronta dell'intervista
 *   e, se già in cache (`generated_modules`), il documento a costo API zero.
 */
async function azioneIntervista(
  supabase: ReturnType<typeof createClient>,
  query: string,
  risposteRaw: Record<string, unknown> | undefined,
) {
  const q = normalizza(query);
  const risposte = (risposteRaw ?? {}) as Record<string, string>;

  // Contesto iniziale: dimensioni rilevate dal testo della richiesta.
  const ctx: Dimensione = trovaDimensioni(q);

  // Applica le risposte strutturate (passo → testo della risposta).
  for (const passoId of DIMENSIONI_INTERVISTA) {
    const testoRisposta = risposte[passoId]?.trim();
    if (!testoRisposta) continue;
    const valore = parseValoreDimensione(passoId, testoRisposta);
    const target = ctx as unknown as Record<string, string | null>;
    if (valore) {
      target[passoId] = valore;
    } else if (normalizza(testoRisposta).length >= 2) {
      // Risposta libera non riconosciuta dalle mappe: fidati dell'utente,
      // la variante resta comunque tracciata nel profilo.
      target[passoId] = normalizza(testoRisposta);
    }
  }

  // Prossimo passo necessario (intervista chirurgica: una domanda alla volta).
  for (const passo of PASSI_INTERVISTA) {
    if (passo.serve(ctx)) {
      return { esito: 'domanda', passo: { id: passo.id, testo: passo.testo, opzioni: passo.opzioni } };
    }
  }

  // Profilo completo → impronta dell'intervista.
  const ctxMap = ctx as unknown as Record<string, string | null>;
  const profilo: Record<string, string> = {};
  for (const dim of DIMENSIONI_INTERVISTA) {
    const valore = ctxMap[dim];
    if (valore) profilo[dim] = valore;
  }

  const impronta = await improntaDocumento(q, profilo);

  // Cache hit → documento a costo zero.
  try {
    const { data: esistente, error: errCache } = await supabase
      .from('generated_modules')
      .select('*')
      .eq('query_hash', impronta)
      .maybeSingle();
    if (!errCache && esistente) {
      return { esito: 'pronto', profilo, modulo: esistente, cache: true };
    }
  } catch (err) {
    console.warn('genera-modulo — lookup cache intervista:', (err as Error).message);
  }

  return { esito: 'pronto', profilo, modulo: null, cache: false };
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
1. DATI GENERICI — Non inventare mai dati reali. Nessun testo segnaposto dentro le celle compilabili (VIETATO "[Nome dell'Istituto]", "[Numero di protocollo]", "[Data odierna]", "[Classe e Sezione]", "[Componenti]" e simili): le caselle da compilare restano VUOTE, con solo spazi bianchi o righe guida per la scrittura a mano. Lascia l'etichetta della voce (es. "Cognome e Nome", "Codice Fiscale") e la cella vuota.
2. NORMATIVA — Rispetta la normativa scolastica italiana vigente. Cita i riferimenti normativi pertinenti quando il documento lo richiede (es. DPR 275/1999, DPR 445/2000, D.Lgs. 297/1994, Legge 107/2015, D.Lgs. 59/2017, DL 36/2022, D.M. istitutivi delle classi di concorso), indicandoli con precisione.
3. REGIONI A STATUTO SPECIALE — Se la richiesta riguarda o può riguardare una Regione a Statuto Speciale (Valle d'Aosta, Trentino-Alto Adige/Südtirol, Friuli-Venezia Giulia, Sicilia, Sardegna), aggiungi una breve nota sulle eventuali peculiarità normative locali (competenze legislative, percorsi abilitanti, reclutamento) e usa il segnaposto [Regione a Statuto Speciale] dove rilevante.
4. HTML PER STAMPA/PDF — Produci SOLO HTML pulito e semantico, pronto per il rendering e la conversione in PDF:
   - Il documento inizia con un titolo <h1> (solo testo: niente logo, niente intestazioni di piattaforma).
   - Usa <h2> per le sezioni principali e <h3> per le sottosezioni, con testi brevi e descrittivi.
   - Usa <table> con <thead> e <tbody> per le tabelle dati; celle con padding 8px e righe alternate chiare (righe pari con sfondo #f9fafb).
   - Usa liste <ol>/<ul> per elenchi e campi da compilare.
   - Testo base 12pt con interlinea 1.3 (font di sistema Arial/Inter).
   - Nessun elemento <style>, <script>, <nav>, header, footer, banner o testo pubblicitario: intestazione, piè di pagina e indice sono gestiti automaticamente dalla piattaforma.
5. STRUTTURA FORMALE DEL DOCUMENTO — Ogni documento deve avere la struttura di un atto scolastico ufficiale, adattata alla tipologia richiesta:
   - INTESTAZIONE ISTITUZIONALE: una tabella a bordi nitidi con nome dell'istituto, anno scolastico, protocollo, data e il riferimento normativo esplicito pertinente (es. per il sostegno: L. 104/1992, D.Lgs. 66/2017, D.M. 182/2020; per le autocertificazioni: DPR 445/2000).
   - QUADRO ANAGRAFICO E CONTESTO: tabelle formali per i dati dell'alunno/richiedente, codice fiscale, classe/sezione, consiglio di classe o GLO e referente ASL quando pertinente.
   - SEZIONI A CROCETTA: riquadri [   ] da sbarrare a mano per selezioni rapide (area di intervento, tipologia di disabilità/BES/DSA, strumenti compensativi, misure dispensative).
   - BOX DI SCRITTURA A MANO: per le sezioni descrittive (relazione iniziale/finale, obiettivi disciplinari, modifiche programmatiche, interventi specialistici) lascia riquadri vuoti alti.
   - GUIDA ALLA COMPILAZIONE: usa la classe .guida-compilazione SOLO sotto le sezioni ad elevata complessità pedagogica/normativa (es. Quadro Operativo ICF, misure dispensative ai sensi della L. 170/2010). MAI per campi ovvi (anagrafica, data, protocollo): quelle celle restano vuote.
   - TABELLA FIRME (class .tabella-firme): in calce, tabella formale a 3 colonne — "Ruolo", "Nome e Cognome (in stampatello)", "Firma autografa" — con almeno 8 righe dedicate ai membri del Consiglio di Classe / Team docenti, più righe per Dirigente Scolastico, Docente di Sostegno, Specialista ASL/Terapista e Genitori/Tutori.
   Usa le classi CSS già presenti nello stylesheet della piattaforma quando utile: .intestazione-formale, .quadro-anagrafico, .crocette, .casella, .scrittura-mano, .tabella-firme, .riferimento-normativo, .guida-compilazione. NON includere mai <style>.
6. LINGUAGGIO — Scrivi in italiano corrente, professionale e vicino a chi lo usa; mantieni il rigore formale dei documenti ufficiali senza verbosità ridondante.
7. RISPOSTA — Restituisci ESCLUSIVAMENTE l'HTML richiesto, senza commenti, senza markdown, senza triple backtick, senza testo introduttivo o finale.`;

/** Costruisce una descrizione leggibile del profilo per il prompt DeepSeek. */
function descriviProfilo(profilo: Record<string, string>): string[] {
  const righe: string[] = [];
  for (const [dimensione, valore] of Object.entries(profilo)) {
    if (!valore) continue;
    righe.push(etichettaDimensione(dimensione, valore));
  }
  return righe;
}

/**
 * Costruisce il prompt utente per DeepSeek a partire dalla richiesta,
 * dal profilo dell'intervista e dall'eventuale modello di catalogo.
 */
function costruisciPromptUtente(
  query: string,
  profilo: Record<string, string> | undefined,
  catalogo: CatalogoModulo | null,
): string {
  const dettagli: string[] = [];
  if (profilo && Object.keys(profilo).length > 0) {
    dettagli.push(`Profilo della richiesta (variante esatta): ${descriviProfilo(profilo).join('; ')}.`);
  } else {
    const dim = trovaDimensioni(query);
    if (dim.tipo) dettagli.push(`Tipo di documento: ${dim.tipo}`);
    if (dim.ordine) dettagli.push(`Ordine di scuola: ${dim.ordine}`);
  }
  const contesto = catalogo
    ? `\n\nModello di riferimento del catalogo ScuoleRadar da adattare al caso specifico: "${catalogo.nome}" (${catalogo.tipo}) — ${catalogo.descrizione}`
    : '';
  const dettagliStr = dettagli.length > 0 ? `\nContesto rilevato dalla richiesta: ${dettagli.join(' ')}` : '';
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
 * - l'impronta dell'intervista (profilo canonico SHA-256) è la chiave di cache;
 *   senza profilo si usa l'hash della query normalizzata (compatibilità legacy)
 * - se l'impronta è presente: restituisce il documento salvato a costo API zero
 * - altrimenti: chiama DeepSeek e salva il risultato nella cache
 */
async function azioneGenera(
  supabase: ReturnType<typeof createClient>,
  query: string,
  profilo: Record<string, string> | undefined,
  catalogoId?: string,
) {
  const q = normalizza(query);
  if (q.length < 4) throw new Error('La richiesta è troppo breve per generare un documento.');

  const impronta = await improntaDocumento(q, profilo);

  // Cache hit → costo API zero
  try {
    const { data: esistente, error: errCache } = await supabase
      .from('generated_modules')
      .select('*')
      .eq('query_hash', impronta)
      .maybeSingle();
    if (!errCache && esistente) {
      return { esito: 'generato', cache: true, modulo: esistente };
    }
  } catch (err) {
    console.warn('genera-modulo — lookup cache:', (err as Error).message);
  }

  const catalogo =
    CATALOGO.find((c) => c.id === catalogoId) ?? catalogoDaProfilo(profilo ?? {}) ?? null;
  const prompt = costruisciPromptUtente(q, profilo, catalogo);
  const raw = await chiamaDeepSeek(prompt);
  const pulito = pulisciHtml(raw);
  const html = rimuoviPrimoH1(pulito);
  const titolo = estraiTitolo(pulito) ?? titoloDaQuery(q);

  const riga = {
    query_hash: impronta,
    query: q,
    title: titolo,
    content_html: html,
    meta: { ...(catalogo ? { catalogo_id: catalogo.id } : {}), ...(profilo ? { profilo } : {}) },
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
        query_hash: impronta,
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
      case 'intervista': {
        const query = String(body.query ?? '').trim();
        const risposte = (body.risposte ?? {}) as Record<string, unknown>;
        const esito = await azioneIntervista(supabase, query, risposte);
        return risposta({ ok: true, ...esito });
      }
      case 'genera': {
        if (!userId) {
          return risposta({ ok: false, errore: 'Autenticazione richiesta per generare documenti.' }, 401);
        }
        const query = String(body.query ?? '').trim();
        const profilo = (body.profilo ?? {}) as Record<string, string>;
        const catalogoId = body.catalogoId ? String(body.catalogoId) : undefined;
        const esito = await azioneGenera(supabase, query, profilo, catalogoId);
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






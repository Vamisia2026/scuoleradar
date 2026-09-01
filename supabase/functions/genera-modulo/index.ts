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
  pei: ['pei', 'osservazioni', 'inclusione', 'piano educativo individualizzato', 'glho', 'glo', 'scheda sintesi pei', 'relazione inclusione'],
  certificazione: ['certificazione', 'l.104', 'legge 104', 'handicap', 'disabilità', 'disabilita'],
  autocertificazione: ['autocertificazione', 'dichiarazione sostitutiva', 'dpr 445', 'titoli di studio'],
  lettera: ['lettera', 'presentazione'],
  mobilita: ['mobilità', 'mobilita', 'trasferimento'],
  delega_privacy: ['delega', 'privacy', 'consenso'],
  checklist: ['checklist', 'elenco'],
  iscrizione: ['iscrizione', 'iscrivere', 'immatricolazione'],
  istruzione_parentale: ['istruzione parentale', 'homeschooling', 'scuola famiglia'],
  permesso_orario: ['permesso orario', 'uscita anticipata', 'entrata posticipata', 'assenza breve', 'giustificazione'],
  esonero_motoria: ['esonero scienze motorie', 'esonero educazione fisica', 'esonero attività motorie', 'esonero attività'],
  accesso_atti: ['accesso agli atti', 'accesso atti', 'l.241', 'legge 241', 'accesso documenti', 'istanza accesso'],
  consenso_foto: ['consenso foto', 'foto e video', 'immagini', 'riprese video', 'diritto all.immagine'],
  borsa_studio: ['borsa di studio', 'borsa studio', 'edisu', 'aliseo', 'dsu', 'diritto allo studio', 'bando borsa'],
  ricorso_borsa: ['ricorso borsa', 'riesame borsa', 'graduatoria provvisoria', 'graduatoria borse', 'ricorso graduatoria'],
  isee_universita: ['isee universita', 'dichiarazione isee', 'isee ateneo'],
  riduzione_contributi: ['riduzione contributo', 'ricalcolo contributo', 'contributo unico', 'riduzione tasse'],
  contributo_straordinario: ['contributo straordinario', 'disagio economico', 'sussidio straordinario'],
  integrativo_erasmus: ['integrativo erasmus', 'borsa erasmus', 'mobilita internazionale', 'borsa mobilita'],
  collaborazioni_studentesche: ['collaborazioni studentesche', '200 ore', 'tutorato', 'part-time studentesco'],
  esenzione_tasse: ['esenzione tasse', 'esenzione tasse universitarie', 'esonero tasse', 'rateizzazione tasse'],
  laurea: ['domanda di laurea', 'proclamazione', 'seduta di laurea', 'deposito tesi', 'assegnazione tesi'],
  schede_osservazione: ['scheda osservazione', 'osservazione competenze', 'schede infanzia'],
  progetto_continuita: ['progetto continuita', 'continuita nido', 'continuita infanzia'],
  servizi_prepost: ['pre scuola', 'post scuola', 'pre post scuola', 'pre-post'],
  rinuncia_iscrizione: ['rinuncia iscrizione', 'ritiro iscrizione', 'ritiro scuola'],
  certificazione_competenze: ['certificazione competenze', 'd.m. 742', 'dm 742', 'certificato competenze'],
  piano_personalizzato: ['piano di studio personalizzato', 'personalizzazione didattica', 'flessibilita didattica'],
  progetti_fondi: ['pon', 'por', 'pnrr', 'progetti europei', 'progetto finanziato', 'adesione progetto'],
  liberatoria_sport: ['liberatoria sport', 'attivita sportive', 'campionati studenteschi', 'tornei'],
  cambio_sezione: ['cambio sezione', 'cambio indirizzo', 'cambio corso', 'cambio classe'],
  assemblea_studenti: ['assemblea di classe', 'assemblea istituto', 'assemblea studenti'],
  esonero_tasse: ['esonero tasse scolastiche', 'esonero contributi', 'esonero tasse scuola'],
  ammissione_esami: ['ammissione esami di stato', 'esame di stato', 'domanda esami', 'esame terza media', 'esame maturita'],
  crediti_scolastici: ['crediti scolastici', 'crediti formativi scuola', 'riconoscimento crediti'],
  certificato_diploma: ['certificato diploma', 'certificato sostitutivo', 'copia conforme', 'diploma'],
  relazione_finale: ['relazione finale pei', 'relazione finale pdp', 'relazione finale'],
  trasporto_protetto: ['trasporto protetto', 'trasporto disabile', 'scuolabus assistente', 'trasporto scolastico protetto'],
  protocollo_intesa: ['protocollo intesa', 'protocollo asl', 'protocollo comune', 'intesa'],
  patrocinio_locali: ['patrocinio', 'uso locali scolastici', 'uso palestra', 'concessione locali'],
  convenzione_pcto: ['convenzione pcto', 'convenzione tirocinio', 'alternanza scuola lavoro', 'stage'],
  segnalazione_anomalia: ['segnalazione anomalia', 'segnalazione disservizio', 'segnalazione servizio'],
  verbale_glo: ['verbale glo', 'verbale glho', 'riunione glo', 'verbale gruppo di lavoro', 'glo'],
  convocazione_glo: ['convocazione glo', 'convocazione glho', 'convocazione gruppo', 'riunione glo convocazione'],
  pdp_dsa: ['pdp dsa', 'piano didattico personalizzato dsa', 'pdp disturbi specifici', 'l. 170'],
  piano_personalizzato_nai: ['piano personalizzato nai', 'alunni stranieri', 'nai', 'piano inclusione stranieri', 'inserimento alunni stranieri'],
  relazione_finale_inclusione: ['relazione finale inclusione', 'relazione finale pei', 'relazione finale pdp', 'relazione inclusione'],
  progetto_alfabetizzazione: ['progetto alfabetizzazione', 'italiano l2', 'italiano seconda lingua', 'alfabetizzazione stranieri', 'corso italiano stranieri'],
  pdp_bes: ['pdp', 'bes', 'adhd', 'dsa', 'piano didattico', 'disturbo specifico', 'piano personalizzato'],
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
    testo: 'Indichi la tipologia di documento di cui necessita.',
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
    testo: 'Per quale ordine di scuola?',
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

/** Passi dell'intervista chirurgica: una domanda alla volta, solo se serve.
 *  L'ordine precede il tipo: per le richieste generiche la prima domanda
 *  concreta riguarda l'ordine di scuola (tono dell'Archivista Capo). */
const PASSI_INTERVISTA: Array<{
  id: string;
  serve: (ctx: Dimensione) => boolean;
  testo: string;
  opzioni: string[];
}> = [
  {
    id: 'ordine',
    serve: (ctx) => !ctx.ordine,
    testo:
      'Per selezionare il modulo corretto, mi indichi l\u2019ordine di scuola: Infanzia, Primaria, Secondaria di primo o di secondo grado, Università o Enti.',
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
    id: 'tipo',
    serve: (ctx) => !ctx.tipo,
    testo: 'Quale documento le occorre esattamente?',
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
    id: 'scopo_sostegno',
    serve: (ctx) => ctx.tipo === 'sostegno' && !ctx.scopo_sostegno,
    testo:
      'La richiesta riguarda l\u2019accertamento e l\u2019assegnazione del sostegno, la disponibilità a un incarico di sostegno o la documentazione PEI?',
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

/** Etichette leggibili per il prompt della prima domanda formulata via LLM. */
const ETICHETTA_PASSO: Record<string, string> = {
  ordine: 'ordine di scuola',
  tipo: 'tipologia di documento',
  scopo_sostegno: 'scopo della richiesta di sostegno',
  destinatario: 'destinatario della richiesta',
  regione: 'modello normativo (Regione a Statuto Speciale o nazionale standard)',
};


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
    biblioteca: 'Adesione / Prestito Biblioteca Scolastica',
    extracurricolari: 'Autorizzazione e Adesione Attività Extracurricolari (Sport / Teatro / Musica)',
    assistenza_comune: 'Richiesta di Assistenza Specialistica e Autonomia (Ente Locale)',
    uscite_didattiche: 'Autorizzazione e Consenso Informato Uscita Didattica / Viaggio di Istruzione',
    scrutini: 'Verbale / Scheda di Valutazione Periodica e Scrutini',
    mensa: 'Modulo di Richiesta / Modifica Servizio Ristorazione Scolastica',
    crediti_formativi: 'Richiesta di Riconoscimento Crediti Formativi',
    pdp_bes: 'Piano Didattico Personalizzato (PDP) / Scheda BES',
    ricorso_reclamo: 'Modulo di Reclamo / Ricorso Amministrativo',
    delega_famiglia: 'Delega Ritiro Alunno / Autorizzazione Uscita Autonoma',
    istruzione_parentale: 'Comunicazione di Istruzione Parentale',
    permesso_orario: 'Richiesta Permesso Orario / Uscita Anticipata',
    esonero_motoria: 'Richiesta Esonero Scienze Motorie',
    accesso_atti: 'Richiesta di Accesso agli Atti (L. 241/1990)',
    consenso_foto: 'Consenso Trattamento Immagini e Riprese Video',
    borsa_studio: 'Domanda di Borsa di Studio (EDISU / ALISEO / DSU)',
    ricorso_borsa: 'Richiesta Riesame / Ricorso Graduatoria Borse di Studio',
    isee_universita: 'Dichiarazione ISEE per l\u2019Università',
    riduzione_contributi: 'Richiesta Ricalcolo / Riduzione Contributo Unico',
    contributo_straordinario: 'Richiesta Contributo Straordinario per Disagio Economico',
    integrativo_erasmus: 'Richiesta Borsa Integrativa Erasmus / Mobilità Internazionale',
    collaborazioni_studentesche: 'Domanda Collaborazioni Studentesche (200 ore / Tutorato)',
    esenzione_tasse: 'Richiesta Esenzione / Riduzione Tasse Universitarie',
    laurea: 'Domanda di Laurea / Proclamazione',
    schede_osservazione: 'Scheda di Osservazione delle Competenze — Scuola dell\u2019Infanzia',
    progetto_continuita: 'Adesione Progetto Continuità Nido-Infanzia',
    servizi_prepost: 'Richiesta Servizio Pre / Post Scuola',
    rinuncia_iscrizione: 'Rinuncia / Ritiro Iscrizione',
    certificazione_competenze: 'Certificazione delle Competenze (D.M. 742/2017)',
    piano_personalizzato: 'Piano di Studio Personalizzato',
    progetti_fondi: 'Adesione Progetti PON / POR / PNRR',
    liberatoria_sport: 'Liberatoria Attività Sportive',
    cambio_sezione: 'Richiesta Cambio Sezione / Indirizzo',
    assemblea_studenti: 'Istanza di Assemblea di Classe / Istituto',
    esonero_tasse: 'Richiesta Esonero Tasse Scolastiche / Contributi',
    ammissione_esami: 'Domanda di Ammissione agli Esami di Stato',
    crediti_scolastici: 'Richiesta Riconoscimento Crediti Scolastici / Formativi',
    certificato_diploma: 'Richiesta Certificato Sostitutivo Diploma',
    relazione_finale: 'Relazione Finale PEI / PDP',
    trasporto_protetto: 'Richiesta Trasporto Scolastico Protetto',
    protocollo_intesa: 'Protocollo di Intesa ASL / Comune',
    patrocinio_locali: 'Richiesta Patrocinio / Uso Locali Scolastici',
    convenzione_pcto: 'Convenzione PCTO / Tirocinio',
    segnalazione_anomalia: 'Segnalazione Anomalie del Servizio',
    verbale_glo: 'Verbale Riunione GLO / GLHO',
    convocazione_glo: 'Convocazione Riunione GLO / GLHO',
    pdp_dsa: 'Piano Didattico Personalizzato DSA (L. 170/2010)',
    piano_personalizzato_nai: 'Piano di Studio Personalizzato per Alunni NAI (Inclusione Stranieri)',
    relazione_finale_inclusione: 'Relazione Finale Inclusione (PEI / PDP)',
    progetto_alfabetizzazione: 'Progetto di Alfabetizzazione / Italiano L2 per Alunni NAI',
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

  // Richiesta fuori contesto o goliardica → risposta da custode distaccato e
  // severo, formulata da DeepSeek (con fallback determinato se il modello è
  // assente o non configurato).
  if (eOffTopic(q)) {
    let testo =
      'Questo archivio custodisce esclusivamente modulistica scolastica e documentazione ufficiale. Formuli una richiesta pertinente.';
    try {
      const risposta = await chiamaDialogo(q, []);
      if (risposta.length >= 20 && risposta.length <= 400) testo = risposta;
    } catch {
      // Fallback: il custode mantiene la misura anche senza modello.
    }
    return { esito: 'domanda', passo: { id: 'offtopic', testo, opzioni: [] } };
  }

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
  const nessunaRisposta = Object.keys(risposte).length === 0;
  for (const passo of PASSI_INTERVISTA) {
    if (passo.serve(ctx)) {
      let testo = passo.testo;
      // Richiesta generica (nessuna risposta ancora fornita): l'Archivista
      // formula SUBITO la prima domanda concreta via DeepSeek.
      if (nessunaRisposta && q.length >= 4) {
        testo = await primaDomandaLLM(query, passo.id, testo);
      }
      return { esito: 'domanda', passo: { id: passo.id, testo, opzioni: passo.opzioni } };
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
      return {
        esito: 'pronto',
        profilo,
        messaggio: 'La modulistica richiesta è disponibile nell\u2019archivio.',
        modulo: esistente,
        cache: true,
      };
    }
  } catch (err) {
    console.warn('genera-modulo — lookup cache intervista:', (err as Error).message);
  }

  return {
    esito: 'pronto',
    profilo,
    messaggio: 'La modulistica richiesta è disponibile nell\u2019archivio.',
    modulo: null,
    cache: false,
  };
}

/* ------------------------------ DeepSeek ------------------------------ */

/**
 * Prompt di sistema per DeepSeek ("Archivista Capo" — persona e logica di
 * risposta, stile "Indovina Chi?"):
 *  - persona: bibliotecario ed esperto di diritto scolastico, cortese e autorevole
 *  - logica: richiesta generica → UNA domanda mirata (ordine di scuola / tipo);
 *            richiesta precisa → consegna sollecita e cordiale del modulo
 *  - dati generici con segnaposto [Tra Parentesi Quadre]
 *  - rispetto della normativa scolastica italiana
 *  - nota sulle Regioni a Statuto Speciale
 *  - HTML pulito pronto per rendering e conversione in PDF
 */
const SISTEMA_PROMPT = `Sei l'Archivista Capo di ScuolaRadar: un bibliotecario ed esperto di diritto scolastico di grande esperienza, estremamente cortese, fermo, autorevole ma accogliente. Rivolgiti SEMPRE all'utente dando del "tu", con un tono cordiale, accogliente ed esperto (es. "Ciao! Vado subito a cercarlo...").\n\nLOGICA DI RISPOSTA:\n- Se la richiesta è vaga o errata, NON fare domande generiche: fai UNA SOLA domanda precisa per correggere l'inesattezza o restringere subito il campo (strategia "Indovina Chi?"), chiedendo prima di tutto l'ORDINE DI SCUOLA (Infanzia, Primaria, Secondaria di I o II Grado) o la tipologia esatta dell'atto. Esempio: "Ciao! Vado subito a cercarlo. Per recuperare la cartella corretta, dimmi solo per quale ordine di scuola ti serve: Infanzia, Primaria o Secondaria?"\n- Se la richiesta è precisa o completa: rispondi in modo sollecito e cordiale (es. "Perfetto, vado subito a prenderlo.") e restituisci il modulo corretto.\n\nQuando la richiesta è precisa e il profilo dell'intervista è completo, hai il compito di redigere il documento richiesto dall'utente. REGOLE D'ORO (vincolanti):\n1. DENSITÀ DINAMICA — Classificazione RIGIDA del layout: i MODULI RAPIDI (deleghe, autocertificazioni, permessi orari, uscite didattiche, accesso agli atti, certificati, reclami/ricorsi semplici) DEVONO stare in UNA SOLA pagina A4 (padding 4-6px, griglie a 2 colonne, righe di scrittura max 3, firme ancorate in calce). I DOCUMENTI PEDAGOGICI E INCLUSIVI (PEI D.I. 182/2020, PDP DSA L. 170/2010, PDP BES, verbali GLO, relazioni finali di inclusione, certificazione delle competenze D.M. 742/2017, piani di studio personalizzati) DEVONO usare il layout ESTESO su 2-4 pagine A4: sezioni ampie e complete, griglie di osservazione per area disciplinare (Italiano, Matematica, Inglese, Storia, Scienze...), tabelle dettagliate per misure compensative/dispensative, spazio adeguato per situazione di partenza e verifica finale. MAI comprimere a 1 pagina un documento pedagogico e MAI pagine quasi vuote.\n2. ZERO RIDONDANZA — Nessun dato può comparire due volte: il titolo descrive la tipologia (es. "Domanda di supplenza — Scuola Primaria"), il quadro anagrafico raccoglie i dati del soggetto. MAI campi riepilogativi intermedi come "Contesto della richiesta", "Oggetto generico" o box duplicati.\n3. ESTETICA TIPOGRAFICA — Righe di scrittura a mano con interlinea reale 24px e colore #e0e0e0; tabelle anagrafiche "Clean Institutional": intestazioni #f8f9fa, bordi 1px #d1d5db, font senza grazie (Inter/Roboto/Arial), titoli max 16pt, testi 10pt, note 8pt.\n\nSegui rigorosamente il Design System di ScuoleRadar (docs/PDF_DESIGN_SYSTEM.md).

REGOLE NON NEGOZIABILI:
1. DATI GENERICI — Non inventare mai dati reali. Nessun testo segnaposto dentro le celle compilabili (VIETATO "[Nome dell'Istituto]", "[Numero di protocollo]", "[Data odierna]", "[Classe e Sezione]", "[Componenti]" e simili): le caselle da compilare restano VUOTE, con solo spazi bianchi o righe guida per la scrittura a mano. Lascia l'etichetta della voce (es. "Cognome e Nome", "Codice Fiscale") e la cella vuota. Non inserire MAI anni scolastici fissi (es. "2025/2026" o "2026/2027"): usa la dicitura compilabile "Anno Scolastico 20____ / 20____".
2. NORMATIVA — Rispetta la normativa scolastica italiana vigente. Cita i riferimenti normativi pertinenti quando il documento lo richiede (es. DPR 275/1999, DPR 445/2000, D.Lgs. 297/1994, Legge 107/2015, D.Lgs. 59/2017, DL 36/2022, D.M. istitutivi delle classi di concorso), indicandoli con precisione.
3. REGIONI A STATUTO SPECIALE — Se la richiesta riguarda o può riguardare una Regione a Statuto Speciale (Valle d'Aosta, Trentino-Alto Adige/Südtirol, Friuli-Venezia Giulia, Sicilia, Sardegna), aggiungi una breve nota sulle eventuali peculiarità normative locali (competenze legislative, percorsi abilitanti, reclutamento) e usa il segnaposto [Regione a Statuto Speciale] dove rilevante.
4. HTML PER STAMPA/PDF — Produci SOLO HTML pulito e semantico, pronto per il rendering e la conversione in PDF:
   - Il documento inizia con un titolo <h1> (solo testo: niente logo, niente intestazioni di piattaforma).
   - Usa <h2> per le sezioni principali e <h3> per le sottosezioni, con testi brevi e descrittivi.
   - Usa <table> con <thead> e <tbody> per le tabelle dati; celle con padding 6-8px e righe alternate chiare (righe pari con sfondo #f9fafb). Nelle tabelle "etichetta → campo" usa un layout a 2 colonne: etichette a sinistra con white-space: nowrap (MAI parole spezzate come "Scolastic / o") su colonna del 30-35%, campi di compilazione ampi (65-70%) con riga sottile (border-bottom: 1px solid #ccc) invece di box chiusi.
   - COMPATTEZZA — Il documento DEVE rientrare in 1-2 pagine A4 (MAI 3): niente pagine quasi vuote, margini e spazi tra sezioni ridotti, tabelle non sproporzionate. Il blocco "Luogo, Data, Firma" e "Convalida/Protocollo" va ancorato a fondo pagina 2 con page-break-inside: avoid — mai firme orfane in una pagina 3.
   - Usa liste <ol>/<ul> per elenchi e campi da compilare.
   - Testo base 10-11pt con interlinea 1.3 (font di sistema Inter/Roboto/Helvetica), padding verticale dei box max 6-8px e gap tra i blocchi max 12px.
   - Nessun elemento <style>, <script>, <nav>, header, footer, banner o testo pubblicitario: intestazione, piè di pagina e indice sono gestiti automaticamente dalla piattaforma.
5. STRUTTURA FORMALE DEL DOCUMENTO — Ogni documento deve avere la struttura di un atto scolastico ufficiale, adattata alla tipologia richiesta:
   - INTESTAZIONE ISTITUZIONALE: una tabella a bordi nitidi con nome dell'istituto, anno scolastico (sempre come dicitura compilabile "Anno Scolastico 20____ / 20____", MAI un anno fisso), protocollo, data e il riferimento normativo esplicito pertinente (es. per il sostegno: L. 104/1992, D.Lgs. 66/2017, D.M. 182/2020; per le autocertificazioni: DPR 445/2000).
   - QUADRO ANAGRAFICO E CONTESTO: tabelle formali per i dati dell'alunno/richiedente, codice fiscale, classe/sezione, consiglio di classe o GLO e referente ASL quando pertinente.
   - SEZIONI A CROCETTA: riquadri [   ] da sbarrare a mano per selezioni rapide (area di intervento, tipologia di disabilità, strumenti compensativi, misure dispensative). Nel PEI la sezione si chiama "Tipologia di disabilità (L. 104/1992)" e NON include DSA/BES (riservati ai template PDP). Disponi le voci su 2 colonne affiancate quando sono più di 3, per risparmiare fino al 40% dello spazio verticale. Per le DICHIARAZIONI SOSTITUTIVE (DPR 445/2000): usa la formula giuridica standard "Il/La sottoscritto/a, consapevole delle responsabilità e delle sanzioni penali stabilite dall'art. 76 del D.P.R. 445/2000 per le false attestazioni e le dichiarazioni mendaci, dichiara sotto la propria responsabilità:" seguita da 4 righe di scrittura; NON includere box a crocette "Oggetto della richiesta". Per le ISTANZE di sostegno / L.104: sezione "Oggetto della richiesta" con la formula "Richiesta di attivazione delle misure di sostegno scolastico e inclusione ai sensi della L. 104/1992 e D.Lgs. 66/2017." + riquadro "Documenti allegati" (Verbale di accertamento dell'handicap, Profilo di Funzionamento / Diagnosi Funzionale, Copia del documento di riconoscimento del richiedente). MAI riquadri didattici nelle istanze (strumenti compensativi, misure dispensative, relazioni, obiettivi): appartengono solo al PEI.
   - BOX DI SCRITTURA A MANO: per le sezioni descrittive (relazione iniziale/finale, obiettivi disciplinari, modifiche programmatiche, interventi specialistici) lascia riquadri vuoti alti.
   - NOTE NORMATIVE: NON usare box "Guida alla compilazione" generici né box "Modello conforme alle Linee Guida": le eventuali note normative vanno in una singola riga discreta a piè di pagina (class .nota-normativa, font 8pt, colore grigio).
   - CHIUSURA STANDARD: il documento NON deve includere MAI blocchi "Luogo e Data", "Firma" o "Convalida/Protocollo": la piattaforma li aggiunge automaticamente in calce (un unico blocco, mai duplicato). Nei documenti estesi (PEI, PDP, relazioni finali, verbali GLO) la piattaforma aggiunge inoltre il blocco firme del team docenti/GLO e della famiglia in fondo all'ultima pagina con page-break-inside: avoid. NON inserire tabelle firme con ruoli (Consiglio di Classe, Genitori/Tutori, Docenti, ASL, Dirigente) se non richiesti esplicitamente dalla tipologia (es. verbali di GLO o PEI).
   Usa le classi CSS già presenti nello stylesheet della piattaforma quando utile: .intestazione-formale, .quadro-anagrafico, .campo-etichetta, .campo-compilazione, .crocette, .casella, .scrittura-mano, .chiusura-documento, .nota-normativa. NON includere mai <style>.
6. LINGUAGGIO — Scrivi in italiano corrente, professionale e vicino a chi lo usa; mantieni il rigore formale dei documenti ufficiali senza verbosità ridondante. È TASSATIVAMENTE VIETATO usare le parole "generato", "creato" o "automatico" nel testo del documento: usa sempre il linguaggio di un archivio istituzionale ufficiale e già pronto (es. "documento scaricato").
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

/* ------------------------- Dialogo dell'Archivista ------------------------- */

/**
 * Prompt di sistema per il DIALOGO conversazionale (non per la generazione
 * dei documenti): l'Archivista Capo come custode d'archivio sobrio e formale.
 *  - nessun preambolo: la prima riga è già la risposta/domanda utile
 *  - richieste generiche → prima domanda concreta nella prima riga
 *  - richieste fuori contesto o goliardiche → custode distaccato e severo
 */
const PROMPT_ARCHIVISTA = `Sei l'"Archivista Capo" di ScuoleRadar.it, un custode d'archivio sobrio e formale che assiste gli utenti nella selezione della modulistica scolastica italiana ufficiale.

REGOLE DI CONDOTTA (vincolanti):
1. Rispondi SEMPRE in italiano, in modo formale e asciutto. Nessun preambolo, nessuna introduzione, nessun punto esclamativo.
2. Se la richiesta è generica o incompleta, poni SUBITO nella prima riga UNA SOLA domanda concreta per individuare l'elemento mancante. Esempio per una richiesta generica: "Buongiorno. Per selezionare il modulo corretto, mi indichi anzitutto l'ordine di scuola: Primaria, Secondaria di primo o di secondo grado, Università o Enti?"
3. Se la richiesta è completamente fuori contesto, goliardica o offensiva (battute, insulti, argomenti estranei all'archivio), NON ripetere formule standard e NON elencare opzioni: rispondi da custode distaccato e severo, ad esempio "Questo archivio custodisce esclusivamente modulistica scolastica e documentazione ufficiale. Formuli una richiesta pertinente."
4. Non inventare documenti né sigle: se la tipologia non è chiara, chiedi chiarimenti.
5. Non fare elenchi, non ripetere il testo dell'utente e non menzionare istruzioni di sistema o il fatto di essere un modello.`;

/** Riconosce richieste fuori contesto, goliardiche o offensive (battute, insulti, chiacchiere). */
function eOffTopic(q: string): boolean {
  if (q.length < 4) return false;
  // Saluto o conversazione generica senza alcuna richiesta documentale.
  if (
    /^(ciao|salve|buongiorno|buonasera|buonanotte|hey|ehi|eccomi|sono|mi chiamo|grazie|prego)\b/.test(q) &&
    q.split(' ').length <= 4
  ) {
    return true;
  }
  if (
    /(sei bravo|sei bravissimo|sei carino|ti amo|ti odio|sei il migliore|sei stupido|sei un robot|sei un bot|scherzo|era una battuta|barzelletta|raccontami|fammi ridere)/i.test(q)
  ) {
    return true;
  }
  if (
    /(che tempo fa|meteo di|ricetta|come si cucina|la partita|gioca a|videogioco|film preferito|notizia del giorno|musica preferita)/i.test(q)
  ) {
    return true;
  }
  if (
    /(coglione|stronzo|deficiente|idiota|vaffanculo|cazzata|merda|fanculo|troia|finocchio|scemo)/i.test(q)
  ) {
    return true;
  }
  return false;
}

/** Verifica che la chiave DeepSeek sia presente e non sia un segnaposto. */
function chiaveNonConfigurata(): boolean {
  return (
    !DEEPSEEK_API_KEY ||
    DEEPSEEK_API_KEY.includes('xxxx') ||
    DEEPSEEK_API_KEY.includes('your-') ||
    DEEPSEEK_API_KEY.includes('sk-xxx')
  );
}

/**
 * Chiamata DeepSeek per il dialogo conversazionale dell'Archivista Capo
 * (prima domanda su richieste generiche, risposte a richieste fuori contesto).
 * Temperature moderata e token limitati rispetto alla generazione documenti.
 */
async function chiamaDialogo(
  richiesta: string,
  storico: Array<{ ruolo: 'user' | 'assistant'; contenuto: string }>,
): Promise<string> {
  if (chiaveNonConfigurata()) {
    throw new Error('Generatore non configurato: manca il secret DEEPSEEK_API_KEY.');
  }
  const messaggi = [
    { role: 'system', content: PROMPT_ARCHIVISTA },
    ...storico.map((m) => ({ role: m.ruolo, content: m.contenuto })),
    { role: 'user', content: richiesta },
  ];
  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: messaggi,
      temperature: 0.4,
      max_tokens: 400,
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
  return contenuto.trim();
}

/**
 * Prima domanda dell'Archivista per richieste generiche: formulata da DeepSeek
 * a partire dalla richiesta e dall'elemento mancante. Se il modello non
 * risponde o produce un testo non adatto, resta il testo strutturato.
 */
async function primaDomandaLLM(query: string, passoId: string, fallback: string): Promise<string> {
  try {
    const testo = await chiamaDialogo(
      `Richiesta utente: "${query.trim()}".\n\nL'elemento mancante da chiedere per primo è: ${ETICHETTA_PASSO[passoId] ?? passoId}.\nPoni UNA sola domanda concreta nella prima riga, chiedendo esclusivamente questo elemento, in modo formale e senza preamboli né punti esclamativi.`,
      [],
    );
    if (testo.length < 20 || testo.length > 300) return fallback;
    return testo;
  } catch {
    return fallback;
  }
}

/** Chiama l'API di DeepSeek (chat completions) e restituisce il contenuto testuale. */
async function chiamaDeepSeek(promptUtente: string): Promise<string> {
  if (chiaveNonConfigurata()) {
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






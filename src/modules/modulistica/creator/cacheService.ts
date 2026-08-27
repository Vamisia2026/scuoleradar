/**
 * ScuoleRadar.it — Cache Service del ModuleCreator.
 *
 * Client tipizzato dell'Edge Function `genera-modulo`, con logica
 * cache-first e persistenza del profilo utente:
 *
 *  - `cercaDocumento`  → ricerca nel catalogo + cache; se la richiesta è
 *                        ambigua restituisce domande di chiarimento.
 *  - `generaDocumento` → verifica PRIMA se la query esiste in
 *                        `generated_modules` (hash SHA-256 server-side):
 *                        se presente restituisce il documento a costo API
 *                        zero; altrimenti genera con DeepSeek, salva in
 *                        cache e restituisce il documento.
 *  - `registraDownloadGenerato` / `registraDownloadCatalogo` → registra il
 *                        download nella tabella `user_saved_modules`.
 *  - `rimuoviDownload`, `elencaDownload`, `caricaDocumentoGenerato` →
 *                        gestione della tab "I miei Modelli Scaricati".
 */
import { supabase } from '@/lib/supabase';
import type { ModuloSalvatoDB } from '../types';

export interface CatalogoSuggerito {
  id: string;
  nome: string;
  tipo: string;
  descrizione: string;
}

export interface DomandaChiarimento {
  id: string;
  testo: string;
  opzioni: string[];
}

/** Riga della tabella Supabase `generated_modules`. */
export interface DocumentoGenerato {
  id: string;
  query_hash: string;
  query: string;
  title: string;
  content_html: string;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type EsitoRicerca =
  | {
      esito: 'prosegui';
      catalogo: CatalogoSuggerito | null;
    }
  | {
      esito: 'chiarimento';
      motivo?: string;
      domande: DomandaChiarimento[];
      suggerimento: { id: string; title: string } | null;
    };

export interface EsitoGenera {
  esito: 'generato';
  cache: boolean;
  modulo: DocumentoGenerato;
}

type Invocazione<T> = { ok: true; dati: T } | { ok: false; errore: string };

/** Invoca l'Edge Function `genera-modulo` con gestione errori uniforme. */
async function invoca<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<Invocazione<T>> {
  if (!supabase) {
    return {
      ok: false,
      errore:
        'Servizio non disponibile: mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY nel file .env.',
    };
  }
  const { data: sessione } = await supabase.auth.getSession();
  if (!sessione.session) return { ok: false, errore: 'NON_AUTENTICATO' };
  const { data, error } = await supabase.functions.invoke('genera-modulo', { body });
  if (error) {
    const payload = data as { errore?: string } | null;
    return {
      ok: false,
      errore: payload?.errore ?? error.message ?? 'Errore di comunicazione con il generatore.',
    };
  }
  const payload = data as { ok?: boolean; errore?: string } | null;
  if (!payload || payload.ok === false) {
    return { ok: false, errore: payload?.errore ?? 'Risposta inattesa dal generatore.' };
  }
  return { ok: true, dati: payload as T };
}

/* ------------------------------ Ricerca ------------------------------ */

/** Cerca il documento più adatto: catalogo + cache, con chiarimenti se ambigua. */
export async function cercaDocumento(
  query: string,
): Promise<{ ok: boolean; errore?: string; esito?: EsitoRicerca }> {
  const res = await invoca({ azione: 'ricerca', query });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, esito: res.dati as unknown as EsitoRicerca };
}

/* --------------------- Generazione cache-first --------------------- */

/**
 * Genera (o riusa dalla cache) il documento per la query.
 * Il controllo `generated_modules` per hash avviene SERVER-SIDE: se la query
 * (o una sua normalizzazione) è già stata generata, nessuna chiamata a DeepSeek.
 */
export async function generaDocumento(
  query: string,
  catalogoId?: string,
): Promise<{ ok: boolean; errore?: string; esito?: EsitoGenera }> {
  const res = await invoca({ azione: 'genera', query, catalogoId });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, esito: res.dati as unknown as EsitoGenera };
}

/* ------------------- Persistenza (user_saved_modules) ------------------- */

async function registra(body: {
  module_key: string;
  module_source: 'generated' | 'catalogo';
  title: string;
  tipo: string;
}): Promise<{ ok: boolean; errore?: string }> {
  const res = await invoca({ azione: 'salva', ...body });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true };
}

/** Registra il download di un documento generato nel profilo dell'utente. */
export async function registraDownloadGenerato(
  modulo: DocumentoGenerato,
): Promise<{ ok: boolean; errore?: string }> {
  if (!modulo.id) {
    return {
      ok: false,
      errore: 'Documento non persistibile: la cache del generatore non è configurata.',
    };
  }
  return registra({
    module_key: `gen:${modulo.id}`,
    module_source: 'generated',
    title: modulo.title,
    tipo: 'HTML/PDF',
  });
}

/** Registra il download di un modulo del catalogo nel profilo dell'utente. */
export async function registraDownloadCatalogo(m: {
  id: string;
  nome: string;
  tipo: string;
}): Promise<{ ok: boolean; errore?: string }> {
  return registra({
    module_key: `cat:${m.id}`,
    module_source: 'catalogo',
    title: m.nome,
    tipo: m.tipo,
  });
}

/** Rimuove un download registrato (user_saved_modules). */
export async function rimuoviDownload(moduleKey: string): Promise<{ ok: boolean; errore?: string }> {
  const res = await invoca({ azione: 'rimuovi', module_key: moduleKey });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true };
}

/** Elenca i moduli salvati dell'utente (tab "I miei Modelli Scaricati"). */
export async function elencaDownload(): Promise<{
  ok: boolean;
  errore?: string;
  moduli?: ModuloSalvatoDB[];
}> {
  const res = await invoca<{ moduli?: ModuloSalvatoDB[] }>({ azione: 'miei' });
  if (!res.ok) return { ok: false, errore: res.errore };
  return { ok: true, moduli: res.dati.moduli ?? [] };
}

/** Legge un documento generato dalla cache (lettura pubblica diretta). */
export async function caricaDocumentoGenerato(id: string): Promise<DocumentoGenerato | null> {
  if (!supabase || !id) return null;
  const { data } = await supabase
    .from('generated_modules')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as DocumentoGenerato | null) ?? null;
}


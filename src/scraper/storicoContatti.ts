/**
 * ScuoleRadar.it — Scraper · STORICO DEI CONTATTI (il «database interno» del Tailoring).
 *
 * Il Tailoring (`lib/tailoringContatti.ts`) cuce il recapito di candidatura di una
 * riga da quattro fonti; questa è la TERZA: il NOSTRO database. Se la stessa scuola
 * è già stata risolta in passato (`interpelli.school_code` → `contact_email`) quel
 * recapito è OSSERVATO: lo si riusa invece di ricostruirlo.
 *
 * Perché serve. Sui runner GitHub i file SCUANAGRAFE non sono presenti (~15 MB non
 * versionati) e l'anagrafica non arricchisce nulla: senza questa fonte le righe
 * nuove nascerebbero senza recapito e resterebbero fuori dalle notifiche. Lo storico
 * è invece l'unica fonte che cresce DA SOLA, run dopo run.
 *
 * Regole (le stesse dell'anagrafica, §26.47/§26.68):
 *  · nessuna email inventata: solo recapiti reali già validati;
 *  · il matching per NOME vale solo se identifica UNA scuola — o una sola nella
 *    provincia dichiarata (mai indovinare, come `scuolaDaNome`);
 *  · un dato già presente non si sovrascrive mai (`patchDaStorico`);
 *  · vince la riga più RECENTE (l'istituto può cambiare casella nel tempo).
 *
 * Verificato da `npm run test:tailoring`.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { chiaveCodiceScuola, normalizzaNomeScuola } from '../lib/anagraficaCsv.ts';
import { emailAvviso } from '../lib/alertInterpello.ts';

/** Tetto di sicurezza della lettura: il run non deve pesare (le più recenti). */
export const MAX_RIGHE_STORICO = 2000;

/** Recapito osservato per una scuola (dalla riga più recente). */
export interface RecapitoStorico {
  email: string;
  pec: string | null;
  /** Provincia della riga: serve al matching per nome non ambiguo. */
  provincia: string | null;
}

/** Indice dello storico: per codice meccanografico e (ripiego) per nome. */
export interface RegistroStorico {
  disponibile: boolean;
  /** Righe con un recapito valido. */
  righe: number;
  perCodice: Map<string, RecapitoStorico>;
  perNome: Map<string, RecapitoStorico[]>;
}

/** Riga minima dello storico (le colonne lette da `interpelli`). */
export interface RigaStorico {
  school_code?: string | null;
  school_name?: string | null;
  province?: string | null;
  contact_email?: string | null;
  school_pec?: string | null;
}

/** Storico non disponibile (DB non raggiungibile, tabelle assenti): nessun appiglio. */
export const REGISTRO_STORICO_VUOTO: RegistroStorico = {
  disponibile: false,
  righe: 0,
  perCodice: new Map(),
  perNome: new Map(),
};

/** Campi che il Tailoring scrive su una riga (solo quelli MANCANTI). */
export interface PatchStorico {
  contact_email?: string;
  school_pec?: string;
}

/**
 * Patch per UNA riga dallo storico interno: `null` quando non c'è nulla da cucire
 * (recapito già presente) o nessun appiglio sicuro. Contratto identico a
 * `arricchisciDaAnagrafica`: mai sovrascritture.
 */
export function patchDaStorico(
  registro: RegistroStorico,
  riga: RigaStorico,
): PatchStorico | null {
  if ((riga.contact_email ?? '').trim()) return null;
  const contatto = contattoDaStorico(registro, riga);
  if (!contatto) return null;
  const patch: PatchStorico = { contact_email: contatto.email };
  if (!(riga.school_pec ?? '').trim() && contatto.pec) patch.school_pec = contatto.pec;
  return patch;
}

/**
 * Carica lo storico da `interpelli` (best-effort): ordina dal più recente e legge
 * solo le righe che HANNO un recapito. Un client assente (ambiente senza Supabase),
 * un errore o la colonna `school_pec` non ancora migrata non fermano il run: si
 * prosegue con lo storico leggibile, dichiarando il motivo del degrado.
 */
export async function caricaStoricoContatti(
  supabase?: SupabaseClient | null,
): Promise<RegistroStorico> {
  if (!supabase) return REGISTRO_STORICO_VUOTO;
  const colonne = ['school_code', 'school_name', 'province', 'contact_email', 'school_pec'];
  for (let tentativo = 0; tentativo < 2; tentativo += 1) {
    const { data, error } = await supabase
      .from('interpelli')
      .select(colonne.join(','))
      .not('contact_email', 'is', null)
      .order('created_at', { ascending: false })
      .limit(MAX_RIGHE_STORICO);
    if (!error) return indiceStoricoContatti((data ?? []) as RigaStorico[]);
    const mancante = error.message.match(/Could not find the '([^']+)' column/i)?.[1];
    if (!mancante || !colonne.includes(mancante)) {
      console.warn(`⚠ Tailoring: storico dei contatti non leggibile (${error.message}).`);
      return REGISTRO_STORICO_VUOTO;
    }
    colonne.splice(colonne.indexOf(mancante), 1);
  }
  return REGISTRO_STORICO_VUOTO;
}


/**
 * Indice dello storico: per ogni chiave vince la PRIMA riga valida incontrata,
 * quindi l'elenco va passato dal più RECENTE al più vecchio (`caricaStoricoContatti`
 * lo ordina già così). Le righe senza email utilizzabile non entrano: lo storico
 * serve a dare recapiti, non a contare righe.
 *
 * Per il NOME si tiene **un candidato per provincia** (il più recente): due righe
 * con lo stesso nome nella stessa provincia sono la stessa scuola (che ha cambiato
 * casella nel tempo), mentre due province diverse sono due scuole distinte e restano
 * entrambe — è ciò che rende il nome «ambiguo» quando la provincia non è dichiarata.
 */
export function indiceStoricoContatti(righe: readonly RigaStorico[]): RegistroStorico {
  const registro: RegistroStorico = {
    disponibile: false,
    righe: 0,
    perCodice: new Map(),
    perNome: new Map(),
  };
  for (const r of righe) {
    const email = emailAvviso(r.contact_email);
    if (!email) continue;
    const recapito: RecapitoStorico = {
      email,
      pec: emailAvviso(r.school_pec),
      provincia: (r.province ?? '').trim().toUpperCase() || null,
    };
    registro.righe += 1;
    const codice = chiaveCodiceScuola(r.school_code);
    if (codice && !registro.perCodice.has(codice)) registro.perCodice.set(codice, recapito);
    const chiaveNome = normalizzaNomeScuola(r.school_name);
    if (chiaveNome.length < 5) continue;
    const lista = registro.perNome.get(chiaveNome);
    if (!lista) registro.perNome.set(chiaveNome, [recapito]);
    else if (!lista.some((c) => c.provincia === recapito.provincia)) lista.push(recapito);
  }
  registro.disponibile = registro.perCodice.size > 0;
  return registro;
}

/**
 * Recapito dello storico per una riga: prima il CODICE meccanografico (esatto),
 * altrimenti il NOME — solo se univoco, o univoco nella provincia dichiarata.
 * `null` quando non c'è un appiglio sicuro: meglio nessun arricchimento che uno
 * sbagliato (stessa politica dell'anagrafica ufficiale).
 */
export function contattoDaStorico(
  registro: RegistroStorico,
  riga: RigaStorico,
): { email: string; pec: string | null } | null {
  if (!registro.disponibile) return null;
  const codice = chiaveCodiceScuola(riga.school_code);
  const daCodice = codice ? registro.perCodice.get(codice) : undefined;
  if (daCodice) return { email: daCodice.email, pec: daCodice.pec };

  const chiave = normalizzaNomeScuola(riga.school_name);
  if (chiave.length < 5) return null;
  const lista = registro.perNome.get(chiave) ?? [];
  if (lista.length === 0) return null;
  if (lista.length === 1) return { email: lista[0].email, pec: lista[0].pec };
  const provincia = (riga.province ?? '').trim().toUpperCase() || null;
  if (!provincia) return null;
  const inProvincia = lista.filter((c) => c.provincia === provincia);
  return inProvincia.length === 1
    ? { email: inProvincia[0].email, pec: inProvincia[0].pec }
    : null;
}


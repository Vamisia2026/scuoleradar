/**
 * Contesto App · funzioni pure del profilo e analytics.
 *
 * Estratte da `AppContext.tsx`: conversione delle righe legacy `notices`,
 * normalizzazione del piano (base / pro / free_forever), rilevazione della prova
 * PRO scaduta e tracciamento deduplicato del signup completato.
 */
import { classeByCodice } from '@/data/classiConcorso';
import type { Interpello } from '@/data/interpelli';
import { province } from '@/data/province';
import { track } from '@/lib/analytics';

/** Converte una riga della tabella `notices` nel tipo `Interpello` usato dalla dashboard. */
export function mapNoticiaToInterpello(r: {
  id: string;
  title: string | null;
  source_url: string | null;
  province: string | null;
  class_codes: string[] | null;
  expiration_date: string | null;
}): Interpello {
  const codici = (r.class_codes ?? []).filter(Boolean);
  const primaClasse = codici[0] ?? '';
  const classe = classeByCodice(primaClasse);
  const provinciaCodice = (r.province ?? '').toUpperCase();
  return {
    id: r.id,
    titolo: r.title ?? 'Avviso non classificato',
    istituto: '', // `notices` non ha un campo scuola dedicato: il match filtri scuole avviene sul titolo
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

/** Normalizza il valore del piano letto dal DB: eventuali alias di Free Forever
 *  ('ffe', 'free forever') convergono sul valore canonico 'free_forever'. */
function normalizzaPiano(raw: unknown): 'base' | 'pro' | 'free_forever' {
  const p = String(raw ?? '').trim().toLowerCase();
  if (p === 'pro') return 'pro';
  if (p === 'free_forever' || p === 'ffe' || p === 'free forever') return 'free_forever';
  return 'base';
}

/**
 * Piano "di servizio" ricavato dalla riga profiles del DB.
 * Fonti in ordine: 1) `piano` testuale (base|pro|free_forever/ffe/free forever);
 * 2) `subscription_tier` (Account Bridge: base|pro_annuale|…|free_forever);
 * 3) `is_free_forever` (colonna delle migrazioni recenti — SOLO se selezionata,
 *    accettata per retrocompatibilità). Questo evita il "desync" da default
 * 'Base' quando una delle colonne non esiste ancora nel DB remoto.
 */
/** Completamento di `pianoDaProfilo`: il piano può essere concesso dal BACKEND
 *  (promo, omaggio, Beta Tester, pannello admin) anche senza toccare `piano`.
 *  `subscription_tier` `pro_*` e `is_beta_tester` contano quindi come PRO: senza
 *  questi due controlli l'utente risultava "Base" nel frontend pur essendo PRO
 *  nel database (limiti province, «Opportunità mappate» e badge errati). */
export function pianoDaProfilo(row: {
  piano?: unknown;
  subscription_tier?: unknown;
  is_free_forever?: boolean | null;
  is_beta_tester?: boolean | null;
}): 'base' | 'pro' | 'free_forever' {
  if (row.is_free_forever === true) return 'free_forever';
  const piano = normalizzaPiano(row.piano);
  if (piano === 'free_forever') return 'free_forever';
  if (piano === 'pro') return 'pro';
  const tier = String(row.subscription_tier ?? '').trim().toLowerCase();
  if (tier === 'free_forever' || tier === 'ffe' || tier === 'free forever') return 'free_forever';
  if (tier.startsWith('pro')) return 'pro';
  if (row.is_beta_tester === true) return 'pro';
  return piano;
}

/**
 * true se la riga profilo è una prova PRO 'trialing' con scadenza già passata
 * → il trial di 30 giorni è finito e l'utente deve tornare naturalmente su Base.
 *
 * I BETA TESTER sono esclusi: il loro PRO è un omaggio, non una prova (stessa
 * esclusione della funzione DB `reverti_prove_pro_scadute`), quindi il client non
 * deve mai retrocederli.
 */
export function provaProScaduta(row: {
  piano?: unknown;
  subscription_status?: unknown;
  abbonamento_scade_il?: unknown;
  is_beta_tester?: boolean | null;
} | null | undefined): boolean {
  if (!row) return false;
  if (row.is_beta_tester === true) return false;
  if (String(row.piano ?? '').trim().toLowerCase() !== 'pro') return false;
  if (String(row.subscription_status ?? '').trim().toLowerCase() !== 'trialing') return false;
  if (!row.abbonamento_scade_il) return false;
  const scad = new Date(String(row.abbonamento_scade_il));
  if (Number.isNaN(scad.getTime())) return false;
  return scad.getTime() <= Date.now();
}

/**
 * Deduplica `signup_completed`: la creazione account email genera sia il track
 * immediato in register() sia l'evento SIGNED_IN del listener OAuth (stessa
 * registrazione, un solo evento nel funnel). Nessun dato personale: solo metodo.
 */
let ultimoTrackSignupMs = 0;
export function tracciaSignupCompletato(method: string, demo?: boolean): void {
  const ora = Date.now();
  if (ora - ultimoTrackSignupMs < 3000) return;
  ultimoTrackSignupMs = ora;
  track('signup_completed', demo ? { method, demo: true } : { method });
}

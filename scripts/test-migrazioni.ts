/**
 * TEST — MIGRAZIONI notifiche (ledger DB + RPC quota) — REGRESSION GUARD.
 * -----------------------------------------------------------------
 * Perché esiste: la RPC `incrementa_notifiche_utente` è stata ri-definita da una
 * migrazione SUCCESSIVA (`20260831100000`) con un `select piano, notifiche_usate,
 * notifiche_anno into …` NON qualificato, ri-introducendo l'ambiguità 42702 già
 * corretta da `20260831010000`. Risultato: quota server-side in errore e digest
 * senza conteggio.
 *
 * Questo test analizza STATICAMENTE i file in `supabase/migrations/` e impedisce
 * che una definizione ambigua (o un ledger incompleto) torni in produzione:
 *   · `notifications_log` definita in modo idempotente con la PK corretta + RLS;
 *   · l'ULTIMA definizione dell'RPC ha colonne qualificate o `#variable_conflict`;
 *   · il contratto `returns table (consentito boolean, notifiche_usate integer)`
 *     è invariato (lo consumano `notifier.ts` e gli script admin);
 *   · limite BASE = 3 e reset su ANNO SCOLASTICO presenti.
 *
 * Esecuzione: npm run test:migrazioni
 */

import { readdirSync, readFileSync } from 'node:fs';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const CARTELLA = new URL('../supabase/migrations/', import.meta.url);
const file = readdirSync(CARTELLA)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** Legge un file di migrazione. */
function leggi(nome: string): string {
  return readFileSync(new URL(nome, CARTELLA), 'utf8');
}

/** Estrae la definizione della RPC (dal `create or replace` alla chiusura `$$;`). */
function definizioniRpc(testo: string): string[] {
  const out: string[] = [];
  const marcatore = 'create or replace function public.incrementa_notifiche_utente';
  let indice = testo.toLowerCase().indexOf(marcatore);
  while (indice >= 0) {
    const chiusura = testo.indexOf('$$;', indice);
    out.push(testo.slice(indice, chiusura >= 0 ? chiusura + 3 : undefined));
    indice = testo.toLowerCase().indexOf(marcatore, indice + marcatore.length);
  }
  return out;
}

console.log(`— Analisi di ${file.length} migrazioni —`);

// 1) LEDGER DB
const fileLedger = file.filter((f) => /create table if not exists public\.notifications_log/i.test(leggi(f)));
check('notifications_log creata (idempotente) in almeno una migrazione', true, fileLedger.length > 0);
const ddlLedger = fileLedger.map(leggi).join('\n');
check(
  'PK (user_id, interpello_hash, canale)',
  true,
  /primary key \(user_id, interpello_hash, canale\)/i.test(ddlLedger),
);
check('RLS abilitata sul ledger', true, /alter table public\.notifications_log enable row level security/i.test(ddlLedger));
check('grant a service_role (mai ad anon)', true, /grant all on public\.notifications_log to service_role/i.test(ddlLedger));
check('revoke ad anon/authenticated', true, /revoke all on public\.notifications_log from anon, authenticated/i.test(ddlLedger));

// 2) ULTIMA DEFINIZIONE DELLA RPC
const conRpc = file
  .map((f) => ({ f, defs: definizioniRpc(leggi(f)) }))
  .filter((x) => x.defs.length > 0);
check('esiste almeno una definizione della RPC', true, conRpc.length > 0);
const ultimo = conRpc[conRpc.length - 1];
const corpo = ultimo.defs[ultimo.defs.length - 1] ?? '';
console.log(`  · ultima definizione RPC: ${ultimo.f} (${ultimo.defs.length} definizioni nel file)`);

check(
  'contratto invariato (consentito, notifiche_usate)',
  true,
  /returns table \(consentito boolean, notifiche_usate integer\)/i.test(corpo),
);
check('security definer + search_path = public', true, /security definer/i.test(corpo) && /set search_path = public/i.test(corpo));
check('lock di riga (for update)', true, /for update/i.test(corpo));
check('limite BASE = 3 per anno scolastico', true, /v_usate >= 3/i.test(corpo));
check('reset su ANNO SCOLASTICO (1° settembre)', true, /v_anno_scolastico/i.test(corpo) && /month from now\(\)\) < 9/i.test(corpo));

// Ambiguità: o colonne qualificate nel SELECT … INTO, o la direttiva di blindatura.
const listaSelect = /\bselect\s+([^;]*?)\s+into\b/is.exec(corpo)?.[1] ?? '';
check('la RPC legge davvero profiles.notifiche_usate', true, /notifiche_usate/i.test(listaSelect));
const qualificato = /p\.notifiche_usate/i.test(listaSelect);
const blindato = /#variable_conflict\s+use_column/i.test(corpo);
check(
  'nessuna ambiguità 42702 (colonne qualificate o #variable_conflict)',
  true,
  qualificato || blindato,
);

// 3) Le definizioni storiche possono essere ambigue SOLO se una successiva le
//    corregge: ciò che conta è l'ULTIMA definizione applicata (verificata sopra).
//    Qui elenchiamo le storiche solo a fini informativi (non è un errore).
const storicheAmbigue = file.filter((f) =>
  definizioniRpc(leggi(f)).some((d) => {
    const lista = /\bselect\s+([^;]*?)\s+into\b/is.exec(d)?.[1] ?? '';
    if (!/notifiche_usate/i.test(lista)) return false;
    return !/p\.notifiche_usate/i.test(lista) && !/#variable_conflict\s+use_column/i.test(d);
  }),
);
console.log(
  `  · definizioni storiche con ambiguità (superate da file successivi): ${
    storicheAmbigue.length > 0 ? storicheAmbigue.join(', ') : 'nessuna'
  }`,
);
check(
  'l’ultima definizione applicata NON è ambigua',
  true,
  qualificato || blindato,
);

// 4) File di riparazione presente; NESSUNA migrazione successiva deve tornare a
//    ridefinire il ledger o la RPC (le guardie 1-2 valgono sull'ultima definizione).
const riparazione = '20260914030000_repair_notifications_log_e_rpc_quota.sql';
check('migrazione di riparazione presente', true, file.includes(riparazione));
const indiceRiparazione = file.indexOf(riparazione);
const successive = file.slice(indiceRiparazione + 1).filter((f) => {
  const testo = leggi(f);
  return definizioniRpc(testo).length > 0 || /notifications_log|incrementa_notifiche_utente/i.test(testo);
});
check(
  'nessuna migrazione successiva alla riparazione tocca ledger o RPC quota',
  [],
  successive,
);
check(
  'la riparazione contiene ENTRAMBE le fix (ledger + RPC)',
  true,
  /create table if not exists public\.notifications_log/i.test(leggi(riparazione)) &&
    /create or replace function public\.incrementa_notifiche_utente/i.test(leggi(riparazione)),
);

// 5) PREFERENZA SOSTEGNO (`profiles.sostegno`): la colonna deve esistere e il
//    backfill deve dichiarare l'adesione IMPLICITA di chi ha già una classe di
//    sostegno tra le preferenze (AD…). Senza il backfill la nuova guardia
//    toglierebbe copertura a chi riceveva legittimamente gli avvisi di sostegno.
const migrazioneSostegno = '20260914040000_add_profiles_sostegno.sql';
check('migrazione preferenza sostegno presente', true, file.includes(migrazioneSostegno));
const ddlSostegno = leggi(migrazioneSostegno);
check(
  'colonna profiles.sostegno idempotente (not null default false)',
  true,
  /alter table public\.profiles add column if not exists sostegno boolean not null default false/i.test(
    ddlSostegno,
  ),
);
check(
  'backfill adesione implicita (classe AD… tra le preferenze)',
  true,
  /update public\.profiles[\s\S]*classi_concorso[\s\S]*\^AD\(\[A-Z\]\{2,3\}\|\[0-9\]\{2\}\)\$/i.test(
    ddlSostegno,
  ),
);

console.log(errori === 0 ? '\n✅ MIGRAZIONI NOTIFICHE: nessun problema' : `\n❌ MIGRAZIONI NOTIFICHE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

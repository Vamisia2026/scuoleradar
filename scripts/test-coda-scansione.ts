/**
 * TEST — MIGRAZIONE coda di scansione (`scan_targets`) — REGRESSION GUARD.
 * ---------------------------------------------------------------------
 * Perché esiste: la coda è il punto di contatto fra N worker concorrenti e il
 * database. Tre proprietà non si vedono provando la migrazione a mano e si
 * perdono in silenzio al primo rifactor:
 *   · il CLAIM deve restare ATOMICO (`for update skip locked`): senza, due
 *     worker scansionano la stessa città e qualche target non viene mai preso;
 *   · le RPC `security definer` devono restare REVOCATE da anon/authenticated:
 *     senza, la chiave anon pubblica può consumare la coda dall'esterno;
 *   · il BACKOFF deve restare calcolato in `numeric`: in `int` va in overflow
 *     (ERROR 22003) dal 31° fallimento, cioè su una fonte morta da settimane —
 *     proprio il caso che il backoff deve coprire.
 * In più: il seed dei 21 target (20 capoluoghi di regione + Asti) deve restare
 * completo e idempotente, e il trigger `updated_at` deve seguire la
 * convenzione delle altre tabelle (`handle_<tabella>_updated_at`).
 *
 * Il controllo è STATICO sul file SQL: gira in CI senza database.
 *
 * Esecuzione: npm run test:coda
 */

import { readFileSync } from 'node:fs';

declare const process: { exitCode?: number };

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const PERCORSO = new URL(
  '../supabase/migrations/20260929102443_create_scan_targets_queue.sql',
  import.meta.url,
);
const sql = readFileSync(PERCORSO, 'utf8');

/** Estrae la definizione di una funzione (dal `create or replace` alla chiusura `$$;`). */
function definizione(nome: string): string {
  const marcatore = `create or replace function public.${nome}`;
  const inizio = sql.toLowerCase().indexOf(marcatore);
  if (inizio < 0) return '';
  const chiusura = sql.indexOf('$$;', inizio);
  return sql.slice(inizio, chiusura >= 0 ? chiusura + 3 : undefined);
}

console.log('— Coda di scansione: analisi statica della migrazione —');

// 1) FILE E IDEMPOTENZA
check('migrazione presente e non vuota', true, sql.trim().length > 0);
check('tabella creata in modo idempotente', true, /create table if not exists public\.scan_targets/i.test(sql));
check(
  'enum creato con guardia sul catalogo (pg_type)',
  true,
  /create type public\.scan_status as enum \('idle', 'queued', 'running', 'error', 'disabled'\)/i.test(sql) &&
    /pg_type/i.test(sql),
);
check(
  '3 indici idempotenti (claim, running, region)',
  3,
  (sql.match(/create index if not exists/gi) ?? []).length,
);
check(
  'indice del claim parziale su idle/queued',
  true,
  /create index if not exists scan_targets_claim_idx[\s\S]{0,200}where status in \('idle', 'queued'\)/i.test(sql),
);
check(
  'indice del reaper parziale su running',
  true,
  /create index if not exists scan_targets_running_idx[\s\S]{0,120}where status = 'running'/i.test(sql),
);

// 2) SCHEMA
check(
  'slug generato e persistito (stored)',
  true,
  /slug\s+text generated always as \(lower\(replace\(city, ' ', '-'\)\)\) stored/i.test(sql),
);
check('città unica (chiave del seed)', true, /unique \(city\)/i.test(sql));
check(
  'colonne di concorrenza e telemetria presenti',
  true,
  ['locked_at', 'locked_by', 'consecutive_failures', 'total_runs', 'next_run_at', 'priority'].every((c) =>
    new RegExp(`\\b${c}\\b`, 'i').test(sql),
  ),
);

// 3) TRIGGER updated_at (convenzione di casa)
check(
  'trigger updated_at dedicato alla tabella',
  true,
  /create or replace function public\.handle_scan_targets_updated_at\(\)/i.test(sql) &&
    /drop trigger if exists set_scan_targets_updated_at on public\.scan_targets;/i.test(sql) &&
    /create trigger set_scan_targets_updated_at[\s\S]{0,80}execute function public\.handle_scan_targets_updated_at\(\)/i.test(sql),
);

// 4) RPC: sicurezza + contratto
const RPC = [
  { nome: 'claim_scan_target', args: 'text, int' },
  { nome: 'finish_scan_target', args: 'uuid, boolean, text, int, int' },
  { nome: 'reap_stuck_scans', args: 'int' },
];
for (const { nome, args } of RPC) {
  const corpo = definizione(nome);
  const firma = args.replace(/([()])/g, '\\$&');
  check(`${nome}: definita`, true, corpo.length > 0);
  check(
    `${nome}: security definer + search_path = public`,
    true,
    /security definer/i.test(corpo) && /set search_path = public/i.test(corpo),
  );
  check(
    `${nome}: execute revocato a public/anon/authenticated`,
    true,
    new RegExp(`revoke execute on function public\\.${nome}\\(${firma}\\) from public, anon, authenticated`, 'i').test(sql),
  );
  check(
    `${nome}: execute concesso al solo service_role`,
    true,
    new RegExp(`grant execute on function public\\.${nome}\\(${firma}\\) to service_role`, 'i').test(sql),
  );
}

// 5) ATOMICITÀ E BACKOFF
const corpoClaim = definizione('claim_scan_target');
/** Ogni riga è una garanzia: il NOME spiega perché la regex non può sparire. */
const GARANZIE_CLAIM: [string, RegExp][] = [
  ['atomico (for update skip locked)', /for update skip locked/i],
  [
    'solo target dovuti, uno per chiamata',
    /status in \('idle', 'queued'\)[\s\S]{0,220}next_run_at <= now\(\)[\s\S]{0,220}limit 1/i,
  ],
  ['ordina per priorità poi scadenza', /order by priority asc, next_run_at asc/i],
  [
    'marca running e timbra il lock del worker',
    /status\s+= 'running'[\s\S]{0,200}locked_at\s+= now\(\)[\s\S]{0,200}locked_by\s+= p_worker/i,
  ],
  [
    'la riga presa torna al chiamante (returning → return next)',
    /returning \* into v_target;[\s\S]{0,120}return next v_target;/i,
  ],
  ['coda vuota → nessuna riga (return senza next)', /if not found then[\s\S]{0,120}return;/i],
  ['conteggia il run sul valore vecchio (total_runs)', /total_runs = total_runs \+ 1/i],
];
for (const [nome, garanzia] of GARANZIE_CLAIM) check(`claim: ${nome}`, true, garanzia.test(corpoClaim));

const corpoFinish = definizione('finish_scan_target');
check(
  'finish: successo → idle e fallimenti azzerati',
  true,
  /status\s+= 'idle'/i.test(corpoFinish) &&
    /consecutive_failures = 0/i.test(corpoFinish) &&
    /last_error\s+= null/i.test(corpoFinish),
);
check(
  'finish: fallimento → error e fallimenti incrementati',
  true,
  /status\s+= 'error'/i.test(corpoFinish) && /consecutive_failures = v_failures/i.test(corpoFinish),
);
check(
  'finish: backoff in numeric (niente overflow 22003 dal 31° fallimento)',
  true,
  /p_base_interval_min::numeric \* \(2::numeric \^ least\(v_failures, 30\)\)/i.test(corpoFinish),
);
check('finish: tetto del backoff applicato', true, /least\([\s\S]{0,140}p_max_backoff_min::numeric/i.test(corpoFinish));
check(
  'finish: libera sempre il lock',
  true,
  /locked_at\s+= null/i.test(corpoFinish) && /locked_by\s+= null/i.test(corpoFinish),
);

const corpoReap = definizione('reap_stuck_scans');
check(
  'reap: solo i running più vecchi della soglia',
  true,
  /status = 'running'/i.test(corpoReap) && /locked_at < now\(\) - make_interval\(secs => p_stale_seconds\)/i.test(corpoReap),
);
check(
  'reap: riporta a queued e libera il lock',
  true,
  /status\s+= 'queued'/i.test(corpoReap) && /locked_at\s+= null/i.test(corpoReap),
);
check('reap: ritorna il numero di righe liberate', true, /select count\(\*\)::int from reaped/i.test(corpoReap));

// 6) RLS E PERMESSI
check('RLS abilitata sulla tabella', true, /alter table public\.scan_targets enable row level security/i.test(sql));
check(
  'policy "service_role_full_access" (all → service_role)',
  true,
  /drop policy if exists "service_role_full_access" on public\.scan_targets;/i.test(sql) &&
    /create policy "service_role_full_access"[\s\S]{0,160}for all[\s\S]{0,80}to service_role/i.test(sql),
);
check('grant tabella a service_role', true, /grant all on table public\.scan_targets to service_role;/i.test(sql));
check(
  'nessun accesso dal client (revoke ad anon/authenticated)',
  true,
  /revoke all on table public\.scan_targets from anon, authenticated;/i.test(sql),
);

// 7) SEED: 20 CAPOLUOGHI DI REGIONE + ASTI
const righeSeed = Array.from(sql.matchAll(/^\s*\('((?:[^']|'')+)',\s*'((?:[^']|'')+)'\)/gm));
const citta = righeSeed.map((m) => (m[1] ?? '').replaceAll("''", "'"));
const regioni = righeSeed.map((m) => (m[2] ?? '').replaceAll("''", "'"));

const CITTA_ATTESE = [
  'Ancona', 'Aosta', 'Asti', 'Bari', 'Bologna', 'Cagliari', 'Campobasso', 'Catanzaro', 'Firenze',
  'Genova', "L'Aquila", 'Milano', 'Napoli', 'Palermo', 'Perugia', 'Potenza', 'Roma', 'Torino',
  'Trento', 'Trieste', 'Venezia',
];
const REGIONI_ATTESE = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia',
  'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia',
  'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
];

check('seed: 21 target (20 capoluoghi + Asti)', 21, righeSeed.length);
check('seed: esattamente le 21 città attese', [...CITTA_ATTESE].sort(), [...citta].sort());
check('seed: nessun duplicato', citta.length, new Set(citta).size);
check('seed: 20 regioni distinte', 20, new Set(regioni).size);
check('seed: esattamente le 20 regioni attese', [...REGIONI_ATTESE].sort(), Array.from(new Set(regioni)).sort());
check('seed: idempotente (on conflict do nothing)', true, /on conflict \(city\) do nothing;/i.test(sql));

// 8) WRAPPER TypeScript ↔ firma delle RPC
// Un rename su un lato solo (SQL o TS) compila ma fallisce a runtime: qui si
// blocca prima, confrontando nomi RPC e nomi dei parametri.
const wrapper = readFileSync(new URL('../src/lib/queue.ts', import.meta.url), 'utf8');
check('wrapper src/lib/queue.ts presente', true, wrapper.trim().length > 0);
for (const { nome } of RPC) {
  check(`wrapper: chiama ${nome}`, true, wrapper.includes(`'${nome}'`));
}
check(
  'wrapper: parametri allineati alla firma SQL',
  true,
  [
    'p_worker', 'p_lock_seconds', 'p_id', 'p_success', 'p_error', 'p_base_interval_min',
    'p_max_backoff_min', 'p_stale_seconds',
  ].every((p) => wrapper.includes(`${p}:`)),
);

console.log(errori === 0 ? '\n✅ CODA SCANSIONE: nessun problema' : `\n❌ CODA SCANSIONE: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

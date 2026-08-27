-- ============================================================
-- Generatore Modulistica — tabelle di cache e profilo utente
--
-- 1) generated_modules  → cache dei documenti generati via DeepSeek.
--    Ogni documento è salvato con l'hash SHA-256 della query normalizzata:
--    se la stessa query viene richiesta di nuovo, il documento viene
--    restituito dalla cache a costo API zero.
--
-- 2) user_saved_modules → moduli scaricati dall'utente (catalogo + generati),
--    visibili nella tab "I miei Modelli Scaricati".
--    module_key = 'cat:<id-catalogo>' oppure 'gen:<id-generated_modules>'.
-- ============================================================

-- ============================================================
-- Tabella generated_modules (cache condivisa, lettura pubblica)
-- ============================================================
create table if not exists public.generated_modules (
  id uuid primary key default gen_random_uuid(),
  -- Hash SHA-256 della query normalizzata (chiave anti-duplicati / cache)
  query_hash text unique not null,
  -- Query originale dell'utente (normalizzata)
  query text not null,
  -- Titolo del documento estratto dall'HTML generato
  title text not null,
  -- HTML pulito del documento (pronto per rendering e stampa/PDF)
  content_html text not null,
  -- Metadati aggiuntivi (es. { catalogo_id: 'mad' })
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generated_modules_query_idx on public.generated_modules (query);
create index if not exists generated_modules_created_idx on public.generated_modules (created_at desc);

alter table public.generated_modules enable row level security;
grant all on table public.generated_modules to service_role;
grant select on table public.generated_modules to anon;
grant select on table public.generated_modules to authenticated;

-- La cache è conoscenza condivisa: lettura consentita a tutti,
-- scrittura riservata al service_role (Edge Function genera-modulo).
drop policy if exists "read generated modules" on public.generated_modules;
create policy "read generated modules" on public.generated_modules
  for select using (true);

-- Trigger per aggiornare updated_at
create or replace function public.handle_generated_modules_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_generated_modules_updated_at on public.generated_modules;
create trigger set_generated_modules_updated_at
  before update on public.generated_modules
  for each row execute function public.handle_generated_modules_updated_at();

-- ============================================================
-- Tabella user_saved_modules (moduli scaricati per utente)
-- ============================================================
create table if not exists public.user_saved_modules (
  id uuid primary key default gen_random_uuid(),
  -- Riferimento a profiles (ON DELETE CASCADE)
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 'cat:<catalogo-id>' | 'gen:<generated-modules-uuid>'
  module_key text not null,
  -- 'catalogo' | 'generated'
  module_source text not null default 'generated',
  title text not null,
  tipo text not null default '',
  created_at timestamptz not null default now(),
  -- Un modulo può essere salvato una sola volta per utente
  constraint user_saved_modules_unique unique (user_id, module_key)
);

create index if not exists user_saved_modules_user_idx
  on public.user_saved_modules (user_id, created_at desc);

alter table public.user_saved_modules enable row level security;
grant all on table public.user_saved_modules to service_role;
grant select, insert, delete on table public.user_saved_modules to authenticated;

-- RLS: ogni utente gestisce solo i propri moduli salvati
drop policy if exists "read own saved modules" on public.user_saved_modules;
create policy "read own saved modules" on public.user_saved_modules
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "insert own saved modules" on public.user_saved_modules;
create policy "insert own saved modules" on public.user_saved_modules
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own saved modules" on public.user_saved_modules;
create policy "delete own saved modules" on public.user_saved_modules
  for delete to authenticated using (auth.uid() = user_id);

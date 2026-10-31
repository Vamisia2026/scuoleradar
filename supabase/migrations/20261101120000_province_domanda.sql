-- ============================================================
-- MVP demand-driven — `province_domanda` + RPC `request_province_scan`
-- (§26.126)
--
-- PERCHÉ ESISTE. La coda `scan_targets` ha UNA riga per CITTÀ (i 20 capoluoghi di
-- regione + Asti): una richiesta per «Cuneo» finisce su «Torino», perché la
-- scansione è regionale. Va bene per accendere l'hub USR, ma non basta per la
-- direttiva dell'MVP: «quando un utente cerca o seleziona una provincia, il
-- sistema accende e INTENSIFICA la scansione su quella specifica provincia».
-- Per intensificare bisogna sapere QUALE provincia è stata chiesta, non solo
-- quale capoluogo la copre.
--
-- Questa migrazione aggiunge il registro minimo della domanda:
--   · UNA riga per provincia (`province`, due lettere) con il conto delle
--     richieste, l'ultima richiesta e la fonte (prova-radar, preferenze, …);
--   · la RPC `request_province_scan`, aperta ad `anon`/`authenticated` perché è
--     il pubblico a chiederla, con TRE proprietà:
--       – VALIDAZIONE: solo codici di due lettere (nessuna riga arbitraria);
--       – THROTTLE: richieste ripetute entro `p_throttle_minutes` sono assorbite
--         (una pagina pubblica non deve poter martellare il database);
--       – BUMPS-ONLY: incrementa un contatore, non restituisce dati.
--   · RLS: lettura e scrittura al solo `service_role` — il registro lo legge
--     `scripts/crawl-mvp.ts` (worker), il browser lo tocca solo via RPC.
--
-- La finestra di validità (7 giorni) NON vive qui: la applica il crawler
-- (`src/lib/mvpPerimetro.ts`, `GIORNI_DOMANDA`), così la regola di prodotto ha
-- una sola sede e il database resta un registro di fatti.
--
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabella
-- ------------------------------------------------------------
create table if not exists public.province_domanda (
  province         text primary key,
  richieste        bigint not null default 0,
  ultima_richiesta timestamptz not null default now(),
  ultima_fonte     text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint province_domanda_codice check (province ~ '^[A-Z]{2}$'),
  constraint province_domanda_richieste_nonneg check (richieste >= 0)
);

comment on table public.province_domanda is
  'Domanda esplicita per provincia (prova del Radar, salvataggio preferenze): una riga per codice di due lettere, con conto e ultima richiesta. La finestra di validità vive nel crawler (src/lib/mvpPerimetro.ts), non qui.';

comment on column public.province_domanda.ultima_richiesta is
  'Ultima richiesta esplicita: il crawler approfondisce le scuole della provincia finché è dentro la finestra di 7 giorni.';

comment on column public.province_domanda.ultima_fonte is
  'Fonte dell''ultima richiesta (prova-radar, preferenze, …): serve alla diagnosi, non al calcolo.';

-- ------------------------------------------------------------
-- 2) Indice del crawler: «chi è stato chiesto negli ultimi N giorni»
-- ------------------------------------------------------------
create index if not exists province_domanda_ultima_idx
  on public.province_domanda (ultima_richiesta desc);

-- ------------------------------------------------------------
-- 3) Trigger `updated_at` (funzione DEDICATA, come `scan_targets`)
-- ------------------------------------------------------------
create or replace function public.handle_province_domanda_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_province_domanda_updated_at on public.province_domanda;
create trigger set_province_domanda_updated_at
  before update on public.province_domanda
  for each row execute function public.handle_province_domanda_updated_at();


-- ------------------------------------------------------------
-- 4) RPC `request_province_scan`
-- ------------------------------------------------------------
create or replace function public.request_province_scan(
  p_province text,
  p_source text default 'sconosciuta',
  p_throttle_minutes int default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provincia text;
  v_righe     int;
begin
  v_provincia := upper(btrim(coalesce(p_province, '')));

  -- SOLO codici di due lettere: la chiave anon non deve poter inserire righe
  -- arbitrarie nel registro (e il crawler scarta comunque i codici fuori
  -- catalogo: `pianoScansione`).
  if v_provincia !~ '^[A-Z]{2}$' then
    return false;
  end if;

  insert into public.province_domanda (province, richieste, ultima_richiesta, ultima_fonte)
  values (
    v_provincia,
    1,
    now(),
    coalesce(nullif(btrim(p_source), ''), 'sconosciuta')
  )
  on conflict (province) do update
     set richieste        = public.province_domanda.richieste + 1,
         ultima_richiesta = now(),
         ultima_fonte     = excluded.ultima_fonte
   where public.province_domanda.ultima_richiesta
         < now() - make_interval(mins => greatest(p_throttle_minutes, 0));

  get diagnostics v_righe = row_count;
  return v_righe > 0;
end;
$$;

comment on function public.request_province_scan(text, text, int) is
  'Registra la domanda di scansione per UNA provincia (due lettere), con throttle sulle richieste ripetute. Ritorna true se la richiesta è stata registrata (o è la prima per quella provincia).';

-- ------------------------------------------------------------
-- 5) Permessi — come `request_scan_target`: aperta al pubblico, senza dati
-- ------------------------------------------------------------
revoke execute on function public.request_province_scan(text, text, int) from public;
grant execute on function public.request_province_scan(text, text, int)
  to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 6) RLS — il registro è del worker, non del browser
-- ------------------------------------------------------------
alter table public.province_domanda enable row level security;

drop policy if exists "service_role_full_access" on public.province_domanda;
create policy "service_role_full_access"
  on public.province_domanda
  for all
  to service_role
  using (true)
  with check (true);

grant all on table public.province_domanda to service_role;
revoke all on table public.province_domanda from anon, authenticated;

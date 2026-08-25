-- ============================================================
-- Referral & Affiliate — schema, trigger e RPC
-- 1) profiles.referral_code univoco (case-insensitive)
-- 2) tabella referrals (KPI referrer, privacy-first)
-- 3) trigger generazione automatica codice
-- 4) RPC valida_codice_promo (per checkout)
-- ============================================================

-- Colonna referral_code
alter table public.profiles add column if not exists referral_code text;

-- Unicità case-insensitive (il trigger uppercasa sempre il valore)
create unique index if not exists profiles_referral_code_idx
  on public.profiles (lower(referral_code)) where referral_code is not null;

comment on column public.profiles.referral_code is
  'Codice promo personale dell utente (UPPERCASE, univoco case-insensitive)';

-- ============================================================
-- Trigger: genera il codice da NOME+COGNOME (fallback email / DOCENTE)
-- con suffisso incrementale in caso di duplicato.
-- ============================================================
create or replace function public.genera_referral_code(nome text, cognome text, email text)
returns text
language plpgsql
as $$
declare
  base  text;
  code  text;
  i     int := 1;
begin
  base := upper(
    coalesce(regexp_replace(nome,  '\s', '', 'g'), '') ||
    coalesce(regexp_replace(cognome, '\s', '', 'g'), '')
  );
  if base = '' and email is not null then
    base := upper(split_part(email, '@', 1));
  end if;
  base := regexp_replace(base, '[^A-Z0-9]', '', 'g');
  if base = '' then base := 'DOCENTE'; end if;

  code := base;
  loop
    exit when not exists (select 1 from public.profiles where lower(referral_code) = lower(code));
    i := i + 1;
    code := base || i::text;
  end loop;
  return code;
end;
$$;

create or replace function public.handle_referral_code()
returns trigger
language plpgsql
as $$
begin
  if new.referral_code is null or new.referral_code = '' then
    new.referral_code := public.genera_referral_code(new.nome, new.cognome, new.email);
  else
    new.referral_code := upper(new.referral_code);
  end if;
  return new;
end;
$$;

drop trigger if exists set_referral_code on public.profiles;
create trigger set_referral_code
  before insert or update on public.profiles
  for each row execute function public.handle_referral_code();

-- ============================================================
-- Tabella referrals
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid references public.profiles (id) on delete cascade,
  referred_user_id uuid references public.profiles (id) on delete set null,
  discount_applied numeric not null default 10.00,
  reward_amount numeric not null default 10.00,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  constraint referrals_status_check check (status in ('pending', 'completed'))
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);
create index if not exists referrals_referred_idx on public.referrals (referred_user_id);

alter table public.referrals enable row level security;
grant all on table public.referrals to service_role;
grant select on table public.referrals to authenticated;

-- RLS: il referrer vede solo le proprie righe (anonime: nessun dato personale degli invitati)
create policy "read own referrals" on public.referrals
  for select to authenticated using (referrer_id = auth.uid());

-- ============================================================
-- RPC valida_codice_promo: usata dal checkout e dal frontend
-- ============================================================
create or replace function public.valida_codice_promo(p_codice text)
returns table (valido boolean, referrer_id uuid, codice text, sconto numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
begin
  select id, referral_code into v
    from public.profiles
   where lower(referral_code) = lower(p_codice)
   limit 1;

  if found then
    return query select true::boolean, v.id, v.referral_code, 10.00::numeric;
  else
    return query select false::boolean, null::uuid, null::text, 0.00::numeric;
  end if;
end;
$$;

grant execute on function public.valida_codice_promo(text) to authenticated;
grant execute on function public.valida_codice_promo(text) to service_role;

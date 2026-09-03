-- ============================================================
-- FREE FOREVER FLAG: profiles.is_free_forever (boolean)
--   true  = accesso PRO a vita:
--           · nessun controllo di scadenza / upsell paywall;
--           · nessun limite / contatore di prova;
--           · escluso dagli avvisi automatici di scadenza abbonamento.
--   false = piano regolare (base / pro a pagamento).
-- Il flag è la fonte canonica server-side; il trigger lo allinea a ogni
-- modifica di profiles.piano (free_forever => true, altrimenti => false).
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- ============================================================

alter table public.profiles add column if not exists is_free_forever boolean not null default false;

comment on column public.profiles.is_free_forever is
  'Free Forever: accesso PRO a vita. true = nessuna scadenza/paywall, escluso dagli avvisi di scadenza abbonamento.';

-- Backfill: i profili già marcati piano='free_forever' ricevono il flag.
update public.profiles
   set is_free_forever = true
 where piano = 'free_forever'
   and is_free_forever is not true;

-- Trigger di sincronizzazione: il flag segue SEMPRE il piano (niente disallineamenti).
create or replace function public.sync_is_free_forever_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.is_free_forever := (new.piano = 'free_forever');
  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_is_free_forever on public.profiles;
create trigger trg_profiles_sync_is_free_forever
  before insert or update of piano on public.profiles
  for each row execute function public.sync_is_free_forever_flag();

-- Firma usata dalle UI admin/frontend (select mirate).
grant select (id, is_free_forever) on public.profiles to authenticated;

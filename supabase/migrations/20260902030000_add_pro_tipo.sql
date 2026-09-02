-- ============================================================
-- Pannello Admin — colonna opzionale `pro_tipo` (piano PRO dettagliato)
-- Valori: 'mensile' | 'annuale' | NULL
-- Permette ai badge compatti del Pannello Admin di mostrare
-- PRO1M (PRO 1 mese) o PRO1A (PRO 1 anno).
-- is_beta_tester esiste già (migrazione ...31170000).
-- ============================================================

alter table public.profiles add column if not exists pro_tipo text;

comment on column public.profiles.pro_tipo is
  'Dettaglio piano PRO: mensile | annuale (badge PRO1M / PRO1A nel Pannello Admin)';

-- Backfill prudente dal campo legacy (solo se la colonna subscription_tier esiste).
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'subscription_tier'
  ) then
    update public.profiles
       set pro_tipo = case
            when subscription_tier = 'pro_mensile' then 'mensile'
            when subscription_tier = 'pro_annuale' then 'annuale'
            else pro_tipo
          end
     where piano = 'pro'
       and pro_tipo is null
       and subscription_tier in ('pro_mensile', 'pro_annuale');
  end if;
end $$;


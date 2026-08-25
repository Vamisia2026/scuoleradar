-- ============================================================
-- Allineamento schema `profiles` allo schema atteso dal frontend
-- (la tabella preesistente NON aveva queste colonne e il trigger
--  handle_referral_code, che usa new.nome/new.cognome, falliva su
--  ogni INSERT/UPDATE con "record new has no field nome").
-- ============================================================

alter table public.profiles add column if not exists nome text;
alter table public.profiles add column if not exists cognome text;
alter table public.profiles add column if not exists ordini text[] default '{}';
alter table public.profiles add column if not exists materie_id text[] default '{}';
alter table public.profiles add column if not exists materie_custom text[] default '{}';
alter table public.profiles add column if not exists telegram_username text default '';
alter table public.profiles add column if not exists email_notifica text default '';
alter table public.profiles add column if not exists onboarded boolean default false;

comment on column public.profiles.nome is 'Nome dell utente (usato dal trigger referral)';
comment on column public.profiles.cognome is 'Cognome dell utente (usato dal trigger referral)';
comment on column public.profiles.materie_id is 'IDs delle materie di competenza selezionate';
comment on column public.profiles.materie_custom is 'Materie personalizzate inserite dall utente';
comment on column public.profiles.onboarded is 'Flag onboarding completato';

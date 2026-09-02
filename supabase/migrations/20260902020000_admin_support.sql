-- ============================================================
-- Pannello Admin — colonne di supporto opzionali
-- Applica dal SQL Editor di Supabase per abilitare:
--   · telefono       → colonna "Phone" nel Gestione Utenti
--   · login_type     → tipologia di accesso (google | email | apple…)
--   · radar_attivo   → toggle istantaneo attiva/disattiva Radar (Tab 2)
-- La nuova UI Admin rileva automaticamente le colonne: se la migrazione
-- non è applicata, mostra i campi come "—" e il toggle con l'avviso.
-- ============================================================

alter table public.profiles add column if not exists telefono text default '';
alter table public.profiles add column if not exists login_type text;
alter table public.profiles add column if not exists radar_attivo boolean not null default true;

comment on column public.profiles.telefono is 'Telefono dell utente (Pannello Admin, colonna Phone)';
comment on column public.profiles.login_type is 'Tipologia di accesso: google | email | apple (Pannello Admin)';
comment on column public.profiles.radar_attivo is 'Stato Radar Scuole: true = attivo, false = in pausa (toggle istantaneo admin)';

-- Backfill prudente: chi ha già completato l'onboarding ha il Radar attivo.
update public.profiles
   set radar_attivo = true
 where onboarded = true
   and radar_attivo is null;

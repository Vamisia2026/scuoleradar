-- ============================================================
-- Versionamento Template Master della modulistica
-- user_saved_modules conserva il riferimento al modello Master
-- (template_id) e la versione corrente (master_version, es. v2026.1):
-- al riscaricamento l'engine attinge SEMPRE al Template Master
-- con la versione normativamente valida.
-- ============================================================

alter table public.user_saved_modules
  add column if not exists template_id text;

alter table public.user_saved_modules
  add column if not exists master_version text;

comment on column public.user_saved_modules.template_id is
  'Riferimento al documento/template del catalogo Master (per i download dal catalogo)';

comment on column public.user_saved_modules.master_version is
  'Versione del Template Master al momento del salvataggio (es. v2026.1)';

-- Backfill: versioni correnti per le righe esistenti.
update public.user_saved_modules
   set template_id = case
         when module_source = 'catalogo' then replace(module_key, 'cat:', '')
         else null
       end,
       master_version = coalesce(master_version, 'v2026.1');

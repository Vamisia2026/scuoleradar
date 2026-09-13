-- ============================================================
-- FIX GLOBALE COGNOME: "Pampanaro" → "Pampararo"
--
-- Contesto: l'allowlist di provisioning (scripts/provision-beta-users.ts e
-- Edge `admin` → EMAIL_PRE_APPROVATI) conteneva la variante ERRATA
-- "pampanaro", che ha generato account duplicati/errati per Giuseppe:
--   ✗ g.pampanaro@gmail.com
--   ✗ pampanaro.giuseppe@itisartom.edu.it
-- Gli account CORRETTI da preservare sono:
--   ✓ g.pampararo@gmail.com                  (Gmail personale)
--   ✓ pampararo.giuseppe@itisartom.edu.it    (istituzionale ITIS "A. Artom", Asti)
--
-- Questa migrazione è IDEMPOTENTE e NON distruttiva: si limita a
-- STANDARDIZZARE la grafia del cognome su `profiles` e sul metadata di
-- `auth.users`. La potatura degli account errati (solo se PRIVI di Radar
-- attivo/registrazione valida) è demandata allo script dedicato, che lavora
-- in DRY-RUN di default e preserva i keeper:
--     npx tsx scripts/admin-fix-pampararo.ts            # report
--     npx tsx scripts/admin-fix-pampararo.ts --apply    # applica
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.cognome → "Pampararo" (qualsiasi variante di grafia)
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'cognome'
  ) then
    update public.profiles
       set cognome = 'Pampararo'
     where lower(btrim(coalesce(cognome, ''))) in ('pampanaro', 'pampararo')
       and cognome is distinct from 'Pampararo';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. auth.users.raw_user_meta_data → cognome/full_name coerenti
--    (solo le righe che contengono davvero la variante errata).
-- ------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'users' and column_name = 'raw_user_meta_data'
  ) then
    update auth.users
       set raw_user_meta_data =
             coalesce(raw_user_meta_data, '{}'::jsonb)
             -- cognome: variante errata → canonico
             || case
                  when lower(btrim(coalesce(raw_user_meta_data->>'cognome', ''))) = 'pampanaro'
                    then jsonb_build_object('cognome', 'Pampararo')
                  else '{}'::jsonb
                end
             -- full_name: sostituisce la variante errata mantenendo il resto
             || case
                  when coalesce(raw_user_meta_data->>'full_name', '') ilike '%pampanaro%'
                    then jsonb_build_object(
                      'full_name',
                      replace(
                        replace(raw_user_meta_data->>'full_name', 'Pampanaro', 'Pampararo'),
                        'pampanaro', 'Pampararo'
                      )
                    )
                  else '{}'::jsonb
                end
     where lower(btrim(coalesce(raw_user_meta_data->>'cognome', ''))) = 'pampanaro'
        or coalesce(raw_user_meta_data->>'full_name', '') ilike '%pampanaro%'
        or coalesce(raw_user_meta_data->>'nome', '') ilike '%pampanaro%';
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. Nota operativa (nessuna cancellazione qui):
--    gli account creati con le email errate vanno rimossi SOLO se privi di
--    Radar attivo / registrazione valida, tramite lo script dedicato
--    (deleteUser → cascade su profiles). I keeper restano intatti.
-- ------------------------------------------------------------

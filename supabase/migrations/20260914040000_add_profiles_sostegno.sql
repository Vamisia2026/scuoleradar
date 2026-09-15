-- ============================================================
-- Preferenza SOSTEGNO (special education) nel profilo Radar.
--
-- Perché: il sostegno (ADAA/ADEE/ADMM/ADSS) è un'abilitazione SEPARATA
-- dalle classi disciplinari, ma le fonti lo pubblicano spesso citando
-- anche le classi di concorso. Senza una preferenza esplicita un docente
-- di tedesco (A-22/A-25) riceveva interpelli di sostegno (falso positivo).
--
-- Regola applicata dal matching (src/lib/matchingEngine.ts → sostegnoAmmesso):
--   gli avvisi di sostegno vengono consegnati SOLO ai profili con
--   sostegno = true OPPURE con una classe di sostegno tra le preferenze
--   (adesione implicita: nessuno perde copertura con questa migrazione).
--
-- Idempotente: può essere rieseguita su un DB già allineato.
-- ============================================================

alter table public.profiles add column if not exists sostegno boolean not null default false;

comment on column public.profiles.sostegno is
  'Preferenza SOSTEGNO: true = includi anche le opportunità di sostegno (ADAA/ADEE/ADMM/ADSS)';

-- BACKFILL — adesione implicita: chi ha già una classe di sostegno tra le
-- proprie preferenze ha evidentemente aderito (nessun opt-out retroattivo).
update public.profiles p
   set sostegno = true
 where p.sostegno is distinct from true
   and exists (
     select 1
       from unnest(coalesce(p.classi_concorso, '{}'::text[])) as c
      where upper(btrim(c)) ~ '^AD([A-Z]{2,3}|[0-9]{2})$'
   );

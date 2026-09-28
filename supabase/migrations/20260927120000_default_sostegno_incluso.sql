-- ============================================================
-- Preferenza SOSTEGNO: INCLUSA di default (nessun filtro silenzioso).
--
-- Regola precedente (20260914040000): `sostegno = false` di default → gli avvisi
-- AD… (ADAA/ADEE/ADMM/ADSS) venivano esclusi a chi non aveva mai risposto alla
-- domanda: un filtro applicato all'insaputa dell'utente.
-- Regola attuale: il sostegno è INCLUSO, salvo scelta esplicita contraria
-- (opzione di uscita nelle Preferenze Radar → `SostegnoToggle`). Chi non lo vuole
-- lo spegne in un click; nessuno perde contenuti per una preferenza mai data.
--
-- Allineato al client: `src/contexts/app/costanti.ts`
-- (`defaultPreferenze.sostegno = true`) e `src/lib/matchingEngine.ts`
-- (guardia `sostegnoAmmesso` → adesione implicita dove la preferenza dice true).
--
-- Idempotente: può essere rieseguita su un DB già allineato.
-- ============================================================

-- Colonna autosufficiente (se la migrazione 20260914040000 non fosse mai girata).
alter table public.profiles add column if not exists sostegno boolean not null default true;

alter table public.profiles alter column sostegno set default true;

comment on column public.profiles.sostegno is
  'Preferenza SOSTEGNO: true = includi anche le opportunità di sostegno (ADAA/ADEE/ADMM/ADSS). Inclusa di default: si esclude solo su scelta esplicita dell''utente.';

-- BACKFILL — nessun opt-out retroattivo: il `false` precedente era il DEFAULT,
-- non una scelta dell'utente, quindi va ricondotto all'inclusione.
update public.profiles
   set sostegno = true
 where sostegno is distinct from true;

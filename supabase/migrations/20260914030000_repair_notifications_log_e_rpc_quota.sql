-- ============================================================
-- REPAIR — Ledger DB + RPC quota notifiche (bloccante per il DIGEST)
--
-- Risolve due problemi che impedivano la deduplica a livello database:
--
-- 1) `public.notifications_log` NON presente in produzione: la migrazione
--    `20260914010000_notifications_log.sql` non è mai stata applicata, quindi
--    il ledger DB era assente e l'unica protezione restava il file locale
--    (`.scuoleradar/notifiche-ledger.json`). Qui la tabella viene RI-ASSERITA in
--    modo idempotente, così questo file è autosufficiente.
--
-- 2) `public.incrementa_notifiche_utente(uuid)` in errore `42702`:
--    "column reference \"notifiche_usate\" is ambiguous". Causa: la REGRESSIONE
--    di `20260831100000_add_rpc_notifiche_annuali_reset_extra.sql`, che ha
--    ri-definito la funzione con un `select piano, notifiche_usate, notifiche_anno
--    into ...` NON qualificato, mentre il `RETURNS TABLE(..., notifiche_usate integer)`
--    crea un OUTPUT PARAMETER omonimo. La fix corretta esiste già in
--    `20260831150000_switch_rpc_notifiche_anno_scolastico.sql` ma non è applicata.
--    Qui la funzione è ridefinita con:
--      · colonne QUALIFICATE con l'alias di tabella `p`;
--      · direttiva `#variable_conflict use_column` (blindatura: anche un futuro
--        riferimento ambiguo risolve sulla COLONNA, non sull'output param);
--      · reset su ANNO SCOLASTICO italiano (1° settembre);
--      · `SELECT ... FOR UPDATE` per l'atomicità.
--
-- Nessuna modifica di dati: solo DDL idempotente.
-- Applicazione: `supabase db push` (progetto linkato) oppure incollare questo file
-- nell'SQL Editor del progetto.
--
-- Verifica post-applicazione:
--   select public.incrementa_notifiche_utente('00000000-0000-0000-0000-000000000000');
--   -- atteso: una riga (false, 0) — nessun utente toccato — NESSUN errore 42702
--   select count(*) from public.notifications_log;
-- ============================================================

-- ------------------------------------------------------------
-- 1) LEDGER DB: notifiche inviate (utente × interpello × canale)
-- ------------------------------------------------------------
create table if not exists public.notifications_log (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  interpello_hash  text not null,
  canale           text not null,               -- 'email' | 'telegram'
  sent_at          timestamptz not null default now(),
  primary key (user_id, interpello_hash, canale)
);

create index if not exists notifications_log_user_idx
  on public.notifications_log (user_id);

-- La PK (user_id, interpello_hash, canale) è l'UNICA chiave di conflitto usata
-- dagli upsert di `notifier.ts`; l'indice sull'hash serve alle letture per avviso.
create index if not exists notifications_log_hash_idx
  on public.notifications_log (interpello_hash);

comment on table public.notifications_log is
  'Ledger delle notifiche inviate (utente × interpello × canale): impedisce a digest, dispatch e backfill di rimandare la stessa opportunità.';

-- Sicurezza: nessun accesso client; solo service_role (scraper/script admin).
alter table public.notifications_log enable row level security;
revoke all on public.notifications_log from anon, authenticated;
grant all on public.notifications_log to service_role;

-- ------------------------------------------------------------
-- 2) RPC QUOTA: incrementa_notifiche_utente (fix ambiguità 42702)
-- ------------------------------------------------------------
create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
-- Blindatura dell'ambiguità: `notifiche_usate` esiste sia come OUTPUT PARAMETER
-- del RETURNS TABLE sia come colonna di profiles.notifiche_usate. Con questa
-- direttiva ogni riferimento non qualificato risolve sulla COLONNA.
#variable_conflict use_column
declare
  v_piano text;
  v_usate integer;
  v_anno integer;
  -- Anno di INIZIO dell'anno scolastico italiano corrente:
  -- da settembre in poi è l'anno solare corrente, prima è il precedente.
  v_anno_scolastico integer := (
    extract(year from now()) -
    case when extract(month from now()) < 9 then 1 else 0 end
  )::int;
begin
  -- Guardia condizionale: i client autenticati possono operare solo sul proprio
  -- profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Lettura con lock di riga: atomicità fra chiamate concorrenti sullo stesso
  -- utente. Colonne QUALIFICATE con l'alias `p`.
  select p.piano, p.notifiche_usate, p.notifiche_anno
    into v_piano, v_usate, v_anno
    from public.profiles p
   where p.id = p_user_id
     for update;

  -- Utente inesistente: nessun effetto, nessun consumo di quota.
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Reset all'INIZIO DELL'ANNO SCOLASTICO (1° settembre): contatore e flag della
  -- sequenza post-quota (extra/recap) ripartono da zero.
  if v_anno is null or v_anno <> v_anno_scolastico then
    v_usate := 0;
    update public.profiles p
       set notifiche_usate          = 0,
           notifiche_anno           = v_anno_scolastico,
           notifiche_blocco_inviato = false,
           notifiche_recap_inviato  = false
     where p.id = p_user_id;
  end if;

  -- PRO (free_forever è gestito come PRO a monte) → sempre consentito; il
  -- contatore viene comunque incrementato per la diagnostica.
  if v_piano = 'pro' then
    update public.profiles p
       set notifiche_usate = v_usate + 1
     where p.id = p_user_id;

    return query select true::boolean, v_usate + 1;
    return;
  end if;

  -- BASE → limite di 3 notifiche per ANNO SCOLASTICO.
  if v_usate >= 3 then
    return query select false::boolean, v_usate;
    return;
  end if;

  -- BASE sotto il limite → incrementa e consenti l'invio.
  update public.profiles p
     set notifiche_usate = v_usate + 1
   where p.id = p_user_id;

  return query select true::boolean, v_usate + 1;
end;
$$;

grant execute on function public.incrementa_notifiche_utente(uuid) to authenticated;
grant execute on function public.incrementa_notifiche_utente(uuid) to service_role;

comment on column public.profiles.notifiche_usate is
  'Notifiche usate nell anno scolastico corrente (base: max 3 per anno scolastico; pro: illimitato)';

comment on column public.profiles.notifiche_anno is
  'Anno di inizio dell anno scolastico di riferimento del contatore (es. 2026 = anno scolastico 2026-2027); reset automatico ogni 1 settembre';

-- ============================================================
-- Notifiche: limite ANNUALE per gli utenti BASE (3 per ANNO SOLARE)
-- Aggiorna l'RPC incrementa_notifiche_utente:
--  - pro  → consentito sempre; il contatore notifiche_usate viene
--           comunque incrementato (conteggio accurato).
--  - base → max 3 notifiche per ANNO; il contatore si azzera
--           automaticamente al cambio di anno solare.
-- La colonna legacy notifiche_mese NON viene più letta/scritta dall'RPC.
-- Viene aggiunta la colonna notifiche_anno come riferimento dell'anno
-- solare corrente del contatore.
-- Mantiene le garanzie delle versioni precedenti:
--   · SELECT ... FOR UPDATE → atomicità / niente race condition
--   · SET search_path = public → sicurezza per SECURITY DEFINER
--   · gestione utente inesistente
--   · guardia condizionale (auth.uid() IS NULL OR auth.uid() = p_user_id)
-- ============================================================

alter table public.profiles
  add column if not exists notifiche_anno integer;

create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piano text;
  v_usate integer;
  v_anno integer;
  v_anno_corrente integer := extract(year from now());
begin
  -- Guardia condizionale: i client autenticati possono operare solo sul
  -- proprio profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Lettura con lock di riga: blocca le race condition tra chiamate
  -- concorrenti sullo stesso utente (es. notifiche in parallelo).
  select piano, notifiche_usate, notifiche_anno
    into v_piano, v_usate, v_anno
    from public.profiles
   where id = p_user_id
     for update;

  -- Utente inesistente
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Reset ANNUALE: se l'anno di riferimento è cambiato (o non è mai stato
  -- registrato), il contatore riparte da zero per il nuovo anno solare.
  if v_anno is null or v_anno <> v_anno_corrente then
    v_usate := 0;
    update public.profiles
       set notifiche_usate = 0,
           notifiche_anno  = v_anno_corrente
     where id = p_user_id;
  end if;

  -- PRO → consentito sempre (incrementa comunque il contatore usato)
  if v_piano = 'pro' then
    update public.profiles
       set notifiche_usate = v_usate + 1
     where id = p_user_id;

    return query select true::boolean, v_usate + 1;
    return;
  end if;

  -- BASE → limite di 3 notifiche per ANNO
  if v_usate >= 3 then
    return query select false::boolean, v_usate;
    return;
  end if;

  -- BASE sotto il limite → incrementa e consenti l'invio
  update public.profiles
     set notifiche_usate = v_usate + 1
   where id = p_user_id;

  return query select true::boolean, v_usate + 1;
end;
$$;

grant execute on function public.incrementa_notifiche_utente(uuid) to authenticated;
grant execute on function public.incrementa_notifiche_utente(uuid) to service_role;

comment on column public.profiles.notifiche_usate is
  'Notifiche usate nell anno corrente (base: max 3 per anno; pro: illimitato)';

comment on column public.profiles.notifiche_anno is
  'Anno solare di riferimento del contatore notifiche_usate (reset annuale automatico)';

comment on column public.profiles.notifiche_mese is
  'Legacy: mese di riferimento del vecchio contatore mensile (non piu usato dall RPC: il limite e ora di 3 notifiche per anno)';

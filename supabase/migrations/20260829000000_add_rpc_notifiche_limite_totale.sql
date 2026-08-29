-- ============================================================
-- Aggiornamento RPC incrementa_notifiche_utente
-- Nuova business logic: il limite per gli utenti BASE è di 3
-- NOTIFICHE TOTALI (senza più alcun reset mensile).
-- - pro      → consentito sempre; il contatore notifiche_usate
--              viene comunque incrementato (conteggio accurato).
-- - base     → max 3 totali; oltre il limite si blocca l'invio.
-- Mantiene le garanzie della versione precedente:
--   · SELECT ... FOR UPDATE → atomicità / niente race condition
--   · SET search_path = public → sicurezza per SECURITY DEFINER
--   · gestione utente inesistente
-- Aggiunge la guardia condizionale (auth.uid() IS NULL OR
-- auth.uid() = p_user_id): i client possono agire solo sul proprio
-- profilo, le chiamate server via service_role passano senza check.
-- La colonna notifiche_mese non viene più letta/scritta dall'RPC
-- (rimane nello schema come colonna legacy, nessun dato rimosso).
-- ============================================================

create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piano text;
  v_usate integer;
begin
  -- Guardia condizionale: i client autenticati possono operare solo sul
  -- proprio profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Lettura con lock di riga: blocca le race condition tra chiamate
  -- concorrenti sullo stesso utente (es. notifiche in parallelo).
  select piano, notifiche_usate
    into v_piano, v_usate
    from public.profiles
   where id = p_user_id
     for update;

  -- Utente inesistente
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- PRO → consentito sempre (incrementa comunque il contatore usato)
  if v_piano = 'pro' then
    update public.profiles
       set notifiche_usate = v_usate + 1
     where id = p_user_id;

    return query select true::boolean, v_usate + 1;
    return;
  end if;

  -- BASE → limite di 3 notifiche totali (nessun reset mensile)
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
  'Notifiche usate (base: max 3 totali, senza reset; pro: illimitato)';

comment on column public.profiles.notifiche_mese is
  'Legacy: mese di riferimento del vecchio contatore mensile (non piu usato dall RPC: il limite e ora di 3 notifiche totali)';

-- ============================================================
-- RPC consumo credito a consumo (paywall CFU / Assistente AI)
-- Decrementa atomicamente i crediti se > 0 e ritorna il nuovo saldo.
-- ============================================================

create or replace function public.consuma_credito_utente(p_user_id uuid)
returns table (ok boolean, crediti integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crediti integer;
begin
  update public.profiles
     set crediti = crediti - 1
   where id = p_user_id
     and crediti > 0
   returning crediti into v_crediti;

  if v_crediti is not null then
    return query select true::boolean, v_crediti::integer;
  else
    return query select false::boolean, 0::integer;
  end if;
end;
$$;

grant execute on function public.consuma_credito_utente(uuid) to authenticated;
grant execute on function public.consuma_credito_utente(uuid) to service_role;

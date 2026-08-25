-- ============================================================
-- FASE 6 — RPC incremento crediti (sblocchi A la Carte)
-- PostgREST non applica l'operatore { inc } sulle colonne integer:
-- si usa una RPC atomica e sicura (security definer).
-- ============================================================

create or replace function public.incrementa_crediti_utente(p_user_id uuid, p_delta integer default 1)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set crediti = crediti + p_delta
   where id = p_user_id;
  return (select crediti from public.profiles where id = p_user_id);
end;
$$;

grant execute on function public.incrementa_crediti_utente(uuid, integer) to authenticated;
grant execute on function public.incrementa_crediti_utente(uuid, integer) to service_role;

-- ============================================================
-- FIX 42702 — ambiguità PL/pgSQL in incrementa_notifiche_utente
-- Il RETURNS TABLE(..., notifiche_usate integer) crea un OUTPUT
-- PARAMETER con lo stesso nome della colonna profiles.notifiche_usate:
-- il `select piano, notifiche_usate, notifiche_anno into ...` non
-- qualificato diventa ambiguo in PL/pgSQL (Postgres 42702).
-- La lettura viene qualificata con l'alias di tabella `p`.
-- La logica è invariata: base → 3 notifiche/ANNO con reset automatico
-- al cambio di anno solare (inclusi i flag extra/recap); pro → illimitato.
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
  v_anno integer;
  v_anno_corrente integer := extract(year from now());
begin
  -- Guardia condizionale: i client autenticati possono operare solo sul
  -- proprio profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Lettura con lock di riga, colonne QUALIFICATE con l'alias `p` per
  -- evitare l'ambiguità con l'output parameter `notifiche_usate`.
  select p.piano, p.notifiche_usate, p.notifiche_anno
    into v_piano, v_usate, v_anno
    from public.profiles p
   where p.id = p_user_id
     for update;

  -- Utente inesistente
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Reset ANNUALE: contatore + flag della sequenza post-prova (extra/recap)
  -- ripartono da zero per il nuovo anno solare.
  if v_anno is null or v_anno <> v_anno_corrente then
    v_usate := 0;
    update public.profiles
       set notifiche_usate          = 0,
           notifiche_anno           = v_anno_corrente,
           notifiche_blocco_inviato = false,
           notifiche_recap_inviato  = false
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

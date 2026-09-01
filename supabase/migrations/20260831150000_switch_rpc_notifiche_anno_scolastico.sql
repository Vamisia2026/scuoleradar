-- ============================================================
-- Notifiche: reset su ANNO SCOLASTICO italiano (1° settembre)
-- Aggiorna l'RPC incrementa_notifiche_utente affinché il limite
-- BASE di 3 notifiche non segua più il calendario solare, ma il
-- ciclo dell'anno scolastico italiano: dal 1° settembre di un anno
-- al 31 agosto dell'anno successivo (es. "2026-2027").
--
-- Regola di calcolo dell'anno scolastico corrente:
--   · da settembre a dicembre  → anno scolastico = anno solare corrente
--     (es. 1/9/2026 → anno scolastico "2026-2027")
--   · da gennaio ad agosto     → anno scolastico = anno solare - 1
--     (es. 31/8/2026 → anno scolastico "2025-2026")
--
-- Il valore salvato in profiles.notifiche_anno è l'ANNO DI INIZIO
-- dell'anno scolastico (2026 = "2026-2027"). Il reset avviene quindi
-- ogni 1° settembre, non più a capodanno, e NON dipende dall'iscrizione
-- dell'utente (nessun anniversario di registrazione).
--
-- Mantiene le garanzie delle versioni precedenti:
--   · SELECT ... FOR UPDATE → atomicità / niente race condition
--   · colonne qualificate con l'alias `p` (fix ambiguità 42702)
--   · guardia condizionale (auth.uid() IS NULL OR auth.uid() = p_user_id)
--   · reset dei flag post-prova (notifiche_blocco_inviato /
--     notifiche_recap_inviato) a ogni cambio di anno scolastico
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
  -- Anno di INIZIO dell'anno scolastico italiano corrente:
  -- da settembre in poi è l'anno solare corrente, prima è il precedente.
  v_anno_scolastico integer := (
    extract(year from now()) -
    case when extract(month from now()) < 9 then 1 else 0 end
  )::int;
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

  -- Reset ALL'INIZIO DELL'ANNO SCOLASTICO (1° settembre): se l'anno di
  -- riferimento è cambiato (o non è mai stato registrato), contatore e
  -- flag della sequenza post-prova (extra/recap) ripartono da zero.
  if v_anno is null or v_anno <> v_anno_scolastico then
    v_usate := 0;
    update public.profiles
       set notifiche_usate          = 0,
           notifiche_anno           = v_anno_scolastico,
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

  -- BASE → limite di 3 notifiche per ANNO SCOLASTICO
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
  'Notifiche usate nell anno scolastico corrente (base: max 3 per anno scolastico; pro: illimitato)';

comment on column public.profiles.notifiche_anno is
  'Anno di inizio dell anno scolastico di riferimento del contatore (es. 2026 = anno scolastico 2026-2027); reset automatico ogni 1 settembre';

comment on column public.profiles.notifiche_blocco_inviato is
  'Reset a ogni anno scolastico (1 settembre): la sequenza extra/recap riparte con il nuovo anno';

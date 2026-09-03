-- ============================================================
-- FREE FOREVER — BYPASS SERVER-SIDE (RPC + cron scadenza)
--  1. incrementa_notifiche_utente: free_forever => sempre consentito
--     (nessun contatore di prova, come per PRO).
--  2. invia_avvisi_scadenza_abbonamento: esclude chiunque abbia
--     is_free_forever = true dagli avvisi di scadenza/downgrade.
-- Il cron pg_cron non va rischedulato: punta alle funzioni per nome.
-- APPLICAZIONE: SQL Editor Supabase (project gwdmsgsshvdnfrplbjiv).
-- ============================================================

-- 1. RPC contatore notifiche: PRO + Free Forever illimitati.
create or replace function public.incrementa_notifiche_utente(p_user_id uuid)
returns table (consentito boolean, notifiche_usate integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_piano text;
  v_usate integer;
  v_free_forever boolean;
begin
  -- Guardia condizionale: i client autenticati possono operare solo sul
  -- proprio profilo; il server (service_role, auth.uid() = NULL) passa.
  if auth.uid() is not null and auth.uid() <> p_user_id then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- Lettura con lock di riga: blocca le race condition tra chiamate
  -- concorrenti sullo stesso utente (es. notifiche in parallelo).
  select piano, notifiche_usate, is_free_forever
    into v_piano, v_usate, v_free_forever
    from public.profiles
   where id = p_user_id
     for update;

  -- Utente inesistente
  if v_piano is null then
    return query select false::boolean, 0::integer;
    return;
  end if;

  -- PRO o FREE FOREVER → consentito sempre (incrementa il contatore usato).
  if v_free_forever or v_piano in ('pro', 'free_forever') then
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
  'Notifiche usate (base: max 3 totali; pro/free_forever: illimitato)';

-- 2. Avvisi automatici di scadenza abbonamento: esclusione Free Forever.
create or replace function public.invia_avvisi_scadenza_abbonamento()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
  v_count integer := 0;
  v_user record;
begin
  select value into v_url from public.app_settings where key = 'send_notification_url';
  select value into v_secret from public.app_settings where key = 'send_notification_secret';
  if v_url is null or v_secret is null then
    raise notice 'app_settings mancanti (send_notification_url / send_notification_secret)';
    return 0;
  end if;

  for v_user in
    select p.id, p.email, p.nome, p.is_beta_tester, p.abbonamento_scade_il, p.scadenza_avviso_stadio
      from public.profiles p
     where p.piano = 'pro'
       and coalesce(p.is_free_forever, false) = false
       and p.abbonamento_scade_il is not null
       and (
         (p.is_beta_tester = true and (
             (p.scadenza_avviso_stadio is null and p.abbonamento_scade_il <= now() + interval '7 days')
          or (p.scadenza_avviso_stadio = 'beta_preavviso' and p.abbonamento_scade_il <= now())
         ))
         or
         (p.is_beta_tester = false and (
             (p.scadenza_avviso_stadio is null and p.abbonamento_scade_il <= now() + interval '7 days')
          or (p.scadenza_avviso_stadio = '7d' and p.abbonamento_scade_il <= now() + interval '3 days')
          or (p.scadenza_avviso_stadio in ('7d','3d') and p.abbonamento_scade_il <= now() + interval '1 day')
          or (p.scadenza_avviso_stadio in ('7d','3d','1d') and p.abbonamento_scade_il <= now())
         ))
       )
  loop

    if v_user.is_beta_tester then
      if v_user.abbonamento_scade_il <= now() then
        -- DAY 0 beta: accesso a vita + email di conferma rinnovo.
        perform net.http_post(
          v_url,
          jsonb_build_object(
            'tipo', 'beta_rinnovo_conferma',
            'userId', v_user.id,
            'email', coalesce(v_user.email, ''),
            'nome', coalesce(v_user.nome, '')
          ),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set abbonamento_scade_il = null,
               beta_rinnovo_email_inviata = true,
               scadenza_avviso_stadio = 'beta_conferma'
         where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio is null then
        -- 7 giorni beta: thank-you "Gratis a Vita" (preavviso).
        perform net.http_post(
          v_url,
          jsonb_build_object(
            'tipo', 'beta_rinnovo_preavviso',
            'userId', v_user.id,
            'email', coalesce(v_user.email, ''),
            'nome', coalesce(v_user.nome, ''),
            'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')
          ),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set scadenza_avviso_stadio = 'beta_preavviso'
         where id = v_user.id;
      end if;
    else
      -- Utente standard (PRO a pagamento).
      if v_user.abbonamento_scade_il <= now() then
        -- DAY 0: avviso finale + downgrade a BASE.
        perform net.http_post(
          v_url,
          jsonb_build_object('tipo', 'scadenza_finale', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, '')),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret)
        );
        update public.profiles
           set piano = 'base',
               scadenza_avviso_stadio = 'finale'
         where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio in ('7d','3d') and v_user.abbonamento_scade_il <= now() + interval '1 day' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_1d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '1d' where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio = '7d' and v_user.abbonamento_scade_il <= now() + interval '3 days' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_3d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '3d' where id = v_user.id;
      elsif v_user.scadenza_avviso_stadio is null and v_user.abbonamento_scade_il <= now() + interval '7 days' then
        perform net.http_post(v_url, jsonb_build_object('tipo', 'scadenza_preavviso_7d', 'userId', v_user.id, 'email', coalesce(v_user.email, ''), 'nome', coalesce(v_user.nome, ''), 'scadenza', to_char(v_user.abbonamento_scade_il, 'DD/MM/YYYY')), '{}'::jsonb, jsonb_build_object('Content-Type', 'application/json', 'x-send-secret', v_secret));
        update public.profiles set scadenza_avviso_stadio = '7d' where id = v_user.id;
      end if;
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.invia_avvisi_scadenza_abbonamento() to postgres;


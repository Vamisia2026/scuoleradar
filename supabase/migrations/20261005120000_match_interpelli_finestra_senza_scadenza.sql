-- ============================================================
-- `match_interpelli` — FINESTRA di validità degli avvisi SENZA scadenza
-- ============================================================
-- Regola di prodotto: un avviso che la fonte pubblica SENZA scadenza esplicita non
-- può restare per sempre fra le opportunità pubbliche. La finestra è di 60 giorni
-- (2 mesi) dalla PUBBLICAZIONE (`interpelli.created_at`), la STESSA soglia usata da
-- bacheca «Radar Live», feed della dashboard e pulizia automatica:
--   · `src/lib/scadenza.ts`            → `GIORNI_FINESTRA_SENZA_SCADENZA`, `eAvvisoVivo`
--   · `radar/flightBoard/filtroAttivi.ts` → filtro PostgREST della bacheca
--   · `src/lib/matchingEngine.ts`      → fallback PostgREST equivalente
--   · `scripts/pulisci-scaduti.ts`     → rimozione delle righe fuori finestra
--
-- Prima di questa migrazione la RPC considerava «attivo» QUALUNQUE avviso con
-- `expiration_date is null`, anche pubblicato anni prima: il feed dell'utente poteva
-- riempirsi di opportunità chiuse. Ora il ramo «senza scadenza» ha la sua finestra.
--
-- Idempotente: `create or replace`, eseguibile più volte senza errori.
-- ============================================================

create or replace function public.match_interpelli(
  p_province text[] default null,
  p_classi text[] default null,
  p_sostegno boolean default true,
  p_limit integer default 100
)
returns setof public.interpelli
language sql
stable
security definer
set search_path = public
as $$
  with richieste as (
    -- Classi richieste, già in forma canonica (una sola volta per codice).
    select distinct public.classe_chiave(c) as k
    from unnest(coalesce(p_classi, '{}'::text[])) as c
  ),
  classi as (
    select k from richieste where k is not null
  ),
  varianti as (
    -- Tutte le forme con cui le fonti scrivono davvero lo stesso codice: il fast
    -- path `&&` (indice GIN) deve poterle intercettare TUTTE.
    select distinct v
    from (
      select k as v from classi
      union all
      select replace(k, '-', '') from classi
      union all
      select split_part(k, '-', 1) || '-' || lpad(split_part(k, '-', 2), 3, '0')
      from classi where k ~ '^[A-Z]{1,2}-[0-9]+$'
      union all
      select split_part(k, '-', 1) || lpad(split_part(k, '-', 2), 3, '0')
      from classi where k ~ '^[A-Z]{1,2}-[0-9]+$'
    ) s
  ),
  filtri as (
    select
      (
        select array_agg(distinct upper(btrim(p)))
        from unnest(coalesce(p_province, '{}'::text[])) as p
        where btrim(p) <> ''
      ) as province,
      (select array_agg(distinct k) from classi) as classi,
      (select array_agg(distinct v) from varianti) as varianti
  )
  select i.*
  from public.interpelli i
  cross join filtri f
  where
    -- PROVINCE: nessun filtro quando la selezione è vuota.
    (f.province is null or upper(btrim(i.province)) = any (f.province))
    -- ATTIVI: scadenza non ancora passata OPPURE senza scadenza ma pubblicato negli
    -- ultimi 60 giorni (giorni di calendario, non «due mesi»). Un avviso senza
    -- scadenza e senza data di pubblicazione utile NON entra.
    and (
      i.expiration_date >= current_date
      or (i.expiration_date is null and i.created_at >= current_date - interval '60 days')
    )
    and (
      f.classi is null
      -- (a) FAST PATH: overlap fra array, servito dall'indice GIN.
      or coalesce(i.class_codes, '{}'::text[]) && coalesce(f.varianti, '{}'::text[])
      -- (b) RAMO TOLLERANTE: la stessa classe in QUALUNQUE formato non previsto.
      or exists (
        select 1
        from unnest(coalesce(i.class_codes, '{}'::text[])) as cc
        where public.classe_chiave(cc) = any (f.classi)
      )
      -- (c) AREA SOSTEGNO: inclusione ESPLICITA e permanente (senza opt-out).
      or (
        coalesce(p_sostegno, false)
        and (
          exists (
            select 1
            from unnest(coalesce(i.class_codes, '{}'::text[])) as sc
            where public.classe_chiave(sc) ~ '^AD([A-Z]{2,3}|[0-9]{2})$'
          )
          or (coalesce(i.title, '') || ' ' || coalesce(i.materia, ''))
             ~* '\y(sostegn|adaa|adee|admm|adss|ad24)'
        )
      )
    )
  order by i.expiration_date asc nulls last, i.created_at desc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 5000));
$$;

comment on function public.match_interpelli(text[], text[], boolean, integer) is
  'Matching Engine del Radar: interpelli ATTIVI (scadenza futura OPPURE senza scadenza ma pubblicati negli ultimi 60 giorni) filtrati per province e classi di concorso (overlap GIN + confronto tollerante), con ramo sostegno esplicito. Stessa semantica di eAvvisoVivo (src/lib/scadenza.ts) e del filtro PostgREST di src/lib/matchingEngine.ts.';

grant execute on function public.match_interpelli(text[], text[], boolean, integer)
  to anon, authenticated, service_role;

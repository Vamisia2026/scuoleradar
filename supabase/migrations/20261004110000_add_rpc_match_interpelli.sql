-- ============================================================
-- `match_interpelli` — Matching Engine NATIVO (RPC PostgreSQL)
-- ============================================================
-- Perché esiste: il matching del Radar deve intercettare i bandi REALI delle
-- province dell'utente (AT, AL, CN, TO e tutte le altre) senza falsi negativi.
-- Fino a oggi il filtro viveva solo lato client (PostgREST): `.in('province')` +
-- `.overlaps('class_codes', varianti)` — corretto, ma con tre limiti:
--   1. le VARIANTI di formato (`A-22` ≡ `A-022` ≡ `A22`) le calcolava il
--      frontend: una fonte che scrive la classe in un modo non previsto non
--      trovava mai il suo utente;
--   2. l'AREA SOSTEGNO non era una condizione della query: restava un filtro in
--      memoria, quindi il primo `limit` poteva tagliare proprio gli avvisi di
--      sostegno prima che il filtro li vedesse;
--   3. la regola «attivo» (scadenza non passata) era un `.or(...)` testuale.
-- Qui la stessa semantica sta nel DATABASE, in una funzione stabile e indicizzata:
--   · `province`    → `= any (p_province)` (array: nessun filtro se vuoto);
--   · `class_codes` → `&&` (GIN `interpelli_class_codes_idx`, fast path) **oppure**
--                     confronto TOLLERANTE in forma canonica (`classe_chiave`);
--   · sostegno      → ramo ESPLICITO (`p_sostegno`): codici `AD…` o titolo/materia
--                     che lo dichiarano — inclusione permanente (policy 04/10/2026);
--   · attivo        → `expiration_date is null or expiration_date >= current_date`.
--
-- Il client la usa per prima (`searchInterpelli` in `src/lib/matchingEngine.ts`) e
-- ricade sulla query PostgREST equivalente se questa migrazione non è applicata:
-- nessun rilascio si rompe, un solo significato di «match».
--
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

-- ---------------------------------------------------------------------------
-- 1 · FORMA CANONICA di un codice di classe di concorso
-- ---------------------------------------------------------------------------
-- Stessa regola di `normalizzaClasse` in `src/lib/matchingEngine.ts`:
--   `A-022` · `A22` · `a 22` · `A_22` · `A.22` · `A - 022`  →  `A-22`
-- I codici a 4 lettere (sostegno/ATA: `ADEE`, `EEEE`, `ADSS`, `AD24`…) restano
-- invariati: la conversione riguarda SOLO il formato «lettera/e + numero».
create or replace function public.classe_chiave(p_codice text)
returns text
language sql
immutable
as $$
  select case
    when c is null then null
    when c ~ '^[A-Z]{1,2}-?0*[0-9]{1,3}$'
      then regexp_replace(c, '^([A-Z]{1,2})-?0*([0-9]{1,3})$', '\1-\2')
    else c
  end
  from (
    select nullif(
      btrim(
        regexp_replace(
          regexp_replace(upper(btrim(coalesce(p_codice, ''))), '[^A-Z0-9]+', '-', 'g'),
          '-{2,}', '-', 'g'
        ),
        '-'
      ),
      ''
    ) as c
  ) t;
$$;

comment on function public.classe_chiave(text) is
  'Forma canonica di un codice di classe di concorso (A-022 ≡ A22 ≡ A-22 → A-22); i codici a 4 lettere restano invariati.';

-- ---------------------------------------------------------------------------
-- 2 · MATCHING ENGINE nativo
-- ---------------------------------------------------------------------------
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
    -- path `&&` (indice GIN) deve poterle intercettare TUTTE, altrimenti l'avviso
    -- resta invisibile a chi ha quella classe in catalogo.
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
    -- ATTIVI: senza scadenza = attivo (una scadenza assente non è una prova di chiusura).
    and (i.expiration_date is null or i.expiration_date >= current_date)
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
  'Matching Engine del Radar: interpelli ATTIVI filtrati per province (array) e classi di concorso (overlap GIN + confronto tollerante dei formati), con ramo sostegno esplicito. Stessa semantica del filtro PostgREST di src/lib/matchingEngine.ts.';

-- Gli interpelli sono dati pubblici (policy `read interpelli`): la funzione legge
-- solo quella tabella e non espone nulla oltre a ciò che l'anon può già leggere.
grant execute on function public.classe_chiave(text) to anon, authenticated, service_role;
grant execute on function public.match_interpelli(text[], text[], boolean, integer)
  to anon, authenticated, service_role;


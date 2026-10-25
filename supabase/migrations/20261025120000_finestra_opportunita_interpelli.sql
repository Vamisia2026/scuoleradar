-- ============================================================
-- `interpelli` — FINESTRA DI CANDIDATURA di 15 giorni: marcatura, gate e pulizia segnaposto
-- ============================================================
-- Direttiva 25/10/2026 (§26.82/§26.83). Regola di prodotto: un avviso è
-- un'OPPORTUNITÀ solo con una scadenza dichiarata, non ancora passata e entro
-- l'orizzonte di 15 giorni (`GIORNI_ORIZZONTE_OPPORTUNITA`, `src/lib/scadenza.ts`).
-- Oltre quell'orizzonte la data non è un termine di candidatura: è la FINE di un
-- incarico («supplenza dal 23/10/2026 al 30/06/2027»), l'avvio di un progetto o
-- la chiusura dell'anno scolastico.
--
-- MISURA sul progetto di produzione (25/10/2026, prima di questa migrazione):
--   · `interpelli`: 575 righe;
--   · RPC `match_interpelli` (il feed della dashboard): consegnava TUTTE le 575
--     righe — 135 con scadenza (5 oltre i 15 giorni) e 440 SENZA scadenza, che
--     entravano dal ramo «senza scadenza ma pubblicato negli ultimi 60 giorni»
--     (§26.75). Dopo: 130 righe, cioè solo le opportunità dentro la finestra;
--   · `school_name`: 312 righe già NULL, 0 con il segnaposto «SCUOLA NON
--     SPECIFICATA» / «PIÙ PLESSI» (il residuo storico è stato azzerato in una
--     sessione precedente: l'istruzione resta perché è idempotente e perché le
--     righe che arriveranno devono essere ripulite allo stesso modo).
--
-- COSA FA (IDEMPOTENTE, rieseguibile senza errori):
--   1. aggiunge il marcatore `fuori_finestra` (+ `finestra_verificata_at`) e un
--      indice parziale per contare le righe fuori finestra;
--   2. definisce la regola in SQL — `giorni_orizzonte_opportunita()` e
--      `in_finestra_opportunita()` — con lo stesso verdetto di
--      `eOpportunitaConScadenza`: senza data / data illeggibile / passata /
--      oltre l'orizzonte = NON opportunità;
--   3. SANIFICA i dati esistenti: marca `fuori_finestra = true` (e riallinea a
--      `false` chi è rientrato in finestra), azzera i `school_name` con il
--      segnaposto residuo;
--   4. tiene il marcatore onesto: trigger su INSERT/UPDATE di `expiration_date`
--      (ingestione) + refresh giornaliero `aggiorna_finestra_interpelli()` via
--      pg_cron (le righe che rientrano in finestra col passare dei giorni);
--   5. chiude il GATE della RPC `match_interpelli`: via il ramo dei 60 giorni,
--      dentro la finestra dei 15. Il marcatore NON è il gate: è una fotografia
--      del giorno, e una fotografia non può decidere di un confine che si muove.
--      Il verdetto è sempre `in_finestra_opportunita(expiration_date)`.
--
-- Verifica dopo l'applicazione: `npm run db:sanifica` (dry-run, atteso
-- «fuori finestra: 445» e «nomi con segnaposto: 0») · `npm run db:verifica-interpelli`.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Marcatore della finestra
-- ------------------------------------------------------------
alter table public.interpelli
  add column if not exists fuori_finestra boolean not null default false;

alter table public.interpelli
  add column if not exists finestra_verificata_at timestamptz;

comment on column public.interpelli.fuori_finestra is
  'True = la `expiration_date` non è un termine di candidatura (assente, illeggibile, passata o oltre i 15 giorni): la riga NON è un''opportunità e resta fuori dal feed. Fotografia del giorno, aggiornata dal trigger di ingestione e da `aggiorna_finestra_interpelli()`; il verdetto autorevole resta `in_finestra_opportunita(expiration_date)`.';
comment on column public.interpelli.finestra_verificata_at is
  'Quando `fuori_finestra` è stato calcolato l''ultima volta (data della VERIFICA, non della scadenza).';

-- Indice PARZIALE: serve a contare e a elencare le righe fuori finestra senza
-- scorrere la tabella. Il feed non lo usa (filtra per data, indice esistente).
create index if not exists interpelli_fuori_finestra_idx
  on public.interpelli (expiration_date)
  where fuori_finestra;

-- ------------------------------------------------------------
-- 2) La regola, in un solo punto (gemella di `src/lib/scadenza.ts`)
-- ------------------------------------------------------------
create or replace function public.giorni_orizzonte_opportunita()
returns integer
language sql
immutable
as $$
  select 15;
$$;

comment on function public.giorni_orizzonte_opportunita() is
  'Orizzonte di candidatura in giorni: gemello SQL di GIORNI_ORIZZONTE_OPPORTUNITA (src/lib/scadenza.ts). Se cambia uno, cambia l''altro.';

create or replace function public.in_finestra_opportunita(
  p_scadenza timestamptz,
  p_oggi date default current_date
)
returns boolean
language sql
stable
as $$
  select p_scadenza is not null
     and p_scadenza::date >= p_oggi
     and p_scadenza::date <= p_oggi + public.giorni_orizzonte_opportunita();
$$;

comment on function public.in_finestra_opportunita(timestamptz, date) is
  'Verdetto UNICO dell''opportunità: scadenza dichiarata, non ancora passata e non oltre l''orizzonte di 15 giorni. Stessa semantica di eOpportunitaConScadenza (src/lib/scadenza.ts) e del filtro PostgREST di radar/flightBoard/filtroAttivi.ts.';

-- ------------------------------------------------------------
-- 3) Refresh del marcatore (una definizione, due chiamanti: migrazione e cron)
-- ------------------------------------------------------------
-- Tocca SOLO le righe il cui marcatore è sbagliato (`is distinct from`): il
-- refresh giornaliero costa zero quando niente è cambiato, e la migrazione è
-- idempotente. Restituisce quante righe ha marcato fuori e quante ha rimesso in
-- finestra, così chi chiama può dire cosa è successo senza indovinare.
create or replace function public.aggiorna_finestra_interpelli()
returns table (marcate_fuori integer, rimesse_dentro integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fuori integer := 0;
  v_dentro integer := 0;
begin
  with cambiate as (
    update public.interpelli i
       set fuori_finestra = not public.in_finestra_opportunita(i.expiration_date),
           finestra_verificata_at = now()
     where i.fuori_finestra is distinct from
           not public.in_finestra_opportunita(i.expiration_date)
    returning i.fuori_finestra as fuori
  )
  select count(*) filter (where fuori), count(*) filter (where not fuori)
    into v_fuori, v_dentro
    from cambiate;

  return query select v_fuori, v_dentro;
end $$;

comment on function public.aggiorna_finestra_interpelli() is
  'Riallinea `interpelli.fuori_finestra` alla finestra di 15 giorni: marca fuori chi è uscito e rimette dentro chi è rientrato (una scadenza a 20 giorni diventa opportunità fra 5 giorni). Idempotente; schedulata ogni notte da pg_cron.';

-- ------------------------------------------------------------
-- 4) SANIFICAZIONE dei dati esistenti
-- ------------------------------------------------------------
-- 4a) Finestra: 445 righe fuori (440 senza scadenza, 5 oltre i 15 giorni) e
--     130 dentro, al 25/10/2026. Nessuna riga viene cancellata: il marcatore
--     dichiara lo stato, la riga resta consultabile.
do $$
declare
  esito record;
begin
  select * into esito from public.aggiorna_finestra_interpelli();
  raise notice
    'interpelli: % righe marcate FUORI FINESTRA, % rimesse dentro la finestra.',
    esito.marcate_fuori, esito.rimesse_dentro;
end $$;

-- 4b) Segnaposto del nome: «SCUOLA NON SPECIFICATA» / «PIÙ PLESSI» (in qualunque
--     combinazione di maiuscole, accenti e separatori) non è una denominazione,
--     è la dichiarazione di un dato mancante (§26.77) → NULL. Il tabellone ricade
--     sul nome ricavato dal titolo (`lib/liveBoard`), che è informazione vera.
comment on column public.interpelli.school_name is
  'Denominazione della scuola che ha pubblicato l''avviso, oppure NULL quando il dato manca. MAI un segnaposto: «SCUOLA NON SPECIFICATA» / «PIÙ PLESSI» è una dichiarazione di dato mancante e viene azzerata (§26.77).';

do $$
declare
  azzerati integer := 0;
begin
  update public.interpelli
     set school_name = null
   where school_name ~* 'scuola\s+non\s+specificat[oa]|pi[uù]\s*[''’]?\s*plessi';
  get diagnostics azzerati = row_count;

  raise notice 'interpelli: % school_name con segnaposto riportati a NULL.', azzerati;
end $$;

-- ------------------------------------------------------------
-- 5) Trigger di ingestione: il marcatore nasce giusto, non si rincorre
-- ------------------------------------------------------------
create or replace function public.marca_finestra_interpello()
returns trigger
language plpgsql
as $$
begin
  new.fuori_finestra := not public.in_finestra_opportunita(new.expiration_date);
  new.finestra_verificata_at := now();
  return new;
end $$;

drop trigger if exists trg_marca_finestra on public.interpelli;
create trigger trg_marca_finestra
  before insert or update of expiration_date on public.interpelli
  for each row
  execute function public.marca_finestra_interpello();

-- ------------------------------------------------------------
-- 6) Refresh notturno (pg_cron): il confine si muove anche senza scritture
-- ------------------------------------------------------------
-- La finestra è relativa a `current_date`: una scadenza a 20 giorni diventa
-- opportunità quando ne mancano 15, e un'opportunità esce quando scade. Senza
-- questo job il marcatore invecchierebbe; il GATE della RPC non ne dipende.
do $mig$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'finestra-opportunita-interpelli') then
      perform cron.unschedule('finestra-opportunita-interpelli');
    end if;
    perform cron.schedule(
      'finestra-opportunita-interpelli',
      '20 3 * * *',
      $cron$ select public.aggiorna_finestra_interpelli(); $cron$
    );
    raise notice 'pg_cron: job «finestra-opportunita-interpelli» schedulato alle 03:20.';
  else
    raise notice
      'pg_cron assente: il marcatore si aggiorna al prossimo `npm run db:sanifica -- --apply` (il gate del feed non dipende dal marcatore).';
  end if;
end $mig$;

grant execute on function public.giorni_orizzonte_opportunita()
  to anon, authenticated, service_role;
grant execute on function public.in_finestra_opportunita(timestamptz, date)
  to anon, authenticated, service_role;
grant execute on function public.aggiorna_finestra_interpelli()
  to service_role;

-- ------------------------------------------------------------
-- 7) GATE del feed: `match_interpelli` dentro la finestra dei 15 giorni
-- ------------------------------------------------------------
-- Sostituisce la versione del 05/10/2026 (`..._match_interpelli_finestra_senza_scadenza.sql`).
-- LEVA il ramo «senza scadenza ma pubblicato negli ultimi 60 giorni»: nei dati
-- reali quelle righe sono pagine di archivio, regolamenti e indici di classi di
-- concorso — 440 su 575 al 25/10/2026 — non opportunità di lavoro. Aggiunge il
-- confine superiore (orizzonte di 15 giorni), che mancava: le 5 righe con la
-- scadenza a fine incarico entravano dal ramo `expiration_date >= current_date`.
-- Tutto il resto (province, forme tolleranti delle classi, ramo sostegno
-- esplicito, ordinamento, limiti) resta identico: cambia UNA regola — il «chi è
-- attivo» — e cambia in un punto solo.
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
    -- ATTIVI: il verdetto è UNO e vive in `in_finestra_opportunita` —
    -- scadenza dichiarata, non ancora passata, non oltre l'orizzonte di 15 giorni.
    -- Nessun ramo per le righe senza data: non sono opportunità.
    and public.in_finestra_opportunita(i.expiration_date)
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
  'Matching Engine del Radar: solo interpelli OPPORTUNITÀ (scadenza dichiarata, non passata, entro l''orizzonte di 15 giorni) filtrati per province e classi di concorso (overlap GIN + confronto tollerante), con ramo sostegno esplicito. Stessa semantica di eOpportunitaConScadenza (src/lib/scadenza.ts), di in_finestra_opportunita() e del filtro PostgREST di radar/flightBoard/filtroAttivi.ts.';

grant execute on function public.match_interpelli(text[], text[], boolean, integer)
  to anon, authenticated, service_role;




-- ============================================================
-- `interpelli` — ALLINEAMENTO della SCADENZA alla colonna CANONICA
-- ============================================================
-- Problema (misurato il 15/10/2026 sul progetto di produzione):
--   · `expiration_date` (timestamptz) è la scadenza CANONICA: la leggono la
--     bacheca «Radar Live», il filtro degli avvisi attivi, il matching e le
--     notifiche;
--   · `deadline` (text) è la colonna LEGACY scritta dal vecchio table-reporter,
--     con formati MISTI (`YYYY-MM-DD`, `YY-MM-DD` da un `slice(2,10)`,
--     `DD/MM/YYYY`, `D-M-YYYY`);
--   · su 1.399 righe, 992 avevano la scadenza in `deadline` e `expiration_date`
--     NULLO: in bacheca la colonna «Scadenza» restava vuota e il tabellone
--     mostrava solo la data di pubblicazione.
--
-- Cosa fa (IDEMPOTENTE, eseguibile più volte senza errori):
--   1. normalizza `deadline` in ISO `YYYY-MM-DD` dove il formato è
--      riconoscibile senza ambiguità (misurato: primo gruppo sempre 13-31
--      nelle righe `YY-MM-DD`, quindi anno-troncato, non giorno);
--   2. riempie `expiration_date` dalle righe con `deadline` valida e
--      `expiration_date` NULLO (mezzanotte UTC, come le scadenze reali);
--   3. NON tocca nessun'altra colonna, non cancella e non riscrive una
--      `expiration_date` già valorizzata.
--
-- Un valore non riconoscibile resta com'è: `make_date` rifiuta le date
-- impossibili (31/02) e la riga si conta fra le «scartate». Mai una data
-- indovinata: nei dati pubblici un vuoto dichiarato è meglio di un falso.
--
-- Verifica dopo l'applicazione: `npm run db:verifica-interpelli`
-- (atteso: «RIGHE DA RIPARARE: 0» e nessun formato non ISO).
-- ============================================================

do $$
declare
  ha_deadline boolean;
  riga record;
  pezzi text[];
  data_norm date;
  iso text;
  normalizzate integer := 0;
  riempite integer := 0;
  scartate integer := 0;
begin
  -- La colonna legacy può non esistere (non è nello schema documentato §13.11).
  select exists (
    select 1
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'interpelli'
       and column_name = 'deadline'
  ) into ha_deadline;

  if not ha_deadline then
    raise notice 'interpelli.deadline assente: nessuna scadenza legacy da allineare.';
    return;
  end if;

  for riga in
    select id, deadline, expiration_date
      from public.interpelli
     where deadline is not null
       and (
         expiration_date is null
         or deadline !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       )
  loop
    begin
      data_norm := null;

      if riga.deadline ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        -- 1) già ISO: il cast è STRETTO (una data impossibile solleva un errore).
        data_norm := riga.deadline::date;

      elsif riga.deadline ~ '^[0-9]{2}-[0-9]{2}-[0-9]{2}$' then
        -- 2) anno-troncato dello storico: '26-09-30' = 2026-09-30.
        data_norm := make_date(
          2000 + substring(riga.deadline from 1 for 2)::int,
          substring(riga.deadline from 4 for 2)::int,
          substring(riga.deadline from 7 for 2)::int
        );

      else
        -- 3) giorno-prima: 30/09/2026, 24/9/2026, 21-09-2026, 30.09.2026.
        pezzi := regexp_match(riga.deadline, '^([0-9]{1,2})[/.\-]([0-9]{1,2})[/.\-]([0-9]{4})$');
        if pezzi is not null then
          data_norm := make_date(pezzi[3]::int, pezzi[2]::int, pezzi[1]::int);
        end if;
      end if;

      if data_norm is null then
        scartate := scartate + 1;
      else
        iso := data_norm::text;

        update public.interpelli
           set deadline = iso,
               expiration_date = coalesce(
                 expiration_date,
                 data_norm::timestamp at time zone 'UTC'
               )
         where id = riga.id;

        if riga.deadline is distinct from iso then
          normalizzate := normalizzate + 1;
        end if;
        if riga.expiration_date is null then
          riempite := riempite + 1;
        end if;
      end if;
    exception
      when others then
        -- Formato o data non interpretabili: la riga resta INTATTA.
        scartate := scartate + 1;
    end;
  end loop;

  raise notice
    'interpelli: % scadenze normalizzate, % expiration_date riempite, % valori lasciati intatti.',
    normalizzate, riempite, scartate;
end $$;

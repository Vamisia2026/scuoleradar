-- ============================================================
-- `interpelli.stato_arricchimento` — anagrafica COMPLETA o PARZIALE
-- ============================================================
-- Perché esiste: l'arricchimento dall'anagrafica nazionale (file SCUANAGRAFE,
-- `src/lib/anagraficaScuole.ts`) non riesce SEMPRE: molte fonti pubblicano solo un
-- titolo, senza codice meccanografico né denominazione dell'istituto. Regola di
-- prodotto (direttiva 04/10/2026, §26.47): un avviso genuino NON si scarta e NON
-- si nasconde mai per un'anagrafica incompleta (caso storico: i 10 annunci di
-- Padova). La riga entra comunque in `interpelli` e in vetrina; questa colonna
-- dice all'interfaccia quanto è (in)completa, così può dichiarare gentilmente
-- «anagrafica in aggiornamento» accanto al nome.
--
--   · 'completo' → l'istituto è identificato (denominazione presentabile o codice
--                  meccanografico valido) E c'è un recapito di candidatura
--                  (`contact_email` o `school_pec`);
--   · 'parziale' → manca uno dei due: la riga resta visibile e notificabile,
--                  semplicemente dichiarata «in via di aggiornamento».
--
-- Idempotente: eseguibile più volte senza errori. La colonna è OPZIONALE e
-- tollerata dallo scraper (`COLONNE_OPZIONALI` in `src/scraper/index.ts`) e da
-- `npm run dati:arricchisci`: se la migrazione non è applicata il payload la
-- perde e nessun inserimento si rompe.
-- ============================================================

alter table if exists public.interpelli
  add column if not exists stato_arricchimento text;

-- Vincolo di dominio sui valori ammessi (`NULL` = riga storica, ammessa).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'interpelli_stato_arricchimento_check'
  ) then
    alter table public.interpelli
      add constraint interpelli_stato_arricchimento_check
      check (
        stato_arricchimento is null
        or stato_arricchimento in ('completo', 'parziale')
      );
  end if;
end $$;

-- BACKFILL delle righe esistenti: completa solo chi ha davvero istituto + recapito.
-- `school_pec` è letta solo se la colonna esiste (migrazione precedente applicata):
-- così questo script non fallisce su una base dati non ancora migrata del tutto.
do $$
declare
  ha_pec boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'interpelli'
      and column_name = 'school_pec'
  ) into ha_pec;

  if ha_pec then
    update public.interpelli
    set stato_arricchimento = case
      when (
        coalesce(nullif(btrim(school_name), ''), nullif(btrim(school_code), '')) is not null
        and (
          nullif(btrim(contact_email), '') is not null
          or nullif(btrim(school_pec), '') is not null
        )
      ) then 'completo'
      else 'parziale'
    end
    where stato_arricchimento is null;
  else
    update public.interpelli
    set stato_arricchimento = case
      when (
        coalesce(nullif(btrim(school_name), ''), nullif(btrim(school_code), '')) is not null
        and nullif(btrim(contact_email), '') is not null
      ) then 'completo'
      else 'parziale'
    end
    where stato_arricchimento is null;
  end if;
end $$;

comment on column public.interpelli.stato_arricchimento is
  'Anagrafica della riga: ''completo'' (istituto identificato + recapito) oppure ''parziale'' (dati grezzi del bando: la riga resta visibile, mai scartata).';

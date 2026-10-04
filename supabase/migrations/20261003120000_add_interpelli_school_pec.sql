-- ============================================================
-- `interpelli.school_pec` — PEC dell'istituto (anagrafica nazionale)
-- ============================================================
-- L'arricchimento dai file SCUANAGRAFE (`src/lib/anagraficaScuole.ts`) recupera,
-- per ogni CODICE MECCANOGRAFICO, il nome reale dell'istituto, la PEO e la PEC.
-- La PEO è il recapito di candidatura e vive in `contact_email`; la PEC sta qui:
-- serve agli atti formali e alla diagnostica, senza mescolare i due canali.
--
-- Colonna OPZIONALE e tollerata: lo scraper (`COLONNE_OPZIONALI` in
-- `src/scraper/index.ts`) e `npm run dati:arricchisci` la tolgono dal payload se
-- la migrazione non è ancora applicata — nessun inserimento si rompe.
-- ============================================================

alter table if exists public.interpelli
  add column if not exists school_pec text;

comment on column public.interpelli.school_pec is
  'PEC dell''istituto dall''anagrafica nazionale (file SCUANAGRAFE), quando disponibile.';

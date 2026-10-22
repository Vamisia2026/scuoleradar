-- ============================================================
-- interpelli — SITO ISTITUZIONALE dell'istituto (`SITOWEBSCUOLA`)
-- Direttiva cliente 22/10/2026: la bacheca «Radar Live» non deve MAI
-- portare a un portale privato (Argo, Spaggiari/Nuvola, Madisoft).
-- Quel link non serve un avviso pubblico: apre una pagina di login.
--
--   · school_site → HOST del sito dichiarato dall'anagrafica MIM
--                   (es. `www.iccarducci.edu.it`), senza schema né percorso.
--                   Lo riempie l'enrichment (`npm run db:arricchisci`) e lo
--                   scrive anche lo scraper quando il sito è già noto.
--
-- La sostituzione del link avviene in lettura (`flightBoard/linkFonte.ts`):
-- COALESCE(`${scheme}//${school_site}`, home .edu.it della PEO/PEC), così
-- nessuna riga storica resta con un link a un portale privato.
-- Idempotente: eseguibile più volte senza errori.
-- ============================================================

alter table public.interpelli
  add column if not exists school_site text;

comment on column public.interpelli.school_site is
  'Host del sito istituzionale dell''istituto (anagrafica MIM, SITOWEBSCUOLA), senza schema: fallback .edu.it dei link di piattaforma privata (Argo/Spaggiari/Nuvola).';

-- Il tabellone filtra le righe con `school_site is null` per sapere quali
-- arricchire ancora: l'indice parziale tiene leggera la scansione.
create index if not exists interpelli_school_site_mancante_idx
  on public.interpelli (id)
  where school_site is null;

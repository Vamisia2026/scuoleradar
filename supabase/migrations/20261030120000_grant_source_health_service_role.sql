-- ============================================================
-- `source_health`: i PERMESSI SQL mancanti — errore 42501 (§26.117)
--
-- Sintomo misurato il 30/10/2026, con la CHIAVE GIUSTA in `.env`
-- (`SUPABASE_SERVICE_ROLE_KEY`, ruolo `service_role` verificato nel JWT):
--
--   GET /rest/v1/source_health      → 403
--   {"code":"42501","message":"permission denied for table source_health",
--    "hint":"Grant the required privileges to the current role with:
--            GRANT SELECT ON public.source_health TO service_role;"}
--
--   GET /rest/v1/scan_targets       → 200
--   GET /rest/v1/discovered_links   → 200
--   GET /rest/v1/interpelli         → 200
--
-- Cioè: non era una chiave sbagliata, non era RLS. La tabella esiste, la policy
-- `service_role_full_access` esiste — manca il GRANT. RLS e GRANT sono due
-- cancelli DIVERSI: la policy decide quali RIGHE vede un ruolo, il privilegio
-- decide se il ruolo può toccare la tabella. `20261023120000_create_source_health.sql`
-- crea la tabella e la policy ma non concede i privilegi, e in questo progetto
-- (creazione fuori dai default privileges di Supabase) il ruolo `service_role`
-- resta senza tabelle.
--
-- Effetto dell'assenza: la telemetria delle fonti è cieca. `recordSourceRun`
-- non lancia (per scelta: la scansione non si ferma per un guasto di
-- telemetria), quindi il giro funziona ma nessuna fonte viene mai isolata e i
-- contatori non esistono. Il runner lo dichiara con un avviso per URL:
-- «⚠ telemetria fonti: source_health non scrivibile (…)».
--
-- Sicurezza invariata: `service_role` è l'unico ruolo autorizzato (il browser
-- usa `anon`, che resta fuori — la policy RLS non lo prevede e qui non si
-- concede nulla). Idempotente: `grant` è ripetibile senza errori.
-- ============================================================

-- 1) Schema: serve il diritto d'uso perché i GRANT sulle tabelle abbiano effetto.
grant usage on schema public to service_role;

-- 2) Tabella di servizio: SOLO `service_role`, nessun accesso da `anon` né da
--    `authenticated` (stesso perimetro di `scan_targets` e `notification_queue`).
grant select, insert, update, delete on public.source_health to service_role;

-- 3) Le sequenze non servono (`source_url` è la chiave naturale, nessun
--    `serial`), ma il default privilege evita che una colonna nuova con
--    `nextval` riapra lo stesso buco.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

-- Diagnosi rapida (da eseguire a mano dopo un sospetto «permission denied»):
--   select has_table_privilege('service_role', 'public.source_health', 'select') as legge,
--          has_table_privilege('service_role', 'public.source_health', 'insert') as scrive;

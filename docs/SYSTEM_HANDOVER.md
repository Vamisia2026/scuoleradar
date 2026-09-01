# ScuoleRadar.it — Technical Knowledge Base & Handover Document (Ultimate Reference)

> **Scopo**: blueprint totale del sistema — ogni file, componente, struttura dati, RPC,
> Edge Function, scraper, flusso di autenticazione, drip notifiche, schema DB e configurazione
> di deploy è documentato in modo esplicito per futuri sviluppatori e agenti AI.
>
> **Repo**: `ScuoleRadar_app/project` · **Dominio prod**: https://scuoleradar.it
> **Progetto Supabase**: `gwdmsgsshvdnfrplbjiv` (URL `https://gwdmsgsshvdnfrplbjiv.supabase.co`)
> **GitHub**: `Vamisia2026/scuoleradar` · **Branch prod**: `main` (Vercel auto-deploy)
> **Ultimo aggiornamento**: 2026-08-31

---

## Indice

0. Quick Start
1. Architettura & Tech Stack
2. Directory & File Map (ogni file)
3. Stato globale & Data Models TypeScript
4. Flusso di Autenticazione
5. Radar Scuole / Interpelli (deep)
6. Notifiche & Drip Freemium (deep)
7. Modulistica & Archivista Capo (deep)
8. Check CFU & CV Builder
9. Blog Notizie (cron + editorial gate)
10. PureFocus, Assistente AI & pagine vetrina
11. Programma Referral & Codici Promo
12. Billing & Stripe (checkout + webhook)
13. Database Schema completo (tabelle, indici, trigger, RLS, vincoli)
14. RPC functions complete
15. Edge Functions complete (contratti payload)
16. Routes, Endpoints & API
17. Ambiente & Secrets (env, GitHub, Supabase)
18. Script npm, CI, Vercel
19. Moduli bloccati (LOCKED_MODULES)
20. Stato attuale & note operative

---

## 0. Quick Start

```bash
cd ScuoleRadar_app/project
npm install            # dipendenze (React, Vite, Tailwind, supabase-js, resend, cheerio…)
npm run dev            # dev server Vite → http://localhost:5174 (porta FISSA, strictPort)
npm run typecheck      # tsc --noEmit -p tsconfig.app.json (frontend)
npm run scrape:check   # tsc -p tsconfig.scraper.json (pipeline interpelli + notifier)
npm run scrape:notizie:check  # tsc -p tsconfig.notizie.json (pipeline notizie)
npm run build          # vite build (produzione SPA)
npm run scrape -- --dry-run          # scraper interpelli senza scrivere
npm run scrape:notizie -- --dry-run  # ingest notizie senza scrivere
```

Senza `.env` configurato l'app gira in **modalità demo** (`supabase === null`): auth locale
su localStorage, feed mock (`src/data/interpelli.ts`), nessuna Edge Function. Per attivare
Supabase servono `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (vedi §17).

---

## 1. Architettura & Tech Stack

### 1.1 Visione d'insieme

- **SPA** React 18.3 + Vite 5.4 + TypeScript 5.5, deployata su **Vercel** con rewrite SPA
  (`vercel.json`: `/(.*)` → `/index.html`).
- **Backend**: Supabase — Auth (email/Google/One Tap), Postgres (24 migrations), 8 **Edge
  Functions Deno**, pg_cron (3 job), RLS.
- **Notifiche**: Resend (email) + Bot Telegram `@ScuoleRadar_bot`; orchestrazione nel
  `notifier` Node (scraper) e nel DB (trigger + cron → Edge `send-notification`).
- **AI**: DeepSeek (`deepseek-chat`) per la generazione modulistica (Edge `genera-modulo`),
  con **cache** su `generated_modules` (impronta SHA-256 → costo API zero).
- **Pagamenti**: Stripe Checkout (Edge `checkout`) + Webhook (`webhook`), referral con
  coupon -10€, crediti a consumo, PRO 49€/anno, beta tester "PRO a vita".
- **Scraping**: Node (`axios` + `cheerio`), due pipeline GitHub Actions: interpelli
  (3×/giorno Lun–Ven) e notizie (ogni giorno 06:00 UTC).
- **Freemium**: account BASE (3 notifiche/anno scolastico + strumenti base + modulistica
  gratuita), PRO (notifiche illimitate, PDF puliti, Archivista Capo in arrivo a Ottobre),
  crediti a consumo (1€).

### 1.2 Stack dettagliato

| Layer | Tecnologia & versione |
|---|---|
| UI | React 18.3.1, react-dom, lucide-react 0.446 |
| Router | react-router-dom 6.30 (`BrowserRouter`, `Routes`, `NavLink`) |
| Build | Vite 5.4.2, `@vitejs/plugin-react`, alias `@` → `src` |
| Stile | Tailwind CSS 3.4.1 (config in `tailwind.config.js`), autoprefixer, `index.css` |
| Lingua | TypeScript 5.5.3 strict, 3 tsconfig (app/scraper/notizie) |
| Supabase | `@supabase/supabase-js` 2.57.4 (anon nel frontend; service_role nei Node/Deno) |
| Email | `resend` 6.22 (Node-only: `src/lib/resend.ts`) |
| Scraping | `axios` 1.19 + `cheerio` 1.2 (Node-only) |
| Edge Functions | Deno (std 0.224, esm.sh `@supabase/supabase-js@2`, `npm:` in elimina-account) |
| AI | API DeepSeek `https://api.deepseek.com/chat/completions` |
| Stripe | API REST `https://api.stripe.com/v1` (no SDK lato Edge) |
| Dev tooling | tsx 4.23 (script Node), ESLint 9 + typescript-eslint, sharp |

### 1.3 Topologia & data flow

```
Browser (SPA) ──► src/App.tsx ──► BrowserRouter ──► Routes (20 pagine)
     │                  ├─ AppProvider (contexts/AppContext)  ← stato globale
     │                  ├─ AuthModal / VetrinaModal / GoogleOneTap / RadarWizardModal / DevToolbar
     │                  └─ ScrollToTop
     │
     ├──► lib/supabase.ts ──► Supabase (Auth, REST/RPC)
     ├──► modules/modulistica ──► Edge genera-modulo (DeepSeek + cache)
     ├──► lib/matchingEngine + data ──► feed Radar (interpelli)
     ├──► departments/notizie ──► dati ingestiti (file TS) + SEO
     └──► lib/resend|telegram|notifier ──► SOLO Node (scraper)

GitHub Actions (cron):
  scraper.yml        → src/scraper/index.ts → Supabase interpelli → notifier → Resend/Telegram
  scrape-notizie.yml → ingestNotizie.ts → data/notizieIngestite.ts → commit → Vercel

Supabase DB (pg_cron + trigger):
  trigger auth.users → step1 welcome → Edge send-notification
  cron step5-notifiche / scadenza-avvisi-multistep → Edge send-notification → Resend/Telegram
```

### 1.4 Configurazioni di build

- **`vite.config.ts`**: plugin react; alias `@`→`src`; `optimizeDeps.exclude: ['lucide-react']`;
  `server.port: 5174, strictPort: true` (l'app gira SOLO su 5174).
- **`tsconfig.json`** (base) → **`tsconfig.app.json`**: target ES2020, `jsx: react-jsx`,
  `strict`, `noUnusedLocals/Parameters: false`, alias `@/*`→`src/*`, **esclude** i moduli
  Node (`src/scraper`, `newsFetcher`, `ingestNotizie`, `lib/resend|notifier|telegram`).
- **`tsconfig.scraper.json`**: target ES2022, `types: ['node']`, include `src/scraper/**`,
  `lib/resend.ts`, `lib/notifier.ts`, `lib/telegram.ts`, `lib/matchingEngine.ts`.
- **`tsconfig.notizie.json`**: include `departments/notizie/services/*` + `types.ts` +
  `data/notizieIngestite.ts`.
- **`tailwind.config.js`**: token custom — `primary` (#2B6F9E fam.), `secondary` (arancio),
  `accent` (verde), `success/warning/error`, `sky.700=#2B6F9E`, `sky.800=#1E5276`,
  `slate.50=#F4F7F9`; font Inter / Source Serif 4; shadow `card`/`soft`; keyframes
  `fade-in`, `pop`, `pulse-soft`.
- **`postcss.config.js`**: tailwindcss + autoprefixer.
- **`eslint.config.js`**: flat config, typescript-eslint, react-hooks, react-refresh; globals
  browser; sezione separata per `src/scraper/**` con globals node e regole React off.


---

## 2. Directory & File Map (ogni file)

> Nota: `LINES` = righe del file (indicativo); "Node-only" = escluso da tsconfig.app.
> Se un file è **🔒** è registrato in `LOCKED_MODULES.md` (non modificare senza autorizzazione).

### 2.1 Root `project/`

| File | Righe | Responsabilità |
|---|---|---|
| `index.html` | 20 | Entry SPA; title/meta "La piattaforma per gli Scuolatori" (terminologia Radar Scuole); favicon; font Google |
| `package.json` | 52 | Script + dipendenze (§18) |
| `vite.config.ts` | 22 | Porta 5174 strictPort; alias `@`; exclude lucide |
| `tailwind.config.js` | 93+ | Token palette, font, shadow, animazioni (§1.4) |
| `postcss.config.js` | 6 | tailwindcss + autoprefixer |
| `eslint.config.js` | — | Flat config ESLint |
| `vercel.json` | 8 | SPA rewrite `/(.*)` → `/index.html` (fix 404) |
| `tsconfig.json` | — | Base project references |
| `tsconfig.app.json` | — | Frontend (ES2020, jsx, alias, exclude Node-only) |
| `tsconfig.scraper.json` | — | Pipeline scraper + lib Node |
| `tsconfig.notizie.json` | — | Pipeline notizie Node |
| `LOCKED_MODULES.md` | — | Registro moduli bloccati (§19) |
| `.env` / `.env.example` | 58 | Segreti locali / template (§17) |
| `.gitignore` | — | Ignora node_modules, dist, .env, logs |
| `dev-server.log` | — | Log runtime del dev server (non committato) |
| `_edit-resend.ps1` | — | Script temp legacy (copia build) — non usare |

### 2.2 `src/` — entry

| File | Righe | Responsabilità |
|---|---|---|
| `main.tsx` | 10 | `createRoot` + `<App/>` in StrictMode |
| `App.tsx` | 139 | Provider (`AppProvider`, `ToastProvider`), `BrowserRouter`, TUTTE le 20 route (§16), modali globali (`AuthModal`, `VetrinaModal`, `GoogleOneTap`, `RadarWizardModal`, `DevToolbar`), `RequireAuth` guard |
| `index.css` | 45 | `@tailwind`; `body bg-slate-50 text-primary-900`; `.input`; `.finestra-conversazione`; scrollbar custom; focus-ring |

### 2.3 `src/components/` — UI condivisa

| File | Righe | Responsabilità / dipendenze |
|---|---|---|
| `Header.tsx` | 360 | Header sticky 2 livelli: top-bar (logo, link istituzionali, accedi/avatar/profilo, badge PRO/Base), barra strumenti (`strumentiLinks` con emoji, es. 📁 Modulistica), menu mobile. Usa `useApp`, `NavLink`, `CreditiModal` |
| `Modal.tsx` | 64 | Modal riusabile: overlay `bg-primary-900/40`, card `rounded-2xl`, `size sm/md/lg/xl`, `zClass`, prop `cardClassName` (default `bg-white`; es. `bg-slate-50`), Escape/blocco scroll |
| `AuthModal.tsx` 🔒 | 315 | Login/registrazione (Google OAuth + email demo), contesto `'pro'` (checkout ripreso), `useNavigate`. **BLOCCATO** |
| `VetrinaModal.tsx` | — | Modal freemium multi-sezione: radar/cv/cfu/moduli/assistente con CTA di upgrade |
| `AbbonamentoModal.tsx` | 210 | Modal abbonamento: piano PRO annuale/mensile/crediti, promo, `avviaCheckout` |
| `CreditiModal.tsx` | 238 | Acquisto crediti a consumo (quantità), promo referral |
| `ContattiModal.tsx` | 18 | Wrapper `ContactForm` in modal |
| `ContactForm.tsx` | 286 | Form contatti (dipartimento, oggetto, messaggio, allegato base64, honeypot) → Edge `contatto` |
| `RadarWizardModal.tsx` | — | Wizard radar 4 passi (ordini/classi/materie/province), `STORAGE_KEY_RADAR_WIZARD_PENDING`, per anonimi e loggati |
| `SimulatorRadar.tsx` | — | Anteprima feed radar (legge `interpelli` da Supabase, fallback mock) |
| `InterpelloCard.tsx` | 188 | Card singolo interpello: scadenza, provincia, classi, badge "Scuola Preferita", notifica, detail modal |
| `CfuTool.tsx` | 500 | Calcolatore CFU (§8.1) |
| `CvTool.tsx` | 174 | CV Builder (§8.2) |
| `ServiziPaywall.tsx` | — | Paywall condiviso (Base → invita a PRO/registrazione), icona Lock |
| `Pill.tsx` | — | Pill rimovibile (chip selezione) |
| `Toast.tsx` | — | Sistema toast (provider + `useToast`): success/error |
| `GoogleOneTap.tsx` | 11 | Componente renderless → `useGoogleOneTap` |
| `DevToolbar.tsx` | 195 | Solo DEV: badge ⚡, switch stato (guest/base/pro via `simulaStato`), reset dati, porta, health check |
| `HealthCheckModal.tsx` | 121 | Modal diagnostica → `eseguiHealthCheck` |
| `ExperimentalBanner.tsx` | 11 | Banner "in sperimentazione" per feature beta |
| `ScrollToTop.tsx` | — | Scroll-to-top a ogni cambio rotta |
| `InterpelloCard`, `Pill` | — | vedi sopra |

### 2.4 `src/components/profile/`

| File | Responsabilità |
|---|---|
| `ReferralSection.tsx` | Modulo marketing "Invita un Collega": codice personale, link, KPI referrer via `useReferral` |

### 2.5 `src/contexts/`

| File | Righe | Responsabilità |
|---|---|---|
| `AppContext.tsx` | 820 | Stato globale (§3), auth, preferenze, radar, checkout, crediti, vetrina, dev-simulation |

### 2.6 `src/data/` — dati statici

| File | Righe | Contenuto |
|---|---|---|
| `moduli.ts` | 3941 | Catalogo modulistica: 271+ moduli, `macroAree`, `macroAreeModulistica`, `ordineMacroAree`, helper `conAggiuntaInCima`, `getModuliScaricati`, `macroAreaById`; tipo `DocumentoModulistica` |
| `interpelli.ts` | — | Tipo `Interpello` + feed mock (~12 voci demo) per modalità demo |
| `classiConcorso.ts` | — | `ClasseConcorso[]` (A-XX, ADEE, ADSS…) con `ordine`, `materie[]`, `requisitiCfu[]`; helper `classeByCodice` |
| `ordiniMaterie.ts` | 79 | `OrdineScuola` (infanzia/primaria/secondaria1/secondaria2/cpia/serali/pon/ata), `ordiniScuola`, `materie` |
| `province.ts` | 117 | `Provincia[]` (107 province: codice/nome/regione) + `regioni` |
| `servizi.ts` | 99 | Vetrina servizi: `Servizio[]` (slug, emoji, titolo, caratteristiche, destinatari, dashboard, sperimentazione) + `servizioDaSlug` |


### 2.7 `src/lib/` — librerie

| File | Righe | Responsabilità |
|---|---|---|
| `supabase.ts` | 20 | Client Supabase frontend (anon); `supabase === null` in demo; `isSupabaseConfigurato` |
| `matchingEngine.ts` | 183 | Matching Radar + utenti compatibili (§5.2) |
| `resend.ts` | 434 | **Node-only** — email Resend: 8 `TipoMessaggio` (`welcome, prova1, prova2, prova3, extra, recap, welcome_pro, notifica_pro`), SUBJECT, CORPO_MESSAGGI, `TIPI_CON_OPPORTUNITA`, `renderEmailHtml`, `inviaNotificaEmail`, `inviaNotificheInterpello` |
| `telegram.ts` | ~250 | **Node-only** — messaggi Telegram (stessi tipi), `formattaMessaggioTelegram`, `inviaNotificaTelegram`, `getTelegramBotToken` |
| `notifier.ts` | 206 | **Node-only** — orchestratore notifiche: per ogni interpello nuovo trova utenti compatibili, RPC `incrementa_notifiche_utente`, sceglie il tipo (`prova1/2/3`, `extra`, `recap` via cron), invia email+Telegram in parallelo, aggiorna flag `notifiche_blocco_inviato`/`step4_inviata_at` |
| `pricing.ts` | 18 | Piani: `PianoId = 'pro_annuale'|'pro_mensile'|'a_consumo'`; localStorage `STORAGE_KEY_INTENDED_PLAN` |
| `promo.ts` | 34 | `validaPromo(codice, userId)` via RPC `valida_codice_promo`; `SCONTO_PROMO_EUR = 10` |

### 2.8 `src/hooks/`

| File | Responsabilità |
|---|---|
| `useLocalStorage.ts` | `useLocalStorage<T>(key, initial)` con gestione quota errors |
| `useGoogleOneTap.ts` | Carica GSI su entry pages, `signInWithIdToken` con client ID Google; solo se non autenticato |
| `useReferral.ts` | Referral: genera codice fallback client-side (stessa regola trigger), `ReferralStats`, `ReferralEntry`, link `?ref=` |

### 2.9 `src/departments/notizie/` — dipartimento isolato (blog)

| File | Righe | Responsabilità |
|---|---|---|
| `types.ts` | 31 | `NewsArticle` (§3) |
| `index.ts` | — | Barrel exports (componenti + services) |
| `data/notizieSeed.ts` | — | Articoli editoriali seed |
| `data/notizieIngestite.ts` | — | **File GENERATO** dall'ingestione (accumulo, dedupe per id; attualmente 4 articoli) |
| `services/newsFetcher.ts` | ~200 | **Node-only** — fetch fonti ufficiali (MIM, Gazzetta Ufficiale), `parseRss`, `verificaUrlUfficiale` (HEAD→GET), `fetchTesto` |
| `services/relevanceEngine.ts` | ~560 | **Node-only, puro** — regole editoriali (§9) |
| `services/ingestNotizie.ts` | ~130 | **Node-only** — CLI pipeline: raccogli → filtra → tetto 3/settimana → scrive `notizieIngestite.ts` |
| `services/newsService.ts` | ~70 | Frontend: `newsArticles` (seed+ingested, dedupe), `categorieNotizie`, `getNotiziaById`, `formatDataNotizia`, `newsFallback` |
| `components/NotizieHero.tsx` | — | Hero editoriale pagina Notizie + `SeoMeta` |
| `components/NotizieGrid.tsx` | — | Griglia articoli + filtro categoria + CTA radar |
| `components/NotizieDettaglio.tsx` | — | Dettaglio articolo (in sintesi, link PDF, fonte) |
| `components/SeoMeta.tsx` | — | SEO: `document.title`, OG/Twitter meta, JSON-LD NewsArticle |

### 2.10 `src/modules/modulistica/` — dipartimento isolato (modulistica)

| File | Righe | Responsabilità |
|---|---|---|
| `index.ts` | — | Barrel exports (`ModuliModule`, components, creator) |
| `types.ts` | 30 | `VistaModulistica = 'archivio'|'intervista'|'miei'`, `ModuloSalvatoDB`, `VoceModulo` |
| `ModuliModule.tsx` | ~280 | Contenitore: ricerca live, macroaree, archivio, anteprima, teaser Archivista, "I miei Modelli", nota accesso |
| `components/ModuliNavigation.tsx` | 39 | Tab: Esplora archivio / I miei Modelli Scaricati |
| `components/MacroAreaMenu.tsx` | 59 | Schede macroaree (Infanzia, Primaria, Secondaria 1°/2°, Università, Enti, Altro, Sostegno) |
| `components/EsploraArchivio.tsx` | ~200 | Griglia 3×5 sottocategorie con paginazione, doppio click, ricerca |
| `components/RicercaArchivista.tsx` | 64 | Barra ricerca: filtro LIVE catalogo + pulsante teaser Archivista (`FolderSearch`, `bg-sky-700`, badge `bg-[#E67E22]` "Esclusivo PRO") |
| `components/TeaserArchivistaModal.tsx` | 45 | Modale teaser (copy ufficiale §7.5) |
| `components/VetrinaModulistica.tsx` | 70 | Hero per non autenticati (ricerca finta → registrazione) |
| `components/SavedModuli.tsx` | — | Lista "I miei Modelli": ri-scarica, anteprima, rimuovi |
| `creator/cacheService.ts` | 2819 | **Motore**: 60+ tipologie template locali, `cercaDocumento`, `inviaIntervista`, `generaDocumento`, `creaDocumentoLocale`, download registry (§7.2) |
| `creator/pdfGenerator.ts` | ~400 | Layout A4 PDF: logo, footer, numerazione, TOC, `costruisciDocumento` (§7.3) |
| `creator/ArchivistaCapo.tsx` | 425 | Interfaccia "Indovina Chi?" — chat guidata Archivista (§7.5) |
| `creator/PensieriArchivista.tsx` | — | Frasi di recupero durante la generazione |
| `creator/ModuloPreview.tsx` | — | Anteprima documento (print, salva) |
| `creator/ModuleCreatorErrorBoundary.tsx` | — | Error boundary del sotto-modulo creator |


### 2.11 `src/pages/` — 20 pagine

| File | Responsabilità |
|---|---|
| `LandingPage.tsx` | Home pubblica: hero, simulatore radar, servizi, pricing snippet, footer condiviso (`Footer`) |
| `PrezziPage.tsx` 🔒 | Pagina prezzi / offerta PRO + PureFocus. **BLOCCATO** |
| `ChiSiamoPage.tsx` 🔒 | Pagina istituzionale. **BLOCCATO** |
| `FAQPage.tsx` | Domande frequenti (pubblica) |
| `ServiziPage.tsx` | Griglia servizi da `data/servizi.ts` |
| `ServizioPage.tsx` | Dettaglio servizio per slug |
| `ContattiPage.tsx` | Form contatti + info |
| `NotiziePage.tsx` | Wrapper `NotizieHero`+`NotizieGrid` |
| `NotizieDettaglioPage.tsx` | Wrapper `NotizieDettaglio` |
| `AuthCallback.tsx` | Rotta ritorno Google OAuth (scambia code → sessione) |
| `OnboardingPage.tsx` | Wizard onboarding preferenze + collegamento Telegram |
| `DashboardPage.tsx` | `DashboardLayout` (tab + `Outlet`) + `DashboardPage` (Radar Scuole: notifiche restanti, abbonamento, crediti, feed, blacklist) |
| `CvPage.tsx` / `CfuPage.tsx` | Wrapper `CvTool` / `CfuTool` |
| `AssistenteAIPage.tsx` | Chat Assistente Sindacalista (demo simulata, paywall) |
| `ModuliPage.tsx` | Wrapper `ModuliModule` |
| `PureFocusPage.tsx` | Ambiente distrazione-free (focus timer) |
| `ProfiloPage.tsx` | Gestione profilo, preferenze, Telegram, account |
| `InvitaPage.tsx` | Referral (`ReferralSection`) |
| `AdminPage.tsx` | Pannello admin (indirizzi autorizzati): diagnostica, override, statistiche |

### 2.12 `src/scraper/` — Node-only

| File | Righe | Responsabilità |
|---|---|---|
| `index.ts` | 522 | Pipeline scraper interpelli (§5.3): env, province attive da `profiles`, fonti per provincia, dedupe hash_id, upsert `interpelli`/`notices`, notifiche ai nuovi |
| `parser.ts` | 184 | Parser: `rilevaClassi` (regex A-XX/ADEE), `rilevaCategoriaAvviso`, `sembraOpportunita`, `estraiDataScadenza`, `generaHashId` (SHA-256 provincia+title+data), `parseInterpello` |

### 2.13 `src/services/` + `src/types/`

| File | Responsabilità |
|---|---|
| `services/healthCheck.ts` | `eseguiHealthCheck(): Promise<HealthCheckResult[]>` — test DB, auth, env, edge functions, rotte SPA |
| `types/google-one-tap.d.ts` | Tipi GSI (`google.accounts.id`) |
| `vite-env.d.ts` | Tipi import.meta.env |

### 2.14 `supabase/functions/` — 8 Edge Functions (Deno)

| Funzione | Righe | Auth | Scopo / payload |
|---|---|---|---|
| `send-notification` | ~290 | `x-send-secret` | Step drip (step1 welcome, step5 avviso finale), welcome_pro, notifiche beta/rinnovo, scadenza avvisi; payload `{ tipo, userId, email, nome, chatId, titolo, ... }`; invia email Resend + Telegram |
| `genera-modulo` | 1327 | JWT | Azioni `intervista/genera/ricerca/salva/rimuovi/miei`; DeepSeek + cache `generated_modules`; intervista chirurgica con impronta SHA-256 (§7.4) |
| `checkout` | 288 | JWT | Sessione Stripe Checkout; `{ plan, promo?, quantita?, origin }`; valida promo/referral, coupon -10€; ritorna `{ url }` |
| `webhook` | 215 | firma Stripe HMAC | Eventi Stripe → piano pro / crediti / referral; ack sempre 200 |
| `admin` | — | JWT + `ADMIN_EMAILS` | Operazioni admin (es. override piano/crediti, diagnostica) |
| `contatto` | — | pubblico + anti-spam | Form contatti → Resend a `CONTACT_SUPPORT_EMAIL`; honeypot, alfabeti, impronte spam, max 3 link |
| `elimina-account` | 80 | JWT | Cancella utente da `auth.users` via `admin.auth.deleteUser` (cascade su profiles) |
| `telegram-webhook` | 128 | `X-Telegram-Bot-Api-Secret-Token` | `/start <user_id>` → aggiorna `profiles.telegram_chat_id` + conferma |

### 2.15 `supabase/migrations/` — 24 migration (§13 e §14 per dettagli)

Ordine: `20260822010000_add_school_filters` · `...22020000_create_interpelli` ·
`...22030000_create_profiles` · `...22040000_extend_profiles` · `...22050000_add_telegram_chat_id` ·
`...22060000_add_billing_stripe` · `...22070000_add_rpc_incrementa_crediti` ·
`...22100000_add_referrals` · `...25160000_align_profiles_schema` · `...26100000_add_rpc_consuma_credito` ·
`...27100000_create_generated_modules` · `...29000000_add_rpc_notifiche_limite_totale` ·
`...29100000_add_notifiche_blocco_inviato` · `...29110000_add_notifiche_recap_inviato` ·
`...30000000_add_rpc_notifiche_annuali` · `...31010000_fix_rpc_notifiche_ambiguita` ·
`...31030000_add_step5_scheduling` · `...31100000_add_rpc_notifiche_annuali_reset_extra` ·
`...31150000_switch_rpc_notifiche_anno_scolastico` · `...31160000_add_promo_codes_beta` ·
`...31170000_add_beta_tester_retention` · `...31180000_add_scadenza_avvisi_multistep` ·
`...31190000_add_template_versioning` · `...31200000_add_profiles_genere`

### 2.16 `.github/workflows/`, `docs/`, `scripts/`, `public/`

| Percorso | Contenuto |
|---|---|
| `.github/workflows/scraper.yml` | Scraper Interpelli: cron Lun-Ven `0 7,12,15 * * 1-5` + dispatch; secrets SUPABASE_*/RESEND/TELEGRAM; `npm ci` → `scrape:check` → `npm run scrape` |
| `.github/workflows/scrape-notizie.yml` | Scraper Notizie: cron giornaliero `0 6 * * *` + dispatch; `contents: write`; `npm ci` → `scrape:notizie:check` → `npm run scrape:notizie` → commit dati (`[skip ci]`) se cambiati |
| `docs/BLOG_EDITORIAL_GUIDELINES.md` | Regole d'oro del blog: max 3 articoli/settimana, zero rumore, acronimi spiegati |
| `docs/PDF_DESIGN_SYSTEM.md` | Design system PDF (A4, tabelle clean, righe scrittura 24px) |
| `docs/SYSTEM_HANDOVER.md` | QUESTO FILE |
| `scripts/` | Test/utility: `test-pdf-*.ts`, `_validate-modulistica.ts`, `test-telegram.ts`, `test-notifiche.ts`, ecc. |
| `public/` | `logo.png`, `ScuoleRadar Favicon Square.png`, `ScuoleRadar Logo Transparent Full Final.png`, `favicon_old.svg`, `logo_old.png` |


---

## 3. Stato globale & Data Models TypeScript

### 3.1 `AppContext` (`src/contexts/AppContext.tsx`)

Provider unico con **fallback demo** (Supabase null → localStorage). Costanti esportate:
- `LIMITE_NOTIFICHE_PROVA = 3`
- `STORAGE_KEY_RADAR_WIZARD_PENDING = 'sr_wizard_pending'`

Interfacce chiave:

```ts
interface User {
  nome: string; cognome: string; genere?: 'M'|'F'|null; email: string; password: string;
}
interface Preferenze {
  ordini: OrdineScuola[]; classiCodici: string[]; materieId: string[];
  materieCustom: string[]; provinceCodici: string[];
  telegramUsername: string; telegramChatId: string; emailNotifica: string; onboarded: boolean;
  favoriteSchools: string[]; ignoredSchools: string[];
}
interface Esame { id: string; materia: string; cfu: number; settore: string; }
type RuoloSimulato = 'guest' | 'base' | 'pro';   // DevToolbar
```

Stato (`AppState`): `user`, `preferenze`, `notificheUsate`, `abbonato`, `crediti`, `esami[]`,
`interpelliNotificati[]`, `fontiInterpelli` (mock o Supabase), `origineDati: 'mock'|'supabase'`.

Funzioni esposte (tutte nel `AppContextValue`):
`register`, `login`, `logout`, `setPreferenze`, `completaOnboarding`, `incrementaNotifica`,
`avviaCheckout(plan, promo?, quantita?)`, `setEsami`, `interpelliFiltrati` (memo), `loading`,
`supabaseUserId`, `avatarUrl`, `authModalOpen/Mode/Ctx`, `openAuthModal`, `closeAuthModal`,
`radarWizardOpen/openRadarWizard/closeRadarWizard`, `vetrinaAperta/Sezione/openVetrina/closeVetrina`,
`simulaStato`, `resettaTutto`, `salvaProfilo`, `loginConGoogle`, `consumaCredito`.

**Filtro feed Radar** (`interpelliFiltrati`): match per provincia (`provinceCodici`),
ordine (`ordini`), classe (`classiCodici` su `classiCodes` o `classeCodice`), materia
(da `materieId` + `materieCustom` vs `classe.materie`), e **blacklist scuole**
(`ignoredSchools` applicato su `istituto + titolo`).

### 3.2 Altri data models principali

```ts
// src/data/interpelli.ts
interface Interpello {
  id: string; titolo: string; istituto: string;
  provinciaCodice: string; provinciaNome: string; classeCodice: string;
  classiCodes?: string[]; ordine: OrdineScuola; dataScadenza: string;
  descrizione: string; linkFonte: string; compatibilita: number;
}
// src/lib/matchingEngine.ts
interface InterpelloDB { id; hash_id; title; province; class_codes: string[]|null;
  school_name; school_code; source_url; expiration_date; created_at; }
interface UtenteCompatibile { id; email; nome?; province[]; classi[];
  telegramChatId?; piano?; notificheBloccoInviato?; notificheRecapInviato?; }
// src/data/moduli.ts
interface Modulo { id; nome; categoria; macroArea; tipo; descrizione; }
interface ModuloScaricato { id; nome; tipo; scaricatoIl; }
// src/departments/notizie/types.ts
interface NewsArticle { id; title; category; deadline_date; summary_points[3];
  content_html; official_source_url; official_pdf_url; relevance_score; published_at; }
// src/modules/modulistica/types.ts
type VistaModulistica = 'archivio'|'intervista'|'miei';
interface ModuloSalvatoDB { id; module_key; module_source: 'generated'|'catalogo'; title; tipo; created_at; }
```

### 3.3 Chiavi localStorage

| Chiave | Uso |
|---|---|
| `scuoleradar:intended_plan` + `_data` | Piano scelto da anonimo → ripresa checkout dopo login |
| `sr_wizard_pending` | Radar wizard in attesa (anonimo ha cliccato "Attiva il tuo Radar") |
| `scuoleradar:moduli_scaricati` | Storico moduli scaricati (modulistica) |
| altre (onboarding/preferenze demo) | Persistenza modalità demo (senza Supabase) |

---

## 4. Flusso di Autenticazione

1. **AuthModal** (`AuthModal.tsx`, 🔒):
   - **Google**: `loginConGoogle()` → `supabase.auth.signInWithOAuth({ provider:'google' })`
     → redirect a `/auth/callback` (`AuthCallback.tsx`) → sessione → profilo.
   - **Email**: demo (`register/login` localStorage) oppure Supabase `signUp/signInWithPassword`.
   - Contesto `'pro'`: se l'utente stava comprando un piano, dopo il login `avviaCheckout`
     riprende dal piano salvato in `STORAGE_KEY_INTENDED_PLAN`.
2. **Google One Tap** (`GoogleOneTap.tsx` + `hooks/useGoogleOneTap.ts`): su entry pages
   (`/`, `/prezzi`, `/chi-siamo`, `/servizi`, `/notizie`), prompt GSI →
   `supabase.auth.signInWithIdToken({ provider:'google', token })`.
3. **Trigger DB** `trg_auth_users_step1_welcome` (migration `...31030000_add_step5_scheduling`):
   su INSERT in `auth.users` → inserisce `profiles` (piano `base`, email) + chiama Edge
   `send-notification` con `tipo:'step1'` (Email 1 welcome). Vale anche per One Tap.
4. **Onboarding** (`OnboardingPage.tsx`): preferenze Radar + collegamento Telegram
   (deeplink `https://t.me/ScuoleRadar_bot?start=<user_id>`) + `email_notifica`.
5. **`RequireAuth`** (in `App.tsx`): se non autenticato NON redirect — apre `AuthModal`
   e mostra la card "Area riservata" (usato da onboarding, profilo, invita, admin).
6. **Logout**: `logout()` → `supabase.auth.signOut()` + pulizia stato.


---

## 5. Radar Scuole / Interpelli — deep dive

### 5.1 Dati e fonti
- **`src/data/interpelli.ts`**: tipo `Interpello` + feed **mock** demo (~12 voci).
- **`src/data/classiConcorso.ts`**: `ClasseConcorso[]` con `{ codice, denominazione, ordine,
  materie[], requisitiCfu[] }`; `classeByCodice(cod)` per il mapping.
- **`src/data/province.ts`**: 107 province; **`src/data/ordiniMaterie.ts`**: 8 `OrdineScuola`
  (incl. cpia, serali, pon, ata) + `materie`.
- **Fonte reale**: tabella Supabase **`interpelli`** (popolata dallo scraper; fallback legacy
  `notices`; fallback finale mock).

### 5.2 Matching Engine (`src/lib/matchingEngine.ts`)
Modulo puro (client passato come parametro → testabile frontend+Node):
- `searchInterpelli(client, { province?, classi?, limit? })`: query `interpelli` con
  `.in('province', prov)` + `.overlaps('class_codes', classi)` (almeno una classe comune),
  `.order('expiration_date')`, `.limit(100)`.
- `getFeedInterpelli(...)`: mappa righe DB → `Interpello[]` (`mapInterpelloDBToInterpello`).
- `findUtentiCompatibili(client, { province, classi })`: legge **tutti** i `profiles`
  (select dei campi notifica), filtra: email valida **o** Telegram, `province_interesse`
  (o `province_attive`) contiene la provincia, `classi_concorso` interseca le classi.
  Restituisce `UtenteCompatibile[]` con flag `notificheBloccoInviato`/`notificheRecapInviato`.

### 5.3 Scraper interpelli (`src/scraper/index.ts` + `parser.ts`)
Pipeline `npm run scrape` (flags: `--dry-run`, `--fixture`, `--no-email`):
1. `caricaEnv()` (process.loadEnvFile) → `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
2. `ottieniProvinceAttive()`: legge `profiles.province_attive`; fallback
   `SCRAPER_PROVINCE_TEST` (default `MI,TO`).
3. Per ogni provincia: scarica la fonte (pagina regione → post del giorno → interpelli)
   o fixture offline; `parseAvvisi(html, provincia, source)`.
4. **Parser** (`parser.ts`): `rilevaClassi` (regex `\b(?:[A-Z]{1,2}-\d{2,3}|AD(?:[A-Z]{2,3}|\d{2}))\b`),
   `rilevaCategoriaAvviso` (Interpello/PNRR/PON/Esperti…), `estraiDataScadenza`
   (numerica `gg/mm/aaaa` o testuale italiana), `generaHashId(provincia, title, data)`
   = SHA-256 univoco.
5. Dedupe per `hashId`; `verifica` link raggiungibili (HTTP).
6. **Upsert** in `interpelli` (`onConflict: 'hash_id', ignoreDuplicates: true`); se la
   tabella non esiste → fallback `notices`.
7. **Notifiche**: per i soli interpelli NUOVI (`hash_id` non presenti) →
   `notificaNuoviInterpelli()` (§6).

### 5.4 UI / feed / filtri / blacklist
- `DashboardPage.tsx`: header notifiche (3/anno, abbonamento, crediti), feed
  `interpelliFiltrati`, CTA wizard/abbonamento, blacklist scuole.
- `SimulatorRadar.tsx`: anteprima feed (Supabase → mock).
- `RadarWizardModal.tsx`: onboarding 4 passi con `Pill`; persiste `sr_wizard_pending`.
- `InterpelloCard.tsx`: card con scadenza (countdown), classe, provincia, badge
  "Scuola Preferita" (`favoriteSchools`), notifica, detail.
- **Filtri avanzati**: `ignoredSchools` (blacklist) nasconde gli avvisi
  (match su `istituto + titolo`); `favoriteSchools` (whitelist) marca badge prioritario.


---

## 6. Notifiche & Drip Freemium — deep dive

### 6.1 Canali e moduli
- **Email** → Resend (`src/lib/resend.ts`, Node-only): `getResendClient()`,
  `renderEmailHtml(interpello, destinatario, dashboardUrl, tipo)`,
  `inviaNotificaEmail(...)` (soggetto+HTML, tag `project: scuoleradar`),
  `inviaNotificheInterpello(...)` (batch multi-utente).
- **Telegram** → `src/lib/telegram.ts` (Node-only): `formattaMessaggioTelegram(...)`,
  `inviaNotificaTelegram(...)` con parse_mode HTML.
- **Orchestrazione** → `src/lib/notifier.ts`: `notificaNuoviInterpelli(client, nuovi, opts)`
  — non lancia MAI eccezioni; esito `{ inviate, fallite, telegramInviate, telegramFallite }`.

### 6.2 Sequenza drip account BASE (6 email)
| # | Tipo | Quando | Canale d'invio |
|---|---|---|---|
| 1 | `welcome` | Iscrizione | Trigger DB `trg_auth_users_step1_welcome` → Edge `send-notification` (`step1`) |
| 2 | `prova1` | 1ª opportunità pertinente | Scraper → `notifier` → RPC `incrementa_notifiche_utente` (`usate=1`) → Resend/Telegram |
| 3 | `prova2` | 2ª opportunità | `usate=2` |
| 4 | `prova3` | 3ª e ultima opportunità | `usate=3` |
| 5 | `extra` (avviso) | 4ª opportunità in poi, UNA volta | `usate≥3` e `!notifiche_blocco_inviato` → warning "prova finita, passa a PRO" |
| 6 | `recap`/`step5` (avviso finale) | 2 ore dopo l'avviso | pg_cron `step5-notifiche` → `dispatch_step5_due()` → Edge `send-notification` |

Per **PRO**: `welcome_pro` (attivazione) + `notifica_pro` (ogni opportunità, illimitate).

Logica del `notifier` (mappa tipo):
```
consentito === false →
  pro            → 'notifica_pro'
  !bloccoInviato → 'extra'  (+ set notifiche_blocco_inviato=true, step4_inviata_at=now)
  else           → skip (Email 6 arriva dal cron step5)
consentito === true →
  usate===1 → 'prova1' | usate===2 → 'prova2' | usate===3 → 'prova3'
```

### 6.3 RPC contatore `incrementa_notifiche_utente(p_user_id)`
- **BASE**: max **3 per ANNO SCOLASTICO** (1/9–31/8). `notifiche_anno` salva l'anno di
  inizio; al cambio anno → reset contatore + flag extra/recap.
- **PRO**: sempre consentito (contatore incrementato comunque).
- Atomicità: `SELECT … FOR UPDATE`; guardia `auth.uid() IS NULL OR auth.uid() = p_user_id`;
  `security definer` con `search_path = public`. Ritorna `(consentito bool, notifiche_usate int)`.

### 6.4 pg_cron (3 job)
| Job | Cron | Funzione | Azione |
|---|---|---|---|
| `step5-notifiche` | `* * * * *` | `dispatch_step5_due()` | BASE con `step4_inviata_at + 2h <= now` e `step5_inviata=false` → Edge `send-notification` `step5` + flag |
| `scadenza-avvisi-multistep` | `0 9,18 * * *` | `invia_avvisi_scadenza_abbonamento()` | Timeline scadenza PRO: `7d→3d→1d→finale` (standard) / `beta_preavviso→beta_conferma` (beta tester, lifetime al Day 0) |
| `beta-rinnovo-omaggio-vita` | (wrapper) | delega a `invia_avvisi_scadenza_abbonamento` | retro-compatibile |

### 6.5 Copia email/Telegram
`resend.ts`/`telegram.ts` contengono SUBJECT + CORPO per ogni `TipoMessaggio`.
`TIPI_CON_OPPORTUNITA = { prova1, prova2, prova3, notifica_pro }` → includono il blocco
dell'opportunità (titolo + dettagli + link fonte). `extra` e `recap` sono solo testuali.
`classeRilevante()` interseca le classi; `categoriaOpportunita()` deduce
PNRR/PON/POR/Bando Esperti/Interpello dal titolo.


---

## 7. Modulistica & Archivista Capo — deep dive

### 7.1 Catalogo (`src/data/moduli.ts`, ~3941 righe)
- `Modulo[]` = catalogo statico (~271 voci con `id, nome, categoria, macroArea, tipo, descrizione`);
  a cui si aggiungono le macroaree strutturate `macroAreeModulistica` (Infanzia, Primaria,
  Secondaria 1°/2°, Università, Enti, Altro, Sostegno) con `SottoCategoriaModulistica` e
  `DocumentoModulistica`.
- `ordineMacroAree` = ordine di presentazione; `macroAreaById(id)` lookup.
- `conAggiuntaInCima(lista, item, max)` → storico con limite; `getModuliScaricati()` da
  localStorage `scuoleradar:moduli_scaricati`.
- Macroaree legacy: `Tutti, Sostegno & Inclusione, Supplenze e Interpelli, Burocrazia &
  Permessi, Candidature`.

### 7.2 Cache Service (`src/modules/modulistica/creator/cacheService.ts`, 2819 righe)
Client tipizzato dell'Edge `genera-modulo` + motore locale cache-first:
- `cercaDocumento(query)`, `inviaIntervista(query, risposte)`, `generaDocumento(...)`,
  `caricaDocumentoGenerato(id)` — chiamate alla Edge Function.
- **`creaDocumentoLocale(nome, { tipo, ordine })`**: genera localmente senza DeepSeek.
  Contiene ~60 tipologie di template (`pei`, `pdp_dsa`, `pdp_bes`, `verbale_glo`,
  `relazione_finale`, `relazione_finale_inclusione`, `piano_personalizzato_nai`,
  `piano_personalizzato`, `progetto_alfabetizzazione`, `autocertificazione`, `delega_famiglia`,
  `mad`, `supplenza`, `ricorso_reclamo`, `borsa_studio`, …) con **sezioni costruite per
  ordine scolastico** (`costruisciSezioni(famiglia, tipo, ordine)`), incluso il PEI Infanzia
  con i 5 **Campi di Esperienza** (Indicazioni Nazionali 2012).
- `trovaModuloLocale(query)`, `registraDownloadGenerato`, `registraDownloadCatalogo`,
  `rimuoviDownload(moduleKey)`, `elencaDownload()`.
- Tipi: `DocumentoGenerato`, `EsitoRicerca`, `EsitoGenera`, `EsitoIntervista`,
  `PassoIntervista`, `ProfiloIntervista`, `DomandaChiarimento`, `CatalogoSuggerito`.

### 7.3 PDF Generator (`src/modules/modulistica/creator/pdfGenerator.ts`)
- `costruisciDocumento(titolo, contenutoHtml): DocumentoPronto` — wrappa l'HTML in un
  documento A4: logo `LOGO_DOCUMENTO='/logo.png'` (42px), divisore, footer
  "Documento scaricato gratuitamente da ScuoleRadar.it", numerazione `Pagina X di Y`
  (via `@page` margin boxes), indice automatico (TOC) solo per >3 pagine.
- `calcolaLayout(html): 'compatto'|'esteso'`; `stimaPagine(html)` (formula
  `Math.ceil(h2Count)` → elimina pagine bianche); `escapeHtml`.
- CSS dedicato: font Inter/Arial 10.5-11pt, tabelle padding 8px, righe alternate,
  `.righe-scrittura` (24px/6px per le dichiarazioni), `.quadro-descrittivo` (100px box).
  Riferimento: `docs/PDF_DESIGN_SYSTEM.md`.

### 7.4 Edge Function `genera-modulo` (1327 righe)
- Endpoint DeepSeek `https://api.deepseek.com/chat/completions`, model
  `DEEPSEEK_MODEL` (default `deepseek-chat`).
- **Azioni** (body JSON, JWT verificato):
  - `intervista { query, risposte }` → una domanda alla volta; quando il profilo è completo
    risponde `{ esito:'pronto', fingerprint }` e, se in cache, il documento a costo zero.
  - `genera { query, profilo, catalogoId? }` → DeepSeek + cache.
  - `ricerca { query }` → ricerca catalogo + cache (legacy).
  - `salva { module_key, module_source, title, tipo }` → `user_saved_modules`.
  - `rimuovi { module_key }` · `miei` → gestione moduli salvati.
- **Cache**: `generated_modules` chiave = SHA-256 della query normalizzata; `normalizza()`
  (lowercase/trim), `hashQuery()` (WebCrypto SHA-256).
- `CATALOGO` interno: catalogo moduli con `parole` chiave per il matching.
- Auth: `intervista`/`ricerca` accettano anche token anonimi; `genera`/`salva`/`rimuovi`/
  `miei` richiedono utente autenticato (protegge il budget API).
- Secrets: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`.

### 7.5 Archivista Capo (UI)
- `ArchivistaCapo.tsx`: bancone "Indovina Chi?" — **una domanda alla volta** (niente chat
  infinita), opzioni/input libero, stati `attesa/domanda/recupero/pronto/errore`,
  `inviaIntervista`/`generaDocumento` con try/catch robusto (mai stuck busy),
  avviso crediti + VetrinaModal (PRO con 0 crediti ammesso), `PensieriArchivista`.
- **Stato attuale**: in **fase di affinamento**; il flusso completo arriva **a Ottobre per
  utenti PRO**. Il pulsante "Chiedi all'Archivista Capo" apre SOLO la modale teaser
  `TeaserArchivistaModal` (copy: "La ricerca guidata per la tua modulistica scolastica.",
  body senza responsabilità di compilazione, CTA "Ho capito").
- La **ricerca standard è live sul catalogo** (271+ documenti, punteggio + normalizzazione
  accent-insensitive `\p{Diacritic}`).

---

## 8. Check CFU & CV Builder

### 8.1 Calcolatore CFU (`CfuTool.tsx`, 500 righe)
- Preset `TITOLI_STUDIO` (L-19, LM-85, LM-14, …) con `esamiTipici`
  `{ materia, cfu, settore }`.
- Input: esami (materia, CFU, settore SSD). Per ogni `ClasseConcorso` selezionata:
  verifica i `requisitiCfu` per ambito, calcola CFU mancanti, mostra ammissibilità
  indicativa.
- **Paywall**: accesso ai risultati completo solo con account/PRO (`ServiziPaywall`).

### 8.2 CV Builder (`CvTool.tsx`, 174 righe)
- `parseCv(testo)`: split per righe → sezioni riconosciute da keyword regex
  (Esperienze/Formazione/Competenze/Lingue/Contatti/Profilo/Certificazioni/Pubblicazioni).
- Anteprima sezioni + **download PDF**: BASE → watermark "ScuoleRadar.it";
  PRO → PDF pulito senza logo (`abbonato`).


---

## 9. Blog Notizie — cron + editorial gate (deep)

### 9.1 Tipi e dati
- `NewsArticle` (vedi §3). `data/notizieSeed.ts` = seed editoriale;
  `data/notizieIngestite.ts` = **generato** dall'ingestione (accumulo, dedupe per id).
- `newsService.ts` (frontend): `newsArticles = unisciNotizie()` (seed+ingested, Map dedup);
  se entrambi vuoti → `newsFallback` (unico articolo realistico senza date/link inventati).

### 9.2 `newsFetcher.ts` (Node-only)
- Fonti: **MIM** (`https://www.mim.gov.it/...`) + **Gazzetta Ufficiale**
  (`https://www.gazzettaufficiale.it/feed/istruzione`), via RSS o scraping cheerio.
- `fetchTestoConStato(url)` — log HTTP esplicito (`✓ HTTP 200 - url`), nessun silent-fail.
- `parseRss(xml, fonte, baseUrl) → VoceFonte[]`.
- `verificaUrlUfficiale(url)` — STRICT URL INTEGRITY: HEAD, se negato (403/405) → GET;
  accetta solo 200/3xx.

### 9.3 `relevanceEngine.ts` (Node-only, PURO)
- `PAROLE_CATEGORIA` (GPS/Mobilità/Concorsi/Pensioni/Sostegno/Graduatorie/Supplenze/Scuole/PNRR);
- `PAROLE_ACCETTA` (decreto, ordinanza, nota, bando, scadenza, concorso, …);
- `PAROLE_RIFIUTA` (intervista, comunicato stampa, campagna, webinar, mostre, …).
- `valutaRilevanza(voce) → { rilevante, categoria, deadline, motivo }`;
  `classificaCategoria(testo)`; `punteggioRilevanza(categoria, hasDeadline)`;
  `estraiDeadline(testo, oggi)` (date italiane con ordinali `1°luglio` + anno implicito;
  formato numerico `gg/mm/aaaa`).
- **`MAX_ARTICOLI_SETTIMANA = 3`** + `limitaArticoliSettimanali(articoli, oggi, max)`:
  finestra mobile di 7 giorni; se non ci sono provvedimenti vincolanti → **0 articoli**.
- `generaArticoloEditoriale(dati)` (acronimi spiegati, link di approfondimento reali,
  brand ScuoleRadar) + `promptScritturaArticolo`/`promptFiltroLLM`.
- `validaUrlDeepLink`, `èLinkPdf`, `èFonteCanonica`, `articoloValido`.

### 9.4 `ingestNotizie.ts` (CLI)
Pipeline: raccogli voci (fetchTesto) → valuta rilevanza → verifica URL → genera articolo →
tetto settimanale → **accoda a `notizieIngestite.ts`** (scrittura) o `--dry-run`.
Esiti: `✓ HTTP 200 - 0 new posts criteria matched` (file invariato, nessun commit) oppure
`✗ HTTP FAIL` (exit 1 → warning nel workflow).

### 9.5 Automazione (`.github/workflows/scrape-notizie.yml`)
- Cron **ogni giorno 06:00 UTC** + `workflow_dispatch`; `permissions: contents: write`.
- `npm ci` → `npm run scrape:notizie:check` → `npm run scrape:notizie`.
- Se ci sono nuove notizie: commit `notizieIngestite.ts` con messaggio
  `chore(notizie): aggiornamento automatico dati ingestiti [skip ci]` e push → deploy Vercel.
- **Tetto settimanale max 3** prima del salvataggio; "nessun commit" = nessun contenuto
  meritevole (comportamento atteso, non un bug).


---

## 10. PureFocus, Assistente AI & pagine vetrina

### 10.1 PureFocus (`PureFocusPage.tsx`)
Ambiente di lavoro distrazione-free (focus timer), incluso nell'offerta PRO.
Pagine Prezzi/ChiSiamo 🔒 bloccate.

### 10.2 Assistente Sindacalista AI (`AssistenteAIPage.tsx`)
Pagina di **Accesso in Anteprima** (early-access): nessuna chat, nessun robot, nessun disclaimer.
Solo il modulo di interesse — Nome e Cognome, Email, Provincia, Ruolo, Età — con CTA
"Richiedi accesso in anteprima". La richiesta finisce in `localStorage` (`scuoleradar:richiesta_assistente`).
Niente menzioni a ricompense o account PRO gratuiti. Nel header/dashboard compare come tab pulito
"Assistente Sindacalista Virtuale" (niente emoji robot).


### 10.3 Pagine vetrina & servizi
- `servizi.ts` → `Servizio[]` per `ServiziPage`/`ServizioPage` (radar, cv, cfu, assistente, moduli).
- `VetrinaModal` → paywall freemium multi-sezione; `ServiziPaywall` → CTA generico.
- `LandingPage` → hero + `SimulatorRadar` + footer condiviso (`Footer`).

---

## 11. Programma Referral & Codici Promo

### 11.1 Referral (migration `20260822100000_add_referrals.sql`)
- `profiles.referral_code` (univoco case-insensitive, UPPERCASE).
- Trigger `handle_referral_code` → `genera_referral_code(nome, cognome, email)`:
  `NOME+COGNOME` senza spazi (fallback email local-part, fallback `DOCENTE`), suffisso
  numerico su duplicato (`base2`, `base3`…).
- Tabella `referrals`: `{ referrer_id, referred_user_id, discount_applied=10, reward_amount=10,
  status ('pending'|'completed') }` — RLS: il referrer legge solo le proprie righe.

### 11.2 Codici promo (migration `20260831160000_add_promo_codes_beta.sql`)
- Tabella `promo_codes`: `{ codice (unique), tipo ('beta'|'sconto'), percentuale, piano,
  durata ('1anno'|'lifetime'), monouso, usato_da, usato_il, scade_il, attivo }`.
- `valida_codice_promo(p_codice)` → prima `promo_codes` (attivo, non scaduto, non usato),
  poi `profiles.referral_code`; ritorna `(valido, gratuito, referrer_id, codice, sconto,
  piano, durata)`.
- `attiva_codice_promo(p_codice, p_user_id)` → **atomico** (`FOR UPDATE` sul codice):
  porta `piano='pro'` (scadenza = +1 anno se `1anno`, NULL se `lifetime`), segna
  `is_beta_tester=true` se `tipo='beta'`, consuma il codice se monouso.
- Seed demo: `BETA1ANNO`, `BETALIFETIME`.
- Frontend: `promo.ts` → `validaPromo(codice, userId)`; `SCONTO_PROMO_EUR = 10`.

---

## 12. Billing & Stripe

### 12.1 Edge `checkout` (JWT)
- Body `{ plan: 'pro_annuale'|'pro_mensile'|'a_consumo', promo?, quantita?, origin? }`
  (accetta varianti inglesi `pro_annual/pro_monthly/alacarte`).
- Price ID **solo da secrets** (`STRIPE_PRICE_PRO_ANNUALE`, `_MENSILE`, `_A_CONSUMO`);
  mai fidarsi di priceId client.
- Referral: `validaPromo` → coupon `STRIPE_COUPON_REFERRAL_10` su PRO annuale e crediti;
  `metadata[promo]`/`metadata[promo_referrer]` per il webhook.
- `allow_promotion_codes` abilitato SOLO se non c'è coupon automatico (mutualmente esclusivi).
- URL success/cancel dinamici: `origin + /dashboard/radar?esito=successo|annullato`.
- `client_reference_id` e `metadata[user_id]` = userId; `customer_email` se nel JWT.

### 12.2 Edge `webhook` (firma HMAC Stripe)
- Verifica `stripe-signature` (WebCrypto HMAC-SHA256, formato `t=…,v1=…`).
- Eventi:
  - `checkout.session.completed`: `mode=payment` → `+1 credito` (RPC
    `incrementa_crediti_utente`); `mode=subscription` → `piano='pro'` +
    `stripe_subscription_id`; se `metadata.promo_referrer` → `registraReferral(10,10)`.
  - `customer.subscription.created/updated`: piano `pro` se `active|trialing`,
    `abbonamento_scade_il = current_period_end`.
  - `customer.subscription.deleted`: `piano='base'`, reset id/scadenza.
- Sempre `ack` 200 (mai far ritentare Stripe).

### 12.3 Passaggio TEST → LIVE
Tutto è già pronto: il codice legge **solo da secrets** e non cambia tra modalità.
Per passare in produzione basta aggiornare i secrets Supabase (nessun redeploy del codice):
1. `STRIPE_SECRET_KEY` → `sk_live_…` (la modalità viene auto-rilevata dal prefisso `sk_live_`).
2. `STRIPE_PRICE_PRO_ANNUALE`, `STRIPE_PRICE_PRO_MENSILE`, `STRIPE_PRICE_A_CONSUMO` → i Price ID
   dello **Stripe Live** (attenzione: gli ID test e live sono diversi anche per lo stesso prezzo).
3. `STRIPE_WEBHOOK_SECRET` → signing secret dell'endpoint **Live** (endpoint webhook separato).
4. `STRIPE_COUPON_REFERRAL_10` → ID del coupon Live (se si vuole mantenere lo sconto referral -10€).
5. `STRIPE_MODE=live` (facoltativo, esplicito) — il log di avvio di `checkout`/`webhook` riporta la
   modalità; il `ping` di `checkout` restituisce `{ mode, configurato, priceMancanti }` per il check.
6. Verifica con un pagamento reale di prova (es. piano mensile) e controlla i log della Edge Function
   `webhook` (piano=`pro`, scadenza=`current_period_end`).

---

## 13. Database Schema completo (Supabase Postgres)

### 13.1 `public.profiles` (RLS: ogni utente legge/modifica solo il proprio)
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | references `auth.users(id)` ON DELETE CASCADE |
| `email` | text | email account |
| `nome`, `cognome` | text | usati dal trigger referral |
| `genere` | text | `'M'|'F'|NULL` (check `profiles_genere_check`) — declina email (Cara/Caro, stata/stato) |
| `ordini` / `ordini_scuola` | text[] default '{}' | ordini di interesse (legacy / nuovo) |
| `classi_concorso` | text[] | classi di concorso |
| `materie_id` / `materie_custom` | text[] | materie |
| `province_attive` / `province_interesse` | text[] | province (legacy / nuovo) |
| `favorite_schools` / `ignored_schools` | text[] | whitelist / blacklist scuole |
| `telegram_username` | text default '' | — |
| `telegram_chat_id` | text | chat ID bot (webhook /start) |
| `email_notifica` | text default '' | email per le notifiche |
| `onboarded` | boolean default false | onboarding completato |
| `piano` | text default 'base' | check `in ('base','pro')` |
| `stripe_customer_id` | text | unique partial index |
| `stripe_subscription_id` | text | — |
| `abbonamento_scade_il` | timestamptz | NULL = lifetime |
| `crediti` | integer default 0 | check `>= 0` (a consumo) |
| `notifiche_usate` | integer default 0 | check `>= 0` |
| `notifiche_mese` | text | **legacy** (vecchio reset mensile) |
| `notifiche_anno` | integer | anno di inizio anno scolastico del contatore |
| `notifiche_blocco_inviato` | boolean default false | warning extra inviato (una tantum, reset annuale) |
| `notifiche_recap_inviato` | boolean default false | recap finale inviato (una tantum, reset annuale) |
| `step4_inviata_at` | timestamptz | istante invio `extra` (→ cron step5 dopo 2h) |
| `step5_inviata` | boolean default false | step5 inviato |
| `scadenza_avviso_stadio` | text | `7d/3d/1d/finale` o `beta_preavviso/beta_conferma` |
| `moduli_scaricati` | text[] | legacy ids moduli |
| `referral_code` | text | univoco case-insensitive (partial unique index) |
| `master_version` / `template_id` | text | versionamento template (vedi user_saved_modules) |
| `is_beta_tester` | boolean default false | beta tester (PRO a vita) |
| `beta_rinnovo_email_inviata` | boolean default false | email rinnovo omaggio inviata |
| `created_at` / `updated_at` | timestamptz | updated_at via trigger `set_profiles_updated_at` |

Trigger: `set_profiles_updated_at` (before update), `set_referral_code` (before insert/update).

### 13.2 `public.interpelli` (RLS: select a tutti)
`id uuid PK`, `hash_id text unique not null` (SHA-256 provincia+title+data),
`title text not null`, `province text not null`, `class_codes text[] default '{}'`,
`school_name text`, `school_code text`, `source_url text not null`,
`expiration_date timestamptz`, `created_at timestamptz`.
Indici: `interpelli_province_idx` (province), `interpelli_class_codes_idx` (GIN class_codes),
`interpelli_expiration_idx` (expiration_date). Policy "read interpelli" select true.
Legacy `notices` (fallback dello scraper).

### 13.3 `public.generated_modules` (RLS: select a tutti; scrittura service_role)
`id uuid PK`, `query_hash text unique` (SHA-256 normalizzata), `query text`,
`title text`, `content_html text`, `meta jsonb default '{}'`,
`created_at`/`updated_at` (trigger `set_generated_modules_updated_at`).
Indici: query, created_at desc.

### 13.4 `public.user_saved_modules` (RLS: per-utente)
`id uuid PK`, `user_id uuid` → profiles ON DELETE CASCADE,
`module_key text` (`'cat:<id>'` | `'gen:<uuid>'`), `module_source text default 'generated'`,
`title text`, `tipo text default ''`, `created_at`,
`template_id text`, `master_version text` (versionamento, backfill `v2026.1`),
UNIQUE `(user_id, module_key)`. Indice `(user_id, created_at desc)`.


### 13.5 `public.referrals` (RLS: referrer-only)
`id uuid PK`, `referrer_id` → profiles, `referred_user_id` → profiles (set null),
`discount_applied numeric default 10`, `reward_amount numeric default 10`,
`status text default 'pending'` check `('pending','completed')`, `created_at`.

### 13.6 `public.promo_codes` (RLS: nessun accesso client — solo RPC/service_role)
`id uuid PK`, `codice text unique`, `tipo ('beta'|'sconto')`, `percentuale integer (0-100)`,
`piano ('base'|'pro')`, `durata ('1anno'|'lifetime'|NULL)`, `monouso boolean default true`,
`usato_da uuid` → profiles, `usato_il timestamptz`, `scade_il timestamptz`,
`attivo boolean default true`, `creato_il timestamptz`.

### 13.7 `public.app_settings` (KV)
`key text PK`, `value text not null`. Contiene `send_notification_url` e
`send_notification_secret` per le chiamate pg_cron/trigger → Edge Function.

---

## 14. RPC functions (security definer, search_path=public)

| Funzione | Firma | Ritorna | Scopo |
|---|---|---|---|
| `incrementa_notifiche_utente` | `(p_user_id uuid)` | `(consentito bool, notifiche_usate int)` | Contatore 3/anno scolastico BASE; PRO illimitato; FOR UPDATE; reset a settembre + flag extra/recap |
| `consuma_credito_utente` | `(p_user_id uuid)` | `(ok bool, crediti int)` | Decremento atomico crediti se >0 |
| `incrementa_crediti_utente` | `(p_user_id uuid, p_delta int default 1)` | `int` | Incremento crediti (webhook Stripe) |
| `valida_codice_promo` | `(p_codice text)` | `(valido, gratuito, referrer_id, codice, sconto, piano, durata)` | promo_codes prima, poi referral |
| `attiva_codice_promo` | `(p_codice text, p_user_id uuid)` | `(ok bool, errore text)` | Attiva PRO atomico (FOR UPDATE), marca beta tester, consumo monouso |
| `genera_referral_code` | `(nome, cognome, email)` | `text` | Genera codice NOME+COGNOME |
| `handle_referral_code` | trigger | — | Before insert/update su profiles |
| `handle_profiles_updated_at` | trigger | — | updated_at |
| `handle_generated_modules_updated_at` | trigger | — | updated_at |
| `send_step1_welcome` | trigger su auth.users | — | Crea profile + Edge send-notification step1 |
| `dispatch_step5_due` | `()` | `int` | Cron: step5 2h dopo step4 |
| `invia_avvisi_scadenza_abbonamento` | `()` | `int` | Cron: timeline scadenza 7d/3d/1d/finale + beta |
| `beta_rinnovo_omaggio_vita` | `()` | `int` | Wrapper → invia_avvisi_scadenza_abbonamento |


---

## 15. Edge Functions — contratti payload

| Funzione | URL | Payload richiesto | Risposta |
|---|---|---|---|
| `send-notification` | `/functions/v1/send-notification` (header `x-send-secret`) | `{ tipo: 'step1'|'step5'|'welcome_pro'|'notifica_pro'|'beta_rinnovo'|'beta_rinnovo_preavviso'|'beta_rinnovo_conferma'|'scadenza_preavviso_7d'|'scadenza_preavviso_3d'|'scadenza_preavviso_1d'|'scadenza_finale', userId?, email?, nome?, chatId?, titolo?, scuola?, provincia?, classe?, scadenza?, link? }` | `{ ok }` (ping: `{ ok, resend, telegram }`) |
| `genera-modulo` | `/functions/v1/genera-modulo` (JWT) | `{ azione: 'intervista'|'genera'|'ricerca'|'salva'|'rimuovi'|'miei', … }` | `{ esito, messaggio, domanda?, opzioni?, fingerprint?, documento?, moduli? }` |
| `checkout` | `/functions/v1/checkout` (JWT) | `{ plan, promo?, quantita?, origin? }` | `{ url }` |
| `webhook` | `/functions/v1/webhook` (firma Stripe) | evento Stripe raw | `ok` |
| `admin` | `/functions/v1/admin` (JWT + ADMIN_EMAILS) | operazione admin | JSON |
| `contatto` | `/functions/v1/contatto` | `{ email, dipartimento, oggetto?, messaggio, website?, utenteLoggato?, allegato? }` | `{ ok }` |
| `elimina-account` | `/functions/v1/elimina-account` (JWT) | `{}` | `{ ok }` |
| `telegram-webhook` | `/functions/v1/telegram-webhook` (secret header) | update Telegram (message `/start <user_id>`) | `ok` |

### 15.1 Esternalizzazioni (API di terze parti)
- **Supabase Auth/REST/RPC**: URL base progetto + `VITE_SUPABASE_ANON_KEY` (frontend) /
  `SUPABASE_SERVICE_ROLE_KEY` (Node/Deno).
- **Resend**: `POST https://api.resend.com/emails` (Bearer `RESEND_API_KEY`).
- **Telegram Bot API**: `POST https://api.telegram.org/bot<TOKEN>/sendMessage`.
- **DeepSeek**: `POST https://api.deepseek.com/chat/completions` (Bearer `DEEPSEEK_API_KEY`).
- **Stripe API**: `https://api.stripe.com/v1` (Basic `STRIPE_SECRET_KEY`).
- **Google GSI**: `https://accounts.google.com/gsi/client` (One Tap).

---

## 16. Routes, Endpoints & API

### 16.1 Router SPA (`src/App.tsx`)
| Route | Pagina | Accesso |
|---|---|---|
| `/` | LandingPage | pubblico |
| `/prezzi`, `/chi-siamo`, `/faq` | PrezziPage🔒 / ChiSiamoPage🔒 / FAQPage | pubblico |
| `/servizi`, `/servizi/:slug` | ServiziPage / ServizioPage | pubblico |
| `/notizie`, `/notizie/:id` | NotiziePage / NotizieDettaglioPage | pubblico |
| `/contatti` | ContattiPage | pubblico |
| `/auth/callback` | AuthCallback | OAuth |
| `/onboarding` | OnboardingPage | RequireAuth |
| `/dashboard/*` (radar, cv, cfu, assistente-ai, moduli, purefocus) | DashboardLayout | vetrina freemium (anche anonimi) |
| `/dashboard/profilo`, `/dashboard/invita` | ProfiloPage / InvitaPage | RequireAuth |
| `/admin` | AdminPage | RequireAuth |
| `*` | Navigate → `/` | fallback |

### 16.2 Endpoint Supabase (REST/RPC usati dal frontend)
- Letture: `interpelli` (feed), `profiles` (profilo), `user_saved_modules` (moduli salvati),
  `generated_modules` (cache), `referrals` (KPI referrer).
- RPC: `valida_codice_promo`, `attiva_codice_promo`, `consuma_credito_utente`,
  `incrementa_notifiche_utente` (solo service_role lato scraper).
- Auth: `signInWithOAuth`, `signInWithIdToken`, `signUp`, `signInWithPassword`, `signOut`.


---

## 17. Ambiente & Secrets

### 17.1 `.env` locale (frontend + scraper)
| Variabile | Uso |
|---|---|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client frontend (anon) |
| `VITE_STRIPE_PRICE_PRO_ANNUALE` / `_MENSILE` / `_ALACARTE` | Solo debug (source of truth = secrets server) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID Google One Tap |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Scraper Node |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` / `RESEND_DASHBOARD_URL` | Email |
| `TELEGRAM_BOT_TOKEN` | Bot Telegram |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL` | Edge genera-modulo (server) |
| `FONTE_TEST_URL` / `SCRAPER_PROVINCE_TEST` | Scraper test |

### 17.2 Secrets GitHub Actions (`.github/workflows/scraper.yml`)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`.

### 17.3 Secrets Supabase Edge (via `supabase secrets set`)
`STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_ANNUALE`, `STRIPE_PRICE_PRO_MENSILE`,
`STRIPE_PRICE_A_CONSUMO` (fallback `_CONSUMO`, `_ALACARTE`), `STRIPE_COUPON_REFERRAL_10`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE` (test | live, vedi §12.3), `SEND_NOTIFICATION_SECRET`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CONTACT_SUPPORT_EMAIL`, `APP_URL`.

---

## 18. Script npm, CI, Vercel

### 18.1 npm scripts
`dev` (vite 5174), `build`, `lint`, `preview`, `typecheck` (tsc app), `scrape`,
`scrape:check`, `scrape:notizie`, `scrape:notizie:check`, `test:telegram`, `test:notifiche`,
`test:pdf*` (mad/breve/brevi/universita/completo).

### 18.2 CI / cron (GitHub Actions)
- `scraper.yml`: Lun–Ven 07/12/15 UTC → interpelli + notifiche.
- `scrape-notizie.yml`: giornaliero 06:00 UTC → notizie + commit + deploy.
- Commit con `[skip ci]` → nessun loop.

### 18.3 Vercel
- Framework Vite; build `npm run build`; output `dist/`.
- `vercel.json`: rewrite `/(.*)` → `/index.html` (fix 404 per rotte dirette).
- Production branch `main`: ogni push triggera il build.

---

## 19. Moduli bloccati (🔒 LOCKED_MODULES.md)

Non modificare senza autorizzazione esplicita ("Sblocca il modulo X"):
1. `src/components/AuthModal.tsx`
2. `src/pages/ChiSiamoPage.tsx`
3. `src/pages/PrezziPage.tsx`

---

## 20. Stato attuale & note operative

- **Ultimo commit**: `41f3d54` "feat: update drip sequence, fix UI text to Radar Scuole,
  and add system handover report" (6 file: resend/telegram/notifier/index.html/send-notification/handover).
- **Working tree**: modifiche non committate (restyling Archivista Capo, template modulistica,
  token palette, modal). Migrations recenti **staged** (da committare in un commit dedicato).
- **`git stash@{0}`**: WIP precedente (modulistica/Vault/branding) non ripristinato.
- **Notizie**: ultimo contenuto reale ingestito 2026-07-16; il cron produce 0 articoli quando
  non ci sono provvedimenti vincolanti (atteso).
- **Archivista Capo**: teaser PRO a Ottobre; la ricerca resta live sul catalogo.
- **Verifiche**: `npm run typecheck` exit 0; `scrape:check` exit 0; `scrape:notizie:check`
  exit 0; `_validate-modulistica.ts` 60/60 + PEI infanzia PASS.
- **Dev server**: porta fissa 5174.


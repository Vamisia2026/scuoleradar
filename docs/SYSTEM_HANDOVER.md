OK guida-digest OK 6.4-query # ScuoleRadar.it — Technical Knowledge Base & Handover Document (Ultimate Reference)

> **Scopo**: blueprint totale del sistema — ogni file, componente, struttura dati, RPC,
> Edge Function, scraper, flusso di autenticazione, drip notifiche, schema DB e configurazione
> di deploy è documentato in modo esplicito per futuri sviluppatori e agenti AI.
>
> **Repo**: `ScuoleRadar_app/project` · **Dominio prod**: https://scuoleradar.it
> **Progetto Supabase**: `gwdmsgsshvdnfrplbjiv` (URL `https://gwdmsgsshvdnfrplbjiv.supabase.co`)
> **GitHub**: `Vamisia2026/scuoleradar` · **Branch prod**: `main` (Vercel auto-deploy)
> **Ultimo aggiornamento**: 2026-09-21 (sincronizzazione: refactoring modulare,
> contesti splittati, error boundary di dipartimento, standard editoriale stretto delle
> notizie, gate `test:architettura`); 2026-10-02: competenze e parole chiave nel ciclo
> Radar — salvataggio `materie_id`/`materie_custom`, validazione, matching e digest
> (§26.35)

---

## Indice

0. Quick Start
1. Architettura & Tech Stack (**+ §1.5 tassonomia a 5 dipartimenti, §1.6 standard modulare e gate**)
2. Directory & File Map (ogni file)
3. Stato globale & Data Models TypeScript
4. Flusso di Autenticazione
5. Radar Scuole / Interpelli (deep)
6. Notifiche & Drip Freemium (deep)
7. Modulistica & Archivista Capo (deep)
8. Calcolatore CFU & CV Builder
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
21. Pipeline di notifica end-to-end (specifica completa)
22. Error handling, resilienza e anti-silent-fail
23. Confini dei moduli e superfici pubbliche
24. Runbook operativi
25. Invarianti, glossario e mappa di lettura

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
su localStorage, feed vuoto (nessuna voce dimostrativa: `src/data/interpelli.ts` espone
solo il tipo `Interpello` + fallback `interpelli = []`), nessuna Edge Function. Per attivare
Supabase servono `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (vedi §17).

---

## 1. Architettura & Tech Stack

### 1.1 Visione d'insieme

- **SPA** React 18.3 + Vite 5.4 + TypeScript 5.5, deployata su **Vercel** con rewrite SPA
  (`vercel.json`: `/(.*)` → `/index.html`).
- **Backend**: Supabase — Auth (email/Google/One Tap), Postgres (**52 migration**), **10 Edge
  Functions Deno** (+ cartella `_shared`), pg_cron, RLS.
- **Architettura modulare** (§1.5–§1.6): 5 domini verticali isolati in `src/departments/`
  (+ `src/modules/modulistica`), stato globale splittato in `src/contexts/app/*`,
  error boundary per dipartimento; regole e gate in [`MODULAR_ARCHITECTURE.md`](./MODULAR_ARCHITECTURE.md)
  e [`DEPARTMENT_MAP.md`](./DEPARTMENT_MAP.md).
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
Browser (SPA) ──► src/App.tsx ──► BrowserRouter ──► Routes (30 route, 24 pagine)
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
  scraper.yml        → src/scraper/index.ts → Supabase interpelli → canali Telegram (nessun invio personale)
  digest.yml         → notifier: BATCH 17:00 (Telegram) per BASE + riepilogo email per tutti
                       + PROMEMORIA 24h (una sola email per utente, una voce per interpello)
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
- **Favicon & brand asset (radice, non `src/`)**: il set favicon ufficiale è generato da
  `npm run favicon` (`scripts/make-favicons.mjs`) ritagliando la **tessera azzurra**
  dalla grafica originale `public/logo.png` (tessera 181×181, azzurro `#2B6F9E` campionato dal
  marchio) e produce `public/favicon-16.png`, `favicon-32.png`, `favicon-48.png`,
  `favicon-256.png`, `favicon.ico` (multi-misura 16/32/48) e `apple-touch-icon.png`
  (180×180, **opaco**). `index.html` li dichiara con `sizes` esplicite + `theme-color`.
  Guardia: **`npm run test:favicon`** (decodifica i PNG senza dipendenze e verifica
  identità azzurra, radar bianco, misure, peso e assenza di asset legacy/scuri).
  ⚠️ `index.html` e `public/**` **non** passano dal gate di architettura ma finiscono nel
  deploy: una loro modifica **non committata non arriva in produzione** (è la causa della
  favicon scura rimasta online fino al 2026-09-22).
- **`eslint.config.js`**: flat config, typescript-eslint, react-hooks, react-refresh; globals
  browser; sezione separata per `src/scraper/**` con globals node e regole React off.


---

### 1.5 Tassonomia a 5 dipartimenti

| # | Dipartimento (prodotto) | Dove vive nel codice | Entry point |
|---|---|---|---|
| 1 | **Radar Interpelli** | `departments/radar/` + `lib/{matchingEngine,radarValidation,scadenza,interpelloRouting}.ts` + `scraper/` + `lib/{notifier,telegram,resend,digest,dedupAvvisi,frequenzaNotifiche,emailScuola,alertInterpello}.ts` | `RadarWizardModal`, `PreferenzeRadar` |
| 2 | **Notizie & Blog** | `departments/notizie/**` (hero, grid, dettaglio, motore di rilevanza, ingestione, archivio) | `NotizieHero`, `NotizieGrid`, `NotizieDettaglio` |
| 3 | **Modulistica** | `modules/modulistica/**` (catalogo + cache, Archivista Capo, generatore PDF, esplora archivio) | `ModuliModule` |
| 4 | **Formazione & Carriera** | `departments/cfu/**` (calcolatore, engine normativo, dossier, landing) + CV Builder in `components/CvTool.tsx` + `pages/CvPage.tsx` | `CalcolatoreCfuApp`, `CalcolatoreCfuLanding` |
| 5 | **Strumenti & Extra** | PureFocus (`lib/purefocus-bridge.ts`, `pages/PureFocusPage.tsx`), Assistente AI (`pages/AssistenteAIPage.tsx`), billing/piani (`lib/{pricing,abbonamento,planLimits,promo}.ts`, `pages/PrezziPage.tsx`, Edge `checkout`/`webhook`) | pagine pubbliche |
| — | **Scadenze** e **Admin** (domini di codice) | `departments/scadenze/` · `departments/admin/` | `RevolverScadenze` · `TabUtenti`, `TabRadar` |

Dettaglio file-per-file, confini e backlog: [`DEPARTMENT_MAP.md`](./DEPARTMENT_MAP.md).

### 1.6 Standard modulare, gate di architettura e baseline

- **Tre livelli**: ① piattaforma (`components/`, `contexts/`, `pages/`, `hooks/`) ·
  ② verticale (`departments/*`, `modules/*`) · ③ basso (`lib/`, `services/`, `data/`,
  `types/`, `scraper/`). Un file appartiene a un solo livello e a una sola responsabilità.
- **Regole**: soft cap **250 righe**, hard cap **300** (`E-DIM`); nessun file di codice in
  radice di dominio (`E-ROOT`); superficie pubblica solo `index.ts` (`E-ENTRY`); import
  fra domini **solo** via `index.ts` (`E-DOM`); lo strato basso non importa verso l'alto
  (`E-STRAT`); nessun ciclo (`E-CICLO`). Policy completa: [`MODULAR_ARCHITECTURE.md`](./MODULAR_ARCHITECTURE.md).
- **Gate**: `npm run test:architettura` (fallisce **solo** sulle violazioni nuove),
  `… -- --report` (inventario completo), `… -- --baseline` (congela lo stato attuale).
  In CI: `.github/workflows/architettura.yml` su push e PR.
- **Stato attuale del gate** (2026-09-21): `371 file analizzati · 145 violazioni
  (82 errori, 63 warning) · ✅ nessuna violazione nuova`. Debito congelato in
  `scripts/architettura-baseline.json`: `E-DIM 41 · E-DOM 24 · E-ROOT 14 · W-UI 38 ·
  W-DIM 25 · E-CICLO 3`.
- **Error boundary**: `AppErrorBoundary` (app intera) + `DepartmentErrorBoundary`
  (per dipartimento) + `CfuErrorBoundary` (in `departments/cfu/shared/`) +
  `ModuleCreatorErrorBoundary` (sotto-modulo creator della Modulistica).
- **Audit e backlog**: [`STRUCTURAL_AUDIT.md`](./STRUCTURAL_AUDIT.md).

---

## 2. Directory & File Map (ogni file)

> Nota: `LINES` = righe del file (indicativo); "Node-only" = escluso da tsconfig.app.
> Se un file è **🔒** è registrato in `LOCKED_MODULES.md` (non modificare senza autorizzazione).

### 2.1 Root `project/`

| File | Righe | Responsabilità |
|---|---|---|
| `index.html` | 20 | Entry SPA; title/meta "Il Radar degli interpelli nella scuola" (Radar Scuole); in meta anche la prova inclusa: 30 giorni di PRO, PureFocus incluso, poi 49 €/anno; favicon; font Google |
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
| `main.tsx` | 18 | `createRoot` + `<App/>` in StrictMode |
| `App.tsx` | 264 | Provider (`AppProvider`, `ToastProvider`), `BrowserRouter`, TUTTE le 30 route (§16), modali globali (`AuthModal`, `VetrinaModal`, `GoogleOneTap`, `DevToolbar`), error boundary (`AppErrorBoundary` + `DepartmentErrorBoundary` per i domini montati sulle pagine), `RequireAuth` guard |
| `index.css` | 45 | `@tailwind`; `body bg-slate-50 text-primary-900`; `.input`; `.finestra-conversazione`; scrollbar custom; focus-ring |

### 2.3 `src/components/` — UI condivisa

| File | Righe | Responsabilità / dipendenze |
|---|---|---|
| `Header.tsx` | 158 | Header sticky 2 livelli: top-bar (**lockup del marchio**: tessera ufficiale + wordmark «ScuoleRadar.it» in testo, link istituzionali, accedi/avatar/profilo, badge PRO/Base), barra strumenti (`strumentiLinks` con emoji, es. 📁 Modulistica), menu mobile. **Marchio importato come asset di build** (`@/assets/marchio-radar.png`, nome hashato, **stessa tessera del favicon**) con fallback sul solo wordmark su `onError`; sottocomponenti in `components/header/**` (`NavIstituzionale`, `MenuUtente`, `MenuMobile`, `BarraStrumenti`, `BadgePiano*`, `navLinks`, `tipiUtente`) |
| `Modal.tsx` | 70 | Modal riusabile: overlay `bg-primary-900/40`, card `rounded-2xl`, `size sm/md/lg/xl`, `zClass`, prop `cardClassName` (default `bg-white`; es. `bg-slate-50`), **prop `dense`** (header/gutter ridotti + `max-h-[94vh]`: usata dal wizard Radar per rientrare nello schermo senza barra interna; default `false`), Escape/blocco scroll |
| `AuthModal.tsx` 🔒 | 400 | Login/registrazione (Google OAuth + email demo), contesto `'pro'` (checkout ripreso), `useNavigate`. **BLOCCATO** |
| `VetrinaModal.tsx` | — | Modal freemium multi-sezione: radar/cv/cfu/moduli/assistente con CTA di upgrade |
| `AbbonamentoModal.tsx` | 210 | Modal abbonamento: piano PRO annuale/mensile/crediti, promo, `avviaCheckout` |
| `ContattiModal.tsx` | 18 | Wrapper `ContactForm` in modal |
| `ContactForm.tsx` | 286 | Form contatti (dipartimento, oggetto, messaggio, allegato base64, honeypot) → Edge `contatto` |
| ~~`SostegnoToggle.tsx`~~ | — | **RIMOSSO il 04/10/2026** (§26.45): il sostegno non è più una preferenza. *(§26.46)* Anche il blocco informativo «Opportunità di sostegno» è stato **rimosso** da `departments/radar/preferenze/PannelloClassi.tsx`: l'inclusione è ora **nativa e invisibile** nel backend — nessun interruttore, nessuna uscita, nessun testo in UI |
| `modals/RadarPromoModal.tsx` | — | Promo del Radar (upsell PRO) |
| `InterpelloCard.tsx` | 188 | Card singolo interpello: scadenza, provincia, classi, badge "Scuola Preferita", notifica, detail modal |
| `ServiziPaywall.tsx` | — | Paywall condiviso (Base → invita a PRO/registrazione), icona Lock |
| `ProFeatureModal.tsx` · `ExperimentalBanner.tsx` | — | Vetrina funzione PRO · banner "in sperimentazione" per feature beta |
| `Pill.tsx` | — | Pill rimovibile (chip selezione) |
| `Toast.tsx` | — | Sistema toast (provider + `useToast`): success/error |
| `GoogleOneTap.tsx` | 11 | Componente renderless → `useGoogleOneTap` |
| `DatiProfiloModal.tsx` · `ForcePasswordModal.tsx` · `OAuthBounceModal.tsx` · `TelegramLoginButton.tsx` | — | Onboarding/profilo: completamento dati, cambio password forzato, bounce OAuth, login Telegram |
| `SoftOnboardingModal.tsx` | — | Benvenuto PRO «**Buone notizie**»: regalo di benvenuto con **un solo pulsante d'azione** (nessuna voce di rinvio; si chiude con la X, non si apre mai da sola). Importa `GIORNI_TRIAL_PRO` da `lib/pricing` |
| `DevToolbar.tsx` | 246 | Solo DEV: badge ⚡, switch stato (guest/base/pro via `simulaStato`), flag dei dipartimenti, reset dati, porta, health check. **Nessuna casella di testo**: il pannello «Editor Testi Rapido» è stato **rimosso** il 03/10/2026 (§26.38) e i testi si toccano col solo **«Visual Editor»** click-to-edit (§26.37 — badge in basso a sinistra, montato da `App.tsx`) |
| `HealthCheckModal.tsx` | 287 | Modal diagnostica → `eseguiHealthCheck` |
| `AppErrorBoundary.tsx` | — | Error boundary dell'**intera app** (fallback full-screen, reset) |
| `DepartmentErrorBoundary.tsx` | — | Error boundary **per dipartimento**: isola il crash di un dominio (radar/notizie/modulistica/cfu) senza spegnere il resto della SPA |
| `ScrollToTop.tsx` | — | Scroll-to-top a ogni cambio rotta |
| `Footer.tsx` · `Accordion.tsx` | — | Footer condiviso · accordion riusabile |
| `CvTool.tsx` | 174 | CV Builder legacy in `src/components/` (§8); il vecchio wrapper CFU (`CfuTool.tsx`) è stato **rimosso** con la V1 |
| `landing/Landing*.tsx` | — | Sezioni della landing pubblica (`LandingHero` — **due colonne** `lg:grid-cols-[minmax(0,1fr)_34rem]`: copy a sinistra, box «Prova il Radar» (`SimulatorRadar`, **sola provincia**, `p-5`) a destra con i pulsanti «ATTIVA IL TUO RADAR»/«ACCEDI» SUBITO SOTTO il box su **due colonne simmetriche** (`sm:grid-cols-2`, `w-full`) e ripartizione verticale `lg:items-center` (§26.16, §26.19) —, **`LandingRegistrazioneRapida`** (sezione sotto l'hero, **solo visitatori**) + **`FormRegistrazioneRapida`** (il **form condiviso** Nome + Cognome + Email, montato anche nella chiusura dell'offerta PRO: i dati vanno nella bozza e si apre la **configurazione del Radar** già compilata — un solo percorso, nessun doppione), `LandingBenefici` («Cosa riceverai»), `LandingCards`, `LandingCta`, `LandingStrumenti` (card **centrate**), `LandingOffertaPro` (**tre benefici**, copy autorizzata su **una riga** + lead capture nome/cognome/email **immediatamente sotto**, CTA letterale `ATTIVA IL TUO RADAR` — §26.19), `LandingPartnerPureFocus`) |
| `PureFocusCard.tsx` | — | Vetrina **PureFocus** condivisa (homepage, `/prezzi`, `/dashboard/purefocus`): `PureFocusWordmark` ufficiale (Pure `#0E0C0A` + Focus `#0047AB`, sans-serif, senza spazi), badge verde `BadgeInclusoPro` «Incluso nel piano PRO», descrizione e link in evidenza a **purefocus.one** |
| `VetrinaModal.tsx` · `profile/ReferralSection.tsx` | — | vedi sopra · modulo referral "Invita un Collega" |

### 2.4 `src/components/profile/`

| File | Responsabilità |
|---|---|
| `ReferralSection.tsx` | Modulo marketing "Invita un Collega": codice personale, link, KPI referrer via `useReferral` |
| `DocumentiProfilo.tsx` | Sezione **«Documenti»** del profilo: due tab (`Moduli scaricati` · `I Miei Documenti`); `?sezione=documenti` apre la sezione, `&tab=miei` il secondo tab. Monta lo storage condiviso `@/components/documenti/MieiDocumenti` |
| `ModuliScaricati.tsx` | Tab **«Moduli scaricati»**: archivio dei moduli UFFICIALI (storico locale condiviso con la Modulistica), riscarica/rimuovi/svuota; rimando alla Modulistica filtrato dalle feature flags |

### 2.4-bis `src/components/documenti/`

| File | Responsabilità |
|---|---|
| `MieiDocumenti.tsx` | **Spazio di storage personale dell'utente**, componente di PIATTAFORMA condiviso da due superfici (profilo → tab «I Miei Documenti»; Modulistica → terza tab omonima). Elenco dei file (apertura, eliminazione), conteggio dello spazio e **disclaimer** di uso esclusivo e responsabilità; i file restano nel browser (`localStorage`, `lib/mieiDocumenti.ts`), nessun upload su server |
| `AreaCaricamentoDocumenti.tsx` | **Area di rilascio** (estratta da `MieiDocumenti`, SRP): drag & drop + selezione multipla dal computer, stati visivi (trascinamento, limite, caricamento) e formati PDF/JPG/PNG/Word |

### 2.5 `src/contexts/`

| File | Righe | Responsabilità |
|---|---|---|
| `AppContext.tsx` | 282 | **Facade** del provider: compone i hook di dominio sotto e riesporta `useApp` (prima era un monolite da 1634 righe — §3.1) |
| `app/types.ts` | 179 | Tipi dello stato globale (`User`, `Preferenze`, `Esame`, `RuoloSimulato`, tipi di ritorno dei hook) |
| `app/costanti.ts` | 26 | Costanti condivise (`LIMITE_NOTIFICHE_PROVA`, chiavi localStorage, storage del wizard) |
| `app/helpers.ts` | 101 | Utility **pure** del contesto (normalizzazioni, riduzioni) |
| `app/useAuthSync.ts` | 167 | Sincronizzazione sessione Supabase ↔ utente locale (login/logout, eventi auth) |
| `app/useAnagraficaProfilo.ts` | 194 | Anagrafica del docente (lettura/scrittura su `profiles`) |
| `app/useProfileBootstrap.ts` · `app/useBootstrapProfilo.ts` | 180 · 112 | Bootstrap del profilo all'avvio (demo su localStorage e reale su Supabase) |
| `app/usePreferenzeUtente.ts` | 139 | Preferenze Radar (ordini, classi, materie, province, sostegno, scuole preferite/ignorate) |
| `app/useRadarTrial.ts` | 186 | Trial PRO del Radar + preavvisi di rinnovo |
| `app/useCheckout.ts` · `app/useBootstrapCheckout.ts` | 186 · 87 | Checkout Stripe (`avviaCheckout`) e ripresa post-login del piano intentato |
| `app/useProfiloAccount.ts` | 139 | Azioni sull'account (piano, crediti, dati profilo) |
| `app/useAzioniAccount.ts` | 255 | Azioni account di livello superiore (compone i hook precedenti) |
| `app/useInterpelliFeed.ts` | 141 | Feed interpelli dell'utente (query + matching) |
| `app/useStatoSimulato.ts` | 106 | DevToolbar: simulazione `guest`/`base`/`pro` senza reload |
| `app/useModaliApp.ts` | 103 | Apertura/chiusura delle modali globali (auth, vetrina, wizard Radar) |

### 2.6 `src/data/` — dati statici

| File | Righe | Contenuto |
|---|---|---|
| `moduli.ts` | 298 | ⚠️ **Ereditato**: il catalogo è stato diviso in `moduliAltreAree.ts` (500), `moduliEntiAltro.ts` (487), `moduliOrdiniScuola.ts` (2710), `classiConcorso.ts` (944); `moduli.ts` conserva tipi, `macroAree`, `ordineMacroAree`, helper `conAggiuntaInCima`, `getModuliScaricati`, `macroAreaById` e il tipo `DocumentoModulistica` |
| `interpelli.ts` | 89 | Tipo `Interpello` + fallback **VUOTO** (`interpelli = []`: nessuna voce dimostrativa — policy dati) + i campi della compatibilità: `compatibilita`, `motivoCompatibilita`, **`scuolaPreferita`** (inclusione d'ufficio della whitelist scuole, §26.56) e **`competenzaSecondaria`** (la competenza del profilo che ha SFUMATO il voto — livello secondario §26.63, scritto dalla bacheca e mai dal DB) |
| `classiConcorso.ts` | — | `ClasseConcorso[]` (A-XX, ADEE, ADSS…) con `ordine`, `materie[]`, `requisitiCfu[]`; helper `classeByCodice` |
| `ordiniMaterie.ts` | ~160 | `OrdineScuola` (infanzia/primaria/secondaria1/secondaria2/cpia/serali/pon/ata), `ordiniScuola`, `materie`, **`MATERIE_GENERICHE`** + **`materieCompetenzeExtra()`** (esclude le discipline curricolari: Storia/Geografia non sono "competenze extra"), **`competenzeSuggerite`** (12 **tag popolari** PNRR/PON: AI nella didattica, robotica educativa, **Stop Motion**, coding, digital storytelling, CLIL, **Lingua inglese**, STEM, creatività digitale, educazione motoria, progettazione bandi, orientamento), **`materieRicercabili()`** (le competenze extra PIÙ i tag popolari che sono discipline curricolari — «Lingua inglese», «Educazione motoria» — così anche loro si trovano dalla ricerca) e **`CORRELAZIONI_MATERIE`** (co-occorrenze curate termine → id di materie esistenti per la ricerca ESTESA: `inglese` → `clil`, `educazione_linguistica`…). Verificato da `npm run test:radar:preferenze` |
| `province.ts` | 117 | `Provincia[]` (107 province: codice/nome/regione) + `regioni` |
| `provinceCoordinate.ts` | 132 | **Dati** (§26.56) — coordinate dei capoluoghi (2 decimali) per la distanza fra province: `coordinateProvince` (106 codici), consumate solo da `prossimitaGeografica.ts` (`distanzaKm`, raggio dei 60 km) |
| `servizi.ts` | 99 | Vetrina servizi: `Servizio[]` (slug, emoji, titolo, caratteristiche, destinatari, dashboard, sperimentazione) + `servizioDaSlug` |
| `editableTexts.ts` | 100 | **Registro dei testi modificabili «al volo» (DEV)**: `TESTI_EDITABILI` (`chiave → testo di default`, 22 voci = 8 FAQ pubbliche `faq.<slug>.domanda|risposta` + i 3 blocchi dell'offerta PRO `prezzi.offerta.<blocco>.titolo|testo`), `ChiaveTesto`/`CHIAVI_TESTO`, `testoDiDefault`, `eChiaveTesto`. **Nessun raggruppamento per pagina** (il `gruppiTesti()` con le etichette cablate è stato rimosso il 29/09/2026, §26.30): le pagine rendono per CHIAVE (`useTestiEditabili`), mai la stringa duplicata, e il `localStorage: sr_simple_text_overrides` vale **solo** in sviluppo (nessuno lo scrive più da quando il pannello è stato rimosso, §26.38). Verificato da `npm run test:testi-chiave` (§26.27; selezione delle FAQ in §26.29) |
| `faqPubbliche.ts` | 51 | **Elenco unico delle FAQ pubbliche** (`FAQ_PUBBLICHE`, `VoceFaq`): 8 voci `{ id, q, a }` = ancora HTML + chiavi del registro testi, nello stesso ordine su `/faq` (`FAQPage`) e su `/prezzi` (`PrezziPage`, 🔒: della pagina è cablata la sola sezione FAQ dal 29/09/2026). Solo copy di **posizionamento**: uscite le voci difensive (disdette, sicurezza dei pagamenti) e i rimandi a funzioni non attive (CV, Archivista AI, Tabelle A/B) — §26.29. L'ancora `#animatore-digitale` è pubblica (referenziata da `AuthModal`/`NotaAccessoScolastico`). Modulo puro: nessun React, nessuna copy |



### 2.7 `src/lib/` — librerie

| File | Righe | Responsabilità |
|---|---|---|
| `supabase.ts` | 20 | Client Supabase frontend (anon); `supabase === null` in demo; `isSupabaseConfigurato` |
| `matchingEngine.ts` | ~700 | Matching Radar + utenti compatibili (§5.2); `searchInterpelli` esclude gli scaduti; **`elencaUtentiNotificabili`** → TUTTI i profili con canale valido e Radar attivo (`findUtentiCompatibili(..., { ignoraFiltri: true })`, così anche chi ha province/classi configurate riceve il riepilogo). **Normalizzazione CLASSI robusta**: `normalizzaClasse` (`A-18` ≡ `A18` ≡ `a 18` ≡ `A_18` ≡ `A-018` → `A-18`; i codici sostegno `ADEE`/`AD24` restano invariati), **`normalizzaClassi`** (dedup + formato canonico), **`contieneClasse`**/**`rimuoviClasse`** (confronto a prova di formato per le caselle UI). **COMPETENZE/PAROLE CHIAVE** (§26.35): `normalizzaCompetenza`, `tokenCompetenza`, `radiceCompetenza`, `etichetteCompetenzeProfilo`, `competenzaCompatibileConAvviso` (regola condivisa da motore, digest e feed), **`avvisoDiSostegno`** (l'area sostegno è a **inclusione permanente**: gli avvisi `AD*` non passano dal controllo di classe — §26.45). Verificato da `npm run test:matching` e `npm run test:radar:preferenze`. **PROSSIMITÀ GEOGRAFICA (§26.55)**: `avvisoCompatibileConProfilo`/`punteggioCompatibilita` accettano `OpzioniCompatibilita` (`ignoraFiltri`, **`provinceLimitrofe`** — default `false`, la attiva solo la bacheca: la consegna resta strict); `normalizzaProvincia` vive in `prossimitaGeografica.ts` (§26.56: raggio di 60 km) ed è qui **riesportata** | 
| `compatibilita.ts` | 146 | **Puro** — SOGLIE (🟢 ≥ 80 · 🟠 ≥ 70 · 🔴 ≥ 60), `normalizzaPunteggioCompatibilita`, `livelloCompatibilita`, `etichettaCompatibilita`, `bandaCompatibilita(punteggio, motivo?)` (livello + etichetta + descrizione/tooltip + classi Tailwind), **`ETICHETTA_SCUOLA_PREFERITA`** («Scuola preferita nel radar») e `descrizioneScuolaPreferita`. **§26.56:** le PENALITÀ cumulate sono state sostituite dalla MEDIA PONDERATA delle MODALI PRIMARIE (`PESI_MODALI`, §26.57), che vivono nei moduli dedicati (`punteggioOrdine`/`punteggioClasse`/`prossimitaGeografica`; le competenze sono il LIVELLO SECONDARIO, §26.63) (§26.54, §26.55, §26.56). **§26.63**: **`ETICHETTA_COMPETENZA_SECONDARIA`** («Competenza trovata») e `descrizioneCompetenzaSecondaria(competenza, punteggio)` — l'etichetta della SFUMATURA del livello secondario, accanto al voto delle preferenze primarie (l'override della Modalità 3 è stato ritirato) |
| `compatibilitaGraduata.ts` | 240 | **Puro** — livello di BACHECA della compatibilità, in DUE LIVELLI dalla §26.63: **(1) PRIMARIO** — le preferenze dichiarate decidono il voto con la MEDIA PONDERATA di `mediaModali.ts` (classe 2, ordine/provincia 1; le modali senza dati dell'utente escono e i pesi si rinormalizzano) **+ la SFUMATURA del livello secondario**, dentro il tetto (`CAP_COMPETENZE` 25 — oppure `PUNTEGGIO_MATCH_SECONDARIO` quando il motore ha sentenziato che il profilo non ha classi); **(2) GEOGRAFIA SOVRANA** — la provincia resta l'unica condizione geografica: oltre il raggio si è esclusi (0), salvo whitelist. Espone `competenzaSecondaria` (la competenza che ha sfumato) e i **motivi leggibili** per il tooltip (righe «media ponderata di N modali» e «livello secondario: +N punti (tetto 25%)»). Invarianti: il sostegno EXTRA resta 60 (le competenze non lo promuovono) e la consegna non passa di qui |
| `mediaModali.ts` | 50 | **Puro** (§26.57, §26.63) — la MEDIA PONDERATA delle modali in un solo posto: **`PESI_MODALI`** (classe **2** = requisito abilitante · ordine/provincia 1; le **competenze NON sono pesate**: sono il LIVELLO SECONDARIO, sfumano il voto di max 25 punti), `ContributoModale` e la primitiva **`mediaPonderata(contributi)`** = `Σ(punteggio × peso) / Σpesi`, rinormalizzata sulle sole modali applicabili |
| `areeDisciplinari.ts` (`affinitaDisciplinare.ts` fino alla §26.56) | 189 | **Puro** — AREE E PONTI DISCIPLINARI, base condivisa della Modale 2 e del LIVELLO SECONDARIO (§26.63): `areeDi(testo)` (radici curate ≥ 5 caratteri usate anche come PREFISSO: `teatr` → «teatrale»), `lingueDi`, `etichetteAree`, `areeInComune`, `ponteTraAree` (ponti affini: Digitale ↔ IA, Arte ↔ Digitale, Scientifico ↔ Digitale; contaminato: Letteratura ↔ Teatro). Sigle solo in maiuscolo («IA», mai «ai») |
| `prossimitaGeografica.ts` | 185 | **Puro** — GEOGRAFIA delle province (§26.56, **Modalità 4**): `normalizzaProvincia` (fonte unica), `coordinateProvincia`, **`distanzaKm`** (Haversine fra capoluoghi), `provinceEntroRaggio`, `provinceDiRicerca` (proprie + entro il raggio di 60 km), `punteggioProvincia` (propria 100 · vicina con penalità 25/40/55 → 75/60/45 · **oltre il raggio = esclusione**), `provinciaCompatibile`. La consegna resta STRICT: senza `limitrofe` vale solo la provincia selezionata |
| `riempitivi.ts` | 105 | **Puro** — CAP DINAMICO: `limitaRiempitivi(lista, opts)` con `MAX_RIEMPITIVI_BACHECA = 5` (sotto il 70%), `MINIMO_MATCH_QUALITA = 10` e **`proteggi`** (§26.56: le scuole preferite non sono riempitivi e non si nascondono); punteggi assenti neutri, ordine invariato, esito con conto e motivo (`sotto-tetto`/`tetto-raggiunto`) · **§26.60**: `riempitivoNonPertinente(voce)` — sotto il 70% **senza** aggancio del motore e **senza** parola chiave della Modale 3 la voce è un falso positivo: la bacheca la scarta a monte, **senza quota e senza cap** (`bachecaInterpelli` espone `riempitiviEsclusi`) |
| `punteggioOrdine.ts` | 76 | **Puro** — **Modalità 1** «Dove vuoi lavorare» (§26.56): `punteggioOrdine(ordini, ordineAvviso)` → 100 selezionato · 90 adiacente (infanzia↔primaria↔secondaria I↔secondaria II) · 70 salto/altra tipologia · `null` = modale fuori dalla media. `ordiniAdiacenti`, `etichettaOrdine` |
| `punteggioClasse.ts` | 180 | **Puro** — **Modalità 2** «Classi di concorso» (§26.56): `punteggioClasse` → 100 esatta · 95 affine (una materia del catalogo in comune: A-22 ↔ A-24) · 90 competenza dichiarata dentro la classe dell'avviso / materia coperta · 85 stessa area · 75 ponte affine · 65 area contaminata · 55 classe estranea; `classeVicina` (soglia 85) apre la bacheca, `materieInComune`, `etichettaClasse` |
| `punteggioCompetenze.ts` | 199 | **Puro** — LIVELLO SECONDARIO del punteggio (**§26.63**; ex «Modalità 3» della §26.56, il cui OVERRIDE §26.58 è stato ritirato): `punteggioCompetenze(profilo, avviso)` SFUMA al massimo `CAP_COMPETENZE` (25) punti ciò che le preferenze primarie hanno già deciso — grado del match PIÙ FORTE (**esatta 25** · **vicina 20** · **riconducibile 10**) + `INCREMENTO_JOLLY` (3) per ogni corrispondenza AGGIUNTIVA, sempre dentro il tetto. `punteggio: 0` = nessuna competenza del profilo nel testo: il voto resta tutto delle modali primarie. Le competenze NON aprono la bacheca (la pertinenza è delle classi, §26.60) e non assegnano mai il voto |
| `filtriScuole.ts` | 223 | **Puro** — **Modalità 5** «Filtri Avanzati Scuole» (§26.56): `testoScuola` (istituto + titolo, minuscolo), `scuolaInElenco`, `scuolaEsclusa` (blacklist), `scuolaPreferita` (whitelist), `giudizioScuole` (la blacklist vince sulla whitelist) · **§26.62 — AMBITO PROVINCIALE dei suggerimenti**: `scuoleNote` (i nomi del feed con la loro provincia, senza doppioni), `suggerimentiScuole` (solo le province da cercare: proprie + entro 60 km), `ambitoScuola` (`dentro`/`fuori`/`sconosciuta`) e `messaggioAmbitoScuola` (una sola copy: la forzatura fuori ambito è **dichiarata**) |
| `scuolePresentabili.ts` | 70 | **Puro** — SUGGERIMENTI del campo scuola (**§26.65**, estratto da `filtriScuole.ts` per la soglia di manutenzione): `scuolePresentabili(avvisi)` = i nomi d'istituto che si possono PROPORRE — passano dal gate dei nomi `nomeIstitutoPresentabile` (§26.59), quindi voci di menu, titoli di sezione, materie e dump di codici («A041 \| B017») NON sono suggerimenti, e la coda procedurale viene tagliata («IC ALBIGNASEGO Interpello per copertura posti» → «IC ALBIGNASEGO»); `provinceSuggerite(note)` = le province con istituti reali, per il selettore accanto al campo (senza doppioni; si tiene il nome più informativo, mai la sigla da sola). Verificato da `npm run test:filtri-scuole` |
| `qualitaAvviso.ts` | 153 | **Puro** — LA RIGA DI FEED È UN AVVISO? (**§26.65**): `motivoRigaNonOpportunita(riga)` → `null` (la riga resta) oppure il motivo dichiarato — `titolo-dump-di-codici`, `indice-di-codici`, `nessuna-traccia-di-opportunita`; l'ordine è la regola: dump → parola operativa (`dichiaraOpportunita`, finestra su titolo+materia) → indice di codici (`eIndiceDiCodici`, sigle «forti») → classi → istituto **presentabile** (`nomeIstitutoPresentabile`, §26.59). `motivoRigaNonOpportunitaAvviso(avviso)` è lo STESSO giudizio sull'avviso mappato: lo usano la bacheca (passo 1-bis, conto `righeNonOpportunita`) e la pulizia del database (`npm run dati:pulisci-contorno`) |

| `materieClassi.ts` | 41 | **Puro** — MATERIE COPERTE dalle classi di concorso (§26.62), derivazione **unica** di Admin e vista utente: `materieDelleClassi(codici)` normalizza i codici (`normalizzaClasse`: `A-018` ≡ `A18`), legge `materie[]` dal catalogo `src/data/classiConcorso.ts` e risolve gli id nel NOME (`src/data/ordiniMaterie.ts`), senza duplicati e nell'ordine delle classi scelte; un codice fuori catalogo resta codice, senza righe inventate. La usano la scheda utente dell'Admin (`departments/admin/components/derivaPreferenzeUtente.ts`, campo `materieClassi`) e il box «In cosa puoi lavorare» del Radar (`departments/radar/components/RiepilogoLavoro.tsx`) |
| `bachecaInterpelli.ts` | 191 | **Puro** (§26.56 → §26.65) — PIPELINE della bacheca, un solo punto: avviso vivo → **la riga è un avviso?** (`motivoRigaNonOpportunitaAvviso`, §26.65: il contorno del feed non entra e lo scarto è contato) → filtri scuole (blacklist fuori, whitelist dentro d'ufficio) → **PORTA D'INGRESSO PRIMARIA** (conferma del motore, oppure classe almeno «stessa area» 85: una competenza trovata NON apre la bacheca) → punteggio (media ponderata delle modali primarie **+ la sfumatura del livello secondario**) → esclusione secca dei riempitivi non pertinenti (§26.60) → cap dei riempitivi con protezione delle scuole preferite. `bachecaInterpelli(fonti, profilo)` restituisce lista + conti (`righeNonOpportunita`, `esclusiBlacklist`, `forzate`, `riempitiviEsclusi`, `riempitiviNascosti`) e scrive sull'interpello `compatibilita`, `motivoCompatibilita`, `scuolaPreferita` e **`competenzaSecondaria`** (§26.63), così `useInterpelliFeed` resta un contenitore di stato |
| `scadenza.ts` | ~90 | Helper scadenza (puro): `giorniRimanenti`, `eScaduto`, `eInterpelloAttivo`, `stileScadenza` (semaforo 🟢 lungo / 🟡 vicino / 🔴 imminente) |
| `alertInterpello.ts` | ~480 | Costruttore dell'**avviso strutturato** (gerarchia obbligatorie/opzionali + campo `email` dell'avviso), `pulisciTitoloAvviso` (via i dump di codici classe), **`emailAvviso`** + costanti condivise `EMAIL_ICONA`/`EMAIL_ETICHETTA`/`EMAIL_ETICHETTA_WEB`, **`ISTRUZIONE_AVVISO_UFFICIALE`** (direttiva standard "clicca STAMPA") e **`suggerimentoRicercaAvviso({ compatto })`** (guida operativa per elenchi/"Stampa" o fonte mancante), **`emailAvviso`** ed **`etichettaFonteLink`/`classificaFonteLink`/`ePaginaRiepilogo`** (etichetta ONESTA del link: PDF / Albo Pretorio / **pagina di riepilogo "Stampa"** / avviso — mai "Candidati"), **GATE DI QUALITÀ**: `eUrlAvvisoDiretto` (link = avviso specifico, mai home/elenco/ricerca/archivio regionale), `motivoAvvisoNonInviabile` e `avvisoInviabile` (**link diretto AND email di candidatura**: altrimenti nessun invio), **PULIZIA DELL'URL**: `pulisciUrlEsterna` (entità `&amp;`, virgolette/angolari/caporalia di markdown, spazi e punteggiatura di contorno) e **`urlFonteAvviso`** = stringa pulita + UNICO gate `eUrlAvvisoDiretto` (il punto unico dell'`href` per Telegram, email e canali — §26.45). Verificato da `npm run test:qualita` |
| `interpelloRouting.ts` | ~40 | Deep link LEGACY `/interpello/:id` (puro): `eUuid`, `chiaveInterpelloDaParam` (uuid → `id`, hash → `hash_id`). **Policy**: le notifiche non generano più link interni; la rotta resta solo per i deep link storici (che reindirizzano subito alla fonte esterna) |
| `digest.ts` | ~130 | **Puro, senza import** — finestra del BATCH giornaliero: `oraLocaleItalia`/`dataLocaleItalia`/`etichettaDataItalia` (fuso `Europe/Rome`), `ORA_DIGEST` (**17:00**), `eOraDelDigest(istante, forzato)`, `descrizioneFinestraDigest`, `ordinaVociDigest` (scadenza più vicina in cima), `raggruppaPerProvincia` |
| `resend.ts` | 1.153 | **Node-only** — email Resend: 8 `TipoMessaggio` (`welcome, prova1, prova2, prova3, extra, recap, welcome_pro, notifica_pro`), **OGGETTO STANDARD delle opportunità** `OGGETTO_OPPORTUNITA = 'Nuove opportunità per te!'` (`subjectDigest`/`subjectOpportunita`/`subjectPerNotifica`; gli oggetti di ciclo di vita restano specifici), **`vociAttive`** (il digest contiene SOLO opportunità non scadute), **`footerEmailHtml`** (footer unico crisp: firma → CTA Notizie email → link Radar **in piccolo** (12.5 px) → riga brand → avviso "non rispondere" in coda; niente "P.S.", niente grigio `#94a3b8`), `ctaNotizieHtml`/`URL_NOTIZIE_VISIBILE`/`CTA_NOTIZIE_TESTO_EMAIL`/`TESTO_NON_RISPOSTA`, `linkOpportunita` (solo link diretto, **URL già pulito** via `urlFonteAvviso`) e **`fonteInEvidenza`** (PULSANTE dell'avviso ufficiale: **UNICA azione di fonte per voce**, etichetta standard; **nessun box giallo né guida operativa nelle email**), **`intestazioneBrandHtml`/`URL_BRAND`** (header email **SOLO testuale**, cliccabile verso `scuoleradar.it`: **nessun logo-immagine**), CORPO_MESSAGGI, `TIPI_CON_OPPORTUNITA`, `renderEmailHtml`, `inviaNotificaEmail`, `inviaNotificheInterpello`, `renderDigestEmailHtml`/`inviaDigestEmail`, **`renderPromemoriaEmailHtml`/`inviaPromemoriaEmail`**. Verificato da `npm run test:email`, `npm run test:digest`, `npm run test:promemoria`, `npm run test:link` |
| `telegram.ts` | 1.286 | **Node-only** — messaggi Telegram. `formattaMessaggioTelegram`: ALERT di **solo testo** (nessuna foto/logo → niente anteprima gigante, nessun disclaimer operativo) con **testata brand cliccabile** (`📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>`), apertura **`🎯 Abbiamo trovato una nuova opportunità per te` (+ contesto classe·provincia)**, riga `📧 Candidature`, **riga UNICA del link di fonte** (`👉 Apri l'avviso ufficiale`: etichetta canonica dei messaggi PERSONALI, la stessa delle email) costruita sull'**URL grezzo** della voce, **pulito** (`urlFonteAvviso`: entità HTML, virgolette, spazi e punteggiatura di contorno) e passato dall'**unico gate** `eUrlAvvisoDiretto` dentro `rigaAvvisoUfficiale` (URL solo nell'`href`) e CTA finale `CTA_RADAR_INTERESSI` (ricalibra il Radar su `/dashboard/radar`, **solo nel ~20% dei messaggi**: `deveMostrareCtaRadar`/`FREQUENZA_CTA_RADAR`, forzabile con `{ mostraCtaRadar }`); i messaggi di ciclo di vita mantengono copy + `CTA_NOTIZIE_TELEGRAM`. Poi `formattaDigestTelegram` (BATCH BASE), **`formattaPostCanaleTelegram`** (post canali a 7 sezioni, testate tipografiche `📝 Interpello docenti`/`🗂️ Avviso ATA`/`📣 Bando / PNRR / Esperto`; brand in testa, **URL ufficiali mai in chiaro** — solo la riga iperlinkata `🔗 Fonte Ufficiale` — e link SOLO se diretto all'avviso, `eUrlAvvisoDiretto`), **`pubblicaInterpelloSuCanali`** con **gate di link safety** (`EsitoPubblicazioneCanali.saltato`: nessuna pubblicazione senza avviso specifico), `inviaNotificaTelegram`, `inviaMessaggioTelegram` (**`payloadMessaggioTesto`**: punto UNICO del payload `sendMessage` con `link_preview_options.is_disabled` + `disable_web_page_preview: true`; mai `sendPhoto`/`sendMediaGroup`), `rigaFonteUfficiale`/`rigaAvvisoUfficiale` (etichetta canonica + gate `eUrlAvvisoDiretto` interno), `getTelegramBotToken`, **`pulisciUrlTelegram`**. **Nessun prompt "Filtra per provincia e classi" nei messaggi personali**; verifica con `npm run test:telegram:canali` |
| `dedupAvvisi.ts` | ~95 | **Puro** — `improntaAvviso` / `normalizzaPerImpronta` / `GIORNI_IMPRONTA`: identità STABILE dell'opportunità (provincia + scuola + **classi NORMALIZZATE `A-022` ≡ `A-22`** + titolo normalizzato senza date/numeri/riempitivi). Intercetta la stessa notizia ripubblicata con titolo/data diversi (hash nuovo) → nessuna notifica ripetuta a distanza di giorni. Usata dallo scraper (dedup in inserimento) e dal **frequency cap per utente** (§6.5.1). Verificata da `npm run test:dedup` e `npm run test:dedup:utente` |
| `frequenzaNotifiche.ts` | ~140 | **Puro** — **FREQUENCY CAP** delle notifiche personali: `MAX_INVII_OPPORTUNITA` (2), `hashContenuto` (FNV-1a del contenuto normalizzato), **`identitaFrequenza`** (`scuola|classi|hashContenuto`, classi normalizzate `A-022` ≡ `A-22`), `giornoFrequenza` (fuso `Europe/Rome`), `valutaFrequenza` → `stesso-giorno` / `limite-raggiunto` / `ok`. Verificato da `npm run test:frequenza` |
| `testiModificabili.ts` | 139 | **Puro e isomorfo** — store degli override dei **testi per chiave** (DEV, `localStorage: sr_simple_text_overrides`): snapshot stabile `overrideTesti()`, `sottoscriviTesti`, `testoCorrente(chiave)` (`override → default`), `impostaTesto` (campo svuotato = ritorno al default, niente scritture se il valore non cambia), `azzeraTesti()` (cancella la chiave). Letture tolleranti: JSON corrotto, chiavi fuori registro e valori vuoti tornano ai default del codice. Dalla rimozione del pannello (§26.38) **nessuno lo scrive più**: la lettura resta per non lasciare attivi, in sviluppo, i testi salvati prima. Verificato da `npm run test:testi-chiave` (§26.27) |
| `testiDomNodi.ts` | 41 | **Puro e isomorfo** — LETTURA dei testi del DOM: era il secondo pezzo della scansione dell'«Editor Testi Rapido» (rimosso il 03/10/2026, §26.38), oggi serve al VISUAL EDITOR (§26.37) con il **tipo minimo `NodoDom`** (permette di ESEGUIRE i testi su un DOM finto negli script Node, senza jsdom) e `etichettaDove` («sezione · Paragrafo»). La scansione dei blocchi e la riscrittura stanno in `visualEditorRegole.ts`. Verificato da `npm run test:visual-editor` |
| `testiDomRegole.ts` | 61 | **Puro, senza dipendenze** — REGOLE e NOMI dei testi del DOM (condivise col VISUAL EDITOR, §26.37): `normalizzaTesto`, `impronta` (djb2 in base 36), `chiaveTestoDom(tag, testo, occorrenza)` → `p#1a2b3c#0` (identità STABILE del testo: non dipende dalla posizione nel DOM, quindi l'override resta agganciato anche quando React ricrea i nodi e due testi identici restano occorrenze distinte) e `campoDi`/`contenitoreDi` per le etichette umane |
| `emailScuola.ts` | ~110 | **Puro** — email UFFICIALE della scuola: `normalizzaCodiceMeccanografico`, `estraiCodiceMeccanograficoDaTesto`, `emailDaCodiceMeccanografico` (PEO `@istruzione.it` / PEC `@pec.istruzione.it`), `risolviEmailUfficialeScuola` (email di fonte → convenzione MIM; mai email inventate) |
| `liveBoard.ts` | 238 | **Puro** — vetrina "Radar Live" (ogni nome passa dal GATE `nomeIstituto.ts`; `titoloLeggibile` per il sottotitolo, `rigaPresentabileVetrina` per la prova): `scuolaDaTitolo` (nome **prima del separatore** quando dopo c'è l'azione amministrativa; respinge frammenti di procedura, elenchi di codici classe e nomi generici), `nomeScuolaRiga` (campo → registro per codice → titolo: l'ente emittente NON è una scuola e non entra in bacheca; un `school_name` fatto solo di codici classe — «ADEE \| EEEE» — **non** è un nome), `nomePresentabileRiga` (per il responso della prova: lo **stesso** gate della bacheca — mai l'ente emittente al posto della scuola, §26.59), `nomeScuolaBoard`/`preparaRigheBoard` (**GATE STRETTO, §26.59**: entra solo una riga con un istituto REALE risolto — campo, registro per codice o titolo; il nome grezzo del bando non è un'anagrafica e non fa più entrare la riga, `nomeGrezzoDaBando` resta come giudizio puro per la qualità dell'ingestione; `anagraficaParziale` è `true` quando il nome è ricostruito (registro/titolo) o lo stato è `parziale`; resta fuori anche l'avviso non vivo). Il tabellone continua a non mostrare mai "Scuola non indicata" né codici in vetrina — e tiene gli **avvisi senza scadenza** pubblicati negli ultimi `GIORNI_FINESTRA_SENZA_SCADENZA`=60 giorni con `scadenza: null` + `senzaScadenza`: mai una data inventata), `diversificaProvince` (round-robin deterministico per provincia: nessuna provincia monopolizza le prime pagine) |
| `nomeIstituto.ts` | 161 | **Puro, senza dipendenze** — GATE dei nomi in vetrina: `nomeIstitutoPresentabile` accetta una stringa solo se ha una **testa d'istituto** (`IC`, `I.I.S.`, `ITIS`, `Liceo`, `Istituto`, `Convitto`…) **e** una **denominazione** (un nome proprio), senza codici amministrativi (classe di concorso, sostegno, meccanografico, token misto lettere+cifre) e senza 3+ cifre consecutive; **taglia la coda di procedura** («IC ALBIGNASEGO Interpello per copertura posti» → «IC ALBIGNASEGO»). Verificato da `npm run test:nome-istituto` |
| `school-lookup.ts` | 67 | **Anti-mock** (§26.47) — registro MINIMO delle scuole, solo istituti REALI registrati a mano: **`nomeScuolaDaCodice`** (mai "Istituto &lt;codice&gt;") e `scuolaDaCodice` (`SchoolInfo` completo, `null` se non registrato). Il vecchio **`resolveSchoolByCode`** — che per QUALSIASI codice fabbricava un nome (`Istituto &lt;codice&gt;`) e la città `N/D` — è stato **rimosso**: il recapito ufficiale nasce solo dalla convenzione MIM (`emailScuola.ts`). Verificato da `npm run test:pipeline` |
| `statoArricchimento.ts` | 84 | **Puro e isomorfo** — STATO dell'anagrafica di una riga (§26.47): `statoArricchimento` (`completo` = istituto identificato + recapito PEO/PEC, altrimenti `parziale`), `istitutoIdentificato`, `recapitoPresente`, `normalizzaStatoArricchimento`, `anagraficaInAggiornamento` (true solo per `parziale`: uno stato ignoto non afferma nulla) e il segnaposto gestito `SCUOLA_NON_SPECIFICATA` («Scuola non specificata / Più plessi», §26.48 — **fuori dalla bacheca dalla §26.59**: resta nella sola scheda del singolo avviso, `src/components/IstitutoEmittente.tsx`). `parziale` non è un motivo di scarto dalla pipeline (la riga entra in `interpelli`), ma **non** fa entrare in vetrina: senza un istituto reale risolto la riga resta fuori dal tabellone (§26.59). Verificato da `npm run test:pipeline` |
| `provaRadarEngine.ts` | 117 | **Puro** — motore del **Radar di prova** pubblico (si prova con la **sola provincia**): `LIMITE_RISULTATI_PROVA`, `righeAttive` (senza scadenza = attiva), `selezionaRisultatiProva(provincia, nazionali, limite)` (tutte le opportunità ATTIVE della provincia + **completamento nazionale** senza duplicati) e la copy del responso (`messaggioConversione`, `messaggioRadarInScansione`, `CODA_CONVERSIONE_PROVA`); responso `{ gruppo: 'provincia'\|'nazionale'\|'vuoto', righe, daProvincia }`. Mai «zero risultati»: l'elenco resta pieno finché esiste un avviso vivo. Verificato da `npm run test:prova-radar` |
| `provaRadar.ts` | 81 | **Memoria della provincia provata** (localStorage, tollerante agli errori): `salvaProvinciaProva`/`leggiProvinciaProva`/`svuotaProvinciaProva` + `provinceInizialiConProva` → la provincia del box «Prova il Radar» diventa la **provincia principale** del wizard/onboarding (validata sul catalogo `data/province`). Verificato da `npm run test:prova-radar` |
| `notifier.ts` | 1.999 | **Node-only** — orchestratore notifiche: **`inviaAlertTelegramTempoReale`** (alert INDIVIDUALI Telegram per i **PRO**), **`inviaDigestGiornaliero`** (BATCH: email per tutti + Telegram solo per **BASE**; opzioni `forzato`, `soloUtente`, `soloRegistrare`/`finoA`, seam di test `inviaEmail`/`inviaTelegram`; guardia "una email al giorno" `chiaveDigestGiorno`) e **`inviaPromemoria24h`** (promemoria email ≥ 24h per scadenze entro 3 giorni). **ACCUMULO EMAIL** (`accumulaVoceEmail`/`inviaEmailAccumulate`): i percorsi di dispatch/backfill (`notificaNuoviInterpelli`, `notificaInterpelliPerUtente`) **non inviano mai una email per opportunità** — le voci compatibili si accumulano e partono con **UN'UNICA email di riepilogo** (`inviaDigestEmail`, stesso renderer del digest); `EsitoDispatchUtente.emailVoci` conta le opportunità incluse nel riepilogo. **REGISTRO INVII per utente** (§6.5.1): `avvisoGiaInviato` (**FREQUENCY CAP**: identità = scuola + classi + impronta del contenuto; **max 2 invii in 2 giorni diversi**, mai due volte nello stesso giorno, per canale di consegna, con marcatori storici pre-cap conservativi) e `registraInvioAvviso` (registra il **GIORNO** dell'invio su ledger file + `notifications_log` con canale `freq_email`/`freq_telegram`) → nessuno spam, e un contenuto aggiornato riparte come nuova opportunità. `recapitoNotifica` (PEO dal codice MIM), **GATE DI QUALITÀ STRICT** (`superaGateQualita`, da `avvisoInviabile`): nessun invio di avvisi senza **link diretto** o senza **recapito** — applicato a `notificaNuoviInterpelli`, `notificaInterpelliPerUtente`, `inviaAlertTelegramTempoReale`, `raccogliVociCanale` (digest) e `inviaPromemoria24h` |
| `promemoria.ts` | ~130 | **Puro** (nessun I/O) — regole del **PROMEMORIA 24h**: `ORE_PROMEMORIA` (24), `GIORNI_URGENZA_PROMEMORIA` (3), `CANALE_PROMEMORIA` (`promemoria`), `oreTrascorse`, `eVoceUrgente`, `motivoPromemoria` (`ok`/`inviata-da-meno-di-24h`/`gia-promemoria`/`scaduta`/`scadenza-non-urgente`/`mai-inviata`/`senza-id`), `ePromemoriaDovuto`, `chiavePromemoria` (chiave di deduplica per coppia utente×interpello). Verificato da `npm run test:promemoria` |
| `ledgerLocale.ts` | ~110 | **Node-only** — ledger anti-duplicato su file (`.scuoleradar/notifiche-ledger.json`): `chiaveLedger`, `ledgerLocaleGia`, `ledgerLocaleChiaviConPrefisso` (conteggio frequenza per identità), `ledgerLocaleRegistra`, `ledgerLocaleSalva`, `percorsoLedgerLocale`. Rete di sicurezza quando le tabelle DB non sono ancora create; committato dai workflow. **Percorso sovrascrivibile con `SCUOLERADAR_LEDGER_PATH`** (usato dai test per NON sporcare il ledger reale). **Tolleranza BOM** in lettura e scrittura senza BOM; un file ILLEGGIBILE produce un warning esplicito (mai deduplica silenziosamente disattivata). Verificato da `npm run test:ledger` |
| `pricing.ts` | 18 | Piani: `PianoId = 'pro_annuale'|'pro_mensile'|'a_consumo'`; localStorage `STORAGE_KEY_INTENDED_PLAN` |
| `promo.ts` | 34 | `validaPromo(codice, userId)` via RPC `valida_codice_promo`; `SCONTO_PROMO_EUR = 10` |
| `provinceRadar.ts` | 68 | **Puro** — PROVINCIA PRINCIPALE del Radar: `provinciaPrincipale` (la PRIMA selezionata), `eProvinciaPrincipale`, `provinceDiContorno` (tutte tranne la principale), `promuoviProvinciaPrincipale` (porta in testa = priorità, idempotente), **`limitaProvinceMantenendoPrincipale`** (troncamento dei downgrade che conserva SEMPRE la principale). L'ordine dell'array `provinceCodici` è la fonte di verità (persistito su `profiles.province`/`sr_preferenze`). Verificato da `npm run test:province` |
| `ricercaSelezioniRadar.ts` | ~190 | **Puro** — RICERCA UNIFICATA (wizard + Preferenze): `cercaSelezioniRadar` (classi + competenze + parola chiave in un solo risultato), `cercaClassiDiConcorso` (codice `a18` ≡ `A-18`, denominazione **o materia collegata, anche CORRELATA**), `cercaCompetenzeExtra` (**materie ricercabili** + competenze CORRELATE: «Inglese» → CLIL, educazione linguistica; le altre disciplinari restano fuori), `materieCorrelate` (sinonimi da `CORRELAZIONI_MATERIE`), `normalizzaTestoRicerca`, `etichettaMateria`, **`classeRispondeAQuery`/`classeCorrispondeAQuery`** (tolleranza di scrittura del codice: `a19` ≡ `A19` ≡ `A-19` ≡ `A_19` ≡ `A-019` ≡ `  a 19  ` — §26.45), `LIMITE_RISULTATI_GRUPPO`, `MIN_CARATTERI_RICERCA`. La parola chiave libera non è riproposta se il catalogo offre già quella voce (per nome o id). Verificato da `npm run test:ricerca` |
| `anagraficaCsv.ts` | ~200 | **Solo-Node** — ANAGRAFICA NAZIONALE delle scuole (file CSV SCUANAGRAFE del Ministero): `parseCsv` (RFC4180: campi quotati, `""` dentro il campo, a capo nei valori), `scuolaDaCampi` → `ScuolaAnagrafica` (codice scuola, istituto di riferimento, denominazioni, PEO, PEC, provincia/comune, tipologia, paritaria), chiavi di confronto `normalizzaNomeScuola`, **`chiaveCodiceScuola`** (permissiva 6–16 alfanumerici: i codici delle **paritarie** — `UD1A036009` — non passano la convenzione MIM statale), `chiaveProvincia` + `provinciaCodiceDaNome` («MONZA E BRIANZA» ≡ «Monza e della Brianza»). Email normalizzate in minuscolo. Verificato da `npm run test:anagrafica` (§26.41) |
| `anagraficaIndice.ts` | ~160 | **Solo-Node** — indice dell'anagrafica: `cartellaAnagrafica` (`SCUOLERADAR_ANAGRAFICA_DIR`, default `~/Downloads`), `fileAnagrafici` (ricerca per PREFISSO `SCUANAGRAFESTAT`/`SCUANAGRAFEPAR`/`SCUANAAUT*`), `caricaAnagrafica` (`perCodice`, `perIstituto`, `perNome`, righe per file, **cache di processo**: ~13 MB mai ricaricati), `IndiceAnagrafica`/`FileAnagraficaLetto`. Cartella assente = `disponibile: false`, mai un errore (§26.41) |
| `anagraficaScuole.ts` | ~175 | **Solo-Node, superficie pubblica** dell'anagrafica (ri-esporta i due moduli sopra): `scuolaDaCodice` (sede o istituto di riferimento), `scuolaDaNome` (**solo se univoco**, con provincia e ripetendo senza la sigla iniziale: «I.C. Ferruccio Ulivi» → «Ferruccio Ulivi»), `nomeDaAnagrafica` (denominazione dell'ISTITUTO passata dal gate §26.20) e **`arricchisciDaAnagrafica`** → patch `{ school_code, school_name, contact_email, school_pec }` **solo sui campi mancanti**. Usata da `scripts/arricchisci-interpelli.ts` e dallo scraper (`arricchisciConAnagrafica`, §26.41): Radar Pubblico, Personale e Regionale leggono le stesse righe arricchite. Verificato da `npm run test:anagrafica` |
| `mieiDocumenti.ts` | 130 | **Storage personale** «I Miei Documenti» (localStorage, nessun upload): `MioDocumento`, `STORAGE_KEY_MIEI_DOCUMENTI`, limiti (`LIMITE_DOCUMENTI` 6 · `LIMITE_BYTE_DOCUMENTO` 1 MB · `LIMITE_BYTE_TOTALE` 3,5 MB · `TIPI_AMMESSI`), `validaNuovoDocumento` (esito ESPLICITO: mai un rifiuto silenzioso), `leggi`/`salva` (quota piena segnalata), `aggiungi`/`rimuovi`, `byteTotali`, `formattaDimensione`. Verificato da `npm run test:documenti` |

### 2.8 `src/hooks/`

| File | Responsabilità |
|---|---|
| `useLocalStorage.ts` | `useLocalStorage<T>(key, initial)` con gestione quota errors |
| `useGoogleOneTap.ts` | Carica GSI su entry pages, `signInWithIdToken` con client ID Google; solo se non autenticato |
| `useReferral.ts` | Referral: genera codice fallback client-side (stessa regola trigger), `ReferralStats`, `ReferralEntry`, link `?ref=` |
| `useTestiEditabili.ts` | **Testi modificabili (DEV)**: il registro `src/data/editableTexts.ts` per le PAGINE che rendono per CHIAVE — `useTestiEditabili()` con `testo(chiave)` (override DEV → default del registro), `imposta(chiave, valore)`, `azzera()`, `testi`, `modificati` (`useSyncExternalStore` sullo store `@/lib/testiModificabili`). Override attivi **solo** con `import.meta.env.DEV` (§26.27). L'API `useTestiInPagina()` e il registro delle viste `src/lib/testiInPagina.ts` sono stati rimossi con il pannello che li usava (§26.38) |

### 2.9 `src/departments/` — 5 domini verticali isolati

Ogni dominio è una **unità autonoma** (`index.ts` = unica superficie pubblica; import
interni fra domini vietati dal gate) con la struttura `components/ · hooks/ · services/ ·
data/ · types.ts`. Dettaglio e regole: [`DEPARTMENT_MAP.md`](./DEPARTMENT_MAP.md), §1.5–§1.6.

| Dominio | File | Righe | Sottocartelle | Entry `index.ts` |
|---|---|---|---|---|
| `radar/` | 32 | 4.700 | `wizard/` (+`components/`) · `preferenze/` · `flightBoard/` · `components/` | `RadarWizardModal`, `PreferenzeRadar`, `RadarStatusToggle`, `BenvenutoProRadar` |
| `notizie/` | 21 | 4.922 | `components/` (+ `hero/`) · `services/` · `data/` | componenti Notizie + servizi/tipi |
| `scadenze/` | 11 | 1.236 | `components/` · `hooks/` | `RevolverScadenze` (+ `RevolverScadenzeProps`) |
| `admin/` | 22 | 3.120 | `tabs/` (+ `tabs/utenti/`) | `TabUtenti`, `TabRadar`, `TabAccount` |
| `cfu/` | 107 | 16.484 | `calcolatore/` · `engine/` · `dossier/` · `landing/` · `shared/` · `__tests__/` | `CalcolatoreCfuApp`, `CalcolatoreCfuLanding` |

> **Come si contano i numeri sopra** (snapshot 28/09/2026, così sono riproducibili): `File` =
> file `.ts`/`.tsx` sotto il dominio (`__tests__` inclusi); `Righe` = **righe non vuote** degli
> stessi file (`Get-ChildItem <dominio> -Recurse -File -Include *.ts,*.tsx | Get-Content |
> Measure-Object -Line`). Sono un indicatore di peso, non una soglia: le soglie vincolanti sono
> `W-DIM`/`E-DIM` in `scripts/check-architettura.ts`.

```tsx
// App.tsx — i domini si montano solo tramite entry point pubblici
<DepartmentErrorBoundary nome="notizie"><NotizieHero /></DepartmentErrorBoundary>
```

#### `departments/notizie/` — blog (dettaglio)

| File | Righe | Responsabilità |
|---|---|---|
| `types.ts` | 31 | `NewsArticle` (§3) |
| `index.ts` | — | Barrel exports (componenti + services) |
| `data/notizieSeed.ts` | — | Articoli editoriali seed |
| `data/notizieIngestite.ts` | — | **File GENERATO** dall'ingestione (accumulo, dedupe per id, refresh delle voci esistenti, SOLO fonti nazionali) |
| `services/newsFetcher.ts` | 573 | **Node-only** — fetch fonti **NAZIONALI** (`FONTI_ISTITUZIONALI`, `FONTI_GU_RSS`; **`FONTI_MIM_RSS = []`**: le fonti MIM si leggono via scraping/waterfall, non via RSS): MIM (`/web/guest/notizie`, `/web/guest/avvisi`, home, `/notizie`) + Gazzetta Ufficiale (RSS + elenco atti `/home`) + ARAN/giurisdizione; **waterfall** `LIVELLI_NAZIONALI`/`raccogliLivello` |
| `services/relevanceEngine.ts` | 815 | **Node-only, puro — ORCHESTRATORE** (§9): `valutaRilevanza` (anti-burocrazia: `attoBurocraticoVuoto`/`titoloInformativo`/`riferimentiObsoleti`, `categoriaDaImpatto`, waterfall nazionale), **allow-list dei temi 360°** (`classificaCategoria`/`classificaTemaPersonale` su `TEMI_OPERATIVI`), **anti-ufficio-stampa** (`titoloDaUfficioStampa`, `contieneFraseFluff`), **gate 2-bis** (`PAROLE_IMPATTO` + `PAROLE_SCUOLA`), **`titoloAzione`**, **`applicaFormatoEditoriale`** (`summary_points` a bullet, **DOPPIO LINK**), `articoloValido` (gate finale), `PAROLE_FORTI_INIZIO_ANNO`; **ri-esporta** i sotto-moduli qui sotto (superficie pubblica invariata per chi importava da qui) |
| `services/editorialVoice.ts` | 137 | **VOCE EDITORIALE unica** («colto ma sciolto»): `NOME_VOCE`, `REGOLE_VOCE` (10 regole con `id`, **`prima_menzione`** = ogni sigla/acronimo/termine spiegato alla PRIMA occorrenza), `bloccoVoceEditoriale()` (blocco pronto per i prompt), `APERTURE_VIETATE`/`apertureVietateTesto()`, `espandiAcronimi` (`GLOSSARIO_ACRONIMI`) |
| `services/promptEditoriale.ts` | 66 | I due prompt LLM: `promptFiltroLLM` (allow-list dei 20 temi) e `promptScritturaArticolo` (3 paragrafi, sezione `VOCE EDITORIALE` importata da `editorialVoice`, URL integrity) |
| `services/articoloEditoriale.ts` | 227 | Composizione dell'articolo: `generaArticoloEditoriale` (copy azione, fonte sempre citata), `linkDomandaUfficiale`, `richiedePresentazioneDomanda`, `CANALI_DOMANDA` |
| `services/articoloCopy.ts` | 184 | Copy editoriale per categoria: `ARTICOLO` (fatto / chi / pratica / come / portale), `IMPATTO_COPY` (welfare, formazione, sicurezza…) |
| `services/linkUfficiale.ts` | 240 | `classificaLink` (`diretto`/`contenitore`/`non-valido`), `etichettaLinkFonte`, `linkDirettoUfficiale`, `linkNonValidiInHtml`, `linkVietatiInHtml` |
| `services/fontiUfficiali.ts` | 174 | `èFonteCanonica`, `èFonteMim`, `èFonteNazionale`, `èLinkPdf`, `validaUrlDeepLink` (`SEGNALI_MOCKUP`/`SEGNALI_LOGIN`) |
| `services/cadenzaArticoli.ts` | 123 | Cadenza e tetti: `MAX_ARTICOLI_SETTIMANA = 3`, `FINESTRA_LOOKBACK_GIORNI = 15`, `FINESTRA_LOOKBACK_NAZIONALE_GIORNI = 60`, `MAX_ARTICOLI_FINESTRA = 6`, `limitaArticoliSettimanali`, `limitaCadenzaSettimanale`, `verificaCadenzaSettimanale` |
| `services/valutazioneTipi.ts` | 23 | Contratto della valutazione: `ValutazioneNotizia` (voce in ingresso e esito) e `VoceInValutazione` |
| `services/editorialStandard.ts` | 118 | Blocco **CONDIVISO** dello standard editoriale: `TEMI_OPERATIVI` (allow-list 360° in ordine di priorità = personale → IA → didattica), `AREE_TEMATICHE`, `PESI_CATEGORIA` (pesi dello scoring), `CATEGORIE_CON_FATTO_CONCRETO`, `temiDalTesto`/`areeTematicheDalTesto` (audit multi-tema) |
| `services/standardTemiPersonale.ts` | 235 | Temi operativi del PERSONALE (`TemaOperativo`: categoria, parole-chiave, macro-area, peso, flag `autosufficiente`) |
| `services/standardTemiIA.ts` | 36 | Tema AUTONOMO «**Intelligenza Artificiale**» (peso 76, `autosufficiente: false`, `fattoConcreto: true`, lessico `PAROLE_IA`): badge, copy e scoring propri; inserito fra i temi del personale e quelli didattici per non rubare il match ai temi storici, vince su innovazione digitale/didattica/pedagogia |
| `services/standardTemiDidattica.ts` | 59 | Temi CULTURALI/DIDATTICI (innovazione digitale — senza il lessico IA, ora autonomo —, didattica, pedagogia): pubblicabili solo con un **fatto concreto** |
| `services/lessicoScuola.ts` | 243 | Lessico **CONDIVISO** della scuola a 360 gradi: `PAROLE_OPERATIVE` (storico + voci 360° dedupe), `PAROLE_IA` (intelligenza artificiale, IA generativa, chatbot, machine learning…), `GLOSSARIO_ACRONIMI` (compresa la sigla `IA`), `FRASI_FLUFF` |
| `services/ingestNotizie.ts` | 566 | **Node-only** — CLI pipeline: **waterfall** livelli 1→4 → filtra → **gate procedura senza canale di presentazione** → gate link punto-a-punto → verifica HTTP 200 → **formattazione editoriale PRIMA dell'igiene** → **tetto settimanale** (`MAX_ARTICOLI_SETTIMANA`) con **riserve + `applicaGaranziaSettimanale`** → scrive `notizieIngestite.ts`; **exit 1 se la settimana resta vuota** (il workflow fallisce, niente silenzio) |
| `services/archivioNotizie.ts` | ~85 | Lettura/scrittura del file archivio (`scriviArchivioNotizie`, `leggiArchivioNotizie`, `estraiArticoliDaTesto`): unico punto di serializzazione di `notizieIngestite.ts` |
| `services/tracciaFonte.ts` | ~250 | **Node-only** — tracciamento della fonte granulare: `tokenizza`, `valutaCandidato` (numeri dell'atto decisivi), `scegliLinkSpecifico`, `risolviFonteGranulare` (da pagina-contenitore alla sottopagina/circolare/PDF) |
| `services/newsService.ts` | 185 | Frontend: `unisciNotizie` (seed+ingested, dedupe), **`ordinaNotizie`** (data di pubblicazione DECRESCENTE; il punteggio è solo tie-break), `newsArticles` (feed già ordinato), `categorieNotizie`, `getNotiziaById`, `formatDataNotizia`, `newsFallback` |
| `components/NotizieHero.tsx` | — | Hero editoriale pagina Notizie + `SeoMeta` |
| `components/NotizieGrid.tsx` | — | Griglia articoli + filtro categoria + CTA radar |
| `components/NotizieDettaglio.tsx` | — | Dettaglio articolo (in sintesi, link PDF, fonte) |
| `components/SeoMeta.tsx` | — | SEO: `document.title`, OG/Twitter meta, JSON-LD NewsArticle |

### 2.10 `src/modules/modulistica/` — dipartimento isolato (modulistica)

| File | Righe | Responsabilità |
|---|---|---|
| `index.ts` | — | Barrel exports (`ModuliModule`, components, creator) |
| `types.ts` | 30 | `VistaModulistica = 'archivio'|'intervista'|'miei'|'documenti'`, `ModuloSalvatoDB`, `VoceModulo` |
| `ModuliModule.tsx` | ~285 | Contenitore: ricerca live, macroaree, archivio, anteprima, teaser Archivista, "I miei Modelli", **terza tab «I Miei Documenti»**, nota accesso |
| `components/ModuliNavigation.tsx` | ~57 | Tab: Esplora archivio / I miei Modelli Scaricati / **I Miei Documenti** |
| `components/TabDocumentiPersonali.tsx` | 38 | Terza tab: intestazione + storage personale (`components/documenti/MieiDocumenti`), senza paywall PRO |
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
| `creator/ModuleCreatorErrorBoundary.tsx` | 66 | Error boundary del sotto-modulo creator |
| `creator/pdf/documento.ts` · `creator/pdf/layout.ts` · `creator/pdf/testo.ts` | 62 · 78 · 16 | **Generatore PDF modulare**: costruzione del documento A4, layout/paginazione, normalizzazione del testo |
| `creator/pdf/stili*.ts` (`stiliBase`, `stiliStampa`, `stiliBlocchi`, `stiliDensita`, `stiliDocumento`) | 175 · 170 · 141 · 148 · 18 | Stili del documento (base, stampa, blocchi, densità, override finale) — riferimento [`PDF_DESIGN_SYSTEM.md`](./PDF_DESIGN_SYSTEM.md) |
| `creator/logoDataUri.ts` | 9 | Logo come data-URI per il PDF (nessuna dipendenza da `public/`) |


### 2.11 `src/pages/` — 24 pagine (+ 14 file di supporto = 38 file; 30 `<Route>` in `App.tsx`)

| File | Responsabilità |
|---|---|
| `LandingPage.tsx` | Home pubblica: hero, simulatore radar, servizi, pricing snippet, footer condiviso (`Footer`) |
| `PrezziPage.tsx` 🔒 | Pagina prezzi / offerta PRO + PureFocus. **BLOCCATO** (intervento autorizzato 29/09/2026: sola sezione FAQ dall'elenco condiviso) |
| `ChiSiamoPage.tsx` 🔒 | Pagina istituzionale. **BLOCCATO** |
| `FAQPage.tsx` | Domande frequenti (pubblica): 8 voci e ancore da `data/faqPubbliche.ts`, testi dal registro (§26.27; selezione editoriale in §26.29) |
| `ServiziPage.tsx` | Griglia servizi da `data/servizi.ts` |
| `ServizioPage.tsx` | Dettaglio servizio per slug |
| `ContattiPage.tsx` | Form contatti + info |
| `NotiziePage.tsx` | Wrapper `NotizieHero`+`NotizieGrid` |
| `NotizieDettaglioPage.tsx` | Wrapper `NotizieDettaglio` |
| `InterpelloDettaglioPage.tsx` | Scheda PUBBLICA dell'avviso (`/interpello/:id` — LEGACY, deep link storici): risolve per `id`/`hash_id` (fallback `notices`), gerarchia strutturata, **guida operativa** quando la pagina è un elenco/"Stampa" o la fonte manca, **un solo** bottone verso la fonte ESTERNA con etichetta onesta; stato "non più disponibile" con link al Radar (mai rimbalzo sulla Home) |
| `AuthCallback.tsx` | Rotta ritorno Google OAuth: **ATTENDE la sessione** (polling `getSession` fino a 8 s) prima di rimbalzare alla home — lo scambio PKCE è asincrono, quindi niente più «ospite» al primo render né secondo click su «Accedi» |
| `OnboardingPage.tsx` | Wizard onboarding preferenze + collegamento Telegram |
| `DashboardPage.tsx` | `DashboardLayout` (tab + `Outlet`) + `DashboardPage` (Radar Scuole: notifiche restanti, abbonamento, crediti, feed, blacklist) |
| `CvPage.tsx` / `CfuPage.tsx` | Wrapper `CvTool` (`components/`) / `CalcolatoreCfuApp` (`departments/cfu/`) |
| `AssistenteAIPage.tsx` | Chat Assistente Sindacalista (demo simulata, paywall) |
| `ModuliPage.tsx` | Wrapper `ModuliModule` |
| `PureFocusPage.tsx` | Vetrina PureFocus condivisa (`PureFocusCard`: wordmark ufficiale, badge «Incluso nel piano PRO», link a purefocus.one) con CTA dinamica PRO/Base |
| `ProfiloPage.tsx` | Gestione profilo, preferenze, Telegram, account |
| `InvitaPage.tsx` | Referral (`ReferralSection`) |
| `AdminPage.tsx` | Pannello admin (indirizzi autorizzati): diagnostica, override, statistiche (monta `departments/admin`) |
| `dashboard/CalcolatoreCFUDashboardPage.tsx` | Calcolatore CFU dentro la dashboard (`DashboardLayout`) |
| `dashboard/components/**` | `DashboardLayout`, `DashboardNav`, `ElencoOpportunita`, `VetrinaRadarOspiti`, `BannerBozzaOnboarding` |
| `interpello/**` | `InterpelloDettaglioPage`, `SchedaAvviso`, `AvvisoAssente`, `ReindirizzamentoAllaFonte`, `helpers` |
| `onboarding/**` | `OnboardingPage` + `components/` (wizard 4 passi: ordini, classi/materie, province, canali; l'anagrafica facoltativa — genere/età — è in **chiusura**, nel passo 4) |
| `CalcolatoreCFUPage.tsx` · `CheckoutRedirectPage.tsx` | Landing calcolatore · redirect post-checkout Stripe |

### 2.12 `src/scraper/` — Node-only

| File | Righe | Responsabilità |
|---|---|---|
| `index.ts` | 1.747 | Pipeline scraper interpelli (§5.3): env, province attive da `profiles`, **selezione delle FONTI** (`fontiPerRun`: hub dei capoluoghi + feed nazionale), connettori hub/aggregatore, gate di conformità (§5.3), **espansione ELENCHI** (`espandiElenchi`), dedupe hash_id, upsert `interpelli`/`notices`, notifiche ai nuovi |
| `fonti.ts` | 190 | **Node-only, puro** — registro fonti: tipi (`FonteInterpelli`, `TipoFonte`), costruzione del catalogo (dati in `fontiRegistro.ts`), `regioneDiProvincia`, `fontiAttive`, `fontiPerProvincia`, `fontiPerRun` (hub locali → feed nazionale; archivi opt-in `SCRAPER_ARCHIVI=1`), tetti `MAX_FONTI_PER_PROVINCIA`/`MAX_FONTI_PER_RUN` |
| `fontiRegistro.ts` | 111 | **Node-only, puro** — SOLO DATI del registro: feed dell'aggregatore (indice nazionale + archivi regionali) e hub di reclutamento USR/USP dei capoluoghi. Ogni URL verificata (HTTP 200) con data; le fonti non verificabili stanno in `HUB_ESCLUSI` col motivo (mai copertura finta) |
| `fontiCopertura.ts` | 81 | **Node-only, puro** — copertura dichiarata: `regioniCoperte`/`regioniScoperte`, `CAPOLUOGHI_PRINCIPALI` (Torino…Perugia), `fontiPerCapoluogo`, `capoluoghiScoperti`, `sintesiCopertura` (log) |
| `hub.ts` | 111 | **Node-only, puro** — connettore dei capoluoghi: `eUrlSezioneReclutamento`/`scopriSezioniReclutamento` (dalle pagine USR si scoprono le sezioni interpelli/avvisi, max `MAX_SEZIONI_HUB`), `eTitoloNavigazione` (menu/archivi/ricerca non sono avvisi) |
| `qualitaOpportunita.ts` | 202 | **Node-only, puro** — conformità della bacheca: `eContenutoEditoriale`/`motivoScartoEditoriale` (separazione dal dominio Notizie), `eTitoloInformativo` (esiti/graduatorie), `motivoScartoOpportunita` (editoriale → informativo → non-opportunità → categoria → scaduto), `eRecordStrutturato` e **`valutaGateLink`** (ping fallace ≠ record scartato) |
| `elenchi.ts` | ~215 | **Node-only, puro** — espansione delle PAGINE INDICE ("elenchi" USR/USP): `eUrlElenco`/`sembraTitoloElenco`/`ePaginaElenco` riconoscono l'elenco, `estraiVociElenco` estrae **una voce per avviso** (riga più specifica vince, mai la lista master), `espandiElencoInAvvisi` le trasforma in avvisi strutturati con link proprio |
| `parser.ts` | ~600 | Parser: `rilevaClassi` (A-XX/ADEE + compatti A042/AB25), `rilevaCategoriaAvviso`, `sembraOpportunita`, `estraiProvincia`/`estraiScuola` (dai dati reali; **`ALIAS_CITTA` completata** — es. **Forlì → FC**, Monza → MB, Pesaro → PU, Barletta → BT, Carbonia → SU, La Spezia → SP: prima un avviso di Forlì-Cesena ricadeva sulla provincia della FONTE, es. TO), `estraiDataPubblicazione`/`estraiDataScadenza` (pubblicazione ≠ scadenza; **due passate** per la scadenza: parola chiave PRIMA della data, poi DOPO — "Pubblicato il 12/09/2026. Scadenza: 15/09/2026" → **15/09**, non 12/09), `inferisciMateria`, `estraiEmail`, **`scegliUrlFonte`** (solo candidati con `eUrlAvvisoDiretto`: **mai la home dell'ente** né un elenco regionale, nessun fallback → `null`), `verificaAvviso`/`eSorgenteVerificata` (anti-mock/dummy), `generaHashId`, `parseInterpello` |

### 2.13 `src/services/` + `src/types/`

| File | Responsabilità |
|---|---|
| `services/healthCheck.ts` | `eseguiHealthCheck(): Promise<HealthCheckResult[]>` — test DB, auth, env, edge functions, rotte SPA, promo BETA1ANNO. Il ping di `checkout` (protetta da JWT): **401 in Guest = OK** (la configurazione Stripe non va esposta a un anonimo), errore solo se il 401 arriva CON una sessione attiva |
| `types/google-one-tap.d.ts` | Tipi GSI (`google.accounts.id`) |
| `vite-env.d.ts` | Tipi import.meta.env |

### 2.14 `supabase/functions/` — 10 Edge Functions (Deno) + `_shared`

| Funzione | Righe | Auth | Scopo / payload |
|---|---|---|---|
| `send-notification` | ~330 | `x-send-secret` | Step drip (step1 welcome, step5 avviso finale), welcome_pro, notifiche beta/rinnovo, scadenza avvisi; payload `{ tipo, userId, email, nome, chatId, titolo, ... }`; invia email Resend + Telegram. **GATE DI QUALITÀ**: per i tipi di opportunità (`step2`/`step3`/`step4`/`notifica_pro`/`prova1..3`/`extra`) l'invio è **saltato** se manca il link diretto o il recapito (`motivoAvvisoNonInviabile`); brand compatto + CTA Notizie a due righe + anteprime disattivate |
| `genera-modulo` | 1327 | JWT | Azioni `intervista/genera/ricerca/salva/rimuovi/miei`; DeepSeek + cache `generated_modules`; intervista chirurgica con impronta SHA-256 (§7.4) |
| `checkout` | 288 | JWT | Sessione Stripe Checkout; `{ plan, promo?, quantita?, origin }`; valida promo/referral, coupon -10€; ritorna `{ url }` |
| `webhook` | 215 | firma Stripe HMAC | Eventi Stripe → piano pro / crediti / referral; ack sempre 200 |
| `admin` | — | JWT + `ADMIN_EMAILS` | Operazioni admin (es. override piano/crediti, diagnostica) |
| `contatto` | — | pubblico + anti-spam | Form contatti → Resend a `CONTACT_SUPPORT_EMAIL`; honeypot, alfabeti, impronte spam, max 3 link |
| `elimina-account` | 80 | JWT | Cancella utente da `auth.users` via `admin.auth.deleteUser` (cascade su profiles) |
| `telegram-webhook` | 138 | `X-Telegram-Bot-Api-Secret-Token` | `/start <user_id>` → aggiorna `profiles.telegram_chat_id` + conferma. Ogni messaggio parte dal **brand compatto cliccabile** con **anteprime disattivate** |
| `telegram-admin-webhook` | ~435 | secret header + `ADMIN_TELEGRAM_ID` | Bot Telegram ADMIN **separato** dal bot pubblico: comandi solo da `ADMIN_TELEGRAM_ID` (`/status`, `/ultimi`, `/log`, `/forward`, …), **alert helper** (`ADMIN_ALERT_SECRET` → notifica proattiva su fallimenti/anomalie), log in `admin_telegram_log`, inoltro opz.; brand compatto in testa e anteprime disattivate |

### 2.15 `supabase/migrations/` — 52 migration (§13 e §14 per dettagli)

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
`...31190000_add_template_versioning` · `...31200000_add_profiles_genere` ·
`...20260901000000_add_account_bridge` · `...20260901010000_update_welcome_email` ·
`...20260902000000_create_school_deadlines` · `...20260902010000_free_forever_plan` ·
`...20260902020000_admin_support` · `...20260902030000_add_pro_tipo` ·
`...20260902040000_beta_testers_view` · `...20260902110000_add_profiles_genere_eta` ·
`...20260902230000_sync_oauth_profiles` · `...20260902234600_free_forever_account_bridge` ·
`...20260902234800_ffe_rinnovo_email` · `...20260903000000_add_radar_attivo` ·
`...20260903010000_add_is_free_forever` · `...20260903020000_free_forever_bypass` ·
`...20260903030000_default_new_user_pro_1anno` · `...20260903040000_new_user_pro_trial_30gg` ·
`...20260903050000_coupon_radar50_drip_guard` · `...20260903060000_add_interpelli_published_at` ·
`...20260903070000_admin_telegram_log` · `...20260903080000_scraper_runs_and_alerts` ·
`...20260903090000_add_interpelli_materia_contact` ·
`...20260903100000_preavvisi_rinnovo_trial_pro` ·
`...20260903110000_profiles_auth_upsert_guard` ·
`...20260914000000_fix_pampararo_cognome` · `...20260914010000_notifications_log` ·
`...20260914020000_channel_posts_log` ·
`...20260914030000_repair_notifications_log_e_rpc_quota` ·
`...20260914040000_add_profiles_sostegno` ·
`...20260924120000_coupon_scuoleradar50_unico` · `...20260927120000_default_sostegno_incluso`

**REPAIR notifiche** (`...20260914030000_repair_notifications_log_e_rpc_quota.sql`): DDL
idempotente che (1) ri-asserisce la tabella `notifications_log` (mai applicata) e
(2) corregge l'errore `42702` della RPC `incrementa_notifiche_utente`. Causa della
regressione: `20260831100000_add_rpc_notifiche_annuali_reset_extra.sql` aveva ridefinito
la funzione con un `select piano, notifiche_usate, notifiche_anno into …` NON qualificato,
mentre `RETURNS TABLE(…, notifiche_usate integer)` crea un OUTPUT PARAMETER omonimo: il
fix corretto (`20260831150000`) non era mai stato applicato. La riparazione qualifica le
colonne (`p.`) e aggiunge `#variable_conflict use_column` come blindatura definitiva.
Verifica: **`npm run db:verifica`** (sonda senza effetti collaterali: tabella + RPC con un
UUID inesistente) e **`npm run test:migrazioni`** (regression guard statico sui file SQL).

**PREFERENZA SOSTEGNO** (`...20260914040000_add_profiles_sostegno.sql`): aggiunge la colonna
idempotente `profiles.sostegno boolean not null default false` e fa il BACKFILL dell'adesione
implicita (chi ha già una classe `AD*` in `classi_concorso` → `true`), così la nuova guardia
del matching non toglie copertura a chi riceveva legittimamente gli avvisi di sostegno.
`npm run db:verifica` sonda anche `profiles.sostegno` (3ª riga di esito).

**SOSTEGNO INCLUSO DI DEFAULT** (`...20260927120000_default_sostegno_incluso.sql`): la
colonna `profiles.sostegno` passa a `not null default true` e il BACKFILL porta a `true`
anche i profili esistenti — nessun avviso di sostegno (ADAA/ADEE/ADMM/ADSS) viene più
filtrato via in silenzio. *(Dal **04/10/2026**, §26.45, la colonna è un valore STORICO: il
sostegno è a **inclusione permanente**, non è più una preferenza e non ha alcuna uscita —
la consegna non dipende più da `profiles.sostegno`.)*
Guardie: `npm run test:sostegno`, `npm run test:migrazioni`, `npm run test:copy:pubblico`.

### 2.16 `.github/workflows/` (6), `docs/` (7), `scripts/` (71), `public/`

| Percorso | Contenuto |
|---|---|
| `.github/workflows/scraper.yml` | Scraper Interpelli: cron Lun-Ven `0 7,12,15 * * 1-5` + dispatch; secrets SUPABASE_*/RESEND/TELEGRAM; `npm ci` → `scrape:check` → `npm run scrape` (inserimento + canali Telegram + **alert PRO in tempo reale**) → commit del ledger via `bash scripts/commit-ledger.sh` (unione chiavi + retry) |
| `.github/workflows/digest.yml` | **Riepilogo/BATCH giornaliero**: cron Lun-Ven `0 15,16 * * 1-5` (una delle due esecuzioni cade alle 17:00 italiane: lo script invia solo se `eOraDelDigest` lo conferma) + dispatch (`force: true`); `npm ci` → `scrape:check` → `test:digest` + `test:migrazioni` → **`db:verifica`** (sonda schema, warning non bloccante) → `npm run notifiche:digest` → **`npm run notifiche:promemoria`** (promemoria 24h sulle voci di ieri in scadenza vicina, `continue-on-error`, guardia nel ledger) → commit del ledger via `bash scripts/commit-ledger.sh`. **PRO**: già avvisati in tempo reale dallo scraper; **BASE**: batch Telegram + email |
| `scripts/verifica-schema-notifiche.ts` | **`npm run db:verifica`** — sonda SENZA effetti collaterali dello schema notifiche: esistenza di `notifications_log`, risposta della RPC quota con un UUID inesistente (atteso `(false, 0)`) e presenza di `profiles.sostegno`. Exit 1 + remediation se manca una migrazione |
| `scripts/test-migrazioni.ts` | **`npm run test:migrazioni`** — regression guard statico su `supabase/migrations`: ledger idempotente con PK/RLS/grants, ULTIMA definizione della RPC non ambigua (blocca il ritorno dell'errore 42702) e colonna+backfill della preferenza sostegno |
| `scripts/test-sostegno-preferenza.ts` | **`npm run test:sostegno`** — AREA SOSTEGNO (§26.45): riconoscimento codici `AD*`/titolo (`isCodiceSostegno`, `eAvvisoSostegno` → `avvisoDiSostegno`), REGOLA UNICA (sostegno **sempre consegnato**, nessun opt-out, ma l'inclusione non supera la provincia) e matching, alert in tempo reale (PRO) e digest in DRY-RUN con client stub (docente di tedesco A-22 che riceve l'avviso ADEE, DB non migrato) |
| `scripts/test-promemoria.ts` | **`npm run test:promemoria`** — oggetti branded (`Scuole Radar — Nuova opportunità per A-22 (Torino)`, digest, promemoria), guardia "una email al giorno" (`chiaveDigestGiorno`, con lancio forzato che la ignora) e **promemoria 24h** con client stub: filtra 24h/urgenza/provincia/scaduti, UNA email per utente e **anti-duplicato** (secondo giro → 0 invii; ledger DB assente → 0 invii) |
| `scripts/test-dedup-utente.ts` | **`npm run test:dedup:utente`** — **registro invii per utente** (§6.5.1): identificatori stabili (hash/impronta/URL), guard PRIMA dell'invio e registrazione immediata dopo, **per canale** (email ≠ telegram) con compatibilità legacy; caso **Liceo Monti** end-to-end sul DIGEST con sender iniettati: hash diverso ⇒ 0 invii, avviso diverso ⇒ 1 invio; impronta `A-022 ≡ A-22 ≡ A042`; ledger DB assente ⇒ guard dal file |
| `scripts/invia-promemoria.ts` | **`npm run notifiche:promemoria`** — runner del promemoria 24h (`--dry-run`, `--force`, `--ore`, `--giorni`, `<email\|uuid>`), eseguito dal workflow `digest.yml` dopo il digest |
| `scripts/unione-ledger.ts` (`npm run ledger:unisci`) | Unisce il ledger del run con quello del branch remoto e scrive l'unione: è il passo che impedisce a scraper e digest (stessi minuti) di **cancellarsi le chiavi a vicenda** |
| `scripts/commit-ledger.sh` | Commit del ledger usato da `scraper.yml`/`digest.yml`: fetch del remoto → unione chiavi → commit → push con **3 tentativi** (mai "vince l'ultimo") |
| `.github/workflows/scrape-notizie.yml` | Scraper Notizie: cron giornaliero `0 6 * * *` + dispatch; `contents: write`; `npm ci` → `scrape:notizie:check` → `npm run scrape:notizie` → commit dati (`[skip ci]`) se cambiati |
| `.github/workflows/health-check.yml` | **Radar Health Check** (Admin bot): cron giornaliero `0 8 * * *` + dispatch; `npm run admin:health` → rileva *dispatch personale fermo* (avvisi **notificabili** senza notifiche), *canali non alimentati*, *consegne personali ferme da N giorni*, *scraper fermo/in errore* e *Notizie ferme*; invia alert a `ADMIN_TELEGRAM_ID` via `inviaAlertaAdmin` (`ADMIN_ALERT_SECRET`, fail-closed). Env: `HEALTH_STALE_HOURS` (48), `HEALTH_NEWS_STALE_DAYS` (14), `HEALTH_DELIVERY_STALE_DAYS` (7) |
| `scripts/admin-health-check.ts` | CLI del monitor (`npm run admin:health [-- --dry] [-- --hours N]`, §26.66): la ricognizione sta in `scripts/lib/saluteDispatch.ts` (+ `avvisiNotificabili.ts`), il CLI legge `interpelli`, `notifications_log`, `channel_posts_log`, `scraper_runs`, `profiles.radar_attivo` e l'archivio `notizieIngestite.ts`; exit 1 solo per anomalie critical/warning (le voci `info` non colorano il cron) |
| `scripts/arricchisci-interpelli.ts` | Manutenzione dati (`npm run dati:arricchisci [-- --apply]`): completa `school_code`, `contact_email` (PEO dalla convenzione MIM) e `school_name` (registro) sugli interpelli esistenti, senza mai sovrascrivere dati presenti |
| `scripts/test-live-board.ts` | Regressione vetrina Radar Live (`npm run test:board`, in `npm test`): righe incomplete arricchite o scartate, mai placeholder; i valori REALI dei `school_name` sporchi (etichette di posto, dump di classi) non entrano in bacheca e i nomi reali con coda di procedura vengono ripuliti |
| `scripts/test-nome-istituto.ts` | Regressione del gate dei nomi d'istituto (`npm run test:nome-istituto`, in `npm test`): codici amministrativi («EEEE \| A246», «AAAA \| A246», «BA02 \| AR04»), etichette di posto/materia, atti amministrativi e artefatti (`timbro_…`) mai in vetrina; nomi reali accettati e coda di procedura tagliata |
| `scripts/test-email-scuola.ts` | Regressione email (`npm run test:email-scuola`): de-offuscamento, correlazione con l'istituto, **PEO/PEC dalla convenzione MIM** e completamento automatico nel parser |
| `scripts/test-email-template.ts` | Regressione template email (`npm run test:email`): **oggetto standard `Nuove opportunità per te!`** (digest/opportunità) e oggetti di ciclo di vita invariati, logo reale, titolo pulito dai dump di codici classe, **footer crisp** (link Radar visibile con URL in chiaro, CTA Notizie email a due righe `scuoleradar.it/notizie` + `… vieni qui!`, avviso "non rispondere" in ULTIMA riga, nessun "P.S.", nessun grigio `#94a3b8`) |
| `scripts/test-radar-preferenze.ts` | **`npm run test:radar:preferenze`** — preferenze Radar: normalizzazione classi (`A-18` ≡ `A18` ≡ `a 18`), dedup/persistenza (load/save normalizzati in `contexts/app/*`), testo UI **"Dove vuoi lavorare?"**, etichetta **"Le tue competenze e laboratori extra da proporre:"**, 12 tag PNRR/PON, **persistenza ISTANTANEA** del wizard (ordini/province/classi/competenze/tag) e assenza di elenchi statici di materie |
| `scripts/test-ricerca-unificata.ts` + `scripts/test-ricerca-cablaggio.ts` | **`npm run test:ricerca`** — ricerca unificata: normalizzazione query (accenti/spazi/trattino), classi per codice/denominazione/**materia collegata** («Pedagogia» → A-18) e **ordine di scuola** («CPIA», «adulti», «primaria»), competenze extra, parola chiave proposta/dedup, marcature «già nel profilo», **separazione dei campi** (destra: nessuna classe — §26.46); guardie STATICHE di cablaggio nel file gemello (un solo campo nel passo 3, colonna di sinistra = classi, colonna di destra = competenze/parole chiave) |
| `scripts/test-pipeline-tollerante.ts` + `scripts/test-match-rpc.ts` | **`npm run test:pipeline`** / **`npm run test:match-rpc`** — (1) PIPELINE TOLLERANTE (§26.47): nessun mock (feed di fallback vuoto, nessun nome-scuola sintetico nei moduli di produzione, nessuna fixture nello scraper), stato anagrafica `completo`/`parziale`, e **nessun avviso genuino scartato** per anagrafica (casi Padova: riga presente con nome grezzo del bando o dicitura gestita, marcatore `anagraficaParziale`, restano fuori solo scaduti e fuori finestra); (2) MATCHING NATIVO: contratto SQL della RPC `match_interpelli` (`security definer` + `search_path`, `stable`, overlap `&&` su GIN, forme tolleranti, ramo sostegno, «attivi», grants) e client `searchInterpelli` (RPC per prima con province deduplicate, varianti di formato e sostegno sempre incluso; fallback PostgREST equivalente se la migrazione non è applicata) |
| `scripts/test-provincia-principale.ts` | **`npm run test:province`** — provincia PRINCIPALE (prima selezionata): badge/pill, promozione in testa, e **sopravvivenza al downgrade** (`limitaProvinceMantenendoPrincipale`: a Base resta la principale, mai una di contorno) + self-heal nel contesto |
| `scripts/test-sessione-identita.ts` | **`npm run test:sessione`** — sessione/identità: `identitaDaSessione` (full_name, campi espliciti, mai sovrascritture), bootstrap che sincronizza l'identità dalla sessione trovata, listener su `TOKEN_REFRESHED`/`USER_UPDATED`, `AuthCallback` che attende la sessione, wizard che rilegge il piano appena arriva l'identità |
| `scripts/test-copy-etico.ts` | **`npm run test:copy:etico`** — COPY ETICO: scansione di `src/**` per le frasi competitive («prima degli altri», «beccare»…) e delle superfici UI/marketing per quelle di fretta; verifica la copy del banner PRO («Un mese PRO, completamente gratis… puoi dedicarti alla tua vita»), il Passo 4 senza urgenza né formule debole, l'anagrafica a **fine percorso**, l'hero a due colonne col simulatore e l'offerta PRO senza toni da televendita |
| `scripts/test-copy-pubblico.ts` | **`npm run test:copy:pubblico`** — COPY PUBBLICO: regalo di benvenuto PRO («Buone notizie», nessuna voce di rinvio), wordmark PureFocus (Pure `#0E0C0A` + Focus `#0047AB`, mai l'emoji-icona), badge «Incluso nel piano PRO», Chi siamo e FAQ come punti di forza commerciali |
| `scripts/test-copy-primo-schermo.ts` | **`npm run test:copy:schermo`** — COPY PRIMO SCHERMO: hero su **due righe** (`span block`, nessuna interruzione di markup), box «Prova il Radar» **non stirato** (`items-start`, niente `h-full`) con ripartizione verticale `lg:items-center` e i pulsanti **SUBITO SOTTO il box su due colonne simmetriche** (`mt-3 grid w-full gap-3 sm:grid-cols-2`, entrambi `w-full`), responso a scorrimento (`max-h-[24rem]`), nessun riquadro ridondante fra Radar Live e offerta PRO (§26.15, §26.16, §26.19) |
| `scripts/test-qualita-invio.ts` | **`npm run test:qualita`** — gate di qualità: link diretto (`eUrlAvvisoDiretto`), gate link+recapito, mappatura province (Forlì → FC), brand/anteprime, frequenza CTA Radar ~20% |
| `scripts/test-canali-telegram.ts` | **`npm run test:telegram:canali`** — post dei canali regionali: brand cliccabile in testa, 7 sezioni, testate tipografiche (nessuna fascia colorata/`[BADGE]`, nessuna immagine), **URL ufficiali mai in chiaro** (solo il bottone `👉 Apri l'avviso ufficiale`), **gate link diretto** (home regionale, elenco/tag, landing regionale, ricerca e "nessun link" → post senza link e pubblicazione annullata) + matrice di routing delle 9 regioni + ATA nazionale |

| `docs/MODULAR_ARCHITECTURE.md` | **Regola architetturale vincolante**: SRP, limiti di righe (250/300), gerarchia a 3 livelli, codici del gate, regole di baseline |
| `docs/DEPARTMENT_MAP.md` | Mappa dei dipartimenti: isolamento per dominio, gerarchia degli import, inventario con numeri reali, debito congelato e backlog |
| `docs/STRUCTURAL_AUDIT.md` | Audit strutturale e refactoring slice-per-slice (monoliti, contesti, domini) |
| `docs/RADAR_ROADMAP_V2.md` | Roadmap evolutiva del Radar |
| `LOCKED_MODULES.md` | Registro moduli bloccati (§19) |
| `docs/BLOG_EDITORIAL_GUIDELINES.md` | Regole d'oro del blog: max 3 articoli/settimana, zero rumore, acronimi spiegati |
| `docs/PDF_DESIGN_SYSTEM.md` | Design system PDF (A4, tabelle clean, righe scrittura 24px) |
| `docs/SYSTEM_HANDOVER.md` | QUESTO FILE |
| `scripts/` | Test/utility: `invia-digest.ts` (`npm run notifiche:digest`), `verifica-schema-notifiche.ts` (`db:verifica`), `test-digest.ts`, **`test-telegram-tier.ts`** (split PRO/BASE + dedup per canale), **`test-ledger-robustezza.ts`** (`test:ledger`), `test-migrazioni.ts`, `admin-dispatch-user.ts`, `test-pdf-*.ts`, `_validate-modulistica.ts`, ecc. |
| `public/` | **Set favicon UFFICIALE** (§1.4): `favicon.ico` (multi-misura 16/32/48), `favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-256.png`, `apple-touch-icon.png` (180×180, opaco) + `logo.png` (882×212: tessera azzurra + radar bianco, **sorgente** del set). Rigenerazione `npm run favicon`, guardia `npm run test:favicon`. Gli asset della **vecchia identità scura** (`ScuoleRadar Favicon Square.png` 2,4 MB, `ScuoleRadar Logo Transparent Full Final.png` 3,5 MB, `favicon_old.svg`, `logo_old.png`) sono stati **rimossi** il 2026-09-22: non devono tornare nel sito servito |


---

## 3. Stato globale & Data Models TypeScript

### 3.1 `AppContext` (`src/contexts/AppContext.tsx`, 282 righe) + hook di contesto

⚠️ Il provider **non è più un monolite**: `AppContext.tsx` è la **facade** che compone i
hook di `src/contexts/app/` (tabella completa in §2.5) e riesporta `useApp`; i tipi dello
stato vivono in `contexts/app/types.ts`, le costanti in `contexts/app/costanti.ts`.

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
(`ignoredSchools` applicato su `istituto + titolo`). Dal **§26.55** la provincia è
ammessa anche entro il raggio di 60 km (`provinciaCompatibile`, §26.56) e ogni
avviso superstite passa da `valutaCompatibilita` (penalità di scostamento + motivo)
per chiudere con `limitaRiempitivi` (max 5 sotto il 70%, nessuno con 10 match di
qualità): la bacheca è graduata, la consegna resta strict.

### 3.2 Altri data models principali

```ts
// src/data/interpelli.ts
interface Interpello {
  id: string; titolo: string; istituto: string;
  provinciaCodice: string; provinciaNome: string; classeCodice: string;
  classiCodes?: string[]; ordine: OrdineScuola; dataScadenza: string;
  descrizione: string; linkFonte: string; compatibilita: number;
  motivoCompatibilita?: string | null; // sintesi delle modali (punteggio, §26.56)
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
type VistaModulistica = 'archivio'|'intervista'|'miei'|'documenti';
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
- **`src/data/interpelli.ts`**: tipo `Interpello` + fallback **VUOTO**
  (`interpelli = []`). Nessun dato demo/mock: la policy anti-segnaposto
  (`verificaAvviso` / `eSorgenteVerificata` in `src/scraper/parser.ts`) scarta
  qualsiasi avviso o URL fittizio (`esempio-N`, `example.com`, `localhost`,
  fixture/dummy) prima del salvataggio. Guard test: `npm run test:dati-fallback`.
- **`src/data/classiConcorso.ts`**: `ClasseConcorso[]` con `{ codice, denominazione, ordine,
  materie[], requisitiCfu[] }`; `classeByCodice(cod)` per il mapping.
- **`src/data/province.ts`**: 107 province; **`src/data/ordiniMaterie.ts`**: 8 `OrdineScuola`
  (incl. cpia, serali, pon, ata) + `materie`.
- **Fonte reale**: tabella Supabase **`interpelli`** (popolata dallo scraper; fallback legacy
  `notices`). Nessun fallback mock: senza avvisi attivi la UI mostra lo stato vuoto.

### 5.2 Matching Engine (`src/lib/matchingEngine.ts`)
Modulo puro (client passato come parametro → testabile frontend+Node):
- `searchInterpelli(client, { province?, classi?, limit? })`: query `interpelli` con
  `.in('province', prov)` + `.overlaps('class_codes', classi)` (almeno una classe comune),
  `.order('expiration_date')`, `.limit(100)`.
- `getFeedInterpelli(...)`: mappa righe DB → `Interpello[]` (`mapInterpelloDBToInterpello`).
- `findUtentiCompatibili(client, { province, classi, titolo?, materia? })`: legge **tutti** i `profiles`
  (select dei campi notifica + `sostegno`, `materie_id`, `materie_custom`), filtra: email valida **o**
  Telegram, poi applica la **regola unica** `avvisoCompatibileConProfilo` (vedi §6.5.2): provincia del
  profilo == provincia dell'avviso, intersezione reale di classi (o materia coperta), **competenze e
  parole chiave** per i profili senza classi (§26.35), guardia sostegno.
  Restituisce `UtenteCompatibile[]` con flag `notificheBloccoInviato`/`notificheRecapInviato`.
- **AREA SOSTEGNO — INCLUSIONE PERMANENTE** (§26.45, 04/10/2026): il sostegno è
  un'abilitazione SEPARATA dalle classi disciplinari, ma **non è più una preferenza**. Un
  avviso è "di sostegno" quando ha un codice `AD*` (`isCodiceSostegno` in
  `data/classiConcorso.ts`: ADAA/ADEE/ADMM/ADSS/AD24…) oppure titolo/materia lo dichiarano
  (`eAvvisoSostegno`; "inclusione" è volutamente escluso perché troppo generico) →
  `avvisoDiSostegno()` in `matchingEngine.ts`. Tali avvisi **non passano dal controllo di
  classe**: vengono consegnati a TUTTI i profili configurati della provincia — nessun
  interruttore, nessun opt-out (`profiles.sostegno` è ormai un valore storico) e nessuna
  differenza tra canali. L'inclusione non è cieca: resta il vincolo di **provincia** e il
  gate di qualità (link diretto + recapito di candidatura), e un profilo non configurato
  resta fuori. Le funzioni storiche `sostegnoAmmesso`/`utenteAderisceSostegno` sono state
  rimosse. La stessa regola è applicata al digest (`notifier.ts` → `raccogliVociCanale`):
  una sola fonte di verità.
  Test: `npm run test:sostegno`.
- `findUtentiCompatibili` legge `sostegno`, `materie_id` e `materie_custom` in modo **tollerante**
  (DB non migrato → rilegge senza le colonne: il matching degrada, non si svuota) — e la decisione
  **non dipende più da `sostegno`**. La seconda lettura
  tiene solo le colonne **storiche** più le competenze: `materie_id`/`materie_custom` esistono dalla
  prima creazione di `profiles` (`20260822030000`, allineata in `20260825160000`), mentre `sostegno`
  arriva con `20260914040000` (default `true` da `20260927120000`); se manca è `sostegno` a venire
  omesso, mai le competenze (§26.35).

### 5.3 Scraper interpelli (`src/scraper/` — motore degli interpelli di lavoro)

**Perimetro**: il motore pubblica SOLO opportunità di lavoro (interpelli/supplenze
docenti e ATA, bandi PNRR/PON/POR, incarichi per esperti esterni). Le notizie
editoriali del MIM sono un altro dominio (`src/departments/notizie/`) e non
entrano mai in bacheca né in notifica: la separazione è verificata da
`npm run test:scraper:domini` (nessun import incrociato + filtro editoriale sul
testo realistico).

Pipeline `npm run scrape` (flags: `--dry-run`, `--no-email`):
1. `caricaEnv()` (process.loadEnvFile) → `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
2. `ottieniProvinceAttive()`: legge `profiles.province_attive`; fallback
   `SCRAPER_PROVINCE_TEST` (default `MI,TO`).
3. **FONTI dei capoluoghi** (`fonti.ts` + `fontiRegistro.ts`, tetto
   `SCRAPER_FONTI_MAX`, default 12):
   · **hub di reclutamento USR/USP** dei capoluoghi di regione (Torino, Milano,
     Genova, Bologna, Firenze, Roma, Napoli, Bari, Palermo, Venezia, Cagliari,
     Perugia, Ancona, L'Aquila, Campobasso, Potenza, Catanzaro…) — `hub.ts` scopre
     nella pagina dell'hub le **sezioni** interpelli/avvisi (max `MAX_SEZIONI_HUB`)
     e le esplora; la provincia di fallback è quella del capoluogo e le voci che
     citano la scuola/città reale vengono riattribuite dal parser;
   · **feed dell'aggregatore** (indice nazionale): il post giornaliero è NAZIONALE
     e viene letto **una volta sola** (dedup per URL); ogni voce prende la PROPRIA
     provincia dall'intestazione di città e, se non è rilevabile, viene scartata
     (mai province inventate). Gli archivi regionali sono opt-in (`SCRAPER_ARCHIVI=1`,
     backfill): contengono gli stessi post nazionali dei giorni precedenti.
   Copertura dichiarata: **19/20 regioni** con hub dedicato (manca la Valle d'Aosta)
   e **tutti i 12 capoluoghi principali**; il registro è verificabile dal vivo con
   `npm run fonti:verifica` (43/43 fonti raggiungibili al 2026-09-28) e presidiato
   da `npm run test:scraper:fonti`.
3-bis. **ELENCHI** (`elenchi.ts`): se la pagina è un INDICE (es. elenchi USR
   Lombardia) o l'avviso raccolto punta a un indice, ogni voce diventa un avviso
   INDIPENDENTE con il proprio link; l'indice non viene mai pubblicato come singolo
   avviso (tetto: `SCRAPER_ELENCHI_MAX`, default 25 pagine/run). Il rumore di
   navigazione (menu, archivi, paginazione, ricerca) viene scartato a monte
   (`eTitoloNavigazione`). Verificato da `npm run test:elenchi`.
4. **GATE 1 — conformità** (`qualitaOpportunita.ts`): fuori dalla bacheca i
   contenuti **editoriali** (comunicato stampa, dichiarazione, intervista,
   rassegna, evento), gli **atti informativi** (esiti, graduatorie, revoche) e le
   voci **fuori target** (nessun segnale di opportunità, categoria non ammessa:
   ammesse interpelli/supplenze, esperti, PNRR/PON/POR, avvisi/bandi). I contatori
   sono loggati (mai scarti silenziosi).
5. **Parser** (`parser.ts`): `rilevaClassi` (formato classico `A-12`, sostegno `ADEE`,
   e COMPATTO `A042`→`A-042`, `AB25`), `rilevaCategoriaAvviso`, `estraiProvincia`/`estraiScuola`
   (dati reali; `estraiProvincia` risolve anche la CITTÀ dell'intestazione),
   `estraiDataPubblicazione`/`estraiDataScadenza` (mai la pubblicazione come
   scadenza), `inferisciMateria`, `estraiEmail`, `generaHashId` (SHA-256).
5-bis. **Arricchimento**: scadenze dichiarate (max `SCRAPER_SCADENZA_MAX`) ed email
   di candidatura (max `SCRAPER_CONTATTI_MAX`, ultima ratio dalla convenzione MIM
   sul codice meccanografico). L'ordine conta: il gate dei "bandi attivi" e il gate
   del link lavorano sui dati arricchiti.
6. **GATE 2 — solo bandi ATTIVI**: dopo l'arricchimento, gli avvisi con scadenza
   già passata non entrano in bacheca (`eScaduto`). Una scadenza ASSENTE non è una
   prova di scadenza: il record resta attivo finché una fonte non lo chiude.
7. **GATE 3 — link (ping fallace ≠ record scartato)**: i server scolastici
   regionali rispondono spesso 403/timeout ai client automatici. Un bando
   **strutturato** (classe di concorso o materia **+** email di candidatura) viene
   ACCETTATO senza verifica del link (e non viene nemmeno pingato); per gli altri
   il ping (parallelo, `SCRAPER_PING_CONCORRENZA`) resta decisivo, e un ping
   fallito su un record incompleto lo scarta. Il link, accettato o no il ping, deve
   restare una fonte ufficiale specifica: nessun fallback alla home dell'ente.
   Verificato da `npm run test:scraper:attivi`.
8. Dedupe per `hashId` + **VALIDAZIONE** (`verificaAvviso`): scarta titoli vuoti/troppo corti,
   titoli con segnali di test/mock e fonti non ufficiali/non verificabili
   (example.com, localhost, social/hosting, root-domain…).
9. **Upsert** in `interpelli` (`onConflict: 'hash_id', ignoreDuplicates: true`), resiliente
   alle colonne opzionali mancanti (migrazioni non applicate); fallback `notices`.
10. **Notifiche** (soli interpelli NUOVI, §6) + pubblicazione sui canali regionali
   (`pubblicaNuoviSuCanali`).

> Igiene dati: `npm run dati:pulisci` (dry-run; `--apply` per applicare) rimuove record non
> verificati e azzera i nomi scuola fittizi. `npm run test:parser:validazione` verifica le regole.

### 5.4 UI / feed / filtri / blacklist
- `DashboardPage.tsx`: header notifiche (3/anno, abbonamento, crediti), feed
  `interpelliFiltrati`, CTA wizard/abbonamento, blacklist scuole.
- `SimulatorRadar.tsx`: anteprima feed (Supabase → mock) — dal 27/09/2026 è il
  **box «Prova il Radar» nella hero della homepage** (`LandingHero`), oltre alle superfici interne.
  Si prova con la **sola provincia** (nessun selettore di classe di concorso, §26.12): motore puro
  condiviso `lib/provaRadarEngine.ts` (tutte le opportunità attive della provincia → completamento
  nazionale), lettura dati in `radar/services/provaRadarQuery.ts` e responso presentazionale in
  `radar/components/ResponsoProva.tsx`, che chiude sempre con il messaggio di conversione
  (`messaggioConversione`: «Abbiamo trovato [X] opportunità attive oggi su [Città]…»); la provincia
  provata diventa la provincia principale del wizard (`lib/provaRadar.ts`).
- `RadarWizardModal.tsx`: onboarding 4 passi con `Pill`; persiste `sr_wizard_pending`.
  **Passo 1** = ordini di scuola (nessuna domanda personale in apertura); **Passo 3** = classi di
  concorso + competenze, con ricerca unificata in testa e campo libero per la **parola chiave**
  nella colonna competenze; **Passo 4** = canali di notifica e, **in fondo**, l'anagrafica
  facoltativa (`BloccoAnagrafica`: nome, cognome, genere, età → bozza di registrazione).
  Il wizard **non chiede più la preferenza SOSTEGNO** (domanda rimossa dal Passo 3): la preferenza
  resta nelle **Preferenze Radar** (`PreferenzeRadar.tsx`, accordion Classi di concorso,
  autosalvataggio) e il valore già salvato viene **preservato** al salvataggio finale
  (`sostegno: preferenze.sostegno ?? false`) — nessun opt-out retroattivo.
- `InterpelloCard.tsx`: card con scadenza (countdown), classe, provincia, badge
  "Scuola Preferita" (`favoriteSchools`), notifica, detail.
- **Persistenza CLASSI (bug "la classe si deseleziona da sola" — RISOLTO)**: il DB
  poteva contenere il formato delle FONTI (`A-022`, `A042`, `A 18`) mentre il
  catalogo usa `A-22`; il confronto letterale delle caselle falliva e la classe
  appariva non selezionata (o si duplicava). Ora i codici sono normalizzati in
  **lettura** (`AppContext` → `normalizzaClassi(data.classi_concorso)`), in
  **scrittura** (`classi_concorso: normalizzaClassi(...)`), nel `setPreferenze`/
  `completaOnboarding`, nella bonifica del localStorage e nelle due UI
  (`PreferenzeRadar`, `RadarWizardModal`) che confrontano con `contieneClasse`.
  Verificato da `npm run test:radar:preferenze`.
- **Testo UI**: il passo 1 del wizard e l'accordion degli ordini dicono
  **"Dove vuoi lavorare?"** (prima: "Dove vuoi insegnare o lavorare?"); è anche il
  titolo del primo passo in `TITOLI_STEP` (avanzamento del wizard).
- **Competenze e laboratori extra**: la sezione mostra l'etichetta
  **"Le tue competenze e laboratori extra da proporre:"** e propone con un click i
  **12 tag più richiesti dai bandi PNRR/PON** (`competenzeSuggerite`: Intelligenza
  artificiale nella didattica, Robotica educativa, Stop Motion, Coding, Digital
  storytelling, CLIL, Lingua inglese, STEM, Creatività digitale, Educazione motoria,
  Progettazione bandi, Orientamento). Le discipline curricolari (Storia, Geografia,
  Italiano, …) NON compaiono più come elenco: la cattedra si intercetta con le classi
  di concorso e la ricerca unificata. **Nessun elenco fisso e nessun campo doppio**:
  un solo campo `RicercaSelezioni` (motore in `lib/ricercaSelezioniRadar.ts`) restituisce
  insieme classi, competenze extra e la possibilità di aggiungere il testo digitato come
  parola chiave personale. Le liste complete sono in `wizard/components/SezioneClassiConcorso`
  e `wizard/components/SezioneCompetenzeExtra` (passo 3 su due colonne).
  Verificato da `npm run test:ricerca` e `npm run test:radar:preferenze`.
- **Wizard a prova di scroll**: `Modal` con `dense` (`max-h-[96vh]`, gutter ridotti),
  progress/footer compatti, liste `max-h-36`/`max-h-44` e passo 3 su due colonne: i
  quattro passi rientrano nel viewport senza barra di scorrimento interna (desktop).
- **Sessione al ritorno da Google**: identità sincronizzata da `identitaDaSessione`
  (bootstrap + listener) e `AuthCallback` che attende lo scambio PKCE prima di
  navigare. Verificato da `npm run test:sessione`.
- **Filtri avanzati**: `ignoredSchools` (blacklist) nasconde gli avvisi
  (match su `istituto + titolo`); `favoriteSchools` (whitelist) marca badge prioritario.
- **Scadenze (semaforo)**: badge colorati via `src/lib/scadenza.ts` — 🟢 verde > 7 giorni,
  🟡 giallo 3–7 giorni, 🔴 rosso ≤ 2 giorni / "scade oggi". Ogni record mostra la DATA di
  scadenza; se assente → "Scadenza n/d".
- **Esclusione scaduti**: gli interpelli SCADUTI non compaiono mai nelle liste attive —
  filtro query (`searchInterpelli`: `expiration_date.is.null,expiration_date.gte.<oggi>`)
  **e** filtro UI (`FlightBoardInterpelli`, `interpelliFiltrati` via `eInterpelloAttivo`).
- **Routine automatica**: `npm run dati:pulisci-scaduti` (dry-run) / `-- --apply` rimuove i
  record scaduti; workflow `.github/workflows/pulisci-scaduti.yml` (cron giornaliero 04:00 UTC).


---

## 6. Notifiche & Drip Freemium — deep dive

### 6.1 Canali e moduli
- **Email** → Resend (`src/lib/resend.ts`, Node-only): `getResendClient()`,
  `renderEmailHtml(interpello, destinatario, dashboardUrl, tipo)`,
  `inviaNotificaEmail(...)` (soggetto+HTML, tag `project: scuoleradar`),
  `inviaNotificheInterpello(...)` (batch multi-utente).
- **Telegram** → `src/lib/telegram.ts` (Node-only): `formattaMessaggioTelegram(...)`,
  `inviaNotificaTelegram(...)` con parse_mode HTML. Ogni CTA di conversione (post
  canale/broadcast regionale, benvenuto del bot `/start`, notifiche) punta a
  **`RADAR_SETUP_URL`** = `…/dashboard/radar` (setup province + classi), mai alla home
  generica: `telegram-webhook/index.ts` e `send-notification/index.ts` usano lo stesso
  percorso (`RADAR_URL`/`radarSetupUrl()`). Verificato da `npm run test:telegram:canali`.
  **Nessun `text_link` nascosto**: gli URL sono visibili (auto-link nativo) così non
  compare il popup di conferma; le email di candidatura sono testo semplice.
- **Deep link scheda** (`/interpello/:id`) — **LEGACY**: le notifiche **non** generano
  più link interni. La rotta resta solo per i deep link STORICI già inviati: se
  l'avviso ha una fonte esterna la pagina **reindirizza subito**
  (`window.location.replace`) a quella; senza fonte mostra l'avviso e la guida
  operativa, senza rimbalzare sulla Home.
- **Copy**: nessun riferimento alla vecchia "prova a 3 notifiche" ("Te ne restano 2",
  "Terza e ultima opportunità"): il mese PRO è presentato come accesso pieno. Le
  tipologie `prova1/2/3`, `extra` e `recap` restano per compatibilità dei cron.
- **Anti-duplicato (mai due volte lo stesso avviso)**: due ledger + fallback.
  · `notifications_log` (utente × interpello × canale) — migrazione
    `20260914010000_notifications_log.sql`;
  · `channel_posts_log` (interpello × canale Telegram) — migrazione
    `20260914020000_channel_posts_log.sql`;
  · `.scuoleradar/notifiche-ledger.json` (**ledger locale su file**, committato
    dai workflow `scraper.yml`/`digest.yml`): blocca i duplicati anche se le tabelle
    non sono state create. Se una tabella manca, il run logga un warning esplicito
    con il nome della migrazione da applicare.
  · **Concorrenza fra run (bug "notifiche ripetute a distanza di giorni")**:
    scraper e digest girano negli stessi minuti e scrivono lo STESSO file. Due
    protezioni: (1) `ledgerLocaleSalva()` fa il **MERGE con il file su disco**
    prima di scrivere (mai la sola cache in memoria, che cancellerebbe le chiavi
    dell'altro processo); (2) il commit in CI usa `scripts/commit-ledger.sh` →
    `npm run ledger:unisci` (unione di chiavi) + push con retry, invece di
    `git add`/`commit`/`push` diretti.
  · **Persistenza IMMEDIATA**: gli alert PRO in tempo reale salvano il ledger dopo
    OGNI invio (non solo a fine run) e lo script dello scraper ha la rete di
    sicurezza `process.on('exit')`; il digest già salvava dopo ogni utente. Se un
    run muore a metà (timeout del workflow, crash), quanto già consegnato resta
    registrato e NON viene rimandato il giorno dopo.
  · **Identità dell'opportunità (impronta)**: `hash_id` = provincia|titolo|data e
    la stessa notizia ripubblicata con titolo/date diversi generava un hash nuovo
    (→ nuovo record → nuovo alert, giorno dopo giorno, es. Liceo Monti). In
    `src/scraper/index.ts` la deduplica `nuovi` ora usa TRE livelli — `hash_id`,
    URL di fonte specifico e **impronta** (`src/lib/dedupAvvisi.ts`, confronto con
    gli avvisi degli ultimi `GIORNI_IMPRONTA` = 60 giorni, più dedup intra-run).
    Le letture di appoggio sono in **lotti** (`LOTTO_IN`) con errore SEMPRE
    loggato: prima un errore non visto faceva considerare NUOVI tutti gli avvisi.
  · **Stato DB verificabile**: `npm run db:verifica` (sonda senza effetti collaterali:
    tabella + RPC con un UUID inesistente) e `npm run test:migrazioni` (regression
    guard statico sui file SQL). Se le migrazioni non sono applicate, la deduplica
    resta comunque garantita dal ledger su file.
  · **Recupero di invii non registrati**: `npm run notifiche:digest -- --registra-consegnate
    [--fino-a <ISO>]` marca come consegnate le opportunità già inviate SENZA rispedire
    nulla e senza consumare quota (il tetto temporale evita di marcare novità recenti
    mai inviate).
- **POLICY DI ROUTING (mai link interni)**: il link di un avviso punta **SOLO alla fonte
  esterna originale** dell'istituzione (`eLinkEsterno`/`urlEsterna` in `alertInterpello.ts`).
  `linkOpportunita` **non ha più fallback** verso pagine della piattaforma: senza fonte
  valida la CTA porta al **Radar** con etichetta esplicita ("Apri il tuo Radar Scuole").
  Anche lo scraper **rifiuta** gli URL della piattaforma come fonte
  (`RE_HOST_NON_ISTITUZIONALE`). Verificato da `npm run test:link` e `npm run test:link-esterno`.
- **EMAIL Interpelli: link ufficiale IN EVIDENZA + CTA primaria** (checklist email §4/§5).
  `fonteInEvidenza(url)` in `resend.ts` rende l'URL **esatto** dell'annuncio/bando pubblicato
  dalla scuola (dato dello scraper) dentro una **scatola blu brand** nella card, con il link
  in grassetto e l'etichetta standard `👉 Apri l'avviso ufficiale`; il **bottone CTA primario**
  punta **allo stesso URL** (senza fonte diretta → fallback esplicito al Radar). Stessa resa
  in alert, digest e promemoria. La riga compare **solo** per avvisi specifici
  (`eUrlAvvisoDiretto`): mai per home, elenchi o archivi (checklist §5).
- **Nel corpo delle email NESSUN box giallo e nessuna guida operativa**: i riquadri ambra
  (`border-left:3px solid #f59e0b; background:#fffbeb`) con «Nel link la scuola pubblica un
  elenco… / clicca STAMPA… / cerca la riga con…» sono stati **rimossi** da alert e digest
  (checklist §4: l'azione è il link stesso). La funzione `suggerimentoRicercaAvviso()` resta
  per i messaggi **Telegram** e per le **viste web** (`InterpelloCard` /
  `InterpelloDettaglioPage`, dove il box è ancora presente: follow-up UI).
- **Email scolastica (asset del piano PRO)**: il recapito di candidatura è un campo
  dell'**avviso strutturato** (`costruisciAvviso.email`) e viene reso **cliccabile**
  (`mailto:`) con etichetta/icona CONDIVISE (`📧 Candidature:` nei messaggi,
  `📧 Email candidature` nelle viste web) in **email, Telegram, post canale, viste web
  (`InterpelloCard`, `/interpello/:id`) e Edge `send-notification`**.
  Se la fonte non pubblica un recapito, si ricostruisce la **PEO ufficiale**
  (`codice@istruzione.it`) dal codice meccanografico (`emailScuola.ts`); il codice
  viene cercato anche nei **link candidati** (URL/allegati/PDF) e nelle pagine di
  **riepilogo/"Stampa"** o negli elenchi tabellari, così il contatto c'è anche quando
  la descrizione estesa manca. Ultima ratio anche lato dispatch (`notifier.ts`,
  Edge `send-notification`, che legge `contact_email`/`school_code`/`title`).
  Se il recapito manca davvero, la riga è **omessa** (mai "Email non disponibile"):
  verificato da `npm run test:email-alert`. `npm run dati:arricchisci` completa le
  righe già in DB.
- **NOTIFICHE PER TIER — PRO in tempo reale · BASE in un batch alle 17:00** →
  `inviaAlertTelegramTempoReale()` + `inviaDigestGiornaliero()` in `src/lib/notifier.ts`,
  `src/lib/digest.ts` (puro) e, per il rendering, `renderDigestEmailHtml`/`inviaDigestEmail`
  (email) + `formattaDigestTelegram`/`inviaDigestTelegram` (Telegram).
  · **PRO** → alert **INDIVIDUALI in TEMPO REALE su Telegram** appena l'avviso è
    scrapato (`inviaAlertTelegramTempoReale`, invocata dallo scraper in FASE 4):
    non consuma quota (PRO è illimitato) e non manda email immediate.
  · **BASE** → **nessun** alert immediato: UN SOLO BATCH al giorno alle 17:00 con tutte
    le opportunità (`inviaDigestGiornaliero`), su Telegram + riepilogo email.
  · **Email** → per ENTRAMBI i tier resta UN SOLO riepilogo quotidiano (mai N email).
  · **Deduplica PER CANALE** (`giaNotificatoCanale`, chiavi `…|<canale>` nel ledger +
    `notifications_log`): un avviso consegnato in tempo reale su Telegram NON torna nel
    batch Telegram serale, ma **può** comparire nel riepilogo EMAIL (canale diverso).
    La chiave LEGACY agnostica `…|notifica` vale per TUTTI i canali (nessun doppio invio
    storico). Verificato da `npm run test:telegram:tier`.
  · **Finestra di invio: 17:00 italiane** (`ORA_DIGEST`, fuso `Europe/Rome`, fine
    giornata scolastica). Il cron GitHub gira in UTC → si schedula `0 15,16 * * 1-5` e
    lo script invia SOLO quando in Italia sono le 17:00 (`eOraDelDigest`); con `--force`
    (o l'admin `npm run admin:dispatch`) si ignora la finestra.
  · Contenuto = TUTTE le opportunità attive compatibili **non ancora consegnate SU QUEL
    CANALE** (ledger per canale), ordinate per scadenza più vicina. Ogni voce porta la
    **fonte ESTERNA in evidenza** (scatola blu brand, `fonteInEvidenza`) e l'email della
    scuola; **nessun bottone globale al Radar nell'email** (le preferenze stanno nel footer,
    in piccolo). Max 12 voci nell'email (con nota delle restanti) e budget di caratteri per
    Telegram (limite 4096 sempre rispettato).
  · **Oggetto email** (formula di prodotto): *"ScuoleRadar — Oggi abbiamo trovato
    {N} opportunità per te"* (`subjectDigest`); la testata del messaggio Telegram usa
    la stessa formula (`testataDigest`).
  · **Layout a bassa fatica visiva**: voci **numerate**, card bianche con bordo tenue
    e accento laterale (niente riquadri grigi ripetuti) e **raggruppamento per urgenza**
    di scadenza (`🔴 entro 2 giorni` · `🟡 entro una settimana` · `🟢 oltre` ·
    `⚪ n/d`, stesse soglie di `scadenza.ts`). Le intestazioni di gruppo compaiono
    **solo** se i gruppi sono più di uno: con un solo gruppo resta una lista lineare.
    In Telegram ogni voce è compressa in poche righe (contesto · classe/scadenza ·
    fonte · email · guida).
  · **Guida standardizzata (solo Telegram e viste web)**: `ISTRUZIONE_AVVISO_UFFICIALE` =
    *"Apri l'avviso ufficiale (clicca STAMPA dove possibile, per candidarti)"*, usata
    identicamente in Telegram e nelle schede; nel digest **Telegram** si usa la variante
    `suggerimentoRicercaAvviso({ compatto: true })`, che non ripete l'email già mostrata
    sulla riga precedente. **Nelle email non c'è nessuna guida** (§4 checklist email).
    Nella voce del digest Telegram la guida si calcola sull'**URL GREZZO** della voce
    (`bloccoVoceTelegram`), non su quello mostrato: il riferimento *"cerca la riga con
    «A-022»"* c'è anche quando la fonte non è mostrabile (elenco/«Stampa» filtrato); la
    variante compatta conserva sempre verbo e riga da cercare. Senza alcun link resta
    l'indicazione pulita (chiedi alla segreteria / scrivi al recapito).
  · **Quota**: UN credito al giorno e **solo per BASE** (PRO è illimitato, nessuna RPC)
    con la sequenza `prova1 → prova2 → prova3 → extra`; dopo `extra` il cron DB
    `step5-notifiche` invia il recap finale. Il ledger viene marcato per canale con le
    voci consegnate, così né il batch di domani né il tempo reale le ripetono.
  · **Una sola email al giorno per utente**: la guardia `chiaveDigestGiorno`
    (`utente|<uuid>:digest|<YYYY-MM-DD>`, lato italiano) viene registrata SOLO dopo
    una consegna riuscita: retry del runner, doppio cron o lancio manuale senza
    `--force` non producono una seconda email. I lanci admin (`forzato`) la ignorano.
  · Comando: `npm run notifiche:digest [-- --dry-run] [-- --force] [-- <email|uuid>]`
    (workflow `.github/workflows/digest.yml`). Verificato da `npm run test:digest`,
    `npm run test:telegram:tier` e `npm run test:promemoria`.
- **PROMEMORIA 24h** → `inviaPromemoria24h(client, opts)` (email, in coda al digest):
  per ogni profilo notificabile legge lo storico delle consegne
  (`notifications_log.canale = 'email'` + `sent_at`), considera le voci consegnate da
  **≥ 24h** e non ancora scadute, e invia **UNA sola email** con quelle ad **alta
  priorità** (scadenza entro **3 giorni**). Regola pura in `src/lib/promemoria.ts`
  (`motivoPromemoria`, `eVoceUrgente`, `chiavePromemoria`). **Strict anti-duplicato**:
  la chiave `utente|<uuid>:<hash>|promemoria` (ledger file) + la riga DB con
  `canale = 'promemoria'` garantiscono **un solo promemoria per interpello**; il
  secondo giro non rimanda nulla. Non consuma quota (non è una notifica nuova) e non
  parte mai senza timestamp affidabili (ledger DB assente → 0 invii, con warning).
  Comando: `npm run notifiche:promemoria [-- --dry-run] [-- --force] [-- --ore 24]
  [-- --giorni 3] [-- <email|uuid>]`; verificato da `npm run test:promemoria`.
- **Orchestrazione LEGACY** → `notificaNuoviInterpelli(client, nuovi, opts)` e
  `notificaInterpelliPerUtente(client, target, opts)` restano esportate per test,
  dry-run e backfill manuali, ma **non sono più usate dalla pipeline**; nessuna lancia
  eccezioni (esito `{ inviate, fallite, telegramInviate, telegramFallite }`). Sul
  canale EMAIL nessuna delle due invia più una email per opportunità: le voci si
  accumulano e partono con **UNA sola** email di riepilogo (`inviaDigestEmail`) a
  fine run; su `notificaInterpelliPerUtente` l'esito espone anche `emailVoci` (numero
  di opportunità incluse nel riepilogo). Il Telegram resta individuale.

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

**Copy del benvenuto** (riga 1): conferma l'attivazione **immediata** del *mese di PRO in
omaggio* e i 4 strumenti già attivi (Radar Scuole con notifiche illimitate, Modulistica
scolastica, Crea CV, Calcolatore CFU), con il tono dell'onboarding. **Vietati** i residui del
vecchio modello: «account Base», quota delle «3 segnalazioni», «piano PRO gratuito per 30
giorni», ritorno al piano gratuito. Le 4 superfici che generano lo stesso messaggio vanno
tenute allineate: `TESTI.conferma_base` (Edge `send-notification`, unica fonte usata anche da
`step1`), `email_1_1_onboarding` (`supabase/functions/_shared/emailTemplates.ts`),
`CORPO_MESSAGGI.welcome` (`src/lib/resend.ts`), `TESTO_TELEGRAM.welcome`
(`src/lib/telegram.ts`) e la scheda «Benvenuto / onboarding»
(`src/config/automazioniEmailCatalogo.ts`). Guardia: `npm run test:email`.

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

### 6.4 pg_cron (6 job)
| Job | Cron | Funzione | Azione |
|---|---|---|---|
| `step5-notifiche` | `* * * * *` | `dispatch_step5_due()` | BASE con `step4_inviata_at + 2h <= now` e `step5_inviata=false` → Edge `send-notification` `step5` + flag |
| `scadenza-avvisi-multistep` | `0 9,18 * * *` | `invia_avvisi_scadenza_abbonamento()` | Timeline scadenza PRO: `7d→3d→1d→finale` (standard) / `beta_preavviso→beta_conferma` (beta tester, lifetime al Day 0) |
| `beta-rinnovo-omaggio-vita` | (wrapper) | delega a `invia_avvisi_scadenza_abbonamento` | retro-compatibile |
| `revert-prove-pro-scadute` | `30 3 * * *` | `reverti_prove_pro_scadute()` | Trial PRO 30 gg scaduto → ritorno su Base (beta/VIP esclusi) |
| `free-forever-rinnovo-annuale` | `30 8 * * *` | `rinnova_free_forever_scadenza()` | FFE in scadenza entro 7 gg → email dedicata + estensione +1 anno |
| `rinnovo-preavvisi-3-5g` | `0 9 * * *` | `invia_preavvisi_rinnovo()` | **Promemoria di rinnovo (finestra 3–5 gg)** per trial PRO e PRO a pagamento → Edge `send-notification` `rinnovo_preavviso_prova` \| `rinnovo_preavviso_pro` (email + Telegram); flag `profiles.preavviso_rinnovo_inviato_at` |

### 6.5 Copia email/Telegram
`resend.ts`/`telegram.ts` contengono SUBJECT + CORPO per ogni `TipoMessaggio`.
`TIPI_CON_OPPORTUNITA = { prova1, prova2, prova3, notifica_pro }` → includono il blocco
dell'opportunità (titolo + dettagli + link fonte). `extra` e `recap` sono solo testuali.
`classeRilevante()` interseca le classi con quelle del profilo e sceglie la **classe coerente
con il titolo** (`scegliClasseRilevante`).

**Regole di TEMPLATE (verificate da `npm run test:telegram:template`, `npm run test:copy` e `npm run test:promemoria`):**
- **OGGETTI email**: il testo delle OPPORTUNITÀ è **STANDARD E UNICO**:
  `OGGETTO_OPPORTUNITA = 'Nuove opportunità per te!'` — vale per il **digest
  giornaliero** (`subjectDigest`), per gli alert di opportunità
  (`subjectOpportunita`/`subjectPerNotifica`) e per i tipi di opportunità della
  Edge (`oggettoOpportunita`). Il contesto (classe · provincia) vive nel CORPO
  del messaggio, non nell'oggetto. Restano SPECIFICI e descrittivi gli oggetti
  dei messaggi di **ciclo di vita** (`welcome`, `extra`, `recap`, `welcome_pro`,
  `conferma_attivazione`, `free_forever_preavviso`) e il **promemoria 24h**
  (`subjectPromemoria` = *"Scuole Radar — Scadenza vicina: <classe> (<provincia>)"*).
- **DIGEST = UNA email al giorno con le SOLE opportunità ATTIVE**:
  `inviaDigestEmail`/`renderDigestEmailHtml` filtrano con **`vociAttive(voci)`**
  (`eInterpelloAttivo`: scadenza non passata; senza scadenza = attiva) → gli
  avvisi scaduti NON entrano nel riepilogo e non vengono mai notificati.
- **Brand**: OGNI messaggio Telegram comincia con la **testata brand compatta e
  CLIICCABILE** `📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>`
  (`BRAND_RIGA_TELEGRAM`/`URL_HOME`, `alertInterpello.ts`; stessa stringa nella Edge):
  una sola riga, **tutto** il nome è un link alla home, nessun logo/foto allegata e
  nessuna anteprima gigante. In **email** l'header è **SOLO TESTO**: la scritta
  `Scuole Radar.it` su una riga centrata, cliccabile verso
  `https://www.scuoleradar.it` (`intestazioneBrandHtml`/`URL_BRAND`). **Nessun
  logo-immagine** nell'header di alcuna email (alert, digest, promemoria, drip
  della Edge): il PNG arrivava compresso/sgranato nelle caselle di posta (il
  vecchio logo da 200 px era stato rimosso perché "gigante"/deformato su mobile;
  il successivo logo 32 px è stato rimosso il 04/10/2026 perché sgranato).
- **Copy**: le opportunità si aprono con il **copy di brand COMPLETO**
  *"Abbiamo trovato una nuova opportunità per te"* — mai la versione abbreviata
  `🎯 Nuova opportunità: …`. Con il contesto del match diventa
  `🎯 <b>Abbiamo trovato una nuova opportunità per te</b>: <classe> · <provincia>`
  (`aperturaOpportunita`, identica per `prova1`/`prova2`/`prova3`/`notifica_pro` e per
  i tipi `step2`/`step3`/`notifica_pro` della Edge); nessuna frase ripetuta
  ("Continuiamo a cercare per te", "A presto!" rimossi) e nessuna riga metadato `🏷️ …`.
- **Post CANALI regionali (solo testo, puliti)**: testate **tipografiche** —
  `📝 Interpello docenti` / `🗂️ Avviso ATA` / `📣 Bando / PNRR / Esperto` —
  al posto delle vecchie fasce colorate con parentesi quadre
  (`🟢 [INTERPELLO DOCENTI]`, `🔵 [AVVISO ATA]`, `🟣 [BANDO / PNRR / ESPERTO]`) che
  sembravano badge di sistema/banner di errore. Nessuna immagine allegata
  (`sendPhoto`/`sendMediaGroup` banditi) e **anteprime native disattivate**
  (`link_preview_options.is_disabled` + `disable_web_page_preview: true`): niente
  riquadri/media giganti. Struttura fissa in 7 sezioni: brand → header → dettagli →
  `🔗 Fonte Ufficiale` + 📧 recapito → CTA di lead generation al Radar →
  CTA Notizie (due righe) → hashtag. Verificato (e reso BLOCCANTE) da
  `npm run test:telegram:canali`.
- **Post canale — BRAND in testa**: OGNI post parte dalla riga cliccabile
  `📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>` (`BRAND_RIGA_TELEGRAM`);
  la testata è la PRIMA sezione del messaggio, senza eccezioni.
- **Post canale — LINK SAFETY (STRICT)**:
  · l'URL della fonte ufficiale **non viene mai mostrato in chiaro**: compare SOLO
    come `href` della riga iperlinkata `🔗 Fonte Ufficiale`
    (`rigaFonteUfficiale`, che applica anche il gate sui link diretti); gli unici URL
    visibili sono quelli di ScuoleRadar (CTA di lead generation al Radar e CTA Notizie);
  · il link deve essere **diretto all'avviso specifico** (`eUrlAvvisoDiretto`):
    mai home regionali, archivi, elenchi/tag, pagine di ricerca o landing regionali;
  · `pubblicaInterpelloSuCanali` ha un **gate** che ANNULLA la pubblicazione
    (`EsitoPubblicazioneCanali.saltato`) quando la fonte non è diretta: nessun invio,
    nessuna destinazione, nessun falso allarme di "dispatch fermo"
    (`senzaFonte` nello `scraper_runs`). Il test verifica i casi negativi
    (home regionale, elenco/tag, landing regionale, ricerca, nessun link).
- **Gerarchia**: `Ordine di scuola` deriva SEMPRE dalla classe mostrata (o dal testo se la
  classe manca) → mai contraddizioni tipo "Scuola Primaria" + titolo della secondaria;
  `scegliClasseRilevante` preferisce la classe **citata nel titolo** tra quelle della tabella
  sorgente (che può elencare codici di livelli diversi). Nel post canale il ruolo non viene
  ripetuto quando coincide con la Classe/Materia.
- **Email**: se il contatto della scuola non è estratto con certezza la riga
  viene **omessa** — mai `"📧 Email non disponibile"` (vale anche per il blocco candidature
  nella card).
- **Scadenze** (`scadenzaUtilizzabile`): una data già passata o identica alla pubblicazione è
  considerata **non valida** e non viene mostrata (nessuna scadenza nel passato negli alert).
- **Link alla fonte — UNA etichetta canonica per Telegram**: `🔗 Fonte Ufficiale`
  (`ETICHETTA_FONTE_UFFICIALE`) in **alert personali, digest e post dei canali**, generata
  SEMPRE da `rigaFonteUfficiale`/`rigaAvvisoUfficiale` (l'avviso delega alla riga canonica):
  l'`href` è **esattamente** l'URL dell'avviso, **mai in chiaro nel testo**, e il **gate
  `eUrlAvvisoDiretto` è applicato DENTRO i generatori** — con home, elenchi/archivi/tag,
  landing regionali o pagine di ricerca (`?s=INTERPELLO`) la riga è **vuota**: nessun
  fallback a un link generico, in nessuna tipologia di messaggio.
  Le **EMAIL** mantengono la loro etichetta descrittiva per destinazione
  (`etichettaFonteLink`, `👉 Apri l'avviso ufficiale` / `Apri il bando ufficiale (PDF)`…):
  la canonica vale per i messaggi Telegram. La parola *"candidati"* è vietata ovunque.
- **Anteprime native — PUNTO UNICO**: `payloadMessaggioTesto(chatId, testo)` è l'unico posto in
  cui si costruisce il payload di `sendMessage`, con `link_preview_options: { is_disabled: true }`
  (Bot API attuale) **e** `disable_web_page_preview: true` (client più vecchi). Nessun media
  (`sendPhoto`/`sendMediaGroup` banditi): i messaggi sono solo testo, senza riquadri che
  caricano loghi istituzionali o immagini delle fonti.
- **Post canale — CTA di LEAD GENERATION**: il footer dei canali pubblici invita
  esplicitamente a creare il Radar personalizzato
  (`⚡ Vuoi solo le opportunità della TUA provincia e delle TUE classi?` +
  `👉 Crea il tuo Radar personalizzato: https://scuoleradar.it/dashboard/radar`),
  con URL **visibile** (nessun popup nativo) e mai la home generica.
- **CTA Radar (frequenza ridotta)**: la riga di ricalibrazione
  (`CTA_RADAR_INTERESSI`) NON compare più in **ogni** comunicazione personale:
  appare nel **~20%** degli alert, con decisione **stabile** sull'identità
  dell'avviso (`deveMostrareCtaRadar`, hash FNV-1a del `id`/URL; `FREQUENZA_CTA_RADAR = 0.2`).
  Forzabile con `formattaMessaggioTelegram(..., { mostraCtaRadar })`.
- **GATE DI QUALITÀ STRICT (nessun avviso incompleto)**: un'opportunità entra nel
  dispatch SOLO con **link diretto all'avviso** (`eUrlAvvisoDiretto`: mai home,
  elenchi, tag, pagine di ricerca/`?s=`, landing regionali tipo
  `/interpelli-lombardia/`) **E** un **recapito di candidatura valido**
  (`avvisoInviabile`, `motivoAvvisoNonInviabile`). Il gate è applicato in
  `notifier.ts` (notifiche, dispatch per utente, alert PRO in tempo reale,
  voci del digest, promemoria 24h) e nella Edge `send-notification`
  (`TIPI_CON_OPPORTUNITA`). Gli scarti sono loggati con il motivo.
- **Mappatura province corretta**: i capoluoghi "composti" sono in `ALIAS_CITTA`
  (`Forlì → FC`, `Monza → MB`, `Pesaro → PU`, `Barletta → BT`, `Carbonia → SU`,
  `La Spezia → SP`, `Bozen → BZ`). Senza l'alias un avviso di Forlì-Cesena
  ricadeva sulla provincia della **fonte** (es. `TO` per la pagina Piemonte) →
  alert "di Torino" con contenuti di Forlì-Cesena. `scegliUrlFonte` non usa
  **mai** la home dell'ente come ripiego: senza fonte specifica l'avviso non
  viene pubblicato.
- **CTA Notizie**: ESATTAMENTE due righe, identiche in ogni canale
  (`CTA_NOTIZIE_TELEGRAM` in `alertInterpello.ts`, `ctaNotizieHtml` in `resend.ts`,
  `CTA_NOTIZIE_TESTO/HTML` nella Edge):
  `📌 https://www.scuoleradar.it/notizie` +
  `Quando vuoi sapere cosa succede di importante nella scuola, vieni qui`.
  Footer canale: `⚡ Ricevi solo gli avvisi della tua provincia e per le tue classi: 👉 <setup Radar>`.
  Nessuna firma promozionale.
- **CTA Notizie nelle EMAIL (formato dedicato, crisp)**: due righe esatte
  `scuoleradar.it/notizie` (link cliccabile, URL breve visibile) +
  `Quando vuoi sapere cosa succede di importante nella scuola vieni qui!`
  (`ctaNotizieHtml`, `URL_NOTIZIE_VISIBILE`, `CTA_NOTIZIE_TESTO_EMAIL`).
- **FOOTER email UNICO e CRISP** (`footerEmailHtml` in `resend.ts`, `RADAR_LINE_EMAIL`
  + `DISCLAIMER_EMAIL` nella Edge), in quest'ordine:
  1. firma `I tuoi colleghi di Scuole Radar`;
  2. CTA Notizie (due righe email);
  3. **link per modificare il Radar, IN PICCOLO** — `modifica il tuo radar su <URL in
     chiaro>`, blu brand (12.5 px): è la casa definitiva delle preferenze, **non** la CTA
     del messaggio (la CTA è il link ufficiale di ogni voce, §5 checklist email);
  4. riga di brand (`ScuoleRadar.it — Interpelli, supplenze, incarichi, PNRR, PON, POR…`);
  5. **avviso "non rispondere" SEMPRE in ULTIMA riga** (`TESTO_NON_RISPOSTA`), con
     separatore e colore leggibile (`#475569`, 13 px).
  **Nessun blocco "P.S."** e **nessun testo sbiadito `#94a3b8`**: la vecchia nota
  grigia a 12 px sembrava una trappola di disiscrizione.
- **LINK alla fonte (STRICT)**: `👉 Apri l'avviso ufficiale` punta SOLO all'avviso
  specifico — pagina dell'ente, **PDF o pagina tabellare/"Stampa" del singolo
  avviso** (`eUrlAvvisoDiretto`). Mai home di ente, elenchi/archivi/tag, pagine di
  ricerca (`?s=`, `?q=`), landing regionali (`/interpelli-lombardia/`) o URL della
  piattaforma: in quei casi la riga è omessa e l'avviso è escluso dal gate di
  qualità.
- **Query string: quando la pagina tabellare è DAVVERO il singolo avviso.** Con una query
  l'URL è diretto **solo** se contiene un parametro che **identifica** il documento
  (`RE_QUERY_ID_AVVISO`: `cod`, `id`, `prot`, `atto`, `doc`, `file`, `allegato`…). Un
  parametro di **ricerca/filtro** (`RE_QUERY_RICERCA`: `s`, `q`, `search`, `ricerca`,
  `filtro`, `anno`, `mese`, `tag`, `category`, `archivio`, `page`, `offset`, `limit`,
  `classe`, `provincia`, `data`, `dal`, `al`…) rende la pagina **NON diretta**, anche se
  c'è un `id`; con un parametro **sconosciuto** si sceglie la prudenza (non diretta).
  Così `/interpelli/stampa?cod=ASTF01000X` è diretta, `/albo/stampa?classe=A022` e
  `?s=interpello` no. Guardie: `test:qualita`, `test:link-esterno`, `test:canali-telegram`.

### 6.5.1 Registro invii per utente — bug "notifiche ripetute" (RISOLTO)
**Sintomo**: lo stesso alert (caso reale: gli avvisi del **Liceo Monti**) tornava
all'utente ciclo dopo ciclo, anche a distanza di giorni.

**Root cause**: il guard per utente usava **solo l'`hash_id`**, ma l'hash non è
stabile — `generaHashId(provincia, titolo, data)` mescola titolo e data, quindi la
stessa opportunità **ripubblicata** (o ri-scrapata con rumore: `prot. n. 1234`,
data, formato del codice classe `A-22` invece di `A-022`) riceve un hash NUOVO →
il registro non la riconosce → nuovo invio. In più l'impronta del scraper non
normalizzava i codici classe (`A-022` ≠ `A-22`) e serviva solo alla fase di
inserimento, non al guard di dispatch.

**Fix — ora FREQUENCY CAP** (`src/lib/notifier.ts` + `src/lib/frequenzaNotifiche.ts`):
- **Identità dell'opportunità** = `scuola + classi + impronta del contenuto`
  (`identitaFrequenza`: classi normalizzate `A-022` ≡ `A-22`; hash FNV-1a del
  titolo normalizzato, senza date/protocolli);
- **cap**: la stessa opportunità può essere inviata a un utente **al massimo 2
  volte, in 2 GIORNI DIVERSI** (`MAX_INVII_OPPORTUNITA = 2` + `valutaFrequenza`);
- **mai due volte nello stesso giorno**: vale per ogni canale di consegna (alert
  PRO in tempo reale, digest delle 17:00, promemoria) e anche per la stessa
  **pagina di fonte** (chiave `utente|frequrl|…`): una ripubblicazione con titolo
  riscritto non genera un secondo messaggio nello stesso giorno;
- **contenuto NUOVO ⇒ nuovo aggiornamento**: una nuova impronta riazzera il
  contatore (la scuola può rilanciare l'avviso modificato);
- **marcatori STORICI** (chiavi `utente|<id>:<hash>|<canale>`, `i:`/`u:` e la
  chiave agnostica `|notifica` scritte dal codice precedente) ⇒ politica
  CONSERVATIVA: l'avviso risulta già consegnato e non si rimanda (`per: 'legacy'`).
  Il codice nuovo NON scrive più quelle chiavi su file; restano su
  `notifications_log` per lo storico del promemoria;
- `avvisoGiaInviato(client, userId, avviso, canale)` è l'**UNICO guard**, chiamato
  PRIMA di ogni invio (digest, tempo reale, dispatch, promemoria); dopo un invio
  riuscito `registraInvioAvviso(...)` scrive il **GIORNO** dell'invio su file
  ledger e su `notifications_log` (`canale = 'freq_email'|'freq_telegram'`,
  `interpello_hash = 'freq:<identità>|<YYYY-MM-DD>'`). Il promemoria 24h consuma
  il giorno EMAIL: niente digest + promemoria della stessa opportunità nello
  stesso giorno;
- il guard è **PER CANALE DI CONSEGNA** (una riga `email` non blocca `telegram`);
  se il ledger DB non è disponibile resta il file (committato dai workflow):
  nessun duplicato.
- Test: **`npm run test:frequenza`** (cap 2 giorni, stesso giorno, contenuto
  nuovo, marcatori storici) + **`npm run test:dedup:utente`** (guard per canale,
  ledger DB assente, caso Liceo Monti end-to-end su email e batch Telegram) +
  **`npm run test:telegram:tier`** (split PRO/Base e conteggio per canale).

### 6.5.2 Filtro STRICT profilo ↔ opportunità (`npm run test:matching`)
Regola UNICA `avvisoCompatibileConProfilo` (`matchingEngine.ts`), usata da matching in tempo
reale, digest e dispatch: nessun avviso fuori contesto.
1. **Sostegno**: avviso AD… solo a chi ha la preferenza (esplicita o classe AD… tra le proprie).
2. **Provincia**: il profilo deve avere province configurate e quella dell'avviso deve essere
   tra esse (bug risolto: profilo **Torino/Piemonte** che riceveva avvisi **Prato/Toscana**,
   perché `searchInterpelli` senza province non filtrava nulla).
3. **Classe**: serve un'intersezione reale con le classi del profilo (formato normalizzato
   `A-022 ≡ A-22 ≡ A042`); se l'avviso non dichiara classi, la **materia** deve ricadere tra
   quelle delle classi utente (`materiaCompatibileConClassi`).
4. **Competenze e parole chiave** (§26.35): per i profili **senza classi di concorso** i criteri «In
   cosa puoi lavorare, anche oltre la tua classe di concorso?» *sono* la regola di match — un tag di
   catalogo (`materie_id`, risolto nel suo nome) o una parola chiave libera (`materie_custom`) combacia
   col testo dell'opportunità (titolo + materia), con accenti, punteggiatura e plurali normalizzati. I
   profili **con** classi restano sulla regola storica (le competenze non allargano il match) e i token
   generici («laboratorio», «attivita», «scuola»…) non producono match.
5. Preferenze incomplete (senza province, né classi né competenze) → **nessun invio**: meglio nessun
   avviso che un avviso sbagliato. `ignoraFiltri` (enumerazione dei profili notificabili per il
   digest) salta 2–3; l'area sostegno, che non è più una condizione di esclusione, non entra in
   gioco (§26.45).

### 6.6 Ciclo di vita abbonamento — trial PRO 1 mese + promemoria 3–5 giorni
**Policy trial (1 mese).** Un nuovo utente nasce con `piano='pro'`,
`subscription_status='trialing'`, `subscription_tier='pro_annuale'` e
`abbonamento_scade_il = now() + 30 giorni` (migrazione `...20260903040000`);
stessa logica per gli accessi Google (`sync_profilo_oauth`) e per
`attivaTrialPro()` al termine dell'onboarding. Alla scadenza l'account rientra
NATURALMENTE su Base: cron `revert-prove-pro-scadute` (03:30) + self-heal client
in `refreshProfilo()` (`provaProScaduta`). Free Forever e beta tester non vengono
mai toccati (assegnazione manuale).

**Promemoria di rinnovo (finestra 3–5 giorni).** Cron `rinnovo-preavvisi-3-5g`
(ogni giorno alle 09:00) → `public.invia_preavvisi_rinnovo()`
(migrazione `...20260903100000`):
- finestra: `abbonamento_scade_il` tra 3 e 5 giorni (estremi inclusi);
- target: `piano='pro'` e non beta tester — sia **TRIAL** (`trialing`) sia **PRO
  a pagamento**; esclusi `free_forever` (rinnovo automatico a 0€) e beta tester;
- tipo inviato alla Edge: `rinnovo_preavviso_prova` (fine mese gratuito) oppure
  `rinnovo_preavviso_pro` (rinnovo abbonamento), con `giorni` e `scadenza`;
- canali: **EMAIL** (Resend, via Edge `send-notification`) **+ TELEGRAM** (se
  `profiles.telegram_chat_id` è collegato) → template centralizzati
  `email_3_5_rinnovo_prova` / `email_3_6_rinnovo_pro` in `_shared/emailTemplates.ts`
  (CTA `{{link_prezzi}}`);
- idempotenza: `profiles.preavviso_rinnovo_inviato_at` (una sola comunicazione
  per ciclo di vita); al rinnovo o al cambio piano la funzione azzera il flag
  (self-heal), così il promemoria si riarma;
- **UI**: `src/lib/abbonamento.ts` (`giorniAllaScadenza`, `inFinestraPreavviso`,
  `etichettaScadenzaAbbonamento`, `dataScadenzaBreve`, `GIORNI_TRIAL_PRO`) replica
  la stessa finestra lato client e alimenta il banner di rinnovo in
  `RadarStatusToggle` (mostrato solo per il trial nella finestra).

Verifica: `npm run test:rinnovo-preavvisi`.

**Allineamento Edge ↔ DB.** I tipi storici del cron `scadenza-avvisi-multistep`
(`scadenza_preavviso_7d/3d/1d`, `scadenza_finale`) non erano mappati su nessun
template della Edge (risposta `400` → nessun invio): ora la Edge li risolve via
`TIPO_ALIAS` sui template FLUSSO 3 (`email_3_1_scadenza_5` → `email_3_4_scadenza_0`).


---

## 7. Modulistica & Archivista Capo — deep dive

### 7.1 Catalogo (`src/data/moduli.ts` 298 righe + cataloghi dedicati)
- `Modulo[]` = catalogo statico (~271 voci con `id, nome, categoria, macroArea, tipo, descrizione`);
  a cui si aggiungono le macroaree strutturate `macroAreeModulistica` (Infanzia, Primaria,
  Secondaria 1°/2°, Università, Enti, Altro, Sostegno) con `SottoCategoriaModulistica` e
  `DocumentoModulistica`.
- `ordineMacroAree` = ordine di presentazione; `macroAreaById(id)` lookup.
- `conAggiuntaInCima(lista, item, max)` → storico con limite; `getModuliScaricati()` da
  localStorage `scuoleradar:moduli_scaricati`.
- Macroaree legacy: `Tutti, Sostegno & Inclusione, Supplenze e Interpelli, Burocrazia &
  Permessi, Candidature`.

### 7.2 Cache Service (`src/modules/modulistica/creator/cacheService.ts`, 3.126 righe)
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

### 7.3 Generatore PDF (`src/modules/modulistica/creator/pdf/**`, 8 file / 808 righe)

Il vecchio monolite `pdfGenerator.ts` è stato **diviso per responsabilità** (gate `E-DIM`):

| File | Righe | Responsabilità |
|---|---|---|
| `pdf/documento.ts` | 62 | Costruzione del documento (`costruisciDocumento`), intestazione, footer, TOC |
| `pdf/layout.ts` | 78 | Impaginazione: `calcolaLayout` (`compatto`/`esteso`), `stimaPagine` (nessuna pagina bianca) |
| `pdf/stiliBase.ts` | 175 | Tipografia base (Inter/Arial 10.5–11pt), reset, tabelle |
| `pdf/stiliStampa.ts` | 170 | Regole di stampa A4 e margin boxes `@page` |
| `pdf/stiliBlocchi.ts` | 141 | Blocchi di contenuto (`.righe-scrittura` 24px/6px, `.quadro-descrittivo`) |
| `pdf/stiliDensita.ts` | 148 | Varianti di densità (compatto/esteso) |
| `pdf/stiliDocumento.ts` | 18 | Composizione finale degli stili |
| `pdf/testo.ts` | 16 | `escapeHtml` e normalizzazione del testo |
| `creator/logoDataUri.ts` | 9 | Logo come data-URI (nessuna dipendenza da `public/`) |

Riferimento di design: [`PDF_DESIGN_SYSTEM.md`](./PDF_DESIGN_SYSTEM.md).

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

## 8. Calcolatore CFU & CV Builder

### 8.1 Calcolatore CFU (`src/departments/cfu/**`, 105 file / 17.677 righe)

**V1 (prodotto oggi, fase 7).** Flusso: `Classe obiettivo → Titolo di studio → Esami → Calcolo → Risultato → Dossier`.

- **Copertura**: solo le classi con regole reali nel SourceRegistry (A-11, A-12, A-22, DM 22/12/2023 Tabella A), elencate da `calcolatore/classi.ts`; le altre non vengono proposte.
- **Autorità del verdetto**: `EsitoClasseConRouting.esitoMotore` (il verdetto del decisore normativo). `pipeline.stato` **non** è mai letto dalla UI: nessun secondo verdetto.
- **Adapter**: `valutazioneV1.ts` legge la superficie di routing e la normalizza; `esitoUtente.ts` + `esitoUtenteTesti.ts` + `requisitoUtente.ts` traducono in lingua utente (moduli puri, senza React). I componenti non importano nulla di `engine/pipeline`.
- **Deficit**: si pubblica un totale **solo** se `deficit.calcolabile === true`; altrimenti si mostrano i problemi requisito per requisito. `null` non diventa mai `0`.
- **Dati utente**: classe di laurea del titolo e data della procedura sono dichiarati dall'utente; il settore SSD di ogni esame è una scelta esplicita («conosco il settore» / «Non lo so»), mai dedotta.
- **Nessun documento**: in V1 non esistono upload, OCR, parsing PDF, storage o fascicolo persistente. La promessa privacy (`shared/privacy.ts`) dice esattamente questo.
- **Pubblicabile, non più "in sperimentazione"**: `servizi.ts` → `sperimentazione: false` per il CFU (nessun banner "solo su invito"); la descrizione CFU nella `VetrinaModal` è stata allineata (niente "in arrivo a Ottobre / riservato ai PRO").
- **Canale commerciale**: il calcolo e il Dossier sono **gratuiti**. Nel risultato è presente una CTA PRO **discreta** e non bloccante, alimentata dalla pagina (`CalcolatoreCFUDashboardPage` → prop `commerciale`) con il meccanismo esistente `openVetrina('cfu')`; con accesso PRO attivo la CTA diventa solo una conferma. Il dipartimento non importa il contesto applicativo.
- **Modifiche all'adapter di motore (non normative)**: `legacyAdapter.ts` e `analisi.ts` accettano `dateRilevanza`/`dataProcedura` opzionali e li passano alla pipeline; senza data il comportamento è identico a prima (cambia solo l'elenco dei dati mancanti in audit).
- **Legacy non raggiungibile dalla UI**: `analisi.ts` conserva `CLASSI_DI_CONCORSO_MATRICE` (A-26/A-27/A-20 demo) e `analizzaPercorsoDiStudi` per le suite `progressiveWiring`/`multiClassScan`; `docs/CFU_*` restano il riferimento per dossier persistente, fascicolo e identità esame (fase 6.x, non in V1).

Il calcolatore **non è più un singolo componente**: è un dominio verticale completo.

| Sottocartella | Contenuto |
|---|---|
| `calcolatore/` | V1: `CalcolatoreCfuApp` + `classi.ts` (classi coperte) + `valutazioneV1.ts` (motore → adapter) + `requisitoUtente.ts` / `esitoUtente.ts` / `esitoUtenteTesti.ts` (adapter puro) + `components/Step Welcome/Classe/Titolo/Esami/Analisi/Risultato/Dossier` + `components/risultato/**`. LEGACY (solo test, non raggiungibile dalla UI): `analisi.ts` con matrice demo A-26/A-27/A-20 |
| `engine/` | motore normativo **PURO**: `requirementSolver`, `normativeResolver`/`normativeDatabase`, `reportEngine`, `documentParser`, `normalizer`, `sourceGate`, `ssdTaxonomy`, `seeds/`, `sources/` (DM 22/12/2023 A11 · A12/A22/LM14 + raw), `traceability/` (`sourceRegistry`, `traceabilityChain`), `bridge/legacyAdapter`, `pipeline/` (**motore universale dei requisiti**: identificazione → fonti (Source Gate v2) → normalizzazione → requisiti strutturati → valutazione per requisito → deficit → stato semantico + payload sola-lettura per l'Assistente Creativo) |
| `dossier/` | `dossierV1.ts` — Dossier Requisiti `.txt` generato dal RISULTATO V1 (download locale, nessuna conservazione) |
| `landing/` | `CalcolatoreCfuLanding` + `SeoMeta` (pagina pubblica) |
| `shared/` | `CfuErrorBoundary`, `normativa`, `ocrUtils`, `privacy`, `ssdMatrix`, `tutorIntro`, `types` |
| `__tests__/` · `engine/__tests__/` | 27 suite eseguite da `npm test` (`engineAudit`, `verticalSlice1`, `traceabilityChain`, `sourceRegistry`, `legacyAdapter`, `universalPipeline`, `universalPipelineSemantica`, `universalPipelineRealSource`, `bridgePipelineParity`, `routingPipelineParity`, `reportPipelineParity`, `statusTruthTable`, `statusInvariants`, `statusAmbiguities`, `statusAmbiguitiesTitoli`, `statusContextCause`, `statusRequirementFacts`, `statusAuthorityDivergences`, `statusCoverageGuard`, `dossierAccademicoContract`, `progressiveWiring`, `multiClassScan`, `esitoUtenteV1`, `esitoUtenteV1Guardie`, `valutazioneV1Engine`, `valutazioneV1Casi`, `dossierV1`). Le cinque suite `*V1*` verificano il contratto utente della V1 (5 stati, deficit pubblicabile, dati mancanti, settore SSD non dedotto, contenuto del Dossier .txt) e il percorso `classi.ts → valutaClasseV1 → esitoUtente`. L'aggregazione di stato è verificata contro l'implementazione di PRODUZIONE (`engine/pipeline/status.ts`): nessuna copia dell'algoritmo nei test; contratti e invarianti in `docs/CFU_STATUS_AGGREGATION_SPEC.md`, `docs/CFU_FASCICOLO_ACCADEMICO_SPEC.md` (modello e provenienza), `docs/CFU_DOSSIER_PERSISTENTE_SPEC.md` (fascicolo persistente: politiche e adeguamenti) e `docs/CFU_IDENTITA_ESAME_SPEC.md` (identità semantica dell'esame e confine della deduplica) |
| `index.ts` | Entry pubblica: `CalcolatoreCfuApp`, `CalcolatoreCfuLanding` |

- Preset `TITOLI_STUDIO` (L-19, LM-85, LM-14, …) con `esamiTipici` `{ materia, cfu, settore }`;
  input esami (materia, CFU, settore SSD) → per ogni `ClasseConcorso` selezionata verifica i
  `requisitiCfu` per ambito, calcola i CFU mancanti e mostra l'ammissibilità indicativa.
- **Paywall**: accesso ai risultati completo solo con account/PRO (`ServiziPaywall`).

### 8.2 CV Builder (`src/components/CvTool.tsx`, 174 righe; montato da `pages/CvPage.tsx`)

⚠️ È l'ultimo tassello di "Formazione & Carriera" ancora **fuori dalla gerarchia dei domini**:
candidato a migrare in `src/departments/cv/` (vedi `DEPARTMENT_MAP.md` §6).
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

### 9.3 `relevanceEngine.ts` (Node-only, PURO) — standard editoriale STRETTO

- **Temi ammessi (allow-list 360°)**: `TEMI_OPERATIVI` (= `standardTemiPersonale` +
  `standardTemiIA` + `standardTemiDidattica`, riuniti da `editorialStandard`) + `classificaTemaPersonale()` —
  CCNL e stipendi, pensioni, welfare e polizza sanitaria, mobilità e assegnazioni,
  GPS/graduatorie/supplenze/interpelli, organico e cattedre, sostegno, ATA e segreterie
  (DSGA), istruzione adulti (CPIA), formazione (TFA/CFU, classi di concorso), reclutamento
  e immissioni in ruolo, PNRR, sicurezza, intelligenza artificiale;
  *normativa/scadenze/concorsi* contano solo con riferimento esplicito al personale.
  L'ordine dell'elenco è la **priorità di match**: vince il primo tema riconosciuto.
- **Tema autonomo «Intelligenza Artificiale»** (`standardTemiIA.ts`): categoria propria
  (`PESI_CATEGORIA` 76, sopra *Innovazione Digitale*), lessico dedicato (`PAROLE_IA` in
  `lessicoScuola.ts`: intelligenza artificiale, IA generativa, chatbot, machine learning,
  LLM…), copy dedicato (`ARTICOLO_ALTRE` in `relevanceEngine.ts`) e sigla `IA` nel
  `GLOSSARIO_ACRONIMI` (spiegata alla prima menzione, anche nel titolo). L'ordine voluto è
  personale → IA → didattica: l'IA non ruba il match ai temi storici (*formazione*,
  *scadenze*) ma vince su *innovazione digitale*, *didattica* e *pedagogia*.
- **Fatto concreto**: `CATEGORIE_CON_FATTO_CONCRETO` (intelligenza artificiale, innovazione
  digitale, didattica, pedagogia) — i temi culturali/didattici passano SOLO con una
  **scadenza reale** o un
  **canale ufficiale di domanda/candidatura**; senza, `valutaRilevanza` li respinge con
  motivo tracciabile («Tema X senza fatto concreto»).
- **Scoring**: `punteggioRilevanza(categoria, haScadenza)` legge `PESI_CATEGORIA` (base per
  tema, bonus scadenza, tetto 100): la matrice dei pesi è unica per motore e test. Le
  categorie d'archivio uscite dall'allow-list (`Assegnazioni Provvisorie`,
  `Ricostruzione Carriera`, `Riconoscimento Titoli`, `Scuole`) restano mappate.
- **Lessico condiviso**: `lessicoScuola.ts` (`PAROLE_OPERATIVE` = storico + voci 360°,
  `GLOSSARIO_ACRONIMI`, `FRASI_FLUFF`), ri-esportate da `relevanceEngine.ts` con i nomi
  storici (es. `PAROLE_ACCETTA`) per copy, igiene archivio e documentazione.
- **Anti-ufficio-stampa (zero fluff)**: `titoloDaUfficioStampa`, `FRASI_FLUFF` +
  `contieneFraseFluff` scartano comunicati, lettere del Ministro, dichiarazioni, eventi e
  rinvii vaghi ("ti avvisiamo appena esce", "verifica nel testo ufficiale").
- **Gate 2-bis**: `PAROLE_IMPATTO` **+** `PAROLE_SCUOLA` (`valutaRilevanza`) — nessun
  articolo senza impatto pratico sul personale (corregge lo stop del 14/09).
- **Link**: `classificaLink` (`diretto` / `contenitore` / `non-valido`: solo `non-valido`
  blocca), `linkVietatiInHtml`, `validaUrlDeepLink`, `èLinkPdf`, `èFonteCanonica`.
- **Doppio link obbligatorio**: `CANALI_DOMANDA` + `linkDomandaUfficiale()` +
  `richiedePresentazioneDomanda()` — per le procedure si pubblica la fonte ufficiale **e**
  il canale di presentazione (Istanze Online/POLIS, Unica, InPA, INPS, PNRR Istruzione);
  un annuncio di procedura senza canale viene **scartato**.
- **Formato editoriale**: `applicaFormatoEditoriale` → `titoloAzione` (rimozione di
  etichette, date e codici), sintesi `summary_points` a bullet (*Cosa cambia · Chi riguarda
  · Scadenza · Cosa devi fare · Presenta la domanda*), acronimi spiegati alla prima
  occorrenza (`GLOSSARIO_ACRONIMI` + `espandiAcronimi`).
- **Cadenza**: `verificaCadenzaSettimanale` / `limitaCadenzaSettimanale` con
  `MAX_ARTICOLI_SETTIMANA = 3`, `FINESTRA_LOOKBACK_GIORNI = 15`,
  `FINESTRA_LOOKBACK_NAZIONALE_GIORNI = 60`, `MAX_ARTICOLI_FINESTRA = 6`.
- **Gate finale**: `articoloValido` (id/titolo/link presenti, fonte canonica nazionale,
  nessun link non valido nel testo). Verificato da `npm run test:notizie-editoriale`,
  `test:notizie-feed`, `test:notizie-nazionale`, `test:notizie-rate`; la catena editoriale
  copre anche l'allow-list 360° (ordine di priorità, macro-aree, pesi), il gate del fatto
  concreto, l'alias `PAROLE_ACCETTA` senza duplicati e l'audit multi-tema (`temiDalTesto`).

### 9.4 `ingestNotizie.ts` (CLI)
Pipeline: raccogli voci (`newsFetcher`, waterfall) → valuta rilevanza (**temi ammessi +
gate 2-bis**, §9.3) → **gate procedura senza canale di domanda** → gate link
punto-a-punto → verifica HTTP 200 → genera articolo → **formatta PRIMA dell'igiene**
(`applicaFormatoEditoriale`) → **tetto settimanale** (max 3) con **riserve**
(`èRiservaSettimanale`) e **`applicaGaranziaSettimanale`** → accoda a
`notizieIngestite.ts` (scrittura via `archivioNotizie.ts`) o `--dry-run`.

Esiti: `✓ HTTP 200 - 0 new posts criteria matched` (file invariato, nessun commit) ·
`✗ HTTP FAIL` (exit 1 → warning nel workflow) · **settimana senza articoli → exit 1**
(il workflow fallisce: la bacheca ferma è un incidente, non un esito normale).

**Manutenzione**: `npm run notizie:ripara-archivio` (opzione `-- --dry`) rigenera
il copy dell'archivio storico (git HEAD + corrente) con le regole editoriali
correnti e rimuove le voci non conformi: serve quando cambiano le regole di copy
o di link, perché l'ingestione non riscrive il copy già pubblicato.

### 9.5 Automazione (`.github/workflows/scrape-notizie.yml`)
- Cron **ogni giorno 06:00 UTC** + `workflow_dispatch`; `permissions: contents: write`.
- `npm ci` → `npm run scrape:notizie:check` → `npm run scrape:notizie`.
- Se ci sono nuove notizie: commit `notizieIngestite.ts` con messaggio
  `chore(notizie): aggiornamento automatico dati ingestiti [skip ci]` e push → deploy Vercel.
- **Tetto settimanale max 3** prima del salvataggio; **se la settimana resta vuota il job
  fallisce** (sorveglianza attiva: la bacheca non può restare ferma senza segnale).


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
- `LandingPage` → `LandingHero` (**due colonne** `lg:grid-cols-[minmax(0,1fr)_34rem]`: copy a
  **due righe** a sinistra — «Ogni giorno decine di opportunità.» / «Noi intercettiamo solo
  quelle per te.» su `span.block`, mai interruzioni di markup — e box «Prova il Radar»
  (`SimulatorRadar`, **sola provincia**) a destra, con le due colonne allineate in altezza
  (`items-stretch`) e gli inviti all'azione ancorati in basso (`lg:mt-auto`)) →
  `LandingRegistrazioneRapida` (**solo visitatori**: form **condiviso**
  `FormRegistrazioneRapida` — Nome, Cognome, Email → bozza + modale di
  configurazione del Radar già compilata) → `FlightBoardInterpelli`
  («Radar Live», **primo contenuto dopo l'hero**: nessun riquadro di chiusura, §26.15) →
  `LandingOffertaPro` (leva di conversione:
  sta **prima** di «Cosa riceverai», **tre benefici** e una sola CTA, nessun link ad altri
  piani; monta lo stesso form rapido con `onRegistrazioneRapida`) → `LandingBenefici` → «Come funziona» (primo passo **«Imposta il tuo Radar»**) + valori →
  `LandingStrumenti` (card centrate) → `LandingPartnerPureFocus` (vetrina `PureFocusCard`) → stats →
  `LandingCta` → `Footer`.

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
- Price ID **solo da secrets** (`STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_MONTHLY`,
  `STRIPE_PRICE_ID_CONSUMO`; retrocompatibili: `STRIPE_PRICE_PRO_ANNUALE`/`_MENSILE`/`_A_CONSUMO`)
  con **fallback sui Price ID LIVE attivi** (tabella §12.3) — mai fidarsi di priceId client.
  Product ID LIVE di riferimento: `prod_VB9makC3Y0XBKH` (annuale 49€), `prod_VB9nHSVaw9Tlhi`
  (mensile 9€), `prod_VB9oCAZRUAgjEp` (a consumo 5€).
- Promo pre-fillato (es. `BETA1ANNO`): mappato server-side sul **Coupon ID** `XRxitsVf`
  (sconto 100% sul PRO annuale → totale 0,00 € subito nel checkout hosted) e applicato alla
  sessione via `discounts[0][coupon]` + `metadata[promo]` (mai `discounts[0][promotion_code]`).
- **`BETA1ANNO` è validato, non solo applicato** (2026-09-22): accettato SOLO con
  `plan='pro_annuale'` (su mensile/crediti un coupon "annuale" al 100% regalerebbe un
  abbonamento che il codice non copre) e **consultato su `promo_codes`** prima di azzerare il
  totale (lettura service_role di `attivo`/`scade_il`/`monouso`/`usato_il`): se il DB conosce il
  codice e lo rifiuta → **HTTP 400 con il motivo**; se la tabella non è leggibile o la riga
  manca (seed non applicato) → fail-open con avviso nel log (un timeout non deve bloccare la
  campagna beta). Nessun accesso anonimo: `[functions.checkout] verify_jwt = true` in
  `supabase/config.toml`.
- `[functions.checkout]` ha `verify_jwt = true` **esplicito** in `supabase/config.toml`: la
  sessione è creata a nome dell'utente del JWT (un `--no-verify-jwt` permetterebbe di attribuire
  un pagamento all'account di un altro). Conseguenza voluta: in modalità Guest il ping di
  diagnostica risponde 401 → il System Health Check lo considera **OK** (§12.4).
- L'**attivazione** dell'anno PRO gratuito avviene nel `webhook` (§12.2), non nel prezzo:
  coupon e `piano='pro'` sono solo parte della catena.
- Referral: `validaPromo` → coupon `REFERRAL_COUPON_ID` (fallback `STRIPE_COUPON_REFERRAL_10`)
  su PRO annuale e crediti;
  `metadata[promo]`/`metadata[promo_referrer]` per il webhook.
- `allow_promotion_codes: true` abilitato SEMPRE, tranne quando è già stato applicato uno sconto
  automatico (coupon referral o coupon `BETA1ANNO` pre-fillato): i due parametri sono mutuamente esclusivi.
- URL success/cancel dinamici: `origin + /dashboard/radar?esito=successo|annullato`.
- `client_reference_id` e `metadata[user_id]` = userId; `customer_email` se nel JWT.

### 12.2 Edge `webhook` (firma HMAC Stripe)
- Verifica `stripe-signature` (WebCrypto HMAC-SHA256, formato `t=…,v1=…`).
- Eventi:
  - `checkout.session.completed`: `mode=payment` → `+1 credito` (RPC
    `incrementa_crediti_utente`); `mode=subscription` → `piano='pro'` +
    `stripe_subscription_id`; se `metadata.promo_referrer` → `registraReferral(10,10)`.
  - **Codice beta** (`metadata.promo` ∈ `BETA1ANNO`/`BETALIFETIME`, `payment_status` `paid`
    o `no_payment_required`): chiama la RPC canonica **`attiva_codice_promo`**, che in modo
    atomico porta `piano='pro'`, `abbonamento_scade_il = now() + 1 anno` (o NULL per
    `lifetime`), **`is_beta_tester = true`** (→ flow "Rinnovo Omaggio a Vita") e **consuma il
    codice monouso**. Prima del 2026-09-22 questa chiamata non esisteva: il coupon Stripe
    azzerava il prezzo ma il codice restava riusabile e il beta tester non era riconosciuto.
    Errori e codici già consumati (retry) sono loggati e NON interrompono il webhook.
  - `customer.subscription.created/updated`: piano `pro` se `active|trialing`,
    `abbonamento_scade_il = current_period_end`.
  - `customer.subscription.deleted`: `piano='base'`, reset id/scadenza.
- Sempre `ack` 200 (mai far ritentare Stripe).

### 12.3 Passaggio TEST → LIVE
Tutto è già pronto: il codice legge **solo da secrets** e non cambia tra modalità. In più, se un
secret `STRIPE_PRICE_ID_*` manca, il codice usa il **Price ID LIVE attivo** come fallback (mai un
test ID). Per passare in produzione basta aggiornare i secrets Supabase (nessun redeploy del codice):
1. `STRIPE_SECRET_KEY` → `sk_live_…` (la modalità viene auto-rilevata dal prefisso `sk_live_`).
2. `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_CONSUMO` → i Price ID
   dello **Stripe Live** (attenzione: gli ID test e live sono diversi anche per lo stesso prezzo).
3. `STRIPE_WEBHOOK_SECRET` → signing secret (`whsec_…`) dell'endpoint **Live** (endpoint webhook separato).
4. `REFERRAL_COUPON_ID` → ID del coupon Live (se si vuole mantenere lo sconto referral -10€).
5. `STRIPE_COUPON_BETA1ANNO` → Coupon ID del codice attivo `BETA1ANNO`
   (default `XRxitsVf`, sconto 100% sul PRO annuale).
6. `STRIPE_MODE=live` (facoltativo, esplicito) — il log di avvio di `checkout`/`webhook` riporta la
   modalità; il `ping` di `checkout` restituisce
   `{ mode, configurato, priceMancanti, productIds, couponBeta1Anno, webhookEndpoint, couponReferral }`.
7. Verifica con un pagamento reale di prova (es. piano mensile) e controlla i log della Edge Function
   `webhook` (piano=`pro`, scadenza=`current_period_end`).

**Valori di produzione attuali (Stripe):**
| Secret | Valore |
|---|---|
| `STRIPE_PRODUCT_ID_ANNUAL` | `prod_VB9makC3Y0XBKH` — PRO annuale 49€ |
| `STRIPE_PRODUCT_ID_MONTHLY` | `prod_VB9nHSVaw9Tlhi` — PRO mensile 9€ |
| `STRIPE_PRODUCT_ID_CONSUMO` | `prod_VB9oCAZRUAgjEp` — a consumo 5€ |
| `STRIPE_PRICE_ID_ANNUAL` | `price_1UAnSqKHxfBbZQd8xtvuLMVK` — PRO annuale 49€ |
| `STRIPE_PRICE_ID_MONTHLY` | `price_1UAnTeKHxfBbZQd8iqjzlvn0` — PRO mensile 9€ |
| `STRIPE_PRICE_ID_CONSUMO` | `price_1UAnUXKHxfBbZQd8n1UfrIkI` — a consumo 5€ |
| `STRIPE_COUPON_BETA1ANNO` | `XRxitsVf` — codice `BETA1ANNO`, sconto 100% sul PRO annuale |
| `REFERRAL_COUPON_ID` | `TOQf7ze2` — coupon -10€ sul PRO annuale |
| `WEBHOOK_ENDPOINT` | `https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/webhook` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` — signing secret dell'endpoint (test o live) |

**Payout / accrediti bancari (Wise):**
- **Beneficiary**: Bartolo Ansaldi
- **IBAN**: BE07 9058 5022 0666
- **SWIFT/BIC**: TRWIBEB1XXX
- **Bank Address**: Wise, Rue du Trône 100, 3rd floor, Brussels, 1050, Belgium

---

## 13. Database Schema completo (Supabase Postgres)

### 13.1 `public.profiles` (RLS: ogni utente legge/modifica solo il proprio)
| Colonna | Tipo | Note |
|---|---|---|
| `id` | uuid PK | references `auth.users(id)` ON DELETE CASCADE |
| `email` | text | email account |
| `nome`, `cognome` | text | usati dal trigger referral |
| `genere` | text | `'M'|'F'|NULL` (check `profiles_genere_check`) — declina email (Cara/Caro, stata/stato) |
| `eta` | integer | età in anni (14–100, check `profiles_eta_check`) — dato demografico del profilo |
| `provincia` | text | **provincia di RESIDENZA** (codice 2 lettere, es. `RM`; check `profiles_provincia_check`, migrazione `20260922120000_add_profiles_provincia.sql`) — distinta dalle `province_*` del Radar (dove l'utente VUOLE lavorare). Raccolta in registrazione / mini-onboarding anagrafico |
| `ordini` / `ordini_scuola` | text[] default '{}' | ordini di interesse (legacy / nuovo) |
| `classi_concorso` | text[] | classi di concorso |
| `sostegno` | boolean not null default **true** | preferenza SOSTEGNO: dal 27/09/2026 il sostegno è **incluso di default** — nessun avviso ADAA/ADEE/ADMM/ADSS filtrato in silenzio; l'utente lo esclude solo con una scelta esplicita (migrazione `20260927120000_default_sostegno_incluso.sql`: `not null default true` + backfill; colonna d'origine `20260914040000_add_profiles_sostegno.sql`, con backfill dell'adesione implicita di chi ha una classe `AD*`) |
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
`published_at timestamptz` (data di pubblicazione dell'avviso), `expiration_date timestamptz`
(scadenza REALE del bando), `materia text` (settore inferito per i generici "DOCENTE"),
`contact_email text` (email di candidatura), `created_at timestamptz`.
Indici: `interpelli_province_idx` (province), `interpelli_class_codes_idx` (GIN class_codes),
`interpelli_expiration_idx` (expiration_date), `interpelli_published_idx` (published_at).
Policy "read interpelli" select true.
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
`send_notification_secret` per le chiamate pg_cron/trigger → Edge Function, e le
**automazioni email** del pannello Admin:

| Chiave | Contenuto |
|---|---|
| `send_notification_url` / `send_notification_secret` | endpoint + secret della Edge `send-notification` |
| `email_automazione_<id>` | JSON `{ abilitata, oggetto?, intro?, corpo?, aggiornatoIl, aggiornatoDa }` — interruttore e testi di UNA automazione (id del catalogo `src/config/automazioniEmail.ts`: benvenuto, attivazione_pro, radar_spento, drip_base, preavvisi_rinnovo, scadenza_abbonamento, free_forever_rinnovo, beta_ritenzione, digest_giornaliero, alert_pro_tempo_reale, promemoria_scadenza) |

Le righe `email_automazione_*` vengono **rimosse** quando lo stato torna al default
(automazione attiva, testi dal codice). La lettura è sempre difensiva: KV assente
o illeggibile → automazione ATTIVA (vedi `src/lib/automazioniEmailDb.ts` e
`supabase/functions/_shared/automazioniEmail.ts`). Il pannello che le governa è
`components/TabEmailAutomazioni` (tab «✉️ Email & Automazioni»), verificato da
`npm run test:automazioni`.

### 13.8 `public.admin_telegram_log` (RLS: nessun accesso client — solo service_role)
`id uuid PK`, `telegram_id bigint not null`, `chat_id bigint`, `username text`,
`command text not null`, `payload text`, `autorizzato boolean default false`, `created_at`.
Audit dei comandi del bot Telegram ADMIN (Edge `telegram-admin-webhook`); registra anche i
tentativi NON autorizzati. Indici su `created_at desc` e `telegram_id`.

### 13.9 `public.scraper_runs` (RLS: nessun accesso client — solo service_role)
Una riga per esecuzione dello scraper: `started_at`, `finished_at`, `durata_ms`, `modalita`
(`reali`|`fixture`), `province text[]`, `trovati`, `nuovi`, `upsert_ok`, `telegram_attesi`,
`telegram_riusciti`, `errori`, `esito` (`ok`|`warn`|`error`), `messaggio`, `created_at`.
Alimenta la diagnostica `/status` (run recenti + tasso errori). Indici su `created_at desc`, `esito`.

### 13.10 `public.admin_telegram_alerts` (RLS: nessun accesso client — solo service_role)
`id uuid PK`, `severity` (`critical`|`warning`|`info`), `category`, `title`, `message`,
`meta jsonb`, `inviato boolean`, `created_at`. Storico degli alert inviati all'admin
dall'helper `inviaAlerta` della Edge `telegram-admin-webhook`. Indici su `created_at desc`, `severity`.

---

### 13.11 Colonne verificate per tabella (dump delle migrazioni)

Origine: parsing automatico di `supabase/migrations/*.sql` (52 file). Dove il DDL è
spezzato su più statement la colonna è elencata nella riga `ADD` della tabella migrazioni
(§13.12). Le colonne sono quelle **realmente dichiarate** in repo: nessuna invenzione.

**`public.interpelli`** — avvisi del Radar (sorgente del feed e delle notifiche)

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `hash_id` | `text unique not null` — chiave di deduplica dello scraper |
| `title` | `text not null` |
| `province` | `text not null` — codice provincia (es. `FC`) |
| `class_codes` | `text[] not null default '{}'` — classi di concorso/ATA |
| `school_name` | `text` |
| `school_code` | `text` — codice meccanografico |
| `source_url` | `text not null` — link ufficiale dell'avviso |
| `expiration_date` | `timestamptz` — scadenza (≠ pubblicazione) |
| `published_at` | `timestamptz` — aggiunta da `20260903060000` |
| `materia` | `text` — aggiunta da `20260903090000` |
| `contact_email` | `text` — email della scuola (PEO/PEC), aggiunta da `20260903090000` |
| `created_at` | `timestamptz default now()` |

RLS: `read interpelli` (lettura pubblica/anon, nessuna scrittura client).
Scritture: solo `service_role` (scraper Node) — upsert per `hash_id`.

**`public.profiles`** — profilo, preferenze Radar, piano, quota notifiche, ciclo di vita

| Gruppo | Colonne |
|---|---|
| Identità (base `20260822030000`) | `id uuid primary key references auth.users(id) on delete cascade` · `email text` · `nome text` · `cognome text` · `created_at` · `updated_at` |
| Preferenze Radar (base + `20260822010000`/`20260822040000`/`20260825160000`) | `ordini text[] default '{}'` · `classi_concorso text[] default '{}'` · `materie_id text[] default '{}'` · `materie_custom text[] default '{}'` · `province_attive text[] default '{}'` · `favorite_schools text[] default '{}'` · `ignored_schools text[] default '{}'` · `ordini_scuola` · `province_interesse` |
| Recapiti & canali | `telegram_username text default ''` · `telegram_chat_id` (`20260822050000`) · `email_notifica text default ''` · `telefono` (`20260902020000`) · `onboarded boolean default false` |
| Billing (`20260822060000`) | `piano` · `stripe_customer_id` · `stripe_subscription_id` · `abbonamento_scade_il` · `crediti` · `notifiche_usate` · `notifiche_mese` |
| Quota notifiche (`20260829100000`→`20260903020000`) | `notifiche_blocco_inviato` · `notifiche_recap_inviato` · `notifiche_anno` |
| Drip & step (`20260831030000`) | `step` · `step4_inviata_at` · `step5_inviata` (usati da `dispatch_step5_due`, §13.16) |
| Referral & promo | `referral_code` (`20260822100000`), tabella `coupon_usage` per l'uso monouso dei coupon di sconto (SCUOLERADAR50) |
| Beta & Free Forever | `is_beta_tester` (`20260831170000`/`20260902040000`) · `beta_rinnovo_email_inviata` · `is_free_forever` (`20260903010000`) |
| Abbonamento avanzato | `subscription_tier` · `subscription_status` · `current_period_end` (`20260901000000`, ridichiarate in `20260902234600`) · `pro_tipo` (`20260902030000`) |
| Ciclo scadenza (`20260831180000`, `20260903100000`) | `scadenza_avviso_stadio` · `preavviso_rinnovo_inviato_at` |
| Admin/diagnostica | `login_type` · `radar_attivo` (`20260902020000`/`20260903000000`) |
| Anagrafica extra | `genere` (`20260831200000`/`20260902110000`) · `eta` (`20260902110000`) · `avatar_url` (`20260902230000`) · `sostegno` (`20260914040000`) · `moduli_scaricati` (`20260822040000`) |

RLS: `read own profile` (select) · `insert own profile` · `update own profile` — sempre
`auth.uid() = id`; il trigger `set_profiles_updated_at` mantiene `updated_at`.
Guardia `profiles_auth_upsert_guard` (`20260903110000`): `piano_protetto(...)` impedisce che
un upsert client declassi un piano protetto (PRO/Free Forever/beta).

**`public.referrals`** (`20260822100000`) — inviti "Invita un Collega"

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `referrer_id` | `uuid references public.profiles(id) on delete cascade` |
| `referred_user_id` | `uuid references public.profiles(id) on delete set null` |
| `discount_applied` | `numeric not null default 10.00` |
| `reward_amount` | `numeric not null default 10.00` |
| `status` | `text not null default 'pending'` |
| `created_at` | `timestamptz not null default now()` |

RLS: `read own referrals` (solo il referrer). Codice generato da `genera_referral_code()` +
trigger `set_referral_code` su `profiles`.

**`public.generated_modules`** (`20260827100000`) — cache dei moduli generati dall'AI

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `query_hash` | `text unique not null` — SHA-256 della query normalizzata (cache hit a costo zero) |
| `query` | `text not null` |
| `title` | `text not null` |
| `content_html` | `text not null` |
| `meta` | `jsonb not null default '{}'::jsonb` |
| `created_at` · `updated_at` | `timestamptz not null default now()` |

RLS: `read generated modules` (select a tutti gli autenticati); scrittura solo
`service_role` (Edge `genera-modulo`). Trigger `set_generated_modules_updated_at`.

**`public.user_saved_modules`** (`20260827100000` + `20260831190000`) — "I miei Modelli"

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `user_id` | `uuid not null references public.profiles(id) on delete cascade` |
| `module_key` | `text not null` |
| `module_source` | `text not null default 'generated'` |
| `title` | `text not null` |
| `tipo` | `text not null default ''` |
| `template_id` | aggiunta da `20260831190000` (versioning template) |
| `master_version` | aggiunta da `20260831190000` |
| `created_at` | `timestamptz not null default now()` |

**`public.app_settings`** (`20260831030000`) — KV di servizio usata dal DB per chiamare la Edge

| Colonna | Tipo / vincolo |
|---|---|
| `key` | `text primary key` |
| `value` | `text not null` |

Valori seminati dalla migration: `send_notification_url`
(`https://gwdmsgsshvdnfrplbjiv.supabase.co/functions/v1/send-notification`) e
`send_notification_secret` (header `x-send-secret` verificato dalla Edge). RLS: nessun
accesso client (solo `service_role`/funzioni `security definer`).

**`public.promo_codes`** (`20260831160000`) — codici promo (BETA1ANNO; SCUOLERADAR50 = -50% annuale, monouso per email)

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| altre colonne | gestite esclusivamente da `valida_codice_promo()` / `attiva_codice_promo()` (§14): lettura e consumo mai dal client (§11.2) |

RLS: nessuna policy client. L'uso monouso del coupon è tracciato in **`public.coupon_usage`**
(policy `read own coupon usage` + `insert own coupon usage`), una riga per utente =
sconto già consumato. Il codice RADAR50 è stato RIMOSSO dalla tabella e dalle funzioni
(`20260924120000_coupon_scuoleradar50_unico.sql`).

**`public.school_deadlines`** (`20260902000000`) — scadenze scolastiche (Revolver)

Popolata da `npm run scadenze:sync` (`scripts/sync-deadlines.ts`) e letta dal widget
`RevolverScadenze`; policy `read school_deadlines` (lettura pubblica). Fallback locale:
`src/data/deadlinesFallback.json` (nessuna configurazione = nessuna rete).

**`public.admin_telegram_log`** (`20260903070000`) — comandi ricevuti dal bot admin

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` (implicito) |
| `telegram_id` | `bigint not null` |
| `chat_id` | `bigint` |
| `username` | `text` |
| `command` | `text not null` |
| `payload` | `text` |
| `autorizzato` | `boolean not null default false` |
| `created_at` | `timestamptz not null default now()` |

Presente anche `update_id` (idempotenza del webhook). RLS: nessun accesso client.

**`public.scraper_runs`** (`20260903080000`) — telemetria di ogni run dello scraper

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `started_at` · `finished_at` | `timestamptz` (`started_at not null default now()`) |
| `durata_ms` | `integer` |
| `modalita` | `text not null default 'reali'` (reali/`--dry-run`) |
| `province` | `text[] not null default '{}'` |
| `trovati` · `nuovi` | `integer not null default 0` |
| `upsert_ok` | `boolean not null default true` |
| `telegram_attesi` · `telegram_riusciti` | `integer not null default 0` |
| `errori` | `integer not null default 0` |
| `esito` | `text not null default 'ok'` |
| `messaggio` | `text` |
| `created_at` | `timestamptz not null default now()` |

**`public.admin_telegram_alerts`** (`20260903080000`) — alert verso il bot admin

| Colonna | Tipo / vincolo |
|---|---|
| `id` | `uuid primary key default gen_random_uuid()` |
| `severity` | `text not null default 'warning'` |
| `category` | `text not null default 'generale'` |
| `title` · `message` | `text not null` |
| `meta` | `jsonb` |
| `inviato` | `boolean not null default false` |
| `created_at` | `timestamptz not null default now()` |

**`public.notifications_log`** (`20260914010000`, riparata in `20260914030000`) — registro invii per utente

| Colonna | Tipo / vincolo |
|---|---|
| `user_id` | `uuid not null references public.profiles(id) on delete cascade` |
| `interpello_hash` | `text not null` |
| `canale` | `text not null` — `email` \| `telegram` \| `freq_email` \| `freq_telegram` |
| `sent_at` | `timestamptz not null default now()` |

È il ledger **server-side** che affianca il ledger su file (§6.5.1): entrambi alimentano il
frequency cap e la deduplica. RLS: nessun accesso client.

**`public.channel_posts_log`** (`20260914020000`) — registro pubblicazioni sui canali Telegram

| Colonna | Tipo / vincolo |
|---|---|
| `interpello_hash` | `text not null` |
| `canale` | `text not null` — handle del canale regionale/ATA |
| `sent_at` | `timestamptz not null default now()` |

Serve al gate "un solo post per canale" (`deduplica PER CANALE`, `test:telegram:tier`).

**`public.notices`** — tabella parallela agli interpelli gestita dallo scraper

Non compare nel DDL rilevato automaticamente (creata con DDL multi-statement), ma è
referenziata dagli script di manutenzione (`pulisci-scaduti.ts`,
`pulisci-dati-non-verificati.ts`, `audit-dati.ts`): ogni igiene applicata a `interpelli`
viene applicata anche a `notices`.

---

### 13.12 Indice completo delle 56 migrazioni (cosa introduce ognuna)

| Migrazione | Contenuto |
|---|---|
| `20260822010000_add_school_filters` | `profiles.favorite_schools`, `profiles.ignored_schools` |
| `20260822020000_create_interpelli` | tabella `interpelli` + policy `read interpelli` |
| `20260822030000_create_profiles` | tabella `profiles` + `handle_profiles_updated_at()` + 3 policy + trigger `set_profiles_updated_at` |
| `20260822040000_extend_profiles` | `ordini_scuola`, `province_interesse`, `moduli_scaricati` |
| `20260822050000_add_telegram_chat_id` | `telegram_chat_id` |
| `20260822060000_add_billing_stripe` | `incrementa_notifiche_utente()` v1 + `piano`, `stripe_customer_id`, `stripe_subscription_id`, `abbonamento_scade_il`, `crediti`, `notifiche_usate`, `notifiche_mese` |
| `20260822070000_add_rpc_incrementa_crediti` | `incrementa_crediti_utente(p_user_id uuid, p_delta integer default 1)` |
| `20260822100000_add_referrals` | tabella `referrals` + `genera_referral_code()`, `handle_referral_code()`, `valida_codice_promo()` + policy + trigger `set_referral_code` + `profiles.referral_code` |
| `20260825160000_align_profiles_schema` | `nome`, `cognome`, `ordini`, `materie_id`, `materie_custom`, `telegram_username`, `email_notifica`, `onboarded` |
| `20260826100000_add_rpc_consuma_credito` | `consuma_credito_utente(p_user_id uuid)` |
| `20260827100000_create_generated_modules` | tabelle `generated_modules` + `user_saved_modules` + `handle_generated_modules_updated_at()` + 4 policy + trigger |
| `20260829000000_add_rpc_notifiche_limite_totale` | `incrementa_notifiche_utente()` v2 (limite totale) |
| `20260829100000_add_notifiche_blocco_inviato` | `notifiche_blocco_inviato` (guardia d'invio email) |
| `20260829110000_add_notifiche_recap_inviato` | `notifiche_recap_inviato` (guardia d'invio Telegram) |
| `20260830000000_add_rpc_notifiche_annuali` | `incrementa_notifiche_utente()` v3 + `notifiche_anno` (quota annuale) |
| `20260831010000_fix_rpc_notifiche_ambiguita` | `incrementa_notifiche_utente()` v4 — fix ambiguità di colonna |
| `20260831030000_add_step5_scheduling` | tabella `app_settings` + `dispatch_step5_due()` + trigger su `auth.users` + **cron `step5-notifiche` (ogni minuto)** + `profiles.step`, `step4_inviata_at`, `step5_inviata` |
| `20260831100000_add_rpc_notifiche_annuali_reset_extra` | `incrementa_notifiche_utente()` v5 (reset extra) |
| `20260831150000_switch_rpc_notifiche_anno_scolastico` | `incrementa_notifiche_utente()` v6 (quota sull'anno scolastico) |
| `20260831160000_add_promo_codes_beta` | tabella `promo_codes` + `valida_codice_promo()` v2 + `attiva_codice_promo()` |
| `20260831170000_add_beta_tester_retention` | `attiva_codice_promo()` v2 + `beta_rinnovo_omaggio_vita()` + **cron `beta-rinnovo-omaggio-vita` (09:00)** + `is_beta_tester`, `beta_rinnovo_email_inviata` |
| `20260831180000_add_scadenza_avvisi_multistep` | `invia_avvisi_scadenza_abbonamento()` + `beta_rinnovo_omaggio_vita()` v2 + **cron `scadenza-avvisi-multistep` (09:00 e 18:00)** + `scadenza_avviso_stadio` |
| `20260831190000_add_template_versioning` | `user_saved_modules.template_id`, `master_version` |
| `20260831200000_add_profiles_genere` | `profiles.genere` |
| `20260901000000_add_account_bridge` | `get_user_pro_status(p_user_id uuid)` + `subscription_tier`, `subscription_status`, `current_period_end` |
| `20260901010000_update_welcome_email` | trigger `trg_auth_users_step` aggiornato (email di benvenuto) |
| `20260902000000_create_school_deadlines` | tabella `school_deadlines` + policy `read school_deadlines` |
| `20260902010000_free_forever_plan` | `incrementa_notifiche_utente()` v7 + `send_conferma_attivazione()` + `rinnova_free_forever_annuale()` + trigger `trg_profiles_conferma_attivazione` + **cron `free-forever-rinnovo-annuale` (08:30)** |
| `20260902020000_admin_support` | `telefono`, `login_type`, `radar_attivo` |
| `20260902030000_add_pro_tipo` | `profiles.pro_tipo` |
| `20260902040000_beta_testers_view` | `profiles.is_beta_tester` (retention beta) |
| `20260902110000_add_profiles_genere_eta` | `genere`, `eta` |
| `20260902230000_sync_oauth_profiles` | `sync_profilo_oauth()` + trigger `trg_auth_users_sync_oauth` + `avatar_url` |
| `20260902234600_free_forever_account_bridge` | `get_user_pro_status()` v2 (bridge Free Forever ↔ PureFocus) |
| `20260902234800_ffe_rinnovo_email` | `rinnova_free_forever_scadenza()` + re-schedule del cron `free-forever-rinnovo-annuale` |
| `20260903000000_add_radar_attivo` | `radar_attivo` (interruttore del Radar) |
| `20260903010000_add_is_free_forever` | `sync_is_free_forever_flag()` + trigger `trg_profiles_sync_is_free_forever` + `is_free_forever` |
| `20260903020000_free_forever_bypass` | `incrementa_notifiche_utente()` v8 + `invia_avvisi_scadenza_abbonamento()` v2 (bypass FFE) |
| `20260903030000_default_new_user_pro_1anno` | `sync_profilo_oauth()` v2 (nuovo utente = PRO 1 anno) + trigger aggiornati |
| `20260903040000_new_user_pro_trial_30gg` | `sync_profilo_oauth()` v3 (trial 30gg) + `reverti_prove_pro_scadute()` + **cron `revert-prove-pro-scadute` (03:30)** |
| `20260903050000_coupon_radar50_drip_guard` | `cancella_drip_pro(p_user_id uuid)`, `stop_drip_on_pro_trigger()` + policy `coupon_radar` + trigger `trg_profiles_stop_drip_on_pro` |
| `20260903060000_add_interpelli_published_at` | `interpelli.published_at` |
| `20260903070000_admin_telegram_log` | tabella `admin_telegram_log` |
| `20260903080000_scraper_runs_and_alerts` | tabelle `scraper_runs` + `admin_telegram_alerts` |
| `20260903090000_add_interpelli_materia_contact` | `interpelli.materia`, `interpelli.contact_email` |
| `20260903100000_preavvisi_rinnovo_trial_pro` | `invia_preavvisi_rinnovo()` + **cron `rinnovo-preavvisi-3-5g` (09:00)** + `preavviso_rinnovo_inviato_at` |
| `20260903110000_profiles_auth_upsert_guard` | `piano_protetto(p_piano, p_is_free_forever, p_is_beta_tester)` + `sync_profilo_oauth()` v4 + `reverti_prove_pro_scadute()` v2 (guardia anti-declassamento) |
| `20260914000000_fix_pampararo_cognome` | fix dati puntuale (account di test admin) |
| `20260914010000_notifications_log` | tabella `notifications_log` |
| `20260914020000_channel_posts_log` | tabella `channel_posts_log` |
| `20260914030000_repair_notifications_log_e_rpc_quota` | ricostruzione `notifications_log` + `incrementa_notifiche_utente()` v9 (quota) |
| `20260914040000_add_profiles_sostegno` | `profiles.sostegno` (preferenza sostegno nel Radar) |
| `20260922120000_add_profiles_provincia` | `profiles.provincia` (provincia di **residenza**, dato demografico; check `^[A-Z]{2}$`) |
| `20260922130000_welcome_metadata_anagrafica` | `send_step1_welcome()` v2: dal `user_metadata` di `signUp` salva **nome, cognome, genere, età e provincia** (con i vincoli della tabella) e li passa alla email di benvenuto |
| `20260924120000_coupon_scuoleradar50_unico` | Coupon unico **SCUOLERADAR50** (50% PRO annuale, monouso per email, 40 giorni dalla registrazione): RADAR50 eliminato da `promo_codes` + drop `valida_coupon_radar50`/`registra_uso_coupon_radar50`, tabella `coupon_radar50_usage` → **`coupon_usage`** (policy rinominate), RPC `valida_coupon_scuoleradar50(uuid)` + `registra_uso_coupon_scuoleradar50(uuid, text)` |
| `20260927120000_default_sostegno_incluso` | `profiles.sostegno` → `not null default true` + backfill a `true` sugli esistenti: il sostegno entra negli avvisi di default, l'esclusione è solo volontaria (Preferenze Radar) |

### 13.13 Policy RLS complete (nome → tabella)

| Policy | Tabella | Operazione |
|---|---|---|
| `read interpelli` | `interpelli` | select (pubblico) |
| `read own profile` · `insert own profile` · `update own profile` | `profiles` | select / insert / update (solo `auth.uid() = id`) |
| `read own referrals` | `referrals` | select (solo referrer) |
| `read generated modules` | `generated_modules` | select (autenticati; scrittura `service_role`) |
| `read own saved modules` · `insert own saved modules` · `delete own saved modules` | `user_saved_modules` | select / insert / delete per utente |
| `read own coupon usage` · `insert own coupon usage` | `coupon_usage` | select / insert per utente |
| `read school_deadlines` | `school_deadlines` | select (pubblico) |

Tabelle **senza** policy client (accesso esclusivo `service_role` / funzioni
`security definer`): `app_settings`, `promo_codes`, `admin_telegram_log`,
`scraper_runs`, `admin_telegram_alerts`, `notifications_log`, `channel_posts_log`.

### 13.14 Trigger (tabella → trigger)

| Tabella | Trigger | Effetto |
|---|---|---|
| `profiles` | `set_profiles_updated_at` | mantiene `updated_at` |
| `profiles` | `set_referral_code` | genera il codice referral alla creazione |
| `profiles` | `trg_profiles_conferma_attivazione` | invia la conferma di attivazione |
| `profiles` | `trg_profiles_sync_is_free_forever` | sincronizza `is_free_forever` |
| `profiles` | `trg_profiles_stop_drip_on_pro` | passaggio a PRO → `cancella_drip_pro` |
| `generated_modules` | `set_generated_modules_updated_at` | mantiene `updated_at` |
| `auth.users` | `trg_auth_users_step` | avvia la sequenza drip (step 1 → welcome) |
| `auth.users` | `trg_auth_users_sync_oauth` | crea/sincronizza il profilo OAuth (`sync_profilo_oauth`) |

### 13.15 pg_cron (job attivi nel DB)

| Job | Schedule | Funzione |
|---|---|---|
| `step5-notifiche` | `* * * * *` (ogni minuto) | `dispatch_step5_due()` → HTTP POST alla Edge `send-notification` |
| `beta-rinnovo-omaggio-vita` | `0 9 * * *` | `beta_rinnovo_omaggio_vita()` |
| `scadenza-avvisi-multistep` | `0 9,18 * * *` | `invia_avvisi_scadenza_abbonamento()` |
| `free-forever-rinnovo-annuale` | `30 8 * * *` | `rinnova_free_forever_annuale()` / `rinnova_free_forever_scadenza()` |
| `revert-prove-pro-scadute` | `30 3 * * *` | `reverti_prove_pro_scadute()` |
| `rinnovo-preavvisi-3-5g` | `0 9 * * *` | `invia_preavvisi_rinnovo()` (preavviso 3–5 giorni) |

### 13.16 `dispatch_step5_due()` — il ponte DB → Edge (implementazione verificata)

Funzione `security definer`, `search_path = public`. Sequenza esatta:

1. legge `send_notification_url` e `send_notification_secret` da `public.app_settings`;
2. se mancano → `raise notice 'app_settings mancanti'` e ritorna `0` (**mai un errore silenzioso**);
3. scorre i profili con `piano = 'base'`, `step4_inviata_at is not null`,
   `step5_inviata = false` e `step4_inviata_at + interval '2 hours' <= now()`;
4. per ciascuno esegue `net.http_post(url, jsonb_build_object('tipo','step5','userId', id), …)`
   con header `Content-Type: application/json` e `x-send-secret: <secret>`;
5. ritorna il numero di dispatch eseguiti.

Questo è l'unico punto in cui il database "spinge" verso una Edge Function: qualsiasi
nuovo automatismo lato DB deve seguire lo stesso schema (URL+secret in `app_settings`,
header `x-send-secret`, funzione idempotente lato Edge).

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
| `invia_preavvisi_rinnovo` | `()` | `int` | Cron `rinnovo-preavvisi-3-5g`: promemoria di rinnovo (trial PRO e PRO a pagamento) nella finestra 3–5 giorni → Edge `send-notification` `rinnovo_preavviso_prova`/`rinnovo_preavviso_pro` (email + Telegram) |


---

### 14.1 Reference completa delle funzioni Postgres (22 + `dispatch_step5_due`)

| Funzione | Firma | Tipo | Ruolo |
|---|---|---|---|
| `incrementa_notifiche_utente` | `(p_user_id uuid)` | `security definer` | Consuma una notifica applicando la quota (BASE 3/anno scolastico, PRO illimitate, crediti a consumo); riscritta **9 volte** (v1→v9): limite totale → annuale → anno scolastico → reset extra → bypass Free Forever → quota definitiva (`20260914030000`) |
| `incrementa_crediti_utente` | `(p_user_id uuid, p_delta integer default 1)` | `security definer` | Aggiunge crediti a consumo (acquisto/omaggio) |
| `consuma_credito_utente` | `(p_user_id uuid)` | `security definer` | Scala 1 credito per una generazione extra |
| `get_user_pro_status` | `(p_user_id uuid)` | `security definer` | Stato PRO normalizzato per l'Account Bridge PureFocus (`subscription_tier`, `subscription_status`, `current_period_end`) |
| `genera_referral_code` | `(nome text, cognome text, email text)` | helper | Genera il codice referral deterministico |
| `handle_referral_code` | `()` | trigger fn | Assegna `profiles.referral_code` |
| `valida_codice_promo` | `(p_codice text)` | `security definer` | Valida un codice promo senza consumarlo (usata da `lib/promo.ts`) |
| `attiva_codice_promo` | `(p_codice text, p_user_id uuid)` | `security definer` | Consuma il codice e applica l'effetto (es. BETA1ANNO, SCUOLERADAR50) |
| `piano_protetto` | `(p_piano text, p_is_free_forever boolean, p_is_beta_tester boolean)` | helper | Guardia anti-declassamento usata da `sync_profilo_oauth`/`reverti_prove_pro_scadute` |
| `sync_profilo_oauth` | `()` | trigger fn | Crea/sincronizza il profilo al primo accesso OAuth (v4: nuovo utente = trial PRO 30 giorni, piano protetto) |
| `reverti_prove_pro_scadute` | `()` | cron fn | Riporta a BASE i trial PRO scaduti (cron `revert-prove-pro-scadute`) |
| `cancella_drip_pro` | `(p_user_id uuid)` | `security definer` | Cancella la sequenza drip residua quando l'utente diventa PRO |
| `stop_drip_on_pro_trigger` | `()` | trigger fn | Invoca `cancella_drip_pro` sul passaggio a PRO |
| `send_conferma_attivazione` | `()` | trigger fn | Conferma di attivazione piano |
| `beta_rinnovo_omaggio_vita` | `()` | cron fn | Rinnova l'omaggio beta (cron `beta-rinnovo-omaggio-vita`) |
| `rinnova_free_forever_annuale` | `()` | cron fn | Rinnova il piano Free Forever annuale |
| `rinnova_free_forever_scadenza` | `()` | cron fn | Riallinea la scadenza FFE e le email |
| `sync_is_free_forever_flag` | `()` | trigger fn | Mantiene coerente `profiles.is_free_forever` |
| `invia_avvisi_scadenza_abbonamento` | `()` | cron fn | Avvisi multistep di scadenza abbonamento (tipi `scadenza_preavviso_7d/3d/1d`, `scadenza_finale` → alias sui template FLUSSO 3 della Edge) |
| `invia_preavvisi_rinnovo` | `()` | cron fn | Preavviso rinnovo 3–5 giorni (trial PRO → `rinnovo_preavviso_prova`, PRO a pagamento → `rinnovo_preavviso_pro`) |
| `handle_profiles_updated_at` | `()` | trigger fn | `profiles.updated_at` |
| `handle_generated_modules_updated_at` | `()` | trigger fn | `generated_modules.updated_at` |
| `dispatch_step5_due` | `()` | cron fn | Ponte DB → Edge `send-notification` (§13.16) |

Note operative:

- tutte le funzioni "di dominio" sono **`security definer` con `search_path = public`**:
  nessuna dipendenza dal `search_path` del chiamante;
- i parametri sono sempre nominali (`p_*`), così le chiamate `supabase.rpc('nome', { p_... })`
  restano leggibili e stabili;
- le funzioni di quota/crediti **non lanciano eccezioni verso il client**: ritornano lo stato
  risultante e il client decide il messaggio (nessun errore 500 da mostrare all'utente);
- una funzione ricreata più volte (come `incrementa_notifiche_utente`) è **idempotente per
  contratto**: l'ultima definizione in ordine di timestamp è quella in produzione
  (`supabase db push` applica le migrazioni in ordine alfabetico di nome file).

### 14.2 Regole per aggiungere una nuova RPC

1. migrazione dedicata con timestamp `YYYYMMDDHHMMSS_nome_descrittivo.sql`;
2. `create or replace function public.<nome>(p_*) returns … language plpgsql security definer set search_path = public`;
3. `grant execute` solo ai ruoli necessari (`authenticated` o `service_role`);
4. se scrive su tabelle protette (senza policy client) non serve alcuna policy aggiuntiva;
5. test di regressione in `scripts/` se la funzione entra nel percorso notifiche
   (`test-migrazioni.ts` è il guard dedicato).

## 15. Edge Functions — contratti payload

| Funzione | URL | Payload richiesto | Risposta |
|---|---|---|---|
| `send-notification` | `/functions/v1/send-notification` (header `x-send-secret`) | `{ tipo: 'step1'|'step5'|'welcome_pro'|'notifica_pro'|'beta_rinnovo'|'beta_rinnovo_preavviso'|'beta_rinnovo_conferma'|'scadenza_preavviso_7d'|'scadenza_preavviso_3d'|'scadenza_preavviso_1d'|'scadenza_finale'|'rinnovo_preavviso_prova'|'rinnovo_preavviso_pro', userId?, email?, nome?, chatId?, titolo?, scuola?, provincia?, classe?, scadenza?, giorni?, link? }` | `{ ok }` (ping: `{ ok, resend, telegram }`) |
| `genera-modulo` | `/functions/v1/genera-modulo` (JWT) | `{ azione: 'intervista'|'genera'|'ricerca'|'salva'|'rimuovi'|'miei', … }` | `{ esito, messaggio, domanda?, opzioni?, fingerprint?, documento?, moduli? }` |
| `checkout` | `/functions/v1/checkout` (JWT) | `{ plan, promo?, quantita?, origin? }` | `{ url }` |
| `webhook` | `/functions/v1/webhook` (firma Stripe) | evento Stripe raw | `ok` |
| `admin` | `/functions/v1/admin` (JWT + ADMIN_EMAILS) | operazione admin | JSON |
| `contatto` | `/functions/v1/contatto` | `{ email, dipartimento, oggetto?, messaggio, website?, utenteLoggato?, allegato? }` | `{ ok }` |
| `elimina-account` | `/functions/v1/elimina-account` (JWT) | `{}` | `{ ok }` |
| `telegram-webhook` | `/functions/v1/telegram-webhook` (secret header) | update Telegram (message `/start <user_id>`) | `ok` |
| `telegram-admin-webhook` | `/functions/v1/telegram-admin-webhook` (secret header + `ADMIN_TELEGRAM_ID`) | update Telegram (comandi `/ping` `/id` `/status` `/ultimi` `/log [n]` `/forward <testo>` o testo libero). Percorso ALERT: header `x-admin-alert-secret` + body `{ severity, category, title, message, meta? }` | `ok` / `{ ok, inviato }` |

### 15.1 Esternalizzazioni (API di terze parti)
- **Supabase Auth/REST/RPC**: URL base progetto + `VITE_SUPABASE_ANON_KEY` (frontend) /
  `SUPABASE_SERVICE_ROLE_KEY` (Node/Deno).
- **Resend**: `POST https://api.resend.com/emails` (Bearer `RESEND_API_KEY`).
- **Telegram Bot API**: `POST https://api.telegram.org/bot<TOKEN>/sendMessage`.
- **DeepSeek**: `POST https://api.deepseek.com/chat/completions` (Bearer `DEEPSEEK_API_KEY`).
- **Stripe API**: `https://api.stripe.com/v1` (Basic `STRIPE_SECRET_KEY`).
- **Google GSI**: `https://accounts.google.com/gsi/client` (One Tap).

---

### 15.4 Inventario completo delle 10 Edge Functions (Deno)

| Function | File (`supabase/functions/…/index.ts`) | Righe | Secret letti (`Deno.env.get`) | Note di contratto |
|---|---|---|---|---|
| `admin` | `admin/index.ts` | 510 | `ADMIN_EMAILS`, `SEND_NOTIFICATION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Azioni di amministrazione (utenti, dispatch, override) con verifica dell'email admin; usa il service role |
| `checkout` | `checkout/index.ts` | 414 | `APP_URL`, `REFERRAL_COUPON_ID`, `STRIPE_MODE`, `STRIPE_PRICE_*`, `STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `WEBHOOK_ENDPOINT` | Crea la sessione Stripe Checkout (piani annuo/mensile/a consumo, coupon referral/promo), JWT obbligatorio |
| `contatto` | `contatto/index.ts` | 217 | `CONTACT_SUPPORT_EMAIL`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Form contatti pubblico (honeypot lato client), invio via Resend |
| `elimina-account` | `elimina-account/index.ts` | 80 | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Cancellazione account (GDPR) — solo con JWT valido |
| `genera-modulo` | `genera-modulo/index.ts` | 1326 | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Azioni `intervista` · `genera` · `ricerca` · `salva` · `rimuovi` · `miei`; cache SHA-256 su `generated_modules`; azioni riconosciute anche `pei`/`sostegno` |
| `send-notification` | `send-notification/index.ts` | 670 | `RESEND_API_KEY`, `RESEND_DASHBOARD_URL`, `RESEND_FROM_EMAIL`, `SCUOLERADAR_BASE_URL`, `SEND_NOTIFICATION_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TELEGRAM_BOT_TOKEN` | Unico punto di invio email/Telegram server-side: **richiede header `x-send-secret`**, risolve i template in `_shared/emailTemplates.ts` |
| `telegram-admin-webhook` | `telegram-admin-webhook/index.ts` | 465 | `ADMIN_ALERT_SECRET`, `ADMIN_COMMAND_FORWARD_SECRET`, `ADMIN_COMMAND_FORWARD_URL`, `ADMIN_TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `ADMIN_TELEGRAM_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Bot admin: riceve comandi (log in `admin_telegram_log`), accetta alert machine-to-machine (`x-admin-alert-secret`) |
| `telegram-login` | `telegram-login/index.ts` | 208 | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TELEGRAM_BOT_TOKEN` | Login Widget Telegram → verifica hash → collega `telegram_chat_id` |
| `telegram-webhook` | `telegram-webhook/index.ts` | 197 | `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Webhook del bot pubblico (comandi utente, deep link) |
| `webhook` | `webhook/index.ts` | 338 | `SEND_NOTIFICATION_SECRET`, `STRIPE_MODE`, `STRIPE_PRICE_*`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Webhook Stripe con **verifica firma HMAC**: aggiorna `piano`, `subscription_*`, `current_period_end`, crediti |

`supabase/functions/_shared/` non è una function: contiene i moduli condivisi
(es. `emailTemplates.ts` con i template `email_3_*`, `email_*_rinnovo_*`).

### 15.5 Contratti di sicurezza delle Edge

- **Autenticazione**: `admin`, `checkout`, `elimina-account`, `genera-modulo` verificano il
  **JWT** dell'utente; `send-notification` verifica l'**header `x-send-secret`**
  (server-to-server: GitHub Actions, pg_cron via `app_settings`);
  `telegram-admin-webhook` verifica `ADMIN_TELEGRAM_WEBHOOK_SECRET` (Telegram) e
  `ADMIN_ALERT_SECRET` (scraper); `webhook` verifica la **firma Stripe**.
- **Service role**: nessuna Edge espone la service role al client — la usa solo internamente
  per scrivere su tabelle senza policy.
- **Errori**: le Edge rispondono sempre JSON con stato esplicito; i fallimenti di invio
  vengono restituiti al chiamante (mai inghiottiti), così il chiamante può registrare
  l'esito in `notifications_log`/`scraper_runs`.
- **Segreti**: si impostano con
  `supabase secrets set <NOME>=<valore> --project-ref gwdmsgsshvdnfrplbjiv` e si
  deployano con `supabase functions deploy <nome> --project-ref gwdmsgsshvdnfrplbjiv`.

### 15.6 Matrice "chi chiama quale Edge"

| Chiamante | Edge | Perché |
|---|---|---|
| Frontend (JWT utente) | `checkout`, `genera-modulo`, `elimina-account` | pagamento, generazione AI, cancellazione account |
| Frontend (contatti pubblici) | `contatto` | form contatti |
| GitHub Actions `scraper.yml` / `digest.yml` (secret condiviso) | `send-notification` | email/Telegram di opportunità, digest, promemoria |
| pg_cron (`dispatch_step5_due`, `invia_avvisi_*`, `invia_preavvisi_rinnovo`) | `send-notification` | drip e ciclo di vita abbonamento |
| GitHub Actions (verifica post-run) | `telegram-admin-webhook` | alert su fallimenti critici / anomalie |
| Telegram | `telegram-webhook`, `telegram-admin-webhook` | comandi bot pubblico e bot admin |
| Frontend (Login Widget) | `telegram-login` | collegamento chat Telegram |
| Stripe | `webhook` | eventi di pagamento/abbonamento |
| Pannello admin (JWT admin) | `admin` | diagnostica, dispatch manuale, override |

## 16. Routes, Endpoints & API

### 16.1 Router SPA (`src/App.tsx`)
| Route | Pagina | Accesso |
|---|---|---|
| `/` | LandingPage | pubblico |
| `/prezzi`, `/chi-siamo`, `/faq` | PrezziPage🔒 / ChiSiamoPage🔒 / FAQPage | pubblico |
| `/servizi`, `/servizi/:slug` | ServiziPage / ServizioPage | pubblico |
| `/notizie`, `/notizie/:id` | NotiziePage / NotizieDettaglioPage | pubblico |
| `/interpello/:id` | InterpelloDettaglioPage (scheda avviso, atterraggio deep link notifiche) | pubblico |
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

### 16.1.1 Tabella completa delle rotte (fonte: `src/App.tsx`, 30 `<Route>`)

| # | Path | Elemento | Guardia | Note |
|---|---|---|---|---|
| 1 | `/` | `LandingPage` | pubblica | hero, simulatore radar, servizi, pricing snippet |
| 2 | `/prezzi` | `PrezziPage` | pubblica | 🔒 modulo bloccato (§19) |
| 3 | `/chi-siamo` | `ChiSiamoPage` | pubblica | 🔒 modulo bloccato |
| 4 | `/faq` | `FAQPage` | pubblica | |
| 5 | `/servizi` | `ServiziPage` | pubblica | griglia da `data/servizi.ts` |
| 6 | `/servizi/:slug` | `ServizioPage` | pubblica | dettaglio servizio |
| 7 | `/notizie` | `NotiziePage` | pubblica | `NotizieHero` + `NotizieGrid` (dipartimento notizie) |
| 8 | `/notizie/:id` | `NotizieDettaglioPage` | pubblica | `NotizieDettaglio` |
| 9 | `/interpello/:id` | `InterpelloDettaglioPage` | pubblica | **atterraggio dei deep link delle notifiche** quando l'avviso non ha fonte esterna |
| 10 | `/contatti` | `ContattiPage` | pubblica | form → Edge `contatto` |
| 11 | `/moduli` | `Navigate → /dashboard/moduli` | pubblica | la vecchia landing di anteprima è stata rimossa |
| 12 | `/calcolatore-cfu` | `CalcolatoreCFUPage` | pubblica | landing del dominio CFU |
| 13 | `/auth/callback` | `AuthCallback` | pubblica | ritorno OAuth (scambio code → sessione) |
| 14 | `/checkout/:plan` | `CheckoutRedirectPage` | pubblica | checkout diretto con coupon (`?coupon=SCUOLERADAR50`) |
| 15 | `/onboarding` | `OnboardingPage` | **`RequireAuth`** | wizard preferenze + Telegram |
| 16 | `/dashboard` | `DashboardLayout` | pubblica (layout) | guscio con tab + `Outlet` |
| 17 | `/dashboard` (index) | `Navigate → radar` | — | default della dashboard |
| 18 | `/dashboard/radar` | `DashboardPage` | pubblica | feed Radar, notifiche residue, blacklist |
| 19 | `/dashboard/cv` | `CvPage` | pubblica | CV Builder |
| 20 | `/dashboard/cfu` | redirect → `/dashboard/calcolatore-cfu` | pubblica | Vecchio mockup CFU rimosso in V1 (nessun numero inventato in pagina) |
| 21 | `/dashboard/calcolatore-cfu` | `CalcolatoreCFUDashboardPage` | **`RequireAuth`** | strumento privato del dipartimento CFU |
| 22 | `/dashboard/assistente-ai` | `AssistenteAIPage` | pubblica | Assistente Sindacalista (paywall PRO) |
| 23 | `/dashboard/moduli` | `ModuliPage` | pubblica | `ModuliModule` |
| 24 | `/dashboard/purefocus` | `PureFocusPage` | pubblica | focus timer / bridge PRO |
| 25 | `/dashboard/profilo` | `ProfiloPage` | **`RequireAuth`** | dati, preferenze, Telegram, account |
| 26 | `/dashboard/invita` | `InvitaPage` | **`RequireAuth`** | referral |
| 27 | `/admin` | `AdminPage` | **`RequireAuth`** + `ADMIN_EMAILS` | pannello admin (monta `departments/admin`) |
| 28 | `*` | `Navigate → /` | — | catch-all: mai una pagina bianca (prima del fix, i deep link non gestiti finivano in 404 bianco) |

### 16.1.2 Comportamento di `RequireAuth` (implementazione esatta)

```tsx
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, openAuthModal } = useApp();
  useEffect(() => { if (!loading && !user) openAuthModal('login'); }, [user, loading, openAuthModal]);
  if (loading) return null;          // attende la verifica sessione: nessun redirect/modal prematuro
  if (!user) return <AreaRiservata />; // card "Area riservata" + CTA che apre il modal di registrazione
  return <>{children}</>;
}
```

Regole: **nessun redirect forzato** — l'utente non autenticato vede una card e il modal di auth;
durante `loading` non viene montato nulla (evita il "flash" di modali su utenti già loggati).

### 16.1.3 Modali globali montate fuori dalle rotte

`AuthModal` · `VetrinaModal` · `GoogleOneTap` · `RadarWizardModal` (entry `departments/radar`) ·
`ForcePasswordModal` · `SoftOnboardingModal` · `DatiProfiloModal` · `OAuthBounceModal` ·
`DevToolbar` (solo `import.meta.env.DEV`).

Sempre attivi: `ToastProvider` (notifiche UI) · `ScrollToTop` · `trackPageview` (analytics
privacy-first, attivo solo con `VITE_POSTHOG_KEY`).

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
| `SCRAPER_PROVINCE_TEST` | Scraper: province di fallback (se `profiles.province_attive` è vuoto) |
| `SCRAPER_SCADENZA_MAX` | Scraper: max pagine ufficiali lette per arricchire le scadenze mancanti (default 20) |
| `SCRAPER_CONTATTI_MAX` | Scraper: max avvisi su cui cercare l'email di candidatura (default 60) |
| `SCRAPER_ELENCHI_MAX` | Scraper: max pagine indice espanse per run (default 25) |
| `SCRAPER_FONTI_MAX` | Scraper: max fonti interrogate per run — hub dei capoluoghi + feed nazionale (default 12) |
| `SCRAPER_ARCHIVI` | Scraper: `1` include gli archivi regionali dell'aggregatore (backfill; di default OFF, contengono gli stessi post nazionali dei giorni precedenti) |
| `SCRAPER_PING_CONCORRENZA` | Scraper: richieste di verifica link in parallelo (default 8) — i bandi strutturati non vengono pingati |
| `SCRAPER_TELEGRAM_REALTIME` | Scraper: `0` disattiva gli alert PRO in tempo reale (test della pipeline) |

### 17.2 Secrets GitHub Actions (`.github/workflows/scraper.yml`)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`ADMIN_ALERT_SECRET` (stesso valore del secret Supabase: invio alert admin dallo scraper).
Gli stessi `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_ALERT_SECRET` sono usati dal
workflow `health-check.yml` (env opzionali: `HEALTH_STALE_HOURS`, `HEALTH_NEWS_STALE_DAYS`).

### 17.3 Secrets Supabase Edge (via `supabase secrets set`)
`STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_CONSUMO`,
`REFERRAL_COUPON_ID`, `WEBHOOK_ENDPOINT`, `STRIPE_WEBHOOK_SECRET` (`whsec_…`), `STRIPE_MODE`
(test | live, vedi §12.3) — retrocompatibili: `STRIPE_PRICE_PRO_ANNUALE`/`_MENSILE`/`_A_CONSUMO`
(e `_CONSUMO`/`_ALACARTE`), `STRIPE_COUPON_REFERRAL_10` —, `SEND_NOTIFICATION_SECRET`,
`RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL`,
`ADMIN_TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `ADMIN_TELEGRAM_WEBHOOK_SECRET`,
`ADMIN_ALERT_SECRET`, `ADMIN_COMMAND_FORWARD_URL`, `ADMIN_COMMAND_FORWARD_SECRET`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CONTACT_SUPPORT_EMAIL`, `APP_URL`.

---

### 17.4 Inventario completo delle variabili e dei segreti (verificato)

**A. Frontend (Vite — inlined nel bundle al build; tutto ciò che è `VITE_*` è PUBBLICO)**

| Variabile | Uso |
|---|---|
| `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` | client `src/lib/supabase.ts` (se assenti → **modalità demo**, §22) |
| `VITE_ADMIN_PASSWORD` | password "di riserva" del pannello admin (solo per email in `ADMIN_EMAILS`); **vuota in produzione** |
| `VITE_STRIPE_PRICE_PRO_ANNUALE` · `VITE_STRIPE_PRICE_PRO_MENSILE` · `VITE_STRIPE_PRICE_ALACARTE` | Price ID visibili al client (la fonte autorevole resta server-side) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | chiave pubblica Stripe (`pk_live_…`) |
| `VITE_GOOGLE_CLIENT_ID` | Google Identity / One Tap |
| `VITE_TELEGRAM_BOT_USERNAME` | `ScuoleRadar_bot` — Login Widget |
| `VITE_POSTHOG_KEY` · `VITE_POSTHOG_HOST` | analytics privacy-first (key vuota = nessun invio) |
| `VITE_PUREFOCUS_BRIDGE_SECRET` · `VITE_PUREFOCUS_BRIDGE_URL` | bridge account ScuoleRadar ↔ PureFocus (HMAC condiviso) |
| `VITE_DEADLINES_API_URL` | override dinamico delle scadenze (altrimenti `school_deadlines` → fallback locale JSON) |

Utilizzi diretti nel codice (`import.meta.env.*` verificati): `DEV`, `MODE`,
`VITE_GOOGLE_CLIENT_ID`, `VITE_SUPABASE_ANON_KEY`, `VITE_TELEGRAM_BOT_USERNAME`.

**B. Node / scraper e script (`.env` locale, mai committato)**

| Variabile | Uso |
|---|---|
| `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` | scritture server-side (scraper, script, notifier) |
| `SUPABASE_ANON_KEY` | alternativa read-only per sviluppo |
| `TELEGRAM_BOT_TOKEN` | bot `@ScuoleRadar_bot` (invio messaggi e post sui canali) |
| `TELEGRAM_CHANNELS` · `TELEGRAM_CHANNELS_REGIONALI` | override opzionali dei canali (JSON provincia→canale / regione→canale) |
| `ADMIN_ALERT_SECRET` · `ADMIN_ALERT_URL` | alert machine-to-machine verso la Edge `telegram-admin-webhook` |
| `DEEPSEEK_API_KEY` · `DEEPSEEK_MODEL` | generazione modulistica (`deepseek-chat`) |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PUBLISHABLE_KEY` · `STRIPE_PRICE_*` · `STRIPE_COUPON_*` · `REFERRAL_COUPON_ID` · `WEBHOOK_ENDPOINT` | billing |
| `SCUOLERADAR_LEDGER_PATH` | override del percorso del ledger file (§6.5.1) — usato dai test per non sporcare il ledger reale |
| `FEATURE_RADAR` · `FEATURE_CFU` · `FEATURE_MODULISTICA` · `FEATURE_PUREFOCUS` · `FEATURE_REFERRAL` · `FEATURE_CV_BUILDER` | **feature flags dei dipartimenti** (`on`/`test`/`off`, §4.8 di `DEPARTMENT_MAP.md`): hanno priorità sugli override locali e pilotano anche le notifiche automatiche. **Default di produzione**: accesi `radar` e `purefocus`; chiusi `cfu`, `modulistica`, `referral`, `cv_builder` |
| `FEATURE_TEST_REDIRECT` · `FEATURE_ADMIN_EMAIL` · `FEATURE_ADMIN_TELEGRAM_ID` | destinazione di test del gate notifiche in stato `test` (default: prima email di `ADMIN_EMAILS` e `ADMIN_TELEGRAM_ID`) |

**C. GitHub Actions secrets** (verificati nei workflow):

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `TELEGRAM_BOT_TOKEN` · `TELEGRAM_CHANNELS` ·
`RESEND_API_KEY` · `ADMIN_ALERT_SECRET`.

**D. Supabase Edge secrets** (`supabase secrets set …`; elenco completo letto dal codice Deno):

| Gruppo | Secret |
|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| Invio | `SEND_NOTIFICATION_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_DASHBOARD_URL`, `SCUOLERADAR_BASE_URL`, `APP_URL`, `CONTACT_SUPPORT_EMAIL` |
| Telegram (pubblico) | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` |
| Telegram (admin) | `ADMIN_TELEGRAM_BOT_TOKEN`, `ADMIN_TELEGRAM_ID`, `ADMIN_TELEGRAM_WEBHOOK_SECRET`, `ADMIN_ALERT_SECRET`, `ADMIN_COMMAND_FORWARD_SECRET`, `ADMIN_COMMAND_FORWARD_URL`, `ADMIN_EMAILS` |
| AI | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` |
| Stripe | `STRIPE_MODE`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WEBHOOK_ENDPOINT`, `STRIPE_PRICE_ID_ANNUAL`, `STRIPE_PRICE_ID_MONTHLY`, `STRIPE_PRICE_ID_CONSUMO`, `STRIPE_PRICE_PRO_ANNUALE`, `STRIPE_PRICE_PRO_MENSILE`, `STRIPE_PRICE_A_CONSUMO`, `STRIPE_PRICE_ALACARTE`, `STRIPE_PRICE_CONSUMO`, `REFERRAL_COUPON_ID`, `STRIPE_COUPON_BETA1ANNO`, `STRIPE_COUPON_SCUOLERADAR50` (fallback accettato `STRIPE_COUPON_RADAR50`), `STRIPE_COUPON_REFERRAL_10` |

### 17.5 Matrice di degradazione (cosa succede se un secret manca)

| Secret mancante | Effetto | Comportamento di progetto |
|---|---|---|
| `VITE_SUPABASE_URL`/`ANON_KEY` | nessun backend | **modalità demo**: auth locale su localStorage, feed vuoto, nessuna Edge |
| `RESEND_API_KEY` (Edge/Node) | email non inviate | l'esito viene restituito come errore e registrato; il digest Telegram resta attivo |
| `TELEGRAM_BOT_TOKEN` | nessun messaggio/post | `send-notification` e lo scraper riportano l'errore in `scraper_runs.errori` |
| `DEEPSEEK_API_KEY` | nessuna generazione AI | l'Archivista/il generatore rispondono con errore esplicito; i **template locali** (`creaDocumentoLocale`, ~60 tipologie) continuano a funzionare senza API |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_*` | checkout non creabile | `avviaCheckout` ritorna `{ ok:false, errore }` senza lanciare; la pagina `/prezzi` resta navigabile |
| `ADMIN_ALERT_SECRET` | nessun alert admin | le anomalie restano visibili in `scraper_runs`/`admin_telegram_alerts` (tabella comunque scritta) |
| `VITE_DEADLINES_API_URL` | sorgente scadenze statica | `school_deadlines` → fallback `src/data/deadlinesFallback.json` |

## 18. Script npm, CI, Vercel

### 18.1 npm scripts

| Gruppo | Comandi |
|---|---|
| Build & qualità | `dev` (vite 5174), `build`, `preview`, `lint`, `typecheck`, `test` (7 suite del motore CFU) |
| Architettura | `test:architettura` (gate), `arch:check` (= gate), `arch:report` (inventario) |
| Scraper & dati | `scrape` (`-- --dry-run`, `--no-email`), `scrape:check`, `scrape:notizie`, `scrape:notizie:check`, `dati:arricchisci`, `dati:pulisci`, `dati:pulisci-scaduti`, `scadenze:sync`, `notizie:ripara-archivio`, `fonti:verifica` (network: ricontrolla dal vivo le URL del registro fonti) |
| Scraper (guardie) | `test:scraper:domini` (isolamento Interpelli ↔ Notizie + filtro editoriale), `test:scraper:fonti` (registro, copertura dei capoluoghi, scoperta sezioni hub), `test:scraper:attivi` (solo bandi attivi, categorie ammesse, gate del link/ping fallace) — tutte in `npm test` |
| Notizie (test) | `test:notizie-feed`, `test:notizie-editoriale`, `test:notizie-nazionale`, `test:notizie-rate` |
| Radar & matching | `test:matching`, `test:radar`, `test:radar:preferenze`, `test:sostegno`, `test:materia`, `test:interpello-scadenza`, `test:scadenze`, `test:rinnovo-preavvisi`, `test:board`, `test:elenchi`, `test:traccia`, `test:prova-radar`, `test:parser*`, `test:dati-fallback` |
| Notifiche & canali | `test:notifiche`, `test:notifier-dry`, `test:telegram` (`:template`, `:tier`, `:canali`), `test:qualita`, `test:copy`, `test:dedup`, `test:dedup:utente`, `test:frequenza`, `test:digest`, `test:email`, `test:email:scuola`, `test:email-alert`, `test:alert`, `test:link`, `test:link-esterno`, `test:promemoria`, `test:ledger`, `notifiche:digest`, `notifiche:promemoria`, `ledger:unisci` |
| Modulistica & PDF | `test:moduli`, `test:pdf` (`:breve`, `:brevi`, `:universita`, `:completo`) |
| Admin & DB | `admin:health`, `admin:dispatch`, `admin:profiles`, `admin:link-telegram`, `admin:fix-pampararo`, `provision:beta` (`:check`), `db:verifica`, `test:migrazioni` |
| Brand & favicon | `favicon` (rigenera il set ufficiale da `public/logo.png` + autoverifica), `test:favicon` (guardia: `index.html` ↔ `public/`, identità azzurra, nessun asset scuro/legacy, pesi) |
| Checkout & promo | `test:checkout-promo` (guardia: `verify_jwt` di `checkout`, **BETA1ANNO validato su `promo_codes` e SOLO sul PRO annuale**, attivazione PRO+1anno/`is_beta_tester`/consumo del monouso dal `webhook`, `profiles.provincia` nel form di registrazione, 401 Guest del health check = OK) |
| Piano & funnel | `test:piano` (guardia: piano letto dal BACKEND — tier `pro_*` e `is_beta_tester` ⇒ PRO; tetti PRO finché il piano non è confermato; Beta Tester mai retrocessi; bozza di registrazione con nome composto, merge e corruzione; Realtime, paywall `pianoStato === 'pronto'`, prefill email/nota del form, trigger DB dell'anagrafica) |

### 18.2 CI / cron (GitHub Actions — 6 workflow)
- `scraper.yml`: Lun–Ven 07/12/15 UTC → interpelli + canali Telegram (nessun invio personale).
- `digest.yml`: Lun–Ven 15/16 UTC → BATCH alle 17:00 italiane (Telegram per BASE + email per tutti).
- `scrape-notizie.yml`: giornaliero 06:00 UTC → notizie + commit + deploy; **fallisce se la settimana resta vuota**.
- `pulisci-scaduti.yml`: giornaliero 04:00 UTC → pulizia degli avvisi scaduti.
- `health-check.yml`: giornaliero 08:00 UTC → diagnostica (`scripts/admin-health-check.ts`).
- `architettura.yml`: su push e PR → gate `npm run test:architettura` (il debito strutturale non può crescere).
- Commit con `[skip ci]` → nessun loop.

### 18.3 Vercel
- Framework Vite; build `npm run build`; output `dist/`.
- `vercel.json`: rewrite `/(.*)` → `/index.html` (fix 404 per rotte dirette).
- Production branch `main`: ogni push triggera il build.

---

### 18.4 Reference dei 71 script `scripts/*.ts` — produzione, manutenzione, diagnostica

| Script | Scopo (dalla testa del file) |
|---|---|
| `check-architettura.ts` | **Gate strutturale** (`docs/MODULAR_ARCHITECTURE.md`): dimensioni, radici di dominio, entry point, import fra domini, strati, cicli, baseline |
| `_validate-modulistica.ts` | Validazione modulistica: coerenza di layout, contenuti, sezioni per ordine scolastico (60/60 + PEI infanzia) |
| `arricchisci-interpelli.ts` | `npm run dati:arricchisci [-- --apply]` → completa `school_code`, `contact_email` (PEO dalla convenzione MIM) e `school_name` senza sovrascrivere dati presenti |
| `audit-dati.ts` | Audit dei dati in `interpelli` e `notices` (igiene e coerenza) |
| `pulisci-dati-non-verificati.ts` | `npm run dati:pulisci` → rimuove i record NON verificati da `interpelli`/`notices` |
| `pulisci-scaduti.ts` | `npm run dati:pulisci-scaduti` → rimuove gli interpelli scaduti (workflow `pulisci-scaduti.yml`, 04:00 UTC) |
| `sync-deadlines.ts` | `npm run scadenze:sync` → sincronizza le scadenze verso Supabase (`school_deadlines`) |
| `ripara-archivio-notizie.ts` | `npm run notizie:ripara-archivio [-- --dry]` → rigenera il copy dell'archivio notizie con le regole correnti |
| `invia-digest.ts` | `npm run notifiche:digest` → digest giornaliero (batch email + Telegram BASE) |
| `invia-promemoria.ts` | `npm run notifiche:promemoria` → promemoria 24h per scadenze entro 3 giorni |
| `unione-ledger.ts` | `npm run ledger:unisci` → unifica i file ledger (più run/macchine) senza perdere chiavi |
| `verifica-schema-notifiche.ts` | `npm run db:verifica` → verifica schema/RPC del percorso notifiche |
| `provision-beta-users.ts` | `npm run provision:beta[:check]` → provisioning degli accessi BETA / utenti pre-approvati |
| `admin-health-check.ts` | `npm run admin:health` → monitor di salute del dispatch Radar (workflow `health-check.yml`, 08:00 UTC); ricognizione in `scripts/lib/saluteDispatch.ts` + `avvisiNotificabili.ts` (§26.66) |
| `admin-dispatch-user.ts` | `npm run admin:dispatch` → digest immediato per un singolo utente |
| `admin-profiles-manutenzione.ts` | `npm run admin:profiles` → manutenzione profili: Free Forever, dedupe, igiene |
| `admin-link-telegram.ts` | `npm run admin:link-telegram` → collega un Chat ID Telegram a un profilo |
| `admin-fix-pampararo.ts` | `npm run admin:fix-pampararo` → cleanup mirato di un account di test |
| ~~`diag-flightboard.ts`~~ | **Rimosso il 02/10/2026** (§26.34): replicava a mano la vecchia query con `.limit(500)`. La diagnosi della bacheca «Radar Live» vive ora in `npm run board:diag` (`src/departments/radar/flightBoard/__tests__/diagnosticaBoard.ts`) e legge a pagine come il prodotto |
| `diag-fonti.ts` | Diagnostica: struttura HTML del post giornaliero di scuolainterpelli.it |
| `diag-interpelli-multiregione.ts` | Diagnostica: verifica l'ingestione multi-regione in `interpelli` |

### 18.5 Reference degli script di test (`scripts/test-*.ts`)

| Gruppo | Script |
|---|---|
| Radar & matching | `test-matching-profilo` · **`test-matching-competenze`** · `test-radar-validation` · `test-radar-preferenze` · `test-sostegno-preferenza` · `test-materia-classe` · `test-scadenza` · `test-scadenze` · `test-live-board` · `test-elenchi` · `test-traccia-fonte` · `test-dati-fallback` · **`test-prova-radar`** |
| Parser & fonti | `test-parser-province` · `test-parser-date` · `test-parser-materia` · `test-parser-tabelle` · `test-parser-validazione` |
| Link & routing | `test-link-fonte` · `test-link-esterno` · `test-alert-avviso` |
| Notifiche & dedup | `test-notifiche` · `test-notifier-dry` · `test-dedup` · `test-dedup-utente` · `test-frequenza` · `test-qualita-invio` · `test-copy-notifiche` · `test-ledger-robustezza` · `test-migrazioni` |
| Email & digest | `test-email-template` (**benvenuto post-registrazione**: blocco `conferma_base` della Edge + template `email_1_1_onboarding` + renderer `welcome` → conferma del mese PRO in omaggio e copy «account Base»/«3 segnalazioni» **vietate**) · `test-email-scuola` · `test-email-alert` · `test-digest` · `test-promemoria` · `test-rinnovo-preavvisi` · **`test:automazioni`** (catalogo + interruttori del pannello Admin) |
| Feature flags | `test-feature-flags` (matrice stati, **superficie pubblica di produzione = solo `radar` + `purefocus`**, snapshot di visibilità, gate notifiche, scrittura di `sr_flag_dipartimenti`) · `test-flags-cablaggio` (navbar/menu/tab/superfici pubbliche/pannelli) · `test-flags-render` (render dei toggle OFF/TEST/ON in `variante="lista"` e `card`) |
| Telegram & canali | `test-telegram` · `test-telegram-template` (etichetta fonte unica `🔗 Fonte Ufficiale`, URL **mai** in chiaro in tutte le tipologie, etichetta sempre cliccabile, payload con anteprime disattivate) · `test-telegram-tier` · `test-canali-telegram` (post canali: etichetta canonica, URL non in chiaro, gate link diretti) |
| Brand & favicon | **`test-favicon`** (`npm run test:favicon`): `index.html` ↔ `public/` (misure dichiarate = misure reali), PNG decodificati per provare **campo azzurro #2B6F9E + radar bianco**, `favicon.ico` multi-misura valido, `apple-touch-icon` opaco, pesi e assenza di asset legacy/scuri. Supporto: `scripts/lib/pngRgba.ts` (decoder PNG senza dipendenze) |
| Checkout & promo | **`test-checkout-promo`** (`npm run test:checkout-promo`): invarianti di `supabase/functions/checkout` (BETA1ANNO solo PRO annuale + validazione `promo_codes` + `discounts[0][coupon]`, mai `promotion_code`), `webhook` (RPC `attiva_codice_promo`: PRO+1anno, `is_beta_tester`, consumo del monouso), `config.toml` (`verify_jwt`), RPC/seed nelle migrazioni, `profiles.provincia`, 401 Guest del health check, form di registrazione (provincia, nota istituti scolastici, errori non silenziosi); la **chiusura annuale** (`PROANNUALE40`) ha la guardia dedicata **`npm run test:checkout:annuale`** (`scripts/test-checkout-annuale.ts`, 11 controlli, §26.16) |
| Piano & funnel | **`test-piano-sync`** (`npm run test:piano`): chiama le **funzioni vere** (`pianoDaProfilo`, `provaProScaduta`, `pianoLimits`, bozza di registrazione con stub di `localStorage`) + invarianti di cablaggio: PRO concesso dal backend (tier `pro_*`/`is_beta_tester`), tetti PRO mentre il piano è in lettura, Beta Tester mai retrocessi, nome composto «Bison Productions» integro nella bozza, prefill del form (nome/cognome/email dal wizard), Realtime sulla riga `profiles`, **entitlement unico dal contesto (`hasProAccess`) in dashboard e badge/menu utente**, visibilità delle feature flags reattiva allo snapshot, paywall solo con piano confermato, trigger DB dell'anagrafica |
| Notizie | `test-notizie-feed` · `test-notizie-editoriale` · `test-notizie-nazionale` · `test-notizie-rate` |
| Modulistica & PDF | `test-moduli-integrity` · `test-pdf-mad` · `test-pdf-breve` · `test-pdf-brevi` · `test-pdf-universita` · `test-pdf-completo` |

Nota di lettura: ogni test è un **programma `tsx` autonomo** (non una suite Vitest): lancia,
stampa esiti espliciti e imposta l'exit code. Molti accettano flag (`--dry`, `--apply`) e
usano il seam di test (`inviaEmail`/`inviaTelegram`, `SCUOLERADAR_LEDGER_PATH`) per non
produrre effetti collaterali.

## 19. Moduli bloccati (🔒 LOCKED_MODULES.md)

Non modificare senza autorizzazione esplicita ("Sblocca il modulo X"):
1. `src/components/AuthModal.tsx`
2. `src/pages/ChiSiamoPage.tsx`
3. `src/pages/PrezziPage.tsx`

---

## 20. Stato attuale & note operative

- **Regola di lavoro permanente — Isolamento dei dipartimenti (Consorzio)**: si opera
  **solo** nel dipartimento in lavorazione (`src/departments/<nome>/**`) + nei
  condivisi essenziali (`src/config/**`, `src/lib/**`, `src/data/**`, `src/hooks/**`,
  `src/types/**`, `supabase/functions/_shared/**`) + negli artefatti della modifica
  (test collegati, `docs/**`, `comunicazione/**`). **Vietato** leggere/scansionare o
  modificare gli altri dipartimenti: per uscire dal perimetro serve lo **sblocco
  congiunto** esplicito nella richiesta dell'utente. Regola scritta in `.clinerules`
  (radice del workspace e `project/`) e dettagliata in `docs/DEPARTMENT_ISOLATION.md`.

- **Sessione 2026-09-24 · Voce di menu «I Miei Documenti» e TERZA tab in Modulistica**:
  1. **Menu utente**: la voce (vicino al badge PRO) non è più «Documenti» ma
     **«I Miei Documenti»** e punta alla **terza tab della Modulistica**
     (`/dashboard/moduli?tab=documenti`); se il dipartimento Modulistica è spento
     (feature flag) ricade sulla sezione Documenti del profilo — mai un link morto.
     Il badge continua a contare i moduli ufficiali scaricati.
  2. **Modulistica — terza tab «I Miei Documenti»**: `VistaModulistica` include
     `'documenti'`, `ModuliNavigation` mostra la terza voce (`FolderUp`), il
     contenitore monta `TabDocumentiPersonali` e il deep link `?tab=documenti`
     atterra direttamente sulla tab. **Nessun paywall PRO**: sono file dell'utente,
     non moduli del catalogo (il lock resta solo su «I Miei Moduli Scaricati»).
  3. **Storage personale con TRASCINAMENTO**: `MieiDocumenti` è stato spostato in
     `src/components/documenti/` (componente di **piattaforma**, una sola
     implementazione per profilo e Modulistica) e ora supporta **drag & drop** e
     selezione multipla dei file, con anteprima di stato («Rilascia qui i tuoi
     file»), conteggio dello spazio, apertura ed eliminazione. Il **disclaimer** è
     esplicito: *spazio di storage a uso esclusivo dell'utente*, file sotto la sua
     totale responsabilità, nessun upload sui nostri server (restano nel browser).
  4. **Verifiche**: `npm run typecheck` ✓ · `npm test` ✓ · `npm run test:modulistica`
     (`test:moduli`) ✓ · `npm run test:architettura` ✓ (nessuna violazione nuova) ·
     `npm run build` ✓ · `npm run lint` pulito sui file toccati. `test:documenti`
     copre ora anche la terza tab, il deep link, l'assenza di paywall e il drag & drop.

- **Sessione 2026-09-24 · Fix UX wizard (zero scroll, ricerca unificata), login/Google,
  provincia principale e copy PRO**:
  1. **Login / Google One Tap — niente secondo click su «Accedi»**: l'identità locale
     ora nasce da un'unica funzione pura, `identitaDaSessione` (`contexts/app/helpers.ts`),
     usata sia dal **bootstrap** (`useProfileBootstrap`: con un token valido — anche al
     ritorno da Google OAuth — `setUser`/`setSupabaseUserId` sono sincronizzati SUBITO,
     senza dipendere dall'ordine degli eventi) sia dal **listener** (`useAuthSync`, che
     ora copre anche `TOKEN_REFRESHED` e `USER_UPDATED`; il track del funnel resta solo
     su `SIGNED_IN`/`INITIAL_SESSION`). `AuthCallback` **attende la sessione** (polling
     `getSession`, max 8 s) invece di rimbalzare alla home: lo scambio PKCE è asincrono e
     il rimbalzo faceva apparire l'utente come ospite. Nel **wizard**, appena arriva
     l'identità si rilegge il piano (`refreshProfilo`) → stato PRO riconosciuto nel
     medesimo render, senza ricaricare la pagina. Verifica: `npm run test:sessione`.
  2. **Wizard a prova di scroll**: `Modal` con `dense` ancora più compatto (`p-1.5/p-2`,
     header `py-2`, `max-h-[96vh]`, body `p-3`); progress e footer ridotti; Passo 1 con
     anagrafica in variante `compatto` e card degli ordini più basse; Passo 2 (lista
     `max-h-36`); Passo 4 (spaziature e box compatti); **Passo 3 su DUE COLONNE**
     (`md:grid-cols-2`: classi a sinistra, competenze a destra) con l'elenco classi
     `max-h-44`. Dicitura uniformata: il passo 1 è **«Dove vuoi lavorare?»** anche nei
     titoli di avanzamento (`TITOLI_STEP`), che ora ricalcano i titoli reali dei passi.
  3. **Ricerca UNIFICATA (classi + competenze + parole chiave)**: nuovo modulo puro
     `lib/ricercaSelezioniRadar.ts` e campo condiviso `radar/components/RicercaSelezioni`
     (risultati inline, visibili solo mentre si digita). Digitando «Pedagogia» escono le
     **classi collegate per materia** (A-18) *e* la proposta di usarla come **parola
     chiave** personale: stesso motore nel passo 3 del wizard e nella sezione «In cosa
     puoi lavorare» delle Preferenze, dove l'elenco fisso di materie è stato **rimosso**
     (restano i 12 tag PNRR/PON e i chip di quanto scelto). Le due colonne non hanno più
     campi di ricerca propri: un solo campo per tutto. Verifica: `npm run test:ricerca`.
  4. **Provincia principale anche nei downgrade**: nuovo
     `limitaProvinceMantenendoPrincipale` (in `lib/provinceRadar.ts`), usato dal wizard
     (prefill, bozza, salvataggio finale), dalle Preferenze e dal **self-heal del
     contesto** (`usePreferenzeUtente`): se il piano torna Base resta attiva la provincia
     **principale** (la prima scelta, ordine = priorità), mai una di contorno. Badge e
     promozione con ☆ già presenti nel wizard e in Preferenze. Verifica:
     `npm run test:province`.
  5. **Copy etico (zero competizione, zero fretta)**: rimosso ogni riferimento a
     «prima degli altri» / «prima di tutti» / fretta artificiale. Il banner PRO
     (`AuthModal`) e il benvenuto PRO (`BenvenutoProRadar`) ora recitano: «**Un mese
     PRO, completamente gratis.** Smetti di perdere ore a cercare sui siti delle
     scuole: ci pensa il Radar a trovare gli interpelli per te, così puoi dedicarti
     alla tua vita.» — CTA senza «subito». Corretti anche il passo 3 della landing
     («Candidati **con i link ufficiali**», non più «prima degli altri»), il sottotitolo
     «Come funziona» e il Passo 4 del wizard (collegamento Telegram senza urgenza).
     Nuovo gate **`npm run test:copy:etico`** (in `npm test`): scansiona `src/**` per
     le frasi competitive e le superfici di UI/marketing per quelle di fretta, e
     verifica la copy del PRO. Le parole generiche («in poche ore», «tempestivamente»)
     restano ammesse SOLO come informazione di servizio (convocazioni) o in formule
     legali nei dipartimenti Notizie/Modulistica: **non toccati**.
     **Conflitto normativo risolto**: `comunicazione/05_abbonamenti_pagamenti` vietava
     «gratis/gratuito»; la regola è stata resa esplicita (il divieto vale per i piani
     a pagamento e per le comunicazioni di pagamento) con l'**eccezione documentata**
     per il mese PRO senza costi nella UI di prodotto, e la sezione §2-bis della
     checklist generale ora codifica il tono etico (zero competizione, zero fretta).
  6. **Verifiche**: `npm run typecheck` ✓ · `npm test` ✓ (catena estesa con
     `test:sessione`, `test:ricerca`, `test:province`, `test:copy:etico`) ·
     `npm run test:architettura` ✓ (nessuna violazione nuova) · `npm run build` ✓ ·
     `npm run lint` pulito sui file toccati. `scripts/test-radar-preferenze.ts`
     snellito (156 righe): le verifiche su ricerca unificata e provincia principale
     vivono nei nuovi script dedicati.

- **Sessione 2026-09-24 · Wizard Radar (persistenza, provincia principale, UI compatta),
  Benvenuto PRO e sezione «Documenti» del profilo**:
  1. **Persistenza ISTANTANEA del wizard** (`departments/radar/RadarWizardModal.tsx`):
     nuovo helper `persistiSelezione(patch)` che salva a OGNI click (ordini, province,
     classi, competenze, sostegno, tag liberi) su `sr_preferenze` **e** su `profiles`,
     senza attendere il passo successivo; **non retrocede `onboarded`**, così chi ha già
     attivato il Radar e sta solo ritoccando le regole non ricade nello stato «bozza».
     Prima una selezione fatta e non confermata andava persa uscendo dalla pagina.
  2. **Provincia PRINCIPALE** (la prima selezionata) vs province di contorno: nuovo modulo
     puro `lib/provinceRadar.ts` (`provinciaPrincipale`, `eProvinciaPrincipale`,
     `provinceDiContorno`, `promuoviProvinciaPrincipale`) e pill condivisa
     `radar/components/ProvinciaPill.tsx` (badge «principale» + ☆ per promuovere), usata
     dal Passo 2 del wizard e da Preferenze → «Dove vuoi cercare?». L'ordine dell'array
     `provinceCodici` è la fonte di verità della priorità ed è già autosalvato.
  3. **UI della modale del Radar**: prop `dense` di `components/Modal.tsx` (header/gutter
     ridotti, `max-h-[94vh]`) usata dal wizard; gli elenchi lunghi sono ora a **ricerca
     predittiva** (filtro per materia e competenze: i suggerimenti compaiono solo
     digitando — rimosse la `<select>` da 50 voci e le liste basse sempre aperte) e i
     **tag popolari PNRR/PON** passano da 5 a 12 (Stop Motion, Lingua inglese, coding,
     STEM, educazione motoria, progettazione bandi, orientamento…). `PassoClassiMaterie`
     è diventato un compositore: le sezioni sono estratte in
     `wizard/components/SezioneClassiConcorso.tsx` e `wizard/components/SezioneCompetenzeExtra.tsx`
     (contratti in `wizard/tipiSelezione.ts`) → **E-DIM risolta** (voce rimossa da
     `scripts/architettura-baseline.json`).
  4. **Benvenuto PRO al primo accesso**: nuovo `radar/components/BenvenutoProRadar`
     (esportato da `departments/radar/index.ts`, montato in `/dashboard/radar`): una sola
     volta per utente (`sr_benvenuto_pro_<id|email>`), solo con piano CONFERMATO dal DB
     (`pianoStato === 'pronto'` + `hasProAccess`) e profilo completo; congratulazioni per
     il **mese di PRO in omaggio** (con scadenza) e CTA immediata «Attiva il Radar subito»
     → `openRadarSetup()`.
  5. **Sezione «Documenti» del profilo**: la voce del menu utente non è più «Documenti
     scaricati» ma **«Documenti»** (`/dashboard/profilo?sezione=documenti`) e nel profilo
     la sezione accoglie due tab: **«Moduli scaricati»** (archivio dei moduli ufficiali,
     ex «Modelli Scaricati di Recente», in `components/profile/ModuliScaricati.tsx`) e
     **«I Miei Documenti»** (`components/documenti/MieiDocumenti.tsx`, oggi condiviso con la
     Modulistica: upload di PDF,
     immagini, Word e testo, apertura, eliminazione, contatore di spazio e **disclaimer di
     responsabilità**) con lo storage locale governato da `lib/mieiDocumenti.ts` (6 file ·
     1 MB per file · 3,5 MB totali, esiti sempre espliciti: nessun salvataggio silenzioso
     quando la quota del browser è piena). I file restano nel browser dell'utente: nessun
     upload sui nostri sistemi.
  6. **Verifiche**: `npm run typecheck` ✓ · `npm test` ✓ (catena estesa con
     `scripts/test-documenti-utente.ts` → `npm run test:documenti`) ·
     `npm run test:architettura` ✓ (nessuna violazione nuova; 1 eccezione risolta) ·
     `npm run build` ✓ · `npm run lint` pulito sui file toccati. Estesi
     `scripts/test-radar-preferenze.ts` (persistenza istantanea, provincia principale con
     casi reali) e `scripts/test-flags-cablaggio.ts` (rimando alla Modulistica spostato in
     `components/profile/ModuliScaricati.tsx`).

- **Sessione 2026-09-23 · Stato PRO letto dal DB (mai «Base» per errore) e chiusura
  dei dipartimenti in produzione**: due interventi richiesti insieme.
  1. **Sincronizzazione PRO frontend/backend**: l'entitlement è UNICO e deriva da
     `profiles.piano` (`pianoDaProfilo`: `piano` + `subscription_tier` `pro_*` +
     `is_beta_tester`, con Free Forever prioritario); la dashboard non lo ricalcola più
     per conto suo (rimosso l'`hasAccessoPro` locale → si usa `hasProAccess` del
     contesto), quindi con un PRO/promo/omaggio/codice beta assegnato dal database
     «Opportunità mappate» e le province multiple risultano sbloccate subito. Anche le
     ETICHETTE del piano seguono il piano e non il solo flag di pagamento: badge top bar
     (`BadgePianoCompatto`), badge mobile (`BadgePianoRiga`) e chip «Piano PRO/Base» /
     CTA «PASSA A PRO» del `MenuUtente` → un PRO con `abbonamento_scade_il` non
     aggiornato non può più comparire come «Base». Restano attivi Realtime sulla riga
     `profiles`, il refresh su focus/60 s e la guardia anti-blocco (10 s) di
     `useGuardiaPiano`.
  2. **Feature flags globali (chiusura in produzione)**: `DIPARTIMENTI[].statoBase`
     (`src/config/features.ts`) espone la superficie PUBBLICA — ACCESI `radar` e
     `purefocus`; CHIUSI `cfu`, `modulistica`, `referral`, `cv_builder` (prima
     `cfu`/`modulistica`/`referral` erano accesi). Nella build `vite build`, senza
     override, un utente non admin non vede nessuna tab/link di un dipartimento chiuso:
     navbar desktop (`BarraStrumenti`), drawer mobile, tab della dashboard
     (`DashboardLayout`), menu utente («Documenti» → sezione del profilo con archivio
     moduli + storage personale; badge filtrato), landing (griglia
     strumenti, bacheca radar, CTA finali), catalogo servizi e pagine `/servizi`,
     footer, vetrina freemium, rotte (`FeatureGate`, incluso il `/calcolatore-cfu`
     pubblico e `/moduli`) e redirect post-login/onboarding (`primaRottaVisibile`). Un
     dipartimento si riapre dal pannello Admin/DEV Toolbar (browser corrente) o con
     `FEATURE_<DIPARTIMENTO>=on`. La VISIBILITÀ è ora anche reattiva: `useFeatureFlags`
     passa lo snapshot sottoscritto degli override a `dipartimentoVisibile`, così
     navbar, tab e `primaRottaVisibile` si aggiornano nello stesso render in cui cambia
     uno stato (prima i valori memoizzati restavano quelli precedenti → sblocco non
     istantaneo).
  Guardie: `npm run test:flags` (superficie pubblica = esattamente `radar` +
  `purefocus`, snapshot di visibilità, cablaggio di menu utente e hook) e
  `npm run test:piano` (entitlement unico in dashboard, etichette del piano dal DB,
  feature flags reattive).

- **Sessione 2026-09-22 · Email di benvenuto allineata alla promo «Mese PRO omaggio»**
  (solo copy, nessun cambio di logica): il messaggio inviato alla registrazione dal trigger DB
  `trg_auth_users_step1_welcome` (Edge `send-notification`, tipo `step1` → copy di
  `conferma_base`) conferma ora l'**attivazione immediata** del mese di PRO in omaggio ed
  elenca i quattro strumenti già disponibili *senza restrizioni* (Radar Scuole con notifiche
  illimitate, Modulistica scolastica, Crea CV, Calcolatore CFU), con invito a impostare
  provincia e classi di concorso. Eliminati i riferimenti al vecchio modello (**«account
  Base»**, quota delle **«3 segnalazioni»**, «piano PRO gratuito per 30 giorni», ritorno al
  piano gratuito). Allineate le 4 superfici che generano lo stesso messaggio:
  `TESTI.conferma_base` (email + Telegram; `TESTI.step1` ne resta un clone ⇒ unica fonte),
  il template `email_1_1_onboarding` (`supabase/functions/_shared/emailTemplates.ts`, usato
  dal pannello Admin e dal tipo omonimo), `CORPO_MESSAGGI.welcome` (`src/lib/resend.ts`),
  `TESTO_TELEGRAM.welcome` (`src/lib/telegram.ts`) e la scheda «Benvenuto / onboarding»
  (`src/config/automazioniEmailCatalogo.ts`). Guardie estese: `test:email` (blocco
  `conferma_base` + template + renderer, con elenco di copy **vietate**), `test:telegram:template`,
  `test:automazioni` (anteprima senza «piano Base»).
  ⚠️ Operativo: il benvenuto parte solo se l'automazione `benvenuto` è **attiva** nel pannello
  Admin; per il tipo `step1` il corpo è fissato nel codice (dal pannello si personalizzano solo
  oggetto e intro), mentre i tipi basati su `emailTemplates` accettano anche un corpo
  personalizzato che **vince** sul copy del codice → serve ri-deployare la Edge `send-notification`.

- **Sessione 2026-09-22 · DEV Toolbar (toggle dipartimenti)**: i sei selettori
  OFF | TEST | ON vivono **dentro** la DEV Toolbar laterale, in forma lista compatta
  (`FlagDipartimentiPanel variante="lista"`, sezione «Dipartimenti (feature flags)» subito
  sotto «Stato utente»). Ogni click salva in `localStorage: sr_flag_dipartimenti` (store
  condiviso → navbar/rotte aggiornate all'istante). Nuovo
  `src/components/FlagDipartimentiProva.tsx`: anteprima «Navbar ora», valore grezzo
  persistito riletto a ogni click e pulsante «Verifica scrittura localStorage» (round-trip
  con ripristino del valore). `npm run test:flags` verifica anche la scrittura della chiave
  (stub di `localStorage`) e il cablaggio dei tre componenti.
  **Aggiornamento (stessa giornata) — copertura totale della vetrina pubblica**: lo store
  notifica ora anche le **altre schede** del browser (evento `storage`, attivato al primo
  sottoscrittore) e l'hook espone `primaRottaVisibile()` (primo dipartimento visibile con
  fallback `/dashboard/profilo`), usato da `ReindirizzaDipartimentoPrincipale`, post-login
  (`AuthModal`), post-onboarding e ritorno dal checkout. Le superfici che prima mostravano
  «in chiaro» i moduli spenti sono ora filtrate dallo stesso store: griglia strumenti della
  landing (`LandingStrumenti`), bacheca radar e CTA finali, catalogo servizi
  (`serviziVisibili`, con `modulo` per servizio in `src/data/servizi.ts`), pagine
  `/servizi` e `/servizi/:slug` (redirect se `off`), footer, vetrina freemium, rimandi in
  profilo e nelle schede avviso. Invariante: `off` = sparisce da navbar desktop/mobile,
  sito pubblico e rotte, per tutti (admin incluso); `test` = solo admin/DEV.

- **Sessione 2026-09-22** (logo · feature flags · email):
  · logo dell'header **riportato all'asset originale** (882×212: tile azzurra con
    radar bianco + wordmark blu/arancione/azzurro) in `public/logo.png` e
    `src/assets/logo.png`; favicon leggera `public/favicon-256.png` (256×256, ~20 KB)
    al posto del PNG da 2,4 MB;
  · **DEV Toolbar**: selettore a 3 stati dei dipartimenti con legenda OFF/TEST/ON e
    persistenza `sr_flag_dipartimenti` (store condiviso, aggiornamento immediato);
  · nuovo pannello **Admin → «✉️ Email & Automazioni»**: per ogni automazione
    trigger, oggetto, anteprima visiva del copy, editor (oggetto/intro/corpo) e
    interruttore. File: `components/{TabEmailAutomazioni,RigaAutomazione,
    AutomazioniInterruttore,PannelloCopyAutomazione,automazioniSupporto}`, stato in
    `hooks/useAutomazioniEmail`, dati in `services/automazioniService`. Lo stato vive
    in `public.app_settings` (`email_automazione_<id>`) e viene rispettato dalla Edge
    `send-notification` e dal notifier (`src/lib/automazioniEmailDb.ts`).
    Guardia: `npm run test:automazioni` (inclusa in `npm test`).

- **Sessione 2026-09-22 · Motore Telegram (anteprime, etichetta fonte, link generici)**:
  risanamento del modulo `src/lib/telegram.ts`, il solo che genera i messaggi Telegram:
  1. **Anteprime**: il payload di `sendMessage` è costruito in un UNICO punto
     (`payloadMessaggioTesto`) con `link_preview_options.is_disabled` **e**
     `disable_web_page_preview: true` → nessun riquadro che carica loghi istituzionali o
     immagini casuali delle fonti (le «FC»/«FE»); nessun media nel modulo
     (`sendPhoto`/`sendMediaGroup` banditi e verificati dai test);
  2. **Etichetta fonte UNICA**: `🔗 Fonte Ufficiale` (`ETICHETTA_FONTE_UFFICIALE`) in alert
     personali, digest e post dei canali — prima erano due (`👉 Apri l'avviso ufficiale` e
     `🔗 Leggi la Fonte Ufficiale`); `rigaAvvisoUfficiale` ora delega a
     `rigaFonteUfficiale`, quindi esiste una sola implementazione. L'URL ufficiale resta
     SOLO nell'`href`: mai in chiaro nel testo (verificato su tutte le tipologie). Le email
     mantengono la loro etichetta descrittiva per destinazione (fuori scope);
  3. **Niente link generici**: il gate `eUrlAvvisoDiretto` è applicato DENTRO i generatori
     di riga → home dell'ente, elenchi/archivi/tag, landing regionali e pagine di ricerca
     (`?s=INTERPELLO`) non producono riga di fonte (`''`), senza alcun fallback; nel digest
     la guida operativa si calcola sull'URL **effettivamente mostrato** (non su quello
     grezzo), così non rimanda a un link assente. Gli URL di ScuoleRadar (CTA Radar,
     Notizie) restano volutamente visibili: il divieto riguarda le fonti.
  Guardie estese: `test:telegram:template` (etichetta unica + sempre cliccabile, URL mai in
  chiaro in TUTTE le tipologie, payload anti-anteprima, link non diretti scartati),
  `test:telegram:canali` (etichetta canonica + URL non in chiaro), `test:digest`,
  `test:link`, `test:copy`.

- **Sessione 2026-09-22 · PRO sincronizzato, dati del wizard e feature flags** (codice rosso):
  tre disallineamenti corretti alla radice:
  1. **Piano PRO letto dal BACKEND**: `pianoDaProfilo` ignorava `subscription_tier` (Account
     Bridge: `pro_annuale`/`pro_mensile`) e `is_beta_tester`, quindi un PRO concesso via promo,
     omaggio, codice beta o pannello admin restava **Base** nel frontend (limiti province,
     «Opportunità mappate» bloccate, badge errati). Ora entrambe le fonti valgono come PRO, i
     Beta Tester **non vengono mai retrocessi** (come nella funzione DB) e la UI è reattiva
     **senza latenza**: sottoscrizione **Realtime** sulla riga `profiles` (oltre a focus/60 s),
     guardia anti-blocco del caricamento (10 s) e — finché il piano non è confermato — **tetti
     PRO** applicati alle preferenze con riallineamento automatico quando il piano arriva
     (`useGuardiaPiano`, `pianoLimits(..., confermato)`); paywall solo con piano confermato.
  2. **Dati del wizard → registrazione**: la bozza anagrafica (nome, cognome, genere, età,
     provincia dedotta, email di notifica) vive in `sr_registrazione_bozza`
     (`src/lib/bozzaRegistrazione.ts`) e precompila il form finale — **niente dati richiesti due
     volte** e nome composto («Bison Productions») conservato integro (il sync OAuth non
     sovrascrive più i valori esistenti e spezza `full_name` solo se mancano i campi espliciti).
     `salvaProfilo` scrive finalmente `nome`/`cognome` e la **migrazione
     `20260922130000_welcome_metadata_anagrafica.sql`** fa sì che il trigger di benvenuto salvi
     anche cognome/età/provincia (prima il cognome andava perso e il mini-onboarding lo
     richiedeva di nuovo). Passo finale del wizard: **registrazione rapida con Google** in
     evidenza + enfasi su **Telegram** (avvisi istantanei) vs email (solo riepiloghi).
  3. **Feature flags e navbar**: i moduli in `off` restavano «in chiaro» sul sito pubblico
     (griglia servizi della landing, pagine `/servizi`, footer, vetrina freemium, rimandi in
     profilo/schede avviso). Ora tutte quelle superfici leggono lo **stesso store** e i redirect
     post-login/onboarding usano `primaRottaVisibile()` (mai un modulo spento); in più lo store
     si sincronizza **tra schede** dello stesso browser (evento `storage`).
  Nuova guardia `npm run test:piano` (43 controlli con le funzioni vere + cablaggio) e controlli
  aggiunti a `test:flags` sulle superfici pubbliche. ⚠️ Da fare a mano: applicare la migrazione
  `20260922130000` e **abilitare Realtime su `public.profiles`** in Supabase (senza, restano
  focus + polling 60 s).

- **Sessione 2026-09-22 · Checkout Stripe, coupon `BETA1ANNO` e onboarding** (verifica mirata):
  tre scostamenti reali, tutti invisibili dalla UI:
  1. `BETA1ANNO` applicava il coupon al 100% su **qualsiasi** piano (anche mensile/crediti) e
     **senza leggere il DB** → ora è accettato solo su `pro_annuale` e lo stato del codice è
     letto da `promo_codes` (disattivato/scaduto/già usato ⇒ HTTP 400 con il motivo; tabella
     non leggibile o riga assente ⇒ fail-open loggato). `[functions.checkout] verify_jwt = true`
     dichiarato esplicitamente in `supabase/config.toml`;
  2. il codice **non veniva mai consumato** e l'utente non diventava `is_beta_tester`: la RPC
     canonica `attiva_codice_promo` (PRO + 1 anno + beta tester + consumo del monouso) esisteva
     ma **non era chiamata da nessuno** → ora la invoca il `webhook` al completamento del
     checkout (anche `no_payment_required`, il caso del coupon al 100%);
  3. il **System Health Check** segnalava come warning il 401 di `checkout` in modalità Guest:
     è invece il comportamento corretto (nessuna configurazione Stripe agli anonimi) → ora è
     **OK**; autenticati, il ping mostra modalità TEST/LIVE, mappatura `BETA1ANNO` e webhook.
  Onboarding e auth: il form di registrazione (ultimo passo del wizard, anche per i Guest)
  raccoglie ora anche la **provincia di residenza** (`profiles.provincia`, migrazione
  `20260922120000`, con fallback se la colonna non è ancora nel DB) e precompila sesso/età dalla
  bozza del wizard; aggiunta la **nota di supporto per gli account istituzionali** (domini
  `.edu.it` → account Google personale o email/password, rimando FAQ `#animatore-digitale`,
  complementare a `OAuthBounceModal`) e resi **non silenziosi** gli errori di `signUp`
  (`register` ora è `async` e traduce l'errore Supabase nel form). Nuova guardia
  `npm run test:checkout-promo` (44 controlli statici su Edge/config/migrazioni/UI).
  ⚠️ Da fare a mano: applicare la migrazione, `supabase functions deploy checkout webhook` e
  verificare nel dashboard Stripe la **durata** del coupon `XRxitsVf` (vedi promo `BETA1ANNO`).

- **Sessione 2026-09-22 · Favicon ufficiale & identità nella scheda** (correzione definitiva):
  la tab del browser mostrava la **vecchia tessera blu scuro** perché `index.html`
  **committato** (quello che Vercel mette in produzione) puntava a
  `/ScuoleRadar Favicon Square.png` (2,4 MB, identità precedente) mentre la correzione
  esisteva solo nel working copy non committato. Risolto in modo strutturale:
  nuovo generatore **`scripts/make-favicons.mjs`** (`npm run favicon`) che ritaglia la
  **tessera azzurra** da `public/logo.png` e produce `favicon-16/32/48/256.png`,
  `favicon.ico` (multi-misura 16/32/48) e `apple-touch-icon.png` (180×180, opaco, sfondo =
  colore dominante del marchio), `index.html` con `sizes` esplicite + `theme-color`
  `#2B6F9E`, nuova guardia **`npm run test:favicon`** (43 controlli: wiring HTML ↔ `public/`,
  decodifica PNG e identità azzurra, radar bianco, pieno formato, ICO valido, pesi) e
  **rimozione** dal sito servito di `ScuoleRadar Favicon Square.png`,
  `ScuoleRadar Logo Transparent Full Final.png`, `favicon_old.svg`, `logo_old.png`
  (`public/` passa da ≈6 MB a ≈91 KB). ⚠️ Serve **commit + push** perché il fix
  raggiunga la produzione.

- **Sessione di riallineamento 2026-09-21**: refactoring modulare (contesti splittati
  `AppContext` 1634 → 282 righe, dominio `departments/cfu/`, generatore PDF modulare,
  `departments/{admin,radar,scadenze}`), **standard editoriale stretto** delle notizie,
  logo dell'header da **asset di build hashato**, **gate di architettura in CI**.
- **Gate**: `npm run test:architettura` → `462 file · 144 violazioni (82 errori / 62 warning)`,
  tutte congelate in `scripts/architettura-baseline.json` → **✅ nessuna violazione nuova**.
- **Verifiche di prodotto**: `npm test` (7 suite del motore CFU), `npm run typecheck`,
  `npm run build`, `npm run test:favicon`, `npm run test:checkout-promo`, `npm run test:piano`,
  `npm run test:flags`, `scrape:check`, `scrape:notizie:check`, `test:notizie-*`, `test:moduli`,
  `test:pdf*`.
- **Dev server**: porta fissa **5174** (`strictPort` in `vite.config.ts`).
- **Notizie**: 1–3 articoli/settimana; il cron **fallisce se la settimana resta vuota**;
  manutenzione dell'archivio con `npm run notizie:ripara-archivio`.
- **Modulistica / Archivista Capo**: teaser PRO, ricerca live sul catalogo; il PDF nasce dal
  modulo `creator/pdf/**` (§7.3).
- **File temporanei in radice** (`dev-server*.log`): non versionati, da ripulire.
- **Follow-up aperto**: asset pesanti in `public/` **RISOLTO** il 2026-09-22 (set favicon
  ufficiale ≈91 KB in totale, `npm run favicon` + `npm run test:favicon`); resta la
  promozione a dominio dedicato di
  **CV Builder**, **PureFocus** e **Assistente AI** (oggi fuori dalla gerarchia a
  5 dipartimenti — §1.5 e `DEPARTMENT_MAP.md` §6).

---

## 21. Pipeline di notifica end-to-end (specifica completa)

### 21.1 Schema dei flussi

```
A) ALERT TEMPO REALE (solo PRO)
   scraper.yml (07/12/15 UTC Lun–Ven) → src/scraper/index.ts → upsert interpelli
     └─► lib/notifier.ts :: inviaAlertTelegramTempoReale
           ├─ gate qualità (avvisoInviabile)
           ├─ frequency cap (valutaFrequenza)
           ├─ inviaMessaggioTelegram (Bot API)
           └─ registraInvioAvviso (ledger file + notifications_log)

B) DIGEST GIORNALIERO (BASE via Telegram, tutti via email)
   digest.yml (15/16 UTC Lun–Ven) → notifier :: inviaDigestGiornaliero
     ├─ finestra: eOraDelDigest (ORA_DIGEST, fuso Europe/Rome)
     ├─ guardia una-email-al-giorno: chiaveDigestGiorno
     ├─ raccolta voci: vociAttive (solo non scadute) + raggruppaPerProvincia
     ├─ email: renderDigestEmailHtml → Resend (TIPI_CON_OPPORTUNITA, OGGETTO_OPPORTUNITA)
     └─ Telegram: formattaDigestTelegram (MAX_VOCI_TELEGRAM_DIGEST) solo per piano BASE

C) PROMEMORIA 24h (email)
   notifier :: inviaPromemoria24h
     ├─ regole pure: promemoria.ts (ORE_PROMEMORIA, GIORNI_URGENZA_PROMEMORIA, eVoceUrgente)
     ├─ chiave di deduplica per coppia utente×interpello: chiavePromemoria
     └─ renderPromemoriaEmailHtml → Resend

D) DRIP BASE (email, 6 step)
   auth.users → trigger trg_auth_users_step → Edge send-notification (step 1…)
   pg_cron step5-notifiche (ogni minuto) → dispatch_step5_due → Edge (tipo 'step5')

E) CICLO DI VITA ABBONAMENTO (email/Telegram)
   pg_cron → invia_avvisi_scadenza_abbonamento / invia_preavvisi_rinnovo
             / reverti_prove_pro_scadute / rinnova_free_forever_*
     └─► Edge send-notification (template _shared/emailTemplates.ts)

F) CANALI TELEGRAM REGIONALI (pubblico)
   scraper → telegram.ts :: pubblicaInterpelloSuCanali
     ├─ destinazioniPubblicazione (regionePerProvincia → canalePerRegione, + ATA nazionale)
     ├─ gate link safety (EsitoPubblicazioneCanali.saltato: nessun post senza avviso specifico)
     └─ channel_posts_log (un post per canale per avviso)
```

### 21.2 Le quattro barriere anti-spam (in ordine di applicazione)

| # | Barriera | Implementazione | Regola |
|---|---|---|---|
| 1 | **Qualità** | `lib/alertInterpello.ts`: `avvisoInviabile`, `motivoAvvisoNonInviabile` | niente invio senza **link diretto** (`eUrlAvvisoDiretto`) **e** recapito (PEO dalla convenzione MIM) |
| 2 | **Identità dell'avviso** | `lib/dedupAvvisi.ts`: `improntaAvviso`, `normalizzaPerImpronta`, `GIORNI_IMPRONTA` | la stessa notizia ripubblicata con titolo/data diversi produce la stessa impronta → non si rinotifica |
| 3 | **Frequency cap** | `lib/frequenzaNotifiche.ts` + `notifier.avvisoGiaInviato` | `MAX_INVII_OPPORTUNITA = 2` in `GIORNI_MASSIMI_OPPORTUNITA` giorni **diversi**, mai due volte lo stesso giorno, **per canale**; `identitaFrequenza = scuola/classi/hashContenuto` (classi normalizzate `A-022` ≡ `A-22`) |
| 4 | **Ledger persistente** | `lib/ledgerLocale.ts` (`.scuoleradar/notifiche-ledger.json`) + `public.notifications_log` | ogni invio è registrato con il **giorno**; i due ledger si fondono (`unioneChiavi`, `unisciFileLedger`) |

Override e seam: `SCUOLERADAR_LEDGER_PATH` sposta il ledger (usato dai test),
`inviaEmail`/`inviaTelegram` iniettano i trasporti, `forzato`/`soloUtente`/`soloRegistrare`/`finoA`
sono le opzioni di `inviaDigestGiornaliero`.

### 21.3 Contratto della Edge `send-notification`

- **Input**: JSON con `tipo` (`step5`, `welcome`, `prova1..3`, `extra`, `recap`, `welcome_pro`,
  `notifica_pro`, `scadenza_preavviso_7d/3d/1d`, `scadenza_finale`, `rinnovo_preavviso_prova`,
  `rinnovo_preavviso_pro`), `userId` e contesto; header `x-send-secret: <SEND_NOTIFICATION_SECRET>`.
- **Output**: JSON con esito per canale. `400` = secret non valido o tipo non mappato (i tipi
  storici sono risolti via `TIPO_ALIAS` sui template FLUSSO 3).
- **Template**: `_shared/emailTemplates.ts` (`email_3_1_scadenza_5` … `email_3_4_scadenza_0`,
  `email_3_5_rinnovo_prova`, `email_3_6_rinnovo_pro`, CTA `{{link_prezzi}}`).
- **Idempotenza**: la Edge **non** deduplica i contenuti — la deduplica vive nel chiamante
  (ledger + frequency cap) e in `preavviso_rinnovo_inviato_at` per i preavvisi.

### 21.4 Punti di rottura noti e contromisure

| Sintomo | Causa tipica | Contromisura implementata |
|---|---|---|
| "lo stesso alert arriva più volte" | stessa opportunità con hash/titolo diverso | barriera 2 (impronta normalizzata) + barriera 3 (frequency cap) |
| Utente BASE senza Telegram e senza digest | recapito mancante | il gate qualità blocca l'invio **e** la quota non viene consumata |
| Digest con voci scadute | filtro mancante | `vociAttive` esclude le scadenze passate |
| Post canale su avviso generico | fonte non puntuale | gate link safety in `pubblicaInterpelloSuCanali` (`saltato`) |
| Drip che continua dopo l'upgrade a PRO | sequenza non cancellata | trigger `trg_profiles_stop_drip_on_pro` → `cancella_drip_pro` |
| Quota non allineata | RPC indeterminata | `incrementa_notifiche_utente` idempotente + `test:migrazioni` |

---

## 22. Error handling, resilienza e anti-silent-fail (specifica)

### 22.1 Error boundary a strati

| Boundary | Dove | Ambito | Fallback |
|---|---|---|---|
| `AppErrorBoundary` | `src/components/AppErrorBoundary.tsx` (esterno) | intera SPA | schermata di errore con reset |
| `DepartmentErrorBoundary` | `src/components/DepartmentErrorBoundary.tsx` | singolo dipartimento (radar/notizie/modulistica/cfu) | contenuto sostitutivo locale: il resto dell'app resta viva |
| `CfuErrorBoundary` | `departments/cfu/shared/CfuErrorBoundary.tsx` | dominio CFU (motore normativo + OCR) | messaggio dedicato, il calcolatore non crasha la dashboard |
| `ModuleCreatorErrorBoundary` | `modules/modulistica/creator/ModuleCreatorErrorBoundary.tsx` | sotto-modulo Archivista | la modulistica classica resta utilizzabile |

Regola: **un errore in un dominio non deve mai spegnere la SPA**; i boundary di dominio sono
montati *dentro* `AppErrorBoundary`, quindi anche un doppio crash degrada in modo ordinato.

### 22.2 Modalità demo (nessun backend)

Con `isSupabaseConfigurato() === false` (`supabase === null`):

- auth locale su `localStorage`, ruolo simulato `guest`/`base`/`pro` pilotabile da `DevToolbar`;
- feed Radar vuoto ma **strutturato** (`src/data/interpelli.ts` espone il tipo + `interpelli = []`:
  nessun mock che possa finire in produzione — coperto da `npm run test:dati-fallback`);
- modulistica e CFU funzionano con cataloghi statici e template locali;
- scadenze dal fallback `src/data/deadlinesFallback.json`;
- notizie dal file `data/notizieIngestite.ts` (committato dal cron): la sezione resta visibile.

### 22.3 Gate che impediscono i fallimenti silenziosi

| Gate | Dove | Cosa impedisce |
|---|---|---|
| **HTTP integrity** | `newsFetcher.verificaUrlUfficiale` (HEAD → GET su 403/405; solo 200/3xx) + log `✓ HTTP 200 - <url>` | link rotti nelle notizie |
| **Qualità notifica** | `avvisoInviabile` + `superaGateQualita` | invii senza link diretto o senza recapito |
| **Link safety canali** | `pubblicaInterpelloSuCanali` | post su canali con URL non puntuali |
| **Anti-mock dati** | `test:dati-fallback`, `verificaAvviso`/`eSorgenteVerificata` | placeholder ("Scuola non indicata", "Scadenza n/d") |
| **Editorial gate** | `articoloValido` + `verificaCadenzaSettimanale` (§9.3) | notizie senza sostanza o fuori standard |
| **Telemetria scraper** | `public.scraper_runs` (`esito`, `errori`, `upsert_ok`, `telegram_attesi/riusciti`) | run "verdi" senza dati |
| **Cron notizie** | `npm run scrape:notizie` → exit 1 su settimana vuota | bacheca ferma senza segnale |
| **Ledger illeggibile** | `ledgerLocale` emette **warning esplicito** su file corrotto | deduplica silenziosamente disattivata |
| **Gate strutturale** | `npm run test:architettura` | degrado architetturale non tracciato |

### 22.4 Pattern di errore nel codice applicativo

1. **Le funzioni non lanciano verso la UI**: `avviaCheckout`, i servizi di dominio e le Edge
   ritornano `{ ok, errore }` o un esito tipizzato (`EsitoRicerca`, `EsitoGenera`,
   `EsitoIntervista`, `EsitoTelegram`, `EsitoPubblicazioneCanali`, `EsitoNotifiche`, `EsitoDigest`,
   `EsitoPromemoria`, `EsitoDispatchUtente`, `EsitoDedup`, `EsitoCompatibilita`).
2. **Traduzione degli errori**: `lib/authErrors.ts` (`traduciErroreAuthSupabase`,
   `MSG_ACCOUNT_NON_ATTIVATO`) — mai un messaggio tecnico Supabase in faccia all'utente.
3. **UI mai bloccata**: gli stati `busy` sono rilasciati in `finally` (regola "mai stuck busy"
   dell'Archivista); i modali si chiudono anche in caso di errore.
4. **Fallback graduale**: se il dato ricco manca si degrada senza inventare — `preparaRigheBoard`
   **scarta** la riga invece di mostrare un segnaposto; se la fonte è un elenco,
   `risolviFonteGranulare` prova a tracciare la voce specifica e altrimenti pubblica la pagina
   disponibile con etichetta onesta.
5. **Nessuna scrittura distruttiva automatica**: le manutenzioni (`dati:pulisci*`,
   `dati:arricchisci`, `notizie:ripara-archivio`) richiedono `--apply`/`--dry` espliciti.

---

## 23. Confini dei moduli e superfici pubbliche

### 23.1 `src/lib/` — API pubbliche verificate (27 moduli)

| Modulo | Righe | Superficie pubblica (principali) |
|---|---|---|
| `alertInterpello.ts` | 704 | `costruisciAvviso`, `avvisoInviabile`, `motivoAvvisoNonInviabile`, `eUrlAvvisoDiretto`, `classificaFonteLink`, `scegliClasseRilevante`, `pulisciTitoloAvviso`, `righeTestoAvviso`, `inferisciOrdineDaTesto`, `formatDataAvviso` |
| `matchingEngine.ts` | 536 | `searchInterpelli`, `getFeedInterpelli`, `avvisoCompatibileConProfilo`, `avvisoDiSostegno`, `findUtentiCompatibili`, `elencaUtentiNotificabili`, `normalizzaClasse`, `normalizzaProvincia` |
| `notifier.ts` | 1.999 | `notificaNuoviInterpelli`, `notificaInterpelliPerUtente`, `inviaDigestGiornaliero`, `inviaPromemoria24h`, `inviaAlertTelegramTempoReale`, `avvisoGiaInviato`, `registraInvioAvviso` |
| `telegram.ts` | 1.264 | `formattaMessaggioTelegram`, `formattaDigestTelegram`, `formattaPostCanaleTelegram`, `pubblicaInterpelloSuCanali`, `destinazioniPubblicazione`, `CANALI_TELEGRAM_REGIONALI`, `canaleAtaNazionale`, `deveMostrareCtaRadar` |
| `resend.ts` | 1.145 | `renderEmailHtml`, `inviaNotificaEmail`, `inviaNotificheInterpello`, `renderDigestEmailHtml`, `inviaDigestEmail`, `renderPromemoriaEmailHtml`, `inviaPromemoriaEmail`, `footerEmailHtml`, `OGGETTO_OPPORTUNITA` |
| `frequenzaNotifiche.ts` | 133 | `valutaFrequenza`, `identitaFrequenza`, `hashContenuto`, `giornoFrequenza`, `MAX_INVII_OPPORTUNITA`, `GIORNI_MASSIMI_OPPORTUNITA` |
| `ledgerLocale.ts` | 178 | `chiaveLedger`, `ledgerLocaleGia`, `ledgerLocaleRegistra`, `ledgerLocaleSalva`, `unioneChiavi`, `unisciFileLedger`, `percorsoLedgerLocale` |
| `digest.ts` | 153 | `eOraDelDigest`, `ORA_DIGEST`, `chiaveDigestGiorno`, `ordinaVociDigest`, `raggruppaPerProvincia`, `descrizioneFinestraDigest`, `oraLocaleItalia` |
| `promemoria.ts` | 122 | `ePromemoriaDovuto`, `motivoPromemoria`, `chiavePromemoria`, `eVoceUrgente`, `oreTrascorse`, `ORE_PROMEMORIA` |
| `dedupAvvisi.ts` | 97 | `improntaAvviso`, `normalizzaPerImpronta`, `GIORNI_IMPRONTA` |
| `emailScuola.ts` | 92 | `risolviEmailUfficialeScuola`, `emailDaCodiceMeccanografico`, `normalizzaCodiceMeccanografico`, `estraiCodiceMeccanograficoDaTesto` |
| `scadenza.ts` | 91 | `giorniRimanenti`, `eScaduto`, `eInterpelloAttivo`, `stileScadenza`, `SOGLIA_IMMINENTE`, `SOGLIA_VICINA` |
| `liveBoard.ts` | 116 | `preparaRigheBoard`, `nomeScuolaRiga`, `nomePresentabileRiga`, `scuolaDaTitolo`, `titoloLeggibile`, `rigaPresentabileVetrina` (scarto dei codici classe e delle azioni amministrative) |
| `nomeIstituto.ts` | 161 | `nomeIstitutoPresentabile` (gate: testa d'istituto + denominazione, mai codici amministrativi; taglio della coda di procedura) |
| `radarValidation.ts` | 81 | `validaConfigRadar`, `messaggioCampiMancanti`, `impostaPassoRadar`, `STORAGE_KEY_RADAR_WIZARD_STEP` |
| `school-lookup.ts` | 65 | `resolveSchoolByCode`, `nomeScuolaDaCodice` |
| `planLimits.ts` | 65 | `LIMITI_RADAR`, `PROGRAMMA_NOTIFICHE`, `BANNER_PIANO`, `pianoLimits`, `limitaSelezione` |
| `abbonamento.ts` | 68 | `giorniAllaScadenza`, `inFinestraPreavviso`, `etichettaScadenzaAbbonamento`, `dataScadenzaBreve`, `FINESTRA_PREAVVISO_RINNOVO` |
| `promo.ts` | 168 | `validaPromo`, `CATALOGO_PROMO`, `leggiOverridePromo`, `salvaOverridePromo`, `SCONTO_PROMO_EUR` |
| `pricing.ts` | 28 | `PIANI`, `PianoId`, `GIORNI_TRIAL_PRO`, `STORAGE_KEY_INTENDED_PLAN`, `STORAGE_KEY_INTENDED_PLAN_DATA` |
| `purefocus-bridge.ts` | 116 | `generatePureFocusBridgeToken`, `generatePureFocusBridgeUrl`, `verifyPureFocusBridgeToken` |
| `auth-bridge.ts` | 58 | `ottieniStatoPro`, `buildPureFocusBridgeUrl` |
| `authErrors.ts` | 109 | `traduciErroreAuthSupabase`, `ErroreAuthSupabase`, `MSG_ACCOUNT_NON_ATTIVATO` |
| `analytics.ts` | 171 | `initAnalytics`, `trackPageview`, `track`, `identify` |
| `interpelloRouting.ts` | 39 | `chiaveInterpelloDaParam`, `eUuid` |
| `deep-parser.ts` | 69 | `parseDeepInterpelloContent` |
| `showroomRedirect.ts` | 27 | `getPostLoginRedirect`, `setPostLoginRedirect`, `SR_POST_LOGIN_REDIRECT` |
| `supabase.ts` | 20 | `supabase`, `isSupabaseConfigurato` |

### 23.2 Confini dei componenti globali (`src/components/`, 43 file)

- **Primitivi senza logica di dominio** (solo props): `Modal`, `Pill`, `Toast`, `Accordion`,
  `Footer`, `ScrollToTop`, `ExperimentalBanner`, `ProFeatureModal`, `ServiziPaywall`.
- **Modali di flusso applicativo** (stato in `AppContext` via `useModaliApp`): `AuthModal`,
  `VetrinaModal`, `AbbonamentoModal`, `DatiProfiloModal`, `ForcePasswordModal`,
  `SoftOnboardingModal`, `OAuthBounceModal`, `HealthCheckModal`.
- **Composizione per area**: `header/**` (6 file + `navLinks`/`tipiUtente`), `landing/**` (4),
  `modals/**` (1), `profile/**` (1) — un componente per file, e i file di un'area nella sua
  sottocartella (i `.tsx` fuori da `components/`/`pages/` sono segnalati come `W-UI`).
- **Legacy in attesa di migrazione**: `CfuTool.tsx` (sostituito da `departments/cfu/`),
  `CvTool.tsx` (candidato a `departments/cv/`).
- **Regola di consumo**: i globali ricevono dati/stato via props o `useApp` e **non** importano
  mai file interni di un dominio (solo entry point pubblici, quando serve).

### 23.3 Confini dei domini (`src/departments/*`, `src/modules/*`)

| Dominio | Entry pubblica | Vietato dall'esterno | Chi lo monta |
|---|---|---|---|
| `radar` | `RadarWizardModal`, `PreferenzeRadar`, `RadarStatusToggle` | `wizard/**`, `preferenze/**`, `flightBoard/**`, `SimulatorRadar`, `valutaConfigurazione` | `App.tsx` (modal), `DashboardPage` |
| `notizie` | `NotizieHero`, `NotizieGrid`, `NotizieDettaglio`, servizi/tipi | `services/**` interni, `data/**` | `NotiziePage`, `NotizieDettaglioPage`, hero dashboard |
| `scadenze` | `RevolverScadenze` (+ `RevolverScadenzeProps`) | `components/**`, `hooks/**`, `engine.ts` | hero di Notizie, dashboard |
| `admin` | `TabUtenti`, `TabRadar`, `TabAccount`, `ADMIN_EMAILS`, `STORAGE_KEY_ADMIN_REDIRECT` | `tabs/**`, `adminService`, `adminUi` | `AdminPage` |
| `cfu` | `CalcolatoreCfuApp`, `CalcolatoreCfuLanding` | `calcolatore/**`, `engine/**`, `dossier/**`, `shared/**` | `CalcolatoreCFUPage`, `CalcolatoreCFUDashboardPage` |
| `modules/modulistica` | `ModuliModule` + tipi | `components/**`, `creator/**`, `hooks/**` | `ModuliPage` |

Verifica automatica di questi confini: `npm run test:architettura` (`E-ENTRY`, `E-DOM`,
`E-STRAT`, `E-ROOT`) con il debito congelato in `scripts/architettura-baseline.json`.

---

## 24. Runbook operativi

### 24.1 Deploy del frontend (Vercel)

0. `npm run test:favicon` → set favicon ufficiale e `index.html` ↔ `public/` coerenti
   (e `git status --short -- index.html public`: **committa** l'HTML e gli asset — un fix
   non committato non entra in produzione, ed è la causa della favicon scura vista fino
   al 2026-09-22);
1. `npm run typecheck` → exit 0;
2. `npm run build` → `dist/` (attesi in radice: `favicon*.png`, `favicon.ico`,
   `apple-touch-icon.png`, `logo.png`);
3. push su `main` → build automatico (rewrite SPA `/(.*) → /index.html` da `vercel.json`);
4. verifica post-deploy: `/`, `/notizie`, `/dashboard/moduli`, `/dashboard/calcolatore-cfu`
   + **hard-reload della scheda**: le favicon sono cache-ate a lungo, se resta quella
   vecchia prova in incognito o svuota la cache del sito.

### 24.2 Migrazioni DB

```bash
supabase migration new <nome_descrittivo>     # crea il file con timestamp
# … scrivi il DDL (seguendo §14.2) …
supabase db push --project-ref gwdmsgsshvdnfrplbjiv
npm run db:verifica && npm run test:migrazioni  # guard di regressione
```

Regole: mai modificare una migrazione già applicata (si aggiunge una nuova); ogni funzione
`security definer` dichiara `set search_path = public`; ogni tabella nuova nasce con RLS
abilitata e con una decisione esplicita ("policy client" oppure "solo service_role").

### 24.3 Deploy di una Edge Function

```bash
supabase secrets set <NOME>=<valore> --project-ref gwdmsgsshvdnfrplbjiv   # se serve
supabase functions deploy <nome> --project-ref gwdmsgsshvdnfrplbjiv
```

Verifica: `HealthCheckModal` nell'app (`services/healthCheck.ts`) e una chiamata reale con
JWT/secret corretto.

### 24.4 Scraper interpelli

```bash
npm run scrape:check          # typecheck della pipeline
npm run scrape -- --dry-run   # nessuna scrittura
npm run scrape                # scrittura + notifiche
```

Diagnostica post-run: `scraper_runs` (esito/errori/telegram_*), poi `npm run board:diag`
(`flightBoard/__tests__/diagnosticaBoard.ts`, sostituisce il vecchio
`diag-flightboard.ts`), `diag-fonti.ts`, `diag-interpelli-multiregione.ts`, `audit-dati.ts`.
Igiene: `npm run dati:pulisci-scaduti` (04:00 UTC dal workflow), `npm run dati:pulisci`.

### 24.5 Notizie (editoriale)

```bash
npm run scrape:notizie:check
npm run scrape:notizie -- --dry-run
npm run scrape:notizie                      # scrive data/notizieIngestite.ts
npm run notizie:ripara-archivio -- --dry    # anteprima della riscrittura dello storico
npm run test:notizie-feed && npm run test:notizie-editoriale
npm run test:notizie-nazionale && npm run test:notizie-rate
```

Se il cron fallisce la settimana: leggere il log dell'ingestione (waterfall dei livelli), poi
`test:notizie-nazionale` per distinguere un problema di policy da un problema di fonti.

### 24.6 Notifiche (digest, promemoria, alert)

```bash
npm run test:notifier-dry            # end-to-end senza effetti collaterali
npm run notifiche:digest             # digest manuale
npm run notifiche:promemoria         # promemoria manuale
npm run admin:dispatch -- <email>    # digest immediato per un singolo utente
npm run test:qualita && npm run test:frequenza && npm run test:dedup:utente
```

In caso di "notifiche ripetute": controllare `notifications_log` + ledger file, poi
`npm run ledger:unisci` (fusione) e `npm run test:ledger`.

### 24.7 Modulistica e PDF

```bash
npm run test:moduli            # integrità del catalogo
npm run test:pdf && npm run test:pdf:brevi && npm run test:pdf:universita && npm run test:pdf:completo
npx tsx scripts/_validate-modulistica.ts
```

### 24.8 Billing & Stripe (passaggio TEST → LIVE)

1. verificare i Price ID nei secret (`STRIPE_PRICE_ID_*`) e in `.env` (`VITE_STRIPE_PRICE_*`);
2. `STRIPE_SECRET_KEY` con prefisso `sk_live_` → `STRIPE_MODE=live` (rilevato automaticamente);
3. firmare il webhook: `STRIPE_WEBHOOK_SECRET` + `WEBHOOK_ENDPOINT`;
4. test: `npm run test:rinnovo-preavvisi` + HealthCheck (`testCheckout`, `testPromoBeta1Anno`);
5. coupon: `REFERRAL_COUPON_ID`, `STRIPE_COUPON_BETA1ANNO`, `STRIPE_COUPON_SCUOLERADAR50`.

---

## 25. Invarianti, glossario e mappa di lettura

### 25.1 Invarianti non negoziabili

1. **Nessun invio senza link diretto e recapito** (`avvisoInviabile`).
2. **Nessuna notifica duplicata** (impronta + frequency cap + ledger).
3. **Nessun dato inventato**: mai placeholder in UI o nei post; la riga si scarta.
4. **Nessun errore silenzioso**: ogni fallimento lascia una traccia (log, `scraper_runs`,
   `admin_telegram_alerts`, exit code).
5. **Nessun segreto nel bundle**: solo `VITE_*` è pubblico; chiavi e token solo server-side.
6. **Un file = una responsabilità** (250/300 righe, gate `test:architettura`).
7. **I domini comunicano solo via `index.ts` / `AppContext`**.
8. **La modalità demo funziona sempre** (nessun backend necessario per navigare l'app).
9. **Il calcolatore CFU non manda nulla in rete senza consenso** (privacy-first, OCR locale).
10. **Ogni modifica alle regole editoriali si riflette sull'archivio** con
    `npm run notizie:ripara-archivio`.

### 25.2 Glossario

| Termine | Significato nel progetto |
|---|---|
| **Avviso / interpello** | Opportunità di lavoro pubblicata da una scuola (record `interpelli`) |
| **PRO** | Piano a pagamento (annuale/mensile) o trial; alias storici: "VIP", "Admin Reale" |
| **BASE / prova** | Piano gratuito: 3 notifiche per anno scolastico + strumenti base |
| **Dipartimento** | Modulo verticale isolato in `src/departments/` (o `src/modules/`) |
| **Flight board / Radar Live** | Vetrina pubblica delle opportunità, con righe mai placeholder |
| **Ledger** | Registro invii (file `.scuoleradar/notifiche-ledger.json` + `notifications_log`) |
| **Frequency cap** | Barriera anti-spam: max 2 invii in 2 giorni diversi per identità/canale |
| **Gate** | Controllo che blocca pubblicazione/invio/merge se non superato |
| **Impronta** | Identità stabile dell'avviso (provincia+scuola+classi normalizzate+titolo) |
| **Scheda avviso** | `/interpello/:id` con gerarchia, guida operativa e un solo link esterno |
| **Sostegno** | Preferenza/filtro per posti di sostegno (`profiles.sostegno`) |
| **Waterfall** | Sequenza dei livelli di raccolta notizie (MIM → GU → ARAN → giurisdizione) |
| **Soft cap / hard cap** | 250 righe (pianificare lo split) / 300 righe (vietato su file nuovi) |

### 25.3 Mappa di lettura (da dove partire)

| Se devi… | Leggi |
|---|---|
| Orientarti nel prodotto | `DEPARTMENT_MAP.md` (§1–§4) |
| Rispettare le regole di codice | `MODULAR_ARCHITECTURE.md` + §1.6 di questo documento |
| Capire il database | §13.11–§13.16 |
| Chiamare correttamente una RPC/Edge | §14, §15 |
| Lavorare sulle notifiche | §6 + §21 |
| Lavorare sulle notizie | §9 + `BLOG_EDITORIAL_GUIDELINES.md` |
| Lavorare su modulistica/PDF | §7 + `PDF_DESIGN_SYSTEM.md` |
| Capire i flussi di fallimento | §22 |
| Fare manutenzione/deploy | §18 + §24 |
| Refactoring strutturale | `STRUCTURAL_AUDIT.md` + §6 di questo documento |

## 26. Correzioni UX, registrazione, coupon e sincronizzazione PRO

**Nota di sessione (24/09/2026)** — intervento mirato su sei punti: copy dei campi,
unificazione della modale di registrazione, parole chiave multiple, coupon unico
SCUOLERADAR50, downgrade senza perdita di dati e cambio account Google. Tutte le
regole sotto sono coperte da guardie nei test di prodotto.

### 26.1 Nessun aiutino paternalistico nei campi di input

I `placeholder` non contengono più esempi fittizi o nomi di persona (`Es. 34`,
`mario.rossi@email.it`, `Mario Rossi`): il campo si spiega con il proprio nome
(`Nome`, `Cognome`, `Età`, `La tua email`, `Il tuo username Telegram, senza @`,
`Codice promo`, `Cerca classe di concorso (codice o materia)`).
Superfici: `AuthModal`, `BloccoAnagrafica`, `DatiProfiloModal`, `onboarding/*`
(`PassoOrdiniOnboarding`, `PassoCanali`, `PassoClassiMaterie`), wizard Radar e Preferenze Radar
(`PassoNotifica`, `PassoProvince`, `PannelloCanali`, `PannelloClassi`,
`PannelloMaterie`, `PannelloFiltriScuole`, `RicercaSelezioni`), `AbbonamentoModal`,
`ContactForm`.
Guardia: `scripts/test-copy-etico.ts` § «Campi di input», che scansiona
`src/components`, `src/pages`, `src/departments/radar`.
**Fuori perimetro dichiarato** (dipartimenti `admin` e `cfu`, regola di isolamento):
restano dei placeholder con esempio in tool interni e nel CFU; si uniformano solo su
richiesta esplicita.
Anche l'identità della simulazione dev (`useStatoSimulato`, solo sviluppo) è **neutra**
(`Utente Demo` / `demo@scuoleradar.it`): nessun nome di persona nemmeno lì (27/09/2026).

### 26.2 Una sola modale di registrazione, proporzionata al viewport

`openAuthModal('registrazione')` è l'UNICO ingresso (vetrina/incognito, dashboard
guest, prezzi, servizio, passo finale del wizard): non esiste un secondo form
«rapido» diverso. `AuthModal` usa `Modal dense` (`max-h-[96vh]`, header e gutter
compatti) e un form a **due colonne da `sm:`** (Nome | Cognome, Sesso, Età |
Provincia, Email, Password, CTA) con etichette `text-xs`: rientra nel viewport senza
zoom ridotto e senza scorrimento verticale forzato. Nessun campo è stato rimosso
(provincia, Telegram, nota istituti scolastici restano attivi).

### 26.3 Parole chiave multiple separate da virgola

`separaParoleChiave()` (`src/lib/ricercaSelezioniRadar.ts`) divide su `,` e `;`,
normalizza gli spazi, scarta le voci vuote e i duplicati (confronto senza
accenti/maiuscole): «Intelligenza artificiale, Didattica digitale, Teatro» produce
**tre** tag indipendenti, mai un'unica stringa incollata. Usato da
`RadarWizardModal`, `PreferenzeRadar` e `OnboardingPage.addCustomMateria`.
`cercaSelezioniRadar` espone ora `paroleChiave: string[]` e la UI propone tutte le
voci con un solo click.

### 26.4 Un solo coupon attivo: SCUOLERADAR50 (RADAR50 rimosso)

L'unico coupon di sconto è **SCUOLERADAR50** (case-insensitive):

| Regola | Implementazione |
|---|---|
| 50% sulla sottoscrizione **annuale** | `SCONTO_SCUOLERADAR50_PERCENTO` + ramo Edge `codiceUpp === 'SCUOLERADAR50'`, ammesso solo su `pro_annuale` |
| **Monouso per email** | `valida_coupon_scuoleradar50(uuid)`: una riga per utente in `coupon_usage` + anti-replay su email, email di notifica e Telegram ID |
| **40 giorni** dalla registrazione iniziale | finestra dinamica `auth.users.created_at + interval '40 days'` (la data che attiva il mese PRO gratuito) |
| Case-insensitive | `normalizzaCodicePromo()` (client) ≡ `toUpperCase().replace(/[^A-Z0-9]/g,'')` (Edge) |

`RADAR50` è eliminato da `promo_codes`, le funzioni `valida_coupon_radar50` /
`registra_uso_coupon_radar50` sono droppate e nessun ramo applicativo lo accetta più.
Il consumo è registrato dal webhook (`registra_uso_coupon_scuoleradar50`) solo a
pagamento riuscito. Migrazione:
`supabase/migrations/20260924120000_coupon_scuoleradar50_unico.sql` — **da applicare**
su Supabase insieme al deploy delle Edge `checkout`/`webhook`; secret Stripe
`STRIPE_COUPON_SCUOLERADAR50` (fallback accettato `STRIPE_COUPON_RADAR50`).
Guardia: `npm run test:checkout-promo` § 7.

### 26.5 Downgrade: i tetti limitano l'USO, non distruggono i dati

Un passaggio (o un riconoscimento) a piano Base NON tronca più le province e le
classi salvate durante la prova PRO:

- `usePreferenzeUtente` non riscrive le preferenze: registra solo un avviso;
- wizard e Preferenze persistono la selezione **integrale** (nessun troncamento in
  salvataggio o in prefill);
- i tetti del piano confermato si applicano al momento dell'**uso**:
  `useInterpelliFeed` usa `limitaSelezione(preferenze.provinceCodici, tetti?.province)`
  per query e filtri, così l'ex PRO non riceve avvisi fuori piano ma conserva tutto;
- la provincia **principale** resta la prima dell'elenco e le voci oltre il tetto
  restano **visibili** e marcate `PRO` in `ProvinciaPill` / `PannelloProvince` /
  `PassoProvince` («restano salvate: si attivano con il piano PRO»).

La stessa regola vale per **caricamenti, refresh e profilo in ritardo** (niente
default vuoto scritto sopra le preferenze):

- ogni azione dell'utente nel pannello `PreferenzeRadar` **marca il campo che
  modifica** (`segnaToccato('classiCodici' | 'provinceCodici' | …)`), e l'autosave
  salva **solo i campi toccati** (`modificheDaSalvare` in
  `src/lib/preferenzeGuardia.ts`): aprire la pagina, un refresh o il bootstrap del
  profilo non possono più svuotare classi, province, competenze, tag o scuole;
- l'idratazione dal DB è **per campo** e salta quelli già toccati
  (`idrataDaProfilo`: il DB vince solo se ha davvero un valore; `[]`/`null` non
  azzerano la scelta locale);
- le preferenze non toccate restano quelle del contesto (nessuna scrittura
  ridondante: se il campo toccato è identico al salvato, l'autosave non parte).

Reintegrato il PRO, l'intera selezione torna attiva senza reinserimenti.
Guardie: `npm run test:province` · `npm run test:persistenza:preferenze` ·
`npm run test:radar:preferenze`.

### 26.6 Cambio account Google e sincronizzazione sessione/anagrafica

`loginConGoogle` chiude la sessione precedente **prima** di avviare l'OAuth
(`signOut({ scope: 'local' })` + azzeramento dello stato locale condiviso con
`logout`, incluso `sr_user` e la bozza del wizard): passare da un account Google a un
altro richiede **un solo click**, senza sessione vecchia riproposta.
Al cambio identità (`pianoSessionUserIdRef` → nuovo `idSessione`) il listener
`useAuthSync` azzera i soli campi anagrafici locali (`genere`, `eta`, `provincia`) e
solo per uno switch **reale**: sesso, età e provincia dell'utente precedente non
compaiono mai nel nuovo account, mentre una prima registrazione conserva i dati

### 26.7 Homepage: Radar Live subito, offerta PRO in tono elite

**Nota di sessione (27/09/2026)** — riordino della vetrina pubblica e pulizia del copy.
> Aggiornamento dello stesso giorno: la hero è tornata a **due colonne** con il box
> «Prova il Radar» (§26.8), la **registrazione rapida** è subito sotto l'hero e l'**offerta
> PRO è salita prima di «Cosa riceverai»**: la tabella qui sotto è **superata** — per
> l'ordine attuale vedi §26.9.
> **Aggiornamento (27/09/2026, sesto intervento)**: il box «Prova il Radar» si usa con la
> **sola provincia** (niente classe di concorso), l'offerta PRO mostra **solo tre benefici**
> senza link «Confronta i piani» né copy difensivo e il form rapido apre la **configurazione
> del Radar** già compilata: vedi §26.12.

**Ordine dei contenuti** (`pages/LandingPage.tsx`):

| # | Sezione | Ruolo |
|---|---|---|
| 1 | `LandingHero` | Promessa + CTA. Due colonne con il box «Prova il Radar» a destra (§26.8) |
| 2 | `LandingRegistrazioneRapida` | Nome, Cognome ed Email in un passaggio (solo visitatori) |
| 3 | `FlightBoardInterpelli` | **«Radar Live» — primo contenuto dopo l'hero** (flag `radar`) |
| 4 | `LandingOffertaPro` | Offerta PRO: 30 giorni inclusi, PureFocus incluso, poi 49 €/anno — **prima** di «Cosa riceverai» |
| 5 | `LandingBenefici` | «Ecco cosa riceverai» |
| 6 | Spiegazione piani + valori | «Come funziona» (3 step) e i tre valori |
| 7 | `LandingStrumenti` | Griglia strumenti (filtrata dalle feature flag) |
| 8 | `LandingPartnerPureFocus` | Fascia sponsor PureFocus alla larghezza dei piani (stato PRO a prop) |
| 9 | Stats + `LandingCta` | Numeri di servizio e CTA finale |
| — | ~~`LandingProvaRadar`~~ | **Rimosso**: il simulatore è nel box «Prova il Radar» della hero (§26.8) |

**Offerta PRO.** `LandingOffertaPro` non contiene cifre a mano: importa
`GIORNI_TRIAL_PRO` e `PREZZO_PRO_ANNUO_ETICHETTA` da `src/lib/pricing.ts`, così la
vetrina non può divergere dal listino. Descrive il comportamento reale dei piani
(alert in tempo reale su Telegram; l'email resta una al giorno), PureFocus PRO
incluso (29 $/anno, nessun costo aggiuntivo) e la fine del periodo con la formula
ammessa «Alla scadenza torni su Base, senza costi». Nessun countdown, nessun
«prezzo che cambia»: la prova è la stessa per tutti tutto l'anno.

**Copy ripulito** (vocabolario approvato `Prova Inclusa` / `Incluso nell'Offerta`):

| Superficie | Prima | Ora |
|---|---|---|
| `index.html` | «La piattaforma per gli Scuolatori» | «Il Radar degli interpelli nella scuola» + 30 giorni di PRO, PureFocus incluso, poi 49 €/anno |
| `ChiSiamoPage` | «1 mese di PRO gratuito, senza carta di credito» | «Prova Inclusa: 30 giorni di PRO con PureFocus incluso» |
| `PrezziPage` (piano Base) | «1 mese di prova gratuito» | «solo nella prova inclusa, 1 mese» |
| `PureFocusPage` | «INCLUSO GRATUITAMENTE» | «INCLUSO NELL'OFFERTA» |
| `AssistenteAIPage` | «scuolatori … in anteprima» | «numero limitato di colleghi» |

**Guardia.** `scripts/test-copy-etico.ts` → sezione «Landing: Radar Live in testa,
offerta PRO senza toni da televendita»: nessun termine da volantino né parola di
pagamento sulle superfici della homepage (`src/pages/LandingPage.tsx` +
`src/components/landing/**`), cifre dell'offerta da `pricing.ts`, ordine
hero → Radar Live, hero a due colonne col simulatore (§26.8), titolo senza `<br>` e
spacing compatto, e nessun «prova gratuita/o» nelle pagine pubbliche. La forbice è
volutamente **per superficie**: le superfici di prodotto (banner di registrazione,
benvenuto PRO) mantengono la dicitura ammessa dalla checklist pagamenti, mentre la
landing usa il vocabolario stretto.
`scripts/test-copy-pubblico.ts` (sezione «Copy pubblico», §26.8) copre invece regalo
di benvenuto PRO, wordmark PureFocus, Chi siamo e FAQ.
**Aggiornamento (28/09/2026, nono intervento)**: i controlli di **layout del primo schermo**
(hero a due righe con `span block`, colonne allineate in altezza, responso a scorrimento,
nessun riquadro ridondante prima dell'offerta) vivono in
`scripts/test-copy-primo-schermo.ts` (`npm run test:copy:schermo`): `test-copy-etico.ts` era
arrivato a **259 righe**, sopra la soglia strutturale di 250. Vedi §26.15.

**Nota operativa.** `scripts/_assistente-cleanup.mjs` (patch una-tantum sulla riga 66 di
`AssistenteAIPage`) è stato **eliminato** il 27/09/2026: l'intervento è esaurito e lo script
era ormai disallineato.

### 26.8 Finitura homepage, wizard e vetrine (hero a due colonne, PureFocus, FAQ)

**Nota di sessione (27/09/2026, secondo intervento)** — impatto visivo e commerciale
delle superfici pubbliche, con i flussi di registrazione alleggeriti dalle domande
personali in apertura.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Hero a due colonne** | `LandingHero`: copy + CTA a sinistra, box **«Prova il Radar»** (`SimulatorRadar`) a destra. Il titolo non ha più `<br>` forzati («Ogni giorno decine di opportunità. Noi intercettiamo solo quelle per te.» scorre in linea) e gli spazi sono compatti (`pt-6` / `pb-8`). `LandingProvaRadar` è stato **eliminato** (nessuna sezione duplicata) |
| 2 | **Regalo PRO non rifiutabile** | `SoftOnboardingModal`: titolo «**Buone notizie**», corpo asciutto, **un solo pulsante** d'azione (la X resta per non intrappolare); `BenvenutoProRadar` perde il rinvio «Più tardi». Entrambi usano `GIORNI_TRIAL_PRO` |
| 3 | **Anagrafica a fine percorso** | wizard Radar: `BloccoAnagrafica` spostato dal Passo 1 al **Passo 4** (`PassoNotifica`, in fondo); l'onboarding post-registrazione sposta genere/età dal Passo 1 (`PassoOrdiniOnboarding`, ex `PassoAnagraficaOrdini`) al **Passo 4** (`PassoCanali`). Via i testi paternalistici e le istruzioni su cosa scrivere nei campi |
| 4 | **Passo 3 più utile** | rimossa la domanda sul **sostegno** (`SezioneClassiConcorso`, preferenza preservata e modificabile solo dalle Preferenze Radar); aggiunto nella colonna competenze un **campo di ricerca per parola chiave/competenza libera** (`SezioneCompetenzeExtra` → `aggiungiParolaChiave`) |
| 5 | **Passo 4 autorevole** | `PassoNotifica`: Telegram = canale immediato con la massima potenza di fuoco, email = **riepilogo giornaliero**; niente «(`consigliato`)», niente notazione algebrica, niente suggerimenti su cosa scrivere; l'account non è mai etichettato «Base» |
| 6 | **PureFocus** | nuova vetrina condivisa `src/components/PureFocusCard.tsx`: **wordmark ufficiale** (Pure `#0E0C0A` + Focus `#0047AB`, sans-serif, senza spazi) al posto dell'emoji-icona, badge verde «**Incluso nel piano PRO**», link in evidenza a **purefocus.one**. Usata da homepage, `/prezzi` e `/dashboard/purefocus` (coordinamento da un'unica fonte) |
| 7 | **Chi siamo & FAQ** | `ChiSiamoPage`: CTA «**Attiva il tuo radar**», rimosso il rimando difensivo alla Carta del Docente. `FAQPage` riscritta come **posizionamento**: come inserire ScuoleRadar tra le app attendibili della scuola (`#animatore-digitale`, ancora pubblica), «Invita un Collega», PureFocus con l'account Gmail, in arrivo l'**Assistente Sindacalista Virtuale** e la **Carta del Docente** |
| 8 | **Marchio** | `Header`: lockup pulito **tessera ufficiale + wordmark «ScuoleRadar.it» in testo** (asset di build `src/assets/marchio-radar.png`, identico al favicon) — niente logo-immagine rimpicciolito, quindi niente effetto «template»; `useStatoSimulato` usa un'identità demo neutra |

**Guardie.** `npm run test:copy:etico` (hero/Passo 4/wizard), `npm run test:copy:pubblico`
(regalo PRO, PureFocus, Chi siamo, FAQ), `npm run test:ricerca` (campo parola chiave nella
colonna competenze senza ricerca duplicata), `npm run test:favicon` (il marchio dell'header è
la **tessera ufficiale**, stesso file del favicon 256: nessun ritorno al logo-immagine).

**Sessione e cambio account.** Al passaggio a un altro account sullo stesso
dispositivo (es. Google Bartolo → Pralino) si azzerano i **soli** campi anagrafici
in `sr_preferenze` (`genere`, `eta`, `provincia`), perché appartengono all'utente
precedente; una **prima** registrazione invece conserva i dati appena inseriti (la
fonte autorevole resta `profiles`).
Guardia: `npm run test:sessione`.

### 26.9 Motore del Radar di prova, sostegno incluso di default, offerta in testa

**Nota di sessione (27/09/2026, terzo intervento)** — finitura del Radar di prova,
eliminazione dei filtri silenziosi sugli avvisi di sostegno e conversione in testa
alla homepage.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Radar di prova a maglie larghe** | nuovo motore **puro** `src/lib/provaRadarEngine.ts`: pertinenti per classe (codice di concorso o materia citata nel titolo) → tutte le opportunità **ATTIVE** della provincia (supplenze, PON/POR, CPIA, ATA, date estese) → **pool nazionale** come ultimo ripiego; le scadute escono, le voci senza scadenza restano. Il responso non è mai vuoto se la provincia ha flusso (`{ gruppo: classe/provincia/nazionale/vuoto, righe }`) |
| 2 | **Provincia provata = provincia principale** | nuovo `src/lib/provaRadar.ts` (localStorage, validato sul catalogo `data/province`): la provincia scelta nel box «Prova il Radar» arriva **pre-selezionata** come provincia principale nel wizard Radar e nell'onboarding post-registrazione (`provinceInizialiConProva`), senza richieste duplicate |
| 3 | **Responso senza scroll** | `SimulatorRadar` più largo (`max-w-*` ottimizzato): il responso entra in una schermata a zoom 100% senza scroll verticale. Per il gate strutturale (≤ 300 righe) la query è in `departments/radar/services/provaRadarQuery.ts` (limiti 200 provincia / 60 nazionale, attesa scansione 900 ms) e il responso in `departments/radar/components/ResponsoProva.tsx` (presentazionale) |
| 4 | **Sostegno incluso di default** | `defaultPreferenze.sostegno = true` + migrazione `20260927120000_default_sostegno_incluso.sql` (§2.15): nessun avviso AD… più filtrato in silenzio. `SostegnoToggle` («**Opportunità di sostegno**», Incluse/Escluse) resta l'**uscita esplicita** nelle Preferenze Radar, con la nota sull'adesione implicita via classe `AD*` *(superato il 04/10/2026 — §26.45: inclusione PERMANENTE, nessun interruttore né opt-out)* |
| 5 | **Offerta PRO prima di «Cosa riceverai»** | `LandingOffertaPro` sale al 4° posto della homepage (subito dopo «Radar Live») con la formulazione diretta — «Siamo così sicuri che Scuole Radar ti piacerà che ti offriamo il primo mese PRO. E se poi non vuoi abbonarti, passi semplicemente a un account Base, senza costi» — e le cifre da `lib/pricing` (`GIORNI_TRIAL_PRO`, `PREZZO_PRO_ANNUO_ETICHETTA`) |
| 6 | **Registrazione rapida sotto l'hero** | nuovo `src/components/landing/LandingRegistrazioneRapida.tsx` (Nome, Cognome, Email + CTA «Attiva il Radar»): i dati finiscono nella **bozza** di registrazione e la modale si apre precompilata — un solo passaggio, nessun doppione di modali (solo per i visitatori) |
| 7 | **FAQ commerciali coerenti** | l'Assistente Sindacalista Virtuale è descritto per lo stato REALE (`AssistenteAIPage` = **accesso in anteprima**): non più «lo trovi dal primo giorno»; `/prezzi` e `/faq` dicono la stessa cosa («in anteprima, riservata agli abbonati PRO») |
| 8 | **Pulizia** | `scripts/_assistente-cleanup.mjs` **eliminato** (patch esaurita); `useStatoSimulato` con identità demo neutra (nessun «Mario Rossi»); marchio dell'header = **tessera ufficiale**, lo stesso file del favicon (§26.8) |
| 9 | **Guardia riallineata** | `scripts/test-piano-sync.ts` (passo finale del wizard, §26.8): i due assert sul Passo 4 verificano ora la copy autorevole corrente («Telegram — avvisi istantanei», «Email — riepilogo giornaliero» / «non arrivano gli avvisi in tempo reale») al posto delle formule superate — `npm run test:piano` di nuovo verde |

**Guardie.** `npm run test:prova-radar` (motore + memoria della provincia + cablaggio
hero/wizard), `npm run test:copy:etico` (hero a due colonne `lg:grid-cols-[minmax(0,1fr)_34rem]`,
offerta senza toni da televendita), `npm run test:copy:pubblico` (registrazione rapida,
wordmark PureFocus, Chi siamo, FAQ, sostegno incluso), `npm run test:sostegno` +
`npm run test:migrazioni` (default `true` con backfill), `npm run test:ricerca`
(parola chiave nella colonna competenze), `npm run test:piano` (passo finale del
wizard), `npm run test:favicon` (tessera ufficiale) e `npm run test:architettura`
(i file nuovi restano sotto le 300 righe).

### 26.10 Finitura commerciale della prova e della registrazione

**Nota di sessione (27/09/2026, quarto intervento)** — la prova pubblica deve stare in
un solo schermo, non deve **mai** dichiarare «zero risultati» a una provincia che ha
flusso, e la registrazione non chiede più dati personali.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Box di prova più largo e più pulito** | `LandingHero`: la colonna del simulatore passa a **34rem** (`lg:grid-cols-[minmax(0,1fr)_34rem]`) e resta **una sola** riga di istruzioni («Nessuna registrazione: scegli provincia e classe di concorso e guarda cosa il Radar trova in questo momento»): il titolo doppio «Prova il Radar» è rimosso, così il responso entra nel primo schermo a zoom 100% |
| 2 | **Pool vivo lato database** | `departments/radar/services/provaRadarQuery.ts`: la lettura filtra gli scaduti con `.or(expiration_date.gte.<ieri>, expiration_date.is.null)`. Con l'ordinamento per scadenza **crescente**, gli avvisi scaduti occupavano il tetto di 200 righe e una provincia con flusso pieno dichiarava «zero risultati» (falso negativo). Il filtro per **giornata esatta** resta di `righeAttive` (`lib/provaRadarEngine`), che tiene anche le righe senza data |
| 3 | **Responso compatto** | `departments/radar/components/ResponsoProva.tsx`: spaziature ridotte (`mt-2.5`/`mt-3`, `p-3.5`, `py-1.5`, `space-y-1`, CTA `py-2`) — nessuno scroll verticale dentro il box |
| 4 | **Registrazione senza domande personali** | `AuthModal`: rimossi `Sesso` ed `Età` dal modulo (griglia Uomo/Donna e campo numerico); al loro posto la nota «Genere ed età li raccogliamo alla fine del percorso, insieme al resto del profilo: qui bastano la provincia di residenza e la password». Genere ed età si raccolgono **solo** a fine percorso (`BloccoAnagrafica` al Passo 4, §26.8) e la modale di registrazione si apre già precompilata da nome, cognome, email e provincia della bozza (`LandingRegistrazioneRapida`) |
| 5 | **Copy del simulatore** | `SimulatorRadar`: categorie dichiarate ad alta voce — «interpelli e supplenze, PON/POR e PNRR, CPIA, ATA e bidelli, selezioni di esperti» — coerenti con il motore a maglie larghe (§26.9, passo 1) |

**Guardie.** `npm run test:prova-radar` (box a 34rem con una sola riga di istruzioni,
responso compatto, pool del simulatore solo di avvisi **vivi** con `LIMITE_PROVINCIA = 200`,
categorie «ATA e bidelli», memoria della provincia e cablaggio wizard/onboarding),
`npm run test:copy:etico` (genere ed età **solo** a fine percorso, campi di registrazione
senza età, hero a 34rem).

**Verifiche (27/09/2026).** `npm run typecheck` ✓ · `npm test` ✓ (catena completa, nessun
fallimento) · `npm run test:architettura` ✓ (nessuna violazione nuova: 142 in baseline) ·
`npm run build` ✓ (15,14 s) · `npm run lint` pulito sui file toccati (`AuthModal`,
`LandingHero`, `ResponsoProva`, `provaRadarQuery`, `SimulatorRadar`, `LandingPage`).

### 26.11 Motore editoriale Notizie a 360° (allow-list dei temi e lessico condiviso)

**Nota di sessione (27/09/2026, quinto intervento)** — il motore delle Notizie non
conosceva la scuola oltre l'interpello: personale ATA e segreterie, DSGA, istruzione
adulti (CPIA), sostegno, TFA e classi di concorso, immissioni in ruolo. Il vocabolario e
lo scoring vivono ora in un **blocco condiviso** e la categoria nasce SOLO da un tema
ammesso, in ordine di priorità.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Blocco editoriale condiviso** | Nuovi moduli in `src/departments/notizie/services/`: `standardTemiPersonale.ts` (temi del personale: parole-chiave, macro-area, peso, flag `autosufficiente`), `standardTemiDidattica.ts` (temi culturali/didattici), `editorialStandard.ts` (unisce in `TEMI_OPERATIVI`, espone `AREE_TEMATICHE`, `PESI_CATEGORIA`, `CATEGORIE_CON_FATTO_CONCRETO`, `temiDalTesto`, `areeTematicheDalTesto`), `lessicoScuola.ts` (lessico, acronimi, frasi di fluff, `PAROLE_OPERATIVE`) |
| 2 | **Allow-list unica, ordine = priorità** | `classificaTemaPersonale` scorre `TEMI_OPERATIVI` (da CCNL a Pedagogia) e restituisce il primo tema riconosciuto; `PAROLE_CATEGORIA` e le liste duplicate dentro il motore sono rimosse |
| 3 | **Scoring su matrice unica** | `punteggioRilevanza(categoria, haScadenza)` legge `PESI_CATEGORIA` (base per tema, bonus scadenza, tetto 100): pesi e punteggi non possono più divergere |
| 4 | **Fatto concreto** | `valutaRilevanza` respinge i temi culturali/didattici senza scadenza reale né canale ufficiale, con motivo tracciabile (il «seminario pedagogico» non diventa notizia) |
| 5 | **Compatibilità** | `relevanceEngine.ts` ri-esporta `PAROLE_ACCETTA` (alias di `PAROLE_OPERATIVE`), `GLOSSARIO_ACRONIMI` e `FRASI_FLUFF`: copy, igiene dell'archivio e documentazione restano validi; `PAROLE_FORTI_INIZIO_ANNO` resta il vocabolario storico dell'avvio anno |

**Guardie.** `npm run test:notizie-editoriale` copre anche: ordine e macro-aree
dell'allow-list, equipollenza peso/tema ↔ `PESI_CATEGORIA`, temi ATA/CPIA/sostegno/
formazione/reclutamento, tetto e bonus di `punteggioRilevanza`, il gate del fatto
concreto (didattica e pedagogia respinte senza scadenza/canale, ammesse con), l'alias
`PAROLE_ACCETTA` senza duplicati e l'audit multi-tema (`temiDalTesto`).

**Verifiche (27/09/2026, quinto intervento).** `npm run typecheck` ✓ · `npm test` ✓ (catena
completa: 13 suite, nessun fallimento) · `npm run
test:notizie-editoriale` ✓ · `npm run test:notizie-nazionale` ✓ · `npm run
test:notizie-feed` ✓ · `npm run test:notizie-rate` ✓ · `npm run test:architettura` ✓
(nessuna violazione nuova: 143 in baseline) · `npm run build` ✓ (11,49 s) · `npm run
lint` pulito sui file toccati (`relevanceEngine`, `lessicoScuola`, `editorialStandard`,
`scripts/test-notizie-editoriale`).

### 26.12 Prova del Radar a sola provincia, conversione della homepage e benvenuto di fine flusso

**Nota di sessione (27/09/2026, sesto intervento)** — la prova pubblica non chiede più la
classe di concorso: si sceglie la provincia e il Radar restituisce **sempre** un elenco reale e
ricco; la homepage chiude la conversione senza frasi difensive né vie d'uscita e il form rapido
apre la configurazione con i dati già dentro.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Box di prova a sola provincia** | `SimulatorRadar`: rimosso il selettore «Classe di concorso» (con l'import `classiConcorso`); la CTA «Cerca ora» si abilita con la sola provincia (`disabled={!provCodice}`). `LandingHero`: rimossa la riga difensiva «Nessuna registrazione: scegli provincia e classe di concorso…» — sopra il box non resta più nessun testo |
| 2 | **Elenco sempre ricco** | `lib/provaRadarEngine.ts`: `selezionaRisultatiProva(provincia, nazionali, limite)` porta TUTTE le opportunità attive della provincia e, se non bastano a riempire l'elenco, le completa con il pool nazionale **senza duplicati** (dedup per `id`); `daProvincia` dichiara quante righe mostrate sono locali. Rimossi `rigaPertinente`, `selezionaRisultatiNazionali` e il gruppo `'classe'`. La query nazionale parte **solo** se la provincia ha meno di `LIMITE_RISULTATI_PROVA` righe |
| 3 | **Messaggio di conversione esatto** | Sotto l'elenco c'è sempre lo stesso testo (`messaggioConversione`): «Abbiamo trovato [X] opportunità attive oggi su [Città]. Attiva ora il tuo radar personalizzato. Ti offriamo un mese PRO con notifiche Telegram in tempo reale e un'email di riepilogo ogni giorno alle 17.00» — con varianti oneste per elenco misto («di cui N su [Città]») e provincia ferma («in Italia»); nessun avviso vivo → `messaggioRadarInScansione`, mai «zero risultati». CTA unica «Attiva il tuo Radar» |
| 4 | **Offerta PRO: tre blocchi, nessuna via d'uscita** | `LandingOffertaPro`: i punti sono SOLO «Avvisi Telegram in tempo reale», «Email riepilogativa tutti i giorni alle 17.00», «PureFocus incluso nel piano PRO»; rimossi il link «Confronta i piani» e la frase difensiva («Siamo così sicuri… passi semplicemente a un account Base, senza costi» → «Un mese intero di PRO offerto da noi…»). La riga di servizio con importo/rinnovo/disdetta è stata rimossa nell'intervento successivo (§26.13) |
| 5 | **Etichette e sezioni della homepage** | `LandingPage`: primo passo di «Come funziona» = **«Imposta il tuo Radar»**; `LandingBenefici`: «Inserisci quello che ti interessa e vedrai solo le opportunità di lavoro nella scuola inerenti al tuo profilo»; `LandingStrumenti`: card **centrate** (flex-wrap `justify-center`, non più griglia a 3 colonne con due soli strumenti visibili) |
| 6 | **Form rapido → configurazione** | `LandingRegistrazioneRapida`: CTA «Attiva il tuo Radar»; i tre campi vanno nella bozza (`lib/bozzaRegistrazione.ts`) e `handleRegistrazioneRapida` (`LandingPage`) apre `openRadarSetup()` — la modale di onboarding/configurazione trova nome, cognome ed **email di notifica** già compilati (`RadarWizardModal`: `preferenze.emailNotifica \|\| bozza?.email \|\| user?.email`) |
| 7 | **Schermata di benvenuto di fine flusso** | `RadarWizardModal`, fase `done`: riquadro d'impatto con il testo esatto `BENVENUTO_FINE_FLUSSO` — «Buone notizie! Ti offriamo noi il primo mese PRO con Scuole Radar! Il tuo Radar Personalizzato è attivo, sfruttalo!» — su una riga sola, così il gate di copy lo verifica come stringa letterale |

**Guardie.** `npm run test:prova-radar` (motore a sola provincia, completamento nazionale senza
duplicati, messaggio di conversione con conteggio e provenienza, nessun selettore di classe nel
simulatore, hero senza frase difensiva, eredità della provincia nel wizard, anagrafica/email
precompilate, schermata di benvenuto con il testo esatto); `npm run test:copy:etico` (offerta PRO
senza copy difensivo e senza link ad altri piani, esattamente **tre** blocchi); `npm run
test:copy:pubblico` (form rapido → configurazione del Radar, etichetta «Imposta il tuo Radar»,
copy di «Cosa riceverai», card strumenti centrate).

**Verifiche (27/09/2026, sesto intervento).** `npm run typecheck` ✓ · `npm test` ✓ (catena
completa, nessun fallimento) · `npm run test:prova-radar` ✓ · `npm run test:copy:etico` ✓ ·
`npm run test:copy:pubblico` ✓ · `npm run test:architettura` ✓ (nessuna violazione nuova: 143 in
baseline) · `npm run build` ✓ (8,31 s) · `npm run lint` pulito sui file toccati
(`provaRadarEngine`, `SimulatorRadar`, `ResponsoProva`, `RadarWizardModal`, `LandingHero`,
`LandingOffertaPro`, `LandingStrumenti`, `LandingBenefici`, `LandingRegistrazioneRapida`,
`LandingPage`, `scripts/test-prova-radar`, `scripts/test-copy-etico`, `scripts/test-copy-pubblico`).
Debito noto **non** toccato: 43 problemi ESLint su file estranei a questo intervento.

> **Esito (direttiva del cliente, 27/09/2026).** La riga di servizio è stata **rimossa
> completamente** dalla sezione: la vetrina PRO è ora solo-benefici, mentre prezzo,
> rinnovo automatico e disdetta restano dichiarati in `/prezzi`, nelle FAQ e nel passo di
> pagamento. Regola e guardie aggiornate: checklist `05_abbonamenti_pagamenti` §3 e
> `npm run test:copy:etico` — vedi §26.13.

### 26.13 Offerta PRO solo-benefici: via importi, rinnovo e disdetta dalla homepage

**Nota di sessione (27/09/2026, settimo intervento)** — la sezione PRO della homepage chiude
la conversione con TRE colonne e basta: nessun importo, nessun addebito ricorrente, nessuna
via d'uscita.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Riga di servizio rimossa** | `LandingOffertaPro`: eliminata la riga in coda «PRO: rinnovo automatico di 49 €/anno, disdici quando vuoi. La prova termina senza costi.» e l'import ormai inutile `PREZZO_PRO_ANNUO_ETICHETTA` (resta `GIORNI_TRIAL_PRO` per il titolo «30 giorni di PRO, tutto incluso»). Nel file non esistono più occorrenze di `/€/`, «rinnovo», «disdici», «torni su Base», «quota annuale», `PREZZO_PRO` — **commenti inclusi** (la guardia è volutamente severa) |
| 2 | **Dove vive la dichiarazione commerciale** | Prezzo, condizioni di proseguimento e disdetta restano dichiarati **fuori** dalla sezione di conversione: `/prezzi` (colonne piani + FAQ «Il PRO annuale costa 49 €/anno (circa 4 € al mese) e si disdice quando vuoi»), FAQ pubbliche («Nulla di automatico: la prova è di 30 giorni di PRO, non un abbonamento nascosto…») e **passo di pagamento** (`AbbonamentoModal`: «Rinnovo automatico trasparente, disdicibile in qualsiasi momento dal tuo profilo»). `PREZZO_PRO_ANNUO_ETICHETTA` resta in `src/lib/pricing.ts` come etichetta condivisa del listino (nessun consumatore in `src/` dopo la rimozione) |
| 3 | **Guardie aggiornate** | `test-copy:etico`: la sezione deve avere esattamente i tre blocchi (`titolo:` ×3), nessun `<Link` / `to="/prezzi"` e **zero** occorrenze di importi o condizioni contrattuali; sostituita la vecchia asserzione che pretendeva la formula «Alla scadenza torni su Base, senza costi». Checklist `05_abbonamenti_pagamenti` §3 aggiornata: la vetrina PRO è **solo-benefici** e la dichiarazione di rinnovo/disdetta vive fuori dalla sezione |

**Confine aggiornato (28/09/2026, nono intervento).** La sezione resta **senza importi**: la
dichiarazione dell'offerta di continuazione (primo anno a `PREZZO_PRO_ANNO_DOPO_OMAGGIO_ETICHETTA`
invece del listino) vive **solo** nel benvenuto di fine flusso (`BenvenutoProRadar`, con il mese
in omaggio attivo) — vedi §26.15.

**Verifiche (27/09/2026, settimo intervento).** `npm run test:copy:etico` ✓ · `npm run
test:copy:pubblico` ✓ · `npm run test:prova-radar` ✓ · `npm run typecheck` ✓ · `npm test` ✓
(catena completa) · `npm run test:architettura` ✓ (nessuna violazione nuova: 143 in baseline) ·
`npm run build` ✓ (6,36 s) · `npm run lint` pulito sui file toccati (`LandingOffertaPro`,
`scripts/test-copy-etico`). Debito noto **non** toccato: 43 problemi ESLint (22 errori, 21
warning) su file estranei a questo intervento.

### 26.14 Passo 4 «in chiaro»: il Radar dichiara cosa cerca e cosa arriva

**Nota di sessione (28/09/2026, ottavo intervento)** — chiusura dell'ondata di cinque
correzioni UX/copy; qui è documentato il blocco di **trasparenza** del passo finale del
wizard Radar (le altre correzioni dell'ondata — sostegno bloccato su ON e le **due
etichette di fonte** per superficie — restano tracciate dal diff dei rispettivi moduli).
Il passo finale non chiede più soltanto i canali: **dichiara** che cosa cerca il Radar e
che cosa arriverà, con i dati reali appena scelti dall'utente.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Blocco nuovo, in testa al Passo 4** | nuova `src/departments/radar/wizard/components/SezioneTrasparenza.tsx` («**Cosa fa il tuo Radar, in chiaro**», icona `ShieldCheck`), montata da `PassoNotifica` con `<SezioneTrasparenza selezione={trasparenza} />` e alimentata **viva** dal contenitore (`RadarWizardModal`: `trasparenza={{ provinceCodici, classiCodici, materieId, materieCustom }}`) — mai un esempio, mai una copia della bozza |
| 2 | **Dati reali dai cataloghi condivisi** | province da `src/data/province` (si mostrano i **nomi**, non i codici), classi di concorso con l'etichetta canonica `etichettaClasseMateria`, competenze dai tag di `src/data/ordiniMaterie` + **parole chiave libere**. Le liste lunghe si accorciano a `MAX_ETICHETTE = 4` voci e si chiudono con «**e N altra/e**»; singolare e plurale corretti («1 provincia» / «2 province») |
| 3 | **Regole di consegna ancorate al motore** | Telegram = avviso immediato quando la scuola pubblica; email = **una sola consegna al giorno** e **solo se ci sono opportunità nuove**; al massimo **`MAX_INVII_OPPORTUNITA`** invii per la stessa opportunità (importato da `@/lib/frequenzaNotifiche`: mai un numero scritto a mano nel copy) e sempre il link all'**annuncio ufficiale della scuola** |
| 4 | **Stato incompleto dichiarato, non nascosto** | il blocco si disegna **sempre** (la `<ul>` di riserva esiste anche vuota, così il layout non salta): con profilo vuoto spiega che «mancano i due dati che accendono la ricerca» e le regole di consegna restano comunque visibili; nessuna riga di competenze vuota |
| 5 | **Guardia dedicata** | nuovo `src/departments/radar/wizard/__tests__/trasparenzaPasso4.test.ts` — **19 controlli** su **render reale** (`react-dom/server`) con selezioni vere dei cataloghi + 4 controlli di **cablaggio** (il Passo 4 monta il blocco, il contenitore passa i dati vivi, le etichette arrivano dai cataloghi, zero dati di esempio nel sorgente). Comando `npm run test:trasparenza`, inserito in `npm test` subito dopo `test:copy:pubblico` |

**Perché sta qui e non nelle guardie di copy generali.** Il controllo vive **dentro il
dipartimento** (`wizard/__tests__/`) perché il gate di architettura vieta ai file in
`scripts/` di importare i sorgenti dei dipartimenti se non via `index.ts`
(**`E-DOM`**: «si importa solo `src/…/<dominio>/index.ts`»): un test in `scripts/` non
può rendere `SezioneTrasparenza` senza forzare la superficie pubblica. Niente gate duplicati in `scripts/test-copy-etico.ts` o
`scripts/test-piano-sync.ts`: quei file restano **identici** a `HEAD` (una sola fonte di
verità per il blocco).

**Verifiche (28/09/2026, ottavo intervento).** `npm run test:trasparenza` ✓ (19/19) ·
`npm run typecheck` ✓ · `npx eslint` **0 problemi** sui 6 file toccati (`SezioneTrasparenza`,
`PassoNotifica`, `RadarWizardModal`, il test nuovo, `scripts/test-copy-etico`,
`scripts/test-piano-sync`) · `npm run test:piano` ✓ · `npm run test:copy` ✓ · `npm run
test:radar` ✓ · `npm run test:architettura` ✓ (143 violazioni in baseline: **nessuna
nuova**) · `npm test` ✓ (catena completa) · `npm run build` ✓ (7,37 s).


### 26.15 Landing: hero a due righe, metriche reali del Radar Live, offerta di continuazione

**Nota di sessione (28/09/2026, nono intervento)** — sei correzioni strutturali e di copy
sulla vetrina pubblica, richieste dal cliente: leggibilità del titolo, allineamento del primo
schermo, **fine dei numeri da mock** nel Radar Live, un riquadro in meno lungo la discesa
verso il piano e un solo form di registrazione.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Hero su DUE righe** | `LandingHero`: il titolo è composto da due `span.block` — «Ogni giorno decine di opportunità.» + «Noi intercettiamo solo quelle per te.» (secondo rigo in `text-secondary-500`) — senza alcun tag di a-capo: la separazione è del layout, non del markup |
| 2 | **Primo schermo allineato** | `LandingHero`: griglia `items-stretch` + colonna destra `flex flex-col` con `<SimulatorRadar className="h-full" />` e inviti all'azione ancorati in basso (`lg:mt-auto`); `SimulatorRadar`: il responso vive in un contenitore `max-h-[24rem] overflow-y-auto overscroll-contain`, quindi il box **non cambia dimensione** mentre si cerca |
| 3 | **Metriche reali del Radar Live** | nuovo `radar/flightBoard/metricaBoard.ts` (modulo **puro**, testato in isolamento): `LIMITE_RIGHE_BOARD = 750` (150 pagine da 5 righe), `pagineBoard`, `etichettaPagina` («Schermata X di Y» — fino al 03/10/2026 «Pagina 7 di 150+ - Aggiornamento automatico», §26.42), `etichettaTotaleAvvisi`, `formattaNumeroIt` (migliaia deterministiche: `toLocaleString('it-IT')` restituisce `3412` dove l'ICU è ridotto). `FlightBoardInterpelli` carica 750 righe e chiede il **conteggio esatto** degli avvisi attivi (`{ count: 'exact', head: true }` su `expiration_date` non scaduta): se il conteggio non arriva, l'etichetta dichiara **solo** le righe in bacheca — mai un totale attribuito all'Italia senza prova |
| 4 | **Un riquadro in meno** | rimossa la chiusura con la CTA «Attiva il mio Radar» dalla bacheca: fra il Radar Live e l'offerta PRO non c'è più nessun blocco che interrompa la discesa verso il piano (le porte d'ingresso restano hero, form rapido sotto l'hero e sezione PRO) |
| 5 | **Un solo form di registrazione** | nuovo `src/components/landing/FormRegistrazioneRapida.tsx` (Nome, Cognome, Email) consumato **due volte**: dalla sezione sotto l'hero (`LandingRegistrazioneRapida`, ora solo la cornice della sezione) e dalla chiusura dell'offerta PRO (`LandingOffertaPro`, prop opzionale `onRegistrazioneRapida`, montata da `LandingPage` **solo** per i visitatori). Un solo stato, un solo percorso: i dati vanno nella bozza e aprono la configurazione del Radar già compilata |
| 6 | **Offerta di continuazione (40 €)** | `lib/pricing.ts`: `PREZZO_PRO_ANNO_DOPO_OMAGGIO_EUR = 40`, `PREZZO_PRO_ANNO_DOPO_OMAGGIO_ETICHETTA`, `SCONTO_OMAGGIO_MESE_EUR` (valore del mese in omaggio scorporato dal listino: 49 − 9 = 40). La dichiarazione vive **solo** nel benvenuto di fine flusso (`BenvenutoProRadar`, blocco visibile con `trialAttivo`): la vetrina della homepage resta **senza importi** (§26.13) |

**Guardie.** Nuovo `scripts/test-copy-primo-schermo.ts` (`npm run test:copy:schermo`, in `npm test`
subito dopo `test:copy:pubblico`): **3 controlli** su hero a due righe, allineamento in altezza col
responso a scorrimento e assenza del riquadro ridondante. I controlli sono stati **estratti** da
`test-copy-etico.ts` perché le righe aggiunte portavano quel gate a **259 righe** (soglia `W-DIM` a
250): il gate etico è tornato a **240 righe** e il file nuovo nasce con un perimetro dichiarato.
Nuovo `npm run test:board:metriche`
(`src/departments/radar/flightBoard/__tests__/metricaBoard.test.ts`, **17 controlli**, in `npm test`):
scala reale a 150 pagine col `+`, singolare/plurale con il separatore delle migliaia, conteggio
assente (si dichiara **solo** la bacheca) e robustezza su liste vuote e pagine fuori scala. Resta
attiva la guardia di §26.13: `LandingOffertaPro` non contiene importi.

**Nota di design delle soglie.** `flightBoard/metricaBoard.ts` è **puro** (nessun React, nessuna
rete, nessun `Date.now()`): la componente mostra il risultato, le etichette si verificano senza
rendering. `LIMITE_RIGHE_BOARD = 750` è la scala **dichiarata** (150 pagine da 5 righe) e il conteggio
esatto decide il `+`: nessun numero mostrato è più grande di quello che il database sa dire.

**⚠️ Blocco di produzione — offerta 40 €.** L'importo **non esiste ancora lato Stripe**: la Edge
`checkout` mappa i soli Price ID dei piani e non risulta nessun coupon `amount_off` da **900
centesimi** (`SCONTO_OMAGGIO_MESE_EUR`) applicabile alla sessione annuale. Finché il coupon non è
provisionato (o il cliente non conferma una strada diversa), l'offerta è **dichiarata ma non
acquistabile** a quel prezzo: da risolvere prima del rilascio. Tracciato anche in
`comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md` §3.

**Debito noto (non introdotto qui).** `radar/FlightBoardInterpelli.tsx` è a **336 righe** (sopra le
300: `E-DIM` **già congelato** in `scripts/architettura-baseline.json`); questo intervento ne aggiunge
una decina in testa (documentazione delle metriche). La chiave del gate è `codice:file`, quindi non
scattano violazioni nuove, ma lo split resta dovuto al prossimo tocco sul file (tabella e righe di
riempimento in `flightBoard/`), come previsto da `.clinerules` §3 (soglia di attenzione a 250 righe).

**Allineamento della documentazione.** Nel §2.9 di questo file i **conteggi** dei cinque domini
sono stati rifatti sul codice di oggi e il metodo è ora dichiarato sotto la tabella (file `.ts`/`.tsx`,
**righe non vuote**, `__tests__` inclusi): `radar/` 31 / 4.605 → **32 / 4.700** in §26.16,
`notizie/` 21 / 4.922, `scadenze/`
11 / 1.236, `admin/` 22 / 3.120, `cfu/` 107 / 16.484 — i valori precedenti erano una fotografia più
vecchia e non riproducibile. In `DEPARTMENT_MAP.md` la riga di `flightBoard/` ora dichiara
`metricaBoard.ts`, `righeBoard.ts` e la guardia del dipartimento.

**Confine ribadito (28/09/2026, decimo intervento).** La sezione resta **senza importi**, ma la
**copy diretta** cambia su direttiva del cliente: al posto di «Un mese intero di PRO offerto da noi»
ora c'è la frase esatta «Siamo così sicuri che Scuole Radar ti piacerà che il primo mese PRO te lo
offriamo noi. Se poi non vuoi abbonarti, passerai automaticamente a un account Base.» L'asserzione
della guardia che **vietava** «Siamo così sicuri…» è stata sostituita dalla verifica della copy
**autorizzata** (`npm run test:copy:etico`): l'esito «account Base» è **veritiero** — scaduta la
prova, il self-heal del client e il cron `revert-prove-pro-scadute` riportano l'account su Base
(§26.16).

**Verifiche (28/09/2026, nono intervento).** `npm run typecheck` ✓ · `npm run test:board:metriche` ✓
(17/17) · `npm run test:copy:etico` ✓ · `npm run test:copy:schermo` ✓ (3/3) ·
`npm run test:copy:pubblico` ✓ · `npm run test:architettura` ✓ (143 violazioni in baseline:
**nessuna nuova**) · **`npm test` ✓ (catena completa)** · `npm run build` ✓ (16,20 s) ·
`npx eslint` **0 problemi** sui 15 file toccati.

### 26.16 Hero compatto, lead capture sotto la vetrina PRO, chiusura annuale 40 €

**Nota di sessione (28/09/2026, decimo intervento)** — cinque disposizioni del cliente sulla
homepage e sul fine flusso, con la **copy esatta** richiesta per la vetrina PRO e per la CTA
annuale.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Hero compatto** | `LandingHero`: rimosso lo stiramento in altezza del box «Prova il Radar» (niente `h-full`, colonne `items-start`): il box resta alla sua altezza naturale, quindi **niente spazio bianco verticale** nella colonna destra |
| 2 | **Pulsanti sotto il box** | «ATTIVA IL TUO RADAR» e «ACCEDI» scendono dal copy alla colonna destra, **subito sotto il box** e allineati a destra (`mt-4 … lg:justify-end`): un solo blocco di conversione compatto. *(Layout poi reso simmetrico su due colonne: §26.19.)* Se il menu verde dei risultati li copre durante l'espansione, è il comportamento **accettato** dal cliente |
| 3 | **Copy autorizzata dell'offerta PRO** | `LandingOffertaPro`: il testo spezzato è sostituito dalla frase esatta «Siamo così sicuri che Scuole Radar ti piacerà che il primo mese PRO te lo offriamo noi. Se poi non vuoi abbonarti, passerai automaticamente a un account Base.» La sezione resta **senza importi** (§26.13 aggiornato) |
| 4 | **Lead capture sotto il testo** | il form condiviso `FormRegistrazioneRapida` (campi nativi Nome, Cognome, Email) è montato **immediatamente sotto la copy**, con il pulsante d'azione `ATTIVA IL TUO RADAR` (`etichetta="Attiva il tuo Radar"`; da §26.19 la stringa è letteralmente maiuscola e il form sta a `mt-4`, senza paragrafi intermedi): il submit scrive i dati nella **bozza** e apre la **modale di configurazione del Radar** già compilata. Per gli utenti autenticati resta la CTA unica del Radar |
| 5 | **Chiusura annuale (PROANNUALE40)** | nuovo `radar/components/CtaProAnnuale.tsx` (presentazione pura): copy esatta «Vuoi toglierti il pensiero e passare subito a PRO Annuale? Ti scontiamo il mese e paghi solo 40 € per tutto l'anno, invece di 49!» + nota su coupon e scorporo del mese (9 €). Montato nella **schermata di conferma post-configurazione** (`RadarWizardModal`, fase «done», con `trialAttivo`) e nel **box di benvenuto PRO** (`BenvenutoProRadar`). Il contenitore chiama `avviaCheckout('pro_annuale', PROMO_CODE_PRO_ANNUALE_40)`: al checkout va **solo il codice**, mai un prezzo. Nuova costante `PROMO_CODE_PRO_ANNUALE_40` in `lib/promo.ts` (anche in `PROMO_CODES_ATTIVI` e nel catalogo del System Health Check) e nuovo ramo nella Edge `checkout` (`plan === 'pro_annuale'`, `discounts[0][coupon]`, **500 esplicito** se il secret `STRIPE_COUPON_PROANNUALE40` non è configurato) |

**Copy e cifre.** La copy della CTA è quella richiesta dal cliente; gli unici scostamenti sono
dichiarati: gli importi sono resi dalle costanti di `lib/pricing.ts` (`40 €` / `49 €`, non «40 Euro»
/ «49») perché nel frontend **nessun prezzo si scrive a mano**, e la nota dice esplicitamente che lo
sconto **vale per il primo anno** (durata `once` del coupon Stripe), così la promessa resta
veritiera anche al rinnovo.

**Guardie.** `npm run test:copy:schermo` riscritta: il box non deve essere stirato e i due pulsanti
devono stare **dopo** `<SimulatorRadar` nel markup, con l'etichetta radar prima di «Accedi»
— **5 controlli**. `npm run test:copy:etico` ora **pretende** la copy autorizzata (non più l'assenza
della formula) e continua a vietare importi/rinnovo/disdetta nella sezione. Nuovo
`npm run test:checkout:annuale` (`scripts/test-checkout-annuale.ts`, **11 controlli**) — estratto da
`test-checkout-promo.ts`, che con le righe nuove arrivava a **266** (`W-DIM` a 250): invarianti del
coupon PROANNUALE40, CTA di presentazione pura, montaggio nelle due superfici, copy esatta e importi
dalle costanti di `lib/pricing`. `test:checkout-promo` rinvia alla guardia dedicata e resta sotto
soglia; entrambe sono in `npm test`.

**⚠️ Blocco di produzione — coupon PROANNUALE40.** Sul progetto Stripe **non esiste ancora** un
coupon `amount_off` da **900 centesimi** con durata `once` e il secret `STRIPE_COUPON_PROANNUALE40`
non è configurato: finché non viene provisionato, il checkout risponde **500 con messaggio
esplicito** — mai un addebito a listino al posto dello sconto promesso. Resta inoltre da decidere il
rapporto con `SCUOLERADAR50` (50% sull'annuale = 24,50 €), che oggi dà uno sconto **maggiore**: due
coupon attivi sullo stesso piano sono una scelta commerciale del cliente. Tracciato in
`comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md` §3.

**Conteggi (§2.9).** Con `CtaProAnnuale.tsx` il dominio `radar/` passa a **32 file / 4.700 righe non
vuote** (stesso metodo dichiarato: file `.ts`/`.tsx`, righe non vuote, `__tests__` inclusi).

**Verifiche (28/09/2026, decimo intervento).** `npm run typecheck` ✓ · **`npm test` ✓ (catena
completa)** · `npm run test:copy:schermo` ✓ (5/5) · `npm run test:copy:etico` ✓ ·
`npm run test:copy:pubblico` ✓ · `npm run test:checkout:annuale` ✓ (11/11) ·
`npm run test:checkout-promo` ✓ · `npm run test:coupon` ✓ · `npm run test:documenti-utente` ✓ ·
`npm run test:architettura` ✓ (143 violazioni in baseline: **nessuna nuova**) · `npm run build` ✓.



### 26.17 Motore degli interpelli: domini isolati, hub dei capoluoghi, niente scarti da ping fallace

**Richiesta (28/09/2026, undicesimo intervento).** Quattro disposizioni inderogabili
sul motore del Radar Live: (1) separazione netta fra interpelli di lavoro e notizie
editoriali del MIM; (2) connettori puntati su feed e pagine di reclutamento dei
capoluoghi di regione / hub metropolitani, con estrazione dei soli bandi di
interpello attivi (docenti, ATA, PNRR, esperti esterni); (3) fine dei blocchi
«scartato (link non raggiungibile)» causati dagli anti-bot dei server scolastici
regionali; (4) test di conformità della bacheca.

**1 · Separazione dei domini (mai una notizia in bacheca).** Il motore `src/scraper/`
non importa (e non importerà) nulla da `src/departments/**`: nessuna dipendenza da
UI o dal dominio Notizie; nel verso opposto, `src/departments/notizie/**` non tocca
`interpelli`/`notices` e non importa il motore. Sul piano dei contenuti, il nuovo
`qualitaOpportunita.ts` scarta a monte (prima di ogni arricchimento di rete) i
contenuti **editoriali** — comunicato stampa, conferenza stampa, dichiarazione,
intervista, lettera/nota del Ministro, rassegna stampa, cerimonia, premiazione,
convegno, campagna di comunicazione, «Notizie per la scuola» — e gli **atti
informativi** (esiti, graduatorie, revoca, annullamento): mai in bacheca, mai nei
canali Telegram né nel digest email. Guardia: `npm run test:scraper:domini`, dentro
`npm test` (include la lettura controllata del dominio Notizie per dimostrare
l'assenza di canali di ritorno).

**2 · Capoluoghi e hub metropolitani.** Nuovo registro fonti in tre moduli puri:
`fontiRegistro.ts` (soli dati), `fonti.ts` (tipi + selezione), `fontiCopertura.ts`
(copertura dichiarata). Le fonti sono passate da 9 landing regionali
dell'aggregatore a **47 voci**, di cui **43 attive**: hub di reclutamento di
**17 USR/USP** (Torino, Milano, Genova, Bologna, Firenze, Roma, Napoli, Bari,
Palermo, Venezia, Cagliari, Perugia, Ancona, L'Aquila, Campobasso, Potenza,
Catanzaro) + feed dell'aggregatore. Ogni URL è stata **verificata a mano** (HTTP
200 + contenuto di reclutamento) e la data di verifica è registrata; le fonti non
verificabili (FVG, Valle d'Aosta, Trentino, hub PNRR nazionale) restano nel
registro con `attiva: false` **e il motivo dichiarato**: la copertura è un dato
verificabile, mai una dichiarazione di comodo. Il connettore `hub.ts` scopre nella
pagina dell'ente le **sezioni** di interpelli/avvisi (es. USR Lombardia →
`interpelli-ricerca-supplenti`, USR Umbria → `interpelli/interpelli-aperti`,
USR Sicilia → `interpelli/`, Puglia → `docenti|ata/reclutamento`) e le esplora
(max 3 per hub). Il post giornaliero dell'aggregatore è **NAZIONALE**: viene letto
**una volta sola** e ogni voce riceve la provincia dall'intestazione di città; se
la provincia non è rilevabile la riga si scarta (**mai province inventate**). Gli
archivi regionali sono opt-in (`SCRAPER_ARCHIVI=1`, backfill). Il rumore di
navigazione (menu, archivi, ricerca, paginazione) è escluso a monte
(`eTitoloNavigazione`).

**3 · Fine degli scarti da «ping fallace».** Il vecchio blocco rigido
(`scartato (link non raggiungibile)`) è stato sostituito dal **gate del link**:
un ping fallito (403/anti-bot/timeout dei server regionali) **non** scarta un bando
**strutturato** — classe di concorso o materia **+** email di candidatura — che
resta in bacheca; i record strutturati non vengono nemmeno pingati, gli altri
vengono verificati in parallelo (`SCRAPER_PING_CONCORRENZA`, default 8) e scartati
solo se incompleti. Restano intatte due regole di prodotto: il link pubblicato è
**sempre** quello specifico dell'avviso (nessun fallback alla home dell'ente) e
l'anti-mock `verificaAvviso` non è stato allentato (link di prova/piattaforme
rifiutati). Il vecchio commento in `parser.ts` («nessun link rotto viene mai
persistito») è stato corretto insieme alla policy.

**4 · Conformità verificata.** Tre guardie nuove in `npm test`:
`test:scraper:domini` (isolamento + filtro editoriale su 8 titoli realistici e su
un lotto misto notizie+bandi: ammessi **solo** i 4 bandi), `test:scraper:fonti`
(igiene del registro, 19/20 regioni, tutti i 12 capoluoghi principali, selezione
per provincia/run, scoperta sezioni con esclusione del rumore e degli host
esterni), `test:scraper:attivi` (bandi attivi vs scaduti, categorie ammesse,
matrice completa del gate del link, anti-mock). Diagnostica dal vivo:
`npm run fonti:verifica` → **43/43 fonti raggiungibili** (28/09/2026), con le
sezioni scoperte per ogni hub. Prova end-to-end `npm run scrape -- --dry-run` su
Piemonte + feed nazionale: 30/33, 13/17 e 10/16 voci ammesse dagli hub USR
Piemonte, **102/102** voci dal feed nazionale, 29 voci di navigazione scartate,
4 righe senza provincia scartate, 4 bandi scaduti scartati, 164 link verificati in
24 secondi.

**File toccati.** `src/scraper/{index.ts,parser.ts}` (commento policy),
`src/scraper/{fonti.ts,fontiRegistro.ts,fontiCopertura.ts,hub.ts,qualitaOpportunita.ts}`
(nuovi), `scripts/{test-scraper-domini.ts,test-scraper-fonti.ts,test-scraper-attivi.ts,verifica-fonti-scraper.ts}`
(nuovi), `package.json` (script + catena `test`), `comunicazione/04_canali_regionali/checklist_regionali.md`,
`docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md,DEPARTMENT_ISOLATION.md}`.
Nessun file fuori dal perimetro Interpelli/Radar (il dominio Notizie è stato
**letto** — mai modificato — solo per la guardia di isolamento richiesta al punto 1).

**Verifiche (28/09/2026).** `npm run typecheck` ✓ 0 errori · **`npm test` ✓ (catena
completa, incluse le 3 guardie nuove)** · `npm run test:architettura` ✓ (143
violazioni in baseline: **nessuna nuova**, nessun file sopra le 250 righe) ·
`npm run build` ✓ · `eslint src/scraper scripts/test-scraper-*.ts
scripts/verifica-fonti-scraper.ts` ✓ 0 problemi · `npm run fonti:verifica` ✓ 43/43 ·
`npm run scrape -- --dry-run` ✓.


### 26.18 Bacheca senza mock: conteggio esatto, bacheca vuota dichiarata, nomi scuola veri

**Richiesta (28/09/2026, dodicesimo intervento).** Quattro correzioni bloccanti sulla
vetrina pubblica: (1) eliminazione di qualunque mock/fallback nella bacheca, contatore
reale esatto (`{ count: 'exact' }`) e paginazione/etichette sulla scala effettiva dei
dati; (2) restyling compatto dell'hero «Prova il Radar» con i pulsanti posizionati in
modo pulito e conferma che nessuna identità di prova («Mario Rossi») esiste in navbar o
placeholder; (3) offerta PRO con form di lead capture nativo (Nome, Cognome, Email
obbligatori) e pulsante «ATTIVA IL TUO RADAR» che apre la configurazione del Radar a 4
province; (4) verifica dei loghi su landing e dashboard.

**1 · Bacheca «Radar Live» — zero mock, numeri reali.** `FlightBoardInterpelli`: stato
iniziale **array vuoto** (nessun seed, nessun fallback) e flag `caricato` che tiene la
sezione in attesa finché la prima lettura non è conclusa **senza errori** (mai «nessun
bando» mentre la query è in volo o il database non risponde); a database raggiunto con
zero righe presentabili si mostra «**Nessun bando attivo al momento**» al posto di
qualunque riga di riempimento. La query delle righe usa ora **lo stesso predicato del
conteggio** (`.gte('expiration_date', oggi)`): si scaricano solo gli avvisi che possono
entrare in bacheca (prima erano 591 righe per mostrarne 17) e il badge alto —
`{ count: 'exact', head: true }` — dichiara il totale REALE, con ripiego su «quanto è in
bacheca» se il conteggio non arriva (mai un totale attribuito all'Italia senza prova).
`LIMITE_RIGHE_BOARD` resta un **tetto di sicurezza sul payload**, non una scala da
esibire: le pagine sono quelle delle righe presenti. (Superato da §26.25: il tetto è
diventato `LIMITE_RIGHE_LETTE = 1.000` e la query usa il filtro `filtroAttivi`; anche quel
numero è **superato** — da §26.34 la bacheca legge a pagine, non fino a un tetto.)
**Misure reali (28/09/2026):** 591
righe in `interpelli`, **61** avvisi attivi, **17** presentabili in vetrina → badge «61
avvisi attivi in Italia», etichetta «Pagina X di 4+ - Aggiornamento automatico» *(etichetta superata il 03/10/2026: §26.42 — ora `Schermata X di Y`, contata sulle righe in vetrina e senza `+`)*.

**2 · Nomi scuola veri (fine dei codici in vetrina).** Il campo `school_name` scritto
dallo scraper contiene a volte elenchi di codici classe («ADEE | EEEE», «BA02 | AR04»,
«AAAA | BB02 |») o frammenti di procedura: in `lib/liveBoard.ts` `nomeScuolaRiga` e

**3 · Hero compatto e pulsanti.** `SimulatorRadar`: provincia e pulsante «Cerca ora»
sulla **stessa riga** da `sm` in su e margini interni ridotti (`mb-2`), quindi il box
«Prova il Radar» è più basso e la colonna destra non lascia spazio bianco verticale;
`LandingHero` porta il padding desktop a `pt-6` (resta `pb-8 pt-6`) e la sezione sotto
l'hero (`LandingRegistrazioneRapida`) parte da `pt-6` invece di `py-8`. I due inviti
all'azione restano sotto il box, allineati a destra (`mt-4 … lg:justify-end`).
*(Layout poi reso simmetrico su due colonne e con ripartizione verticale `lg:items-center`: §26.19.)*

**4 · Lead capture diretto dell'offerta PRO.** In `LandingOffertaPro` la copy
autorizzata del primo mese PRO resta una sola frase pulita, **senza paragrafo
ridondante** sotto il testo; `FormRegistrazioneRapida` ha i tre campi **nativi
obbligatori** (`required` su Nome, Cognome, Email: validazione del browser attiva,
niente `noValidate`) e il pulsante principale «ATTIVA IL TUO RADAR»; il submit scrive i
dati nella **bozza** e apre la modale di configurazione del Radar (PRO, fino a 4
province) già compilata.

**5 · Identità visiva.** Nessun «Mario Rossi» in `src/**`: la guardia
`test:copy:pubblico` compone il nome di prova a runtime e verifica che non compaia in
sorgenti e script. Marchio: `Header` usa la **tessera ufficiale**
(`@/assets/marchio-radar.png`, identica al favicon) + wordmark «ScuoleRadar.it» in
testo — guardia `npm run test:favicon`. In landing e dashboard **non esiste alcun
logo-immagine**: `src/assets/logo.png` sopravvive solo come anteprima del pannello
admin (copy email) e `LOGO_URL` per le email transazionali.

**Guardie aggiornate.** `scripts/test-copy-primo-schermo.ts`: **+5 controlli**
(conteggio ESATTO, stato iniziale vuoto senza costanti di seed, messaggio della bacheca
vuota, badge sul conteggio reale, attesa della prima lettura) — 108 righe.
`scripts/test-copy-pubblico.ts`: i tre campi del form rapido devono essere `required` e
il form non deve avere `noValidate` — 238 righe (sotto la soglia `W-DIM` di 250).
`scripts/test-live-board.ts`: righe con `school_name` a codici classe e recupero del
nome reale dal titolo — 147 righe. `flightBoard/__tests__/metricaBoard.test.ts`: caso
sulla **scala misurata** (17 righe → 4 pagine, 61 attivi).

**File toccati.** `src/departments/radar/{FlightBoardInterpelli.tsx,SimulatorRadar.tsx}`,
`src/departments/radar/flightBoard/{metricaBoard.ts,__tests__/metricaBoard.test.ts}`,
`src/lib/liveBoard.ts`,
`src/components/landing/{LandingHero.tsx,LandingOffertaPro.tsx,LandingRegistrazioneRapida.tsx,FormRegistrazioneRapida.tsx}`,
`scripts/{test-copy-primo-schermo.ts,test-copy-pubblico.ts,test-live-board.ts}`,
`docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md}`. Nessun file fuori dal perimetro
Radar/landing: le sezioni di landing e `src/lib/liveBoard.ts` sono superfici pubbliche
condivise citate nella richiesta.

**Nota per il cliente (dato, non UI).** Restano avvisi attivi con `school_name` vuoto o
sostituito da una materia: sono **dati** dello scraper e per questo non compaiono in
vetrina (colonna «Scuola» mai con valori non veri). Una pulizia/backfill di
`interpelli.school_name` farebbe risalire il numero di righe presentabili (oggi 17 su
61 attive) senza toccare l'interfaccia.

**Verifiche (28/09/2026).** `npm run typecheck` ✓ 0 errori · **`npm test` ✓ (catena
completa: copy etico, copy pubblico, copy primo schermo, metriche del Radar Live, Radar
Live)** · `npm run test:architettura` ✓ (143 violazioni in baseline: **nessuna nuova**) ·
`npm run build` ✓ (10,20 s) · `eslint` **0 problemi** sui file toccati ·
`npm run test:favicon` ✓. La misura dei dati (591 / 61 / 17) è stata presa con uno
script di diagnostica temporaneo, **cancellato** a fine sessione.

`scuolaDaTitolo` ora respingono quei testi (regex dei codici classe + azioni
amministrative: interpello/avviso/bando/…/dal/fino/entro) e `scuolaDaTitolo` guarda
**prima del separatore** quando dopo c'è l'azione («IX IC Ricci Curbastro — Interpello
per la copertura…» → «IX IC Ricci Curbastro», nome reale recuperato dal titolo). Le
righe senza scuola identificabile restano fuori dalla vetrina secondo la regola di
prodotto: meglio una bacheca più corta che una colonna «Scuola» con codici.


### 26.19 Hero simmetrico, copy PRO su una riga, CTA letterale «ATTIVA IL TUO RADAR»

**Nota di sessione (28/09/2026, dodicesimo intervento)** — tre correzioni visive e di copy
richieste dal cliente sulla landing pubblica: spazio bianco del box destro, testo del primo
mese PRO e lead capture dell'offerta PRO.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Hero senza spazio bianco sproporzionato** | `LandingHero`: il contenitore delle colonne diventa `grid items-start gap-6 lg:items-center lg:grid-cols-[minmax(0,1fr)_34rem]`. Il box «Prova il Radar» NON viene stirato (nessun `h-full`) e lo scarto verticale rispetto alla colonna del copy si **ripartisce** sopra e sotto invece di accumularsi come un vuoto sotto i pulsanti. `SimulatorRadar`: padding uniforme `p-5` (via `sm:p-6`), titolo `mb-1.5` e introduzione `mb-3` — il box è più basso e compatto |
| 2 | **Pulsanti simmetrici sotto la prova** | «ATTIVA IL TUO RADAR» e «ACCEDI» stanno SUBITO sotto il box su **due colonne simmetriche** della stessa larghezza (`mt-3 grid w-full gap-3 sm:grid-cols-2`, entrambi i pulsanti `w-full`): fine dell'allineamento a destra con sbilanciamento |
| 3 | **Copy PRO esatta e su una riga** | `LandingOffertaPro`: la frase autorizzata sta su **una sola riga di sorgente** (`<p>` a `text-lg`, `max-w-3xl`), quindi non esiste più alcun testo spezzato: «Siamo così sicuri che Scuole Radar ti piacerà che il primo mese PRO te lo offriamo noi. Se poi non vuoi abbonarti, passerai automaticamente a un account Base.» |
| 4 | **Lead capture immediata e CTA letterale** | I tre campi **nativi obbligatori** (Nome, Cognome, Email, `required`) stanno **immediatamente sotto** la copy (`mt-4`, nessun paragrafo intermedio) e il pulsante principale — full width — dice `ATTIVA IL TUO RADAR` come **stringa letterale** (non più solo `uppercase` via CSS). Il submit scrive i dati nella **bozza** e apre la **modale di configurazione del Radar PRO (fino a 4 province)** già compilata: nessun passaggio intermedio |

**Un solo percorso di registrazione.** L'etichetta `ATTIVA IL TUO RADAR` è ora la stessa
dell'hero e della checklist di prodotto
(`comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md`): il default vive in
`FormRegistrazioneRapida` e la chiusura PRO lo passa esplicitamente, così le due superfici
dicono la stessa cosa. Per l'utente autenticato resta la CTA unica del Radar
(`GESTISCI IL TUO RADAR` / `ATTIVA IL TUO RADAR`).

**Guardie aggiornate.** `scripts/test-copy-primo-schermo.ts`: layout del box (aggiunto
`lg:items-center`, riga dei pulsanti `mt-3 grid w-full gap-3 sm:grid-cols-2`) e verifica che
**entrambi** i pulsanti siano `w-full`; `scripts/test-copy-pubblico.ts`: CTA esatta
`ATTIVA IL TUO RADAR` nel form e nel montaggio PRO, più l'attacco diretto della lead capture
alla copy (`passerai automaticamente a un account Base… <FormRegistrazioneRapida …
etichetta="ATTIVA IL TUO RADAR"`); `scripts/test-copy-etico.ts`: la frase PRO è verificata come
**stringa intera**, prova che sta su una riga sola.

**File toccati.** `src/components/landing/{LandingHero.tsx,LandingOffertaPro.tsx,FormRegistrazioneRapida.tsx}`,
`src/departments/radar/SimulatorRadar.tsx`,
`scripts/{test-copy-primo-schermo.ts,test-copy-pubblico.ts,test-copy-etico.ts}`,
`docs/SYSTEM_HANDOVER.md`. Nessun file fuori dal perimetro Radar/landing.

**Verifiche (28/09/2026).** `npm run typecheck` ✓ 0 errori · `npm test` ✓ (catena completa) ·
`npm run test:architettura` ✓ (143 violazioni in baseline: **nessuna nuova**) · `npm run build`
✓ · `eslint` **0 problemi** sui file toccati · guardie di copy ✓ (`test:copy:etico`,
`test:copy:pubblico`, `test:copy:schermo`) · `test:prova-radar` ✓.

### 26.20 Pulizia assoluta dei nomi scuola in bacheca (mai codici, mai stringhe grezze)

**Nota di sessione (28/09/2026, tredicesimo intervento)** — direttiva cliente bloccante:
nella colonna «Scuola & Città» del Radar Live NON deve comparire alcun codice
amministrativo o stringa grezza (esempi citati: `EEEE | A246`, `AAAA | A246`); il
parser deve scartare o convertire subito e, se il nome non è risolvibile in chiaro,
la riga NON entra nella vetrina pubblica. Verifica finale richiesta su localhost:
tre campi visibili a colpo d'occhio nella sezione PRO e bacheca con soli istituti
reali.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **GATE dei nomi in vetrina** | nuovo modulo **puro** `src/lib/nomeIstituto.ts`: `nomeIstitutoPresentabile(testo)` accetta una stringa solo se ha una **testa d'istituto** (`IC`, `I.I.S.`, `ITIS`, `IPSIA`, `CPIA`, `Liceo`, `Istituto`, `Convitto`, `Comprensivo`… — sigle anche puntate, ricomposte dai token) **e** una **denominazione** (nome proprio non generico) e non contiene **codici** (classe di concorso `A042`/`A-22`, sostegno `ADEE`/`ADSS`, sigla ripetuta `EEEE`/`AAAA`, meccanografico, qualunque token misto lettere+cifre tipo `A246`/`AA56`) né 3+ cifre consecutive. La **coda di procedura** viene tagliata al primo marcatore di posto/procedura/materia: «I.C. Ferruccio Ulivi – interpello preventivo primaria sostegno» → «I.C. Ferruccio Ulivi» |
| 2 | **Bacheca: solo istituti reali** | `liveBoard.nomeScuolaRiga` (campo → registro per codice → titolo) passa OGNI fonte dal gate e l'**ente emittente non è più ammesso** in bacheca (USP/USR non è una scuola): se non resta un nome in chiaro la riga è scartata da `preparaRigheBoard`. `FlightBoardInterpelli`: il sottotitolo della colonna usa `titoloLeggibile` (titolo ripulito dai dump di codici via `pulisciTitoloAvviso`) e non viene renderizzato quando non resta nulla di leggibile — mai un elenco di codici sotto il nome |
| 3 | **Prova del Radar allineata** | `ResponsoProva` non mostra più `school_name` grezzo (era la superficie da cui i codici finivano sotto gli occhi del cliente): usa `nomePresentabileRiga` (ultima risorsa legittima l'ente emittente) e `titoloLeggibile`; la città arriva dal catalogo province (`nomeProvincia`) al posto del codice; `SimulatorRadar` filtra il pool con `rigaPresentabileVetrina`, così i conteggi del responso restano onesti. Se non c'è nulla di presentabile resta la copy di scansione già prevista (mai una schermata vuota) |
| 4 | **Guardie e dati reali** | `scripts/test-live-board.ts` (fixture con i valori REALI trovati in `interpelli`: «Conversazione in lingua straniera», «Scuola primaria posto Montessori», «Esiti assegnazione sede», «timbro_…», «PRIMARIA-signed» e i dump di classi) + nuovo `scripts/test-nome-istituto.ts` (`npm run test:nome-istituto`, dentro `npm test`) con gate, taglio della coda e superfici pubbliche |

**Verifica sui dati di produzione (sola lettura).** Su 61 interpelli attivi: prima del
filtro la bacheca mostrava 5 righe con nomi-JUNK («Conversazione in lingua straniera»,
«Matematica e Fisica»); dopo il filtro mostra **10 righe con istituti REALI** («IX IC
Ricci Curbastro», «IC SAONARA (PD)», «IC di Campodarsego», «V IC Donatello», «IC
LOREGGIA VILLA DEL CONTE», «IC di CURTAROLO»…), tutte prive di codici. Il responso
della prova scende a 17 righe presentabili sulle 61 attive: le restanti hanno titolo e
`school_name` ridotti a dump di classi (dato a monte dello scraper) e restano fuori
dalla vetrina, come richiesto.

**Debito residuo dichiarato.** La causa a monte è nello **scraper**: molte righe
salvano nel `title` l'elenco delle classi e in `school_name` l'etichetta del posto
(«Conversazione in lingua straniera») invece del nome dell'istituto. Finché non si
corregge l'ingestione, la bacheca resta corta: le righe senza nome reale non entrano
(regola del cliente). Il registro scuole noto (`school-code` → denominazione) copre
oggi 2 codici: allargarlo è il modo più diretto per recuperare righe senza toccare la
vetrina.

**File toccati.** `src/lib/{nomeIstituto.ts (nuovo),liveBoard.ts}`,
`src/departments/radar/{FlightBoardInterpelli.tsx,SimulatorRadar.tsx,components/ResponsoProva.tsx}`,
`scripts/{test-live-board.ts,test-nome-istituto.ts}`, `package.json`,
`docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md}`. Nessun file fuori dal perimetro
Radar/landing: le superfici pubbliche citate nella richiesta.

**Verifiche (28/09/2026).** `npm run typecheck` ✓ 0 errori · `npm test` ✓ (catena
completa, con `test:board` e `test:nome-istituto` ora inclusi) ·
`npm run test:architettura` ✓ (baseline 143: **nessuna nuova** — lo split del test in
`test-nome-istituto.ts` è nato proprio dalla soglia delle 250 righe) · `npm run build`
✓ · `eslint` **0 problemi** sui file toccati · prova sui dati reali in sola lettura ✓.

### 26.21 Coda di scansione regionale (`scan_targets`): claim atomico, reaper e backoff

**Nota di sessione (29/09/2026, quattordicesimo intervento)** — nasce la coda che
distribuisce la scansione delle **21 città** (20 capoluoghi di regione + Asti) fra N
worker concorrenti: due worker non devono mai scansionare la stessa città e una fonte
morta non deve bloccare la coda.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Migrazione** `supabase/migrations/20260929102443_create_scan_targets_queue.sql` (idempotente) | enum `scan_status` (`idle/queued/running/error/disabled`, creata con guardia sul catalogo `pg_type`), tabella `scan_targets` (`city` unica, `region`, `slug` generato `stored`, `priority`, `next_run_at`, `last_checked_at`, `last_success_at`, `last_error`, `consecutive_failures`, `total_runs`, `locked_at`, `locked_by`, `metadata`), 3 indici (claim parziale su `idle/queued`, reaper parziale su `running`, `region`), trigger `set_scan_targets_updated_at` → `handle_scan_targets_updated_at()` (convenzione delle altre tabelle), RLS attiva con policy `service_role_full_access`, seed `on conflict (city) do nothing` |
| 2 | **3 RPC** (`security definer`, `set search_path = public`; `execute` revocato a `public, anon, authenticated` e concesso **al solo `service_role`**) | `claim_scan_target(p_worker, p_lock_seconds)` → 0/1 riga: prende in carico UN target dovuto; `finish_scan_target(p_id, p_success, p_error, p_base_interval_min, p_max_backoff_min)` → `idle` (fallimenti azzerati) oppure `error` con backoff; `reap_stuck_scans(p_stale_seconds)` → riporta a `queued` i `running` bloccati e ritorna quante righe ha liberato |
| 3 | **Claim atomico in due passi** | `select … into v_target … for update skip locked` (take del lock sulla riga scelta) + `update … returning * into v_target` (marca `running` e rimanda al worker i valori aggiornati) + `return next v_target`. Mai `return query <update>`: in questo repo `return query` è **sempre e solo** su `select`; il pattern `returning … into` è quello di `consuma_credito_utente` (`20260826100000_add_rpc_consuma_credito.sql`). Coda vuota → `return` senza righe e il worker chiude il giro |
| 4 | **Backoff in `numeric`** | `p_base_interval_min::numeric * (2::numeric ^ least(v_failures, 30))`, con tetto a `p_max_backoff_min`: in `int` l'esponente va in **overflow (ERROR 22003)** dal 31° fallimento, cioè proprio su una fonte morta da settimane — il caso che il backoff deve coprire |
| 5 | **Wrapper TypeScript** `src/lib/queue.ts` (③) | `claimScanTarget`, `finishScanTarget`, `reapStuckScans` + costanti (`LEASE_CLAIM_SECONDI` 300, `SOGLIA_LOCK_MORTO_SECONDI` 900, `INTERVALLO_BASE_MIN` 360, `BACKOFF_MASSIMO_MIN` 1440) ed errore tipizzato `QueueRpcError`: le RPC di servizio vanno chiamate con un client `SUPABASE_SERVICE_ROLE_KEY` |
| 6 | **Guardia di regressione** `scripts/test-coda-scansione.ts` (`npm run test:coda`) | 52 controlli **statici** sul file SQL (nessun database richiesto): idempotenza, indici, colonne di concorrenza, trigger, `security definer` + revoche/grant per ognuna delle 3 RPC, le 7 garanzie del claim (atomicità, filtro `idle/queued` + `next_run_at`, ordinamento per priorità, lock del worker, riga restituita, coda vuota, `total_runs`), backoff in `numeric` col tetto, reaper, RLS e allineamento nomi/parametri fra SQL e wrapper TypeScript |

**Contratto per chi scrive il worker** (nessun consumer esiste ancora — vedi debito):
`claimScanTarget(worker, lease)` in loop → scansione della città → `finishScanTarget({
id, success, error })`; un job periodico separato chiama
`reapStuckScans(SOGLIA_LOCK_MORTO_SECONDI)` per liberare i lock morti. `p_lock_seconds`
è nel contratto ma **non** è applicato dentro la RPC: la scadenza reale la decide il reaper.

**Stato: migrazione NON ancora applicata (verificato).** Il file è in `supabase/migrations/`,
ma il progetto `gwdmsgsshvdnfrplbjiv` non ha ancora la tabella. Prova in sola lettura dello
stesso giorno: lo spec OpenAPI di PostgREST (`GET /rest/v1/` con la service key) elenca
`interpelli` e `profiles` ma **non** `scan_targets`. Sul perché: **nessun workflow applica
migrazioni** (in `.github/workflows/` non esiste alcun `supabase db push`), quindi il push
resta manuale.

```bash
cd ScuoleRadar_app/project
supabase db push --project-ref gwdmsgsshvdnfrplbjiv   # chiede la password del DB
```

Verifica post-push (SQL editor): `select status, count(*) from public.scan_targets group
by status;` → 21 `idle` · `select * from public.claim_scan_target('worker-1');` → la
prima città passa a `running` · `select public.finish_scan_target('<id>', true);` → torna
`idle` · `select public.reap_stuck_scans(900);` → 0 (nessun lock morto).

**Debito residuo dichiarato.** La coda è pronta ma **orfana**: nessuno script la consuma
(lo scraper interpelli resta guidato dalle province di `profiles.province_attive`). Il
worker regionale va scritto in `src/scraper/**` — nessun `tsconfig` da toccare, perché
`tsc` segue gli import e quindi `src/lib/queue.ts` entra da sé nel progetto scraper.
Finché il worker non esiste, l'unico effetto in produzione è la tabella con 21 righe `idle`.

**File toccati.** `supabase/migrations/20260929102443_create_scan_targets_queue.sql`
(nuovo, 338 righe — gli `.sql` sono fuori dal gate strutturale), `src/lib/queue.ts`
(nuovo, 165 righe), `scripts/test-coda-scansione.ts` (nuovo, 245 righe con la metrica del
gate: 5 di margine sulle 250 — il prossimo controllo va in un file dedicato, come già
fatto con `test-nome-istituto.ts`), `package.json` (script `test:coda`),
`docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md}`.
Nessun file di dipartimento: la modifica vive nei condivisi essenziali (③ e migrazioni),
quindi nessuna uscita di perimetro da dichiarare.

**Verifiche (29/09/2026).** `npm run test:coda` ✓ (52 controlli, 0 errori) ·
`npm run test:migrazioni` ✓ (57 migrazioni analizzate) · `npm run typecheck` ✓ 0 errori ·
`npm run test:architettura` ✓ (518 file, 143 violazioni = baseline: **nessuna nuova** —
il gate sorveglia i soli `.ts/.tsx`, quindi il `.sql` è fuori perimetro) · `eslint`
**0 problemi** sui file toccati · `npm test` ✓ catena completa (1143 righe di log,
nessun `npm error`) · `npm run build` ✓ 21,25 s. **Non verificato**: l'esecuzione reale
delle 3 RPC, perché in questa sessione non c'erano né la password del database né Docker
(quindi né `db push` né un Supabase locale); l'unico controllo live possibile è stato lo
spec OpenAPI in sola lettura, che conferma l'assenza della tabella e quindi l'impossibilità
di provare claim/finish/reap prima del push.

> **Aggiornamento (29/09/2026, stesso giorno):** il push è stato eseguito — lo spec
> PostgREST del progetto live elenca ora `scan_targets` e le tre RPC
> (`claim_scan_target`, `finish_scan_target`, `reap_stuck_scans`). La coda è quindi
> **applicata ma ancora orfana** (nessun worker la consuma): resta valido tutto il
> resto della nota.

### 26.22 Bande di urgenza del «Radar Live» (`lib/urgency.ts`) e stato della RPC `radar_live_page`

**Nota di sessione (29/09/2026, quindicesimo intervento)** — la colonna «Scadenza» del
tabellone pubblico passa dal semaforo a tre livelli (`scadenza.ts`) a una **scala a
cinque bande** dedicata alla bacheca.

| # | Banda | Colore | Etichetta | Quando |
|---|---|---|---|---|
| 1 | `concluso` | slate | «Concluso» | scadenza passata *(mai in tabellone: gli scaduti non entrano)* |
| 2 | `oggi` | rosso + `animate-pulse` | «Scade oggi» | 0 giorni |
| 3 | `ultime48` | rosso | «Ultime 48h» | 1–2 giorni |
| 4 | `entro3` | arancio (`bg-orange-500`) | «Scade tra Xg» | 3 giorni |
| 5 | `entro7` | giallo (`bg-amber-500`) | «Scade tra Xg» | 4–7 giorni |
| 6 | `inCorso` | verde (`bg-emerald-600`) | «In corso» | oltre 7 giorni |
| — | `sconosciuto` | slate chiaro | «Scadenza n/d» | data assente o non valida |

**Perché un modulo nuovo e non `scadenza.ts`.** Il calcolo dei giorni **non** è
duplicato: `urgency.ts` importa `giorniRimanenti` da `scadenza.ts` (confronto per
GIORNO, indispensabile perché le scadenze reali arrivano a mezzanotte UTC e un
conteggio a ore anticiperebbe di un giorno l'allarme). Il semaforo condiviso resta
intatto per dashboard, scheda avviso, email e promemoria: **zero impatto fuori dal
Radar**. Divergenza dichiarata: per 1–2 giorni la bacheca scrive «Ultime 48h» mentre le
altre superfici scrivono «Ultimi N giorni» — stesso dato, due etichette.

**La banda `concluso` è codice difensivo, non una superficie.** La regola di prodotto
(§26.20, `comunicazione/04_canali_regionali`) è che gli interpelli scaduti non
compaiono mai nelle liste attive: la banda esiste solo perché `calcolaUrgenza` è TOTALE
(nessun input la rompe), non per essere mostrata.

**Copy.** Le bande sono informazione di servizio: nessun conto alla rovescia, nessun
invito a correre, nessuna frase di fretta — la regola immutabile `§2-bis` della
checklist straordinaria resta rispettata (`test:copy:etico` ✓, `test:copy:schermo` ✓).

**Misura sui dati reali (29/09/2026, sola lettura).** 58 avvisi attivi · 10 presentabili
in vetrina (17%) · **tutte e dieci in banda `inCorso`** (scadenze 2026-12-23,
2027-06-08, 2027-06-30). Cioè: con i dati di oggi il tabellone è **monocromatico
verde** e le bande non producono alcun «mix». Il motivo è noto e dichiarato in §26.20:
le righe con scadenza vicina sono quelle con `title`/`school_name` degradati dallo
scraper, che il gate di vetrina scarta. **La varietà di colore dipende
dall'ingestione, non dalla UI.**

**RPC `radar_live_page`: esiste sul database, non esiste nel repo.** Verifica empirica
(spec OpenAPI, sola lettura): la funzione è viva con firma
`radar_live_page(p_page, p_page_size, p_window_days, p_max_per_city)` e restituisce
`id, title, school_name, province, region, expiration_date, created_at, source_url,
link_status, city_rank, total_count`. **Nessuna migrazione del repo la crea** — e anche
la colonna `interpelli.link_status`, che la RPC espone, non è in nessuna migrazione:
drift di schema. Conseguenza: un database ricostruito dalle migrazioni **non** avrebbe
questa RPC (una migrazione di allineamento va scritta dal `pg_get_functiondef` live).
Prova di commutazione del tabellone sulla RPC, misurata oggi:

- righe presentabili **1 su 20** (5%) contro **10 su 58** (17%) della query attuale: la
  RPC ordina per scadenza più vicina e restituisce soprattutto righe degradate, quindi
  le pagine da 5 diventano quasi vuote (riempitivi trasparenti);
- `total_count = 34` mentre gli avvisi attivi sono **58**: il badge «avvisi attivi in
  Italia» diventerebbe **falso**, contro la regola del conteggio esatto;
- la finestra `p_window_days = 14` agisce sulla **pubblicazione**, non sulla scadenza
  (fra le righe restituite ci sono scadenze 2027-06-30);
- la RPC non restituisce `class_codes`/`materia`/`school_code`, che sono le fonti della
  colonna «Classe/Tipologia» e della risoluzione del nome istituto.

Per questo il tabellone **continua a leggere `interpelli` direttamente** (`.gte` su
`expiration_date`, ordine per `created_at`, conteggio esatto separato): il passaggio
all'RPC resta **da decidere**, insieme alla migrazione che la renda riproducibile e a
un `db push`.

**Debito dichiarato.** (1) `interpelli.link_status` e la RPC `radar_live_page` vivono
solo in produzione: da riportare in migrazione. (2) `LIMITE_RIGHE_BOARD = 10_000`
(2.000 pagine da 5): valore trovato nel codice, non deciso in questa sessione — su una
homepage pubblica sono fino a ~6 MB di payload nei casi estremi: da rivedere (il
riferimento documentato nelle guardie erano 750 righe = 150 pagine).
**CHIUSO il 30/09/2026 da §26.25**: la costante è diventata `LIMITE_RIGHE_LETTE =
1.000` (unico tetto reale di PostgREST per richiesta) e il predicato `.gte` è stato
sostituito dal filtro a doppio ramo `filtroAttivi`. (3) `estraiCitta` in
`flightBoard/righeBoard.ts` è esportato ma non più usato da nessuno (l'import orfano è
stato rimosso da `FlightBoardInterpelli`).

**Guardie preesistenti trovate rosse e riallineate** (nessuna delle due causata da
questo intervento): `test:copy:schermo` pretendeva `{metrica.etichettaTotale ??` mentre
il tabellone usa `&&` (corretto: senza conteggio il badge non si disegna; ripristinato
anche il marker `RIMOSSO (direttiva cliente)` nel docblock del componente) e
`test:board:metriche` si aspettava 150 pagine con il tetto ora a 10.000.

**File toccati.** `src/lib/urgency.ts` (nuovo, 84 righe), `scripts/test-urgenza.ts`
(nuovo, 122 righe, script `test:urgenza` + inserito in `npm test`),
`src/departments/radar/FlightBoardInterpelli.tsx` (342 righe: banda a 5 colori, import
orfano rimosso), `src/departments/radar/flightBoard/__tests__/metricaBoard.test.ts`,
`scripts/test-copy-primo-schermo.ts`, `package.json`,
`docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md}`,
`comunicazione/04_canali_regionali/checklist_regionali.md`. Nessun file di altri
dipartimenti.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:urgenza` ✓
(bande, soglie, monotonia, pulsazione unica, mezzanotte UTC, date assenti) ·
`npm run test:board` ✓ · `npm run test:board:metriche` ✓ ·
`npm run test:interpello-scadenza` ✓ · `npm run test:copy:etico` ✓ ·
`npm run test:copy:pubblico` ✓ · `npm run test:copy:schermo` ✓ ·
`npm run test:architettura` ✓ (143 violazioni = baseline, nessuna nuova) ·
`eslint` **0 problemi** sui file toccati · `npm run build` ✓ 12,01 s ·
misura sui dati reali in sola lettura ✓ (gli script di diagnostica usati per la misura
sono stati **cancellati** a fine sessione).

### 26.23 Ingestione: il nome dell'istituto letto dalla FONTE (e il gate corretto su «ASTI»)

**Nota di sessione (29/09/2026, sedicesimo intervento)** — la causa della bacheca
corta e verde non era la UI: era l'ingestione. Qui si legge il nome della scuola dalla
colonna della fonte, si impedisce che un'etichetta di materia finisca in `school_name`
e si corregge un falso positivo del gate condiviso.

**Diagnosi misurata (sola lettura, 29/09/2026).** 58 avvisi attivi · `school_name`
presente in **5 righe**, tutte JUNK («Conversazione in lingua straniera») · **53 righe
senza nome** · 13 righe con **codice meccanografico valido** · coppie codice→nome
raccoglibili dal database: **0** (il registro non si allarga da sé) · righe
presentabili in vetrina: 10, **tutte con scadenza oltre 14 giorni** → zero colori
accesi. Le tabelle delle fonti però **contengono** il nome, in una colonna accanto al
codice (`VCIC80500N | IC LIVORNO-TRONZANO | EEEE - PRIMARIA`): il dato c'era, non
veniva letto.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **`src/scraper/scuolaDaRiga.ts`** (nuovo, puro) | Legge la finestra di testo che segue (o precede) il codice meccanografico, la taglia al primo confine di cella (stato della supplenza, date, codici) e tiene il candidato più lungo che supera `nomeIstitutoPresentabile`. `null` quando non c'è un nome vero |
| 2 | **`parser.ts` ordine di priorità** | `input.schoolName` → **nome accanto al codice** → estrazioni dal testo libero **passate dal gate**: «Conversazione in lingua straniera» non entra più in `school_name` |
| 3 | **Bug del gate: «ASTI»** | `RE_SIGLA_SOSTEGNO` era `/^A[DS][A-Z]{2}$/`: «ASTI» ha esattamente quella forma (A+S+2 lettere), quindi `I.C. VILLAFRANCA D'ASTI` e `IC Asti` venivano **scartati come sigle di sostegno**. Allineato alla regola di casa (`data/classiConcorso.ts`: «in Italia ogni classe di sostegno inizia per `AD`, quindi il pattern è chiuso») → `/^AD(?:[A-Z]{2,3}|\d{2})$/` |
| 4 | **«corso» non è sempre procedura** | `I.C. CUNEO CORSO SOLERI` veniva troncato a `I.C. CUNEO` (una via scambiata per «corso di formazione»): ora `corso`/`corsi` tagliano **solo** nel sintagma di procedura |

**Misura dell'effetto (righe reali delle pagine Piemonte, sola lettura).** Prima: 0 nomi
letti. Dopo: **18 su 18 (100%)**, per esempio `ALIC81700X → «IC ALESSANDRIA SPINETTA
MARENGO»`, `ALIC832002 → «ISTITUTO COMPRENSIVO CASALE 1»`, `ATIC810006 → «I.C.
VILLAFRANCA D ASTI»`, `ATIC81800R → «ISTITUTO COMPRENSIVO 1 ASTI»`, `CNIC80200E →
«ISTITUTO COMPRENSIVO DI SCUOLA MATERNA, ELEMENTARE E MEDIA DI MOROZZO»`,
`CNIC85700P → «I.C. CUNEO CORSO SOLERI»`.

**Effetto in bacheca.** Con il nome della scuola valorizzato, le righe passano il gate
di vetrina: la bacheca si riempie e — con le scadenze entro pochi giorni, che oggi
sono proprio quelle senza nome — si accendono anche le bande arancio/giallo/rosso di
§26.22. **Le righe già in banca dati NON si aggiornano da sole**: l'upsert è
`ignoreDuplicates` su `hash_id` (che è `provincia|titolo|scadenza`, **senza**
`school_name`), quindi ogni run successivo salta le righe già presenti e un nuovo
re-scrape non le arricchirebbe mai: serve un backfill dedicato, **eseguito** in §26.24.

**Debito dichiarato.** (1) **Copertura**: 50 delle 58 righe attive non hanno nemmeno un
codice meccanografico da cui leggere il nome (titoli = dump di codici dall'aggregatore),
quindi restano fuori vetrina finché la fonte non pubblica il nome (§26.24). (2)
**Apostrofo**: verificato che la pagina ufficiale pubblica proprio `I.C. VILLAFRANCA D
ASTI` senza apostrofo — nessuna perdita in estrazione, il dato scritto è fedele alla
fonte (§26.24). (3) **Fonti senza codice meccanografico**: senza codice non c'è nessuna
colonna da cui leggere il nome (`scuolaDaRiga` restituisce `null`, come deve). (4)
`scuolaDaRiga` è ancora **sconosciuto al gate strutturale** come ogni file del parser:
`parser.ts` (1165 righe) e `index.ts` (1747) restano debito di split congelato.

**File toccati.** `src/scraper/scuolaDaRiga.ts` (nuovo, 118 righe),
`src/scraper/parser.ts` (import + priorità della scuola),
`src/lib/nomeIstituto.ts` (due correzioni al gate: sigla sostegno, «corso»),
`scripts/test-scuola-da-riga.ts` (nuovo, `test:scuola-riga`, in `npm test`),
`scripts/test-nome-istituto.ts` (4 verifiche nuove, incluse le `codiciSostegno` del
catalogo), `package.json`, `docs/{SYSTEM_HANDOVER.md,DEPARTMENT_MAP.md}`,
`comunicazione/04_canali_regionali/checklist_regionali.md`. Nessun file di altri
dipartimenti.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:scuola-riga`
✓ (18 controlli: righe reali, mai indovinare, codice prima/dopo il nome) ·
`npm run test:nome-istituto` ✓ · `npm run test:board` ✓ · `npm run test:board:metriche` ✓ ·
`npm run test:scraper:domini|fonti|attivi` ✓ · `npm run test:parser` (+ `:tabelle`, `:date`,
`:materia`, `:validazione`) ✓ ·
`npm run test:qualita` ✓ · `npm run test:copy:etico|pubblico|schermo` ✓ ·
`npm run test:urgenza` ✓ · `npm run test:architettura` ✓ (143 = baseline) ·
`eslint` **0 problemi** sui file toccati · `npm run build` ✓ · `npm test` ✓ catena
completa. Misure su dati reali in sola lettura ✓ (gli script di diagnostica usati per
la misura sono stati **cancellati** a fine sessione).

### 26.24 Backfill dei nomi istituto su `interpelli` (perché lo scraper NON basta)

**Il problema strutturale.** L'upsert dello scraper è
`.upsert(righe, { onConflict: 'hash_id', ignoreDuplicates: true })` e `hash_id` è
`provincia|titolo|scadenza` (`generaHashId`, `parser.ts`): **il nome della scuola non
fa parte dell'identità** della riga. In `index.ts` il gate di novità precede l'upsert
(`if (hashEsistenti.has(u.hashId)) return false`), quindi un run successivo salta gli
avvisi già presenti e **non li arricchisce mai**. Corollario operativo: per sanare i
record esistenti serve un `UPDATE` per `id`, non un nuovo scrape.

**Attrezzi aggiunti (29/09/2026).**
- `scripts/lib/scuolaDaPagina.ts` (nuovo, 144 righe): factory `creaRisolutore({ maxFetch })`
  con cache per URL e budget di rete; risolve il nome in ordine di affidabilità
  **titolo** (`estraiScuola` dello scraper) → **fonte** (`scuolaDaRiga` sulla pagina
  `source_url`: prima l'intera pagina, poi la finestra di ±600 caratteri attorno al
  titolo, utile nelle pagine multi-riga) → **registro** (`nomeScuolaDaCodice`). Ogni
  candidato passa il gate `nomeIstitutoPresentabile`; fonte non leggibile (403/timeout,
  PDF) o nessun candidato ⇒ `null`, mai un nome inventato.
- `scripts/backfill-nomi-istituto.ts` (nuovo, 193 righe) + `npm run dati:backfill-scuole`:
  dry-run per default, `--apply` per scrivere (service role), `--max-fetch=N` per
  limitare le richieste alle fonti. Lavora sulle sole righe con scadenza non passata
  (quelle che possono entrare in bacheca), scrive **solo** `school_name` e — se mancava —
  `school_code`, e non sovrascrive un nome già presentabile. A fine run stampa il report
  con le bande di urgenza §26.22 e l'elenco delle righe che il tabellone mostra.

**Risultato misurato (dati reali, 29/09/2026).** `interpelli`: 587 righe totali, 58 con
scadenza non passata, **0 con un nome presentabile** prima del backfill. Dopo l'`--apply`
(8/8 patch scritte, 0 errori): 8 righe arricchite **dalla fonte**, 0 dai titoli, 0 dal
registro. Righe ora in vetrina, con la banda §26.22:

| Prov | Scuola (scritta in `school_name`) | Codice | Banda |
|---|---|---|---|
| NO | I C DUCA D AOSTA | NOIC826004 | Ultime 48h |
| VC | IC LIVORNO-TRONZANO | VCIC80500N | Ultime 48h |
| CN | I.C. S.GRANDIS DI BORGO SAN DALMAZZO | CNIC80800D | Scade tra 3g |
| AT | I.C. CANELLI | ATIC81300N | Scade tra 7g |
| TO | IC BALANGERO | TOIC829003 | In corso |
| VC | ISTITUTO COMPRENSIVO DON E. FERRARIS | VCIC80600D | In corso |
| TO | I.C. SANTA MARIA | TOIC88500B | In corso |
| AT | I.C. VILLAFRANCA D ASTI | ATIC810006 | In corso |

Tre dei nomi scritti hanno **sostituito il valore errato** `Conversazione in lingua
straniera` (etichetta di materia, ora respinta dal gate `nomeIstitutoPresentabile`): è la
dimostrazione che il vecchio `school_name` non era «un dato da preservare».

**Effetto sul prodotto.** Il tabellone «Radar Live» smette di essere verde mono-banda:
4 bande accese (rosso ultime 48h, arancio entro 3 giorni, ambra entro 7 giorni, verde in
corso) esattamente come previsto da §26.22, e le 5 righe con scadenza ravvicinata —
prima invisibili perché senza nome — sono ora quelle che spingono il cambio colore.

**Le 50 righe non risolte (debito di copertura).** Hanno titoli che sono dump di codici
(`AAAA | BB02 | ADEE |`, `annotazione_INTERPELLO – Classe di concorso A042 …`), nessun
codice meccanografico e `source_url` che punta all'indice dell'aggregatore: non esiste
nessuna colonna da cui leggere il nome, quindi restano fuori vetrina. Non è un bug del
backfill: è il limite della fonte. Per recuperarle serve che l'aggregatore esponga il
nome per riga (o una mappatura provincia+classi, oggi inesistente: 0 coppie codice→nome
nel registro per quelle righe).

**Correzione a §26.23(2) — l'apostrofo non è un bug di estrazione.** Scaricando la pagina
ufficiale (`servizi.istruzionepiemonte.it/interpello2026/ric_interpello_ambito_at.php`) e
decodificando le entità HTML (`&rsquo;`, `&#39;`) la riga della fonte recita
`ATIC810006 I.C. VILLAFRANCA D ASTI …`: **l'apostrofo non c'è nella fonte**. Il valore
scritto è quindi fedele e verificabile; il «ripristino dell'apostrofo» che era in
backlog è stato chiuso come **non applicabile** (mai correggere la fonte con una
conoscenza esterna).

**Il run completo dello scraper non è stato lanciato (scelta consapevole).**
`npm run scrape` senza `--dry-run` avrebbe: (a) inserito solo avvisi NUOVI (le righe
esistenti sarebbero state saltate, quindi **non** avrebbe risolto nulla di questo
backfill) e (b) **pubblicato sui canali Telegram reali e inviato alert PRO agli utenti**
(`pubblicaNuoviSuCanali`, `inviaAlertTelegramTempoReale` — `SCRAPER_TELEGRAM_REALTIME=0`
disattiva solo gli alert PRO, non i canali): azione irreversibile e di prodotto, quindi
lasciata alla decisione dell'utente. È stato invece eseguito `npm run scrape -- --dry-run`
(sicuro: nessuna scrittura, nessun invio): **107 voci estratte, 97 uniche**, da 4 fonti
(3 hub di USR Piemonte + aggregatore nazionale, 43 fonti attive, 19/20 regioni coperte);
di queste, 9 scartate come già scadute e 91 scartate dal gate di link, segno che la
maggior parte delle voci dell'aggregatore è di qualità bassa (titoli = codici, nessuna
scadenza) — la stessa ragione per cui 50 righe restano fuori vetrina.

**File toccati.** `scripts/backfill-nomi-istituto.ts` (nuovo, 193 righe),
`scripts/lib/scuolaDaPagina.ts` (nuovo, 144 righe), `package.json` (script
`dati:backfill-scuole`), `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`.
Dati (non codice): 8 righe di `interpelli` (`school_name`/`school_code`), via service
role. Nessun file di altri dipartimenti: si resta nel perimetro Radar + condivisi
essenziali (`src/lib/**`, `src/scraper/**`).

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 · `npm run test:architettura` ✓ 143
(baseline, **nessuna violazione nuova**: il primo tentativo era `W-DIM 297 righe` e il
file è stato diviso a 193 + 144) · `eslint` sui due file nuovi ✓ 0 · `npm test` ✓ catena
completa · `npm run build` ✓ · sonda end-to-end del modulo (2 righe reali su pagine di
USR Piemonte → `IC LIVORNO-TRONZANO`, `I.C. CANELLI`; riga senza codice → `null`;
budget rispettato) poi **cancellata**. Verifica indipendente sull'effetto: nuovo run in
dry-run con `--max-fetch=0` → 8 righe «nome già presentabile», 0 patch (il DB è
coerente) — la scrittura non è «dichiarata», è riletta dal database.

### 26.25 «Radar Live» su scala nazionale: filtro a doppio ramo, 1.000 righe, alternanza per provincia — *la scala “1.000 righe” è superata da §26.34 (lettura a pagine)*

**Il problema.** La bacheca homepage leggeva `interpelli` con
`.gte('expiration_date', oggi)`: una riga **senza scadenza** non soddisfa un `gte`
(qualsiasi confronto con `NULL` è falso), quindi restava in tabella ma non
arrivava mai alla pagina — e il fallback «senza scadenza ma pubblicato negli ultimi
60 giorni», già scritto in `preparaRigheBoard`, era **codice morto**: il database
scartava prima. Misurato il 30/09/2026: **58 righe** visibili su **623 candidate**,
e in più il tabellone era già **troncato da un `.put()`**: `preparaRigheBoard`
chiamava un metodo inesistente sull'array (nessun `push`), quindi `npm run
typecheck` non passava (`TS2339: Property 'put' does not exist on type
'RigaBoardCompleta<R>[]'`) e la funzione sarebbe esplosa al primo giro con una riga
valida.

**Fix 1 — filtro a doppio ramo (una regola, due implementazioni).**
`filtroAttivi(oggi)` (`radar/flightBoard/filtroAttivi.ts`, puro) genera
l'espressione PostgREST
`expiration_date.gte.<oggi>,and(expiration_date.is.null,created_at.gte.<oggi−60g>)`,
usata **sia** dalla lettura righe **sia** dal conteggio `head: true` (mai un totale
che parla di avvisi diversi da quelli leggibili). La data è quella **locale**, mai
`toISOString()`: alle 00:30 ora di Roma la data UTC è ancora ieri e gli avvisi che
scadono oggi uscirebbero dal tabellone. Lo stesso significato è applicato in
memoria da `preparaRigheBoard` (`GIORNI_FINESTRA_SENZA_SCADENZA = 60`, giorni di
calendario — non «due mesi», che sono 59–62): doppia difesa, un solo significato.
`RigaBoard.scadenza` → `string | null` con `senzaScadenza: boolean`, così la
provenienza della riga è dichiarata e verificabile.

**Fix 2 — mai una data inventata.** Prima il fallback scriveva
`scadenza = created_at`, cioè la data di **pubblicazione** usata come scadenza: la
colonna avrebbe mostrato una data finta e `calcolaUrgenza` avrebbe restituito la
banda «Concluso» — banda che per contratto non deve mai comparire in bacheca. Ora
la cella mostra la banda `sconosciuto` («Scadenza n/d») e, al posto della data, la
**data di pubblicazione** (`Pubblicato 12 set`, `dataItBreve` nel componente): un
fatto vero, chiaramente etichettato come pubblicazione.

**Fix 3 — scala.** `LIMITE_RIGHE_LETTE = 1.000` al posto di
`LIMITE_RIGHE_BOARD = 10.000` (fuorviante: PostgREST non restituisce più di 1.000
righe per richiesta) e ordinamento `created_at DESC` + `expiration_date ASC` (a
parità, scade prima). Il `+` dell'etichetta di pagina continua a dichiarare che il
database ha altri avvisi.

**Superato dal §26.34 (02/10/2026).** `LIMITE_RIGHE_LETTE` **non esiste più**: la
bacheca legge a PAGINE (`flightBoard/letturaBoard.ts`). *(Il `+` di maggiorazione — pensato per il caso «il database è cresciuto fra il conteggio e la lettura» — è stato rimosso il 03/10/2026: §26.42, l'etichetta è `Schermata X di Y` contata sulle righe in vetrina.)* Il tetto di PostgREST (1.000)
non è una scala di prodotto: con l'ordinamento per pubblicazione decrescente tagliava in
silenzio proprio le righe più vecchie.

**Fix 4 — diversità geografica.** `diversificaProvince(righe)`
(`lib/liveBoard.ts`, puro): round-robin deterministico per codice provincia
(maiuscolo; righe senza provincia raggruppate insieme) che conserva l'ordine di
arrivo dentro ogni provincia. Nessuna casualità: il tabellone non «balla» a ogni
refetch. Effetto misurato sulle righe reali presentabili:

| | prime 10 province |
|---|---|
| senza alternanza | `AT TO RI RI RI RI RI RI RI PD` (7/10 dalla stessa provincia) |
| con alternanza | `AT TO RI PD VC NO CN AT TO RI` |

prima pagina: **5/5 province diverse** (direttiva cliente: nessuna provincia
monopolizza le prime pagine).

**Misure reali (30/09/2026, sonda in sola lettura poi cancellata).** `interpelli`:
**623 righe**, tutte dentro il nuovo filtro; **565 senza scadenza** = recuperate
dalla finestra dei 60 giorni; **69 presentabili in vetrina** (erano 17: il tabellone
passa da 4 a 14 pagine da 5). Bande sulle righe presentabili:
`inCorso 14 · oggi 2 · ultime48 1 · entro7 1 · sconosciuto 51` — il multi-colore
§26.22 regge, e la banda `sconosciuto` è la conseguenza dichiarata della direttiva
«includi gli avvisi non datati». Esempio di prima pagina reale: `AT · I.C. CANELLI ·
06 ott`, `TO · I.C. SANTA MARIA · 18 ott`, `RI · I.C. Ferruccio Ulivi · Pubblicato
02 set`, `PD · IC di Campodarsego · 23 dic`, `VC · IC LIVORNO-TRONZANO · 30 set`.

**Regole di prodotto aggiornate.** `comunicazione/04_canali_regionali/checklist_regionali.md`:
§4 — la bacheca include gli avvisi **senza scadenza** pubblicati negli ultimi 60
giorni (banda «Scadenza n/d» + data di pubblicazione) e alterna le righe per
provincia; §5 — aggiunte le guardie `test:board:scala` e `test:board:filtro`.

**File toccati.** `src/lib/liveBoard.ts` (209 righe: fix del `.put()`, finestra
60 giorni, `senzaScadenza`, `diversificaProvince`),
`src/departments/radar/flightBoard/filtroAttivi.ts` (nuovo, 49),
`.../flightBoard/metricaBoard.ts` (`LIMITE_RIGHE_LETTE`),
`.../radar/FlightBoardInterpelli.tsx` (filtro, ordinamento, alternanza, cella
Scadenza), `.../flightBoard/__tests__/filtroAttivi.test.ts` (nuovo, 68),
`.../__tests__/metricaBoard.test.ts`, `scripts/test-live-board.ts` (215),
`scripts/test-live-board-scala.ts` (nuovo, 170), `package.json`,
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`,
`comunicazione/04_canali_regionali/checklist_regionali.md`. Nessun file di altri
dipartimenti: perimetro Radar + condivisi essenziali (`src/lib/**`).

**Verifiche (30/09/2026).** `npm run typecheck` ✓ 0 · `npm run test:architettura` ✓
143 di baseline, **0 violazioni nuove** (primo tentativo: `E-DIM
scripts/test-live-board.ts` a 360 righe → diviso in 215 + 170) · `npm test` ✓ catena
completa · `npm run build` ✓ · `eslint` ✓ 0 sui file toccati · guardie mirate
`test:board` ✓, `test:board:scala` ✓ (14 asserzioni), `test:board:filtro` ✓ (12),
`test:board:metriche` ✓. Sonda live in sola lettura sui dati reali (numeri sopra)
poi **cancellata**.

### 26.26 Slogan della pagina Notizie: il contesto scolastico entra nella frase

**La frase.** Lo slogan della testata editoriale (`SLOGAN_NOTIZIE`, dipartimento
Notizie) era l'unico testo pubblico della pagina a omettere il contesto:
«Quando vuoi sapere cosa succede di importante, vieni qui!». Ora dice
**«Quando vuoi sapere cosa succede di importante nella scuola, vieni qui!»**,
allineato alle CTA di Notizie già in uso nelle notifiche (email e Telegram:
`CTA_NOTIZIE_TESTO` in `src/lib/alertInterpello.ts`, `CTA_NOTIZIE_TESTO_EMAIL`
in `src/lib/resend.ts`), che citavano già la scuola.

**Natura della modifica.** Solo copy: un **unico letterale** (riga 19 di
`NotizieHero.tsx`), nessuna logica, nessuna prop, nessuna firma di componente.
Le virgolette «…» restano aggiunte dal presentatore
(`components/hero/TestataEditoriale.tsx`, `«{slogan}»`): il testo a schermo resta
una riga sola, con il punto esclamativo finale.

**File toccati.** `src/departments/notizie/components/NotizieHero.tsx` (il solo
letterale), `docs/SYSTEM_HANDOVER.md`. Nessun file di altri dipartimenti
(perimetro Notizie, nessun condiviso essenziale coinvolto); le CTA di notifica
non sono state toccate perché già corrette.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run
test:architettura` ✓ nessuna violazione nuova (529 file, 143 di baseline) ·
`eslint src/departments/notizie/components/NotizieHero.tsx` ✓ 0 · `npm run build`
✓ (1959 moduli) · guardie Notizie: `test:notizie-editoriale` ✓ e
`test:notizie-nazionale` ✓; `test:notizie-feed` e `test:notizie-rate` falliscono
sul criterio **«almeno 1 articolo negli ultimi 7 giorni»** (articolo più recente
24/09/2026): fallimento **guidato dai dati**, indipendente dalla copy — i due
script importano solo `data/**` e `types.ts`, non citano né lo slogan né il
componente · occorrenza **unica** nel repo: nessun test o documento citava la
vecchia formulazione (nessuna guardia di copy da aggiornare) · resa live
verificata sul dev server (`localhost:5174`): modulo `NotizieHero.tsx` servito con
**1** occorrenza della nuova frase e **0** della vecchia.

### 26.27 DEV Toolbar — «Editor Testi Rapido»: modifica dei testi chiave al volo

**Cosa fa.** Nuova sezione **collassabile** della DEV Toolbar (`EditorTestiRapido`,
subito sopra «Reset»): elenca i testi del registro con una `<textarea>` per chiave;
digitando, il testo cambia **all'istante** dove è usato e viene salvato in
`localStorage: sr_simple_text_overrides`. Il pulsante «Reset testi (default)» riporta
tutto ai default del codice e cancella la chiave salvata. Nessun builder visuale,
nessuna modale, nessun wrapper: solo caselle di testo (richiesta dell'utente).

**Come è fatto (4 file nuovi, tutti < 250 righe).**
- `src/data/editableTexts.ts` (135) — registro PURO `chiave → testo di default`
  (`TESTI_EDITABILI`, **30 chiavi**): 12 FAQ pubbliche (`faq.<slug>.domanda|risposta`,
  slug = ancore pubbliche laddove esistono) + i 3 blocchi dell'offerta PRO della
  vetrina di homepage (`prezzi.offerta.<blocco>.titolo|testo`). Espone `ChiaveTesto`,
  `CHIAVI_TESTO`, `testoDiDefault`, `eChiaveTesto`, `gruppiTesti()`.
- `src/lib/testiModificabili.ts` (137) — store senza React (stesso schema di
  `src/config/features.ts`): snapshot stabile per `useSyncExternalStore`, letture
  tolleranti (JSON corrotto / chiavi fuori registro / valori vuoti → default),
  `impostaTesto` senza scritture inutili, `azzeraTesti`.
- `src/hooks/useTestiEditabili.ts` (61) — `testo(chiave)`, `imposta`, `azzera`, `testi`,
  `modificati`; gli override vengono applicati **solo** con `import.meta.env.DEV`:
  in build di produzione la copy è sempre quella del registro.
- `src/components/EditorTestiRapido.tsx` (101) — la sezione (raggruppata per prefisso,
  contatore delle voci modificate, evidenziazione dei campi modificati, reset).

**Superfici cablate (rendono per CHIAVE, nessuna copy duplicata nel JSX).**
`src/pages/FAQPage.tsx` (le voci sono una lista `id` + chiavi in `data/faqPubbliche.ts`; i testi sono
stati spostati **verbatim** nel registro — verifica a macchina: 12 voci, 0
differenze rispetto a `HEAD`; dal 29/09/2026 le voci sono **8**, §26.29), la sezione «Domande frequenti» di `src/pages/PrezziPage.tsx` (stesse chiavi, 🔒: cablata il 29/09/2026) e `src/components/landing/LandingOffertaPro.tsx`
(`PUNTI` con chiavi; restano inline la copy autorizzata dal cliente e
`GIORNI_TRIAL_PRO`, sorvegliati dalle guardie). `src/components/DevToolbar.tsx` monta
la sezione (due commenti e una riga di markup compattati per non superare le 250
righe).

**Vincolo 🔒 — sblocco mirato e ri-bloccato (29/09/2026).** `src/pages/PrezziPage.tsx` è registrato
**BLOCCATO** in `LOCKED_MODULES.md`: del listino (piani, importi, vantaggi) **non**
si tocca nulla; con autorizzazione esplicita dell'utente (la richiesta nominava pagina
e FAQ) è stata sostituita e cablata la **sola sezione «Domande frequenti»**, che rende per
chiave le stesse voci di `/faq` (`src/data/faqPubbliche.ts`) e viene ri-bloccata subito.

**Guardie aggiornate (copy di prodotto intatta).** La copy della FAQ e i tre blocchi
dell'offerta vivono ora nel registro: `test-copy-pubblico.ts` e `test-copy-etico.ts`
la controllano **nel registro** e pretendono il **cablaggio** (import + render
`testo(...)`), così né un doppione nel JSX né una pagina scollegata passano
inosservati. Nuovo `scripts/test-editor-testi.ts` (`npm run test:editor-testi`,
inserito in `npm test`): 36 asserzioni (§26.28) su registro, copy dell'offerta (nessuna cifra,
nessuna parola di televendita), store (scrittura/rilettura della chiave, precedenza,
reset, notifiche, tolleranza) e cablaggio (sezione nella DEV Toolbar, pagine per
chiave, elenco condiviso `/faq` ↔ `/prezzi`).

**File toccati.** Nuovi: `src/data/editableTexts.ts`, `src/lib/testiModificabili.ts`,
`src/hooks/useTestiEditabili.ts`, `src/components/EditorTestiRapido.tsx`,
`scripts/test-editor-testi.ts`. Modificati: `src/components/DevToolbar.tsx`,
`src/pages/FAQPage.tsx`, `src/components/landing/LandingOffertaPro.tsx`,
`scripts/test-copy-etico.ts`, `scripts/test-copy-pubblico.ts`, `package.json`,
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. **Nessun file di dipartimenti**
(non è un lavoro di dipartimento: dev tooling condiviso + pagine pubbliche);
`src/pages/PrezziPage.tsx` non toccato (era 🔒); l'intervento autorizzato del 29/09/2026
(sola sezione FAQ) è documentato in §26.28.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ **0 errori** (primo giro: il
sostituendo di `{f.q}` in `FAQPage` aveva rimosso la riga del `<span>`: errore di
parsing JSX intercettato da `eslint`, ripristinato) · `eslint` ✓ 0 sui 10 file toccati
· `npm run build` ✓ (1963 moduli, 43,17 s) · `npm run test:architettura` ✓ nessuna
violazione nuova (534 file, 143 di baseline; primo giro: le due guardie di copy a
252/257 righe → aggiunte compattate) · `npm run test:editor-testi` ✓ 31/31 (36/36 dopo §26.28) ·
`test:copy:etico` ✓ · `test:copy:pubblico` ✓ · `test:checkout-promo` ✓ (controlla
l'ancora `#animatore-digitale`, intatta) · dev server riavviato in background su
`http://localhost:5174`.


---

### 26.28 FAQ pubbliche — 4 nuove voci su `/faq` e `/prezzi`: elenco unico condiviso

**Richiesta (29/09/2026).** Sostituire le FAQ «ansiogene» con domande di posizionamento
commerciale e istruzioni pratiche, **su entrambe le superfici** (pagina FAQ e pagina
Prezzi).

**Le 4 voci (copy del cliente, verbatim).**

| # | Domanda | Chiave del registro | Cosa cambia |
|---|---|---|---|
| 1 | Posso pagare con la Carta del Docente? | `faq.carta-docente.risposta` | risposta riscritta: «stiamo valutando per il futuro» + invito a segnalarlo dal modulo contatti |
| 2 | Qual è il piano più conveniente per accedere a tutto? | `faq.piano-conveniente.*` | **nuova**: PRO Annuale = massimo risparmio, accesso illimitato, PureFocus |
| 3 | Come posso regalare un anno di Scuole Radar PRO a un collega? | `faq.regala-pro-collega.*` | **nuova** |
| 4 | Non riesco a registrarmi con l'email scolastica (.edu.it), cosa devo fare? | `faq.accesso-google-edu.*` | domanda e risposta riscritte in chiave pratica: filtri della scuola → Animatore Digitale / Responsabile Informatico |

**Voci uscite.** `faq.fine-prova.*` («Cosa succede quando finisce la prova inclusa?»):
l'informazione resta sulla homepage nella vetrina PRO con la copy autorizzata («passerai
automaticamente a un account Base», sorvegliata da `test:copy:etico`). La FAQ «Che
differenza c'è tra il piano Base e il PRO?» di `/prezzi` (importi nel testo) è sostituita
dalla nuova #2. Restano le voci di posizionamento e di strumento (Radar, Animatore
Digitale, Invita un Collega, PureFocus, CV, Calcolatore CFU, Modulistica, Assistente
Sindacalista).

**Elenco unico, zero doppioni.** Nuovo `src/data/faqPubbliche.ts` (48 righe, modulo puro
`{ id, q, a }`): le stesse 12 voci nello stesso ordine per `FAQPage` e `PrezziPage`. Prima
le due pagine tenevano due liste di copy **divergenti** (stesse domande, risposte
leggermente diverse): ora la copy vive **solo** nel registro `src/data/editableTexts.ts`
(30 chiavi = 24 FAQ + 6 offerta) e le pagine rendono per chiave (`useTestiEditabili`).

**Modulo 🔒 — sblocco mirato e ri-blocco.** `src/pages/PrezziPage.tsx` è BLOCCATO
(`LOCKED_MODULES.md`): la richiesta nominava esplicitamente pagina Prezzi e FAQ, quindi è
stata trattata come autorizzazione e l'intervento è stato **limitato alla sola sezione
«Domande frequenti»** (import + hook + render per chiave; ~26 righe di copy in meno, file
da 375 a 351). Piani, importi, vantaggi, PureFocus, checkout e CTA **non** toccati e
nessuna chiave `prezzi.*` del listino nel registro: l'invariante è ora verificata a
macchina. Il modulo è stato **ri-bloccato** aggiornando la sua riga nel registro.

**Guardie aggiornate.** `test:editor-testi` (30 chiavi, 12 FAQ, presenza delle 4 voci e
della copy richiesta, elenco condiviso su entrambe le pagine, ancore pubbliche
nell'elenco, listino ancora nel file) · `test:copy:pubblico` (copy commerciale nel
registro + elenco condiviso) · `test:checkout-promo` (l'ancora `#animatore-digitale` è ora
nell'elenco condiviso). Nota di prodotto da decidere: la FAQ #2 dice «massimo risparmio
equivalente a **mesi gratuiti**» — la checklist pagamenti (§4) vieta «gratuito» riferito a
piani a pagamento e ammette per il mese incluso la forma «in omaggio». La copy è stata
inserita **verbatim come richiesta**; la variante conforme («due mesi in omaggio») si
applica in un istante dall'«Editor Testi Rapido».

**File toccati.** Nuovo: `src/data/faqPubbliche.ts`. Modificati:
`src/data/editableTexts.ts`, `src/pages/FAQPage.tsx`, `src/pages/PrezziPage.tsx` 🔒,
`scripts/test-editor-testi.ts`, `scripts/test-copy-pubblico.ts`,
`scripts/test-checkout-promo.ts`, `LOCKED_MODULES.md`, `docs/SYSTEM_HANDOVER.md`,
`docs/DEPARTMENT_MAP.md`. Nessun file di dipartimenti (pagine pubbliche + dev tooling
condiviso): nessuna lettura fuori perimetro.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:editor-testi`
✓ 36/36 · `test:copy:etico` ✓ · `test:copy:pubblico` ✓ · `test:checkout-promo` ✓ ·
`npm run test:architettura` ✓ nessuna violazione nuova (535 file, 143 di baseline) ·
`eslint` ✓ 0 sui file toccati · `npm run build` ✓ (1964 moduli, 34,42 s) · dev server
riavviato in background su `http://localhost:5174`.

---

### 26.29 FAQ pubbliche — selezione editoriale: da 12 a 8 voci, copy del cliente

**Richiesta (29/09/2026, secondo intervento su `/faq` e `/prezzi`).** (1) togliere le domande
ansiogene o difensive (disdette, sicurezza dei pagamenti); (2) togliere i rimandi a funzioni
non attive (generatore CV, Archivista AI, Tabelle A/B del D.P.R. 19/2016); (3) riscrivere le
voci restanti con la copy positiva fornita dal cliente.

**Elenco risultante: 8 voci** (erano 12), stesso ordine su `/faq` e su `/prezzi`: la lista
`id` + chiavi sta in `src/data/faqPubbliche.ts`, i testi nel registro `src/data/editableTexts.ts`.

| # | Domanda (chiave) | Cosa cambia |
|---|---|---|
| 1 | Come funziona il Radar e cosa mi arriva? (`faq.radar-personalizzati.*`) | invariata |
| 2 | Animatore Digitale / siti sicuri della scuola (`faq.animatore-digitale.*`) | invariata — `#animatore-digitale` è ancora PUBBLICA (`AuthModal` → `NotaAccessoScolastico`) |
| 3 | Non riesco a registrarmi con l'email scolastica (.edu.it) (`faq.accesso-google-edu.*`) | invariata (già identica al brief) |
| 4 | Come funziona «Invita un Collega»? (`faq.invita-un-collega.risposta`) | RISCRITTA: sezione nella BACHECA, **10 € di sconto** per chi si abbona e **buono Amazon da 10 Euro** per chi invita |
| 5 | Posso pagare con la Carta del Docente? (`faq.carta-docente.risposta`) | invariata (valutazione futura + modulo contatti) |
| 6 | Qual è il piano più conveniente per accedere a tutto? (`faq.piano-conveniente.*`) | invariata |
| 7 | Come posso regalare un anno di Scuole Radar PRO a un collega? (`faq.regala-pro-collega.risposta`) | RISCRITTA: codice «Invita un collega» (10 Euro di sconto / 10 Euro di credito Amazon), regalo annuale **in valutazione**, risposta dal modulo contatti |
| 8 | PureFocus richiede un account nuovo? Funziona con la mia Gmail? (`faq.purefocus-gmail.*`) | domanda e risposta RISCRITTE: cos'è PureFocus (YouTube senza distrazioni), incluso in Scuole Radar PRO con le **stesse credenziali**, meglio con un **account Gmail**, accesso da `scuoleradar.it` o `purefocus.one` |

**Voci uscite (4) — e le loro ancore.** `faq.cv-non-pronto.*` (generatore CV),
`faq.classi-di-concorso.*` (Tabelle A/B), `faq.modulo-introvabile.*` (Archivista AI),
`faq.dubbio-norma.*` (annuncio «sta arrivando» dell'Assistente Sindacalista Virtuale: elencato
come vantaggio PRO nel listino, ma non ancora attivo). Le ancore `#cv-non-pronto`,
`#classi-di-concorso`, `#modulo-introvabile`, `#dubbio-norma` **non erano linkate da nessuna
superficie** (verificato prima della rimozione): l'unica ancora pubblica resta
`#animatore-digitale`.

**Registro.** `src/data/editableTexts.ts`: 30 → **22 chiavi** (16 FAQ + 6 offerta), 135 → 126
righe, con la REGOLA DI CONTENUTO delle FAQ nel commento di testa. `src/data/faqPubbliche.ts`:
48 → 51 righe (commento di testa riscritto: ordine di lettura, voce editoriale, ancore uscite).

**Guardie.** `test:editor-testi` ✓ 22 chiavi / 8 FAQ / 6 chiavi riscritte, cablaggio e store ·
`test:copy:pubblico` ✓ frammenti approvati verificati **nel registro** (buono Amazon da 10 Euro,
account Gmail, credito Amazon, Carta del Docente, Invita un Collega, piano conveniente) e
**nuovo invariante** «nessun rimando a funzioni non attive (CV, Archivista AI, Tabelle A/B)»
accanto a «nessuna domanda difensiva (cancellazione / sicurezza pagamenti)» · `test:copy:etico` ✓ ·
`test:checkout-promo` ✓ (ancora `#animatore-digitale` integra).

**Nota di processo.** La prima stesura portava `scripts/test-editor-testi.ts` a **260 righe**:
`test:architettura` l'ha segnalata come violazione **nuova** (`W-DIM` > 250). Il file è stato
ricompatto a **238 righe** spostando le asserzioni di CONTENUTO della copy nella guardia di copy
(`test:copy-pubblico.ts`, che è la guardia della copy pubblica), lasciando all'editor-testi la
sola struttura del registro. Nessuna duplicazione: struttura in un test, contenuto nell'altro.

**File toccati.** `src/data/editableTexts.ts`, `src/data/faqPubbliche.ts`,
`src/pages/FAQPage.tsx` (solo il commento di testa: la pagina rende per chiave),
`scripts/test-editor-testi.ts`, `scripts/test-copy-pubblico.ts`,
`comunicazione/05_abbonamenti_pagamenti/checklist_pagamenti.md` (la dichiarazione di
rinnovo/disdetta non vive più nelle FAQ: colonne piani + `AbbonamentoModal`),
`LOCKED_MODULES.md`, `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`.
**NON toccato:** `src/pages/PrezziPage.tsx` 🔒 — la sua sezione «Domande frequenti» legge
l'elenco condiviso, quindi i contenuti cambiano senza aprire il modulo; nessun file di
dipartimento (`src/departments/**`, `src/modules/**`): nessuna lettura fuori perimetro.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:editor-testi` ✓ nessun
problema (22 chiavi, 8 FAQ, 6 voci riscritte, cablaggio e store) · `npm run test:copy:etico` ✓ ·
`npm run test:copy:pubblico` ✓ · `npm run test:checkout-promo` ✓ (ancora `#animatore-digitale`
integra) · `npm run test:architettura` ✓ nessuna violazione nuova (535 file, 143 = baseline) ·
`eslint` ✓ 0 sui file toccati · `npm run build` ✓ (1964 moduli, 46,06 s) · dev server in background
su `http://localhost:5174` (Vite ready in 896 ms): `/faq` e `/prezzi` → **HTTP 200**, e il registro
servito da Vite contiene «buono Amazon» e «account Gmail» e **non** contiene più `Archivista` né
`cv-non-pronto`.



### 26.30 DEV Toolbar — «Editor Testi Rapido» CONTESTUALE: solo i testi della vista attiva

**Cosa cambia.** La sezione dell'editor non elenca più TUTTI i testi del registro
raggruppati per area — le fisarmoniche «FAQ pubbliche · /faq e /prezzi» e «Offerta PRO ·
homepage», generate dal `gruppiTesti()` con etichette cablate — ma mostra **solo le chiavi
che la pagina attiva sta rendendo in questo momento**. L'header dichiara la rotta
(`useLocation().pathname`) e il numero di testi presenti qui; l'elenco è piatto (una
`<textarea>` per chiave, etichetta umana + chiave tecnica), senza fisarmoniche né voci di
pagine che l'utente non ha davanti. Se la vista non rende nessuna chiave del registro il
pannello lo dichiara in una riga («Nessun testo modificabile in questa vista»), ad esempio
su `/dashboard`, `/contatti` o dentro le pagine dei dipartimenti.

**Contestualità senza nessuna mappa rotta → chiavi.** Le chiavi le iscrive CHI LE LEGGE:
`useTestiEditabili()` (le pagine) aggiunge al registro `src/lib/testiInPagina.ts` ogni
chiave passata a `testo(chiave)` e riallinea il registro dopo ogni render (così conta anche
una chiave letta solo a dati caricati); lo smontaggio del componente — cambio rotta, modale
chiusa, sezione non più resa — la toglie dal registro. Il pannello legge l'elenco con il
nuovo `useTestiInPagina()`, il cui `testo()` NON registra nulla: altrimenti l'editor
conterebbe se stesso come vista e mostrerebbe sempre tutto. Nessuna tabella di
corrispondenze da aggiornare quando nasce una superficie nuova: si cabla una chiave per
`testo(...)` e quella compare da sola nel pannello della sua pagina.

**Contratto dello store di viste (identico agli override).** Snapshot a riferimento
STABILE per `useSyncExternalStore`, notifica agli ascoltatori **solo** al cambiamento reale
(ri-render con le stesse chiavi = nessun render inutile del pannello mentre si digita),
unione delle viste riportata all'ordine di REGISTRO (`CHIAVI_TESTO`), quindi la lista non
si rimescola navigando. Registrazione idempotente sullo stesso insieme: sopravvive al
doppio mount di StrictMode.

**Live sync invariato.** Digitando, `imposta(chiave, valore)` scrive
`localStorage: sr_simple_text_overrides` e notifica lo store condiviso: il testo cambia
SUBITO dove è usato, senza reload. Nessuna modifica al percorso dei dati (hook dei testi,
store degli override e registro sono gli stessi del §26.27).

**File toccati.** Nuovo: `src/lib/testiInPagina.ts` (93). Nuovo test:
`scripts/test-editor-testi-vista.ts` (145). Modificati: `src/hooks/useTestiEditabili.ts`
(61 → 128: due API + registrazione delle chiavi lette), `src/components/EditorTestiRapido.tsx`
(101 → 133: rotta attiva, elenco contestuale, stato vuoto; via `<details>` e `gruppiTesti()`),
`src/data/editableTexts.ts` (126 → 100: rimossi `gruppiTesti()`, `ETICHETTE_GRUPPI`,
`GruppoTesti`), `src/components/DevToolbar.tsx` (solo il commento sopra la sezione),
`scripts/test-editor-testi.ts` (240 → 242: asserzioni di contestualità, niente più
raggruppamenti), `package.json` (catena `test` + `test:editor-testi` con il secondo script).
**NON toccato:** `src/pages/PrezziPage.tsx` 🔒 — la sua sezione FAQ continua a leggere il
registro tramite l'hook e la registrazione della vista è trasparente per il consumatore;
nessun file di dipartimento (`src/departments/**`, `src/modules/**`): non è un lavoro di
dipartimento ma di dev tooling condiviso + dati/pagine pubbliche.

**Guardie.** `npm run test:editor-testi` (catena di due script) copre registro, store, copy
e cablaggio; il nuovo `scripts/test-editor-testi-vista.ts` ESEGUE il registro delle viste in
Node: vista singola = solo le sue chiavi in ordine di registro, due viste = unione,
smontaggio = uscita delle chiavi, snapshot a riferimento stabile, notifiche solo al
cambiamento reale, StrictMode senza duplicati; più le asserzioni di cablaggio (hook delle
pagine che registra, hook dell'editor che NON registra, pannello senza `<details>`/elenchi
di altre pagine, registro senza raggruppamenti cablati).

**Nota di processo.** La prima stesura portava `scripts/test-editor-testi.ts` a **252
righe**: `test:architettura` l'ha segnalata come violazione **nuova** (`W-DIM` > 250), come
già successo in §26.29. Il file è stato ricompatto a **242 righe** e la verifica del
registro delle viste è finita in un file suo (`test-editor-testi-vista.ts`, 145 righe),
stessa policy: un test per responsabilità, nessuna duplicazione.

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:editor-testi` ✓
entrambi gli script (vecchio: nessun problema, 40 asserzioni; nuovo: 19 asserzioni, nessun
problema) · `npm run test:copy:etico` ✓ · `npm run test:copy:pubblico` ✓ ·
`npm run test:architettura` ✓ nessuna violazione nuova (537 file — due in più: il modulo e
il test nuovi — 143 = baseline) · `eslint` ✓ 0 sui 7 file toccati · `npm run build` ✓
(15,52 s) · dev server in background su `http://localhost:5174` (**Vite ready in 763 ms**):
`/`, `/faq` e `/prezzi` → **HTTP 200**; i moduli serviti contengono `useTestiInPagina` e
`chiavi.map` e **non** contengono `<details>` né `gruppiTesti` (pannello contestuale
effettivamente servito). **Fallimenti pre-esistenti, fuori perimetro:** la catena `npm test`
si ferma in `&&` a `test:copy:schermo` — «nessun riquadro ridondante fra il Radar Live e
l'offerta PRO» pretende il commento `RIMOSSO (direttiva cliente)` in
`src/departments/radar/FlightBoardInterpelli.tsx` (modificato dalle sessioni precedenti, mai
toccato qui); eseguiti a parte, `test:live-board-scala` ✓ e `test:checkout-promo` ✓, mentre
`test:live-board` (3), `test:nome-istituto` (2) e `test:urgenza` (1) falliscono su attese di
board/nomi/scadenze mai sfiorate da questa modifica (debito del working tree).

### 26.31 DEV Toolbar — «Editor Testi Rapido» UNIVERSALE: si scandisce il DOM, non si elencano chiavi

> ⚠️ **RIMOSSO il 03/10/2026 → §26.38.** Il pannello e tutta la sua scansione del DOM
> (`components/EditorTestiRapido.tsx`, `lib/testiDom.ts` + `testiDomOverride.ts`,
> `hooks/useTestiDom.ts`, `lib/testiInPagina.ts`, guardie `test:editor-testi`) non esistono più:
> l'unico strumento di editing testuale della DEV Toolbar è il **«Visual Editor»** click-to-edit
> (§26.37). Questa sezione resta come storia del ciclo (§26.27–§26.31) e come riferimento delle
> **identità dei testi** (`impronta` / `chiaveTestoDom` — `p#1a2b3c#0`), oggi usate dal Visual
> Editor: sono le stesse chiavi, quindi gli override salvati allora restano comprensibili.

**Cosa cambia.** L'editor non dipende più dal dizionario dei testi: **scandisce il DOM** della
pagina attiva e mostra **una casella per ogni blocco di testo che c'è davvero** — titoli,
paragrafi, voci di elenco, celle, pulsanti, didascalie — con l'etichetta umana del punto
(«sezione · Paragrafo»), il tag, la rotta attiva e il numero di testi nell'header («N qui»).
Nessun cablaggio nei componenti, nessuna chiave da aggiungere a `editableTexts.ts`, nessun
elenco di pagine: cambiando rotta, aprendo una modale o arrivando i dati la lista si aggiorna
da sé; se la vista non ha testi si legge una riga esplicita («Nessun testo rilevato in questa
vista»). Il pannello non elenca più le chiavi del registro: le legge solo per **azzerarle**.

**Scrittura immediata e persistente.** Digitando nella casella il testo cambia **subito** dove
è usato e l'override va in `localStorage: sr_dom_text_overrides` (`chiave → { t, v }`: `t` =
default del codice, conservato per il reset; `v` = testo scritto a mano). Svuotare la casella
(o riscrivere il default) toglie l'override. La scansione gira **sempre** in DEV — la monta la
DEV Toolbar (**non** il pannello, che può stare chiuso): dopo un reload (localStorage) e dopo
ogni ri-renderizzazione di React (che rimette la copy del codice) il testo scritto a mano torna
a schermo. L'osservatore è un `MutationObserver` sul `body` con attesa di 60 ms; le scritture
dell'editor non riaprono il ciclo (la seconda scansione non cambia nulla ⇒ nessuna notifica).

**Identità del testo, non posizione nel DOM.** `chiaveTestoDom(tag, testo, occorrenza)`
(`p#1a2b3c#0`) nasce da tag + impronta del testo di default + numero di occorrenza: resta
stabile fra una scansione, un reload e un ri-render, quindi l'override non si perde quando React
ricrea i nodi; due testi identici restano occorrenze distinte (`#0`, `#1`) e si scrive solo
quella scelta. Un `WeakMap` ricorda il testo ORIGINALE delle occorrenze toccate: al reset i nodi
tornano alla copy del codice all'istante, senza reload.

**Elenco pulito.** Si guardano solo i NODI DI TESTO con almeno 2 lettere (fuori numeri, «€ 9»,
simboli e spazi) e si saltano i contenitori tecnici (`script`, `style`, `svg`, `code`,
`textarea`…) e i pannelli DEV (`data-sr-dev-toolbar` o «DevToolbar» in `id`/`aria-label`):
l'editor non elenca — e non riscrive — se stesso. La riscrittura conserva gli spazi di bordo del
JSX, così i testi inline non attaccano le parole. «Reset testi (default)» azzera **due**
livelli: gli override sul DOM (`sr_dom_text_overrides`) e quelli del registro
(`sr_simple_text_overrides`, §26.27/§26.30), così non resta nessun testo modificato fuori vista.

**File toccati.** Nuovi: `src/lib/testiDom.ts` (141 righe), `src/lib/testiDomNodi.ts` (95),
`src/lib/testiDomRegole.ts` (69), `src/lib/testiDomOverride.ts` (115),
`src/hooks/useTestiDom.ts` (100), `scripts/lib/dom-finto.ts` (94, DOM finto riutilizzabile dai
test Node), `scripts/test-editor-testi-dom.ts` (191), `scripts/test-editor-testi-dom-cablaggio.ts`
Riscritto: `src/components/EditorTestiRapido.tsx` (133 → 145: elenco dal DOM, badge «N qui»
/ «N modificati», stato vuoto, reset a due livelli, marchio `data-sr-dev-toolbar`). Modificati:
`src/components/DevToolbar.tsx` (248: monta `useScansioneTestiDom()` **sempre**, con due righe
bianche in meno per non superare il limite), `scripts/test-editor-testi.ts` (242 → 243),
`scripts/test-editor-testi-vista.ts` (145 → 152: pannello cablato su `useTestiDomInPagina`),
`package.json` (`test:editor-testi` = quattro script). **NON toccati:** `src/pages/PrezziPage.tsx`
🔒, nessun file di dipartimento (`src/departments/**`, `src/modules/**`): è dev tooling condiviso
più `lib/` / `hooks/` / `components/` e i test.

**Guardie.** `npm run test:editor-testi` = 4 script: registro/store/copy (invariato), vista attiva
(invariato), **scansione del DOM** (27 asserzioni: rilevazione e rami ignorati, chiave stabile,
occorrenze identiche, scrittura sul nodo + `{ t, v }` nello storage, spazi di bordo, re-render di
React che non cancella l'override, ricarica che rilegge lo storage, reset che rimette i default e
svuota lo store) e **cablaggio** (15 asserzioni: moduli puri senza React, hook con
`MutationObserver` su `document.body`, DEV Toolbar che monta la scansione sempre, pannello con una
casella per testo + Reset).

**Verifiche (29/09/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:editor-testi` ✓ quattro
script, tutte le asserzioni ✓ · `npm run test:copy:etico` ✓ nessun problema ·
`npm run test:architettura` ✓ nessuna violazione nuova (**545 file** analizzati, 143 = baseline; i
moduli nuovi stanno fra 69 e 191 righe) · `npm run lint` ✓ 0 sui 12 file toccati · `npm run build`
✓ (**28,95 s**, 1.970 moduli) · dev server in background su `http://localhost:5174` (**Vite ready
in 595 ms**, PID 35796): `/`, `/faq` e `/prezzi` → **HTTP 200**; i moduli serviti contengono
`useTestiDomInPagina` + `testi.map` e **non** contengono più `chiavi.map`, e `lib/testiDomNodi.ts`
è servito con la regola dei pannelli DEV. **Debito pre-esistente, fuori perimetro:** `npm test` si
ferma in `&&` a `test:copy:schermo` — 1 errore in «nessun riquadro ridondante fra il Radar Live e
l'offerta PRO» (riguarda la landing + `src/departments/radar/`, mai toccati qui) — come già
annotato in §26.30, insieme a `test:live-board` (3), `test:nome-istituto` (2) e `test:urgenza` (1).

**Nota di processo (W-DIM, due volte).** La prima stesura di `src/lib/testiDom.ts` era di **294
righe** e `scripts/test-editor-testi-dom.ts` di **267**: `test:architettura` le ha segnalate come
violazioni **nuove** (`W-DIM` > 250), esattamente come in §26.29 e §26.30. La scansione è stata
quindi divisa in **quattro** moduli per responsabilità (regole/nomi → lettura del DOM → elenco +
override → store) e i costruttori del DOM finto sono finiti in `scripts/lib/dom-finto.ts`, riusabili
da altri test. Nota operativa: una `Remove-Item` rimasta **in coda nella shell** ha cancellato il
file appena riscritto — il contenuto è stato ricreato e riverificato per intero prima di chiudere.

### 26.32 Tema autonomo «Intelligenza Artificiale» nel motore editoriale Notizie

**Nota di sessione (01/10/2026).** L'intelligenza artificiale era una parola dentro
*Innovazione Digitale*: una notizia sull'IA a scuola finiva nel calderone della innovazione
digitale (PNSD, coding, robotica) e non aveva né badge, né peso, né copy propri. Ora è una
**categoria autonoma** dell'allow-list. Integra §26.11 senza toccarne gli invarianti: nulla è
stato rimosso dai temi storici, nessun peso esistente è cambiato.

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | **Nuovo blocco `standardTemiIA.ts`** | Tema `Intelligenza Artificiale`: `area: 'Innovazione didattica e strumenti'`, `autosufficiente: false` (serve un contesto di personale scolastico), `fattoConcreto: true`, `peso: 76`, `parole: PAROLE_IA`; riunito in `TEMI_OPERATIVI` da `editorialStandard.ts` |
| 2 | **Lessico dedicato** | `lessicoScuola.ts`: nuovo blocco `PAROLE_IA` (17 voci: intelligenza artificiale, IA generativa, machine learning, deep learning, chatbot, LLM, ChatGPT…) e sigla `IA` in `GLOSSARIO_ACRONIMI` (spiegata alla prima menzione, anche nel titolo: «IA (Intelligenza Artificiale) generativa…»); le voci IA sono state **rimosse da `Innovazione Digitale`** |
| 3 | **Ordine = priorità, senza regressioni** | `TEMI_OPERATIVI = [...TEMI_PERSONALE, ...TEMI_IA, ...TEMI_DIDATTICA]`: l'IA non ruba il match ai temi storici (una «Formazione sull'IA: corsi per i docenti» resta *Formazione*, un «entro il …» resta *Scadenze*, come prescrive `standardTemiPersonale.ts`) ma batte *Innovazione Digitale*, *Didattica* e *Pedagogia*, cioè i temi da cui si separa |
| 4 | **Scoring e gate** | `PESI_CATEGORIA['Intelligenza Artificiale'] = 76` (sopra *Innovazione Digitale* = 72) e categoria in `CATEGORIE_CON_FATTO_CONCRETO`: senza **scadenza reale** o **canale ufficiale di domanda/candidatura** `valutaRilevanza` respinge con motivo «Tema Intelligenza Artificiale senza fatto concreto» (mai comunicati o convegni sull'IA) |
| 5 | **Copy e prompt LLM** | `articoloCopy.ts` (all'epoca dentro `relevanceEngine.ts`): blocco `ARTICOLO_ALTRE['Intelligenza Artificiale']` (fatto/chi/pratica/come/portale) e liste `CATEGORIA`/`ZERO RUMORE` del `promptFiltroLLM` aggiornate col nuovo tema |

**Guardie.** `scripts/test-notizie-editoriale.ts` ha una sezione nuova («TEMA AUTONOMO:
intelligenza artificiale» + «COPY IA»): allow-list a **20 temi**, macro-area dichiarata,
`autosufficiente: false`, `fattoConcreto: true`, peso 76, lessico IA riconosciuto dal tema,
IA respinta senza scadenza né canale (con motivo tracciabile) e ammessa con scadenza
(`2026-09-30`) o con canale `Unica`; più due casi di non-regressione (Formazione resta
*Formazione*, «entro il» resta *Scadenze*) e il copy dedicato (sigla spiegata, nessun fluff,
un solo URL).

**Verifiche (01/10/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:notizie-editoriale`
✓ 161 asserzioni, 0 fallimenti · `npm run test:notizie-nazionale` ✓ · `npm run
test:architettura` ✓ nessuna violazione nuova (**546 file**, 143 = baseline; `standardTemiIA`
è di 36 righe, `lessicoScuola` sale a 243) · `npm run build` ✓ (**10,00 s**) · `npm run lint` ✓
0 problemi sui 6 file toccati (`relevanceEngine`, `editorialStandard`, `lessicoScuola`,
`standardTemiIA`, `standardTemiDidattica`, `scripts/test-notizie-editoriale`).

**Debito pre-esistente, fuori perimetro.** `npm run test:notizie-rate` e `npm run
test:notizie-feed` sono rossi per la **garanzia settimanale**: l'archivio non ha articoli
negli ultimi 7 giorni (il più recente è del 24/09/2026, orologio al 01/10/2026). Non dipende
da questa modifica — `data/notizieIngestite.ts` non è stato toccato (ultima scrittura
28/09/2026) — e va chiuso con un giro di ingestione.

### 26.33 Motore editoriale Notizie: sotto-moduli SRP + voce unica (`editorialVoice`)

**Nota di sessione (01/10/2026, secondo intervento).** `relevanceEngine.ts` era arrivato a
**1.723 righe**: gate anti-burocrazia, link, copy, cadenza, prompt LLM e generazione
dell'articolo nello stesso file, e le regole di stile ridette a mano dentro il prompt di
scrittura. Modificare una regola significava leggere mille righe di contesto estraneo.

**1. Split del motore (nessun cambio di comportamento).** Il file scende a **815 righe** e
diventa l'**orchestratore** (valutazione, categoria, titolo, formato editoriale, gate finale)
che **ri-esporta** la superficie pubblica: chi importava da `relevanceEngine.ts` continua a
farlo senza toccare una riga (`valutaRilevanza`, `titoloAzione`, `generaArticoloEditoriale`,
`promptFiltroLLM`, `promptScritturaArticolo`, `classificaLink`, `espandiAcronimi`…). Nuovi
sotto-moduli, tutti **sotto le 300 righe**:

| Modulo | Righe | Ruolo |
|---|---:|---|
| `services/valutazioneTipi.ts` | 23 | Tipi della valutazione (`ValutazioneNotizia`, `VoceInValutazione`) |
| `services/editorialVoice.ts` | 137 | **Voce unica** «colto ma sciolto» |
| `services/cadenzaArticoli.ts` | 123 | Cadenza e tetti (lookback 15/60 gg, `MAX_ARTICOLI_SETTIMANA = 3`, `MAX_ARTICOLI_FINESTRA = 6`) |
| `services/fontiUfficiali.ts` | 174 | `èFonteCanonica`, `èFonteMim`, `èFonteNazionale`, `èLinkPdf`, `validaUrlDeepLink` |
| `services/articoloCopy.ts` | 184 | Copy per categoria (`ARTICOLO`, `IMPATTO_COPY`) |
| `services/articoloEditoriale.ts` | 227 | `generaArticoloEditoriale`, `linkDomandaUfficiale`, `richiedePresentazioneDomanda` |
| `services/linkUfficiale.ts` | 240 | `classificaLink`, `etichettaLinkFonte`, `linkDirettoUfficiale`, `linkNonValidiInHtml`, `linkVietatiInHtml` |
| `services/promptEditoriale.ts` | 66 | `promptFiltroLLM`, `promptScritturaArticolo` |

**2. Voce unica (`editorialVoice.ts`).** Un solo posto decide COME si scrive:
`NOME_VOCE = 'colto ma sciolto'`; `REGOLE_VOCE` con 10 regole vincolanti (ognuna con `id`:
`voce`, **`prima_menzione`**, `fatti`, `zero_burocratese`, `zero_press`, `zero_politica`,
`pratico`, `zero_fluff`, `link_unico`, `nessuna_cta`); `bloccoVoceEditoriale()` (le stesse
regole pronte per i prompt, una riga per regola); `APERTURE_VIETATE` /
`apertureVietateTesto()`; `espandiAcronimi()`.
La regola **prima menzione** è quella richiesta dal cliente ed è ora vincolante: ogni sigla,
acronimo o termine tecnico è **spiegato tra parentesi alla PRIMA occorrenza** (es. «GPS
(Graduatorie Provinciali per le Supplenze)», «SPID (Sistema Pubblico di Identità
Digitale)»), poi si usa la sigla senza ripetere la spiegazione — glossario in
`GLOSSARIO_ACRONIMI` (`lessicoScuola.ts`), applicato da `titoloAzione` e da
`generaArticoloEditoriale`.
`promptScritturaArticolo` NON ridetta più le regole di stile: le importa e le presenta come
sezione `VOCE EDITORIALE (colto ma sciolto)`. Regole di prodotto aggiornate in
`docs/BLOG_EDITORIAL_GUIDELINES.md` (nuovo **§4-bis** + tabella «Dove è implementato»).

**3. Copy IA dedicato (contratto del test).** La sezione «COPY IA» della suite pretende che
l'articolo di categoria *Intelligenza Artificiale* usi il **copy dedicato** e non il fallback
generico *Scuole*. La voce esisteva già in `articoloCopy.ts`, ma il `fatto` non conteneva la
frase contrattuale: è stato riscritto in «**L'intelligenza artificiale entra a scuola** con
percorsi, strumenti e indicazioni per chi insegna: è online l'avviso». Nessun ramo speciale in
`generaArticoloEditoriale`: il copy resta un dato del modulo di copy, così l'articolo continua a
passare dai gate (link diretto, acronimi alla prima menzione, zero fluff, bullet «In sintesi»).

**Guardie.** `scripts/test-notizie-editoriale.ts`, sezione nuova «VOCE EDITORIALE
centralizzata» (9 asserzioni): voce dichiarata, `id` univoci, ogni regola testualmente
presente nel blocco dei prompt, blocco dentro `promptScritturaArticolo`, aperture vietate
citate, allow-list dei 20 temi integra nel filtro, nessuna regola di stile ridetta a mano.

**Verifiche (01/10/2026).** `npm run typecheck` ✓ 0 errori · `npm run test:notizie-editoriale`
✓ **tutto verde** (il debito dati di §26.32 è stato chiuso: vedi sotto) · `npm run
test:notizie-nazionale` ✓ pulito · `npm run test:architettura` ✓ nessuna violazione nuova
(**554 file**, 143 = baseline: `relevanceEngine.ts` resta in baseline perché ancora > 300
righe, tutti i sotto-moduli nuovi sono sotto la soglia) · `npm run build` ✓ (**29,17 s**) ·
`npm run lint` ✓ 0 problemi sui file toccati.

**Debito dati: CHIUSO (01/10/2026).** Le due voci d'archivio senza link ufficiale di §26.32
(percorso di formazione MIM, polizza sanitaria) sono state rigenerate in-place con
`npm run notizie:ripara-archivio` (script **offline**, nessuna rete): 5 voci esaminate, **5
pubblicabili, 0 rimosse**, copy e link riscritti con le regole correnti in
`src/departments/notizie/data/notizieIngestite.ts`. `npm run test:notizie-editoriale` è ora
**tutto verde (0 fallimenti)**.

**Debito residuo, fuori perimetro (aggiornamento al 01/10/2026).** `npm run
test:notizie-feed` e `npm run test:notizie-rate` restano rossi per la **garanzia
settimanale**: nessun articolo negli ultimi 7 giorni — l'archivio non si aggiorna dal
**21/09/2026** (orologio al 01/10/2026). Non dipende da questo intervento e si chiude con un
giro di ingestione (`npm run scrape:notizie`), che richiede rete.

**File toccati.** `src/departments/notizie/services/`: `editorialVoice.ts`,
`promptEditoriale.ts`, `articoloEditoriale.ts`, `articoloCopy.ts`, `linkUfficiale.ts`,
`fontiUfficiali.ts`, `cadenzaArticoli.ts`, `valutazioneTipi.ts` (nuovi) e
`relevanceEngine.ts` (orchestratore + ri-esportazioni) e
`src/departments/notizie/data/notizieIngestite.ts` (archivio rigenerato con
`npm run notizie:ripara-archivio`: 5 voci, 0 rimosse);
`scripts/test-notizie-editoriale.ts` (sezione «VOCE EDITORIALE centralizzata»);
`docs/BLOG_EDITORIAL_GUIDELINES.md`, `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`,
`docs/STRUCTURAL_AUDIT.md`. Nessun file di altri dipartimenti: la modifica resta nel
perimetro Notizie più gli artefatti di documentazione previsti dalla regola di isolamento.



### 26.34 «Radar Live»: la bacheca legge a PAGINE, non fino al tetto di PostgREST

**Il problema.** §26.25 (Fix 3) aveva messo un numero — `LIMITE_RIGHE_LETTE = 1.000` —
dove serviva una lettura completa. Quel numero **non è una scala di prodotto**: è il
`max-rows` con cui PostgREST chiude una singola risposta. Con l'ordinamento per
pubblicazione decrescente il taglio cade sulle righe **più vecchie**, cioè proprio su
quelle che il lettore non sospetta di perdere — il tabellone sembra pieno. Il 30/09 la
misura (623 righe in tabella, 69 presentabili) stava sotto il tetto **per caso**: una
sola ingestione di massa avrebbe troncato la bacheca senza un sintomo visibile.

**Fix — lettura a pagine.** Nuovo modulo puro `radar/flightBoard/letturaBoard.ts`
(`leggiTutteLePagine`, `intervalloPagina`; 138 righe): chiede pagine contigue di
`RIGHE_PER_PAGINA_QUERY = 1.000` righe con `.range(da, a)` e continua finché il
tabellone non copre tutto. Sei regole, tutte coperte dai test:

1. la fetta la fa **PostgREST** (`.range`), mai un'affettatura lato client;
2. l'offset avanza di quante righe il server ha **davvero consegnato**, non di quante
   ne sono state chieste: con un `max-rows` server più basso (p.es. 500) avanzare di
   1.000 salterebbe le righe in mezzo — di nuovo un taglio muto, solo più difficile da
   vedere;
3. la sentinella di fine è una pagina **vuota**, non una pagina «corta» (una pagina
   corta è la normalità di un server che pagina meno di noi); quando il conteggio
   esatto è noto (`attese`, dal `head: true`) la lettura si ferma appena lo raggiunge,
   senza richieste di troppo;
4. le righe già viste si scartano per `chiave` (`id`) e il numero dei doppioni è
   dichiarato: un ordinamento non totalizzabile lato database può ripetere una riga, e
   il tabellone non deve mostrarla due volte;
5. `MAX_PAGINE_LETTURA = 50` è una **guardia anti-anello**, non un tetto di prodotto: se
   scatta, la lettura restituisce ciò che ha e dichiara `esaustiva: false`;
6. se una pagina non aggiunge righe nuove (server che ignora l'offset) ci si ferma e lo
   si dichiara: mai un ciclo infinito per una risposta che non avanza.

**Cablaggio (`FlightBoardInterpelli`, 224 righe).** Il componente conta gli avvisi
attivi (`count: 'exact', head: true`) e passa il numero come `attese`; ogni pagina
ordina `created_at DESC` → `expiration_date ASC` (`nullsFirst: false`) → **`id` per
ultimo**: senza un criterio finale univoco l'ordinamento non è totalizzabile e la
paginazione può ripetere o saltare righe (è la ragione dell'`.order('id')`, non un
vezzo). Errori e letture parziali finiscono in `console.warn` (`[flight-board] …`), mai
muti; se la prima lettura fallisce del tutto si resta sullo stato precedente (mai una
vetrina vuota per un errore di rete). `metricaBoard.ts` (60 righe) **non contiene più un
tetto**: le pagine si contano sulle righe davvero in bacheca e il `+` resta solo per il
caso «il database è cresciuto fra il conteggio e la lettura».

**Split del componente (limite delle 300 righe).** Il vecchio `flightBoard/rigaBoard.tsx`
conteneva rendering **e** dati derivati: ora sono due file con un solo compito —
`flightBoard/rigaBoardDati.ts` (87 righe: tipologia, urgenza, date brevi; funzioni pure)
e `flightBoard/components/RigaBoard.tsx` (182 righe: `RigaBoard`, `RigheRiempimento`).
Il rendering è rimasto **identico**: il confronto col JSX precedente è stato fatto
**prima** di cancellare il vecchio file — nessuna modifica visiva, solo struttura.
`diagnosticaBoard.ts` (sonda diagnostica, 242 righe) è ora tipizzato con
`SupabaseClient`: sta nel perimetro `E-DOM` e non importa il client per conto suo.

**Allineamento §26.22 (debito trovato per strada).** La banda `sconosciuto` di
`src/lib/urgency.ts` rendeva `bg-amber-500 text-white`, mentre la tabella di §26.22 e la
guardia `npm run test:urgenza` prescrivono **slate chiaro**: la guardia era rossa e
fermava la catena. Ora `bg-slate-100 text-slate-600` — neutro, coerente col significato
(«la data non c'è, il colore non deve allarmare»). Nessun'altra banda toccata, nessun
effetto fuori dal Radar.



**Guardie nuove.** `flightBoard/__tests__/letturaBoard.test.ts` (170 righe: lettore puro
con client finto — pagina vuota = fine, pagina corta ≠ fine, offset che avanza di ciò che
il server consegna, doppioni scartati, errore a metà che tiene il letto e dichiara la
verità, guardia anti-anello) e `flightBoard/__tests__/letturaBoardCablaggio.test.ts` (102
righe: il componente non contiene più `.limit(`, nessun riferimento a
`LIMITE_RIGHE_LETTE` — una sola sorgente di verità —, `id` per ultimo nell'`.order()`,
errori di lettura dichiarati in console, la metrica non ha più un tetto). Entrambe sono
in `npm test`; `npm run test:board:lettura` le esegue da sole. Sonda di sola lettura sui
dati reali: `npm run board:verifica` (`__tests__/letturaBoardLive.ts`, 162 righe). La
diagnosi manuale — risponde a «perché la bacheca mostra quello che mostra» sul grezzo
della tabella, legge a pagine come il prodotto — è `npm run board:diag`
(`__tests__/diagnosticaBoard.ts`).

**Verifiche (02/10/2026) — misurate, non dedotte.** `npm run typecheck` ✓ (uscita 0) ·
`npm run test:architettura` ✓ (uscita 0, **0 violazioni nuove**: 560 file, 142 in
baseline — l'entry `E-DIM` di `FlightBoardInterpelli.tsx` è uscita perché il file,
spezzato, è sceso a 224 righe; resta il solo `E-ROOT`, il componente ancora nella radice
del dipartimento) · `npm run build` ✓ (uscita 0) · `eslint` ✓ (uscita 0) sui 10 file
toccati (componente, `letturaBoard`, `RigaBoard`, `rigaBoardDati`, `metricaBoard`,
`diagnosticaBoard`, i tre test nuovi, `urgency`). La catena `npm test` (58 passi) è stata
eseguita **passo per passo**, con l'uscita di ognuno: passi **1–55 ✓** — dentro, i passi
che contano qui: 44 `metricaBoard`, 45 `letturaBoard`, 46 `letturaBoardCablaggio`,
47 `filtroAttivi`, 48 `test-urgenza` (che **ora è verde**), 49–55 (`scuola-da-riga`,
coupon, checkout, scraper) — e passo 57 `test-live-board-scala` ✓. Rossi **due** passi,
fuori da questa modifica: 56 `scripts/test-live-board.ts` (3 assert) e 58
`scripts/test-nome-istituto.ts` (2 assert). La catena `npm test` si ferma al primo rosso,
quindi 57 e 58 sono stati verificati singolarmente. Le due sonde **live** (`npm run
board:verifica`, `npm run board:diag`) restano fuori da questa verifica: leggono il
database vero e chiedono le chiavi, quindi non entrano nella catena.

**Debito dichiarato, fuori perimetro (non chiuso qui).** Restano rossi due script di un
**cantiere diverso**: `scripts/test-live-board.ts` (3 asserzioni: quali righe sono
presentabili, «nessuna etichetta di posto o codice in bacheca», elenchi di codici classe
scartati) e `scripts/test-nome-istituto.ts` (2: titolo-dump fuori vetrina, ente emittente
mai un codice di provincia). Esercitano `src/lib/liveBoard.ts` + `src/lib/nomeIstituto.ts`
(quest'ultimo nuovo e non tracciato): è il cantiere «nomi istituto in vetrina», non il
troncamento. **Prova dell'indipendenza (due lati).** (a) `git diff HEAD --
scripts/test-live-board.ts` mostra le tre asserzioni rosse come righe **aggiunte** dalla
stessa modifica in corso, insieme alle righe finte che le alimentano (`etichetta-posto`,
`client-codici`, `posto-montessori`, `solo-codici`): il gate `nomeIstituto` è scritto ma
non ancora cablato in `preparaRigheBoard` — si sta guardando un lavoro a metà di un altro
cantiere, non una regressione. (b) Le due superfici non si toccano: nessun file di
`src/lib/**` importa `letturaBoard`/`metricaBoard`/`rigaBoardDati`, e il grafo di
`src/lib/liveBoard.ts` (`scadenza`, `matchingEngine`, `school-lookup`, `nomeIstituto`,
`alertInterpello`) non contiene nulla di `flightBoard/`. Nota di metodo: il controllo va
fatto sul filesystem (`Get-ChildItem | Select-String`), non con `git grep`, perché i file
di questo cambiamento sono **non tracciati** e `git grep` non li vede. Osservato e non
toccato perché su un'altra superficie: `src/contexts/app/useInterpelliFeed.ts` legge
ancora con `.limit(100)` (feed dell'app, accesso da `AppContext`; non è il tabellone
pubblico).

**File toccati.** `src/departments/radar/flightBoard/`: `letturaBoard.ts` (nuovo),
`components/RigaBoard.tsx` (nuovo), `rigaBoardDati.ts` (nuovo), `rigaBoard.tsx`
(**cancellato**), `metricaBoard.ts`, `__tests__/letturaBoard.test.ts` (nuovo),
`__tests__/letturaBoardCablaggio.test.ts` (nuovo), `__tests__/letturaBoardLive.ts`
(nuovo), `__tests__/diagnosticaBoard.ts`; `src/departments/radar/FlightBoardInterpelli.tsx`;
`src/lib/urgency.ts` (condiviso essenziale: allineamento §26.22); `package.json` (`test`,
`test:board:lettura`, `board:diag`, `board:verifica`), `scripts/architettura-baseline.json`,
`scripts/diag-flightboard.ts` (**cancellato**: replicava a mano la vecchia query con
`.limit(500)`; la diagnosi vive ora in `__tests__/diagnosticaBoard.ts`, che legge a pagine
e sta DENTRO il dipartimento, `npm run board:diag`),
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. Nessun file di altri dipartimenti:
perimetro Radar più i condivisi essenziali (`src/lib/**`).

### 26.35 Competenze e parole chiave (`materie_id`/`materie_custom`): il salvataggio che non c'era e il falso negativo dei profili solo-competenza

**Il problema.** Il passo «In cosa puoi lavorare, anche oltre la tua classe di concorso?» produceva
una configurazione VALIDA ma **mai salvata**: `salvaProfilo` non metteva `materie_id`/`materie_custom`
nel payload su `profiles`, quindi le competenze vivevano solo nello stato locale del browser. Tre
conseguenze a catena, tutte silenziose: (a) dopo un refresh o su un altro dispositivo il profilo
risultava senza competenze; (b) `valutaConfigurazioneRadar` non trovava le due colonne nella SELECT
del DB → «Profilo incompleto» pur con il Radar configurato; (c) `findUtentiCompatibili` non leggeva le
competenze e la **regola unica** `avvisoCompatibileConProfilo` pretendeva classi di concorso: un
profilo configurato solo a competenze/parole chiave non era compatibile con NULLA — zero
opportunità, zero notifiche, digest vuoto, Radar acceso. Nessuna eccezione nei log: solo un servizio
muto.

**La correzione (ciclo completo: scrittura → idratazione → validazione → matching → consegna).**
1. **Scrittura** (`useAnagraficaProfilo.salvaProfilo`): `materie_id: dati.materieId` e
   `materie_custom: dati.materieCustom` entrano nel payload `profiles` (erano l'UNICO blocco di
   preferenze assente dal salvataggio).
2. **Idratazione** (`useProfileBootstrap`): le due colonne entrano nella SELECT e nel mapping
   (`materieId`/`materieCustom`), con fallback sullo stato precedente quando il DB risponde `[]` —
   un array vuoto non deve cancellare la scelta appena fatta.
3. **Validazione** (`valutaConfigurazioneRadar`): `materie_id` **e** `materie_custom` nella SELECT
   del DB, così la parola chiave libera vale come «cosa cerchi» esattamente come il tag di catalogo.
4. **Matching** (`src/lib/matchingEngine.ts`): `ProfiloCompatibilita` porta `materieId`/
   `materieCustom`, `findUtentiCompatibili` le legge e le propaga a `UtenteCompatibile` (così digest e
   alert riapplicano la stessa regola per singola opportunità). Nuovi helper:
   `normalizzaCompetenza`, `tokenCompetenza`, `radiceCompetenza`, `etichetteCompetenzeProfilo`,
   `competenzaCompatibileConAvviso`, riusati dalla regola unica `avvisoCompatibileConProfilo`
   (§6.5.2 punto 4).
5. **Consegna** (`src/lib/notifier.ts`): il digest passa `titolo`/`materia` all'avviso e non perde le
   competenze nel tragitto; il **feed dell'app** (`useInterpelliFeed`) riusa
   `competenzaCompatibileConAvviso` — una sola regola, nessuna copia locale.

**Semantica (decisione di prodotto).** Le competenze attivano il match **solo** per i profili SENZA
classi di concorso (§6.5.2 punto 4): chi ha classi resta sulla regola storica, quindi nessun ritorno
dei falsi positivi. Il confronto è per token radicizzati (`inglese`/`inglesi` → `ingles`), con
accenti e punteggiatura normalizzati, e i token senza potere discriminante (`laboratorio`, `scuola`,
`attivita`, `progetto`…) sono esclusi: un avviso che parla di «laboratorio» non riguarda chi ha
scritto «laboratori». **Niente tavola di sinonimi**: le varianti semantiche (IA ↔ «Intelligenza
Artificiale») sono un lavoro a sé, tracciato in `docs/RADAR_ROADMAP_V2.md` §4 («Mappa Sinonimi /
Varianti per Keyword Personalizzate»); qui si confronta solo ciò che l'utente ha scritto davvero. Le
province restano vincolanti come prima: le competenze non allargano mai il perimetro geografico.

**Verifiche (comandi eseguiti, non assunti).**
- `npm run test:matching` → ✅, exit 0: `FILTRO PROFILO` + il nuovo `COMPETENZE NEL MATCHING`
  (`scripts/test-matching-competenze.ts`, agganciato in catena in `package.json`). Copre: tag di
  catalogo risolto nel nome × titolo dell'avviso, parola chiave libera × materia, plurali/singolari,
  accenti e punteggiatura, competenza NON pertinente scartata, profilo senza classi **e** senza
  competenze (nessun invio casuale), provincia vincolante anche con le competenze, competenze che NON
  allargano i profili con classi, token generico senza match, guardia sostegno invariata; e il
  **digest end-to-end** su client Supabase stub (profilo solo-competenza → 1 voce; competenza assente →
  0 invii, profilo saltato).
- `npm run typecheck` → exit 0, nessun `error TS`.
- `npm run build` → ✅ `built in 20.17s` (resta il warning noto sui chunk > 500 kB).
- `npm run test:architettura` → ✅ «nessuna violazione nuova» (142 debiti = baseline)
- `npm run test:radar:preferenze` → ✅ (il test ora verifica anche il ciclo completo delle competenze:
  payload di `salvaProfilo`, SELECT/mapping del bootstrap, lettura in `valutaConfigurazioneRadar`,
  presenza delle competenze nel motore).
- `npm run test:sostegno` → ✅, `npm run test:copy:etico` → ✅ (dopo la correzione del placeholder in
  `PannelloClassi`).
- `npx eslint` sui 12 file toccati → **0 errori**; restano 4 warning storici
  `react-hooks/exhaustive-deps` in `useAnagraficaProfilo`/`useProfileBootstrap` (dipendenza dai
  setter dei context, non introdotta qui).

**DB e invio (controlli fatti, non assunti).** `profiles.materie_id` / `materie_custom` esistono da
`20260822030000_create_profiles.sql` e sono state riallineate in `20260825160000_align_profiles_schema.sql`:
**nessuna migrazione nuova necessaria**. In `findUtentiCompatibili` la SELECT resta tollerante: la
seconda lettura tiene le colonne storiche + le competenze, così se il DB non ha `profiles.sostegno`
(migrazione `20260914040000`, default `true` da `20260927120000`) si perde la guardia sostegno — mai le
competenze — e nessun utente resta senza notifiche. `supabase/functions/send-notification/index.ts` è
un trasporto (recapito per `id=eq.<userId>` di `email,email_notifica,telegram_chat_id,nome,genere`): non
fa matching, quindi non richiede le colonne delle competenze.

**Nota su «Radar Live» (stato preesistente, NON introdotto qui).** La catena `npm test` si ferma sui
**3 errori** di `scripts/test-live-board.ts` (righe `etichetta-posto`, `client-codici`,
`posto-montessori` in vetrina; «ADEE | EEEE» interpretato come nome di scuola): è il cantiere «nomi
istituto in vetrina» già descritto in §26.34. Prova dell'indipendenza: `git diff HEAD --
scripts/test-live-board.ts` è **vuoto** (il file è identico a HEAD, quindi rosso da prima), le
asserzioni riguardano `src/lib/nomeIstituto.ts` + `preparaRigheBoard` (`src/lib/liveBoard.ts`), file non
toccati da questa modifica, e il diff di `matchingEngine.ts` non tocca `enteEmittenteDaTitolo`, l'unica
funzione che `liveBoard.ts` importa dal motore.

> **Risolto il 03/10/2026 → §26.39.** Il drift del commit `56c6d0d` («dicitura standard») è
> stato rimosso: `preparaRigheBoard` scarta di nuovo le righe senza un nome d'istituto in
> chiaro e `nomePresentabileRiga`/`rigaPresentabileVetrina` filtrano di nuovo il responso della
> prova. `npm test` è verde per intero (59 comandi, exit 0).

**File toccati.** `src/lib/matchingEngine.ts`, `src/lib/notifier.ts`,
`src/contexts/app/useAnagraficaProfilo.ts`, `src/contexts/app/useProfileBootstrap.ts`,
`src/contexts/app/useInterpelliFeed.ts` (condivisi essenziali: motore e contesti del profilo),
`src/departments/radar/valutaConfigurazione.ts`,
`src/departments/radar/preferenze/PannelloClassi.tsx` (placeholder: rimossi gli esempi di codici
classe, resta «Cerca per parola chiave»),
`src/departments/radar/wizard/components/SezioneClassiConcorso.tsx`,
`scripts/test-radar-preferenze.ts`, `scripts/test-matching-competenze.ts` (**nuovo**), `package.json`
(`test:matching` = `test-matching-profilo && test-matching-competenze`), `docs/SYSTEM_HANDOVER.md`.
Nessun file di altri dipartimenti: perimetro Radar più i condivisi essenziali (`src/lib/**`,
`src/contexts/app/**`).

### 26.36 Landing pubblica: larghezze uniformi alla bacheca, un solo form di registrazione, monitor «Radar Live» non editabile

**Nota di sessione (03/10/2026).** Tre correzioni sulla vetrina pubblica richieste dal cliente, tutte
di presentazione (nessuna regola di prodotto cambiata, nessuna query toccata).

**1. Larghezza uniforme alla bacheca.** Il tabellone `Radar Live` è il metro della pagina:
`max-w-7xl` con padding `px-4 sm:px-6 lg:px-8`. Tutte le sezioni sotto la bacheca che erano ancora più
strette sono state allineate a quella classe — `LandingOffertaPro`, `LandingBenefici` («Cosa
riceverai»), «Come funziona», `LandingStrumenti` («I nostri strumenti»), `LandingPartnerPureFocus`
(era `max-w-5xl`) e i due blocchi interni della pagina «Valori»/«Statistiche» (erano `max-w-6xl`).
Risultato: dalla bacheca in giù nessun effetto di restringimento, un solo bordo sinistro/destro.
La hero (prima della bacheca) e la CTA finale (blocco centrato, `max-w-3xl`) restano come sono: la
prima precede il metro, la seconda è un blocco centrato per disegno.

**2. Un solo form di registrazione.** La superficie di lead capture vive **unicamente** nel box PRO in
basso (`LandingOffertaPro`, che monta il condiviso `FormRegistrazioneRapida`). È stato rimosso il
blocco di registrazione rapida che stava **sopra** la bacheca: `LandingPage.tsx` non importa più
`LandingRegistrazioneRapida` (componente eliminato) e il tipo `DatiRegistrazioneRapida` arriva da
`FormRegistrazioneRapida`. Un solo percorso, una sola legenda, nessun carattere residuo sotto il
pulsante.

**3. Monitor «Radar Live» protetto da interazioni di text-editing.** La sezione a scorrimento
(`FlightBoardInterpelli`) ora è blindata contro gli editor testuali: `contentEditable={false}` (fuori
dalla modifica anche dentro un contenitore reso editabile), `translate="no"` + classe `notranslate`
(la traduzione automatica del browser non avvolge più le celle in nodi estranei — nodi aggiunti
farebbero fallire l'aggiornamento React delle righe, che cambiano da sole a ogni rotazione),
`spellCheck={false}`, `select-none` e `suppressContentEditableWarning`. Le righe restano cliccabili:
non è stato disabilitato il pointer, solo l'editing testuale.

**Verifiche (comandi eseguiti, non assunti).**
- `npm run typecheck` → exit 0, nessun `error TS`.
- `npx tsx scripts/test-copy-primo-schermo.ts` → ✅: nuova asserzione «monitor LIVE protetto dalle
  interazioni di text-editing» (`contentEditable={false}`, `translate="no"`, `notranslate`,
  `spellCheck={false}`) accanto alle guardie storiche della bacheca.
- `npx tsx scripts/test-copy-pubblico.ts` → ✅: `SEZIONI_BACHECA` (OffertaPro, Benefici, Strumenti,
  PureFocus, LandingPage) tutte su `max-w-7xl` + `lg:px-8`.
- `npm run build` → ✅; `npm run test:architettura` → ✅ nessuna violazione nuova;
  `npx eslint` sui file toccati → 0 errori.

**File toccati.** `src/pages/LandingPage.tsx`, `src/components/landing/LandingOffertaPro.tsx`,
`src/components/landing/LandingBenefici.tsx`, `src/components/landing/LandingStrumenti.tsx`,
`src/components/landing/LandingPartnerPureFocus.tsx` (vetrina pubblica — richiesta esplicita
dell'utente, non è un dipartimento), `src/departments/radar/FlightBoardInterpelli.tsx` (dipartimento
Radar), `scripts/test-copy-primo-schermo.ts`, `scripts/test-copy-pubblico.ts`, `package.json`,
`docs/SYSTEM_HANDOVER.md`. La rimozione di `src/components/landing/LandingRegistrazioneRapida.tsx`
riguarda lo stesso perimetro vetrina.

### 26.37 DEV Toolbar — «Visual Editor» (CLICK-TO-EDIT): si clicca il testo sulla pagina e si riscrive lì

**Nota di sessione (03/10/2026).** Secondo strumento di modifica dei testi in sviluppo, accanto
all'«Editor Testi Rapido» (§26.27–§26.31): stesso intento (cambiare le copy senza toccare il codice),
UX opposta. L'Editor Testi Rapido **elenca** i testi in una sezione della DEV Toolbar; il Visual
Editor **non elenca nulla**: si accende, si passa il mouse sulla pagina (anello tratteggiato che
segue il blocco sotto il puntatore) e si **clicca il testo** — si apre la casella e si scrive sul
posto. Salvataggio immediato in `localStorage`, **una chiave per ROTTA**
(`sr_visual_editor:/prezzi`, `sr_visual_editor:/faq`…), quindi la pagina modificata si ritrova
intatta dopo un refresh; da lì si può ripristinare il singolo blocco, azzerare la pagina o tutte le
pagine, ed **esportare** il testo («era»/«ora», pronto da riportare nei componenti) o il JSON
completo. Vive **solo in sviluppo**: in build di produzione il provider restituisce l'albero intatto.

**1. Che cosa è un blocco: il testo CONTIGUO.** L'unità di modifica non è il nodo di testo ma il
testo contiguo: `<p>Vedi <strong>qui</strong> ora</p>` è **UNA** casella (non tre micro-pezzi),
mentre `<div><p>a</p><p>b</p></div>` sono **DUE** (i figli di blocco spezzano la contiguità). Un
elemento è un blocco quando il suo sottoalbero contiene solo testo e tag inline; fra due contigui
vince il più esterno, così un `<strong>` dentro un `<p>` non diventa una casella a sé. Restano
fuori i sottoalberi tecnici (script, style, svg, textarea…), i pannelli DEV
(`data-sr-dev-toolbar`, `data-sr-visual-editor` — l'editor non elenca né riscrive se stesso) e
tutto ciò che è `contenteditable="false"`: è la protezione del monitor «Radar Live» (§26.36), le
cui celle ruotano da sole e non vanno toccate.
`Regole`: `src/lib/visualEditorRegole.ts` (`TAG_TECNICI`, `TAG_NEUTRI`, `TAG_INLINE`, `TAG_BLOCCO`,
`MARCHI_ESCLUSI`, `contiguo`, `eBlocco`, `raccogliBlocchi`, `antenatoBlocco`, `scriviBlocco`).

**2. Chiave STABILE, calcolata sul testo di DEFAULT.** `tag#impronta(testo di default)#occorrenza`
(es. `p#1qwwa4q#0`): l'impronta è quella dell'Editor Testi Rapido (djb2 in base 36, spazi inutili
collassati) e l'occorrenza distingue due testi identici nella stessa pagina (`#0`, `#1`). Il punto
delicato è che il testo a schermo può essere già modificato: la chiave viene quindi calcolata sul
**default del codice**, letto la prima volta che il blocco compare e conservato in una `WeakMap`
(`MemoriaTocchi`) — altrimenti una modifica cambierebbe la chiave di se stessa e sparirebbe al
reload. Da qui la stabilità fra scansioni, ri-render e refresh.

**3. Riscrittura che non litiga con React.** `scriviBlocco` sostituisce **solo il valore dei nodi di
testo** del blocco (il testo nuovo nel primo nodo, gli altri svuotati): nessun nodo aggiunto o
rimosso, nessun `innerHTML`, così una ri-renderizzazione di React non trova il DOM «sorpreso» e in
sviluppo non nascono errori di riconciliazione. Gli spazi di bordo del JSX (`'  ciao  '`) restano
dov'erano, e se il testo non cambia **non si scrive nulla**: l'osservatore delle mutazioni non
entra in ciclo. Campo svuotato o testo identico al default = «torna come nel codice» (l'override
viene tolto, non salvato vuoto: un blocco senza testo uscirebbe dalla scansione e non si potrebbe
più riaprire).

**4. Moduli e interfaccia (SRP, niente file monolitici).** Il sistema è diviso in cinque pezzi, come
l'Editor Testi Rapido:
`src/lib/visualEditorRegole.ts` (puro: che cos'è un blocco, lettura e riscrittura),
`src/lib/visualEditorStore.ts` (puro: `sr_visual_editor:`, `sr_visual_editor:_rotte`,
`sr_visual_editor_attivo`, con `chiaveStorageRotta`/`overrideRotta`/`overrideRottaSalvatiDaStorage`/
`rotteSalvate`/`overrideTutteLeRotte`/`impostaOverrideRotta`/`azzeraOverrideRotta`/
`azzeraTutteLeRotte`/`esportaTestoRotta`/`esportaJsonRotte`; lettura TOLLERANTE — storage bloccato,
JSON corrotto o voci malformate → copy del codice, mai un crash — e notifica agli ascoltatori solo
su cambiamento reale),
`src/lib/visualEditorScansione.ts` (puro: `scansionaVista` riscrive i blocchi modificati e
restituisce l'elenco per il pannello più i due indici — `WeakMap` elemento → blocco per il click,
`Map` chiave → elemento per l'anello),
`src/hooks/useVisualEditor.ts` (ponte React: `MutationObserver` con attesa di 60 ms — i testi che
compaiono dopo, filtri, tab, modali, righe del Radar, entrano da soli —, click ascoltato in fase di
**cattura** solo a editor acceso, API per il pannello, spezzato sotto le 250 righe) e
`src/components/dev/VisualEditorProvider.tsx` + `VisualEditorPannello.tsx` +
`VisualEditorCasella.tsx` + `visualEditorUi.ts` (badge in basso a sinistra con accensione/spegnimento
e conteggio, guida, casella di scrittura, azzeramenti, esportazioni).
Il provider è montato in `src/App.tsx` **dentro `BrowserRouter`** (segue la rotta corrente) e **in
produzione non monta nulla** (`import.meta.env.DEV`); l'anello tratteggiato è posizionato scrivendo
gli stili, senza re-render a ogni movimento del mouse. `Esc` chiude prima la casella aperta, poi
spegne l'editor; l'accensione è ricordata fra i refresh (`sr_visual_editor_attivo`). Pannello e
anello portano l'attributo `data-sr-visual-editor`, i click lì dentro non vengono intercettati: il
sistema non modifica se stesso.

**5. Azzeramenti ed esportazioni.** `Ripristina` = l'override del blocco viene tolto e torna il testo
del codice; `Azzera pagina` = tutte le modifiche della rotta; `Azzera tutto` = tutte le rotte
(l'indice `sr_visual_editor:_rotte` fa da elenco, senza scorrere tutto il `localStorage`).
L'esportazione del testo produce un blocco pronto da incollare nei componenti (una riga per blocco,
`era: «…»` / `ora: «…»`, in ordine di chiave, con il rimando a questa sezione); quella JSON scarica
tutte le pagine, per passar le modifiche a un altro strumento. La data dell'esportazione la passa il
chiamante: lo store resta puro, senza orologi nascosti.

**Verifiche (comandi eseguiti, non assunti).**
- `npx tsx scripts/test-visual-editor.ts` → ✅ **22 asserzioni** (contiguità ed esclusioni: il
  paragrafo con il grassetto è una casella sola, il monitor «Radar Live» e il pannello dell'editor
  restano fuori; riscrittura senza nodi aggiunti/rimossi, spazi di bordo conservati, nessuna
  scrittura quando il testo non cambia; scansione: chiave `p#1qwwa4q#0`, due testi identici su `#0`
  e `#1`, override riflesso al reload, modifica tolta → copy del codice, click su figlio inline →
  blocco giusto, nessun blocco nel monitor Radar Live).
- `npx tsx scripts/test-visual-editor-store.ts` → ✅ **26 asserzioni** (chiave per rotta + indice
  delle rotte + flag di accensione, notifiche solo su cambiamento reale, letture tolleranti con JSON
  corrotto e voci malformate, azzeramento di pagina e globale, esportazioni testo/JSON, cablaggio di
  `App.tsx`, provider, hook e pannello).
- Guardie nuove in `package.json`: `test:visual-editor` = i due script in catena, **incluso in
  `npm test`** subito dopo `test-editor-testi-vista` (eseguito: entrambi ✅ dentro la catena).
  > **Aggiornamento 03/10/2026 → §26.38:** il pannello «Editor Testi Rapido» è stato rimosso
  > (§26.38) e in catena il Visual Editor sta ora subito dopo `test:testi-chiave` (l'ex
  > `test-editor-testi`, il cui script è diventato `scripts/test-testi-chiave.ts`).
- `npm run typecheck` → exit 0, nessun `error TS` · `npm run test:architettura` → ✅ nessuna
  violazione nuova (570 file, 142 = baseline; i file nuovi sotto le 250 righe) · `npx eslint` sui
  file toccati → 0 errori · `npm run build` → ✅ (6,25 s).
- `npm test` → si ferma in `&&` a `test:live-board`: **3 errori** in `RADAR LIVE` (le stesse tre
  attese annotate in §26.30/§26.31), debito **preesistente** del working tree — `scripts/test-live-board.ts`
  importa solo `src/lib/liveBoard.ts`, mai toccato qui.

**File toccati.** `src/lib/visualEditorRegole.ts` (**nuovo**), `src/lib/visualEditorStore.ts`
(**nuovo**), `src/lib/visualEditorScansione.ts` (**nuovo**), `src/hooks/useVisualEditor.ts` (**nuovo**),
`src/components/dev/VisualEditorProvider.tsx` (**nuovo**), `src/components/dev/VisualEditorPannello.tsx`
(**nuovo**), `src/components/dev/VisualEditorCasella.tsx` (**nuovo**), `src/components/dev/visualEditorUi.ts`
(**nuovo**), `src/App.tsx`, `scripts/test-visual-editor.ts` (**nuovo**),
`scripts/test-visual-editor-store.ts` (**nuovo**), `package.json`, `docs/DEPARTMENT_MAP.md`,
`docs/SYSTEM_HANDOVER.md`. Nessun file di dipartimento: tutto dentro i condivisi essenziali
(`src/lib/**`, `src/hooks/**`) più il dev tooling (`src/components/dev/**`) e il montaggio in `App.tsx`.

### 26.38 DEV Toolbar — rimosso il vecchio pannello «Editor Testi Rapido»: resta il solo «Visual Editor»

**Cosa cambia.** In DEV la stessa toolbar offriva **due** strumenti di editing testuale: il
«Visual Editor» click-to-edit (§26.37) e la sezione collassabile **«Editor Testi Rapido»**
(`components/EditorTestiRapido.tsx`, §26.27–§26.31), che elencava i blocchi di testo del DOM
con **una casella laterale per blocco**: dove la copy è spezzata in più elementi inline (es. la
marca **PureFocus**, resa come «Pure» + «Focus») comparivano caselle separate per ogni
frammento. Due UX, due store (`sr_dom_text_overrides` vs `sr_visual_editor:*`), due elenchi di
testi in pagina: sovrapposizione e confusione. Il pannello è stato **rimosso**: ora l'unico
editing testuale in sviluppo è il Visual Editor, che si accende dal badge in **basso a sinistra**
(`App.tsx`).

**Cosa è stato rimosso** (nessun file di dipartimento: tutto dev tooling condiviso):

- `src/components/EditorTestiRapido.tsx` — il pannello, con il mount in
  `src/components/DevToolbar.tsx` (import, `<EditorTestiRapido />`, chiamata
  `useScansioneTestiDom()` e la sua nota: la toolbar non applica più nulla ai testi del DOM);
- `src/lib/testiDom.ts` + `src/lib/testiDomOverride.ts` — la scansione del DOM e lo store
  `localStorage: sr_dom_text_overrides` (§26.31);
- `src/hooks/useTestiDom.ts` — `useScansioneTestiDom()` / `useTestiDomInPagina()`;
- `src/lib/testiInPagina.ts` — il registro delle viste (§26.30) — e `useTestiInPagina()` in
  `src/hooks/useTestiEditabili.ts`: esistevano **solo** per l'elenco contestuale del pannello,
  quindi se ne sono andati con lui (l'hook resta con la sola `useTestiEditabili()` per le
  pagine: niente più registrazioni di chiavi a ogni render);
- `scripts/test-editor-testi-vista.ts`, `scripts/test-editor-testi-dom.ts`,
  `scripts/test-editor-testi-dom-cablaggio.ts` e lo script npm `test:editor-testi`.

**Cosa resta** (e perché non si è buttato tutto). Le **identità dei testi** sono le stesse che
usa il Visual Editor, quindi i due moduli puri restano, potati del codice morto (che nessuno
importava più): `src/lib/testiDomRegole.ts` (61 righe: `normalizzaTesto`, `impronta`,
`chiaveTestoDom`, `campoDi`/`contenitoreDi`; via `TAG_IGNORATI` e `SELETTORI_TARGET`, mai usati
altrove), `src/lib/testiDomNodi.ts` (41: `NodoDom`, `etichettaDove`; via `raccogli`,
`scriviTesto`, `OccorrenzaDom`) e l'helper di test `scripts/lib/dom-finto.ts` (65: `el`, `con`,
`testo`; via la pagina di prova del vecchio editor). Resta anche il **livello «con chiave»**
delle pagine — `data/editableTexts.ts` + `lib/testiModificabili.ts` + `useTestiEditabili`
(FAQ pubbliche, sezione «Domande frequenti» di `/prezzi`, vetrina PRO): gli override
`sr_simple_text_overrides` valgono **solo** in sviluppo e da ora **nessuno li scrive** (la
lettura resta per non lasciare attivi, in DEV, i testi salvati prima); «Reset dati /
LocalStorage» della DEV Toolbar ora li **cancella davvero** — `resettaTutto`
(`src/contexts/app/useStatoSimulato.ts`) ripulisce anche `sr_simple_text_overrides` e il
residuo inerte `sr_dom_text_overrides`, così non resta nessun testo modificato invisibile.
I commenti dei file coinvolti sono stati allineati: si modifica la copy col Visual Editor,
non più dal pannello.

**Guardia.** `scripts/test-editor-testi.ts` è stato **rinominato** `scripts/test-testi-chiave.ts`
(`npm run test:testi-chiave`, nella catena `npm test` al posto di `test:editor-testi`): copre
registro, copy dell'offerta, store DEV e pagine rese per chiave (§26.27–§26.31), e verifica **in
negativo** che il pannello non sia tornato — nessun riferimento a `EditorTestiRapido`/`testiDom`/
`useScansioneTestiDom`/`STORAGE_KEY_TESTI_DOM` in `DevToolbar.tsx`, nessun `export function
useTestiInPagina` né import da `@/lib/testiInPagina` nell'hook.

**Verifiche (03/10/2026).** `npm run typecheck` → exit 0, nessun `error TS` ·
`npm run test:testi-chiave` → ✅ nessun problema · `npm run test:visual-editor` → ✅ exit 0
(22 + 26 asserzioni) · `npm run test:architettura` → ✅ **nessuna violazione nuova** (562 file,
142 = baseline: le righe tolte non erano in baseline) · `npx eslint` sugli 11 file toccati → ✅
0 problemi · `npm run build` → ✅ 7,61 s · `npm test` → la catena esegue il nuovo script al posto
dei due rimossi e si ferma, come prima, in `&&` a `test:live-board` (3 errori RADAR LIVE,
debito **preesistente** §26.30/§26.31).

**File toccati.** Rimossi: `src/components/EditorTestiRapido.tsx`, `src/hooks/useTestiDom.ts`,
`src/lib/testiDom.ts`, `src/lib/testiDomOverride.ts`, `src/lib/testiInPagina.ts`,
`scripts/test-editor-testi-vista.ts`, `scripts/test-editor-testi-dom.ts`,
`scripts/test-editor-testi-dom-cablaggio.ts`. Modificati: `src/components/DevToolbar.tsx`,
`src/hooks/useTestiEditabili.ts`, `src/lib/testiDomNodi.ts`, `src/lib/testiDomRegole.ts`,
`scripts/lib/dom-finto.ts`, `package.json`, `src/contexts/app/useStatoSimulato.ts`
(`resettaTutto` ripulisce anche le chiavi dei testi), i commenti di allineamento in
`src/data/editableTexts.ts`, `src/data/faqPubbliche.ts`, `src/lib/testiModificabili.ts`,
`src/pages/FAQPage.tsx`, `src/components/landing/LandingOffertaPro.tsx`,
`docs/DEPARTMENT_MAP.md`, `docs/SYSTEM_HANDOVER.md`, e `scripts/test-editor-testi.ts` →
**rinominato** `scripts/test-testi-chiave.ts`. Nessun file di dipartimento; nessuna rotta, nessun
testo di prodotto e nessuna regola di copy cambiati.

### 26.39 «Radar Live» — la vetrina torna alla direttiva di §26.20 (fine del drift della «dicitura standard»)

**Nota di sessione (03/10/2026).** La catena `npm test` era rossa da prima (§26.30, §26.31,
§26.37, §26.38) e il colpevole non erano le guardie: era **il codice**. Il commit
`56c6d0d` («fix: public radar production sync», 02/10/2026) aveva sostituito la regola di
vetrina della direttiva cliente di §26.20 — *«se il nome non è risolvibile in chiaro la riga
NON entra nella vetrina pubblica»* — con una regola diversa e **non documentata**: la colonna
«Scuola» mostra la dicitura di riempimento `Scuola non specificata / Più plessi` e
`preparaRigheBoard` non scarta più nulla (via `if (!scuola) continue;`). Effetti misurati:

1. `scripts/test-live-board.ts` (**3 errori**): `senza-scuola`, `solo-codici`,
   `etichetta-posto`, `client-codici`, `posto-montessori` tornavano in vetrina con la dicitura
   al posto dell'istituto; `«ADEE | EEEE»` non era più considerato un non-nome.
2. `scripts/test-nome-istituto.ts` (**2 errori, invisibili dietro la `&&`**: la catena si
   fermava a `test:live-board`, il comando #57 di 59): con `nomeScuolaRiga` che restituiva
   *sempre* una stringa, l'ultima risorsa di `nomePresentabileRiga` — l'**ente emittente**
   («USP Torino») — era **codice morto**, e `rigaPresentabileVetrina` tornava `true` su ogni
   riga, disattivando in silenzio il filtro del responso della prova (`SimulatorRadar` ×2).

**Ripristino (nessun test toccato: le guardie erano corrette).**

| # | Intervento | Dettaglio |
|---|---|---|
| 1 | `nomeScuolaRiga` → `string \| null` | Torna il nome **reale** o `null`: `school_name` (dal gate) → registro per codice meccanografico → titolo (`scuolaDaTitolo`). L'ente emittente resta fuori dalla bacheca (§26.20, riga 2) |
| 2 | `preparaRigheBoard` | Riapplicato `if (!scuola) continue;` prima del `push` (**di nuovo IN VIGORE dalla §26.59 del 05/10/2026**; era stato revocato dalla §26.47 del 04/10/2026): senza un nome in chiaro la riga **non entra**. Finestra dei 60 giorni e `senzaScadenza` invariati |
| 3 | `nomePresentabileRiga` → `string \| null` | Ultima risorsa legittima l'**ente emittente** (prova del Radar), `null` quando non c'è nulla di presentabile: `rigaPresentabileVetrina` filtra di nuovo davvero |
| 4 | JSDoc e commenti allineati | Header del modulo, `nomeScuolaRiga`, `nomePresentabileRiga`, `preparaRigheBoard`: la «dicitura standard» non è più descritta come regola di prodotto |

**Verifiche (03/10/2026, da `project/`).** `npm run test:board` → ✅ **17/17** asserzioni
(«RADAR LIVE: nessun problema») · `npm run test:nome-istituto` → ✅ **28/28** («NOMI ISTITUTO:
nessun problema», incluse le due asserzioni del responso) · `npm run test:board:scala` → ✅ ·
**`npm test` → exit 0: catena completa verde** (59 comandi, nessun arresto in `&&`) ·
`npm run typecheck` → ✅ exit 0, nessun `error TS` · `npm run test:architettura` → ✅ **nessuna
violazione nuova** (562 file, 142 = baseline) · `npx eslint src/lib/liveBoard.ts` → ✅ 0
problemi (i 42 problemi di `npm run lint` sul repo sono il debito noto, `liveBoard.ts` non è fra
i file segnalati) · `npm run build` → ✅ exit 0.

**File toccati.** `src/lib/liveBoard.ts` (unico file di codice: 29 righe aggiunte, 18 tolte),
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. **Nessun test modificato** e nessun file di
dipartimento: perlomeno nessuno *nuovo* — `liveBoard.ts` è uno dei condivisi essenziali
(`src/lib/**`) già nel perimetro del Radar Live. Le note di §26.30, §26.31, §26.37, §26.38 e la
«Nota su «Radar Live»» del §26.36 vanno lette come **storia**: quel debito è chiuso qui.

**Residuo dichiarato (fuori da questa guardia).** `src/departments/radar/flightBoard/righeBoard.ts`
contiene `risolviNomeScuola` (dicitura standard) ed `eInterpelloVisibile`: **codice morto**
(nessun `import` in `src/**` né in `scripts/**`), duplicato non cablato della stessa regola. Non
è stato toccato qui — la sua rimozione è una pulizia a sé, da fare col dipartimento Radar.

### 26.40 Visual Editor senza pannello-guida · riepilogo profilo reale · ricerca estesa per sinonimi

**Cosa cambia (tre interventi, tutti con guardie verdi).**

1. **Visual Editor: via il pannello descrittivo.** Il badge in basso a sinistra resta l'unico
   punto di comando e assorbe anche i due azzeramenti: conteggio (`N testi · M modificati`),
   **Esporta**, **Azzera** (questa pagina), **Azzera tutte**, **Esci**. Il pannello flottante che
   compariva a vuoto con «Modifica i testi della pagina / Clicca un testo: si apre la casella…»
   è stato **eliminato**: nessun testo d'aiuto, solo i comandi (la casella di modifica e la
   scheda di esportazione restano, con la loro X). Solo `src/components/dev/VisualEditorPannello.tsx`
   (dev tooling condiviso: nessun file di dipartimento).
2. **Profilo — «In cosa puoi lavorare» mostra i dati VERI.** La casella era una dicitura fissa
   («Classi di Concorso Monitorate (A-22, A-11, ecc.)»), identica per tutti: sembrava vuota perché
   non leggeva nulla. Ora la riempie `RiepilogoLavoro` (`src/departments/radar/components/`, nuovo,
   esportato da `radar/index.ts`): legge `preferenze` dal contesto e mostra le **classi di concorso**
   (codice + denominazione da `classeByCodice`), le **competenze di catalogo** (`materieId` → nome)
   e le **parole chiave personali** (`materieCustom`); con il profilo vuoto dice cosa manca e porta
   a `/dashboard/radar`. `src/pages/ProfiloPage.tsx` monta il componente al posto del markup statico.
3. **Ricerca estesa: «Inglese» aggancia le materie correlate.** Due pezzi nuovi in
   `src/data/ordiniMaterie.ts` — **`materieRicercabili()`** (le competenze extra PNRR/PON **più** i
   tag popolari che sono discipline curricolari: «Lingua inglese» → `inglese`, «Educazione motoria»
   → `ed_fisica`: prima non erano cercabili) e **`CORRELAZIONI_MATERIE`** (co-occorrenze curate
   termine → id di materie esistenti: `inglese` → `clil`, `educazione_linguistica`, `mediazione`…;
   `coding` → `robotica`, `digital_skills`; `ia`/`ai` → `intelligenza_artificiale`…). In
   `src/lib/ricercaSelezioniRadar.ts` nascono `materieCorrelate()`/`materiaCorrelata()` e le usano
   `cercaClassiDiConcorso` (una materia correlata vale come materia della classe) e
   `cercaCompetenzeExtra`; la parola chiave libera non è più riproposta quando il catalogo offre già
   quella voce (per **nome visibile** o per **id**). Misurato prima/dopo con una sonda read-only:
   `«inglese»` → **4 classi, 0 competenze, 1 parola chiave** ⇒ ora **4 classi, competenze «Lingua
   inglese» + CLIL + educazione linguistica + mediazione**, nessuna parola chiave ridondante.
   `«pedagogia»` resta **senza competenze** (nessuna disciplina curricolare entra nell'elenco).

**Diagnosi — perché NON partono notifiche Telegram/email (misure su dati reali, 03/10/2026).**

Configurazione: **a posto**. `.env` ha `SUPABASE_URL`, `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`; i flag dei dipartimenti lasciano `radar`
a `on` per default e il dirottamento admin vale solo in stato `test`. Il trigger orario esiste:
`.github/workflows/digest.yml` gira `0 15,16 * * 1-5` (UTC) e lo script invia solo quando in Italia
sono le 17:00 (`eOraDelDigest`, `ORA_DIGEST = 17`), con `workflow_dispatch` e `--force` per i lanci
manuali; il promemoria 24h è lo step successivo.

Il blocco è **a monte: i dati**. Misure (diagnostica read-only, script poi rimosso): `interpelli` =
609 righe · `contact_email` presente **325/609 (53,4%)** · `school_code` presente **142/609
(23,3%)** · `source_url` è un avviso **diretto** 433/609 (71,1%). Il **gate di qualità strict**
degli invii (`motivoAvvisoNonInviabile`: servono link diretto *e* recapito di candidatura,
`alertInterpello.ts`) scarta tutto ciò che non ha entrambi: il digest reale in `--dry-run --force`
produce `1 profili notificabili · 0 inviati · 1 saltati`, con `⛔ Avviso escluso dall'invio
(recapito di candidatura mancante)`. Intervallo di sicurezza: **49/609 righe (8%)** sono insieme in
vetrina e inviabili. Due cause concorrenti, entrambe da risolvere in **ingestione**: il gate
pretende un recapito che la pipeline non estrae (le PEC/PEO stanno nelle pagine sorgente, non in
tabella — `dati:arricchisci` in dry-run recupera **0 codici, 0 email, 0 nomi**, perché i titoli non
contengono un codice meccanografico) e non arrivano **righe nuove** (`created_at` massimo =
`2026-09-29`: da giorni ciò che esiste è fermo, ed è la condizione che `npm run admin:health`
segnala come «dispatch/scraper fermo»). Nota di contorno: `scripts/test-notifier-dry.ts` non chiama
`process.loadEnvFile()`, quindi annuncia «notifiche email disattivate» anche con la chiave presente
— lacuna della *diagnosi*, non dell'invio.

**Diagnosi — «Radar Live» «da 625 a 10» annunci.** L'imbuto reale, misurato riga per riga sui dati
veri, non lascia dubbi: **609 righe** in `interpelli` → il filtro temporale ne passa **609/609**
(44 con scadenza futura, 565 senza scadenza ma pubblicate entro i 60 giorni: `filtroAttivi` non
taglia nulla) → `urlValido(source_url)` **609/609** → `preparaRigheBoard` (vetrina §26.20) ne tiene
**66 (10,8%)**. Il crollo non è del filtro di scadenza né della lettura a pagine: è la **fonte** che
non porta il nome dell'istituto — `school_name` presente **70/609 (11,5%)** e *presentabile* appena
**19/609 (3,1%)**, `school_code` assente nel 76,7% dei casi, e i titoli sono **dump di codici di
classe** (`A041 | A020 | A033 | A040 | EEEE | ADEE`), da cui `scuolaDaTitolo` non ricava nulla. Le
66 righe che restano hanno un nome vero nel titolo o nel campo (`I.C. Ferruccio Ulivi`,
`I.C. Minervini Sisti`, …). Ricostruire i nomi dal registro è possibile solo col codice
meccanografico (assente) e `dati:arricchisci` non recupera nulla: serve l'**ingestione**
(`src/scraper/**`). L'alternativa — mostrare in vetrina l'**ente emittente** («USP Monza Brianza»
per i 433 avvisi ufficiali) — **cambia la direttiva cliente di §26.20** («se il nome non è
risolvibile in chiaro la riga NON entra»): è una decisione di prodotto, non un fix tecnico.

**Verifiche (03/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` → ✅ exit 0:
catena completa verde** (59 comandi, nessun arresto in `&&`) · `npm run test:architettura` → ✅
nessuna violazione nuova (563 file, **142 = baseline**) · `npx eslint` sugli 8 file toccati → ✅ 0
problemi · `npm run build` → ✅ · `test:ricerca` ✅ (con le nuove asserzioni estese) ·
`test:radar:preferenze` ✅ (guardia allineata: `materieRicercabili()` al posto del vecchio
controllo su `materieCompetenzeExtra()`) · `test:visual-editor` ✅ (entrambi gli script) ·
`test:board` ✅ · `test:nome-istituto` ✅ · `test:matching` ✅.

**File toccati.** `src/components/dev/VisualEditorPannello.tsx`,
`src/departments/radar/components/RiepilogoLavoro.tsx` (**nuovo**), `src/departments/radar/index.ts`,
`src/pages/ProfiloPage.tsx`, `src/data/ordiniMaterie.ts`, `src/lib/ricercaSelezioniRadar.ts`,
`scripts/test-ricerca-unificata.ts`, `scripts/test-radar-preferenze.ts`, `docs/SYSTEM_HANDOVER.md`,
`docs/DEPARTMENT_MAP.md`. **Fuori dal dipartimento Radar, per richiesta esplicita dell'utente:**
`src/pages/ProfiloPage.tsx` (pagina condivisa: monta il componente del Radar al posto del markup
statico) e `src/components/dev/VisualEditorPannello.tsx` (dev tooling condiviso). Nessun file dei
dipartimenti `notizie`, `cfu`, `modulistica`. Gli script di diagnostica usati per le misure
(`_funnel-radar.ts`, `_probe-ricerca.ts` e i relativi output) erano **temporanei** e sono stati
rimossi: i numeri sono qui sopra.

### 26.41 Anagrafica nazionale delle scuole (SCUANAGRAFE): nome, PEO e PEC reali su tutte le superfici

**Cosa cambia (sblocco esplicito dell'utente: dati + `src/scraper/**`).** Le fonti degli interpelli
pubblicano spesso **solo codici** (dump di classi, meccanografici) e la tabella `interpelli` non
aveva né il nome dell'istituto né un recapito: la vetrina pubblica scartava quelle righe (§26.20) e
il gate di qualità degli invii le escludeva («recapito di candidatura mancante», §26.40). Ora i
quattro file ufficiali del Ministero — `SCUANAGRAFESTAT` (statali), `SCUANAGRAFEPAR` (paritarie),
`SCUANAAUTSTAT` e `SCUANAAUTPAR` (autonomie di Trento/Bolzano) — alimentano un **indice per codice e
per nome** che completa le righe alla fonte.

**Moduli nuovi** (tutti **solo-Node**, mai nel bundle del browser):

| Modulo | Cosa fa |
|---|---|
| `src/lib/anagraficaCsv.ts` | Parser CSV RFC4180 (campi quotati, `""`, a capo nei valori), mappa riga → scuola (`ScuolaAnagrafica`), chiavi: `normalizzaNomeScuola`, **`chiaveCodiceScuola`** (permissiva 6–16 alfanumerici: i codici delle **paritarie** — `UD1A036009` — non passano la convenzione MIM statale e sarebbero stati scartati in silenzio), `chiaveProvincia`/`provinciaCodiceDaNome` (i connettivi cadono: «MONZA E BRIANZA» ≡ «Monza e della Brianza»). PEO/PEC in **minuscolo** |
| `src/lib/anagraficaIndice.ts` | Scoperta dei file per prefisso nella cartella `SCUOLERADAR_ANAGRAFICA_DIR` (default `~/Downloads`), costruzione dell'indice (`perCodice`, `perIstituto`, `perNome`) e **cache di processo** (i file pesano ~13 MB: mai ricaricati a riga) |
| `src/lib/anagraficaScuole.ts` | Superficie pubblica (ri-esporta i due moduli sopra): `scuolaDaCodice`, `scuolaDaNome` (solo se **univoco**, con provincia; ripete togliendo una testa di 2–6 caratteri perché l'avviso scrive «I.C. Ferruccio Ulivi» e l'anagrafica «Ferruccio Ulivi»), `nomeDaAnagrafica` (denominazione dell'**istituto**, passata dal gate §26.20) e **`arricchisciDaAnagrafica(riga)`** → patch `{ school_code, school_name, contact_email, school_pec }` |
| `src/scraper/anagraficaInterpelli.ts` | Ponte dello scraper: `arricchisciConAnagrafica(avviso)` completa la riga **all'inserimento** + `riepilogoAnagrafica()` per il log del run |

**Regole di sicurezza dei dati.** L'arricchimento **non sovrascrive mai** un campo già presente e
**non inventa nulla**: se il codice non è in anagrafica la riga resta com'è; un nome **ambiguo**
(omonimie senza provincia) non produce nulla. La PEC finisce nella colonna dedicata
`interpelli.school_pec` (migrazione nuova `20261003120000_add_interpelli_school_pec.sql`,
**opzionale e tollerata**: scraper e script la tolgono dal payload se non è applicata; **applicata in produzione il 03/10/2026**, vedi l'aggiornamento in coda a questa nota).

**Uniformità su Radar Pubblico, Personale e Regionale.** Tutte e tre le superfici leggono la stessa
tabella `interpelli`: le righe vengono completate **una volta sola** (script di manutenzione sulle
righe storiche + scraper per quelle nuove), quindi nessuna di esse ha logica duplicata né bisogno di
conoscere l'anagrafica.

**Misure sui dati reali (03/10/2026).** Anagrafica indicizzata: **62.850 codici** da 4 file
(50.273 statali · 11.331 paritarie · 1.178 autonomie statali · 68 autonomie paritarie).
`npm run dati:arricchisci -- --apply` su 609 righe: **142 risolte per codice**, **91 righe
aggiornate** (nome reale dell'istituto + codice/recapito dove mancavano). Effetto sulla vetrina
(§26.20): **da 66 a 157 righe** (`school_name` presentabile da 19 a 110 → tabellone dal 10,8% al
**25,8%**), con nomi veri (`ISTITUTO COMPRENSIVO DOMO 2`, `I.I.S. "SANSI-LEONARDI-VOLTA"`, …). Il
recupero **per nome** ha dato 0 su questi dati: i nomi negli avvisi non coincidono con le
denominazioni del registro (il percorso efficace è il codice).

**Guasto di produzione trovato e risolto (perché le notifiche non partivano).** `npm run scrape:check`
**falliva** — `src/config/features.ts` usava `window`, che nel programma Node-only dello scraper
(`tsconfig.scraper.json`, `lib` senza DOM) non compila. Il workflow `.github/workflows/scraper.yml`
esegue la validazione **prima** dello scraping: usciva in errore e **non scrapava**, quindi nessun
interpello nuovo entrava in tabella (ultimo `created_at`: 29/09) e non c'era nulla da notificare. Ora
la sincronizzazione fra schede usa un `globalThis` tipizzato: `scrape:check` → **exit 0**.

**Verifiche (03/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · `npm run scrape:check` →
✅ exit 0 (prima **falliva**) · **`npm test` → ✅ exit 0: catena completa verde** (60 comandi, il
nuovo `test:anagrafica` è l'ultimo) · `npm run test:anagrafica` → ✅ 25 asserzioni (parser CSV, indice,
lookup per codice/istituto/nome, ambiguità, arricchimento senza sovrascritture, smoke sui file reali)
· `npm run test:board` ✅ 17/17 · `npm run test:nome-istituto` ✅ · `npm run test:architettura` → ✅
**nessuna violazione nuova** (568 file, 142 = baseline; i due moduli lunghi sono stati spezzati in
`anagraficaCsv.ts` + `anagraficaIndice.ts` + `anagraficaScuole.ts` per restare sotto i limiti) ·
`npx eslint` sugli 8 file toccati → ✅ 0 problemi · `npm run build` → ✅ exit 0.

**File toccati.** `src/lib/anagraficaCsv.ts`, `src/lib/anagraficaIndice.ts`, `src/lib/anagraficaScuole.ts`
(**nuovi**, condivisi essenziali), `src/scraper/anagraficaInterpelli.ts` (**nuovo**), `src/scraper/index.ts`,
`src/scraper/parser.ts`, `src/config/features.ts`, `scripts/arricchisci-interpelli.ts`,
`scripts/test-anagrafica-scuole.ts` (**nuovo**), `supabase/migrations/20261003120000_add_interpelli_school_pec.sql`
(**nuova**, applicata in produzione il 03/10/2026), `package.json`, `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`.
Perimetro: sblocco esplicito dell'utente su `src/scraper/**` + i condivisi essenziali; nessun altro
dipartimento toccato. **Dati**: 91 righe di `interpelli` aggiornate (solo campi vuoti) con il
comando documentato `npm run dati:arricchisci -- --apply`.



> **Aggiornamento (03/10/2026, stesso giorno) — migrazione applicata + PEC della fonte: esito reale.**
> La migrazione `20261003120000_add_interpelli_school_pec.sql` è ora **applicata in produzione** con
> `supabase db push --project-ref gwdmsgsshvdnfrplbjiv`. Prima del push, `supabase migration list
> --linked` mostrava **una sola** migrazione pendente — proprio questa (tutte le altre 59 già `Remote`):
> il push non ha toccato altro. Verifica in sola lettura via PostgREST: **prima** `select=school_pec` →
> `42703 column interpelli.school_pec does not exist`; **dopo** → `200` con `school_pec: null`. Il
> percorso di tolleranza di scraper e script (payload senza la colonna) non è più esercitato.
>
> `npm run dati:arricchisci -- --apply` sulle **609 righe** ha riportato **0 righe aggiornate**: non è un
> guasto, è la conferma che il run precedente aveva già colmato tutto il colmabile (142 righe risolte per
> codice, 91 scritte). Con la colonna presente `pecDisponibile` resta `true`: nessun fallback silenzioso,
> nessuna PEC scartata dal payload.
>
> **Perché «PEC aggiunte 0» è il risultato CORRETTO (misurato sui file, non dedotto).** Il file delle
> statali pubblica la PEC come **«Non Disponibile» in 50.271 righe su 50.273** (soltanto 2 caselle reali);
> le autonomie statali 29 su 1.178; le **paritarie 7.048 su 11.331** — sono l'unica famiglia che pubblica
> la PEC. In `interpelli` i codici distinti sono **76** e **nessuno** appartiene a una paritaria con PEC
> (**intersezione = 0**): non c'era nulla da scrivere. `arricchisciDaAnagrafica` scrive `school_pec`
> **solo** quando il file la pubblica (`scuola.pec`), in linea col vincolo «non inventare».
>
> **Decisione di prodotto (confermata, NON implementata): la PEC non si ricostruisce per convenzione.**
> `comunicazione/01_email_riepilogo/checklist_email.md` §6 ammette `codice@pec.istruzione.it` **solo se
> non esiste alcun recapito PEO utilizzabile** e vieta esplicitamente di «ricostruire la PEC quando
> esiste la PEO»: qui la PEO c'è su tutte le righe arricchite, quindi `school_pec` **resta NULL per le
> statali** ed è il comportamento conforme — non un debito aperto né un bug da «sistemare». Per gli usi
> che richiedono la convenzione, `emailScuola.ts` continua a esporre
> `emailDaCodiceMeccanografico().pec` (e `school-lookup.ts` il suo `pecEmail`).
>
> **Verifiche (03/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` → ✅ catena
> completa verde** (60 comandi, fino a `test:anagrafica`; log del run: 1.566 righe, **0 marker di
> errore**) · `npm run scrape:check` → ✅ exit 0 · `npm run test:architettura` → ✅ 568 file, 142 = baseline
> (**nessuna violazione nuova**) · dati: 0 righe modificate da questo run, colonna `school_pec` presente e leggibile
> (`select=school_pec`).
>
> **Ingestione ancora ferma al 29/09 (atteso).** Il `created_at` massimo in `interpelli` è il
> **29/09/2026** e le righe con `school_pec` valorizzata sono **0**: lo scraper ricomincerà a inserire
> quando la correzione di `scrape:check` (`src/config/features.ts`) sarà **committata e pushata** — il
> workflow GitHub gira sui file del repository, non sul working tree. È il passo che riaccende davvero il
> flusso delle notifiche; per avere l'arricchimento anche sul runner servono i file SCUANAGRAFE
> (`SCUOLERADAR_ANAGRAFICA_DIR`, ~15 MB, non versionati: senza di essi le righe nuove nascono come prima).

---

### 26.42 «Radar Live»: schermate ESATTE nella bacheca pubblica — via il `+` e la dicitura fissa (03/10/2026)

**Direttiva cliente (03/10/2026).** L'etichetta sotto il tabellone mostrava
`Pagina 1 di 32+ - Aggiornamento automatico`: il `32` (righe in vetrina ÷ 5) e il `+` dicevano due
cose diverse e il `+` sembrava un **tetto**, non un conteggio. Ora l'etichetta è **`Schermata X di
Y`**: `Y` = elementi presenti in vetrina ÷ 5, arrotondati per eccesso. Nessun `+`, nessuna dicitura
fissa — il numero cresce solo quando si apre davvero una schermata nuova.

**Moduli toccati (dipartimento Radar).**
- `radar/flightBoard/metricaBoard.ts` — `etichettaPagina(pagina, pagine)` → `` `Schermata X di Y` ``
  (indici normalizzati: mai 0/`NaN`/decimali, `X` sempre compreso fra 1 e `Y`);
  `MetricaBoard.oltreIlLimite` **rimosso** e `metricaBoard` non calcola più maggiorazioni.
- `radar/FlightBoardInterpelli.tsx` — la scala arriva da `pagineBoard(totale, RIGHE_PER_PAGINA)`,
  la **stessa** funzione che `metricaBoard` usa per l'etichetta: etichetta, rotazione automatica e
  taglio delle righe mostrate parlano di un solo numero (prima il componente ricalcolava
  `Math.ceil(totale / 5)` a mano, con il rischio di divergere).
- `radar/flightBoard/__tests__/metricaBoard.test.ts` — attese aggiornate + guardie nuove
  («nessun `+` e nessuna dicitura fissa», «schermata oltre il totale agganciata all'ultima»).

**Misure reali (03/10/2026: `board:diag` + sonda di vetrina con la pipeline del componente).**
`interpelli` = **609** righe, **tutte** con `source_url` valido e **nessuna** scaduta → il badge
dichiara il conteggio esatto **«609 avvisi attivi in Italia»**; le righe **presentabili in vetrina**
(§26.20: solo nomi d'istituto in chiaro, risolti anche per codice meccanografico) sono **157** →
etichetta **«Schermata X di 32»**. Non «122» (609 ÷ 5): il tabellone mostra 157 avvisi e un numero
più grande del contenuto sarebbe, di nuovo, un numero che non regge.

**Regola di prodotto aggiornata.** `comunicazione/04_canali_regionali/checklist_regionali.md` §4:
la voce della bacheca pubblica ora pretende il conto ESATTO («Schermata X di Y», senza `+` e senza
dicitura fissa) sulle righe davvero presenti; il totale resta il **conteggio esatto** del database.

**Test REALE di email, Telegram e dispatch (nessun mock, stesso giorno).**
- `npm run test:notifiche` → **email Resend inviata** a `bartoloansaldi@gmail.com` (`✓ Inviata`) e
  **Telegram inviato** alla chat configurata nell'ambiente (`✓ Inviato`, chat privata `8683710446`).
  Connettività del canale verificata a monte con le API Telegram: `getMe` → bot **`ScuoleRadar_bot`**
  (id 8894515872, `ok: true`), `getChat` → utente privato valido (`ok: true`).
- `npx tsx scripts/admin-dispatch-user.ts bartoloansaldi@gmail.com` (dry-run) e
  `npm run notifiche:digest -- --force --dry-run` → il motore `inviaDigestGiornaliero` elabora i
  profili veri: **1 profilo notificabile su 8** in tabella (`free_forever`, province `AT`, classi
  `A-22`/`A-24`, sostegno, Telegram collegato) e **1 opportunità compatibile scartata dal gate di
  qualità** («recapito di candidatura mancante»: l'avviso non ha PEO/PEC risolvibile) → **0 invii,
  0 errori**. È il comportamento voluto dal gate stretto (§26.40), non un guasto: quando una riga
  compatibile avrà un recapito, il digest partirà con lo stesso motore.
- Nessun invio a terzi e **nessuna quota consumata**: il contatore `incrementa_notifiche_utente`
  viene toccato solo dopo il controllo `voci.length > 0` (e nel run reale solo se non si è in
  dry-run), quindi un dry-run non «brucia» né crediti né voce di ledger.

**Verifiche (03/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` → ✅ catena
completa verde** (exit 0, log 1.523 righe, **0 marker di errore**) · `npm run test:board:metriche` →
✅ 21/21 · `test:board:lettura` + `test:board:filtro` + `test:board` + `test:board:scala` → ✅ exit 0 ·
`npm run test:architettura` → ✅ **568 file, 142 = baseline** (nessuna violazione nuova) ·
`npx eslint` sui 3 file toccati → ✅ 0 problemi · `npm run build` → ✅ `built in 11,33s` (solo il
warning preesistente sui chunk > 500 kB).

**File toccati.** `src/departments/radar/flightBoard/metricaBoard.ts`,
`src/departments/radar/FlightBoardInterpelli.tsx`,
`src/departments/radar/flightBoard/__tests__/metricaBoard.test.ts`,
`comunicazione/04_canali_regionali/checklist_regionali.md`, `docs/SYSTEM_HANDOVER.md`,
`docs/DEPARTMENT_MAP.md`. Perimetro: **solo dipartimento Radar** + la checklist di prodotto della
bacheca; nessun altro dipartimento toccato, nessuna migrazione, nessuna modifica a
`src/lib/**` o `src/config/**`.

### 26.43 Notifiche email/Telegram: `\vert{}` nel gate dei link, semantica della query string, guida del digest (04/10/2026)

**Nota di sessione (04/10/2026).** Riparazione della catena di notifica (condivisi essenziali
`src/lib/**`): tre difetti reali corretti e due conferme misurate a runtime. Il punto di partenza era
di prodotto — la classificazione della **fonte ufficiale** («Apri l'avviso ufficiale») non si comportava
più come previsto — e la causa vera era un **artefatto di escape JSON** finito dentro una regex.

1. **Regex CORROTTA nel gate dei link** (`src/lib/alertInterpello.ts`, `RE_HOST_INTERNO`). L'alternanza
   conteneva la sequenza `\vert{}` al posto della giunzione `$|(^|\.)`: la branca dei **host interni**
   (`scuoleradar.it`/`scuoleradar.com`, `purefocus.one`, `localhost`, `127.0.0.1`, `0.0.0.0`) non
   matchava più, quindi `eLinkEsterno()` non escludeva più gli URL della piattaforma e un URL di
   ScuoleRadar poteva essere trattato come **fonte esterna** (mostrato come «Apri l'avviso ufficiale» e
   ammesso dal gate dei canali). Ripristinata la giunzione con scrittura **byte-exact** (UTF-8 senza BOM,
   **CRLF preservati**, emoji intatte). In `src/**` e `scripts/**` non resta **nessun** `\vert{}`
   (verificato anche a livello di byte: nessun `0x0B` nei sorgenti).
2. **Semantica della query string nel gate `eUrlAvvisoDiretto`** (§6.4, riga «LINK alla fonte»). Prima la
   sola presenza di una query string rendeva l'URL non diretto, in blocco: anche la pagina tabellare
   «Stampa» del singolo avviso (`?cod=…`) veniva scartata. Ora il verdetto passa da due elenchi
   espliciti — **`RE_QUERY_ID_AVVISO`** (`cod`, `codice`, `id`, `uid`, `prot`, `protocollo`, `num`,
   `numero`, `atto`, `pratica`, `doc`, `documento`, `file`, `allegato`) e **`RE_QUERY_RICERCA`** (`s`,
   `q`, `query`, `search`, `ricerca`, `cerca`, `keyword`, `filtro`/`filtri`, `anno`, `mese`, `tag`,
   `category`/`categoria`, `archivio`, `page`/`paged`, `offset`, `limit`, `classe`, `provincia`, `data`,
   `dal`, `al`). Regola: un parametro di **ricerca/filtro** esclude il singolo avviso (anche se c'è un
   `id`), un parametro **sconosciuto** è trattato con prudenza (non diretto), senza query restano le
   regole su percorso (archivi/elenchi/tag, home con un solo segmento). Esiti: `/interpelli/stampa?cod=…`
   → **diretta** (pagina tabellare del singolo avviso: checklist email §5), `/albo/stampa?classe=A022` e
   `?s=interpello` → **non dirette**.
3. **Guida del digest Telegram calcolata sull'URL GREZZO** (`src/lib/telegram.ts`, `bloccoVoceTelegram`).
   `suggerimentoRicercaAvviso({ compatto: true })` era calcolata sull'URL *mostrato*: per una voce con
   elenco/«Stampa» filtrato (fonte non mostrabile dal gate STRICT) la guida **spariva**, proprio nel caso
   in cui serve. Ora si calcola su `v.link`: resta la riga *«cerca la riga con «A-022» e leggi lì date e
   classi»*, mentre la riga `🔗 Fonte Ufficiale` continua a obbedire al gate. Corretta anche la variante
   **compatta**, che perdeva verbo e riga da cercare. Le email restano **senza** guida (checklist email §4).

**Conferme misurate a runtime (nessuna modifica necessaria).**
- **Testata di brand su ogni superficie.** Telegram: prima riga di ogni messaggio =
  `📡 <a href="https://www.scuoleradar.it">Scuole Radar.it</a>` (`BRAND_RIGA_TELEGRAM`, garantita in modo
  idempotente nel layer di invio). Email: `intestazioneBrandHtml()` (logo + «Scuole Radar.it») in alert e
  digest.
- **Recapito della scuola nel corpo.** Il `mailto:` del recapito risolto è presente **sia** nell'email sia
  nel messaggio Telegram (etichetta condivisa `📧 Candidature`). Il campo è **uno solo** (`contactEmail`) e
  segue la gerarchia della checklist email §6 — PEO istituzionale, poi generica, poi segreteria, **poi** la
  PEC: la PEC resta l'ultima risorsa e non si ricostruisce quando la PEO esiste (§26.41: `school_pec`
  resta NULL per le statali). Nessuna riga PEC separata nei corpi: sarebbe una violazione della §6.

**Verifiche (04/10/2026, da `project/`).** `npm run test:alert`, `test:email`, `test:link`,
`test:email-alert`, `test:digest`, `test:qualita`, `test:promemoria`, `test:link-esterno`, `test:telegram`,
`test:telegram:template`, `test:telegram:tier`, `test:email-scuola` → ✅ **tutte verdi** (nessun marker
`✗`) · `npm run typecheck` → ✅ exit 0 · `npm run test:architettura` → ✅ **nessuna violazione nuova**
(568 file, 142 = baseline) · `npm run build` → ✅ `built in 12,28s` (solo il warning preesistente sui
chunk > 500 kB) · `npx eslint` sui file toccati → ✅ 0 problemi.

**File toccati (tutti condivisi essenziali o guardie della modifica stessa).**
`src/lib/alertInterpello.ts` (regex riparata, gate della query string, variante compatta della guida),
`src/lib/telegram.ts` (guida del digest sull'URL grezzo), `scripts/test-alert-avviso.ts`,
`scripts/test-link-fonte.ts`, `scripts/test-email-alert.ts`, `scripts/test-promemoria.ts` (fixture con
date 2099 al posto di date costruite su un `ADESSO` congelato: il digest risultava vuoto; l'asserzione
della guida punta al testo della guida e non a `STAMPA` dentro l'URL), `docs/SYSTEM_HANDOVER.md`.
Nessun file di dipartimento, nessuna migrazione, nessun dato di produzione toccato.

**Difetto FUORI PERIMETRO (solo segnalato, non toccato).** Lo stesso artefatto `\vert{}` è presente in
`src/departments/notizie/services/promptEditoriale.ts:30`, come separatore dei titoli nel prompt
editoriale del dipartimento **Notizie**: serve lo **sblocco congiunto** su quel dipartimento per
correggerlo (qui ci si ferma, come impone l'isolamento dei dipartimenti).

### 26.44 Notifiche: header email testuale, un solo pulsante di fonte, riga di fonte garantita su Telegram, email aggregate (04/10/2026)

Quattro interventi correttivi sui **moduli di notifica** (Telegram + email), richiesti
dopo l'analisi degli ultimi invii. Nessun file di dipartimento toccato: si opera sui
condivisi essenziali (`src/lib/**`), sui moduli di notifica e sulle guardie.

1. **Intestazione email SOLO testuale** (`src/lib/resend.ts`, `intestazioneBrandHtml`;
   stessa resa nella Edge `supabase/functions/send-notification`). Rimosso
   **definitivamente** il logo-immagine delle email (`LOGO_URL`/`logo.png`): i client
   di posta lo rendevano compresso e sgranato e dominava il messaggio. Al suo posto la
   scritta `Scuole Radar.it` su una riga centrata, **cliccabile** verso
   `scuoleradar.it` (nuova costante `URL_BRAND`). Vale per alert, digest, promemoria e
   per le email di ciclo di vita della Edge. Guardia statica in `npm run test:copy`
   (nessun `<img>`/`logo.png` nei renderer email, `URL_BRAND` presente).
2. **Un solo pulsante «Apri l'avviso ufficiale» per voce** (checklist email §5
   aggiornata). `fonteInEvidenza()` non è più una scatola celeste che **duplicava** la
   dicitura già presente sul bottone CTA: ora rende **un unico pulsante blu brand**.
   Nella card dell'alert la riga di fonte è stata **rimossa** (la CTA primaria in
   fondo è l'unica azione); nel digest e nel promemoria il pulsante è l'unica azione
   della voce. La dicitura e l'URL dell'annuncio compaiono **una volta sola**
   (asserzioni nuove in `test:email`, `test:link`, `test:email-alert`, `test:digest`).
3. **Riga di fonte GARANTITA su Telegram** (`src/lib/telegram.ts`). La riga
   `👉 Apri l'avviso ufficiale` era costruita sul link già filtrato
   (`linkOpportunita`): un doppio gate a monte poteva farla **sparire** anche con una
   fonte esterna valida. Ora si costruisce sull'**URL grezzo** della voce
   (`interpello.link` / `v.link`) e il gate sulla destinazione resta **uno solo**
   (`eUrlAvvisoDiretto`, dentro `rigaAvvisoUfficiale`): home, elenchi e pagine di
   ricerca restano esclusi e non esiste alcun fallback alla home di ScuoleRadar.
4. **Email AGGREGATE: mai una email per opportunità** (checklist email §1 aggiornata).
   La pipeline già consegnava un solo digest (17:00); restavano due percorsi eseguibili
   che potevano mandare **N email** (una per avviso): `notificaNuoviInterpelli` e
   `notificaInterpelliPerUtente`. Ora entrambi **accumulano** le voci compatibili
   (`accumulaVoceEmail`) e le consegnano con **UNA sola** email di riepilogo
   (`inviaEmailAccumulate` → `inviaDigestEmail`, stesso renderer/oggetto del digest),
   registrando la consegna per voce nel ledger (`registraInvioAvviso`). L'esito di
   `notificaInterpelliPerUtente` espone il nuovo campo `EsitoDispatchUtente.emailVoci`.
   Il canale **Telegram resta individuale** (alert PRO in tempo reale). Guardia statica
   in `npm run test:copy`: in `src/lib/notifier.ts` non esiste più alcuna
   `inviaNotificaEmail(` — le email di opportunità passano solo da `inviaDigestEmail`.

**Conferme misurate a runtime.** Recapito della scuola: il `mailto:` della scuola
(campo unico `contactEmail`, gerarchia checklist §6 con la **PEC come ultima risorsa**)
è presente in **tutte** le email di opportunità e nei messaggi Telegram, con l'etichetta
condivisa `📧 Candidature`; il gate di qualità STRICT esclude gli avvisi senza recapito,
quindi la riga non manca mai quando il messaggio parte (nessuna riga PEC separata: la
§6 la vieta). Le email restano **senza** guide operative (checklist §4).

**Verifiche (04/10/2026, da `project/`).** `npm run test:copy`, `test:email`,
`test:link`, `test:email-alert`, `test:digest`, `test:promemoria`, `test:alert`,
`test:link-esterno`, `test:notifier-dry`, `test:telegram`, `test:telegram:template`,
`test:telegram:tier`, `test:qualita`, `test:email-scuola` → ✅ tutte verdi ·
`npm run typecheck` → ✅ exit 0 · `npm run test:architettura` → ✅ nessuna violazione
nuova · `npm run build` → ✅ · `npm test` → ✅ catena completa verde.

**File toccati.** `src/lib/resend.ts`, `src/lib/telegram.ts`, `src/lib/notifier.ts`,
`supabase/functions/send-notification/index.ts` (**modulo di notifica**: header email
testuale), `scripts/test-email-template.ts`, `scripts/test-link-fonte.ts`,
`scripts/test-email-alert.ts`, `scripts/test-digest.ts`, `scripts/test-promemoria.ts`,
`scripts/test-copy-notifiche.ts` (nuove guardie statiche),
`comunicazione/01_email_riepilogo/checklist_email.md`, `comunicazione/README.md`,
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. Nessun file di dipartimento,
nessuna migrazione, nessun dato di produzione.

### 26.45 Notifiche: riga di fonte garantita su Telegram, sostegno a inclusione permanente, ricerca classi a prova di formato (04/10/2026)

Tre interventi correttivi richiesti sul **modulo di notifica** e sulle **preferenze
Radar**. Perimetro: condivisi essenziali (`src/lib/**`, `src/contexts/app/**`),
dipartimento **Radar**, il modulo di notifica e le guardie. Nessuna migrazione, nessun
dato di produzione.

1. **Riga «👉 Apri l'avviso ufficiale» sempre presente e in formato pulito**
   (`src/lib/alertInterpello.ts` + `src/lib/telegram.ts` + `src/lib/resend.ts`). La riga
   poteva **sparire** quando l'URL della fonte arrivava con i caratteri di contorno della
   pagina (entità HTML `&amp;`, virgolette/angolari/caporalia di markdown, puntini e
   spazi della frase): il gate di qualità lo considerava «non diretto», quindi nessun link
   usciva (e in email nessun pulsante di fonte). Ora esiste un **punto unico**:
   `pulisciUrlEsterna()` (pulizia idempotente dell'URL) e **`urlFonteAvviso()`** =
   stringa PULITA + UNICO gate `eUrlAvvisoDiretto`; `rigaAvvisoUfficiale`,
   `rigaFonteUfficiale`, `linkOpportunita` e `fonteInEvidenza` passano tutti da lì (mai
   home/elenchi/ricerche, mai un fallback alla home di ScuoleRadar). Il gate riconosce
   anche i link a singolo avviso con parametri di identità tipici dei CMS
   (`?p=`, `?news=`, `?nid=`, `?post=`, `?articolo=`). Nel digest la riga è costruita
   sull'**URL della voce** (grezzo → pulito), negli alert su `interpello.link`.
2. **Sostegno a INCLUSIONE PERMANENTE: via toggle e logica condizionale**
   (`src/lib/matchingEngine.ts`, `src/lib/notifier.ts`, `src/departments/radar/**`,
   `src/contexts/app/**`). Il sostegno non è più una preferenza: eliminate le funzioni
   storiche `sostegnoAmmesso`/`utenteAderisceSostegno` e il gate condizionale; al loro
   posto **`avvisoDiSostegno()`** e, nella REGOLA UNICA, un'**eccezione esplicita**: un
   avviso dell'area sostegno (codici `ADAA/ADEE/ADMM/ADSS`, oppure titolo/materia che lo
   dichiarano) **non passa dal controllo di classe** e viene consegnato a **tutti** i
   profili configurati della provincia — nessun interruttore, nessun opt-out
   (`profiles.sostegno` resta nel DB come valore storico, non decide più nulla). Vale
   anche per l'**alternativa all'insegnamento della religione**: nessun filtro dedicato.
   L'inclusione non è cieca: restano il vincolo di **provincia**, il gate di qualità
   (link diretto + recapito di candidatura) e l'esclusione dei profili non configurati —
   così il volume di opportunità utili aumenta senza invii a caso. UI: rimosso il
   componente `src/components/SostegnoToggle.tsx` (nessun `role="switch"`, nessuna
   uscita); nelle Preferenze Radar `PannelloClassi.tsx` mostra un blocco **informativo**
   «Opportunità di sostegno — Incluse, sempre». Guardie statiche in
   `npm run test:copy:pubblico` (nessun toggle, `inclusione permanente, non
   disattivabile`, componente assente).
3. **RICERCA CLASSI DI CONCORSO a prova di formato** (`src/lib/ricercaSelezioniRadar.ts`,
   `src/departments/radar/PreferenzeRadar.tsx`, `src/departments/radar/RadarWizardModal.tsx`,
   `src/pages/onboarding/OnboardingPage.tsx`). Il filtro delle classi nelle Preferenze
   Radar (dashboard) e nell'onboarding confrontava le stringhe alla lettera: digitando
   `a19` o `  a 19  ` la casella restava **vuota**. Ora la regola vive **una volta sola**
   nel motore condiviso — `classeRispondeAQuery()` / `classeCorrispondeAQuery()` — e
   riconosce ogni variante di scrittura del codice (`a19`, `A19`, `A-19`, `a-19`, `A_19`,
   `A.19`, `A-019`, `A019`, `  a 19  `), oltre a denominazione e materia collegata; le
   Preferenze e l'onboarding **usano la stessa funzione**, quindi i risultati coincidono
   su tutte le superfici. Guardie in `npm run test:ricerca` (matrice delle varianti su
   `A-19`, verifica su **tutte** le classi del catalogo, nessun confronto «fai-da-te» nei
   file delle superfici).

**Verifiche (04/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 ·
`npm test` → ✅ catena completa verde · `npm run test:architettura` → ✅ **nessuna
violazione nuova** (file compattati per restare sotto le soglie 250/300) ·
`npm run build` → ✅ · `npx eslint` sui file toccati → ✅ zero errori · suite mirate
`test:ricerca`, `test:sostegno`, `test:matching`, `test:copy:pubblico`,
`test:radar:preferenze`, `test:qualita`, `test:link`, `test:link-esterno`, `test:email`,
`test:email-alert`, `test:email-scuola`, `test:digest`, `test:promemoria`,
`test:telegram`, `test:telegram:template`, `test:telegram:tier`, `test:telegram:canali`,
`test:notifiche`, `test:notifier-dry`, `test:alert`, `test:migrazioni`,
`test:dedup:utente`, `test:copy:etico`, `test:copy:schermo`, `test:testi-chiave` → ✅
tutte verdi.

**File toccati.** `src/lib/alertInterpello.ts`, `src/lib/telegram.ts`,
`src/lib/resend.ts`, `src/lib/matchingEngine.ts`, `src/lib/notifier.ts`,
`src/lib/ricercaSelezioniRadar.ts`, `src/contexts/app/costanti.ts` (commento),
**departimento Radar**: `src/departments/radar/preferenze/PannelloClassi.tsx`,
`src/departments/radar/PreferenzeRadar.tsx`, `src/departments/radar/RadarWizardModal.tsx`
· `src/pages/onboarding/OnboardingPage.tsx` (host del flusso Radar: stesso motore di
ricerca) · `src/components/SostegnoToggle.tsx` **rimosso** · guardie:
`scripts/test-ricerca-unificata.ts`, `scripts/test-sostegno-preferenza.ts`,
`scripts/test-matching-profilo.ts`, `scripts/test-matching-competenze.ts`,
`scripts/test-copy-pubblico.ts`, `scripts/test-radar-preferenze.ts` · documentazione:
`docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. Nessun altro dipartimento toccato,
nessuna migrazione. Nota: eventuali righe del DB con `profiles.sostegno = false` restano
tali ma **non hanno più alcun effetto** sulla consegna; il primo salvataggio delle
Preferenze le riallinea a `true`.

### 26.46 Radar Personale sui dati reali, sostegno invisibile, campi di ricerca separati, copy delle notifiche (04/10/2026)

Quattro interventi richiesti dal prodotto su **Radar Personale** e **notifiche**.
Perimetro: condivisi essenziali (`src/lib/**`, `src/contexts/app/**`, `src/config/**`),
dipartimento **Radar** e il modulo di notifica (incluso l'Edge `send-notification`).
Nessuna migrazione, nessun dato di produzione.

1. **Radar Personale = DATI REALI, nessun mock** (`src/contexts/app/useInterpelliFeed.ts`).
   Verificato il flusso: la bacheca personale legge la tabella `interpelli` via Matching
   Engine (`getFeedInterpelli` → `searchInterpelli`: filtri PostgREST `in(province)` +
   `overlaps(class_codes)` con varianti `A-22 ≡ A-022 ≡ A22` e finestra scadenze), con
   fallback alla tabella legacy `notices` e, se non c'è nulla di attivo, **feed VUOTO**
   (`src/data/interpelli.ts` è `[]` per policy: nessun dato dimostrativo — il «Liceo
   Monti» ricorre solo nei commenti e nelle fixture dei test). Aggiunta l'**inclusione
   forzata del sostegno** anche nel feed: gli avvisi `AD…` (o con titolo/materia che lo
   dichiarano) entrano nella bacheca entro la provincia dell'utente con la **stessa
   regola** del motore di notifica (`avvisoDiSostegno`): bacheca e notifiche non
   divergono più.
2. **Sostegno invisibile: rimosso il blocco visivo**
   (`src/departments/radar/preferenze/PannelloClassi.tsx`). Non compare più alcun testo
   «Opportunità di sostegno», nessun interruttore e nessuna nota: l'inclusione è
   **nativa e permanente nel backend** (§26.45). Il pannello resta il solo selettore
   delle classi di concorso. Guardia aggiornata in `npm run test:copy:pubblico` (assenza
   del blocco + nessun `role="switch"`).
3. **Campi di ricerca di nuovo SEPARATI e matcher tollerante su materia e ordine.**
   Nuovo modulo condiviso `src/lib/ricercaTesto.ts` (normalizzazione, materie correlate,
   ordine di scuola, parole chiave), ri-esportato da `src/lib/ricercaSelezioniRadar.ts`;
   nuova `cercaCompetenzeParole()` usata dalle Preferenze, così la colonna di **destra**
   (competenze/parole chiave) **non restituisce più classi di concorso** — niente
   doppioni con il campo di **sinistra** («Classi di concorso»), che resta l'unico
   selettore delle abilitazioni. Il wizard continua a usare la ricerca unificata
   (`cercaSelezioniRadar`). Il filtro delle classi ora risponde anche al **nome
   dell'ordine** («CPIA», «adulti», «primaria», «infanzia») oltre che a codice
   (`a19` ≡ `A-19` ≡ `A_19`…), denominazione e materia («italiano»): nessun risultato
   vuoto per una differenza di formato o di nome dell'area. Le guardie statiche di
   cablaggio vivono in `scripts/test-ricerca-cablaggio.ts` (file sotto soglia), mentre
   `test-ricerca-unificata.ts` copre il comportamento del motore.
4. **Copy delle notifiche** (`src/lib/alertInterpello.ts`, `src/lib/telegram.ts`,
   `src/lib/resend.ts`, `src/config/automazioniEmailCatalogo.ts`,
   `supabase/functions/send-notification/index.ts`). La dicitura del link/pulsante di
   fonte è ora **«Guarda la fonte ufficiale»** — unica stringa
   (`ETICHETTA_AVVISO_UFFICIALE`) per email, Telegram, Edge e anteprima del pannello
   Admin — e punta **solo** all'URL esterno dell'avviso specifico (punto unico
   `urlFonteAvviso` → gate `eUrlAvvisoDiretto`, nessun fallback a home/elenchi). L'incipit
   delle **email di opportunità** (alert e digest) è più caldo e personale —
   `FRASE_OPPORTUNITA` in `resend.ts`: «Ciao <nome>, / Abbiamo trovato nuove opportunità
   per te! Dai un'occhiata e, se ti interessa, applica al più presto!». **Email/PEC della
   scuola sempre nel blocco di notifica**: il recapito è derivato (PEO/PEC dalla
   convenzione MIM sul codice meccanografico via `recapitoNotifica` →
   `risolviEmailUfficialeScuola`) e il gate di qualità blocca l'invio senza recapito:
   ogni notifica che parte lo espone, e quando manca davvero nessun segnaposto viene
   inventato.

**Verifiche (04/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 ·
`npm test` → ✅ catena completa verde (include il nuovo `scripts/test-ricerca-cablaggio.ts`)
· `npm run test:architettura` → ✅ **nessuna violazione nuova** (569 file · 142 violazioni
= baseline) · `npm run build` → ✅ · `npx eslint` sui file toccati → ✅ zero errori (resta
1 warning `react-hooks/exhaustive-deps` pre-esistente in `PreferenzeRadar.tsx`) · suite
mirate `test:ricerca`, `test:copy`, `test:copy:pubblico`, `test:email`, `test:link`,
`test:email-alert`, `test:digest`, `test:qualita`, `test:telegram:template`,
`test:telegram:canali`, `test:telegram:tier`, `test:link-esterno`, `test:sostegno`,
`test:matching`, `test:radar:preferenze`, `test:promemoria`, `test:notifier-dry`,
`test:dedup`, `test:dedup:utente`, `test:frequenza`, `test:alert`, `test:trasparenza` →
✅ tutte verdi.

**File toccati.** `src/lib/ricercaSelezioniRadar.ts` · **nuovo** `src/lib/ricercaTesto.ts`
· `src/lib/alertInterpello.ts`, `src/lib/telegram.ts`, `src/lib/resend.ts` ·
`src/contexts/app/useInterpelliFeed.ts` · `src/config/automazioniEmailCatalogo.ts` ·
**dipartimento Radar**: `src/departments/radar/preferenze/PannelloClassi.tsx`,
`src/departments/radar/preferenze/PannelloMaterie.tsx`,
`src/departments/radar/PreferenzeRadar.tsx` ·
`supabase/functions/send-notification/index.ts` (etichetta allineata: fa parte della
catena di notifica richiesta) · guardie: `scripts/test-ricerca-unificata.ts`,
**nuovo** `scripts/test-ricerca-cablaggio.ts`, `scripts/test-copy-pubblico.ts`,
`scripts/test-copy-notifiche.ts`, `scripts/test-link-fonte.ts`,
`scripts/test-email-alert.ts`, `scripts/test-email-template.ts`,
`scripts/test-digest.ts`, `scripts/test-telegram-template.ts`,
`scripts/test-promemoria.ts`, `scripts/test-qualita-invio.ts` · `package.json` (catena
`test:ricerca`) · documentazione: `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`,
`comunicazione/**` (etichette di fonte). **Non toccati**: `src/departments/notizie/**`
(l'etichetta degli articoli «apri l'avviso ufficiale» è di quel dipartimento isolato) e
`src/scraper/**` (solo commenti). Nessuna migrazione.

### 26.47 Pipeline Radar tollerante e blindata: bonifica dei mock, anagrafica `completo`/`parziale`, matching RPC nativo (04/10/2026)

> **⚠️ Dicitura superata (04/10/2026) e regola superata (05/10/2026).** La dicitura di vetrina
> introdotta in questa direttiva — «Anagrafica in aggiornamento» — è **superata dalla §26.48**
> (segnaposto neutro **«Scuola non specificata / Più plessi»**); l'**ingresso in bacheca senza
> istituto reale** è a sua volta **superato dalla §26.59** (in vetrina entra solo una riga con un
> istituto reale risolto: il segnaposto resta nella sola scheda del singolo avviso). Restano validi
> il resto della direttiva (arricchimento `completo`/`parziale`, ingresso della riga in `interpelli`
> senza scarto per anagrafica, matching RPC nativo).

Direttiva di prodotto del 04/10/2026 su **ingestione → database → matching**, con due
correzioni dettate dal campo: (a) il «Liceo Augusto Monti» di **Asti è una scuola
REALE** — si rimuovono solo i generatori di dati fittizi, mai i dati veri; (b) **un
interpello genuino non si scarta MAI** per un'anagrafica incompleta (caso storico: i
**10 annunci di Padova** spariti dalla bacheca perché l'istituto non era mappato).
Perimetro: condivisi essenziali (`src/lib/**`, `src/data/**`, `src/scraper/**`),
dipartimento **Radar** (`flightBoard/**`, `FlightBoardInterpelli.tsx`), migrazioni
`supabase/migrations/**`, guardie e documentazione. Nessun dato di produzione toccato:
le due migrazioni vanno applicate dal committente (nessuna scrittura sul DB in questa
sessione).

**1 · Bonifica dei mock (nessun dato inventato).** Il feed di fallback è `[]` (già da
§26.46) e la vecchia `FIXTURE_HTML` era stata rimossa; restava UN generatore di dati
fittizi in codice di PRODUZIONE: `resolveSchoolByCode` in `src/lib/school-lookup.ts`,
che per **qualsiasi** codice meccanografico costruiva `name: 'Istituto <codice>'`,
`city: 'N/D'`, PEO e PEC — ed era usato dallo scraper come ultima risorsa per
l'email. Ora la funzione è **rimossa** (al suo posto `scuolaDaCodice`, che ritorna
`null` quando l'istituto non è nel registro reale) e `emailIstituzionaleDaCodice` usa
**solo** la convenzione ufficiale MIM (`emailDaCodiceMeccanografico` →
`codice@istruzione.it`): per i codici validi produce la stessa casella di prima, per i
codici malformati non produce più nulla (nessuna email inventata). Rimossa anche la
dicitura fissa **«Scuola non specificata / Più plessi»** col suo codice morto in
`radar/flightBoard/righeBoard.ts` (`risolviNomeScuola`, `eInterpelloVisibile`: erano un
duplicato non cablato della regola di vetrina, §26.32). Lo scraper, quando non trova
nulla, **logga e si ferma** (branch `unici.length === 0`): nessun seed, nessun
inserimento di comodo.

**2 · Arricchimento TOLLERANTE: nuovo stato `stato_arricchimento`.** Migrazione nuova
`20261004100000_add_interpelli_stato_arricchimento.sql` (idempotente): colonna
`stato_arricchimento text`, vincolo `check ('completo'|'parziale')`, **backfill** delle
righe esistenti (legge `school_pec` solo se la migrazione precedente è applicata) e
comment di colonna. La regola vive in UN solo modulo puro,
`src/lib/statoArricchimento.ts` (`completo` = istituto identificato — denominazione
presentabile o codice meccanografico valido — **e** recapito PEO/PEC; altrimenti
`parziale`), usato da: scraper (`mappaRigaInterpelli` scrive la colonna su OGNI riga),
manutenzione dati (`scripts/arricchisci-interpelli.ts`, che ora **ricalcola** lo stato
e tollera QUALSIASI colonna mancante: lettura su un elenco ridotto di colonne e
`update` che toglie dal payload solo il campo sconosciuto) e interfaccia. La colonna è
in `COLONNE_OPZIONALI` dello scraper: se la migrazione non è applicata il payload la
perde e **nessun inserimento si rompe**. `parziale` **non è un motivo di scarto**: è
l'etichetta con cui la UI dichiara «anagrafica in aggiornamento».

**3 · Vetrina: mai più uno scarto per anagrafica.** `src/lib/liveBoard.ts`: nuova
catena `nomeScuolaBoard` → nome reale (gate `nomeIstituto`) → **nome grezzo pubblicato
dal bando** (`nomeGrezzoDaBando`: si accetta solo se resta un nome leggibile — mai dump
di codici `EEEE | A246`, `BA02 | AR04`, `ADEE`, date o protocolli) → **dicitura gestita
«Anagrafica in aggiornamento»**; `preparaRigheBoard` **non scarta più** nessuna riga per
il nome (restano fuori solo gli avvisi NON vivi: scaduti o fuori dalla finestra dei 60
giorni) e restituisce `anagraficaParziale` (true quando il nome è di ripiego o lo stato
è `parziale`). `FlightBoardInterpelli` propaga il marcatore e
`components/RigaBoard.tsx` mostra un chip ambra «anagrafica in aggiornamento» (nessun
chip quando la colonna mostra già la dicitura). La direttiva **§26.20 del 28/09/2026 è
quindi CORRETTA**: quel gate è la causa esatta dei 10 annunci di Padova, e
`comunicazione/04_canali_regionali/checklist_regionali.md` §4 è aggiornata di
conseguenza (la colonna «Scuola» continua a non mostrare **mai** un codice al posto del
nome).

**4 · Matching Engine nativo (RPC `match_interpelli`).** Migrazione nuova
`20261004110000_add_rpc_match_interpelli.sql`: `public.classe_chiave(text)` (forma
canonica `A-022 ≡ A22 ≡ a 22 → A-22`, `immutable`, codici a 4 lettere invariati) e
`public.match_interpelli(p_province text[], p_classi text[], p_sostegno boolean,
p_limit integer)` — `security definer` con `search_path = public`, `stable`,
`returns setof public.interpelli`. La query: province con `= any(array)` (nessun filtro
se la selezione è vuota), classi con **`&&` sull'indice GIN**
`interpelli_class_codes_idx` (varianti generate in SQL: `A-22`, `A22`, `A-022`, `A022`)
**oppure** confronto TOLLERANTE `classe_chiave(cc) = any(...)` per qualunque formato non
previsto — nessun falso negativo da rigidità di formato —, **ramo sostegno ESPLICITO**
(`p_sostegno`: codici `AD…` o titolo/materia che lo dichiarano: l'inclusione permanente
§26.45 ora è una condizione della QUERY e non più un filtro in memoria che il `limit`
poteva tagliare), `attivo = expiration_date is null or >= current_date`, ordinamento per
scadenza e `limit` sempre valido (1…5.000). Permessi `execute` ad `anon`,
`authenticated` e `service_role` (i dati restano quelli pubblici della policy
`read interpelli`). Lato client `searchInterpelli` (`src/lib/matchingEngine.ts`) prova
la **RPC per prima** (province normalizzate e deduplicate, varianti di formato delle
classi, `p_sostegno: true`, limite inoltrato) e — se la migrazione non è ancora
applicata o la RPC risponde con errore — **ricade sulla query PostgREST equivalente**
(`in(province)` + `overlaps(class_codes)` + finestra scadenze): un solo significato di
«match» e nessun rilascio che si rompe. `InterpelloDB` e `Interpello` espongono
`stato_arricchimento`/`statoArricchimento` (normalizzato), così anche feed e scheda
possono dichiarare «anagrafica in aggiornamento».

**Verifiche (04/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · `npm test` →
✅ **exit 0, catena completa verde** (comprende le due guardie nuove: `test:pipeline` e
`test:match-rpc`) · `npm run test:architettura` → ✅ **nessuna violazione nuova** (572
file · 142 violazioni = baseline: `scripts/test-live-board.ts` e
`scripts/arricchisci-interpelli.ts` riportati sotto le 250 righe con gli split/compattamenti
della sessione) · `npm run build` → ✅ 11,08 s · `npx eslint` sui 13 file toccati → ✅ zero
problemi · suite mirate `test:board`, `test:board:scala`, `test:board:metriche`,
`test:nome-istituto`, `test:anagrafica`, `test:prova-radar`, `test:migrazioni`,
`npx tsx scripts/test-scuola-da-riga.ts` → ✅ tutte verdi. **Debito pre-esistente
dichiarato (NON introdotto qui — chiuso nella §26.51)**: `npm run test:dati-fallback` segnala 2 controlli rossi
su `src/data/editableTexts.ts` (URL `https://www.scuoleradar.it/contatti` respinto da
`eSorgenteVerificata`); il file era già modificato nella sessione precedente e il comando
non è nella catena `npm test`.

**File toccati.** **Condivisi**: `src/lib/school-lookup.ts` (rimosso il generatore
sintetico) · **nuovo** `src/lib/statoArricchimento.ts` · `src/lib/liveBoard.ts`
(`nomeGrezzoDaBando`, `nomeScuolaBoard`, `anagraficaParziale`) ·
`src/lib/matchingEngine.ts` (RPC-first + `stato_arricchimento`) · `src/data/interpelli.ts`
(`statoArricchimento`) · **ingestione**: `src/scraper/index.ts` (colonna stato,
`COLONNE_OPZIONALI`, email solo da convenzione MIM) ·
`scripts/arricchisci-interpelli.ts` (ricalcolo dello stato + tolleranza GENERICA sulle
colonne mancanti) · **dipartimento Radar**:
`src/departments/radar/flightBoard/righeBoard.ts` (codice morto rimosso,
`anagrafica_parziale`), `src/departments/radar/flightBoard/components/RigaBoard.tsx`
(chip), `src/departments/radar/FlightBoardInterpelli.tsx` (propagazione del marcatore) ·
**migrazioni nuove**: `supabase/migrations/20261004100000_add_interpelli_stato_arricchimento.sql`,
`supabase/migrations/20261004110000_add_rpc_match_interpelli.sql` · **guardie**:
**nuovi** `scripts/test-pipeline-tollerante.ts` (`npm run test:pipeline`) e
`scripts/test-match-rpc.ts` (`npm run test:match-rpc`), aggiornata
`scripts/test-live-board.ts` · `package.json` (due script + catena `npm test`) ·
**documentazione**: `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`,
`comunicazione/04_canali_regionali/checklist_regionali.md`. **Non toccati**:
`src/departments/notizie/**` (dipartimento isolato) e i **dati di produzione** (nessuna
scrittura sul DB: le due migrazioni sono da applicare dal committente).

### 26.48 «Radar Live» — etichetta anagrafica della vetrina: «Scuola non specificata / Più plessi» (04/10/2026)

> **⚠️ Regola superata (05/10/2026).** Il **segnaposto** in bacheca è superato dalla **§26.59**: in
> vetrina entra SOLO una riga con un istituto reale risolto (nome reale → registro per codice →
> titolo). La dicitura «Scuola non specificata / Più plessi» resta nella **scheda del singolo
> avviso** (`src/components/IstitutoEmittente.tsx`), dove l'avviso è già dell'utente. Cespite mai
> toccato: `SCUOLA_NON_SPECIFICATA` in `src/lib/statoArricchimento.ts`.

**Nota di sessione (04/10/2026).** Nuova direttiva di prodotto sulla **vetrina pubblica** della
bacheca «Radar Live»: la colonna «Scuola» mostra, quando l'istituto non è risolvibile in chiaro,
il segnaposto **«Scuola non specificata / Più plessi»** al posto della dicitura tecnica
«Anagrafica in aggiornamento» (§26.47, **superata**). La vetrina resta pulita e professionale:
**nessun messaggio tecnico o di errore** verso i visitatori. Il lavoro di arricchimento
anagrafico **continua in background invariato** (`stato_arricchimento` `completo`/`parziale`,
`nomeScuolaRiga`/`nomeScuolaBoard`), ma serve ormai SOLO all'invio delle notifiche puntuali.

**Intervento.** In `src/lib/statoArricchimento.ts` la costante della dicitura gestita è
**rinominata** `SCUOLA_ANAGRAFICA_IN_AGGIORNAMENTO` → `SCUOLA_NON_SPECIFICATA` con valore
`'Scuola non specificata / Più plessi'` (un solo punto di verità, ri-esportata da
`src/lib/liveBoard.ts`). `nomeScuolaBoard` (`liveBoard.ts`) usa il nuovo segnaposto come ultima
risorsa della catena (nome reale → nome grezzo del bando → segnaposto). Il chip ambra di
`src/departments/radar/flightBoard/components/RigaBoard.tsx` dichiara ora il ripiego con la stessa
dicitura (testo **e** tooltip), restando nascosto quando la colonna mostra già il segnaposto.
Commenti allineati in `src/lib/matchingEngine.ts` e `src/departments/radar/FlightBoardInterpelli.tsx`.

**Verifiche (04/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0, nessun `error TS` ·
`npm run test:board` → ✅ («RADAR LIVE: nessun problema») · `npm run test:pipeline` → ✅ («PIPELINE
TOLLERANTE: tutti i controlli superati»). Le due guardie confrontano la **costante** (non un
letterale), quindi seguono automaticamente il nuovo valore.

**File toccati.** **Condivisi**: `src/lib/statoArricchimento.ts` (costante rinominata + valore),
`src/lib/liveBoard.ts` (import/re-export/uso + JSDoc), `src/lib/matchingEngine.ts` (commenti) ·
**dipartimento Radar**: `src/departments/radar/flightBoard/components/RigaBoard.tsx` (chip testo +
tooltip), `src/departments/radar/FlightBoardInterpelli.tsx` (commento) · **guardie**:
`scripts/test-live-board.ts`, `scripts/test-pipeline-tollerante.ts` (import/uso della costante
rinominata) · **documentazione**: `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`,
`comunicazione/04_canali_regionali/checklist_regionali.md`. **Non toccati**: `src/departments/notizie/**` (dipartimento isolato), `src/scraper/**`
(fuori perimetro: resta **un commento** alla riga ~973 che cita la vecchia dicitura
«anagrafica in aggiornamento» — nessun effetto sul comportamento; per allinearlo serve
uno sblocco esplicito) e i **dati di produzione** (nessuna scrittura sul DB).

### 26.49 Radar Utente/Admin allineati: provincia asciutta, scheda Admin con ordini e competenze extra (04/10/2026)

**Nota di sessione (04/10/2026).** Direttiva di prodotto su **Radar Personale** e **pannello Admin**:
pulizia delle superfici del dashboard utente, allineamento della scheda utente Admin alla vista
utente e verifica del motore di matching sulle «Opportunità mappate». Perimetro: dipartimento
**Radar** (`src/departments/radar/**`), dipartimento **Admin** (`src/departments/admin/**`, richiesto
esplicitamente dalla direttiva), condivisi essenziali (`src/lib/**`, `src/data/**`) e guardie.
Nessuna migrazione, nessun dato di produzione.

1. **Box sostegno: già rimosso** (§26.45/§26.46). Verificato che nelle Preferenze Radar non esiste più
   alcun blocco «Opportunità di sostegno», nessun interruttore e nessun `role="switch"`
   (`PannelloClassi.tsx`); l'inclusione ADAA/ADEE/ADMM/ADSS resta **nativa e permanente** nel backend
   (`avvisoDiSostegno`), presidiata da `npm run test:copy:pubblico`.
2. **Pannello «Dove vuoi cercare?» ripulito** (`radar/preferenze/PannelloProvince.tsx`): rimossi i
   testi descrittivi sotto al selettore — il box «PRO: puoi monitorare fino a 4 province» / «Piano
   Base…», la nota sulla **provincia principale**, la nota condizionale sulle province marcate PRO e la
   riga di chiusura. Rimossa anche la prop `limitiPiano` (non più usata) e il passaggio in
   `PreferenzeRadar.tsx`: il pannello resta asciutto, con «Limite province raggiunto» nel `<select>` e
   la pill «principale» come unici segnali. Il tetto continua a limitare la selezione.
3. **Scheda utente Admin allineata alla vista utente** (`admin/tabs/utenti/DettaglioUtente.tsx`,
   `admin/types.ts`): gli **ordini di scuola** si mostrano nel nome leggibile (`ordiniScuola`), le
   **materie/competenze extra** nel nome della materia (`etichetteCompetenzeProfilo`, da `materie_id`)
   e i **tag personalizzati** (`materie_custom`) restano il testo scritto dall'utente. Il tipo
   `AdminUtente` dichiara `materie_custom` (la SELECT dell'Edge `admin` è `select('*')`, quindi il dato
   era già disponibile ma non mostrato). Lo schema di salvataggio del Radar
   (`useAnagraficaProfilo.salvaProfilo` → `profiles`) scriveva già `ordini_scuola`, `materie_id` e
   `materie_custom`: nessuna modifica al DB.
4. **Ricerca classi di concorso e matching: verificati, nessuna correzione necessaria.** La barra delle
   classi filtra già per **codice** (`A19` ≡ `A-19` ≡ `A_19`) e per **nome/materia/ordine** («Italiano»,
   «CPIA», «adulti», «primaria») in Preferenze, wizard e onboarding (`classeCorrispondeAQuery` /
   `cercaClassiDiConcorso`): coperta da `npm run test:ricerca`. Il motore (`searchInterpelli`: RPC
   `match_interpelli` + fallback PostgREST, varianti `A-22 ≡ A-022 ≡ A22`, ramo sostegno esplicito) e il
   filtro della bacheca non scartano gli avvisi reali della provincia con classe, sostegno o
   competenza/parola chiave in comune: coperto da `npm run test:matching`, `test:match-rpc`,
   `test:sostegno`.

**Verifiche (04/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · `npm test` → ✅ catena
completa verde (include la nuova guardia `test:admin:utente`) · `npm run test:architettura` → ✅ nessuna
violazione nuova (573 file · 142 = baseline) · `npm run build` → ✅ · `npx eslint` sui file toccati → ✅
zero errori (resta il warning `react-hooks/exhaustive-deps` **pre-esistente** in `PreferenzeRadar.tsx`) ·
suite mirate `test:province`, `test:ricerca`, `test:radar:preferenze`, `test:copy:pubblico`,
`test:matching`, `test:match-rpc`, `test:board` → ✅ verdi.

**Osservazione fuori perimetro — CHIUSA il 04/10/2026.** `npm run test:sostegno` era **rosso** nel
working tree (7 errori, tutti nel percorso DIGEST: `inviaDigestGiornaliero` saltava i 3 profili con un
avviso di sostegno). La causa **non era nel notificatore**: i client STUB delle guardie rispondevano
alla RPC `match_interpelli` con l'esito del contatore notifiche. Risolta in **§26.50** (sessione
dedicata al modulo di notifica), che ha riportato **verdi** tutte le guardie del digest.

**File toccati.** **Radar**: `src/departments/radar/preferenze/PannelloProvince.tsx` (testi rimossi +
prop `limitiPiano` eliminata), `src/departments/radar/PreferenzeRadar.tsx` (passaggio prop rimosso) ·
**Admin** (dipartimento richiesto dalla direttiva): `src/departments/admin/tabs/utenti/DettaglioUtente.tsx`
(ordini + competenze extra/tag risolti), `src/departments/admin/types.ts` (`materie_custom`) ·
**guardie**: **nuovo** `scripts/test-admin-dettaglio-radar.ts` (`test:admin:utente`, in `npm test`) ·
`package.json` (script + catena) · **documentazione**: `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`.
**Non toccati**: `src/departments/notizie/**`, `src/departments/cfu/**`, `src/departments/modulistica/**`
e la logica di matching (verificata, non modificata).

### 26.50 Guardie del DIGEST: la RPC `match_interpelli` nei client STUB (04/10/2026)

**Nota di sessione (04/10/2026).** Chiude la **nota di attenzione** aperta in §26.49 (`npm run
test:sostegno` rosso nel working tree). Nessun file di **produzione** è stato modificato.

**DIAGNOSI (la causa NON era nel notificatore).** Dal §26.47 `searchInterpelli` interroga **prima** la
RPC nativa `match_interpelli` e considera valido **qualunque** esito senza errore
(`if (!error) return (data ?? []) as InterpelloDB[]`). I client **STUB** delle guardie di notifica
rispondevano a **TUTTE** le RPC con l'esito del contatore
(`[{ consentito: true, notifiche_usate: 1 }]`): `raccogliVociCanale` riceveva quindi righe **senza i
campi di `interpelli`** → **0 voci compatibili** per ogni profilo → digest vuoto e `saltati` = tutti i
profili (nei test: 3 su 3). Il digest in **produzione** non era coinvolto: con la migrazione applicata
la RPC restituisce le righe reali, senza migrazione l'errore fa scattare il fallback PostgREST
(comportamento presidiato da `npm run test:match-rpc`).

**INTERVENTO (solo guardie).** In **sei** client STUB la RPC è ora **distinta per nome**: a
`match_interpelli` (costante `RPC_MATCH_INTERPELLI` importata da `src/lib/matchingEngine.ts`, nessuna
stringa duplicata) si risponde con le righe di `interpelli` del DB simulato — il filtro
provincia/classe/competenze/sostegno resta alla **REGOLA UNICA in JS** — mentre le altre RPC
(`incrementa_notifiche_utente`) rispondono col loro esito. File:
`scripts/test-sostegno-preferenza.ts`, `scripts/test-promemoria.ts`, `scripts/test-dedup-utente.ts`,
`scripts/test-telegram-tier.ts`, `scripts/test-matching-profilo.ts`,
`scripts/test-matching-competenze.ts`. **Nessuna modifica** a `src/lib/notifier.ts` o a
`src/lib/matchingEngine.ts`: il codice di prodotto era corretto.

**Guardie prima rosse → ora verdi (04/10/2026, da `project/`).** `test:sostegno` (7 errori → 0) ·
`test:promemoria` (2 → 0) · `test:dedup:utente` (6 → 0) · `test:telegram:tier` (4 → 0) ·
`test:matching` (3 → 0). Suite di notifica ricontrollate verdi: `test:notifier-dry`, `test:digest`,
`test:dedup`, `test:frequenza`, `test:alert`, `test:email`, `test:email-scuola`, `test:email-alert`,
`test:link`, `test:link-esterno`, `test:ledger`, `test:qualita`, `test:copy`, `test:telegram`,
`test:telegram:template`, `test:telegram:canali`, `test:match-rpc`, `test:radar:preferenze`,
`test:automazioni`, `test:migrazioni`.

**Verifiche.** `npm run typecheck` → ✅ exit 0 · `npm test` → ✅ exit 0 (catena completa) ·
`npm run test:architettura` → ✅ nessuna violazione nuova (573 file · 142 = baseline) · `npx eslint`
sui 6 file toccati → ✅ zero problemi · `npm run build` → ✅.

**File toccati.** Solo guardie (`scripts/**`): i sei client STUB elencati · **documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.49 aggiornata + questa §26.50), `docs/DEPARTMENT_MAP.md`.
**Non toccati**: `src/**` (in particolare `src/lib/notifier.ts`, `src/lib/matchingEngine.ts`),
`comunicazione/**` e gli altri dipartimenti (notizie, cfu, modulistica, admin).

### 26.51 Guardia `test:dati-fallback`: il link al proprio sito non è una «fonte» (04/10/2026)

**Nota di sessione (04/10/2026).** Chiude il **debito pre-esistente dichiarato** in §26.47
(`npm run test:dati-fallback` con 2 controlli rossi su `src/data/editableTexts.ts`). Nessuna riga
di **produzione** modificata: il difetto era nella **guardia**, non nei dati.

**DIAGNOSI (falso positivo).** La guardia pretendeva da **ogni** URL in `src/data/**` il
superamento di `eSorgenteVerificata()` — la regola anti-mock della **pipeline di ingestione** — che
respinge per progetto gli host `scuoleradar`/`purefocus` (`RE_HOST_NON_ISTITUZIONALE` in
`src/scraper/parser.ts`: una fonte di avviso non sta mai su una piattaforma nostra/proprietaria).
I due URL segnalati sono però **copy reale delle FAQ** — `faq.carta-docente.risposta` e
`faq.regala-pro-collega.risposta` — che rimandano al modulo contatti del nostro sito
(`https://www.scuoleradar.it/contatti`): un link **al** nostro sito, non una fonte **di** avvisi, e
per costruzione **non può** essere un mock. Applicare la regola di ingestione a un self-link era un
errore di categoria.

**INTERVENTO (solo la guardia, `scripts/test-dati-fallback.ts`).** Due sole funzioni nuove:
`linkProprio` (host `scuoleradar.it` o sottodominio, `RE_HOST_PROPRIO = /(^|\.)scuoleradar\.it$/i`)
ed `eDeepLink` (pathname ≠ `/` oppure query). Nel ciclo sugli URL il filtro anti-segnaposto resta
per **tutti** gli URL; poi il ramo — **link al sito proprio** → si pretende il **deep-link** (mai
la root nuda) · **fonte esterna** → `eSorgenteVerificata()` come prima. Nessun allentamento:
`eSorgenteVerificata` e `verificaAvviso` (regole di prodotto) **non sono state toccate** e i
self-link restano soggetti al filtro anti-segnaposto. Aggiunti 5 controlli-guardia nuovi: sito
proprio riconosciuto, deep-link, root nuda rifiutata, dominio «simile» (`notscuoleradar.it`) **non**
scambiato per proprio, dominio di terzi non classificato come proprio.

**Verifiche (04/10/2026, da `project/`).** `npm run test:dati-fallback` → ✅ **exit 0, tutti i
controlli verdi (15/15)** — prima 2 rossi · `npx eslint scripts/test-dati-fallback.ts` → ✅ zero
problemi. Il comando **non è nella catena `npm test`** (§26.47): non è stato aggiunto qui per non
cambiare l'insieme dei test di prodotto senza richiesta.

**File toccati.** Guardia: `scripts/test-dati-fallback.ts` · **documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.47 aggiornata + questa §26.51), `docs/DEPARTMENT_MAP.md`.
**Non toccati**: `src/**` (in particolare `src/data/editableTexts.ts` — il copy è corretto e resta
intatto), `comunicazione/**` e gli altri dipartimenti.

### 26.52 Preferenze Radar: si scrivono solo per azione esplicita (05/10/2026)

**Nota di sessione (05/10/2026).** Chiude il difetto per cui classi di concorso, province,
competenze, tag e scuole preferite potevano **sparire** senza che l'utente toccasse nulla: bastava
aprire il Radar dopo un caricamento lento del profilo (o fare un refresh) perché il pannello
riscrivesse valori vuoti sopra la selezione salvata.

**Causa.** La scrittura era **dedotta per differenza** fra due fotografie dello stesso stato, invece
di dipendere dall'**azione** dell'utente: un profilo che arriva in ritardo, un refresh o un default
`[]` finivano nello stesso calcolo di una modifica reale, e il campo non toccato veniva sovrascritto
con il default della pagina appena aperta (i campi mai toccati non erano distinguibili da quelli
riportati a vuoto apposta).

**Intervento (regola unica, in un solo posto).**
`src/lib/preferenzeGuardia.ts` espone la guardia condivisa:

- `modificheDaSalvare<P extends object>(toccati, locale, salvate) → Partial<P>`: restituisce **solo**
  i campi marcati come toccati **e** diversi dal valore già salvato (`{}` quando non c'è nulla da
  salvare);
- `idrataDaProfilo` / `haContenuto`: lato **lettura**, il DB vince solo se ha un valore vero
  (`[]`/`null`/`''` non azzerano la scelta locale).

`src/departments/radar/PreferenzeRadar.tsx`: **ogni** handler dell'utente marca il proprio campo
(`toggleOrdine`, `toggleClasse`, `toggleMateria`, `aggiungiCompetenzaSuggerita`, `aggiungiParolaChiave`,
`removeCustomMateria`, `toggleProvincia`, `promuoviPrincipale`, scuole preferite/ignorate, più i nuovi
`cambiaTelegramUsername`/`cambiaTelegramChatId`/`cambiaEmailNotifica` per le tendine di Telegram ed
email, che ora passano da un handler che marca il campo). L'autosave usa
`modificheDaSalvare<Preferenze>(toccatiRef.current, locale, preferenze)`, **non parte** quando è vuoto
e sparge le modifiche nel contesto reale; l'idratazione è **per campo** e salta quelli già toccati;
rimosso il troncamento automatico di classi/province in schermata (regola §26.5: i tetti limitano
l'**uso**, non i dati). `src/contexts/app/useProfileBootstrap.ts` legge tutte le colonne delle
preferenze con `idrataDaProfilo` (nessun `length > 0` scritto a mano) e il commento della prop `tetti`
di `usePreferenzeUtente` è allineato al comportamento reale (solo avviso, nessuna riscrittura).

**Guardie.** Nuova `npm run test:persistenza:preferenze` (`scripts/test-persistenza-preferenze.ts`):
esegue le funzioni **reali** della guardia sui casi che facevano sparire i dati — primo avvio/refresh
senza campi toccati ⇒ nessuna scrittura · azione esplicita ⇒ nel payload solo quel campo · campo
toccato ma identico ⇒ nessun ciclo di autosave · svuotamento **voluto** ⇒ si salva il vuoto · profilo
vuoto/`null` ⇒ il valore locale resta — e verifica il cablaggio su `PreferenzeRadar.tsx` e
`useProfileBootstrap.ts` (marcatura di ogni campo, idratazione selettiva, nessun troncamento, nessuna
API di salvataggio dedotta a posteriori). Estese `test:radar:preferenze`, `test:province` e `test:piano`
con gli stessi presidi; il comando nuovo entra nella catena `npm test`.

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 ·
`npm run test:persistenza:preferenze`, `npm run test:radar:preferenze`, `npm run test:province`,
`npm run test:piano` → ✅ tutte verdi · **`npm test` (catena completa, con la guardia nuova dentro) →
✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (575 file · 142 = baseline) ·
`npx eslint` sui file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0.

**File toccati.** Dipartimento **Radar**: `src/departments/radar/PreferenzeRadar.tsx` · **condivisi
essenziali**: `src/lib/preferenzeGuardia.ts`, `src/contexts/app/usePreferenzeUtente.ts` (solo
commento) · **guardie/script**: `scripts/test-persistenza-preferenze.ts` (nuova),
`scripts/test-radar-preferenze.ts`, `scripts/test-provincia-principale.ts`, `scripts/test-piano-sync.ts`,
`package.json` (comando dedicato + ingresso in `npm test`) · **documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.5 estesa + questa §26.52), `docs/DEPARTMENT_MAP.md`.
**Non toccati**: `comunicazione/**` (nessuna regola di prodotto nuova: la §26.5 era già la specifica,
qui è resa effettiva) e gli altri dipartimenti (notizie, cfu, modulistica, admin).



### 26.53 Opportunità: scuola + fonte sempre visibili; gli avvisi senza scadenza escono dopo 60 giorni

**Perché.** Due requisiti di prodotto sulla scheda dell'opportunità (card della dashboard **e**
modale di dettaglio): **(1)** la **scuola emittente** e un **link diretto alla fonte ufficiale**
devono essere visibili e cliccabili in **entrambe** le viste (prima il link esisteva solo dentro
l'aperto del dettaglio); **(2)** un avviso che la fonte pubblica **senza scadenza esplicita** non
può restare pubblico per sempre: dopo **60 giorni** (2 mesi) dalla pubblicazione esce dalle liste
pubbliche.

**Cosa è cambiato.**

- **Regola unica della finestra** (`src/lib/scadenza.ts`, modulo puro): `GIORNI_FINESTRA_SENZA_SCADENZA = 60`,
  `dataIsoLocale`, `dataLimiteFinestraSenzaScadenza` e **`eAvvisoVivo(scadenza, pubblicazione, oggi)`** —
  con scadenza → non ancora passata; senza scadenza → pubblicato entro la finestra (confronto per
  **giorno** di calendario, come il filtro PostgREST); senza scadenza **né** pubblicazione → NON vivo.
  `src/lib/liveBoard.ts` e `radar/flightBoard/filtroAttivi.ts` ora **delegano** a questo modulo invece
  di tenere copie locali (la soglia e la data locale restano ri-esportate, così i test esistenti non
  cambiano). `preparaRigheBoard` usa `eAvvisoVivo`: identico comportamento, una sola regola.
- **Tutte le superfici pubbliche allineate**: `useInterpelliFeed` (feed della dashboard) filtra con
  `eAvvisoVivo` grazie al nuovo campo `dataPubblicazione` di `Interpello` (dal `created_at`);
  `searchInterpelli` (fallback PostgREST) usa
  `expiration_date.gte.<oggi>,and(expiration_date.is.null,created_at.gte.<limite>)`;
  la **RPC nativa** applica la finestra nel database (migrazione nuova
  `20261005120000_match_interpelli_finestra_senza_scadenza.sql`); la **pulizia automatica**
  (`scripts/pulisci-scaduti.ts`) rimuove ora anche le righe senza scadenza fuori finestra, oltre alle
  scadute.
- **Card e modale** (`src/components/InterpelloCard.tsx`, spezzata per restare sotto le 300 righe del
  gate: il dettaglio vive in `src/components/InterpelloDettaglioModal.tsx`): la card espone il
  **link diretto alla fonte** accanto a «Vedi dettaglio» (etichetta onesta `etichettaFonteLink`, nuova
  scheda con `rel="noopener noreferrer"`), e la **scuola emittente** è resa dallo stesso componente
  `src/components/IstitutoEmittente.tsx` in card, modale e scheda pubblica `/interpello/:id`
  (`SchedaAvviso.tsx`) — mai una riga vuota: se il bando non pubblica un nome presentabile si mostra la
  dicitura gestita `SCUOLA_NON_SPECIFICATA` con la nota «anagrafica in aggiornamento».

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · guardie dedicate
(`test:interpello-scadenza` estesa con `eAvvisoVivo`, **`test:opportunita` nuova**, `test:board`,
`test:board:filtro`, `test:board:scala`) → ✅ tutte verdi · **`npm test` (catena completa, con le due
guardie dentro) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (578 file ·
**141** = baseline, dopo la rimozione dell'eccezione ormai inutile
`W-DIM:src/components/InterpelloCard.tsx`) · `npx eslint` sui file toccati → ✅ zero problemi ·
`npm run build` → ✅ exit 0.

**File toccati.** **Dipartimento Radar**: `src/departments/radar/flightBoard/filtroAttivi.ts` ·
**condivisi essenziali**: `src/lib/scadenza.ts`, `src/lib/liveBoard.ts`, `src/lib/matchingEngine.ts`,
`src/data/interpelli.ts`, `src/contexts/app/helpers.ts`, `src/contexts/app/useInterpelliFeed.ts` ·
**viste condivise (fuori dal dipartimento, richiesta esplicita dell'utente)**: `src/components/InterpelloCard.tsx`,
`src/components/InterpelloDettaglioModal.tsx` (nuovo), `src/components/IstitutoEmittente.tsx` (nuovo),
`src/pages/interpello/components/SchedaAvviso.tsx` · **dati e pipeline**:
`supabase/migrations/20261005120000_match_interpelli_finestra_senza_scadenza.sql` (nuova),
`scripts/pulisci-scaduti.ts` · **guardie**: `scripts/test-opportunita-vive.ts` (nuova),
`scripts/test-scadenza.ts` (estesa), `package.json` (comando `test:opportunita` + ingresso in `npm test`),
`scripts/architettura-baseline.json` (eccezione `W-DIM` rimossa) · **documentazione**:
`docs/SYSTEM_HANDOVER.md` (questa §26.53), `docs/DEPARTMENT_MAP.md`,
`comunicazione/04_canali_regionali/checklist_regionali.md` (§4 e §5). **Nessun altro dipartimento
toccato** (notizie, cfu, modulistica, admin).


### 26.54 Punteggio di compatibilità: soglie 60/70/80, sostegno EXTRA e preferenze Admin complete (05/10/2026)

**Perché.** Tre richieste di prodotto: **(1)** la compatibilità dell'opportunità deve avere soglie
cromatiche chiare (🔴 ≥ 60 · 🟠 ≥ 70 · 🟢 ≥ 80); **(2)** le opportunità di **sostegno** che arrivano a
chi non ha scelto il sostegno valgono **~60** e restano consigli **secondari** in bacheca, mai priorità;
**(3)** le viste utente del **pannello Admin** devono mostrare tutti i parametri del profilo — ordini di
scuola, classi, materie, tag personalizzati — senza buchi rispetto alla dashboard dell'utente.

**Cosa è cambiato.**

- **Soglie e banda, una sola fonte** (`src/lib/compatibilita.ts`, modulo puro nuovo):
  `SOGLIA_COMPATIBILITA_ROSSO = 60`, `…_ARANCIO = 70`, `…_VERDE = 80`, `livelloCompatibilita`,
  `etichettaCompatibilita` («80% Compatibile», «60% · extra») e `bandaCompatibilita(punteggio)` con
  livello, etichetta, descrizione (tooltip) e classi Tailwind (verde `accent` · arancio `warning` ·
  rosso `error`). Sotto 60 il badge **non** compare: qualche colore in meno, mai uno in più.
- **Punteggio nel motore** (`src/lib/matchingEngine.ts`): `punteggioCompatibilita(profilo, avviso)` —
  **100** provincia + classe in comune · **80** avviso senza codice classe ma materia coperta dalle
  proprie classi · **70** profilo configurato solo su competenze/parole chiave · **60** area SOSTEGNO
  senza una classe AD… propria · **0** non compatibile. Prima passa sempre `avvisoCompatibileConProfilo`
  (ok/motivo): il punteggio **gradua**, non decide una seconda volta. Nuovo `profiloAderisceSostegno`:
  la scelta volontaria dell'utente è una **classe AD… tra le proprie** — `profiles.sostegno` resta una
  colonna di compatibilità (default `true`) e non è più un segnale di scelta (§26.45).
- **Bacheca e superfici utente**: `useInterpelliFeed` calcola il punteggio per ogni opportunità (una sola
  regola, nessuna copia dei criteri) e `DashboardPage` ordina **prima per compatibilità, poi per
  scadenza** — i match forti in testa, il sostegno extra in coda; card (`InterpelloCard`) e modale
  (`InterpelloDettaglioModal`) colorano con la banda condivisa (via il vecchio badge cablato al 100%).
  **Nessun cambio di consegna**: notifiche, digest e dispatch restano quelli di prima (§26.45: il
  sostegno continua ad arrivare a tutti; cambia solo *come* si presenta).
- **Pannello Admin**: blocco condiviso nuovo `src/departments/admin/components/PreferenzeUtente.tsx`
  su derivazione pura `derivaPreferenzeUtente.ts` (`preferenzeUtenteAdmin`), montato in **due** punti —
  la scheda di dettaglio del tab «Utenti» e la **card utente del tab «Radar»**, che prima mostrava solo
  classi/materie/province (nessun ordine di scuola, nessun tag, e le materie come id opachi). Ordini nel
  nome leggibile (`ordiniScuola`), competenze di catalogo nel nome della materia
  (`etichetteCompetenzeProfilo`), tag nel testo scritto dall'utente.

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (582 file · **141** =
baseline) · `npx eslint` sui 13 file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0.
Guardia nuova `npm run test:compatibilita` (soglie, punteggi, sostegno extra, cablaggio
card/modale/feed/ordine bacheca, blocco Admin); `test:opportunita` e `test:admin:utente` estese;
allineata anche l'aspettativa ormai superata di `test:match-rpc` sul ramo «senza scadenza» (la finestra
dei 60 giorni di §26.53 non era ancora riflessa in quella guardia: era un rosso già presente prima di
questa sessione).

**File toccati.** **Condivisi essenziali**: `src/lib/compatibilita.ts` (nuovo),
`src/lib/matchingEngine.ts`, `src/contexts/app/useInterpelliFeed.ts` · **viste condivise (fuori dal
dipartimento, richiesta esplicita dell'utente)**: `src/pages/DashboardPage.tsx`,
`src/components/InterpelloCard.tsx`, `src/components/InterpelloDettaglioModal.tsx` · **dipartimento
Admin (richiesta esplicita dell'utente)**: `src/departments/admin/components/PreferenzeUtente.tsx`
(nuovo), `src/departments/admin/components/derivaPreferenzeUtente.ts` (nuovo),
`src/departments/admin/tabs/utenti/DettaglioUtente.tsx`, `src/departments/admin/tabs/TabRadar.tsx` ·
**guardie**: `scripts/test-compatibilita-punteggio.ts` (nuova), `scripts/test-opportunita-vive.ts`,
`scripts/test-admin-dettaglio-radar.ts`, `scripts/test-match-rpc.ts`, `package.json` (comando
`test:compatibilita` + ingresso in `npm test`) · **documentazione**: `docs/SYSTEM_HANDOVER.md` (questa
§26.54), `docs/DEPARTMENT_MAP.md`. **Non toccati**: `comunicazione/**` (il badge di compatibilità è una
superficie della dashboard, non un canale: le checklist restano valide), `src/departments/notizie/**`,
`src/departments/cfu/**`, `src/modules/**` e la pipeline di consegna (`src/lib/notifier.ts`).

### 26.55 Compatibilità graduata: affinità disciplinare, prossimità geografica e cap dei riempitivi (05/10/2026)

**Perché.** Tre richieste di prodotto sull'**intelligenza semantica della bacheca**: **(1)** le materie
vicine non vanno escluse a priori — «Inglese» cercato con «Tedesco» offerto è una competenza
metodologica reale con uno scostamento da DICHIARARE; **(2)** la provincia limitrofa/secondaria non è un
blocco rigido ma una distanza da ponderare (fuoriluogo resta fuori); **(3)** gli avvisi di basso valore
vanno limitati: massimo 5 sotto il 70%, e nessuno se la bacheca ha già 10 opportunità di qualità.

**Cosa è cambiato.**

- **Penalità calibrate, una sola fonte** (`src/lib/compatibilita.ts`): `PENALITA_LINGUA_AFFINE = 25`,
  `PENALITA_AREA_AFFINE = 10`, `PENALITA_AREA_CONTAMINATA = 15`, `PENALITA_PROVINCIA_LIMITROFA = 10`,
  tetto `PENALITA_MASSIMA = 35`, `applicaPenalita(punteggio, punti)` e
  `bandaCompatibilita(punteggio, motivo?)`: il MOTIVO dello scostamento entra nella descrizione del
  badge (tooltip di card e modale) — un match parziale si dichiara, non si lascia intuire.
- **Matrice di affinità disciplinare** (`src/lib/affinitaDisciplinare.ts`, nuovo, puro): lingue affini
  («Inglese» vs «Tedesco» → −25%, **solo su scelta ESPLICITA** dell'utente: una classe multi-lingua
  A-22/A-24/A-25 non è una scelta) e ponti tematici CURATI (Digitale ↔ Intelligenza artificiale −10%,
  Letteratura ↔ Teatro −15%, Arte ↔ Digitale, Scientifico ↔ Digitale). Una sola penalità disciplinare
  per avviso (mai cumuli); le sigle valgono solo in maiuscolo (`IA`/`AI`, mai la preposizione «ai»).
- **Prossimità geografica** (`src/lib/prossimitaGeografica.ts`, nuovo, puro): `normalizzaProvincia`
  (spostata qui dal motore, che la **riesporta**), `regioneProvincia`, `sonoProvinceLimitrofe` (stessa
  REGIONE), `provinciaCompatibile`, `penalitaGeografica`, `provinceDiRicerca`. Tre livelli: provincia
  selezionata → nessuna penalità; limitrofa → −10% e resta visibile; **fuoriluogo → esclusa** (Milano
  per chi cerca Asti non passa, nemmeno con l'opzione attiva).
- **Cap dinamico dei riempitivi** (`src/lib/riempitivi.ts`, nuovo, puro): `limitaRiempitivi` con
  `MAX_RIEMPITIVI_BACHECA = 5` e `MINIMO_MATCH_QUALITA = 10`. Il 70% esatto è qualità, un punteggio
  assente resta neutro (mai classificato a caso), l'ordine della bacheca non cambia.
- **Un solo punto di valutazione** (`src/lib/compatibilitaGraduata.ts`, nuovo, puro):
  `valutaCompatibilita(profilo, avviso, opts)` = punteggio del motore + penalità + motivi leggibili.
  Invarianti: il pavimento del **sostegno EXTRA** resta 60 (l'inclusione permanente di §26.45 non si
  sconta) e il punteggio base del motore (`punteggioCompatibilita`) non cambia di una virgola.
- **Bacheca** (`src/contexts/app/useInterpelliFeed.ts`): cerca anche le province limitrofe
  (`provinceDiRicerca`), filtra con `provinciaCompatibile(..., { limitrofe: true })`, valuta con
  `valutaCompatibilita(..., { provinceLimitrofe: true })` e chiude con `limitaRiempitivi`. Card
  (`InterpelloCard`) e modale (`InterpelloDettaglioModal`) passano il motivo alla banda, che viaggia
  sull'`Interpello` (`motivoCompatibilita`, `src/data/interpelli.ts`) — `DashboardPage` non cambia:
  ordina ancora per compatibilità e poi per scadenza.
- **CONSEGNA INVARIATA (nessuna regressione):** `avvisoCompatibileConProfilo` accetta la nuova opzione
  `OpzioniCompatibilita.provinceLimitrofe` con default **`false`**; notifier, digest e `scripts/invia-*`
  non la passano (guardia dedicata) — email/Telegram continuano a consegnare SOLO le province scelte,
  quindi `comunicazione/**` resta valido così com'è (perimetro dei canali e del digest Base invariato).

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (588 file · **141** =
baseline) · `npx eslint` sui file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0.
Guardie nuove `npm run test:compatibilita:graduata` (penalità, affinità, prossimità, integrazione di
`valutaCompatibilita`) e `npm run test:riempitivi` (cap + cablaggio + consegna invariata);
`test:compatibilita` e `test:opportunita` allineati al nuovo punto di valutazione del feed. Le guardie
hanno trovato e fatto correggere un bug reale (nome dell'opzione geo non propagato) prima del commit.

**File toccati.** **Condivisi essenziali**: `src/lib/compatibilita.ts`,
`src/lib/affinitaDisciplinare.ts` (nuovo), `src/lib/prossimitaGeografica.ts` (nuovo),
`src/lib/riempitivi.ts` (nuovo), `src/lib/compatibilitaGraduata.ts` (nuovo),
`src/lib/matchingEngine.ts`, `src/data/interpelli.ts`, `src/contexts/app/useInterpelliFeed.ts` ·
**viste condivise (fuori dal dipartimento, richiesta esplicita dell'utente)**:
`src/components/InterpelloCard.tsx`, `src/components/InterpelloDettaglioModal.tsx` · **guardie**:
`scripts/test-compatibilita-graduata.ts` (nuova), `scripts/test-riempitivi-bacheca.ts` (nuova),
`scripts/test-compatibilita-punteggio.ts`, `scripts/test-opportunita-vive.ts`, `package.json`
(`test:compatibilita:graduata`, `test:riempitivi` + ingresso in `npm test`) · **documentazione**:
`docs/SYSTEM_HANDOVER.md` (questa §26.55). **Non toccati**: `comunicazione/**`, `src/departments/**`,
`src/modules/**` e la pipeline di consegna (`src/lib/notifier.ts`, `src/lib/digest.ts`).

### 26.56 Le 5 MODALI del Radar: media del punteggio, raggio dei 60 km e scuole preferite (05/10/2026)

**Nota (06/10/2026).** Il modello a «5 modali» di questa sezione è stato **riordinato in DUE LIVELLI** dalla **§26.63**: le modali **PRIMARIE** (ordine · classi di concorso · provincia) fanno il voto con la media ponderata, le **competenze** (Modale 3) sono un **LIVELLO SECONDARIO** che sfuma al massimo 25 punti un voto che le preferenze hanno già deciso — **non lo assegnano** e **non aprono la bacheca**; l'**override della Modalità 3 (§26.58) è stato ritirato**. La tabella dei numeri delle singole modali resta valida (riga 3 a parte, da leggere secondo la §26.63), così come soglie, raggio dei 60 km, cap dei riempitivi e filtri scuole.

**Perché.** Richiesta di prodotto: il punteggio di bacheca non è più una serie di sconti cumulati
(§26.54/§26.55) ma la **media delle 5 MODALI** delle preferenze dell'utente, con i numeri decisi dal
prodotto e i **filtri avanzati scuole** (whitelist/blacklist) come giudizio che vince sul punteggio.

**Le 5 modali (numeri di prodotto).**

| Modale (finestra preferenze) | Punteggi | Note |
|---|---|---|
| 1 · «Dove vuoi lavorare» (ordine) | 100 selezionato · **90 subito prima/dopo** (infanzia↔primaria↔secondaria I↔secondaria II) · **70 salto** (es. primaria per chi cerca la secondaria) | tipologie fuori sequenza (CPIA, serali, PON, ATA): 100 solo se selezionate, altrimenti 70 |
| 2 · «Classi di concorso» | 100 esatta (A-022 ≡ A-22) · **95 affine** (una materia del catalogo in comune: A-22 ↔ A-24) · 90 competenza dichiarata dentro la classe dell'avviso / materia coperta · **85 stessa area** · 75 ponte affine · 65 area contaminata · **55 estranea** | «penalità crescente in base alla distanza disciplinare»: quattro gradini misurati dalla matrice di `areeDisciplinari.ts` |
| 3 · «In cosa puoi lavorare oltre la classe» | **livello SECONDARIO (§26.63)**: competenza piena **25** · vicina **20** · riconducibile **10**, +3 per ogni corrispondenza aggiuntiva, **tetto 25** | la competenza NON assegna più il voto (l'**override §26.58 è ritirato**): SFUMA di max 25 punti il voto delle preferenze primarie e **non apre la bacheca** (la pertinenza è delle classi, §26.60). La provincia resta l'unica condizione geografica: oltre il raggio si è esclusi |
| 4 · «Provincia» | 100 provincia selezionata · **grossa penalità entro il raggio di 60 km**: −25 (≤ 20 km) / −40 (≤ 40 km) / −55 (≤ 60 km) → **75 / 60 / 45** · **oltre i 60 km: esclusione d'ufficio** | distanza in linea d'aria fra **capoluoghi** (Haversine) e ricerca allargata alle province entro il raggio |
| 5 · «Filtri Avanzati Scuole» | **blacklist → avviso oscurato e scartato** a prescindere dal punteggio · **whitelist → inclusione d'ufficio** a prescindere dal punteggio | la blacklist VINCE sulla whitelist; se il punteggio è insufficiente la card mostra l'etichetta dedicata **«Scuola preferita nel radar»** al posto del voto basso, se è buono lo mette accanto al match |

**Come si compone il punteggio (dalla §26.63, in DUE LIVELLI).** `valutaCompatibilita` (bacheca)
calcola i punteggi delle modali **PRIMARIE applicabili** — una modale senza dati dell'utente (nessun
ordine, nessuna classe, nessuna provincia) NON entra nella media: non azzera l'opportunità per un dato
che l'utente non ha dichiarato — con la media **PONDERATA** della **§26.57** (`PESI_MODALI`,
`src/lib/mediaModali.ts`), poi **somma la SFUMATURA del livello secondario** (le competenze: max 25
punti) e chiude col **tetto**: `min(100, media + sfumatura)`, oppure `PUNTEGGIO_MATCH_SECONDARIO` (25)
quando il profilo non ha classi di concorso. La Modale 3 **non assegna più il voto** (l'override della
§26.58 è ritirato) e non produce più incrementi in percentuale sul voto mediato.
Il numero resta dentro le bande di §26.54 (🟢 ≥ 80 · 🟠 ≥ 70 · 🔴 ≥ 60) e nello stesso ordine di
bacheca (`DashboardPage`: compatibilità → scadenza).

**Cosa è cambiato (moduli).** Nuovi moduli PURI, uno per modale: `punteggioOrdine.ts` (Modalità 1),
`punteggioClasse.ts` (2), `punteggioCompetenze.ts` (3), `prossimitaGeografica.ts` riscritto intorno
alla distanza (4), `filtriScuole.ts` (5), `areeDisciplinari.ts` (matrice di aree e ponti, che
**sostituisce** `affinitaDisciplinare.ts`), `bachecaInterpelli.ts` (la pipeline della bacheca, prima
dentro l'hook) e i **dati** `src/data/provinceCoordinate.ts` (coordinate dei capoluoghi, 106 province).
`compatibilitaGraduata.ts` diventa l'aggregatore (media + jolly + invarianti); `compatibilita.ts`
**perde le penalità cumulate** (`applicaPenalita`, `PENALITA_*`) e conserva soglie, banda cromatica,
`descrizioneScuolaPreferita` e `ETICHETTA_SCUOLA_PREFERITA`; `riempitivi.ts` guadagna `proteggi` (le
scuole preferite non sono riempitivi); `Interpello` guadagna **`scuolaPreferita`** e card e modale
mostrano l'etichetta dedicata.

**Invarianti (nessuna regressione).** Il **sostegno fuori dalle proprie classi resta 60** (§26.45: non
si sconta); la **CONSEGNA è intatta** — `provinceLimitrofe` è un'opzione della sola bacheca e notifier,
digest e `scripts/invia-*` non la passano (guardia), quindi email/Telegram continuano a consegnare SOLO
le province scelte e `comunicazione/**` resta valido così com'è; la pertinenza resta un gate (senza
aggancio del motore o di una vicinanza ≥ 85 il ponte tematico NON crea l'opportunità: niente card a
caso); `DashboardPage` non cambia (ordina ancora compatibilità → scadenza) e il cap dei riempitivi resta
5 sotto il 70% con la nuova protezione delle preferite (**§26.60**: il cap vale per i riempitivi
PERTINENTI — quelli non pertinenti non entrano più affatto, vedi la §26.60).

**Scostamenti dichiarati (cambi di comportamento voluti dalla richiesta).** (1) L'**ordine di scuola non
è più un filtro rigido**: un avviso adiacente o distante entra con 90/70 (il cap dei riempitivi evita il
rumore); (2) la provincia non è più «stessa regione»: si misura la **distanza fra capoluoghi** e oltre i
60 km l'avviso è escluso; (3) una **classe affine (95) o della stessa area (85)** può far entrare un
avviso che il motore strict non agganciava (prima 0); (4) i valori assoluti cambiano (es. «materia
coperta» 80 → 90; «profilo solo competenze» 70 → media delle modali applicabili).

**Limiti dichiarati (onestà, non silenzi).** Le coordinate sono quelle dei **capoluoghi**, arrotondate a
2 decimali (fonte: coordinate pubbliche delle voci Wikipedia dei comuni capoluogo): la soglia dei 60 km
è una distanza fra capoluoghi, non la geometria del confine amministrativo — per un dataset ISTAT/IGM si
sostituisce un solo file (`provinceCoordinate.ts`). La **whitelist** può pescare solo gli avvisi delle
province che il feed interroga (proprie + entro il raggio): per seguire una scuola di un'altra regione
l'utente aggiunge la sua provincia. La sfumatura del **3% è deterministica** (dipende dalle
corrispondenze trovate, non dal caso): un punteggio casuale non sarebbe né spiegabile all'utente né
verificabile da una guardia.

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (597 file · **141** =
baseline) · `npx eslint` sui 23 file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0 ·
`test:radar:preferenze`, `test:match-rpc`, `test:digest`, `test:qualita`, `test:admin:utente`,
`test-provincia-principale`, `test-sostegno-preferenza` → ✅ exit 0. Guardie: **nuove**
`npm run test:modali` (Modali 1-2-3 + media e jolly), `test:prossimita` (distanze reali, raggio, fasce,
esclusione, strict della consegna), `test:filtri-scuole` (blacklist/whitelist + etichetta dedicata +
cablaggio grafico); **riscritta** `test:compatibilita:graduata` (invarianti, media, cablaggio feed →
bacheca → card); **estese** `test:riempitivi` (`proteggi`), `test:opportunita` e `test:compatibilita`
(cablaggio spostato nella bacheca pura).

**File toccati.** **Condivisi essenziali**: `src/lib/punteggioOrdine.ts`, `src/lib/punteggioClasse.ts`,
`src/lib/punteggioCompetenze.ts`, `src/lib/areeDisciplinari.ts`, `src/lib/filtriScuole.ts`,
`src/lib/bachecaInterpelli.ts` (nuovi), `src/lib/prossimitaGeografica.ts` (riscritto),
`src/lib/compatibilitaGraduata.ts` (riscritto), `src/lib/compatibilita.ts`, `src/lib/riempitivi.ts`,
`src/lib/matchingEngine.ts` (solo commenti), `src/data/interpelli.ts`, `src/data/provinceCoordinate.ts`
(nuovo), `src/contexts/app/useInterpelliFeed.ts` (**da 247 a 143 righe**: la pipeline è nel modulo
puro) · **viste condivise (fuori dal dipartimento, richiesta esplicita dell'utente)**:
`src/components/InterpelloCard.tsx`, `src/components/InterpelloDettaglioModal.tsx` · **guardie**:
`scripts/test-modali-radar.ts`, `scripts/test-prossimita-60km.ts`, `scripts/test-filtri-scuole.ts`
(nuove), `scripts/test-compatibilita-graduata.ts` (riscritta), `scripts/test-riempitivi-bacheca.ts`,
`scripts/test-opportunita-vive.ts`, `scripts/test-compatibilita-punteggio.ts`, `package.json`
(`test:modali`, `test:prossimita`, `test:filtri-scuole` + ingresso in `npm test`) ·
**documentazione**: `docs/SYSTEM_HANDOVER.md` (questa §26.56 + mappa moduli),
`docs/DEPARTMENT_MAP.md`. **File rimosso**: `src/lib/affinitaDisciplinare.ts` (assorbito in
`areeDisciplinari.ts`; nessun altro file lo importava). **Non toccati**: `comunicazione/**` (la consegna
non cambia), `src/departments/**`, `src/modules/**` e la pipeline di consegna (`src/lib/notifier.ts`,
`src/lib/digest.ts`).

### 26.57 La MEDIA PONDERATA delle modali: i pesi del voto finale (05/10/2026) — aggiornata dalla §26.63

> **Nota (06/10/2026).** Dalla **§26.63** i pesi valgono per le **modali PRIMARIE** (ordine · classi di concorso · provincia): le **competenze** NON sono più una modale pesata né un jolly in percentuale — sono il **LIVELLO SECONDARIO** che sfuma il voto di max 25 punti. Tabella e formula qui sotto vanno lette con questa avvertenza (la riga della «Modale 3» è già marcata SUPERATA).

**Perché.** Richiesta di prodotto sulla §26.56: il voto finale della bacheca non è la media
aritmetica delle modali, ma una **media PONDERATA** in cui ogni modale porta il suo **contributo**;
le modali senza dati dell'utente restano fuori dal calcolo e i pesi si **rinormalizzano** su ciò che
c'è davvero (una modale non configurata non abbassa il voto, ma non lo alza nemmeno).

**I pesi, decisione di prodotto in una riga di codice.** `PESI_MODALI`
(`src/lib/compatibilitaGraduata.ts`):

| Modale | Peso | Perché quel peso |
|---|---|---|
| 2 · Classi di concorso | **2** | è il requisito **ABILITANTE**: senza una classe compatibile quella materia non si insegna, quindi il suo scostamento deve incidere il doppio — è la stessa gerarchia del motore §26.54 (100 classe in comune · 80 materia coperta · 70 competenze · 60 sostegno extra) |
| 1 · Ordine di scuola | 1 | preferenza di **contesto**: dice dove, non se sei abilitato |
| 3 · Parole chiave | ~~1~~ | **SUPERATA (§26.63)**: le competenze sono il **LIVELLO SECONDARIO** — sfumatura di max 25 punti, **fuori** dalla media e dai pesi (la riga col peso 1 della §26.57 non esiste più) |
| 4 · Provincia | 1 | **perimetro** geografico, non abilitazione: da sola non «promuove» un avviso della classe sbagliata |

**La formula (aggiornata dalla §26.63).** `punteggio = min(tetto, mediaPonderata(modali primarie) +
sfumatura competenze)`, con `tetto = 100` — oppure `PUNTEGGIO_MATCH_SECONDARIO` (25) quando il profilo
non ha classi di concorso — e le **competenze fuori dal denominatore**; se nessuna modale è applicabile
il voto resta `PUNTEGGIO_MATCH_NESSUNO` (0). La
primitiva pura è **`mediaPonderata(contributi)`** (con `ContributoModale = { punteggio, peso }`):
sostituisce la media aritmetica `mediaModali`, che **non esiste più**. Il dettaglio per modale
(`valutazione.modali`) dichiara anche **`pesoTotale`**, il denominatore usato: è ciò che rende il
numero spiegabile a una guardia (e al tooltip).

**Invariante strutturale.** Nessun peso SUPERA la metà dei pesi totali applicabili (2 su 4 = 1+2+1: la
`classe` pesa 2, al più metà): il voto **non può derivare da una sola modale**. La verifica sta in
`npm run test:modali` (`Math.max(pesi) * 2 <= Σpesi`) — §26.63.

**Effetti sui numeri (dichiarati, non silenziosi).** Dove la classe è debole il voto scende, dove
la classe è giusta e la geografia è vicina sale:

| Caso (ordine · classe · provincia) | §26.56 (media semplice) | §26.57 (media ponderata) |
|---|---|---|
| 100 · 100 (esatta) · 60 (provincia vicina) | 87 | **90** |
| 100 · 55 (estranea) · 100 (propria) | 85 | **78** |
| 100 · 95 (affine) · 90 (parola chiave) · 100 | 96 | **96** (invariato) |
| 100 · 95 (affine) · 90 · 100 **+ jolly 3%** | 99 | **99** (invariato) |

**Tutto il resto della §26.56 resta intatto.** Sostegno extra a **60** (§26.45), esclusione oltre i
60 km salvo whitelist, blacklist che vince sulla whitelist, jolly del 3% **deterministico**,
consegna STRICT (`provinceLimitrofe` è un'opzione della sola bacheca: `notifier`, `digest` e
`invia-*` non la passano). Il tooltip di card e modale aggiunge una riga di composizione —
«media ponderata di N modali» (+ «jolly 3%» quando scatta) — così il numero non arriva mai da solo.

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (597 file ·
**141** = baseline; `compatibilitaGraduata.ts` = **237 righe**, sotto la soglia di attenzione di
250) · `npx eslint` sui file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0 ·
`test:modali`, `test:prossimita`, `test:filtri-scuole`, `test:compatibilita:graduata`,
`test:riempitivi`, `test:opportunita`, `test:compatibilita` → ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/compatibilitaGraduata.ts` (pesi, media
ponderata, `pesoTotale`, riga di composizione nel motivo), `src/lib/compatibilita.ts` (solo
commento: «media ponderata»). **Guardie**: `scripts/test-modali-radar.ts` (pesi, media ponderata,
rinormalizzazione, denominatore), `scripts/test-compatibilita-graduata.ts` (media 90, penalità 10,
peso doppio della classe). **Documentazione**: `docs/SYSTEM_HANDOVER.md` (questa §26.57 + mappa
moduli), `docs/DEPARTMENT_MAP.md`. **Non toccati**: `comunicazione/**` (nessuna regola di prodotto
cambia: la consegna e i numeri delle singole modali restano quelli della §26.56), `src/departments/**`
e la pipeline di consegna.

### 26.58 L'OVERRIDE della Modale 3: la parola chiave assegna il voto (05/10/2026) — SUPERATA dalla §26.63 (API ritirata)

> **Nota (06/10/2026).** Questa sezione è **STORICA**: l'**override** della Modalità 3 è stato **RITIRATO** dalla **§26.63**. Una competenza trovata nel testo **non assegna più il voto** (90 piena · 85 vicina), non blocca la media e **non apre** una card da sola: è il **LIVELLO SECONDARIO** che sfuma di max 25 punti il voto delle preferenze primarie. Ritirati con esso: il campo `EsitoCompetenze.override`, `ETICHETTA_PAROLA_CHIAVE`, `descrizioneParolaChiave`, il campo `Interpello.parolaChiaveVoto` e la guardia `npm run test:override` (`scripts/test-override-modale3.ts`, **rimosso**: al suo posto `npm run test:scoring`). La fotografia storica resta per tracciabilità.

**Perché.** Richiesta di prodotto sulla §26.57: le parole chiave non sono una modale «fra le
altre». Quando una parola chiave del profilo compare nel testo dell'avviso il voto **non deve
nascere da nessuna media**: la Modale 3 è un **override ad alta priorità** — assegna d'ufficio il
voto e blocca ogni altro calcolo. La **PROVINCIA** resta l'unica condizione (oltre il raggio
l'esclusione geografica vince: §26.56).

**La regola, in due tier.**

| Tier | Quando | Voto mostrato |
|---|---|---|
| **1 · OVERRIDE (Modalità 3)** | una parola chiave del profilo è TROVATA nel testo dell'avviso (tutti i suoi token significativi, es. «Intelligenza Artificiale») | **90%** d'ufficio: la media delle altre modali non viene calcolata (`pesoTotale` 0, nessun jolly) |
| | match **SEMANTICO VICINO** (alcuni token della parola chiave, es. «Didattica Multimediale») | **85%** d'ufficio, stesse regole |
| **2 · MEDIA PONDERATA (Modalità 1 · 2 · 4)** | la Modale 3 non aggancia nulla (o trova solo corrispondenze «riconducibili») | `Σ(punteggio × peso) / Σpesi` + jolly del 3% (§26.57) |

Il match e la sua natura vivono in `punteggioCompetenze`: `EsitoCompetenze.override` =
`{ grado: 'esatta' | 'vicina', parolaChiave, punteggio }` — **un solo oggetto** dichiara quale
parola ha assegnato il voto, e `null` significa «media ponderata». Le parole chiave **non hanno
peso** in `PESI_MODALI` (ora `{ ordine: 1, classe: 2, provincia: 1 }`): non entrano nella media —
o decidono loro, o sfumano il voto col jolly (+3% per corrispondenza parziale o riconducibile,
tetto +9%). Invariante verificata da `npm run test:modali` (`!('competenze' in PESI_MODALI)`).

**La media ponderata ha la sua casa.** Pesi, `ContributoModale` e `mediaPonderata` sono passati
nel nuovo modulo puro **`src/lib/mediaModali.ts`** (50 righe): la formula è una regola a sé,
testabile senza l'aggregatore. `compatibilitaGraduata.ts` (**242 righe**) resta il punto dei due
tier — override prima, media poi — e il tooltip dichiara la riga giusta: «voto assegnato
d'ufficio 90% (Modale 3: parola chiave piena)» oppure «media ponderata di N modali».

**Effetti sui numeri (dichiarati, non silenziosi).**

| Caso | §26.57 | §26.58 |
|---|---|---|
| ordine 100 · classe affine 95 · provincia 100 · **parola chiave piena** | 96 | **90** (la media tace: la classe non conta più) |
| ordine 100 · classe esatta 100 · provincia 100 · **match vicino** | 100 | **85** (voto assegnato, non mediato) |
| ordine 100 · classe affine 95 · provincia 100 (nessuna parola chiave) | 98 | **98** (invariato: media ponderata di 3 modali) |
| parola chiave piena ma provincia **oltre** i 60 km | — | **0 · escluso** (l'esclusione d'ufficio vince sull'override) |

**Invarianti che NON cambiano.** Il pavimento EXTRA del sostegno resta **60** anche quando una
parola chiave combacia (§26.45: è un suggerimento extra a inclusione permanente, non un match — e
l'aggregatore esce sull'`PUNTEGGIO_EXTRA_SOSTEGNO` prima di valutare l'override). La **blacklist**
continua a scartare a prescindere; la **whitelist** continua a includere d'ufficio e, se la parola
chiave scatta, il voto assegnato resta quello. La consegna (email, Telegram, digest) resta STRICT e
non passa di qui; il jolly del 3% resta **deterministico** e vale solo sulla media.

**Card e dettaglio dichiarano il voto.** Nuova etichetta condivisa `ETICHETTA_PAROLA_CHIAVE`
(«Parola chiave trovata») e `descrizioneParolaChiave(parola, punteggio)` in
`src/lib/compatibilita.ts`, mostrate accanto al badge (o all'etichetta della scuola preferita) da
`InterpelloCard.tsx` e `InterpelloDettaglioModal.tsx`: un voto fisso **spiegato**, mai un numero che
sembra casuale. L'unico dato nuovo è **`parolaChiaveVoto`** (`src/data/interpelli.ts`): lo scrive la
bacheca da `valutazione.override`, mai il DB.

**Verifiche (05/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (599 file ·
**141** = baseline; `compatibilitaGraduata.ts` = 242 righe e `mediaModali.ts` = 50, sotto la soglia
di attenzione di 250) · `npx eslint` sui file toccati → ✅ zero problemi · `npm run build` → ✅ exit 0 ·
guardie: `test:override` (**nuova**, in `npm test`), `test:modali`, `test:compatibilita:graduata`,
`test:filtri-scuole`, `test:opportunita`, `test:compatibilita`, `test:riempitivi`, `test:prossimita`
→ ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/mediaModali.ts` (**nuovo**: pesi + formula),
`src/lib/compatibilitaGraduata.ts` (override + media dei tre pesi), `src/lib/punteggioCompetenze.ts`
(`EsitoCompetenze.override`, `matchPrevalente`/`motivoDi` interni), `src/lib/bachecaInterpelli.ts`
(pertinenza via override + `parolaChiaveVoto`), `src/lib/compatibilita.ts`
(`ETICHETTA_PAROLA_CHIAVE`, `descrizioneParolaChiave`), `src/data/interpelli.ts` (`parolaChiaveVoto`) ·
**viste condivise (fuori dal dipartimento, come da richiesta sulla vetrina)**:
`src/components/InterpelloCard.tsx`, `src/components/InterpelloDettaglioModal.tsx` · **guardie**:
`scripts/test-override-modale3.ts` (**nuova**), `scripts/test-modali-radar.ts`,
`scripts/test-compatibilita-graduata.ts`, `package.json` (`test:override` + ingresso in `npm test`) ·
**documentazione**: `docs/SYSTEM_HANDOVER.md` (questa §26.58 + mappa moduli),
`docs/DEPARTMENT_MAP.md`. **Non toccati**: `comunicazione/**` (la consegna e i numeri della consegna
restano quelli della §26.56/§26.57), `src/departments/**`, la pipeline di consegna
(`src/lib/notifier.ts`, `src/lib/digest.ts`, `invia-*`).

### 26.59 Vetrina: il gate STRETTO del nome scuola — in bacheca (e nella prova) entra solo una riga con un istituto REALE (05/10/2026)

**Perché.** Direttiva di prodotto del 05/10/2026 sul **Radar Live**: il tabellone è la vetrina del
servizio e una riga di cui **non si sa quale scuola** emette l'avviso non è verificabile in pubblico —
sembra un servizio rotto. Le due direttive del 04/10 (§26.47 «nessuno scarto per anagrafica» e §26.48
«segnaposto *Scuola non specificata / Più plessi*») avevano tenuto in bacheca anche le righe senza
istituto: **qui si torna al gate stretto** (§26.20 del 28/09, che era stato revocato dalla §26.47). Lo
stesso giudizio vale per il **responso della prova del Radar**: due superfici pubbliche non possono
avere regole diverse. Companion della stessa sessione: **§26.60** (bacheca: riempitivi non pertinenti)
e **§26.61** (prova: sola provincia, nessun pool nazionale).

**La regola, in una riga.** In vetrina entra **solo** una riga con il nome di un **istituto REALE**
risolto per anagrafica, in quest'ordine (`nomeScuolaRiga`, `src/lib/liveBoard.ts`): (1) `school_name`
del record — comunque passato dal GATE `nomeIstituto.ts`; (2) **registro scolastico** per codice
meccanografico (`school-lookup.ts`, soli istituti reali); (3) **titolo** dell'avviso (`scuolaDaTitolo`:
nome prima del separatore quando dopo c'è l'azione amministrativa). Il terzo gradino è *ricostruito*:
la riga entra ma l'anagrafica è dichiarata incompleta.

**Cosa resta fuori.**

| # | Esclusione | Perché |
|---|---|---|
| 1 | righe con il **solo nome grezzo pubblicato dal bando** (`nomeGrezzoDaBando`) | è il dato della fonte, non un'anagrafica: la §26.47 lo usava come ripiego di vetrina |
| 2 | righe **senza alcun nome risolvibile** (per cui la §26.47/§26.48 prevedevano il segnaposto) | un segnaposto non è una scuola: la riga non è verificabile |
| 3 | avvisi **non vivi** (scaduti o fuori dalla finestra dei 60 giorni) | invariato (§26.34/§26.20) |

I **codici amministrativi** («ADEE \| EEEE», «BA02 \| AR04», elenchi di classi di concorso) restano
fuori **a monte**, nel gate `nomeIstituto.ts`: non sono mai un nome, per nessuna strada.

**Intervento (un solo punto di verità).** In `src/lib/liveBoard.ts` `nomeScuolaBoard(riga)`
restituisce `NomeScuolaBoard | null` (`{ nome, approssimativo }`; `null` = riga **FUORI**) e
sostituisce la vecchia catena a ripiego; `preparaRigheBoard` riapplica `if (!nome) continue;` prima
del `push`; `nomePresentabileRiga` (responso della prova) usa lo **stesso** gate — l'ente emittente
non è più una risorsa (l'import di `enteEmittenteDaTitolo` è rimosso) e `rigaPresentabileVetrina`
richiede un istituto reale. `nomeGrezzoDaBando` resta nel modulo come **giudizio puro** («nome
leggibile o dump di codici?») per la qualità dell'ingestione, ma non è più un ripiego. In
`src/lib/statoArricchimento.ts` cambiano solo il contratto documentato del segnaposto
(`SCUOLA_NON_SPECIFICATA` non è più una dicitura di vetrina) e la nota su `parziale`.

**La tolleranza che resta (dichiarata, non silenziosa).** La pipeline **non perde** un avviso
genuino: la riga entra comunque in `interpelli` con i dati grezzi e il suo `stato_arricchimento`
(§26.47 invariata), resta nel feed dell'utente e nelle notifiche puntuali. Cambia la **superficie
pubblica**. Caso Padova: istituto reale + anagrafica `parziale` → **entra** e `anagraficaParziale` lo
dichiara (chip ambra di `radar/flightBoard/components/RigaBoard.tsx`); riga **senza** istituto →
resta in database ma **non** in bacheca.

**Effetti dichiarati.** (1) Il segnaposto «Scuola non specificata / Più plessi» non compare più in
nessuna superficie della bacheca o della prova: resta nella **scheda del singolo avviso**
(`src/components/IstitutoEmittente.tsx`), dove l'avviso è già dell'utente. (2) Una provincia con
molte righe non mappate mostra **meno** righe di prima: il conteggio resta esatto e mai gonfiato
(`npm run test:board:scala`). (3) La colonna «Scuola» non mostra mai un codice, per nessuna strada.

**Verifiche (05/10/2026, da `project/`).** `npm run test:board` → ✅ («RADAR LIVE: nessun problema»:
23 asserzioni, con i nuovi casi «nessun nome risolvibile → FUORI», «elenco di codici classe →
FUORI», «anagrafica `parziale` con istituto reale → dentro e dichiarata») · `npm run
test:nome-istituto` → ✅ («NOMI ISTITUTO: nessun problema»: gate di bacheca e responso della prova con
la stessa regola stretta, «titolo leggibile ma nessuna scuola → FUORI») · `npm run test:pipeline` →
✅ («PIPELINE TOLLERANTE: tutti i controlli superati», inclusa la riga di Padova tollerata e il
giudizio puro su `nomeGrezzoDaBando`) · `npm run typecheck` → ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/liveBoard.ts`, `src/lib/statoArricchimento.ts`
(JSDoc/contratto). **Dipartimento Radar**: `src/departments/radar/flightBoard/righeBoard.ts` (JSDoc),
`src/departments/radar/SimulatorRadar.tsx` (commento di vetrina). **Guardie**: `scripts/test-live-board.ts`,
`scripts/test-nome-istituto.ts`, `scripts/test-pipeline-tollerante.ts`. **Documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.59, mappa dei moduli, note di superamento in §26.47/§26.48),
`comunicazione/04_canali_regionali/checklist_regionali.md` (§4: in bacheca nessuna riga senza la sua
scuola). **Non toccati**: `src/departments/notizie/**`, `src/scraper/**`, il database.

### 26.60 Bacheca: i riempitivi NON pertinenti non entrano — esclusione secca a monte del cap (05/10/2026)

**Perché.** Il **cap dinamico** dei riempitivi (§26.55) metteva un tetto al rumore (max **5** voci
sotto la soglia arancio, e nessuna quando ci sono già **10** match di qualità), ma **dosava** anche i
falsi positivi: un avviso sotto il 70% che il Radar **non conferma** — né la classe dell'utente, né
una sua parola chiave — non è «una voce che tocca di striscio il profilo»: è un avviso che **non
appartiene** a quel docente. Il caso tipico era il **suggerimento EXTRA del sostegno** (§26.45): la
conferma del motore lo include d'ufficio (`profiloAderisceSostegno`), quindi passava la porta
d'ingresso e finiva tra i riempitivi, in cima agli occhi di un utente che non ha nessuna classe AD.
Companion della stessa sessione: **§26.59** (gate stretto dei nomi d'istituto: in vetrina entra solo
un istituto reale) e **§26.61** (la prova risponde con la sola provincia).

**La regola, in una riga.** Se il punteggio è **noto** e **sotto la soglia arancio** (< 70%) e la
voce **non è pertinente** (né classe dell'utente né parola chiave del profilo), la voce **non entra
in bacheca**: nessuna quota, nessun cap. I riempitivi **pertinenti** restano — e restano soggetti al
cap di 5 — e le **scuole preferite** non sono toccabili da nessun automatismo (scelta esplicita
dell'utente, Modalità 5).

**Chi resta, chi va** (`riempitivoNonPertinente` in `src/lib/riempitivi.ts`, applicato da
`bachecaInterpelli` in `src/lib/bachecaInterpelli.ts`):

| # | Caso | Esito |
|---|---|---|
| 1 | < 70% con la **conferma del motore** (una classe in comune; per i profili senza classi vale il livello secondario, §26.63) | **resta**: riempitivo *pertinente*, soggetto al cap di 5 |
| 2 | < 70% senza la conferma del motore (tipico sostegno EXTRA) | **FUORI**: esclusione secca, a monte del cap |
| 3 | < 70% ma scuola preferita (`forzata`) | **resta**: inclusione d'ufficio della Modalità 5 |
| 4 | ≥ 70% (qualità) | resta a prescindere dalla pertinenza: il cap non la tocca |
| 5 | punteggio **assente** (`null` dal DB) | resta: un valore assente è **neutro**, mai classificato a caso |

**Meccanica (due punti di verità, nessun altro).** In `src/lib/riempitivi.ts` il nuovo predicato puro
`riempitivoNonPertinente(voce, { pertinente, forzata?, soglia? })` risponde in quest'ordine:
`forzata` → `false`; `pertinente` → `false`; punteggio non noto → `false`; altrimenti
`punteggio < soglia`. In `src/lib/bachecaInterpelli.ts` la pipeline resta a **sei passi** e la **porta
d'ingresso è PRIMARIA (§26.63)**: entrano gli avvisi confermati dal motore oppure con la classe almeno
«stessa area» (`classeVicina`, 85) — una competenza trovata **non apre** la bacheca a un profilo che ha
già una classe. La pertinenza è la conferma del motore (§26.54)
**depurata del solo suggerimento EXTRA del sostegno** (`avvisoDiSostegno && !profiloAderisceSostegno`),
perché per la pertinenza serve una conferma per **classe** (per un profilo senza classi resta il livello
secondario, §26.63). L'esclusione **conta**:
`EsitoBacheca.riempitiviEsclusi` (companion di `riempitiviNascosti`) — nessuno scarto è silenzioso.

**Effetti dichiarati.** (1) Una provincia magra può mostrare **meno** righe di ieri: quelle in più
sono opportunità vere. (2) Nessun riempitivo di qualità perso: la quota di 5 resta piena sui
pertinenti. (3) Cap ed esclusione **non** toccano la consegna (`notifier`/`digest`, §26.59): la
bacheca è una superficie, non un filtro di notifica.

**Verifiche (05/10/2026, da `project/`).** `npm run test:riempitivi` → ✅ («RIEMPITIVI: cap dinamico
(max 5 sotto il 70%, nessuno con 10 match di qualità) + esclusione secca dei NON pertinenti
(§26.60)», con le asserzioni «esclusione secca dei non pertinenti, A MONTE del cap» e «il conto
degli esclusi è dichiarato, mai silenzioso») · `npm run test:filtri-scuole` → ✅ (le scuole preferite
sopravvivono a cap e blacklist) · `npm run test:board` → ✅ · `npm run test:prova-radar` → ✅ ·
`npm run test:nome-istituto` → ✅ · `npm run test:pipeline` → ✅ · `npm run test:admin:utente` → ✅ ·
`npm run typecheck` → ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/riempitivi.ts` (nuovo `riempitivoNonPertinente`
+ §26.60 nel contratto del modulo), `src/lib/bachecaInterpelli.ts` (passo 5 e
`riempitiviEsclusi`), `src/lib/compatibilita.ts`/`src/lib/compatibilitaGraduata.ts` (soglia condivisa
`sogliaCompatibilitaArancio`). **Guardie**: `scripts/test-riempitivi-bacheca.ts`. **Documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.60), `docs/DEPARTMENT_MAP.md`,
`comunicazione/04_canali_regionali/checklist_regionali.md` (§4: il rumore non occupa il posto di
un'opportunità). **Non toccati**: `src/departments/notizie/**`, `src/scraper/**`, il database.

### 26.61 Prova del Radar: si prova con la SOLA provincia — nessun pool nazionale, nessun dato di esempio (05/10/2026)

**Perché.** Il box «Prova il Radar» dell'hero è il primo contatto con il servizio e la sua promessa è
scritta nella UI: «Scegli la provincia: cerchiamo su tutte le categorie». Il responso però poteva
attingere a un **ripiego nazionale** (le 60 righe lette fuori provincia) quando la provincia provata
era magra: un avviso di un'altra provincia mostrato sotto il nome di quella provata è una promessa
tradita — e in pubblico. Allineata al gate stretto dei nomi d'istituto (§26.59), la prova ora
risponde con la **sola provincia** provata.

**La regola, in una riga.** La prova legge **UNA** provincia — `.eq('province', <codice>)`, 200 righe,
solo avvisi **vivi** — e il responso mostra **solo** quelle righe. Se la provincia non ha nulla di
vivo il gruppo è `'vuoto'` e prende la parola `messaggioRadarInScansione(provincia)`: «Appena esce un
avviso su <provincia> te lo diciamo noi». È una promessa vera (il Radar personale sorveglia quella
provincia) e la prova resta onesta.

**Perché non può più sbagliare (difesa strutturale, non copy).**
`selezionaRisultatiProva(righeProvincia, limite)` ha un **unico ingresso**: non esiste una firma con
cui passare un pool di altre province, quindi la chiusura della prova non ha modo di mostrare un
avviso non locale. `GruppoProvaRadar` è `'provincia' | 'vuoto'` e `messaggioConversione` conta
soltanto le righe mostrate: il conteggio è **esatto** e non gonfiato.

| # | Prima (§26.40 e precedenti) | Ora (§26.61) |
|---|---|---|
| 1 | ripiego su righe **nazionali** quando la provincia era magra | **nessun** ripiego: fuori provincia non si legge |
| 2 | il responso poteva dichiarare una provenienza non locale | provenienza **sempre** la provincia provata |
| 3 | pool consumato da avvisi già scaduti (ordinamento per scadenza) | soglia `expiration_date` lato DB (margine di 1 giorno) + `righeAttive` in memoria: le righe senza scadenza restano |

**Cosa resta invariato.** (1) La **maglia larga sulle categorie**: interpelli e supplenze, PON/POR,
PNRR, CPIA, ATA/bidelli, esperti esterni — la geografia è stretta, le categorie no. (2) La **memoria
della provincia provata** (`src/lib/provaRadar.ts`, `sr_prova_radar`): il wizard «Attiva il tuo
Radar» la eredita come provincia **principale** invece di chiederla di nuovo (solo il codice, validato
sul catalogo `data/province`). (3) Il **limite di schermo** (5 righe, `LIMITE_RISULTATI_PROVA`) e la
coda di conversione unica. (4) Il gate dei nomi in vetrina vale anche qui (`rigaPresentabileVetrina`,
§26.59).

**Verifiche (05/10/2026, da `project/`).** `npm run test:prova-radar` → ✅ («PROVA DEL RADAR: nessun
problema»: responso con la sola provincia provata, responso vuoto che dichiara la scansione, pool dei
soli avvisi **vivi**, box dell'hero e wizard allineati) · `npm run test:board` → ✅ ·
`npm run test:riempitivi` → ✅ · `npm run test:nome-istituto` → ✅ · `npm run test:pipeline` → ✅ ·
`npm run typecheck` → ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/provaRadarEngine.ts` (responso a un solo
ingresso, gruppo `'vuoto'`), `src/lib/provaRadar.ts` (memoria della provincia provata, JSDoc).
**Dipartimento Radar**: `src/departments/radar/services/provaRadarQuery.ts` (una provincia, solo
vivi), `src/departments/radar/SimulatorRadar.tsx` (nessun selettore di classe, nessuna seconda query),
`src/departments/radar/components/ResponsoProva.tsx`. **Guardie**: `scripts/test-prova-radar.ts` e la
fixture condivisa `scripts/lib/fixtures-prova-radar.ts` (righe di prova, mai dati dimostrativi; lo
stub dello storage in memoria vive qui). **Documentazione**: `docs/SYSTEM_HANDOVER.md` (§26.61),
`docs/DEPARTMENT_MAP.md` (riga `services/`: rimossa la dicitura «60 nazionali»),
`comunicazione/04_canali_regionali/checklist_regionali.md` (§4: si prova con la sola provincia; §5:
guardia `test:prova-radar`). **Non toccati**: `src/departments/notizie/**`, `src/scraper/**`, il
database.

### 26.62 Preferenze Radar: i suggerimenti scuola restano nell'ambito provinciale (forzatura dichiarata) + scheda utente Admin completa (05/10/2026)

**Perché.** Due buchi sulla stessa catena (profilo dell'utente ↔ lettura Admin). (1) Il campo «Scuole
preferite / escluse» del pannello «Filtri Avanzati Scuole» proponeva come suggerimenti **tutte** le
scuole comparse nel feed, comprese quelle di province che l'utente **non** segue: il feed è raccolto
sulle province proprie **più** il raggio dei 60 km (§26.56), quindi un nome proposto poteva appartenere
a una provincia fuori ambito e finire in whitelist/blacklist senza che l'utente sapesse di stare
allargando le proprie province. (2) La scheda utente dell'Admin e la card del tab «Radar» mostravano le
CLASSI come codici nudi — mai le DISCIPLINE che ne derivano — e i chip erano **troncati** con un «+N»:
l'Admin non vedeva l'elenco completo delle preferenze del profilo.

**La regola, in una riga.** I suggerimenti del campo scuola sono **solo** le scuole delle province da
cercare (proprie + entro 60 km, `provinceDiRicerca`); un nome fuori da quell'ambito resta
**scrivibile**, ma la **forzatura è dichiarata** (avviso sotto il campo + badge sulla pill) — e le
superfici Admin mostrano le preferenze **complete**, con le materie derivate dalle classi e senza chip
troncati.

**Ambito di un nome di scuola** (`ambitoScuola` + `messaggioAmbitoScuola`, `src/lib/filtriScuole.ts`):

| # | Caso | Esito | Cosa vede l'utente |
|---|---|---|---|
| 1 | Scuola di una provincia **seguita** (propria o entro 60 km) | `dentro` | «Scuola delle tue province (o entro 60 km): entra nelle liste senza forzature.» |
| 2 | Scuola **nota** ma di un'altra provincia | `fuori` | «Scuola di <provincia>: fuori dalle tue province e dal raggio di 60 km — la forzatura è dichiarata.» + badge «Fuori ambito · <provincia>» sulla pill |
| 3 | Nome **mai visto** nel feed (a campo vuoto: nessun avviso) | `sconosciuta` | «Scuola non presente nel feed: forzatura manuale dichiarata.» |

**Meccanica (una sola sorgente, un solo confronto).** `scuoleNote(avvisi)` legge il feed reale
(`istituto` + provincia dell'avviso) e costruisce la mappa nome → provincia senza doppioni;
`suggerimentiScuole(note, provinceCodici)` tiene solo le province seguite; `ambitoScuola(note,
provinceCodici, nome)` risponde `dentro`/`fuori`/`sconosciuta` con lo stesso confronto onesto delle
liste (prima il nome intero, poi `includes`; sigle di provincia normalizzate in maiuscolo). La copy è
**una sola** per campo, avviso e badge (`messaggioAmbitoScuola`). Senza province scelte non c'è ambito
da proporre: i suggerimenti sono **vuoti** e il campo resta a testo libero — ogni nome digitato è una
forzatura dichiarata. In `departments/radar/PreferenzeRadar.tsx` l'ambito è calcolato con
`provinceDiRicerca(provinceCodici)` — la **stessa** fonte della Modalità 4 — quindi suggerimenti e
forzature non possono divergere dal raggio dei 60 km.

**Scheda utente Admin (#4).** Una sola derivazione (`preferenzeUtenteAdmin`,
`departments/admin/components/derivaPreferenzeUtente.ts`) e una sola resa
(`departments/admin/components/PreferenzeUtente.tsx`), montata dalla scheda di dettaglio del tab
«Utenti» (`variante="dettaglio"`) e dalla card del tab «Radar» (`variante="compatto"`): ordini di
scuola nel nome leggibile, classi di concorso, **Materie derivate dalle classi** (nuovo modulo
condiviso `src/lib/materieClassi.ts`: `materieDelleClassi(codici)` normalizza i codici
(`normalizzaClasse`: `A-018` ≡ `A18`) e legge `materie[]` dal catalogo `src/data/classiConcorso.ts`
risolvendo gli id nel nome, senza duplicati e nell'ordine delle classi scelte; un codice fuori catalogo
non inventa righe), materie/competenze di catalogo nel nome della materia, tag personalizzati, province
e scuole preferite/escluse. Il titolo della sezione della scheda è **«Profilo utente & preferenze
Radar»**; in variante compatta le due liste scuola diventano il **conteggio** «Scuole preferite /
escluse: N / M». In `departments/admin/adminUi.tsx` il componente `Chips` **non tronca più** l'elenco:
spariscono `lista.slice(0, 4)` e il contatore `+{lista.length - 4}` — l'Admin vede tutte le voci. La
**stessa** derivazione delle materie vive nella vista utente
(`departments/radar/components/RiepilogoLavoro.tsx`, box «In cosa puoi lavorare», riga «Materie»): due
superfici, una sola regola.

**Effetti dichiarati.** (1) Il campo scuola propone **meno** nomi di prima: quelli in più erano fuori
ambito. (2) Nulla è stato reso impossibile: la forzatura resta scrivibile — cambia solo che ora è
**visibile**, mai silenziosa. (3) Nessun effetto su matching, bacheca e notifiche: whitelist e blacklist
continuano a valere come prima (`giudizioScuole`, la blacklist vince); qui cambiano l'aiuto alla
digitazione e la sua dichiarazione.

**Verifiche (05/10/2026, da `project/`).** `npm test` → ✅ exit 0 · `npm run test:filtri-scuole` → ✅
(§4 nuova: scuole note senza doppioni, suggerimenti solo nell'ambito, `dentro`/`fuori`/`sconosciuta`,
copy della forzatura, cablaggio di pannello e `PreferenzeRadar`) · `npm run test:admin:utente` → ✅
(schede Admin complete: Materie derivate, nessun chip troncato) · `npm run build` → ✅ · `npm run
typecheck` → ✅ exit 0 · `npm run test:architettura` → ✅ nessuna violazione nuova · `npx eslint` sui file
toccati → ✅ nessun errore.

**File toccati.** **Condivisi essenziali**: `src/lib/filtriScuole.ts` (sezione «ambito provinciale» con
`scuoleNote`, `suggerimentiScuole`, `ambitoScuola`, `messaggioAmbitoScuola`, `ScuolaNota`,
`AmbitoScolastico`), **nuovo** `src/lib/materieClassi.ts`. **Dipartimento Radar**:
`src/departments/radar/PreferenzeRadar.tsx` (`scuoleNote(interpelliFiltrati)` + ambito con
`provinceDiRicerca`), `src/departments/radar/preferenze/PannelloFiltriScuole.tsx` (datalist con la sigla
di provincia accanto al nome, avviso dell'ambito sotto **entrambi** i campi, badge «Fuori ambito» sulle
pill), `src/departments/radar/components/RiepilogoLavoro.tsx` (riga «Materie»). **Dipartimento Admin**:
`src/departments/admin/components/derivaPreferenzeUtente.ts` (campo `materieClassi`),
`src/departments/admin/components/PreferenzeUtente.tsx` (riga «Materie», conteggio delle scuole nella
variante compatta), `src/departments/admin/tabs/utenti/DettaglioUtente.tsx` (titolo della sezione),
`src/departments/admin/adminUi.tsx` (`Chips` senza troncamento). **Guardie**:
`scripts/test-filtri-scuole.ts` (§4), `scripts/test-admin-dettaglio-radar.ts`. **Documentazione**:
`docs/SYSTEM_HANDOVER.md` (§26.62), `docs/DEPARTMENT_MAP.md` (moduli `lib/filtriScuole.ts` e
`lib/materieClassi.ts` + riga di changelog),
`comunicazione/04_canali_regionali/checklist_regionali.md` (§4: la forzatura è dichiarata; §5: guardie
`test:filtri-scuole` e `test:admin:utente`). **Non toccati**: `src/departments/notizie/**`,
`src/scraper/**`, il database.

### 26.63 Il punteggio ha DUE LIVELLI: le preferenze fanno il voto, le competenze lo sfumano (06/10/2026)

**Perché.** Richiesta di prodotto sulla §26.56/§26.57/§26.58: il voto della bacheca **non può essere
deciso** da una competenza del profilo. Le preferenze dichiarate — dove vuole lavorare, quali classi di
concorso, in quale provincia — sono l'unico criterio che **fa** il match; le competenze e le parole
chiave libere («In cosa puoi lavorare oltre la classe») sono un **secondo livello**: **sfumano** un voto
che esiste già, di al massimo `CAP_COMPETENZE` = **25** punti. L'**override** della Modalità 3 (§26.58:
90 parola chiave piena · 85 match vicino **assegnati d'ufficio**) è **ritirato**.

**I due livelli.**

| Livello | Chi lo compone | Cosa può fare |
|---|---|---|
| **PRIMARIO (100%)** | `punteggioOrdine` (peso 1) · `punteggioClasse` (2) · `punteggioProvincia` (1), media PONDERATA di `mediaModali.ts` | **decide** il voto **e** la porta d'ingresso della bacheca |
| **SECONDARIO (max 25)** | `punteggioCompetenze` (competenze di catalogo + `materie_custom`) | **sfuma**: si somma al primario, non lo sostituisce e non apre nulla |

**Come si calcola (un solo punto: `valutaCompatibilita`, `src/lib/compatibilitaGraduata.ts`).**

```
punteggio = min(tetto, mediaPonderata(modali primarie applicabili) + punteggioCompetenze)
tetto     = punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO ? 25 : 100
```

In quest'ordine: (1) la **geografia è sovrana** — oltre il raggio dei 60 km l'avviso è escluso (`0`),
salvo `forzata` (whitelist); (2) il **sostegno EXTRA** fuori dalle proprie classi resta al pavimento
`PUNTEGGIO_EXTRA_SOSTEGNO` = **60** e le competenze **non lo promuovono** (il livello secondario non
entra: `pesoTotale` 0, `competenzaSecondaria` null); (3) altrimenti media ponderata delle modali
primarie applicabili **+ la sfumatura**, dentro il tetto.

**La sfumatura (`src/lib/punteggioCompetenze.ts`).** Il grado del match PIÙ FORTE fra le competenze
trovate decide i punti: **esatta 25** (tutti i token significativi della competenza sono nel testo) ·
**vicina 20** (match semantico vicino) · **riconducibile 10** (stessa area disciplinare o ponte curato).
Ogni corrispondenza **aggiuntiva** vale `INCREMENTO_JOLLY` = **3** punti in più, sempre **dentro** il
tetto: `punteggio = min(CAP_COMPETENZE, puntiDelGrado + 3 × corrispondenzeAggiuntive)`. Nessuna
corrispondenza → `punteggio 0`: il livello secondario **non ha nulla da dire** e il voto resta tutto
delle preferenze. È **deterministico** (dipende dalle corrispondenze trovate, non dal caso), quindi
spiegabile all'utente e verificabile da una guardia.

**Perché il tetto è 25 (e non un altro numero).** È **lo stesso numero del motore**:
`PUNTEGGIO_MATCH_SECONDARIO` (`src/lib/matchingEngine.ts`) è la sentenza con cui il motore dice «questo
profilo **non ha classi**: l'aggancio può venire solo dal testo». Il livello secondario, da solo, **non
può** raggiungere il match pieno né superare la soglia rossa (60): da qui la regola del tetto —
`punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO` → `tetto = 25`, altrimenti `100`. La guardia
`npm run test:scoring` verifica che i due numeri restino **uguali**.

**La porta d'ingresso è primaria (`src/lib/bachecaInterpelli.ts`).** In bacheca entrano gli avvisi che
le preferenze PRIMARIE agganciano: la conferma del motore (`avvisoCompatibileConProfilo`, province entro
il raggio) **oppure** la classe almeno «stessa area» (`classeVicina`, 85). Una competenza trovata **non
fa entrare una card da sola**: nessun avviso di una classe lontana promosso da un tag, nessuna quota di
bacheca per una parola chiave (per un profilo **senza** classi di concorso l'aggancio possibile è solo
testuale, e resta sotto il tetto — §26.45 e la regola storica del motore). La **pertinenza** dei
riempitivi (§26.60) segue la stessa logica: è la conferma del motore per **classe**, depurata del solo
suggerimento EXTRA del sostegno.

**Card e modale dichiarano la sfumatura.** Nuova etichetta condivisa `ETICHETTA_COMPETENZA_SECONDARIA`
(«Competenza trovata») e `descrizioneCompetenzaSecondaria(competenza, punteggio)` in
`src/lib/compatibilita.ts`, mostrate accanto al badge da `InterpelloCard.tsx` e
`InterpelloDettaglioModal.tsx`: il voto resta quello delle preferenze e la competenza è **dichiarata**
come ciò che l'ha sfumato (mai un numero che sembra casuale). Il dato è `Interpello.competenzaSecondaria`
(`src/data/interpelli.ts`, al posto di `parolaChiaveVoto`): lo scrive la bacheca, **mai il DB** (verificato il 06/10/2026: `competenzaSecondaria` non compare in `src/lib/notifier.ts`, `src/lib/digest.ts`, negli `invia-*` né in `supabase/**`), e **non
entra nella consegna** — `notifier`, `digest` e `invia-*` continuano a usare il motore STRICT
(`provinceLimitrofe` è un'opzione della sola bacheca).

**Invarianti (nessuna regressione).** Sostegno extra **60** (le competenze non lo promuovono); esclusione
oltre i 60 km salvo whitelist; `forzata` bypassa geografia e cap dei riempitivi, **non** il punteggio;
nessun peso supera la metà dei pesi totali applicabili (classe 2 su 4); `0` = nessuna modale applicabile
(resta il valore del DB); la consegna è intatta.

**API ritirata (§26.58).** Nessun simbolo resta in `src/**` e `scripts/**`: `EsitoCompetenze.override`,
`ETICHETTA_PAROLA_CHIAVE`, `descrizioneParolaChiave`, `Interpello.parolaChiaveVoto`, `JOLLY_MASSIMO`, il
ruolo JOLLY in percentuale della Modalità 3 e la guardia `npm run test:override`
(`scripts/test-override-modale3.ts`, **rimosso**). `npm run test:scoring` verifica l'assenza di tutti
questi simboli e che lo script ritirato non sia più nella catena di `npm test`.

**Verifiche (06/10/2026, da `project/`).** `npm run typecheck` → ✅ exit 0 · **`npm test` (catena
completa) → ✅ exit 0** · `npm run test:architettura` → ✅ nessuna violazione nuova (602 file · **141** =
baseline; `scripts/test-compatibilita-graduata.ts` = **248 righe**, sotto la soglia di attenzione di 250;
`src/lib/punteggioCompetenze.ts` = 199) · `npx eslint` sui file toccati → ✅ zero problemi · `npm run
build` → ✅ exit 0 · guardie: `test:scoring` (**nuova**, in `npm test`: sostituisce `test:override`),
`test:modali`, `test:compatibilita:graduata`, `test:compatibilita`, `test:riempitivi`,
`test:filtri-scuole`, `test:opportunita` → ✅ exit 0.

**File toccati.** **Condivisi essenziali**: `src/lib/punteggioCompetenze.ts` (livello secondario: gradi
25/20/10, `CAP_COMPETENZE`, `INCREMENTO_JOLLY`, tetto; ritirato l'override),
`src/lib/compatibilitaGraduata.ts` (media primaria + sfumatura + regola del tetto + `competenzaSecondaria`),
`src/lib/matchingEngine.ts` (`PUNTEGGIO_MATCH_SECONDARIO` = 25, commenti), `src/lib/mediaModali.ts`
(commenti: le competenze fuori dai pesi), `src/lib/riempitivi.ts` (commenti: la pertinenza è PRIMARIA — le competenze non la stabiliscono, §26.60/§26.63), `src/lib/bachecaInterpelli.ts` (porta d'ingresso primaria +
`competenzaSecondaria`), `src/lib/compatibilita.ts` (`ETICHETTA_COMPETENZA_SECONDARIA`,
`descrizioneCompetenzaSecondaria`), `src/data/interpelli.ts` (`competenzaSecondaria` al posto di
`parolaChiaveVoto`) · **viste condivise (fuori dal dipartimento, come nelle §26.56/§26.58)**:
`src/components/InterpelloCard.tsx`, `src/components/InterpelloDettaglioModal.tsx`, `src/contexts/app/useInterpelliFeed.ts` (commenti: porta d'ingresso primaria e voto a due livelli, nessun jolly in percentuale) · **guardie**:
`scripts/test-scoring-due-livelli.ts` (**nuova**), `scripts/test-modali-radar.ts`,
`scripts/test-compatibilita-graduata.ts`, `scripts/test-compatibilita-punteggio.ts`, `package.json`
(`test:scoring` al posto di `test:override`); **rimosso** `scripts/test-override-modale3.ts` ·
**documentazione**: `docs/SYSTEM_HANDOVER.md` (questa §26.63 + mappa moduli + note di superamento sulle
§26.56/§26.57/§26.58/§26.60), `docs/DEPARTMENT_MAP.md` (riga di changelog §26.63 + marcatura di riordino/superamento sulle righe §26.56, §26.57, §26.58 e §26.60),
`comunicazione/04_canali_regionali/checklist_regionali.md` (nuova **§6 «Il punteggio ha DUE livelli (§26.63)»** in coda: porta d'ingresso primaria, grado ponderato con la sfumatura dichiarata, nessuna promozione da parola chiave, «perché è mostrato» + override ritirato; **§5** arricchita con `test:scoring`/`test:modali`/`test:compatibilita:graduata`; **§4** riscritta sul falso positivo con la pertinenza primaria).
**Non toccati**: `src/departments/**`, `src/modules/**`, la pipeline di consegna (`src/lib/notifier.ts`,
`src/lib/digest.ts`, `invia-*`), il database.

### 26.64 Modalità 3 — JOLLY SEMANTICO asimmetrico: il match pieno apre e pavimenta, il parziale sfuma, l'assenza non toglie nulla (06/10/2026)

**Perché.** La §26.63 aveva ricondotto la Modalità 3 («In cosa puoi lavorare oltre la classe») a una
mera **sfumatura**: una competenza trovata aggiungeva al massimo `CAP_COMPETENZE` punti a un voto già
deciso dalle preferenze. Ma se una competenza è nominata **per intero** nell'avviso, l'interesse
dichiarato dall'utente è un **fatto**, non una sfumatura: non può valere zero. Il jolly diventa
quindi **ASIMMETRICO**: verso l'alto è un acceleratore (può **aprire** la bacheca e **pavimentare** il
voto), verso il basso non toglie nulla. Nessuna soglia, nessun filtro, nessuna fonte nuova: cambia il
**significato** di ciò che la §26.63 già misura.

**Una sola MISURA, due decisioni.** Il grado del match resta quello di `punteggioCompetenze.ts`
(§26.63 — `esatta` **25** · `vicina` **20** · `riconducibile` **10**); il nuovo modulo
`src/lib/jollySemantico.ts` **non rilegge il testo** (invariante verificato: niente `areeDi`,
`areeInComune`, `ponteTraAree`, `tokenCompetenza`, `paroleNelTitolo`): interpreta la rilevazione già
fatta. Un solo misuratore, due decisioni.

| Fascia del match | Quando | Cosa fa il jolly |
|---|---|---|
| **PIENO** | grado `esatta` (tutti i token significativi della competenza compaiono nell'avviso) | **pavimento d'eccellenza** `PUNTEGGIO_JOLLY_PIENO` = **90** dentro le proprie province · **inclusione d'ufficio** `PUNTEGGIO_JOLLY_OLTRE_RAGGIO` = **60** oltre il raggio dei 60 km |
| **PARZIALE** | grado `vicina` (20) o `riconducibile` (10) | **bonus** entro `BONUS_JOLLY_PARZIALE` = **15** (più stretto della §26.63): **sfuma** un voto già agganciato, **non apre** e **non scavalca** l'esclusione geografica |
| **ASSENTE** | nessuna competenza trovata (0 punti) | **zero punti e zero penalizzazioni**: il voto resta esattamente quello delle preferenze primarie |

**Come si applica (`punteggioConJolly`, una sola espressione).** PIENO **dentro** le proprie province →
`max(voto, 90)`: **mai una decurtazione** (un match pieno non declassa ciò che le preferenze hanno già
premiato). PIENO **oltre** il raggio → il voto **è** `60`: l'inclusione d'ufficio non si presenta come
un 100% a chi ha l'avviso a 200 km — **la distanza resta dichiarata nel numero**. PARZIALE →
`min(voto, base + 15)`. ASSENTE → voto **intatto**.

**Le tre SOSPENSIONI (lì vale la §26.63, il jolly tace).** `forzata` (scuola preferita in whitelist,
§26.62): l'inclusione d'ufficio è già della Modalità 5 e il voto resta quello dei due livelli
primari; `tettoMotore` (profilo **senza classi**): il verdetto `PUNTEGGIO_MATCH_SECONDARIO` (25) resta
il tetto e la sfumatura resta dichiarata; `sostegno` (pavimento `PUNTEGGIO_EXTRA_SOSTEGNO` = 60,
§26.45): il pavimento del suggerimento EXTRA non si sconta con un secondo pavimento.

**La porta d'ingresso (§26.63 · §26.64).** `bachecaInterpelli.ts` valuta **una volta** e usa il
verdetto: un match **PIENO** è una **conferma di pertinenza** e apre la bacheca anche fuori dalle
proprie province (`classeVicina(profilo, avviso) || jollyPieno`); un match **PARZIALE** **no**: sfuma
un voto che le preferenze hanno già deciso e **non crea l'opportunità**.

**Cosa vede l'utente.** Nuova etichetta `ETICHETTA_JOLLY_SEMANTICO` = «Interesse pieno» e tooltip
`descrizioneJollySemantico(competenza, punteggio)` in `src/lib/compatibilita.ts`; card e modale la
mostrano **al posto** del badge del livello secondario quando parla il jolly
(`secondarioDaDichiarare`: PIENO → `null`, PARZIALE → il **bonus davvero applicato**, ASSENTE → la
sfumatura classica della §26.63). Il campo di vetrina `Interpello.jollySemantico` viaggia sulla riga
di bacheca: **non** è persistito su database e **non** entra nelle consegne.

**Invarianti verificati.** `PUNTEGGIO_JOLLY_PIENO` (90) > soglia verde (80); `BONUS_JOLLY_PARZIALE`
(15) < `CAP_COMPETENZE` (25); `PUNTEGGIO_JOLLY_OLTRE_RAGGIO` (60) = `PUNTEGGIO_EXTRA_SOSTEGNO`;
asimmetria (**il jolly non abbassa mai** un punteggio: assenza = voto intatto); una sola misura, due
decisioni; **consegna strict**: `notifier.ts` e `digest.ts` non vedono il jolly.

**Verifiche (06/10/2026, da `project/`).** `npm run test:jolly` → ✅ (sezioni 1–7: tre fasce,
sospensioni, asimmetria di `punteggioConJolly`, `secondarioDaDichiarare`, cablaggio
`valutaCompatibilita`, invarianti, catena). `npm test` → ✅ catena verde. `npm run typecheck` → 0
errori. `npm run test:architettura` → ✅ 604 file, 141 violazioni = baseline congelata (nessuna
nuova; `E-DIM` 300 / `W-DIM` 250 rispettati: `test-jolly-semantico.ts` 243 righe, gli altri due
guardati 249). `npm run lint` sui file toccati → 0 errori. `npm run build` → ✅.

**File toccati.** Nuovo: `src/lib/jollySemantico.ts`, `scripts/test-jolly-semantico.ts`.
Modificati: `src/lib/compatibilita.ts` (etichetta + `descrizioneJollySemantico`),
`src/lib/compatibilitaGraduata.ts` (wiring di `valutaCompatibilita`),
`src/lib/bachecaInterpelli.ts` (porta d'ingresso e campo di vetrina),
`src/data/interpelli.ts` (`Interpello.jollySemantico`), `src/components/InterpelloCard.tsx` e
`src/components/InterpelloDettaglioModal.tsx` (badge), `scripts/test-compatibilita-graduata.ts` e
`scripts/test-scoring-due-livelli.ts` (allineamento asserzioni), `package.json` (script `test:jolly` +
catena), `docs/**`, `comunicazione/04_canali_regionali/checklist_regionali.md`.

**Non toccati.** Nessun dipartimento (`src/departments/**`), nessun modulo (`src/modules/**`),
pipeline di consegna (email/Telegram), database/migrazioni.

**Nota di sessione (06/10/2026).** Il jolly semantico completa la §26.63 senza contraddirla: la
sfumatura resta il pavimento di sicurezza del livello secondario, il jolly è il suo **ramo
asimmetrico**. Restano fuori perimetro (riportati come debito) eventuali ritocchi al copy delle email
e l'estensione del jolly alle Modalità 1/2, che non ne hanno bisogno.

### 26.65 Il feed è fatto di AVVISI: il contorno non entra — bacheca, suggerimenti scuola e scadenze oneste (06/10/2026)

**Perché.** Tre difetti sulla stessa catena, tutti di ONESTÀ della vetrina. (1) L'ingestione legge la PAGINA intera: accanto agli avvisi finiva in `interpelli` anche il contenuto di CONTORNO — voci di menu («Presentazione», «AREE TEMATICHE», «Calendario scolastico»), titoli di sezione, indici di classi di concorso («A041 | B017»), numeri di protocollo. La bacheca li mostrava come **opportunità** con punteggi piatti (nessuna classe, nessun istituto presentabile → il voto restava schiacciato) e il campo scuola delle Preferenze li **proponeva** fra i suggerimenti. (2) Le righe che la fonte non data stampavano `Invalid Date` (reso in maiuscolo) nell'intestazione della card: una bugia, non un dato. (3) Il campo «Scuole preferite / escluse» mescolava scuole, province e titoli in un'unica tendina, senza un modo per restringere la ricerca.

**Il giudizio unico — `src/lib/qualitaAvviso.ts` (puro, 153 righe).** `motivoRigaNonOpportunita(riga)` risponde per UNA riga: `null` = è un avviso di lavoro e resta; altrimenti il motivo, e sono **tre**:

| Motivo | Quando | Cosa dichiara |
|---|---|---|
| `titolo-dump-di-codici` | il titolo è fatto SOLO di sigle («A028 \| AAAA», «EEEE \| ADEE»): ogni token è un codice | è un indice/tabella: non c'è una parola da leggere |
| `indice-di-codici` | due o più voci separate da `\|` che iniziano con una sigla **forte** (una cifra o ≥ 3 lettere): «A042 \| ADAA \| A028 \| Primaria Lingua Inglese» | è la tabella delle classi aperte: il codice c'è, l'avviso no |
| `nessuna-traccia-di-opportunita` | nessuna parola operativa, nessuna classe riconosciuta, nessun istituto **presentabile** | voce di menu, titolo di sezione o atto senza contenuto |

**L'ordine è la regola:** dump → **parola operativa** (`dichiaraOpportunita`, finestra su titolo + materia: «interpell-», «supplenz-», «band-», «selezion-», …) → indice di codici → classi → istituto. La parola operativa decide PRIMA dell'indice, così «Comunicazione | I.C. Manzoni | A042» resta un avviso; il gate delle sigle pretende un codice **forte** (`\d` o almeno tre lettere), così le iniziali di «I.C.» non creano un falso indice. Il giudizio è **generoso**: basta UN segnale (una parola, una classe, un nome d'istituto) perché la riga resti — una riga genuina non si scarta per un dettaglio che non capiamo (§26.47); si scarta ciò che non è nemmeno un testo.

**Un solo giudizio, due consumatori.** (a) **Bacheca**: `bachecaInterpelli.ts` applica `motivoRigaNonOpportunitaAvviso(i)` al **passo 1-bis**, prima di ogni punteggio, e conta gli scarti in `righeNonOpportunita` (nuovo campo di `EsitoBacheca`): lo scarto è **dichiarato**, mai silenzioso. Il segnale «istituto» vale solo se il nome è **presentabile** (`nomeIstitutoPresentabile`, §26.59): la colonna dell'istituto delle fonti contiene anche titoli di sezione e dump di codici, e una stringa grezza non deve tenere in vita una riga di contorno. (b) **Manutenzione**: `scripts/pulisci-non-opportunita.ts` (`npm run dati:pulisci-contorno`) ripulisce il database con lo STESSO giudizio, così vetrina e pulizia non possono divergere.

**Scadenza onesta.** `etichettaScadenzaAvviso(iso, pubblicato)` in `src/lib/alertInterpello.ts`: la scadenza vera quando c'è («15 set 2026»), altrimenti la **pubblicazione dichiarata** («Pubblicato 12 set 2026»), altrimenti «Senza scadenza dichiarata». La card della bacheca (`ElencoOpportunita.tsx`) non costruisce più la data con `new Date(...).toLocaleDateString`: è la stessa regola della tavola «Radar Live» (`rigaBoardDati.ottieniUrgenzaOAnzianita`).

**L'ordine si LEGGE dal titolo.** `mapInterpelloDBToInterpello` (`matchingEngine.ts`) sceglieva `secondaria2` come **default fisso** per ogni riga senza codice classe: un salto di ordine per tutti e punteggi piatti in Modalità 1. Ora `inferisciOrdineDaTesto(title)` (in `alertInterpello.ts`: ATA/DSGA, infanzia, primaria, secondaria I e II) precede il default, che resta solo come ultima rete.

**Campo scuola: DUE campi, suggerimenti veri.** Il pannello delle Preferenze mostra prima il selettore **Provincia** (le province con istituti reali, `provinceSuggerite`) e poi il campo **Scuola**: scegliendo la provincia i suggerimenti si restringono **istantaneamente** (`cercaScuole`, sottostringa normalizzata) — prima la provincia, poi la scuola, come in un input di indirizzi. Il componente `CampoScuola.tsx` ha la sua tendina (`useId`), quindi le due liste (preferite / escluse) non si scambiano i suggerimenti; il valore salvato resta il **nome** dell'istituto, la sigla di provincia è solo l'etichetta del suggerimento. I suggerimenti passano dal gate `scuolePresentabili(avvisi)` (nuovo `src/lib/scuolePresentabili.ts`): mai un titolo di sezione, mai una materia, mai un dump di codici; la coda procedurale viene tagliata («IC ALBIGNASEGO Interpello per copertura posti» → «IC ALBIGNASEGO»). L'ambito provinciale e la dichiarazione della forzatura restano quelli della §26.62, e senza province scelte i suggerimenti sono vuoti.

**Un modulo ESTRATTO, non una copia.** `scuolePresentabili.ts` (70 righe) è nato da `filtriScuole.ts`, che scendeva a 271 righe e scende a **223** (dentro la soglia di manutenzione di `MODULAR_ARCHITECTURE.md`): nel modulo dedicato stanno `scuolePresentabili` e `provinceSuggerite`, nel vecchio restano le LISTE (§26.56), l'ambito (§26.62) e la ricerca (`cercaScuole`), con `siglaProvincia` ora `export` per la condivisione. **Nessuna copia**: il test verifica che il gate dei nomi non risalga in `filtriScuole.ts`.

**Verifiche (06/10/2026, da `project/`).** `npm run test:qualita-avviso` e `npm run test:filtri-scuole` → ✅ (compreso il blocco «Suggerimenti VERI»: voci di menu fuori, coda procedurale tagliata, una sola copia del gate). `npm test` → ✅ catena verde. `npm run typecheck` → 0 errori. `npm run test:architettura` → ✅ 610 file, 141 violazioni = baseline congelata (nessuna nuova; 250/300 rispettati: `scuolePresentabili.ts` 70, `filtriScuole.ts` 223, `test-filtri-scuole.ts` 225). `npm run lint` sui file toccati → 0 errori. `npm run build` → ✅.

**File toccati.** Nuovi: `src/lib/qualitaAvviso.ts`, `src/lib/scuolePresentabili.ts`, `src/departments/radar/preferenze/components/CampoScuola.tsx` (spostato da `preferenze/`, come le altre sottocartelle del Radar), `scripts/pulisci-non-opportunita.ts`, `scripts/test-qualita-avviso.ts`. Modificati: `src/lib/bachecaInterpelli.ts` (passo 1-bis + conto), `src/lib/alertInterpello.ts` (`etichettaScadenzaAvviso`, `inferisciOrdineDaTesto`), `src/lib/matchingEngine.ts` (ordine dal titolo), `src/lib/filtriScuole.ts` (estrazione + `siglaProvincia`), `src/pages/dashboard/components/ElencoOpportunita.tsx` (scadenza onesta — **vista condivisa**, come le §26.56/26.58/26.63), dipartimento **Radar** (`PreferenzeRadar.tsx`, `preferenze/PannelloFiltriScuole.tsx`, `preferenze/components/CampoScuola.tsx`), `package.json` (script `test:qualita-avviso`, `dati:pulisci-contorno`, catena di `npm test`), `docs/**`.

**Non toccati.** Gli altri dipartimenti (`notizie`, `cfu`, `modulistica`, …), `src/modules/**`, la pipeline di consegna (email/Telegram), il database e le migrazioni.

**Bonifica eseguita sul database (06/10/2026).** `npm run dati:pulisci-contorno --apply` → **541 righe di contorno rimosse** su 714 (383 `titolo-dump-di-codici`, 72 `indice-di-codici`, 86 `nessuna-traccia-di-opportunita`); riverifica in dry-run: `interpelli in tabella: 173 · righe di contorno: 0`. Prima di cancellare, le righe scartate sono state guardate a mano: le 86 «nessuna traccia» sono voci di menu, titoli di sezione e numeri di protocollo («Aree tematiche», «Presentazione», «AOOUSPVC.REGISTRO UFFICIALE(U).0006133…»); le 22 che portano un'email sono voci di menu dei siti USR/USP (l'indirizzo è quello generico dell'ufficio nel footer, non una candidatura); i dump sono liste di codici. **Nessun avviso vero è stato scartato.** Effetto collaterale dichiarato: 63 post sui canali Telegram e 10 notifiche, già inviati prima di questo fix, puntano a righe ora rimosse e il loro link atterra su `AvvisoAssente` — la pagina lo dice con garbo, senza rimbalzare sulla Home (§26.27). Nessun vincolo violato: i ledger `notifications_log` e `channel_posts_log` usano `interpello_hash`, non chiavi esterne. La bonifica è una **fotografia**, non un argine: le fonti dichiarate «interpelli» possono riportare in tabella il contorno ai run successivi, e a tenerlo fuori dalla vetrina resta la regola di questo paragrafo. Dopo la pulizia `npm run test:opportunita` → ✅ e `npm run admin:health` → 2 anomalie già note e fuori perimetro (dispatch senza notifiche nelle ultime 48h, con ultimo invio il 28/09; sezione Notizie ferma al 21/09).

**Nota di sessione (06/10/2026).** Il contorno del feed non è più un'opportunità: bacheca, suggerimenti e pulizia del database leggono lo STESSO giudizio puro, e una data che non esiste non si stampa più. La bonifica del database è stata eseguita (541 righe rimosse, 173 opportunità reali in tabella) e si ripete con `npm run dati:pulisci-contorno --apply`; si lancia a parte, mai dentro i test di prodotto.

### 26.66 «Dispatch Radar FERMO»: il monitor misurava le righe grezze, il digest non consegnava (06/10/2026)

**Sintomo.** `npm run admin:health` usciva con exit 1 e un allarme `critical` ripetuto ogni giorno: «Dispatch Radar FERMO: dati nuovi ma nessuna notifica» — 17 interpelli nelle ultime 48h, 0 notifiche, ultimo invio il 28/09.

**Diagnosi (misurata, non dedotta).**

- **La pipeline gira.** `scraper_runs`: run il 05/10 e il 06/10, `esito=warn`, `errori=0`, `upsert_ok=true`; i canali Telegram sono **vivi**: 11 pubblicazioni in `channel_posts_log` nella finestra (ultima il 06/10 alle 13:57 UTC) e 177 in totale.
- **Il gate di qualità spiega lo zero, non una rottura.** Dei 17 avvisi entrati **nessuno** ha un recapito di candidatura (`contact_email` nullo, `school_code` nullo, `stato_arricchimento=parziale`): `motivoAvvisoNonInviabile` risponde «recapito di candidatura mancante» per **17/17**. Il dispatch personale è gated (link diretto + recapito — §26.65 / `comunicazione/**`), quindi 0 notifiche era il risultato **atteso**. Undici dei 17 sono contorno (§26.65) riportato in tabella dalle fonti USR FVG: la bonifica è una fotografia, non un argine.
- **Chi avrebbe materiale lo consegnerebbe.** L'unico profilo con Radar attivo è `bartoloansaldi@gmail.com` (province AT/AL/CN/TO): `npx tsx scripts/admin-dispatch-user.ts <email>` in **DRY-RUN** → 2 voci pronte, 0 errori, exit 0. Motore di matching, ledger e render funzionano; l'ultima consegna **reale** è del 28/09 16:14 (2 avvisi Piemonte in `notifications_log`) e **18 avvisi di quella stessa ondata sono ancora pendenti**.
- **Il TRIGGER non è mai scattato.** Nel ledger locale committato dai workflow (`.scuoleradar/notifiche-ledger.json`) **non esiste alcuna chiave `digest|<data>`** — `chiaveDigestGiorno` si registra solo dopo un invio riuscito (`notifier.ts`) — e non c'è alcuna voce `notifications_log` a ~17:00 italiane: il **Digest giornaliero** non ha mai consegnato. Nello stesso quadro la sezione Notizie è ferma dal 21/09 e `admin_telegram_alerts` è **vuota** (nessun alert ha mai raggiunto il bot admin).
- **L'allerta non poteva arrivare.** `ADMIN_ALERT_SECRET` è **assente** in `.env` e l'helper è fail-closed (`inviaAlertaAdmin` → «non configurati»): l'anomalia restava nel log locale. Le 4 chiavi (bot admin + secret) sono già documentate in `.env.example`. Probe live dell'Edge: `GET .../telegram-admin-webhook` → **405** (funzione deployata e raggiungibile), `POST` senza secret e con secret errato → **403** (fail-closed). `app_settings` non è leggibile dal service role («permission denied»): comportamento pre-esistente, non incidente su questo percorso.

**Fix — il monitor misura ciò che è consegnabile.** Tre file, un solo giudizio condiviso:
- `scripts/lib/avvisiNotificabili.ts` (nuovo, 77 righe): conta gli avvisi di una finestra con lo **stesso metro del dispatch** — `emailAvviso` → `risolviEmailUfficialeScuola` (PEO dal codice meccanografico) → `motivoAvvisoNonInviabile` — e il contorno con `motivoRigaNonOpportunitaAvviso`. `notificabili: null` = lettura fallita (mai «0»).
- `scripts/lib/saluteDispatch.ts` (nuovo, 201 righe): le letture e la costruzione di **report** e **allarmi**. `critical` **solo** se esistevano avvisi NOTIFICABILI senza notifica; `warning` motivato quando nessun avviso supera il gate (0 notifiche è atteso); `critical` se entrano avvisi e le pubblicazioni sui canali sono **0**; `warning` se le **consegne personali sono ferme** da `HEALTH_DELIVERY_STALE_DAYS` (7 giorni) — il segnale che mancava.
- `scripts/admin-health-check.ts` (97 righe, solo CLI): invia gli allarmi critical/warning, **exit 1** se ce n'è almeno uno (le voci `info` non colorano più il cron) e, quando l'invio fallisce per configurazione, stampa l'istruzione esatta su dove impostare `ADMIN_ALERT_SECRET`.

**Risultato (verificato, da `project/`).** `npx tsx scripts/admin-health-check.ts --dry` → exit 1 con: 17 nuovi · 0 notifiche · 1 utente attivo · **0 notificabili su 17** (`recapito di candidatura mancante: 17`) · **11 pubblicazioni sui canali** · **8 giorni senza consegne personali**. Il falso `critical` è sparito; restano tre warning azionabili (recapiti delle fonti, trigger del digest, Notizie).

**Verifiche (exit code).** `npm run typecheck` → 0 · `tsc --noEmit` sui tre script → 0 · `npm run test:notifier-dry` → 0 · `npm run admin:health` (reale) → 1 (tre warning; allerta non spedita per secret mancante, con istruzione stampata) · `npx tsx scripts/admin-dispatch-user.ts <email>` (DRY-RUN) → 0 (2 voci pronte) · `npm run db:verifica` → 0 (ledger e RPC quota ok) · probe Edge → 405/403/403 · `npm run test:architettura` → 0 (612 file, 141 violazioni = baseline; nuovi file 97/201/77 righe) · `npm run lint` sui file toccati → 0 · `npm test` → 0 · `npm run build` → 0.

**Azione dell'operatore (fuori dal codice).** (1) **Secrets GitHub**: impostare `ADMIN_ALERT_SECRET` (stesso valore dei secrets Supabase dell'Edge `telegram-admin-webhook`), altrimenti nessun alert parte dalla CI. (2) **Actions**: verificare che il workflow **Digest giornaliero** (`0 15,16 * * 1-5`) risulti eseguito e verde — dal ledger non risulta alcuna consegna del digest, quindi il sospetto è il cron (workflow disabilitato, minuti esauriti, run fallito prima dell'invio). (3) **Recapiti**: un avviso diventa notificabile solo con un'email o un meccanografico risolvibile; la copertura si alza con l'arricchimento anagrafico (file `SCUANAGRAFE`, non versionati, assenti in CI).

**File toccati.** Nuovi: `scripts/lib/saluteDispatch.ts`, `scripts/lib/avvisiNotificabili.ts`. Riscritto: `scripts/admin-health-check.ts`. Docs: `docs/SYSTEM_HANDOVER.md`, `docs/DEPARTMENT_MAP.md`. Nessun altro dipartimento toccato, nessuna modifica a database/migrazioni, al digest o al gate di qualità.








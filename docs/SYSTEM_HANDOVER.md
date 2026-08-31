# ScuoleRadar.it — Full System Handover Report

> **Scopo**: documento di consegna completo del sistema. Ogni componente, flusso dati,
> Edge Function, scraper, autenticazione, drip notifiche e architettura file è documentato
> per consentire a un nuovo sviluppatore di prendere in mano il progetto senza gap.
>
> **Repo**: `ScuoleRadar_app/project` · **Dominio**: https://scuoleradar.it
> **Progetto Supabase**: `gwdmsgsshvdnfrplbjiv` · **Deploy**: Vercel (production = branch `main`)
> **Ultimo aggiornamento**: 2026-08-31

---

## 1. Overview

ScuoleRadar.it è una piattaforma **freemium** per docenti italiani: monitora interpelli,
supplenze, PNRR/PON e opportunità (il **Radar Opportunità**), offre modulistica scolastica
(l'**Archivista Capo**), un **Calcolatore CFU**, un **CV Builder**, un blog notizie ufficiali
(dipartimento **Notizie**) e un **Assistente Sindacalista** AI.

- **Modello freemium**: account Base gratuito (3 notifiche/anno scolastico + strumenti base),
  abbonamento **PRO** (49€/anno, notifiche illimitate, PDF puliti) e **crediti a consumo**
  (1€/credito). Beta tester: PRO a vita in omaggio.
- **Principio architetturale**: dominio `src/modules/modulistica` e `src/departments/notizie`
  **isolati** (nessuna dipendenza dagli stati interni di altri dipartimenti); integrazione
  solo via router e primitive UI condivise.

### Tech stack

| Layer | Tecnologia |
|---|---|
| Frontend | React 18.3 · TypeScript 5.5 · Vite 5.4 (SPA, porta fissa **5174**) |
| Routing | react-router-dom 6.30 (`BrowserRouter`) |
| Stile | Tailwind CSS 3.4 con token custom (vedi §11) · lucide-react icone |
| Backend | Supabase (Auth, Postgres, Edge Functions Deno) |
| Notifiche | Resend (email) + Bot Telegram `@ScuoleRadar_bot` |
| Pagamenti | Stripe (Checkout + Webhook) |
| AI | DeepSeek (`deepseek-chat`) per la generazione modulistica |
| Scraping | Node (`axios` + `cheerio`), orchestrato da GitHub Actions |
| Deploy | Vercel (SPA rewrite via `vercel.json`) |

---

## 2. Architettura dei file

```
project/
├─ index.html                  # Entry SPA (title/meta "Radar Opportunità")
├─ package.json                # Script + dipendenze (vedi §13)
├─ vite.config.ts              # Porta 5174 strictPort, alias @ → src
├─ tailwind.config.js          # Token palette ufficiale (§11)
├─ vercel.json                 # SPA rewrite /(.*) → /index.html
├─ tsconfig.app.json           # Frontend (esclude scraper/notizie-node/lib-node)
├─ tsconfig.scraper.json       # Pipeline interpelli (src/scraper + src/lib/*)
├─ tsconfig.notizie.json       # Pipeline notizie (departments/notizie/services)
├─ LOCKED_MODULES.md           # Registro moduli BLOCCATI (AuthModal, ChiSiamo, Prezzi)
├─ .env.example                # Template variabili d'ambiente
├─ .github/workflows/
│  ├─ scraper.yml              # Scraper Interpelli (Lun-Ven 07/12/15 UTC)
│  └─ scrape-notizie.yml       # Scraper Notizie (ogni giorno 06:00 UTC)
├─ docs/                       # BLOG_EDITORIAL_GUIDELINES, PDF_DESIGN_SYSTEM, SYSTEM_HANDOVER
├─ scripts/                    # Test/utility Node (test-pdf*, _validate-modulistica, …)
├─ supabase/
│  ├─ functions/               # Edge Functions Deno (8 funzioni, §8.3)
│  └─ migrations/              # 24 migration SQL (ordine cronologico, §8.1)
└─ src/
   ├─ App.tsx                  # Provider + Router + modali globali
   ├─ main.tsx                 # Entry React
   ├─ index.css                # @tailwind + componenti CSS (.input, …)
   ├─ components/              # UI condivisa (Header, Modal, AuthModal, CfuTool, CvTool, …)
   ├─ contexts/AppContext.tsx  # Stato centrale dell'app (§4)
   ├─ hooks/                   # useLocalStorage, useReferral, useGoogleOneTap
   ├─ lib/                     # supabase, resend, telegram, notifier, matchingEngine, pricing, promo
   ├─ data/                    # moduli, interpelli, classiConcorso, province, ordiniMaterie, servizi
   ├─ modules/modulistica/     # Dipartimento Modulistica (isolato)
   ├─ departments/notizie/     # Dipartimento Notizie (isolato)
   ├─ pages/                   # 20 pagine/route (§3)
   ├─ scraper/                 # Scraper interpelli (index.ts + parser.ts)
   ├─ services/healthCheck.ts  # Diagnostica system health
   └─ types/google-one-tap.d.ts
```

---

## 3. Routing e pagine (`src/App.tsx`)

| Route | Pagina | Accesso |
|---|---|---|
| `/` | LandingPage | Pubblico |
| `/prezzi` | PrezziPage | Pubblico |
| `/chi-siamo` | ChiSiamoPage 🔒 | Pubblico |
| `/faq` | FAQPage | Pubblico |
| `/servizi`, `/servizi/:slug` | ServiziPage / ServizioPage | Pubblico |
| `/notizie`, `/notizie/:id` | NotiziePage / NotizieDettaglioPage | Pubblico |
| `/contatti` | ContattiPage | Pubblico |
| `/auth/callback` | AuthCallback | Callback OAuth |
| `/onboarding` | OnboardingPage | `RequireAuth` |
| `/dashboard` → redirect `/dashboard/radar` | DashboardLayout | Vetrina freemium (anche senza login) |
| `/dashboard/radar` | DashboardPage (Radar Opportunità) | Vetrina |
| `/dashboard/cv` | CvPage (CV Builder) | Vetrina |
| `/dashboard/cfu` | CfuPage (Calcolatore CFU) | Vetrina |
| `/dashboard/assistente-ai` | AssistenteAIPage | Vetrina |
| `/dashboard/moduli` | ModuliPage (Modulistica) | Vetrina |
| `/dashboard/purefocus` | PureFocusPage | Vetrina |
| `/dashboard/profilo` | ProfiloPage | `RequireAuth` |
| `/dashboard/invita` | InvitaPage | `RequireAuth` |
| `/admin` | AdminPage | `RequireAuth` |

**Modali globali** montati in `App.tsx`: `AuthModal`, `VetrinaModal`, `GoogleOneTap`,
`RadarWizardModal`, `DevToolbar` (solo DEV). `ScrollToTop` resetta lo scroll a ogni rotta.
`RequireAuth` non fa redirect: apre la **AuthModal** e mostra una card "Area riservata".

---

## 4. Stato centrale — `src/contexts/AppContext.tsx`

Provider unico (AppProvider) con stato condiviso e **fallback demo** (se Supabase non è
configurato `supabase === null`, tutto funziona su localStorage con dati mock):

- **User**: `{ nome, cognome, genere?, email, password }` + `supabaseUserId`, `avatarUrl`
- **Preferenze** (Radar): `ordini`, `classiCodici`, `materieId`, `materieCustom`,
  `provinceCodici`, `telegramUsername`, `telegramChatId`, `emailNotifica`, `onboarded`,
  `favoriteSchools`, `ignoredSchools`
- **Piano/freemium**: `abbonato`, `crediti` (a consumo), `notificheUsate`
  (`LIMITE_NOTIFICHE_PROVA = 3` per anno scolastico)
- **Esami CFU**: `esami[]`
- **Feed Radar**: `interpelliFiltrati` (filtro client su provincia/ordine/classe/materia/
  scuole ignorate) · `fontiInterpelli` (da Supabase `interpelli` o mock `data/interpelli.ts`)
- **Radar wizard**: `radarWizardOpen/openRadarWizard/closeRadarWizard`
- **Vetrina freemium**: `vetrinaAperta/vetrinaSezione/openVetrina/closeVetrina`
- **Auth**: `register/login/logout` (demo) · `loginConGoogle` (Supabase OAuth/OneTap) ·
  `authModalOpen/authModalMode/authModalCtx/openAuthModal/closeAuthModal`
- **Checkout**: `avviaCheckout(plan, promo?, quantita?)` → Edge Function `checkout`
- **Crediti**: `consumaCredito` (RPC `consuma_credito_utente`), `incrementaNotifica`
- **Dev**: `simulaStato('guest'|'base'|'pro')` e `resettaTutto` (DevToolbar)

**Mappa origine dati**: `origineDati: 'mock' | 'supabase'` (fallback automatico se il
fetch della tabella `interpelli` fallisce).

---

## 5. Flusso di autenticazione

1. **AuthModal** (`src/components/AuthModal.tsx`, 🔒 bloccato): login/registrazione.
   - **Google OAuth**: `loginConGoogle()` → `supabase.auth.signInWithOAuth({ provider: 'google' })`
     → redirect `/auth/callback` (`AuthCallback.tsx`) → sessione stabilita.
   - **Email/password**: in modalità demo (Supabase assente) `register/login` usano localStorage;
     con Supabase usa `signUp`/`signInWithPassword`.
   - **Google One Tap** (`GoogleOneTap.tsx` + `hooks/useGoogleOneTap.ts`): prompt GSI sulle
     pagine d'ingresso (`/`, `/prezzi`, `/chi-siamo`, `/servizi`, `/notizie`); ID token →
     `supabase.auth.signInWithIdToken`.
2. **Trigger DB** `trg_auth_users_step1_welcome` su `auth.users` (migration
   `20260831030000_add_step5_scheduling.sql`): inserisce il profilo in `public.profiles`
   (piano `base` di default) e invia l'**Email 1 (welcome)** tramite Edge Function
   `send-notification` (`tipo: 'step1'`). Vale anche per gli utenti One Tap.
3. **Onboarding** (`OnboardingPage.tsx`): compilazione preferenze Radar (ordini, classi,
   materie, province), collegamento Telegram (deeplink `t.me/ScuoleRadar_bot?start=<user_id>`,
   il webhook collega il `telegram_chat_id`), email di notifica. Completa il profilo.
4. **Profilo** (`ProfiloPage.tsx`): modifica preferenze, collegamento Telegram, gestione account.
5. **Logout**: `logout()` (chiude sessione Supabase + pulisce stato locale).


---

## 6. Radar Opportunità (ex "Radar Interpelli")

### 6.1 Dati
- **`src/data/interpelli.ts`** — tipo `Interpello` + feed mock (fallback demo):
  `{ id, titolo, istituto, provinciaCodice/Nome, classeCodice, classiCodes?, ordine,
  dataScadenza, descrizione, linkFonte, compatibilita }`.
- **`src/data/classiConcorso.ts`** — `ClasseConcorso[]`: `{ codice (A-XX/ADEE…), denominazione,
  ordine, materie[], requisitiCfu[] }` + helper `classeByCodice`.
- **`src/data/ordiniMaterie.ts`** — `OrdineScuola` (`infanzia|primaria|secondaria1|secondaria2`).
- **`src/data/province.ts`** — sigle + nomi province italiane.

### 6.2 Matching Engine (`src/lib/matchingEngine.ts`)
Modulo puro (client Supabase passato come parametro → testabile nel frontend e nello scraper):
- `searchInterpelli(client, { province?, classi?, limit? })` → query tabella `interpelli`
  con `in('province')` + `overlaps('class_codes', classi)` (almeno una classe in comune),
  ordinate per scadenza.
- `getFeedInterpelli(...)` → righe mappate nel tipo `Interpello`.
- `mapInterpelloDBToInterpello(row)` → conversione `interpelli` → `Interpello`.
- `findUtentiCompatibili(client, { province, classi })` → utenti `profiles` con email valida
  **o** Telegram collegato, provincia in comune e almeno una classe in comune. Restituisce
  `UtenteCompatibile` con i flag `notificheBloccoInviato`/`notificheRecapInviato`.

### 6.3 UI
- `DashboardPage.tsx` (`/dashboard/radar`) — card notifiche restanti (3/anno), abbonamento,
  crediti, feed `interpelliFiltrati`, badge "Scuola Preferita", blacklist scuole.
- `SimulatorRadar.tsx` — anteprima del feed (legge `interpelli` da Supabase, fallback mock).
- `RadarWizardModal.tsx` — wizard onboarding radar a 4 passi (ordini, classi, materie,
  province) per chiunque (anche anonimo, riprende dopo il login con `sr_wizard_pending`).
- `InterpelloCard.tsx` — card singola interpello.
- `VetrinaModal.tsx` / `ServiziPaywall.tsx` — gating freemium (paywall per gli strumenti).

### 6.4 Scraper interpelli (`src/scraper/`)
Pipeline `npm run scrape` (vedi §10.1): fonti reali per provincia → parser → upsert
`interpelli` (fallback `notices`) → notifiche ai soli interpelli NUOVI.

---

## 7. Sistema di notifiche & drip (Freemium)

### 7.1 Canali
- **Email**: Resend — `src/lib/resend.ts` (solo Node, verificato da tsconfig.scraper.json).
- **Telegram**: `src/lib/telegram.ts` (bot `@ScuoleRadar_bot`, HTML parse_mode).
- **Orchestratore**: `src/lib/notifier.ts` → `notificaNuoviInterpelli()` (invio email+Telegram
  in parallelo, non lancia mai eccezioni).

### 7.2 Sequenza drip account BASE (6 email)
| # | Tipo | Quando | Dove |
|---|---|---|---|
| 1 | `welcome` | Iscrizione | Trigger DB `trg_auth_users_step1_welcome` → Edge Function `send-notification` |
| 2 | `prova1` | 1ª opportunità pertinente | Scraper → matchingEngine → `notifier` (RPC contatore `usate=1`) |
| 3 | `prova2` | 2ª opportunità pertinente | `usate=2` |
| 4 | `prova3` | 3ª e ultima opportunità | `usate=3` |
| 5 | `extra` (avviso) | 4ª opportunità, una sola volta | `usate≥3` → se `!notifiche_blocco_inviato` invia warning "prova finita, passa a PRO" |
| 6 | `recap`/`step5` (avviso finale) | 2 ore dopo l'avviso | pg_cron `step5-notifiche` (ogni minuto) → `dispatch_step5_due` → Edge Function |

- **PRO**: `welcome_pro` (attivazione) + `notifica_pro` (ogni opportunità, illimitate).
- **Contatore**: RPC atomica `incrementa_notifiche_utente` — BASE max **3 per anno
  scolastico** (reset automatico al 1° settembre); PRO sempre consentito. `SELECT … FOR UPDATE`
  previene le race condition. I flag `notifiche_blocco_inviato`/`notifiche_recap_inviato`
  e `step4_inviata_at`/`step5_inviata` guidano la sequenza post-prova.
- **Ciclo annuale**: `20260831150000_switch_rpc_notifiche_anno_scolastico.sql` — anno
  scolastico italiano (1/9–31/8), `notifiche_anno` salva l'anno di inizio.

### 7.3 Copia email/Telegram
`resend.ts`/`telegram.ts` definiscono soggetto + corpo per ogni `TipoMessaggio`
(`welcome, prova1, prova2, prova3, extra, recap, welcome_pro, notifica_pro`).
`TIPI_CON_OPPORTUNITA` = tipi che includono il blocco opportunità
(`prova1, prova2, prova3, notifica_pro`); `extra` e `recap` sono solo testuali.
`classeRilevante()` sceglie la classe in comune; `categoriaOpportunita()` deduce
PNRR/PON/POR/Bando Esperti/Interpello dal titolo.


---

## 8. Dipartimento Modulistica (`src/modules/modulistica/`)

Modulo **isolato** (tipi condivisi in `types.ts`): viste `archivio | intervista | miei`.

### 8.1 Catalogo (`src/data/moduli.ts`)
- `Modulo[]` — catalogo statico (~271 voci): `{ id, nome, categoria, macroArea, tipo, descrizione }`.
- `macroAree`: `Tutti, Sostegno & Inclusione, Supplenze e Interpelli, Burocrazia & Permessi, Candidature`.
- `MacroAreaMenu` / `EsploraArchivio` — drill-down 3×3 per sottocategorie con paginazione.
- Ricerca **live** (`RicercaArchivista.tsx`): filtra il catalogo a ogni digitazione con
  normalizzazione accent-insensitive (`\p{Diacritic}`) e punteggio di pertinenza.
- Storico download in localStorage (`scuoleradar:moduli_scaricati`) + tabella
  `user_saved_modules` (RPC/Edge `salva`/`rimuovi`/`miei`).

### 8.2 Generatore documenti (`creator/`)
- **`cacheService.ts`** — cuore del motore:
  - `cercaDocumento`, `inviaIntervista`, `generaDocumento` → Edge Function `genera-modulo`
    (DeepSeek + cache `generated_modules` a costo API zero tramite impronta SHA-256).
  - `creaDocumentoLocale(nome, { tipo, ordine })` → generazione **locale** (60 tipologie,
    template per ordine scolastico: PEI, PDP, Relazione Finale, PSP NAI, DPR 445, delega, …).
  - `trovaModuloLocale`, `registraDownloadGenerato`, `registraDownloadCatalogo`,
    `rimuoviDownload`, `elencaDownload`, `caricaDocumentoGenerato`.
- **`pdfGenerator.ts`** — `costruisciDocumento(titolo, html)` → A4 stampabile: logo, footer
  "Documento scaricato gratuitamente da ScuoleRadar.it", numerazione `Pagina X di Y`,
  indice automatico (TOC) solo >3 pagine. `calcolaLayout` (compatto/esteso),
  `stimaPagine` (formula `Math.ceil(h2Count)` per evitare pagine bianche).
  Riferimento: `docs/PDF_DESIGN_SYSTEM.md`.
- **`ArchivistaCapo.tsx`** — interfaccia "Indovina Chi?" (una domanda alla volta, niente chat
  infinita). **In fase di affinamento**: il flusso completo arriva **a Ottobre per i PRO**;
  ora il pulsante apre solo la modale teaser (`TeaserArchivistaModal.tsx`).
- **`PensieriArchivista.tsx`** — frasi brevi durante il recupero del documento.

### 8.3 Edge Function `genera-modulo`
Azioni (body JSON, JWT verificato):
- `intervista { query, risposte }` — una domanda chirurgica alla volta; quando il profilo è
  completo risponde `pronto` con l'impronta (SHA-256) e, se già in cache su
  `generated_modules`, il documento a costo zero.
- `genera { query, profilo, catalogoId? }` — genera via DeepSeek con cache.
- `ricerca { query }` — ricerca legacy nel catalogo + cache.
- `salva { module_key, module_source, title, tipo }` → `user_saved_modules`.
- `rimuovi { module_key }` · `miei` — gestione "I miei Modelli Scaricati".
- Secrets: `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL=deepseek-chat`.

### 8.4 Verifica
- `npm run test:pdf:completo` (60 tipologie), `scripts/_validate-modulistica.ts`
  (60/60 + PEI infanzia: verifica pagine e assenza di contenuti vietati, es. niente
  "172/2017" nella delega infanzia, niente discipline nel PEI infanzia).

---

## 9. Check CFU e CV Builder

### 9.1 Calcolatore CFU (`CfuTool.tsx` + `CfuPage.tsx`)
- Preset `TITOLI_STUDIO` (L-19, LM-85, LM-14, …) con esami tipici (materia, cfu, settore).
- Confronta gli esami inseriti con i `requisitiCfu` delle `ClasseConcorso` selezionate:
  verifica quali requisiti sono soddisfatti e calcola il totale CFU.
- Paywall (Base → vetrina) per l'accesso alle risposte complete.

### 9.2 CV Builder (`CvTool.tsx` + `CvPage.tsx`)
- Incolla testo → parser a sezioni (Esperienze, Formazione, Competenze, Lingue, Contatti,
  Profilo, Certificazioni, Pubblicazioni) → anteprima → download PDF.
- **Freemium**: Base = PDF con watermark "ScuoleRadar.it"; PRO = PDF pulito senza logo.

---

## 10. Dipartimento Notizie (Blog Engine)

### 10.1 Tipi e dati
- `types.ts` → `NewsArticle { id, title, category, deadline_date, summary_points[3],
  content_html, official_source_url, official_pdf_url, relevance_score, published_at }`.
- `data/notizieSeed.ts` — articoli editoriali seed.
- `data/notizieIngestite.ts` — **file GENERATO** dall'ingestione (accumulo, dedupe per id).

### 10.2 Pipeline di ingestione (`src/departments/notizie/services/`)
1. **`newsFetcher.ts`** (Node-only): scarica fonti ufficiali — MIM (feed/pagina notizie) e
   **Gazzetta Ufficiale** (feed istruzione). Log HTTP esplicito per ogni fonte (nessun
   silent-fail). `verificaUrlUfficiale` = STRICT URL INTEGRITY (HEAD→GET, solo 200/3xx).
2. **`relevanceEngine.ts`** (modulo PURO): regole editoriali STRETTE —
   - `PAROLE_RIFIUTA`: interviste, comunicati, campagne, webinar… → ZERO rumore;
   - `PAROLE_ACCETTA`: decreti, ordinanze, note, bandi, scadenze operative;
   - `estraiDeadline` (date italiane, ordinali, anno implicito);
   - **`MAX_ARTICOLI_SETTIMANA = 3`** (finestra mobile 7 giorni) → `limitaArticoliSettimanali`;
   - `generaArticoloEditoriale` (acronimi spiegati, link reali validati, brand ScuoleRadar).
3. **`ingestNotizie.ts`** (CLI): `npm run scrape:notizie` (scrittura file) / `--dry-run`.
   Esiti: `✓ HTTP 200 - 0 new posts criteria matched` (nessun commit) oppure `✗ HTTP FAIL`.
4. **`newsService.ts`** (frontend): unisce seed + ingestite (dedup per id); se entrambi vuoti
   usa il fallback realistico singolo (`newsFallback`).

### 10.3 UI e SEO
- `NotizieHero`, `NotizieGrid`, `NotizieDettaglio`, `SeoMeta` (og: tags + JSON-LD NewsArticle).
- Pagine `/notizie` e `/notizie/:id`.

### 10.4 Automazione
GitHub Action `scrape-notizie.yml` — **ogni giorno 06:00 UTC**: `npm ci` →
`scrape:notizie:check` → `npm run scrape:notizie` → se ci sono nuove notizie, committa
`notizieIngestite.ts` (`[skip ci]`) → push → deploy Vercel automatico. **Tetto: massimo
3 articoli a settimana**; se non ci sono provvedimenti vincolanti si pubblicano 0 articoli.


---

## 11. Integrazione Supabase

### 11.1 Tabelle (migrations in `supabase/migrations/`)
| Tabella | Scopo | Colonne principali |
|---|---|---|
| `profiles` | Profilo utente (1:1 con `auth.users`) | `id, email, email_notifica, nome, cognome, genere, piano('base'|'pro'), crediti, ordini_scuola, province_interesse, classi_concorso, materie_id, materie_custom, favorite_schools, ignored_schools, onboarded, telegram_username, telegram_chat_id, referral_code, stripe_customer_id, stripe_subscription_id, abbonamento_scade_il, notifiche_usate, notifiche_anno, notifiche_mese, notifiche_blocco_inviato, notifiche_recap_inviato, step4_inviata_at, step5_inviata, moduli_scaricati, master_version, template_id, is_beta_tester, beta_rinnovo_email_inviata, scadenza_avviso_stadio` |
| `interpelli` | Interpelli/opportunità scraped | `id, hash_id (unique), title, province, class_codes[], school_name, school_code, source_url, expiration_date, created_at` (+ indici su province, class_codes GIN, expiration_date) |
| `referrals` | Programma invita-amico | codice → referrer_id |
| `generated_modules` | Cache documenti generati | fingerprint intervista (chiave) + documento |
| `user_saved_modules` | "I miei Modelli Scaricati" | `module_key, module_source, title, tipo, created_at` |
| `app_settings` | KV per configurazione edge functions | `key/value` (es. `send_notification_url`, `send_notification_secret`) |
| `promo_codes` | Codici promo (beta) | codice → validità |

### 11.2 RPC (Postgres functions)
`incrementa_notifiche_utente` (contatore 3/anno scolastico), `consuma_credito_utente`,
`incrementa_crediti_utente`, `valida_codice_promo`, `attiva_codice_promo`,
`genera_referral_code`, `handle_referral_code` (trigger), `handle_profiles_updated_at`,
`handle_generated_modules_updated_at`, `send_step1_welcome` (trigger),
`dispatch_step5_due`, `beta_rinnovo_omaggio_vita`, `invia_avvisi_scadenza_abbonamento`.

### 11.3 pg_cron (schedulazioni DB)
| Job | Frequenza | Azione |
|---|---|---|
| `step5-notifiche` | ogni minuto | `dispatch_step5_due()` → Edge `send-notification` step5 (avviso finale PRO, 2h dopo `step4_inviata_at`) |
| `beta-rinnovo-omaggio-vita` | 09:00 giornaliero | `beta_rinnovo_omaggio_vita()` — rinnovo PRO a vita per i beta tester |
| `scadenza-avvisi-multistep` | 09:00 e 18:00 | `invia_avvisi_scadenza_abbonamento()` — avvisi multistep scadenza abbonamento |

### 11.4 Edge Functions (Deno, deploy `npx supabase functions deploy <nome> --project-ref gwdmsgsshvdnfrplbjiv`)
| Funzione | Auth | Scopo |
|---|---|---|
| `send-notification` | `x-send-secret` | Invio email/Telegram dei step del drip (step1 welcome, step5 avviso finale) + welcome_pro + notifiche beta/rinnovo |
| `genera-modulo` | JWT | Intervista/generazione/cache/salvataggio modulistica (DeepSeek) |
| `checkout` | JWT | Sessione Stripe Checkout (piani + promo referral -10€ + crediti a consumo) |
| `webhook` | firma Stripe HMAC | Aggiorna `profiles` (piano pro / crediti) su eventi Stripe |
| `admin` | JWT + `ADMIN_EMAILS` | Operazioni amministrative (diagnostica, override piani) |
| `contatto` | pubblico + anti-spam | Inoltro form contatti via Resend (honeypot, alfabeti, impronte spam) |
| `elimina-account` | JWT | Cancellazione definitiva account |
| `telegram-webhook` | pubblico | Collegamento `telegram_chat_id` al profilo via deeplink `/start` |

### 11.5 Client frontend
`src/lib/supabase.ts`: `createClient(url, anonKey)` con fallback `null` → modalità demo
(localStorage). Le credenziali arrivano da `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
Gli scraper Node usano `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` dal `.env`.


---

## 12. Scrapers & Automazione GitHub Actions

### 12.1 Scraper Interpelli (`.github/workflows/scraper.yml`)
- **Cron**: Lun–Ven alle **07:00, 12:00, 15:00 UTC** (orari reali di pubblicazione degli
  uffici scolastici) + `workflow_dispatch`.
- Secrets richiesti: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `TELEGRAM_BOT_TOKEN`.
- Pipeline: `npm ci` → `npm run scrape:check` → `npm run scrape` (scraping per provincia →
  parse → upsert `interpelli`/`notices` → notifiche email/Telegram per i soli nuovi).

### 12.2 Scraper Notizie (`.github/workflows/scrape-notizie.yml`)
- **Cron**: ogni giorno alle **06:00 UTC** + `workflow_dispatch`.
- `permissions: contents: write` — committa `notizieIngestite.ts` se ci sono novità
  (`[skip ci]`), nessun loop; il deploy Vercel riparte dal push.
- Tetto settimanale **max 3 articoli** applicato dal `relevanceEngine`.

---

## 13. Deploy, Dev & Design System

### 13.1 Vercel
- `vercel.json`: SPA rewrite `/(.*)` → `/index.html` (404 fix sui path diretti).
- Production = branch `main`; ogni push a main triggera il build. Git push con messaggi
  contenenti `[skip ci]` non rigenerano i workflow GitHub (niente loop).

### 13.2 Script npm
`dev` (vite, porta 5174 strict), `build`, `typecheck` (tsc app), `scrape`, `scrape:check`,
`scrape:notizie`, `scrape:notizie:check`, `test:telegram`, `test:notifiche`, `test:pdf*`.

### 13.3 Design System
- `tailwind.config.js` token custom: `primary` (Blu Radar #2B6F9E family), `secondary`
  (arancio), `accent` (verde), `success`/`warning`/`error`, + `sky.700=#2B6F9E`,
  `sky.800=#1E5276`, `slate.50=#F4F7F9` (palette allineata).
- `index.css`: `@tailwind`, `.input`, `.finestra-conversazione` (transizione Archivista).
- PDF: `docs/PDF_DESIGN_SYSTEM.md` (A4, righe scrittura 24px, tabelle clean institutional).
- `index.html`: title/meta **"Solo le opportunità giuste per te"** (terminologia Radar Opportunità).

### 13.4 Variabili d'ambiente
`.env` locale (git-ignored) + secrets GitHub Actions + secrets Supabase
(`STRIPE_*`, `SEND_NOTIFICATION_SECRET`, `DEEPSEEK_*`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`,
`ADMIN_EMAILS`, `CONTACT_SUPPORT_EMAIL`). Vedi `.env.example`.

---

## 14. Stato attuale & note operative

- **Working tree**: modifiche non committate (drip notifiche `resend/telegram/notifier`,
  terminologia `index.html`, Edge Function `send-notification` step4, restyling Archivista,
  template modulistica, token palette, modali). Migrations più recenti **staged ma non
  committate** (da includere in un commit dedicato).
- **`git stash@{0}`**: WIP precedente (modulistica/Vault/branding) non ripristinato.
- **Notizie**: ultimo contenuto reale ingestito 2026-07-16; il cron produce 0 articoli
  quando non ci sono provvedimenti vincolanti (comportamento atteso, vedi §10.4).
- **Archivista Capo**: teaser PRO a Ottobre; chat isolata; la ricerca resta live sul catalogo.
- **Verifica**: `npm run typecheck` e `npm run scrape:check` / `scrape:notizie:check` → exit 0;
  `_validate-modulistica.ts` → 60/60 + PEI infanzia PASS.

---

## 15. Moduli bloccati (🔒 `LOCKED_MODULES.md`)

Non modificare senza autorizzazione esplicita ("Sblocca il modulo X"):
1. `src/components/AuthModal.tsx`
2. `src/pages/ChiSiamoPage.tsx`
3. `src/pages/PrezziPage.tsx`


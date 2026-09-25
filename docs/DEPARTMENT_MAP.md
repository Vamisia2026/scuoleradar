# 🗺️ ScuoleRadar — Mappa dei Dipartimenti (`DEPARTMENT_MAP`)

> **Scopo**: descrivere **come è organizzato il codice** secondo la tassonomia di
> prodotto a 5 dipartimenti (*Interpelli · Notizie & Blog · Modulistica ·
> Formazione & Carriera · Strumenti & Extra*) e, insieme, le **regole
> strutturali** che ne garantiscono l'isolamento.
>
> **Repo**: `ScuoleRadar_app/project` · **Dominio prod**: https://scuoleradar.it
> **Ultimo riallineamento**: 2026-09-21 (riorganizzazione modulare + gate di architettura)
>
> **Documenti collegati**
> - [`MODULAR_ARCHITECTURE.md`](./MODULAR_ARCHITECTURE.md) — **regola vincolante**: SRP, limiti di righe, gerarchia, gate
> - [`DEPARTMENT_ISOLATION.md`](./DEPARTMENT_ISOLATION.md) — **regola di lavoro (Consorzio)**: si opera solo nel dipartimento in lavorazione + condivisi essenziali; gli altri restano chiusi senza *sblocco congiunto* (`.clinerules`)
> - [`STRUCTURAL_AUDIT.md`](./STRUCTURAL_AUDIT.md) — audit dei monoliti, slice per slice
> - [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) — blueprint tecnico completo (servizi, RPC, workflow)
> - [`BLOG_EDITORIAL_GUIDELINES.md`](./BLOG_EDITORIAL_GUIDELINES.md) — standard editoriale della sezione Notizie

## Indice

1. [Modello a tre livelli](#1-modello-a-tre-livelli)
2. [Isolamento per dominio](#2-isolamento-per-dominio)
3. [Gerarchia: chi può importare chi](#3-gerarchia-chi-può-importare-chi)
4. [Inventario completo](#4-inventario-completo)
5. [Enforcement e limiti](#5-enforcement-e-limiti)
6. [Debito congelato e backlog](#6-debito-congelato-e-backlog)
7. [Registro modifiche](#7-registro-modifiche)

---

## 1. Modello a tre livelli

```
src/
├── components/  contexts/  hooks/  pages/      ① PIATTAFORMA (trasversale)
├── departments/<dominio>/                      ② DOMINI VERTICALI (5)
├── modules/<modulo>/                           ② MODULI VERTICALI (1)
| Livello | Cartelle (file `.ts/.tsx`) | Cosa ci sta | Dipendenze ammesse |
|---|---|---|---|
| **① Piattaforma** | `components/` (43) · `contexts/` (17) · `pages/` (38) · `hooks/` (3) · `assets/` (logo) | UI globale e riusabile, routing, stato applicativo (`AppContext`), error boundary, hooks trasversali | può usare ② e ③ |
| **② Verticale** | `departments/{admin,cfu,notizie,radar,scadenze}` (114) · `modules/modulistica` (39) | funzionalità di dominio complete: `components/`, `hooks/`, `services/`, `data/`, `types.ts` | può usare ① e ③; **altri domini solo via `index.ts`** |
| **③ Strati bassi** | `lib/` (27) · `data/` (9) · `services/` (1) · `types/` (2) · `scraper/` (5) | motori puri, integrazioni esterne, cataloghi, tipi e costanti condivise | **non** importa ① né ② |

**Codice sorvegliato dal gate**: 371 file (`src/**` + `scripts/**`) — vedi §5.

### 1.1 Regola d'oro

> Un file appartiene a **un solo** livello e a **una sola** responsabilità.
> Se per descriverlo serve la parola "e", va diviso (soft cap 250 righe,
> hard cap 300 — §5).

---

## 2. Isolamento per dominio

Ogni dipartimento è una **unità autonoma** dentro `src/departments/[nome]/`:

```
departments/<dominio>/
├── index.ts        ← ENTRY POINT PUBBLICO: l'unica superficie importabile da fuori
├── types.ts        ← tipi del dominio (quando non stanno in types/ dedicati)
├── components/     ← UI del dominio (un componente per file)
├── hooks/          ← hook del dominio (`use*.ts`, uno per hook)
├── services/       ← logica applicativa, parsing, I/O, integrazioni
└── data/           ← cataloghi, seed, dati generati (es. archivio Notizie)
```

Regole operative:

- **Zero import diretti fra domini**: da `departments/a/**` si importa
  `@/departments/b` (che risolve sull'`index.ts`), **mai**
  `@/departments/b/services/qualcosa`. Il gate emette `E-DOM` altrimenti.
- **Nessun file di codice nella radice di un dominio** tranne `index.ts` e
  `types.ts` (`E-ROOT`): tutto va in una sottocartella di dominio.
- **Comunicazione fra domini e piattaforma** solo con tre canali:
  1. **props** (componenti),
  2. **`AppContext`** (`@/contexts/AppContext`: utente, piano, preferenze, checkout),
  3. **entry point pubblici** (`index.ts` di dominio/modulo).
- **Servizi condivisi** stanno in ③ (`lib/`, `data/`, `types/`), non dentro un
  dominio: se due domini usano lo stesso codice, quel codice sale di livello.

---

## 3. Gerarchia: chi può importare chi

```
        ┌──────────────────────────────────────────┐
        │ ①  components/ · contexts/ · pages/ ·    │  UI globale, routing,
        │    hooks/ · assets/                      │  AppContext, error boundary
        └────────────────────┬─────────────────────┘
                             │ può importare
        ┌────────────────────▼─────────────────────┐
        │ ②  departments/{admin,cfu,notizie,       │  domini verticali:
        │    radar,scadenze} · modules/modulistica │  components/hooks/services/data
        └────────────────────┬─────────────────────┘
                             │ può importare
        ┌────────────────────▼─────────────────────┐
        │ ③  lib/ · services/ · data/ · types/ ·   │  motori puri, integrazioni,
        │    scraper/                              │  cataloghi, tipi condivisi
        └──────────────────────────────────────────┘
```

| Direzione | Ammessa? | Esempio / vincolo |
|---|---|---|
| ① → ② | ✅ | la pagina monta il dominio via `index.ts` (`NotizieHero`, `ModuliModule`) |
| ① → ③ | ✅ | `lib/pricing`, `lib/matchingEngine`, `data/moduli` |
| ② → ③ | ✅ | `notizie/services/*` usa `lib/…` |
| ② → ① | ⚠️ solo UI/stato condivisi | componenti e `AppContext` sì; `pages/` **no** (`E-STRAT`) |
| ② → ② (altro dominio) | ⚠️ **solo `index.ts`** | import di file interni → `E-DOM` |
| ③ → ①② | ❌ | strato basso che importa verso l'alto → `E-STRAT` |
| ciclo fra moduli | ❌ | rilevato sul grafo degli import → `E-CICLO` |
| salita relativa ≥ 4 livelli | ⚠️ | accoppiamento fragile → `W-PROF` (usare alias `@/`) |

---

## 4. Inventario completo

### 4.1 Tassonomia di prodotto ↔ codice

| # | Dipartimento | Dove vive nel codice | Confine |
|---|---|---|---|
| 1 | **Radar Interpelli** | `departments/radar/` (wizard, preferenze, flight board) + `lib/{matchingEngine,radarValidation,scadenza,interpelloRouting}.ts` + `scraper/` + `lib/{notifier,telegram,resend,digest,dedupAvvisi,frequenzaNotifiche,emailScuola,alertInterpello}.ts` | la logica di matching/notifica è in ③ (pura e riusabile), il dominio fa UI + orchestrazione |
| 2 | **Notizie & Blog** | `departments/notizie/` (hero, griglia, dettaglio, motore di rilevanza, ingestione, archivio) | interamente nel dominio; standard in `BLOG_EDITORIAL_GUIDELINES.md` |
| 3 | **Modulistica** | `modules/modulistica/` (catalogo + cache, Archivista Capo AI, generatore PDF, esplora archivio) | modulo verticale autonomo; entry `ModuliModule` |
| 4 | **Formazione & Carriera** | `departments/cfu/` (calcolatore CFU, dossier, engine) + **CV Builder**: `components/CvTool.tsx`, `pages/CvPage.tsx` | ⚠️ il CV Builder è ancora trasversale → candidato a `departments/cv/` (§6) |
| 5 | **Strumenti & Extra** | PureFocus: `lib/purefocus-bridge.ts`, `pages/PureFocusPage.tsx` · Assistente AI: `pages/AssistenteAIPage.tsx` · Billing/piani: `lib/{pricing,abbonamento,planLimits,promo}.ts`, `pages/{PrezziPage,AbbonamentoModal}` , `supabase/functions/{checkout,webhook}` | ⚠️ PureFocus e Assistente AI sono pagine/bridge ①③: candidati a domini dedicati (§6) |
| — | **Scadenze** (dominio di codice) | `departments/scadenze/` | alimenta l'hero di Notizie e i promemoria Radar |
| — | **Admin** (dominio di codice) | `departments/admin/` | area riservata (`ADMIN_EMAILS`), tab utenti/radar/account |

**Regole chiave di piattaforma** (shell condivisa, §5 — vedi `SYSTEM_HANDOVER.md` §26):

- **Coupon**: un solo codice di sconto attivo, `SCUOLERADAR50` (case-insensitive, 50%
  sulla sottoscrizione **annuale**, monouso per email, valido **40 giorni** dalla
  registrazione). `RADAR50` è rimosso; validazione in `valida_coupon_scuoleradar50` +
  tracciamento utilizzi in `coupon_usage` (`supabase/migrations/20260924120000_*`),
  mappatura Stripe nelle Edge `checkout`/`webhook`.
- **Tetti di piano** (`lib/planLimits.ts`): limitano l'**uso** (feed del Radar via
  `useInterpelliFeed`), non i dati salvati: un downgrade a Base non tronca le 4
  province/4 classi scelte in prova PRO, che restano visibili (badge `PRO`) e
  tornano attive al rientro in PRO.
- **Ricerca unificata** (`lib/ricercaSelezioniRadar.ts`): un solo campo per classi di
  concorso, competenze e parole chiave; più voci separate da virgola creano **tag
  indipendenti** (`separaParoleChiave`).
- **Sessione**: `loginConGoogle` chiude la sessione precedente prima dell'OAuth
  (cambio account Google in un click); al cambio identità le voci anagrafiche locali
  (`genere`, `eta`, `provincia`) vengono azzerate e rilette da `profiles`.

### 4.2 Notizie & Blog — `src/departments/notizie/` (17 file · 4.776 righe)

| Sottocartella | File principali | Cosa contiene |
|---|---|---|
| `components/` | `NotizieHero`, `NotizieGrid`, `NotizieDettaglio`, `SeoMeta`, `hero/{TestataEditoriale,WidgetScadenze}` | **Hero** (testata, categorie, widget scadenze), **Grid** (card paginate con link che aprono l'articolo in **nuova scheda**, `target="_blank" rel="noopener noreferrer"`), **Detail** (badge, "In Sintesi", corpo, Fonti Ufficiali, PDF, condivisione) |
| `services/` | `relevanceEngine`, `ingestNotizie`, `newsFetcher`, `newsService`, `archivioNotizie`, `tracciaFonte` | **Motore di rilevanza** + **ingestione** (waterfall MIM → Gazzetta Ufficiale → ARAN → giurisdizione, validazione HTTP 200 dei link, igiene archivio, garanzia settimanale) + lettura feed |
| `data/` | `notizieIngestite.ts` (generato dal cron), `notizieSeed.ts` | archivio accumulato (dedupe per id, formato editoriale uniforme) + seed curati |
| `index.ts` | — | superficie pubblica: componenti Notizie + servizi/tipi usati dall'app |

**Standard editoriale stretto** (dettaglio in `BLOG_EDITORIAL_GUIDELINES.md`):

1. **Temi ammessi** (`classificaTemaPersonale`): CCNL e stipendi, pensioni,
   welfare e polizza sanitaria, mobilità e assegnazioni, GPS/graduatorie/
   supplenze/interpelli, organico e cattedre, formazione, PNRR, sicurezza;
   *normativa/scadenze/concorsi* valgono solo con un riferimento esplicito al
   personale.
2. **Niente fluff**: respinti comunicati, lettere del Ministro, dichiarazioni,
   eventi e rinvii vaghi ("ti avvisiamo appena esce", "verifica nel testo
   ufficiale") → `titoloDaUfficioStampa`, `FRASI_FLUFF`, `contieneFraseFluff`,
   applicati anche all'igiene delle voci già in archivio.
3. **Link diretti**: fonte ufficiale canonica **+ link di presentazione della
   domanda** quando la notizia parla di una procedura (`linkDomandaUfficiale`:
   Istanze Online/POLIS, Unica, InPA, INPS, PNRR Istruzione). Un avviso che
   annuncia una procedura senza il canale di presentazione viene **scartato**.
4. **Titoli azione** (`titoloAzione`) e **sintesi "In Sintesi"** a bullet
   operativi: *Cosa cambia · Chi riguarda · Scadenza · Cosa devi fare · Presenta
   la domanda*; acronimi spiegati alla prima occorrenza (`GLOSSARIO_ACRONIMI`).
5. **Cadenza**: 1–3 articoli datati negli ultimi 7 giorni
   (`verificaCadenzaSettimanale` in `services/ingestNotizie.ts`), con garanzia
   minima settimanale (`èRiservaSettimanale` + `applicaGaranziaSettimanale`) e
   cron che **fallisce** se la bacheca resta ferma.

### 4.3 Modulistica — `src/modules/modulistica/` (40 file · 6.570 righe)

| Sottocartella | File principali | Cosa contiene |
|---|---|---|
| `components/` | `ModuliModule`, `ModuliNavigation`, `RicercaArchivista`, `TeaserArchivistaModal`, **`TabDocumentiPersonali`**, `esploraArchivio/**` | UI del catalogo (filtri, ricerca, modali) + **Esplora Archivio** + ingresso all'Archivista + **terza tab «I Miei Documenti»** (storage personale, condiviso con il profilo) |
| `creator/` | `ArchivistaCapo.tsx`, `ConversazioneArchivista`, `EsitoArchivista`, `IntestazioneArchivista`, `PensieriArchivista`, `archivistaTipi.ts`, `hooks/useIntervistaArchivista.ts` | **Archivista Capo (AI)**: intervista guidata → modulo compilato |
| `creator/pdf/` | `documento.ts`, `logoDataUri.ts` | **Generatore PDF**: documento A4, tabelle, logo embed |
| `hooks/` | `useModulistica.ts` | stato, salvataggi e caricamento dei moduli dell'utente |
| `index.ts` | — | superficie pubblica: `ModuliModule` + tipi (`ModuloSalvatoDB`, `VistaModulistica`, `VoceModulo`) |
| `creator/cacheService.ts` | — | **cache del catalogo** (memoria + persistenza): nessuna rilettura del DB a ogni apertura |

### 4.4 Radar Interpelli — `src/departments/radar/` (25 file · 3.958 righe)

| Sottocartella | File principali | Cosa contiene |
|---|---|---|
| `wizard/` | step del wizard Radar + `tipiSelezione.ts` | onboarding guidato delle regole; il Passo 3 è un **compositore** (ricerca unificata in testa + due colonne) e le sezioni vivono in `wizard/components/` |
| `wizard/components/` | `SezioneClassiConcorso` · `SezioneCompetenzeExtra` | classi di concorso + adesione al sostegno · tag popolari PNRR/PON e chip delle competenze/parole chiave (nessun elenco statico) |
| `preferenze/` | `PreferenzeRadar` + pannelli | modifica delle regole del Radar senza rifare il wizard («In cosa puoi lavorare» usa la stessa ricerca unificata) |
| `flightBoard/` | `FlightBoard*` | bacheca degli interpelli in arrivo per l'utente |
| `components/` | `ProvinciaPill` · `BenvenutoProRadar` · `RicercaSelezioni` | pill con il ruolo di **provincia principale** · benvenuto PRO al primo accesso · campo di **ricerca unificata** (classi + competenze + parole chiave) |
| `index.ts` | — | superficie pubblica: `RadarWizardModal`, `PreferenzeRadar`, `RadarStatusToggle`, `BenvenutoProRadar` |

Componenti di dominio **ancora in radice** (`RadarWizardModal.tsx`,
`PreferenzeRadar.tsx`, `FlightBoardInterpelli.tsx`, `SimulatorRadar.tsx`,
`RadarStatusToggle.tsx`, `ordineIcone.tsx`, `valutaConfigurazione.ts`): segnalati
come `E-ROOT` dal gate → spostamento in `components/` pianificato (§6).

Il dipartimento è solo la **UI**; il lavoro pesante sta negli strati bassi ③:

| Sottodipartimento di prodotto | Artefatti |
|---|---|
| **Motore di Matching** | `lib/matchingEngine.ts`, `lib/radarValidation.ts`, `lib/scadenza.ts`, `lib/interpelloRouting.ts` — puri, coperti da `npm run test:matching`, `test:radar`, `test:sostegno`, `test:interpello-scadenza` |
| **Pipeline di Scraping** | `scraper/{index,parser,elenchi,channelLog,adminAlerts}.ts` + `.github/workflows/{scraper,pulisci-scaduti}.yml` + `scripts/{pulisci-scaduti,arricchisci-interpelli,audit-dati}.ts` |
| **Sistema di Notifica** | `lib/telegram.ts` (bot + canali), `lib/resend.ts` (email), `lib/notifier.ts` (dispatch + dedup), `lib/digest.ts` (batch giornaliero), `lib/{dedupAvvisi,frequenzaNotifiche,planLimits,emailScuola,alertInterpello}.ts`, Edge `supabase/functions/send-notification`, workflow `digest.yml` + `health-check.yml` |

### 4.5 Formazione & Carriera — `src/departments/cfu/` (53 file · 9.109 righe)

| Sottocartella | Cosa contiene |
|---|---|
| `calcolatore/` | `CalcolatoreCfuApp` + `components/` (compreso `components/documenti/`): wizard CFU, Step Documenti, risultati |
| `engine/` | motore puro: `requirementSolver`, `traceabilityChain`, `sources/` (registry + seed), `bridge/`, `legacyAdapter` — coperto da `npm test` (7 suite: `engineAudit`, `verticalSlice1`, `traceabilityChain`, `sourceRegistry`, `legacyAdapter`, `progressiveWiring`, `multiClassScan`) |
| `dossier/` | composizione del dossier PDF del docente |
| `landing/` | `CalcolatoreCfuLanding`: pagina pubblica del calcolatore |
| `shared/` · `__tests__/` | utility condivise del dominio + test del motore |
| `index.ts` | superficie pubblica: `CalcolatoreCfuApp`, `CalcolatoreCfuLanding` |

**CV Builder** (sottodipartimento di prodotto): oggi **trasversale** —
`components/CvTool.tsx` + `pages/CvPage.tsx`; nessun dominio dedicato →
candidato a `src/departments/cv/` (§6).

### 4.6 Scadenze — `src/departments/scadenze/` (11 file · 1.357 righe)

`components/RevolverScadenze` (+ `hooks/`): scadenze scolastiche nazionali
(vacanze, esami, adempimenti), usate nell'hero di Notizie e nella dashboard.
Entry: `RevolverScadenze` + `RevolverScadenzeProps`; motore dati e servizio in
`departments/scadenze/{engine.ts,deadlinesService.ts}` (in radice → `E-ROOT`,
spostamento pianificato §6).

### 4.7 Admin — `src/departments/admin/` (22 file · ~3.3k righe)

`tabs/{TabUtenti,TabRadar,TabAccount}` + `tabs/utenti/**` (tabella, barra filtri,
dettaglio, modali) + `components/{TabDipartimenti, TabEmailAutomazioni,
RigaAutomazione, AutomazioniInterruttore, PannelloCopyAutomazione,
automazioniSupporto}` (feature flags e automazioni email) +
`hooks/useAutomazioniEmail` + `services/automazioniService` + `adminService`,
`adminUi`, `AdminAccessModal`.
Entry: `TabUtenti`, `TabRadar`, `TabEmailAutomazioni`, `TabDipartimenti`, … Accesso
riservato (`ADMIN_EMAILS`).

### 4.8 Feature flags dei dipartimenti — `src/config/` + `src/hooks/useFeatureFlags.ts`

Ogni dipartimento/modulo ha **tre stati** (`off` · `test` · `on`):

| Stato | Navbar/rotte | Notifiche automatiche (email/Telegram) |
|---|---|---|
| `off` | tab nascosta, `FeatureGate` mostra la pagina «in arrivo» | nessun invio |
| `test` | tab e rotta visibili **solo all'admin** (badge «TEST») | solo verso l'account di test dell'admin (dirottate) |
| `on` | visibile a tutti | invio regolare |

**Default di produzione** (`DIPARTIMENTI[].statoBase` — nessuna variabile, nessun
override locale: è la superficie che vede un utente NON admin nella build `vite build`):

| Dipartimento | `statoBase` | Effetto in produzione |
|---|---|---|
| 📡 Radar Scuole (`radar`) | `on` | navbar, tab dashboard, landing e notifiche attivi |
| 🧘 Pure Focus (`purefocus`) | `on` | servizio partner pubblico |
| 🎓 Calcolatore CFU (`cfu`) | `off` | nessuna tab/link; `/calcolatore-cfu` e `/dashboard/calcolatore-cfu` mostrano la pagina «in arrivo» |
| 📁 Modulistica (`modulistica`) | `off` | nessuna tab/link (anche nel menu utente e nel footer); `/moduli` e `/dashboard/moduli` dietro il gate |
| 🎁 Invita un Collega (`referral`) | `off` | nessuna tab; `/dashboard/invita` dietro il gate |
| 📄 Crea CV (`cv_builder`) | `off` | nessuna tab; `/dashboard/cv` dietro il gate |

Per riaprire un dipartimento: pannello Admin (per il browser corrente) oppure
`FEATURE_<DIPARTIMENTO>=on` per i processi server-side, oppure si cambia lo
`statoBase` nel codice. Guardia automatica: `npm run test:flags` verifica che la
superficie pubblica sia **esattamente** `radar` + `purefocus`.

File e responsabilità:

| File | Responsabilità |
|---|---|
| `src/config/features.ts` | anagrafica dei 6 dipartimenti (`DIPARTIMENTI`) + store degli override locali (`sr_flag_dipartimenti`, sottoscrivibile) |
| `src/config/statoDipartimenti.ts` | stato effettivo (env → locale → default), visibilità per utente, etichette |
| `src/config/gateNotifiche.ts` | gate centralizzato degli invii (`gateEmail`, `gateTelegram`, `valutaInvioNotifica`) |
| `src/lib/utentiAdmin.ts` | whitelist admin + recapiti di test (unica fonte di verità) |
| `src/lib/ambiente.ts` | lettura isomorfa delle variabili d'ambiente (browser/Node/Deno) |
| `src/hooks/useFeatureFlags.ts` | hook React (`stati`, `visibile`, `impostaStato`, `forzaDev`) |
| `src/components/FeatureGate.tsx` · `ModuloInManutenzione.tsx` | guardia di rotta + pagina «in arrivo» |
| `src/components/FlagDipartimentiPanel.tsx` | selettore a 3 posizioni: `variante="card"` (pannello Admin) e `variante="lista"` (DEV Toolbar, una riga per dipartimento) |
| `src/components/FlagDipartimentiProva.tsx` | prova live dentro la DEV Toolbar: anteprima della navbar (`visibile`), valore salvato in `sr_flag_dipartimenti` riletto a ogni click, test di scrittura/rilettura |
| `scripts/test-feature-flags.ts` | `npm run test:flags` (matrice stati, **superficie pubblica di produzione = solo radar + purefocus**, snapshot di visibilità, scrittura reale della chiave con stub di `localStorage`, gate notifiche) |
| `scripts/test-flags-cablaggio.ts` | sempre in `npm run test:flags`: cablaggio delle flag in navbar desktop/mobile, tab, menu utente, superfici pubbliche, redirect e pannelli Admin/DEV (estratto da `test-feature-flags` per il limite di 250 righe/file) |
| `scripts/test-flags-render.ts` | render del selettore con `react-dom/server` (6 righe × 3 pulsanti in `variante="lista"`, card in Admin): guardia contro la non-visibilità dei toggle |

Nella **DEV Toolbar** (`src/components/DevToolbar.tsx`) la sezione «Dipartimenti (feature
flags)» sta subito **sotto «Stato utente»** e mostra i sei selettori **sempre a schermo**
in forma lista, più l'anteprima di navbar e chiave persistita
(`FlagDipartimentiProva`): nessuna modale da aprire.

Mentre lo stato `test` è attivo, **ogni** invio automatico passa dal gate: i choke
point sono `inviaMessaggioTelegram` (`src/lib/telegram.ts`), i tre invii email di
`src/lib/resend.ts` e `inviaEmail`/`inviaTelegram` della Edge `send-notification`.
Gli invii lato server seguono le variabili `FEATURE_<DIPARTIMENTO>` e
`FEATURE_TEST_REDIRECT` (vedi `.env.example`), che hanno priorità sugli override
locali impostati dal browser.

### 4.9 Automazioni email — `src/config/automazioni*.ts`

Catalogo unico delle **comunicazioni automatiche** (transazionali e di richiamo):
benvenuto, richiamo «Radar ancora spento» (24h), drip piano Base, digest
giornaliero, alert PRO in tempo reale, promemoria di scadenza (24h), preavvisi di
rinnovo, drip di scadenza abbonamento, rinnovo Free Forever, retention beta.

| File | Responsabilità |
|---|---|
| `src/config/automazioniTipi.ts` | tipi del contratto (`IdAutomazione`, `AutomazioneEmail`, stato) |
| `src/config/automazioniEmailCatalogo.ts` | anagrafica (nome, trigger, motore, canale, oggetto, anteprima copy) + prefisso chiavi |
| `src/config/automazioniEmail.ts` | entry point: riesporta tipi+catalogo e aggiunge gli helper puri (`normalizzaStatoAutomazione`, `testoAnteprima`, …) |
| `supabase/functions/_shared/automazioniEmail.ts` | gemello Deno: mappa `tipo` → automazione, lettura KV, applicazione di oggetto/intro/corpo |
| `src/lib/automazioniEmailDb.ts` | lettura Node per il notifier (digest, alert, promemoria) con cache 60s |
| `src/departments/admin/components/TabEmailAutomazioni.tsx` (+ `RigaAutomazione`, `AutomazioniInterruttore`, `PannelloCopyAutomazione`) | tabella, anteprima visiva, editor copy, interruttore |
| `src/departments/admin/hooks/useAutomazioniEmail.ts` · `services/automazioniService.ts` | stato/azioni del pannello e livello dati (Edge `admin`) |
| `scripts/test-automazioni-email.ts` · `scripts/test-automazioni-email-cablaggio.ts` | `npm run test:automazioni` (catalogo ↔ template, Edge, notifier, UI) |

Lo stato vive in `public.app_settings` (chiave `email_automazione_<id>`) ed è letto
da: Edge `send-notification` (invii transazionali e cron DB), notifier Node (digest,
alert PRO, promemoria 24h) e pannello Admin (azioni `list_email_automations` /
`set_email_automation` della Edge `admin`). Errori di lettura → automazione ATTIVA.
Gli oggetti **vincolati** dalle checklist («Nuove opportunità per te!») non sono
modificabili dal pannello; per le automazioni basate su template centralizzato è
editabile anche il corpo del messaggio.

---


---

## 5. Enforcement e limiti

### 5.1 Comandi

| Comando | Uso |
|---|---|
| `npm run test:architettura` | **gate**: exit 1 solo sulle violazioni **nuove** |
| `npm run test:architettura -- --report` | inventario completo (file più grandi, file per dominio, tutte le violazioni), exit 0 |
| `npm run test:architettura -- --baseline` | congela lo stato attuale (atto deliberato, da motivare in PR) |
| `npm run arch:check` · `npm run arch:report` | alias diretti dello stesso script (`scripts/check-architettura.ts`) |

Output corrente del gate:

```
— Gate strutturale (docs/MODULAR_ARCHITECTURE.md) —
• File analizzati: 371 | violazioni: 145 (82 errori, 63 warning)
• Debito congelato in baseline: 145
✅ ARCHITETTURA: nessuna violazione nuova
```

Il gate gira **in CI su ogni push e PR** (`.github/workflows/architettura.yml`)
e non sostituisce i controlli di prodotto: `npm test`, `npm run build`,
`npm run test:notizie-*`.

### 5.2 Limiti dimensionali (SRP)

| Soglia / regola | Codice | Effetto |
|---|---|---|
| **250 righe** | `W-DIM` | soft cap: split **proattivo** pianificato |
| **300 righe** | `E-DIM` | **hard cap**: non ammesso su file nuovi |
| file nella radice di un dominio | `E-ROOT` | va in `components/` · `hooks/` · `services/` · `data/` |
| dominio senza `index.ts` | `E-ENTRY` | manca la superficie pubblica |
| import interno a un altro dominio | `E-DOM` | si passa dall'`index.ts` |
| strato basso che importa verso l'alto | `E-STRAT` | ③ non conosce ① e ② |
| ciclo di import | `E-CICLO` | da rompere |
| `.tsx` fuori da `components/`/`pages/` | `W-UI` | spostare il componente |
| `use*.ts` fuori da `hooks/`/`contexts/` | `W-HOOK` | spostare l'hook |
| cartella di dominio fuori vocabolario | `W-STRUT` | aggiornare policy o spostare |
| salita relativa ≥ 4 livelli | `W-PROF` | usare l'alias `@/` |

### 5.3 Baseline: regole di eccezione

`scripts/architettura-baseline.json` congela le violazioni **già presenti**,
ciascuna con il proprio motivo. Regole:

1. il gate **fallisce solo sulle violazioni nuove** → il debito non può crescere;
2. le eccezioni **non più necessarie vengono segnalate** a ogni esecuzione:
   rimuoverle fa parte del lavoro di refactoring;
3. una **nuova** eccezione va motivata nella PR e considerata temporanea: si
   rimuove appena il file viene diviso o spostato;
4. i **dati puri** (`data/**`: cataloghi, seed) possono restare sopra soglia solo
   se elencati in baseline come dati, mai come logica;
5. la policy completa è in [`MODULAR_ARCHITECTURE.md`](./MODULAR_ARCHITECTURE.md).

---

## 6. Debito congelato e backlog

Stato all'attivazione del gate: **371 file analizzati, 145 violazioni congelate**.

| Codice | N° | Esempi / significato | Priorità |
|---|---|---|---|
| `E-DIM` | 41 | `modulistica/creator/cacheService.ts` 3.127 · `data/moduliOrdiniScuola.ts` 2.710 · `lib/notifier.ts` 2.000 · `notizie/services/relevanceEngine.ts` 1.875 · `scraper/index.ts` 1.516 | alta |
| `E-DOM` | 24 | import fra domini che scavalcano l'`index.ts` | alta |
| `E-ROOT` | 14 | file in radice di dominio (radar, scadenze, admin, modulistica) | media — spostamenti a basso rischio |
| `E-CICLO` | 3 | cicli fra `src/data/moduli.ts` e `moduli{EntiAltro,AltreAree,OrdiniScuola}.ts` | alta (facile da chiudere) |
| `W-UI` | 38 | componenti fuori da `components/` (es. `admin/tabs/**`) | media |
| `W-DIM` | 25 | file fra 250 e 300 righe (split pianificati) | bassa |
| `W-STRUT` · `W-PROF` | — | vocabolario cartelle · import profondi | bassa |

**Backlog prioritizzato**

1. dividere i file oltre 1.000 righe — in particolare estrarre da
   `relevanceEngine.ts` il modulo `services/editorialStandard.ts` (glossario
   acronimi, temi ammessi, regole fluff);
2. rompere i **3 cicli** di `src/data/moduli*`;
3. spostare i 14 file `E-ROOT` nelle sottocartelle corrette (nessuna modifica di logica);
4. promuovere a dominio i sottodipartimenti oggi trasversali: **CV Builder**
   (`departments/cv/`), **PureFocus bridge**, **Assistente AI**;
5. ripulire le eccezioni risolte dalla baseline (il gate le elenca da solo).

---

## 7. Registro modifiche

| Data | Modifica |
|---|---|
| 2026-09-21 | **Riscrittura completa** della mappa: struttura a 3 livelli (§1), isolamento per dominio (§2), gerarchia degli import (§3), inventario con numeri reali e feature per dipartimento (§4), enforcement e regole di baseline (§5), debito congelato e backlog (§6). Sostituisce la precedente mappa di 811 righe (non tracciata in git); i dettagli operativi restano in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) |
| 2026-09-21 | Introdotti `docs/MODULAR_ARCHITECTURE.md`, il gate `npm run test:architettura` (+ `arch:report`, `--baseline`) e la baseline del debito |



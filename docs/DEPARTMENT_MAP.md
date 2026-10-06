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
| **③ Strati bassi** | `lib/` (27) · `data/` (9) · `services/` (1) · `types/` (2) · `scraper/` (10) | motori puri, integrazioni esterne, cataloghi, tipi e costanti condivise | **non** importa ① né ② |

**Codice sorvegliato dal gate**: 545 file (`src/**` + `scripts/**`) — vedi §5.

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
| 1 | **Radar Interpelli** | `departments/radar/` (wizard, preferenze, flight board) + `lib/{matchingEngine,radarValidation,scadenza,urgency,interpelloRouting}.ts` + il **punteggio in DUE LIVELLI** (`lib/{compatibilitaGraduata,mediaModali,punteggioOrdine,punteggioClasse,punteggioCompetenze,prossimitaGeografica,compatibilita,riempitivi,bachecaInterpelli}.ts`, §26.63) + `scraper/` + `lib/{notifier,telegram,resend,digest,dedupAvvisi,frequenzaNotifiche,emailScuola,alertInterpello,queue}.ts` | la logica di matching/notifica è in ③ (pura e riusabile), la **coda di scansione** (`lib/queue.ts` → RPC `claim/finish/reap`, §26.21 di `SYSTEM_HANDOVER.md`) è infrastruttura di servizio: il dominio fa UI + orchestrazione |
| 2 | **Notizie & Blog** | `departments/notizie/` (hero, griglia, dettaglio, motore di rilevanza, ingestione, archivio) | interamente nel dominio; standard in `BLOG_EDITORIAL_GUIDELINES.md` |
| 3 | **Modulistica** | `modules/modulistica/` (catalogo + cache, Archivista Capo AI, generatore PDF, esplora archivio) | modulo verticale autonomo; entry `ModuliModule` |
| 4 | **Formazione & Carriera** | `departments/cfu/` (calcolatore CFU, dossier, engine) + **CV Builder**: `components/CvTool.tsx`, `pages/CvPage.tsx` | ⚠️ il CV Builder è ancora trasversale → candidato a `departments/cv/` (§6) |
| 5 | **Strumenti & Extra** | PureFocus: `lib/purefocus-bridge.ts`, `pages/PureFocusPage.tsx` · Assistente AI: `pages/AssistenteAIPage.tsx` · Billing/piani: `lib/{pricing,abbonamento,planLimits,promo}.ts`, `pages/{PrezziPage,AbbonamentoModal}` , `supabase/functions/{checkout,webhook}` | ⚠️ PureFocus e Assistente AI sono pagine/bridge ①③: candidati a domini dedicati (§6) |
| — | **Scadenze** (dominio di codice) | `departments/scadenze/` | alimenta l'hero di Notizie e i promemoria Radar |
| — | **Admin** (dominio di codice) | `departments/admin/` | area riservata (`ADMIN_EMAILS`), tab utenti/radar/account |

**Regole chiave di piattaforma** (shell condivisa, §5 — vedi `SYSTEM_HANDOVER.md` §26):

- **Coupon**: codici di sconto attivi `SCUOLERADAR50` (case-insensitive, 50%
  sulla sottoscrizione **annuale**, monouso per email, valido **40 giorni** dalla
  registrazione) e `PROANNUALE40` (PRO annuale a 40 € invece di 49 €, coupon Stripe
  `amount_off` 900 cent con durata `once`: sconto del **primo anno**, applicato dalla
  CTA di fine flusso — `radar/components/CtaProAnnuale`, §26.16). `RADAR50` è rimosso;
  validazione in `valida_coupon_scuoleradar50` +
  tracciamento utilizzi in `coupon_usage` (`supabase/migrations/20260924120000_*`),
  mappatura Stripe nelle Edge `checkout`/`webhook`.
- **Tetti di piano** (`lib/planLimits.ts`): limitano l'**uso** (feed del Radar via
  `useInterpelliFeed`), non i dati salvati: un downgrade a Base non tronca le 4
  province/4 classi scelte in prova PRO, che restano visibili (badge `PRO`) e
  tornano attive al rientro in PRO.
- **Ricerca classi/competenze** (`lib/ricercaSelezioniRadar.ts` + `lib/ricercaTesto.ts`):
  il confronto testo ↔ catalogo (accenti, trattini, «a19» ≡ «A-19», **ordine di scuola**
  «CPIA»/«adulti»/«primaria», co-occorrenze tra materie) vive in `ricercaTesto.ts`;
  `ricercaSelezioniRadar.ts` compone i risultati. Nelle **Preferenze** i due campi sono
  **separati**: a sinistra le classi di concorso (`classeCorrispondeAQuery`), a destra
  competenze e parole chiave (`cercaCompetenzeParole`, nessuna classe negli esiti). Il
  wizard usa la ricerca unificata (`cercaSelezioniRadar`); più voci separate da virgola
  creano **tag indipendenti** (`separaParoleChiave`).
- **Sessione**: `loginConGoogle` chiude la sessione precedente prima dell'OAuth
  (cambio account Google in un click); al cambio identità le voci anagrafiche locali
  (`genere`, `eta`, `provincia`) vengono azzerate e rilette da `profiles`.

### 4.2 Notizie & Blog — `src/departments/notizie/` (30 file · 5.582 righe)

| Sottocartella | File principali | Cosa contiene |
|---|---|---|
| `components/` | `NotizieHero`, `NotizieGrid`, `NotizieDettaglio`, `SeoMeta`, `hero/{TestataEditoriale,WidgetScadenze}` | **Hero** (testata, categorie, widget scadenze), **Grid** (card paginate con link che aprono l'articolo in **nuova scheda**, `target="_blank" rel="noopener noreferrer"`), **Detail** (badge, "In Sintesi", corpo, Fonti Ufficiali, PDF, condivisione) |
| `services/` | `relevanceEngine` (orchestratore), `editorialVoice` (**voce unica**), `promptEditoriale`, `articoloEditoriale`, `articoloCopy`, `linkUfficiale`, `fontiUfficiali`, `cadenzaArticoli`, `valutazioneTipi`, `editorialStandard`, `lessicoScuola`, `standardTemiPersonale`, `standardTemiIA`, `standardTemiDidattica`, `ingestNotizie`, `newsFetcher`, `newsService`, `archivioNotizie`, `tracciaFonte` | **Motore di rilevanza** (sotto-moduli SRP < 300 righe) + **ingestione** (waterfall MIM → Gazzetta Ufficiale → ARAN → giurisdizione, validazione HTTP 200 dei link, igiene archivio, garanzia settimanale) + lettura feed |
| `data/` | `notizieIngestite.ts` (generato dal cron), `notizieSeed.ts` | archivio accumulato (dedupe per id, formato editoriale uniforme) + seed curati |
| `index.ts` | — | superficie pubblica: componenti Notizie + servizi/tipi usati dall'app |

**Standard editoriale stretto** (dettaglio in `BLOG_EDITORIAL_GUIDELINES.md`):

1. **Temi ammessi** (`TEMI_OPERATIVI` + `classificaTemaPersonale`: peso in
   `PESI_CATEGORIA`, macro-area in `AREE_TEMATICHE` — blocco condiviso in
   `services/editorialStandard.ts` + `services/standardTemi*.ts`): CCNL e
   stipendi, pensioni, welfare e polizza sanitaria, mobilità e assegnazioni,
   GPS/graduatorie/supplenze/interpelli, organico e cattedre, sostegno, ATA e
   segreterie, CPIA, formazione (TFA/CFU, classi di concorso), reclutamento e
   immissioni in ruolo, PNRR, sicurezza, **intelligenza artificiale** (categoria
   autonoma); *normativa/scadenze/concorsi* valgono
   solo con un riferimento esplicito al personale; i temi *culturali/didattici*
   (innovazione digitale, didattica, pedagogia) e l'*intelligenza artificiale*
   solo con un **fatto concreto**
   (scadenza reale o canale ufficiale: `CATEGORIE_CON_FATTO_CONCRETO`).
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

### 4.4 Radar Interpelli — `src/departments/radar/` (34 file · 4.745 righe; 41 con i test)

| Sottocartella | File principali | Cosa contiene |
|---|---|---|
| `wizard/` | step del wizard Radar + `tipiSelezione.ts` | onboarding guidato delle regole; il Passo 3 è un **compositore** (ricerca unificata in testa + due colonne) e le sezioni vivono in `wizard/components/` |
| `wizard/components/` | `SezioneClassiConcorso` · `SezioneCompetenzeExtra` · **`SezioneTrasparenza`** | classi di concorso (il **sostegno è a inclusione permanente**: nessuna domanda nel wizard e nessuna preferenza da spegnere — §26.45) · campo libero per la parola chiave + tag popolari PNRR/PON e chip delle competenze (nessun elenco statico) · blocco «**Cosa fa il tuo Radar, in chiaro**» del **Passo 4** (province/classi/competenze reali + regole di consegna), con guardia dedicata `npm run test:trasparenza` (`wizard/__tests__/trasparenzaPasso4.test.ts`) |
| `preferenze/` · `preferenze/components/` | `PreferenzeRadar` + pannelli + **`CampoScuola.tsx`** (riga a tre comandi — `Provincia` + `Nome della scuola` + `Aggiungi` — con la provincia **per lista** e filtro istantaneo, §26.67) | modifica delle regole del Radar senza rifare il wizard: **Classi di concorso** a sinistra (`classeCorrispondeAQuery`: codice «a19» ≡ «A-19», denominazione, materia, ordine «CPIA»/«adulti») e **competenze/parole chiave** a destra (`cercaCompetenzeParole`, nessuna classe negli esiti — §26.46). Il **sostegno** non ha alcun blocco né interruttore: inclusione permanente e invisibile nel backend (§26.45/§26.46) |
| `flightBoard/` | `letturaBoard.ts` · `metricaBoard.ts` · `righeBoard.ts` · `filtroAttivi.ts` · `rigaBoardDati.ts` · `components/RigaBoard.tsx` · `FlightBoard*` | **lettura esaustiva** della bacheca: pagine contigue (`.range`) con offset che avanza di ciò che il server ha **davvero** consegnato, fine dichiarata da una pagina vuota o dal conteggio esatto, doppioni scartati per `id`, guardia anti-anello a 50 pagine — il vecchio `LIMITE_RIGHE_LETTE = 1.000` era il taglio muto di PostgREST sulle righe più vecchie, §26.34 · **scala reale** della bacheca: le schermate si contano sulle righe DAVVERO presenti (5 righe per schermata) e l'etichetta è **`Schermata X di Y`** — conto ESATTO, senza `+` di maggiorazione e senza dicitura fissa (§26.42), con conteggio **esatto** degli avvisi attivi in Italia e `formattaNumeroIt` (migliaia deterministiche) · espressione PostgREST del filtro bacheca (`filtroAttivi(oggi)`: scadenza non passata **oppure** senza scadenza ma pubblicato negli ultimi 60 giorni, su data **locale**) · estrazione di città, PDF e host delle righe · dati derivati della riga (tipologia, urgenza, date brevi: funzioni pure) · rendering della riga in bacheca (`components/RigaBoard.tsx`: `RigaBoard` col chip ambra «Scuola non specificata / Più plessi» delle righe di ripiego (§26.47/§26.48), `RigheRiempimento`) · bacheca degli interpelli in arrivo per l'utente — guardie `npm run test:board:lettura` (`flightBoard/__tests__/letturaBoard.test.ts` + `letturaBoardCablaggio.test.ts`), `npm run test:board:metriche` (`flightBoard/__tests__/metricaBoard.test.ts`) e `npm run test:board:filtro` (`flightBoard/__tests__/filtroAttivi.test.ts`); diagnosi manuale sui dati veri `npm run board:diag` |
| `components/` | `ProvinciaPill` · `BenvenutoProRadar` · **`CtaProAnnuale`** · `RicercaSelezioni` · `ResponsoProva` · **`RiepilogoLavoro`** | pill con il ruolo di **provincia principale** · benvenuto PRO al primo accesso (**con la CTA PRO Annuale**, coupon `PROANNUALE40`) · CTA in evidenza della chiusura annuale (copy del cliente + nota su scorporo del mese e coupon, presentazione pura: il checkout lo avvia il contenitore — §26.16) · campo di **ricerca unificata** (classi + competenze + parole chiave, con **aggancio esteso** per sinonimi: «Inglese» → CLIL, educazione linguistica — §26.40) · **responso del Radar di prova** (sola presentazione) · **riepilogo «In cosa puoi lavorare»** della pagina Profilo: classi, competenze e parole chiave REALI dal contesto (prima era una dicitura fissa, identica per tutti — §26.40) |
| `services/` | `provaRadarQuery.ts` | lettura degli interpelli del **Radar di prova** (Supabase): **una sola provincia**, `.eq('province')` + solo avvisi vivi (soglia `expiration_date` lato DB, le righe senza scadenza restano), limite 200 righe e attesa della scansione 900 ms — **nessun pool nazionale, nessun fallback, nessun dato di esempio** (§26.61) |
| `index.ts` | — | superficie pubblica: `RadarWizardModal`, `PreferenzeRadar`, `RadarStatusToggle`, `RiepilogoLavoro`, `BenvenutoProRadar` |

Componenti di dominio **ancora in radice** (`RadarWizardModal.tsx`,
`PreferenzeRadar.tsx`, `FlightBoardInterpelli.tsx`, `SimulatorRadar.tsx`,
`RadarStatusToggle.tsx`, `ordineIcone.tsx`, `valutaConfigurazione.ts`): segnalati
come `E-ROOT` dal gate → spostamento in `components/` pianificato (§6).

Il dipartimento è solo la **UI**; il lavoro pesante sta negli strati bassi ③:

| Sottodipartimento di prodotto | Artefatti |
|---|---|
| **Motore di Matching** | `lib/matchingEngine.ts`, `lib/radarValidation.ts`, `lib/scadenza.ts`, `lib/interpelloRouting.ts`, **`lib/compatibilitaGraduata.ts`** (il voto in **DUE LIVELLI**, §26.63: media **ponderata** delle modali PRIMARIE + **sfumatura** delle competenze, dentro la regola del tetto — punto UNICO di `valutaCompatibilita`), **`lib/mediaModali.ts`** (`PESI_MODALI` ordine 1 · classe 2 · provincia 1, `ContributoModale`, `mediaPonderata`: le competenze **fuori** dai pesi, il denominatore è dei contributi applicabili), **`lib/punteggioOrdine.ts`** + **`lib/punteggioClasse.ts`** + **`lib/punteggioCompetenze.ts`** (livello **SECONDARIO**: gradi 25/20/10, +3 per corrispondenza in più, tetto `CAP_COMPETENZE` = 25 — **non** apre la bacheca, §26.63) + **`lib/jollySemantico.ts`** (il **JOLLY SEMANTICO** della Modalità 3, §26.64: **una misura, due decisioni** — match **PIENO** → pavimento `PUNTEGGIO_JOLLY_PIENO` **90** dentro le proprie province e **inclusione d'ufficio** `PUNTEGGIO_JOLLY_OLTRE_RAGGIO` **60** oltre il raggio, quindi **apertura** della bacheca; match **PARZIALE** → `BONUS_JOLLY_PARZIALE` **15**, sfuma e **non** apre; **assenza** → voto intatto; tre **sospensioni**: whitelist, tetto del motore, sostegno) + **`lib/prossimitaGeografica.ts`** (raggio dei 60 km) + **`lib/compatibilita.ts`** (soglie e bande, `ETICHETTA_COMPETENZA_SECONDARIA`), **`lib/riempitivi.ts`** (cap dinamico dei riempitivi + **esclusione secca dei non pertinenti**, §26.55/§26.60), **`lib/bachecaInterpelli.ts`** (pipeline PURA della bacheca: avviso vivo → blacklist/whitelist → **porta d'ingresso PRIMARIA** (§26.63: conferma del motore o classe almeno «stessa area») → punteggio (primario + sfumatura) → esclusione secca dei non pertinenti → cap dei riempitivi, §26.56–§26.63), **`lib/provaRadarEngine.ts`** + **`lib/provaRadar.ts`** (Radar di prova: **si prova con la SOLA provincia**, maglie larghe sulle categorie + memoria della provincia provata, §26.61), **`lib/filtriScuole.ts`** (liste scuole preferite/escluse + **ambito provinciale dei suggerimenti** con forzatura dichiarata, §26.62) + **`lib/materieClassi.ts`** (materie coperte dalle classi di concorso, derivazione unica Admin/Radar, §26.62), **`lib/nomeIstituto.ts`** + **`lib/liveBoard.ts`** (gate dei nomi d'istituto in vetrina: mai codici o stringhe grezze in bacheca; finestra 60 giorni per gli avvisi che la fonte non data, con `scadenza: null` + `senzaScadenza`; `diversificaProvince`, round-robin per provincia) — puri, coperti da `npm run test:matching`, `test:radar`, `test:sostegno`, `test:interpello-scadenza`, `test:prova-radar`, `test:board`, `test:board:scala`, `test:board:filtro`, `test:nome-istituto`, `test:riempitivi`, `test:filtri-scuole`, `test:admin:utente`, `test:scoring`, `test:modali`, `test:compatibilita:graduata`, `test:jolly`, `test:compatibilita`, `test:opportunita` |
| **Pipeline di Scraping** | `scraper/{index,parser,elenchi,fonti,fontiRegistro,fontiCopertura,hub,qualitaOpportunita,channelLog,adminAlerts,storicoContatti,tailoringInterpelli}.ts` + `.github/workflows/{scraper,pulisci-scaduti}.yml` + `scripts/{pulisci-scaduti,arricchisci-interpelli,audit-dati,verifica-fonti-scraper}.ts` — **isolata dal dominio Notizie** (guardia `npm run test:scraper:domini`): il registro fonti copre i capoluoghi di regione e gli hub USR/USP, il gate di conformità esclude contenuti editoriali e atti informativi |
| **Sistema di Notifica** | `lib/telegram.ts` (bot + canali), `lib/resend.ts` (email), `lib/notifier.ts` (dispatch + dedup), `lib/digest.ts` (batch giornaliero), `lib/{dedupAvvisi,frequenzaNotifiche,planLimits,emailScuola,alertInterpello,tailoringContatti}.ts`, Edge `supabase/functions/send-notification`, workflow `digest.yml` + `health-check.yml` (**monitor** `scripts/admin-health-check.ts` + `scripts/lib/{saluteDispatch,avvisiNotificabili}.ts`, §26.66) |

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

### 4.7 Admin — `src/departments/admin/` (24 file · ~3,4k righe)

`tabs/{TabUtenti,TabRadar,TabAccount}` + `tabs/utenti/**` (tabella, barra filtri,
dettaglio, modali) + `components/{TabDipartimenti, TabEmailAutomazioni,
RigaAutomazione, AutomazioniInterruttore, PannelloCopyAutomazione,
automazioniSupporto, **PreferenzeUtente** (+ derivazione pura
`derivaPreferenzeUtente`)}` — le preferenze del Radar (ordini di scuola, classi,
materie, tag, province, scuole) in **un solo blocco** per la scheda del tab
«Utenti» e la card del tab «Radar» (§26.54). Feature flags e automazioni email +
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
| 🎯 Pure Focus (`purefocus`) | `on` | servizio partner pubblico (wordmark ufficiale + badge «Incluso nel piano PRO» su homepage, `/prezzi` e `/dashboard/purefocus`) |
| 🎓 Calcolatore CFU (`cfu`) | `off` | nessuna tab/link; `/calcolatore-cfu` e `/dashboard/calcolatore-cfu` mostrano la pagina «in arrivo» |
| 📁 Modulistica (`modulistica`) | `off` | nessuna tab/link (anche nel menu utente e nel footer); `/moduli` e `/dashboard/moduli` dietro il gate |
| 🎁 Invita un Collega (`referral`) | `off` | nessuna tab; `/dashboard/invita` dietro il gate |
| 📄 Crea CV (`cv_builder`) | `off` | nessuna tab; `/dashboard/cv` dietro il gate |

Per riaprire un dipartimento: pannello Admin (per il browser corrente) oppure
`FEATURE_<DIPARTIMENTO>=on` per i processi server-side, oppure si cambia lo
`statoBase` nel codice. Guardia automatica: `npm run test:flags` verifica che la
superficie pubblica sia **esattamente** `radar` + `purefocus`.

**Compatibilità Node-only (03/10/2026, §26.41).** `features.ts` è importato anche dal
programma TypeScript dello **scraper** (`tsconfig.scraper.json`: `lib` senza DOM), quindi
non deve usare identificatori del browser: la sincronizzazione fra schede accede a
`addEventListener` via **`globalThis` tipizzato** invece di `window`. Prima il file non
compilava lì, `npm run scrape:check` usciva in errore e il workflow dello scraper si
fermava **prima** di scrapare (nessun interpello nuovo → nessuna notifica).

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

**Visual Editor "click-to-edit" (DEV)** — l'unico strumento di editing testuale della DEV Toolbar
(§26.37 di `SYSTEM_HANDOVER.md`): badge in **basso a sinistra** (`App.tsx` monta
`components/dev/VisualEditorProvider.tsx` dentro il router), si accende, si passa il puntatore su
un blocco (anello di evidenziazione) e si **clicca il testo** per riscriverlo in una casella
accanto. Chiave del blocco = tag + impronta del testo **di default** + occorrenza
(`p#1qwwa4q#0`), store **per rotta** (`localStorage: sr_visual_editor:<rotta>` + indice
`sr_visual_editor:_rotte` + flag `sr_visual_editor_attivo`): la modifica sopravvive al refresh e
alla ri-renderizzazione di React (la riscrittura tocca solo il valore dei nodi di testo,
`MutationObserver` a 60 ms). Azioni: ripristino del singolo blocco, azzeramento della pagina o di
tutte le rotte, esportazione del testo e del JSON. Vale **solo** in sviluppo: in produzione il
provider non monta nulla. Guardia: `npm run test:visual-editor` (2 script, 22 + 26 asserzioni, in
`npm test`).

Il **vecchio pannello «Editor Testi Rapido»** (`src/components/EditorTestiRapido.tsx`: caselle
laterali con una textarea per blocco del DOM, §26.27–§26.31) è stato **rimosso il 03/10/2026**
(§26.38): con lui se ne sono andati la scansione del DOM (`lib/testiDom.ts` +
`lib/testiDomOverride.ts`, store `sr_dom_text_overrides`), l'hook `hooks/useTestiDom.ts`, il
registro delle viste `lib/testiInPagina.ts` (+ `useTestiInPagina`) e le guardie `test:editor-testi`
(4 script). Di quella macchina restano solo le utilità che il Visual Editor riusa
(`lib/testiDomRegole.ts`: `normalizzaTesto`/`impronta`/`chiaveTestoDom`/`campoDi`;
`lib/testiDomNodi.ts`: `NodoDom`/`etichettaDove`) e l'helper di test `scripts/lib/dom-finto.ts`.
Il **registro con chiave** resta invece il livello "preciso" delle pagine e copre oggi le **8 FAQ
pubbliche** (`pages/FAQPage.tsx` e la sezione «Domande frequenti» di `pages/PrezziPage.tsx`:
elenco unico in `data/faqPubbliche.ts`, selezione editoriale in §26.29 di `SYSTEM_HANDOVER.md`) e i
3 blocchi dell'offerta PRO della homepage (`components/landing/LandingOffertaPro.tsx`), con gli
override di `sr_simple_text_overrides` attivi **solo** in sviluppo: da quando il pannello non c'è
più nessuno li scrive, e «Reset dati / LocalStorage» della DEV Toolbar li ripulisce. Guardia del
livello per chiave: `npm run test:testi-chiave` (registro, copy, store, pagine, e verifica in
negativo che il pannello non sia tornato). Della pagina Prezzi (🔒 `LOCKED_MODULES.md`) è cablata
la **sola sezione FAQ** — intervento autorizzato il 29/09/2026 — mentre piani, importi e vantaggi
restano nel file.

**Visual Editor (DEV)** — dev tooling condiviso (§26.37 di `SYSTEM_HANDOVER.md`), accanto all'Editor
Testi Rapido ma con UX opposta: **click-to-edit**. Si accende dal badge in basso a sinistra, si passa
il mouse sulla pagina (anello tratteggiato sul blocco sotto il puntatore) e si **clicca il testo**:
si apre la casella e si scrive sul posto. Moduli: `src/lib/visualEditorRegole.ts` (puro: blocco =
testo contiguo — `<p>Vedi <strong>qui</strong></p>` è una casella sola; fuori pannelli DEV,
`contenteditable="false"` e il monitor «Radar Live»; riscrittura che tocca **solo il valore dei nodi
di testo**, spazi di bordo conservati, nessuna scrittura se il testo non cambia),
`src/lib/visualEditorScansione.ts` (scansione + indici `WeakMap` elemento→blocco e `Map`
chiave→elemento), `src/lib/visualEditorStore.ts` (store **per rotta**: `sr_visual_editor:<rotta>`
`chiave → { d, v }`, indice `sr_visual_editor:_rotte`, flag `sr_visual_editor_attivo`; letture
tolleranti), `src/hooks/useVisualEditor.ts` (`MutationObserver` con attesa 60 ms, click in cattura) e
`src/components/dev/VisualEditor{Provider,Pannello,Casella}.tsx` + `visualEditorUi.ts` — montato in
`src/App.tsx` dentro `BrowserRouter`, **in produzione non monta nulla**. Chiave del blocco =
`tag#impronta(testo di default)#occorrenza` (`p#1qwwa4q#0`), calcolata sul **default del codice** e
tenuta in `WeakMap`: l'override sopravvive a reload e ri-render. Azioni: ripristino del singolo
blocco, azzeramento della pagina o di tutte le rotte, esportazione del testo («era»/«ora», pronto da
riportare nei componenti) e del JSON completo. I comandi vivono **tutti nel badge** (conteggio,
Esporta, Azzera, Azzera tutte, Esci): il pannello flottante che a vuoto ripeteva le istruzioni
(«Modifica i testi della pagina / Clicca un testo…») è stato **eliminato** il 03/10/2026 (§26.40),
insieme a lui nessun testo d'aiuto — restano la casella di modifica e la scheda di esportazione.
Guardia `npm run test:visual-editor` (due script,
`test-visual-editor.ts` 22 asserzioni + `test-visual-editor-store.ts` 26, entrambi in `npm test`).

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
| `E-DIM` | 41 | `modulistica/creator/cacheService.ts` 3.127 · `data/moduliOrdiniScuola.ts` 2.710 · `lib/notifier.ts` 2.000 · `scraper/index.ts` 1.747 · `notizie/services/relevanceEngine.ts` 815 | alta |
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
| 2026-09-29 | **Coda di scansione regionale (`scan_targets`)**: nuova migrazione `20260929102443_create_scan_targets_queue.sql` (tabella + enum `scan_status`, 3 RPC `security definer` riservate al `service_role`, RLS, seed di 21 città), wrapper `lib/queue.ts` (③, `claimScanTarget`/`finishScanTarget`/`reapStuckScans`) e guardia `npm run test:coda` (`scripts/test-coda-scansione.ts`). La migrazione **non è ancora applicata** al progetto Supabase: dettagli, contratto delle RPC e comando di push in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.21 |
| 2026-09-29 | **Ingestione: nome istituto dalla fonte.** Nuovo `scraper/scuolaDaRiga.ts` (legge la colonna accanto al codice meccanografico, valida col gate: **18/18 righe reali** lette, prima 0) + `parser.ts` che non lascia più entrare etichette di materia in `school_name`; corretto nel gate `RE_SIGLA_SOSTEGNO` (era `/^A[DS][A-Z]{2}$/`: scartava come «sostegno» il toponimo **ASTI**, quindi `I.C. VILLAFRANCA D'ASTI` non entrava in vetrina) e il marcatore «corso» (tagliava `I.C. CUNEO CORSO SOLERI`). Guardia `npm run test:scuola-riga` (in `npm test`). **Backfill da fare**: le righe già in banca dati non si aggiornano da sole — dettagli in §26.23 |
| 2026-09-29 | **Bande di urgenza del «Radar Live»**: nuovo modulo puro `lib/urgency.ts` (`calcolaUrgenza`: concluso · scade oggi · ultime 48h · entro 3 giorni · entro 7 giorni · in corso, con i giorni calcolati da `scadenza.ts`, mai duplicati) cablato in `FlightBoardInterpelli`, guardia `npm run test:urgenza` (in `npm test`) e regola corrispondente in `comunicazione/04_canali_regionali`. Misurato sui dati reali: le 10 righe presentabili hanno **tutte** banda «In corso», quindi il tabellone è verde mono-banda finché non migliora l'ingestione (scuola/titolo) — dettagli in §26.22, insieme allo **schema drift** della RPC `radar_live_page` (viva in produzione, assente dalle migrazioni: non ancora usata dal frontend) |
| 2026-09-29 | **Backfill dei nomi istituto su `interpelli`** (dati, non codice): nuovo `scripts/backfill-nomi-istituto.ts` (dry-run di default, `--apply`) + `scripts/lib/scuolaDaPagina.ts` (risoluzione titolo → fonte accanto al codice → registro, con gate e budget di rete), npm script `dati:backfill-scuole`. Eseguito: **8 righe su 58 arricchite** (`school_name` 0 → 8 presentabili) e tabellone «Radar Live» da mono-banda verde a **4 bande** (ultime 48h · entro 3g · entro 7g · in corso). Restano 50 righe fuori vetrina (nessun codice meccanografico nell'aggregatore). Il run completo `npm run scrape` **non è stato lanciato** (pubblica su canali reali e comunque non aggiornerebbe le righe esistenti): dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.24 |
| 2026-09-30 | **«Radar Live» su scala nazionale.** Il tabellone leggeva con `.gte('expiration_date', oggi)`: le righe **senza scadenza** (565 delle 623 in tabella) non arrivavano mai in pagina — **58 visibili** — e `preparaRigheBoard` era rotto (`pronte.put(...)`, `TS2339`). Ora: filtro a doppio ramo `radar/flightBoard/filtroAttivi.ts` (scadenza futura **oppure** senza scadenza entro 60 giorni, data **locale**) usato anche dal conteggio, lettura a `LIMITE_RIGHE_LETTE = 1.000` con `created_at DESC` + `expiration_date ASC` *(scala superata il 02/10/2026: la bacheca legge a pagine, §26.34)*, `RigaBoardCompleta.scadenza: string \| null` + `senzaScadenza` (mai una data inventata: banda «Scadenza n/d» + data di pubblicazione) e `diversificaProvince` (round-robin per provincia: prima pagina con **5/5** province diverse, prima 7/10 da una sola). **69 righe presentabili** (erano 17), tabellone da 4 a 14 pagine. Guardie nuove `npm run test:board:scala` e `npm run test:board:filtro` (in `npm test`). Dettagli e misure reali in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.25 |
| 2026-10-02 | **«Radar Live» senza tetto di lettura.** `LIMITE_RIGHE_LETTE` è stato rimosso: la bacheca leggeva con una richiesta sola, e PostgREST non consegna più di 1.000 righe, quindi con l'ordinamento per pubblicazione decrescente il taglio cadeva in silenzio sulle righe più vecchie. Ora `radar/flightBoard/letturaBoard.ts` legge a PAGINE (`leggiTutteLePagine`: l'offset avanza di ciò che il server ha davvero consegnato, la fine la dichiara una pagina vuota o il conteggio esatto, doppioni scartati per `id`, guardia anti-anello a 50 pagine) e il componente ordina `created_at DESC` → `expiration_date ASC` → `id` (senza un ultimo criterio univoco l'ordinamento non è totalizzabile e la paginazione può ripetere o saltare righe), con errori in `console.warn`, mai muti; `metricaBoard.ts` non ha più un tetto. Il vecchio `rigaBoard.tsx` è stato diviso in `rigaBoardDati.ts` (dati derivati) + `components/RigaBoard.tsx` (rendering identico, verificato prima di cancellare il file). Allineata anche la banda `sconosciuto` di `lib/urgency.ts` (slate chiaro, come da §26.22). Guardie in `npm test` (`npm run test:board:lettura`); l'entry `E-DIM` di `FlightBoardInterpelli.tsx` è uscita dalla baseline d'architettura. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.34 |
| 2026-09-29 | **DEV Toolbar: «Editor Testi Rapido» UNIVERSALE** (dev tooling condiviso: nessun file di dipartimento toccato). Il pannello non elenca più le chiavi del dizionario: **scandisce il DOM** della pagina attiva (`lib/testiDom.ts` + `testiDomNodi.ts` + `testiDomRegole.ts` + `testiDomOverride.ts`, hook `hooks/useTestiDom.ts`, montato **sempre** in DEV dalla DevToolbar) e mostra una casella per ogni blocco di testo che la pagina ha a schermo (titoli, paragrafi, voci, celle, pulsanti…), con etichetta umana del punto, tag, rotta e conteggio. Scrivendo, il testo cambia subito e l'override va in `localStorage: sr_dom_text_overrides` (`chiave → { t, v }`): la chiave è tag + impronta del testo + occorrenza (**non** posizione nel DOM), quindi l'override sopravvive a reload e ri-render di React (riapplicato dalla scansione, `MutationObserver` con attesa 60 ms). «Reset testi» azzera i due livelli (DOM + registro). Guardie: `npm run test:editor-testi` = 4 script (nuovi `test-editor-testi-dom.ts` e `…-cablaggio.ts`, con l'helper `scripts/lib/dom-finto.ts`). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.31 |
| 2026-10-03 | **DEV Toolbar: «Visual Editor» — click-to-edit sui testi** (dev tooling condiviso: nessun file di dipartimento toccato). Accanto all'Editor Testi Rapido, con UX opposta: **non** elenca le chiavi, si accende dal badge in basso a sinistra, evidenzia il blocco sotto il puntatore e si modifica **cliccando il testo** sulla pagina. Moduli nuovi `lib/visualEditorRegole.ts` (blocco = testo contiguo, riscrittura che tocca solo il valore dei nodi di testo → React-safe, spazi di bordo conservati), `lib/visualEditorScansione.ts` (scansione + indici `WeakMap`/`Map`), `lib/visualEditorStore.ts` (store **per ROTTA**: `sr_visual_editor:<rotta>` + indice `sr_visual_editor:_rotte` + flag `sr_visual_editor_attivo`, letture tolleranti), `hooks/useVisualEditor.ts` (`MutationObserver` 60 ms, click in cattura), `components/dev/VisualEditor{Provider,Pannello,Casella}.tsx` + `visualEditorUi.ts` (montati in `App.tsx` dentro `BrowserRouter`, **nulla in produzione**; pannello in basso a sinistra, `Esc` chiude prima la casella e poi l'editor). Chiave del blocco = tag + impronta del testo **di default** + occorrenza (`p#1qwwa4q#0`, default tenuto in `WeakMap`), quindi l'override resta agganciato anche dopo il refresh e la ri-renderizzazione. Azioni: ripristino del singolo blocco, azzeramento della pagina o di tutte le rotte, esportazione del testo («era»/«ora») e del JSON. Guardie nuove `npm run test:visual-editor` (2 script, 22 + 26 asserzioni, inclusi in `npm test` subito dopo `test-editor-testi-vista`). Verifiche: `typecheck` ✓ 0 errori · `test:architettura` ✓ nessuna violazione nuova (570 file, 142 = baseline) · `eslint` ✓ 0 sugli 11 file toccati · `build` ✓ 6,25 s · `npm test` si ferma in `&&` a `test:live-board` (3 errori, debito preesistente §26.30/§26.31). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.37 |
| 2026-10-03 | **DEV Toolbar: rimosso il vecchio pannello «Editor Testi Rapido» — resta il solo «Visual Editor»** (dev tooling condiviso: nessun file di dipartimento toccato). La sezione collassabile che elencava i blocchi del DOM con una casella per blocco (`components/EditorTestiRapido.tsx`, §26.27–§26.31: dove la copy è spezzata in più elementi inline — «Pure» + «Focus» — comparivano caselle separate) è stata **eliminata**, per non avere due strumenti che riscrivono gli stessi testi. Con lei se ne sono andati `lib/testiDom.ts` + `lib/testiDomOverride.ts` (store `sr_dom_text_overrides`), `hooks/useTestiDom.ts`, il registro delle viste `lib/testiInPagina.ts` (+ `useTestiInPagina`) e le guardie `test:editor-testi` (4 script). Potati del codice morto e conservati i moduli riusati dal Visual Editor: `lib/testiDomRegole.ts` (61 righe: `normalizzaTesto`/`impronta`/`chiaveTestoDom`/`campoDi`) e `lib/testiDomNodi.ts` (41: `NodoDom`/`etichettaDove`), più l'helper `scripts/lib/dom-finto.ts` (65). Il livello «con chiave» delle pagine resta (FAQ pubbliche, sezione FAQ di `/prezzi`, vetrina PRO) con gli override `sr_simple_text_overrides` validi solo in sviluppo e ripulibili da «Reset dati / LocalStorage». Guardia aggiornata: `test-editor-testi.ts` → `scripts/test-testi-chiave.ts` (`npm run test:testi-chiave`, in `npm test`), che verifica anche in negativo l'assenza del pannello. Verifiche: `typecheck` ✅ 0 errori · `test:testi-chiave` ✅ · `test:visual-editor` ✅ · `test:architettura` ✅ nessuna violazione nuova (562 file, 142 = baseline) · `eslint` ✅ 0 problemi sugli 11 file toccati · `build` ✅ 7,61 s. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.38 |
| 2026-10-03 | **«Radar Live»: la vetrina torna alla direttiva di §26.20 (fine del drift della «dicitura standard»)** — dipartimento **Radar**. Il commit `56c6d0d` (02/10, «public radar production sync») aveva tolto da `preparaRigheBoard` lo scarto delle righe senza nome d'istituto in chiaro, sostituendolo con la dicitura di riempimento «Scuola non specificata / Più plessi» (regola mai documentata): la catena `npm test` si fermava a `test:live-board` (3 errori) e, **dietro la `&&`**, `test:nome-istituto` (2 errori: l'ente emittente di `nomePresentabileRiga` era diventato codice morto e `rigaPresentabileVetrina` tornava sempre `true`, disattivando il filtro del responso della prova). Ripristinata la regola cliente di §26.20: `nomeScuolaRiga` torna `string \| null`, `preparaRigheBoard` riapplica `if (!scuola) continue;`, `nomePresentabileRiga` torna `string \| null` con l'ente emittente come ultima risorsa. **Nessun test modificato** (le guardie erano già corrette). Verifiche: `test:board` ✅ 17/17 · `test:nome-istituto` ✅ 28/28 · **`npm test` ✅ exit 0, catena completa verde** (59 comandi) · `typecheck` ✅ · `test:architettura` ✅ nessuna violazione nuova (562 file, 142 = baseline) · `eslint src/lib/liveBoard.ts` ✅ 0 · `build` ✅. Unico file di codice: `src/lib/liveBoard.ts`. **SUPERATA dalla §26.47 del 04/10/2026**: lo scarto delle righe senza nome è revocato — quel gate è la causa dei 10 annunci di Padova. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.39 e §26.47 |
| 2026-10-04 | **Radar Personale sui dati reali · sostegno invisibile · campi di ricerca separati · copy delle notifiche (§26.46)** — dipartimento **Radar** + condivisi essenziali + modulo di notifica. **(1)** Verificato e documentato il flusso bacheca ↔ DB: tabella `interpelli` via Matching Engine (`in(province)` + `overlaps(class_codes)` con varianti `A-022 ≡ A-22 ≡ A22`), fallback legacy `notices`, altrimenti **feed vuoto** (nessun mock: `src/data/interpelli.ts` è `[]`); aggiunta l'inclusione forzata del **sostegno** nel feed mediante la stessa regola delle notifiche (`avvisoDiSostegno`) — bacheca e notifiche non divergono più. **(2)** Rimosso del tutto il blocco «Opportunità di sostegno» da `preferenze/PannelloClassi.tsx`: inclusione permanente e **invisibile**, nessun interruttore/nota. **(3)** Campi di ricerca di nuovo **separati**: nuovo modulo `lib/ricercaTesto.ts` (normalizzazione, materie correlate, ordine di scuola, parole chiave) ri-esportato da `lib/ricercaSelezioniRadar.ts`; nuova `cercaCompetenzeParole()` — la colonna di destra non restituisce più classi (niente doppioni), il wizard resta unificato; il filtro classi risponde anche a materia («italiano») e ordine («CPIA», «adulti», «primaria»). **(4)** Copy notifiche: etichetta del link di fonte **«Guarda la fonte ufficiale»** su email/Telegram/Edge/anteprima Admin (unica stringa `ETICHETTA_AVVISO_UFFICIALE`, URL solo della fonte esterna), incipit caldo delle email di opportunità (`FRASE_OPPORTUNITA`), recapito email/PEC della scuola sempre presente nel blocco (derivato dal codice meccanografico, gate di qualità). Guardie: `test:ricerca` + nuovo `scripts/test-ricerca-cablaggio.ts`, `test:copy:pubblico`, `test:copy`, `test:email`, `test:link`, `test:email-alert`, `test:email-template`, `test:digest`, `test:telegram:template`, `test:promemoria`, `test:qualita`. Doc: `SYSTEM_HANDOVER` §26.46, `DEPARTMENT_MAP`, `comunicazione/**`. |

| 2026-10-03 | **Visual Editor senza pannello-guida · «In cosa puoi lavorare» col profilo REALE · ricerca estesa per sinonimi.** Tre interventi chiusi insieme: (1) dev tooling — il pannello flottante del Visual Editor che a vuoto mostrava «Modifica i testi della pagina / Clicca un testo…» è stato **eliminato**: i comandi stanno tutti nel badge (conteggio, **Esporta**, **Azzera**, **Azzera tutte**, **Esci**) e restano solo la casella di modifica e la scheda di esportazione (`components/dev/VisualEditorPannello.tsx`); (2) profilo — la casella «In cosa puoi lavorare» mostrava una dicitura FISSA («Classi di Concorso Monitorate (A-22, A-11, ecc.)»), uguale per tutti: ora la riempie **`RiepilogoLavoro`** (`departments/radar/components/`, nuovo, esportato da `radar/index.ts`) con classi di concorso, competenze e parole chiave REALI dal contesto, e con lo stato vuoto che porta al Radar (`pages/ProfiloPage.tsx` monta il componente al posto del markup statico); (3) ricerca — nuove **`materieRicercabili()`** (competenze extra PIÙ i tag PNRR/PON che sono disciplinari: «Lingua inglese», «Educazione motoria e sportiva») e **`CORRELAZIONI_MATERIE`** (co-occorrenze curate) in `data/ordiniMaterie.ts`, con `materieCorrelate`/`materiaCorrelata` in `lib/ricercaSelezioniRadar.ts`: digitando «Inglese» escono anche CLIL ed educazione linguistica, «Coding» anche robotica e competenze digitali, e la parola chiave libera non è più riproposta quando la voce esiste in catalogo (sonda sui moduli reali, prima/dopo: 0 → 3 competenze per «inglese»). Guardie aggiornate: `test:ricerca` (6 asserzioni nuove) e `test:radar:preferenze` (allineata a `materieRicercabili()`). Verifiche: `typecheck` ✅ 0 · **`npm test` ✅ exit 0, catena completa verde** (59 comandi) · `test:architettura` ✅ nessuna violazione nuova (563 file, 142 = baseline) · `eslint` ✅ 0 problemi sugli 8 file toccati · `build` ✅. Incluse due **diagnosi** (non risolte: richiedono l'ingestione, fuori perimetro): notifiche Telegram/email che non partono (gate qualità strict × `contact_email` presente su 325/609 righe, nessun interpello nuovo dal 29/09) e «Radar Live» ridotto a poche decine di annunci (`school_name` presentabile 19/609: i titoli delle fonti sono dump di codici di classe). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.40 |
| 2026-10-03 | **Anagrafica NAZIONALE delle scuole (SCUANAGRAFE) su tutte le superfici + guasto di produzione delle notifiche risolto** (sblocco esplicito su `src/scraper/**`). Le fonti pubblicano solo codici e la tabella `interpelli` non aveva nome/recapito: la vetrina scartava quelle righe (§26.20) e il gate di qualità le escludeva (§26.40). Ora i 4 file ufficiali — `SCUANAGRAFESTAT`, `SCUANAGRAFEPAR`, `SCUANAAUTSTAT`, `SCUANAAUTPAR` — alimentano un indice per **codice e nome**: moduli nuovi solo-Node `lib/anagraficaCsv.ts` (parser RFC4180, `chiaveCodiceScuola` **permissiva** perché i codici delle paritarie `UD1A036009` non passano la convenzione MIM statale, `chiaveProvincia` che ignora i connettivi «MONZA E BRIANZA» ≡ «Monza e della Brianza», PEO/PEC in minuscolo), `lib/anagraficaIndice.ts` (scoperta per prefisso in `SCUOLERADAR_ANAGRAFICA_DIR`, indice `perCodice`/`perIstituto`/`perNome`, cache di processo: ~13 MB), `lib/anagraficaScuole.ts` (superficie pubblica: `scuolaDaCodice`, `scuolaDaNome` solo se univoco — con provincia e ripetendo senza la sigla iniziale —, `nomeDaAnagrafica` dal gate §26.20, `arricchisciDaAnagrafica` → patch `{ school_code, school_name, contact_email, school_pec }`, mai sovrascritture) e il ponte `scraper/anagraficaInterpelli.ts` (righe complete all'inserimento + riepilogo nel run); `arricchisci-interpelli.ts` esteso (pagine, `--no-anagrafica`, `--apply`, tolleranza alla colonna mancante), migrazione nuova `20261003120000_add_interpelli_school_pec.sql` (opzionale e tollerata), guardia nuova `npm run test:anagrafica` (25 asserzioni, ultimo comando di `npm test`). **Misure reali**: 62.850 codici da 4 file (50.273+11.331+1.178+68) · 142 righe risolte per codice · **91 righe aggiornate** · vetrina **da 66 a 157 righe** (school_name presentabile 19 → 110, tabellone 10,8% → **25,8%**). **Guasto trovato**: `npm run scrape:check` falliva da giorni (`src/config/features.ts` usava `window`, assente nella `lib` Node-only dello scraper) e `.github/workflows/scraper.yml` esegue quella validazione PRIMA di scrapare: il workflow moriva lì, nessun interpello nuovo entrava (ultimo `created_at` 29/09) e non c'era nulla da notificare. Ora usa un `globalThis` tipizzato → `scrape:check` ✅ exit 0. Verifiche: `typecheck` ✅ 0 · `scrape:check` ✅ 0 · **`npm test` ✅ exit 0** (60 comandi) · `test:architettura` ✅ nessuna violazione nuova (567 file, 142 = baseline: moduli lunghi spezzati in 3 file) · `eslint` ✅ 0 sugli 8 file toccati · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.41 |
| 2026-10-03 | **`interpelli.school_pec`: migrazione applicata in produzione + misura reale della PEC della fonte** — dipartimento **Radar** (dati e condivisi essenziali già sbloccati). `supabase migration list --linked` mostrava **una sola** migrazione pendente (proprio `20261003120000_add_interpelli_school_pec.sql`, le altre 59 già remote): `supabase db push --project-ref gwdmsgsshvdnfrplbjiv` → applicata; verifica in sola lettura via PostgREST (`select=school_pec` → `200`; prima `42703 column interpelli.school_pec does not exist`). `npm run dati:arricchisci -- --apply` sulle 609 righe → **0 righe aggiornate**: tutto il colmabile era già scritto dal run precedente (142 righe risolte per codice, 91 aggiornate) e la colonna presente tiene `pecDisponibile=true` (nessun fallback silenzioso). **Misura che spiega «PEC aggiunte 0»** (conteggio sui file reali): `SCUANAGRAFESTAT` ha la PEC **«Non Disponibile» in 50.271 righe su 50.273** (2 vere), le autonomie statali 29 su 1.178, le **paritarie 7.048 su 11.331**; i **76** codici distinti presenti in `interpelli` **non intersecano** nessuna paritaria con PEC (**0**) → nessuna scrittura, non un percorso rotto. **Decisione confermata**: la PEC **non** si ricostruisce per convenzione quando la PEO esiste (`comunicazione/01_email_riepilogo/checklist_email.md` §6 lo vieta) → `school_pec` resta NULL per le statali, comportamento conforme. Verifiche: `npm run typecheck` ✅ 0 · **`npm test` ✅ catena completa verde** (60 comandi, 0 marker di errore). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.41 (aggiornamento in coda) |
| 2026-10-03 | **Bacheca «Radar Live»: schermate ESATTE (`Schermata X di Y`), via il `+` e la dicitura fissa** — dipartimento **Radar** (+ la regola di prodotto in `comunicazione/**`). L'etichetta sotto il tabellone mostrava `Pagina 1 di 32+ - Aggiornamento automatico`: il `+` non aggiungeva informazione e sembrava un tetto. Ora `etichettaPagina(pagina, pagine)` → **`Schermata X di Y`**, con `Y` = righe in vetrina ÷ 5 arrotondato per eccesso; `MetricaBoard.oltreIlLimite` **rimosso** e `FlightBoardInterpelli` che prende la scala da `pagineBoard(...)` (la stessa funzione usata dall'etichetta: etichetta, rotazione e taglio delle righe parlano di un solo numero, e `X` è sempre ≤ `Y`). **Misure reali del 03/10**: `interpelli` 609 righe tutte attive e con fonte → badge «609 avvisi attivi in Italia»; righe presentabili in vetrina (§26.20) **157** → **«Schermata X di 32»** (mai «122»: il tabellone mostra 157 avvisi). Aggiornata `checklist_regionali.md` §4 (conto esatto, nessun `+`) e il test `test:board:metriche`. **Test REALE dei canali** (nessun mock): `npm run test:notifiche` → email Resend inviata a `bartoloansaldi@gmail.com` + Telegram inviato alla chat configurata (bot `ScuoleRadar_bot` verificato con `getMe`/`getChat`); il motore di dispatch (`admin-dispatch-user --dry-run` e `notifiche:digest -- --force --dry-run`) elabora correttamente i profili notificabili — **1 su 8** (`free_forever`, `AT`, `A-22`/`A-24`, Telegram collegato) — e scarta l'unica opportunità compatibile col gate di qualità («recapito di candidatura mancante») → 0 invii, come da progetto. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.42 |
| 2026-10-04 | **Notifiche (Telegram + email): header email testuale, un solo pulsante di fonte, riga di fonte garantita su Telegram, email aggregate** — nessun dipartimento (solo `src/lib/**` + moduli di notifica + guardie + regole di prodotto). **(1)** `src/lib/resend.ts` e la Edge `send-notification`: rimosso **definitivamente** il logo-immagine dalle email (arrivava compresso/sgranato) → intestazione `Scuole Radar.it` **solo testo**, cliccabile verso `scuoleradar.it` (`URL_BRAND`). **(2)** `fonteInEvidenza()` non duplica più la dicitura del bottone CTA: è **un unico pulsante** per voce; la card dell'alert non ha più il secondo link (dicitura + URL **una volta sola**). **(3)** `src/lib/telegram.ts`: la riga `👉 Apri l'avviso ufficiale` si costruisce sull'**URL grezzo** della voce con **un solo gate** (`eUrlAvvisoDiretto`): non può più sparire e non c'è fallback alla home di ScuoleRadar. **(4)** `src/lib/notifier.ts`: i percorsi di dispatch/backfill (`notificaNuoviInterpelli`, `notificaInterpelliPerUtente`) **non mandano mai N email** — accumulano le voci (`accumulaVoceEmail`) e consegnano **UNA sola** email di riepilogo via `inviaDigestEmail` (`EsitoDispatchUtente.emailVoci`); Telegram resta individuale. Guardie nuove in `npm run test:copy` (nessun `<img>`/`logo.png` nei renderer email · nessuna `inviaNotificaEmail(` nel notifier). Verifiche: `typecheck` ✅ 0 · `npm test` ✅ catena verde · `test:architettura` ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.44 |
| 2026-10-04 | **Pipeline Radar tollerante e blindata: bonifica dei mock, anagrafica `completo`/`parziale`, matching RPC nativo** — condivisi (`src/lib/**`, `src/data/**`, `src/scraper/**`), dipartimento **Radar** (`flightBoard/**`, `FlightBoardInterpelli.tsx`), migrazioni. Tre interventi: **(1) BONIFICA** — rimosso l'unico generatore di dati fittizi in codice di produzione, `resolveSchoolByCode` in `src/lib/school-lookup.ts` (fabbricava «Istituto &lt;codice&gt;», città `N/D`, PEO e PEC per QUALSIASI codice; usato dallo scraper per l'email): il recapito ora nasce solo dalla convenzione MIM (`emailDaCodiceMeccanografico`), e con lui se ne va il codice morto di `radar/flightBoard/righeBoard.ts` (`risolviNomeScuola` con la dicitura fissa «Scuola non specificata / Più plessi», `eInterpelloVisibile`). Feed di fallback `[]` e scraper che, a zero risultati, **logga e si ferma** (nessun seed). **(2) ARRICCHIMENTO TOLLERANTE** — migrazione nuova `20261004100000_add_interpelli_stato_arricchimento.sql` (colonna + `check` `completo`/`parziale` + backfill tollerante sulla presenza di `school_pec`) e modulo puro nuovo `src/lib/statoArricchimento.ts` (`completo` = istituto identificato + recapito): lo stato si scrive a OGNI riga (scraper, in `COLONNE_OPZIONALI`) e si ricalcola in `dati:arricchisci` (ora tollerante a QUALSIASI colonna mancante). **(3) VETRINA E MATCHING** — `preparaRigheBoard` **non scarta più nessuna riga per anagrafica** (caso storico: i 10 annunci di Padova): catena `nomeScuolaBoard` → nome reale → **nome grezzo pubblicato dal bando** (`nomeGrezzoDaBando`, mai dump di codici) → **dicitura gestita «Anagrafica in aggiornamento»**, con marcatore `anagraficaParziale` propagato fino al chip ambra di `components/RigaBoard.tsx`; la direttiva §26.20 è quindi **corretta** (restano fuori solo gli avvisi non vivi) e `checklist_regionali.md` §4 è aggiornata. Matching: migrazione nuova `20261004110000_add_rpc_match_interpelli.sql` con `public.classe_chiave(text)` (forma canonica `A-022 ≡ A22 ≡ A-22`) e **`public.match_interpelli(p_province, p_classi, p_sostegno, p_limit)`** (`security definer` + `search_path`, `stable`): province `= any(array)`, classi **`&&` sull'indice GIN** *più* confronto tollerante, **ramo sostegno ESPLICITO** (non più filtro in memoria tagliabile dal `limit`), `attivo` = senza scadenza o non scaduto; `searchInterpelli` usa la RPC per prima e **ricade sulla query PostgREST equivalente** se la migrazione non è applicata (nessun rilascio rotto). Guardie nuove **`npm run test:pipeline`** e **`npm run test:match-rpc`** (entrambe in `npm test`), `test:board` aggiornata. Verifiche: `typecheck` ✅ 0 · **`npm test` ✅ exit 0, catena verde** · `test:architettura` ✅ nessuna violazione nuova (572 file, 142 = baseline) · `eslint` ✅ 0 sui 13 file toccati · `build` ✅ 11,08 s. Debito pre-esistente dichiarato: `test:dati-fallback` (2 controlli su `editableTexts.ts`, non toccato qui). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.47 |
| 2026-10-04 | **«Radar Live» — etichetta anagrafica della vetrina: «Scuola non specificata / Più plessi»** — condivisi (`src/lib/**`) + dipartimento **Radar** (`flightBoard/**`, `FlightBoardInterpelli.tsx`). La colonna «Scuola» della bacheca mostra, quando l'istituto non è risolvibile in chiaro, il segnaposto neutro **«Scuola non specificata / Più plessi»** al posto della dicitura tecnica «Anagrafica in aggiornamento» (**supera la §26.47**): vetrina pulita, nessun messaggio tecnico/di errore. Costante rinominata `SCUOLA_ANAGRAFICA_IN_AGGIORNAMENTO` → `SCUOLA_NON_SPECIFICATA` (`src/lib/statoArricchimento.ts`, ri-esportata da `liveBoard.ts`); chip ambra di `radar/flightBoard/components/RigaBoard.tsx` allineato (testo + tooltip). L'arricchimento anagrafico **continua in background** identico ma serve SOLO alle notifiche puntuali. Verifiche: `typecheck` ✅ 0 · `test:board` ✅ · `test:pipeline` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.48 |
| 2026-10-04 | **Radar Utente/Admin allineati: provincia asciutta + scheda Admin con ordini e competenze extra (§26.49)** — dipartimenti **Radar** e **Admin** + condivisi (`src/lib/**`, `src/data/**`). **(1)** Pannello «Dove vuoi cercare?» ripulito: rimossi i testi descrittivi sotto al selettore («PRO: puoi monitorare fino a 4 province», la nota sulla provincia principale, la nota condizionale PRO) e la prop `limitiPiano` non più usata. **(2)** Scheda utente del pannello Admin allineata alla vista utente: ordini di scuola nel nome leggibile (`ordiniScuola`), materie/competenze extra nel nome della materia (`etichetteCompetenzeProfilo` da `materie_id`) e **tag personalizzati** (`materie_custom`) in chiaro; tipo `AdminUtente` esteso. Lo schema di salvataggio Radar (`ordini_scuola`/`materie_id`/`materie_custom`) era già completo: nessuna migrazione. **(3)** Verificati (nessuna correzione) la ricerca classi di concorso (codice + nome/materia/ordine) e il motore di matching (RPC + fallback, sostegno permanente, varianti di formato). Guardia nuova `npm run test:admin:utente`. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ · `test:architettura` ✅ · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.49 |
| 2026-10-04 | **Guardie del DIGEST: RPC `match_interpelli` nei client STUB (§26.50)** — nessun dipartimento: solo `scripts/**` + documentazione. Chiusa la **nota di attenzione** di §26.49 (`test:sostegno` rosso). **Causa**: dal §26.47 `searchInterpelli` interroga per prima la RPC nativa `match_interpelli` e accetta qualunque esito senza errore, mentre i client STUB delle guardie rispondevano a TUTTE le RPC con l'esito del contatore notifiche → `raccogliVociCanale` riceveva righe senza i campi di `interpelli` → 0 voci e digest vuoto (tutti i profili `saltati`, 3 su 3). **Codice di prodotto invariato** (in produzione la RPC serve le righe reali, senza migrazione scatta il fallback PostgREST). **Intervento**: in **sei** stub la RPC è ora distinta per nome — `match_interpelli` (costante `RPC_MATCH_INTERPELLI` da `matchingEngine.ts`, nessuna stringa duplicata) serve le righe di `interpelli` del DB simulato, le altre RPC il loro esito — in `test-sostegno-preferenza.ts`, `test-promemoria.ts`, `test-dedup-utente.ts`, `test-telegram-tier.ts`, `test-matching-profilo.ts`, `test-matching-competenze.ts`. **Guardie riportate verdi**: `test:sostegno` (7→0), `test:promemoria` (2→0), `test:dedup:utente` (6→0), `test:telegram:tier` (4→0), `test:matching` (3→0); ricontrollate `test:notifier-dry`, `test:digest`, `test:dedup`, `test:frequenza`, `test:alert`, `test:email`, `test:email-scuola`, `test:email-alert`, `test:link`, `test:link-esterno`, `test:ledger`, `test:qualita`, `test:copy`, `test:telegram`, `test:telegram:template`, `test:telegram:canali`, `test:match-rpc`, `test:radar:preferenze`, `test:automazioni`, `test:migrazioni`. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ exit 0 · `test:architettura` ✅ nessuna violazione nuova (573 file · 142 = baseline) · `eslint` (6 file) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.50 |
| 2026-10-04 | **Guardia `test:dati-fallback`: il link al proprio sito non è una «fonte» (§26.51)** — nessun dipartimento: solo `scripts/**` + documentazione. Chiuso il **debito pre-esistente** dichiarato in §26.47 (2 controlli rossi). **Causa (falso positivo)**: la guardia esigeva `eSorgenteVerificata()` — la regola anti-mock della **pipeline di ingestione**, che respinge per progetto gli host `scuoleradar`/`purefocus` — anche dai due link **reali** del copy FAQ (`https://www.scuoleradar.it/contatti`, in `faq.carta-docente` e `faq.regala-pro-collega`): un link **al** nostro sito non è una fonte **di** avvisi e non può essere un mock. **Intervento**: nel ciclo sugli URL il filtro anti-segnaposto resta per **tutti**; i self-link (`RE_HOST_PROPRIO`, host `scuoleradar.it`/sottodominio) devono essere **deep-link** (mai la root nuda), le fonti esterne passano `eSorgenteVerificata()` come prima — **regole di prodotto intatte**, `src/data/editableTexts.ts` non toccato. 5 controlli-guardia nuovi. Verifiche: `test:dati-fallback` ✅ exit 0 (15/15) · `eslint` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.51 |
| 2026-10-05 | **Preferenze Radar: si scrivono solo per azione esplicita (§26.52)** — dipartimento **Radar** + condivisi essenziali (`src/lib/**`, `src/contexts/app/**`). Classi di concorso, province, competenze, tag e scuole preferite non possono più sparire da sole: la scrittura era **dedotta per differenza** fra due fotografie dello stato, quindi un profilo che arrivava in ritardo (o un refresh) riscriveva i default vuoti della pagina appena aperta. Ora **ogni** handler di `PreferenzeRadar.tsx` marca il campo toccato (`segnaToccato`: ordini, classi, materie, tag, province, Telegram/email, scuole preferite-ignorate) e l'autosave salva **solo** i campi toccati **e** diversi dal valore salvato (`modificheDaSalvare` in `src/lib/preferenzeGuardia.ts`; nessuna scrittura a payload vuoto), mentre l'idratazione dal profilo è **per campo** e salta quelli già toccati (`idrataDaProfilo`: `[]`/`null` non azzerano la scelta locale). Rimossi i troncamenti automatici in schermata (§26.5: i tetti limitano l'**uso**, non i dati). Guardia nuova `npm run test:persistenza:preferenze` (in catena `npm test`) + presidi estesi in `test:radar:preferenze`, `test:province`, `test:piano`. Verifiche: `typecheck` ✅ 0 · guardie dedicate ✅ · `npm test` (catena) ✅ 0 · `test:architettura` ✅ · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.52 |
| 2026-10-05 | **Opportunità: scuola e fonte sempre visibili; gli avvisi senza scadenza escono dopo 60 giorni (§26.53)** — dipartimento **Radar** + condivisi essenziali (`src/lib/**`, `src/data/**`, `src/contexts/**`) + viste condivise (`src/components/**`, `src/pages/interpello/**` — richiesta esplicita dell'utente). **(1) CARD E MODALE** — la card mostra il **link diretto alla fonte ufficiale** accanto a «Vedi dettaglio» (etichetta onesta `etichettaFonteLink`, nuova scheda con `rel="noopener noreferrer"`) e la **scuola emittente** sempre visibile in card, modale e scheda pubblica `/interpello/:id` tramite il componente unico nuovo `src/components/IstitutoEmittente.tsx` (se il bando non ha un nome presentabile → dicitura gestita `SCUOLA_NON_SPECIFICATA`, mai una riga vuota); `InterpelloCard.tsx` (**271 → 183 righe**) è stato spezzato estraendo `src/components/InterpelloDettaglioModal.tsx` (nuovo, 185), e l'eccezione `W-DIM` in `scripts/architettura-baseline.json` è stata **rimossa** (debito 142 → **141**). **(2) FINESTRA DEI 60 GIORNI, REGOLA UNICA** — `src/lib/scadenza.ts` (puro) ospita `GIORNI_FINESTRA_SENZA_SCADENZA = 60`, `dataIsoLocale`, `dataLimiteFinestraSenzaScadenza` e **`eAvvisoVivo(scadenza, pubblicazione)`**: con scadenza → non passata · senza scadenza → pubblicato negli ultimi 60 giorni (per **giorno** di calendario) · senza né l'una né l'altra → non vivo. `liveBoard.ts` e `radar/flightBoard/filtroAttivi.ts` **delegano** al modulo (niente copie locali), il feed della dashboard (`useInterpelliFeed` + nuovo `dataPubblicazione` su `Interpello`) e il fallback PostgREST di `searchInterpelli` usano la stessa finestra, la **RPC nativa** la applica nel database (migrazione nuova `20261005120000_match_interpelli_finestra_senza_scadenza.sql`) e `scripts/pulisci-scaduti.ts` rimuove anche le righe senza scadenza fuori finestra. Guardie: `npm run test:opportunita` (**nuova**, cablaggio card/modale/finestra) + `npm run test:interpello-scadenza` estesa con `eAvvisoVivo`, entrambe in `npm test`. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (578 file · 141 = baseline) · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.53 |
| 2026-10-05 | **Punteggio di compatibilità: soglie 60/70/80, sostegno EXTRA e preferenze Admin complete (§26.54)** — dipartimento **Admin** + Radar (richiesta esplicita dell'utente) e condivisi essenziali (`src/lib/**`, `src/contexts/app/**`, `src/pages/DashboardPage.tsx`, `src/components/**`). **(1) SOGLIE** — modulo puro nuovo `src/lib/compatibilita.ts`: rosso ≥ 60 · arancio ≥ 70 · verde ≥ 80, con `bandaCompatibilita()` (livello, etichetta, tooltip, classi Tailwind) usata dalla card e dalla modale: via il badge cablato al 100%, sotto 60 nessun badge. **(2) PUNTEGGIO** — `punteggioCompatibilita(profilo, avviso)` in `matchingEngine.ts`: 100 classe in comune · 80 materia coperta · 70 solo competenze/parole chiave · **60 area SOSTEGNO senza una classe AD… propria** (l'inclusione resta permanente §26.45: l'opportunità resta in bacheca, ma come consiglio **extra**); `profiloAderisceSostegno` chiarisce che la scelta è una classe AD…, non la colonna legacy `profiles.sostegno`. Il feed (`useInterpelliFeed`) applica il punteggio e `DashboardPage` ordina **compatibilità → scadenza**: i match forti in testa, l'extra in coda. **(3) ADMIN** — blocco condiviso nuovo `admin/components/PreferenzeUtente.tsx` (+ derivazione pura `derivaPreferenzeUtente.ts`), montato nella scheda del tab «Utenti» **e** nella card del tab «Radar» (che non mostrava ordini di scuola né tag). Guardie: `npm run test:compatibilita` (**nuova**, in `npm test`), `test:opportunita` e `test:admin:utente` estese, aspettativa di `test:match-rpc` allineata alla finestra §26.53. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (582 file · 141 = baseline) · `eslint` (13 file) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.54 |
| 2026-10-05 | **Compatibilità graduata: affinità disciplinare, prossimità geografica e cap dei riempitivi (§26.55)** — nessun dipartimento: solo condivisi essenziali e superfici di bacheca, su richiesta esplicita dell'utente (`src/lib/**`, `src/data/interpelli.ts`, `src/contexts/app/**`, `src/components/**`). **(1) PENALITÀ CALIBRATE** — `src/lib/compatibilita.ts` ospita anche lingua affine **25** · area affine **10** · area contaminata **15** · provincia limitrofa **10**, con tetto **35**, `applicaPenalita()` e `bandaCompatibilita(punteggio, motivo?)` (il motivo entra nel tooltip della card e della modale: un match parziale si dichiara). **(2) MODULI PURI NUOVI** — `affinitaDisciplinare.ts` (lingue affini **solo su scelta esplicita** dell'utente, ponti tematici curati Digitale ↔ IA e Letteratura ↔ Teatro, una sola penalità per avviso, sigle solo in maiuscolo: «IA» sì, la preposizione «ai» no), `prossimitaGeografica.ts` (fonte unica di `normalizzaProvincia`, limitrofe = **stessa regione**, fuoriluogo escluso: Milano per chi cerca Asti resta fuori anche con l'opzione), `riempitivi.ts` (max **5** opportunità sotto il 70%, **nessuna** con 10 match di qualità), `compatibilitaGraduata.ts` (`valutaCompatibilita` = punteggio del motore + penalità + motivi leggibili; il sostegno EXTRA resta 60). **(3) BACHECA** — il feed cerca e mostra anche le province limitrofe con la penalità lieve, dichiara lo scostamento (`motivoCompatibilita` su `Interpello`) e chiude col cap dei riempitivi. **CONSEGNA INVARIATA**: `provinceLimitrofe` è un'opzione con default `false` che notifier e digest **non** passano (guardia dedicata), quindi `comunicazione/**` resta valido. Guardie nuove `npm run test:compatibilita:graduata` e `npm run test:riempitivi` (in `npm test`), `test:compatibilita` e `test:opportunita` allineati al nuovo punto di valutazione. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (588 file · 141 = baseline) · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.55 |
| 2026-10-05 | **Le 5 MODALI del Radar: media del punteggio, raggio dei 60 km e scuole preferite (§26.56)** — ✔️ **riordinata dalla §26.63** (il modello a «5 modali» è ora a **DUE LIVELLI**: primarie che decidono voto e porta d'ingresso + livello secondario che sfuma) — nessun dipartimento: condivisi essenziali e superfici di bacheca, su richiesta esplicita dell'utente (`src/lib/**`, `src/data/**`, `src/contexts/app/**`, `src/components/**`). **(1) CINQUE MODALI, UN PUNTEGGIO** — il punteggio mostrato è la **media delle modali applicabili** + **jolly del 3%**: ordine di scuola (**100** selezionato · **90** adiacente · **70** salto), classi di concorso (**100** esatta · **95** affine A-22 ↔ A-24 · **90** competenza nella classe/materia coperta · **85** stessa area · **75** ponte affine · **65** area contaminata · **55** estranea), parole chiave (**90** trovata · **85** vicina, **modale esclusa dalla media** se non c'è corrispondenza e `+3%` per ogni corrispondenza parziale/riconducibile), provincia (**100** propria · **75/60/45** entro 20/40/60 km · **oltre i 60 km → esclusione d'ufficio**, distanza Haversine fra capoluoghi), scuole (blacklist **scarta sempre**, whitelist **include sempre**). **(2) MODULI PURI NUOVI** — `punteggioOrdine.ts`, `punteggioClasse.ts`, `punteggioCompetenze.ts`, `filtriScuole.ts`, `bachecaInterpelli.ts` (la pipeline della bacheca, prima dentro l'hook: `useInterpelliFeed` da **247 a 148 righe**) e i dati `src/data/provinceCoordinate.ts` (coordinate dei capoluoghi, 106 voci); `prossimitaGeografica.ts`, `compatibilitaGraduata.ts` e `riempitivi.ts` riscritti/estesi (`proteggi`: le preferite non sono riempitivi); `areeDisciplinari.ts` **sostituisce** `affinitaDisciplinare.ts`; `compatibilita.ts` perde le penalità cumulate (`applicaPenalita`/`PENALITA_*`) e conserva soglie, banda cromatica e `ETICHETTA_SCUOLA_PREFERITA`. **(3) GRAFICA WHITELIST** — con punteggio insufficiente la card e la modale mostrano l'etichetta dedicata **«Scuola preferita nel radar»** (`descrizioneScuolaPreferita`) invece di un voto basso; con punteggio buono lo evidenziano accanto al match; il flag `scuolaPreferita` viaggia su `Interpello`. **(4) INVARIANTI** — sostegno fuori dalle proprie classi a **60**, **consegna STRICT** (`provinceLimitrofe` opzione della sola bacheca: notifier/digest invariati, `comunicazione/**` valido), pertinenza come gate (nessun ponte tematico da solo), `DashboardPage` e cap dei riempitivi invariati. Guardie nuove `npm run test:modali`, `test:prossimita`, `test:filtri-scuole` (in `npm test`), `test:compatibilita:graduata` riscritta, `test:riempitivi`/`test:opportunita`/`test:compatibilita` estese. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (597 file · 141 = baseline) · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.56 |
| 2026-10-05 | **La MEDIA PONDERATA delle modali: i pesi del voto finale (§26.57)** — ✔️ **aggiornata dalla §26.63** (i pesi `ordine:1, classe:2, provincia:1` valgono per le sole modali **PRIMARIE**; l'invariante `Math.max(pesi) * 2 <= Σpesi` è ora la guardia `test:modali`) — nessun dipartimento: condivisi essenziali (`src/lib/**`) + guardie (`scripts/**`) + documentazione. **(1) PESI** — `PESI_MODALI` in `src/lib/compatibilitaGraduata.ts`: **classi di concorso 2** (requisito ABILITANTE: il suo scostamento incide il doppio), ordine · parole chiave · provincia 1 (preferenze di contesto); invariante: nessun peso raggiunge la metà dei pesi totali (2 su 5), quindi il voto non può derivare da una sola modale. **(2) FORMULA** — `mediaPonderata(contributi)` = `Σ(punteggio × peso) / Σpesi` **rinormalizzata sulle sole modali applicabili** (una modale senza dati dell'utente non abbassa il voto, ma non lo alza nemmeno); la vecchia media aritmetica (`mediaModali`) è **rimossa**. Il dettaglio `modali` dichiara `pesoTotale` e il tooltip di card e modale aggiunge la riga di composizione («media ponderata di N modali» + «jolly 3%»). **(3) INVARIANTI §26.56 INTATTI** — sostegno extra a 60, esclusione oltre i 60 km (salvo whitelist), blacklist che vince sulla whitelist, jolly del 3% deterministico, consegna STRICT (notifier/digest non passano da qui). **(4) VALORI** — ordine 100 · classe 100 (peso 2) · provincia vicina 60 → **90** (era 87 con la media semplice); ordine 100 · classe estranea 55 · provincia 100 → **78**. Guardie: `npm run test:modali` estesa ai pesi (tabella `PESI_MODALI`, media ponderata, rinormalizzazione, denominatore) e `npm run test:compatibilita:graduata` allineata (media, penalità, peso doppio della classe). Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.57 |
| 2026-10-05 | **L'OVERRIDE della Modale 3: la parola chiave assegna il voto (§26.58)** — ❌ **SUPERATA dalla §26.63** (l'override è **RITIRATO**: la parola chiave **non assegna più il voto**, resta solo la sfumatura del livello secondario, al massimo `CAP_COMPETENZE` = 25 punti; API ritirata `EsitoCompetenze.override` / `ETICHETTA_PAROLA_CHIAVE` / `descrizioneParolaChiave` / `Interpello.parolaChiaveVoto` / `JOLLY_MASSIMO`, guardia `test:override` → `test:scoring`) — nessun dipartimento: condivisi essenziali (`src/lib/**`, `src/data/**`) + viste condivise (`src/components/**` — richiesta esplicita dell'utente sulla vetrina) + guardie e documentazione. **(1) OVERRIDE** — `punteggioCompetenze` restituisce `EsitoCompetenze.override` (`{ grado: 'esatta' \| 'vicina', parolaChiave, punteggio }`): una parola chiave del profilo trovata nel testo dell'avviso (**90**) o un match vicino (**85**) **assegnano d'ufficio** il voto; `valutaCompatibilita` esce su quel voto **prima** della media (`pesoTotale: 0`, nessun jolly) e il tooltip dichiara «voto assegnato d'ufficio 90% (Modale 3: parola chiave piena)». La **PROVINCIA** resta l'unica condizione (oltre i 60 km vince l'esclusione d'ufficio, whitelist a parte) e il **suggerimento EXTRA del sostegno resta 60** anche quando la parola chiave combacia (§26.45: l'override non lo promuove). **(2) LA MEDIA IN UN MODULO DEDICATO** — pesi, `ContributoModale` e `mediaPonderata` passano nel nuovo modulo puro `src/lib/mediaModali.ts` (50 righe) e `PESI_MODALI` perde le parole chiave (`{ ordine: 1, classe: 2, provincia: 1 }`: o assegnano il voto, o sfumano col jolly del 3%). **(3) VETRINA** — nuova etichetta condivisa `ETICHETTA_PAROLA_CHIAVE` («Parola chiave trovata») + `descrizioneParolaChiave(parola, punteggio)` e nuovo campo `parolaChiaveVoto` su `Interpello` (scritto dalla bacheca, mai dal DB): card e modale dichiarano il voto fisso. Guardie: `npm run test:override` (**nuova**, in `npm test`), `test:modali` e `test:compatibilita:graduata` aggiornate. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (599 file · 141 = baseline) · `eslint` (11 file) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.58 |
| 2026-10-05 | **Vetrina: il gate STRETTO del nome scuola — in bacheca e nel responso della prova entra solo una riga con un istituto REALE (§26.59)** — nessun dipartimento: condivisi essenziali (`src/lib/**`) + dipartimento **Radar** (solo JSDoc) + guardie (`scripts/**`) + documentazione. `nomeScuolaRiga` in `src/lib/liveBoard.ts` risolve il nome con tre gradini (campo `school_name` al gate `nomeIstituto.ts` → registro scolastico per codice meccanografico → titolo dell'avviso, dichiarato ricostruito) e `nomeScuolaBoard` restituisce `NomeScuolaBoard \| null`: è **il gate**, e `null` significa «riga FUORI», non «mostra un ripiego». `preparaRigheBoard` riapplica `if (!nome) continue;`, `nomePresentabileRiga`/`rigaPresentabileVetrina` (responso della prova) usano **lo stesso** giudizio — l'import di `enteEmittenteDaTitolo` è rimosso — e `nomeGrezzoDaBando` resta nel modulo come **giudizio puro** sulla qualità dell'ingestione, non più come ripiego di vetrina. Restano fuori le righe con il solo nome grezzo del bando e quelle senza istituto risolvibile (il segnaposto «Scuola non specificata / Più plessi» non è un'anagrafica e resta solo nella scheda del singolo avviso); i codici amministrativi restano fuori a monte in `nomeIstituto.ts`. La pipeline **non perde** avvisi genuini (restano in `interpelli`, nel feed e nelle notifiche, §26.47): cambia la **superficie pubblica**. Guardie: `npm run test:board` (23 asserzioni), `test:nome-istituto`, `test:pipeline`, `test:board:scala`; `typecheck` ✅ 0. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.59 |
| 2026-10-05 | **Bacheca: i riempitivi NON pertinenti non entrano — esclusione secca a monte del cap (§26.60)** — ✔️ **aggiornata dalla §26.63** (il «voto della Modale 3 calcolato una volta sola» non esiste più: la mediata è delle sole **PRIMARIE** e le competenze sono una sfumatura dichiarata; l'esclusione a monte del cap resta) — nessun dipartimento: condivisi essenziali (`src/lib/**`) + guardie (`scripts/**`) + documentazione. Il **cap dinamico** dei riempitivi (§26.55) **dosava** anche i falsi positivi: un avviso sotto la soglia arancio (70%) che il Radar **non** conferma per classe o parola chiave non è «una voce che tocca di striscio il profilo», è una voce che **non appartiene** a quel docente — caso tipico il **suggerimento EXTRA del sostegno** (§26.45), incluso d'ufficio dalla conferma del motore. Ora `riempitivoNonPertinente(voce, { pertinente, forzata?, soglia? })` in `src/lib/riempitivi.ts` esclude la voce **a monte del cap**: `forzata` → resta · `pertinente` → resta · punteggio **assente** → resta (un `null` è neutro, mai classificato a caso) · altrimenti `punteggio < soglia` → **FUORI**. `bachecaInterpelli` (`src/lib/bachecaInterpelli.ts`) passa a **sei passi** e calcola il voto della Modale 3 **una volta sola**, e l'esito dichiara `riempitiviEsclusi` (companion di `riempitiviNascosti`): nessuno scarto silenzioso. Restano i riempitivi **pertinenti** (cap di 5, nessuno con 10 match di qualità) e le **scuole preferite** (mai nascoste, Modalità 5). Guardie: `npm run test:riempitivi` (esclusione a monte del cap + conto dichiarato), `test:filtri-scuole`, `test:board`; `typecheck` ✅ 0. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.60 |
| 2026-10-05 | **Prova del Radar: si prova con la SOLA provincia — nessun pool nazionale, nessun dato di esempio (§26.61)** — dipartimento **Radar** + condivisi essenziali (`src/lib/**`) + guardie (`scripts/**`) + documentazione. Il box «Prova il Radar» legge `interpelli` con `.eq('province', <codice>)` (200 righe, solo avvisi **vivi**: soglia `expiration_date` lato DB con margine di 1 giorno + `righeAttive` in memoria — le righe senza scadenza restano) e `selezionaRisultatiProva(righeProvincia, limite)` ha un **unico ingresso**: sparisce il ripiego sulle righe di altre province (60 nazionali) che mostrava un avviso non locale sotto il nome della provincia provata. Se la provincia non ha nulla di vivo il gruppo è `'vuoto'` e prende la parola `messaggioRadarInScansione(provincia)` («Appena esce un avviso su <provincia> te lo diciamo noi»); il conteggio della conversione conta **solo** le righe mostrate. Invariati: maglia **larga sulle categorie** (interpelli/supplenze, PON/POR, PNRR, CPIA, ATA, esperti esterni — la geografia è stretta, le categorie no), memoria della provincia provata (`src/lib/provaRadar.ts`, `sr_prova_radar` → provincia principale del wizard), limite di schermo (5 righe) e gate dei nomi in vetrina (§26.59). Guardie: `npm run test:prova-radar` (responso con la sola provincia, responso vuoto che dichiara la scansione, pool dei soli vivi), `test:board`; `typecheck` ✅ 0. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.61 |
| 2026-10-05 | **Preferenze Radar: i suggerimenti scuola restano nell'ambito provinciale (forzatura dichiarata) + scheda utente Admin completa (§26.62)** — dipartimenti **Radar** e **Admin** + condivisi essenziali (`src/lib/**`) + guardie (`scripts/**`) + documentazione. **(1) SUGGERIMENTI NELL'AMBITO**: il campo «Scuole preferite / escluse» propone **solo** le scuole delle province da cercare (proprie + entro 60 km, `provinceDiRicerca`: la stessa fonte della Modalità 4) — `scuoleNote` legge il feed reale (nome + provincia, senza doppioni), `suggerimentiScuole` filtra all'ambito, `ambitoScuola` risponde `dentro`/`fuori`/`sconosciuta` e `messaggioAmbitoScuola` è l'unica copy: fuori ambito la **forzatura è dichiarata** (avviso sotto il campo + badge «Fuori ambito · <provincia>» sulla pill), mai silenziosa; senza province scelte i suggerimenti sono **vuoti** (testo libero). Nel datalist la **sigla di provincia** sta accanto al nome. **(2) SCHEDA UTENTE ADMIN COMPLETA**: il blocco condiviso `PreferenzeUtente.tsx` (derivazione unica `preferenzeUtenteAdmin`) aggiunge la riga «Materie» — le discipline **derivate** dalle classi di concorso con il nuovo modulo condiviso `src/lib/materieClassi.ts` (`materieDelleClassi`, stessa derivazione del box «In cosa puoi lavorare» del Radar, `RiepilogoLavoro.tsx`) — il titolo della sezione diventa «Profilo utente & preferenze Radar», la card compatta conta le scuole («Scuole preferite / escluse: N / M») e `Chips` **non tronca più** gli elenchi con «+N». Guardie: `npm run test:filtri-scuole` (§4 nuova), `npm run test:admin:utente`; `npm test`, `npm run build`, `typecheck` e `test:architettura` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.62 |
| 2026-10-06 | **Il punteggio ha DUE LIVELLI: le preferenze fanno il voto, le competenze lo sfumano (§26.63)** — nessun dipartimento: condivisi essenziali (`src/lib/**`, `src/data/**`, `package.json`) + viste condivise (`src/components/**`, come nelle §26.56/§26.58) + guardie (`scripts/**`) + documentazione e comunicazione. **(1) DUE LIVELLI** — `punteggio = min(tetto, mediaPonderata(modali PRIMARIE) + sfumatura)` in `compatibilitaGraduata.ts`: il **PRIMARIO** (`punteggioOrdine` · `punteggioClasse` peso **2** · `punteggioProvincia`, pesi in `mediaModali.ts`) **decide** il voto **e** la porta d'ingresso della bacheca; il **SECONDARIO** (`punteggioCompetenze`) **sfuma** soltanto: esatta **25** · vicina **20** · riconducibile **10**, `+3` per ogni corrispondenza aggiuntiva, tetto `CAP_COMPETENZE` = **25**. **(2) TETTO = 25** — `tetto = punteggioMotore === PUNTEGGIO_MATCH_SECONDARIO ? 25 : 100`: per un profilo **senza classi** il verdetto del motore resta un tetto, quindi le competenze da sole **non** superano la soglia rossa. **(3) OVERRIDE RITIRATO (§26.58)** — spariscono `EsitoCompetenze.override`, `ETICHETTA_PAROLA_CHIAVE`, `descrizioneParolaChiave`, `Interpello.parolaChiaveVoto`, `JOLLY_MASSIMO` e `scripts/test-override-modale3.ts`; al loro posto `ETICHETTA_COMPETENZA_SECONDARIA` + `descrizioneCompetenzaSecondaria` e `Interpello.competenzaSecondaria` (dato **di vetrina**: lo scrive la bacheca, **mai il DB**). **(4) INVARIANTI** — sostegno EXTRA **60** e competenze che non lo promuovono; geografia sovrana (oltre i 60 km esclusione, `forzata` bypassa geografia e cap dei riempitivi ma **non** il punteggio); porta d'ingresso **primaria** (conferma del motore oppure classe almeno «stessa area» = 85); **consegna STRICT** — verificato il 06/10/2026 che `competenzaSecondaria` non compare in `notifier.ts`, `digest.ts`, `invia-*` né in `supabase/**`. Guardie: `npm run test:scoring` (`scripts/test-scoring-due-livelli.ts`, **al posto** di `test:override`), `test:modali` (invariante `Math.max(pesi) * 2 <= Σpesi`), `test:compatibilita:graduata`, `test:riempitivi`. Verifiche: `typecheck` ✅ 0 · `npm test` ✅ 0 · `test:architettura` ✅ (602 file · 141 = baseline) · `eslint` (file toccati) ✅ · `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.63 |
| 2026-10-06 | **Modalità 3: il JOLLY SEMANTICO asimmetrico — un match pieno apre e pavimenta, mai una sottrazione (§26.64)** — nessun dipartimento: condivisi essenziali (`src/lib/**`, `src/data/**`, `package.json`) + viste condivise (`src/components/**`) + guardie (`scripts/**`) + documentazione. Il **match PIENO** della Modalità 3 («In cosa puoi lavorare oltre la classe») smette di essere una mera sfumatura: **pavimento d'eccellenza 90** dentro le proprie province, **inclusione d'ufficio 60** oltre il raggio dei 60 km (mai un 100% a duecento chilometri: la distanza resta nel numero) e **apertura** della bacheca (`classeVicina(profilo, avviso) \|\| jollyPieno`); il **PARZIALE** sfuma entro 15 e **non** apre; l'**ASSENZA** non toglie nulla (voto intatto). Tre **sospensioni** dove vale la §26.63 (whitelist scuole preferite, profilo senza classi col tetto del motore, pavimento del sostegno EXTRA). **Una sola misura** (`punteggioCompetenze`, §26.63), **due decisioni**: il jolly non rilegge il testo. Etichetta «Interesse pieno» + tooltip in `compatibilita.ts`, badge in card e modale (`secondarioDaDichiarare`), campo di vetrina `Interpello.jollySemantico` (vetrina: non DB, non consegne). Nuova guardia `npm run test:jolly` in catena con `test:scoring` e `test:compatibilita:graduata`. |
| 2026-10-06 | **Il feed è fatto di AVVISI: il contorno non entra — bacheca, suggerimenti scuola e scadenze oneste (§26.65)** — dipartimento **Radar** (pannello delle Preferenze) + condivisi essenziali (`src/lib/**`, `src/data/**`, `package.json`) + vista condivisa (`src/pages/dashboard/components/ElencoOpportunita.tsx`, come le §26.56/§26.58/§26.63) + guardie (`scripts/**`) + documentazione. **(1) UN GIUDIZIO PURO** — nuovo `src/lib/qualitaAvviso.ts`: `motivoRigaNonOpportunita` risponde `null` oppure `titolo-dump-di-codici` / `indice-di-codici` / `nessuna-traccia-di-opportunita`; ordine dump → parola operativa → indice di codici → classi → istituto **presentabile** (§26.59). **(2) BACHECA** — passo 1-bis in `bachecaInterpelli.ts` prima di ogni punteggio, scarto **contato** (`righeNonOpportunita`), mai silenzioso. **(3) PULIZIA DB** — `npm run dati:pulisci-contorno` (`scripts/pulisci-non-opportunita.ts`) con lo STESSO giudizio. **(4) SCADENZE ONESTE** — `etichettaScadenzaAvviso` in `alertInterpello.ts`: scadenza vera → pubblicazione dichiarata → «Senza scadenza dichiarata», mai più `Invalid Date`; `inferisciOrdineDaTesto` sostituisce il default fisso `secondaria2` in `matchingEngine.ts`. **(5) CAMPO SCUOLA** — DUE campi (Provincia + Scuola) con filtro istantaneo, nuova `preferenze/components/CampoScuola.tsx`, suggerimenti solo istituti presentabili dal nuovo `src/lib/scuolePresentabili.ts` (estratto da `filtriScuole.ts`, 271 → **223** righe). Guardie: `npm run test:qualita-avviso`, `npm run test:filtri-scuole`; `npm test`, `npm run build`, `typecheck`, `test:architettura` ✅. **(6) BONIFICA ESEGUITA (06/10/2026)** — `npm run dati:pulisci-contorno --apply`: **541 righe di contorno rimosse** su 714 (restano **173** opportunità reali), riverifica in dry-run «righe di contorno: 0»; verifica a mano delle righe scartate senza falsi positivi (voci di menu, indici di codici, numeri di protocollo); 63 post sui canali e 10 notifiche già inviati prima del fix atterrano ora su `AvvisoAssente`. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.65 |
| 2026-10-06 | **«Dispatch Radar FERMO» era un falso allarme: il monitor misurava le righe grezze (§26.66)** — dipartimento **Radar** (monitor di salute del dispatch) + condivisi essenziali (`src/lib/alertInterpello.ts`, `src/lib/emailScuola.ts`, `src/lib/qualitaAvviso.ts`, `src/scraper/adminAlerts.ts`) + guardie (`scripts/**`) + documentazione. **(1) DIAGNOSI MISURATA** — la pipeline gira (`scraper_runs` 05-06/10, `errori=0`) e i canali sono vivi (**11 pubblicazioni** in `channel_posts_log` nella finestra di 48h), ma dei 17 avvisi entrati **nessuno** ha un recapito di candidatura: `motivoAvvisoNonInviabile` = «recapito di candidatura mancante» per **17/17**, quindi 0 notifiche era il risultato **atteso** (gate di qualità, §26.65) e non una rottura. **(2) MONITOR ONESTO** — nuovi `scripts/lib/avvisiNotificabili.ts` (conteggio col metro del dispatch: `emailAvviso` → `risolviEmailUfficialeScuola` → `motivoAvvisoNonInviabile`, contorno con `motivoRigaNonOpportunitaAvviso`) e `scripts/lib/saluteDispatch.ts` (letture + report + allarmi); `scripts/admin-health-check.ts` resta un CLI di **97 righe**. `critical` **solo** con avvisi NOTIFICABILI e 0 notifiche; `critical` se 0 pubblicazioni sui canali; `warning` se nessun avviso supera il gate o se le **consegne personali** sono ferme da `HEALTH_DELIVERY_STALE_DAYS` (7 g) — il segnale che mancava; exit 1 solo per critical/warning. **(3) ALLERTA VISIBILE** — quando l'invio ad `ADMIN_ALERT_SECRET` fallisce per configurazione, il monitor stampa l'istruzione esatta (fail-closed, nessun silenzio). **(4) TROVATO FUORI DAL CODICE** — nel ledger committato dai workflow non esiste alcuna chiave `digest\|<data>` e `admin_telegram_alerts` è vuota: il **Digest giornaliero** non ha mai consegnato e nessun alert ha mai raggiunto il bot admin; l'unico profilo attivo ha però **2 voci pronte** (dispatch DRY-RUN exit 0) e l'Edge `telegram-admin-webhook` risponde (405 su GET, 403 senza secret). Azioni dell'operatore: impostare `ADMIN_ALERT_SECRET` nei secrets, verificare il cron del digest, alzare la copertura dei recapiti. Verifiche: `typecheck`, `npm test`, `test:architettura` (612 file, 141 violazioni = baseline), `lint`, `build` → ✅. |
| 2026-10-06 | **«Filtri Avanzati Scuole»: la provincia è di OGNI lista, non un default del pannello (§26.67)** — dipartimento **Radar** (pannello delle Preferenze) + condivisi essenziali (`src/lib/scuolePresentabili.ts`) + guardia (`scripts/test-filtri-scuole.ts`) + documentazione/checklist. **(1) VIA IL SELETTORE UNICO** — il menu «Provincia» in cima al pannello col default «Tutte le tue province» è **rimosso**: non c'è più una scelta condivisa fra preferite ed escluse. **(2) PROVINCIA DENTRO IL CAMPO** — `preferenze/components/CampoScuola.tsx` ha ora **una riga sola**, `[ Provincia ▾ ] [ Nome della scuola ] [ + Aggiungi ]`, con placeholder neutro `Seleziona provincia…`; il pannello tiene **due stati indipendenti** (`provinciaPreferite`, `provinciaEscluse`) e il selettore è controllato (`provincia` + `onProvinciaChange`) con label accessibile dedicata, impilato su mobile (`sm:flex-row`). **(3) OMONIMIE** — nuova funzione pura **`omonimieScuole(note)`** in `src/lib/scuolePresentabili.ts` (i nomi presenti in più di una provincia): il campo chiede la provincia **solo** quando il rischio esiste davvero, altrimenti tace («nessun istituto in ambito» o nessun avviso). **(4) INVARIANTI** — l'ambito resta quello delle proprie province + 60 km (§26.62), il valore salvato resta il **nome** (il confronto `includes` delle liste non si rompe), la forzatura resta **dichiarata** (avviso sotto il campo + badge «Fuori ambito · <provincia>» sulla pill), i suggerimenti restano istituti presentabili (§26.59) con `datalist` per-campo (`useId`). Guardie: `npm run test:filtri-scuole` estesa (omonimie pure, tendina nella riga, «UNA provincia per lista», assenza del default); `npm test` ✅, `typecheck` ✅ 0, `test:architettura` ✅ 611 file · 141 = baseline (`PannelloFiltriScuole.tsx` 227, `CampoScuola.tsx` 189), `eslint` ✅ 0, `build` ✅. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.67 |
| 2026-10-06 | **Tailoring del recapito: un interpello vero non si perde per un'anagrafica incompleta (§26.68)** — dipartimento **Radar** (pipeline di ingestione + dispatch) + condivisi essenziali (`src/lib/**`, `supabase/functions/send-notification`) + guardie (`scripts/**`) + **regole di prodotto** (`comunicazione/**`) + documentazione. **(1) CAMBIO DI REGOLA** — `motivoAvvisoNonInviabile` conserva **un solo requisito**, il **link diretto** alla fonte ufficiale; la mancanza di recapito diventa un'**avvertenza** (`avvisoSenzaRecapito` + `MOTIVO_RECAPITO_MANCANTE`) che il notifier e la Edge loggano una volta per avviso: il messaggio parte **senza il blocco contatto** (tutti i renderer omettevano già la riga `📧`: nessuna riga vuota, mai `Email non disponibile`). Checklist aggiornate in blocco: `checklist_straordinaria` §4/§5, `checklist_email` §6, `checklist_telegram_pro` §2 e riga contatti, `checklist_telegram_base`, `checklist_regionali`. **(2) IL TAILORING ENGINE** — nuovo modulo **puro** `src/lib/tailoringContatti.ts` (`risolviContattoAvviso`: **fonte → anagrafica → storico interno → convenzione MIM**, un solo punto di decisione, `daRevisionare` onesto, mai indirizzi inventati) + il «database interno» `src/scraper/storicoContatti.ts` (recapiti **osservati** da `interpelli`: per codice, o per nome **univoco** — un candidato per provincia, la riga più recente vince; `patchDaStorico` mai sovrascritture) + il ponte `src/scraper/tailoringInterpelli.ts` (`applicaTailoring` in coda all'anagrafica, precaricamento dello storico una volta per run, contatori e **alert admin** `tailoring` con gli esempi delle righe rimaste senza recapito). **(3) DOVE SI USA** — scraper all'inserimento (`mappaRigaInterpelli`), manutenzione dati (`npm run dati:arricchisci`, passo 2-bis sull'indice delle righe già lette: zero query in più) e Edge `send-notification` (`caricaEmailAvviso`: ultimo anello, il recapito osservato per la stessa scuola). **(4) MONITOR ONESTO** — `senzaRecapito` in `scripts/lib/avvisiNotificabili.ts`, messaggi di `saluteDispatch.ts` riscritti: il conteggio delle righe da arricchire resta visibile senza bloccare nulla. Guardie: `npm run test:tailoring` (**nuova**, in coda a `npm test`) e `npm run test:qualita` (l'asserzione «senza email → SCARTATO» diventa «senza email → **inviabile**, con avvertenza»). Verifiche: `typecheck` ✅ 0 · `scrape:check` ✅ 0 · `npm test` ✅ · `test:architettura` ✅ 615 file · 141 = baseline (`arricchisci-interpelli.ts` 248 righe) · `eslint` ✅ 0 sui 12 file toccati · `build` ✅. Nessuna migrazione, nessun cambio di schema. Dettagli in [`SYSTEM_HANDOVER.md`](./SYSTEM_HANDOVER.md) §26.68 |



















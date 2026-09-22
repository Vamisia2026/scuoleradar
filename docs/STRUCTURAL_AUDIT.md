# 🔬 Audit strutturale di `src/` — file sovradimensionati e accoppiamento

> **Obiettivo**: individuare i file che aumentano il costo di token e la complessità
> di manutenzione, rifattorizzarli in sotto-componenti con responsabilità unica e
> verificare che build e type-check restino verdi.
>
> **Data**: 2026-09-21 · **Soglia di analisi**: > 300 righe (LOC totali)
> **Strumento riutilizzabile**: [`scripts/_split-analysis.mjs`](../scripts/_split-analysis.mjs)
> **Esito wave 1-13**: ✅ eseguite e verificate (typecheck, build, eslint, test dopo ogni wave) · **wave 14 in corso** (1ª slice: tipi, verificata)
> **Documento collegato**: [`DEPARTMENT_MAP.md`](./DEPARTMENT_MAP.md)

---

## 1. Metodo

1. Conteggio LOC totale (`Get-Content | .Count`) di **tutti** i file `.ts/.tsx` in `src/`.
2. Classificazione per **ruolo**, perché la soglia di 300 righe non ha lo stesso
   significato ovunque:

   | Classe | Cos'è | Refactoring sensato? |
   |---|---|---|
   | **UI-monolite** | pagina/componente con un unico render gigante | ✅ **sì** (pannelli/primitive) |
   | **Contesto** | provider globale con stato + effetti | ⚠️ solo estraendo moduli puri (tipi, helper) |
   | **Servizio** | logica di dominio/testo (motori, template) | ⚠️ sì, per sezioni funzionali |
   | **Dati** | dataset (cataloghi, moduli, classi) | ❌ no: sono dati, non codice |
   | **Backend** | escluso da `tsconfig.app.json` (Node/cron/Edge) | ❌ fuori dal bundle frontend |
   | **Test** | suite (es. `engineAudit.test.ts`) | ❌ no |
   | **🔒 Locked** | in `LOCKED_MODULES.md` / checklist comunicazione | ❌ vietato |

3. Per ogni split: analisi automatica delle **free variables** del blocco →
   distinzione fra *props* (stato/handler del contenitore), *import* (simboli di
   modulo) e *costanti di modulo*. Solo dopo si sposta il codice.
4. Spostamenti **verbatim** del corpo JSX (nessuna riscrittura manuale) + prune
   degli import orfani guidato da `eslint`.

---

## 2. Inventario: 44 file oltre 300 righe

Legenda azione: ✅ fatto · ▶️ wave successiva · ⏸️ rinviato (motivazione)

| # | LOC | File | Classe | Azione |
|---:|---:|---|---|---|
| 1 | 3126 | `modules/modulistica/creator/cacheService.ts` | Servizio | ⏸️ estrarre i template per famiglie (fase dedicata) |
| 2 | 2709 | `data/moduliOrdiniScuola.ts` | Dati | ⏸️ dati puri |
| 3 | 1999 | `lib/notifier.ts` | Backend 🔒 | ⏸️ fuori bundle + governance checklist |
| 4 | 282 | `contexts/AppContext.tsx` | Contesto | ✅ **wave 14+15**: 10 slice + split dei 2 hook di contesto (1634 → 282) |
| 5 | 1515 | `scraper/index.ts` | Backend | ⏸️ fuori bundle |
| 6 | 1396 | `notizie/services/relevanceEngine.ts` | Servizio | ▶️ wave 4: gate / link / copy |
| 7 | 1264 | `lib/telegram.ts` | Backend 🔒 | ⏸️ fuori bundle + governance |
| 8 | 301 | `departments/admin/tabs/utenti/TabUtenti.tsx` | UI-contenitore | ✅ **wave 5** (623 → 301, 4 sotto-componenti + helper) |
| 9 | 1161 | `scraper/parser.ts` | Backend | ⏸️ fuori bundle |
| 10 | 1145 | `lib/resend.ts` | Backend 🔒 | ⏸️ fuori bundle + governance |
| 11 | 943 | `data/classiConcorso.ts` | Dati | ⏸️ dati puri |
| 12 | 340 | `departments/radar/PreferenzeRadar.tsx` | UI-contenitore | ✅ **wave 2** (804 → 340, 6 pannelli estratti) |
| 13 | 765 | `cfu/engine/requirementSolver.ts` | Servizio + test | ⏸️ coperto da suite |
| 14 | 24 | `modules/modulistica/creator/pdfGenerator.ts` | Servizio (barrel) | ✅ **wave 13** (733 → 24: 8 sotto-moduli in `creator/pdf/`) |
| 15 | 704 | `lib/alertInterpello.ts` | Servizio | ▶️ wave 4 |
| 16 | 271 | `pages/onboarding/OnboardingPage.tsx` | UI-contenitore | ✅ **wave 7** (677 → 271, 5 sotto-componenti in `components/`) |
| 17 | 622 | `cfu/engine/traceability/traceabilityChain.ts` | Servizio + test | ⏸️ coperto da suite |
| 18 | 288 | `pages/LandingPage.tsx` | UI-contenitore | ✅ **wave 2** (603 → 288, sotto soglia) |
| 19 | 570 | `notizie/services/newsFetcher.ts` | Backend | ⏸️ fuori bundle |
| 20 | 559 | `departments/radar/RadarWizardModal.tsx` | UI-monolite | ✅ **wave 1** (1004 → 559) |
| 21 | 536 | `lib/matchingEngine.ts` | Servizio | ▶️ wave 4 |
| 22 | 499 | `data/moduliAltreAree.ts` | Dati | ⏸️ dati puri |
| 23 | 486 | `data/moduliEntiAltro.ts` | Dati | ⏸️ dati puri |
| 24 | 165 | `modules/modulistica/ModuliModule.tsx` | UI-contenitore | ✅ **wave 6** (485 → 165, dati in `useModulistica`) |
| 25 | 175 | `modules/modulistica/components/EsploraArchivio.tsx` | UI-contenitore | ✅ **wave 6** (483 → 175, 6 moduli in `esploraArchivio/`) |
| 25-bis | 372 | `modules/modulistica/hooks/useModulistica.ts` | Hook di dominio | ⚠️ **nato dalla wave 6**: dati+logica del modulo (prossimo split per dominio) |
| 26 | 474 | `cfu/engine/__tests__/engineAudit.test.ts` | Test | ⏸️ test |
| 27 | 455 | `cfu/engine/types.ts` | Tipi | ⏸️ tipi puri |
| 28 | 119 | `departments/scadenze/components/RevolverScadenze.tsx` | UI-contenitore | ✅ **wave 8** (448 → 119: 4 componenti + 2 hook) |
| 29 | 119 | `components/Header.tsx` | UI-shell | ✅ **wave 3** (447 → 119; 6 sotto-componenti) |
| 30 | 436 | `notizie/services/ingestNotizie.ts` | Backend | ⏸️ fuori bundle |
| 31 | 399 | `components/AuthModal.tsx` | 🔒 Locked | ⏸️ vietato |
| 32 | 87 | `modules/modulistica/creator/ArchivistaCapo.tsx` | UI-contenitore | ✅ **wave 12** (390 → 87: hook + 3 viste); ⏸️ non ancora montato |
| 33 | 387 | `cfu/engine/bridge/legacyAdapter.ts` | Servizio + test | ⏸️ coperto da suite |
| 34 | 108 | `pages/interpello/InterpelloDettaglioPage.tsx` | UI-contenitore | ✅ **wave 9** (369 → 108: 3 componenti + `helpers.ts`) |
| 35 | 363 | `pages/PrezziPage.tsx` | 🔒 Locked | ⏸️ vietato |
| 36 | 359 | `cfu/engine/reportEngine.ts` | Servizio + test | ⏸️ coperto da suite |
| 37 | 124 | `pages/DashboardPage.tsx` | UI-contenitore | ✅ **wave 10** (356 → 124: guscio + 3 viste estratti) |
| 38 | 354 | `departments/scadenze/engine.ts` | Servizio | ⏸️ motore puro coperto da test |
| 39 | 188 | `cfu/calcolatore/components/StepDocumenti.tsx` | UI-contenitore | ✅ **wave 11** (350 → 188: 6 pannelli in `documenti/`) |
| 40 | 344 | `radar/wizard/PassoClassiMaterie.tsx` | UI-pannello | ⚠️ nato dallo split: 3 sotto-sezioni |
| 41 | 329 | `services/healthCheck.ts` | Servizio | ▶️ wave 4 |
| 42 | 323 | `departments/radar/FlightBoardInterpelli.tsx` | UI + helper | ✅ **wave 1** (410 → 323) |
| 43 | 321 | `cfu/engine/__tests__/sourceRegistry.test.ts` | Test | ⏸️ test |
| 44 | 96 | `notizie/components/NotizieHero.tsx` | UI-contenitore | ✅ **wave 11** (304 → 96: + `hero/` e modulo `vacanzeScolastiche.ts`) |

**Uscito dalla lista dopo la wave 1**: `departments/radar/RadarStatusToggle.tsx` (307 → 264).

---

## 3. Criteri di priorità

Ordine applicato (e consigliato per le wave successive):

1. **Impatto sul costo in token**: LOC del file × frequenza di lettura in sviluppo.
   Le UI-monolite dei flussi principali (Radar, Landing, Header, Modulistica) sono
   i file che si aprono più spesso → priorità massima.
2. **Rischio di regressione**: i moduli coperti da suite (CFU engine) e i moduli
   🔒 bloccati vanno **dopo** o **esclusi**.
3. **Presenza di una cucitura pulita**: blocchi JSX già separati da commenti
   (`{/* Passo N */}`, `<Accordion>…</Accordion>`) o funzioni pure.
4. **Assenza di cicli**: dopo ogni split, il figlio non deve importare il padre
   (verificato: i figli importano solo `@/components`, `@/data`, `@/lib` e i
   moduli condivisi del dipartimento).

---

## 4. Wave 1 — ✅ ESEGUITA: dipartimento Radar

### 4.1 Prima → dopo

| File | Prima | Dopo | Note |
|---|---:|---:|---|
| `components/RadarWizardModal.tsx` | **1004** | — | spostato in `departments/radar/` e svuotato nei passi |
| `departments/radar/RadarWizardModal.tsx` | — | **559** | contenitore: stato, validazione, salvataggio, progress, footer |
| `departments/radar/wizard/PassoOrdini.tsx` | — | **59** | nuovo (passo 1, 2 props) |
| `departments/radar/wizard/PassoProvince.tsx` | — | **123** | nuovo (passo 2, 8 props) |
| `departments/radar/wizard/PassoClassiMaterie.tsx` | — | **344** | nuovo (passo 3, 3 props raggruppate) |
| `departments/radar/wizard/PassoNotifica.tsx` | — | **132** | nuovo (passo 4, 2 props raggruppate) |
| `components/FlightBoardInterpelli.tsx` | 410 | — | spostato nel dipartimento |
| `departments/radar/FlightBoardInterpelli.tsx` | — | **323** | UI rimasta + helper estratti |
| `departments/radar/flightBoard/righeBoard.ts` | — | **95** | nuovo: etichette di riga **pure** (tipo + 6 funzioni) |
| `components/RadarStatusToggle.tsx` | 307 | — | spostato nel dipartimento |
| `departments/radar/RadarStatusToggle.tsx` | — | **264** | helper di validazione estratti |
| `departments/radar/valutaConfigurazione.ts` | — | **66** | nuovo: `valutaConfigurazioneRadar`, `nonVuoto` |
| `departments/radar/ordineIcone.tsx` | — | **40** | nuovo: icone degli ordini (era **duplicato** in 2 file) |
| `departments/radar/index.ts` | — | **21** | facciata pubblica del dipartimento |
| `components/PreferenzeRadar.tsx` / `RadarStatusToggle.tsx` / `SimulatorRadar.tsx` | 804 / 307 / ~300 | — | spostati in `departments/radar/` |

### 4.2 Accoppiamento: prima → dopo

**Prima**
- 5 componenti Radar sparsi in `src/components/` (nessun confine di dipartimento).
- `ordineIcons` **duplicato** in `RadarWizardModal` e `PreferenzeRadar` (dimensioni
  diverse, stessi 8 ordini di scuola) → rischio di divergenza.
- `valutaConfigurazioneRadar` (accesso a Supabase + regole di validità) mescolata
  al render di `RadarStatusToggle`.
- 6 helper puri del Flight Board (URL, host, città, scuola) dentro il file di UI.
- Import orfani preesistenti (`enteEmittenteDaTitolo` in FlightBoard, `eInterpelloAttivo`).

**Dopo**
- Un solo punto di ingresso: `@/departments/radar` (`index.ts`) → gli importatori
  restano 5 e sono tutti `@/departments/radar` (nessun percorso interno).
- Icone ordini: **una sola** funzione `creaIconeOrdine(dimensione)`; per aggiungere
  un ordine di scuola si tocca **un** file.
- Validazione configurazione: modulo autonomo, senza React, riutilizzabile
  (es. dalla dashboard o da un futuro banner).
- Etichette Flight Board: funzioni pure testabili e senza dipendenze da React.
- Import orfani rimossi; ogni file ha un solo `import` per modulo.

### 4.3 Verbatim, non riscritto

I corpi JSX dei 4 passi sono stati **spostati riga per riga** (nessuna
riscrittura), quindi il markup e le classi Tailwind sono bit-identici a prima:
il rischio di regressione visiva è nullo per costruzione.

---

## 5. Wave 2 — ✅ ESEGUITA (pannelli Preferenze + sezioni Landing)

### 5.1 `departments/radar/PreferenzeRadar.tsx` — 804 → **340 righe**

Sei pannelli estratti in `src/departments/radar/preferenze/`, uno per accordion,
ognuno con interfaccia props dedicata e nessun accesso a `useApp()`:

| Pannello | Righe (prima) | File nuovo | Props |
|---|---:|---|---:|
| Canali di Notifica & Telegram | 104 | `preferenze/PannelloCanali.tsx` (147) | 10 |
| Filtri Avanzati Scuole | 103 | `preferenze/PannelloFiltriScuole.tsx` (153) | 13 |
| Province | 64 | `preferenze/PannelloProvince.tsx` (105) | 7 |
| Materie e Competenze | 114 | `preferenze/PannelloMaterie.tsx` (161) | 10 |
| Classi di Concorso (+ sostegno) | 116 | `preferenze/PannelloClassi.tsx` (183) | 14 |
| Ordini e Tipologie di Scuola | 32 | `preferenze/PannelloOrdini.tsx` (66) | 4 |

Il contenitore conserva ciò che gli compete: stato, autosave con debounce,
validazione del piano e salvataggio su Supabase.

**Trappole reali incontrate** (utili per le wave successive):
- `contieneClasse` **non** è in `@/data/classiConcorso` ma in `@/lib/matchingEngine`;
- falsi positivi dell'analisi: le parole nel testo JSX (`attivo`), gli attributi
  JSX (`attivo={sostegno}`, `list="scuole-conosciute"`, `idPrefisso="preferenze-…"`)
  e i letterali di classe (`list-decimal`) vengono contati come identificatori:
  vanno verificati prima di dichiararli come props;
- `limitiPiano.piano` non è il `piano` del contenitore (property access, non variabile).

Regole operative già validate nella wave 1:
- gruppi di props (>8) con **destrutturazione in testa** al componente, per
  mantenere il corpo JSX verbatim;
- **attenzione ai falsi positivi** dell'analisi: parole nel testo JSX
  (`attivo`, `attiva`, `Radar`) e attributi JSX (`attivo={sostegno}`) non sono props;
- dopo ogni blocco: `npx tsc` + `npx eslint <file>` per il prune degli import.

### 5.2 `pages/LandingPage.tsx` — 603 → **288 righe**

Sei estrazioni, con `Footer` promosso a componente condiviso della cartella
`src/components/` (era importato da **11 pagine** passando per la landing):

| Blocco | Righe (prima) | File nuovo | Props |
|---|---:|---|---:|
| `Footer` | 106 | `src/components/Footer.tsx` (123) | 0 — autonomo |
| `StepCard`, `ValueCard`, `VetrinaCard`, `Stat` | 95 | `src/components/landing/LandingCards.tsx` (108) | primitive |
| Hero | 58 | `src/components/landing/LandingHero.tsx` (88) | 4 |
| «Ecco cosa riceverai» (features) | 42 | `src/components/landing/LandingBenefici.tsx` (55) | 0 |
| CTA finale | 22 | `src/components/landing/LandingCta.tsx` (42) | 2 |

Restano in pagina (per scelta, sono testi strettamente legati alla landing):
«Come funziona», i valori, la fascia partner PureFocus e le statistiche.

**Effetto collaterale desiderabile**: `pages/LandingPage.tsx` non è più il
"collo di bottiglia" della `Footer`. Gli 11 import sono stati riscritti da
`'./LandingPage'` a `'@/components/Footer'` con una sostituzione letterale
unica; nessun file importa più il footer passando per una pagina.

### 5.3 ✅ ESEGUITA — `components/Header.tsx` → `src/components/header/` (447 → **119 righe**)

| Blocco | Righe (prima) | File nuovo | Righe | Props |
|---|---:|---|---:|---:|
| Nav istituzionale (desktop) | 16 | `header/NavIstituzionale.tsx` | 28 | 0 |
| Menu utente (chip + tendina) | 143 | `header/MenuUtente.tsx` | 202 | 10 |
| Drawer mobile | 113 | `header/MenuMobile.tsx` | 155 | 8 |
| Barra strumenti (desktop) | 27 | `header/BarraStrumenti.tsx` | 40 | 0 |
| Badge piano (top bar) | 24 | `header/BadgePianoCompatto.tsx` | 48 | 3 |
| Badge piano (drawer) | 24 | `header/BadgePianoRiga.tsx` | 46 | 3 |
| Dati di navigazione | 24 | `header/navLinks.ts` | 31 | — dati |
| Tipi derivati dal contesto | 0 | `header/tipiUtente.ts` | 14 | — tipi |

Il guscio (`Header.tsx`) conserva: logo, griglia a 3 colonne, stato di apertura dei
menù (`menuOpen`, `menuUtenteOpen`), conteggio documenti scaricati, condizione
`!isDashboard` per la barra strumenti e il ramo ospite con il pulsante «Accedi».

**Scelte di disaccoppiamento**
- I sotto-componenti **non** chiamano `useApp()`: ricevono `user`, `piano`,
  `pianoStato`, `abbonato`, `avatarUrl`, `moduliScaricati` e gli handler come props;
  il primo step per renderli testabili in isolamento.
- `PianoUtente` e `StatoPiano` sono **derivati** dal contesto
  (`ReturnType<typeof useApp>['piano' | 'pianoStato']`) in `header/tipiUtente.ts`:
  se il contesto cambia, l'header resta allineato senza toccare le union a mano.
- `navLinks` / `strumentiLinks` / `LinkStrumento` sono uscite dal componente e
  vivono in `header/navLinks.ts`: erano dati condivisi da tre sezioni.
- I due badge sono componenti separati (contesti visivi diversi) invece di un unico
  componente con flag: markup verbatim, nessuna condizione aggiuntiva.

**Insidia incontrata**: l'assert di sicurezza sugli indici di riga falliva per
l'escaping delle virgolette interne (`StartsWith('<div className="…"')`): risolto
confrontando sottostringhe senza virgolette. Nessuna scrittura è avvenuta finché
l'assert non è passato — il file originale è rimasto integro.

---

## 5-bis. Wave 4 — ✅ ESEGUITA: dipartimento Admin

`src/pages/admin/AdminTabs.tsx` (1179 righe) **non esiste più**: il modulo admin è
stato promosso a dipartimento (`src/departments/admin/`) e i tre tab sono ora tre
file autonomi, con la facciata pubblica in `index.ts`.

| File | Righe | Note |
|---|---:|---|
| `departments/admin/index.ts` | 25 | facciata: 3 tab + AdminAccessModal + service + primitive + tipi |
| `departments/admin/tabs/utenti/TabUtenti.tsx` | 623 | tab Utenti (contenitore: filtri, tabella, modali) |
| `departments/admin/tabs/utenti/DettaglioUtente.tsx` | 109 | scheda di dettaglio (sola lettura) |
| `departments/admin/tabs/utenti/utentiHelpers.ts` | 87 | `IdColonna`, `COLONNE`, 5 formattatori puri |
| `departments/admin/tabs/TabRadar.tsx` | 142 | tab Radar (scuole + stato) |
| `departments/admin/tabs/TabAccount.tsx` | 300 | tab Account (piani, crediti, referral) |
| `departments/admin/{AdminAccessModal,adminService,adminUi,types}` | 236 · 240 · 218 · 86 | spostati come sono (import interni già relativi) |

**Perché il dipartimento**: le tab importano `adminService`/`adminUi`/`types`, quindi
metterle in `src/components/admin/` avrebbe creato una dipendenza
`components → pages`. Con `src/departments/admin/` tutti gli import restano fra
fratelli (`../../adminService`), la pagina `AdminPage.tsx` (157 righe) resta un
wrapper sottile e la cartella `src/pages/admin/` è stata rimossa.

**Impatto**: 3 file aggiornati (`AdminPage`, `components/Footer`, `App.tsx`, ora su
`@/departments/admin`), **bundle ridotto** (1.144,5 kB → 1.123,1 kB: il file
monolitico aveva import non usati), zero riferimenti residui ai vecchi percorsi.

---

## 5-ter. Wave 5 — ✅ ESEGUITA: `TabUtenti.tsx` (623 → **301 righe**)

Quattro sezioni estratte in `src/departments/admin/tabs/utenti/`, tutte con props
tipizzate e markup verbatim:

| Sezione | Righe (prima) | File nuovo | Righe | Props |
|---|---:|---|---:|---:|
| Barra strumenti (filtri + export + colonne + CTA) | 82 | `utenti/BarraFiltriUtenti.tsx` | 145 | 14 |
| Tabella elenco (colonne, editing inline, azioni) | 126 | `utenti/TabellaUtenti.tsx` | 176 | 10 |
| Modale «Aggiungi utente» | 77 | `utenti/ModaleNuovoUtente.tsx` | 108 | 5 |
| Conferma eliminazione (digitazione «DELETE») | 37 | `utenti/ModaleEliminazioneUtente.tsx` | 68 | 5 |
| Funzioni **pure** (filtro + testo celle) | 25 | `utenti/utentiHelpers.ts` (già esistente) | 127 | — |
| Scheda dettaglio | 96 | `utenti/DettaglioUtente.tsx` (wave 4) | 109 | 2 |

Il contenitore conserva: stato, handler CRUD, dialog di conferma condiviso e il
montaggio dei quattro sotto-componenti (la tabella resta dentro il ternario
caricamento/errore).

**Scelte di disaccoppiamento**
- `filtraUtenti()` e `testoCell()` sono uscite dal componente come **funzioni pure**
  in `utentiHelpers.ts` (accanto a `loginType`, `telefono`, `badgeGenere`,
  `testoTelegram`): il criterio di filtro e la formattazione delle celle sono ora
  verificabili senza montare React.
- Il guard `{nuovoAperto && …}` / `{eliminaTarget && …}` è rimasto nel contenitore:
  i figli ricevono solo ciò che serve a renderizzare (nessuna prop ridondante —
  `eliminaTarget` è stata rimossa dopo che `eslint` l'ha segnalata inutilizzata).
- `setColonneMenu` è tipizzata `Dispatch<SetStateAction<boolean>>` perché il corpo
  usa la forma con updater (`(v) => !v`): la tipizzazione «semplice»
  `(aperto: boolean) => void` avrebbe rotto il toggle — errore intercettato da `tsc`.

---

## 5-quater. Wave 6 — ✅ ESEGUITA: modulo Modulistica

Due monoliti (968 righe complessive) diventati contenitori sottili, con i pezzi
spostati in sottocartelle dedicate e un **hook di dominio** per la logica.

| File | Prima | Dopo | Note |
|---|---:|---:|---|
| `ModuliModule.tsx` | **485** | **165** | dati/logica in `hooks/useModulistica.ts` (372 righe) |
| `components/EsploraArchivio.tsx` | **483** | **175** | 6 moduli in `components/esploraArchivio/` |

**`components/esploraArchivio/`** (nuovo sotto-pacchetto):

| File | Righe | Ruolo |
|---|---:|---|
| `ricercaFuzzy.ts` | 66 | 5 funzioni **pure**: normalizzazione, Levenshtein, soglia refuso, match fuzzy, correzione token |
| `alberoCatalogo.ts` | 59 | tipi `Livello`/`DocConPercorso` + `livelloCorrente`, `nomiPercorso`, `raccogliDocumenti` (pure) |
| `CardModulo.tsx` | 51 | card documento (presentazione pura) |
| `SkeletonConsultazione.tsx` | 30 | skeleton «Labor Illusion» (nessuna prop) |
| `RisultatiRicerca.tsx` | 80 | vista risultati (skeleton / vuoto / griglia + refusi) |
| `GrigliaSottocategorie.tsx` | 194 | drill-down: breadcrumb, griglia 3×5, paginazione, cartella finale, stato vuoto |

**Perché anche l'hook**: in `ModuliModule` il markup era già delegato a 8
sotto-componenti; le ~300 righe residue erano **stato e handler** (ricerca, download
cache-first, DB dei salvati, anteprima). Estrarli in `useModulistica()` ha portato
il componente a 165 righe e reso il data-layer riusabile/testabile; il JSX è rimasto
verbatim (il componente destruttura i 25 valori che usa).

**Insidie reali**: il primo assert è fallito perché i blocchi **includono i commenti
JSDoc** (i confini erano spostati di 1-2 righe rispetto agli indici attesi) — nessuna
scrittura è avvenuta; `moduli` era usato dalla logica → spostato nell'hook, mentre
l'import nel componente è stato rimosso (segnalato da `eslint`).

**Numeri**: file > 300 righe in `src/` **42 → 41**; build più rapida (5,92 s vs
7,8 s); bundle 1.125,5 kB (+1,2 kB). Nuovi moduli tutti ≤ 194 righe.

---

## 5-quinquies. Wave 7 — ✅ ESEGUITA: `OnboardingPage.tsx` (677 → **271 righe**)

La pagina è stata spostata in una cartella di feature
(`src/pages/onboarding/`) e i cinque blocchi del wizard sono diventati
sotto-componenti in `src/pages/onboarding/components/`.

| Blocco | Righe (prima) | File nuovo | Righe | Props |
|---|---:|---|---:|---:|
| Progress (`{/* Progress */}`) | 15 | — (resta nella pagina) | — | — |
| Passo 1 · anagrafica + ordini | 93 | `components/PassoAnagraficaOrdini.tsx` | 130 | 7 |
| Passo 2 · classi + materie | 171 | `components/PassoClassiMaterie.tsx` | 235 | 2 gruppi |
| Passo 3 · province | 78 | `components/PassoProvince.tsx` | 116 | 7 |
| Passo 4 · canali di notifica | 66 | `components/PassoCanali.tsx` | 98 | 6 |
| Navigazione (Indietro/Avanti/Attiva) | 33 | `components/NavigazioneOnboarding.tsx` | 65 | 5 |

La pagina conserva: stato del wizard, memos di filtro, validazione `canNext`,
`handleFinish`, il progress indicato e il montaggio condizionato dei passi.

**Scelte di disaccoppiamento**
- **Gruppi di props** per il passo 2 (`classi`, `materieScelte`) con
  destrutturazione in testa: 17 props raggruppate in 2, corpo JSX invariato.
- `ordineIcons` (icone degli ordini) è passato **come prop** dal contenitore:
  evita di accoppiare il pannello al dipartimento Radar e mantiene una sola
  definizione (la pagina).
- `LIMITE_PROVINCE` resta prop con lo stesso nome usato nel markup (tetto fair
  use), così il corpo del pannello è verbatim.
- `setStep` è tipizzata `Dispatch<SetStateAction<number>>` (il markup usa la forma
  con updater per Indietro/Avanti).
- **Zero cicli**: i 5 pannelli importano solo `@/components`, `@/data` e lucide;
  nessuno importa la pagina.

**Insidia reale**: il primo assert è fallito per un off-by-one sui `)}` di
chiusura dei blocchi (i pannelli chiudono **una riga prima** di quanto indicato
dai commenti) — nessuna scrittura è avvenuta; corrette le soglie, l'estrazione è
andata a buon fine in un colpo.

**Numeri**: file > 300 righe in `src/` **41 → 40**; bundle 1.127,1 kB (+1,6 kB);
build 6,09 s; i 5 nuovi moduli sono 65-235 righe.

---

## 5-sexies. Wave 8 — ✅ ESEGUITA: `RevolverScadenze.tsx` (448 → **119 righe**)

Il widget è il primo **carosello** del repo: motore di stato pesante (orologio,
autoplay, snap del clone di testa, swipe) + 4 blocchi di render. La
decomposizione separa comportamento e presentazione in due hook e quattro
sotto-componenti, tutti in `src/departments/scadenze/`.

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| Swipe + autoplay + snap + misura viewport + navigazione | 197 | `hooks/useRevolverCarosello.ts` | 265 |
| Dati master + orologio + coda/clone | 47 | `hooks/useCodaScadenze.ts` | 68 |
| Helper di testo + slide della card | 87 | `components/SlideScadenza.tsx` | 115 |
| Track `revolver-track` + map degli slide | 33 | `components/TracciaRevolver.tsx` | 50 |
| Frecce precedente/successiva | 24 | `components/FrecceRevolver.tsx` | 44 |
| Dots di impaginazione | 21 | `components/IndicatoriRevolver.tsx` | 48 |

Il contenitore conserva: `section` (aria + pausa su hover/focus), header, viewport
con `ref` e handler di puntatore, barra di avanzamento, stato vuoto e composizione.

**Scelte di disaccoppiamento**
- **Due hook invece di uno**: il primo tentativo produceva un motore da 304 righe
  (sopra soglia). La coda (dati + orologio) è stata separata in `useCodaScadenze`,
  riusabile da qualunque vista delle scadenze: `useRevolverCarosello` scende a 265.
- `SlideScadenza` riceve `attivo: boolean` invece di `i`/`pos`: il `key` resta al
  call-site (map in `TracciaRevolver`), così lo slide non conosce l'indice.
- `aria-hidden={i !== pos}` → `aria-hidden={!attivo}`: **output DOM identico**.
- I 4 sotto-componenti importano solo `../types`, `../engine` (formattazione) e i
  fratelli: nessun ciclo, nessuno importa contenitore o motore.
- I guard `{totale > 0 ? … }` e `{totale > 1 && … }` restano nel contenitore;
  `FrecceRevolver` rende un **Fragment**: nessun nodo DOM in più, gli elementi
  assoluti restano ancorati al viewport del carosello.

**Verifica di equivalenza** (controllo automatico riga-per-riga): delle 356 righe
di codice dell'originale, 13 non sono ritrovate verbatim — tutte attese (7 righe
di import riscritte, il trittico `map`/`key`/`aria-hidden`, il guard su due righe
delle frecce, 1 commento). Le altre **343 sono verbatim**: markup e classi
Tailwind invariati.

**Insidia reale**: quando servivano gli ultimi append il file originale era già
stato riscritto; il blocco verbatim è stato recuperato da `git show HEAD:…`
(448 righe, confini verificati con assert) — nessuna scrittura parziale.

**Numeri**: file > 300 righe in `src/` **40 → 39**; bundle 1.128,1 kB (+1,0 kB);
build OK; nessun nuovo file sopra soglia (max 265 righe).

---

## 5-septies. Wave 9 — ✅ ESEGUITA: `InterpelloDettaglioPage.tsx` (369 → **108 righe**)

La pagina conteneva già tre sotto-componenti locali (`SchedaAvviso`,
`AvvisoAssente`, `ReindirizzamentoAllaFonte`) e tre helper di modulo: il lavoro è
stato **spostarli** in una cartella di feature (`src/pages/interpello/`) senza
toccare il markup, lasciando alla pagina stato, fetch e switch degli stati.

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| `SchedaAvviso` (card di dettaglio + derivazioni) | 147 | `components/SchedaAvviso.tsx` | 180 |
| `AvvisoAssente` (stato «non disponibile») | 29 | `components/AvvisoAssente.tsx` | 37 |
| `ReindirizzamentoAllaFonte` (fallback redirect) | 20 | `components/ReindirizzamentoAllaFonte.tsx` | 35 |
| `COLONNE_INTERPELLI` + `daNotices` + `reindirizzaAllaFonte` | 48 | `helpers.ts` | 59 |

La pagina conserva: `useParams`, stato
(`caricamento|trovato|assente|reindirizzamento`), l'effetto di fetch (tabella
`interpelli` → fallback legacy `notices`), Header/Footer e lo switch dei quattro
stati.

**Scelte di disaccoppiamento**
- **`SchedaAvviso` con una sola prop**: le derivazioni (`etichettaClasseMateria`,
  `costruisciAvviso`, `pulisciTitoloAvviso`, `stileScadenza`, `urlEsterna`,
  `suggerimentoRicercaAvviso`) restano dentro la card: nessun prop drilling.
- **`export` mirati**: gli helper sono diventati `export` (li consuma solo la
  pagina) e le firme dei componenti usano interfacce props tipizzate
  (`SchedaAvvisoProps`, `ReindirizzamentoAllaFonteProps`); `AvvisoAssente` non ha
  prop.
- **Zero cicli**: i componenti importano solo `react-router-dom`, lucide, `@/data`
  e `@/lib`; `helpers.ts` solo `@/lib` e `@/data`; nessuno importa la pagina.
- I tre componenti erano **già** privi di stato: lo spostamento non ha richiesto
  estrarre hook.

**Verifica di equivalenza**: delle 318 righe di codice dell'originale, **311 sono
verbatim**; le 7 differenze sono solo firme (`export` + interfacce props) e la
riga di import riscritta. Byte-check di encoding sui 5 file: **0 artefatti**. Il
bundle resta **identico in dimensione** (1.128,1 kB): refactor net-zero a runtime.

**Insidia reale**: un assert sbagliato di una riga (il doc-block di
`reindirizzaAllaFonte` inizia con `/**`, non con il testo descrittivo) ha
bloccato l'intera passata — nessun file scritto — ed è stato corretto dopo la
diagnostica.

**Numeri**: file > 300 righe in `src/` **39 → 38**; bundle invariato; nessun
nuovo file sopra soglia (max 180 righe).

---

## 5-octies. Wave 10 — ✅ ESEGUITA: `DashboardPage.tsx` (356 → **124 righe**)

Il file conteneva **due** componenti esportati (`DashboardLayout` + `DashboardPage`)
più tre sezioni di pagina. La decomposizione separa il guscio di routing dalle
viste, tutte in `src/pages/dashboard/components/`.

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| `DashboardLayout` (Header + nav + boundary + Outlet + Footer) | 63 | `components/DashboardLayout.tsx` | 71 |
| Barra delle tab (`<nav>` con `NavLink`) | 25 | `components/DashboardNav.tsx` | 57 |
| Banner «Finisci di completare il tuo Radar» | 23 | `components/BannerBozzaOnboarding.tsx` | 39 |
| Vetrina freemium per gli ospiti | 32 | `components/VetrinaRadarOspiti.tsx` | 48 |
| Accordion «Opportunità mappate» + card + urgenza | 64 | `components/ElencoOpportunita.tsx` | 148 |
| `TabNav`, `DIPARTIMENTI_DASHBOARD`, helper di urgenza | 40 | guscio (`DashboardLayout`/`DashboardNav`) e viste | — |

La pagina conserva: `useApp`, `hasAccessoPro`/`feedBloccatoBase`, il filtro delle
opportunità attive (gate identitario + ordinamento per scadenza), lo stato
dell'accordion, `toggleOpportunita`, `haBozzaOnboarding` e la composizione delle
sezioni.

**Scelte di disaccoppiamento**
- **`ElencoOpportunita` con props raggruppate** (`accordion`, `filtri`): le
  etichette leggibili dei filtri (`classeByCodice`, `province`) sono derivate
  **dentro** il componente, quindi il contenitore non dipende più da `@/data`.
- **Azioni come callback**: `onRiprendi`, `onRegistrati`, `onCompletaProfilo`
  sostituiscono le chiamate dirette al contesto → i sotto-componenti non toccano
  `useApp` (nessuno stato, nessun effetto).
- **`TabNav` e `DIPARTIMENTI_DASHBOARD`** restano nel guscio/nav; `App.tsx` ora
  importa `DashboardLayout` da `@/pages/dashboard/components/DashboardLayout`.
- **Zero cicli**: `DashboardNav` importa solo `react-router-dom`; le viste solo
  lucide / `@/components` / `@/data`; nessuno importa la pagina.

**Fidelity**: gli 8 punti di rinominazione in `ElencoOpportunita` sono
`opportunitaAttive.length` → `totale` (badge e ramo vuoto), `aperto`/`onToggle`,
`user && !preferenze.onboarded` → `mostraInvitoProfilo`, `openRadarSetup` →
`onCompletaProfilo`, `listaOpportunita.map` → `lista.map`; markup e classi
Tailwind invariati.

**Insidia reale (di ambiente)**: a metà wave il terminale della sessione ha
smesso di eseguire comandi (anche `echo` non riporta più l'esito). Le estrazioni
verbatim erano già concluse, quindi **non c'è stato alcun salvataggio parziale**;
il resto (pulizia del file originale, `ElencoOpportunita`, `App.tsx`) è stato
completato con l'editor e verificato per lettura. Le verifiche automatiche della
wave 10 restano da eseguire (§8).

**Numeri**: file > 300 righe in `src/` **38 → 37**; nessun nuovo file sopra
soglia (max 148 righe). Bundle atteso invariato (refactor strutturale).

---

## 5-nonies. Wave 11 — ✅ ESEGUITA: `StepDocumenti.tsx` (350 → **188**) e `NotizieHero.tsx` (304 → **96**)

Due file, due nature: un **form multi-modale** (CFU) e una **hero editoriale**
(Notizie) con helper di calendario. Entrambi lasciano nei contenitori solo stato,
handler e composizione.

### 5-nonies.1 `StepDocumenti` → `components/documenti/`

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| Selettore modalità (`<nav>`/tab) + `ModalitaInserimento` | 19 | `documenti/TabInserimento.tsx` | 47 |
| Pannello «Carica documento» (dropzone + allegati) | 62 | `documenti/PannelloDocumento.tsx` | 99 |
| Pannello «Incolla l'elenco» (OCR) | 22 | `documenti/PannelloTesto.tsx` | 41 |
| Pannello «Inserimento manuale» (form 3 campi) | 44 | `documenti/PannelloManuale.tsx` | 69 |
| Riepilogo «Esami in archivio» | 27 | `documenti/ArchivioEsami.tsx` | 50 |
| Barra di avanzamento + CTA | 16 | `documenti/AzioniContinua.tsx` | 36 |

Il contenitore conserva: stato (`modalita`, ref file, errore, campi, testo, nota),
`cambiaFile` (validazione + accodamento), `aggiungiManuale`, `riconosciTesto`,
`pronto`/`totaleCfu`, testata con `PrivacyBadge`, bottone demo e nota di esito.

**Scelte**
- Il **form manuale** riceve `campi` + `onCambia(campo, valore)` + `onAggiungi(e)`:
  validazione e creazione dell'esame restano in un unico punto nel contenitore.
- Il **selettore** nasconde le proprie etichette in una costante privata
  (`MODULI`) ed esporta il tipo `ModalitaInserimento`.
- Nessuno dei 6 pannelli importa il contenitore: zero cicli, nessun `useApp`.

### 5-nonies.2 `NotizieHero` → `components/hero/` + modulo vacanze

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| `dataPasqua` + `giorniCiviliTra` + `prossimeVacanze` | 92 | `notizie/vacanzeScolastiche.ts` | 106 |
| Colonna sinistra (masthead, sottotitolo, slogan, badge, Categorie) | 82 | `hero/TestataEditoriale.tsx` | 119 |
| Colonna destra (boundary + Revolver + countdown) | 41 | `hero/WidgetScadenze.tsx` | 60 |

Il contenitore conserva: copy (`SOTTOTITOLO_NOTIZIE`, `SLOGAN_NOTIZIE`), `SeoMeta`,
orologio a mezzanotte (effetto + `useMemo` su `prossimeVacanze`) e la griglia a 2
colonne.

**Scelte**
- Il tipo di ritorno del countdown è stato estratto in **`ContoVacanze`** (ex tipo
  inline di `prossimeVacanze`): lo condividono modulo e widget.
- La testata riceve `sottotitolo`/`slogan` **come prop** (il copy resta nel
  dipartimento, dove serve anche a `SeoMeta`): nel corpo sono stati rinominati 2
  soli riferimenti.
- Effetto collaterale positivo: NotizieHero non esporta più funzioni di dominio →
  **sparisce il warning `react-refresh/only-export-components`** che aveva dalla wave 8.

**Equivalenza**: 237 righe di codice nell'originale, **228 verbatim**; le 9
differenze sono: 4 righe di import riscritte, la firma di `prossimeVacanze`
(→ `ContoVacanze`), 2 usi del copy passato come prop. Zero artefatti di encoding.

**Numeri**: file > 300 righe in `src/` **37 → 35** (nessun nuovo file sopra
soglia: max 148); bundle 1.129,6 kB (+0,2 kB); build OK; 342 assert.

---

## 5-decies. Wave 12 — ✅ ESEGUITA: `ArchivistaCapo.tsx` (390 → **87 righe**)

Componente **non montato** (attivazione prevista a Ottobre): il refactor prepara
il terreno senza toccare il comportamento. Il file conteneva un'intera macchina a
stati (5 fasi) + 4 callback async + il JSX del bancone.

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| Stato, refs, catena `gestisciPronto`/`chiediProssimo`/`avvia`, effetto mount, `rispondi`/`invia`/`ricomincia` | 215 | `hooks/useIntervistaArchivista.ts` | 295 |
| `DomandaCorrente` + `Fase` | 8 | `archivistaTipi.ts` | 16 |
| Intestazione (sigillo, titolo, Ricomincia, Archivio) | 27 | `components/IntestazioneArchivista.tsx` | 50 |
| Conversazione (risposta, messaggio, attesa, campo libero) | 45 | `components/ConversazioneArchivista.tsx` | 91 |
| Esiti (recupero, documento pronto, errore) | 33 | `components/EsitoArchivista.tsx` | 72 |

Il contenitore conserva: props, `containerRef` + auto-scroll, composizione
(intestazione + bancone) e il `return` con la classe condizionale sulla fase.

**Scelte**
- **Tipi in `archivistaTipi.ts`**: `Fase` serve sia al motore sia alle viste, che
  così non dipendono dall'hook (evita anche di sfondare le 300 righe nel hook).
- **`apriPronto()` nell'hook**: la guardia `pronto && onDocumentoPronto(...)` non
  entra nel JSX: il bottone riceve una callback già sicura.
- **Fragment nelle viste**: Conversazione ed Esiti rendono più fratelli senza
  aggiungere nodi al DOM (le viste erano già figlie di un unico wrapper nel
  bancone: il markup utile resta identico).
- **Zero cicli**: viste → `../archivistaTipi` + `../cacheService` + lucide;
  hook → `../archivistaTipi` + `../cacheService` + `useApp`; nessuno importa il
  contenitore.

**Equivalenza**: 331 righe di codice nell'originale, **323 verbatim**; le 8
differenze sono: 3 righe di import riscritte, `interface DomandaCorrente`/`type
Fase` (ora esportati nel modulo tipi) e le 3 `onClick` diventate prop.

**Nota (bug latente, NON corretto)**: nel blocco dell'input libero il testo
contiene `\u2019` e `\u2026` **come testo JSX** (non in una stringa): oggi
renderebbe letteralmente `L\u2019Archivista…`. È preesistente e fuori dallo scope
del refactor (il componente non è montato): da correggere all'attivazione di
Ottobre, insieme al montaggio.

**Nota (warning preesistenti)**: l'hook eredita 2 warning
`react-hooks/exhaustive-deps` perché le `useCallback` originali non elencavano
`onDocumentoPronto`/`onAccessoRichiesto`: sono **identici** a quelli del file
pre-refactor (codice spostato verbatim) e restano volutamente invariati.

**Numeri**: file > 300 righe in `src/` **35 → 34**; bundle 1.129,6 kB (invariato);
build OK; 342 assert; `tsc` exit 0.

---

## 5-undecies. Wave 13 — ✅ ESEGUITA: `pdfGenerator.ts` (733 → **24 righe**)

Primo **servizio** del piano: nessuna UI, quindi la fedeltà si verifica sui
*documenti generati*, non a occhio. Il file conteneva un template literal CSS di
~590 righe, le funzioni di layout/stima e l'assemblatore del documento.

| Blocco (prima) | Righe | Destinazione | Righe |
|---|---:|---|---:|
| CSS parte 1/4 — foglio A4, tipografia, anatomia 2 colonne | 163 | `pdf/stiliBase.ts` | 175 |
| CSS parte 2/4 — firme, righe guida, dichiarazioni, campi liberi | 130 | `pdf/stiliBlocchi.ts` | 141 |
| CSS parte 3/4 — Regola 1 (densità) + Regola 3 (inclusione) | 136 | `pdf/stiliDensita.ts` | 148 |
| CSS parte 4/4 — Regola 6 (stampa), footer, firme bipartite, Atto Pubblico | 159 | `pdf/stiliStampa.ts` | 170 |
| Composizione del CSS | — | `pdf/stiliDocumento.ts` | 18 |
| `calcolaLayout` + `stimaPagine` + `aggiungiIndice` | 77 | `pdf/layout.ts` | 78 |
| `escapeHtml` | 8 | `pdf/testo.ts` | 16 |
| `LOGO_DOCUMENTO`, `FOOTER_UFFICIALE_DOCUMENTO`, `DocumentoPronto`, `costruisciDocumento` | 76 | `pdf/documento.ts` | 62 |
| — | — | `pdfGenerator.ts` (barrel pubblico) | 24 |

**Scelte**
- **`pdfGenerator.ts` resta l'entry point**: solo `export … from './pdf/…'`, così
  i consumatori (`cacheService`, `templatePrescrittivi`, `ModuloPreview`,
  `scripts/test-pdf*.ts`) non cambiano una riga né un import.
- **CSS spezzato in 4 parti monotematiche** che ricalcano le sezioni già presenti
  nei commenti del foglio di stile (base · blocchi · densità/inclusione · stampa);
  le parti si concatenano in `stiliDocumento.ts` **senza toccare righe vuote**,
  perché fanno parte del CSS.
- `aggiungiIndice` è ora `export` (serve a `documento.ts`): unica firma cambiata.
- **Zero cicli**: `stili*` non importano nulla; `testo` → nulla; `layout` → `testo`;
  `documento` → `stiliDocumento` + `testo` + `layout` + `logoDataUri`; il barrel →
  `documento`/`layout`/`testo`.

**Verifica di fedeltà (la più forte del piano)**: le 5 suite PDF
(`test:pdf`, `:breve`, `:brevi`, `:universita`, `:completo`) generano **92
documenti**. Snapshot PRIMA del refactor: 92 file / 5.713.825 byte / hash
`02916356093CC5C5BBD6A1C09428F2C1DE23484DBA893CEB4238E82B8090FC5D`. Dopo il
refactor: **stessi 92 file, stessi byte, hash identico** → HTML, CSS, indice,
classificazione compatto/esteso e stima pagine sono invariati byte per byte.

**Insidie reali**: il primo tentativo è stato abortito dagli assert per due
off-by-one (indici 0-based vs numero di riga mostrato dal dump) e da un assert con
apostrofo mal quotato in PowerShell (`'REGOLA D''ORO 6'` dentro una stringa
doppia): nessuna scrittura parziale, corretti dopo diagnostica su file.

**Numeri**: file > 300 righe in `src/` **34 → 33** (max nuovo file 175 righe);
bundle 1.129,6 kB (invariato); build OK; 342 assert; `tsc` exit 0.

---

## 5-duodecies. Wave 14 ✅ completata — `AppContext.tsx`: 10 slice eseguite (1634 → 282 righe)

Contesto consumato da **42 file**: ogni slice è uno spostamento *verbatim* con
ri-esportazione dei nomi pubblici, così nessun consumatore cambia riga.

| Slice | Righe sorgente | Destinazione | Stato |
|---|---:|---|---|
| Tipi + costanti pubbliche (`LIMITE_NOTIFICHE_PROVA`, `STORAGE_KEY_RADAR_WIZARD_PENDING`, `User`, `Preferenze`, `Esame`, `RuoloSimulato`, `AppState`, `AppContextValue`) | 169 | `contexts/app/types.ts` (179) | ✅ **fatta** |
| Helper puri (`mapNoticiaToInterpello`, `normalizzaPiano`, `pianoDaProfilo`, `provaProScaduta`, `tracciaSignupCompletato`) | 89 | `contexts/app/helpers.ts` (101) | ✅ **fatta** |
| Stato + callback dei modali globali (auth, wizard, PRO-Gift, OAuth bounce, vetrina) | 42 | `contexts/app/useModaliApp.ts` (103) | ✅ **fatta** |
| `defaultPreferenze` | 17 | `contexts/app/costanti.ts` (26) | ✅ **fatta** |
| Feed interpelli (stato + fetch Matching Engine + filtri del profilo) | 108 | `contexts/app/useInterpelliFeed.ts` (141) | ✅ **fatta** |
| Azioni di account (register, login demo/Supabase, accediDemo, logout, login Google + effetto demo) | 190 | `contexts/app/useAzioniAccount.ts` (255) | ✅ **fatta** |
| Preferenze, esami e notifiche (localStorage + normalizzazione classi + contatore RPC) | 64 | `contexts/app/usePreferenzeUtente.ts` (139) | ✅ **fatta** |
| Checkout Stripe (`salvaIntendedPlan`, `avviaCheckout` + lock anti-concorrenza) | 145 | `contexts/app/useCheckout.ts` (186) | ✅ **fatta** |
| Profilo/anagrafica/trial/crediti (`simulaStato`, `resettaTutto`, `salvaProfilo`, `consumaCredito`, `valutaProfiloIncompleto`, `aggiornaAnagrafica`, `refreshProfilo`, `aggiornaRadarAttivo`, `attivaTrialPro`) | 332 | `contexts/app/useProfiloAccount.ts` (435) | ✅ **fatta** — ⚠️ oltre 300 righe: candidato a split in wave 15 |
| Bootstrap/sessione (5 effetti: caricamento profilo dal DB, `onAuthStateChange`, refresh focus/60 s, wizard Radar in attesa, ripresa checkout) | 303 | `contexts/app/useBootstrapProfilo.ts` (389) | ✅ **fatta** — ⚠️ oltre 300 righe: split consigliato in wave 15 |

`AppContext.tsx` **1634 → 282** righe (**−1352, −83%**): il provider ora è solo
composizione di hook, calcoli derivati, `value` e `useApp`. API pubblica
**identica**: `User`, `Preferenze`, `Esame`, `RuoloSimulato`, `LIMITE_NOTIFICHE_PROVA`,
`STORAGE_KEY_RADAR_WIZARD_PENDING`, `AppProvider`, `useApp` (`AppState`/`AppContextValue`
restano interni). Dipendenze emerse da `tsc`/eslint e risolte: `PianoId` (usato da
`avviaCheckout`) importato in `types.ts`; `STORAGE_KEY_RADAR_WIZARD_PENDING`
ri-esportato senza import locale; usciti dal provider `province`, `track`,
`defaultPreferenze`, `getModuliScaricati`, `normalizzaClassi`, `pianoDaProfilo`,
`provaProScaduta`, `tracciaSignupCompletato`, `identify`, `supabase`,
`STORAGE_KEY_INTENDED_PLAN*` e i tipi `Preferenze`/`RuoloSimulato`. `loading` è
stato spostato sopra la chiamata dell'hook (era dichiarato dopo gli effetti, e
passarlo come argomento richiede l'inizializzazione); l'**ordine degli effetti è
quello originale** e nel provider resta solo la guardia del PRO-Gift.

**Verifica**: `tsc` exit 0 · `npm run build` OK (9,28 s) · **342 assert** ·
eslint 0 errori (13 warning: 3 `react-refresh` su costanti + `useApp`, 2
`exhaustive-deps` storiche nel provider, 8 `exhaustive-deps` sugli array
**verbatim** dei due hook nuovi — `setPianoStato`, `pianoSessionUserIdRef`,
`setCrediti`, `setProfiloIncompleto`, `setLoading`, …: omissioni preesistenti
delle vecchie deps array, nessun impatto sul comportamento perché setter di stato
e ref sono stabili).

**Bilancio file > 300 righe in `src/`**: 34 (invariato): `AppContext.tsx` è
uscito dal gruppo, `useProfiloAccount.ts` (435) e `useBootstrapProfilo.ts` (389)
sono entrati ⇒ wave 15 può spezzarli (`useAnagraficaProfilo` + `useRadarTrial`;
`useAuthSync` + `useBootstrapCheckout`).

### Slice successive (tutte completate)

| Slice | Righe | Modulo | Note |
|---|---:|---|---|
| Azioni account (register/login/…/logout) | ~175 | `contexts/app/useAzioniAccount.ts` | ✅ fatta |
| Checkout (`salvaIntendedPlan`, `avviaCheckout`) | 145 | `contexts/app/useCheckout.ts` (186) | ✅ fatta — ref anti-concorrenza isolata |
| Profilo/anagrafica/trial/radar | 332 | `contexts/app/useProfiloAccount.ts` → **139** (era 435) | ✅ fatta + **wave 15**: split in `useAnagraficaProfilo` (194), `useRadarTrial` (186), `useStatoSimulato` (106) |
| Bootstrap (5 effect di caricamento) | 303 | `contexts/app/useBootstrapProfilo.ts` → **112** (era 389) | ✅ fatta + **wave 15**: split in `useProfileBootstrap` (180), `useAuthSync` (167), `useBootstrapCheckout` (87) |

Vincoli: estrarre **blocchi contigui** sostituiti *in loco* (React richiede ordine
stabile degli hook); gli effetti 1112-1415 referenziano setter dichiarati più
avanti nel corpo (funziona perché i riferimenti sono dentro i callback) ⇒
passarli come argomenti senza spostarli. Nessun test automatico copre il
contesto: la verifica resta `tsc` + `build` + `npm test` + suite PDF + smoke test
manuale (login/logout, piano/trial, persistenza preferenze, wizard Radar,
vetrina, redirect checkout).

---

## 5-terdecies. Wave 15 ✅ completata — split dei due hook di contesto (facade)

I due hook nati in wave 14 e rimasti sopra le 300 righe sono stati divisi in
**moduli focalizzati + una facade sottile** che conserva firma e API pubblica:
`AppContext.tsx` non ha richiesto **nessuna modifica**.

| Modulo | Righe | Contenuto |
|---|---:|---|
| `contexts/app/useAnagraficaProfilo.ts` | 194 | `salvaProfilo`, `consumaCredito`, `valutaProfiloIncompleto`, `aggiornaAnagrafica` (+ `DatiAnagrafici`) |
| `contexts/app/useRadarTrial.ts` | 186 | `refreshProfilo`, `aggiornaRadarAttivo`, `attivaTrialPro` |
| `contexts/app/useStatoSimulato.ts` | 106 | `simulaStato`, `resettaTutto` (DevToolbar) |
| `contexts/app/useProfiloAccount.ts` | **139** (era 435) | facade: `useAnagraficaProfilo` + `useRadarTrial` + `useStatoSimulato` |
| `contexts/app/useProfileBootstrap.ts` | 180 | effetto 1: caricamento iniziale del profilo/preferenze dal DB |
| `contexts/app/useAuthSync.ts` | 167 | effetti 2-3: `onAuthStateChange` + refresh su focus/visibility e ogni 60 s |
| `contexts/app/useBootstrapCheckout.ts` | 87 | effetti 4-5: wizard Radar "in attesa" + ripresa checkout |
| `contexts/app/useBootstrapProfilo.ts` | **112** (era 389) | facade: i tre moduli, chiamati nell'ordine originale degli effetti |

**Fidelità**: corpi di callback ed effetti spostati *verbatim* (commenti, log,
messaggi d'errore e array di dipendenze compresi); l'unico aggiustamento è di
forma — `DatiAnagrafici` è importato **e** ri-esportato dalla facade, perché un
`export … from` non introduce il nome nello scope locale.

**Dipendenze**: grafo aciclico `types/costanti/helpers → hook focalizzati →
facade → AppContext`; nessun modulo importa una facade (solo `AppContext.tsx`
importa `useProfiloAccount` e `useBootstrapProfilo`) ⇒ **zero dipendenze
circolari**. L'ordine di chiamata delle facade è quello originale degli hook,
quindi la sequenza degli effetti React è invariata.

**Verifica**: `tsc` exit 0 · `npm run build` OK (6,62 s) · **342 assert** ·
eslint `src/contexts` 0 errori (13 warning, tutte preesistenti: 3 `react-refresh`,
10 `exhaustive-deps` su array di dipendenze ereditati). **File > 300 righe in
`src/`**: **34 → 32** — nessun modulo di contesto sopra soglia (il più grande è
`useAzioniAccount.ts` a 255).

---

## 6. Wave 3 e 4 — backlog

**Wave 14 (servizi, con test a corredo)** — restano i servizi "grossi" e i
monoliti fuori bundle: `AppContext` (1634), `matchingEngine`, `alertInterpello`,
`healthCheck`, `relevanceEngine`; `useModulistica` (372) da dividere per dominio.

**Wave 7 (servizi e stato, con test a corredo)**: `AppContext` (1634 righe),
`matchingEngine`, `alertInterpello`, `healthCheck`, `relevanceEngine`; per il
dipartimento admin il passo naturale è l'hook `useUtentiAdmin()` (stato + `carica()`
fuori dal componente, come già fatto per le funzioni pure).
Restano in pagina, per la LandingPage, le sezioni «Come funziona», valori,
fascia partner PureFocus e statistiche: estraibili con lo stesso metodo se il
file dovesse ricrescere sopra soglia.

**Wave 4 (servizi e contesto, richiede rete di test)**
- `AppContext.tsx` (1634): estrarre in `contexts/app/` i **tipi** (`User`,
  `Preferenze`, `Esame`, `AppContextValue`), i **mapper** (`pianoDaProfilo`,
  `provaProScaduta`) e i **costanti**; il provider resta il compositore.
- `matchingEngine`, `alertInterpello`, `healthCheck`, `relevanceEngine`: split per
  responsabilità con test di regressione dedicati (i test esistenti coprono già
  gli engine CFU).

**Esclusi motivati**: i 4 dataset (`data/*`, 4637 righe complessive), i 6 file
backend fuori bundle, i 2 moduli 🔒 (`AuthModal`, `PrezziPage`), i test e i tipi.

---

## 7. Regole di disaccoppiamento applicate

> **Regola vincolante**: [`MODULAR_ARCHITECTURE.md`](./MODULAR_ARCHITECTURE.md) —
> SRP e limiti di righe (250 di attenzione, **300 massimo**), struttura per
> dominio (`departments/<dominio>/{components,hooks,services,data}`), isolamento
> (niente cicli, cross-domain solo via `index.ts`, strati condivisi verso il
> basso). Applicazione automatica: `npm run test:architettura` (gate),
> `npm run arch:report` (inventario), CI su ogni push/PR
> (`.github/workflows/architettura.yml`), debito storico congelato in
> `scripts/architettura-baseline.json`.

1. **Un figlio non importa mai il padre**: i nuovi sotto-componenti importano solo
   da `@/components/*`, `@/data/*`, `@/lib/*` e dai moduli condivisi del proprio
   dipartimento (`ordineIcone`, `righeBoard`, `valutaConfigurazione`).
2. **Props esplicite, mai `useApp()` nei pannelli**: i pannelli del wizard non
   conoscono il contesto: stato, handler e limiti arrivano come props. Così sono
   montabili in isolamento (story/test) e non creano dipendenze circolari.
3. **Gruppi di props coerenti** (`selezioneClassi`, `selezioneMaterie`, `notifica`,
   `piano`) + destrutturazione in testa: interfaccia leggibile senza rinominare il
   corpo JSX.
4. **Dipendenze solo verso il basso**: contenitore → pannelli → moduli puri
   (`righeBoard`, `valutaConfigurazione`, `ordineIcone`), mai il contrario.
5. **Un punto di ingresso per dipartimento**: `departments/radar/index.ts` espone 5
   simboli; il resto è invisibile all'esterno.
6. **Nessun `any` aggiunto**: i props riusano i tipi esistenti (`OrdineScuola`,
   `Provincia`, `Materia`, `ClasseConcorso`, `PianoLimits`).

---

## 8. Verifiche eseguite

| Comando | Esito |
|---|---|
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ **0 errori** (verificato dopo ogni wave, wave 13 inclusa) |
| `npm run build` | ✅ build completata; **bundle 1.144,5 → 1.129,6 kB** dalle wave 4-13 |
| `npm test` (suite CFU) | ✅ **342 assert** superati (7 suite), `exit 0` |
| `npm run test:pdf*` (5 suite PDF) | ✅ **92 documenti generati identici byte-per-byte** alla baseline pre-refactor (hash `0291…FC5D`, 5.713.825 byte) — wave 13 |
| `npx eslint src/pages src/components src/departments src/modules` | ✅ **0 errori** nei file nuovi/modificati; restano 3 errori **preesistenti e non correlati** (`NotizieDettaglio`, `tracciaFonte`, `cacheService`) + 2 warning `exhaustive-deps` ereditati verbatim dal vecchio `ArchivistaCapo` |
| File > 300 righe in `src/` | ✅ **44 → 33** (wave 1-13); i nuovi moduli sono tutti ≤ 295 righe |

### ✅ Wave 10 e 11 — verifiche automatiche

La wave 10 era stata completata con l'editor mentre il terminale della sessione
era bloccato (non eseguiva più alcun comando). Alla riapertura del terminale la
suite è stata rieseguita **su tutte le wave** con esito positivo: `tsc` exit 0,
`vite build` OK, 342 assert, eslint pulito su
`src/pages src/App.tsx src/pages/dashboard` e su `src/departments/{cfu/calcolatore,notizie}`.
Le modifiche fatte a mano in wave 10 sono quindi confermate corrette dal
compilatore, non solo dalla lettura.

#### Wave 11 — comandi ed esiti

```bash
npx tsc --noEmit -p tsconfig.app.json       # exit 0
npm run build                               # OK, bundle 1.129,6 kB
npm test                                    # 342 assert (7 suite)
npx eslint src/departments/cfu/calcolatore  # 0 problemi
npx eslint src/departments/notizie          # 2 errori preesistenti (NotizieDettaglio, tracciaFonte)
```

Verifica di equivalenza (confronto riga-per-riga contro i backup `_orig11*.txt`):
`StepDocumenti` **315/331** righe verbatim, `NotizieHero` **228/237**; zero
artefatti di encoding in tutti i nuovi moduli.
| Import orfani | ✅ rimossi in ogni wave (ultimo: 13 in `OnboardingPage`) + 1 direttiva ESLint superflua |
| Cicli di importazione | ✅ assenti: ogni sotto-componente importa solo librerie, `@/components`, `@/data`, `@/lib` o fratelli dello stesso dominio |
| Fedeltà UI | ✅ corpi JSX spostati **verbatim**: classi Tailwind e markup identici all'originale |

**Errori reali intercettati durante la wave 1** (e corretti): import di
`contieneClasse` dal modulo sbagliato (`@/data/classiConcorso` invece di
`@/lib/matchingEngine`), collisione di nome fra il gruppo di props `materie` e
l'array dati `materie` (rinominato in `selezioneMaterie`), 2 import orfani.

---

## 9. Rischi e limiti dichiarati

- **Nessun test visivo automatico**: la parità è garantita dal fatto che il JSX
  non è stato toccato, ma resta consigliato un giro di smoke test manuale delle
  4 schermate Radar (wizard nei 4 passi + annullamento, preferenze, Radar Live).
- **`PassoClassiMaterie` è ancora 344 righe**: ha una sola responsabilità (passo 3)
  ma contiene 3 sotto-sezioni (classi / materie / sostegno) che possono diventare
  3 file in una wave successiva.
- **Il contenitore del wizard resta 559 righe**: contiene stato, validazione,
  salvataggio e footer. La prossima riduzione richiede di spostare la logica di
  salvataggio in un hook (`useSalvataggioWizard`), con test a corredo.
- **`scripts/_split-analysis.mjs`** è uno strumento di sviluppo (come gli altri
  `scripts/_*.mjs` già presenti nel repo): non fa parte del bundle.
- **Wave 2 — smoke test consigliato**: bacheca Preferenze Radar (apertura/chiusura
  dei 6 accordion, selezione ordini/classi/materie/province, filtri scuole,
  canali) e pagina `/` pubblica (hero, benefici, CTA, footer). La parità è
  garantita dal markup verbatim, ma il comportamento dinamico va visto a schermo.
- **Wave 3 — smoke test consigliato**: header su desktop e mobile — apertura
  tendina utente (avatar e freccia), badge piano nei tre stati (loading / PRO /
  Base / Free Forever), drawer mobile (link, riepilogo utente, uscita), barra
  strumenti nascosta su `/dashboard`, ramo ospite con «Accedi».
- **Wave 4 — smoke test consigliato**: `/admin` con i tre tab — tabella utenti
  (ricerca, filtri rapidi, ordinamento, colonne configurabili, export CSV),
  modifica inline e reset password, creazione utente, cancellazione con conferma
  testuale, dettaglio utente; tab Radar (attivazione scuola); tab Account
  (upgrade/ritorno a Base/Free Forever, referral, sezione congelata).
- **`TabUtenti` è sceso a 301 righe** (da 623): resta un contenitore di stato e
  handler CRUD. Il passo successivo è l'hook `useUtentiAdmin()`
  (stato `utenti`/`caricamento`/`errore` + `carica()` + `setUtenti`), che porta il
  file sotto le 270 righe e rende il data-layer testabile con `fetch`/Edge mockati.
- **Wave 6 — smoke test consigliato**: `/dashboard/moduli` — ricerca con refuso
  («sostengo» → «sostegno»), skeleton di consultazione, risultati, drill-down
  macroarea → sottocategoria → documento, paginazione, breadcrumb, modelli salvati,
  download/anteprima, avviso di accesso per gli ospiti.
- **`useModulistica` (372 righe)**: è il data-layer del modulo (catalogo, ricerca,
  download cache-first, DB dei salvati, anteprima). Prossimo split naturale, per
  dominio: `useRicercaCatalogo` · `useModuliSalvati` · `useAnteprimaDocumento`.
- **Wave 7 — smoke test consigliato**: `/onboarding` — i 4 passi (anagrafica +
  ordini, classi/materie, province, canali), validazione «Avanti» bloccata sui
  campi obbligatori, collegamento Telegram, «Attiva il Radar» e redirect finale.
- **Cartella di feature**: `OnboardingPage.tsx` è ora in
  `src/pages/onboarding/` accanto ai suoi `components/` (come per landing, header
  e admin): la rotta in `App.tsx` punta a `@/pages/onboarding/OnboardingPage`.
- **No `useState` nei 5 pannelli**: solo la pagina tiene lo stato del wizard.
- **Wave 8 — smoke test consigliato**: `/notizie` (hero) — il carosello Scadenze
  deve scorrere da solo ogni 5 s, andare in pausa su hover/focus, rispondere alle
  frecce e ai dots, seguire lo swipe touch/mouse (effetto gomma oltre ~140 px) e
  mostrare lo stato vuoto quando la coda è a zero. Verificare anche il loop
  ultimo→primo senza scatto (snap del clone di testa) e, con
  `prefers-reduced-motion`, l'assenza di animazioni.
- **Nessuno stato nei 4 sotto-componenti Scadenze**: contenitore (`section`,
  viewport, barra) + `TracciaRevolver`/`SlideScadenza`/`FrecceRevolver`/
  `IndicatoriRevolver` sono di sola presentazione; il comportamento vive in
  `useRevolverCarosello` (+ `useCodaScadenze` per dati/orologio), entrambi con
  interfaccia di ritorno tipizzata.
- **Wave 9 — smoke test consigliato**: `/interpello/:id` con (a) uuid di un
  avviso con fonte esterna → redirect immediato alla pagina ufficiale, (b) avviso
  con `hash_id` e senza fonte → scheda interna con gerarchia, guida e bottone
  onesto, (c) id inesistente → stato «Avviso non più disponibile» con le due vie
  d'uscita, (d) deep link legacy su tabella `notices` → stessa scheda.
- **Cartella di feature**: `InterpelloDettaglioPage.tsx` è in
  `src/pages/interpello/` con `components/` e `helpers.ts`; la rotta in `App.tsx`
  punta a `@/pages/interpello/InterpelloDettaglioPage`.
- **Wave 10 — smoke test consigliato**: `/dashboard/radar` — barra delle tab
  (4 voci + badge «Novembre» su «Invita un Collega»), tab attiva corretta a ogni
  rotta, boundary di dipartimento che si resetta al cambio rotta (`key`), banner
  bozza onboarding solo con preferenze parziali, vetrina per i non loggati,
  accordion «Opportunità mappate» (badge conteggio / 🔒 PRO per i Base, invito a
  completare il profilo, stato vuoto con etichette di classe e provincia, card con
  color-coding di urgenza). Verificare anche `/dashboard/calcolatore-cfu` e
  `/dashboard/moduli`: il guscio è condiviso.
- **Wave 11 — smoke test consigliato (CFU)**: `/calcolatore-cfu` → Step 2
  «Documenti»: i tre tab (Carica documento / Incolla l'elenco / Inserimento
  manuale) azzerano la nota di esito al cambio; la dropzone accetta più file e
  rifiuta gli altri con messaggio; il riconoscimento dal testo aggiunge gli esami;
  il form manuale valida denominazione e CFU; l'elenco somma i CFU e rimuove per
  riga; il bottone demo popola il piano di studi; la CTA «Calcola i tuoi CFU» resta
  disabilitata senza dati.
- **Wave 11 — smoke test consigliato (Notizie)**: `/notizie` — masthead con
  sottotitolo e slogan, badge di fiducia, menu Categorie (filtro attivo + conteggi,
  scrollabile su mobile), colonna destra con revolver e countdown delle vacanze
  (nascosto in estate), boundary dedicato se le Scadenze falliscono.
- **`PannelloClassi` è 183 righe**: se cresce ancora, si divide in
  `PannelloClassi` + `PreferenzaSostegno`.
- **`PreferenzeRadar` resta 340 righe**: contiene stato, autosave e validazione.
  Scendere sotto 300 richiede di estrarre un hook (`usePreferenzeRadarForm`) con
  test a corredo: operazione di wave 4.
- **Profondità dello split**: fermarsi quando l'astrazione costa più di quanto
  risparmia (es. non estrarre blocchi < 25 righe usati una sola volta).




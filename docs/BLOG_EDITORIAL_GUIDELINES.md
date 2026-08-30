# 📰 ScuoleRadar — Blog Editorial Guidelines & Standard Notizie

> **Standard permanente** per il servizio Notizie (Dipartimento Notizie / Blog Engine).
> Ogni articolo pubblicato (via motore editoriale, LLM o seed) DEVE rispettare
> tassativamente le regole seguenti, sia per il motore di rilevanza e redazione
> (`src/departments/notizie/services/relevanceEngine.ts`) sia per la pipeline di
> ingestione (`src/departments/notizie/services/ingestNotizie.ts`) e per i
> componenti di pubblicazione (`NotizieGrid.tsx`, `NotizieDettaglio.tsx`).

---

## ⭐ Regole d'Oro (algoritmo editoriale)

1. **CAPACITÀ SETTIMANALE — MASSIMO 3 ARTICOLI AD ALTO VALORE**
   - Al massimo **3 articoli** per settimana (finestra mobile di 7 giorni).
   - Se non ci sono **decreti ufficiali o aggiornamenti vincolanti** per il
     personale scolastico → **0 articoli**. La bacheca non riempie il vuoto.
   - Il tetto si applica in ingestione tramite `limitaArticoliSettimanali`
     (gli articoli più rilevanti restano, gli esuberi recenti vengono scartati).

2. **ZERO RUMORE MARKETING / PRESS-RELEASE**
   - **RIFIUTA SEMPRE**: discorsi, interviste, dichiarazioni non vincolanti,
     comunicati stampa, campagne di comunicazione, eventi promozionali, festival,
     premi, mostre, webinar, podcast.
   - **ACCETTA SOLO** provvedimenti vincolanti: decreti, Ordinanze Ministeriali,
     note, circolari, bandi, avvisi e scadenze operative per GPS, mobilità,
     concorsi, pensioni, sostegno, supplenze e graduatorie.

3. **VALIDITÀ SCIENTIFICA E GIURIDICA**
   - Ogni articolo DEVE citare **il riferimento ufficiale esatto**: Ordinanza
     Ministeriale, Decreto, Nota prot., articolo di legge.
   - Mai riferimenti generici ("il Ministero ha comunicato…") senza l'atto
     preciso da cui la notizia deriva.
   - La notizia deve essere tracciabile a un atto consultabile su fonte
     istituzionale.

4. **LINGUAGGIO CHIARO PER CHI LAVORA A SCUOLA**
   - Spiegare la burocrazia complessa in modo semplice per docenti e personale
     ATA di tutti i giorni.
   - Ogni acronimo va spiegato alla prima menzione (GPS, SPID, CIE, SIDI…).
   - **Zero fluff e zero cliché da chatbot** ("C'è una novità ufficiale",
     "La fonte ufficiale segnala", "Vale la pena di leggere subito").
   - Il blog è un **filtro sulle fonti ufficiali**, NON una vetrina di moduli o
     template interni.

5. **STRICT URL INTEGRITY**
   - **Niente mockup**, niente segnaposto, niente URL inventati.
   - **Niente fallback a root-domain generici**: mai linkare homepage come
     `https://www.mim.gov.it/` come "fonte".
   - Tutti i link devono essere **link di approfondimento reali** e validati
     **HTTP 200** in fase di ingestione (niente link rotti in pubblicazione).
   - Uniche radici ammesse: i **portali di servizio** dove la radice È l'accesso
     operativo (InPA, INPS). Istanze Online/POLIS ha una pagina canonica dedicata.

6. **GESTIONE PDF UFFICIALI**
   - Se la fonte è un **documento PDF ufficiale** (o l'avviso fornisce un PDF
     allegato), il componente UI deve mostrare un **bottone/icona dedicato**
     **"Visualizza PDF Ufficiale"** che apre il PDF direttamente in una nuova
     scheda (`target="_blank"`).
   - Il PDF deve essere reale e raggiungibile (validato HTTP 200).

---

## 1. Soglia settimanale e selezione

- Finestra mobile: **ultimi 7 giorni** dalla data di ingestione.
- Selezione in caso di esubero: prima per **punteggio di rilevanza**
  (`relevance_score`), poi per data di pubblicazione più recente.
- Gli articoli più vecchi della finestra non vengono mai toccati (accumulo).
- Nessun articolo in assenza di provvedimenti vincolanti: il motore risponde
  con `0` e la bacheca resta invariata.

## 2. Filtro editoriale: cosa accettare, cosa rifiutare

- **ACCETTA** (`PAROLE_ACCETTA`): decreto, decreto ministeriale, ordinanza,
  nota prot., circolare, bando, avviso, scadenza, termine ultimo, domanda,
  istanza, pubblicazione, rettifica, proroga, conferimento, nomina…
- **RIFIUTA** (`PAROLE_RIFIUTA`): intervista, discorso, dichiarazione del
  ministro, comunicato stampa, conferenza stampa, cerimonia, inaugurazione,
  premiazione, premio letterario, spettacolo, spot, campagna di comunicazione,
  campagna social, webinar, seminario, podcast, mostra, fiera, concorso
  artistico, festa, evento sportivo, manifestazione, sondaggio…
- La categoria viene dedotta con `PAROLE_CATEGORIA` (GPS, Mobilità, Concorsi,
  Pensioni, Sostegno, Graduatorie, Supplenze, Scuole, PNRR).

## 3. Validità giuridica e citazioni

- Il paragrafo di apertura deve sempre collegare il fatto **all'atto ufficiale**
  (es. "l'Ordinanza Ministeriale n. X del…", "il Decreto Ministeriale…").
- Nel prompt LLM di scrittura (`promptScritturaArticolo`) la citazione è
  **obbligatoria**: se la fonte non consente di citare un riferimento preciso,
  l'articolo non viene scritto.
- Data di scadenza sempre **esatta** (ISO in ingresso, italiano in uscita);
  vietati "le date saranno confermate" o testi vaghi.

## 4. Stile e linguaggio

- Tono: giornalistico, sobrio, orientato all'azione ("come agire").
- Struttura fissa: **3 paragrafi** — 1) fatto + riferimento + scadenza,
  2) chi è coinvolto e cosa significa in pratica, 3) dove e come agire con link
  contestuale.
- Acronimi spiegati alla prima menzione; niente sezioni `<h2>` nel corpo.
- Link contestuali: ogni menzione di portale esterno è un `<a>` cliccabile
  (`target="_blank" rel="noopener noreferrer"`) verso l'URL reale di
  approfondimento.

## 5. Integrità degli URL (Strict URL Integrity)

- `validaUrlDeepLink` (controllo puro, senza rete) rifiuta:
  - URL non HTTP(S);
  - root-domain generici (es. `https://www.mim.gov.it/`);
  - URL con segnali da mockup/placeholder (`example.com`, `localhost`,
    `mockup`, `:5173`…).
- `verificaUrlUfficiale` (controllo di rete, in `newsFetcher.ts`) verifica che
  il link risponda **HTTP 200/3xx** prima di pubblicare.
- Mappa dei portali (`URL_PORTALI`) — link verificati:
  | Portale | URL | Note |
  |---|---:|---|
  | Istanze Online / POLIS | `https://www.istruzione.it/polis/Istanzeonline.htm` | Pagina ufficiale POLIS (200 ✓) |
  | InPA | `https://www.inpa.gov.it/` | Portale del Reclutamento (200 ✓) |
  | MIM — Notizie | `https://www.mim.gov.it/web/guest/notizie` | Link di profondità (200 ✓) |
  | INPS | `https://www.inps.it/` | Portale di servizio (200 ✓) |
  - **NOTA**: la radice `https://www.istanze.istruzione.it/` e il percorso
    `/istanzeonline/` sono irraggiungibili/404: usare SEMPRE la pagina POLIS
    canonica `https://www.istruzione.it/polis/Istanzeonline.htm` (200 ✓).

## 6. PDF ufficiali

- `èLinkPdf(url)` riconosce i link a file `.pdf` (anche `official_source_url`
  che punta direttamente a un PDF).
- In `NotizieDettaglio.tsx` e `NotizieGrid.tsx`:
  - se `official_pdf_url` è presente **oppure** la fonte è un PDF → bottone
    **"Visualizza PDF Ufficiale"** (icona PDF) che apre il file in una nuova
    scheda (`target="_blank"`);
  - il link alla pagina web ufficiale resta disponibile solo quando la fonte
    è una pagina HTML.

---

## Dove è implementato

| File | Ruolo |
|---|---|
| `src/departments/notizie/services/relevanceEngine.ts` | Motore puro: `valutaRilevanza`, `PAROLE_ACCETTA/RIFIUTA`, `URL_PORTALI`, `validaUrlDeepLink`, `èLinkPdf`, `èFonteCanonica`, `limitaArticoliSettimanali` (`MAX_ARTICOLI_SETTIMANA`), `promptFiltroLLM`, `promptScritturaArticolo`, `generaArticoloEditoriale` |
| `src/departments/notizie/services/newsFetcher.ts` | Raccolta fonti ufficiali (MIM, G.U.) + `verificaUrlUfficiale` (HTTP 200/3xx) |
| `src/departments/notizie/services/ingestNotizie.ts` | Pipeline: filtro → validazione URL → generazione → tetto settimanale → accumulo con dedupe |
| `src/departments/notizie/data/notizieSeed.ts` | Articoli seed curati a mano (conformi alle regole) |
| `src/departments/notizie/data/notizieIngestite.ts` | Archivio generato dall'ingestione (accumulo) |
| `src/departments/notizie/components/NotizieGrid.tsx` | Card con badge PDF ufficiale dedicato |
| `src/departments/notizie/components/NotizieDettaglio.tsx` | Fonti Ufficiali + bottone "Visualizza PDF Ufficiale" (`target="_blank"`) |
| `src/departments/notizie/services/newsService.ts` | Fusione seed + ingestite, fallback realistico con link di profondità |
| `.github/workflows/scrape-notizie.yml` | Cron quotidiano 06:00 UTC, commit automatico dei dati |

## Checklist di conformità (un articolo è "pronto" solo se…)

- [ ] **Max 3 articoli** per settimana (finestra mobile 7 giorni); 0 se nessun
      provvedimento vincolante
- [ ] Cita il **riferimento ufficiale esatto** (Ordinanza Ministeriale, Decreto,
      Nota prot., articolo di legge)
- [ ] **Nessun** contenuto di marketing/press-release (discorsi, interviste,
      comunicati, eventi)
- [ ] **3 paragrafi**, acronimi spiegati alla prima menzione, zero cliché
- [ ] Link di **approfondimento reali** validati HTTP 200; **nessun**
      root-domain generico né mockup
- [ ] Se la fonte è un **PDF ufficiale** → bottone dedicato
      **"Visualizza PDF Ufficiale"** che apre il PDF in nuova scheda
- [ ] Scadenza **esatta** (mai "date da confermare")
- [ ] Il blog NON promuove moduli o template interni (è un filtro sulle fonti)

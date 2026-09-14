# 📰 ScuoleRadar — Blog Editorial Guidelines & Standard Notizie

> **Standard permanente** per il servizio Notizie (Dipartimento Notizie / Blog Engine).
> Ogni articolo pubblicato (via motore editoriale, LLM o seed) DEVE rispettare
> tassativamente le regole seguenti, sia per il motore di rilevanza e redazione
> (`src/departments/notizie/services/relevanceEngine.ts`) sia per la pipeline di
> ingestione (`src/departments/notizie/services/ingestNotizie.ts`) e per i
> componenti di pubblicazione (`NotizieGrid.tsx`, `NotizieDettaglio.tsx`).

---

## ⭐ Regole d'Oro (algoritmo editoriale)

0. **PERIMETRO NAZIONALE — SOLO FONTI NAZIONALI ACCREDITATE (waterfall)**
   - ScuoleRadar è una piattaforma **nazionale**: si pubblicano solo aggiornamenti
     nazionali (MIM, Gazzetta Ufficiale, ARAN, giurisdizione contabile/
     amministrativa). Le pagine **REGIONALI/LOCALI** (USR `/web/usr-*`, AT
     provinciali) sono **escluse** (`èFonteNazionale`) e vengono **rimosse**
     dall'archivio dall'igiene dell'ingestione.
   - **Waterfall delle fonti**: la pipeline interroga i livelli in ordine di
     priorità `1 MIM → 2 Gazzetta Ufficiale → 3 ARAN → 4 giurisdizione/previdenza`
     (`raccogliLivello`) e **si ferma al primo livello che produce articoli
     validi**; scende al successivo solo se il precedente non ne ha.
   - **Finestre di lookback**: **15 giorni** per le notizie quotidiane;
     **60 giorni** per gli atti nazionali strutturali (CCNL —
     `FINESTRA_LOOKBACK_NAZIONALE_GIORNI`); **45 giorni** per gli atti numerati
     (decreti/ordinanze — `FINESTRA_ATTI_NAZIONALI_GIORNI`).
   - **Atti nazionali**: un decreto/ordinanza ministeriale **numerato** e
     **recente** è un provvedimento vincolante e viene ammesso (categoria
     inferita, `Scuole` come default; la data dell'atto NON è una scadenza).
     Sono **respinti**: la cronaca di stampa ("Valditara: …"), gli atti senza
     numero, gli atti non recenti e i CCNL di **altri comparti** (Sanità,
     Funzioni Locali, PCM…).

1. **CAPACITÀ — MASSIMO 6 ARTICOLI PER FINESTRA DI 15 GIORNI (≈3/SETTIMANA)**
   - Lookback di **15 giorni** (`FINESTRA_LOOKBACK_GIORNI`) per coprire l'avvio
     dell'anno scolastico (presa di servizio, interpelli, supplenze, nomine…).
   - Al massimo **6 articoli** ad alto valore nella finestra (`MAX_ARTICOLI_FINESTRA`,
     ≈3 a settimana).
   - Se non ci sono **decreti ufficiali o aggiornamenti vincolanti** per il
     personale scolastico → **0 articoli**. La bacheca non riempie il vuoto.
   - Il tetto si applica in ingestione tramite `limitaArticoliSettimanali`
     (gli articoli più rilevanti restano, gli esuberi recenti vengono scartati).
   - **CADENZA SETTIMANALE BLOCCATA (1–3 / settimana)**: negli ultimi **7 giorni**
     restano al massimo **3** articoli datati (`limitaCadenzaSettimanale`,
     `MAX_ARTICOLI_SETTIMANA = 3`). Vince la **freschezza** (restano i più
     recenti); lo storico più vecchio di 7 giorni non è toccato e non consuma la
     cadenza. La potatura viene applicata ad **ogni** ingestione, anche quando
     non arriva nulla di nuovo.
   - **ORDINE DI VISUALIZZAZIONE**: il feed è sempre ordinato per **data di
     pubblicazione DECRESCENTE** (`ordinaNotizie`): la prima card in alto a
     sinistra è l'aggiornamento nazionale più recente. Il punteggio di rilevanza
     NON decide la posizione (solo tie-break a parità di data).

2-bis. **GIORNALISMO UTILE — NO ALLA BUROCRAZIA VUOTA**
   - **NON si pubblicano** avvisi/atti che sono SOLO il loro riferimento formale:
     *"Decreto Direttoriale n. 1095 del 10 settembre 2026"*, *"Ordinanza
     Ministeriale n. 163 del 7 agosto 2026"*, *"Nota prot. n. X"*. Il blog non fa
     da Gazzetta Ufficiale (`attoBurocraticoVuoto`).
   - **NON si pubblicano titoli pigri** copiati dalle liste delle fonti
     (*"Concorso"*, *"Avviso"*, *"Comunicazione"*): un titolo deve dire chi/che
     cosa (`titoloInformativo`).
   - **NON si pubblica materiale d'archivio** rispolverato dagli elenchi
     (avvisi 2019/2020, riferimenti solo a vecchi anni) quando la fonte non
     attesta una pubblicazione recente (`riferimentiObsoleti`).
   - **SI pubblicano invece** le notizie di **impatto pratico** per docenti, ATA
     e organizzazione scolastica anche senza una parola-categoria ufficiale:
     welfare e polizza sanitaria del personale, formazione e aggiornamento
     professionale, sicurezza, organico e cattedre, iscrizioni, orientamento,
     inclusione (`categoriaDaImpatto` + `PAROLE_IMPATTO`). La diplomazia
     istituzionale (memorandum, protocolli d'intesa, visite) resta fuori.
3. **TITOLI AZIONE (mai copia-incolla istituzionale)**
   - Il titolo pubblicato non è quello della fonte: `titoloAzione` elimina le
     intestazioni/le code burocratiche, tiene il SOGGETTO della notizia, mette la
     categoria in testa quando aiuta e aggiunge l'urgenza con la scadenza
     (*"… — domande entro il 16 lug"*).
   - Deve essere chiaro **che cosa cambia** e **perché conta** per il lettore: il
     primo paragrafo dell'articolo apre con il fatto e l'impatto (copy dedicato
     per welfare/formazione/sicurezza), il secondo spiega a chi serve, il terzo
     dice dove agire con il link ufficiale.
4. **ZERO RUMORE MARKETING / PRESS-RELEASE**
   - **RIFIUTA SEMPRE**: discorsi, interviste, dichiarazioni non vincolanti,
     comunicati stampa, campagne di comunicazione, eventi promozionali, festival,
     premi, mostre, webinar, podcast.
   - **ACCETTA SOLO** provvedimenti vincolanti: decreti, Ordinanze Ministeriali,
     note, circolari, bandi, avvisi e scadenze operative per GPS, mobilità,
     concorsi, pensioni, sostegno, supplenze e graduatorie.
   - **Soglia categoria (avvio anno)**: la categoria viene assegnata SOLO se il
     titolo contiene una **parola-categoria ufficiale** oppure un termine **"forte"**
     dell'avvio anno (`interpelli`, `supplenze`, `presa di servizio`, `reggenze`,
     `bollettini` — `PAROLE_FORTI_INIZIO_ANNO`). Gli **avvisi tecnici/amministrativi
     generali** (es. bandi di raffrescamento, enti del Terzo settore, manifestazioni)
     vengono **scartati** perché non interessano a docenti e personale ATA.

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

5. **LINK PUNTO-A-PUNTO (Obbligatorio)**
   - **Niente mockup**, niente segnaposto, niente URL inventati.
   - **Il link ufficiale deve puntare SOLO al documento specifico**: la pagina
     dell'avviso/decreto/comunicato (o il suo PDF). È la regola
     `linkDirettoUfficiale()`.
   - **VIETATI come link**: homepage di qualunque sito (anche dei portali di
     servizio), indici ed elenchi (`/elenco-interpelli-2026`, `/atti`,
     `/archivio`, `/albo-pretorio`), pagine "notizie"/"comunicati", directory
     **URP**, pagine di ricerca (`?q=`, `?s=`, filtri) e di paginazione
     (`/page/2`).
   - I portali di servizio (Istanze Online/POLIS, InPA, INPS) si **citano a
     parole, senza link**: sono punti di accesso, non documenti.
   - **Se il link diretto non è estraibile in modo affidabile, l'articolo NON si
     pubblica** (nessun fallback a un contenitore "master").
   - La regola vale due volte: sul campo `official_source_url` **e** sui link
     dentro il testo (`linkVietatiInHtml`), validati **HTTP 200/3xx** in fase di
     ingestione.

6. **GESTIONE PDF UFFICIALI**
   - Se la fonte è un **documento PDF ufficiale** (o l'avviso fornisce un PDF
     allegato), il componente UI deve mostrare un **bottone/icona dedicato**
     **"Visualizza PDF Ufficiale"** che apre il PDF direttamente in una nuova
     scheda (`target="_blank"`).
   - Il PDF deve essere reale e raggiungibile (validato HTTP 200).

---

## 1. Soglia settimanale e selezione

- Finestra (lookback): **ultimi 15 giorni** dalla data di ingestione (`FINESTRA_LOOKBACK_GIORNI`).
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

- **Voce diretta, zero burocrazia**: si parte da **che cosa cambia** e da
  **che cosa devi fare**. Vietate le aperture istituzionali del tipo
  *"Il Ministero dell'Istruzione e del Merito ha comunicato che…"*,
  *"Il MIM ha pubblicato…"*, *"È stato pubblicato…"*, *"La notizia riguarda…"*.
- **Struttura fissa in 3 paragrafi**:
  1. **CHE COSA CAMBIA** — azione o conseguenza pratica + riferimento ufficiale
     esatto + scadenza ("Hai tempo fino al 30 settembre…"). Se la scadenza è già
     passata non si invita all'azione: si dice di verificare nel testo ufficiale.
  2. **PERCHÉ CONTA PER TE** — a chi serve (docenti, ATA, dirigenti) e che cosa
     si rischia a non muoversi.
  3. **CHE COSA FARE** — modalità, documenti e **un solo link**: quello diretto
     al documento ufficiale (etichetta onesta: "apri l'avviso ufficiale" /
     "apri il documento ufficiale (PDF)").
- Acronimi spiegati alla prima menzione; niente sezioni `<h2>` nel corpo.
- Frase breve, seconda persona ("hai", "puoi", "devi"): il lettore deve capire
  in 20 secondi se lo riguarda.

## 5. Integrità degli URL (tracciabilità e link granulari)

- **Regola d'oro**: una notizia VERA non viene mai soppressa perché il link
  diretto non è stato isolato automaticamente. L'URL non valido (mockup, login,
  non http) è l'unico motivo di blocco.
- `classificaLink(url)` distingue tre classi:
  - `diretto` → documento/pagina specifica (fonte ideale);
  - `contenitore` → pagina reale ma generica (indice, elenco, sezione, home):
    **pubblicabile come traccia**, con etichetta onesta
    ("apri la pagina ufficiale della fonte");
  - `non-valido` → mockup/placeholder/login/URL malformato: **unico blocco**.
- `risolviFonteGranulare(voce)` (in `tracciaFonte.ts`) **traccia** la fonte
  quando la voce punta a una pagina di elenco: confronta il titolo con i link e i
  testi della pagina (parole, numeri dell'atto, slug) e restituisce la
  sottopagina/circolare/PDF che è la base fattuale della notizia. Se non trova un
  match affidabile, pubblica comunque con la pagina disponibile.
- `linkNonValidiInHtml(html)` blocca solo i link non validi nel testo;
  `linkVietatiInHtml(html)` resta come diagnostica (contenitori presenti).
- `verificaUrlUfficiale` (rete, `newsFetcher.ts`) verifica lo **status HTTP
  200/3xx** dell'URL scelto prima della pubblicazione.
- Manutenzione: `npm run notizie:ripara-archivio` rigenera il copy dell'archivio
  storico secondo le regole correnti e rimuove le voci non conformi.

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
| `src/departments/notizie/services/relevanceEngine.ts` | Motore puro: `valutaRilevanza` (anti-burocrazia: `attoBurocraticoVuoto`, `titoloInformativo`, `riferimentiObsoleti`; impatto: `categoriaDaImpatto`; waterfall nazionale), **`classificaLink`** (`diretto`/`contenitore`/`non-valido`), `etichettaLinkFonte`, `linkNonValidiInHtml`, `èFonteCanonica`, `èFonteNazionale`, `titoloAzione`, `articoloValido`, `limitaCadenzaSettimanale`, `promptFiltroLLM`, `promptScritturaArticolo`, **`generaArticoloEditoriale`** (copy azione a 3 paragrafi, fonte sempre citata) |
| `src/departments/notizie/services/tracciaFonte.ts` | **Tracciamento della fonte granulare**: `tokenizza`, `valutaCandidato`, `scegliLinkSpecifico`, `risolviFonteGranulare` (elenco → sottopagina/circolare/PDF) |
| `src/departments/notizie/services/newsFetcher.ts` | Raccolta fonti ufficiali (MIM, G.U.) + `verificaUrlUfficiale` (HTTP 200/3xx) |
| `src/departments/notizie/services/ingestNotizie.ts` | Pipeline: lookback 15 gg → filtro → **gate link punto-a-punto** → generazione → tetto articoli (6) → accumulo con dedupe |
| `src/departments/notizie/services/archivioNotizie.ts` | Lettura/scrittura dell'archivio generato (`scriviArchivioNotizie`, `leggiArchivioNotizie`, `estraiArticoliDaTesto`) |
| `scripts/ripara-archivio-notizie.ts` | `npm run notizie:ripara-archivio`: rigenera il copy storico e rimuove le voci non conformi |
| `src/departments/notizie/data/notizieSeed.ts` | Articoli seed curati a mano (conformi alle regole) |
| `src/departments/notizie/data/notizieIngestite.ts` | Archivio generato dall'ingestione (accumulo) |
| `src/departments/notizie/components/NotizieGrid.tsx` | Card con badge PDF ufficiale dedicato |
| `src/departments/notizie/components/NotizieDettaglio.tsx` | Fonti Ufficiali + bottone "Visualizza PDF Ufficiale" (`target="_blank"`) |
| `src/departments/notizie/services/newsService.ts` | Fusione seed + ingestite, fallback realistico con link di profondità |
| `.github/workflows/scrape-notizie.yml` | Cron quotidiano 06:00 UTC, commit automatico dei dati |

## Checklist di conformità (un articolo è "pronto" solo se…)

- [ ] **Max 6 articoli** nella finestra di 15 giorni (≈3/settimana); 0 se nessun
      provvedimento vincolante
- [ ] Cita il **riferimento ufficiale esatto** (Ordinanza Ministeriale, Decreto,
      Nota prot., articolo di legge)
- [ ] **Nessun** contenuto di marketing/press-release (discorsi, interviste,
      comunicati, eventi)
- [ ] **3 paragrafi**, acronimi spiegati alla prima menzione, zero cliché
- [ ] **Tono azione**: nessuna apertura istituzionale ("Il Ministero ha
      comunicato…"), si parte da che cosa cambia e da che cosa fare
- [ ] **Fonte tracciabile**: il link pubblicato è il documento specifico quando
      tracciato; se la fonte è una pagina di elenco viene tracciata la voce
      specifica, altrimenti si pubblica con la pagina ufficiale (con etichetta
      onesta). Bloccano solo i link NON validi (mockup/login/non http)
- [ ] Se il link diretto non è disponibile → l'articolo **si pubblica comunque**
      con la traccia disponibile (mai sopprimere una notizia vera)
- [ ] Se la fonte è un **PDF ufficiale** → bottone dedicato
      **"Visualizza PDF Ufficiale"** che apre il PDF in nuova scheda
- [ ] Scadenza **esatta** (mai "date da confermare")
- [ ] Il blog NON promuove moduli o template interni (è un filtro sulle fonti)

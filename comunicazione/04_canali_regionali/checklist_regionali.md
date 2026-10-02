# ✅ CHECKLIST CANALI REGIONALI — Comunicazioni pubbliche

> **Ambito**: i **canali Telegram pubblici** (regionali e ATA nazionale) su cui
> ScuoleRadar pubblica gli avvisi in forma broadcast, senza personalizzazione.
>
> **Stato**: REGOLE IMMUTABILI. Vale insieme a
> `00_regole_generali/checklist_straordinaria.md`.
>
> **Ancoraggi nel codice**: `src/lib/telegram.ts`
> (`formattaPostCanaleTelegram`, `pubblicaInterpelloSuCanali`,
> `EsitoPubblicazioneCanali`, `pulisciUrlTelegram`);
> `src/scraper/index.ts` (pubblicazione sui canali);
> test `npm run test:telegram:canali`.

## 1. Formattazione standard del post

- [ ] **Un unico formato** per tutti i canali pubblici: il post è generato
      esclusivamente da `formattaPostCanaleTelegram` (nessun template
      alternativo, nessuna composizione manuale).
- [ ] Post a **7 sezioni fisse**, nello stesso ordine per ogni avviso:
      testata (tipo avviso) · provincia · ordine di scuola · classe/materia ·
      scuola · scadenza · candidature/fonte.
- [ ] Testate tipografiche standard:
      - `📝 Interpello docenti`
      - `🗂️ Avviso ATA`
      - `📣 Bando / PNRR / Esperto`
- [ ] Brand in testa al post, con nome/link ufficiale `ScuoleRadar.it`
      (`https://www.scuoleradar.it`).
- [ ] Ogni post è **autosufficiente e inoltratile** da chiunque.
- [ ] Nessun testo di debug, nessun ID interno, nessun dato utente.

## 2. Link — una sola regola, stretta

- [ ] **URL ufficiali mai in chiaro** nel testo: si usa **solo** la riga
      iperlinkata `🔗 Leggi la Fonte Ufficiale` (`rigaFonteUfficiale`), con l'URL
      nell'`href` — mai un URL ufficiale stampato come testo.
- [ ] Il link è pubblicato **solo se diretto all'avviso specifico**
      (`eUrlAvvisoDiretto`): niente home, elenchi, archivi, tag, pagine di
      ricerca o landing regionali.
- [ ] **Gate di link safety** (`pubblicaInterpelloSuCanali`): se manca l'avviso
      specifico la pubblicazione è **saltata** (`EsitoPubblicazioneCanali.saltato`)
      e l'esito viene loggato — mai pubblicare un link generico.
- [ ] **Un ping fallito NON è un avviso inesistente**: i server scolastici
      regionali rispondono 403/timeout ai client automatici. In ingresso
      (`valutaGateLink`) un bando **strutturato** — classe di concorso o materia
      **+** email di candidatura — entra in bacheca anche senza verifica del link;
      il link pubblicato resta comunque quello specifico dell'avviso, mai una home.
- [ ] La parola **"candidati"** è vietata; l'etichetta di fonte è unica e
      standard.
- [ ] Anteprime dei link disattivate (`link_preview_options.is_disabled`):
      nessun riquadro gigante nel canale.

## 3. Contenuto e gerarchia

- [ ] Ordine di scuola coerente con classe/materia (mai "Scuola Primaria" con un
      titolo della secondaria); il ruolo non viene ripetuto quando coincide con
      la Classe/Materia.
- [ ] Scadenze già passate o non valide **non** vengono mostrate.
- [ ] Recapito di candidatura come `📧 Candidature: <mailto:…>` **solo se
      estratto**; mai `Email non disponibile` e mai riga `📧` vuota.
- [ ] Titolo pulito: nessun "dump" di codici classe, nessuna intestazione
      burocratica copiata dalla fonte.
- [ ] Nessuna variante personale nei canali pubblici (no saluti, no
      "Ciao …", nessun riferimento al singolo utente).
- [ ] Footer canale **LEAD GENERATION** (standard):
      `⚡ Vuoi solo le opportunità della TUA provincia e delle TUE classi?` +
      `👉 Crea il tuo Radar personalizzato: https://scuoleradar.it/dashboard/radar`,
      senza firma promozionale. URL del Radar **visibile** (nessun popup nativo),
      mai la home generica.

## 4. Pubblicazione

- [ ] Si pubblicano **solo avvisi nuovi** (dedup in inserimento lato scraper):
      nessun post ripetuto dello stesso avviso sui canali.
- [ ] Il canale regionale giusto in base alla provincia effettiva dell'avviso
      (con alias dei capoluoghi composti).
- [ ] La pubblicazione sui canali **non** sostituisce né duplica l'invio
      personale: sono canali diversi, con dedup per canale.
- [ ] Un avviso scartato dal gate di qualità non viene pubblicato né
      parzialmente formattato.
- [ ] **Solo opportunità di lavoro reali e attive**: in bacheca e sui canali
      entrano esclusivamente bandi di reclutamento (docenti, ATA, PNRR/PON/POR,
      esperti esterni). I **contenuti editoriali** del MIM (comunicati stampa,
      dichiarazioni, interviste, rassegne, eventi) e gli **atti informativi**
      (esiti, graduatorie, revoche) restano nel dominio Notizie: mai un post.
- [ ] **Bacheca pubblica «Radar Live» (lato UI)**: nessuna riga di riempimento e
      nessun mock, mai. Il totale mostrato è il **conteggio esatto** del database
      e le pagine si contano sulle righe davvero presenti (con `+` se il DB ne ha
      altre); a database vuoto/nessuna riga presentabile la sezione dice
      **«Nessun bando attivo al momento»**. La colonna «Scuola» non mostra mai un
      elenco di codici classe al posto del nome dell'istituto
      (`src/lib/liveBoard.ts`).
- [ ] **Copertura nazionale della bacheca**: il tabellone legge fino a **1.000
      righe in una sola query** con il filtro a doppio ramo
      `radar/flightBoard/filtroAttivi.ts` — «scadenza non ancora passata» **oppure**
      «nessuna scadenza ma pubblicato negli ultimi 60 giorni»
      (`GIORNI_FINESTRA_SENZA_SCADENZA`) — e usa lo **stesso** filtro per il
      conteggio mostrato: mai un totale che parla di avvisi diversi da quelli
      leggibili. Le righe presentabili si **alternano per provincia**
      (`diversificaProvince`): una sola provincia non occupa mai le prime pagine.
- [ ] **Avvisi senza scadenza**: entrano in bacheca (finestra dei 60 giorni) con la
      banda «Scadenza n/d» e la **data di pubblicazione** accanto, mai con una data
      di scadenza inventata. Il nome dell'istituto resta obbligatorio: senza nome
      reale la riga non entra.
- [ ] **Bande di urgenza della colonna «Scadenza»**: il colore dice quanto manca —
      scade oggi · ultime 48h · entro 3 giorni · entro 7 giorni · in corso — sempre
      accanto alla DATA di scadenza (o alla data di **pubblicazione** quando la
      fonte non ne dichiara una), senza conti alla rovescia né inviti a correre
      (`src/lib/urgency.ts`). Gli avvisi scaduti non compaiono mai in bacheca.
- [ ] **Nome dell'istituto letto dalla FONTE**: la colonna «Scuola» mostra il nome
      pubblicato dall'ente accanto al codice meccanografico (`scraper/scuolaDaRiga.ts`).
      Se la fonte non lo pubblica, la riga non entra: mai un'etichetta di materia o un
      dump di codici al posto dell'istituto.

## 5. Verifica prima del merge

- [ ] `npm run test:telegram:canali` — formato a 7 sezioni, testate, assenza di
      "candidati", assenza di "Email non disponibile", link safety.
- [ ] `npm run test:qualita` — solo avvisi con link diretto + recapito.
- [ ] `npm run test:scraper:domini` — nessun contenuto editoriale in bacheca
      (isolamento dal dominio Notizie).
- [ ] `npm run test:scraper:attivi` — solo bandi attivi e categorie di
      reclutamento; ping fallace ≠ record scartato.
- [ ] `npm run test:board` + `npm run test:board:scala` + `npm run test:board:filtro` + `npm run test:board:metriche` + `npm run test:urgenza` + `npm run test:copy:schermo`
      — vetrina della bacheca: righe complete, codici classe mai come nome scuola,
      conteggio esatto e nessun mock nel tabellone, finestra dei 60 giorni senza date
      inventate, alternanza per provincia (nessuna provincia monopolizza le prime
      pagine), filtro PostgREST a doppio ramo, bande di urgenza monotone (pulsa solo
      «Scade oggi»).
- [ ] `npm run test:telegram` — nessuna anteprima/logo, solo testo.
- [ ] Prova manuale su un canale di test: leggibilità, inoltrabilità, un solo
      link ufficiale.

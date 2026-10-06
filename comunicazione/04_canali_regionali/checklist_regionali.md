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
- [ ] **Bacheca pubblica «Radar Live» (lato UI)**: nessun mock, mai. Il totale
      mostrato è il **conteggio esatto** del database e le schermate si contano
      sulle righe davvero presenti: **«Schermata X di Y»**, con `Y` = elementi in
      vetrina ÷ 5 arrotondato per eccesso — nessun `+` di maggiorazione e nessuna
      dicitura fissa (direttiva cliente 03/10/2026); a database vuoto la sezione
      dice **«Nessun bando attivo al momento»**.
- [ ] **Nessuna riga in vetrina senza la sua scuola** (direttiva cliente 05/10/2026,
      §26.59 — corregge la §26.47 del 04/10/2026): in bacheca entra solo una riga con
      il nome di un **istituto reale** risolto per anagrafica (campo `school_name` al
      gate `nomeIstituto.ts`, registro scolastico per codice meccanografico, oppure
      nome leggibile ricavato dal titolo — `nomeScuolaRiga`, `src/lib/liveBoard.ts`).
      Restano fuori: le righe con il solo **nome grezzo pubblicato dal bando**, quelle
      senza alcun nome risolvibile (il segnaposto «Scuola non specificata / Più plessi»
      **non** è un'anagrafica) e — come sempre — gli avvisi **non vivi** (scaduti o
      fuori dalla finestra dei 60 giorni). La colonna «Scuola» non mostra **mai** un
      elenco di codici classe al posto del nome dell'istituto. **Lo stesso gate vale per il responso
      della prova del Radar** (`nomePresentabileRiga` / `rigaPresentabileVetrina`,
      `src/lib/provaRadarEngine.ts`): due superfici pubbliche non possono avere due regole diverse.
- [ ] **Vetrina pubblica pulita**: la colonna «Scuola» non mostra **mai** messaggi
      tecnici o di errore all'utente, e non mostra il segnaposto neutro «Scuola non
      specificata / Più plessi»: la dicitura resta nella **scheda del singolo avviso**
      (`src/components/IstitutoEmittente.tsx`), quando il bando non pubblica la scuola.
      L'arricchimento anagrafico serve all'ingresso in vetrina e all'invio delle
      notifiche puntuali (direttive 04/10 e 05/10/2026).
- [ ] **Copertura nazionale della bacheca**: il tabellone legge a **pagine**
      (`.range`, mai una richiesta sola: PostgREST non consegna più di 1.000 righe —
      `radar/flightBoard/letturaBoard.ts`, §26.34) con il filtro a doppio ramo
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
- [ ] **«Prova il Radar»: si prova con la SOLA provincia** — il box pubblico legge quella provincia e
      nient'altro (`src/departments/radar/services/provaRadarQuery.ts`, `.eq('province')`;
      `src/lib/provaRadarEngine.ts`): **nessun pool nazionale, nessun ripiego, nessun dato di
      esempio**. Se la provincia non ha nulla di vivo il responso **non** pesca avvisi altrove:
      dichiara che il Radar è in scansione («Appena esce un avviso su <provincia> te lo diciamo noi»).
- [ ] **Il rumore non occupa il posto di un'opportunità**: un avviso sotto la soglia arancio (70%)
      che il Radar **non** conferma per classe o parola chiave è un falso positivo e resta **fuori**
      dalla bacheca (`riempitivoNonPertinente`, `src/lib/riempitivi.ts`): non è un riempitivo da
      dosare. I riempitivi **pertinenti** restano, entro il cap di 5 (nessuno quando ci sono già 10
      match di qualità), e le **scuole preferite** non vengono mai nascoste (§26.60).
- [ ] **Scheda dell'opportunità (card + modale di dettaglio): scuola e fonte sempre in chiaro** —
      la card e la modale mostrano SEMPRE la **scuola emittente**
      (`src/components/IstitutoEmittente.tsx`: nome reale, oppure la dicitura gestita «Scuola non
      specificata / Più plessi» quando il bando non la pubblica) e un **link diretto alla fonte
      ufficiale** con etichetta onesta (`etichettaFonteLink`, nuova scheda
      `target="_blank" rel="noopener noreferrer"`): nessuna vista senza contesto, mai un link interno
      spacciato per fonte.
- [ ] **Finestra dei 60 giorni in TUTTE le superfici pubbliche** — lo **stesso** numero e la stessa
      data **locale** vivono in `src/lib/scadenza.ts` (`GIORNI_FINESTRA_SENZA_SCADENZA`,
      `eAvvisoVivo(scadenza, pubblicazione)`) e valgono per bacheca, **feed della dashboard**,
      matching (fallback PostgREST + RPC nativa, migrazione `20261005120000_...`) e **pulizia
      automatica** (`scripts/pulisci-scaduti.ts` rimuove anche le righe senza scadenza fuori
      finestra): un avviso che la fonte non data non resta pubblico per sempre.

- [ ] **Scuole preferite/escluse: i suggerimenti restano nell'ambito delle proprie province (+60 km)** — il
      campo scuola del Radar propone **solo** le scuole delle province da cercare (`suggerimentiScuole`,
      `src/lib/filtriScuole.ts`, §26.62), con la **sigla della provincia** accanto al nome; una scuola di
      un'altra provincia resta **scrivibile**, ma la **forzatura è dichiarata** (avviso sotto il campo e
      badge «Fuori ambito · <provincia>» sulla pill) in **entrambe** le liste: nessuna forzatura silenziosa.


## 5. Verifica prima del merge
- [ ] `npm run test:opportunita` + `npm run test:interpello-scadenza` — la scuola emittente e la
      fonte ufficiale sono visibili su card e modale, e la finestra dei 60 giorni vale in tutte le
      superfici pubbliche (feed, matching, bacheca, pulizia automatica).
- [ ] `npm run test:prova-radar` — la prova risponde con la **sola provincia** provata (nessun avviso
      di altre province, nessun dato di esempio) e il responso vuoto dichiara la scansione.
- [ ] `npm run test:riempitivi` — in bacheca non entrano falsi positivi sotto soglia (riempitivi non
      pertinenti esclusi a monte del cap) e il conto degli esclusi è dichiarato, mai silenzioso.

- [ ] `npm run test:filtri-scuole` + `npm run test:admin:utente` — i suggerimenti scuola restano
      nell'ambito provinciale (fuori ambito = forzatura dichiarata) e le schede utente dell'Admin mostrano
      **tutte** le preferenze: ordini, classi, **materie derivate dalle classi**, competenze, tag, province
      e scuole, senza elenchi troncati.

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

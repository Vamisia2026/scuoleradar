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
      estratto**; mai `Email non disponibile` e mai riga `📧` vuota. Senza recapito
      l'avviso si pubblica comunque (§26.68), senza la riga `📧`.
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
      mostrato e le schermate nascono dallo **stesso** numero — le righe davvero in
      vetrina (§26.71): **«Schermata X di Y»**, con `Y` = elementi in
      vetrina ÷ 5 arrotondato per eccesso — nessun `+` di maggiorazione e nessuna
      dicitura fissa (direttiva cliente 03/10/2026); a database vuoto la sezione
      dice **«Nessun bando attivo al momento»**. Mai un conteggio preso dal database
      grezzo: direbbe «869 avvisi attivi» mentre il tabellone ne pagina 396.
- [ ] **Nessuna riga in vetrina senza la sua scuola** (direttiva cliente 05/10/2026,
      §26.59 — corregge la §26.47 del 04/10/2026): in bacheca entra solo una riga con
      il nome di un **istituto reale** risolto per anagrafica (campo `school_name` al
      gate `nomeIstituto.ts`, registro scolastico per codice meccanografico, **denominazione
      certificata dal codice meccanografico statale** (§26.81: il MIM scrive alcune denominazioni
      ufficiali senza la testa d'istituto — «G. PASCOLI», «RIVALTA B.DA - "N. BOBBIO"» — e il
      codice `XXYY12345Z` è la prova d'identità), oppure nome leggibile ricavato dal titolo —
      `nomeScuolaRiga`, `src/lib/nomeScuolaRiga.ts`, ri-esportato da `src/lib/liveBoard.ts`).
      Restano fuori: le righe con il solo **nome grezzo pubblicato dal bando**, quelle
      senza alcun nome risolvibile (il segnaposto «Scuola non specificata / Più plessi»
      **non** è un'anagrafica) e — come sempre — gli avvisi **non vivi** (scaduti o
      fuori dalla finestra dei 60 giorni). La colonna «Scuola» non mostra **mai** un
      elenco di codici classe al posto del nome dell'istituto. **§26.73 (16/10/2026):** il
      gate riconosce anche le sigle e le abbreviazioni con cui le fonti scrivono davvero
      il nome (`ICS`, `IT`, `IST. COMPR.`, `I grado`, `CPIA2AL`, «Ottavo Circolo»), ma la
      regola non cambia: nessun codice, nessun segnaposto, nessun nome senza denominazione.
      **Lo stesso gate vale per il responso della prova del Radar**
      (`nomePresentabileRiga` / `rigaPresentabileVetrina`,
      `src/lib/provaRadarEngine.ts`): due superfici pubbliche non possono avere due regole diverse.
- [ ] **Vetrina pubblica pulita**: la colonna «Scuola» non mostra **mai** messaggi
      tecnici o di errore all'utente, e non mostra il segnaposto neutro «Scuola non
      specificata / Più plessi»: la dicitura resta nella **scheda del singolo avviso**
      (`src/components/IstitutoEmittente.tsx`), quando il bando non pubblica la scuola.
      L'arricchimento anagrafico serve all'ingresso in vetrina e all'invio delle
      notifiche puntuali (direttive 04/10 e 05/10/2026).
- [ ] **Copertura nazionale della bacheca**: il tabellone legge a **pagine**
      (`.range`, mai una richiesta sola: PostgREST non consegna più di 1.000 righe —
      `radar/flightBoard/letturaBoard.ts`, §26.34) con il filtro
      `radar/flightBoard/filtroAttivi.ts` — **solo** avvisi con una
      `expiration_date` dichiarata e non ancora passata — e usa lo **stesso** filtro
      per il conteggio mostrato. Le righe presentabili si **alternano per provincia**
      (`diversificaProvince`): una sola provincia non occupa mai le prime pagine.
- [ ] **Regola ferrea della scadenza** (§26.71): un avviso senza `expiration_date`
      (assente o non interpretabile) **non è un'opportunità** e non entra né in
      bacheca né nel feed, né consuma quota di notifica. Nei dati reali quelle righe
      sono pagine di archivio, regolamenti e **indici di classi di concorso**
      («ADEE | AAAA», «A041 | EEEE | A043»): entravano in bacheca con la banda
      «Scadenza n/d» e facevano sembrare «attivi» avvisi che non si candidano.
      Regola in un solo punto (`eOpportunitaConScadenza`, `src/lib/scadenza.ts`),
      applicata da filtro di lettura, `preparaRigheBoard` e pipeline del feed
      (`bachecaInterpelli` → contatore `senzaScadenza`, scarto **dichiarato**).
      Un solo grado di urgenza senza data resta possibile: la riga **fuori dal feed**
      che il chiamante ha già deciso di mostrare (banda grigia, mai una data inventata).
- [ ] **Badge della colonna «Scadenza»: QUATTRO luci** (§26.89, §26.100, §26.122) — il colore dice
      quanto manca e ogni luce ha UN solo significato, nella **scala del blu del brand**
      (niente rosso, niente arancio: l'ansia non è informazione) — **blu notte**
      `bg-primary-700` per «Scade oggi» (meno di 24 ore) · **blu** `bg-primary-600` per
      «Scade domani» e «Ultime 72h» (24–72 ore) · **verde** `bg-accent-600` per «In corso»
      (dal terzo giorno alla finestra di candidatura) · **blu chiaro** `bg-primary-500` per
      «Scadenza lontana» (oltre la finestra) — sempre accanto alla DATA di scadenza; senza
      data la banda è ardesia media e dichiara «Scadenza n/d» (mai una data inventata,
      nessuna banda che pulsa).
      Un solo modulo: `stileScadenza` in `src/lib/scadenzaSemaforo.ts`
      (`SCADENZA_TOKENS`), usato da tabellone, scheda avviso e feed della dashboard.
      Tutte le bande portano etichetta **BIANCA in grassetto** (`text-white font-bold`) e
      reggono **AA** sul bianco: `primary-700` 9,1:1 · `primary-600` 7,1:1 ·
      `accent-600` 4,99:1 · `primary-500` 5,43:1 · ardesia 7,58:1 / 4,76:1. Restano fuori
      le tinte chiare del §26.98 (`amber-400` 1,67:1 · `emerald-500` 2,54:1 · `rose-500`
      3,67:1: sotto AA), i rossi/aranci d'allarme e ogni nero o ardesia scura: il tabellone
      è la vetrina del servizio e non deve avere toni «da funerale» (§26.100; misura in
      `npm run test:interpello-scadenza` e `npm run test:scadenza`).
      Gli avvisi scaduti non compaiono mai in bacheca.
- [ ] **Allegati su gestori documentali: il FILE è l'avviso** (§26.96) — una tabella d'albo che linka
      solo il PDF su Gecodoc / Argo / Nuvola–Spaggiari si legge DENTRO il documento (scadenza dichiarata,
      classe di concorso, codice meccanografico, provincia, recapiti); la HOME della stessa piattaforma
      resta un login e non diventa mai `source_url`. Una bacheca vuota o chiusa non spegne il target: si
      riparte dall'albo della scuola, risolta sul codice meccanografico scritto nell'URL. Guardia:
      `npm run test:piattaforme-documentali`.
      **Su una piattaforma di LOGIN solo i contenitori PUBBLICI sono avvisi** (§26.108): bacheca, albo,
      pubblicazioni, documenti. Un'area applicativa — `nuvola.madisoft.it/interpelli/<CODICE>/docenti/<uuid>/
      candidatura` — risponde 200 ma è il modulo del docente (guscio JavaScript `noindex` che chiede le
      credenziali): non entra mai in bacheca né in `source_url`. Guardia:
      `npm run test:piattaforme-contenitori`.
- [ ] **In bacheca solo DOMINI ISTITUZIONALI — un aggregatore concorrente non è una fonte** (§26.109,
      §26.123) — ammessi per costruzione `.edu.it` e `.gov.it`, `istruzione.it` e sottodomini, e i
      portali USR/USP/UAT/UST del registro (`src/scraper/portaliUfficiali.ts`: 62 host oggi). Fuori
      `scuolainterpelli.it`, `interpelloweb.it`, social, hosting gratuiti, moduli Google e qualunque
      dominio non pubblico — anche `istruzione.it.evil.com` (il confronto è sul suffisso, non su
      «contiene»). Se l'avviso linka un aggregatore si pubblica la **home `.edu.it`** dell'istituto
      (GATE 0 di `presidioLinkIngresso.ts`), altrimenti la riga **resta fuori**: meglio una riga in
      meno che un click su un terzo. §26.123 — il divieto vale anche per il **registro delle fonti**:
      indice nazionale e 19 archivi regionali di `scuolainterpelli.it` sono registrati e **spenti**
      (`attiva: false` + motivo), `fontiAttive()` esclude per dominio anche se il flag venisse
      riacceso, e il connettore salta la fonte invece di scaricarla. Una regola sola in
      `src/lib/dominiIstituzionali.ts`. Guardie: `npm run test:domini-istituzionali`,
      `npm run test:scraper:fonti`, `npm run test:pagina-archivio`.
- [ ] **La QUARANTENA di una fonte dura 60 giorni, poi si riprova** (§26.109) — `source_health`
      isola dopo 2 run con **`404`/`410`** (`not_found`), 2 con layout ignoto, 3 con timeout o zero
      righe (`sogliaQuarantena`). Passata la finestra (`GIORNI_QUARANTENA` in
      `src/lib/sourceQuarantine.ts`) la fonte torna candidabile, i contatori ripartono da zero e —
      se è ancora morta — viene isolata di nuovo con una data nuova: costo della riprova, **un run
      ogni 60 giorni**. Nessuna lista da ripulire a mano, nessuna quarantena eterna. Guardia:
      `npm run test:quarantena`.
- [ ] **Finestra di CANDIDATURA = 15 giorni — per FEED e matching, non per la vetrina** (§26.82,
      §26.100) — `GIORNI_ORIZZONTE_OPPORTUNITA` in `src/lib/scadenza.ts` vale per
      `eOpportunitaConScadenza` (feed, punteggio, RPC di matching): oltre, la «scadenza» letta
      dalle fonti è la fine di un incarico o l'avvio di un progetto, non un termine per
      candidarsi. La **bacheca pubblica** invece legge `eOpportunitaAperta` (scadenza
      dichiarata e non ancora passata, **senza tetto in avanti**) e il suo filtro PostgREST ha
      un solo estremo (`expiration_date.gte.<oggi>`): il cliente vuole il volume ATTIVO
      completo, e un bando che scade fra un mese è aperto. Guardia: `npm run test:board:filtro`.
- [ ] **«Prova il Radar»: si prova con la SOLA provincia** — il box pubblico legge quella provincia e
      nient'altro (`src/departments/radar/services/provaRadarQuery.ts`, `.eq('province')`;
      `src/lib/provaRadarEngine.ts`): **nessun pool nazionale, nessun ripiego, nessun dato di
      esempio**. Se la provincia non ha nulla di vivo il responso **non** pesca avvisi altrove:
      dichiara che il Radar è in scansione («Appena esce un avviso su <provincia> te lo diciamo noi»).
- [ ] **Il rumore non occupa il posto di un'opportunità**: un avviso sotto la soglia arancio (70%)
      che le preferenze **primarie** non agganciano (classi di concorso · ordine · provincia) è un
      falso positivo e resta **fuori** dalla bacheca (`riempitivoNonPertinente`,
      `src/lib/riempitivi.ts`): non è un riempitivo da dosare. La **pertinenza è primaria** (§26.63):
      le competenze non la stabiliscono, la sfumano soltanto. I riempitivi **pertinenti** restano,
      entro il cap di 5 (nessuno quando ci sono già 10 match di qualità), e le **scuole preferite**
      non vengono mai nascoste (§26.60).
- [ ] **Scheda dell'opportunità (card + modale di dettaglio): scuola e fonte sempre in chiaro** —
      la card e la modale mostrano SEMPRE la **scuola emittente**
      (`src/components/IstitutoEmittente.tsx`: nome reale, oppure la dicitura gestita «Scuola non
      specificata / Più plessi» quando il bando non la pubblica) e un **link diretto alla fonte
      ufficiale** con etichetta onesta (`etichettaFonteLink`, nuova scheda
      `target="_blank" rel="noopener noreferrer"`): nessuna vista senza contesto, mai un link interno
      spacciato per fonte. Sul **Radar Live** il link non può essere morto (§26.76): se la fonte
      pubblica solo un indirizzo di **piattaforma** (Argo, Nuvola/ClasseViva, moduli Google,
      OneDrive/SharePoint, WeTransfer) la riga porta alla **home `.edu.it`** dell'istituto e lo
      dichiara (`tipo: 'sito-scuola'`); se non esiste né un avviso apribile né un dominio
      istituzionale, la riga **non entra** in bacheca. In vetrina **nessun badge di stato interno**
      (niente più «anagrafica parziale»): la colonna «Scuola» mostra solo il nome reale.
      §26.123 — **la stessa scheda vale per le righe nate dalle tabelle USR** (Liguria `provincia.php`,
      Piemonte `ric_interpello_ambito_*`): classe, scadenza (solo se aperta), **email della scuola**
      risolta dall'anagrafica MIM o dalla convenzione `codice@istruzione.it` («Sartoria», mai
      «Email non disponibile») e link alla fonte ufficiale — che, quando la tabella non linka il
      singolo avviso, è **la tabella USR stessa**. I record già scaduti non arrivano alla card. Guardia:
      `npm run test:scheda-ust`.
- [ ] **Il link pubblicato è il BANDO, non la pagina che lo ospita** (§26.122, §26.124) — «La
      segreteria comunica», «Comunicazioni», «Albo online», «Archivio» sono **contenitori**: una voce
      che punta lì, o che si chiama semplicemente «Interpelli»/«Comunicazioni», **non entra** in
      bacheca (`paginaArchivio.motivoPaginaContenitore` sulla voce d'albo in
      `table-reporter.recordDaVoceScuola`, e sul GATE 1 di `src/scraper/index.ts`, che ora riceve
      anche URL e scadenza). Eccezioni dichiarate: la pagina con **scadenza o classe** è un bando e
      resta; un link a un **documento** (`*.pdf`) è il bando, non l'involucro; un contenitore che
      porta **un solo** allegato pertinente viene pubblicato direttamente **sul PDF** (link
      assoluto, `documentoUnicoDaContenitore` → `allegatoUnico`). Con più PDF non si indovina:
      l'archivio si scarta. Guardia: `npm run test:pagina-archivio`.
- [ ] **Una pagina vuota non è una fonte** (§26.124) — se l'albo o la ricerca interna rispondono
      «Nessun risultato» / «La ricerca non ha prodotto risultati» e non resta testo sufficiente
      (`paginaArchivio.ePaginaSenzaRisultati`, stesse frasi e soglia del discovery `empty_view`), la
      pagina **non** produce record né viene promossa in coda. Si conta in `pagineVuote` nel log del
      deep crawl: è un'informazione, non un errore. Guardia: `npm run test:pagina-archivio`.
- [ ] **Nessun aggregatore nemmeno in USCITA** (§26.123, §26.124) — il divieto vale a monte
      (registro, connettore, discovery, pulizia del DB) **e** sull'ultimo miglio: `vetrinaVisibile`
      (dashboard) esclude le righe con `linkFonte` di un dominio della lista unica e
      `preparaRigheBoard` (Radar Live) le righe con `source_url` di aggregatore. Una riga storica già
      salvata non compare in pagina. Guardie: `npm run test:vetrina-bacheca`, `npm run test:board`,
      `npm run test:pagina-archivio`.
- [ ] **Prova a occhio, senza aspettare lo scraper** (§26.77) — `npm run dati:demo` (dry-run)
      elenca le **10** righe `demo-*` con l'esito dichiarato: **7 in bacheca** (Argo/Forms/Nuvola
      → home `.edu.it`, avvisi veri, badge **pieni** nei tre stati di scadenza, nome dal
      titolo) e **3 fuori** (nessuna fonte apribile, segnaposto, titolo di sola pubblicazione).
      `npm run dati:demo -- --apply` le scrive (mai in produzione senza `--consenti-produzione`),
      `npm run dati:demo -- --pulisci --apply` le elimina. La stessa tabella di casi è la guardia
      `npm run test:board:demo` (esito atteso = esito reale). Il badge della scadenza è **pieno**
      e ha **quattro luci** (`bg-primary-700` solo oggi · `bg-primary-600` 24–72h ·
      `bg-accent-600` in corso · `bg-primary-500` oltre la finestra; etichetta `text-white` in
      grassetto, ardesia media per scaduto/non databile: §26.89, §26.100, §26.122) e il totale
      della pill conta le **stesse** righe che generano le schermate (§26.77).
- [ ] **Finestra dei 60 giorni: solo FETCH e pulizia, mai vetrina** (§26.71) — lo **stesso** numero
      e la stessa data **locale** vivono in `src/lib/scadenza.ts`
      (`GIORNI_FINESTRA_SENZA_SCADENZA`, `eAvvisoVivo(scadenza, pubblicazione)`) e valgono per la
      lettura permissiva (matching: fallback PostgREST + RPC nativa, migrazione `20261005120000_...`)
      e per la **pulizia automatica** (`scripts/pulisci-scaduti.ts` rimuove anche le righe senza
      scadenza fuori finestra): nessuna riga non databile resta nel database per sempre. Non è più
      una porta d'ingresso: bacheca e feed scartano a monte la riga senza scadenza
      (`eOpportunitaConScadenza`) e lo dichiarano nel contatore.

- [ ] **Scuole preferite/escluse: la provincia si sceglie PER LISTA e i suggerimenti restano nell'ambito delle proprie
      province (+60 km)** — il campo scuola del Radar è una riga sola, `[ Provincia ▾ ] [ Nome della scuola ]
      [ + Aggiungi ]`: la provincia sta **dentro il campo**, una per lista (preferite ed escluse **non** condividono la
      scelta) e senza default «tutte le tue province» (`src/departments/radar/preferenze/components/CampoScuola.tsx`,
      §26.67); il campo chiede la provincia **solo** quando esistono omonimie da sciogliere (`omonimieScuole`,
      `src/lib/scuolePresentabili.ts`). I suggerimenti restano **solo** le scuole delle province da cercare
      (`suggerimentiScuole`, `src/lib/filtriScuole.ts`, §26.62), con la **sigla della provincia** accanto al nome; una
      scuola di un'altra provincia resta **scrivibile**, ma la **forzatura è dichiarata** (avviso sotto il campo e
      badge «Fuori ambito · <provincia>» sulla pill) in **entrambe** le liste: nessuna forzatura silenziosa. Il valore
      salvato resta il **nome** dell'istituto (la sigla è solo l'etichetta del suggerimento).


- [ ] **Il giro di una provincia parte dall'ANAGRAFICA, non dalle citazioni** (§26.125) — con
      `--province=AT` (o `--scuole-provincia`) `table-reporter` semina il deep crawl con
      `lib/scuoleProvincia.scuoleDellaProvincia`: una voce per istituto, solo sito dichiarato dal MIM
      (`SITOWEBSCUOLA`, `*.edu.it` preferito), paritarie escluse, PEC mai. Il log deve dire
      «Scuole della provincia AT: N istituti con sito ufficiale» e, a fine giro, elencare le
      **«SCUOLE CONTATTATE»** (più le «non raggiunte»). Una provincia con la coda vuota **non** ferma
      il giro. Guardia: `npm run test:crawl-provincia`.
- [ ] **L'hub REGIONALE resta dentro il giro di provincia** (§26.125) — il filtro `--province=AT`
      ammette la provincia richiesta **e** gli hub istituzionali verificati della sua regione
      (`lib/ambitoProvincia.targetInAmbitoProvincia`): il Piemonte non ha un hub censito su Asti, e
      senza questa regola l'unica fonte che ne parla restava spenta. Le righe sono comunque filtrate
      per provincia all'upsert: leggere l'hub non significa pubblicare avvisi di altre province.
- [ ] **Uno stato `pending` senza padrone è una fonte muta** (§26.125) — i siti seminati da
      `import-schools-local.ts` restano `pending` finché qualcuno non li promuove: il comando unico è
      `npm run crawl:provincia -- --province=AT --apply` (o il workflow «Crawl Provincia»), che elenca
      le scuole, promuove la coda e lancia il crawler con l'output in chiaro. È la risposta operativa
      alla promessa «Prova il Radar su Asti → il sistema interroga Asti».

## 5. Verifica prima del merge
- [ ] `npm run test:opportunita` + `npm run test:interpello-scadenza` — la scuola emittente e la
      fonte ufficiale sono visibili su card e modale, e la finestra dei 60 giorni vale in tutte le
      superfici pubbliche (feed, matching, bacheca, pulizia automatica).
- [ ] `npm run test:prova-radar` — la prova risponde con la **sola provincia** provata (nessun avviso
      di altre province, nessun dato di esempio) e il responso vuoto dichiara la scansione.
- [ ] `npm run test:riempitivi` — in bacheca non entrano falsi positivi sotto soglia (riempitivi non
      pertinenti esclusi a monte del cap) e il conto degli esclusi è dichiarato, mai silenzioso.

- [ ] `npm run test:scoring` + `npm run test:modali` + `npm run test:compatibilita:graduata` — il
      punteggio ha **due livelli** (§26.63): le preferenze primarie fanno il voto, le competenze lo
      sfumano al massimo di 25 punti e **non** aprono la bacheca né promuovono un avviso sotto soglia;
      nessun simbolo dell'override ritirato resta in `src/**` o `scripts/**`.

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
- [ ] `npm run test:elenchi` + `npm run test:scraper:fonti` — i feed di elenco e i
      **portali provinciali** si leggono per **righe** (tabelle `<table>` e **griglie
      ARIA** `role="row"`): la riga di intestazione non è una voce, la scadenza arriva
      dall'**etichetta di colonna**, e menu/testata/footer non entrano — la **home
      dell'ente non è mai un avviso** (`eUrlHome`, §26.72).

- [ ] `npm run test:board` + `npm run test:board:scala` + `npm run test:board:filtro` + `npm run test:board:metriche` + `npm run test:urgenza` + `npm run test:copy:schermo`
      — vetrina della bacheca: righe complete, codici classe mai come nome scuola,
      conteggio esatto e nessun mock nel tabellone, finestra dei 60 giorni senza date
      inventate, alternanza per provincia (nessuna provincia monopolizza le prime
      pagine), filtro PostgREST a doppio ramo, bande di urgenza monotone (pulsa solo
      «Scade oggi»).
- [ ] `npm run test:telegram` — nessuna anteprima/logo, solo testo.
- [ ] Prova manuale su un canale di test: leggibilità, inoltrabilità, un solo
      link ufficiale.

## 6. Il punteggio ha DUE livelli (§26.63)

Le preferenze **primarie** fanno il match e il voto; le competenze e le parole chiave libere
(«In cosa puoi lavorare oltre la classe») sono un **secondo livello** che **sfuma** un voto già
deciso. Nessun messaggio pubblico può raccontare il contrario.

- [ ] **La porta d'ingresso è PRIMARIA**: un avviso entra in bacheca **solo** se il Radar lo aggancia
      con le preferenze — conferma del motore (classe compatibile, province entro il raggio dei 60 km)
      oppure classe almeno «stessa area» (85) — salvo le scuole preferite, incluse d'ufficio (§26.62).
      Una **competenza trovata NON apre** la bacheca (`bachecaInterpelli`,
      `src/lib/bachecaInterpelli.ts`): nessun avviso «in Radar» solo perché contiene una parola che
      gli somiglia.
- [ ] **Il voto**: media **ponderata** delle modali primarie (`ordine` 1 · `classi di concorso` 2 ·
      `provincia` 1, in `src/lib/mediaModali.ts`) **+ la sfumatura** delle competenze
      (`src/lib/punteggioCompetenze.ts`: 25 competenza piena · 20 vicina · 10 riconducibile, +3 per
      ogni corrispondenza in più), dentro il tetto `CAP_COMPETENZE` = **25 punti**. Le competenze
      restano **fuori** dal denominatore della media.
- [ ] **Mai promosso da una parola chiave**: quando il motore ha agganciato solo il «match secondario»
      (25) il tetto del voto resta **25**, quindi una competenza non porta mai un avviso sotto soglia
      sopra la soglia. Il **sostegno EXTRA** fuori dalle proprie classi resta a **60** e le competenze
      non lo promuovono; oltre i **60 km** l'avviso è escluso (whitelist a parte). La forzatura
      (`scuola preferita`) bypassa geografia e cap dei riempitivi, **non** il punteggio.
- [ ] **La scheda dice PERCHÉ**: card e modale mostrano il motivo leggibile e, quando c'è, la
      **competenza trovata** (`ETICHETTA_COMPETENZA_SECONDARIA` → `descrizioneCompetenzaSecondaria`,
      campo `Interpello.competenzaSecondaria`) accanto al voto delle preferenze: mai un numero che
      sembra casuale. `competenzaSecondaria` è un dato **di vetrina**: lo scrive la bacheca, **non** il
      database, e **non entra nelle consegne** (email e Telegram restano sul motore strict).
- [ ] **Nessun voto d'ufficio**: l'override della «Modalità 3» (§26.58: 90 parola chiave piena · 85
      match vicino assegnati d'ufficio) e il jolly in percentuale **non esistono più** — la parola
      chiave non assegna voti e non fa da jolly in nessun testo pubblico.

## 7. Il JOLLY SEMANTICO della Modalità 3 (§26.64): asimmetrico, mai una sottrazione

«In cosa puoi lavorare oltre la classe» è un **interesse dichiarato**, non un filtro. Se l'avviso
nomina **per intero** la competenza del candidato, quel fatto **apre e sostiene**; se la nomina di
sfuggita, **sfuma**; se non la nomina, **non toglie nulla**.

- [ ] **Match PIENO = apertura e pavimento.** Dentro le proprie province il voto ha il pavimento
      d'eccellenza di **90** (`PUNTEGGIO_JOLLY_PIENO`); oltre il raggio dei 60 km l'avviso entra
      **d'ufficio al 60** (`PUNTEGGIO_JOLLY_OLTRE_RAGGIO`, come il pavimento del sostegno §26.45) e
      **la bacheca lo mostra**: mai un 90–100 a duecento chilometri di distanza, la distanza resta
      dichiarata nel numero.
- [ ] **Match PARZIALE = solo sfumatura, mai apertura.** Bonus fino a **15** (`BONUS_JOLLY_PARZIALE`,
      più stretto del tetto §26.63 di 25): sfuma un voto già agganciato, **non apre** la bacheca e
      **non scavalca** l'esclusione geografica.
- [ ] **Assenza = nessuna penalizzazione.** Non trovare la competenza **non è un demerito**: il voto
      resta esattamente quello delle preferenze primarie.
- [ ] **Tre sospensioni** (lì vale la §26.63): scuola preferita in whitelist, profilo **senza classi**
      (tetto del motore a 25), pavimento del sostegno EXTRA. Il jolly non tocca nessuna delle tre.
- [ ] **La scheda dice PERCHÉ.** Card e modale mostrano l'etichetta «Interesse pieno»
      (`ETICHETTA_JOLLY_SEMANTICO` → `descrizioneJollySemantico`) al posto del badge del livello
      secondario, che **torna** quando il match è parziale; la competenza dichiarata viaggia in
      `Interpello.jollySemantico` (vetrina: **non** database, **non** consegne).
- [ ] **Guardia**: `npm run test:jolly`, in catena con `test:scoring` e `test:compatibilita:graduata`.

## 8. La SCALA del paracadute (§26.125): tre gradini e un divieto

Le «5 opportunità minime» non si toccano (`MINIMO_BACHECA`): sotto i cinque posti la vetrina si
completa con le migliori righe della scorta. Cambia **l'ordine** — e c'è una riga che non entra mai.

- [ ] **I tre gradini, in quest'ordine** — `ottime` (stessa provincia **e** stessa classe) →
      `affini` (stessa provincia + classe affine, **oppure** provincia vicina entro i 60 km + stessa
      classe) → `ultima-spiaggia` (stessa provincia + sostegno **o** alternativa alla Religione). La
      regola è una sola, in `lib/scalaParacadute.scalaParacadute`, e l'ordine passa a
      `paracaduteCinque(..., { priorita })`: prima il gradino, poi il voto.
- [ ] **DIVIETO: sostegno e Religione mai fuori dalle province scelte** — vale anche per la
      provincia «solo vicina» e anche quando la vetrina è vuota. La bacheca scarta la riga **prima
      del punteggio** e la conta in `sostegnoFuoriProvincia`; non entra nemmeno nella scorta. La
      whitelist delle scuole preferite resta sovrana (scelta esplicita dell'utente).
- [ ] **Priorità ≠ filtro** — l'unico verdetto di esclusione della scala è il divieto; tutto il resto
      ordina soltanto. Così la **consegna** (email/Telegram, strict) e il **jolly semantico** (§26.64)
      non cambiano comportamento: una riga `non-classificata` (per esempio un match pieno del jolly
      oltre il raggio) resta ammessa e va in coda.
- [ ] **Chi ha una classe `AD…` propria è un match, non un ripiego** — la classe esatta viene prima
      del sostegno: il pavimento di 60 resta un suggerimento **extra**, non l'ultima spiaggia.
- [ ] **Guardie**: `npm run test:scala-paracadute` (gradini, divieto, ordine della scorta, bacheca
      vera) e `npm run test:sostegno` (pertinenza per ordine di scuola), entrambe in `npm test`.

## 9. Il perimetro dell'MVP e la domanda (§26.126): due densità, una sola verità

L'ingestione non è più «tutto il Paese»: c'è una base nazionale stabile e c'è ciò che gli utenti
chiedono. La regola vive in `lib/mvpPerimetro` (pura) e lo script è `npm run crawl:mvp`.

- [ ] **Baseline nazionale = 20 capoluoghi di regione + Asti** — sempre letta, a ogni giro
      (`PROVINCE_BASELINE`). È ciò che tiene viva la copertura del Radar Live: una regione non deve
      sembrare vuota solo perché nessuno l'ha ancora cercata.
- [ ] **La domanda accende, non sostituisce** — una provincia cercata in «Prova il Radar» o salvata
      nel profilo entra in `province_domanda` (`request_province_scan`) e per **7 giorni** legge il
      **100% delle scuole statali dell'anagrafica MIM** (nessun tetto: `--max-scuole=tutte`, §26.127).
      Le province senza richieste restano coperte dagli **hub USR regionali**: nessun taglio
      silenzioso, solo un'intensità diversa.
- [ ] **Anche un capoluogo sale di regime** — se la ricerca riguarda una provincia della baseline
      (Torino, Milano, …) quella provincia passa **subito** da `fondo` a `domanda` per 7 giorni: la
      baseline non è un tetto alla copertura, è il fondo che tiene vivo il Paese.
- [ ] **Due giri, due densità** — prima le province richieste (`--max-scuole-domanda`, l'anagrafica
      intera), poi il fondo (`--max-scuole-fondo`, un campione deciso dal termostato). Il log dichiara
      i due blocchi e dice `tutte le scuole` dove non c'è tetto.
- [ ] **Promozione solo delle province richieste** (`--apply`) — i target `pending` delle altre non si
      risvegliano: una provincia non richiesta non deve consumare rete.
- [ ] **Codici mai inventati** — una richiesta con codice fuori catalogo finisce in `sconosciute` e
      non entra nel piano; una richiesta scaduta finisce in `scadute` e non accende nulla.
- [ ] **Guardie**: `npm run test:mvp-perimetro` (perimetro, finestra, dedup, cablaggio RPC/script/
      workflow), in `npm test`.


## 10. Tutti i lavoratori della scuola (§26.126): ATA, segreteria, tecnici

Il Radar non è solo per i docenti. Un bando per collaboratori scolastici, assistenti amministrativi o
assistenti tecnici è un'opportunità come un interpello: si indicizza, si mostra, si consegna.

- [ ] **Nessuna opportunità ATA scartata a monte** — il gate di qualità non tratta «personale ATA»,
      «collaboratori scolastici», «assistenti amministrativi/tecnici», «bidelli», «DSGA» come rumore
      (`noiseFilterAta`): sono indicatori di reclutamento.
- [ ] **Il codice del profilo c'è sempre** — `ATA-AA` (segreteria), `ATA-AT` (tecnici), `ATA-CS`
      (collaboratori) entrano in `class_codes`; un bando che dice solo «personale ATA» porta **tutte e
      tre** le classi, perché è aperto a tutti i profili.
- [ ] **Consegna reale** — `match_interpelli` e il fallback PostgREST agganciano il profilo ATA con la
      stessa regola delle classi docenti (classe esatta = 100). Nessuna eccezione, nessun ramo separato.
- [ ] **Guardia**: `npm run test:profili-ata` (catalogo, riconoscimento, `class_codes`, matching,
      punteggio, gate di qualità), in `npm test`.

## 11. Il termostato del crawler (§26.127): l'intensità segue il fabbisogno

L'aggressività del giro non è più una costante: la decide il numero di **avvisi attivi** in archivio
(la stessa popolazione che il Radar Live conta e mostra). La regola vive in `lib/termostatoCrawl`
(pura), la applica `npm run crawl:mvp`.

- [ ] **Soglia di riferimento: 1.000 avvisi attivi** — è un riferimento di lavoro, **non** un numero da
      raggiungere: nessuna riga viene creata per «arrivare a 1.000», e il conteggio mostrato in vetrina
      resta quello vero del database. Il numero **fluttua** perché il crawler aggiunge ciò che le fonti
      pubblicano e il tempo toglie ciò che scade.
- [ ] **Tre regimi, una fascia morta** — sotto 1.000 → **carenza** (giro esteso: 20 scuole di fondo per
      provincia, hub regionali a 80 documenti su 6 pagine); da 1.000 a 1.150 → **equilibrio** (8 · 40 su
      3 pagine); oltre 1.150 → **saturo** (3 · 25 su 2 pagine). La fascia 1.000→1.150 è l'**isteresi**:
      senza di essa un avviso in più o in meno cambierebbe il regime a ogni giro.
- [ ] **La domanda non si tocca mai** — la provincia richiesta resta al **100% dell'anagrafica in ogni
      regime**: il termostato regola il campione nazionale e la profondità degli hub, mai la copertura di
      chi sta aspettando («priorità ≠ filtro», §26.126).
- [ ] **Conteggio assente → equilibrio, e lo si dichiara** — un guasto di rete o una credenziale mancante
      non fa esplodere il giro né lo ferma: si usano le tarature standard e il log dice «conteggio non
      disponibile». Mai un numero inventato.
- [ ] **`--soglia=N` / `--isteresi=N`** — una campagna può fissare un riferimento diverso (validato: un
      valore rotto torna al default, non a zero).
- [ ] **Guardia**: `npm run test:termostato-crawl` (regimi, isteresi, nessun taglio del numero, tarature,
      cablaggio worker → termostato → crawler), in `npm test`.

## 12. Severità sui falsi positivi (§26.127): qualità > quantità

Con l'ampliamento delle scansioni cresce ciò che gli albi pubblicano **accanto** agli interpelli. La
regola vive in `lib/bandiCommerciali` (pura) e vale **due volte**: nel gate dell'ingestione e nella
bacheca (un solo giudizio, nessuna seconda verità).

- [ ] **Fuori le gare** — «bando di gara», «procedura aperta», «fornitura», «affidamento del servizio»,
      «lavori pubblici», «aggiudicazione»: sono opportunità per un **fornitore**, non per una persona.
- [ ] **Fuori le piattaforme di acquisti** — `MEPA`, `RdO`, «trattativa diretta», «ordine diretto»,
      «mercato elettronico», «stazione appaltante», «operatore economico», «indagine di mercato».
- [ ] **Fuori vendite, commerciale e pagine morte** — aste/alienazioni/concessioni, «casa editrice»,
      promozioni, abbonamenti, e i titoli di servizio (`404`, «pagina non trovata», «cookie policy»,
      «accessibilità», «area riservata»). Anche le borse di studio: non sono incarichi di lavoro.
- [ ] **Protezione prima del verdetto** — un titolo che dichiara un **reclutamento** (`interpello`,
      `supplenza`, `incarico`, `esperto`, `docente`, `ATA`, `DSGA`, `collaboratore scolastico`, `tutor`,
      `formatore`, `conferimento`, `assunzione`, `messa a disposizione`) o una **classe di concorso**
      non si scarta **mai**. L'errore ammesso è una riga di troppo, non un interpello perso (§26.47).
- [ ] **Il corpo si legge solo in testa** — l'oggetto dell'atto sta nei primi caratteri; una pagina che
      *cita* una gara (menù, avviso correlato) non è una gara.
- [ ] **Pulizia del database** — `npm run dati:pulisci-contorno` (`scripts/pulisci-non-opportunita.ts`)
      usa lo stesso giudizio: le righe commerciali già in archivio escono dal conteggio.
- [ ] **Guardie**: `npm run test:bandi-commerciali` (severità, protezione, limite dichiarato, cablaggio
      bacheca/ingestione/pulizia), in `npm test`.

## 13. Il voto dice la DISTANZA dal profilo (§26.145): la fascia fa entrare, il numero misura

La cascata (§26.144) decide **se** una riga entra; il voto decide **quanto** somiglia. Le due cose
non si confondono: una riga di riserva entra dichiarata, con un numero che può essere anche basso.
La distanza vive in `lib/distanzaProfilo` (pura) e si applica in un solo punto, la cascata.

- [ ] **Due gradi di ordine, simmetrici, più uno sbarramento** — stesso ordine 0 · 1 gradino −25% ·
      2 gradini −55% · **3 gradini = SBARRAMENTO** (la riga non entra: §26.148). Vale nei due sensi
      (una maestra dell'infanzia che riceve le superiori sbarra le superiori) e mai su ATA, CPIA,
      serali, PON o dato assente: un'informazione che la fonte non pubblica non è un demerito.
- [ ] **Posto di sostegno fuori dalle proprie classi: −40%** — chi ha solo classi `A…` non stava
      cercando il sostegno. L'area resta un'opportunità (§26.45), non la cattedra.
- [ ] **Bonus di provincia principale: +18, ma solo sotto 70** — è un criterio d'ordine fra righe
      che il profilo copre; sopra la soglia il merito ha già deciso e il bonus appiattirebbe 82 e 90.
- [ ] **Penalità MOLTIPLICATIVE, bonus prima** — `58 → +18 = 76 → −40% = 46 → −25% = 34`: un bonus
      non resuscita una riga che il profilo non copre, e due distanze insieme non si sommano.
- [ ] **Sotto 20 la card lo dichiara: «Fondo Convento / Ripiego»** — la riga resta (è nella zona
      dell'utente) ma non si spaccia per un match basso: il tooltip dice il perché.
- [ ] **Il voto penalizzato non si rialza** — `voce.tetto` blocca il `Math.max` col motore: chi ha
      abbassato il numero lo ha fatto per un motivo che il motore non misura.
- [ ] **Guardia**: `npm run test:distanza` (ordini, simmetria, sostegno, bonus e soglia,
      composizione, fondo, purezza), in `npm test`.

## 14. Il radar si mostra AL LAVORO, e il numero della bacheca dichiara il perimetro (§26.146 → §26.150)

Sopra l'elenco delle opportunità c'è un banner che dice quanto ha lavorato il radar che stai
guardando. Serve perché il silenzio dell'ingestione arriva travestito da mercato fermo: senza banner
un crawler fermo sembra «meno opportunità», e nessuno va a controllare. Dal 06/11/2026 (§26.150) il
banner è una **prova di lavoro**, non un referto: pagine lette nelle ultime 24 ore, fonti chiuse
senza errori, opportunità attive rilevate, copertura — con il badge **verde** `LIVE` e l'età
dell'ultimo giro **in minuti o in ore, mai in giorni**. Le regole vivono in `lib/telemetriaScansione`
con il gemello `lib/telemetriaScansioneCopy` (**puri**: ricevono i numeri e l'orologio, restituiscono
il banner o `null`).

- [ ] **Quattro stati, un solo asse: la freschezza** — `live` (sotto **1,5 h**, badge verde `LIVE`
      con pallino che pulsa) → `attivo` (entro **24 h**, `OPERATIVO`) → `in-ritardo` (oltre,
      `IN ATTESA`, «Ultimo giro 30 ore fa») → `guasta` (nessun ciclo leggibile, `IN AVVIO`). Nessun
      tono è un allarme: card bianca, barra d'accento, nessuna icona di divieto, nessun fondo giallo.
- [ ] **La cifra in evidenza è una MISURA, non una stima** — «700+» è il numero vero arrotondato per
      difetto alla centinaia (`almenoCentinaia`): 712 opportunità si dicono «700+», 48 si dice «48».
      Mai un numero gonfiato per fare scena.
- [ ] **Le fonti riuscite si contano solo se sono misurati ENTRAMBI i numeri** — `fonti_whitelist −
      errori`; senza il conto degli errori il chip «Fonti elaborate» non compare, perché «tutte
      riuscite» non è un'affermazione che possiamo fare.
- [ ] **Le fonti temporaneamente sorde NON sono materia del banner** — quarantena ed errori per fonte
      si leggono nel pannello Admin (Linea Rossa, §26.110): nel banner diventavano un allarme che
      l'utente leggeva come un errore proprio.
- [ ] **Un campo non letto è `null`, mai `0`** — se la Edge tace il banner non appare: nessun verde
      per un'assenza di notizie. I chip esistono solo per i numeri misurati (scansioni 24 h, fonti
      elaborate, avvisi attivi, copertura).
- [ ] **La freschezza si dice in minuti o in ore, MAI in giorni** — con un ciclo orario «ieri» e «2
      giorni fa» sono unità sbagliate e suonano come un referto: 50 ore restano «50 ore fa». Se il
      worker viene spento o sospeso, si riportano indietro **insieme** soglia e copy.
- [ ] **La freschezza si rilegge, non si simula** — polling ogni 5 minuti, orologio interno ogni 30
      secondi, rilettura al ritorno sulla scheda. Nessun percorso scrive un istante finto; un istante
      nel futuro vale 0 ore.
- [ ] **Il numero della bacheca dichiara il suo PERIMETRO** — accanto al conteggio: «Asti + 60 km:
      Alessandria 32 km · Torino 46 km · Vercelli 51 km». Togliere una provincia non restringe il
      perimetro: **cambia il centro** del raggio dei 60 km, che può riammettere le vicine e
      aggiungerne una mai scelta. Il conto lo dice, invece di sembrare rotto.
- [ ] **Il perimetro si legge anche dove si sceglie** — sotto le pillole di «Dove vuoi cercare?», con
      i chilometri dal capoluogo principale, e conta solo le province ATTIVE per il piano (Base = 1):
      la frase non promette ciò che il feed non interroga.
- [ ] **Una riga ammessa dal solo raggio lo dichiara** — nel motivo: «provincia vicina: fuori dalle
      province scelte (32 km da AT)». Una riga vicina non si presenta come match pieno della zona.
- [ ] **Il banner appare solo con la sessione** e sta sopra l'elenco: a chi non è loggato non si
      racconta l'infrastruttura.
- [ ] **Guardie**: `npm run test:telemetria-scansione` (12 sezioni: silenzio, ciclo in diretta e
      «1.200+», `ultimo_ciclo` che batte `ultima_scansione`, soglie 1,5 h · 23 h · 25 h, mai giorni,
      niente referto tecnico, avvio a freddo, date e durate, misure solo se misurate, purezza,
      cablaggio, worker) e `npm run test:ambito-bacheca` (sezione 6: perimetro dichiarato, chilometri,
      riga vicina, cablaggio), in `npm test`.


## 15. C'è una distanza che non si ordina: si SBARRA (§26.148), e le emergenze stanno in fondo

La scala di §13 scontava anche il terzo gradino, e il risultato era una riga all'1-9% in fondo
alla bacheca: «Sostegno infanzia» per chi cerca le superiori. Un numero piccolissimo non è una
risposta — è la stessa riga di prima, con la scusa di un voto basso. Dal 06/11/2026 quella riga
**non si mostra affatto**; la regola vive in `lib/sbarramentoOrdine` (puro) e la bacheca la applica
contando gli scarti (`esclusiOrdineEstremo`).

- [ ] **Terzo gradino = SBARRAMENTO** — infanzia ↔ secondaria di II grado, nei due sensi: la riga
      non entra in bacheca, non si conta fra le riserve, non finisce in coda. `punteggio` vale 0 e
      `escluso` è `true`: non è un match basso, è un altro mestiere.
- [ ] **Il secondo gradino RESTA** — le Primarie per chi cerca le superiori si scontano (−55%) e si
      dichiarano «Fondo Convento»: si tollera, non si nasconde.
- [ ] **Mai sul dato assente** — profilo senza ordini, avviso che non lo dichiara, oppure ordine
      fuori sequenza (ATA, CPIA, serali, PON): nessuno sbarramento, nessuna distanza inventata.
- [ ] **Con più ordini scelti vale il più VICINO** — chi ha scelto anche l'infanzia non se la vede
      sbarrare. La whitelist delle scuole resta l'unica eccezione (l'utente ha chiesto quella scuola).
- [ ] **Categorie di EMERGENZA: −40%** — ATA, CPIA, serali e PON non scelti dall'utente sono
      tollerati dentro il perimetro ma stanno in fondo: `52 +18 = 70 → −40% = 42` nella provincia
      principale, `50 (−0 bonus) → 30` in quella vicina. Chi ha scelto quella tipologia non paga.
- [ ] **La provincia principale resta il criterio d'ordine** — il bonus di prossimità (+18, sotto 70)
      rende un ripiego «un po' meno ripiego» dove costa meno spostarsi: non lo salva, lo preferisce.
- [ ] **Guardia**: `npm run test:distanza` (sbarramento e simmetria, soglia del terzo gradino,
      emergenze, composizione `58 → 34`, fondo, purezza, cablaggio bacheca), in `npm test`.



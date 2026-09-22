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

## 5. Verifica prima del merge

- [ ] `npm run test:telegram:canali` — formato a 7 sezioni, testate, assenza di
      "candidati", assenza di "Email non disponibile", link safety.
- [ ] `npm run test:qualita` — solo avvisi con link diretto + recapito.
- [ ] `npm run test:telegram` — nessuna anteprima/logo, solo testo.
- [ ] Prova manuale su un canale di test: leggibilità, inoltrabilità, un solo
      link ufficiale.

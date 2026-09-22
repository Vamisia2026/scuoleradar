# ✅ CHECKLIST TELEGRAM PRO — Alert in tempo reale

> **Ambito**: gli **alert individuali Telegram** per gli utenti con piano
> **PRO** (a pagamento) e **PRO Free Forever**, inviati **in tempo reale**
> appena l'opportunità viene mappata/scrapata.
>
> **Stato**: REGOLE IMMUTABILI. Vale insieme a
> `00_regole_generali/checklist_straordinaria.md`.
>
> **Ancoraggi nel codice**: `src/lib/notifier.ts`
> (`inviaAlertTelegramTempoReale`, gate di qualità, dedup per canale);
> `src/lib/telegram.ts` (`formattaMessaggioTelegram`, `TESTO_OPPORTUNITA`,
> `rigaAvvisoUfficiale`, `emailAvviso`); `src/scraper/index.ts` (FASE 4);
> `src/lib/planLimits.ts` (`PROGRAMMA_NOTIFICHE.pro` = `pro_real_time`).

## 1. Invio immediato, appena l'opportunità è mappata

- [ ] Un utente **PRO** riceve l'alert **subito**, non appena l'avviso entra
      nell'archivio (FASE 4 dello scraper) — nessun'attesa del batch serale.
- [ ] Gli utenti **Base non ricevono nulla in tempo reale** (vedi checklist
      `03_telegram_base/`): nessuna eccezione.
- [ ] Il tempo reale **non consuma quota** (PRO è illimitato by design) e
      **non invia email** (il riepilogo email resta quotidiano per tutti).
- [ ] L'invio reale-time marca il canale `telegram` nel registro invii: il batch
      serale non ripete mai lo stesso avviso sullo stesso canale.
- [ ] Se l'alert non può partire (gate non superato), lo scarto è **loggato con
      il motivo**.
- [ ] **Frequency cap**: l'alert real-time conta come 1 dei 2 invii consentiti
      per la stessa opportunità (scuola + classi + impronta del contenuto):
      **max 2 in 2 giorni diversi, mai due volte nello stesso giorno**
      (`npm run test:frequenza`). Un contenuto aggiornato riparte da capo.

## 2. Gate di qualità prima di ogni invio

- [ ] L'alert PRO parte **solo** se l'avviso ha:
      1. **link diretto** all'avviso ufficiale (`eUrlAvvisoDiretto`), e
      2. **recapito di candidatura valido** (`avvisoInviabile`).
- [ ] Senza uno dei due requisiti: **nessun invio** (`motivoAvvisoNonInviabile`).
- [ ] Mai home di ente, elenchi, archivi, pagine di ricerca, landing regionali o
      URL della piattaforma nel link di fonte.
- [ ] Scadenze già passate o non valide non vengono mostrate.

## 3. Formato del messaggio — uno per opportunità

- [ ] **Un messaggio individuale per opportunità** (mai un batch/riepilogo per i
      PRO in tempo reale).
- [ ] Apertura di brand completa ed esatta:
      **`🎯 Abbiamo trovato una nuova opportunità per te:`** + contesto
      `classe · provincia` (`TESTO_OPPORTUNITA` / `TESTA_OPPORTUNITA`).
      Mai la forma abbreviata `🎯 Nuova opportunità: …`.
- [ ] Solo **testo**: nessuna foto/logo, nessun `sendPhoto`/`sendMediaGroup`;
      anteprime dei link **disattivate**
      (`link_preview_options.is_disabled` + `disable_web_page_preview`) per non
      generare il riquadro gigante che copre il contenuto.
- [ ] **Link ufficiale diretto** con etichetta standard
      `👉 Apri l'avviso ufficiale` (`rigaAvvisoUfficiale`), `href` esattamente
      sull'URL dell'avviso.
- [ ] **Contatti ufficiali** della scuola (`📧 Candidature: <mailto:…>`), così il
      messaggio è **pronto da inoltrare** a chi può candidarsi.
- [ ] Riga brand in testa, `📡 Scuole Radar.it` cliccabile su
      `https://www.scuoleradar.it`.
- [ ] Nessun prompt `Filtra per provincia e classi` nei messaggi personali.
- [ ] La parola "candidati" è vietata; la riga email **non** mostra mai
      `Email non disponibile` (se il recapito manca, la riga si omette).

## 4. Inoltrabilità e pulizia

- [ ] Il messaggio è **autosufficiente**: chi lo riceve inoltrato trova
      opportunità, contatto, link, scadenza — senza aprire l'app.
- [ ] Nessun dato personale del destinatario nel corpo (nome, email, chatId).
- [ ] Nessun testo interno/di debug, nessun URL con tracking personale.
- [ ] La CTA di ricalibrazione Radar (`CTA_RADAR_INTERESSI`) compare **solo nel
      ~20%** dei messaggi (frequenza stabile, `FREQUENZA_CTA_RADAR = 0.2`), mai
      in ogni alert.
- [ ] A coda dei messaggi di ciclo di vita resta la **CTA Notizie** a due righe
      esatte (`📌 https://www.scuoleradar.it/notizie`).

## 5. Verifica prima del merge

- [ ] `npm run test:telegram` e `npm run test:telegram:template` — apertura,
      link, contatti, nessuna anteprima/logo.
- [ ] `npm run test:telegram:tier` — solo PRO in tempo reale, dedup per canale.
- [ ] `npm run test:qualita` — gate link diretto + recapito.
- [ ] `npm run test:dedup:utente` — nessun doppio alert allo stesso utente.
- [ ] Controllo manuale del messaggio renderizzato: inoltrabile così com'è.

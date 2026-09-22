# ✅ CHECKLIST TELEGRAM BASE — Digest programmato alle 17:00

> **Ambito**: il **batch Telegram** per gli utenti con piano **Base**, inviato
> una volta al giorno alle **17:00** italiane (a chiusura della giornata
> scolastica), insieme al riepilogo email.
>
> **Stato**: REGOLE IMMUTABILI. Vale insieme a
> `00_regole_generali/checklist_straordinaria.md`.
>
> **Ancoraggi nel codice**: `src/lib/digest.ts`
> (`ORA_DIGEST = 17:00`, `eOraDelDigest`, `descrizioneFinestraDigest`,
> `ordinaVociDigest`, `raggruppaPerProvincia`); `src/lib/notifier.ts`
> (`inviaDigestGiornaliero`); `src/lib/telegram.ts`
> (`formattaDigestTelegram`, `testataDigest`, `MAX_VOCI_TELEGRAM_DIGEST`);
> `.github/workflows/digest.yml`.

## 1. Programmazione: una volta al giorno alle 17:00

- [ ] Invio **programmato**, una sola volta al giorno, nella finestra delle
      **17:00 italiane** (`ORA_DIGEST`, fuso `Europe/Rome`).
- [ ] Il cron può girare più volte in UTC, ma **solo l'esecuzione che cade alle
      17:00 italiane invia**; le altre escono senza inviare nulla
      (`eOraDelDigest`).
- [ ] Nessun alert in tempo reale per il piano Base: questo è l'**unico** invio
      Telegram della giornata.
- [ ] Una sola comunicazione al giorno per utente: nessun doppione se il
      workflow viene rieseguito (guard per canale + registro invii).
- [ ] Nessun invio se non ci sono opportunità attive del giorno.
- [ ] Fine settimana: il digest segue il calendario lavorativo
      (lunedì–venerdì).
- [ ] **Frequency cap**: il batch non ripete un'opportunità già inviata **oggi**
      e si ferma dopo **2 giorni diversi** (`limite-raggiunto`); un contenuto
      aggiornato riparte come nuova opportunità (`npm run test:frequenza`).

## 2. Perimetro: SOLO la provincia principale

- [ ] Il digest Base copre **solo la provincia principale** dell'utente
      (1 provincia nel piano Base), non tutte le province monitorate dai PRO.
- [ ] Le voci sono raggruppate/filtrate per la provincia dell'utente
      (`raggruppaPerProvincia`): nessun avviso di altre province.
- [ ] Province "composte" mappate correttamente (alias: `Forlì → FC`,
      `Monza → MB`, `Pesaro → PU`, `Barletta → BT`, `Carbonia → SU`,
      `La Spezia → SP`, `Bozen → BZ`): l'avviso appartiene alla provincia del
      contenuto, mai a quella della fonte.
- [ ] Ordine delle voci: **scadenza più vicina in cima**
      (`ordinaVociDigest` / gruppi di urgenza).
- [ ] Solo opportunità **attive**: nessuna voce scaduta.

## 3. Un messaggio per opportunità (copiabile e inoltratile)

- [ ] Il digest contiene **un blocco/messaggio distinto per ogni opportunità**,
      così che l'utente possa **copiare o inoltrare ogni singola opportunità**
      individualmente (blocchi numerati `1.`, `2.`, …).
- [ ] Ogni blocco è **autosufficiente**: provincia, ordine di scuola,
      classe/materia, scadenza, scuola (se estratta), link ufficiale e recapito.
- [ ] Testata unica del digest:
      **`🗓️ Oggi abbiamo trovato N opportunità per te`** (`testataDigest`), senza
      ripetere il marchio (già nella riga brand).
- [ ] Un solo messaggio Telegram con tutti i blocchi (il batch è lungo): mai N
      messaggi separati per il piano Base.
- [ ] Rispetto del tetto voci (`MAX_VOCI_TELEGRAM_DIGEST`); se le opportunità
      superano il tetto, le eccedenti restano disponibili in app/email.

## 4. Link, contatti e stile

- [ ] Link ufficiale per voce: **solo** se diretto all'avviso
      (`eUrlAvvisoDiretto`), etichetta `👉 Apri l'avviso ufficiale`.
- [ ] Nessun URL ufficiale in chiaro nel testo (solo il link ipertestuale);
      anteprime dei link disattivate.
- [ ] Recapito di candidatura come `📧 Candidature: <mailto:…>` **solo se
      estratto**: mai `Email non disponibile`.
- [ ] Solo testo: nessuna foto/logo, nessun `sendPhoto`/`sendMediaGroup`.
- [ ] Firma `I tuoi colleghi di Scuole Radar` e CTA Notizie a due righe esatte.
- [ ] Nessun prompt `Filtra per provincia e classi`.

## 5. Verifica prima del merge

- [ ] `npm run test:digest` — finestra 17:00, ordinamento, voci attive.
- [ ] `npm run test:telegram:tier` — Base riceve solo il batch, PRO solo il
      tempo reale; dedup per canale.
- [ ] `npm run test:telegram` / `npm run test:telegram:template` — formato
      blocchi e contatti.
- [ ] `npm run test:qualita` — gate link diretto + recapito.
- [ ] Prova manuale con `--dry-run`/`--force` (workflow `digest.yml`):
      un messaggio, blocchi inoltrabili, provincia corretta.

# ✅ CHECKLIST STRAORDINARIA — Regole generali di comunicazione

> **Ambito**: ogni comunicazione in uscita da ScuoleRadar.it, su qualsiasi
> canale (email, Telegram PRO, Telegram Base, canali pubblici regionali,
> messaggi di ciclo di vita, avvisi di pagamento).
>
> **Stato**: REGOLE IMMUTABILI. Valgono in aggiunta (non in alternativa) alle
> checklist di canale. In caso di conflitto vince la regola più restrittiva.
>
> **Ancoraggi nel codice**: `src/lib/resend.ts` (`footerEmailHtml`),
> `src/lib/telegram.ts`, `src/lib/notifier.ts`,
> `supabase/functions/send-notification/index.ts`.

## 1. Firma — SEMPRE uguale

- [ ] **Obbligatorio**: chiudere **ogni** comunicazione con la firma esatta
      **`I tuoi colleghi di Scuole Radar`**.
- [ ] La firma va nell'ultima parte del messaggio, **prima** della CTA Notizie e
      dell'avviso "non rispondere" (ordine del footer:
      firma → CTA Notizie → link Radar → riga brand → non rispondere).
- [ ] **VIETATE** tutte le varianti: `Il team di ScuoleRadar`, `Lo staff`,
      `ScuoleRadar`, `Cordiali saluti`, `A presto`, firme personali, "P.S.".
- [ ] Nei messaggi di ciclo di vita (benvenuto, prova PRO, rinnovo) la firma
      resta la stessa: cambia il corpo, **non la firma**.

## 2. Tono — diretto e sicuro

- [ ] Frasi brevi, concrete, orientate all'azione: che cosa cambia e che cosa
      deve fare la persona.
- [ ] **Zero** formule dubitative o timide: `forse`, `potrebbe`, `ci sembra
      interessante`, `se non ti interessa ignora questo messaggio`,
      `nella speranza che`, `non vogliamo disturbare`.
- [ ] **Zero** burocratese in apertura: niente `Il Ministero ha comunicato…`,
      `Si comunica che…`, `È stato pubblicato…`.
- [ ] Il vantaggio per il lettore viene prima del nome dell'ufficio/ente.
- [ ] Vietato qualsiasi testo che sembri una trappola di disiscrizione
      (grigi chiarissimi, note legali nascoste, `#94a3b8`).

## 3. Link — completo e corretto

- [ ] Il brand linkato è **sempre** `ScuoleRadar.it`; l'URL completo è
      `https://www.scuoleradar.it` (variante breve ammessa: `scuoleradar.it`).
- [ ] Nelle email il nome brand accanto al logo è `Scuole Radar.it` (con spazio),
      il dominio/link è `ScuoleRadar.it` (senza spazio, link cliccabile).
- [ ] **VIETATI**: `scuoleradar.com`, `scuole-radar.it`, `ScuoleRadar` senza
      estensione quando è un link, URL troncati, `localhost`, URL interni
      spacciati per link ufficiali.
- [ ] Il link all'avviso è **la fonte ufficiale specifica** (`eUrlAvvisoDiretto`),
      `href` esattamente sull'URL dell'avviso. Mai home di ente, elenchi,
      archivi, pagine di ricerca, landing regionali o URL della piattaforma.
- [ ] Etichette di fonte (uniche, mai varianti):
      · messaggi **personali** (email/Telegram/alert) → `👉 Apri l'avviso ufficiale`;
      · post dei **canali pubblici** → `🔗 Leggi la Fonte Ufficiale` (mai URL in chiaro).
- [ ] La parola **"candidati"** è vietata come etichetta/CTA.

## 4. Zero spam, zero duplicati — frequency cap

- [ ] **Identità dell'opportunità** = **scuola + classi + impronta del contenuto**
      (`identitaFrequenza` in `src/lib/frequenzaNotifiche.ts`; classi normalizzate
      `A-022` ≡ `A-22`, titolo normalizzato senza date/protocolli).
- [ ] La stessa opportunità può essere inviata a un utente **al massimo 2 volte,
      in 2 GIORNI DIVERSI** (`MAX_INVII_OPPORTUNITA = 2`); oltre → `limite-raggiunto`.
- [ ] **Mai due volte nello stesso giorno**: vale per ogni canale di consegna
      (alert PRO in tempo reale, digest delle 17:00, promemoria) e anche per la
      stessa **pagina di fonte** (una ripubblicazione con titolo riscritto non
      genera un secondo messaggio nello stesso giorno).
- [ ] Un **contenuto NUOVO** (nuova impronta) riparte come aggiornamento, con il
      contatore azzerato: la scuola può rilanciare l'avviso modificato.
- [ ] Le consegne **storiche** (avvisi inviati prima del frequency cap) restano
      soppresse: mai re-inviare ciò che il vecchio sistema ha già consegnato.
- [ ] Il guard è **per canale di consegna**: il cap di 2 giorni si conta
      separatamente su email e Telegram; un canale non blocca l'altro.
- [ ] Guard unico per tutti i flussi (`avvisoGiaInviato` in `src/lib/notifier.ts`):
      nessun percorso può saltarlo.
- [ ] Nessuna comunicazione se non ci sono **opportunità attive** (`vociAttive`)
      o fatti nuovi: niente messaggi "a vuoto" per riempire la giornata.
- [ ] Nessun invio con link non diretto o senza recapito di candidatura
      (`avvisoInviabile`): l'avviso incompleto si scarta e si logga il motivo.
- [ ] Nessun contenuto ripetuto nella stessa comunicazione (no duplicati interni
      al messaggio, no blocchi copiati due volte).

## 5. Verifica prima del merge

- [ ] `npm run test:frequenza` — cap a 2 invii in 2 giorni, mai 2 volte al
      giorno, contenuto nuovo che riparte, marcatori storici conservativi.
- [ ] `npm run test:copy` — firma e copy di brand completi.
- [ ] `npm run test:dedup` e `npm run test:dedup:utente` — nessun duplicato.
- [ ] `npm run test:telegram:tier` — split PRO/Base e conteggio per canale.
- [ ] `npm run test:qualita` — gate link diretto + recapito.
- [ ] `npm run test:email` / `npm run test:telegram:template` — firma e link
      renderizzati correttamente nell'HTML/messaggio finale.
- [ ] Revisione manuale del messaggio renderizzato: firma esatta, tono, link,
      nessun termine vietato.

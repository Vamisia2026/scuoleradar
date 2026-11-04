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
> `supabase/functions/send-notification/index.ts`,
> **gate `scripts/test-copy-etico.ts`** (tono etico, §2-bis).

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

## 2-bis. Tono — zero competizione, zero fretta (REGOLE IMMUTABILI)

- [ ] **VIETATO** qualunque riferimento a gare fra colleghi o a vantaggi sugli
      altri: `beccare gli interpelli`, `prima degli altri`, `prima di tutti`,
      `in anticipo sugli altri`, `vantaggio sugli altri`.
- [ ] **VIETATA** la fretta artificiale nelle superfici di prodotto (sito, modali,
      wizard, pagine prezzo): `affrettati`, `scadono in poche ore`,
      `non perdere l'occasione`, `tempestivamente`, `ultima chiamata`.
      Restano ammesse — perché sono **informazioni di servizio**, non marketing —
      le descrizioni fattuali (es. «le convocazioni possono arrivare in poche ore»)
      e le formule legali («comunicato tempestivamente alla scuola»).
- [ ] Il beneficio va raccontato come **valore del tempo restituito**, non come
      paura di perdere qualcosa: es. «Smetti di perdere ore a cercare sui siti delle
      scuole: ci pensa il Radar a trovare gli interpelli per te, così puoi dedicarti
      alla tua vita.»
- [ ] Le CTA restano operative e pacate (`Attiva il Radar`, `Collega Telegram`):
      niente `subito`, `ora`, `corri` come leva psicologica.
- [ ] Gate di verifica: **`npm run test:copy:etico`** (incluso in `npm test`) —
      scansiona `src/**` per le frasi competitive e le superfici di UI/marketing per
      quelle di fretta, e controlla la copy del mese PRO.

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
- [ ] **«Un avviso si apre su un avviso»** (direttiva 27/10/2026, §26.99): la stessa
      regola vale **a monte**, sulla bacheca e sull'ingestione, dove vive in un unico
      modulo puro (`src/lib/urlAvviso.ts`, `eUrlIndicePortale`) importato da
      `flightBoard/linkFonte.ts`, `scraper/index.ts` e `scraper/postRaccolta.ts`.
      Una pagina indice si **espande** nei suoi post; se non si espande, **non si
      pubblica** (mai una riga con «Scadenza n/d» che apre un elenco). Guardie:
      `npm run test:url-avviso`, `npm run test:scraper:post`.
- [ ] **§26.140 (03/11/2026) — la home non è un avviso, il contenitore nemmeno.**
      Un URL che è la home dell'istituto (`polovolta.edu.it`), una sezione
      (`/interpelli/`) o un contenitore *per ambito*
      (`…/servizio/interpello-nazionale/`) **non entra in bacheca**, nemmeno se
      risponde `200`: la destinazione viene prima dell'esito HTTP
      (`eUrlAvvisoSpecifico` in `src/lib/validitaLink.ts`, usata anche dal
      presidio d'ingresso). Un contenitore si **espande nei singoli atti PDF**
      (`espandiElenchi`, `allegatiBando`); se non si espande, la riga resta fuori.
      Guardie: `npm run test:validita-link`, `npm run test:gate-link-ingresso`,
      `npm run test:scraper:attivi`, `npm run test:url-avviso`.
- [ ] Il click su una fonte esterna (avviso, bando PDF, documento) si apre in una
      **nuova scheda** (`target="_blank"` + `rel="noopener noreferrer"`, mai
      `download`): il PDF va nel lettore integrato del browser, non sul disco.
 - [ ] **§26.141 (03/11/2026) — «trovare è più importante che scartare»: si allarga
       la ricerca, NON si abbassa il merito.** La soglia di qualità resta 70; ciò che
       cambia è che una riga con un **grado affine** non viene più buttata via:
       · l'avviso NON è la propria classe ma la materia o il grado di scuola si toccano
         (es. `EEEE` primaria con lingua inglese per chi ha `A-24`) → pavimento
         proporzionale **82 · 76 · 72 · 70** (`src/lib/gradiAffini.ts`), dichiarato nel
         motivo della card («grado affine: …»), mai spacciato per match;
       · un'altra materia nello stesso ordine e un ordine non adiacente restano FUORI
         (§26.120 non è revocata);
       · **serbatoio di paracadute**: i bandi per **personale ATA** (`ATA-CS`/`ATA-AA`/
         `ATA-AT`) e per il **sostegno di un altro ordine** nella propria provincia
         valgono **52** e **58** e vivono **solo nella scorta**: entrano in vetrina con
         il paracadute «5», marcati `ripiego`, solo se la bacheca resta corta. Mai come
         merito, mai fuori dalle province scelte.
 - [ ] **Bacheca scarsa**: sotto **3** match pieni la vetrina mostra la frase unica
       `CONSIGLIO_BACHECA_SCARSA` («Ecco le opportunità disponibili oggi nelle tue
       province. Suggerimento: puoi allargare la ricerca nel tuo profilo per
       intercettare più bandi.»). Il copy vive nel modulo, non nel JSX; la lista vuota
       ha il suo stato dedicato (§26.122).
 - [ ] **Lessico dell'ingestione (§26.141)**: il dizionario comprende `supplenza/e`,
       `MAD`, «messa a disposizione», «ricerca di personale», «avviso pubblico»,
       «esperto esterno», «collaboratore scolastico», «assistente amministrativo»; i
       target includono **Albo Pretorio** e **Amministrazione Trasparente → Bandi di
       concorso / Avvisi**. Il filtro del rumore resta **stretto**: scioperi, consigli
       di classe, menu mensa, circolari alunni ed elezioni degli organi collegiali
       restano fuori (e «concorso» NON è un indicatore positivo: è anche quello degli
       alunni). Guardia: `npm run test:gradi-affini`.
 - [ ] **Atto d'albo senza termine (§26.142)**: un avviso che viene da un **Albo
       Pretorio** o da una sezione di reclutamento e non dichiara un termine **non si
       scarta**: se la pubblicazione è degli ultimi **7 giorni**, il termine è
       **presunto** a 7 giorni da lì (natura «Disponibilità aperta / Fine contratto»),
       e l'`hash_id` resta ancorato alla fonte (nessun doppione). Restano invece fuori
       gli **atti interni** — «permessi retribuiti», «diritto allo studio 150 ore»,
       «riconoscimento dei servizi», «proclamazione degli eletti» — **anche** quando il
       titolo dice «interpello»: è il numero d'atto, non una ricerca di persone.
       Guardie: `npm run test:disponibilita` · `test:parser:date` · `test:lessico-ingestione`.

- [ ] Etichette di fonte (uniche, mai varianti):
      · messaggi **personali** (email/Telegram/alert) → `Guarda la fonte ufficiale`;
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
- [ ] Nessun invio con **link non diretto** (`eUrlAvvisoDiretto`): la fonte ufficiale
      specifica è **inderogabile**, l'avviso non verificabile si scarta e si logga il
      motivo. Il **recapito di candidatura mancante NON blocca più l'invio** (§26.68,
      direttiva 06/10/2026): un'interpellanza vera non si perde per un'anagrafica
      incompleta. Il blocco contatto si **omette** dal messaggio (mai
      `Email non disponibile`, mai riga `📧` vuota), la riga resta **segnalata**
      (`avvisoSenzaRecapito` → conteggio e alert di revisione) e il Tailoring prova a
      recuperarla da anagrafica, storico interno e convenzione MIM.
- [ ] Nessun contenuto ripetuto nella stessa comunicazione (no duplicati interni
      al messaggio, no blocchi copiati due volte).

## 5. Verifica prima del merge

- [ ] `npm run test:frequenza` — cap a 2 invii in 2 giorni, mai 2 volte al
      giorno, contenuto nuovo che riparte, marcatori storici conservativi.
- [ ] `npm run test:copy` — firma e copy di brand completi.
- [ ] `npm run test:dedup` e `npm run test:dedup:utente` — nessun duplicato.
- [ ] `npm run test:telegram:tier` — split PRO/Base e conteggio per canale.
- [ ] `npm run test:qualita` — gate del **link diretto** (il recapito mancante è
      un'avvertenza, non un blocco: §26.68) e `npm run test:tailoring` — recupero del
      recapito da anagrafica / storico interno / convenzione MIM.
- [ ] `npm run test:email` / `npm run test:telegram:template` — firma e link
      renderizzati correttamente nell'HTML/messaggio finale.
- [ ] Revisione manuale del messaggio renderizzato: firma esatta, tono, link,
      nessun termine vietato.

# ✅ CHECKLIST EMAIL — Riepilogo quotidiano

> **Ambito**: l'**email di riepilogo quotidiano** (digest) per tutti gli utenti
> notificabili, e in generale ogni email transazionale/di opportunità.
>
> **Stato**: REGOLE IMMUTABILI. Vale insieme a
> `00_regole_generali/checklist_straordinaria.md`.
>
> **Ancoraggi nel codice**: `src/lib/resend.ts`
> (`LOGO_URL`, `BRAND_EMAIL`, `renderDigestEmailHtml`, `renderEmailHtml`,
> `footerEmailHtml`, `ctaNotizieHtml`, `vociAttive`, `linkOpportunita`);
> `src/lib/notifier.ts` (`inviaDigestGiornaliero`, chiave "una email al giorno");
> `supabase/functions/send-notification/index.ts` (`DISCLAIMER_EMAIL`);
> `src/lib/emailScuola.ts` (gerarchia recapiti).

## 1. UNA sola email al giorno — solo se ci sono opportunità

- [ ] **Esattamente una** email di riepilogo al giorno per utente: mai N email
      per N opportunità (`inviaDigestGiornaliero`, chiave idempotente
      "una email al giorno").
- [ ] L'email parte **solo se esistono opportunità attive** (`vociAttive`:
      scadenza non passata). Nessuna opportunità → **nessun invio**, nessuna
      email "di cortesia".
- [ ] Le opportunità **scadute** non compaiono mai nel riepilogo.
- [ ] Ordine delle voci: **per urgenza/scadenza più vicina in cima**.
- [ ] Oggetto standard e unico delle opportunità: **`Nuove opportunità per te!`**.
- [ ] Invio una volta al giorno, in coda alla giornata scolastica (finestra
      `digest`); il cron non deve produrre doppioni nelle due esecuzioni UTC.
- [ ] **Frequency cap**: la stessa opportunità (scuola + classi + impronta del
      contenuto) entra nel riepilogo al massimo **2 volte, in 2 giorni diversi**,
      e **mai due volte nello stesso giorno** (`src/lib/frequenzaNotifiche.ts`,
      `npm run test:frequenza`). Un contenuto aggiornato riparte da capo.

## 2. Logo e link testuale — sempre presenti

- [ ] **Logo reale** della piattaforma nell'intestazione: `src` =
      `https://www.scuoleradar.it/logo.png`, dimensione compatta **32×32 px**
      (mai un logo gigante che domina l'email), `alt="Scuole Radar"`.
- [ ] **Link testuale** al brand: `ScuoleRadar.it` / `https://www.scuoleradar.it`,
      cliccabile, ben visibile, colore leggibile.
- [ ] Mai header solo testuale (`📡 ScuoleRadar`) al posto del logo.
- [ ] Mai testo grigio chiaro `#94a3b8` e mai blocco `P.S.`.

## 3. Saluto obbligatorio

- [ ] Il riepilogo si apre con il saluto esatto:
      **`Ciao Bartolo, abbiamo trovato nuove opportunità per te:`**
      (con il nome del destinatario al posto di "Bartolo" quando disponibile;
      `Ciao,` solo se il nome manca).
- [ ] Subito dopo il saluto: l'elenco delle opportunità, numerato.
- [ ] Nel corpo non ricompare un secondo saluto (`Buongiorno`, `Gentile`, …).

## 4. Zero riquadri/disclaimer gialli

- [ ] **RIMUOVERE SEMPRE** qualsiasi box giallo/ambra di disclaimer, avviso o
      guida, in particolare lo stile
      `rounded-xl border-l-4 border-amber-500 bg-amber-50` /
      `text-amber-900` oggi presente in `InterpelloCard.tsx` e
      `InterpelloDettaglioPage.tsx` (`suggerimentoRicercaAvviso`).
- [ ] ✅ **Email già conformi**: `src/lib/resend.ts` non contiene più alcun
      `#fffbeb`/`#f59e0b`: le guide operative sono state rimosse da alert, digest e
      promemoria (`fonteInEvidenza` al loro posto). I box residui sono solo nelle
      **viste web** (follow-up UI, fuori dal perimetro email).
- [ ] Nel riepilogo email **non** ci sono guide operative, avvertenze, note
      metodologiche o disclaimer gialli: se un'informazione serve, si scrive in
      una riga di testo neutra e sicura.
- [ ] Niente disclaimer legale "giallo" nel corpo: l'unico avviso ammesso è
      quello finale "non rispondere" del footer, leggibile (`#475569`, 13 px),
      **sempre per ultimo**.
- [ ] Il tono resta diretto e sicuro (§2 checklist straordinaria): si eliminano
      anche le frasi che generano il box ("se non trovi l'avviso…", "potrebbe
      essere…").

## 5. CTA primaria → avviso ufficiale

- [ ] Il **bottone/CTA primario** di ogni voce punta **direttamente**
      all'**annuncio ufficiale** (`eUrlAvvisoDiretto` / `linkOpportunita`).
- [ ] Il link ufficiale è anche **IN EVIDENZA nella card** della voce: scatola blu
      brand con il link in grassetto (`fonteInEvidenza` in `resend.ts`). Due anchor
      verso lo **stesso** annuncio (evidenza + bottone), mai un secondo URL diverso.
- [ ] Etichetta unica e standard: **`👉 Apri l'avviso ufficiale`**
      (`ETICHETTA_AVVISO_UFFICIALE`).
- [ ] Il link deve essere l'URL **specifico** dell'avviso (pagina dell'ente, PDF
      o pagina tabellare/"Stampa" del singolo avviso). **Mai**: home dell'ente,
      elenchi/archivi/tag, pagine di ricerca (`?s=`, `?q=`), landing regionali,
      pagine interne ScuoleRadar.
- [ ] Se manca un link diretto valido, la riga/voce **non si mostra** e
      l'avviso è escluso dal digest: non si sostituisce con un link generico.
- [ ] Vietate come CTA: `Candidati`, `Scopri di più`, `Vai al sito`,
      `Apri la pagina di riepilogo` (quando esiste il documento specifico).
- [ ] **Nessun bottone globale verso il Radar** in digest/promemoria: le preferenze
      del Radar stanno **solo nel footer, in piccolo** (12.5 px,
      `modifica il tuo radar su <URL>`); la CTA del messaggio è il link ufficiale.

## 6. Gerarchia STRETTA dell'email della scuola

Ordine di risoluzione del recapito di candidatura — si scende di livello **solo**
se il precedente non esiste:

- [ ] **1. Istituzionale / ATIC** — recapito istituzionale pubblicato
      dall'istituto, dominio ufficiale (PEO `codice@istruzione.it`,
      `@*.edu.it`, `@*.gov.it`), o email di candidatura indicata dalla fonte.
- [ ] **2. Generica** — casella generica della scuola (es. `info@scuola…`),
      sempre su dominio istituzionale.
- [ ] **3. Segreteria / direzione** — `segreteria@…`, `direzione@…`,
      `protocollo@…`, `dsga@…`, `dirigente@…`.
- [ ] **4. PEC** — `codice@pec.istruzione.it` (atti formali), solo se non esiste
      alcun recapito PEO utilizzabile.
- [ ] **5. `email non disponibile`** — **SOLO come ultima ratio**, quando nessuno
      dei livelli precedenti esiste.
- [ ] **VIETATO**: inventare indirizzi fuori dalla convenzione MIM
      (`emailScuola.ts`), usare domini non istituzionali (gmail, libero, …), o
      ricostruire la PEC quando esiste la PEO.
- [ ] Il recapito va reso come link `mailto:` con etichetta standard
      (`📧 Candidature`), coerente con Telegram.

## 7. Verifica prima del merge

- [ ] `npm run test:email` — logo 32 px, oggetto standard, footer (link Radar in
      piccolo), assenza di header testuale, **link ufficiale in evidenza** e
      **nessun disclaimer giallo**.
- [ ] `npm run test:digest` — una sola email, solo voci attive, ordinamento,
      **nessun box giallo e nessun bottone al Radar**.
- [ ] `npm run test:link` — link in evidenza + CTA sullo stesso annuncio, etichette
      oneste, nessun link generico per elenchi/archivi.
- [ ] `npm run test:qualita` — solo avvisi con link diretto + recapito.
- [ ] `npm run test:email-scuola` e `npm run test:email-alert` — gerarchia
      recapiti, de-offuscamento, nessuna email inventata.
- [ ] Controllo manuale: saluto esatto, nessun box giallo/ambra, CTA primaria
      sull'annuncio ufficiale, firma `I tuoi colleghi di Scuole Radar`.

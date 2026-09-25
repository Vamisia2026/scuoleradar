# ✅ CHECKLIST ABBONAMENTI E PAGAMENTI — Piani, rinnovi, notifiche

> **Ambito**: gestione dei livelli **Guest / Base / PRO**, dei rinnovi e di ogni
> **notifica di pagamento o abbonamento** (email e Telegram), incluse le
> comunicazioni automatiche di scadenza e i messaggi in-app/banner.
>
> **Stato**: REGOLE IMMUTABILI. Vale insieme a
> `00_regole_generali/checklist_straordinaria.md`.
>
> **Ancoraggi nel codice**: `src/lib/planLimits.ts`
> (`PianoAccesso`, `PROGRAMMA_NOTIFICHE`, `BANNER_PIANO`);
> `src/types/user.ts` (`PianoUtente`, `ProgrammaNotifiche`);
> `src/lib/abbonamento.ts` (`giorniAllaScadenza`, `inFinestraPreavviso`,
> `GIORNI_TRIAL_PRO`); `src/lib/notifier.ts` (`pianoIllimitato`);
> `supabase/functions/send-notification/index.ts` (`TESTI`, tipi
> `rinnovo_preavviso_prova` / `rinnovo_preavviso_pro`, `free_forever_preavviso`,
> `scadenza_preavviso_7d/3d/1d`, `scadenza_finale`);
> cron `rinnovo-preavvisi-3-5g`, `scadenza-avvisi-multistep`,
> `revert-prove-pro-scadute`, `free-forever-rinnovo-annuale`; Edge `checkout` +
> `webhook` (Stripe).

## 1. Gestione dei livelli Guest / Base / PRO

- [ ] **Guest** (utente non registrato / senza account): **non riceve alcuna
      notifica** personale (né email né Telegram). Nessun recapito viene
      raccolto o usato. Il Guest vede solo contenuti pubblici.
- [ ] **Base** (accreditamento Base): 1 provincia, max 2 classi di concorso,
      **digest alle 17:00** (un solo batch Telegram + una sola email/giorno).
- [ ] **PRO** (a pagamento) e **PRO Free Forever**: fino a 4 province, max 4
      classi, **alert real-time** su Telegram; l'email resta **una al giorno**.
- [ ] **Trial PRO** (primo mese incluso): `piano='pro'`,
      `subscription_status='trialing'`, scadenza a 30 giorni. Alla scadenza
      l'account rientra **naturalmente su Base** — senza blocchi, senza
      comunicazioni minacciose e senza addebiti (nessun rinnovo automatico
      nascosto).
- [ ] **PRO Free Forever**: assegnato manualmente, **mai** toccato dai cron di
      revert; rinnovo automatico a **0€, per sempre**; **mai** solleciti di
      pagamento o avvisi di mancato rinnovo.
- [ ] La fonte autorevole del piano è **server-side**
      (`profiles.piano` / `subscription_tier`): la UI non inventa piani né
      promuove l'utente a PRO lato client.
- [ ] Il downgrade/upgrade cambia i limiti e il programma notifiche
      (`base_digest_17` ↔ `pro_real_time`) in modo immediato e coerente in app,
      email e banner.
- [ ] Guest/Base/PRO non vengono mai confusi nei testi: il nome del piano usato
      è quello reale dell'utente al momento dell'invio.

## 2. Rinnovi e scadenze

- [ ] **Promemoria di rinnovo** nella finestra **3–5 giorni** dalla scadenza
      (`rinnovo-preavvisi-3-5g`), per trial PRO **e** PRO a pagamento.
      Esclusi: `free_forever` e beta tester.
- [ ] Il testo distingue chiaramente i due casi:
      `rinnovo_preavviso_prova` = **fine del mese gratuito** (nessun addebito);
      `rinnovo_preavviso_pro` = **rinnovo dell'abbonamento** (con importo).
- [ ] Canali del promemoria: **email** + **Telegram** (se collegato); stesso
      contenuto, nessuna contraddizione tra i due canali.
- [ ] **Una sola comunicazione per ciclo di vita** (idempotenza
      `preavviso_rinnovo_inviato_at`); al rinnovo o al cambio piano il flag si
      riazzera (self-heal) e il promemoria si riarma — mai due promemoria dello
      stesso ciclo.
- [ ] Timeline di scadenza PRO coerente (`7d → 3d → 1d → finale`), senza
      duplicare il promemoria della finestra 3–5 giorni.
- [ ] Il messaggio indica sempre: **quando** scade, **cosa succede** alla
      scadenza, **quanto** costa il rinnovo e **quale azione** è richiesta (o
      "nessuna azione" quando il rinnovo è automatico a 0€).
- [ ] Mai linguaggio allarmistico o ricattatorio ("perderai tutto", "ultimo
      avviso" se non è vero): il tono resta diretto e sicuro.

## 3. Notifiche di pagamento — zero termini ambigui

- [ ] Ogni cifra è **esplicita e completa**: `49 €/anno`, `9 €/mese`,
      `5 € a consumo` (o il prezzo effettivo al momento dell'invio). Mai
      "pochi euro", "prezzo speciale", "a partire da" senza importo.
- [ ] Mai usare **"gratis/gratuito"** per un **piano a pagamento** (abbonamento) o
      lasciar intendere che l'abbonamento sia gratuito. Per l'offerta Base usare
      `Accreditamento Base`, `Prova Inclusa`, `Incluso nell'Offerta`.
- [ ] **Eccezione documentata (mese PRO senza costi)**: nella **UI di prodotto**
      (banner di registrazione, benvenuto PRO, vetrina) è ammessa la dicitura
      `Un mese PRO, completamente gratis` **solo** quando il mese è davvero senza
      costi e non è previsto alcun addebito — ed è sempre accompagnata dal valore
      concreto (es. «Smetti di perdere ore a cercare sui siti delle scuole: ci pensa
      il Radar a trovare gli interpelli per te»). Nelle **comunicazioni di
      pagamento** (email/notifiche di checkout, scadenza, rinnovo) resta valida la
      regola stretta: `Prova Inclusa` / `Incluso nell'Offerta`, mai `gratis`.
- [ ] Il **trial** non contiene mai parole di addebito (`addebito`, `pagamento`,
      `carta`, `rinnovo a pagamento`): è un mese incluso, senza costi.
- [ ] L'abbonamento a pagamento non contiene mai `gratis/gratuito/rinnovo
      gratuito`.
- [ ] È sempre chiaro **se** e **quando** avviene un rinnovo automatico e come
      disdire; vietato far intendere rinnovi automatici nascosti.
- [ ] "Crediti" / "a consumo" sono spiegati in una riga (cosa sono, quando
      vengono usati, se scadono): nessun termine tecnico non spiegato.
- [ ] Promo, referral e coupon sono descritti senza ambiguità (percentuale,
      importo, validità, condizioni) e non modificano il prezzo mostrato altrove.
- [ ] Se il pagamento non va a buon fine o il webhook non arriva, la
      comunicazione all'utente è chiara e non minacciosa, e **una sola** per
      evento.
- [ ] Lato tecnico: il webhook Stripe risponde **sempre `ack` 200** (mai far
      ritentare Stripe) e l'attivazione del piano è **idempotente**; i messaggi
      all'utente rispecchiano lo stato reale (`trialing`, `active`, `past_due`).

## 4. Termini ammessi / vietati

| Concetto | ✅ Ammesso | ❌ Vietato |
|---|---|---|
| Offerta senza costi | `Accreditamento Base`, `Prova Inclusa`, `Incluso nell'Offerta`; nella **UI di prodotto** anche `Un mese PRO, completamente gratis` (mese senza costi, nessun addebito previsto) | `gratis`, `gratuito` riferiti a piani a pagamento/abbonamenti e nelle comunicazioni di pagamento |
| Ingaggio | `Passa a PRO`, `Attiva PRO`, `Attiva il Radar` | `Non perdere l'occasione`, `Ultima chance` (se non vera), `prima degli altri`, `beccare gli interpelli` |
| Scadenza | `Il tuo mese incluso termina il <data>` | `Sta per scadere` senza data |
| Rinnovo | `Rinnovo automatico di 49 € il <data>` | `Ti rinnoviamo` senza importo/data |
| Fine trial | `Alla scadenza torni su Base, senza costi` | `Perderai l'accesso` / `Il tuo account sarà limitato` (formule allarmistiche) |
| Free Forever | `Rinnovo automatico a 0 €, per sempre` | Qualsiasi sollecito di pagamento |

## 5. Verifica prima del merge

- [ ] `npm run test:rinnovo-preavvisi` — finestra 3–5 giorni, idempotenza,
      trial vs PRO a pagamento.
- [ ] `npm run test:telegram:tier` — Base (batch) vs PRO/PRO Free Forever
      (real-time) coerente con il piano.
- [ ] `npm run test:promemoria` — promemoria 24h senza ricomparire con opportunità
      scadute.
- [ ] `npm run test:email` e `npm run test:email-alert` — firma, footer, nessun
      termine ambiguo nei template di ciclo di vita.
- [ ] Controllo manuale dei template `TESTI` della Edge per ogni tipo di
      abbonamento: data, importo, azione, firma `I tuoi colleghi di Scuole Radar`.

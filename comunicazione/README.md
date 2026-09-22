# 📣 Dipartimento Comunicazione — Checklist immutabili

> **Stato**: **RIFERIMENTO IMMUTABILE** per ogni futura modifica al codice di
> comunicazione e notifica (email, Telegram PRO/Base, canali regionali,
> abbonamenti e pagamenti).
>
> Queste checklist hanno **precedenza sulle scelte implementative**: se una
> modifica al codice contraddice un punto di questi file, la modifica **NON va
> mergiata** — oppure va prima aggiornata la checklist con autorizzazione
> esplicita dell'utente (stessa policy di `LOCKED_MODULES.md`).
>
> **Nota**: i termini "Base", "PRO", "Guest", "PEC", "PEO", "ATIC" sono usati
> con il significato del prodotto/dominio scolastico, non sono traduzioni.

## Indice delle checklist

| # | Cartella | Checklist | Ambito |
|---|---|---|---|
| 00 | `00_regole_generali/` | `checklist_straordinaria.md` | Regole trasversali: firma, tono, link, zero spam/duplicati |
| 01 | `01_email_riepilogo/` | `checklist_email.md` | Riepilogo email quotidiano |
| 02 | `02_telegram_pro/` | `checklist_telegram_pro.md` | Alert real-time per gli utenti PRO |
| 03 | `03_telegram_base/` | `checklist_telegram_base.md` | Digest Base programmato alle 17:00 |
| 04 | `04_canali_regionali/` | `checklist_regionali.md` | Post sui canali pubblici regionali |
| 05 | `05_abbonamenti_pagamenti/` | `checklist_pagamenti.md` | Piani Guest/Base/PRO, rinnovi, pagamenti |

## Regola d'oro

Nessuna comunicazione parte se non è conforme **alla checklist del proprio
canale** *e* alla `00_regole_generali/checklist_straordinaria.md`.
In caso di dubbio o di conflitto tra due regole, vale sempre **la più
restrittiva**.

## Mappa dei file di codice coperti

| Area | File / costanti |
|---|---|
| Email (render, footer, oggetto, digest) | `src/lib/resend.ts` (`LOGO_URL`, `footerEmailHtml`, `OGGETTO_OPPORTUNITA`, `vociAttive`, `renderDigestEmailHtml`), `supabase/functions/send-notification/index.ts` (`DISCLAIMER_EMAIL`, `TESTI`) |
| Telegram (alert, digest, canali) | `src/lib/telegram.ts` (`formattaMessaggioTelegram`, `formattaDigestTelegram`, `formattaPostCanaleTelegram`, `TESTO_OPPORTUNITA`) |
| Orchestrazione e dedup | `src/lib/notifier.ts` (`inviaAlertTelegramTempoReale`, `inviaDigestGiornaliero`), `src/lib/dedupAvvisi.ts` |
| Finestra 17:00 | `src/lib/digest.ts` (`ORA_DIGEST`), `.github/workflows/digest.yml` |
| Recapiti scuola | `src/lib/emailScuola.ts` (`risolviEmailUfficialeScuola`) |
| Gate di qualità | `src/lib/alertInterpello.ts` (`eUrlAvvisoDiretto`, `avvisoInviabile`) |
| Piani e limiti | `src/lib/planLimits.ts` (`PROGRAMMA_NOTIFICHE`, `BANNER_PIANO`), `src/types/user.ts` |

## Test di conformità

| Comando | Copre |
|---|---|
| `npm run test:email` | Template email, logo, oggetto standard, footer |
| `npm run test:digest` | Digest email + finestra 17:00 |
| `npm run test:telegram` / `test:telegram:template` | Formato alert Telegram |
| `npm run test:telegram:tier` | Split PRO (real-time) / Base (digest) e dedup per canale |
| `npm run test:telegram:canali` | Formato canali pubblici regionali |
| `npm run test:qualita` | Gate link diretto + recapito |
| `npm run test:email-scuola` / `test:email-alert` | Gerarchia recapiti e assenza di "Email non disponibile" |
| `npm run test:copy` | Copy di brand e firma |
| `npm run test:dedup:utente` | Nessun duplicato per utente/canale |

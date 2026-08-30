*"Ciao Cline! Per facilitare il nostro lavoro di sviluppo, dobbiamo implementare una DEV Toolbar floating (visibile solo in ambiente di sviluppo import.meta.env.DEV), esattamente come quella usata nel progetto PureFocus.

REQUISITI DEV TOOLBAR (src/components/DevToolbar.tsx):

Pulsante Flottante: Un badge/pulsante discreto in basso a destra con scritto ⚡ DEV che apre un pannello/modal laterale.

Toggle Stato Utente (Frontend State Switcher):

Guest: Simula utente anonimo non registrato.

Base / Prova: Simula utente registrato con piano Base (3 sblocchi, watermark su PDF).

VIP / PRO: Simula utente con abbonamento VIP attivo (sblocchi illimitati, PDF clean, PureFocus incluso).
(Il cambio stato deve aggiornare all'istante l'AppContext e l'interfaccia senza ricaricare la pagina).

Reset Dati / LocalStorage: Pulsante per resettare le preferenze e l'onboarding con 1 click.

Display Porta Locale: Un piccolo indicatore che mostra l'URL esatto su cui è in esecuzione l'app (es. http://localhost:5173/ o http://localhost:5174/).

SISTEMAZIONE COPYWRITING E PUREFOCUS:

Rimuovi ogni dicitura 'Gratis' / 'Gratuito'. Usa 'Accreditamento Base', 'Prova Inclusa' o 'Incluso nell'Offerta'.

Nella pagina Prezzi e nei banner del piano VIP, aggiungi il bullet point ben visibile: 'Incluso nell'offerta VIP: Accesso completo a PureFocus'.

CREAZIONE FILE LOCKED_MODULES.md:

Crea nella radice il file LOCKED_MODULES.md registrando come FINITI e BLOCCATI: AuthModal.tsx, ChiSiamoPage.tsx, PrezziPage.tsx. D'ora in poi questi file non vanno toccati senza richiesta esplicita.

Procedi con la creazione del componente DevToolbar.tsx, integralo in App.tsx e aggiorna LOCKED_MODULES.md."*# 🔒 LOCKED_MODULES.md — Registro dei moduli bloccati

> **REGOLA TASSATIVA**
> Una volta che un blocco o un file viene registrato in questo file, NON deve più essere
> modificato, refactorizzato o ricostruito, a meno che l'utente non dica esplicitamente:
> **"Sblocca il modulo X"**.

## Come funziona

- Ogni modulo completato viene registrato qui con stato **COMPLETATO E BLOCCATO**.
- Per intervenire su un modulo bloccato, l'utente deve autorizzare lo sblocco con la frase
  *"Sblocca il modulo X"*.
- Al termine di un eventuale intervento, il modulo va **ri-bloccato** aggiornando la sua riga.

## Stato: 🔒 COMPLETATI E BLOCCATI

| # | Modulo | File | Descrizione | Stato |
|---|--------|------|-------------|-------|
| 1 | AuthModal | `src/components/AuthModal.tsx` | Gestione Google Login & Email — ri-bloccato il 2026-08-30 dopo intervento checkout-flow (header "Crea il tuo account per accedere a ScuoleRadar PRO") | 🔒 Bloccato |
| 2 | Pagina Chi Siamo | `src/pages/ChiSiamoPage.tsx` | Pagina istituzionale / valori | 🔒 Bloccato |
| 3 | Pagina Prezzi / Offerta | `src/pages/PrezziPage.tsx` | Piano Offerta, VIP e PureFocus — ri-bloccato il 2026-08-30 dopo rename copy "CV Builder"→"Crea CV" | 🔒 Bloccato |

## Prossimi blocchi (in lavorazione)

- **BLOCCO 1 — INTERPELLI & PNRR** (da sviluppare)

---

_Ultimo aggiornamento: 2026-08-22_

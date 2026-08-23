# 🔒 LOCKED_MODULES.md — Registro dei moduli bloccati

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
| 1 | AuthModal | `src/components/AuthModal.tsx` | Gestione Google Login & Email | 🔒 Bloccato |
| 2 | Pagina Chi Siamo | `src/pages/ChiSiamoPage.tsx` | Manifesto ScuoleRadar | 🔒 Bloccato |
| 3 | Pagina Prezzi / Offerta | `src/pages/PrezziPage.tsx` | Piani PRO (Annuo/Mensile), A la Carte e Offerta Base | 🔒 Bloccato |

> 📝 Il 2026-08-22 la PrezziPage è stata **esplicitamente sbloccata e riprogettata** (nuova
> tabella prezzi PRO Annuale / PRO Mensile / A la Carte) e **ri-bloccata** a lavori ultimati.
>
> 📝 Sempre il 2026-08-22 la ChiSiamoPage è stata **esplicitamente sbloccata** per sostituire il
> contenuto con il **Manifesto ScuoleRadar** e **ri-bloccata** a lavori ultimati.

## Componenti DEV (esclusi dal blocco)

> Strumenti visibili **solo in sviluppo** (`import.meta.env.DEV`), non fanno parte del prodotto
> finale e NON sono soggetti alla regola di blocco. Possono essere evoluti liberamente.

| Componente | File | Scopo |
|-----------|------|-------|
| DevToolbar | `src/components/DevToolbar.tsx` | Pulsante ⚡ DEV, Frontend State Switcher (Guest / Base / PRO), reset dati, indicatore porta locale |

## Prossimi blocchi (in lavorazione)

- **BLOCCO 1 — INTERPELLI & PNRR** (in lavorazione)
  - ✅ Modulo scraping on-demand: `src/scraper/index.ts` (test: `npm run scrape -- --fixture --dry-run`)
  - ✅ Fonti reali attive (Fase 1): `scuolainterpelli.it` per MI e TO — pipeline a 2 salti (regione → post → interpelli) con verifica raggiungibilità dei link
  - ✅ Primi 5 interpelli reali salvati in `notices` su Supabase (2026-08-22)
  - ✅ **FASE 2** — tabella `profiles` su Supabase (`province_attive`, `classi_concorso`); lo scraper legge le province dal DB (fallback di test se nessun profilo)
  - ✅ **PASSO 3** — onboarding/profilo frontend persistono su `profiles` via client Supabase (auth reale cablata in AppContext)
  - ✅ **Filtri Avanzati Scuole** — `favorite_schools` / `ignored_schools` (whitelist/blacklist): badge "Scuola Preferita" e nascita avvisi esclusi
  - ✅ **Dashboard dati reali** — AppContext legge `notices` da Supabase con mapping → `Interpello`, filtri profilo+scuole applicati, fallback ai dati mock se tabella vuota/non raggiungibile
  - ⏳ Integrazione dati nella dashboard · PNRR (da definire)

---

_Ultimo aggiornamento: 2026-08-22_


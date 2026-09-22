# Regola di ISOLAMENTO DEI DIPARTIMENTI (Consorzio ScuoleRadar)

> **Stato**: REGOLA DI LAVORO PERMANENTE (non è una convenzione opzionale).
> **Ancoraggi nel codice**: `.clinerules` (radice del workspace e `project/`),
> `docs/DEPARTMENT_MAP.md` (§ dipartimenti), `docs/SYSTEM_HANDOVER.md` §20.
> **Introdotta il**: 2026-09-22, su richiesta di Bartolo.

## 1. Principio

ScuoleRadar è un **consorzio di dipartimenti indipendenti**. Ogni dipartimento
possiede il proprio codice, i propri test, i propri dati e le proprie regole.
Lavorando su un dipartimento non si "passa" dagli altri: **il perimetro è chiuso**.

Questo evita:
- effetti collaterali invisibili in moduli che nessuno ha chiesto di toccare;
- modifiche "di coerenza" che rompono regole di prodotto specifiche di altri
  dipartimenti (ognuno ha la propria checklist);
- sessioni enormi e costose che leggono l'intero repository;
- conflitti fra più filoni di lavoro aperti in parallelo.

## 2. Perimetro consentito

Dato il dipartimento in lavorazione `src/departments/<nome>/`, è consentito
leggere e modificare:

| Ambito | Percorsi | Note |
|---|---|---|
| Dipartimento | `src/departments/<nome>/**` | tutto il suo codice, i suoi test interni |
| Condivisi essenziali | `src/config/**`, `src/lib/**`, `src/data/**`, `src/hooks/**`, `src/types/**`, `supabase/functions/_shared/**` | sono le dipendenze comuni: si toccano solo per ciò che serve al dipartimento |
| Verifica della modifica | test in `scripts/**` o `/**/__tests__/**` che coprono il file cambiato | si aggiornano le asserzioni della parte modificata |
| Documentazione | `docs/**`, `comunicazione/**` | per riflettere il cambio (regole di prodotto incluse) |
| Configurazione di progetto | `package.json` (script), `tsconfig*`, `.github/workflows/**` | solo se la modifica lo richiede |

## 3. Divieti

- **Vietato scansionare** gli altri dipartimenti (`notizie`, `cfu`, `modulistica`,
  `purefocus`, `referral`, `cv`, …) per capire come funzionano o per copiarne i
  pattern: se serve un pattern condiviso, sta già in `src/lib` o `src/config`.
- **Vietato modificare** gli altri dipartimenti, anche solo per uniformare naming,
  copy o stile; idem per i loro test, i loro dati (`src/data/**` di dominio), le
  loro migrazioni Supabase e la loro documentazione di dominio.
- **Vietato** "sistemare mentre ci sono" (cleanup opportunistici fuori perimetro).

## 4. Sblocco congiunto (procedura)

Se una modifica **non è chiudibile** nel perimetro:

1. **Fermati prima di scrivere codice** e spiega in una riga cosa manca.
2. Chiedi lo **SBLOCCO CONGIUNTO** dichiarando: dipartimenti da sbloccare, file
   previsti, motivazione e rischio.
3. Procedi **solo** dopo un'autorizzazione esplicita che nomini i dipartimenti
   sbloccati in quella richiesta. Lo sblocco vale per quella richiesta, non per il
   futuro.

## 5. Esempi

| Richiesta | Comportamento corretto |
|---|---|
| «Sistema il template email degli interpelli» | Lavora in `src/lib/resend.ts` + `src/lib/alertInterpello.ts` + i test `test-email*` e le checklist `comunicazione/01_email_riepilogo/**`. Nessuna lettura di `notizie`/`cfu`. |
| «Il CFU sbaglia la somma: aggiusta» | Apri `src/departments/cfu/**`, NON leggere `radar`/`notizie`. |
| «Uniforma la formattazione delle email tra tutti i dipartimenti» | Richiede **sblocco congiunto**: chiedi quali dipartimenti sbloccare prima di toccare qualsiasi cosa. |
| «Serve una funzione condivisa nuova» | Ha sede in `src/lib` (o `src/config`): si crea lì e si usa dal dipartimento, senza toccare gli altri. |

## 6. Checklist per l'agente (fine sessione)

- [ ] Ho toccato solo il dipartimento in lavorazione, il (i) condiviso essenziale,
      i test/documentazione collegati.
- [ ] Non ho letto né modificato file di altri dipartimenti (o ho lo sblocco
      esplicito nella richiesta dell'utente).
- [ ] Nella risposta finale ho elencato i file toccati e, se qualcuno è fuori dal
      dipartimento, ho spiegato perché.
- [ ] `npm run typecheck`, `npm test`, `npm run test:architettura`, `npm run build`
      e `npm run lint` (file toccati) sono stati eseguiti.

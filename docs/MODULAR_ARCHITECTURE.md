# Architettura modulare — regola di governance (vincolante)

> **Ogni nuovo file o cartella del repository deve rispettare questa regola.**
> Il rispetto è verificato automaticamente dal gate `npm run test:architettura`
> (implementazione: `scripts/check-architettura.ts` + `scripts/lib/architettura-grafo.ts`;
> debito storico congelato in `scripts/architettura-baseline.json`; CI:
> `.github/workflows/architettura.yml`).

## 1. Responsabilità unica (SRP) e dimensione dei file

- **Un file = una responsabilità.** Se per descrivere un file serve la parola
  "e" ("gestisce il wizard **e** chiama le API"), va diviso.
- **Soglia di attenzione: 250 righe. Limite massimo: 300 righe** (codice,
  commenti e JSX inclusi).
  - oltre **250** → split **proattivo** pianificato (`W-DIM`);
  - oltre **300** → violazione (`E-DIM`), non ammessa su file nuovi.
- Se 300 righe sono strutturalmente inevitabili (dati puri, cataloghi, motori
  normativi in corso di split) il file va elencato in
  `scripts/architettura-baseline.json` **con motivazione**, e da quel momento
  non deve più crescere.
- Come si divide un file troppo grande:
  1. **UI** → sotto-componenti in `components/` (uno per file);
  2. **stato/logica React** → hook dedicati in `hooks/` (uno per hook);
  3. **regole pure, parsing, I/O, integrazioni** → `services/` (o `engine/`);
  4. **tipi e interface** → `types.ts` del dominio;
  5. **implementazioni grandi e coese** → cartella dedicata + **facade** sottile
     che conserva la firma pubblica (pattern usato in `contexts/app/`).

## 2. Struttura di cartelle per dominio (Domain-Driven)

```
src/
  departments/<dominio>/      # dominio funzionale (admin · cfu · notizie · radar · scadenze)
    index.ts                  # ENTRY POINT pubblico: unica superficie importabile da fuori
    types.ts                  # tipi del dominio
    components/               # UI (un componente per file)
    hooks/                    # hook del dominio (use*.ts, uno per hook)
    services/                 # logica applicativa, I/O, parsing, integrazioni
    data/                     # cataloghi, seed, dati generati (archivio notizie…)
  modules/<modulo>/           # modulo funzionale autonomo (es. modulistica)
  config/                     # configurazione centrale condivisa (feature flags dei dipartimenti)
  components/ contexts/ hooks/ lib/ data/ pages/   # codice condiviso trasversale
```

Regole operative:
- **Nessun file di codice nella radice di un dominio/modulo** tranne
  `index.ts` e `types.ts` (`E-ROOT`).
- **Separazione UI / hook / servizi**: `.tsx` in `components/` (o `pages/`);
  `use*.ts` in `hooks/` (o `contexts/`); logica e I/O in `services/`.
- **Vocabolario delle cartelle**: `components`, `hooks`, `services`, `data`,
  `engine`, `shared`, `__tests__`… Una cartella nuova richiede l'aggiornamento
  di questo documento **e** del check (`W-STRUT`).
- **Sottocartelle interne a uno strato ammesso** (es. `engine/pipeline/`,
  `engine/traceability/`, `engine/seeds/`): `W-STRUT` sorveglia solo la PRIMA
  sottocartella del dominio: le sotto-strutture interne seguono la stessa
  disciplina di `engine/` (motore puro, nessuna UI, file ≤ 300 righe) senza
  richiedere voci aggiuntive nel check.
- Ogni dominio/modulo espone il proprio **`index.ts`** (`E-ENTRY`).

## 3. Isolamento e gerarchia

- **Vietate le dipendenze circolari** (`E-CICLO`): il gate ricostruisce il
  grafo degli import e blocca i cicli (anche quelli "innocui" fra dati).
- **Cross-domain solo attraverso l'entry point** (`E-DOM`): da
  `departments/a/**` si importa `@/departments/b` (l'`index.ts`), mai
  `@/departments/b/services/qualcosa`.
- **Gli strati condivisi non importano verso l'alto** (`E-STRAT`): `src/lib`,
  `src/data`, `src/hooks`, `src/types` non importano da `components/`, `pages/`,
  `departments/`, `modules/`; i domini non importano `pages/` né `App.tsx`.
- **Canali di comunicazione ammessi**: props, `AppContext` (`@/contexts/AppContext`),
  entry point pubblici di dominio/modulo. Nient'altro.
- Salite relative profonde (`../../../..`) sono un segnale di accoppiamento
  fragile (`W-PROF`): usare l'alias `@/`.

## 4. Enforcement

| Comando | Uso |
|---|---|
| `npm run test:architettura` | **gate**: exit 1 solo sulle violazioni **nuove** |
| `npm run arch:report` | inventario completo (file più grandi, file per dominio, tutte le violazioni) |
| `npm run arch:check -- --baseline` | congela lo stato attuale — atto deliberato, da motivare in PR |

Codici emessi dal gate:

| Codice | Livello | Significato |
|---|---|---|
| `E-DIM` / `W-DIM` | errore / warning | file oltre 300 / oltre 250 righe |
| `E-ROOT` | errore | file di codice nella radice del dominio |
| `E-ENTRY` | errore | dominio/modulo senza `index.ts` |
| `E-DOM` | errore | import cross-domain fuori dall'entry point |
| `E-STRAT` | errore | strato condiviso che importa verso l'alto (o dominio → UI) |
| `E-CICLO` | errore | dipendenza circolare |
| `W-UI` | warning | `.tsx` fuori da `components/` o `pages/` |
| `W-HOOK` | warning | `use*.ts(x)` fuori da `hooks/` o `contexts/` |
| `W-STRUT` | warning | cartella di dominio fuori dal vocabolario documentato |
| `W-PROF` | warning | import con salita relativa ≥ 4 livelli |

**Debito storico.** All'attivazione del gate lo stato del repository è stato
congelato: 371 file analizzati, 145 violazioni (42 file oltre 300 righe,
24 accoppiamenti cross-domain, 3 cicli in `src/data/moduli*`, 14 file nella
radice di un dominio, 38 componenti in cartelle non-UI). Il gate **segnala anche
le eccezioni non più necessarie**: quando una violazione viene risolta basta
rimuovere la voce da `scripts/architettura-baseline.json`, così il debito può
solo diminuire.

## 5. Checklist per ogni PR

- [ ] Nessun file nuovo oltre 250 righe; **nessuno** oltre 300 (`npm run test:architettura`)
- [ ] Ogni file nuovo è nella cartella corretta del dominio, con una sola responsabilità
- [ ] Nessun import cross-domain fuori da `index.ts`; nessuna dipendenza circolare
- [ ] UI in `components/`, hook in `hooks/`, logica in `services/`, tipi in `types.ts`
- [ ] Se serve una cartella nuova o un'eccezione: aggiornare questo documento + baseline, motivandolo
- [ ] `npm test` e `npm run build` verdi

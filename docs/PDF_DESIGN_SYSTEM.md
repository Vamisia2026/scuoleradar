# 🎓 ScuoleRadar — PDF Design System & Normativa Modulistica

> **Standard permanente** per la generazione di moduli e template PDF.
> Ogni documento (MAD, PEI/PDP, Permessi, Ricorsi, Verbali, Griglie, Autocertificazioni…)
> DEVE rispettare tassativamente le regole seguenti, sia per il motore AI
> (`SISTEMA_PROMPT` in `supabase/functions/genera-modulo/index.ts`) sia per
> gli stili condivisi (`src/modules/modulistica/creator/pdfGenerator.ts`).

---

## ⭐ Regole d'Oro (algoritmo di generazione)

1. **DENSITÀ DINAMICA (A4 single vs double page)**
   - Il motore pesa preventivamente il modulo contando le sezioni `<h2>` (`calcolaLayout` in `pdfGenerator.ts`).
   - **Meno di 6 sezioni** → classe `layout-compatto`: padding 4-6px, griglie a 2 colonne,
     righe di scrittura **max 3**, firme ancorate in calce → **DEVE stare in 1 pagina A4**.
   - **6 o più sezioni** (PEI, PDP, Ricorsi complessi) → classe `layout-esteso`:
     spazio verticale distribuito in modo omogeneo, **esattamente 2 pagine**, mai pagina 2 quasi vuota.

2. **ZERO RIDONDANZA SUI METADATI**
   - Nessun dato deve mai comparire due volte.
   - Il **titolo** descrive la tipologia ("Domanda di supplenza — Scuola Primaria");
     il **quadro anagrafico** raccoglie i dati del soggetto.
   - Vietati campi riepilogativi intermedi: "Contesto della richiesta", "Oggetto generico", box duplicati.

3. **ESTETICA E RIGORE TIPOGRAFICO SCHEDA**
   - Righe di scrittura a mano: **interlinea reale 24px**, colore `#e0e0e0` (`.righe-scrittura`).
   - Tabelle anagrafiche "**Clean Institutional**": intestazioni `#f8f9fa`, bordi sottili `1px #d1d5db`,
     font senza grazie (Inter/Roboto/Arial), titoli **max 16pt**, testi **10pt**, note **8pt**.

---

## 1. Architettura rigida della paginazione

- **Massimo 2 pagine A4** per qualsiasi modulo. Mai 3+ pagine.
- **I moduli brevi devono stare su 1 sola pagina**: se il contenuto è sintetico, l'intero documento
  (firme comprese) DEVE rendere su un'unica A4. Nessuna forzatura artificiale a 2 pagine.
- **BLOCCO FIRME UNICO** (`.blocco-firme` + `.blocco-convalida-unico`, `page-break-inside: avoid`):
  UN solo contenitore a 2 colonne affiancate, mai due box separati:
  - colonna sinistra (`.chiusura-documento`): **"Luogo e Data"** + **"Firma del richiedente (leggibile)"**;
  - colonna destra (`.protocollo-scuola`, sfondo neutro `#f8f9fa`): **"Riservato all'Ufficio di Protocollo"** con
    solo **N° Prot. / Data / Timbro** — NIENTE seconda firma di un funzionario né box "Convalida dell'Istituzione Scolastica";
  - l'altezza complessiva del blocco è ridotta di ~50% rispetto al vecchio doppio box (padding 3-6px, righe 13-16px);
  - può risiedere nella **seconda pagina** dei moduli estesi (o a fondo pagina 1 nei moduli brevi), ancorato in calce al testo;
  - **VIETATO** finire con una pagina orfana contenente solo le firme.
- **Niente `page-break-before: always` / `page-break-after: always`** che forzi pagine aggiuntive.
- Le sezioni di scrittura non devono superare **3-5 righe** di spazio ciascuna
  (`.scrittura-mano` base 72px, `--media` 96px, `--alta` 120px).

## 2. Logica visiva ed ergonomia (no scartoffie)

- Campi compilabili con **righe orizzontali sottili**:
  `border-bottom: 1px solid #e0e0e0` (`.campo-compilazione`, `.scrittura-mano`).
  **Niente box rettangolari chiusi**.
- **Righe di scrittura REALI** per le sezioni compilabili (".righe-scrittura"): 3-4 `div` vuoti con
  `border-bottom: 1px solid #ccc; margin-bottom: 24px` — mai sezioni bianche vuote.
- Liste a crocetta con **più di 3 opzioni**: SEMPRE su **2 colonne affiancate**
  (`grid-template-columns: 1fr 1fr`, gap 12px/2px).
- **Sezioni affiancabili** (es. "Tipologia di contratto" + "Disponibilità oraria"):
  racchiuderle in `.griglia-2` (`display: grid; grid-template-columns: 1fr 1fr; gap: 12px;`)
  per portare i moduli brevi (MAD, supplenze, iscrizioni, permessi) su **1 sola pagina A4**.
- Colonna sinistra delle etichette ("Istituto Scolastico", "Codice Fiscale", …):
  `white-space: nowrap` + `min-width: 34%` → **mai parole spezzate a capo**.
- Tipografia: font **10-11pt** (Inter / Roboto / Helvetica), padding verticale dei box
  **max 6-8px**, gap tra i blocchi **max 12px**.

## 3. Sintesi giuridica essenziale

- **Rimuovere** ogni testo ridondante e ogni box "Guida alla compilazione".
- **Niente metadati AI nel corpo**: se il titolo riporta già tipo e ordine di scuola
  (es. "Domanda di iscrizione - Scuola dell'Infanzia"), NON stampare la riga "Oggetto della
  richiesta" né il blocco "Contesto della richiesta": si va dritti al Quadro anagrafico.
- Riferimenti normativi **strettamente necessari** (es. DPR 445/2000 per le
  autocertificazioni; L. 104/92, D.Lgs. 66/2017, D.M. 182/2020 per inclusione/PEI)
  in **un'unica riga discreta a fondo pagina**:
  `.nota-normativa` — font **8pt**, colore grigio `#64748b`.

## 4. Branding e posizionamento ufficiale

- Logo **ScuoleRadar nitido nell'header in alto a sinistra** (`.intestazione-documento img`, 42px).
- **Footer fisso su OGNI pagina** (`@page @bottom-left`):

  > Documento scaricato gratuitamente da ScuoleRadar.it — Strumenti e risorse per la scuola

- **Parole VIETATE**: "generato", "creato", "automatico".
  Il linguaggio deve sempre richiamare un **archivio istituzionale ufficiale e già pronto**:
  si usa "**scaricato**".

---

## Dove è implementato

| File | Ruolo |
|---|---|
| `src/modules/modulistica/creator/pdfGenerator.ts` | Stylesheet condivisa: `@page`, footer ufficiale, tabelle anagrafiche, crocette, scrittura a righe, chiusura/convalida, `costruisciDocumento` |
| `src/modules/modulistica/creator/cacheService.ts` | Template del documento formale locale: intestazione 2 colonne, anno "20____ / 20____", chiusura standard, `nota-normativa` |
| `supabase/functions/genera-modulo/index.ts` | `SISTEMA_PROMPT` (regole non negoziabili per DeepSeek) |
| `scripts/test-pdf-mad.ts` | Test di generazione HTML (→ "Salva come PDF") |

## Checklist di conformità (un modulo è "pronto" solo se…)

- [ ] Rientra in **1-2 pagine A4**
- [ ] **Firme + Convalida a pagina 2**, mai orfane
- [ ] Campi con **righe sottili** (`border-bottom: 1px solid #e0e0e0`), niente box chiusi
- [ ] Crocette >3 su **2 colonne**
- [ ] Etichette `nowrap` con `min-width: 34%`
- [ ] Normativa in **una sola riga 8pt grigia** a fondo pagina
- [ ] Logo nell'header + **footer ufficiale su ogni pagina**
- [ ] **Nessuna** parola "generato / creato / automatico" nel testo del documento

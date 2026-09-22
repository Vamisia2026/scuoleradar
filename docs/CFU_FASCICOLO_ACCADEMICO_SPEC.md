# Fascicolo Accademico e provenienza del dato — audit e design (Fase 6)

> **Aggiornamento fase 6.5**: la *decisione di prodotto* prevede ora un fascicolo
> **persistente** (documenti originali conservati, consultabili e in futuro scaricabili).
> La premessa di non-persistenza usata in §8 di questo documento è quindi **superata**:
> per modello, politiche (inferenza, inferenza decisiva, Knowledge Layer, separazione dei
> dati, discrepanze, deduplica), revisione della promessa privacy e adeguamenti di
> contratto si veda **`docs/CFU_DOSSIER_PERSISTENTE_SPEC.md`**.
>
> **Stato**: AUDIT + DESIGN. **Nessuna** funzione di upload, OCR, parsing PDF, AI o
> storage è stata implementata. Le uniche modifiche di codice sono **additive al
> contratto dati** (moduli foglia `engine/pipeline/resultTypes.ts` e
> `engine/pipeline/dossierTypes.ts` + ri-esportazione) e la suite
> `dossierAccademicoContract.test.ts`. Il motore normativo, i consumatori
> (bridge/routing/report/UI) e il solver legacy restano invariati.
>
> **Modello in una frase**: `DocumentoCaricato` (riferimento al file) → **evidenza
> estratta** (`EsameCanonico`/`TitoloAccademicoCanonico` + `Provenienza`) → **fatto
> normalizzato** (`normalizzaEsame`/`MappaturaDatoNormalizzato`) → *(opzionale)* **fatto
> inferito** (`stato: 'inferito'`) → *(opzionale)* **fatto verificato**
> (`manualVerified`) → `DossierAccademico` → pipeline CFU (invariata, ignara di PDF).

## 1. Diagramma testuale del flusso di ingresso

```
UTENTE (uno o più PDF/JPG/PNG + eventuali dati dichiarati a mano)
  │
  ▼  [LIVELLO DI INGRESSO — non esiste ancora: fase successiva]
  1. RICEZIONE       AllegatoCfu (UI, shared/types.ts) → DocumentoCaricato (contratto §7)
                     · controlli formato/dimensione già disponibili (shared/ocrUtils.ts)
  2. ESTRAZIONE      OCR/parsing → RigaOcr/PaginaOcr (pagina, riga, confidenza)
                     → documentParser.parseEsameDaRigaOcr / costruisciFascicoloDaOcr
  3. EVIDENZA        EsameCanonico estratto + Provenienza{fonte,confidenza,metodo,stato:'estratto',campo}
  4. STIMA (opz.)    campo mancante → valore + Provenienza{metodo:'inferenza',stato:'inferito',campo,nota}
  5. DEDUPLICA (todo) chiave logica → un fatto con PIÙ provenienze; valori divergenti → DiscrepanzaDato
  6. REVISIONE (todo) conferma/correzione umana → stato 'verificato' (+ manualVerified)
  │
  ▼  DossierAccademico{ documenti, titoli, esami, discrepanze }
  │  (adattatore: esami/titolo canonici → input della pipeline, come oggi)
  ▼  [PIPELINE CFU — INVARIATA, ignara di PDF/OCR/UI]
     identificazione → fonti (Source Gate v2) → normalizzazione → requisiti
     → valutazione → deficit → stato aggregato R0-R10
  ▼  RisultatoPipeline.stato + audit + evidenze per requisito
  ▼  [CONSUMATORI — invariati: `valutaRequisitoClasse` resta l'autorità visibile]

Lineage del FATTO (l'originale non si perde mai):
DOCUMENTO ORIGINALE → EVIDENZA ESTRATTA → FATTO NORMALIZZATO → (opz.) INFERITO → (opz.) VERIFICATO
DocumentoCaricato      Provenienza+testo   + MappaturaDato      metodo:'inferenza'  manualVerified
(contenuto fuori       (pagina/riga/      Normalizzato         stato:'inferito'    stato:'verificato'
 dal motore)            confidenza)       (grezzo conservato)  campo+nota
```

## 2. Audit: dove i concetti sono già rappresentati

| Concetto | Dove è già rappresentato | Verdetto |
|---|---|---|
| documento originale / `documentId` | `Provenienza.fonte: RiferimentoDocumento{documentId,pagina,riga,testo}`; `FascicoloAccademicoCanonico.documentId`; UI: `AllegatoCfu{id,nomeFile,tipo,dimensioneByte,suggerimento}` | **parziale**: manca un record di documento con data, impronta ed esito di estrazione (aggiunto in contratto) |
| pagina / riga | `RiferimentoDocumento.pagina/riga/testo`, `RigaOcr{numero,confidenza}`, `PaginaOcr{documentId,pagina,righe}` | **sufficiente** |
| estratto vs normalizzato | `EsameCanonico` (estratto/dichiarato) vs `normalizzaEsame` + `MappaturaDatoNormalizzato{cfuGrezzo,cfuNormalizzato,ssdOrigine,ssdCanonico,gsd,tipoCodice,avvisi}` vs `DatiAccademiciNormalizzati{cfuNonValidi,codiciMancanti,anomalie}` | **sufficiente** |
| provenienza / confidenza / affidabilità | `Provenienza{confidenza 0..1, metodo}`, `EsameCanonico.affidabilita` (alta/media/bassa), confidenza per riga OCR, `confidenzaMediaFascicolo` | **sufficiente** (fonte) |
| dichiarato vs verificato | `FonteEsame` (`manuale`/`ocr-documento`/`testo-incollato`), `EsameCanonico.manualVerified` | **parziale**: nessuno stato esplicito; l'inferito non è distinguibile |
| non risolto / mancante | `DatiAccademiciNormalizzati.{cfuNonValidi,codiciMancanti,anomalie}`, `MappaturaDatoNormalizzato.cfuNormalizzato: null`, `identificazione.datiMancanti`, `AnalisiDeficit.cfuMancantiTotali: null`, stati `INSUFFICIENT_DATA`/`MANUAL_VERIFICATION_REQUIRED` | **sufficiente** (nessun "campo non risolto" esplicito: vedi §11) |
| titolo / esame / SSD / GSD / CFU / classe / istituzione / date | `TitoloAccademicoCanonico{denominazione,classe,classeLegacy,istituzione,paese,titoloEstero,dataInizio,dataLaurea,raw}`, `EsameCanonico{denominazione,cfu,voto,anno,ssd,ssdOrigine,gsd,fonte,affidabilita,manualVerified,provenienza}` | **sufficiente** |

**Conclusione**: 8 concetti su 9 sono già coperti; mancano solo lo **stato epistemico
esplicito** e il **contratto multi-documento** (con discrepanze). Nessun tipo nuovo è
stato creato dove un tipo esistente bastava (`Provenienza`, `RiferimentoDocumento`,
`EsameCanonico`, `TitoloAccademicoCanonico`, `FascicoloAccademicoCanonico` sono riusati).

## 3. Fonte (A) vs stato del dato (B)

Prima di questa fase la distinzione era solo implicita:

| Domanda | Rappresentazione precedente |
|---|---|
| A. Da dove viene? | `EsameCanonico.fonte` (canale), `Provenienza.metodo` (tecnica), `Provenienza.fonte` (documento/pagina/riga) |
| B. Che cosa sappiamo? | deducibile dal metodo: `manualVerified === true` ⇒ verificato; `metodo: 'ocr'` ⇒ estratto; `fonte: 'manuale'` ⇒ dichiarato; `metodo: 'normalizzazione'` ⇒ normalizzato; **inferito: non rappresentato**; assente: indistinguibile |

Modifica minima (solo contratto, additiva e retrocompatibile):

- nuovo vocabolario `StatoDato = 'dichiarato' | 'estratto' | 'normalizzato' | 'inferito' | 'verificato' | 'non-disponibile'`;
- `Provenienza.stato?: StatoDato` (assente ⇒ deducibile dal `metodo`: nessuna rottura);
- `Provenienza.campo?: string | null` (a quale campo si riferisce la provenienza);
- `Provenienza.nota?: string` (spiegazione del passaggio: regola di stima, revisione);
- `Provenienza.metodo` esteso con `'inferenza'`.

Regola d'uso: **`metodo` = come è stato ottenuto** (fonte/tecnica), **`stato` = cosa ne
sappiamo** (status). Sono indipendenti: un dato `estratto` può non essere `verificato`;
un dato `inferito` non è mai `verificato`.

## 4. Inferenza (stima)

Il contratto conserva tutti e cinque gli elementi richiesti, senza nuovi record:

| Elemento | Dove |
|---|---|
| valore | il campo stesso (es. `EsameCanonico.ssd`) |
| fonte/provenienza | `Provenienza` (per una stima: `fonte` assente o della riga che l'ha motivata) |
| status = inferito | `Provenienza.stato: 'inferito'` |
| confidenza | `Provenienza.confidenza` (0..1, segnale **qualitativo**) + `EsameCanonico.affidabilita` a fasce |
| metodo/spiegazione | `Provenienza.metodo: 'inferenza'` + `Provenienza.nota` (regola applicata) + `Provenienza.campo` |

Regole non negoziabili:

1. **Una stima non diventa mai verificata**: nessun percorso di codice imposta
   `manualVerified`; lo stato è per campo (`campo`), quindi un SSD stimato convive con
   una denominazione estratta.
2. **La confidenza è qualitativa**: mai probabilità di errore inventate; la UI deve
   parlare di «stima», non di «X% di errore».
3. **Le regole di stima non sono fonti normative**: vivono fuori dal database normativo e
   non possono produrre `ELIGIBLE` da sole; la verità normativa resta nei decreti/tabelle
   con Source Gate v2.
4. Il motore **deve** rispettare il livello di confidenza: gap dichiarato in §9 (oggi la
   valutazione non legge `stato`/`confidenza`); il contratto è pronto perché la policy sia
   una decisione esplicita della fase successiva.


## 5. Fascicolo multi-documento (modello concettuale minimo)

```
DossierAccademico                    (contratto §7 di resultTypes.ts)
├─ documenti: DocumentoCaricato[]    documentId, tipo, nome, formato, ricevutoIl,
│                                    pagine, improntaSha256, esitoEstrazione
├─ titoli:    TitoloAccademicoCanonico[]   uno o più titoli (con provenienza)
├─ esami:     EsameCanonico[]        fatti deduplicati: più Provenienza sullo stesso fatto
└─ discrepanze: DiscrepanzaDato[]    chiaveLogica, campo, valori[{valore,documentId,confidenza}], stato
```

Il **singolo documento** resta descritto da `FascicoloAccademicoCanonico` (uno per
documento: `documentId`, `esami`, `titolo?`, `pagineAnalizzate`, `estrattoIl`). Il
fascicolo utente è la loro aggregazione: nessuna nuova gerarchia, nessun contenitore di
contenuti (i file restano fuori dal motore).

Informazioni necessarie per **deduplica** e **discrepanze** (contratto, non algoritmo):

| Serve | Disponibile oggi | Note |
|---|---|---|
| identità logica del fatto (chiave) | **no** per gli esami (`chiaveLogicaRequisito` esiste per i REQUISITI, non per gli esami) | da produrre nel livello di ingresso: denominazione normalizzata + anno + SSD/GSD |
| più provenienze sullo stesso fatto | ✔ `EsameCanonico.provenienza[]` | un esame deduplicato ha una voce per documento |
| codice canonico + origine grezza | ✔ `ssd`/`gsd` + `ssdOrigine` | base del confronto |
| CFU grezzi e normalizzati | ✔ `MappaturaDatoNormalizzato.{cfuGrezzo,cfuNormalizzato}` | il grezzo non si perde |
| anno / periodo | ✔ `EsameCanonico.anno` | utile per distinguere esami omonimi |
| tipo documento, data, impronta | aggiunti ora (`DocumentoCaricato`) | servono anche per la retention |
| stato per campo + confidenza | aggiunti ora (`Provenienza.stato`/`campo`/`confidenza`) | permette di preferire l'evidenza verificata |
| criterio di preferenza fra fonti | **decisione di prodotto**, non ora | mai una scelta automatica: le divergenze restano visibili |
| chi/quando ha verificato | solo `manualVerified: boolean` | un audit completo richiederebbe `verificatoDa`/`verificatoIl`: rimandato |

Clausola anti-doppio-conteggio: la chiave logica va progettata **con** il solver
(l'unione dei crediti non deve contare due volte lo stesso esame), non a valle.

## 6. Documento originale vs fatto derivato

| Stadio | Tipo che lo rappresenta | Garanzia "l'originale non si perde" |
|---|---|---|
| ORIGINALE | file dell'utente + `DocumentoCaricato` (id, impronta, data) | il contenuto non entra nel motore; l'impronta identifica senza conservare |
| EVIDENZA | `Provenienza.fonte{page/line/testo}` + `EsameCanonico` | il testo grezzo della riga è conservato per il controllo umano |
| NORMALIZZATO | `normalizzaEsame` (copia) + `MappaturaDatoNormalizzato` | `ssdOrigine` e `cfuGrezzo` immutati; valori non validi → `null`/`cfuNonValidi` (mai corretti d'ufficio) |
| INFERITO | stesso record + `Provenienza{metodo:'inferenza', stato:'inferito', campo, nota}` | la stima è etichettata per campo e mai spacciata per evidenza |
| VERIFICATO | `manualVerified: true` (+ `stato: 'verificato'`) | solo un atto umano esplicito può promuovere un fatto |

`TitoloAccademicoCanonico.raw` conserva il payload originale del titolo; `EsameCanonico`
non viene mai mutato in place (le funzioni restituiscono copie: verificato dalla suite).

## 7. Provenienza del titolo: allineamento minimo

Prima: il titolo non aveva `provenienza`, `affidabilita` né un canale di origine → la
«provenienza per ogni fatto» richiesta dal fascicolo non era soddisfatta.
Modifica minima applicata: `TitoloAccademicoCanonico.provenienza?: Provenienza[]` (stessa
forma degli esami; il canale è dentro `metodo`, quindi **nessun** nuovo vocabolario e
nessun campo `fonte`/`affidabilita` aggiunto). Campo opzionale: i titoli già in uso
restano validi e sono trattati come «provenienza non dichiarata» (mai «verificata»).


## 8. Privacy e retention: hook architetturali (nessuna implementazione)

Promessa attuale (`shared/privacy.ts`): «Non salviamo i documenti caricati. Li
analizziamo in tempo reale e li eliminiamo.» — **un fascicolo persistente la
contraddice**: è una decisione di prodotto, non tecnica. Due opzioni coerenti:
(a) fascicolo di sessione (nessuna persistenza: la promessa resta valida);
(b) persistenza con consenso esplicito, informativa e retention dichiarata.

Hook già presenti o aggiunti ora (solo nomi, nessuna logica):

| Esigenza futura | Hook |
|---|---|
| conservare/eliminare il documento originale | `DocumentoCaricato.documentId` (chiave di eliminazione) + `ricevutoIl` (orologio di retention) + `improntaSha256` (identità senza contenuto) |
| stato del documento nel ciclo di vita | `DocumentoCaricato.esitoEstrazione` (`in-attesa`/`estratto`/`parziale`/`illeggibile`) |
| mantenere il fascicolo | `DossierAccademico{documenti,titoli,esami,discrepanze}` (+ `FascicoloAccademicoCanonico` per documento) |
| eliminare i dati derivati | ogni fatto punta alle proprie prove via `Provenienza.fonte.documentId`: eliminando un documento si eliminano/adattano le provenienze che lo citano e i fatti che restano senza prove diventano `non-disponibile` (nessun "fantasma") |
| mantenere la tracciabilità | `Provenienza` (per fatto e per campo) + `VoceAudit` (testo, senza contenuto personale) |

Regola assoluta: **i documenti degli utenti non sono mai una banca dati normativa.** Il
database normativo si alimenta solo da fonti pubbliche verificate (Source Gate v2 con
SHA-256); nessuna estrazione, nessuna statistica e nessun «apprendimento» da fascicoli
utente può diventare fonte di `ELIGIBLE`. Il contratto del motore non contiene alcun
identificativo dell'utente (privacy by design): il collegamento al profilo appartiene al
livello di ingresso.

## 9. Gap reali, modifiche minime e ciò che va rimandato

| # | Gap | Stato |
|---|---|---|
| 1 | stato epistemico non rappresentato (fonte ≠ status) | **risolto** (`StatoDato` + `Provenienza.stato`) |
| 2 | nessun canale per l'inferenza | **risolto** (`metodo: 'inferenza'`, `stato: 'inferito'`, `campo`, `nota`) |
| 3 | titolo senza provenienza | **risolto** (`TitoloAccademicoCanonico.provenienza?`) |
| 4 | fascicolo mono-documento, un solo titolo | **risolto come contratto** (`DossierAccademico`) |
| 5 | nessuna rappresentazione delle discrepanze | **risolto come contratto** (`DiscrepanzaDato`) |
| 6 | nessun record di documento con ciclo di vita | **risolto come contratto** (`DocumentoCaricato`) |
| 7 | `ssdOrigine` assorbe un codice STIMATO (normalizer) | **documentato** (test di caratterizzazione): l'origine diventa indistinguibile da un codice dichiarato; correzione possibile quando il motore leggerà `stato` |
| 8 | il solver ignora `stato`/`confidenza` | **documentato** (test di caratterizzazione): serve una policy di prodotto/motore («nessun esito positivo su fatti solo stimati») |
| 9 | nessun «campo non risolto» distinto da `NaN` | **documentato**: `cfu` è `number`; serve una decisione di rappresentazione |
| 10 | audit della verifica (chi/quando) | **rimandato**: oggi solo `manualVerified: boolean` |

**NON implementare ancora**: upload, OCR, parsing PDF, estrazione AI, storage dei
documenti, algoritmi di deduplica/discrepanza, retention/cancellazione, uso della
confidenza nel motore, migrazione dei consumatori, rimozione del solver legacy, nuovi
tipi di requisito, dati normativi derivati da documenti utente.

## 10. Rischi architetturali

1. **Promessa privacy vs fascicolo persistente** (rischio legale/prodotto): decidere prima
   di scrivere qualsiasi storage.
2. **Stima usata come fatto verificato** (rischio di verdetto non veritiero): il contratto
   è pronto, manca la policy del motore → non abilitare l'inferenza in produzione prima.
3. **`ssdOrigine` che assorbe la stima** (perdita di distinguibilità, gap 7).
4. **Deduplica mal definita** → doppio conteggio dei CFU (viola «unione senza doppio
   conteggio»): la chiave logica va progettata con il solver.
5. **Discrepanze risolte implicitamente** → viola «mai risolvere in autonomia»: la scelta
   di preferenza è una decisione, non un automatismo.
6. **Documenti utente nel database normativo**: divieto assoluto, da enunciare nel codice
   del livello di ingresso quando esisterà.
7. **Crescita del modulo foglia** (`resultTypes.ts` a 250 righe, limite del gate): al
   prossimo tipo va estratto `pipeline/dossierTypes.ts` (nota di manutenzione).
8. **Confidenza letta come «probabilità di errore»**: restare su scala qualitativa +
   `affidabilita` a fasce, come richiesto.

## 11. Verifica di questa fase

| Gate | Esito |
|---|---|
| `npm run typecheck` | ✅ 0 diagnostiche |
| `npm run lint` (`src/departments/cfu`) | ✅ 0 problemi |
| `npm test` | ✅ 22 suite (nuova: `dossierAccademicoContract`, 21 assert) |
| `npm run test:architettura` | ✅ nessuna violazione nuova |
| `npm run build` | ✅ |

## 12. Prossimo passo raccomandato

1. **Decisione di prodotto** su retention/persistenza del fascicolo (promessa privacy).
2. **Definire la chiave logica** degli esami (deduplica) e la policy di preferenza fra
   fonti, insieme al principio «nessun esito positivo basato solo su fatti stimati».
3. **Costruire il livello di ingresso** (ricezione → estrazione → evidenza → stima
   marcata → revisione umana) che produce `DossierAccademico` e alimenta la pipeline con
   gli stessi input canonici di oggi.
4. Solo dopo: abilitare l'uso di `stato`/`confidenza` nel motore e migrare i consumatori.

_Ultimo aggiornamento: fase 6 (audit del modello esistente + contratto Fascicolo Accademico; nessun upload/OCR implementato)._


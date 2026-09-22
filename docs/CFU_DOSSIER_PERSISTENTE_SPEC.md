# Fascicolo Accademico persistente — decisione di prodotto e politiche (Fase 6.5)

> **Stato**: AUDIT + DESIGN su decisione di prodotto. **Nessuna** funzione di upload,
> storage, OCR, estrazione AI, retention, anonimizzazione, deduplica o risoluzione
> automatica è stata implementata. Uniche modifiche di codice: **contratto dati**
> additivo (estratto in `engine/pipeline/dossierTypes.ts` + 3 campi opzionali di deduplica
> su `EsameCanonico`) e la suite di contratto aggiornata. Motore normativo, consumatori,
> solver legacy e UI: **invariati**.
>
> **Decisione di prodotto (contesto)**: Scuole Radar offre un **Fascicolo Accademico
> personale persistente** nel profilo: titoli, esami, CFU, SSD/GSD, certificazioni, altri
> documenti accademici e **documenti originali** caricati (consultabili e, in futuro,
> scaricabili). Il fascicolo vive nell'area **Modulistica** ed è la base riusabile per
> calcolo CFU, verifica requisiti, precompilazione/generazione documenti, abbinamento
> opportunità e futuri servizi formativi/affiliate.
> **Questa non è ancora l'implementazione legale GDPR/retention**: è il modello.

## 1. Modello concettuale del Dossier persistente

```
FASCICOLO ACCADEMICO PERSONALE (di un utente)          ← livello di ingresso / profilo
├─ documenti: DocumentoCaricato[]        DOCUMENTO ORIGINALE (file) — riferimento, non contenuto
│     documentId · tipo · nome · formato · ricevutoIl · pagine
│     improntaSha256 · esitoEstrazione · conservazione{originale|soli-dati}
├─ titoli: TitoloAccademicoCanonico[]    uno o più titoli (classe, istituzione, date, raw, provenienza)
├─ esami: EsameCanonico[]                fatti: denominazione, CFU, SSD/GSD, anno, voto,
│     codice · periodo · istituzione · provenienza[] (multi-fonte) · manualVerified
├─ certificazioni                        attestati di ente (lingua, informatica, abilitazioni…)
│     oggi: documento di tipo `certificazione`; il record strutturato è rimandato (§10)
└─ discrepanze: DiscrepanzaDato[]        chiaveLogica · campo · valori[] (con documento+confidenza)
      stato{non-risolta|risolta}         mai risolte automaticamente

CONTESTO PER FATTO (Provenienza, per campo)
stato ∈ {dichiarato, estratto, normalizzato, inferito, verificato, non-disponibile}
metodo ∈ {ocr, testo-incollato, manuale, normalizzazione, riconoscimento, inferenza}
confidenza 0..1 (qualitativa) · fonte{documentId,pagina,riga,testo} · campo · nota
```

**Regola di lettura (contratto, non codice)**: lo stato di un *campo* è quello della
provenienza **più forte** presente (`verificato` > `dichiarato` > `normalizzato` >
`estratto` > `inferito` > `non-disponibile`); l'elenco completo conserva tutta la storia
del fatto. Nessuna provenienza viene mai eliminata quando se ne aggiunge una.

## 2. Documento originale vs dati derivati vs Dossier

| | Che cos'è | Dove vive | Chi lo possiede |
|---|---|---|---|
| **Documento originale** | il file caricato dall'utente (PDF/immagine) | **fuori dal motore** (storage del livello di ingresso) | utente; il motore ne ha solo il riferimento `DocumentoCaricato` |
| **Dato derivato** | evidenza estratta, fatto normalizzato, stima, verifica | `EsameCanonico` / `TitoloAccademicoCanonico` + `Provenienza` | utente; prodotto dal livello di ingresso |
| **Dossier** | rappresentazione **strutturata e riusabile** dei dati derivati (+ riferimenti ai documenti) | `DossierAccademico` | utente; consumata da CFU/verifica/precompilazione |

Cancellazione futura (non implementata): eliminare un documento significa
(a) eliminare il file, (b) impostare `conservazione: 'soli-dati'` oppure rimuovere il
riferimento, (c) **mantenere** i dati che la policy consente di conservare, (d) aggiornare
le provenienze che citano quel `documentId` — mai lasciare «prove fantasma»: un fatto che
resta senza evidenza fisica deve risultare `non-disponibile` o essere riclassificato.
Nessuna gerarchia automatica fra documenti, nessuna cancellazione silenziosa di derivati.

## 3. Politica di inferenza (stima)

**Un'inferenza può**: suggerire una corrispondenza, proporre una correlazione, aiutare
l'utente, evidenziare un campo potenzialmente mancante.
**Un'inferenza non può**: diventare automaticamente un fatto verificato, entrare nel
database normativo, generare un esito definitivo da sola.

Ciclo di vita del campo (esempio: «Storia moderna — 6 CFU», SSD assente):

| Fase | Rappresentazione | Effetto sull'esito normativo |
|---|---|---|
| 1. Proposta | `ssd` valorizzato + `Provenienza{metodo:'inferenza', stato:'inferito', campo:'ssd', confidenza, nota:'regola X'}`; nell'UI: «Possibile SSD: M-STO/02 (stima)» | il motore **non** deve trattarla come dichiarata/verificata → richiede conferma umana (§4) |
| 2a. L'utente **conferma** | si **aggiunge** `Provenienza{metodo:'manuale', stato:'dichiarato', campo:'ssd', nota:'conferma su proposta'}`; `manualVerified` resta assente | il fatto è dichiarato dall'utente: entra nel calcolo come dato dichiarato, ma **non** è «verificato» |
| 2b. L'utente **corregge** | la stima resta tracciata (`inferito`) e si aggiunge la provenienza corretta (`dichiarato`, o `estratto` se fornisce un documento) | come 2a |
| 3. Verifica (futura) | `Provenienza{stato:'verificato'}` + `manualVerified: true`, con provenienza di chi/quando | unico caso in cui il fatto è «verificato» |

`verificato` è quindi **riservato** a un controllo su evidenza o a un'atto di autorità;
la conferma dell'utente è `dichiarato`. Nessun automatismo promuove `inferito` →
`dichiarato`/`verificato` (verificato dalla suite di contratto).

## 4. Inferenza DECISIVA (quando la stima cambia l'esito normativo)

Caso: un requisito chiede proprio `M-STO/02`, il documento non lo riporta, il sistema
stima `M-STO/02`.

Regola (conservativa sulla verità):

1. **Non può produrre un esito positivo definitivo.** Un fatto con provenienza più forte
   `inferito` non può sostenere `ELIGIBLE`: la stima non è un dato dichiarato né verificato.
2. **Deve attivare la richiesta di verifica manuale.** Se il fatto stimato è *decisivo*
   (cioè senza di esso il requisito non è soddisfatto), l'esito della valutazione resta
   non definitivo: `MANUAL_VERIFICATION_REQUIRED`, con il requisito e il campo stimato
   indicati nell'audit e nelle `escalations`.
3. **Motore**: la modifica è **rimandata** (decisione di prodotto/policy): oggi
   `strategies`/`solver` non leggono `stato`/`confidenza`, quindi la stima entrerebbe nel
   calcolo come se fosse dichiarata. La suite di contratto **documenta** questo
   comportamento attuale come gap dichiarato, così il cambiamento sarà esplicito.
4. **Interfaccia (futura)**: la distinzione deve essere visibile all'utente:
   - «Requisito soddisfatto solo se l'SSD stimato è corretto → conferma o correggi»
   - mai «idoneo» e mai «non idoneo» su una stima non confermata; se l'utente conferma,
     resta comunque `dichiarato` (esito *condizionato alla veridicità della dichiarazione*),
     mentre la verifica su evidenza è ciò che abilita un esito pieno.

Sintesi a tre livelli: **stimato** → mai esito positivo definitivo; **dichiarato** →
esito ammesso ma tracciato come dichiarazione dell'utente; **verificato** → esito pieno.

## 5. Extraction Knowledge Layer (futuro, non implementato)

Possibilità futura: accumulare **statistiche anonime** sui documenti per migliorare
l'estrazione (strutture dei transcript per ateneo, abbreviazioni ricorrenti, correlazioni
nome insegnamento → SSD, formati CFU, layout).

**Posizione nell'architettura**: un modulo **fuori dal motore normativo** e **fuori dal
fascicolo personale**, alimentato *solo* da dati anonimizzati/aggregati, in sola lettura
rispetto a esso:

```
FASCICOLO PERSONALE ──(anonimizzazione, irreversibile)──► OSSERVAZIONI AGGREGATE
        │                                                        │
        │                                                        ▼
        │                                        EXTRACTION KNOWLEDGE LAYER
        │                                        (pattern di estrazione, suggerimenti)
        │                                                        │
        ▼                                                        ▼
  MOTORE CFU (autorità) ◄── dati canonici ── SUGGERIMENTI (sempre `inferito`, confidenza, spiegazione)
                                                         │
                                          MAI: fonte normativa, MAI fatto verificato
```

**Dati minimi che dovrebbe ricevere** (per osservazione, nessun dato personale, nessun
documento, nessun identificativo): tipo di documento e ateneo (o anonimizzati), testo
normalizzato del campo (es. denominazione insegnamento), codice osservato (SSD/GSD),
formato CFU, esito dell'estrazione (ok/parziale/illeggibile), eventuale conferma o
correzione dell'utente come *contatore* (non come contenuto), data/versione del modello.

**Regole non negoziabili**: non è una fonte normativa; non modifica le regole del motore
CFU; non trasforma la frequenza osservata in una regola; non sostituisce le fonti
ufficiali; non produce mai un fatto verificato; i suoi output sono **suggerimenti**
(`stato: 'inferito'`, con confidenza e spiegazione «dedotto da documenti simili»).

## 6. Separazione: Dossier personale ≠ Knowledge Layer ≠ Database normativo

| | Contenuto | Legame con l'utente | Uso | Può diventare norma? |
|---|---|---|---|---|
| **Dossier personale** | titoli, esami, CFU, SSD/GSD, certificazioni, documenti, provenienze | **sì** (profilo dell'utente) | calcolo CFU, verifica requisiti, precompilazione, abbinamento | **NO** |
| **Knowledge Layer di estrazione** | pattern anonimi/aggregati di estrazione | **no** (irreversibile) | migliorare estrazione e suggerimenti (`inferito`) | **NO** |
| **Database normativo** | decreti/tabelle con estratti verbatim e SHA-256 (Source Gate v2) | **no** | unica fonte di `ELIGIBLE` | sì, ma solo da fonti pubbliche ufficiali |

Frecce ammesse: Personale → (anonimizzazione) → Knowledge; Normativo → motore;
Knowledge → suggerimenti (`inferito`) → Personale. Frecce **vietate**: Personale →
Normativo, Knowledge → Normativo, Personale/Knowledge → regole del motore.
Divieto assoluto: i documenti degli utenti non alimentano mai il database normativo.

## 7. Discrepanze

Regola: se due documenti riportano valori diversi (Doc A: 6 CFU, Doc B: 9 CFU) e nessuna
regola documentata stabilisce la preferenza:

1. **si conservano entrambe le evidenze** (`DiscrepanzaDato.valori[]`, ciascuna con
   `documentId` e confidenza);
2. **si rappresenta la discrepanza** (`stato: 'non-risolta'`), con chiave logica e campo;
3. **non si sceglie arbitrariamente**: nessuna gerarchia automatica di fonti;
4. **si chiede all'utente di risolvere** quando la discrepanza è rilevante per l'esito;
   la decisione diventa una provenienza (`dichiarato`, con nota) e `stato: 'risolta'`,
   **mantenendo** i valori originali (la storia non si cancella).


## 8. Deduplica: requisiti minimi

> **Approfondimento (fase 6.7)**: definizione dell'**identità semantica dell'esame**,
> classificazione degli attributi, analisi di 13 casi, confine della deduplica e
> invariante anti-doppio-conteggio in **`docs/CFU_IDENTITA_ESAME_SPEC.md`**. Qui restano i
> requisiti minimi e le ambiguità di primo livello.

Per riconoscere che due documenti descrivono **lo stesso** esame servono (contratto):

| Segnale | Nel modello | Ambiguità da trattare esplicitamente |
|---|---|---|
| denominazione normalizzata | `denominazione` (+ normalizzazione lessicale nel livello di ingresso) | omonimie («Storia moderna» vs «Storia contemporanea»); abbreviazioni di ateneo |
| CFU | `cfu` (+ `cfuGrezzo` in mappatura) | 6 vs 9 può essere discrepanza **o** due esami diversi (annuale/semestrale) |
| SSD/GSD | `ssd`, `gsd`, `ssdOrigine` | SSD assente in un documento e presente nell'altro (stima vs evidenza) |
| anno / periodo | `anno`, `periodo` (nuovo) | cicli diversi con stesso nome; «1° semestre» non sempre presente |
| codice insegnamento | `codice` (nuovo) | codici cambiano fra ordinamenti; il codice può mancare del tutto |
| istituzione | `istituzione` (nuovo) | carriere miste (trasferimenti): stesso esame verbalizzato in due atenei |
| provenienze multiple | `provenienza[]` | un fatto deduplicato porta una voce per documento (nessuna fusione distruttiva) |

Combinazioni **da trattare come ambigue** (nessuna fusione automatica): stessa
denominazione con CFU diversi; stessa denominazione senza SSD e con SSD diverso; stesso
codice con anno/periodo diversi; stessa denominazione senza codice e senza anno; esami
identici in atenei diversi (possibile duplicazione di carriera, non di esame).
Rischi speculari: fusione troppo aggressiva → **esame perso**; fusione troppo timida →
stesso esame contato due volte (**CFU gonfiati**). La chiave logica va progettata **con**
il solver, non a valle.

## 9. Allineamento con la monetizzazione

Catena prevista: `Dossier → CFU → Opportunità → Modulistica → Precompilazione → Formazione/Affiliate`.
Verifica architetturale (nessuna modifica richiesta):

- il **motore CFU** riceve solo dati canonici + regole normative e non conosce utente,
  pagamenti, opportunità o servizi: nessun incentivo commerciale può entrare nelle regole;
- il **Dossier** è una base riusabile (`DossierAccademico`), senza dipendenze dalla catena
  commerciale;
- la **precompilazione** usa i dati derivati con la loro provenienza: un dato `inferito`
  non deve essere stampato come se fosse verificato (etichettatura obbligatoria);
- **opportunità/affiliate**: il matching usa dati del fascicolo (classi, titoli, CFU)
  **fuori** dal motore normativo.

Regola: la verità normativa e l'etichettatura della provenienza non si piegano mai a fini
di conversione o vendita.


## 10. Revisione della promessa privacy (`shared/privacy.ts`) — nessuna modifica ora

Testo attuale: «Non salviamo i documenti caricati. Li analizziamo in tempo reale e li
eliminiamo. Per fare di nuovo questa operazione dovrai inviare di nuovo i documenti.»

**Frasi che diventeranno incompatibili con il fascicolo persistente**

1. «Non salviamo i documenti caricati» → l'utente potrà conservare e scaricare gli originali.
2. «li eliminiamo» → documenti e dati derivati resteranno nel profilo.
3. «Per fare di nuovo questa operazione dovrai inviare di nuovo i documenti» → non più
   vero: il fascicolo è riusabile.

**Cosa dovrà essere chiarito all'utente** (testo futuro, non ora)

- cosa viene conservato (originali? dati derivati? entrambi?), per quanto, con quale base
  giuridica e consenso (conservazione vs trattamento per miglioramento);
- differenza fra **dichiarato**, **estratto**, **stimato** e **verificato** e cosa comporta
  ciascuno nell'esito;
- possibilità di eliminare un singolo documento conservando i derivati
  (`conservazione: 'soli-dati'`) e come questo incide sull'esito;
- uso di **statistiche anonime** aggregate per migliorare l'estrazione (irreversibilità) e
  cosa **non** ne deriva (nessuna regola normativa).

**Decisioni che richiederanno verifica legale**

- base giuridica e consenso per conservare documenti accademici (attenzione a dati che
  possano rivelare condizioni personali particolari);
- retention, cancellazione su richiesta (diritto all'oblio), export/portabilità e tenuta
  dell'audit delle verifiche;
- ruoli privacy (titolare/responsabile), luogo e cifratura dello storage, log di accesso,
  eventuale DPIA per trattamento sistematico di documenti;
- processo di anonimizzazione del Knowledge Layer e sua **irreversibilità** dimostrabile;
- informativa e consenso specifico per la catena commerciale (formazione/affiliate).

## 11. Adeguamenti minimi di contratto (fatti in questa fase)

| # | Adeguamento | Perché è necessario ora |
|---|---|---|
| 1 | `DocumentoCaricato.conservazione: 'originale' \| 'soli-dati'` | rende rappresentabile «elimino il file, conservo i derivati» senza prove fantasma (§2) |
| 2 | `TipoDocumento` + `'certificazione'` | la decisione di prodotto prevede certificazioni accanto a libretti e certificati di laurea (§1) |
| 3 | `EsameCanonico.codice?`, `.periodo?`, `.istituzione?` | input di deduplica richiesti esplicitamente (§8); opzionali, nessun impatto |
| 4 | `DiscrepanzaDato.stato: 'non-risolta' \| 'risolta'` | rappresenta la decisione dell'utente mantenendo intatte le evidenze (§7) |
| 5 | Contratto del dossier estratto in `engine/pipeline/dossierTypes.ts` | il modulo foglia era al limite di dimensione del gate; il dossier è un contratto di livello superiore (nota di manutenzione prevista in fase 6) |
| 6 | Semantica documentata (non codice): `verificato` riservato a evidenza/autorità; conferma utente ⇒ `dichiarato`; stato del campo = provenienza più forte | senza questa regola la conferma dell'utente diventerebbe implicitamente «verifica» (§3) |

Nessun altro cambiamento: motore normativo, `valutaRequisitoClasse`, bridge, routing,
report, UI e dati normativi restano identici.

## 12. Cosa NON è stato implementato (vincoli rispettati)

Upload, storage/DB documenti, OCR, estrazione AI, retention/cancellazione, anonimizzazione,
Knowledge Layer, deduplica automatica, risoluzione automatica delle discrepanze, uso di
`stato`/`confidenza` nel motore, migrazione dei consumatori, rimozione del solver legacy,
nuove regole normative.

## 13. Prossimo passo raccomandato

1. **Revisione legale/privacy** (§10) e decisione su persistenza, retention e consenso:
   prerequisito a qualsiasi storage.
2. **Progettare la chiave logica di deduplica** con il solver e la policy di preferenza fra
   fonti (§8, §7).
3. **Livello di ingresso**: ricezione → estrazione → evidenza → stima marcata → revisione
   umana → `DossierAccademico` → pipeline (input canonici invariati).
4. **Policy del motore sulle stime decisive** (§4): «nessun esito positivo definitivo su
   fatti solo stimati», poi migrazione dei consumatori.

_Ultimo aggiornamento: fase 6.5 (decisione di prodotto: fascicolo persistente; nessuna implementazione di upload/storage/retention)._


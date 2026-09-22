# Identità semantica di un esame accademico — design (Fase 6.7)

> **Stato**: DESIGN ONLY. Non implementati (e non richiesti in questa fase): upload, OCR,
> parsing PDF, estrazione AI, database/storage, deduplica automatica, risoluzione
> automatica delle discrepanze, UI, migrazione consumatori, migrazione solver, GDPR.
>
> **Unica modifica di codice**: un tipo additivo (`AmbiguitaIdentita`) + un campo in
> `DossierAccademico` e le relative asserzioni di contratto. Motivazione e alternative in
> §12. Motore normativo, solver, consumatori e dati normativi: **invariati**.
>
> Riferimenti: `docs/CFU_FASCICOLO_ACCADEMICO_SPEC.md` (modello e provenienza),
> `docs/CFU_DOSSIER_PERSISTENTE_SPEC.md` (fascicolo persistente, politiche, dedup §8),
> `docs/CFU_STATUS_AGGREGATION_SPEC.md` (stati R0-R10).

## 1. Principio: due domande separate

| | Domanda | Chi la tratta | Cosa produce |
|---|---|---|---|
| **A** | «Le due evidenze si riferiscono allo stesso evento didattico?» | **deduplica** | associazione evidenze ↔ **fatto logico** (o astensione) |
| **B** | «Quale valore è corretto?» | **risoluzione della discrepanza** | decisione sul valore, con tracciabilità |

Regole non negoziabili:

1. una decisione di deduplica **non sovrascrive, non scarta e non altera** l'evidenza
   originale: il valore grezzo di ogni documento resta nella sua provenienza;
2. se due evidenze sono associate allo stesso fatto ma **non concordano** (CFU, SSD, anno,
   codice…), si **conservano entrambi i valori** e si rappresenta la discrepanza;
3. l'associazione (A) e la scelta del valore (B) possono avvenire in momenti diversi e con
   esiti diversi: associare non significa decidere.

## 2. Definizione minima di identità (nessun punteggio numerico)

```
IDENTITÀ(esame) := AMBITO(istituzione, corso/titolo di appartenenza)
                 ∧ SEGNALE DISTINTIVO(codice insegnamento ∨ denominazione distintiva)
                 ∧ COERENZA(anno accademico)
```

- **AMBITO** delimita l'universo in cui il confronto ha senso: due esami in atenei diversi
  (o in corsi di laurea diversi) appartengono ad ambiti diversi → fatti diversi.
- **SEGNALE DISTINTIVO**: il codice dell'insegnamento (forte entro ambito+ordinamento) o,
  in mancanza, una denominazione **non generica** normalizzata.
- **COERENZA(anno)**: l'anno corrobora; se differisce cambia la classificazione
  (ripetizione vs cicli diversi) e serve revisione.
- **I valori normativi non sono identità**: `cfu`, `ssd`/`gsd` e `voto` sono *valori da
  verificare* e possono legittimamente divergere su uno stesso esame.

Esiti possibili della deduplica: **SAME_FACT** (con eventuali discrepanze),
**DIFFERENT_FACTS**, **AMBIGUOUS → REQUIRE REVIEW**.

## 3. Classificazione degli attributi

| Attributo | Classe | Perché |
|---|---|---|
| `denominazione` **normalizzata e distintiva** | **FORTE** | segnale principale quando il codice manca |
| `denominazione` normalizzata **generica** | **DEBOLE** («Laboratorio», «Tirocinio»…) | non identifica: serve revisione |
| `denominazione` **grezza** | **DESCRITTIVO** | vive in `Provenienza.fonte.testo`: serve al controllo umano |
| `codice` (insegnamento/verbalizzazione) | **FORTE** entro ambito+ordinamento | emesso dall'ateneo; può mancare o cambiare con i regolamenti |
| `istituzione` | **FORTE (di ambito)** | identità *scoped*: atenei diversi ⇒ fatti diversi |
| corso/titolo di appartenenza | **FORTE (di ambito)** | stesso ateneo, corsi diversi ⇒ fatti diversi |
| `anno` accademico | **MEDIO** | distingue cicli; una ripetizione cambia anno |
| `periodo` (semestre/sessione) | **DEBOLE** | spesso assente; non necessario all'identità |
| data di verbalizzazione | **DEBOLE** | utile per le ripetizioni, non decisiva |
| `ssdOrigine` (testo grezzo) | **DEBOLE** | varianti di scrittura |
| `voto` | **DESCRITTIVO** (e indizio di ripetizione) | mai identità |
| `provenienza`/`fonte`/`documentId`/`pagina`/`riga` | **DESCRITTIVO / di scoping** | distingue «stesso documento due volte» |
| `affidabilita`, `confidenza`, `stato`, `manualVerified`, `conservazione` | **QUALITÀ** | descrivono l'evidenza, non l'identità |
| **`cfu`** | **VALORE DA VERIFICARE — NON SICURO COME IDENTITÀ** | è il campo che più spesso confligge: non può decidere da solo né la fusione né la separazione |
| **`ssd`/`gsd`** | **VALORE DA VERIFICARE — NON SICURO COME IDENTITÀ** | può mancare in un documento, differire, o essere **stimato**: identico e con evidenza *corrobora*, diverso non separa |

## 4. I 13 casi, con esito concettuale

| # | Caso | Esito | Perché |
|---|---|---|---|
| 1 | stesso nome + stesso ateneo + stesso anno + stessi CFU | **SAME_FACT** | ambito e segnale coerenti, valori coerenti |
| 2 | stesso nome + stesso ateneo + CFU diversi | **SAME_FACT + DISCREPANZA (cfu), non risolta** | i CFU sono un valore da verificare, non identità; se la differenza è strutturale (6 vs 12 = semestrale/annuale) *e* anno/periodo differiscono → **AMBIGUOUS → REVIEW** |
| 3 | stesso nome + anno diverso | **AMBIGUOUS → REVIEW** | può essere ripetizione, due cicli o due corsi omonimi: l'evidenza non basta |
| 4 | stesso nome + stesso anno + SSD diverso | **SAME_FACT + DISCREPANZA (ssd), non risolta** | l'SSD è un valore da verificare (spesso trascritto male o stimato) |
| 5 | stesso nome + SSD assente in un documento | **SAME_FACT** | valore assente ≠ conflitto; il valore noto resta con la **sua** provenienza, nell'altro documento il campo è `non-disponibile` |
| 6 | stesso codice + nome diverso | **AMBIGUOUS → REVIEW** | rinomina del corso (nuovo ordinamento) vs riuso del codice |
| 7 | stesso codice + anno diverso | **AMBIGUOUS → REVIEW** | stessa verbalizzazione in anni diversi vs codice riusato |
| 8 | stesso nome + stessi CFU + ateneo diverso | **DIFFERENT_FACTS** | ambito diverso: due esami distinti (carriera mista/trasferimento). Solo una dichiarazione esplicita dell'utente può associarli, e resta una decisione tracciata |
| 9 | stesso esame su transcript e certificato di laurea | **SAME_FACT** | il certificato riepiloga la carriera: due **provenienze** dello stesso fatto, nessuna gerarchia di fonte |
| 10 | stesso esame più volte **nello stesso documento** | **AMBIGUOUS → REVIEW** | artefatto di estrazione (riga duplicata) vs doppia verbalizzazione: non si conta due volte e non si scarta una riga |
| 11 | esame ripetuto / rifatto | **AMBIGUOUS → REVIEW** | numero di tentativi e voto valido sono una **decisione di dominio** non ancora presa: entrambe le evidenze restano, nessun CFU sommato |
| 12 | esami senza codice | dipende dagli altri segnali: nome distintivo + ambito/anno coerenti → **SAME_FACT**; nome generico → **AMBIGUOUS → REVIEW** | il codice è forte ma non obbligatorio |
| 13 | nomi generici («Laboratorio», «Tirocinio», «Lingua inglese»…) | **AMBIGUOUS → REVIEW** | un nome generico non è mai un segnale identificativo (l'elenco dei nomi generici è una decisione di prodotto, §11) |

## 5. Modello delle provenienze multiple

```
UNA rappresentazione canonica      EsameCanonico (valori usati nella valutazione)
+ N documenti sorgente             Provenienza.fonte.documentId
+ N voci di provenienza            {fonte{pagina,riga,testo}, metodo, confidenza, stato, campo, nota}
+ valori grezzi mai cancellati     provenienza[].fonte.testo · ssdOrigine · MappaturaDatoNormalizzato.cfuGrezzo
```

- **Provenienze coerenti** (Doc A e Doc B dicono la stessa cosa) → *un fatto, N provenienze,
  nessuna discrepanza*: è solo corroborazione, e non alza di per sé lo stato a `verificato`.
- **Provenienze divergenti su un valore** (6 vs 9 CFU) → *un fatto (se l'identità è
  stabilita), N valori concorrenti* → `DiscrepanzaDato{campo:'cfu', valori[], stato:'non-risolta'}`.
- **Divergenza sull'identità** (non si può decidere se è lo stesso esame) → **nessuna
  associazione**: le evidenze restano fatti separati e l'incertezza è rappresentata in
  `ambiguitaIdentita` (§12), così che non diventi né una fusione silenziosa né un doppio
  conteggio silenzioso.
- Il valore canonico usato nella valutazione **non cancella** i valori originali: ogni
  campo conserva la propria storia di provenienza e una eventuale stima resta `inferito`.

## 6. Confine della deduplica

| Può | Non può |
|---|---|
| associare più evidenze a un unico fatto logico | scegliere quale valore è corretto |
| mantenere N provenienze (una per documento) | creare verità normativa (nessun effetto sulle regole) |
| dichiarare l'astensione (`AmbiguitaIdentita`) | scartare, sovrascrivere o alterare un'evidenza |
| registrare il motivo dell'astensione in chiaro | stabilire una gerarchia universale di fonti (§9) |
| lasciare separati i fatti quando l'identità non è decidibile | fondere silenziosamente due esami distinti |

## 7. Invariante anti-doppio-conteggio

> **Lo stesso esame accademico logico non deve mai contribuire con i propri CFU più di una
> volta a un calcolo normativo.**

Come si garantisce (futuro livello di ingresso):

1. al motore si fornisce **un fatto canonico per esame logico**, con tutte le evidenze
   allegate come provenienze: l'unione dei crediti del solver conta allora ogni fatto una
   volta sola;
2. finché esistono **ambiguità di identità non risolte** o **discrepanze non risolte**, o un
   valore **stimato su un campo decisivo**, l'elenco dei fatti **non è definitivo**: l'esito
   non può essere pubblicato come certo (politica di fase 6.5 §4, estesa qui all'identità);
3. **oggi il motore conta ogni esame che riceve** (non legge `stato`, `confidenza`,
   `chiaveLogica`): fino alla migrazione del solver l'invariante è responsabilità del
   livello di ingresso, che non deve consegnare un insieme ambiguo come se fosse finale.
   Nessuna modifica al solver in questa fase.


## 8. Esami ripetuti / rifatti: quattro situazioni distinte

| Situazione | Semantica | Esito |
|---|---|---|
| **stesso esame su documenti diversi** | una carriera descritta da più documenti | **SAME_FACT**, N provenienze |
| **stesso esame ripetuto nello stesso documento** | riga duplicata (artefatto di estrazione) **oppure** doppia registrazione | **AMBIGUOUS → REVIEW** (mai contare due volte, mai scartare) |
| **esame rifatto (retake)** | stesso esame sostenuto più volte, voti/date diversi | **AMBIGUOUS → REVIEW**: decidere quanti tentativi contano e quale voto vale è una regola di dominio non ancora presa; nessun CFU sommato |
| **due corsi distinti con nome identico** | stesso ateneo, corsi/periodi diversi, oppure SSD diversi | ambito diverso ⇒ **DIFFERENT_FACTS**; ambito uguale e segnali insufficienti ⇒ **AMBIGUOUS → REVIEW** |

Regola trasversale: **la ricomparsa di un esame non è mai prova di CFU ripetuti**, e la
scomparsa di una riga non è mai una pulizia automatica.

## 9. Nessuna gerarchia di fonti

Vietato introdurre (in questa fase e come automatismo implicito):
`certificato > transcript > autodichiarazione > OCR > inserimento manuale`.
`affidabilita`, `confidenza`, `conservazione` e `stato` sono **metadati descrittivi**, non un
ordine di precedenza. Se in futuro servisse una preferenza, dovrà essere:

1. una **decisione di prodotto/dominio esplicita e documentata** (non dedotta dal tipo di
   documento);
2. tracciata come decisione (`Provenienza{dichiarato, nota}`), con l'evidenza alternativa
   comunque conservata;
3. visibile all'utente (cosa è stato preferito e perché).
Per questa fase: **le evidenze concorrenti si conservano tutte**.

## 10. Contratto futuro livello di ingresso → motore

**Precondizioni che il livello di ingresso dovrà garantire** (il motore resta invariato):

1. **un solo fatto per esame logico** in `esami` (deduplica fatta o astensione dichiarata);
2. ogni fatto porta **tutte** le proprie evidenze in `provenienza[]`, con
   `fonte{documentId,pagina,riga,testo}`, `metodo`, `confidenza`, `stato`, `campo`, `nota`;
3. **i valori stimati restano `inferito`** (mai presentati come dichiarati o verificati);
4. **le discrepanze restano visibili** (`discrepanze[]`) e nessun valore scelto viene
   presentato come certo;
5. **le ambiguità di identità restano visibili** (`ambiguitaIdentita[]`, `da-rivedere`);
6. **nessuna verità normativa creata a monte**: solo valori; le regole continuano a
   venire esclusivamente dal database normativo con Source Gate v2.

**Politica futura del motore (rimandata, non implementata ora)**: ambiguità di identità
aperta, discrepanza non risolta o stima su un campo decisivo ⇒ esito **non definitivo**
(`MANUAL_VERIFICATION_REQUIRED`), mai un verdetto positivo silenzioso. È l'estensione a
«identità» della regola già definita in fase 6.5 per le stime decisive.

## 11. Decisioni ancora aperte

1. **CFU diversi + stesso nome/ateneo**: associare con discrepanza (proposta di questo
   documento) o trattare come identità ambigua? Serve conferma di prodotto.
2. **Esami rifatti**: un fatto con più tentativi (e quale voto vale) o due fatti distinti?
3. **Atenei diversi, stesso nome/esame**: esiste un caso legittimo di «stesso esame»
   (trasferimento/erasmus) da associare automaticamente? O sempre decisione dell'utente?
4. **Nomi generici**: elenco dei nomi considerati non identificativi (e chi lo mantiene).
5. **Ripetizione nello stesso documento**: come distinguere artefatto di estrazione da
   doppia verbalizzazione (euristiche? revisione sempre?).
6. **Preferenza di fonte**: se mai necessaria, quale decisione di dominio la giustifica.
7. **Chi revisiona** le ambiguità (utente o operatore) e come si traccia (chi/quando) —
   oggi solo `manualVerified: boolean`.
8. **Esito della revisione** di un'ambiguità: come rappresentare «risolta come stesso
   esame» / «risolta come esami distinti» (oggi: `stato` + fatti risultanti).
9. **Codice insegnamento**: ambito di validità (ateneo? corso? ordinamento?) e sua
   normalizzazione.
10. **Chiave logica canonica**: se e quando esporla sul fatto (`EsameCanonico`) e se il
    motore dovrà leggerla per un controllo difensivo anti-duplicazione.

## 12. Adeguamento di contratto necessario? Sì, minimo

Con il contratto precedente l'ambiguità di identità **non era rappresentabile**: le uniche
opzioni erano (a) fondere le evidenze (associazione silenziosa, vietata) o (b) tenerle
separate senza segnalarlo (doppio conteggio silenzioso, vietato dall'invariante §7).
Adeguamento applicato (additivo, nessuna logica):

| # | Adeguamento | Perché |
|---|---|---|
| 1 | `AmbiguitaIdentita{chiaveLogica, evidenze[], motivo, stato:'da-rivedere'\|'risolta'}` in `engine/pipeline/dossierTypes.ts` | rappresenta «forse lo stesso esame, non decidibile» con le evidenze elencate e il motivo in chiaro |
| 2 | `DossierAccademico.ambiguitaIdentita` (elenco, come le altre collezioni) | finché non è vuoto l'elenco dei fatti non è definitivo |
| 3 | Asserzioni di contratto (`dossierAccademicoContract`: 30 assert) | congela la regola: ambiguità rappresentata, entrambe le evidenze conservate |

**Alternativa valutata e scartata**: riusare `DiscrepanzaDato` con `campo:'identita'`.
Scartata perché confonde un **conflitto di valore** su un fatto associato con una
**questione di identità** (associazione non ancora decisa) — due problemi con cicli di vita,
responsabili e conseguenze diverse.

Nessun altro cambiamento: motore normativo, `valutaRequisitoClasse`, bridge, routing,
report, UI, seeds e dati normativi sono rimasti identici (nessuna migrazione).

_Ultimo aggiornamento: fase 6.7 (identità semantica dell'esame: principi, 13 casi, confine della deduplica, contratto futuro; solo un tipo additivo)._


# Specifica dell'aggregazione di stato — autorità interna della pipeline (Fase 4-5)

> **Stato**: IMPLEMENTATA. Unica definizione formale dell'algoritmo:
> `engine/pipeline/status.ts` (regole R0-R10) con il contratto/vocabolario in
> `engine/pipeline/statusTypes.ts`. Nessuna copia dell'algoritmo vive nei test:
> le suite esercitano il codice di produzione.
>
> **Confine di autorità (deliberato in fase 4, invariato in fase 5)**
> - DENTRO la pipeline: `RisultatoPipeline.stato` è l'aggregazione autorevole
>   (R0-R10). I fatti usati sono FATTI DI REQUISITO (natura, integrabilità, rami
>   della disgiunzione) e FATTI DI CONTESTO (conflitti, causa del contesto non
>   risolto): nessuna deduzione dalle regole applicabili (fase 5 — A5).
> - FUORI dalla pipeline: il verdetto usato da bridge, routing, report e UI resta
>   `valutaRequisitoClasse` (`engine/requirementSolver.ts`), esposto come
>   `RisultatoPipeline.statoSolutore` / `valutazioneClasse.stato`.
> - Nessun consumatore legacy è commutato: dove le due viste divergono la
>   divergenza è DICHIARATA in `escalations` e verificata da
>   `statusAuthorityDivergences.test.ts`.
>
> **Suite di riferimento**: `statusTruthTable.test.ts` (matrice, 26 casi),
> `statusInvariants.test.ts` (sweep esaustivo G1-G4 + D1-D4),
> `statusAmbiguities.test.ts` (A1-A3) e `statusAmbiguitiesTitoli.test.ts` (A4-A6),
> `statusContextCause.test.ts` (confine R0/R1), `statusRequirementFacts.test.ts`
> (fatti di requisito A5 + rami OR),
> `statusAuthorityDivergences.test.ts` (contratto di divergenza + Core Set reale),
> `statusCoverageGuard.test.ts` (tipi senza natura dichiarata). 21 suite in `npm test`.

## 1. Vocabolario per requisito

| Stato | Significato |
|---|---|
| `SODDISFATTO` | requisito positivamente soddisfatto sui dati disponibili |
| `NON_SODDISFATTO` | requisito non soddisfatto: deficit certo |
| `NON_SODDISFATTO_INTEGRABILE` | deficit che una FONTE dichiara integrabile |
| `DATO_UTENTE_MANCANTE` | manca un dato dell'utente (CFU non numerici, SSD, classe del titolo, codice disciplinare) |
| `DATO_NORMATIVO_MANCANTE` | manca o non è dichiarata un'informazione NORMATIVA (integrabilità non dichiarata, ammissibilità della classe di laurea non provata da fonte primaria) |
| `INCERTO` | calcolo non affidabile (mappature non applicabili, OCR…) |
| `NON_VALUTABILE` | nessuna strategia registrata / tipo senza natura di aggregazione dichiarata |

Ogni requisito entra nell'aggregazione con i propri FATTI (A5, fase 5):
**natura** (`cfu` | `titolo` | `accesso`, dichiarata alla risoluzione da `naturaDaTipo`
in `conversions.ts`) e **integrabilità** (`ALLOWED` | `PROHIBITED` | `NOT_SPECIFIED`,
dichiarata dalla fonte per QUEL requisito; sui requisiti di titolo/accesso resta non
dichiarata perché riguarda i deficit di CFU). Un tipo senza natura dichiarata è
`NON_VALUTABILE` (R2): non può contribuire a un verdetto positivo.

Mapping di produzione (`costruisciContestoAggregazione`, dagli esiti per requisito +
fatti di requisito): `SODDISFATTO→SODDISFATTO`, `NON_SODDISFATTO→NON_SODDISFATTO`
(`ALLOWED` ⇒ `NON_SODDISFATTO_INTEGRABILE`), `COMPUTAZIONE_INCERTA→INCERTO`,
`DATI_INSUFFICIENTI→DATO_UTENTE_MANCANTE`, `NON_VALUTABILE→NON_VALUTABILE`. I rami di
una disgiunzione arrivano dall'esito del requisito (`EsitoValutazioneRequisito.rami`),
mai ricostruiti a valle. `DATO_NORMATIVO_MANCANTE` è prodotto da dichiarazioni
esplicite a livello di requisito (es. ammissibilità della classe di laurea non provata).

## 2. Regole di precedenza (la prima che scatta vince)

| # | Condizione | Stato aggregato |
|---|---|---|
| R0 | contesto non risolto per **DATI UTENTE** mancanti (data della procedura assente) | `INSUFFICIENT_DATA` |
| R1 | **conflitto** fra fonti registrato, oppure contesto non risolto per causa **NORMATIVA** | `MANUAL_VERIFICATION_REQUIRED` |
| R1b | **nessun requisito** ricostruibile (0 fonti verificate, o fonti che non dichiarano requisiti) | `MANUAL_VERIFICATION_REQUIRED` |
| R2 | almeno un requisito `NON_VALUTABILE` | `MANUAL_VERIFICATION_REQUIRED` |
| R3 | almeno un requisito `INCERTO` | `MANUAL_VERIFICATION_REQUIRED` |
| R4 | requisito `titolo`/`accesso` `NON_SODDISFATTO` | `NOT_ELIGIBLE` |
| R5 | requisito CFU `NON_SODDISFATTO` con integrabilità `PROHIBITED` **del requisito** | `NOT_ELIGIBLE` |
| R5b | deficit `NON_SODDISFATTO_INTEGRABILE` ma integrabilità `PROHIBITED` (incoerenza) | `MANUAL_VERIFICATION_REQUIRED` |
| R6 | almeno un requisito `DATO_NORMATIVO_MANCANTE` | `MANUAL_VERIFICATION_REQUIRED` |
| R7 | almeno un requisito `DATO_UTENTE_MANCANTE` | `INSUFFICIENT_DATA` |
| R8 | CFU `NON_SODDISFATTO` con integrabilità `ALLOWED`, oppure `NON_SODDISFATTO_INTEGRABILE` | `CONDITIONALLY_ELIGIBLE` |
| R9 | CFU `NON_SODDISFATTO` con integrabilità non dichiarata (`NOT_SPECIFIED`) | `MANUAL_VERIFICATION_REQUIRED` |
| R10 | tutti i requisiti `SODDISFATTO` | `ELIGIBLE` |

**Confine R0/R1 (decisione di fase 5)**: `INSUFFICIENT_DATA` è riservato ai casi in
cui il candidato possiede l'informazione mancante. Ogni causa NORMATIVA — nessuna norma
utilizzabile, contesti in conflitto, fonti non verificabili, nessun requisito
ricostruibile (R1b) — produce `MANUAL_VERIFICATION_REQUIRED`. La causa è un fatto di
CONTESTO (`ContestoAggregazione.causaContesto`, derivata da `causaContestoNormativoDa`:
`risolta` | `dato-utente` | `normativa`), non una deduzione dai requisiti. R1b sostituisce
il precedente R0b (`INSUFFICIENT_DATA`): con regole applicabili ma nessun requisito
ricostruibile nulla è stabilito dalle fonti verificate, quindi senza R1b l'aggregazione
cadrebbe in R10 producendo `ELIGIBLE` per vacuità.

## 3. Requisiti mandatori (A)

Un requisito di **titolo** o di **accesso** non soddisfatto è definitivo: nessun CFU
lo sostituisce e nessun dato mancante altrove può renderlo positivo → `NOT_ELIGIBLE`
(R4, valutato **prima** di R6/R7 perché l'assenza di dati non può migliorare un esito
negativamente accertato). Invariante D2 in `statusInvariants.test.ts`.

## 4. Requisiti alternativi (B) — disgiunzione "A oppure B" (decisione A3)

**Definizione — ramo conclusivo**: un ramo è *conclusivamente soddisfatto*
(`SODDISFATTO`) quando la sua soglia è raggiunta sui dati affidabili; una soglia
raggiunta non è ribaltabile da informazioni mancanti o incerte (codici disciplinari
assenti, campi non dichiarati, altri rami). Ogni altro stato è **non conclusivo**,
compreso `NON_SODDISFATTO_INTEGRABILE`: un ramo *completibile* non è un ramo
*soddisfatto*.

**Regola (D1-D7)** — `esitoDisgiunzione(rami)`:
- **D1** almeno un ramo `SODDISFATTO` ⇒ requisito `SODDISFATTO` (il ramo lo
  stabilisce DA SOLO: i rami incerti, mancanti o non valutabili non lo ribaltano e
  non bloccano);
- altrimenti si propaga lo **stato più grave** secondo l'ordine di precedenza
  (`GRAVITA_STATO`, allineato a R2 < R3 < R6 < R7):
  `NON_VALUTABILE` (D2) > `INCERTO` (D3) > `DATO_NORMATIVO_MANCANTE` (D4) >
  `DATO_UTENTE_MANCANTE` (D5) > `NON_SODDISFATTO_INTEGRABILE` (D6) >
  `NON_SODDISFATTO` (D7);
- disgiunzione senza rami ⇒ `NON_VALUTABILE`.

**Vietato** (regola semplicistica): *"uno stato positivo all'apparenza ⇒ OR
soddisfatto"*. `NON_SODDISFATTO_INTEGRABILE` (o qualunque stato rischioso) NON
soddisfa una disgiunzione. Casi verificati in `statusAmbiguities.test.ts` (A3):

| Ramo A | Ramo B | Requisito collassato | Esito aggregato |
|---|---|---|---|
| conclusivo | incerto | `SODDISFATTO` | `ELIGIBLE` |
| solo condizionale | incerto | `INCERTO` | `MANUAL_VERIFICATION_REQUIRED` |
| non valutabile | conclusivo | `SODDISFATTO` | `ELIGIBLE` (B basta da sé) |
| dato utente insufficiente | conclusivo | `SODDISFATTO` | `ELIGIBLE` |
| incertezza normativa | conclusivo | `SODDISFATTO` | `ELIGIBLE` |
| incerto | normativo mancante | `INCERTO` | `MANUAL_VERIFICATION_REQUIRED` |
| fallito | fallito (integrazione vietata) | `NON_SODDISFATTO` | `NOT_ELIGIBLE` |
| fallito | fallito (integrazione ammessa) | `NON_SODDISFATTO` | `CONDITIONALLY_ELIGIBLE` |
| fallito | fallito (non dichiarata) | `NON_SODDISFATTO` | `MANUAL_VERIFICATION_REQUIRED` |

Nella pipeline attuale la disgiunzione è già collassata dalla strategia del
requisito (`valutaRequisitoCfu` + `disgiunzioneSsd`), che applica **la stessa
regola** (ogni opzione è misurata sul proprio minimo, i crediti non si sommano, il
calcolo incerto blocca l'esito). Il parametro `opzioni` di `RequisitoAggregato`
rende la regola esplicita anche a livello di aggregazione: diventa obbligatorio
quando `natura`/`integrabilità` scendono a livello di requisito (rinviato — A5).

## 5. CFU (C)

Unione dei crediti (nessun doppio conteggio), soglie per gruppo, disgiunzioni non
additive; il deficit è pubblicato solo quando è computabile (`cfuMancantiTotali`
`null` altrimenti: mai `0` di comodo — `deficit.ts`).

## 6. Conflitti (D)

Qualunque conflitto fra fonti autorevoli ⇒ `MANUAL_VERIFICATION_REQUIRED` (R1),
verificato **prima** di ogni esito positivo, e sempre tracciato nell'audit e nelle
`escalations`. Un conflitto non è mai risolto in autonomia.

## 7. Tipi non supportati (E)

Nessuna strategia registrata **o** tipo senza natura di aggregazione dichiarata ⇒
`NON_VALUTABILE` ⇒ R2 ⇒ `MANUAL_VERIFICATION_REQUIRED`. La validazione a build-time
di `tipo → natura` è rinviata: fino ad allora la guardia resta obbligatoria
(`statusCoverageGuard.test.ts`).

## 8. Dati mancanti (F) — distinzione richiesta

| Situazione | Chi può risolverla | Stato |
|---|---|---|
| dato **utente** mancante (CFU non numerici, SSD, classe del titolo) | il candidato | `INSUFFICIENT_DATA` (R7) |
| informazione **normativa** mancante (integrabilità non dichiarata, nessuna regola, ammissibilità non provata) | l'operatore/il normatore | `MANUAL_VERIFICATION_REQUIRED` (R6/R9/R0) |
| calcolo non affidabile (mappature/OCR) | verifica manuale | `MANUAL_VERIFICATION_REQUIRED` (R3) |
| inidoneità accertata (titolo/accesso escluso, integrazione vietata) | nessuno | `NOT_ELIGIBLE` (R4/R5) |

## 9. Invarianti (G + D)

- **G1**: uno stato rischioso (`DATO_*`, `INCERTO`, `NON_VALUTABILE`), un conflitto
  o un contesto non risolto ⇒ **mai** un verdetto positivo.
- **G2**: `ELIGIBLE` ⟺ tutti i requisiti sono conclusivamente soddisfatti
  (contesto risolto, nessun conflitto, almeno un requisito).
- **G3**: sostituire uno stato con uno rischioso non può migliorare il verdetto.
- **G3b**: un deficit dichiarato integrabile non è mai peggiore di uno semplice.
- **G4**: `CONDITIONALLY_ELIGIBLE` richiede una dichiarazione ESPLICITA di
  integrabilità (mai dedotta dall'assenza di dati).
- **D1**: un dato mancante, da solo, non produce **mai** `NOT_ELIGIBLE`.
- **D2**: una negativa accertata da fonte resta negativa anche con dati mancanti
  non correlati.
- **D3**: conflitto, tipo non gestito e contesto non risolto non sono mai positivi.
- **D4**: un OR è positivo (`ELIGIBLE`) solo con almeno un ramo conclusivo.


## 10. Decisioni A1-A6 (chiuse in fase 4)

| Id | Decisione | Regola / test |
|---|---|---|
| **A1** | dato **utente** mancante ⇒ `INSUFFICIENT_DATA` (azionabile dal candidato); da solo non può MAI produrre `NOT_ELIGIBLE`; con un'incertezza normativa vale A2 | R7; `statusTruthTable` (3 casi) + `statusAmbiguities.testA1DatoUtenteMancante` (aggregazione + pipeline con CFU non numerici) |
| **A2** | se manca anche un'informazione **normativa** prevale `MANUAL` (R6): un dato utente non declassa mai l'incertezza normativa — vale anche dentro una disgiunzione (collasso per gravità) | R6 prima di R7; `statusTruthTable` (misto utente+normativo) + `statusAmbiguities.testA2PrecedenzaNormativa` |
| **A3** | disgiunzione soddisfatta **solo** da un ramo conclusivo (`SODDISFATTO`); un ramo "completibile" o incerto non la soddisfa; nessuna promozione di stati "positivi all'apparenza" | §4 (D1-D7, `esitoDisgiunzione`); `statusAmbiguities.testA3Disgiunzione` (9 casi + guardia + prova di pipeline reale) |
| **A4** | un percorso condizionale non è mai pubblicato mentre un requisito è irrisolto (R2/R3/R6/R7 precedono R8); eccezione: il requisito irrisolto è un **ramo non decisivo** di una disgiunzione (A3) | R2-R7 prima di R8; `statusAmbiguities.testA4PercorsoCondizionale` (4 stati irrisolti + ramo non decisivo) |
| **A5** | **COMPLETATA (fase 5)**: `natura` e `integrabilità` sono FATTI DEL REQUISITO dichiarati alla risoluzione (`DefinizioneRequisito.natura` / `.integrabilita`); l'aggregazione non rilegge più tipo testuale né regole applicabili; un deficit `ALLOWED` diventa `NON_SODDISFATTO_INTEGRABILE` | `requirements.ts` (dichiarazione) + `statusTypes.ts` (`statoAggregatoDaRequisito`, `RequisitoAggregato.integrabilita`) + `statusRequirementFacts.test.ts` (fatti, contratto senza scorciatoie, mappatura) |
| **A6** | classe di laurea: **esclusione documentata** ⇒ `NOT_ELIGIBLE` (R4); **ammissibilità documentata** ⇒ requisito soddisfatto; **assenza di prova primaria** ⇒ incertezza normativa (`MANUAL`), MAI inidoneità. "Manca l'estratto verbatim" ≠ "classe non ammessa" | `statusAmbiguities.testA6ClasseDiLaurea` (esclusione, ammissibilità, nessuna lista dichiarata, fonte non verificata + guardia di aggregazione) |

**Cambi di stato interni alla pipeline** (nessuno visibile all'utente, perché i
consumatori leggono ancora il verdetto legacy):

1. **Dato utente mancante** (fase 4/A1): `MANUAL_VERIFICATION_REQUIRED` → `INSUFFICIENT_DATA`
   (caso CFU non numerici in `universalPipelineSemantica`).
2. **Contesto non risolto per causa NORMATIVA** (fase 5): `INSUFFICIENT_DATA` →
   `MANUAL_VERIFICATION_REQUIRED` (R1/R1b). Riguarda i casi "nessun contesto per la data",
   "contesti in conflitto", "tutte le fonti escluse dal Source Gate": sono incertezze
   normative, non dati utente mancanti.
3. **Tipo non supportato / requisito non valutabile**: nessuna modifica (R2).

## 11. Divergenze INTENZIONALI fra autorità legacy e pipeline

Contratto verificato in `statusAuthorityDivergences.test.ts`: per ogni caso sono
asseriti stato legacy, stato della pipeline, REGOLA applicata e motivo.

| Caso | Autorità (`valutaRequisitoClasse`) | Pipeline | Regola | Perché |
|---|---|---|---|---|
| conflitto fra fonti con soglie incompatibili | `ELIGIBLE` (merge first-wins silenzioso) | `MANUAL_VERIFICATION_REQUIRED` | R1-conflitto | il legacy non risolve il conflitto in modo dichiarato |
| tipo di requisito non supportato (nessuna strategia) | `ELIGIBLE` (requisito ignorato) | `MANUAL_VERIFICATION_REQUIRED` | R2-tipo-non-gestito | il legacy non conosce il tipo e lo ignora |
| tipo non supportato con strategia a runtime | `ELIGIBLE` | `MANUAL_VERIFICATION_REQUIRED` | R2-tipo-non-gestito | il tipo non dichiara la natura di aggregazione |
| CFU non numerici (dato utente) | `CONDITIONALLY_ELIGIBLE` con deficit NaN | `INSUFFICIENT_DATA` | R7-dato-utente-mancante | A1: il dato è azionabile dal candidato |

Le prime tre sono i casi in cui **il verdetto legacy non è conservativo**: la
pipeline li mitiga con escalation motivate e tracciate. La quarta è la decisione A1.
**Sui dati reali non esistono divergenze**: Core Set DM 22/12/2023 (A-11 ELIGIBLE,
A-11 con deficit reale, A-12, A-22 · LM-14) → autorità e pipeline coincidono, così
come `payloadAssistantCreativo.stato` e il verdetto legacy.

## 12. Cosa resta RINVIATO (fase 5 e successive)

1. **Migrazione dei consumatori**: bridge (`legacyAdapter.ts`), routing
   (`calcolatore/analisi.ts`), report (`reportEngine.ts`) e UI devono leggere
   `RisultatoPipeline.stato` al posto di `valutazioneClasse.stato`. Da fare DOPO la
   progettazione del livello di ingresso documenti (fase 5 non commutata).
2. **Rimozione dell'aggregazione duplicata** in `valutaRequisitoClasse` e pulizia
   SRP di `legacyAdapter`/`reportEngine` al di sotto del limite del gate.
3. **Livello di ingresso documenti** (upload, estrazione, revisione umana) e
   **validazione a build-time di `tipo → natura`** al posto della guardia runtime.
4. **Provenienza per campo del titolo** (vedi §14): solo se il livello di ingresso
   la richiede per distinguere estratto/dichiarato/verificato sul titolo.

## 13. Principio di prodotto (fase 5)

- **Il motore è veritiero**: la verità normativa non si cambia per la conversione.
  Nessun verdetto positivo senza fonte verificata e requisito conclusivamente
  soddisfatto.
- **L'incertezza va minimizzata, non nascosta**: ogni stato non positivo risponde
  internamente a tre domande — mancano DATI UTENTE (R0/R7: il candidato può agire),
  mancano o confliggono DATI NORMATIVI (R1/R1b/R5/R6/R9: serve verifica manuale),
  oppure il requisito è genuinamente irrisolto (R2/R3)?
- **Conseguenza**: il livello di prodotto può tradurre l'incertezza in un'azione
  concreta (chiedere un dato specifico, spiegare che manca una norma, richiedere la
  verifica) invece di mostrare un "Boh" indistinto. È il motivo per cui
  `INSUFFICIENT_DATA` non è un "non so" generico.

## 14. Ingresso documenti: prontezza del modello dati (fase 5, sola analisi)

**Già pronto (nessuna modifica necessaria)**

- `EsameCanonico` (`pipeline/resultTypes.ts`): `denominazione`, `cfu`, `ssd`/`ssdOrigine`,
  `gsd`, `voto`, `anno`, `fonte` (`'manuale' | 'ocr-documento' | 'testo-incollato'`),
  `manualVerified`, `affidabilita` (`'alta'|'media'|'bassa'`), `provenienza[]`.
- `Provenienza` + `RiferimentoDocumento`: confidenza 0..1, `metodo`
  (`'ocr' | 'testo-incollato' | 'manuale' | 'normalizzazione' | 'riconoscimento'`),
  `documentId` + `pagina` + `riga` + testo della riga → **la distinzione
  estratto/dichiarato/verificato esiste già** (fonte + metodo + `manualVerified`).
- `TitoloAccademicoCanonico`: `denominazione`, `classe`, `classeLegacy`, `istituzione`,
  `paese`, `titoloEstero`, `dataInizio`, `dataLaurea`, `raw` (payload originale intatto).
- Estrazione pura in `documentParser.ts` (`RigaOcr`/`PaginaOcr` → `parseEsameDaRigaOcr` →
  `costruisciFascicoloDaOcr`), con avvisi per le righe non interpretabili e
  `confidenzaMediaFascicolo` per un eventuale segnale di verifica manuale.
- Normalizzazione conservativa in `normalization.ts`/`normalizer.ts`: dati grezzi mai
  alterati, `MappaturaDatoNormalizzato` (grezzo → canonico + avvisi), `cfuNonValidi`,
  `codiciMancanti`, `anomalie`.
- Campi oggi obbligatori: `EsameCanonico.id`, `.denominazione`, `.cfu`, `.fonte`,
  `.provenienza`; `Provenienza.metodo` + `.confidenza`; `RiferimentoDocumento.documentId`
  + `.pagina`. `TitoloAccademicoCanonico.denominazione`.
- Campi che possono restare ignoti: `ssd`/`ssdOrigine` (⇒ `codiciMancanti` ⇒ R7),
  `voto`, `anno`, `gsd`, `classe` (⇒ R7/R4), `istituzione`, `paese`, `dataInizio`,
  `dataLaurea`; `cfu` non numerico va rappresentato come `NaN` (⇒ `cfuNonValidi` ⇒ R7),
  **mai** corretto d'ufficio.

**Mancante (rinviato al livello di ingresso documenti)**

- Provenienza/confidenza **a livello di titolo** (oggi solo per esame): il documento
  di laurea deve poter dichiarare `fonte`, `affidabilita`, `provenienza[]` come un esame.
- Un registro dei documenti caricati (`documentId` → file, tipo, data, esito
  estrazione): oggi `documentId` è un riferimento libero, il catalogo appartiene al
  livello di upload (fuori dal motore).
- Un canale per "campo non risolto" diverso da `NaN`: utile quando l'estrazione non
  trova un valore (oggi l'assenza è indistinguibile da un valore non valido).
- Nessun ostacolo architetturale: l'estrattore può già produrre dati canonici con
  provenienza e confidenza; il motore valuta e segnala l'incertezza senza inventare
  valori.

_Ultimo aggiornamento: fase 5 (confine R0/R1, A5 completata, principio di prodotto, prontezza ingresso documenti)._


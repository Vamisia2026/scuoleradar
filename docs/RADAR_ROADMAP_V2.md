# Radar V2 — Roadmap Tecnica (post-lancio)

> Obiettivo: rendere il Radar Scuole un motore di matching *trasparente* e *misurabile*,
> eliminando rumore (falsi positivi) e perdite (falsi negativi) e spiegando **perché**
> una segnalazione arriva all'utente.

Stato: **proposta / roadmap** — nessuna di queste feature è ancora implementata.
Documento di riferimento per architettura, UX e KPI della prossima iterazione del Radar.

---

## 1. Match Scoring Algorithm

Il cuore di V2 è un punteggio di affinità (`matchScore`) calcolato a ogni nuovo avviso
contro il profilo dell'utente. Il punteggio determina **se** notificare e **come**
presentare la segnalazione.

| Punteggio | Etichetta UI | Significato |
|---|---|---|
| **100** | Strong Match | Match esatto su tutti i criteri core: provincia + ordine + classe di concorso (o profilo ATA). |
| **80** | Probable | Match forte ma con un criterio secondario mancante (classe non perfetta ma materia coperta, o provincia limitrofa). |
| **60** | Possible | Match parziale: competenze/materie affini, ordine diverso, bando tematico (PNRR/STEM) affine. |
| **40** | Extra / Preferred School | Segnalazione "in più": fuori dai criteri stretti ma da **Scuola Preferita** (whitelist) o nicchia utile (GPS, scadenze, proroghe). |

Regole di progetto:
- Soglie di notifica per piano: BASE → solo 100 (o 100/80 nel digest); PRO → 80+ in
  real-time, 60 nel digest opzionale.
- Punteggio **calcolato server-side** (Edge/RPC) e **salvato con la notifica**
  (`match_score`) per KPI e debugging retroattivo.
- Nessun punteggio "a scatola chiusa": ogni componente del punteggio è tracciabile.

---

## 2. Signal Reasons — Badge "Perché ti segnaliamo questo"
## 3. Deduplicazione Avanzata & Tracciamento Rettifiche / Proroghe

Gli stessi interpelli/bandi vengono pubblicati più volte con leggere variazioni
(riaperture, rettifiche, proroghe, nuove graduatorie). Oggi la dedup si basa su
`hash_id = SHA256(provincia|titolo|data)`.

Obiettivi V2:
1. **Raggruppamento per "avviso madre"** (`family_id` / `canonical_id`): cluster generato
   da normalizzazione del titolo, codice scuola, classe di concorso e finestra temporale.
2. **Collegamento Rettifiche/Proroghe**: quando un nuovo avviso è riconosciuto come
   *rettifica* o *proroga* di uno già notificato, invece di notificare un duplicato si
   **aggiorna la scheda esistente** e si emette una notifica di tipo "aggiornamento"
   (es. "Scadenza prorogata al …").
3. **Tracciamento versione**: `interpelli_amendment` (o campi su `interpelli`) con
   `hash_id_riferimento`, tipo (`rettifica`|`proroga`), data e diff rilevante.
4. Similarità difensiva: titolo normalizzato (minuscole, spazi, acronimi) + Jaccard su
   token significativi per decidere se è lo "stesso avviso".

---

## 4. Mappa Sinonimi / Varianti per Keyword Personalizzate

Le competenze personalizzate (es. "AI") devono intercettare le varianti reali negli
avvisi ("IA", "AI generativa", "Intelligenza Artificiale", "Didattica Digitale").

- **Tavola sinonimi** (`keyword_synonyms`): termine → insieme di varianti (espansione
  acronimi, singolare/plurale, inglese/italiano).
- **Espansione lato profilo**: le competenze utente vengono espanse in token candidati.
- **Espansione lato avviso**: i testi vengono normalizzati con la stessa tavola (così
## 5. KPI Interni — Misurare Qualità del Matching

Dashboard interna (admin/DevToolbar) con metriche di qualità, non solo di volume:

| Metrica | Definizione | Obiettivo |
|---|---|---|
| **False Positive rate** | % di segnalazioni "non pertinenti" / disattivazioni dopo notifica | ↓ minimo |
| **False Negative rate** | opportunità NON notificate a utenti compatibili (audit campione + feedback utenti) | ↓ minimo |
| **Click / Apertura** | CTR email/Telegram (link "Leggi l'avviso") + aperture scheda nel feed | ↑ |
| **Match Score distribution** | distribuzione punteggi inviati (100/80/60/40) | bilanciata |
| **Convert-to-Radar** | utenti che aggiungono classi/province dopo una notifica (feedback implicito) | ↑ |
| **Segnalazioni duplicato** | quota di notifiche duplicate ignorate/segnalate | ↓ |

- Tracciamento: `radar_notification { match_score, signal_reasons, esito_clic }`
  nell'analytics (PostHog) già in uso.
- Audit manuale settimanale su campione per stimare i falsi negativi.

---

## Appendice — Ordine di implementazione suggerito

1. **Signal Reasons** (quick win, zero rischio): esporre i motivi del match già calcolati.
2. **Match Scoring**: formalizzare 100/80/60/40 e salvare `match_score` sulla notifica.
3. **Dedup avanzata + rettifiche/proroghe**: riduce subito il rumore percepito.
4. **KPI interni**: dashboard di qualità → decide se/come investire su sinonimi.
5. **Sinonimi/varianti**: ultimo step, guidato dai falsi negativi misurati.

  "IA" e "Intelligenza Artificiale" collidono).
- **Rilevanza semantica leggera**: co-occorrenze curate (es. AI → coding, robotica
  educativa, pensiero computazionale), senza LLM in real-time.

Esempio: l'utente aggiunge "AI" → il Radar intercetta anche "Intelligenza Artificiale",
"IA generativa" e "Didattica digitale".

---


Ogni opportunità (feed + notifica email/Telegram) espone i **motivi del match** come badge:

- `✓ Provincia` — match sulla provincia selezionata;
- `✓ Classe di Concorso A-026` — match sulla classe di concorso;
- `✓ Competenza PNRR` — match su competenza/materia (es. STEM, coding, robotica);
- `★ Scuola Preferita` — pubblicazione da una scuola in whitelist (anche a score 40);
- `✓ Ordine di Scuola` — match su ordine (infanzia/primaria/secondaria/CPIA/ATA/PON).

Implementazione: `signalReasons: string[]` serializzato su notifica/feed e renderizzato in
`InterpelloCard` con le Pill esistenti; stessa logica in email e Telegram.

---

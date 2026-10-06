/**
 * ScuoleRadar.it — BACHECA INTERPELLI (modulo PURO): dal feed del DB alla lista
 * che la dashboard mostra.
 *
 * Una sola pipeline, in quest'ordine:
 *   1. **avviso vivo** (`eAvvisoVivo`: scaduto no, senza scadenza solo entro la
 *      finestra dei 60 giorni);
 *   2. **Modalità 5 — Filtri Avanzati Scuole**: blacklist → scartato a
 *      prescindere dal punteggio; whitelist → incluso d'ufficio (saltando gli
 *      altri criteri) e marcato `scuolaPreferita`;
 *   3. **pertinenza**: l'avviso deve appartenere al Radar — il motore lo conferma
 *      (`avvisoCompatibileConProfilo`, province entro il raggio) oppure la classe è
 *      almeno «stessa area» (85) o una parola chiave del profilo è stata trovata
 *      (OVERRIDE della Modale 3: 90 piena · 85 vicina). Un ponte tematico da solo NON
 *      crea l'opportunità: nessun invio (e nessuna card) a caso;
 *   4. **punteggio**: OVERRIDE della Modale 3 o media delle altre modali + jolly
 *      (`valutaCompatibilita`), con il motivo leggibile che card e modale mostrano nel
 *      tooltip;
 *   5. **esclusione secca dei riempitivi NON pertinenti** (§26.60): una voce sotto
 *      la soglia arancio (70%) che il Radar non conferma per classe/competenza —
 *      tipicamente il suggerimento EXTRA del sostegno (§26.45) — **non entra in
 *      bacheca**: nessun cap, nessuna quota (`riempitivoNonPertinente`);
 *   6. **cap dinamico dei riempitivi** (`limitaRiempitivi`) sui soli riempitivi
 *      PERTINENTI, che non tocca le scuole preferite.
 *
 * Perché è un modulo PURO e non codice dentro l'hook: la stessa logica serve a
 * guardie e verifiche senza React, e `useInterpelliFeed` resta un contenitore di
 * stato e fetch (ben sotto il limite di 250 righe del gate strutturale).
 */
import type { Interpello } from '../data/interpelli';
import type { OrdineScuola } from '../data/ordiniMaterie';
import { valutaCompatibilita, type ProfiloModali } from './compatibilitaGraduata';
import { giudizioScuole } from './filtriScuole';
import { avvisoCompatibileConProfilo, avvisoDiSostegno, profiloAderisceSostegno } from './matchingEngine';
import { classeVicina } from './punteggioClasse';
import { punteggioCompetenze } from './punteggioCompetenze';
import { limitaRiempitivi, riempitivoNonPertinente } from './riempitivi';
import { eAvvisoVivo } from './scadenza';

/** Profilo completo della bacheca: criteri del Radar + liste scuole. */
export interface ProfiloBacheca extends ProfiloModali {
  /** Ordini di scuola scelti (Modalità 1). */
  ordini: readonly OrdineScuola[];
  /** Classi di concorso attive per il piano (Modalità 2). */
  classi: readonly string[];
  /** Province attive per il piano: la ricerca allarga al raggio (Modalità 4). */
  province: readonly string[];
  /** Whitelist scuole (Modalità 5). */
  favoriteSchools?: readonly string[] | null;
  /** Blacklist scuole (Modalità 5). */
  ignoredSchools?: readonly string[] | null;
}

/** Esito della pipeline: lista pronta per la dashboard + conti per log/guardie. */
export interface EsitoBacheca {
  lista: Interpello[];
  /** Avvisi scartati dalla blacklist scuole. */
  esclusiBlacklist: number;
  /** Avvisi inclusi d'ufficio dalla whitelist scuole. */
  forzate: number;
  /** Riempitivi NON pertinenti esclusi a monte (§26.60: nessun cap, nessuna quota). */
  riempitiviEsclusi: number;
  /** Riempitivi tolti dal cap dinamico. */
  riempitiviNascosti: number;
}

/** Avviso minimo per le modali, derivato dall'interpello della bacheca. */
function avvisoDaInterpello(i: Interpello) {
  return {
    province: i.provinciaCodice,
    classi: i.classiCodes,
    materia: i.materia,
    titolo: i.titolo,
    ordine: i.ordine,
  };
}

/**
 * Pipeline della bacheca: filtra, valuta e limita gli interpelli del feed.
 * Nessuna mutazione dell'input; l'ordine ricevuto è conservato (l'ordinamento
 * per compatibilità è responsabilità della dashboard).
 */
export function bachecaInterpelli(
  fonti: readonly Interpello[],
  profilo: ProfiloBacheca,
): EsitoBacheca {
  const inBacheca: Interpello[] = [];
  let esclusiBlacklist = 0;
  let forzate = 0;
  let riempitiviEsclusi = 0;

  for (const i of fonti) {
    if (!eAvvisoVivo(i.dataScadenza, i.dataPubblicazione)) continue;

    const scuole = giudizioScuole(profilo, i);
    if (scuole.escluso) {
      esclusiBlacklist += 1;
      continue;
    }

    const avviso = avvisoDaInterpello(i);
    // La CONFERMA del motore (§26.54) e la PERTINENZA del Radar (§26.60) non sono la
    // stessa cosa: la conferma include l'inclusione d'ufficio dell'area sostegno, che
    // resta un suggerimento EXTRA (`profiloAderisceSostegno` = l'utente ha una classe
    // AD… propria), mentre per la pertinenza serve una conferma per CLASSE/COMPETENZA.
    const confermato = avvisoCompatibileConProfilo(profilo, avviso, { provinceLimitrofe: true }).ok;
    const pertinenzaMotore =
      confermato && !(avvisoDiSostegno(avviso) && !profiloAderisceSostegno(profilo));
    // Il voto della Modale 3 è calcolato una volta: serve sia alla porta d'ingresso sia
    // all'esclusione secca.
    const competenze = punteggioCompetenze(profilo, avviso).override !== null;
    if (!scuole.preferita) {
      const inRadar = confermato || classeVicina(profilo, avviso) || competenze;
      if (!inRadar) continue;
    }

    const valutazione = valutaCompatibilita(profilo, avviso, {
      provinceLimitrofe: true,
      forzata: scuole.preferita,
    });
    if (valutazione.escluso) continue;
    // `0` = nessuna modale applicabile: si conserva il valore dal DB.
    if (valutazione.punteggio === 0) {
      inBacheca.push(i);
      continue;
    }
    // §26.60 — ESCLUSIONE SECCA: sotto il 70% e senza pertinenza del Radar la voce è un
    // falso positivo, non un riempitivo da dosare: fuori, senza quote e senza cap. Le
    // scuole preferite restano (scelta esplicita dell'utente, Modalità 5).
    if (
      riempitivoNonPertinente(
        { compatibilita: valutazione.punteggio },
        { pertinente: pertinenzaMotore || competenze, forzata: scuole.preferita },
      )
    ) {
      riempitiviEsclusi += 1;
      continue;
    }
    if (scuole.preferita) forzate += 1;
    inBacheca.push({
      ...i,
      compatibilita: valutazione.punteggio,
      motivoCompatibilita: valutazione.motivi.join(' · ') || undefined,
      scuolaPreferita: scuole.preferita,
      // Modalità 3 — OVERRIDE: la parola chiave che ha ASSEGNATO il voto (`null` se il
      // punteggio è una media ponderata delle altre modali).
      parolaChiaveVoto: valutazione.override?.parolaChiave ?? null,
    });
  }

  const cap = limitaRiempitivi(inBacheca, { proteggi: (v) => v.scuolaPreferita === true });
  return {
    lista: cap.lista,
    esclusiBlacklist,
    forzate,
    riempitiviEsclusi,
    riempitiviNascosti: cap.riempitiviNascosti,
  };
}

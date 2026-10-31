/**
 * ScuoleRadar.it — BACHECA INTERPELLI (modulo PURO): dal feed del DB alla lista mostrata.
 *
 * Una sola pipeline, in quest'ordine:
 *   1. **opportunità con scadenza** (`eOpportunitaConScadenza`, §26.71): senza una
 *      `expiration_date` dichiarata e non passata la riga NON entra (archivi, regolamenti,
 *      indici di classi). Lo scarto è contato (`senzaScadenza`), mai silenzioso;
 *   1-bis. **la riga è un avviso?** (`motivoRigaNonOpportunita`, §26.65): titoli di sezione,
 *      voci di menu, indici di classi («A041 | B017»), numeri di protocollo **non entrano**.
 *      Lo scarto è dichiarato (`righeNonOpportunita`);
 *   2. **Modalità 5 — Filtri Avanzati Scuole**: blacklist → scartato; whitelist → incluso
 *      d'ufficio (saltando gli altri criteri) e marcato `scuolaPreferita`;
 *   3. **porta d'ingresso (§26.63 · §26.64)**: decidono le PREFERENZE PRIMARIE — il motore
 *      conferma l'avviso (`avvisoCompatibileConProfilo`, province entro il raggio) oppure
 *      la classe è almeno «stessa area» (85) — oppure un match PIENO del jolly semantico:
 *      l'interesse dichiarato per intero apre l'opportunità anche fuori dalle proprie
 *      province. Un match PARZIALE no. Chi non passa questa porta NON entra nemmeno nella
 *      scorta del paracadute (§26.120): la geografia non sostituisce l'affinità di classe;
 *   4. **punteggio**: media ponderata delle preferenze primarie + jolly semantico
 *      (`valutaCompatibilita`, §26.64), col motivo leggibile e la competenza riconosciuta;
 *   5. **esclusione secca dei riempitivi NON pertinenti** (§26.60): sotto la soglia arancio
 *      (70%) e senza conferma per classe o match PIENO — tipicamente il suggerimento EXTRA
 *      del sostegno (§26.45) — **non entra**: nessun cap, nessuna quota;
 *   6. **cap dinamico dei riempitivi** (`limitaRiempitivi`) sui soli riempitivi PERTINENTI;
 *   7. **paracadute «5 osso-da-mordere»** (§26.106): sotto i 5 risultati la coda si completa
 *      con le MIGLIORI righe della scorta — avvisi veri con affinità di CLASSE (§26.120) —
 *      marcate `ripiego` e dichiarate in vetrina.
 *
 * Perché è un modulo PURO e non codice dentro l'hook: la stessa logica serve a guardie e
 * verifiche senza React, e `useInterpelliFeed` resta un contenitore di stato e fetch.
 */
import type { Interpello } from '../data/interpelli';
import type { OrdineScuola } from '../data/ordiniMaterie';
import {
  valutaCompatibilita,
  type ProfiloModali,
  type ValutazioneCompatibilita,
} from './compatibilitaGraduata';
import { giudizioScuole } from './filtriScuole';
import { avvisoCompatibileConProfilo, avvisoDiSostegno, profiloAderisceSostegno } from './matchingEngine';
import { classeVicina } from './punteggioClasse';
import { motivoRigaNonOpportunitaAvviso } from './qualitaAvviso';
import { limitaRiempitivi, paracaduteCinque, riempitivoNonPertinente } from './riempitivi';
import { eOpportunitaConScadenza } from './scadenza';


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
  /** Righe di contorno scartate a monte: non sono avvisi (§26.65). */
  righeNonOpportunita: number;
  /**
   * Righe senza una scadenza dichiarata e valida: NON sono opportunità (§26.71) e
   * non entrano nel feed (pagine di archivio, regolamenti, indici di classi).
   */
  senzaScadenza: number;
  /** Avvisi scartati dalla blacklist scuole. */
  esclusiBlacklist: number;
  /** Avvisi inclusi d'ufficio dalla whitelist scuole. */
  forzate: number;
  /** Riempitivi NON pertinenti esclusi a monte (§26.60: nessun cap, nessuna quota). */
  riempitiviEsclusi: number;
  /** Riempitivi tolti dal cap dinamico. */
  riempitiviNascosti: number;
  /** Righe scartate perché la classe non ha rapporto con le proprie (§26.120):
   *  fuori dalla bacheca e fuori dalla scorta del paracadute. */
  senzaAffinitaClasse: number;
  /**
   * Righe entrate con il PARACADUTE «5 osso-da-mordere» (§26.106): la vetrina era sotto
   * `MINIMO_BACHECA` e la coda è stata completata dalla scorta. Sono dichiarate `ripiego`.
   */
  ripieghiInBacheca: number;
}

/** Candidato di RIPIEGO (§26.106): opportunità vera non agganciata dal Radar, marcata `ripiego`. */
function candidatoRipiego(i: Interpello, valutazione: ValutazioneCompatibilita): Interpello {
  return {
    ...i,
    compatibilita: valutazione.punteggio,
    motivoCompatibilita: valutazione.motivi.join(' · ') || undefined,
    ripiego: true,
  };
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
  // SCORTA del paracadute «5 osso-da-mordere» (§26.106): le opportunità VERE che il Radar
  // non aggancia, pronte a completare la vetrina se resta sotto i 5 risultati.
  const scorta: Interpello[] = [];
  let righeNonOpportunita = 0;
  let senzaScadenza = 0;
  let esclusiBlacklist = 0;
  let forzate = 0;
  let riempitiviEsclusi = 0;
  let senzaAffinitaClasse = 0;

  for (const i of fonti) {
    // §26.71 — REGOLA FERREA: senza una scadenza dichiarata e non ancora passata la
    // riga NON è un'opportunità. Prima di ogni punteggio e di ogni porta d'ingresso:
    // le pagine di archivio e gli indici di classi di concorso non devono né entrare
    // né consumare quota. Lo scarto è contato, mai silenzioso.
    if (!eOpportunitaConScadenza(i.dataScadenza)) {
      senzaScadenza += 1;
      continue;
    }
    // §26.65 — la riga è un AVVISO? Le voci di contorno (titoli di sezione, indici
    // di classi, numeri di protocollo) escono PRIMA di ogni punteggio: senza questo
    // filtro entravano in bacheca con punteggi piatti e finivano nei suggerimenti
    // del campo scuola. Lo scarto è contato, mai silenzioso.
    // Il segnale «istituto» vale solo se il nome è PRESENTABILE (§26.59): una
    // stringa grezza che la fonte usa come titolo di sezione («Presentazione»,
    // «A041 | B017») non è un istituto, e non tiene in vita una riga di contorno.
    if (motivoRigaNonOpportunitaAvviso(i) !== null) {
      righeNonOpportunita += 1;
      continue;
    }

    const scuole = giudizioScuole(profilo, i);
    if (scuole.escluso) {
      esclusiBlacklist += 1;
      continue;
    }

    const avviso = avvisoDaInterpello(i);
    // PRIMA la valutazione: porta il verdetto del jolly semantico (§26.64), che può far
    // entrare d'ufficio un match PIENO fuori dalle proprie province (i vincoli geografici
    // secondari non escludono più) e quindi aprire anche la porta d'ingresso.
    const valutazione = valutaCompatibilita(profilo, avviso, {
      provinceLimitrofe: true,
      forzata: scuole.preferita,
    });
    // La CONFERMA del motore (§26.54) e la PERTINENZA del Radar (§26.60) non sono la
    // stessa cosa: la conferma include l'inclusione d'ufficio dell'area sostegno, che
    // resta un suggerimento EXTRA (`profiloAderisceSostegno` = l'utente ha una classe
    // AD… propria), mentre per la pertinenza serve una conferma per CLASSE. Un match
    // PIENO del jolly (§26.64) È una conferma: l'utente ha dichiarato di saperci lavorare.
    const jollyPieno = valutazione.jollySemantico !== null;
    const confermato = avvisoCompatibileConProfilo(profilo, avviso, { provinceLimitrofe: true }).ok;
    const pertinenzaMotore =
      jollyPieno ||
      (confermato && !(avvisoDiSostegno(avviso) && !profiloAderisceSostegno(profilo)));
    // PORTA D'INGRESSO (§26.63 · §26.64): entrano gli avvisi che le preferenze PRIMARIE
    // agganciano — conferma del motore, oppure classe almeno «stessa area» (85) — e quelli
    // che un match PIENO del jolly ha aperto. Una competenza PARZIALE non apre la bacheca:
    // sfuma un punteggio che le preferenze hanno già deciso, e non crea l'opportunità.
    if (!scuole.preferita) {
      const inRadar = confermato || classeVicina(profilo, avviso) || jollyPieno;
      if (!inRadar) {
        // §26.120 — NIENTE SCORTA PER CHI NON HA AFFINITÀ DI CLASSE. Fino al
        // 30/10/2026 questa riga finiva nella scorta del paracadute «5» e tornava
        // in vetrina come ripiego: era il canale da cui entravano le «cinque
        // opportunità al 60%» che non c'entravano nulla con il profilo (§26.60
        // le escludeva dalla bacheca, il paracadute le ripescava). La geografia
        // non basta: se la classe non ha alcun rapporto con le proprie, la riga
        // non entra — né in bacheca né di ripiego. Meglio una vetrina corta e
        // onesta che cinque card da scartare.
        senzaAffinitaClasse += 1;
        continue;
      }
    }
    if (valutazione.escluso) continue;
    // `0` = nessuna modale applicabile: si conserva il valore dal DB.
    if (valutazione.punteggio === 0) {
      inBacheca.push(i);
      continue;
    }
    // §26.60 — ESCLUSIONE SECCA: sotto il 70% e senza pertinenza del Radar la voce è un
    // falso positivo, non un riempitivo da dosare: fuori, senza quote e senza cap. La
    // pertinenza è PRIMARIA (§26.63: le competenze non la stabiliscono — sfumano soltanto).
    // Le scuole preferite restano (scelta esplicita dell'utente, Modalità 5).
    if (
      riempitivoNonPertinente(
        { compatibilita: valutazione.punteggio },
        { pertinente: pertinenzaMotore, forzata: scuole.preferita },
      )
    ) {
      riempitiviEsclusi += 1;
      // SCORTA (§26.106): la riga ha passato le porte d'ingresso ed è solo «poco
      // pertinente»: è esattamente la migliore candidata a completare la vetrina.
      scorta.push(candidatoRipiego(i, valutazione));
      continue;
    }
    if (scuole.preferita) forzate += 1;
    inBacheca.push({
      ...i,
      compatibilita: valutazione.punteggio,
      motivoCompatibilita: valutazione.motivi.join(' · ') || undefined,
      scuolaPreferita: scuole.preferita,
      // LIVELLO SECONDARIO (§26.63): la competenza del profilo che ha SFUMATO il punteggio
      // (`null` = nessuna competenza trovata: il voto è tutto delle preferenze primarie).
      competenzaSecondaria: valutazione.competenzaSecondaria?.etichetta ?? null,
      // JOLLY SEMANTICO (§26.64): la competenza riconosciuta PER INTERO, che ha garantito il
      // pavimento d'eccellenza o l'ingresso d'ufficio fuori dalle proprie province.
      jollySemantico: valutazione.jollySemantico,
    });
  }

  const cap = limitaRiempitivi(inBacheca, { proteggi: (v) => v.scuolaPreferita === true });
  // PARACADUTE «5 OSSO-DA-MORDERE» (§26.106): sotto i cinque risultati la vetrina si
  // completa con le migliori righe della scorta (già marcate `ripiego`, dichiarate in UI).
  // Se il database non ha cinque opportunità ammissibili la lista resta corta: il
  // paracadute non inventa righe e non scavalca il blocco geografico.
  const paracadute = paracaduteCinque(cap.lista, scorta);
  return {
    lista: paracadute.lista,
    righeNonOpportunita,
    senzaScadenza,
    esclusiBlacklist,
    forzate,
    riempitiviEsclusi,
    riempitiviNascosti: cap.riempitiviNascosti,
    ripieghiInBacheca: paracadute.aggiunti,
    senzaAffinitaClasse,
  };
}

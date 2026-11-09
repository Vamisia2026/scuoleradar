/**
 * ScuoleRadar.it — BACHECA INTERPELLI (modulo PURO): dal feed del DB alla lista mostrata.
 *
 * «BUTTADENTRO» (direttiva 04/11/2026, §26.144). Fino al 03/11/2026 questa era una pipeline
 * di GATEKEEPER: una catena di porte (classe esatta o vicina, conferma del motore, grado
 * affine, serbatoio) decideva l'INGRESSO, e chi non passava una porta non entrava — nemmeno
 * per essere guardato. Oggi la logica è rovesciata: **un solo sbarramento rigido, la
 * geografia**, e tutto il resto è una CASCATA di erogazione (`lib/cascataGenerosa`).
 *
 *   1. **opportunità con scadenza** (`eOpportunitaConScadenza`, §26.71) e **riga che è
 *      davvero un avviso** (`motivoRigaNonOpportunita`, §26.65): restano — scartano il
 *      contorno (archivi, indici di classi, voci di menu), non il merito;
 *   1-bis. **sostegno ambiguo** (§26.131): un «piano di sostegno didattico» non è una
 *      cattedra e non entra, nemmeno come riserva;
 *   2. **Modalità 5 — filtri scuole**: la blacklist oscura; la whitelist include d'ufficio
 *      (salta sbarramento e cascata) e marca `scuolaPreferita`;
 *   3. **PERIMETRO GEOGRAFICO** (`scalaParacadute`, §26.125 · §26.139): province scelte +
 *      raggio dei 60 km. **È l'unico sbarramento rigido**: fuori perimetro la riga non entra,
 *      dentro il perimetro entra (l'unica eccezione resta il match PIENO del jolly semantico,
 *      §26.64, che apre d'ufficio oltre il raggio);
 *   4. **CASCATA** (`voceCascata`): sostegno/alternativa/ATA entrano d'ufficio — merito 90/86
 *      nell'ordine scelto, riserva 58/56 (ATA 52/50) in un altro ordine; l'insegnamento entra
 *      con la classe agganciata (≥ 85, merito), col grado affine o col ponte disciplinare
 *      (tolleranza 82 · 76 · 72 · 70). **L'unico scarto di merito** è l'incompatibilità
 *      semantica evidente (Musica vs Spagnolo): due temi noti che non si toccano;
 *   5. **punteggio**: `max(voto del motore, pavimento della cascata)` — con l'eccezione di
 *      §26.145: quando la DISTANZA DAL PROFILO (`lib/distanzaProfilo`) ha abbassato il voto
 *      (`voce.tetto`), quel numero è un limite e il motore non lo rialza. Il voto a due
 *      livelli (§26.63 · §26.64) resta com'è; la cascata rialza solo ciò che il motore non
 *      sapeva leggere. Nessun cap e nessun paracadute: non c'è più una coda di «riempitivi»
 *      da dosare né una vetrina da riempire — la cascata garantisce la densità e la scarsità
 *      la dichiara la pagina (§26.141, `bachecaScarsa`).
 *
 * Perché è un modulo PURO e non codice dentro l'hook: la stessa logica serve a guardie e
 * verifiche senza React, e `useInterpelliFeed` resta un contenitore di stato e fetch.
 */
import type { Interpello } from '../data/interpelli';
import type { OrdineScuola } from '../data/ordiniMaterie';
import { avvisoDaInterpello, rigaInBacheca, type EsitoBacheca } from './bachecaRipiego';
import { voceCascata } from './cascataGenerosa';
import { sostegnoAmbiguo } from './classificatoreSostegno';
import { valutaCompatibilita, type ProfiloModali } from './compatibilitaGraduata';
import { giudizioScuole } from './filtriScuole';
import { avvisoCompatibileConProfilo } from './matchingEngine';
import { motivoRigaNonOpportunitaAvviso } from './qualitaAvviso';
import { distanzaKm } from './prossimitaGeografica';
import { provinciaPrincipale } from './provinceRadar';
import { scalaParacadute } from './scalaParacadute';
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

/**
 * L'ESITO della pipeline (`EsitoBacheca`, conti per log e guardie) e la RIGA DI BACHECA
 * vivono in `lib/bachecaRipiego.ts`: qui si riesporta il tipo, così chi legge la bacheca
 * trova il contratto dove l'ha sempre trovato.
 */
export type { EsitoBacheca } from './bachecaRipiego';

/**
 * Pipeline della bacheca: valuta e filtra gli interpelli del feed.
 * Nessuna mutazione dell'input; l'ordine ricevuto è conservato (l'ordinamento
 * per compatibilità è responsabilità della dashboard).
 */
export function bachecaInterpelli(
  fonti: readonly Interpello[],
  profilo: ProfiloBacheca,
): EsitoBacheca {
  const lista: Interpello[] = [];
  let righeNonOpportunita = 0;
  let senzaScadenza = 0;
  let esclusiBlacklist = 0;
  let forzate = 0;
  /** §26.144 — l'unico scarto di merito: due temi noti che non si toccano. */
  let senzaAffinitaClasse = 0;
  /** §26.144 — righe fuori dal perimetro: province scelte + raggio dei 60 km. */
  let fuoriPerimetro = 0;
  /** §26.148 — righe SBARRATE: terzo gradino di ordine (infanzia ↔ superiori). */
  let esclusiOrdineEstremo = 0;
  /** §26.131 — righe che parlano di sostegno senza dichiarare un reclutamento. */
  let sostegnoAmbiguoScartato = 0;
  /** §26.144 — righe entrate per MERITO (sostegno/ATA nell'ordine scelto, classe ≥ 85). */
  let meritoInBacheca = 0;
  /** §26.144 — righe entrate per TOLLERANZA (grado affine o ponte disciplinare). */
  let tolleranzaInBacheca = 0;
  /** §26.144 — righe entrate di RISERVA (sostegno/ATA d'altro ordine, classe ignota). */
  let riserveInBacheca = 0;
  /** §26.145 — righe sotto la soglia del fondo: restano, ma la card le dichiara. */
  let fondoInBacheca = 0;
  /** §26.150 — la principale del profilo: centro del raggio che va DICHIARATO sulla riga. */
  const principale = provinciaPrincipale(profilo.province);

  for (const i of fonti) {
    // §26.71 — REGOLA FERREA: senza una scadenza dichiarata e non ancora passata la riga
    // NON è un'opportunità. Prima di ogni punteggio e di ogni porta d'ingresso: le pagine
    // di archivio e gli indici di classi non devono né entrare né consumare quota.
    if (!eOpportunitaConScadenza(i.dataScadenza)) {
      senzaScadenza += 1;
      continue;
    }
    // §26.65 — la riga è un AVVISO? Le voci di contorno (titoli di sezione, indici di
    // classi, numeri di protocollo) escono PRIMA di ogni punteggio: senza questo filtro
    // entravano in bacheca con punteggi piatti e finivano nei suggerimenti del campo scuola.
    if (motivoRigaNonOpportunitaAvviso(i) !== null) {
      righeNonOpportunita += 1;
      continue;
    }

    const avviso = avvisoDaInterpello(i);
    // §26.131 — TERZO STATO DEL SOSTEGNO: la riga parla di sostegno ma non dichiara un
    // reclutamento («piano di sostegno didattico», «progetto sostegno»). Non è una
    // cattedra: esce qui, prima del punteggio, e non entra nemmeno di riserva.
    if (sostegnoAmbiguo(avviso)) {
      sostegnoAmbiguoScartato += 1;
      continue;
    }

    // MODALITÀ 5 — la blacklist oscura, la whitelist include d'ufficio.
    const scuole = giudizioScuole(profilo, i);
    if (scuole.escluso) {
      esclusiBlacklist += 1;
      continue;
    }

    // §26.144 — PERIMETRO GEOGRAFICO: province scelte + raggio dei 60 km. È l'unico
    // sbarramento rigido della bacheca; `scala.provincia` alimenta la cascata (propria,
    // vicina, non-applicabile) e `scala.ammessa` è il verdetto secco. Il match PIENO del
    // jolly semantico (§26.64) resta l'unica apertura oltre il raggio, com'era.
    const scala = scalaParacadute(profilo, avviso);
    const valutazione = valutaCompatibilita(profilo, avviso, {
      provinceLimitrofe: true,
      forzata: scuole.preferita,
    });
    const jollyPieno = valutazione.jollySemantico !== null;
    if (!scala.ammessa && !scuole.preferita && !jollyPieno) {
      fuoriPerimetro += 1;
      continue;
    }

    // §26.144 — CASCATA: come la riga si guadagna la bacheca (merito · tolleranza · riserva).
    const voce = voceCascata(profilo, avviso, scala.provincia);
    // §26.148 — SBARRAMENTO DI ORDINE: al terzo gradino (infanzia ↔ superiori) la riga non è
    // un match basso, è un altro mestiere: non si mostra, non si conta fra le riserve, non
    // finisce in coda. La whitelist resta l'unica eccezione (l'utente ha chiesto quella scuola).
    if (voce.escluso && !scuole.preferita) {
      esclusiOrdineEstremo += 1;
      continue;
    }
    if (voce.fascia === 'incompatibile' && !scuole.preferita) {
      senzaAffinitaClasse += 1;
      continue;
    }
    // Profilo senza classi (solo competenze o parole chiave): la cascata non giudica e
    // l'ingresso resta quello del motore — conferma per competenza o match pieno del jolly.
    if (voce.fascia === 'motore' && !scuole.preferita) {
      const confermato =
        jollyPieno || avvisoCompatibileConProfilo(profilo, avviso, { provinceLimitrofe: true }).ok;
      if (!confermato) {
        senzaAffinitaClasse += 1;
        continue;
      }
    }

    if (scuole.preferita) forzate += 1;
    if (voce.fascia === 'merito') meritoInBacheca += 1;
    else if (voce.fascia === 'tolleranza') tolleranzaInBacheca += 1;
    else if (voce.fascia === 'riserva') riserveInBacheca += 1;
    // §26.145 — la riga resta (è nella zona dell'utente) ma è dichiarata «Fondo Convento».
    if (voce.fondo) fondoInBacheca += 1;

    // RISERVA: il voto è quello dichiarato dalla cascata (50-60). Le modali del motore
    // misurerebbero qui il «salto» di ordine e la classe estranea, non l'affinità.
    // MERITO e TOLLERANZA: pavimento della cascata, mai sotto il voto del motore.
    // §26.145 — se la DISTANZA DAL PROFILO ha abbassato il voto (`tetto`), quel numero è
    // un limite: il motore non misura la distanza di ordine, quindi non può rialzarlo.
    const punteggio =
      voce.fascia === 'riserva' || voce.tetto
        ? voce.punteggio
        : Math.max(valutazione.punteggio, voce.punteggio);
    // Il tooltip spiega il numero MOSTRATO: se il voto non è quello del motore (o se il
    // motore aveva escluso la riga) i suoi motivi descriverebbero un altro numero.
    const motivi = punteggio === valutazione.punteggio && !valutazione.escluso ? undefined : [];

    // §26.150 — LA RIGA DICHIARA IL PERIMETRO. Una riga ammessa SOLO dal raggio (province
    // scelte + 60 km) non sta nella zona che l'utente ha scelto e non deve sembrare un match
    // pieno: il motivo dice che è vicina, fuori dalle province scelte e a quanti chilometri.
    // È la stessa frase del perimetro dichiarato accanto al conteggio (`lib/perimetroRicerca`),
    // in forma di tooltip: così il numero della bacheca si può spiegare riga per riga.
    const kmVicina = scala.provincia === 'vicina' ? distanzaKm(principale, avviso.province) : null;
    const dichiarazioneArea =
      scala.provincia === 'vicina'
        ? kmVicina === null
          ? 'provincia vicina: fuori dalle province scelte'
          : `provincia vicina: fuori dalle province scelte (${kmVicina} km da ${principale})`
        : '';

    lista.push(
      rigaInBacheca(i, valutazione, {
        punteggio,
        scuolaPreferita: scuole.preferita,
        motivoInPiu: [voce.etichetta, dichiarazioneArea].filter(Boolean).join(' · ') || undefined,
        motivi,
      }),
    );
  }

  return {
    lista,
    righeNonOpportunita,
    senzaScadenza,
    esclusiBlacklist,
    forzate,
    senzaAffinitaClasse,
    fuoriPerimetro,
    esclusiOrdineEstremo,
    sostegnoAmbiguoScartato,
    meritoInBacheca,
    tolleranzaInBacheca,
    riserveInBacheca,
    fondoInBacheca,
  };
}
